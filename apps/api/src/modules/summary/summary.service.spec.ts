import { NotFoundException } from '@nestjs/common';
import { SummaryService } from './summary.service';

describe('SummaryService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    summary: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    diaryEntry: {
      findMany: jest.fn(),
    },
    calendarEvent: {
      findMany: jest.fn(),
    },
    indexingOutbox: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };

  let service: SummaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SummaryService(prisma as any);
  });

  it('lists summaries scoped to the authenticated user', async () => {
    const periodStart = new Date('2026-05-18T00:00:00.000Z');
    const periodEnd = new Date('2026-05-18T23:59:59.999Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.summary.findMany.mockResolvedValue([
      {
        id: 'summary-1',
        summary_type: 'daily',
        period_start: periodStart,
        period_end: periodEnd,
        content: '**Key wins:** A useful summary',
        created_at: new Date('2026-05-18T12:00:00.000Z'),
      },
    ]);

    const result = await service.findAll('supabase-user-1', {
      type: 'daily',
      limit: 5,
    });

    expect(prisma.summary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
          summary_type: 'daily',
        }),
        take: 5,
      }),
    );
    expect(result).toEqual({
      count: 1,
      summaries: [
        expect.objectContaining({
          id: 'summary-1',
          type: 'daily',
          content: 'Key wins: A useful summary',
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        }),
      ],
    });
  });

  it('rejects access when the Supabase user is not known', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findAll('missing-user', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates the user row from the authenticated JWT when loading summaries', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'user-1' });
    prisma.summary.findMany.mockResolvedValue([]);

    const result = await service.findAll(
      {
        supabaseId: 'supabase-user-1',
        email: 'user@example.com',
      },
      {},
    );

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { supabaseId: 'supabase-user-1' },
      update: { email: 'user@example.com' },
      create: {
        supabaseId: 'supabase-user-1',
        email: 'user@example.com',
      },
      select: { id: true },
    });
    expect(result).toEqual({ count: 0, summaries: [] });
  });

  it('only returns a summary owned by the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.summary.findFirst.mockResolvedValue(null);

    await expect(service.findOne('supabase-user-1', 'summary-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'summary-2',
        user_id: 'user-1',
      },
    });
  });

  it('reuses an existing period summary unless force regeneration is requested', async () => {
    const periodStart = new Date('2026-05-18T00:00:00.000Z');
    const periodEnd = new Date('2026-05-18T23:59:59.999Z');
    prisma.summary.findFirst.mockResolvedValue({
      id: 'summary-1',
      summary_type: 'daily',
      period_start: periodStart,
      period_end: periodEnd,
      content: 'Existing summary',
      created_at: new Date('2026-05-18T23:50:00.000Z'),
    });

    const result = await service.generateSummaryForUserId('user-1', {
      type: 'daily',
      date: '2026-05-18T12:00:00.000Z',
    });

    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        summary_type: 'daily',
        period_start: periodStart,
        period_end: periodEnd,
      },
    });
    expect(prisma.diaryEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.calendarEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.summary.create).not.toHaveBeenCalled();
    expect(prisma.summary.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      generated: false,
      summary: expect.objectContaining({
        id: 'summary-1',
        type: 'daily',
        content: 'Existing summary',
      }),
      memoryIndexingStatus: 'queued',
    });
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'summary',
            source_id: 'summary-1',
          },
        },
      }),
    );
  });
});
