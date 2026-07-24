import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or DIRECT_URL is required.');
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(scriptDir, '..', 'prisma', 'migrations');
const client = new Client({ connectionString });

await client.connect();

try {
  await ensurePrismaMigrationsTable();

  const migrationNames = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationNames) {
    const existing = await client.query(
      'SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = $1 AND rolled_back_at IS NULL LIMIT 1',
      [migrationName],
    );

    if (existing.rowCount) {
      console.log(`skip ${migrationName}`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, migrationName, 'migration.sql'), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    if (await canBaselineLegacyMigration(migrationName)) {
      console.log(`baseline ${migrationName}`);
      await recordMigration(migrationName, checksum, 0, 'Baselined against an existing legacy Supabase schema.');
      continue;
    }

    console.log(`apply ${migrationName}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await recordMigration(migrationName, checksum, 1);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  const status = await readStatus();
  console.log(JSON.stringify(status, null, 2));
} finally {
  await client.end();
}

async function ensurePrismaMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function canBaselineLegacyMigration(migrationName) {
  if (migrationName !== '202605100001_align_memory_chunks_with_ai_pipeline') {
    return false;
  }

  const { rows } = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'memory_chunks_user_source_chunk_key'
      ) AS has_unique_chunk_key,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_chunks'
          AND column_name = 'occurred_at'
      ) AS has_occurred_at
  `);

  return Boolean(rows[0]?.has_unique_chunk_key && rows[0]?.has_occurred_at);
}

async function recordMigration(migrationName, checksum, appliedStepsCount, logs = null) {
  await client.query(
    `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, NOW(), $3, $4, NULL, NOW(), $5)`,
    [randomUUID(), checksum, migrationName, logs, appliedStepsCount],
  );
}

async function readStatus() {
  const { rows } = await client.query(`
    SELECT
      to_regclass('public.indexing_outbox')::text AS indexing_outbox,
      to_regclass('public._prisma_migrations')::text AS prisma_migrations,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'calendar_events_user_external_key'
      ) AS calendar_events_user_external_key,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'google_contacts_user_external_key'
      ) AS google_contacts_user_external_key,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'google_drive_files_user_external_key'
      ) AS google_drive_files_user_external_key,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'summaries_user_type_period_key'
      ) AS summaries_user_type_period_key,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'indexing_outbox_job_source_key'
      ) AS indexing_outbox_job_source_key,
      (
        SELECT COUNT(*)::int FROM "_prisma_migrations"
      ) AS prisma_migration_count
  `);

  return rows[0];
}
