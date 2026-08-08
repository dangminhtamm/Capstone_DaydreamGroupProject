import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DriveService } from './drive.service';

const mockDriveFilesList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        on: jest.fn(),
      })),
    },
    drive: jest.fn().mockImplementation(() => ({
      files: {
        list: mockDriveFilesList,
      },
    })),
  },
}));

describe('DriveService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    googleDriveFile: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    indexingOutbox: {
      upsert: jest.fn(),
    },
    searchHistory: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
  };

  let service: DriveService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'test-token-encryption-key';
    service = new DriveService(prisma as any);
  });

  it('returns Drive status without exposing Google tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      google_connected: true,
      google_access_token: 'access-token',
      google_refresh_token: 'refresh-token',
    });
    prisma.googleDriveFile.count.mockResolvedValue(3);
    prisma.googleDriveFile.findFirst.mockResolvedValue({
      updated_at: new Date('2026-07-23T10:00:00.000Z'),
    });

    const status = await service.getConnectionStatus('supabase-user-1');

    expect(status).toEqual(
      expect.objectContaining({
        source: 'drive',
        oauthMode: 'all_google_sources',
        connected: true,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        requestedScopes: ['https://www.googleapis.com/auth/drive.readonly'],
        fileCount: 3,
        lastSyncedAt: new Date('2026-07-23T10:00:00.000Z'),
        lastError: null,
        lastErrorAt: null,
      }),
    );
    expect(status).not.toHaveProperty('google_access_token');
  });

  it('syncs Drive files and queues Drive memory indexing', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      supabaseId: 'supabase-user-1',
      google_access_token: null,
      google_refresh_token: 'refresh-token',
    });
    mockDriveFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: 'drive-file-1',
            name: 'Capstone Notes.txt',
            mimeType: 'text/plain',
            webViewLink: 'https://drive.google.com/file/d/drive-file-1/view',
            iconLink: 'https://drive-thirdparty.googleusercontent.com/icon',
            thumbnailLink: 'https://drive.google.com/thumb',
            size: '1200',
            modifiedTime: '2026-07-23T10:00:00.000Z',
          },
        ],
      },
    });
    prisma.googleDriveFile.upsert.mockResolvedValue({
      id: 'drive-file-db-1',
      external_id: 'drive-file-1',
      name: 'Capstone Notes.txt',
      mime_type: 'text/plain',
    });
    prisma.indexingOutbox.upsert.mockResolvedValue({
      id: 'job-1',
      source_type: 'drive',
      source_id: 'drive-file-db-1',
      status: 'pending',
    });

    const result = await service.syncGoogleDriveFiles('supabase-user-1');

    expect(mockDriveFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
        pageSize: 50,
        orderBy: 'modifiedTime desc',
      }),
    );
    expect(prisma.googleDriveFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id_external_id: {
            user_id: 'user-1',
            external_id: 'drive-file-1',
          },
        },
        create: expect.objectContaining({
          name: 'Capstone Notes.txt',
          mime_type: 'text/plain',
          size: BigInt(1200),
        }),
      }),
    );
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'drive',
            source_id: 'drive-file-db-1',
          },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        syncedCount: 1,
        queuedIndexingJobs: 1,
        memoryIndexingStatus: 'queued',
      }),
    );
  });

  it('tells users to reconnect when Drive scope is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      google_access_token: null,
      google_refresh_token: 'refresh-token',
    });
    mockDriveFilesList.mockRejectedValue({
      code: 403,
      message: 'Request had insufficient authentication scopes.',
    });

    await expect(service.syncGoogleDriveFiles('supabase-user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns only Drive files owned by the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.googleDriveFile.findMany.mockResolvedValue([]);

    await service.getFilesFromDb('supabase-user-1');

    expect(prisma.googleDriveFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1' },
      }),
    );
  });

  it('throws when the authenticated user cannot be resolved', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getFilesFromDb('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.googleDriveFile.findMany).not.toHaveBeenCalled();
  });
});
