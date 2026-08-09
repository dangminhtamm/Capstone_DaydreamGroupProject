// apps/worker/src/index.ts
import { prisma } from './lib/prisma';
import { captureWorkerException } from './instrument';

// 1. Import all background jobs with a single line
import {
    SummaryPipelineJob,
    WeeklySummaryPipelineJob,
    MonthlySummaryPipelineJob,
    YearlySummaryPipelineJob,
    SyncCalendarJob,
    SemanticLinkingJob,
    DataIngestionJob
} from './jobs';

console.log('===================================================');
console.log('Starting [The Second Brain] Background Worker...');
console.log('===================================================');

const WORKER_HEARTBEAT_ID = process.env.WORKER_HEARTBEAT_ID ?? 'indexing-worker';
const WORKER_HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 15000);
let heartbeatTimer: NodeJS.Timeout | null = null;

async function writeWorkerHeartbeat(status: 'running' | 'stopping', detail?: string) {
    try {
        await prisma.$executeRawUnsafe(
            `
            INSERT INTO worker_heartbeats (id, status, detail, started_at, heartbeat_at, updated_at)
            VALUES ($1, $2, $3, now(), now(), now())
            ON CONFLICT (id)
            DO UPDATE SET
                status = EXCLUDED.status,
                detail = EXCLUDED.detail,
                heartbeat_at = now(),
                updated_at = now()
            `,
            WORKER_HEARTBEAT_ID,
            status,
            detail ?? null,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[WorkerHeartbeat] Could not write heartbeat: ${message}`);
    }
}

function startWorkerHeartbeat() {
    void writeWorkerHeartbeat('running', 'Worker process started and cron jobs are scheduled.');
    heartbeatTimer = setInterval(() => {
        void writeWorkerHeartbeat('running', 'Worker process is alive.');
    }, Math.max(5000, WORKER_HEARTBEAT_INTERVAL_MS));
    heartbeatTimer.unref?.();
}

function installShutdownHandler(signal: NodeJS.Signals) {
    process.on(signal, () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        void writeWorkerHeartbeat('stopping', `Worker received ${signal}.`).finally(() => {
            void prisma.$disconnect().finally(() => process.exit(0));
        });
    });
}

// 2. Initialize and start all Cron Jobs
try {
    startWorkerHeartbeat();

    // Data Retrieval Pipeline
    SyncCalendarJob.startCron();

    // Data Linking Pipeline
    SemanticLinkingJob.startCron();

    // Universal Data Ingestion
    DataIngestionJob.startCron();
    DataIngestionJob.startRealtimeListener();

    // Data Summarization Pipeline
    SummaryPipelineJob.startCron();
    WeeklySummaryPipelineJob.startCron();
    MonthlySummaryPipelineJob.startCron();
    YearlySummaryPipelineJob.startCron();

    console.log('===================================================');
    console.log('All background jobs have been scheduled successfully!');
    console.log('===================================================');
} catch (error) {
    console.error('Critical error while starting the Worker:', error);
    void captureWorkerException(error).finally(() => process.exit(1));
}

installShutdownHandler('SIGINT');
installShutdownHandler('SIGTERM');

// 3. Keep the Worker process alive & expose a health endpoint for Render Free Web Service
import http from 'http';

const port = Number(process.env.PORT ?? 3002);
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', workerId: WORKER_HEARTBEAT_ID, uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Worker health HTTP server listening on port ${port}`);
});

function closeHttpServer() {
  server.close();
}

process.on('SIGINT', closeHttpServer);
process.on('SIGTERM', closeHttpServer);
