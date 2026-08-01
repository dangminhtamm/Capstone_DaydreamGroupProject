CREATE TABLE IF NOT EXISTS "gmail_messages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "thread_id" TEXT,
  "sender" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "snippet" TEXT,
  "body" TEXT NOT NULL,
  "received_at" TIMESTAMP(3),
  "raw_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gmail_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gmail_messages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "gmail_messages"
  ADD COLUMN IF NOT EXISTS "thread_id" TEXT,
  ADD COLUMN IF NOT EXISTS "snippet" TEXT,
  ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "raw_json" JSONB,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "gmail_messages"
  DROP CONSTRAINT IF EXISTS "gmail_messages_external_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "gmail_messages_user_external_key"
  ON "gmail_messages" ("user_id", "external_id");

CREATE INDEX IF NOT EXISTS "gmail_messages_user_received_at_idx"
  ON "gmail_messages" ("user_id", "received_at");
