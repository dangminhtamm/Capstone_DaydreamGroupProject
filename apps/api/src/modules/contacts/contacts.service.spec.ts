import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';

const mockPeopleConnectionsList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        on: jest.fn(),
      })),
    },
    people: jest.fn().mockImplementation(() => ({
      people: {
        connections: {
          list: mockPeopleConnectionsList,
        },
      },
    })),
  },
}));

describe('ContactsService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    googleContact: {
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

  let service: ContactsService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'test-token-encryption-key';
    service = new ContactsService(prisma as any);
  });

  it('returns contacts status without exposing Google tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      google_connected: true,
      google_access_token: 'access-token',
      google_refresh_token: 'refresh-token',
    });
    prisma.googleContact.count.mockResolvedValue(2);
    prisma.googleContact.findFirst.mockResolvedValue({
      updated_at: new Date('2026-07-22T10:00:00.000Z'),
    });

    const status = await service.getConnectionStatus('supabase-user-1');

    expect(status).toEqual(
      expect.objectContaining({
        source: 'contact',
        oauthMode: 'all_google_sources',
        connected: true,
        scopes: ['https://www.googleapis.com/auth/contacts.readonly'],
        requestedScopes: ['https://www.googleapis.com/auth/contacts.readonly'],
        contactCount: 2,
        lastSyncedAt: new Date('2026-07-22T10:00:00.000Z'),
        lastError: null,
        lastErrorAt: null,
      }),
    );
    expect(status).not.toHaveProperty('google_access_token');
  });

  it('syncs Google Contacts and queues contact memory indexing', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      supabaseId: 'supabase-user-1',
      google_access_token: null,
      google_refresh_token: 'refresh-token',
    });
    mockPeopleConnectionsList.mockResolvedValue({
      data: {
        connections: [
          {
            resourceName: 'people/contact-1',
            names: [{ displayName: 'Linh Mentor' }],
            emailAddresses: [{ value: 'linh@example.com' }],
            phoneNumbers: [{ value: '+84 900 000 001' }],
            organizations: [{ name: 'RMIT', title: 'Mentor' }],
            photos: [{ url: 'https://example.com/linh.jpg' }],
          },
        ],
      },
    });
    prisma.googleContact.upsert.mockResolvedValue({
      id: 'contact-1',
      external_id: 'people/contact-1',
      display_name: 'Linh Mentor',
    });
    prisma.indexingOutbox.upsert.mockResolvedValue({
      id: 'job-1',
      source_type: 'contact',
      source_id: 'contact-1',
      status: 'pending',
    });

    const result = await service.syncGoogleContacts('supabase-user-1');

    expect(mockPeopleConnectionsList).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceName: 'people/me',
        personFields: 'metadata,names,emailAddresses,phoneNumbers,organizations,photos',
        pageSize: 500,
      }),
    );
    expect(prisma.googleContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id_external_id: {
            user_id: 'user-1',
            external_id: 'people/contact-1',
          },
        },
        create: expect.objectContaining({
          display_name: 'Linh Mentor',
          email_addresses: ['linh@example.com'],
          phone_numbers: ['+84 900 000 001'],
          organizations: ['RMIT', 'Mentor'],
        }),
      }),
    );
    expect(prisma.indexingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job_type_source_type_source_id: {
            job_type: 'index_memory',
            source_type: 'contact',
            source_id: 'contact-1',
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

  it('returns only contacts owned by the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.googleContact.findMany.mockResolvedValue([]);

    await service.getContactsFromDb('supabase-user-1');

    expect(prisma.googleContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1' },
        orderBy: { display_name: 'asc' },
      }),
    );
  });

  it('throws when the authenticated user cannot be resolved', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getContactsFromDb('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.googleContact.findMany).not.toHaveBeenCalled();
  });
});
