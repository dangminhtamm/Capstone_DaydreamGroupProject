-- Application data is accessed through the Nest API, not directly through
-- Supabase Data API. RLS remains an additional guard even if table grants are
-- accidentally restored later. Supabase Auth and Storage use separate schemas
-- and are not affected by this migration.

DO $security$
DECLARE
  table_name TEXT;
  backend_role TEXT := current_user;
  protected_tables TEXT[] := ARRAY[
    'users',
    'diary_entries',
    'attachments',
    'calendar_events',
    '_CalendarEventToDiaryEntry',
    'summaries',
    'memory_chunks',
    'entity_mentions',
    'gmail_messages',
    'google_contacts',
    'google_drive_files',
    'google_connections',
    'search_history',
    'indexing_outbox',
    'worker_heartbeats'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format(
        'DROP POLICY IF EXISTS backend_full_access ON public.%I',
        table_name
      );
      EXECUTE format(
        'CREATE POLICY backend_full_access ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        table_name,
        backend_role
      );

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  END IF;
END
$security$;
