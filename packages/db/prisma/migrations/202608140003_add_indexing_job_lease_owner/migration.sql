ALTER TABLE "indexing_outbox"
ADD COLUMN IF NOT EXISTS "locked_by" VARCHAR(128);

CREATE INDEX IF NOT EXISTS "indexing_outbox_processing_lease_idx"
ON "indexing_outbox" ("status", "locked_at")
WHERE "status" = 'processing';
