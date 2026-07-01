-- Calendar events are tenant-scoped. Google external IDs must not be unique
-- across the whole table because different users can have the same provider ID.

DO $$
BEGIN
  IF to_regclass('public.calendar_events') IS NOT NULL THEN
    -- Keep the newest row for accidental duplicates of the target compound key.
    WITH ranked_events AS (
      SELECT
        "id",
        ROW_NUMBER() OVER (
          PARTITION BY "user_id", "external_id"
          ORDER BY "updated_at" DESC, "created_at" DESC, "id"
        ) AS row_number
      FROM "calendar_events"
    )
    DELETE FROM "calendar_events"
    WHERE "id" IN (
      SELECT "id"
      FROM ranked_events
      WHERE row_number > 1
    );

    ALTER TABLE "calendar_events"
      DROP CONSTRAINT IF EXISTS "calendar_events_external_id_key";

    DROP INDEX IF EXISTS "calendar_events_external_id_key";

    CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_user_external_key"
      ON "calendar_events" ("user_id", "external_id");

    CREATE INDEX IF NOT EXISTS "calendar_events_user_start_time_idx"
      ON "calendar_events" ("user_id", "start_time");
  END IF;
END $$;

-- Summaries are generated per user, type, and exact period. This unique key
-- makes API/worker generation idempotent even under concurrent runs.

DO $$
BEGIN
  IF to_regclass('public.summaries') IS NOT NULL THEN
    -- Keep the newest generated summary for duplicate periods.
    WITH ranked_summaries AS (
      SELECT
        "id",
        ROW_NUMBER() OVER (
          PARTITION BY "user_id", "summary_type", "period_start", "period_end"
          ORDER BY "created_at" DESC, "id"
        ) AS row_number
      FROM "summaries"
    )
    DELETE FROM "summaries"
    WHERE "id" IN (
      SELECT "id"
      FROM ranked_summaries
      WHERE row_number > 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "summaries_user_type_period_key"
      ON "summaries" ("user_id", "summary_type", "period_start", "period_end");

    CREATE INDEX IF NOT EXISTS "summaries_user_period_start_idx"
      ON "summaries" ("user_id", "period_start");
  END IF;
END $$;
