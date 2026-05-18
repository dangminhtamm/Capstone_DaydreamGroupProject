import { NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';

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
    $transaction: jest.fn(),
  };
  const queue = {
    enqueueDiaryIndex: jest.fn(),
  };

  let service: DiaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiaryService(prisma as any, queue as any);
  });

  it('creates a diary for the authenticated user and queues indexing', async () => {
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
    queue.enqueueDiaryIndex.mockResolvedValue({ id: 'job-1' });

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
    expect(queue.enqueueDiaryIndex).toHaveBeenCalledWith({
      userId: 'user-1',
      diaryId: 'diary-1',
      rawText: 'Title\n\nContent',
      entryDate: entryDate.toISOString(),
      sourceTitle: 'Title',
    });
    expect(result).toMatchObject({
      id: 'diary-1',
      title: 'Title',
      content: 'Content',
      memoryQueued: true,
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
