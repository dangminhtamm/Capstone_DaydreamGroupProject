CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'running',
  "detail" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "worker_heartbeats_heartbeat_at_idx"
  ON "worker_heartbeats"("heartbeat_at");
