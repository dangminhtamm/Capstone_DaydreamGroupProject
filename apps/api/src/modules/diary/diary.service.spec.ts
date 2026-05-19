import { NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';

// Mock the external AI/DB functions so tests don't call real APIs
jest.mock('@second-brain/ai', () => ({
  indexMemoryFromDiary: jest.fn().mockResolvedValue({ chunkCount: 2 }),
}));
jest.mock('@second-brain/db', () => ({
  insertMemoryChunks: jest.fn(),
  pruneMemoryChunksForSource: jest.fn(),
  deleteMemoryChunksForSource: jest.fn(),
}));

describe('DiaryService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    diaryEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };

  let service: DiaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiaryService(prisma as any);
  });

  it('creates a diary for the authenticated user and indexes memory', async () => {
    const entryDate = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.create.mockResolvedValue({
      id: 'diary-1',
      raw_text: 'Title\n\nContent',
      status: 'published',
      created_at: entryDate,
      updated_at: entryDate,
      entry_date: entryDate,
    });

    const result = await service.create('supabase-user-1', {
      title: 'Title',
      content: 'Content',
    });

    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: {
        raw_text: 'Title\n\nContent',
        user_id: 'user-1',
        status: 'published',
      },
    });
    expect(result).toMatchObject({
      id: 'diary-1',
      title: 'Title',
      content: 'Content',
      memoryIndexed: true,
    });
  });

  it('does not create a diary when the authenticated user is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.create('missing-user', { title: 'Title', content: 'Content' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.diaryEntry.create).not.toHaveBeenCalled();
  });

  it('scopes diary listing by the resolved internal user id', async () => {
    const createdAt = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findMany.mockResolvedValue([
      {
        id: 'diary-1',
        raw_text: 'Title\n\nContent',
        status: 'published',
        created_at: createdAt,
        updated_at: createdAt,
      },
    ]);

    const result = await service.findAll('supabase-user-1');

    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      orderBy: { created_at: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'diary-1', title: 'Title' });
  });
});
