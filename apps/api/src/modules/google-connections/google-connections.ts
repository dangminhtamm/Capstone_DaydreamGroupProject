import type { PrismaService } from '../../prisma/prisma.service';

export type GoogleSource = 'calendar' | 'gmail' | 'drive' | 'contact';

export type GoogleConnectionStatus = {
  source: GoogleSource;
  connected: boolean;
  scopes: string[];
  lastSyncAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  syncCursor: unknown | null;
};

type GoogleConnectionRow = {
  source: GoogleSource;
  connected: boolean;
  scopes: string[];
  last_sync_at: Date | null;
  last_error: string | null;
  last_error_at: Date | null;
  sync_cursor: unknown | null;
};

export const GOOGLE_SOURCE_SCOPES: Record<GoogleSource, string[]> = {
  calendar: ['https://www.googleapis.com/auth/calendar.readonly'],
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  drive: ['https://www.googleapis.com/auth/drive.readonly'],
  contact: ['https://www.googleapis.com/auth/contacts.readonly'],
};

export const GOOGLE_WORKSPACE_SOURCES = Object.keys(GOOGLE_SOURCE_SCOPES) as GoogleSource[];

export function getAllGoogleWorkspaceScopes() {
  return [...new Set(GOOGLE_WORKSPACE_SOURCES.flatMap((source) => GOOGLE_SOURCE_SCOPES[source]))];
}

export async function markGoogleWorkspaceConnected(prisma: PrismaService, userId: string) {
  await Promise.all(
    GOOGLE_WORKSPACE_SOURCES.map((source) =>
      upsertGoogleConnection(prisma, {
        userId,
        source,
        connected: true,
        scopes: GOOGLE_SOURCE_SCOPES[source],
        lastError: null,
      }),
    ),
  );
}

export async function getGoogleConnectionStatus(
  prisma: PrismaService,
  userId: string,
  source: GoogleSource,
  fallbackConnected = false,
): Promise<GoogleConnectionStatus> {
  const fallback = {
    source,
    connected: fallbackConnected,
    scopes: fallbackConnected ? GOOGLE_SOURCE_SCOPES[source] : [],
    lastSyncAt: null,
    lastError: null,
    lastErrorAt: null,
    syncCursor: null,
  };

  let rows: GoogleConnectionRow[];
  try {
    rows = await prisma.$queryRawUnsafe<GoogleConnectionRow[]>(
      `
      SELECT
        source,
        connected,
        scopes,
        last_sync_at,
        last_error,
        last_error_at,
        sync_cursor
      FROM google_connections
      WHERE user_id = $1 AND source = $2
      LIMIT 1
      `,
      userId,
      source,
    );
  } catch {
    return fallback;
  }
  const row = rows[0];

  if (!row) {
    return fallback;
  }

  return {
    source,
    connected: row.connected,
    scopes: row.scopes ?? [],
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at,
    syncCursor: row.sync_cursor,
  };
}

export async function recordGoogleSyncSuccess(
  prisma: PrismaService,
  input: {
    userId: string;
    source: GoogleSource;
    syncCursor?: unknown;
  },
) {
  await upsertGoogleConnection(prisma, {
    userId: input.userId,
    source: input.source,
    connected: true,
    scopes: GOOGLE_SOURCE_SCOPES[input.source],
    lastSyncAt: new Date(),
    lastError: null,
    syncCursor: input.syncCursor,
  });
}

export async function recordGoogleSyncFailure(
  prisma: PrismaService,
  input: {
    userId: string;
    source: GoogleSource;
    error: unknown;
  },
) {
  await upsertGoogleConnection(prisma, {
    userId: input.userId,
    source: input.source,
    connected: true,
    scopes: GOOGLE_SOURCE_SCOPES[input.source],
    lastError: toPublicErrorMessage(input.error),
  });
}

async function upsertGoogleConnection(
  prisma: PrismaService,
  input: {
    userId: string;
    source: GoogleSource;
    connected: boolean;
    scopes: string[];
    lastSyncAt?: Date | null;
    lastError?: string | null;
    syncCursor?: unknown;
  },
) {
  const syncCursor = input.syncCursor === undefined ? null : JSON.stringify(input.syncCursor);

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO google_connections (
        user_id,
        source,
        connected,
        scopes,
        last_sync_at,
        last_error,
        last_error_at,
        sync_cursor
      )
      VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 IS NULL THEN NULL ELSE now() END, CASE WHEN $7::jsonb IS NULL THEN NULL ELSE $7::jsonb END)
      ON CONFLICT (user_id, source) DO UPDATE SET
        connected = EXCLUDED.connected,
        scopes = EXCLUDED.scopes,
        last_sync_at = COALESCE(EXCLUDED.last_sync_at, google_connections.last_sync_at),
        last_error = EXCLUDED.last_error,
        last_error_at = CASE WHEN EXCLUDED.last_error IS NULL THEN NULL ELSE now() END,
        sync_cursor = COALESCE(EXCLUDED.sync_cursor, google_connections.sync_cursor),
        updated_at = now()
      `,
      input.userId,
      input.source,
      input.connected,
      input.scopes,
      input.lastSyncAt ?? null,
      input.lastError ?? null,
      syncCursor,
    );
  } catch {
    // The table is migration-backed. Google sync should still work in partially
    // migrated local/demo environments; health/readiness will report the gap.
  }
}

function toPublicErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1000);
  return String(error).slice(0, 1000);
}
