CREATE OR REPLACE FUNCTION notify_indexing_outbox_jobs()
RETURNS trigger AS $$
DECLARE
  payload text;
BEGIN
  IF NEW.job_type = 'index_memory'
     AND NEW.status IN ('pending', 'retry')
     AND NEW.run_after <= now()
  THEN
    payload := json_build_object(
      'id', NEW.id,
      'sourceType', NEW.source_type,
      'sourceId', NEW.source_id,
      'status', NEW.status
    )::text;

    PERFORM pg_notify('indexing_outbox_jobs', payload);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS indexing_outbox_jobs_notify_trigger ON indexing_outbox;

CREATE TRIGGER indexing_outbox_jobs_notify_trigger
AFTER INSERT OR UPDATE OF status, run_after ON indexing_outbox
FOR EACH ROW
EXECUTE FUNCTION notify_indexing_outbox_jobs();
