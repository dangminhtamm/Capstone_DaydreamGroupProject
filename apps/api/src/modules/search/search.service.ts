import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { answerMemory } from '@second-brain/ai';
import {
  saveSearchHistory,
  findCachedAnswer,
  getUserSearchHistory,
  deleteSearchHistoryItem,
  clearUserSearchHistory,
} from '@second-brain/db';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async answerQuestion(userId: string, queryDto: SearchQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedQuestion = queryDto.question.trim();
    const lang = queryDto.responseLanguage ?? 'en';

    // ── Live search ──
    try {
      if (this.canUseExactAnswerCache(queryDto)) {
        const cached = await findCachedAnswer(
          this.prisma,
          user.id,
          normalizedQuestion,
          lang,
        );

        if (cached) {
          return {
            answer: cached.answer,
            confidence: cached.confidence,
            sources: this.parseJsonArray(cached.sources_json),
            noMemory: false,
            suggestions: [],
            analytics: this.parseJsonObject(cached.analytics_json),
            debugTrace: null,
            cached: true,
          };
        }
      }

      const filters: {
        chunkType?: string;
        sourceType?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};
      if (queryDto.chunkType) filters.chunkType = queryDto.chunkType;
      if (queryDto.sourceType) filters.sourceType = queryDto.sourceType;
      if (queryDto.startDate) filters.startDate = new Date(queryDto.startDate);
      if (queryDto.endDate) filters.endDate = new Date(queryDto.endDate);

      const result = await answerMemory(normalizedQuestion, user.id, this.prisma, {
        limit: queryDto.limit ?? 8,
        maxDistance: queryDto.maxDistance,
        responseLanguage: lang,
        filters,
      });

      const response = {
        answer: result.answer,
        confidence: result.confidence,
        sources: result.citations,
        noMemory: result.noMemory ?? false,
        suggestions: result.suggestions ?? [],
        analytics: result.analytics ?? null,
        debugTrace: this.debugTraceEnabled() ? (result.debugTrace ?? null) : null,
        cached: false,
      };

      // ── Persist to search history (async, non-blocking) ──
      saveSearchHistory(this.prisma, {
        userId: user.id,
        question: normalizedQuestion,
        answer: result.answer,
        confidence: result.confidence,
        sourcesJson: result.citations?.length ? JSON.stringify(result.citations) : null,
        analyticsJson: result.analytics ? JSON.stringify(result.analytics) : null,
        responseLanguage: lang,
        tokenCount: result.analytics?.tokenUsage?.totalTokens ?? 0,
      }).catch((err) => {
        console.warn('Failed to save search history (non-fatal):', err);
      });

      return response;
    } catch (error) {
      console.error('Failed to answer memory search question:', error);
      throw new InternalServerErrorException('Failed to answer memory search question.');
    }
  }

  async getHistory(userId: string, limit: number = 20) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return getUserSearchHistory(this.prisma, user.id, limit);
  }

  async deleteHistoryItem(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return deleteSearchHistoryItem(this.prisma, user.id, id);
  }

  async clearHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return clearUserSearchHistory(this.prisma, user.id);
  }

  private canUseExactAnswerCache(queryDto: SearchQueryDto) {
    return !(
      queryDto.chunkType ||
      queryDto.sourceType ||
      queryDto.startDate ||
      queryDto.endDate ||
      queryDto.limit ||
      queryDto.maxDistance
    );
  }

  private debugTraceEnabled() {
    return process.env.MEMORY_DEBUG_TRACE === 'true';
  }

  private parseJsonArray(value: string | null | undefined) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parseJsonObject(value: string | null | undefined) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
}
