import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { answerMemory } from '@second-brain/ai';
import {
  saveSearchHistory,
  findCachedAnswer,
  getUserSearchHistory,
  deleteSearchHistoryItem,
  clearUserSearchHistory,
} from '@second-brain/db';
import {
  getCachedSearchAnswer,
  setCachedSearchAnswer,
} from '../../common/cache/search-answer-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

const DEFAULT_SEARCH_LIMIT = 8;

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
    const timeZone = queryDto.timeZone?.trim() || undefined;

    // ── Live search ──
    try {
      const includeDebugTrace = this.debugTraceEnabled(user.id);

      if (this.canUseExactAnswerCache(queryDto) && !includeDebugTrace) {
        const redisCached = await getCachedSearchAnswer({
          userId: user.id,
          question: normalizedQuestion,
          responseLanguage: lang,
          timeZone,
        });

        if (redisCached && this.isCacheableCachedAnswer(redisCached)) {
          return {
            ...redisCached,
            debugTrace: null,
            cached: true,
            answerMode: 'cache',
            cacheStorage: 'redis',
          };
        } else if (redisCached) {
          console.warn('Skipping stale/unsafe Redis search cache entry.');
        }

        const cached = timeZone
          ? null
          : await findCachedAnswer(
              this.prisma,
              user.id,
              normalizedQuestion,
              lang,
            );

        if (cached) {
          const cachedAnalytics = this.parseJsonObject(cached.analytics_json);
          if (!this.isCacheableStoredAnswer(cachedAnalytics, cached.answer)) {
            console.warn('Skipping stale/unsafe search cache entry with fallback or model error.');
          } else {
            return {
              answer: cached.answer,
              confidence: cached.confidence,
              sources: this.parseJsonArray(cached.sources_json),
              noMemory: false,
              suggestions: [],
              analytics: cachedAnalytics,
              debugTrace: null,
              cached: true,
              answerMode: 'cache',
              cacheStorage: 'database',
            };
          }
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
        limit: queryDto.limit ?? DEFAULT_SEARCH_LIMIT,
        maxDistance: queryDto.maxDistance,
        responseLanguage: lang,
        answerStrategy: queryDto.answerStrategy ?? 'auto',
        timeZone,
        filters,
      });

      const answerMode = result.answerMode ?? result.analytics?.answerMode ?? 'gemini';
      const response = {
        answer: result.answer,
        confidence: result.confidence,
        sources: result.citations,
        noMemory: result.noMemory ?? false,
        suggestions: result.suggestions ?? [],
        analytics: result.analytics ?? null,
        modelError: result.modelError ?? null,
        answerMode,
        debugTrace: includeDebugTrace ? (result.debugTrace ?? null) : null,
        cached: false,
      };

      // ── Persist to search history (async, non-blocking) ──
      if (
        this.canUseExactAnswerCache(queryDto) &&
        !includeDebugTrace &&
        this.isCacheableLiveResult(result, answerMode)
      ) {
        setCachedSearchAnswer(
          {
            userId: user.id,
            question: normalizedQuestion,
            responseLanguage: lang,
            timeZone,
          },
          {
            answer: result.answer,
            confidence: result.confidence,
            sources: result.citations ?? [],
            noMemory: result.noMemory ?? false,
            suggestions: result.suggestions ?? [],
            analytics: result.analytics ?? null,
            answerMode,
            modelError: result.modelError ?? null,
          },
        ).catch((err) => {
          console.warn('Failed to save Redis search cache (non-fatal):', err);
        });
      }

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
      queryDto.maxDistance ||
      !this.isDefaultAnswerStrategy(queryDto.answerStrategy) ||
      !this.isDefaultSearchLimit(queryDto.limit)
    );
  }

  private isDefaultSearchLimit(limit: number | undefined) {
    return limit === undefined || limit === DEFAULT_SEARCH_LIMIT;
  }

  private isDefaultAnswerStrategy(strategy: SearchQueryDto['answerStrategy']) {
    return strategy === undefined || strategy === 'auto';
  }

  private isCacheableLiveResult(
    result: {
      answer?: string;
      modelError?: unknown;
      noMemory?: boolean;
      analytics?: { status?: string; answerMode?: string } | null;
    },
    answerMode: string,
  ) {
    return (
      !this.isLikelyIncompleteAnswer(result.answer) &&
      !result.modelError &&
      result.noMemory !== true &&
      result.analytics?.status === 'success' &&
      ['gemini', 'fast_path'].includes(answerMode)
    );
  }

  private isCacheableCachedAnswer(value: {
    modelError?: unknown;
    noMemory?: boolean;
    answerMode?: string;
    answer?: string;
    analytics?: unknown;
  }) {
    if (this.isLikelyIncompleteAnswer(value.answer)) return false;
    if (value.modelError || value.noMemory === true) return false;

    const analyticsAnswerMode = this.getAnalyticsAnswerMode(value.analytics);
    const answerMode = value.answerMode === 'cache' ? analyticsAnswerMode : value.answerMode;
    return ['gemini', 'fast_path'].includes(answerMode ?? '');
  }

  private isCacheableStoredAnswer(analytics: Record<string, unknown> | null, answer?: string) {
    if (this.isLikelyIncompleteAnswer(answer)) return false;
    if (!analytics) return false;

    const status = typeof analytics.status === 'string' ? analytics.status : undefined;
    const answerMode = this.getAnalyticsAnswerMode(analytics);
    return status === 'success' && ['gemini', 'fast_path'].includes(answerMode ?? '');
  }

  private getAnalyticsAnswerMode(analytics: unknown) {
    if (!analytics || typeof analytics !== 'object') return undefined;

    const answerMode = (analytics as { answerMode?: unknown }).answerMode;
    return typeof answerMode === 'string' ? answerMode : undefined;
  }

  private isLikelyIncompleteAnswer(answer: unknown) {
    if (typeof answer !== 'string') return false;

    const trimmed = answer.replace(/\s+/g, ' ').trim();
    if (!trimmed) return true;

    const hasTerminalPunctuation = /[.!?…。！？]$/u.test(trimmed);
    const normalized = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean);
    const lastWord = words.at(-1) ?? '';

    if (!hasTerminalPunctuation && lastWord.length <= 1) return true;
    if (
      !hasTerminalPunctuation &&
      /\b(?:to claim|claim|because|because of|due to|in order to|so that|such as|for example|including|include)$/iu.test(normalized)
    ) {
      return true;
    }

    return /\b(?:minh|ban|ve|vi|boi|any|about|because|the|a|an|is|are|was|were|to|for|of|and|or)$/iu.test(normalized);
  }

  private debugTraceEnabled(userId?: string) {
    // Per-user debug mode: check TRUSTED_DEBUG_USERS env var
    const trustedUsers = process.env.TRUSTED_DEBUG_USERS?.split(',').map((u) => u.trim()).filter(Boolean) ?? [];
    if (userId && trustedUsers.length > 0) {
      return trustedUsers.includes(userId);
    }

    // Fallback to global toggle
    const configured = process.env.MEMORY_DEBUG_TRACE?.toLowerCase();
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    return process.env.NODE_ENV !== 'production';
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
