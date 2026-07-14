import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type AuthenticatedUserInput = {
  supabaseId: string;
  email: string;
};

type CountRow = {
  status: string;
  count: number | bigint;
};

type NameRow = {
  name: string | null;
};

type RecentJobRow = {
  id: string;
  job_type: string;
  source_type: string;
  source_id: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error: string | null;
  run_after: Date;
  locked_at: Date | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class IndexingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(authUser: AuthenticatedUserInput) {
    const user = await this.findOrCreateUser(authUser);
    const available = await this.outboxExists();

    if (!available) {
      return {
        available: false,
        reason: 'indexing_outbox table is missing. Apply migrations before async indexing can be observed.',
        counts: {},
        staleProcessingCount: 0,
        recent: [],
      };
    }

    const [counts, staleProcessing, recent] = await Promise.all([
      this.getCounts(user.id),
      this.getStaleProcessingCount(user.id),
      this.getRecentJobs(user.id),
    ]);

    return {
      available: true,
      counts,
      staleProcessingCount: staleProcessing,
      recent: recent.map((job) => this.toClientJob(job)),
    };
  }

  async requeueJob(authUser: AuthenticatedUserInput, jobId: string) {
    const user = await this.findOrCreateUser(authUser);
    const available = await this.outboxExists();

    if (!available) {
      return {
        requeued: false,
        reason: 'indexing_outbox table is missing. Apply migrations before requeueing jobs.',
      };
    }

    const job = await this.prisma.indexingOutbox.findFirst({
      where: { id: jobId, user_id: user.id },
    });

    if (!job) {
      throw new NotFoundException('Indexing job not found.');
    }

    const updated = await this.prisma.indexingOutbox.update({
      where: { id: job.id },
      data: this.requeueData(),
    });

    return {
      requeued: true,
      job: this.toClientJob({
        id: updated.id,
        job_type: updated.job_type,
        source_type: updated.source_type,
        source_id: updated.source_id,
        status: updated.status,
        retry_count: updated.retry_count,
        max_retries: updated.max_retries,
        error: updated.error,
        run_after: updated.run_after,
        locked_at: updated.locked_at,
        processed_at: updated.processed_at,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      }),
    };
  }

  async requeueDeadLetterJobs(authUser: AuthenticatedUserInput) {
    const user = await this.findOrCreateUser(authUser);
    const available = await this.outboxExists();

    if (!available) {
      return {
        requeued: 0,
        reason: 'indexing_outbox table is missing. Apply migrations before requeueing jobs.',
      };
    }

    const result = await this.prisma.indexingOutbox.updateMany({
      where: {
        user_id: user.id,
        status: { in: ['dead_letter', 'failed'] },
      },
      data: this.requeueData(),
    });

    return {
      requeued: result.count,
      status: result.count > 0 ? 'pending' : 'no_dead_letter_jobs',
    };
  }

  async getDemoReadiness(authUser: AuthenticatedUserInput) {
    const user = await this.findOrCreateUser(authUser);
    const available = await this.outboxExists();
    const counts = available ? await this.getCounts(user.id) : {};

    const [
      diaryEntries,
      memoryChunks,
      summaries,
      calendarEvents,
      linkedDiaries,
      attachments,
      extractedAttachments,
    ] = await Promise.all([
      this.prisma.diaryEntry.count({ where: { user_id: user.id } }),
      this.prisma.memoryChunk.count({ where: { userId: user.id } }),
      this.prisma.summary.count({ where: { user_id: user.id } }),
      this.prisma.calendarEvent.count({ where: { user_id: user.id } }),
      this.prisma.diaryEntry.count({
        where: {
          user_id: user.id,
          calendar_events: { some: {} },
        },
      }),
      this.prisma.attachment.count({
        where: { diary_entry: { user_id: user.id } },
      }),
      this.prisma.attachment.count({
        where: {
          diary_entry: { user_id: user.id },
          extracted_text: { not: null },
        },
      }),
    ]);

    const pendingOutbox =
      (counts.pending ?? 0) + (counts.retry ?? 0) + (counts.processing ?? 0);
    const failedOutbox = (counts.dead_letter ?? 0) + (counts.failed ?? 0);

    const checks = [
      {
        id: 'diary_entries',
        label: 'Diary entries',
        ok: diaryEntries >= 7,
        required: true,
        detail: `${diaryEntries}/7 recommended entries`,
      },
      {
        id: 'memory_chunks',
        label: 'Memory chunks',
        ok: memoryChunks > 0,
        required: true,
        detail: `${memoryChunks} indexed chunks`,
      },
      {
        id: 'summaries',
        label: 'AI summaries',
        ok: summaries > 0,
        required: true,
        detail: `${summaries} summaries generated`,
      },
      {
        id: 'calendar_events',
        label: 'Calendar events',
        ok: calendarEvents > 0,
        required: true,
        detail: `${calendarEvents} synced events`,
      },
      {
        id: 'linked_calendar',
        label: 'Diary-calendar linking',
        ok: linkedDiaries > 0,
        required: true,
        detail: `${linkedDiaries} diary entries linked`,
      },
      {
        id: 'attachments',
        label: 'Attachment ingestion',
        ok: attachments > 0 && extractedAttachments > 0,
        required: false,
        detail: `${extractedAttachments}/${attachments} attachments extracted`,
      },
      {
        id: 'outbox_available',
        label: 'Indexing outbox',
        ok: available,
        required: true,
        detail: available ? 'Outbox table is available' : 'Outbox table is missing',
      },
      {
        id: 'outbox_clean',
        label: 'Outbox health',
        ok: failedOutbox === 0,
        required: true,
        detail:
          failedOutbox > 0
            ? `${failedOutbox} failed/dead-letter jobs need attention`
            : pendingOutbox > 0
              ? `${pendingOutbox} jobs still pending or processing`
              : 'No failed jobs',
      },
    ];

    const ready = checks
      .filter((check) => check.required)
      .every((check) => check.ok);

    return {
      ready,
      counts: {
        diaryEntries,
        memoryChunks,
        summaries,
        calendarEvents,
        linkedDiaries,
        attachments,
        extractedAttachments,
        pendingOutbox,
        failedOutbox,
      },
      outbox: {
        available,
        counts,
      },
      checks,
      nextActions: checks
        .filter((check) => !check.ok)
        .map((check) => this.nextActionForCheck(check.id)),
    };
  }

  private async findOrCreateUser(authUser: AuthenticatedUserInput) {
    return this.prisma.user.upsert({
      where: { supabaseId: authUser.supabaseId },
      update: { email: authUser.email },
      create: {
        supabaseId: authUser.supabaseId,
        email: authUser.email,
      },
      select: { id: true },
    });
  }

  private async outboxExists() {
    const rows = await this.prisma.$queryRawUnsafe<NameRow[]>(
      'SELECT to_regclass($1)::text AS name',
      'public.indexing_outbox',
    );

    return Boolean(rows[0]?.name);
  }

  private async getCounts(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<CountRow[]>(
      'SELECT status, COUNT(*) AS count FROM indexing_outbox WHERE user_id = $1 GROUP BY status ORDER BY status',
      userId,
    );

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});
  }

  private async getStaleProcessingCount(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: number | bigint }>>(
      "SELECT COUNT(*) AS count FROM indexing_outbox WHERE user_id = $1 AND status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes'",
      userId,
    );

    return Number(rows[0]?.count ?? 0);
  }

  private async getRecentJobs(userId: string) {
    return this.prisma.$queryRawUnsafe<RecentJobRow[]>(
      `SELECT
        id,
        job_type,
        source_type,
        source_id,
        status,
        retry_count,
        max_retries,
        error,
        run_after,
        locked_at,
        processed_at,
        created_at,
        updated_at
      FROM indexing_outbox
      WHERE user_id = $1
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 10`,
      userId,
    );
  }

  private requeueData() {
    return {
      status: 'pending',
      retry_count: 0,
      error: null,
      run_after: new Date(),
      locked_at: null,
      processed_at: null,
    };
  }

  private toClientJob(job: RecentJobRow) {
    const now = Date.now();
    const ageMs = Math.max(0, now - job.created_at.getTime());
    const processingAgeMs =
      job.status === 'processing' && job.locked_at
        ? Math.max(0, now - job.locked_at.getTime())
        : null;

    return {
      id: job.id,
      jobType: job.job_type,
      sourceType: job.source_type,
      sourceId: job.source_id,
      status: job.status,
      retryCount: job.retry_count,
      maxRetries: job.max_retries,
      error: job.error,
      lastErrorAt: job.error ? job.updated_at.toISOString() : null,
      runAfter: job.run_after.toISOString(),
      nextRunAfter: job.run_after.toISOString(),
      ageMs,
      processingAgeMs,
      lockedAt: job.locked_at?.toISOString() ?? null,
      processedAt: job.processed_at?.toISOString() ?? null,
      createdAt: job.created_at.toISOString(),
      updatedAt: job.updated_at.toISOString(),
    };
  }

  private nextActionForCheck(checkId: string) {
    const actions: Record<string, string> = {
      diary_entries: 'Create or seed at least 7 diary entries across different days.',
      memory_chunks: 'Run the worker or drain indexing jobs so diary/calendar/attachment content becomes searchable.',
      summaries: 'Generate one daily summary and one weekly summary from the Summary page.',
      calendar_events: 'Connect Google Calendar, then run Sync Demo or Sync Now in Settings.',
      linked_calendar: 'Make sure diary entry dates match synced Calendar events, then run Calendar sync/linking again.',
      attachments: 'Upload one text/PDF/image attachment and let the worker extract/index it.',
      outbox_available: 'Apply database migrations before relying on async indexing.',
      outbox_clean: 'Inspect retry/dead-letter indexing jobs and requeue or fix the underlying error.',
    };

    return actions[checkId] ?? 'Review this readiness check before the demo.';
  }
}
