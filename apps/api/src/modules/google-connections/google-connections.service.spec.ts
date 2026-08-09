import { NotFoundException } from '@nestjs/common';
import {
  getGoogleConnectionStatus,
  isGoogleReconnectRequiredError,
  recordGoogleSyncFailure,
} from './google-connections';
import { GoogleConnectionsService } from './google-connections.service';

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        revokeToken: jest.fn().mockResolvedValue(undefined),
      })),
    },
  },
}));

jest.mock('../../common/cache/search-answer-cache', () => ({
  invalidateUserSearchCache: jest.fn(),
}));

describe('GoogleConnectionsService', () => {
  const tx = {
    user: { update: jest.fn() },
    indexingOutbox: { deleteMany: jest.fn() },
    memoryChunk: { deleteMany: jest.fn() },
    gmailMessage: { deleteMany: jest.fn() },
    googleDriveFile: { deleteMany: jest.fn() },
    googleContact: { deleteMany: jest.fn() },
    calendarEvent: { deleteMany: jest.fn() },
    searchHistory: { updateMany: jest.fn() },
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };

  let service: GoogleConnectionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      google_access_token: null,
      google_refresh_token: null,
    });
    tx.indexingOutbox.deleteMany.mockResolvedValue({ count: 4 });
    tx.memoryChunk.deleteMany.mockResolvedValue({ count: 12 });
    tx.gmailMessage.deleteMany.mockResolvedValue({ count: 3 });
    tx.googleDriveFile.deleteMany.mockResolvedValue({ count: 2 });
    tx.googleContact.deleteMany.mockResolvedValue({ count: 5 });
    tx.calendarEvent.deleteMany.mockResolvedValue({ count: 7 });
    service = new GoogleConnectionsService(prisma as any);
  });

  it('disconnects Google tokens without deleting synced data by default', async () => {
    const result = await service.disconnectGoogle({
      supabaseId: 'supabase-user-1',
      email: 'user@example.com',
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        google_connected: false,
        google_access_token: null,
        google_refresh_token: null,
      },
    });
    expect(tx.calendarEvent.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        disconnected: true,
        deleteSyncedData: false,
        deletedCounts: expect.objectContaining({
          calendarEvents: 0,
          memoryChunks: 0,
        }),
      }),
    );
  });

  it('deletes Google source data when requested', async () => {
    const result = await service.disconnectGoogle(
      {
        supabaseId: 'supabase-user-1',
        email: 'user@example.com',
      },
      { deleteSyncedData: true },
    );

    expect(tx.indexingOutbox.deleteMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        source_type: { in: ['calendar', 'gmail', 'drive', 'contact'] },
      },
    });
    expect(tx.memoryChunk.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        sourceType: { in: ['calendar', 'gmail', 'drive', 'contact'] },
      },
    });
    expect(tx.calendarEvent.deleteMany).toHaveBeenCalledWith({ where: { user_id: 'user-1' } });
    expect(result.deletedCounts).toEqual({
      calendarEvents: 7,
      gmailMessages: 3,
      driveFiles: 2,
      contacts: 5,
      memoryChunks: 12,
      indexingJobs: 4,
    });
  });

  it('throws when the authenticated user cannot be resolved', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.disconnectGoogle({
        supabaseId: 'missing-user',
        email: 'user@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a Google source disconnected when sync fails from token or scope errors', async () => {
    const connectionPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };

    await recordGoogleSyncFailure(connectionPrisma as any, {
      userId: 'user-1',
      source: 'gmail',
      error: {
        response: {
          status: 403,
          data: {
            error: {
              message: 'Request had insufficient authentication scopes.',
            },
          },
        },
      },
    });

    expect(connectionPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      'user-1',
      'gmail',
      false,
      ['https://www.googleapis.com/auth/gmail.readonly'],
      null,
      expect.stringContaining('Needs reconnect:'),
      null,
    );
  });

  it('keeps a Google source connected for transient sync failures', async () => {
    const connectionPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };

    await recordGoogleSyncFailure(connectionPrisma as any, {
      userId: 'user-1',
      source: 'drive',
      error: new Error('AI quota or rate limit was reached.'),
    });

    expect(connectionPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      'user-1',
      'drive',
      true,
      ['https://www.googleapis.com/auth/drive.readonly'],
      null,
      'AI quota or rate limit was reached.',
      null,
    );
  });

  it('classifies invalid_grant as requiring Google reconnect', () => {
    expect(isGoogleReconnectRequiredError(new Error('invalid_grant'))).toBe(true);
  });

  it('treats stale disconnected source rows as connected when user-level Google tokens are valid', async () => {
    const connectionPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          source: 'calendar',
          connected: false,
          scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
          last_sync_at: new Date('2026-08-06T15:59:40.006Z'),
          last_error: null,
          last_error_at: null,
          sync_cursor: null,
        },
      ]),
    };

    await expect(
      getGoogleConnectionStatus(connectionPrisma as any, 'user-1', 'calendar', true),
    ).resolves.toEqual(
      expect.objectContaining({
        source: 'calendar',
        connected: true,
      }),
    );
  });

  it('keeps source disconnected when the row requires reconnect', async () => {
    const connectionPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          source: 'gmail',
          connected: false,
          scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
          last_sync_at: null,
          last_error: 'Needs reconnect: invalid_grant',
          last_error_at: new Date('2026-08-09T05:00:00.000Z'),
          sync_cursor: null,
        },
      ]),
    };

    await expect(
      getGoogleConnectionStatus(connectionPrisma as any, 'user-1', 'gmail', true),
    ).resolves.toEqual(
      expect.objectContaining({
        source: 'gmail',
        connected: false,
      }),
    );
  });
});
