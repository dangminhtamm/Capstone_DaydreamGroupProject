-- Minimize stored Google payloads. The app keeps normalized fields needed for
-- citations/indexing and no longer stores full provider payloads by default.
UPDATE gmail_messages SET raw_json = NULL WHERE raw_json IS NOT NULL;
UPDATE google_drive_files SET raw_json = NULL WHERE raw_json IS NOT NULL;
UPDATE google_contacts SET raw_json = NULL WHERE raw_json IS NOT NULL;
