import { NotFoundException } from '@nestjs/common';
import { SummaryService } from './summary.service';

describe('SummaryService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    summary: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
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
        content: 'A useful summary',
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
          content: 'A useful summary',
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
});
