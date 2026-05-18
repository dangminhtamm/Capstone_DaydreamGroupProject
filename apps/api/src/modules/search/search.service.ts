import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { answerMemory, answerMemoryStream } from '@second-brain/ai';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

type SearchResponse = {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: unknown[];
};

type ResolvedDateRange = {
  label: string;
  startDate: Date;
  endDate: Date;
};

const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS ?? 15000);
const DEFAULT_TIMEZONE_OFFSET_MINUTES = Number(
  process.env.MEMORY_TIMEZONE_OFFSET_MINUTES ?? 420,
);

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private prisma: PrismaService) {}

  async answerQuestion(
    userId: string,
    queryDto: SearchQueryDto,
  ): Promise<SearchResponse> {
    const requestId = this.createRequestId();
    const user = await this.resolveUser(userId);
    const question = queryDto.question?.trim() ?? '';
    const dateRange = this.resolveDateRange(queryDto);

    try {
      this.logger.log(
        `[${requestId}] Memory search started for user ${user.id}`,
      );
      this.logDateRange(requestId, dateRange, queryDto);

      if (!(await this.hasSearchableMemory(user.id, queryDto.sourceType))) {
        this.logger.log(`[${requestId}] No searchable memory chunks found`);
        if (dateRange) {
          const diaryFallback = await this.answerFromDiaryEntries(
            user.id,
            dateRange,
          );

          if (diaryFallback) {
            this.logger.log(
              `[${requestId}] Returned diary-entry fallback without memory chunks for ${dateRange.label}`,
            );
            return diaryFallback;
          }
        }

        return this.fallbackResponse(
          'No saved memories are available yet. Add a diary entry or sync calendar first.',
        );
      }

      const result = await withTimeout(
        answerMemory(
          question,
          user.id,
          this.prisma,
          this.buildAnswerOptions(queryDto, dateRange),
        ),
        SEARCH_TIMEOUT_MS,
        'Memory search timed out',
      );

      if (dateRange && result.citations.length === 0) {
        const diaryFallback = await this.answerFromDiaryEntries(
          user.id,
          dateRange,
        );

        if (diaryFallback) {
          this.logger.log(
            `[${requestId}] Returned diary-entry fallback for ${dateRange.label}`,
          );
          return diaryFallback;
        }
      }

      this.logger.log(
        `[${requestId}] Memory search completed with ${result.citations.length} source(s)`,
      );

      return {
        answer: result.answer || 'No answer could be generated from memory.',
        confidence: result.confidence,
        sources: result.citations ?? [],
      };
    } catch (error) {
      this.logger.error(
        `[${requestId}] Memory search failed: ${this.describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      return this.fallbackResponse(
        'Memory search is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  /**
   * Streaming variant: returns a structured object with the Gemini stream
   * and pre-resolved citations. The controller will convert this into SSE.
   */
  async answerQuestionStream(userId: string, queryDto: SearchQueryDto) {
    const requestId = this.createRequestId();
    const user = await this.resolveUser(userId);
    const question = queryDto.question?.trim() ?? '';
    const dateRange = this.resolveDateRange(queryDto);

    try {
      this.logger.log(
        `[${requestId}] Streaming memory search started for user ${user.id}`,
      );
      this.logDateRange(requestId, dateRange, queryDto);

      if (!(await this.hasSearchableMemory(user.id, queryDto.sourceType))) {
        this.logger.log(`[${requestId}] No searchable memory chunks found`);
        if (dateRange) {
          const diaryFallback = await this.answerFromDiaryEntries(
            user.id,
            dateRange,
          );

          if (diaryFallback) {
            this.logger.log(
              `[${requestId}] Returned streaming diary-entry fallback without memory chunks for ${dateRange.label}`,
            );
            return {
              stream: textToStream(diaryFallback.answer),
              citations: diaryFallback.sources,
              confidence: diaryFallback.confidence,
              noMemory: false,
            };
          }
        }

        return this.streamFallback(
          'No saved memories are available yet. Add a diary entry or sync calendar first.',
        );
      }

      const result = await withTimeout(
        answerMemoryStream(
          question,
          user.id,
          this.prisma,
          this.buildAnswerOptions(queryDto, dateRange),
        ),
        SEARCH_TIMEOUT_MS,
        'Streaming memory search timed out',
      );

      if (dateRange && result.citations.length === 0) {
        const diaryFallback = await this.answerFromDiaryEntries(
          user.id,
          dateRange,
        );

        if (diaryFallback) {
          this.logger.log(
            `[${requestId}] Returned streaming diary-entry fallback for ${dateRange.label}`,
          );
          return {
            stream: textToStream(diaryFallback.answer),
            citations: diaryFallback.sources,
            confidence: diaryFallback.confidence,
            noMemory: false,
          };
        }
      }

      return result;
    } catch (error) {
      this.logger.error(
        `[${requestId}] Streaming memory search failed: ${this.describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      return this.streamFallback(
        'Memory search is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async hasSearchableMemory(userId: string, sourceType?: string) {
    const count = await this.prisma.memoryChunk.count({
      where: {
        userId,
        ...(sourceType && { sourceType }),
      },
    });

    return count > 0;
  }

  private buildAnswerOptions(
    queryDto: SearchQueryDto,
    dateRange: ResolvedDateRange | null,
  ) {
    return {
      limit: queryDto.limit ?? 8,
      maxDistance: queryDto.maxDistance,
      filters: {
        chunkType: queryDto.chunkType,
        sourceType: queryDto.sourceType,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      },
    };
  }

  private resolveDateRange(queryDto: SearchQueryDto): ResolvedDateRange | null {
    if (queryDto.startDate || queryDto.endDate) {
      return {
        label: 'explicit',
        startDate: queryDto.startDate
          ? new Date(queryDto.startDate)
          : new Date(0),
        endDate: queryDto.endDate ? new Date(queryDto.endDate) : new Date(),
      };
    }

    return inferRelativeDateRange(queryDto.question);
  }

  private logDateRange(
    requestId: string,
    range: ResolvedDateRange | null,
    queryDto: SearchQueryDto,
  ) {
    if (!range) return;

    const source =
      queryDto.startDate || queryDto.endDate ? 'explicit' : 'inferred relative';

    this.logger.log(
      `[${requestId}] Using ${source} date range ${range.label}: ${range.startDate.toISOString()} -> ${range.endDate.toISOString()}`,
    );
  }

  private async answerFromDiaryEntries(
    userId: string,
    range: ResolvedDateRange,
  ): Promise<SearchResponse | null> {
    const entries = await this.prisma.diaryEntry.findMany({
      where: {
        user_id: userId,
        OR: [
          {
            created_at: {
              gte: range.startDate,
              lte: range.endDate,
            },
          },
          {
            entry_date: {
              gte: range.startDate,
              lte: range.endDate,
            },
          },
        ],
      },
      orderBy: { created_at: 'asc' },
    });

    if (!entries.length) return null;

    const label =
      range.label === 'today'
        ? 'hôm nay'
        : range.label === 'yesterday'
          ? 'hôm qua'
          : range.label === 'tomorrow'
            ? 'ngày mai'
            : 'trong khoảng thời gian này';

    const answer = `Dựa trên nhật ký ${label}, bạn đã ghi: ${entries
      .map((entry) => this.toDiarySummary(entry.raw_text))
      .join(' ')}`;

    return {
      answer,
      confidence: 'medium',
      sources: entries.map((entry, index) => ({
        marker: `D${index + 1}`,
        chunkId: entry.id,
        sourceType: 'diary',
        sourceId: entry.id,
        sourceTitle: this.extractDiaryTitle(entry.raw_text),
        occurredAt: entry.created_at.toISOString(),
        chunkType: 'diary_entry',
        quote: this.extractDiaryContent(entry.raw_text),
        similarity: 1,
        retrievalMode: 'diary-date-fallback',
      })),
    };
  }

  private extractDiaryTitle(rawText: string) {
    return rawText.split('\n\n')[0]?.trim() || 'Diary entry';
  }

  private extractDiaryContent(rawText: string) {
    const [, ...contentParts] = rawText.split('\n\n');
    return (contentParts.join('\n\n') || rawText).trim();
  }

  private toDiarySummary(rawText: string) {
    const title = this.extractDiaryTitle(rawText);
    const content = this.extractDiaryContent(rawText);
    return `"${title}": ${content}`;
  }

  private fallbackResponse(answer: string): SearchResponse {
    return {
      answer,
      confidence: 'low',
      sources: [],
    };
  }

  private streamFallback(answer: string) {
    return {
      stream: textToStream(answer),
      citations: [],
      confidence: 'low' as const,
      noMemory: true,
    };
  }

  private createRequestId() {
    return Math.random().toString(36).slice(2, 10);
  }

  private describeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function textToStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

function inferRelativeDateRange(question: string | undefined): {
  label: string;
  startDate: Date;
  endDate: Date;
} | null {
  const normalized = normalizeVietnamese(question ?? '');
  const offsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES;
  const today = getLocalDateParts(new Date(), offsetMinutes);

  if (/\b(hom nay|today)\b/.test(normalized)) {
    return buildDayRange('today', today, offsetMinutes);
  }

  if (/\b(hom qua|yesterday)\b/.test(normalized)) {
    return buildDayRange('yesterday', addDays(today, -1), offsetMinutes);
  }

  if (/\b(ngay mai|tomorrow)\b/.test(normalized)) {
    return buildDayRange('tomorrow', addDays(today, 1), offsetMinutes);
  }

  return null;
}

function buildDayRange(
  label: string,
  date: { year: number; month: number; day: number },
  offsetMinutes: number,
) {
  const startMs =
    Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0) -
    offsetMinutes * 60_000;
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1;

  return {
    label,
    startDate: new Date(startMs),
    endDate: new Date(endMs),
  };
}

function getLocalDateParts(date: Date, offsetMinutes: number) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function addDays(
  date: { year: number; month: number; day: number },
  days: number,
) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function normalizeVietnamese(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
