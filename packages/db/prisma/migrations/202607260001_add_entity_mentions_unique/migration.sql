-- Make EntityMention idempotent per memory chunk.
-- Existing data may contain duplicates because older inserts used
-- ON CONFLICT DO NOTHING without a matching unique constraint.

DO $$
BEGIN
  IF to_regclass('public.entity_mentions') IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM "entity_mentions" newer
  USING "entity_mentions" older
  WHERE newer."chunk_id" = older."chunk_id"
    AND newer."entity_type" = older."entity_type"
    AND newer."entity_value" = older."entity_value"
    AND newer.ctid > older.ctid;

  CREATE UNIQUE INDEX IF NOT EXISTS "entity_mentions_chunk_type_value_key"
    ON "entity_mentions" ("chunk_id", "entity_type", "entity_value");
END $$;
