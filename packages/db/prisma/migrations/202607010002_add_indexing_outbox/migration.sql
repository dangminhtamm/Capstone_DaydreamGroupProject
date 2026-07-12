CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "indexing_outbox" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "job_type" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "max_retries" INTEGER NOT NULL DEFAULT 3,
  "error" TEXT,
  "payload" JSONB,
  "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "indexing_outbox_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "indexing_outbox_job_source_key"
  ON "indexing_outbox" ("job_type", "source_type", "source_id");

CREATE INDEX IF NOT EXISTS "indexing_outbox_status_run_after_idx"
  ON "indexing_outbox" ("status", "run_after", "created_at");

CREATE INDEX IF NOT EXISTS "indexing_outbox_user_status_created_idx"
  ON "indexing_outbox" ("user_id", "status", "created_at");
