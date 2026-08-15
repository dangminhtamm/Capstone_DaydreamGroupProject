import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { aiGatewayEnvHint, hasAiGatewayKey, loadLocalEnv } from "./env.ts";
import { resolveEvaluationUserId } from "./eval-user.ts";

loadLocalEnv();

type EvaluationQuestion = {
  id: string;
  category: string;
  question: string;
  expectedSourceTypes?: string[];
  expectedChunkTypes?: string[];
  expectedSourceIds?: string[];
  expectedNoSources?: boolean;
};

type EvaluationDataset = {
  referenceNow?: string;
  questions: EvaluationQuestion[];
};

type TopSource = {
  sourceType: string;
  sourceId: string;
  chunkType: string;
  similarity: number;
  vectorSimilarity: number;
  lexicalScore: number;
  retrievalMode: string;
  occurredAt: string;
};

type RetrievalEvalResult = {
  id: string;
  category: string;
  question: string;
  embeddingMs: number;
  retrievalMs: number;
  totalRecallMs: number;
  sourceCount: number;
  topSimilarity: number;
  sourceTypeCorrect: boolean;
  sourceIdCorrect: boolean;
  chunkTypeCorrect: boolean;
  sourceRelevant: boolean;
  noDataCorrect: boolean | null;
  retrievalUnder500ms: boolean;
  topSources: TopSource[];
  error?: string;
};

const datasetPath =
  process.env.MEMORY_EVAL_DATASET ??
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../evaluation/memory-evaluation.dataset.json",
  );
const evalLimit = process.env.MEMORY_RETRIEVAL_EVAL_LIMIT
  ? parseEvalLimit(process.env.MEMORY_RETRIEVAL_EVAL_LIMIT)
  : undefined;
const retrievalLimit = Number(process.env.MEMORY_RETRIEVAL_EVAL_SOURCE_LIMIT ?? 8);
const noDataSimilarityThreshold = Number(
  process.env.MEMORY_RETRIEVAL_NO_DATA_MAX_SIMILARITY ?? 0.55,
);

if (!hasAiGatewayKey()) {
  console.error(aiGatewayEnvHint("running retrieval evaluation"));
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running retrieval evaluation.");
  process.exitCode = 1;
} else {
  const [
    db,
    {
      createDefaultEmbeddingProvider,
      inferRetrievalFilters,
      retrieveMemoryWithEmbedding,
    },
  ] = await Promise.all([
    import("@second-brain/db"),
    import("../src/index.ts"),
  ]);
  const prisma = db.createPrismaClient();
  const userId = await resolveEvaluationUserId(prisma as any, "evaluate retrieval");
  const dataset = JSON.parse(
    readFileSync(datasetPath, "utf8"),
  ) as EvaluationDataset;
  const referenceNow = resolveReferenceNow(dataset);
  const embedder = createDefaultEmbeddingProvider();

  try {
    if (userId) {
      const questions = Number.isFinite(evalLimit)
        ? dataset.questions.slice(0, Math.max(0, evalLimit ?? 0))
        : dataset.questions;
      const results: RetrievalEvalResult[] = [];

      for (const item of questions) {
        try {
          const embeddingStart = performance.now();
          const embedding = await embedder.embedQuery(item.question);
          const embeddingMs = elapsedSince(embeddingStart);

          const retrievalStart = performance.now();
          const chunks = await retrieveMemoryWithEmbedding(
            item.question,
            userId,
            prisma,
            embedding,
            {
              ...inferRetrievalFilters(item.question, referenceNow),
              limit: retrievalLimit,
              maxDistance: process.env.MEMORY_MAX_DISTANCE
                ? Number(process.env.MEMORY_MAX_DISTANCE)
                : undefined,
            },
          );
          const retrievalMs = elapsedSince(retrievalStart);

          results.push(
            buildResult(item, chunks, embeddingMs, retrievalMs),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            id: item.id,
            category: item.category,
            question: item.question,
            embeddingMs: 0,
            retrievalMs: 0,
            totalRecallMs: 0,
            sourceCount: 0,
            topSimilarity: 0,
            sourceTypeCorrect: false,
            sourceIdCorrect: false,
            chunkTypeCorrect: false,
            sourceRelevant: false,
            noDataCorrect: item.expectedNoSources ? false : null,
            retrievalUnder500ms: false,
            topSources: [],
            error: message.replace(/\s+/g, " ").slice(0, 240),
          });
        }
      }

      const summary = {
        mode: "retrieval",
        total: results.length,
        sourceRelevant: countPass(results, "sourceRelevant"),
        sourceTypeCorrect: countPass(results, "sourceTypeCorrect"),
        sourceIdCorrect: countPass(results, "sourceIdCorrect"),
        chunkTypeCorrect: countPass(results, "chunkTypeCorrect"),
        noDataCorrect: results.filter((row) => row.noDataCorrect === true).length,
        retrievalUnder500ms: countPass(results, "retrievalUnder500ms"),
        averageEmbeddingMs: average(results.map((row) => row.embeddingMs)),
        averageRetrievalMs: average(results.map((row) => row.retrievalMs)),
        averageTotalRecallMs: average(results.map((row) => row.totalRecallMs)),
        errors: results.filter((row) => row.error).length,
        limit: evalLimit ?? null,
        note:
          "Retrieval evaluation checks source matching only. It does not call Tuturuuu answer generation, but still uses query embeddings.",
      };

      console.log(JSON.stringify({ summary, results }, null, 2));
      failIfRequested(summary, results);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function buildResult(
  item: EvaluationQuestion,
  chunks: Array<{
    sourceType: string;
    sourceId: string;
    chunkType: string;
    similarity: number;
    vectorSimilarity: number;
    lexicalScore: number;
    retrievalMode: string;
    occurredAt: Date;
  }>,
  embeddingMs: number,
  retrievalMs: number,
): RetrievalEvalResult {
  const topSimilarity = Number(chunks[0]?.similarity ?? 0);
  const topSources = chunks.slice(0, 5).map((chunk) => ({
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    chunkType: chunk.chunkType,
    similarity: Number(chunk.similarity),
    vectorSimilarity: Number(chunk.vectorSimilarity ?? 0),
    lexicalScore: Number(chunk.lexicalScore ?? 0),
    retrievalMode: chunk.retrievalMode,
    occurredAt:
      chunk.occurredAt instanceof Date
        ? chunk.occurredAt.toISOString()
        : new Date(chunk.occurredAt).toISOString(),
  }));
  const sourceTypeCorrect = matchesAny(
    chunks,
    item.expectedSourceTypes,
    "sourceType",
  );
  const sourceIdCorrect = matchesAny(chunks, item.expectedSourceIds, "sourceId");
  const chunkTypeCorrect = matchesAny(
    chunks,
    item.expectedChunkTypes,
    "chunkType",
  );
  const hasSourceExpectations = Boolean(
    item.expectedSourceTypes?.length ||
      item.expectedSourceIds?.length ||
      item.expectedChunkTypes?.length,
  );
  const noDataCorrect = item.expectedNoSources
    ? chunks.length === 0 || topSimilarity < noDataSimilarityThreshold
    : null;
  const sourceRelevant = item.expectedNoSources
    ? Boolean(noDataCorrect)
    : hasSourceExpectations
      ? sourceTypeCorrect && sourceIdCorrect && chunkTypeCorrect
      : chunks.length > 0;

  return {
    id: item.id,
    category: item.category,
    question: item.question,
    embeddingMs,
    retrievalMs,
    totalRecallMs: embeddingMs + retrievalMs,
    sourceCount: chunks.length,
    topSimilarity,
    sourceTypeCorrect,
    sourceIdCorrect,
    chunkTypeCorrect,
    sourceRelevant,
    noDataCorrect,
    retrievalUnder500ms: retrievalMs <= 500,
    topSources,
  };
}

function matchesAny<T extends Record<string, unknown>>(
  rows: T[],
  expected: string[] | undefined,
  key: keyof T,
): boolean {
  if (!expected?.length) return true;
  return rows.some((row) => expected.includes(String(row[key])));
}

function countPass<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): number {
  return rows.filter((row) => Boolean(row[key])).length;
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function elapsedSince(start: number): number {
  return Math.round(performance.now() - start);
}

function parseEvalLimit(value: string): number | undefined {
  if (value.toLowerCase() === "all") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveReferenceNow(dataset: EvaluationDataset): Date {
  const configured = process.env.MEMORY_EVAL_NOW ?? dataset.referenceNow;
  if (configured) {
    const parsed = new Date(configured);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }

  return new Date();
}

function failIfRequested(
  summary: { total: number; sourceRelevant: number; noDataCorrect: number; errors: number },
  results: RetrievalEvalResult[],
): void {
  if (process.env.MEMORY_EVAL_FAIL_ON_ERROR !== "1") return;

  const noDataTotal = results.filter((row) => row.noDataCorrect !== null).length;
  const failed = results.filter((row) => !row.sourceRelevant || row.error);
  const noDataFailed = results.filter((row) => row.noDataCorrect === false);

  if (
    summary.errors > 0 ||
    summary.sourceRelevant < summary.total ||
    summary.noDataCorrect < noDataTotal
  ) {
    console.error(
      `Retrieval evaluation failed: ${failed.length} source failures, ${noDataFailed.length} no-data failures, ${summary.errors} errors.`,
    );
    process.exitCode = 1;
  }
}
