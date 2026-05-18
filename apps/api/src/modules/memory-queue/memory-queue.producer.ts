// apps/api/src/modules/memory-queue/memory-queue.producer.ts
//
// The producer service. Other modules inject this to dispatch indexing jobs.

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MEMORY_INDEX_QUEUE, MemoryJobType } from './memory-queue.constants';

export interface IndexDiaryJobData {
  userId: string;
  diaryId: string;
  rawText: string;
  entryDate: string; // ISO string (Dates can't be serialized to Redis)
  sourceTitle: string;
}

export interface IndexCalendarJobData {
  userId: string;
  events: Array<{
    eventId: string;
    externalId: string;
    title: string;
    description: string | null;
    startTime: string; // ISO
    endTime: string;   // ISO
    htmlLink: string | null;
  }>;
}

@Injectable()
export class MemoryQueueProducer {
  constructor(
    @InjectQueue(MEMORY_INDEX_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Enqueue a diary entry for AI indexing.
   * The worker will chunk it, embed it, and persist memory_chunks.
   * If a job for the same diary already exists, it will be replaced (dedup).
   */
  async enqueueDiaryIndex(data: IndexDiaryJobData) {
    return this.queue.add(MemoryJobType.INDEX_DIARY, data, {
      // Dedup: if we re-save the same diary quickly, replace the pending job
      jobId: `diary-${data.diaryId}`,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s → 4s → 8s
      },
    });
  }

  /**
   * Enqueue calendar events for AI indexing (batch).
   */
  async enqueueCalendarIndex(data: IndexCalendarJobData) {
    return this.queue.add(MemoryJobType.INDEX_CALENDAR, data, {
      jobId: `calendar-${data.userId}-${Date.now()}`,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    });
  }
}
