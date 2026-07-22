import { prisma } from '../../lib/prisma';
import { indexMemoryFromCalendar } from '@second-brain/ai';
import cron from 'node-cron';

export class CalendarIndexWorker {
    static startCron() {
        cron.schedule('*/5 * * * *', async () => {
            console.log('[Cron] Checking for pending Calendar Indexing jobs...');
            await this.processPendingJobs();
        });

     console.log('Background Worker for Index Calendar started.');

    }
    static async processPendingJobs() {
        const pendingJobs = await prisma.indexingOutbox.findMany({
            where: {
                status: 'pending',
                source_type: 'calendar',
            },
            take: 10,
        });

        if (pendingJobs.length === 0) return;

        for (const job of pendingJobs) {
            try {
                await prisma.indexingOutbox.update({
                    where: { id: job.id },
                    data: { status: 'processing', locked_at: new Date() },
                });

                const calendarEvent = await prisma.calendarEvent.findUnique({
                    where: { id: job.source_id },
                });

                if (!calendarEvent) {
                    await prisma.indexingOutbox.update({
                        where: { id: job.id },
                        data: { status: 'failed', error: 'Calendar event not found' },
                    });
                    continue;
                }

                const aiResult = await indexMemoryFromCalendar({
                    userId: job.user_id,
                    events: [
                        {
                            eventId: calendarEvent.id,
                            externalId: calendarEvent.external_id,
                            title: calendarEvent.title,
                            description: calendarEvent.description || '',
                            startTime: calendarEvent.start_time,
                            endTime: calendarEvent.end_time,
                        }
                    ],

                    insertChunks: async (chunks) => {
                        await prisma.$executeRaw`
                                DELETE FROM memory_chunks 
                                WHERE source_type = 'calendar' 
                                AND source_id = ${calendarEvent.id};
                            `;
                        for (const chunk of chunks) {
                            const vectorString = `[${chunk.embedding.join(',')}]`;

                            await prisma.$executeRaw`
                INSERT INTO memory_chunks (
                  id, user_id, source_type, source_id, content, metadata, embedding, created_at, updated_at
                )
                VALUES (
                  gen_random_uuid(),
                  ${job.user_id},
                  'calendar',
                  ${chunk.sourceId || calendarEvent.id},
                  ${chunk.text},
                  ${JSON.stringify(chunk.metadata || {})}::jsonb,
                  ${vectorString}::vector,
                  now(),
                  now()
                );
              `;
                        }
                    }
                });

                await prisma.indexingOutbox.update({
                    where: { id: job.id },
                    data: { status: 'completed', processed_at: new Date() },
                });

                console.log(`[Worker - Calendar Index] Indexed event: ${calendarEvent.title} (Created ${aiResult.totalChunkCount} chunks)`);
            } catch (error: any) {
                console.error(`[Worker - Calendar Index] Failed job [${job.id}]:`, error.message);
                await prisma.indexingOutbox.update({
                    where: { id: job.id },
                    data: {
                        status: 'failed',
                        error: error.message,
                        retry_count: { increment: 1 }
                    },
                });
            }
        }
    }
}