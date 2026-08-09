UPDATE memory_chunks
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'date',
    COALESCE(metadata->>'date', metadata->>'memoryDate', occurred_at::text),
    'memoryDate',
    COALESCE(metadata->>'memoryDate', metadata->>'date', occurred_at::text)
  ),
  updated_at = now()
WHERE COALESCE(metadata->>'memoryDate', '') = ''
   OR COALESCE(metadata->>'date', '') = '';
