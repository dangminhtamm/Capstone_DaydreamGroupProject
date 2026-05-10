DO $$
BEGIN
  IF to_regclass('public.memory_chunks') IS NULL THEN
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS "memory_chunks_text_search_idx"
    ON "memory_chunks"
    USING gin (
      to_tsvector(
        'simple',
        coalesce("text", '') || ' ' || coalesce("evidence", '') || ' ' || coalesce("metadata"::text, '')
      )
    );
END $$;
