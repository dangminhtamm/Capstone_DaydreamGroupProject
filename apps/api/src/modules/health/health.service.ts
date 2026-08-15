import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getAuditLogStatus } from '../../common/middleware/audit-log.middleware';
import { checkRedisRateLimitHealth, getRateLimitStatus } from '../../common/middleware/rate-limit.middleware';
import { getSecurityHeaderStatus } from '../../common/middleware/security-headers.middleware';
import { getSearchCacheStatus } from '../../common/cache/search-answer-cache';
import { getQueryEmbeddingCacheStatus } from '../../common/cache/query-embedding-cache';
import { TUTURUUU_EMBEDDING_MODEL } from '@second-brain/ai';

type DbCountRow = {
  status: string;
  count: number | bigint;
};

type DbNameRow = {
  name: string | null;
};

type HealthCheck = {
  ok: boolean;
  detail?: string;
};

type SchemaCheck = HealthCheck & {
  required: boolean;
};

type OutboxHealth = {
  available: boolean;
  counts: Record<string, number>;
  pendingJobCount: number;
  dueJobCount: number;
  staleProcessingCount: number;
  failedJobCount: number;
  deadLetterJobCount: number;
  oldestPendingAgeMs: number | null;
  detail?: string;
};

type WorkerHealth = {
  available: boolean;
  ok: boolean;
  status: 'healthy' | 'missing' | 'stale' | 'stopping' | 'unavailable';
  id?: string;
  detail: string;
  lastHeartbeatAt: string | null;
  heartbeatAgeMs: number | null;
  staleAfterMs: number;
};

type EmbeddingIndexHealth = {
  available: boolean;
  healthy: boolean;
  embeddingModel: string;
  totalChunks: number;
  embeddedChunks: number;
  currentEmbeddingModelChunks: number;
  staleEmbeddingModelChunks: number;
  missingEmbeddingChunks: number;
  latestChunkUpdatedAt: string | null;
  detail?: string;
};

type WorkerHeartbeatRow = {
  id: string;
  status: string;
  detail: string | null;
  heartbeat_at: Date;
  age_ms: number | string | null;
};

type OutboxSummaryRow = {
  pendingJobCount: number | bigint | string;
  dueJobCount: number | bigint | string;
  staleProcessingCount: number | bigint | string;
  failedJobCount: number | bigint | string;
  deadLetterJobCount: number | bigint | string;
  oldestPendingAgeMs: number | string | null;
};

type EmbeddingSummaryRow = {
  totalChunks: number | bigint | string;
  embeddedChunks: number | bigint | string;
  currentEmbeddingModelChunks: number | bigint | string;
  staleEmbeddingModelChunks: number | bigint | string;
  missingEmbeddingChunks: number | bigint | string;
  latestChunkUpdatedAt: Date | null;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness() {
    return { status: 'alive' as const };
  }

  async getReadiness() {
    const checkedAt = new Date().toISOString();
    const database = await this.checkDatabase();

    if (!database.ok) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checkedAt,
      });
    }

    return {
      status: 'ready' as const,
      checkedAt,
    };
  }

  async getDiagnostics() {
    const checkedAt = new Date().toISOString();
    const [redis, database] = await Promise.all([
      checkRedisRateLimitHealth(),
      this.checkDatabase(),
    ]);
    const env = this.getEnvironmentStatus(redis);
    const tables = database.ok
      ? await this.checkRelations({
          indexing_outbox: true,
          calendar_events: true,
          google_contacts: true,
          google_drive_files: true,
          google_connections: true,
          summaries: true,
          memory_chunks: true,
          entity_mentions: true,
          worker_heartbeats: true,
        })
      : {};
    const indexes = database.ok
      ? await this.checkRelations({
          calendar_events_user_external_key: true,
          google_contacts_user_external_key: true,
          google_drive_files_user_external_key: true,
          google_connections_user_source_key: true,
          summaries_user_type_period_key: true,
          indexing_outbox_job_source_key: true,
          indexing_outbox_processing_lease_idx: true,
          memory_chunks_user_source_chunk_key: true,
          entity_mentions_type_normalized_value_idx: true,
          worker_heartbeats_heartbeat_at_idx: true,
        }, 'index')
      : {};
    const outbox = database.ok && tables.indexing_outbox?.ok
      ? await this.getOutboxHealth()
      : {
          available: false,
          counts: {},
          pendingJobCount: 0,
          dueJobCount: 0,
          staleProcessingCount: 0,
          failedJobCount: 0,
          deadLetterJobCount: 0,
          oldestPendingAgeMs: null,
          detail: 'indexing_outbox table is missing. Apply migrations before relying on async indexing.',
        };
    const [worker, embeddingIndex] = database.ok
      ? await Promise.all([
          this.getWorkerHealth(tables.worker_heartbeats?.ok ?? false),
          this.getEmbeddingIndexHealth(tables.memory_chunks?.ok ?? false),
        ])
      : [
          this.unavailableWorkerHealth('Database is not reachable.'),
          this.unavailableEmbeddingIndexHealth('Database is not reachable.'),
        ] as const;

    const missingRequiredSchema = [...Object.values(tables), ...Object.values(indexes)]
      .some((check) => check.required && !check.ok);
    const missingRequiredEnv = !env.databaseConfigured || !env.supabaseConfigured || !env.tuturuuuConfigured;
    const queueNeedsAction = outbox.failedJobCount > 0 || outbox.deadLetterJobCount > 0 || outbox.staleProcessingCount > 0;
    const embeddingNeedsAction = embeddingIndex.available && !embeddingIndex.healthy;
    const status = database.ok &&
      !missingRequiredSchema &&
      !missingRequiredEnv &&
      worker.ok &&
      !queueNeedsAction &&
      !embeddingNeedsAction
      ? 'ok'
      : 'degraded';

    return {
      status,
      checkedAt,
      database,
      environment: env,
      enterpriseControls: this.getEnterpriseControls(redis),
      worker,
      schema: {
        tables,
        indexes,
      },
      indexingOutbox: outbox,
      embeddingIndex,
      warnings: this.buildWarnings({
        database,
        env,
        tables,
        indexes,
        outbox,
        worker,
        embeddingIndex,
      }),
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'Database connection failed.',
      };
    }
  }

  private async checkRelations(
    names: Record<string, boolean>,
    kind: 'table' | 'index' = 'table',
  ): Promise<Record<string, SchemaCheck>> {
    const entries = await Promise.all(
      Object.entries(names).map(async ([name, required]) => {
        const exists = kind === 'table'
          ? await this.tableExists(name)
          : await this.indexExists(name);

        return [
          name,
          {
            ok: exists,
            required,
            ...(exists ? {} : { detail: `${kind} ${name} is missing.` }),
          },
        ] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  private async tableExists(tableName: string) {
    const rows = await this.prisma.$queryRawUnsafe<DbNameRow[]>(
      'SELECT to_regclass($1)::text AS name',
      `public.${tableName}`,
    );

    return Boolean(rows[0]?.name);
  }

  private async indexExists(indexName: string) {
    const rows = await this.prisma.$queryRawUnsafe<DbNameRow[]>(
      "SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1",
      indexName,
    );

    return Boolean(rows[0]?.name);
  }

  private async getOutboxHealth(): Promise<OutboxHealth> {
    try {
      const [rows, summaryRows] = await Promise.all([
        this.prisma.$queryRawUnsafe<DbCountRow[]>(
        'SELECT status, COUNT(*) AS count FROM indexing_outbox GROUP BY status ORDER BY status',
        ),
        this.prisma.$queryRawUnsafe<OutboxSummaryRow[]>(
          `
          SELECT
            COUNT(*) FILTER (WHERE status IN ('pending', 'retry')) AS "pendingJobCount",
            COUNT(*) FILTER (WHERE status IN ('pending', 'retry') AND run_after <= now()) AS "dueJobCount",
            COUNT(*) FILTER (
              WHERE status = 'processing'
                AND locked_at < now() - ($1 * interval '1 millisecond')
            ) AS "staleProcessingCount",
            COUNT(*) FILTER (WHERE status = 'failed') AS "failedJobCount",
            COUNT(*) FILTER (WHERE status = 'dead_letter') AS "deadLetterJobCount",
            EXTRACT(EPOCH FROM (
              now() - MIN(created_at) FILTER (WHERE status IN ('pending', 'retry'))
            )) * 1000 AS "oldestPendingAgeMs"
          FROM indexing_outbox
          `,
          this.getIndexingLeaseTimeoutMs(),
        ),
      ]);
      const summary = summaryRows[0];

      return {
        available: true,
        counts: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        }, {}),
        pendingJobCount: toNumber(summary?.pendingJobCount),
        dueJobCount: toNumber(summary?.dueJobCount),
        staleProcessingCount: toNumber(summary?.staleProcessingCount),
        failedJobCount: toNumber(summary?.failedJobCount),
        deadLetterJobCount: toNumber(summary?.deadLetterJobCount),
        oldestPendingAgeMs: nullableNumber(summary?.oldestPendingAgeMs),
      };
    } catch (error) {
      return {
        available: false,
        counts: {},
        pendingJobCount: 0,
        dueJobCount: 0,
        staleProcessingCount: 0,
        failedJobCount: 0,
        deadLetterJobCount: 0,
        oldestPendingAgeMs: null,
        detail: error instanceof Error ? error.message : 'Could not read indexing_outbox.',
      };
    }
  }

  private getIndexingLeaseTimeoutMs() {
    const configured = Number(process.env.INDEXING_LEASE_TIMEOUT_MS ?? 5 * 60_000);
    if (!Number.isFinite(configured)) return 5 * 60_000;
    return Math.min(Math.max(Math.trunc(configured), 60_000), 60 * 60_000);
  }

  private async getWorkerHealth(tableAvailable: boolean): Promise<WorkerHealth> {
    const staleAfterMs = Number(process.env.WORKER_HEARTBEAT_STALE_MS ?? 90_000);

    if (!tableAvailable) {
      return this.unavailableWorkerHealth('worker_heartbeats table is missing. Apply migrations, then restart the worker.');
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<WorkerHeartbeatRow[]>(
        `
        SELECT
          id,
          status,
          detail,
          heartbeat_at,
          EXTRACT(EPOCH FROM (now() - heartbeat_at)) * 1000 AS age_ms
        FROM worker_heartbeats
        ORDER BY heartbeat_at DESC
        LIMIT 1
        `,
      );
      const row = rows[0];

      if (!row) {
        return {
          available: true,
          ok: false,
          status: 'missing',
          detail: 'No worker heartbeat found. Start the worker so indexing jobs can be drained.',
          lastHeartbeatAt: null,
          heartbeatAgeMs: null,
          staleAfterMs,
        };
      }

      const heartbeatAgeMs = nullableNumber(row.age_ms);
      const stale = heartbeatAgeMs == null || heartbeatAgeMs > staleAfterMs;
      const stopping = row.status === 'stopping';

      return {
        available: true,
        ok: !stale && !stopping,
        status: stopping ? 'stopping' : stale ? 'stale' : 'healthy',
        id: row.id,
        detail: stopping
          ? 'Worker heartbeat says the process is stopping.'
          : stale
            ? `Last worker heartbeat is older than ${Math.round(staleAfterMs / 1000)} seconds. Restart the worker.`
            : row.detail ?? 'Worker heartbeat is fresh.',
        lastHeartbeatAt: row.heartbeat_at.toISOString(),
        heartbeatAgeMs,
        staleAfterMs,
      };
    } catch (error) {
      return this.unavailableWorkerHealth(
        error instanceof Error ? error.message : 'Could not read worker heartbeat.',
      );
    }
  }

  private async getEmbeddingIndexHealth(tableAvailable: boolean): Promise<EmbeddingIndexHealth> {
    if (!tableAvailable) {
      return this.unavailableEmbeddingIndexHealth('memory_chunks table is missing. Apply migrations before indexing memory.');
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<EmbeddingSummaryRow[]>(
        `
        SELECT
          COUNT(*) AS "totalChunks",
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS "embeddedChunks",
          COUNT(*) FILTER (
            WHERE embedding IS NOT NULL
              AND metadata->>'embeddingModel' = $1
          ) AS "currentEmbeddingModelChunks",
          COUNT(*) FILTER (
            WHERE embedding IS NOT NULL
              AND metadata->>'embeddingModel' IS DISTINCT FROM $1
          ) AS "staleEmbeddingModelChunks",
          COUNT(*) FILTER (WHERE embedding IS NULL) AS "missingEmbeddingChunks",
          MAX(updated_at) AS "latestChunkUpdatedAt"
        FROM memory_chunks
        `,
        TUTURUUU_EMBEDDING_MODEL,
      );
      const row = rows[0];
      const totalChunks = toNumber(row?.totalChunks);
      const missingEmbeddingChunks = toNumber(row?.missingEmbeddingChunks);
      const staleEmbeddingModelChunks = toNumber(row?.staleEmbeddingModelChunks);
      const healthy = totalChunks === 0 || (missingEmbeddingChunks === 0 && staleEmbeddingModelChunks === 0);

      return {
        available: true,
        healthy,
        embeddingModel: TUTURUUU_EMBEDDING_MODEL,
        totalChunks,
        embeddedChunks: toNumber(row?.embeddedChunks),
        currentEmbeddingModelChunks: toNumber(row?.currentEmbeddingModelChunks),
        staleEmbeddingModelChunks,
        missingEmbeddingChunks,
        latestChunkUpdatedAt: row?.latestChunkUpdatedAt?.toISOString() ?? null,
        detail: healthy
          ? totalChunks > 0
            ? `All embedded chunks are aligned with ${TUTURUUU_EMBEDDING_MODEL}.`
            : 'No memory chunks have been indexed yet.'
          : `${missingEmbeddingChunks} chunks are missing embeddings and ${staleEmbeddingModelChunks} chunks use an older embedding model.`,
      };
    } catch (error) {
      return this.unavailableEmbeddingIndexHealth(
        error instanceof Error ? error.message : 'Could not inspect memory embeddings.',
      );
    }
  }

  private unavailableWorkerHealth(detail: string): WorkerHealth {
    return {
      available: false,
      ok: false,
      status: 'unavailable',
      detail,
      lastHeartbeatAt: null,
      heartbeatAgeMs: null,
      staleAfterMs: Number(process.env.WORKER_HEARTBEAT_STALE_MS ?? 90_000),
    };
  }

  private unavailableEmbeddingIndexHealth(detail: string): EmbeddingIndexHealth {
    return {
      available: false,
      healthy: false,
      embeddingModel: TUTURUUU_EMBEDDING_MODEL,
      totalChunks: 0,
      embeddedChunks: 0,
      currentEmbeddingModelChunks: 0,
      staleEmbeddingModelChunks: 0,
      missingEmbeddingChunks: 0,
      latestChunkUpdatedAt: null,
      detail,
    };
  }

  private getEnvironmentStatus(redis: Awaited<ReturnType<typeof checkRedisRateLimitHealth>>) {
    const supabaseServerKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SECRET_KEY;
    const supabaseServerKeyIsPublishable = supabaseServerKey?.startsWith('sb_publishable') ?? false;

    return {
      databaseConfigured: hasRealValue(process.env.DATABASE_URL),
      supabaseConfigured:
        hasRealValue(process.env.SUPABASE_URL) &&
        hasRealValue(supabaseServerKey) &&
        !supabaseServerKeyIsPublishable,
      tuturuuuConfigured: hasRealValue(process.env.TUTURUUU_AI_API_KEY),
      googleOAuthConfigured: hasRealValue(process.env.GOOGLE_CLIENT_ID) && hasRealValue(process.env.GOOGLE_CLIENT_SECRET),
      redisConfigured: hasRealValue(process.env.REDIS_URL),
      redisReachable: redis.reachable,
      rateLimitRedisRequired:
        process.env.RATE_LIMIT_REDIS_REQUIRED === 'true' ||
        (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_REDIS_REQUIRED !== 'false'),
      trustedProxyConfigured:
        hasRealValue(process.env.TRUST_PROXY) ||
        process.env.RATE_LIMIT_TRUST_PROXY_HEADERS === 'true' ||
        hasRealValue(process.env.RATE_LIMIT_CLIENT_IP_HEADER),
      temporalConfigured: hasRealValue(process.env.TEMPORAL_ADDRESS) || hasRealValue(process.env.TEMPORAL_NAMESPACE),
      sentryConfigured: hasRealValue(process.env.SENTRY_DSN),
      openTelemetryConfigured:
        hasRealValue(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) ||
        hasRealValue(process.env.OTEL_SERVICE_NAME),
    };
  }

  private getEnterpriseControls(redis: Awaited<ReturnType<typeof checkRedisRateLimitHealth>>) {
    return {
      requestId: {
        enabled: true,
        header: 'x-request-id',
      },
      securityHeaders: {
        enabled: true,
        ...getSecurityHeaderStatus(),
      },
      rateLimit: getRateLimitStatus(),
      auditLogging: getAuditLogStatus(),
      searchCache: getSearchCacheStatus(),
      queryEmbeddingCache: getQueryEmbeddingCacheStatus(),
      observability: {
        sentryConfigured: hasRealValue(process.env.SENTRY_DSN),
        openTelemetryConfigured:
          hasRealValue(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) ||
          hasRealValue(process.env.OTEL_SERVICE_NAME),
        redisConfigured: hasRealValue(process.env.REDIS_URL),
        redisReachable: redis.reachable,
        redisError: redis.error,
        temporalConfigured: hasRealValue(process.env.TEMPORAL_ADDRESS) || hasRealValue(process.env.TEMPORAL_NAMESPACE),
      },
    };
  }

  private buildWarnings(input: {
    database: HealthCheck;
    env: ReturnType<HealthService['getEnvironmentStatus']>;
    tables: Record<string, SchemaCheck>;
    indexes: Record<string, SchemaCheck>;
    outbox: OutboxHealth;
    worker: WorkerHealth;
    embeddingIndex: EmbeddingIndexHealth;
  }) {
    const warnings: string[] = [];

    if (!input.database.ok) warnings.push('Database is not reachable.');
    if (!input.env.tuturuuuConfigured) warnings.push('TUTURUUU_AI_API_KEY is missing; AI summary/search/indexing will fail.');
    if (!input.env.supabaseConfigured) warnings.push('Supabase service env is missing; storage/auth-backed features may fail.');
    if (!input.env.googleOAuthConfigured) warnings.push('Google OAuth env is missing; Calendar connect cannot run end-to-end.');
    if (!input.env.redisConfigured) warnings.push('Redis is not configured; rate limiting, hot answer cache, and shared query embedding cache are using local fallbacks.');
    if (input.env.redisConfigured && !input.env.redisReachable) warnings.push('Redis is configured but not reachable; rate limiting, hot answer cache, and shared query embedding cache are using local fallbacks.');
    if (input.env.rateLimitRedisRequired && !input.env.redisReachable) warnings.push('Production rate limiting requires Redis, but Redis is not reachable.');
    if (process.env.NODE_ENV === 'production' && !input.env.trustedProxyConfigured) warnings.push('Trusted proxy/IP header is not configured; anonymous rate limiting will use direct socket IP.');
    if (!input.env.temporalConfigured) warnings.push('Temporal is not configured; worker jobs are running with local cron/outbox semantics.');
    if (!input.env.sentryConfigured) warnings.push('Sentry is not configured; production error reporting is disabled.');
    if (!input.env.openTelemetryConfigured) warnings.push('OpenTelemetry is not configured; distributed tracing export is disabled.');
    if (!input.worker.ok) warnings.push(input.worker.detail);
    if (input.embeddingIndex.available && !input.embeddingIndex.healthy) {
      warnings.push(input.embeddingIndex.detail ?? 'Some memory chunks need re-embedding before semantic search is fully healthy.');
    }

    for (const [name, check] of Object.entries(input.tables)) {
      if (check.required && !check.ok) warnings.push(`Missing required table: ${name}.`);
    }

    for (const [name, check] of Object.entries(input.indexes)) {
      if (check.required && !check.ok) warnings.push(`Missing required index/constraint: ${name}.`);
    }

    if (!input.outbox.available) warnings.push(input.outbox.detail ?? 'Indexing outbox is unavailable.');
    if (input.outbox.deadLetterJobCount > 0) warnings.push(`${input.outbox.deadLetterJobCount} indexing jobs are in dead-letter.`);
    if (input.outbox.failedJobCount > 0) warnings.push(`${input.outbox.failedJobCount} indexing jobs failed.`);
    if (input.outbox.staleProcessingCount > 0) warnings.push(`${input.outbox.staleProcessingCount} indexing jobs are stuck in processing.`);
    if (!input.worker.ok && input.outbox.dueJobCount > 0) {
      warnings.push(`${input.outbox.dueJobCount} due indexing jobs are waiting while the worker is not healthy.`);
    }

    return warnings;
  }
}

function hasRealValue(value?: string) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized !== '...' && !normalized.includes('<');
}

function toNumber(value: number | bigint | string | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function nullableNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
