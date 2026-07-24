CREATE TABLE IF NOT EXISTS "google_drive_files" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "web_view_link" TEXT,
  "icon_link" TEXT,
  "thumbnail_link" TEXT,
  "size" BIGINT,
  "modified_time" TIMESTAMP(3),
  "extracted_text" TEXT,
  "raw_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_drive_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_drive_files_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_drive_files_user_external_key"
  ON "google_drive_files"("user_id", "external_id");

CREATE INDEX IF NOT EXISTS "google_drive_files_user_modified_time_idx"
  ON "google_drive_files"("user_id", "modified_time");
