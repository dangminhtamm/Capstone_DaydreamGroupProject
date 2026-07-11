import { InternalServerErrorException } from '@nestjs/common';
import { answerMemory } from '@second-brain/ai';
import { findCachedAnswer, saveSearchHistory } from '@second-brain/db';
import { SearchService } from './search.service';

jest.mock('@second-brain/ai', () => ({
  answerMemory: jest.fn(),
  answerMemoryStream: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
    (saveSearchHistory as jest.Mock).mockResolvedValue(undefined);
    (findCachedAnswer as jest.Mock).mockResolvedValue(null);
    service = new SearchService(prisma as any);
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
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What did I work on?',
      responseLanguage: 'en',
    });

    expect(answerMemory).toHaveBeenCalledWith(
      'What did I work on?',
      'user-1',
      prisma,
      expect.objectContaining({ responseLanguage: 'en' }),
    );
    expect(result.confidence).toBe('high');
    expect(result.sources).toHaveLength(1);
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

  it('returns cached answers for unfiltered repeat questions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (findCachedAnswer as jest.Mock).mockResolvedValue({
      answer: 'Cached answer',
      confidence: 'medium',
      sources_json: JSON.stringify([{ marker: 'S1', quote: 'cached source' }]),
      analytics_json: JSON.stringify({ tokenUsage: { totalTokens: 99 } }),
    });

    const result = await service.answerQuestion('supabase-user-1', {
      question: '  What did I work on?  ',
      responseLanguage: 'en',
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

  it('throws a stable HTTP error when AI search fails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    (answerMemory as jest.Mock).mockRejectedValue(new Error('Gemini failed'));

    await expect(
      service.answerQuestion('supabase-user-1', {
        question: 'What did I work on?',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
