import { InternalServerErrorException } from '@nestjs/common';
import { answerMemory } from '@second-brain/ai';
import { findCachedAnswer, saveSearchHistory } from '@second-brain/db';
import { SearchService } from './search.service';

jest.mock('@second-brain/ai', () => ({
  DEFAULT_TUTURUUU_EMBEDDING_MODEL: 'google/gemini-embedding-2',
  TUTURUUU_EMBEDDING_MODEL: 'google/gemini-embedding-2',
  createDefaultEmbeddingProvider: jest.fn(() => ({
    embedQuery: jest.fn(),
  })),
  answerMemory: jest.fn(),
  getTuturuuuAnswerModel: jest.fn(() => 'google/gemini-3.5-flash-lite'),
}));

jest.mock('@second-brain/db', () => ({
  saveSearchHistory: jest.fn(),
  findCachedAnswer: jest.fn(),
  getUserSearchHistory: jest.fn(),
  deleteSearchHistoryItem: jest.fn(),
  clearUserSearchHistory: jest.fn(),
}));

describe('SearchService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  let service: SearchService;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMemoryDebugTrace = process.env.MEMORY_DEBUG_TRACE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.MEMORY_DEBUG_TRACE = originalMemoryDebugTrace;
    (saveSearchHistory as jest.Mock).mockResolvedValue(undefined);
    (findCachedAnswer as jest.Mock).mockResolvedValue(null);
    service = new SearchService(prisma as any);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.MEMORY_DEBUG_TRACE = originalMemoryDebugTrace;
  });

  it('returns grounded memory answers from the AI package', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'You worked on the capstone search flow.',
      confidence: 'high',
      citations: [{ marker: 'S1', quote: 'capstone search flow' }],
      noMemory: false,
      suggestions: [],
      analytics: { tokenUsage: { totalTokens: 42 } },
      debugTrace: {
        status: 'success',
        reason: 'mock trace',
        chunksRetrieved: 1,
        inferredFilters: {},
        appliedFilters: {},
        topChunks: [],
      },
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What did I work on?',
      responseLanguage: 'en',
    });

    expect(answerMemory).toHaveBeenCalledWith(
      'What did I work on?',
      'user-1',
      prisma,
      expect.objectContaining({ responseLanguage: 'en', answerStrategy: 'auto' }),
    );
    expect(result.confidence).toBe('high');
    expect(result.sources).toHaveLength(1);
    expect(result.debugTrace).toBeNull();
    expect(result.cached).toBe(false);
    expect(saveSearchHistory).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        userId: 'user-1',
        question: 'What did I work on?',
        tokenCount: 42,
      }),
    );
  });

  it('returns debug trace only for admin users when enabled', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'true';
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Admin debug answer',
      confidence: 'high',
      citations: [],
      analytics: { tokenUsage: { totalTokens: 7 } },
      debugTrace: {
        status: 'success',
        reason: 'admin trace',
        chunksRetrieved: 2,
        inferredFilters: {},
        appliedFilters: {},
        topChunks: [],
      },
    });

    const result = await service.answerQuestion(
      {
        userId: 'supabase-user-1',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      },
      {
        question: 'What did I work on?',
        responseLanguage: 'en',
      },
    );

    expect(result.debugTrace).toMatchObject({ status: 'success', reason: 'admin trace' });
    expect(result.cached).toBe(false);
  });

  it('returns cached answers for unfiltered repeat questions', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'false';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    const cacheVersion = (service as any).getSearchCacheVersion();
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Cached answer',
      confidence: 'medium',
      sources_json: JSON.stringify([{ marker: 'S1', quote: 'cached source' }]),
      analytics_json: JSON.stringify({
        tokenUsage: { totalTokens: 99 },
        status: 'success',
        answerMode: 'tuturuuu',
        cacheVersion,
      }),
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: '  What did I work on?  ',
      responseLanguage: 'en',
      limit: 8,
    });

    expect(findCachedAnswer).toHaveBeenCalledWith(
      prisma,
      'user-1',
      'What did I work on?',
      'en',
    );
    expect(answerMemory).not.toHaveBeenCalled();
    expect(saveSearchHistory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: 'Cached answer',
      confidence: 'medium',
      cached: true,
    });
    expect(result.sources).toHaveLength(1);
  });

  it('skips cached answers from an older recall pipeline version', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'false';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Old model answer',
      confidence: 'high',
      sources_json: JSON.stringify([{ marker: 'S1', quote: 'old source' }]),
      analytics_json: JSON.stringify({
        tokenUsage: { totalTokens: 41 },
        status: 'success',
        answerMode: 'tuturuuu',
        cacheVersion: 'ai-recall-v0',
      }),
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh current-pipeline answer',
      confidence: 'high',
      citations: [{ marker: 'S1', quote: 'fresh source' }],
      analytics: {
        tokenUsage: { totalTokens: 33 },
        status: 'success',
        answerMode: 'tuturuuu',
      },
      answerMode: 'tuturuuu',
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What did I work on?',
      responseLanguage: 'en',
      limit: 8,
    });

    expect(answerMemory).toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: 'Fresh current-pipeline answer',
      cached: false,
    });
  });

  it('skips cached fallback answers and generates a fresh answer', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'false';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Old fallback answer',
      confidence: 'low',
      sources_json: JSON.stringify([{ marker: 'S1', quote: 'old source' }]),
      analytics_json: JSON.stringify({
        tokenUsage: { totalTokens: 0 },
        status: 'success',
        answerMode: 'extractive_fallback',
      }),
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh Tuturuuu answer',
      confidence: 'high',
      citations: [{ marker: 'S1', quote: 'fresh source' }],
      analytics: {
        tokenUsage: { totalTokens: 31 },
        status: 'success',
        answerMode: 'tuturuuu',
      },
      answerMode: 'tuturuuu',
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What did I work on?',
      responseLanguage: 'en',
      limit: 8,
    });

    expect(answerMemory).toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: 'Fresh Tuturuuu answer',
      answerMode: 'tuturuuu',
      cached: false,
    });
  });

  it('skips cached answers that look truncated and generates a fresh answer', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'false';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'We separated search latency from answer generation to claim p',
      confidence: 'medium',
      sources_json: JSON.stringify([{ marker: 'S1', quote: 'retrieval latency' }]),
      analytics_json: JSON.stringify({
        tokenUsage: { totalTokens: 721 },
        status: 'success',
        answerMode: 'tuturuuu',
      }),
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh answer: retrieval latency is measured separately from generation so the team can report p95 retrieval latency instead of average full answer latency.',
      confidence: 'high',
      citations: [{ marker: 'S1', quote: 'claim p95 retrieval latency' }],
      analytics: {
        tokenUsage: { totalTokens: 44 },
        status: 'success',
        answerMode: 'tuturuuu',
      },
      answerMode: 'tuturuuu',
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'Why did we separate retrieval latency from answer generation?',
      responseLanguage: 'en',
      limit: 8,
    });

    expect(answerMemory).toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: expect.stringContaining('Fresh answer'),
      cached: false,
    });
  });

  it('bypasses the answer cache when debug trace is enabled', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'true';
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Cached answer',
      confidence: 'medium',
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh debug answer',
      confidence: 'high',
      citations: [],
      analytics: { tokenUsage: { totalTokens: 7 } },
      debugTrace: {
        status: 'success',
        reason: 'fresh pipeline trace',
        chunksRetrieved: 2,
        inferredFilters: {},
        appliedFilters: {},
        topChunks: [],
      },
    });

    const result = await service.answerQuestion(
      {
        userId: 'supabase-user-1',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      },
      {
        question: 'What did I work on?',
        responseLanguage: 'en',
      },
    );

    expect(findCachedAnswer).not.toHaveBeenCalled();
    expect(answerMemory).toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: 'Fresh debug answer',
      cached: false,
      debugTrace: { status: 'success', reason: 'fresh pipeline trace' },
    });
  });

  it('omits debug trace by default in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MEMORY_DEBUG_TRACE;
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Production answer',
      confidence: 'high',
      citations: [],
      analytics: { tokenUsage: { totalTokens: 7 } },
      debugTrace: {
        status: 'success',
        reason: 'should be hidden',
        chunksRetrieved: 2,
        inferredFilters: {},
        appliedFilters: {},
        topChunks: [],
      },
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What did I work on?',
      responseLanguage: 'en',
      limit: 8,
    });

    expect(result.debugTrace).toBeNull();
  });

  it('bypasses answer cache when retrieval filters are present', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Cached answer',
      confidence: 'medium',
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh filtered answer',
      confidence: 'high',
      citations: [],
      analytics: { tokenUsage: { totalTokens: 7 } },
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What happened today?',
      responseLanguage: 'en',
      sourceType: 'diary',
    });

    expect(findCachedAnswer).not.toHaveBeenCalled();
    expect(answerMemory).toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: 'Fresh filtered answer',
      cached: false,
    });
  });

  it('bypasses answer cache when a non-default limit is present', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'false';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Cached answer',
      confidence: 'medium',
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh wider answer',
      confidence: 'high',
      citations: [],
      analytics: { tokenUsage: { totalTokens: 7 } },
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What happened in June?',
      responseLanguage: 'en',
      limit: 12,
    });

    expect(findCachedAnswer).not.toHaveBeenCalled();
    expect(answerMemory).toHaveBeenCalledWith(
      'What happened in June?',
      'user-1',
      prisma,
      expect.objectContaining({ limit: 12 }),
    );
    expect(result).toMatchObject({
      answer: 'Fresh wider answer',
      cached: false,
    });
  });

  it('bypasses answer cache when answer strategy is not auto', async () => {
    process.env.MEMORY_DEBUG_TRACE = 'false';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Cached answer',
      confidence: 'medium',
    });
    (answerMemory as jest.Mock).mockResolvedValue({
      answer: 'Fresh deep answer',
      confidence: 'high',
      citations: [],
      analytics: { tokenUsage: { totalTokens: 21 } },
      answerMode: 'tuturuuu',
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'Analyze my mood this week',
      responseLanguage: 'en',
      answerStrategy: 'deep',
    });

    expect(findCachedAnswer).not.toHaveBeenCalled();
    expect(answerMemory).toHaveBeenCalledWith(
      'Analyze my mood this week',
      'user-1',
      prisma,
      expect.objectContaining({ answerStrategy: 'deep' }),
    );
    expect(result).toMatchObject({
      answer: 'Fresh deep answer',
      answerMode: 'tuturuuu',
      cached: false,
    });
  });

  it('throws a stable HTTP error when AI search fails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (answerMemory as jest.Mock).mockRejectedValue(new Error('Tuturuuu failed'));

    await expect(
      service.answerQuestion('supabase-user-1', {
        question: 'What did I work on?',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
