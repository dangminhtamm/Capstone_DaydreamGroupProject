import { Injectable } from '@nestjs/common';
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
      recent: recent.map((job) => ({
        id: job.id,
        jobType: job.job_type,
        sourceType: job.source_type,
        sourceId: job.source_id,
        status: job.status,
        retryCount: job.retry_count,
        maxRetries: job.max_retries,
        error: job.error,
        runAfter: job.run_after.toISOString(),
        lockedAt: job.locked_at?.toISOString() ?? null,
        processedAt: job.processed_at?.toISOString() ?? null,
        createdAt: job.created_at.toISOString(),
        updatedAt: job.updated_at.toISOString(),
      })),
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
}
