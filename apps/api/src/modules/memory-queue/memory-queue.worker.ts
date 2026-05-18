// apps/api/src/modules/memory-queue/memory-queue.worker.ts
//
// The BullMQ worker (consumer) that processes AI memory indexing jobs.
// This runs in the same process as the NestJS API for simplicity, but could
// be deployed as a separate service later for horizontal scaling.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { indexMemoryFromDiary, indexMemoryFromCalendar } from '@second-brain/ai';
import {
  deleteMemoryChunksForSource,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
} from '@second-brain/db';
import { PrismaService } from '../../prisma/prisma.service';
import { MEMORY_INDEX_QUEUE, MemoryJobType } from './memory-queue.constants';
import type { IndexDiaryJobData, IndexCalendarJobData } from './memory-queue.producer';

@Processor(MEMORY_INDEX_QUEUE, {
  concurrency: 2, // Process up to 2 jobs in parallel
})
export class MemoryQueueWorker extends WorkerHost {
  private readonly logger = new Logger(MemoryQueueWorker.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.name} [${job.id}] attempt #${job.attemptsMade + 1}`);

    switch (job.name) {
      case MemoryJobType.INDEX_DIARY:
        return this.handleDiaryIndex(job.data as IndexDiaryJobData, job);

      case MemoryJobType.INDEX_CALENDAR:
        return this.handleCalendarIndex(job.data as IndexCalendarJobData, job);

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return { skipped: true };
    }
  }

  // -----------------------------------------------------------------------
  // Diary Indexing
  // -----------------------------------------------------------------------

  private async handleDiaryIndex(data: IndexDiaryJobData, job: Job) {
    const startTime = Date.now();

    const indexingResult = await indexMemoryFromDiary({
      userId: data.userId,
      diaryId: data.diaryId,
      rawText: data.rawText,
      entryDate: data.entryDate,
      sourceTitle: data.sourceTitle,
      insertChunks: (chunks) =>
        this.prisma.$transaction(async (tx) => {
          await insertMemoryChunks(tx as any, chunks);
          await pruneMemoryChunksForSource(tx as any, {
            userId: data.userId,
            sourceType: 'diary',
            sourceId: data.diaryId,
            keepChunkCount: chunks.length,
          });
        }),
    });

    if (indexingResult.chunkCount === 0) {
      await deleteMemoryChunksForSource(this.prisma as any, {
        userId: data.userId,
        sourceType: 'diary',
        sourceId: data.diaryId,
      });
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Diary ${data.diaryId} indexed: ${indexingResult.chunkCount} chunks in ${duration}ms`,
    );

    await job.updateProgress(100);
    return {
      chunkCount: indexingResult.chunkCount,
      durationMs: duration,
    };
  }

  // -----------------------------------------------------------------------
  // Calendar Indexing
  // -----------------------------------------------------------------------

  private async handleCalendarIndex(data: IndexCalendarJobData, job: Job) {
    const startTime = Date.now();

    const calendarInputs = data.events.map((e) => ({
      eventId: e.eventId,
      externalId: e.externalId,
      title: e.title,
      description: e.description,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
      htmlLink: e.htmlLink,
    }));

    const result = await indexMemoryFromCalendar({
      userId: data.userId,
      events: calendarInputs,
      insertChunks: async (chunks) => {
        await this.prisma.$transaction(async (tx) => {
          await insertMemoryChunks(tx as any, chunks);
        });
      },
    });

    const duration = Date.now() - startTime;
    this.logger.log(
      `Calendar batch indexed: ${result.indexedEventCount}/${data.events.length} events, ${result.totalChunkCount} chunks in ${duration}ms`,
    );

    await job.updateProgress(100);
    return {
      indexedEventCount: result.indexedEventCount,
      totalChunkCount: result.totalChunkCount,
      errors: result.errors,
      durationMs: duration,
    };
  }

}
