-- ============================================================================
-- Migration: Optimize HNSW Index + Add Entity Mention Indexes
-- Purpose:
--   1. Replace the basic HNSW index with a tuned version (m=16, ef_construction=200)
--      for better recall/speed tradeoff at scale (1000s of chunks).
--   2. Add indexes on entity_mentions for fast Knowledge Graph queries.
--   3. Add a composite index for common filter patterns (user + chunk_type + occurred_at).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.memory_chunks') IS NULL THEN
    RETURN;
  END IF;

  -- 1. Drop existing basic HNSW index and recreate with tuned parameters
  --    m=16: each node connects to 16 neighbors (good balance of speed/recall)
  --    ef_construction=200: higher build quality → better recall at query time
  DROP INDEX IF EXISTS "memory_chunks_embedding_hnsw_idx";

  CREATE INDEX IF NOT EXISTS "memory_chunks_embedding_hnsw_idx"
    ON "memory_chunks"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 200)
    WHERE "embedding" IS NOT NULL;

  -- 2. Composite index for filtered retrieval queries
  --    Covers the common pattern: WHERE user_id = ? AND chunk_type = ? ORDER BY occurred_at
  CREATE INDEX IF NOT EXISTS "memory_chunks_user_chunk_type_occurred_idx"
    ON "memory_chunks" ("user_id", "chunk_type", "occurred_at" DESC);

  -- 3. Index for source_type filtering (used in retrieval.ts filters)
  CREATE INDEX IF NOT EXISTS "memory_chunks_user_source_type_idx"
    ON "memory_chunks" ("user_id", "source_type");

END $$;

-- 4. Entity Mention indexes for Knowledge Graph queries
DO $$
BEGIN
  IF to_regclass('public.entity_mentions') IS NULL THEN
    RETURN;
  END IF;

  -- Fast lookup: "Find all mentions of entity type X with value Y"
  CREATE INDEX IF NOT EXISTS "entity_mentions_type_value_idx"
    ON "entity_mentions" ("entity_type", "entity_value");

  -- Fast lookup: "Find all entities extracted from chunk X"
  CREATE INDEX IF NOT EXISTS "entity_mentions_chunk_id_idx"
    ON "entity_mentions" ("chunk_id");

END $$;
