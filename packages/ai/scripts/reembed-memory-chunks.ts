import { createPrismaClient, toVectorLiteral } from "@second-brain/db";
import { aiGatewayEnvHint, hasAiGatewayKey, loadLocalEnv } from "./env.ts";

loadLocalEnv();

interface ReembedOptions {
  allUsers: boolean;
  batchSize: number;
  delayMs: number;
  dryRun: boolean;
  force: boolean;
  limit?: number;
  userEmail?: string;
  userId?: string;
}

interface MemoryChunkRow {
  id: string;
  user_id: string;
  email: string;
  text: string;
  embedding_model: string | null;
}

function parseArgs(argv: string[]): ReembedOptions {
  const options: ReembedOptions = {
    allUsers: false,
    batchSize: 25,
    delayMs: Number(process.env.MEMORY_REEMBED_DELAY_MS ?? 100),
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--") {
      continue;
    } else if (arg === "--all") {
      options.allUsers = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--user-email" && next) {
      options.userEmail = next;
      index++;
    } else if (arg === "--user-id" && next) {
      options.userId = next;
      index++;
    } else if (arg === "--batch-size" && next) {
      options.batchSize = Math.max(1, Number(next) || options.batchSize);
      index++;
    } else if (arg === "--delay-ms" && next) {
      options.delayMs = Math.max(0, Number(next) || 0);
      index++;
    } else if (arg === "--limit" && next) {
      options.limit = Math.max(1, Number(next) || 0);
      index++;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!options.allUsers && !options.userEmail && !options.userId) {
    throw new Error(
      "Choose a scope: --all, --user-email <email>, or --user-id <internal-user-id>.",
    );
  }

  return options;
}

function buildSelectQuery(options: ReembedOptions, embeddingModel: string) {
  const params: unknown[] = [];
  const conditions = [
    "mc.text IS NOT NULL",
    "length(trim(mc.text)) > 0",
  ];

  if (!options.force) {
    params.push(embeddingModel);
    conditions.push(`(mc.embedding IS NULL OR mc.metadata->>'embeddingModel' IS DISTINCT FROM $${params.length})`);
  }

  if (options.userEmail) {
    params.push(options.userEmail);
    conditions.push(`u.email = $${params.length}`);
  }

  if (options.userId) {
    params.push(options.userId);
    conditions.push(`u.id = $${params.length}::text`);
  }

  const limitClause = options.limit ? `LIMIT ${options.limit}` : "";

  return {
    params,
    sql: `
      SELECT
        mc.id,
        mc.user_id,
        u.email,
        mc.text,
        mc.metadata->>'embeddingModel' AS embedding_model
      FROM memory_chunks mc
      JOIN users u ON u.id = mc.user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY u.email, mc.occurred_at, mc.chunk_index, mc.id
      ${limitClause}
    `,
  };
}

async function retry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : undefined;
      if (![429, 500, 503].includes(status ?? 0) || attempt === 4) break;

      const delayMs = Math.min(60_000, 2_000 * attempt * attempt);
      console.warn(`${label} failed with ${status}; retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!hasAiGatewayKey()) {
    throw new Error(aiGatewayEnvHint("re-embedding memory chunks"));
  }

  const options = parseArgs(process.argv.slice(2));
  const { TUTURUUU_EMBEDDING_MODEL, createDefaultEmbeddingProvider } =
    await import("../src/embedding.ts");
  const prisma = createPrismaClient() as any;
  const embedder = createDefaultEmbeddingProvider();
  const { sql, params } = buildSelectQuery(options, TUTURUUU_EMBEDDING_MODEL);

  try {
    const rows = await prisma.$queryRawUnsafe(sql, ...params) as MemoryChunkRow[];
    console.log(`Embedding model: ${TUTURUUU_EMBEDDING_MODEL}`);
    console.log(`Target chunks: ${rows.length}`);

    if (options.dryRun || rows.length === 0) {
      if (rows.length) {
        console.log(
          JSON.stringify(
            rows.slice(0, 10).map((row) => ({
              id: row.id,
              email: row.email,
              previousModel: row.embedding_model,
              textPreview: row.text.slice(0, 80),
            })),
            null,
            2,
          ),
        );
      }
      return;
    }

    const updatedAt = new Date().toISOString();
    let completed = 0;

    for (let index = 0; index < rows.length; index += options.batchSize) {
      const batch = rows.slice(index, index + options.batchSize);

      for (const row of batch) {
        const embedding = await retry(`Embedding chunk ${row.id}`, () =>
          embedder.embedDocument(row.text),
        );

        await retry(`Updating chunk ${row.id}`, () =>
          prisma.$executeRawUnsafe(
            `
              UPDATE memory_chunks
              SET
                embedding = $1::vector,
                metadata = jsonb_set(
                  jsonb_set(
                    coalesce(metadata, '{}'::jsonb),
                    '{embeddingModel}',
                    to_jsonb($2::text),
                    true
                  ),
                  '{embeddingUpdatedAt}',
                  to_jsonb($3::text),
                  true
                ),
                updated_at = now()
              WHERE id = $4::text
            `,
            toVectorLiteral(embedding),
            TUTURUUU_EMBEDDING_MODEL,
            updatedAt,
            row.id,
          ),
        );

        completed++;
        if (completed % 10 === 0 || completed === rows.length) {
          console.log(`Re-embedded ${completed}/${rows.length}`);
        }

        await sleep(options.delayMs);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
