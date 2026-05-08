import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
  GeminiEmbeddingProvider,
  processQuery,
  type SearchResult,
} from '@second-brain/ai';
import {
  createPrismaClient,
  vectorSearch,
  type VectorSearchOptions,
} from '@second-brain/db';
import type { SearchRequestDto } from './dto/search-request.dto';
import type { SearchResponseDto, SourceDto } from './dto/search-response.dto';

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);

  /** Shared Prisma client — created once when the module starts. */
  private prisma = createPrismaClient();

  /** Gemini embedding provider — reused across requests. */
  private embedder: GeminiEmbeddingProvider;

  onModuleInit(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required for SearchService.',
      );
    }
    this.embedder = new GeminiEmbeddingProvider(apiKey);
    this.logger.log('SearchService initialised — Gemini embedder ready.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Full RAG pipeline for one search request:
   *
   * 1. Build VectorSearchOptions from the request DTO (user-scoped + filters)
   * 2. Create a searchFn that calls vectorSearch with those options
   * 3. Delegate to processQuery() — embed → retrieve → generate answer
   * 4. Map the result into the SearchResponseDto shape
   */
  async search(dto: SearchRequestDto): Promise<SearchResponseDto> {
    const {
      query,
      userId,
      chunkType,
      sourceType,
      dateFrom,
      dateTo,
      topK = 6,
      minSimilarity = 0.4,
    } = dto;

    this.logger.debug(
      `Search request — user=${userId} query="${query}" topK=${topK}`,
    );

    // Build the vector search options
    const searchOptions: VectorSearchOptions = {
      userId,
      chunkType,
      sourceType,
      dateFrom,
      dateTo,
      topK,
      minSimilarity,
    };

    // searchFn injects the DB + options — processQuery stays decoupled from DB
    const searchFn = (embedding: number[]) =>
      vectorSearch(this.prisma, embedding, searchOptions);

    const { answer, sources } = await processQuery({
      query,
      embeddingProvider: this.embedder,
      searchFn,
      apiKey: process.env.GEMINI_API_KEY,
    });

    return {
      answer,
      sources: sources.map((s) => this.toSourceDto(s)),
      generatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toSourceDto(result: SearchResult): SourceDto {
    const date =
      typeof result.metadata['date'] === 'string'
        ? result.metadata['date']
        : result.createdAt.toISOString().slice(0, 10);

    return {
      id: result.id,
      chunkType: result.chunkType,
      text: result.text,
      sourceType: result.sourceType,
      sourceId: result.sourceId,
      date,
      similarity: Math.round(result.similarity * 10000) / 10000,
    };
  }
}
