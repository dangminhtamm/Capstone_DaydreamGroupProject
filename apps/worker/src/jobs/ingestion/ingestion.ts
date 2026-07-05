import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  indexMemoryFromAttachment,
  indexMemoryFromCalendar,
  indexMemoryFromDiary,
  indexMemoryFromSummary,
} from '@second-brain/ai';
import {
  deleteMemoryChunksForSource,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
} from '@second-brain/db';
import { createClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';
import { prisma } from '../../lib/prisma';

type IndexingOutboxJob = {
  id: string;
  user_id: string;
  job_type: string;
  source_type: string;
  source_id: string;
  status: string;
  retry_count: number;
  max_retries: number;
  payload: unknown;
};

type SourceType = 'diary' | 'attachment' | 'summary' | 'calendar';

type IndexingBatchResult = {
  found: number;
  claimed: number;
  succeeded: number;
  failed: number;
  resetStale: number;
};

export class DataIngestionJob {
  private static getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Key must be set in environment variables.');
    }

    return createClient(supabaseUrl, supabaseKey);
  }

  private static async extractTextFromBlob(
    base64Data: string,
    mimeType: string,
  ): Promise<string> {
    console.log(`[Worker - Ingestion] Calling Gemini to extract text (MIME: ${mimeType})...`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing in environment variables.');

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: process.env.GEMINI_VISION_MODEL ?? 'gemini-1.5-flash',
    });

    const prompt = `
You are an extraction engine for a personal Second Brain app.
Extract all readable text, transcripts, headings, labels, and meaningful textual content from this attachment.
For images with little or no visible text, provide a concise factual description of what is shown.
Do not invent names, dates, or claims that are not visible in the file.
Return only the extracted text or factual description.
`.trim();

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ]);

    return result.response.text().trim();
  }

  static async processPendingIndexingJobs(batchSize = 10): Promise<IndexingBatchResult> {
    const resetStale = await this.resetStaleProcessingJobs();
    const jobs = await prisma.indexingOutbox.findMany({
      where: {
        job_type: 'index_memory',
        status: { in: ['pending', 'retry'] },
        run_after: { lte: new Date() },
      },
      orderBy: [{ run_after: 'asc' }, { created_at: 'asc' }],
      take: batchSize,
    });
    const stats: IndexingBatchResult = {
      found: jobs.length,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      resetStale,
    };

    if (jobs.length === 0) {
      if (resetStale > 0) {
        console.log(`[Worker - Ingestion] Reset ${resetStale} stale processing job(s).`);
      } else {
        console.log('[Worker - Ingestion] No pending indexing jobs found.');
      }
      return stats;
    }

    console.log(`[Worker - Ingestion] Found ${jobs.length} indexing jobs.`);

    for (const job of jobs as IndexingOutboxJob[]) {
      const claimed = await prisma.indexingOutbox.updateMany({
        where: {
          id: job.id,
          status: { in: ['pending', 'retry'] },
        },
        data: {
          status: 'processing',
          locked_at: new Date(),
          error: null,
        },
      });

      if (claimed.count === 0) continue;
      stats.claimed += 1;

      try {
        const chunkCount = await this.processIndexingJob(job);
        await prisma.indexingOutbox.update({
          where: { id: job.id },
          data: {
            status: 'succeeded',
            error: null,
            locked_at: null,
            processed_at: new Date(),
          },
        });
        console.log(
          `[Worker - Ingestion] Job ${job.id} (${job.source_type}:${job.source_id}) indexed ${chunkCount} chunks.`,
        );
        stats.succeeded += 1;
      } catch (error) {
        await this.markJobFailed(job, error);
        stats.failed += 1;
      }
    }

    return stats;
  }

  private static async processIndexingJob(job: IndexingOutboxJob) {
    if (!isSupportedSourceType(job.source_type)) {
      throw new Error(`Unsupported indexing source type: ${job.source_type}`);
    }

    if (job.source_type === 'diary') {
      return this.indexDiary(job);
    }

    if (job.source_type === 'attachment') {
      return this.indexAttachment(job);
    }

    if (job.source_type === 'summary') {
      return this.indexSummary(job);
    }

    return this.indexCalendar(job);
  }

  private static async indexDiary(job: IndexingOutboxJob) {
    const diary = await prisma.diaryEntry.findFirst({
      where: {
        id: job.source_id,
        user_id: job.user_id,
      },
    });

    if (!diary) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'diary',
        sourceId: job.source_id,
      });
      return 0;
    }

    const result = await indexMemoryFromDiary({
      userId: job.user_id,
      diaryId: diary.id,
      rawText: diary.raw_text,
      entryDate: diary.entry_date,
      sourceTitle: getPayloadString(job.payload, 'sourceTitle') ?? deriveTitle(diary.raw_text),
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await insertMemoryChunks(tx, chunks);
          await pruneMemoryChunksForSource(tx, {
            userId: job.user_id,
            sourceType: 'diary',
            sourceId: diary.id,
            keepChunkCount: chunks.length,
          });
        }),
    });

    if (result.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'diary',
        sourceId: diary.id,
      });
    }

    return result.chunkCount;
  }

  private static async indexAttachment(job: IndexingOutboxJob) {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: job.source_id,
        diary_entry: {
          user_id: job.user_id,
        },
      },
      include: {
        diary_entry: true,
      },
    });

    if (!attachment) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'attachment',
        sourceId: job.source_id,
      });
      return 0;
    }

    let extractedText = attachment.extracted_text?.trim() ?? '';

    if (!extractedText) {
      const supabase = this.getSupabaseClient();
      const { data, error } = await supabase.storage
        .from('attachments-bucket')
        .download(attachment.storage_path);

      if (error || !data) {
        throw new Error(error?.message ?? `Failed to download ${attachment.storage_path}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      extractedText =
        attachment.file_type === 'text/plain'
          ? buffer.toString('utf8').trim()
          : await this.extractTextFromBlob(buffer.toString('base64'), attachment.file_type);

      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { extracted_text: extractedText },
      });
    }

    if (!extractedText) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'attachment',
        sourceId: attachment.id,
      });
      return 0;
    }

    const result = await indexMemoryFromAttachment({
      userId: job.user_id,
      attachmentId: attachment.id,
      diaryEntryId: attachment.diary_entry_id,
      extractedText,
      occurredAt: attachment.diary_entry.entry_date,
      sourceTitle:
        getPayloadString(job.payload, 'originalName') ??
        `Attachment: ${attachment.storage_path.split('/').pop() ?? attachment.id}`,
      fileType: attachment.file_type,
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await insertMemoryChunks(tx, chunks);
          await pruneMemoryChunksForSource(tx, {
            userId: job.user_id,
            sourceType: 'attachment',
            sourceId: attachment.id,
            keepChunkCount: chunks.length,
          });
        }),
    });

    return result.chunkCount;
  }

  private static async indexSummary(job: IndexingOutboxJob) {
    const summary = await prisma.summary.findFirst({
      where: {
        id: job.source_id,
        user_id: job.user_id,
      },
    });

    if (!summary) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'summary',
        sourceId: job.source_id,
      });
      return 0;
    }

    const result = await indexMemoryFromSummary({
      userId: job.user_id,
      summaryId: summary.id,
      summaryType: summary.summary_type,
      content: summary.content,
      periodStart: summary.period_start,
      periodEnd: summary.period_end,
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await insertMemoryChunks(tx, chunks);
          await pruneMemoryChunksForSource(tx, {
            userId: job.user_id,
            sourceType: 'summary',
            sourceId: summary.id,
            keepChunkCount: chunks.length,
          });
        }),
    });

    if (result.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'summary',
        sourceId: summary.id,
      });
    }

    return result.chunkCount;
  }

  private static async indexCalendar(job: IndexingOutboxJob) {
    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: job.source_id,
        user_id: job.user_id,
      },
    });

    if (!event) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'calendar',
        sourceId: job.source_id,
      });
      return 0;
    }

    const result = await indexMemoryFromCalendar({
      userId: job.user_id,
      events: [
        {
          eventId: event.id,
          externalId: event.external_id,
          title: event.title,
          description: event.description,
          startTime: event.start_time,
          endTime: event.end_time,
          htmlLink: event.html_link,
        },
      ],
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await insertMemoryChunks(tx, chunks);
          await pruneMemoryChunksForSource(tx, {
            userId: job.user_id,
            sourceType: 'calendar',
            sourceId: event.id,
            keepChunkCount: chunks.length,
          });
        }),
    });

    if (result.totalChunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'calendar',
        sourceId: event.id,
      });
    }

    return result.totalChunkCount;
  }

  private static async markJobFailed(job: IndexingOutboxJob, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const retryCount = job.retry_count + 1;
    const exhausted = retryCount >= job.max_retries;
    const delayMs = Math.min(60_000 * 2 ** Math.max(0, retryCount - 1), 30 * 60_000);

    await prisma.indexingOutbox.update({
      where: { id: job.id },
      data: {
        status: exhausted ? 'failed' : 'retry',
        retry_count: retryCount,
        error: message.slice(0, 4000),
        locked_at: null,
        run_after: new Date(Date.now() + delayMs),
      },
    });

    console.error(
      `[Worker - Ingestion] Job ${job.id} failed (${retryCount}/${job.max_retries}): ${message}`,
    );
  }

  private static async resetStaleProcessingJobs() {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const result = await prisma.indexingOutbox.updateMany({
      where: {
        job_type: 'index_memory',
        status: 'processing',
        locked_at: { lt: staleBefore },
      },
      data: {
        status: 'retry',
        locked_at: null,
        run_after: new Date(),
        error: 'Reset stale processing job after worker timeout.',
      },
    });

    return result.count;
  }

  static startCron() {
    cron.schedule('*/1 * * * *', async () => {
      await this.processPendingIndexingJobs();
    });
    console.log('Background Worker for Indexing Outbox started.');
  }
}

function isSupportedSourceType(sourceType: string): sourceType is SourceType {
  return (
    sourceType === 'diary' ||
    sourceType === 'attachment' ||
    sourceType === 'summary' ||
    sourceType === 'calendar'
  );
}

function getPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function deriveTitle(rawText: string) {
  const firstLine = rawText.trim().split(/\r?\n/)[0]?.trim();
  if (!firstLine) return 'Diary entry';
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 77)}...`;
}
