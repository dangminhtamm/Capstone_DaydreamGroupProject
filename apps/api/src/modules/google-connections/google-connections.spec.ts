import {
  getGoogleConnectionStatus,
  markGoogleWorkspaceConnected,
  shouldStoreGoogleRawPayloads,
} from './google-connections';

describe('google connection helpers', () => {
  const originalStoreRawPayloads = process.env.GOOGLE_STORE_RAW_PAYLOADS;

  afterEach(() => {
    if (originalStoreRawPayloads === undefined) {
      delete process.env.GOOGLE_STORE_RAW_PAYLOADS;
    } else {
      process.env.GOOGLE_STORE_RAW_PAYLOADS = originalStoreRawPayloads;
    }
  });

  it('does not mark a missing source connected when source-scoped rows already exist', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '1' }]),
    };

    const status = await getGoogleConnectionStatus(prisma as any, 'user-1', 'gmail', true);

    expect(status).toEqual(
      expect.objectContaining({
        source: 'gmail',
        connected: false,
        scopes: [],
      }),
    );
  });

  it('keeps legacy fallback connected when the google_connections table has no rows yet', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]),
    };

    const status = await getGoogleConnectionStatus(prisma as any, 'user-1', 'calendar', true);

    expect(status).toEqual(
      expect.objectContaining({
        source: 'calendar',
        connected: true,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      }),
    );
  });

  it('records full workspace scopes when connecting all Google sources', async () => {
    const prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    await markGoogleWorkspaceConnected(prisma as any, 'user-1');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    for (const call of prisma.$executeRawUnsafe.mock.calls) {
      expect(call[4]).toEqual(
        expect.arrayContaining([
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/contacts.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/gmail.readonly',
        ]),
      );
    }
  });

  it('stores Google raw payloads only when explicitly enabled', () => {
    delete process.env.GOOGLE_STORE_RAW_PAYLOADS;
    expect(shouldStoreGoogleRawPayloads()).toBe(false);

    process.env.GOOGLE_STORE_RAW_PAYLOADS = 'true';
    expect(shouldStoreGoogleRawPayloads()).toBe(true);
  });
});
