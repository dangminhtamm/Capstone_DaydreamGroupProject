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
    indexingOutbox: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };
  const storageService = {
    createSignedUrl: jest.fn(),
  };

  let service: DiaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService.createSignedUrl.mockImplementation(
      async (_bucket: string, path: string) => `https://storage.local/${path}`,
    );
    prisma.indexingOutbox.findMany.mockResolvedValue([]);
    service = new DiaryService(prisma as any, storageService as any);
  });

  it('creates a diary for the authenticated user and queues memory indexing', async () => {
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
        tags: [],
      },
    });
    expect(result).toMatchObject({
      id: 'diary-1',
      title: 'Title',
      content: 'Content',
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
    });
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'diary',
            source_id: 'diary-1',
          },
        },
      }),
    );
  });

  it('stores an explicit diary entry date when provided', async () => {
    const createdAt = new Date('2026-05-18T09:00:00.000Z');
    const explicitEntryDate = '2026-05-12T12:00:00.000Z';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.create.mockResolvedValue({
      id: 'diary-2',
      raw_text: 'Backdated\n\nContent',
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
      entry_date: new Date(explicitEntryDate),
    });

    const result = await service.create('supabase-user-1', {
      title: 'Backdated',
      content: 'Content',
      entryDate: explicitEntryDate,
    });

    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: {
        raw_text: 'Backdated\n\nContent',
        user_id: 'user-1',
        status: 'published',
        tags: [],
        entry_date: new Date(explicitEntryDate),
      },
    });
    expect(result).toMatchObject({
      id: 'diary-2',
      entryDate: explicitEntryDate,
    });
  });

  it('stores an explicit diary entry date when provided', async () => {
    const createdAt = new Date('2026-05-18T09:00:00.000Z');
    const explicitEntryDate = '2026-05-12T12:00:00.000Z';
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.create.mockResolvedValue({
      id: 'diary-2',
      raw_text: 'Backdated\n\nContent',
      status: 'published',
      created_at: createdAt,
      updated_at: createdAt,
      entry_date: new Date(explicitEntryDate),
    });

    const result = await service.create('supabase-user-1', {
      title: 'Backdated',
      content: 'Content',
      entryDate: explicitEntryDate,
    });

    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: {
        raw_text: 'Backdated\n\nContent',
        user_id: 'user-1',
        status: 'published',
        tags: [],
        entry_date: new Date(explicitEntryDate),
      },
    });
    expect(result).toMatchObject({
      id: 'diary-2',
      entryDate: explicitEntryDate,
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
      select: {
        id: true,
        raw_text: true,
        status: true,
        mood: true,
        tags: true,
        entry_date: true,
        created_at: true,
        updated_at: true,
        attachments: {
          select: {
            id: true,
            storage_path: true,
            file_type: true,
            extracted_text: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
        calendar_events: {
          select: {
            id: true,
            title: true,
            start_time: true,
            end_time: true,
            html_link: true,
          },
          orderBy: { start_time: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'diary-1', title: 'Title' });
  });

  it('normalizes and returns diary mood and tags', async () => {
    const createdAt = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.create.mockResolvedValue({
      id: 'diary-3',
      raw_text: 'Mood day\n\nHad a strong focus block.',
      status: 'published',
      mood: 'great',
      tags: ['capstone', 'focus-block'],
      created_at: createdAt,
      updated_at: createdAt,
      entry_date: createdAt,
    });

    const result = await service.create('supabase-user-1', {
      title: 'Mood day',
      content: 'Had a strong focus block.',
      mood: 'great',
      tags: [' Capstone ', '#Focus Block', 'capstone', 'bad tag!'],
    });

    expect(prisma.diaryEntry.create).toHaveBeenCalledWith({
      data: {
        raw_text: 'Mood day\n\nHad a strong focus block.',
        user_id: 'user-1',
        status: 'published',
        mood: 'great',
        tags: ['capstone', 'focus-block', 'bad-tag'],
      },
    });
    expect(result).toMatchObject({
      mood: 'great',
      tags: ['capstone', 'focus-block'],
    });
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          payload: {
            sourceTitle: 'Mood day',
            mood: 'great',
            tags: ['capstone', 'focus-block', 'bad-tag'],
          },
        }),
      }),
    );
  });

  it('returns signed attachment urls without exposing storage paths', async () => {
    const createdAt = new Date('2026-05-18T09:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.diaryEntry.findMany.mockResolvedValue([
      {
        id: 'diary-1',
        raw_text: 'Title\n\nContent',
        status: 'published',
        created_at: createdAt,
        updated_at: createdAt,
        attachments: [
          {
            id: 'attachment-1',
            storage_path: 'attachments/user-1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-file.pdf',
            file_type: 'application/pdf',
            extracted_text: 'Extracted text',
            created_at: createdAt,
          },
        ],
      },
    ]);
    prisma.indexingOutbox.findMany.mockResolvedValue([
      {
        source_id: 'attachment-1',
        status: 'succeeded',
        error: null,
        retry_count: 0,
        updated_at: createdAt,
      },
    ]);

    const result = await service.findAll('supabase-user-1');

    expect(storageService.createSignedUrl).toHaveBeenCalledWith(
      'attachments-bucket',
      'attachments/user-1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-file.pdf',
    );
    expect(result[0].attachments).toEqual([
      expect.objectContaining({
        id: 'attachment-1',
        fileName: 'file.pdf',
        signedUrl: 'https://storage.local/attachments/user-1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-file.pdf',
        extractionStatus: 'extracted',
        indexingStatus: 'succeeded',
      }),
    ]);
  });

  describe('toClientEntry robust parsing fallbacks', () => {
    it('correctly handles default double newline format', async () => {
      const entryDate = new Date('2026-05-18T09:00:00.000Z');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'diary-1',
          raw_text: 'A Beautiful Day\n\nI went to the park and had a great time.',
          status: 'published',
          created_at: entryDate,
          updated_at: entryDate,
        },
      ]);
      const result = await service.findAll('supabase-user-1');
      expect(result[0]).toMatchObject({
        title: 'A Beautiful Day',
        content: 'I went to the park and had a great time.',
      });
    });

    it('gracefully falls back to single newline if double newline is missing', async () => {
      const entryDate = new Date('2026-05-18T09:00:00.000Z');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'diary-2',
          raw_text: 'Single Newline Title\nThis is content on a single newline.',
          status: 'published',
          created_at: entryDate,
          updated_at: entryDate,
        },
      ]);
      const result = await service.findAll('supabase-user-1');
      expect(result[0]).toMatchObject({
        title: 'Single Newline Title',
        content: 'This is content on a single newline.',
      });
    });

    it('uses the whole text as title if it has no newlines and is short', async () => {
      const entryDate = new Date('2026-05-18T09:00:00.000Z');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'diary-3',
          raw_text: 'Just a short note with no newlines',
          status: 'published',
          created_at: entryDate,
          updated_at: entryDate,
        },
      ]);
      const result = await service.findAll('supabase-user-1');
      expect(result[0]).toMatchObject({
        title: 'Just a short note with no newlines',
        content: 'Just a short note with no newlines',
      });
    });

    it('truncates the title and retains full text as content if no newlines and long text', async () => {
      const entryDate = new Date('2026-05-18T09:00:00.000Z');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'diary-4',
          raw_text: 'This is a very long diary entry without any newline characters because the user typed a long single line stream of conscious thoughts containing a lot of details.',
          status: 'published',
          created_at: entryDate,
          updated_at: entryDate,
        },
      ]);
      const result = await service.findAll('supabase-user-1');
      expect(result[0].title).toBe('This is a very long diary entry without any newline chara...');
      expect(result[0].content).toBe('This is a very long diary entry without any newline characters because the user typed a long single line stream of conscious thoughts containing a lot of details.');
    });
  });
});
