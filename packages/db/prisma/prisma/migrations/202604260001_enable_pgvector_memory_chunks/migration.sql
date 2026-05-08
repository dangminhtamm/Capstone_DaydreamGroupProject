CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE IF EXISTS "memory_chunks"
  ADD COLUMN IF NOT EXISTS "chunk_type" TEXT NOT NULL DEFAULT 'general_note',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "memory_chunks_user_source_idx"
  ON "memory_chunks" ("user_id", "source_type", "source_id");
