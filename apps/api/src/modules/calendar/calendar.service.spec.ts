import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

const mockGenerateAuthUrl = jest.fn((args: { state: string }) => {
  return `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(args.state)}`;
});
const mockGetToken = jest.fn(async () => ({
  tokens: {
    access_token: 'google-access-token',
    refresh_token: 'google-refresh-token',
  },
}));
const mockCalendarEventsList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: jest.fn(),
        on: jest.fn(),
      })),
    },
    calendar: jest.fn().mockImplementation(() => ({
      events: {
        list: mockCalendarEventsList,
      },
    })),
  },
}));

describe('CalendarService', () => {
  const mockedGoogle = jest.requireMock('googleapis').google;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    calendarEvent: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    diaryEntry: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    indexingOutbox: {
      upsert: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
  };

  let service: CalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_OAUTH_STATE_SECRET = 'state-secret';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'test-token-encryption-key';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.GOOGLE_CALLBACK_URL;
    mockCalendarEventsList.mockReset();
    prisma.diaryEntry.findMany.mockResolvedValue([]);
    service = new CalendarService(prisma as any);
  });

  it('accepts the legacy GOOGLE_CALLBACK_URL env var for local Calendar OAuth', async () => {
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/api/auth/google/callback';
    prisma.user.upsert.mockResolvedValue({ id: 'user-1' });

    await service.createGoogleConnectUrl({
      supabaseId: 'supabase-user-1',
      email: 'user@example.com',
    });

    expect(mockedGoogle.auth.OAuth2).toHaveBeenLastCalledWith(
      'google-client-id',
      'google-client-secret',
      'http://localhost:3001/api/auth/google/callback',
    );
  });

  it('creates a server-side Google OAuth URL with signed state', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'user-1' });

    const url = await service.createGoogleConnectUrl({
      supabaseId: 'supabase-user-1',
      email: 'user@example.com',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supabaseId: 'supabase-user-1' },
      }),
    );
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: 'offline',
        prompt: 'consent',
        scope: expect.arrayContaining([
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/contacts.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/gmail.readonly',
        ]),
      }),
    );
    expect(url).toContain('state=');
  });

  it('stores Google OAuth tokens on callback and redirects back to settings', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    const connectUrl = await service.createGoogleConnectUrl({
      supabaseId: 'supabase-user-1',
      email: 'user@example.com',
    });
    const state = new URL(connectUrl).searchParams.get('state') ?? '';

    const redirectUrl = await service.handleGoogleOAuthCallback({
      code: 'oauth-code',
      state,
    });

    expect(mockGetToken).toHaveBeenCalledWith('oauth-code');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { supabaseId: 'supabase-user-1' },
      data: {
        google_connected: true,
        google_access_token: expect.stringMatching(/^enc:v1:/),
        google_refresh_token: expect.stringMatching(/^enc:v1:/),
      },
      select: { id: true },
    });
    expect(prisma.user.update.mock.calls[0][0].data.google_access_token).not.toBe('google-access-token');
    expect(prisma.user.update.mock.calls[0][0].data.google_refresh_token).not.toBe('google-refresh-token');
    expect(redirectUrl).toBe('http://localhost:3000/settings?calendar=connected');
  });

  it('returns calendar connection status without exposing tokens', async () => {
    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      google_connected: true,
      google_access_token: 'access-token',
      google_refresh_token: 'refresh-token',
    });
    prisma.calendarEvent.count.mockResolvedValue(3);
    prisma.calendarEvent.findFirst.mockResolvedValue({
      updated_at: new Date('2026-05-18T12:00:00.000Z'),
    });

    const status = await service.getConnectionStatus({
      supabaseId: 'supabase-user-1',
      email: 'user@example.com',
    });

    expect(status).toEqual(
      expect.objectContaining({
        source: 'calendar',
        oauthMode: 'all_google_sources',
        connected: true,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        requestedScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        eventCount: 3,
        lastSyncedAt: new Date('2026-05-18T12:00:00.000Z'),
        lastError: null,
        lastErrorAt: null,
      }),
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supabaseId: 'supabase-user-1' },
      }),
    );
    expect(status).not.toHaveProperty('google_access_token');
  });

  it('syncs events and queues calendar indexing when only a refresh token is stored', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      supabaseId: 'supabase-user-1',
      google_access_token: null,
      google_refresh_token: 'refresh-token',
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    mockCalendarEventsList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'google-event-1',
            summary: 'Capstone Mentor Review',
            description: 'Review AI memory and Calendar demo.',
            start: { dateTime: '2026-05-18T10:00:00.000Z' },
            end: { dateTime: '2026-05-18T11:00:00.000Z' },
            htmlLink: 'https://calendar.google.com/event-1',
          },
        ],
      },
    });
    prisma.calendarEvent.upsert.mockResolvedValue({
      id: 'calendar-event-1',
      external_id: 'google-event-1',
      title: 'Capstone Mentor Review',
      description: 'Review AI memory and Calendar demo.',
      start_time: new Date('2026-05-18T10:00:00.000Z'),
      end_time: new Date('2026-05-18T11:00:00.000Z'),
      html_link: 'https://calendar.google.com/event-1',
    });
    prisma.indexingOutbox.upsert.mockResolvedValue({
      id: 'indexing-job-1',
      source_type: 'calendar',
      source_id: 'calendar-event-1',
      status: 'pending',
    });

    const result = await service.syncGoogleEvents('supabase-user-1');

    expect(mockCalendarEventsList).toHaveBeenCalled();
    expect(prisma.calendarEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id_external_id: {
            user_id: 'user-1',
            external_id: 'google-event-1',
          },
        },
      }),
    );
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'calendar',
            source_id: 'calendar-event-1',
          },
        },
        update: expect.objectContaining({
          user_id: 'user-1',
          status: 'pending',
          retry_count: 0,
          error: null,
        }),
        create: expect.objectContaining({
          user_id: 'user-1',
          job_type: 'index_memory',
          source_type: 'calendar',
          source_id: 'calendar-event-1',
          status: 'pending',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        syncedCount: 1,
        queuedIndexingJobs: 1,
        linkedDiaryCount: 0,
        linkedEventCount: 0,
        memoryIndexingStatus: 'queued',
      }),
    );
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
