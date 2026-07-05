import './env';
import { DataIngestionJob } from './jobs/ingestion/ingestion';
import { prisma } from './lib/prisma';

async function main() {
  const batchSize = Number(process.env.INDEXING_DRAIN_BATCH_SIZE ?? 10);
  const maxBatches = Number(process.env.INDEXING_DRAIN_MAX_BATCHES ?? 20);
  const totals = {
    batches: 0,
    found: 0,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    resetStale: 0,
  };

  for (let i = 0; i < maxBatches; i += 1) {
    const result = await DataIngestionJob.processPendingIndexingJobs(batchSize);
    totals.batches += 1;
    totals.found += result.found;
    totals.claimed += result.claimed;
    totals.succeeded += result.succeeded;
    totals.failed += result.failed;
    totals.resetStale += result.resetStale;

    if (result.claimed === 0) break;
  }

  console.log(JSON.stringify(totals, null, 2));
}

main()
  .catch((error) => {
    console.error('[Worker - Ingestion] Drain failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
