import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import * as cron from 'node-cron';
import {
  deleteMemoryChunksForSource,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
} from '@second-brain/db';
import {
  getGeminiVisionModel,
  indexMemoryFromAttachment,
  indexMemoryFromCalendar,
  indexMemoryFromDiary,
  indexMemoryFromSummary,
} from '@second-brain/ai';
import { prisma } from '../../lib/prisma';

type IndexingJob = {
  id: string;
  user_id: string;
  job_type: string;
  source_type: 'diary' | 'attachment' | 'calendar' | 'summary' | string;
  source_id: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error: string | null;
  payload: Record<string, unknown> | null;
  run_after: Date;
  locked_at: Date | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type DrainResult = {
  found: number;
  claimed: number;
  succeeded: number;
  failed: number;
  resetStale: number;
  metrics: WorkerMetricsSnapshot;
};

type JobDurationMetric = {
  count: number;
  last: number;
  avg: number;
  max: number;
};

type WorkerMetricsSnapshot = {
  jobs_claimed_total: number;
  jobs_succeeded_total: number;
  jobs_failed_total: number;
  jobs_dead_letter_total: number;
  job_duration_ms: JobDurationMetric;
};

const ATTACHMENT_BUCKET = 'attachments-bucket';

export class DataIngestionJob {
  private static processing = false;
  private static listenerStarted = false;
  private static metrics: WorkerMetricsSnapshot = {
    jobs_claimed_total: 0,
    jobs_succeeded_total: 0,
    jobs_failed_total: 0,
    jobs_dead_letter_total: 0,
    job_duration_ms: {
      count: 0,
      last: 0,
      avg: 0,
      max: 0,
    },
  };

  private static getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Key must be set in environment variables.');
    }

    return createClient(supabaseUrl, supabaseKey);
  }

  private static async extractTextFromBlob(base64Data: string, mimeType: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing in environment variables.');

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: getGeminiVisionModel(),
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

    const extractedText = result.response.text().trim();
    if (!extractedText) throw new Error('Attachment extraction returned empty text.');
    return extractedText;
  }

  static async processPendingAttachments() {
    return this.processPendingIndexingJobs();
  }

  static async processPendingIndexingJobs(batchSize = 10): Promise<DrainResult> {
    const resetStale = await this.resetStaleJobs();
    const jobs = await this.claimJobs(batchSize);
    const jobDelayMs = this.getInterJobDelayMs();
    const result: DrainResult = {
      found: jobs.length,
      claimed: jobs.length,
      succeeded: 0,
      failed: 0,
      resetStale,
      metrics: this.getMetrics(),
    };
    this.metrics.jobs_claimed_total += jobs.length;

    for (const [index, job] of jobs.entries()) {
      const jobStart = Date.now();
      try {
        await this.processJob(job);
        await this.markSucceeded(job.id);
        result.succeeded += 1;
        this.metrics.jobs_succeeded_total += 1;
      } catch (error) {
        result.failed += 1;
        this.metrics.jobs_failed_total += 1;
        const failedStatus = await this.markFailed(job, error);
        if (failedStatus === 'dead_letter') {
          this.metrics.jobs_dead_letter_total += 1;
        }
      } finally {
        this.recordJobDuration(Date.now() - jobStart);
      }

      if (jobDelayMs > 0 && index < jobs.length - 1) {
        await this.sleep(jobDelayMs);
      }
    }

    result.metrics = this.getMetrics();
    return result;
  }

  private static async claimJobs(batchSize: number) {
    const safeBatchSize = Math.min(Math.max(Math.floor(batchSize), 1), 100);
    return prisma.$queryRawUnsafe<IndexingJob[]>(
      `
      WITH candidates AS (
        SELECT id
        FROM indexing_outbox
        WHERE job_type = 'index_memory'
          AND status IN ('pending', 'retry')
          AND run_after <= now()
        ORDER BY run_after ASC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE indexing_outbox AS job
      SET status = 'processing',
          locked_at = now(),
          updated_at = now()
      FROM candidates
      WHERE job.id = candidates.id
      RETURNING job.*
      `,
      safeBatchSize,
    );
  }

  private static async resetStaleJobs() {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      UPDATE indexing_outbox
      SET status = 'retry',
          run_after = now(),
          locked_at = NULL,
          updated_at = now(),
          error = COALESCE(error, 'Job lock expired and was requeued.')
      WHERE status = 'processing'
        AND locked_at < now() - interval '10 minutes'
      RETURNING id
      `,
    );

    return rows.length;
  }

  private static async processJob(job: IndexingJob) {
    const sourceType = this.normalizeSourceType(job.source_type);

    switch (sourceType) {
      case 'diary':
        await this.processDiary({ ...job, source_type: sourceType });
        return;
      case 'attachment':
        await this.processAttachment({ ...job, source_type: sourceType });
        return;
      case 'calendar':
        await this.processCalendarEvent({ ...job, source_type: sourceType });
        return;
      case 'summary':
        await this.processSummary({ ...job, source_type: sourceType });
        return;
      default:
        throw new Error(`Unsupported indexing source_type: ${job.source_type}`);
    }
  }

  private static normalizeSourceType(sourceType: string) {
    const normalized = sourceType.trim().toLowerCase();
    const aliases: Record<string, IndexingJob['source_type']> = {
      diary_entry: 'diary',
      diaryentry: 'diary',
      journal: 'diary',
      file: 'attachment',
      upload: 'attachment',
      calendar_event: 'calendar',
      calendarevent: 'calendar',
      google_calendar: 'calendar',
      generated_summary: 'summary',
    };

    return aliases[normalized] ?? normalized;
  }

  private static async processDiary(job: IndexingJob) {
    const diary = await prisma.diaryEntry.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
    });

    if (!diary) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'diary',
        sourceId: job.source_id,
      });
      return;
    }

    const title =
      typeof job.payload?.sourceTitle === 'string'
        ? job.payload.sourceTitle
        : diary.raw_text.split('\n')[0]?.trim() || 'Diary entry';
    const tags = Array.isArray((diary as any).tags) ? (diary as any).tags : [];
    const mood = typeof (diary as any).mood === 'string' ? (diary as any).mood : null;
    const metadataContext = [
      mood ? `Mood: ${mood}` : '',
      tags.length ? `Tags: ${tags.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    const rawTextForIndex = metadataContext
      ? `${diary.raw_text}\n\n${metadataContext}`
      : diary.raw_text;

    const indexingResult = await indexMemoryFromDiary({
      userId: job.user_id,
      diaryId: diary.id,
      rawText: rawTextForIndex,
      entryDate: diary.entry_date,
      sourceTitle: title,
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

    if (indexingResult.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'diary',
        sourceId: diary.id,
      });
    }
  }

  private static async processAttachment(job: IndexingJob) {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: job.source_id,
        diary_entry: { user_id: job.user_id },
      },
      include: {
        diary_entry: {
          select: {
            id: true,
            user_id: true,
            entry_date: true,
          },
        },
      },
    });

    if (!attachment) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'attachment',
        sourceId: job.source_id,
      });
      return;
    }

    let extractedText = attachment.extracted_text?.trim() ?? '';
    if (!extractedText) {
      const supabase = this.getSupabaseClient();
      const { data, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .download(attachment.storage_path);

      if (error || !data) {
        throw new Error(error?.message ?? `File not found in storage: ${attachment.storage_path}`);
      }

      const base64Data = Buffer.from(await data.arrayBuffer()).toString('base64');
      extractedText = await this.extractTextFromBlob(base64Data, attachment.file_type);
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { extracted_text: extractedText },
      });
    }

    const indexingResult = await indexMemoryFromAttachment({
      userId: job.user_id,
      attachmentId: attachment.id,
      diaryEntryId: attachment.diary_entry.id,
      extractedText,
      occurredAt: attachment.diary_entry.entry_date,
      sourceTitle:
        typeof job.payload?.sourceTitle === 'string'
          ? job.payload.sourceTitle
          : attachment.storage_path.split('/').pop(),
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

    if (indexingResult.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'attachment',
        sourceId: attachment.id,
      });
    }
  }

  private static async processCalendarEvent(job: IndexingJob) {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
    });

    if (!event) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'calendar',
        sourceId: job.source_id,
      });
      return;
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

    if (result.errors.length) {
      throw new Error(result.errors.map((item) => item.error).join('; '));
    }
  }

  private static async processSummary(job: IndexingJob) {
    const summary = await prisma.summary.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
    });

    if (!summary) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: 'summary',
        sourceId: job.source_id,
      });
      return;
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
  }

  private static async markSucceeded(jobId: string) {
    await prisma.indexingOutbox.update({
      where: { id: jobId },
      data: {
        status: 'succeeded',
        error: null,
        locked_at: null,
        processed_at: new Date(),
      },
    });
  }

  private static async markFailed(job: IndexingJob, error: unknown): Promise<'retry' | 'dead_letter'> {
    const message = this.toErrorMessage(error).slice(0, 4000);
    const nextRetryCount = job.retry_count + 1;
    const exhausted = nextRetryCount >= job.max_retries;
    const nextStatus = exhausted ? 'dead_letter' : 'retry';

    await prisma.indexingOutbox.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        retry_count: nextRetryCount,
        error: message,
        run_after: exhausted ? job.run_after : this.nextRunAfter(nextRetryCount),
        locked_at: null,
        processed_at: exhausted ? new Date() : null,
      },
    });

    console.error(
      `[Worker - Ingestion] Job ${job.id} (${job.source_type}/${job.source_id}) ${exhausted ? 'dead-lettered' : 'scheduled for retry'}: ${message}`,
    );

    return nextStatus;
  }

  private static nextRunAfter(retryCount: number) {
    const baseMs = Number(process.env.INDEXING_RETRY_BASE_MS ?? 30_000);
    const maxMs = Number(process.env.INDEXING_RETRY_MAX_MS ?? 15 * 60_000);
    const delay = Math.min(maxMs, Math.max(1_000, baseMs) * 2 ** Math.max(0, retryCount - 1));
    return new Date(Date.now() + delay);
  }

  private static toErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private static getInterJobDelayMs() {
    const configuredDelay = Number(process.env.INDEXING_JOB_DELAY_MS);
    if (Number.isFinite(configuredDelay)) {
      return Math.max(0, Math.floor(configuredDelay));
    }

    return this.usesLowFreeTierGeminiModel() ? 15_000 : 0;
  }

  private static usesLowFreeTierGeminiModel() {
    const configuredModels = [
      process.env.GEMINI_CHUNK_MODEL,
      process.env.GEMINI_VISION_MODEL,
      process.env.GEMINI_SUMMARY_MODEL,
      process.env.GEMINI_ANSWER_MODEL,
    ]
      .filter(Boolean)
      .join(' ');

    return configuredModels.includes('gemini-2.5-flash');
  }

  private static sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static getMetrics(): WorkerMetricsSnapshot {
    return {
      jobs_claimed_total: this.metrics.jobs_claimed_total,
      jobs_succeeded_total: this.metrics.jobs_succeeded_total,
      jobs_failed_total: this.metrics.jobs_failed_total,
      jobs_dead_letter_total: this.metrics.jobs_dead_letter_total,
      job_duration_ms: { ...this.metrics.job_duration_ms },
    };
  }

  private static recordJobDuration(durationMs: number) {
    const current = this.metrics.job_duration_ms;
    const nextCount = current.count + 1;
    const nextAvg = Math.round(((current.avg * current.count) + durationMs) / nextCount);

    this.metrics.job_duration_ms = {
      count: nextCount,
      last: durationMs,
      avg: nextAvg,
      max: Math.max(current.max, durationMs),
    };
  }

  static startCron() {
    cron.schedule('*/1 * * * *', async () => {
      if (this.processing) return;
      this.processing = true;
      try {
        const result = await this.processPendingIndexingJobs(
          Number(process.env.INDEXING_WORKER_BATCH_SIZE ?? 10),
        );
        if (result.claimed > 0 || result.resetStale > 0) {
          console.log(`[Worker - Ingestion] ${JSON.stringify(result)}`);
        }
      } catch (error) {
        console.error('[Worker - Ingestion] Cron processing error:', error);
      } finally {
        this.processing = false;
      }
    });
    console.log('Background Worker for IndexingOutbox ingestion started.');
  }

  static startRealtimeListener() {
    if (this.listenerStarted) return;
    this.listenerStarted = true;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[Worker - Ingestion] DATABASE_URL missing; realtime listener disabled.');
      return;
    }

    const client = new PgClient({ connectionString });
    client
      .connect()
      .then(async () => {
        await client.query('LISTEN indexing_outbox_jobs');
        console.log('[Worker - Ingestion] Listening for indexing_outbox_jobs notifications.');
      })
      .catch((error) => {
        console.warn('[Worker - Ingestion] Could not start realtime listener:', error.message);
      });

    client.on('notification', () => {
      void this.processPendingIndexingJobs(
        Number(process.env.INDEXING_WORKER_BATCH_SIZE ?? 10),
      ).catch((error) => {
        console.error('[Worker - Ingestion] Realtime drain failed:', error);
      });
    });

    client.on('error', (error) => {
      console.warn('[Worker - Ingestion] Realtime listener error:', error.message);
    });
  }
}
