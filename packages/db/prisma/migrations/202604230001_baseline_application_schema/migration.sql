-- This repository originally relied on `prisma db push`, so the historical
-- migrations assume the core tables already exist. Build the complete schema
-- only for a genuinely empty database. Existing installations skip this block
-- and continue with the forward-only migrations below it.
DO $baseline$
BEGIN
IF to_regclass('public.users') IS NOT NULL THEN
    RAISE NOTICE 'Core application schema already exists; baseline skipped.';
    RETURN;
END IF;

-- Extensions are only created while provisioning a blank database. Existing
-- managed Supabase databases may expose them without granting CREATE EXTENSION.
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "html_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_contacts" (
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

    CONSTRAINT "google_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_drive_files" (
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

    CONSTRAINT "google_drive_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_connections" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "sync_cursor" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "summary_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_mentions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "chunk_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_messages" (
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

    CONSTRAINT "gmail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "supabaseId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "google_connected" BOOLEAN NOT NULL DEFAULT false,
    "google_access_token" TEXT,
    "google_refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "diary_entry_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "sources_json" TEXT,
    "analytics_json" TEXT,
    "response_language" TEXT NOT NULL DEFAULT 'en',
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_outbox" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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

    CONSTRAINT "indexing_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "status" TEXT NOT NULL DEFAULT 'running',
    "detail" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_chunks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_type" TEXT NOT NULL DEFAULT 'general_note',
    "text" TEXT NOT NULL,
    "evidence" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(768),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CalendarEventToDiaryEntry" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CalendarEventToDiaryEntry_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "calendar_events_user_start_time_idx" ON "calendar_events"("user_id", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_user_external_key" ON "calendar_events"("user_id", "external_id");

-- CreateIndex
CREATE INDEX "google_contacts_user_display_name_idx" ON "google_contacts"("user_id", "display_name");

-- CreateIndex
CREATE UNIQUE INDEX "google_contacts_user_external_key" ON "google_contacts"("user_id", "external_id");

-- CreateIndex
CREATE INDEX "google_drive_files_user_modified_time_idx" ON "google_drive_files"("user_id", "modified_time");

-- CreateIndex
CREATE UNIQUE INDEX "google_drive_files_user_external_key" ON "google_drive_files"("user_id", "external_id");

-- CreateIndex
CREATE INDEX "google_connections_user_connected_idx" ON "google_connections"("user_id", "connected");

-- CreateIndex
CREATE UNIQUE INDEX "google_connections_user_source_key" ON "google_connections"("user_id", "source");

-- CreateIndex
CREATE INDEX "summaries_user_period_start_idx" ON "summaries"("user_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "summaries_user_type_period_key" ON "summaries"("user_id", "summary_type", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "entity_mentions_type_value_idx" ON "entity_mentions"("entity_type", "entity_value");

-- CreateIndex
CREATE INDEX "entity_mentions_chunk_id_idx" ON "entity_mentions"("chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_mentions_chunk_type_value_key" ON "entity_mentions"("chunk_id", "entity_type", "entity_value");

-- CreateIndex
CREATE INDEX "gmail_messages_user_received_at_idx" ON "gmail_messages"("user_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_messages_user_external_key" ON "gmail_messages"("user_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseId_key" ON "users"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "search_history_user_created_idx" ON "search_history"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "search_history_user_question_idx" ON "search_history"("user_id", "question");

-- CreateIndex
CREATE INDEX "indexing_outbox_status_run_after_idx" ON "indexing_outbox"("status", "run_after", "created_at");

-- CreateIndex
CREATE INDEX "indexing_outbox_user_status_created_idx" ON "indexing_outbox"("user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "indexing_outbox_job_source_key" ON "indexing_outbox"("job_type", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "worker_heartbeats_heartbeat_at_idx" ON "worker_heartbeats"("heartbeat_at");

-- CreateIndex
CREATE INDEX "memory_chunks_user_source_idx" ON "memory_chunks"("user_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "memory_chunks_user_occurred_at_idx" ON "memory_chunks"("user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "memory_chunks_user_source_chunk_key" ON "memory_chunks"("user_id", "source_type", "source_id", "chunk_index");

-- CreateIndex
CREATE INDEX "_CalendarEventToDiaryEntry_B_index" ON "_CalendarEventToDiaryEntry"("B");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_contacts" ADD CONSTRAINT "google_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_drive_files" ADD CONSTRAINT "google_drive_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "memory_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_messages" ADD CONSTRAINT "gmail_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indexing_outbox" ADD CONSTRAINT "indexing_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventToDiaryEntry" ADD CONSTRAINT "_CalendarEventToDiaryEntry_A_fkey" FOREIGN KEY ("A") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventToDiaryEntry" ADD CONSTRAINT "_CalendarEventToDiaryEntry_B_fkey" FOREIGN KEY ("B") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

END
$baseline$;
