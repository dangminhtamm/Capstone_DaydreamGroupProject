import { NotFoundException } from '@nestjs/common';
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
});
