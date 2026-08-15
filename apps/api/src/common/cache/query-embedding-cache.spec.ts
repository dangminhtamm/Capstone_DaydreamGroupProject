import { TUTURUUU_EMBEDDING_MODEL } from '@second-brain/ai';
import { RedisCachedQueryEmbeddingProvider } from './query-embedding-cache';

describe('RedisCachedQueryEmbeddingProvider', () => {
  const embedding = Array.from({ length: 768 }, (_, index) => index / 768);

  function createHarness(cachedValue: string | null = null) {
    const delegate = { embedQuery: jest.fn().mockResolvedValue(embedding) };
    const cache = {
      get: jest.fn().mockResolvedValue(cachedValue),
      setEx: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      isConfigured: jest.fn().mockReturnValue(true),
      isConnected: jest.fn().mockReturnValue(true),
    };
    return {
      delegate,
      cache,
      provider: new RedisCachedQueryEmbeddingProvider(delegate, cache as any),
    };
  }

  it('returns a valid Redis embedding without calling Tuturuuu', async () => {
    const { provider, delegate, cache } = createHarness(
      JSON.stringify({
        model: TUTURUUU_EMBEDDING_MODEL,
        dimension: 768,
        embedding,
      }),
    );

    await expect(provider.embedQuery('  What did I do? ')).resolves.toEqual(embedding);
    expect(delegate.embedQuery).not.toHaveBeenCalled();
    expect(cache.setEx).not.toHaveBeenCalled();
  });

  it('stores a cache miss with a bounded TTL', async () => {
    const { provider, delegate, cache } = createHarness();

    await expect(provider.embedQuery('What did I do?')).resolves.toEqual(embedding);
    expect(delegate.embedQuery).toHaveBeenCalledTimes(1);
    expect(cache.setEx).toHaveBeenCalledWith(
      expect.stringMatching(/^sb:query-embedding:/),
      7 * 24 * 60 * 60,
      expect.any(String),
    );
  });

  it('deduplicates concurrent misses for the same normalized query', async () => {
    const { provider, delegate } = createHarness();

    const [first, second] = await Promise.all([
      provider.embedQuery('What did I do?'),
      provider.embedQuery('  what did i do?  '),
    ]);

    expect(first).toEqual(embedding);
    expect(second).toEqual(embedding);
    expect(delegate.embedQuery).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local provider when Redis read fails', async () => {
    const { provider, delegate, cache } = createHarness();
    cache.get.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(provider.embedQuery('What did I do?')).resolves.toEqual(embedding);
    expect(delegate.embedQuery).toHaveBeenCalledTimes(1);
  });
});
