UPDATE indexing_outbox
SET status = 'succeeded',
    error = NULL,
    locked_at = NULL,
    processed_at = COALESCE(processed_at, updated_at, now()),
    updated_at = now()
WHERE job_type = 'index_memory'
  AND status = 'completed';
