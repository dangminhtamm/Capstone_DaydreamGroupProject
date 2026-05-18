import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    calendarEvent: {
      findMany: jest.fn(),
    },
  };

  let service: CalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CalendarService(prisma as any);
  });

  it('returns only calendar events owned by the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.calendarEvent.findMany.mockResolvedValue([]);

    await service.getEventsFromDb('supabase-user-1');

    expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
        }),
        orderBy: { start_time: 'asc' },
        take: 20,
      }),
    );
  });

  it('throws when the authenticated user cannot be resolved', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getEventsFromDb('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.calendarEvent.findMany).not.toHaveBeenCalled();
  });
});
