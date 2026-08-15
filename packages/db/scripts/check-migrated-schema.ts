import pg from 'pg';
import { fileURLToPath } from 'node:url';

const { Client } = pg;

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
}

const requiredTables = [
  'users',
  'diary_entries',
  'attachments',
  'calendar_events',
  '_CalendarEventToDiaryEntry',
  'summaries',
  'memory_chunks',
  'entity_mentions',
  'gmail_messages',
  'google_contacts',
  'google_drive_files',
  'google_connections',
  'search_history',
  'indexing_outbox',
  'worker_heartbeats',
] as const;

const requiredColumns: Record<string, readonly string[]> = {
  users: ['supabaseId', 'role', 'google_access_token', 'google_refresh_token'],
  diary_entries: ['entry_date', 'mood', 'tags'],
  memory_chunks: ['chunk_index', 'chunk_type', 'occurred_at', 'embedding'],
  indexing_outbox: ['status', 'retry_count', 'run_after', 'locked_at', 'locked_by'],
  google_connections: ['source', 'connected', 'last_error', 'sync_cursor'],
};

const requiredIndexes = [
  'calendar_events_user_external_key',
  'summaries_user_type_period_key',
  'memory_chunks_user_source_chunk_key',
  'memory_chunks_text_search_idx',
  'indexing_outbox_status_run_after_idx',
  'indexing_outbox_processing_lease_idx',
  'google_connections_user_source_key',
  'worker_heartbeats_heartbeat_at_idx',
] as const;

function fail(message: string): never {
  throw new Error(`Migrated schema check failed: ${message}`);
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) fail('DIRECT_URL or DATABASE_URL is required');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const tables = await client.query<{ table_name: string; rls_enabled: boolean }>(
      `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p')
         AND c.relname = ANY($1::text[])`,
      [requiredTables],
    );

    const tableMap = new Map(tables.rows.map((row) => [row.table_name, row]));
    const missingTables = requiredTables.filter((name) => !tableMap.has(name));
    if (missingTables.length > 0) fail(`missing tables: ${missingTables.join(', ')}`);

    const rlsDisabled = requiredTables.filter((name) => !tableMap.get(name)?.rls_enabled);
    if (rlsDisabled.length > 0) fail(`RLS disabled on: ${rlsDisabled.join(', ')}`);

    const policies = await client.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_policies
       WHERE schemaname = 'public'
         AND policyname = 'backend_full_access'
         AND tablename = ANY($1::text[])`,
      [requiredTables],
    );
    const policyTables = new Set(policies.rows.map((row) => row.tablename));
    const missingPolicies = requiredTables.filter((name) => !policyTables.has(name));
    if (missingPolicies.length > 0) {
      fail(`backend RLS policy missing on: ${missingPolicies.join(', ')}`);
    }

    const exposedGrants = await client.query<{ grantee: string; table_name: string }>(
      `SELECT grantee, table_name
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND grantee IN ('anon', 'authenticated')
         AND table_name = ANY($1::text[])`,
      [requiredTables],
    );
    if (exposedGrants.rows.length > 0) {
      fail(
        `Supabase Data API grants remain: ${exposedGrants.rows
          .map((row) => `${row.grantee}.${row.table_name}`)
          .join(', ')}`,
      );
    }

    const columns = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [Object.keys(requiredColumns)],
    );
    const availableColumns = new Set(
      columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
      names
        .filter((name) => !availableColumns.has(`${table}.${name}`))
        .map((name) => `${table}.${name}`),
    );
    if (missingColumns.length > 0) fail(`missing columns: ${missingColumns.join(', ')}`);

    const indexes = await client.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])`,
      [requiredIndexes],
    );
    const availableIndexes = new Set(indexes.rows.map((row) => row.indexname));
    const missingIndexes = requiredIndexes.filter((name) => !availableIndexes.has(name));
    if (missingIndexes.length > 0) fail(`missing indexes: ${missingIndexes.join(', ')}`);

    console.log(
      `Migrated schema is ready: ${requiredTables.length} tables, RLS enabled, and critical indexes present.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
