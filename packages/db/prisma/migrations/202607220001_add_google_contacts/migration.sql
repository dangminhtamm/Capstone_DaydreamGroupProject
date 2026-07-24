CREATE TABLE IF NOT EXISTS "google_contacts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "email_addresses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "phone_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "organizations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "photo_url" TEXT,
  "raw_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_contacts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_contacts_user_external_key"
  ON "google_contacts"("user_id", "external_id");

CREATE INDEX IF NOT EXISTS "google_contacts_user_display_name_idx"
  ON "google_contacts"("user_id", "display_name");
