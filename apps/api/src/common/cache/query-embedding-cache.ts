import {
  DEFAULT_EMBEDDING_DIMENSION,
  TUTURUUU_EMBEDDING_MODEL,
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from '@second-brain/ai';
import { hashRedisKey, redisClient } from '../redis/redis-client';

const DEFAULT_QUERY_EMBEDDING_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

type QueryEmbedder = Pick<AdvancedEmbeddingProvider, 'embedQuery'>;
type QueryEmbeddingCacheClient = Pick<
  typeof redisClient,
  'get' | 'setEx' | 'del' | 'isConfigured' | 'isConnected'
>;

type CachedQueryEmbedding = {
  model: string;
  dimension: number;
  embedding: number[];
};

export class RedisCachedQueryEmbeddingProvider implements QueryEmbedder {
  private readonly inFlight = new Map<string, Promise<number[]>>();

  constructor(
    private readonly delegate: QueryEmbedder,
    private readonly cache: QueryEmbeddingCacheClient = redisClient,
  ) {}

  async embedQuery(text: string): Promise<number[]> {
    const normalized = normalizeQuery(text);
    if (!normalized) return this.delegate.embedQuery(text);
    if (!this.isEnabled()) return this.delegate.embedQuery(text);

    const key = buildQueryEmbeddingCacheKey(normalized);
    const inFlight = this.inFlight.get(key);
    if (inFlight) return inFlight;

    const operation = this.getOrCreateEmbedding(key, text);
    this.inFlight.set(key, operation);

    try {
      return await operation;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async getOrCreateEmbedding(key: string, text: string) {
    try {
      const rawCached = await this.cache.get(key);
      const cached = parseCachedEmbedding(rawCached);
      if (cached) return cached;
      if (rawCached) await this.cache.del(key).catch(() => undefined);
    } catch {
      return this.delegate.embedQuery(text);
    }

    const embedding = await this.delegate.embedQuery(text);
    if (!isValidEmbedding(embedding)) return embedding;

    const payload: CachedQueryEmbedding = {
      model: TUTURUUU_EMBEDDING_MODEL,
      dimension: DEFAULT_EMBEDDING_DIMENSION,
      embedding,
    };

    try {
      await this.cache.setEx(key, getQueryEmbeddingCacheTtlSeconds(), JSON.stringify(payload));
    } catch {
      // Redis is an optimization; the delegate keeps its process-local LRU fallback.
    }

    return embedding;
  }

  private isEnabled() {
    return process.env.QUERY_EMBEDDING_REDIS_CACHE_ENABLED !== 'false' &&
      this.cache.isConfigured();
  }
}

let defaultProvider: QueryEmbedder | null = null;

export function getQueryEmbeddingProvider(): QueryEmbedder {
  defaultProvider ??= new RedisCachedQueryEmbeddingProvider(
    createDefaultEmbeddingProvider(),
  );
  return defaultProvider;
}

export function getQueryEmbeddingCacheStatus() {
  return {
    enabled:
      process.env.QUERY_EMBEDDING_REDIS_CACHE_ENABLED !== 'false' &&
      redisClient.isConfigured(),
    storage:
      redisClient.isConfigured() && redisClient.isConnected()
        ? 'redis-with-local-fallback'
        : 'local-lru-fallback',
    ttlSeconds: getQueryEmbeddingCacheTtlSeconds(),
    model: TUTURUUU_EMBEDDING_MODEL,
    dimension: DEFAULT_EMBEDDING_DIMENSION,
  };
}

function buildQueryEmbeddingCacheKey(normalizedQuery: string) {
  const digest = hashRedisKey(
    JSON.stringify({
      query: normalizedQuery,
      model: TUTURUUU_EMBEDDING_MODEL,
      dimension: DEFAULT_EMBEDDING_DIMENSION,
    }),
  );
  return `sb:query-embedding:${digest}`;
}

function normalizeQuery(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseCachedEmbedding(value: string | null): number[] | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<CachedQueryEmbedding>;
    if (
      parsed.model !== TUTURUUU_EMBEDDING_MODEL ||
      parsed.dimension !== DEFAULT_EMBEDDING_DIMENSION ||
      !isValidEmbedding(parsed.embedding)
    ) {
      return null;
    }
    return parsed.embedding;
  } catch {
    return null;
  }
}

function isValidEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.length === DEFAULT_EMBEDDING_DIMENSION &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function getQueryEmbeddingCacheTtlSeconds() {
  const configured = Number(
    process.env.QUERY_EMBEDDING_CACHE_TTL_SECONDS ??
      DEFAULT_QUERY_EMBEDDING_CACHE_TTL_SECONDS,
  );
  if (!Number.isFinite(configured)) return DEFAULT_QUERY_EMBEDDING_CACHE_TTL_SECONDS;
  return Math.min(Math.max(Math.floor(configured), 60), 30 * 24 * 60 * 60);
}
