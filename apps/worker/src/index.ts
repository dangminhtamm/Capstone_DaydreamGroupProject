// apps/worker/src/index.ts
import './env';

// 1. Import all background jobs with a single line
import {
    SummaryPipelineJob,
    WeeklySummaryPipelineJob,
    MonthlySummaryPipelineJob,
    YearlySummaryPipelineJob,
    SyncCalendarJob,
    SemanticLinkingJob,
    DataIngestionJob,
    CalendarIndexWorker
} from './jobs';

console.log('===================================================');
console.log('Starting [The Second Brain] Background Worker...');
console.log('===================================================');

// 2. Initialize and start all Cron Jobs
try {
    // Data Retrieval Pipeline
    SyncCalendarJob.startCron();

    // Data Linking Pipeline
    SemanticLinkingJob.startCron();

    // Universal Data Ingestion
    DataIngestionJob.startCron();
    DataIngestionJob.startRealtimeListener();

    // AI Data Indexing Pipeline
    CalendarIndexWorker.startCron();

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
    process.exit(1);
}

// 3. Keep the Worker process alive
// For pure Node.js environments without an HTTP server
setInterval(() => { }, 1000 * 60 * 60);
