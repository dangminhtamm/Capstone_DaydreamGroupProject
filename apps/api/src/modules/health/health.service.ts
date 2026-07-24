import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getAuditLogStatus } from '../../common/middleware/audit-log.middleware';
import { checkRedisRateLimitHealth, getRateLimitStatus } from '../../common/middleware/rate-limit.middleware';
import { getSearchCacheStatus } from '../../common/cache/search-answer-cache';

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
  detail?: string;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
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
          summaries: true,
          memory_chunks: true,
        })
      : {};
    const indexes = database.ok
      ? await this.checkRelations({
          calendar_events_user_external_key: true,
          google_contacts_user_external_key: true,
          google_drive_files_user_external_key: true,
          summaries_user_type_period_key: true,
          indexing_outbox_job_source_key: true,
          memory_chunks_user_source_chunk_key: true,
        }, 'index')
      : {};
    const outbox = database.ok && tables.indexing_outbox?.ok
      ? await this.getOutboxHealth()
      : {
          available: false,
          counts: {},
          detail: 'indexing_outbox table is missing. Apply migrations before relying on async indexing.',
        };

    const missingRequiredSchema = [...Object.values(tables), ...Object.values(indexes)]
      .some((check) => check.required && !check.ok);
    const missingRequiredEnv = !env.databaseConfigured || !env.supabaseConfigured || !env.geminiConfigured;
    const status = database.ok && !missingRequiredSchema && !missingRequiredEnv ? 'ok' : 'degraded';

    return {
      status,
      checkedAt,
      database,
      environment: env,
      enterpriseControls: this.getEnterpriseControls(redis),
      schema: {
        tables,
        indexes,
      },
      indexingOutbox: outbox,
      warnings: this.buildWarnings({
        database,
        env,
        tables,
        indexes,
        outbox,
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
      const rows = await this.prisma.$queryRawUnsafe<DbCountRow[]>(
        'SELECT status, COUNT(*) AS count FROM indexing_outbox GROUP BY status ORDER BY status',
      );

      return {
        available: true,
        counts: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        }, {}),
      };
    } catch (error) {
      return {
        available: false,
        counts: {},
        detail: error instanceof Error ? error.message : 'Could not read indexing_outbox.',
      };
    }
  }

  private getEnvironmentStatus(redis: Awaited<ReturnType<typeof checkRedisRateLimitHealth>>) {
    const supabaseServerKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SECRET_KEY ??
      process.env.SUPABASE_SERVICE_KEY;
    const supabaseServerKeyIsPublishable = supabaseServerKey?.startsWith('sb_publishable') ?? false;

    return {
      databaseConfigured: hasRealValue(process.env.DATABASE_URL),
      supabaseConfigured:
        hasRealValue(process.env.SUPABASE_URL) &&
        hasRealValue(supabaseServerKey) &&
        !supabaseServerKeyIsPublishable,
      geminiConfigured: hasRealValue(process.env.GEMINI_API_KEY),
      googleOAuthConfigured: hasRealValue(process.env.GOOGLE_CLIENT_ID) && hasRealValue(process.env.GOOGLE_CLIENT_SECRET),
      redisConfigured: hasRealValue(process.env.REDIS_URL),
      redisReachable: redis.reachable,
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
        headers: [
          'X-Content-Type-Options',
          'X-Frame-Options',
          'Referrer-Policy',
          'Permissions-Policy',
          'Cross-Origin-Resource-Policy',
        ],
      },
      rateLimit: getRateLimitStatus(),
      auditLogging: getAuditLogStatus(),
      searchCache: getSearchCacheStatus(),
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
  }) {
    const warnings: string[] = [];

    if (!input.database.ok) warnings.push('Database is not reachable.');
    if (!input.env.geminiConfigured) warnings.push('GEMINI_API_KEY is missing; AI summary/search/indexing will fail.');
    if (!input.env.supabaseConfigured) warnings.push('Supabase service env is missing; storage/auth-backed features may fail.');
    if (!input.env.googleOAuthConfigured) warnings.push('Google OAuth env is missing; Calendar connect cannot run end-to-end.');
    if (!input.env.redisConfigured) warnings.push('Redis is not configured; rate limiting and hot answer cache are using local fallbacks.');
    if (input.env.redisConfigured && !input.env.redisReachable) warnings.push('Redis is configured but not reachable; rate limiting and hot answer cache are using local fallbacks.');
    if (!input.env.temporalConfigured) warnings.push('Temporal is not configured; worker jobs are running with local cron/outbox semantics.');
    if (!input.env.sentryConfigured) warnings.push('Sentry is not configured; production error reporting is disabled.');
    if (!input.env.openTelemetryConfigured) warnings.push('OpenTelemetry is not configured; distributed tracing export is disabled.');

    for (const [name, check] of Object.entries(input.tables)) {
      if (check.required && !check.ok) warnings.push(`Missing required table: ${name}.`);
    }

    for (const [name, check] of Object.entries(input.indexes)) {
      if (check.required && !check.ok) warnings.push(`Missing required index/constraint: ${name}.`);
    }

    if (!input.outbox.available) warnings.push(input.outbox.detail ?? 'Indexing outbox is unavailable.');

    return warnings;
  }
}

function hasRealValue(value?: string) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized !== '...' && !normalized.includes('<');
}
