import { hashRedisKey, redisClient } from '../redis/redis-client';

export type CachedSearchAnswer = {
  answer: string;
  confidence: string;
  sources: unknown[];
  noMemory: boolean;
  suggestions: string[];
  analytics: unknown;
  answerMode?: string;
  modelError?: unknown;
};

const DEFAULT_SEARCH_CACHE_TTL_SECONDS = 10 * 60;

export async function getCachedSearchAnswer(input: {
  userId: string;
  question: string;
  responseLanguage: string;
  timeZone?: string | null;
  cacheVersion: string;
}): Promise<CachedSearchAnswer | null> {
  if (!isSearchRedisCacheEnabled()) return null;

  try {
    const value = await redisClient.get(await buildSearchCacheKey(input));
    if (!value) return null;

    const parsed = JSON.parse(value);
    return isCachedSearchAnswer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setCachedSearchAnswer(
  input: {
    userId: string;
    question: string;
    responseLanguage: string;
    timeZone?: string | null;
    cacheVersion: string;
  },
  value: CachedSearchAnswer,
) {
  if (!isSearchRedisCacheEnabled()) return;

  try {
    await redisClient.setEx(
      await buildSearchCacheKey(input),
      getSearchCacheTtlSeconds(),
      JSON.stringify(value),
    );
  } catch {
    // Redis is an optimization. Search history remains the durable fallback.
  }
}

export async function invalidateUserSearchCache(userId: string) {
  if (!isSearchRedisCacheEnabled()) return;

  try {
    await redisClient.incr(userCacheVersionKey(userId));
  } catch {
    // Non-fatal: cache entries have a short TTL and DB cache is explicitly expired.
  }
}

export function getSearchCacheStatus() {
  return {
    enabled: isSearchRedisCacheEnabled(),
    storage: redisClient.isConfigured() && redisClient.isConnected() ? 'redis' : 'database-fallback',
    ttlSeconds: getSearchCacheTtlSeconds(),
    redisConfigured: redisClient.isConfigured(),
    redisConnected: redisClient.isConnected(),
  };
}

async function buildSearchCacheKey(input: {
  userId: string;
  question: string;
  responseLanguage: string;
  timeZone?: string | null;
  cacheVersion: string;
}) {
  const version = await getUserSearchCacheVersion(input.userId);
  const digest = hashRedisKey(
    JSON.stringify({
      userId: input.userId,
      question: input.question.trim(),
      responseLanguage: input.responseLanguage,
      timeZone: input.timeZone?.trim() || null,
      cacheVersion: input.cacheVersion,
      version,
    }),
  );

  return `sb:search-answer:${digest}`;
}

async function getUserSearchCacheVersion(userId: string) {
  try {
    return (await redisClient.get(userCacheVersionKey(userId))) ?? '0';
  } catch {
    return '0';
  }
}

function userCacheVersionKey(userId: string) {
  return `sb:search-answer-version:${userId}`;
}

function isSearchRedisCacheEnabled() {
  return process.env.SEARCH_REDIS_CACHE_ENABLED !== 'false' && redisClient.isConfigured();
}

function getSearchCacheTtlSeconds() {
  const configured = Number(process.env.SEARCH_CACHE_TTL_SECONDS ?? DEFAULT_SEARCH_CACHE_TTL_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_SEARCH_CACHE_TTL_SECONDS;
  return Math.min(Math.max(Math.floor(configured), 30), 24 * 60 * 60);
}

function isCachedSearchAnswer(value: unknown): value is CachedSearchAnswer {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.answer === 'string' &&
    typeof record.confidence === 'string' &&
    Array.isArray(record.sources)
  );
}
