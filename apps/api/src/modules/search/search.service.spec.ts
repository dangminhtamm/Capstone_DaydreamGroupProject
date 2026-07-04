import { InternalServerErrorException } from '@nestjs/common';
import { answerMemory } from '@second-brain/ai';
import { saveSearchHistory } from '@second-brain/db';
import { SearchService } from './search.service';

jest.mock('@second-brain/ai', () => ({
  answerMemory: jest.fn(),
  answerMemoryStream: jest.fn(),
}));

jest.mock('@second-brain/db', () => ({
  saveSearchHistory: jest.fn(),
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
