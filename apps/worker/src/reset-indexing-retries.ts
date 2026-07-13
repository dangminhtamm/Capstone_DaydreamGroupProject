import './env';
import { prisma } from './lib/prisma';

async function main() {
  const rows = await prisma.$executeRawUnsafe(
    `
      UPDATE indexing_outbox
      SET status = 'pending',
          retry_count = 0,
          error = NULL,
          run_after = now(),
          locked_at = NULL,
          processed_at = NULL,
          updated_at = now()
      WHERE job_type = 'index_memory'
        AND status IN ('pending', 'retry', 'dead_letter')
        AND (
          error ILIKE '%Unknown source_type%'
          OR error ILIKE '%Unsupported indexing source_type%'
        )
    `,
  );

  console.log(JSON.stringify({ requeued: Number(rows) }, null, 2));
}

main()
  .catch((error) => {
    console.error('[Worker - Ingestion] Failed to reset indexing retries:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
