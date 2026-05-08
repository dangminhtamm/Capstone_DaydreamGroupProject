import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchRequestDto } from './dto/search-request.dto';
import type { SearchResponseDto } from './dto/search-response.dto';

/**
 * POST /search
 *
 * Accepts a natural language question and optional filters,
 * runs the full RAG pipeline, and returns an AI-generated answer
 * with traceable source citations.
 *
 * Example request:
 * ```json
 * {
 *   "query": "What did I decide about the sprint?",
 *   "userId": "uuid-of-the-user",
 *   "chunkType": "decision",
 *   "topK": 8
 * }
 * ```
 *
 * Example response:
 * ```json
 * {
 *   "answer": "You decided to postpone the notification redesign [Source 1].",
 *   "sources": [
 *     {
 *       "id": "chunk-uuid",
 *       "chunkType": "decision",
 *       "text": "we agreed to postpone the notification redesign until next sprint",
 *       "sourceType": "diary_entry",
 *       "sourceId": "diary-uuid",
 *       "date": "2025-01-15",
 *       "similarity": 0.9123
 *     }
 *   ],
 *   "generatedAt": "2025-01-28T00:00:00.000Z"
 * }
 * ```
 */
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchRequestDto): Promise<SearchResponseDto> {
    this.logger.log(`POST /search — query="${dto.query}" user=${dto.userId}`);

    try {
      return await this.searchService.search(dto);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error during search';
      this.logger.error(`Search failed: ${message}`);
      throw new BadRequestException(message);
    }
  }
}
