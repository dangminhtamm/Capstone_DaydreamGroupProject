import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import * as cron from "node-cron";
import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  decryptOAuthToken,
  encryptOAuthToken,
  isAttachmentExtractionFallback,
} from "@second-brain/shared";
import {
  deleteEntityMentionsForSource,
  deleteMemoryChunksForSource,
  insertEntityMentions as insertEntityMentionRows,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
  resolveMemoryChunkIds,
} from "@second-brain/db";
import {
  indexMemoryFromAttachment,
  indexMemoryFromCalendar,
  indexMemoryFromContact,
  indexMemoryFromDiary,
  indexMemoryFromDrive,
  indexMemoryFromGmail,
  indexMemoryFromSummary,
  extractEntityMentionsFromMetadata,
  type PersistedMemoryChunkPayload,
} from "@second-brain/ai";
import { prisma } from "../../lib/prisma";
import type { WorkerMetricsSnapshot } from "../../metrics";
import {
  extractAudioAttachmentContent,
  extractAttachmentContent,
  isAudioMimeType,
  prepareImageForExtraction,
} from "./attachment-extraction";
import {
  calculateFailureTransition,
  calculateReconnectDelayMs,
  SingleFlight,
} from "./reliability";
import {
  extractImageTextLocally,
  extractPdfTextLocally,
} from "./local-document-extraction";

type IndexingJob = {
  id: string;
  user_id: string;
  job_type: string;
  source_type: "diary" | "attachment" | "calendar" | "summary" | string;
  source_id: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error: string | null;
  payload: Record<string, unknown> | null;
  run_after: Date;
  locked_at: Date | null;
  locked_by: string | null;
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

const ATTACHMENT_BUCKET = "attachments-bucket";

export class DataIngestionJob {
  private static readonly workerId = (
    process.env.INDEXING_WORKER_ID ??
    `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`
  ).slice(0, 128);
  private static readonly drainFlight = new SingleFlight<DrainResult>();
  private static readonly drainCoordinatorFlight = new SingleFlight<void>();
  private static drainRequested = false;
  private static listenerStarted = false;
  private static listenerStopping = false;
  private static listenerClient: PgClient | null = null;
  private static listenerReconnectTimer: NodeJS.Timeout | null = null;
  private static listenerReconnectAttempt = 0;
  private static metrics: WorkerMetricsSnapshot = {
    jobs_claimed_total: 0,
    jobs_succeeded_total: 0,
    jobs_failed_total: 0,
    jobs_dead_letter_total: 0,
    job_duration_ms: {
      count: 0,
      last: 0,
      sum: 0,
      avg: 0,
      max: 0,
    },
  };

  private static getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabase URL and Service Key must be set in environment variables.",
      );
    }

    return createClient(supabaseUrl, supabaseKey);
  }

  static async processPendingAttachments() {
    return this.processPendingIndexingJobs();
  }

  static processPendingIndexingJobs(
    batchSize = this.getWorkerBatchSize(),
  ): Promise<DrainResult> {
    return this.drainFlight.run(() => this.processIndexingBatch(batchSize));
  }

  private static async processIndexingBatch(
    batchSize: number,
  ): Promise<DrainResult> {
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
    const stopLeaseRenewal = this.startLeaseRenewal(jobs.map((job) => job.id));

    try {
      for (const [index, job] of jobs.entries()) {
        const jobStart = Date.now();
        try {
          await this.renewLeases([job.id]);
          await this.processJob(job);
          const completed = await this.markSucceeded(job.id);
          if (!completed) {
            throw new Error(
              `Indexing lease lost before job ${job.id} could be completed.`,
            );
          }
          result.succeeded += 1;
          this.metrics.jobs_succeeded_total += 1;
        } catch (error) {
          result.failed += 1;
          this.metrics.jobs_failed_total += 1;
          const failedStatus = await this.markFailed(job, error);
          if (failedStatus === "dead_letter") {
            this.metrics.jobs_dead_letter_total += 1;
          }
        } finally {
          this.recordJobDuration(Date.now() - jobStart);
        }

        if (jobDelayMs > 0 && index < jobs.length - 1) {
          await this.sleep(jobDelayMs);
        }
      }
    } finally {
      stopLeaseRenewal();
      await this.releaseOwnedJobs(jobs.map((job) => job.id));
    }

    result.metrics = this.getMetrics();
    return result;
  }

  private static async claimJobs(batchSize: number) {
    const safeBatchSize = Math.min(Math.max(Math.floor(batchSize), 1), 100);
    const sourceIdFilter =
      process.env.INDEXING_WORKER_SOURCE_ID_FILTER?.trim() || null;
    return prisma.$queryRawUnsafe<IndexingJob[]>(
      `
      WITH candidates AS (
        SELECT id
        FROM indexing_outbox
        WHERE job_type = 'index_memory'
          AND status IN ('pending', 'retry')
          AND run_after <= now()
          AND ($3::text IS NULL OR source_id = $3)
        ORDER BY
          CASE source_type
            WHEN 'diary' THEN 0
            WHEN 'calendar' THEN 1
            WHEN 'gmail' THEN 2
            WHEN 'contact' THEN 3
            WHEN 'summary' THEN 4
            WHEN 'attachment' THEN 5
            WHEN 'drive' THEN 6
            ELSE 7
          END ASC,
          run_after ASC,
          created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE indexing_outbox AS job
      SET status = 'processing',
          locked_at = now(),
          locked_by = $2,
          updated_at = now()
      FROM candidates
      WHERE job.id = candidates.id
      RETURNING job.*
      `,
      safeBatchSize,
      this.workerId,
      sourceIdFilter,
    );
  }

  private static async resetStaleJobs() {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      UPDATE indexing_outbox
      SET status = 'retry',
          run_after = now(),
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now(),
          error = COALESCE(error, 'Job lock expired and was requeued.')
      WHERE status = 'processing'
        AND locked_at < now() - ($1 * interval '1 millisecond')
      RETURNING id
      `,
      this.getLeaseTimeoutMs(),
    );

    return rows.length;
  }

  private static startLeaseRenewal(jobIds: string[]) {
    if (jobIds.length === 0) return () => undefined;

    const timer = setInterval(() => {
      void this.renewLeases(jobIds).catch((error) => {
        console.warn(
          `[Worker - Ingestion] Could not renew indexing leases: ${this.toErrorMessage(error)}`,
        );
      });
    }, this.getLeaseRenewIntervalMs());
    timer.unref?.();

    return () => clearInterval(timer);
  }

  private static async renewLeases(jobIds: string[]) {
    if (jobIds.length === 0) return 0;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      UPDATE indexing_outbox
      SET locked_at = now(), updated_at = now()
      WHERE id = ANY($1::text[])
        AND status = 'processing'
        AND locked_by = $2
      RETURNING id
      `,
      jobIds,
      this.workerId,
    );
    return rows.length;
  }

  private static async releaseOwnedJobs(jobIds: string[]) {
    if (jobIds.length === 0) return;
    try {
      await prisma.$executeRawUnsafe(
        `
        UPDATE indexing_outbox
        SET status = 'retry',
            run_after = now(),
            locked_at = NULL,
            locked_by = NULL,
            updated_at = now(),
            error = COALESCE(error, 'Worker released an unfinished indexing lease.')
        WHERE id = ANY($1::text[])
          AND status = 'processing'
          AND locked_by = $2
        `,
        jobIds,
        this.workerId,
      );
    } catch (error) {
      console.warn(
        `[Worker - Ingestion] Could not release unfinished leases: ${this.toErrorMessage(error)}`,
      );
    }
  }

  private static async processJob(job: IndexingJob) {
    const sourceType = this.normalizeSourceType(job.source_type);

    switch (sourceType) {
      case "diary":
        await this.processDiary({ ...job, source_type: sourceType });
        return;
      case "attachment":
        await this.processAttachment({ ...job, source_type: sourceType });
        return;
      case "calendar":
        await this.processCalendarEvent({ ...job, source_type: sourceType });
        return;
      case "contact":
        await this.processContact({ ...job, source_type: sourceType });
        return;
      case "drive":
        await this.processDriveFile({ ...job, source_type: sourceType });
        return;
      case "gmail":
        await this.processGmailMessage({ ...job, source_type: sourceType });
        return;
      case "summary":
        await this.processSummary({ ...job, source_type: sourceType });
        return;
      default:
        throw new Error(`Unsupported indexing source_type: ${job.source_type}`);
    }
  }

  private static normalizeSourceType(sourceType: string) {
    const normalized = sourceType.trim().toLowerCase();
    const aliases: Record<string, IndexingJob["source_type"]> = {
      diary_entry: "diary",
      diaryentry: "diary",
      journal: "diary",
      file: "attachment",
      upload: "attachment",
      calendar_event: "calendar",
      calendarevent: "calendar",
      google_calendar: "calendar",
      google_contact: "contact",
      google_contacts: "contact",
      contacts: "contact",
      people: "contact",
      google_drive: "drive",
      drive_file: "drive",
      google_drive_file: "drive",
      google_mail: "gmail",
      google_gmail: "gmail",
      gmail_message: "gmail",
      email: "gmail",
      generated_summary: "summary",
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
        sourceType: "diary",
        sourceId: job.source_id,
      });
      return;
    }

    const title =
      typeof job.payload?.sourceTitle === "string"
        ? job.payload.sourceTitle
        : diary.raw_text.split("\n")[0]?.trim() || "Diary entry";
    const tags = Array.isArray((diary as any).tags) ? (diary as any).tags : [];
    const mood =
      typeof (diary as any).mood === "string" ? (diary as any).mood : null;
    const metadataContext = [
      mood ? `Mood: ${mood}` : "",
      tags.length ? `Tags: ${tags.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
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
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "diary",
            sourceId: diary.id,
          });
        }),
    });

    if (indexingResult.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "diary",
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
        sourceType: "attachment",
        sourceId: job.source_id,
      });
      return;
    }

    const sourceTitle =
      typeof job.payload?.sourceTitle === "string"
        ? job.payload.sourceTitle
        : attachment.storage_path.split("/").pop();
    const storedExtractedText = attachment.extracted_text?.trim() ?? "";
    const hasLegacyFallback =
      isAttachmentExtractionFallback(storedExtractedText);
    let extractedText = hasLegacyFallback ? "" : storedExtractedText;

    if (hasLegacyFallback) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "attachment",
        sourceId: attachment.id,
      });
    }

    if (!extractedText) {
      const supabase = this.getSupabaseClient();
      const audio = isAudioMimeType(attachment.file_type);
      const image = attachment.file_type.toLowerCase().startsWith("image/");
      const pdf = attachment.file_type.toLowerCase() === "application/pdf";

      try {
        if (audio || image || pdf) {
          const { data, error } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .download(attachment.storage_path);
          if (error || !data) {
            throw new Error(
              error?.message ??
                `File not found in storage: ${attachment.storage_path}`,
            );
          }

          const rawBuffer = Buffer.from(await data.arrayBuffer());
          if (audio) {
            extractedText = await extractAudioAttachmentContent({
              attachmentId: attachment.id,
              buffer: rawBuffer,
              mimeType: attachment.file_type,
              fileName: sourceTitle ?? attachment.storage_path,
              maxOutputTokens: this.getAudioTranscriptionMaxOutputTokens(),
            });
          } else {
            extractedText = image
              ? await extractImageTextLocally(rawBuffer)
              : await extractPdfTextLocally(rawBuffer);

            if (!extractedText && image) {
              const optimizedImage = await prepareImageForExtraction(rawBuffer);
              extractedText = await extractAttachmentContent({
                attachmentId: attachment.id,
                base64Data: optimizedImage.buffer.toString("base64"),
                mimeType: optimizedImage.mimeType,
                fileName: sourceTitle ?? attachment.storage_path,
                maxOutputTokens: this.getAttachmentExtractionMaxOutputTokens(),
              });
            }

            if (!extractedText) {
              throw new Error(
                pdf
                  ? "PDF contains no extractable or OCR-readable text."
                  : "Image contains no OCR-readable text and vision extraction was unavailable.",
              );
            }
          }
        } else {
          const { data, error } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .createSignedUrl(attachment.storage_path, 10 * 60);
          if (error || !data?.signedUrl) {
            throw new Error(
              error?.message ??
                `Could not create attachment extraction URL: ${attachment.storage_path}`,
            );
          }

          extractedText = await extractAttachmentContent({
            attachmentId: attachment.id,
            fileUrl: data.signedUrl,
            mimeType: attachment.file_type,
            fileName: sourceTitle ?? attachment.storage_path,
            maxOutputTokens: this.getAttachmentExtractionMaxOutputTokens(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${audio ? "Audio transcription" : "Attachment extraction"} failed: ${message}`,
        );
      }
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
      sourceTitle,
      fileType: attachment.file_type,
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "attachment",
            sourceId: attachment.id,
          });
        }),
    });

    if (indexingResult.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "attachment",
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
        sourceType: "calendar",
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
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "calendar",
            sourceId: event.id,
          });
        }),
    });

    if (result.errors.length) {
      throw new Error(result.errors.map((item) => item.error).join("; "));
    }
  }

  private static async processContact(job: IndexingJob) {
    const contact = await prisma.googleContact.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
    });

    if (!contact) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "contact",
        sourceId: job.source_id,
      });
      return;
    }

    const result = await indexMemoryFromContact({
      userId: job.user_id,
      contacts: [
        {
          contactId: contact.id,
          externalId: contact.external_id,
          displayName: contact.display_name,
          emailAddresses: contact.email_addresses,
          phoneNumbers: contact.phone_numbers,
          organizations: contact.organizations,
          photoUrl: contact.photo_url,
          updatedAt: contact.updated_at,
        },
      ],
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "contact",
            sourceId: contact.id,
          });
        }),
    });

    if (result.errors.length) {
      throw new Error(result.errors.map((item) => item.error).join("; "));
    }
  }

  private static async processDriveFile(job: IndexingJob) {
    const driveFile = await prisma.googleDriveFile.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
      include: {
        user: {
          select: {
            id: true,
            google_access_token: true,
            google_refresh_token: true,
          },
        },
      },
    });

    if (!driveFile) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "drive",
        sourceId: job.source_id,
      });
      return;
    }

    let extractedText = driveFile.extracted_text?.trim() ?? "";
    if (!extractedText) {
      extractedText = await this.extractGoogleDriveFileText(driveFile);
      await prisma.googleDriveFile.update({
        where: { id: driveFile.id },
        data: { extracted_text: extractedText },
      });
    }

    const result = await indexMemoryFromDrive({
      userId: job.user_id,
      driveFileId: driveFile.id,
      externalId: driveFile.external_id,
      name: driveFile.name,
      mimeType: driveFile.mime_type,
      extractedText,
      webViewLink: driveFile.web_view_link,
      modifiedTime: driveFile.modified_time,
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "drive",
            sourceId: driveFile.id,
          });
        }),
    });

    if (result.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "drive",
        sourceId: driveFile.id,
      });
    }
  }

  private static async processGmailMessage(job: IndexingJob) {
    const message = await prisma.gmailMessage.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
    });

    if (!message) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "gmail",
        sourceId: job.source_id,
      });
      return;
    }

    const result = await indexMemoryFromGmail({
      userId: job.user_id,
      message: {
        messageId: message.id,
        externalId: message.external_id,
        threadId: message.thread_id,
        sender: message.sender,
        subject: message.subject,
        snippet: message.snippet,
        body: message.body,
        receivedAt: message.received_at,
      },
      insertChunks: (chunks) =>
        prisma.$transaction(async (tx: any) => {
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "gmail",
            sourceId: message.id,
          });
        }),
    });

    if (result.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "gmail",
        sourceId: message.id,
      });
    }
  }

  private static async extractGoogleDriveFileText(driveFile: {
    external_id: string;
    name: string;
    mime_type: string;
    web_view_link?: string | null;
    modified_time?: Date | null;
    user: {
      id: string;
      google_access_token: string | null;
      google_refresh_token: string | null;
    };
  }) {
    if (
      !driveFile.user.google_access_token &&
      !driveFile.user.google_refresh_token
    ) {
      throw new Error("Google token is missing for Drive extraction.");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: decryptOAuthToken(driveFile.user.google_access_token),
      refresh_token: decryptOAuthToken(driveFile.user.google_refresh_token),
    });
    oauth2Client.on("tokens", async (tokens) => {
      await prisma.user.update({
        where: { id: driveFile.user.id },
        data: {
          ...(tokens.access_token && {
            google_access_token: encryptOAuthToken(tokens.access_token),
          }),
          ...(tokens.refresh_token && {
            google_refresh_token: encryptOAuthToken(tokens.refresh_token),
          }),
        },
      });
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const exportMimeType = this.getDriveExportMimeType(driveFile.mime_type);

    if (exportMimeType) {
      const response = await drive.files.export(
        {
          fileId: driveFile.external_id,
          mimeType: exportMimeType,
        },
        { responseType: "arraybuffer" },
      );
      return Buffer.from(response.data as ArrayBuffer)
        .toString("utf8")
        .trim();
    }

    const response = await drive.files.get(
      {
        fileId: driveFile.external_id,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" },
    );
    const buffer = Buffer.from(response.data as ArrayBuffer);
    if (this.isPlainTextMimeType(driveFile.mime_type)) {
      return buffer.toString("utf8").trim();
    }

    const audio = isAudioMimeType(driveFile.mime_type);

    try {
      return audio
        ? await extractAudioAttachmentContent({
            attachmentId: `drive-${driveFile.external_id}`,
            buffer,
            mimeType: driveFile.mime_type,
            fileName: driveFile.name,
            maxOutputTokens: this.getAudioTranscriptionMaxOutputTokens(),
          })
        : await extractAttachmentContent({
            attachmentId: `drive-${driveFile.external_id}`,
            base64Data: buffer.toString("base64"),
            mimeType: driveFile.mime_type,
            fileName: driveFile.name,
            maxOutputTokens: this.getAttachmentExtractionMaxOutputTokens(),
          });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (audio) {
        throw new Error(`Drive audio transcription failed: ${message}`);
      }
      console.warn(
        `[Worker - Ingestion] Drive file ${driveFile.external_id} imported, but AI extraction failed; indexing metadata fallback: ${message}`,
      );
      return this.buildDriveExtractionFallback(driveFile, message);
    }
  }

  private static buildDriveExtractionFallback(
    driveFile: {
      name: string;
      mime_type: string;
      web_view_link?: string | null;
      modified_time?: Date | null;
    },
    error: string,
  ) {
    return [
      `Google Drive file "${driveFile.name}" was imported.`,
      `MIME type: ${driveFile.mime_type}.`,
      driveFile.modified_time
        ? `Modified at: ${driveFile.modified_time.toISOString()}.`
        : "",
      driveFile.web_view_link
        ? `Google Drive URL: ${driveFile.web_view_link}.`
        : "",
      `Full text extraction was unavailable during indexing: ${error.slice(0, 240)}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private static getDriveExportMimeType(mimeType: string) {
    const exportMimeTypes: Record<string, string> = {
      "application/vnd.google-apps.document": "text/plain",
      "application/vnd.google-apps.spreadsheet": "text/csv",
      "application/vnd.google-apps.presentation": "text/plain",
      "application/vnd.google-apps.drawing": "application/pdf",
    };

    return exportMimeTypes[mimeType] ?? null;
  }

  private static isPlainTextMimeType(mimeType: string) {
    return (
      mimeType.startsWith("text/") ||
      [
        "application/json",
        "application/xml",
        "application/javascript",
        "application/typescript",
        "application/csv",
      ].includes(mimeType)
    );
  }

  private static async processSummary(job: IndexingJob) {
    const summary = await prisma.summary.findFirst({
      where: { id: job.source_id, user_id: job.user_id },
    });

    if (!summary) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "summary",
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
          await this.persistChunksWithEntities(tx, chunks, {
            userId: job.user_id,
            sourceType: "summary",
            sourceId: summary.id,
          });
        }),
    });

    if (result.chunkCount === 0) {
      await deleteMemoryChunksForSource(prisma as any, {
        userId: job.user_id,
        sourceType: "summary",
        sourceId: summary.id,
      });
    }
  }

  private static async persistChunksWithEntities(
    tx: any,
    chunks: PersistedMemoryChunkPayload[],
    source: { userId: string; sourceType: string; sourceId: string },
  ) {
    await insertMemoryChunks(tx, chunks);
    await pruneMemoryChunksForSource(tx, {
      ...source,
      keepChunkCount: chunks.length,
    });
    await deleteEntityMentionsForSource(tx, source);

    if (!chunks.length) return;

    const chunkIdMap = await resolveMemoryChunkIds(tx, source);
    const seen = new Set<string>();
    const mentionRows = chunks.flatMap((chunk) => {
      const chunkId = chunkIdMap.get(chunk.chunkIndex);
      if (!chunkId) return [];

      return extractEntityMentionsFromMetadata(chunk.metadata)
        .filter((mention) => {
          const key = `${chunkId}:${mention.entityType}:${mention.entityValue}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((mention) => ({
          chunkId,
          entityType: mention.entityType,
          entityValue: mention.entityValue,
        }));
    });

    await insertEntityMentionRows(tx, mentionRows);
  }

  private static async markSucceeded(jobId: string) {
    const result = await prisma.indexingOutbox.updateMany({
      where: {
        id: jobId,
        status: "processing",
        locked_by: this.workerId,
      },
      data: {
        status: "succeeded",
        error: null,
        locked_at: null,
        locked_by: null,
        processed_at: new Date(),
      },
    });
    return result.count === 1;
  }

  private static async markFailed(
    job: IndexingJob,
    error: unknown,
  ): Promise<"retry" | "dead_letter" | "lost_lease"> {
    const message = this.toErrorMessage(error).slice(0, 4000);
    const requiresReconnect = this.isGoogleReconnectRequiredError(message);
    const transition = calculateFailureTransition({
      retryCount: job.retry_count,
      maxRetries: job.max_retries,
      requiresReconnect,
      baseDelayMs: Number(process.env.INDEXING_RETRY_BASE_MS ?? 30_000),
      maxDelayMs: Number(process.env.INDEXING_RETRY_MAX_MS ?? 15 * 60_000),
    });

    if (requiresReconnect) {
      await this.markGoogleConnectionReconnectRequired(job, message);
    }

    const result = await prisma.indexingOutbox.updateMany({
      where: {
        id: job.id,
        status: "processing",
        locked_by: this.workerId,
      },
      data: {
        status: transition.status,
        retry_count: transition.retryCount,
        error: message,
        run_after: transition.runAfter,
        locked_at: null,
        locked_by: null,
        processed_at: transition.status === "dead_letter" ? new Date() : null,
      },
    });

    if (result.count === 0) {
      console.warn(
        `[Worker - Ingestion] Job ${job.id} lost its lease; status was not overwritten.`,
      );
      return "lost_lease";
    }

    console.error(
      `[Worker - Ingestion] Job ${job.id} (${job.source_type}/${job.source_id}) ${transition.status === "dead_letter" ? "dead-lettered" : "scheduled for retry"}: ${message}`,
    );

    return transition.status;
  }

  private static isGoogleReconnectRequiredError(message: string) {
    const normalized = message.toLowerCase();

    return (
      /\binvalid_grant\b/i.test(message) ||
      /\binvalid_credentials\b/i.test(message) ||
      normalized.includes("invalid credentials") ||
      normalized.includes("token has been expired") ||
      normalized.includes("token has been revoked") ||
      normalized.includes("token expired") ||
      normalized.includes("unauthorized") ||
      normalized.includes("401") ||
      normalized.includes("insufficient authentication scopes") ||
      normalized.includes("insufficient permission") ||
      normalized.includes("insufficient permissions") ||
      normalized.includes("insufficient scope") ||
      normalized.includes("insufficient_scope") ||
      (normalized.includes("forbidden") &&
        (normalized.includes("scope") || normalized.includes("permission")))
    );
  }

  private static async markGoogleConnectionReconnectRequired(
    job: IndexingJob,
    error: string,
  ) {
    const source = this.toGoogleSource(job.source_type);
    if (!source) return;

    try {
      await prisma.$executeRawUnsafe(
        `
        UPDATE google_connections
        SET
          connected = false,
          last_error = $3,
          last_error_at = now(),
          updated_at = now()
        WHERE user_id = $1::text AND source = $2
        `,
        job.user_id,
        source,
        `Needs reconnect: ${error}`.slice(0, 1000),
      );
    } catch {
      // Health/readiness reports missing google_connections in partially migrated environments.
    }
  }

  private static toGoogleSource(sourceType: string) {
    const normalized = this.normalizeSourceType(sourceType);
    if (
      normalized === "calendar" ||
      normalized === "contact" ||
      normalized === "drive" ||
      normalized === "gmail"
    ) {
      return normalized;
    }

    return null;
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

    return this.usesKnownLowQuotaModel() ? 15_000 : 0;
  }

  private static getWorkerBatchSize() {
    const configured = Number(process.env.INDEXING_WORKER_BATCH_SIZE ?? 2);
    if (!Number.isFinite(configured)) return 2;
    return Math.min(Math.max(Math.trunc(configured), 1), 10);
  }

  private static getLeaseTimeoutMs() {
    const configured = Number(
      process.env.INDEXING_LEASE_TIMEOUT_MS ?? 5 * 60_000,
    );
    if (!Number.isFinite(configured)) return 5 * 60_000;
    return Math.min(Math.max(Math.trunc(configured), 60_000), 60 * 60_000);
  }

  private static getLeaseRenewIntervalMs() {
    const configured = Number(
      process.env.INDEXING_LEASE_RENEW_INTERVAL_MS ?? 30_000,
    );
    const timeout = this.getLeaseTimeoutMs();
    if (!Number.isFinite(configured))
      return Math.min(30_000, Math.floor(timeout / 3));
    return Math.min(
      Math.max(Math.trunc(configured), 5_000),
      Math.floor(timeout / 2),
    );
  }

  private static getAttachmentExtractionMaxOutputTokens() {
    const configured = Number(
      process.env.ATTACHMENT_EXTRACTION_MAX_OUTPUT_TOKENS ?? 6000,
    );
    if (!Number.isFinite(configured)) return 6000;
    return Math.min(Math.max(Math.trunc(configured), 500), 12000);
  }

  private static getAudioTranscriptionMaxOutputTokens() {
    const configured = Number(
      process.env.AUDIO_TRANSCRIPTION_MAX_OUTPUT_TOKENS ?? 6000,
    );
    if (!Number.isFinite(configured)) return 6000;
    return Math.min(Math.max(Math.trunc(configured), 500), 12000);
  }

  private static usesKnownLowQuotaModel() {
    const configuredModels = [
      process.env.TUTURUUU_CHUNK_MODEL,
      process.env.TUTURUUU_VISION_MODEL,
      process.env.TUTURUUU_TRANSCRIPTION_MODEL,
      process.env.TUTURUUU_SUMMARY_MODEL,
      process.env.TUTURUUU_ANSWER_MODEL,
    ]
      .filter(Boolean)
      .join(" ");

    return configuredModels.includes("gemini-2.5-flash");
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
    const nextSum = current.sum + durationMs;
    const nextAvg = Math.round(nextSum / nextCount);

    this.metrics.job_duration_ms = {
      count: nextCount,
      last: durationMs,
      sum: nextSum,
      avg: nextAvg,
      max: Math.max(current.max, durationMs),
    };
  }

  static startCron() {
    cron.schedule("*/1 * * * *", async () => {
      await this.requestDrain("cron");
    });
    console.log("Background Worker for IndexingOutbox ingestion started.");
  }

  private static requestDrain(trigger: "cron" | "realtime") {
    this.drainRequested = true;
    const run = this.drainCoordinatorFlight.run(async () => {
      const maxBatches = this.getAutomaticDrainMaxBatches();
      let batches = 0;

      while (this.drainRequested && batches < maxBatches) {
        this.drainRequested = false;

        while (batches < maxBatches) {
          const result = await this.processPendingIndexingJobs(
            this.getWorkerBatchSize(),
          );
          batches += 1;
          if (result.claimed > 0 || result.resetStale > 0) {
            console.log(
              `[Worker - Ingestion] ${trigger} ${JSON.stringify(result)}`,
            );
          }
          if (result.claimed === 0) break;
        }
      }

      if (batches >= maxBatches) this.drainRequested = true;
    });

    void run
      .catch((error) => {
        console.error(`[Worker - Ingestion] ${trigger} drain failed:`, error);
      })
      .finally(() => {
        if (this.drainRequested && !this.listenerStopping) {
          setImmediate(() => void this.requestDrain(trigger));
        }
      });

    return run;
  }

  static startRealtimeListener() {
    if (this.listenerStarted) return;
    this.listenerStarted = true;
    this.listenerStopping = false;

    if (!process.env.DATABASE_URL) {
      console.warn(
        "[Worker - Ingestion] DATABASE_URL missing; realtime listener disabled.",
      );
      this.listenerStarted = false;
      return;
    }

    void this.connectRealtimeListener();
  }

  static async stopRealtimeListener() {
    this.listenerStopping = true;
    this.listenerStarted = false;
    if (this.listenerReconnectTimer) clearTimeout(this.listenerReconnectTimer);
    this.listenerReconnectTimer = null;
    const client = this.listenerClient;
    this.listenerClient = null;
    if (!client) return;

    client.removeAllListeners();
    try {
      await client.query("UNLISTEN indexing_outbox_jobs");
    } catch {
      // The connection may already be closed during shutdown.
    }
    await client.end().catch(() => undefined);
  }

  private static async connectRealtimeListener() {
    if (this.listenerStopping || this.listenerClient) return;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return;

    const client = new PgClient({
      connectionString,
      application_name: `${this.workerId}:indexing-listener`,
      keepAlive: true,
    });
    this.listenerClient = client;

    client.on("notification", () => {
      void this.requestDrain("realtime");
    });
    client.on("error", (error) => {
      this.handleListenerDisconnect(client, error);
    });
    client.on("end", () => {
      this.handleListenerDisconnect(
        client,
        new Error("PostgreSQL LISTEN connection ended."),
      );
    });

    try {
      await client.connect();
      await client.query("LISTEN indexing_outbox_jobs");
      this.listenerReconnectAttempt = 0;
      console.log(
        "[Worker - Ingestion] Listening for indexing_outbox_jobs notifications.",
      );
      await this.requestDrain("realtime");
    } catch (error) {
      this.handleListenerDisconnect(client, error);
    }
  }

  private static handleListenerDisconnect(client: PgClient, error: unknown) {
    if (this.listenerClient !== client) return;
    this.listenerClient = null;
    client.removeAllListeners();
    void client.end().catch(() => undefined);

    if (this.listenerStopping) return;
    const delayMs = calculateReconnectDelayMs(this.listenerReconnectAttempt, {
      baseDelayMs: Number(
        process.env.INDEXING_LISTENER_RECONNECT_BASE_MS ?? 1_000,
      ),
      maxDelayMs: Number(
        process.env.INDEXING_LISTENER_RECONNECT_MAX_MS ?? 60_000,
      ),
    });
    this.listenerReconnectAttempt += 1;
    console.warn(
      `[Worker - Ingestion] Realtime listener disconnected; reconnecting in ${delayMs}ms: ${this.toErrorMessage(error)}`,
    );

    if (this.listenerReconnectTimer) clearTimeout(this.listenerReconnectTimer);
    this.listenerReconnectTimer = setTimeout(() => {
      this.listenerReconnectTimer = null;
      void this.connectRealtimeListener();
    }, delayMs);
    this.listenerReconnectTimer.unref?.();
  }

  private static getAutomaticDrainMaxBatches() {
    const configured = Number(
      process.env.INDEXING_AUTOMATIC_DRAIN_MAX_BATCHES ?? 20,
    );
    if (!Number.isFinite(configured)) return 20;
    return Math.min(Math.max(Math.trunc(configured), 1), 100);
  }
}
