import { answerMemory } from '@second-brain/ai';
import { SearchService } from './search.service';

jest.mock('@second-brain/ai', () => ({
  answerMemory: jest.fn(),
  answerMemoryStream: jest.fn(),
}));

describe('SearchService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    memoryChunk: {
      count: jest.fn(),
    },
    diaryEntry: {
      findMany: jest.fn(),
    },
  };

  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(prisma as any);
  });

  it('returns diary-date fallback when no memory chunks exist for a date query', async () => {
    const createdAt = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.memoryChunk.count.mockResolvedValue(0);
    prisma.diaryEntry.findMany.mockResolvedValue([
      {
        id: 'diary-1',
        raw_text: 'nhật kí thường ngày\n\nhôm nay trời mưa, ở nhà nguyên ngày.',
        created_at: createdAt,
        entry_date: createdAt,
      },
    ]);

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'hôm nay tôi làm gì?',
      startDate: '2026-05-18T00:00:00.000Z',
      endDate: '2026-05-18T23:59:59.999Z',
    });

    expect(answerMemory).not.toHaveBeenCalled();
    expect(result.confidence).toBe('medium');
    expect(result.sources).toHaveLength(1);
    expect(result.answer).toContain('hôm nay trời mưa');
  });

  it('keeps the fixed response contract when AI search fails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.memoryChunk.count.mockResolvedValue(3);
    (answerMemory as jest.Mock).mockRejectedValue(new Error('Gemini failed'));

    const result = await service.answerQuestion('supabase-user-1', {
      question: 'What did I work on?',
    });

    expect(result).toEqual({
      answer: 'Memory search is temporarily unavailable. Please try again shortly.',
      confidence: 'low',
      sources: [],
    });
  });
});
