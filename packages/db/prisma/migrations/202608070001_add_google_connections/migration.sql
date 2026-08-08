CREATE TABLE IF NOT EXISTS google_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  sync_cursor JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS google_connections_user_source_key
  ON google_connections(user_id, source);

CREATE INDEX IF NOT EXISTS google_connections_user_connected_idx
  ON google_connections(user_id, connected);

INSERT INTO google_connections (user_id, source, connected, scopes, last_sync_at)
SELECT
  users.id,
  source_data.source,
  users.google_connected AND (users.google_access_token IS NOT NULL OR users.google_refresh_token IS NOT NULL),
  source_data.scopes,
  source_data.last_sync_at
FROM users
CROSS JOIN LATERAL (
  VALUES
    (
      'calendar',
      ARRAY['https://www.googleapis.com/auth/calendar.readonly']::TEXT[],
      (
        SELECT MAX(updated_at)
        FROM calendar_events
        WHERE calendar_events.user_id = users.id
      )
    ),
    (
      'gmail',
      ARRAY['https://www.googleapis.com/auth/gmail.readonly']::TEXT[],
      (
        SELECT MAX(updated_at)
        FROM gmail_messages
        WHERE gmail_messages.user_id = users.id
      )
    ),
    (
      'drive',
      ARRAY['https://www.googleapis.com/auth/drive.readonly']::TEXT[],
      (
        SELECT MAX(updated_at)
        FROM google_drive_files
        WHERE google_drive_files.user_id = users.id
      )
    ),
    (
      'contact',
      ARRAY['https://www.googleapis.com/auth/contacts.readonly']::TEXT[],
      (
        SELECT MAX(updated_at)
        FROM google_contacts
        WHERE google_contacts.user_id = users.id
      )
    )
) AS source_data(source, scopes, last_sync_at)
WHERE users.google_connected = TRUE
  AND (users.google_access_token IS NOT NULL OR users.google_refresh_token IS NOT NULL)
ON CONFLICT (user_id, source) DO UPDATE SET
  connected = EXCLUDED.connected,
  scopes = EXCLUDED.scopes,
  last_sync_at = COALESCE(google_connections.last_sync_at, EXCLUDED.last_sync_at),
  updated_at = now();
