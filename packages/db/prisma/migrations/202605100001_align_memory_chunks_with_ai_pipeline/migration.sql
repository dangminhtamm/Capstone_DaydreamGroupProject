CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF to_regclass('public.memory_chunks') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "memory_chunks"
    ADD COLUMN IF NOT EXISTS "chunk_index" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "evidence" TEXT,
    ADD COLUMN IF NOT EXISTS "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

  WITH numbered_chunks AS (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "user_id", "source_type", "source_id"
        ORDER BY "created_at", "id"
      ) - 1 AS next_chunk_index
    FROM "memory_chunks"
  )
  UPDATE "memory_chunks" AS chunk
  SET "chunk_index" = numbered_chunks.next_chunk_index
  FROM numbered_chunks
  WHERE chunk."id" = numbered_chunks."id";

  CREATE UNIQUE INDEX IF NOT EXISTS "memory_chunks_user_source_chunk_key"
    ON "memory_chunks" ("user_id", "source_type", "source_id", "chunk_index");

  CREATE INDEX IF NOT EXISTS "memory_chunks_user_occurred_at_idx"
    ON "memory_chunks" ("user_id", "occurred_at");

  CREATE INDEX IF NOT EXISTS "memory_chunks_embedding_hnsw_idx"
    ON "memory_chunks"
    USING hnsw ("embedding" vector_cosine_ops)
    WHERE "embedding" IS NOT NULL;
END $$;
