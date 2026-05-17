// apps/api/src/modules/memory-queue/memory-queue.module.ts
//
// NestJS module that registers the BullMQ queue, producer, and worker.
// The queue connection uses REDIS_URL from env, defaulting to localhost.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MEMORY_INDEX_QUEUE } from './memory-queue.constants';
import { MemoryQueueProducer } from './memory-queue.producer';
import { MemoryQueueWorker } from './memory-queue.worker';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required by BullMQ
      },
    }),
    BullModule.registerQueue({
      name: MEMORY_INDEX_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  providers: [
    PrismaService,
    MemoryQueueProducer,
    MemoryQueueWorker,
  ],
  exports: [MemoryQueueProducer],
})
export class MemoryQueueModule {}
