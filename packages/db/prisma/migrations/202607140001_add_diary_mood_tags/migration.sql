ALTER TABLE "diary_entries"
  ADD COLUMN "mood" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "diary_entries_user_mood_idx"
  ON "diary_entries" ("user_id", "mood");

CREATE INDEX "diary_entries_tags_gin_idx"
  ON "diary_entries"
  USING GIN ("tags");
