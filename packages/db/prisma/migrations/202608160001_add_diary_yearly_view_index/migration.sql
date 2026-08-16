CREATE INDEX IF NOT EXISTS "diary_entries_user_entry_date_idx"
ON "diary_entries" ("user_id", "entry_date" DESC);
