import { performance } from "node:perf_hooks";
import { aiGatewayEnvHint, hasAiGatewayKey, loadLocalEnv } from "./env.ts";
import { resolveEvaluationUserId } from "./eval-user.ts";

loadLocalEnv();

type BenchmarkRow = {
  question: string;
  embeddingMs: number;
  retrievalMs: number;
  totalRecallMs: number;
  answerMs: number | null;
  totalMs: number;
  sourceCount: number;
  memoryRecallTargetMs: number;
  memoryRecallPass: boolean;
  answerGenerationIncluded: boolean;
  note: string;
};

const DEFAULT_QUESTIONS = [
  "What did I work on recently?",
];

const questions = getQuestions();
const includeAnswer = parseBoolean(process.env.MEMORY_BENCHMARK_INCLUDE_ANSWER);
const delayMs = Number(process.env.MEMORY_BENCHMARK_DELAY_MS ?? 0);

if (!hasAiGatewayKey()) {
  console.error(aiGatewayEnvHint("running the memory benchmark"));
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running the memory benchmark.");
  process.exitCode = 1;
} else {
  const [
    db,
    {
      answerFromChunks,
      createDefaultEmbeddingProvider,
      retrieveMemoryWithEmbedding,
    },
  ] = await Promise.all([
    import("@second-brain/db"),
    import("../src/index.ts"),
  ]);
  const prisma = db.prisma ?? db.createPrismaClient();

  const userId = await resolveEvaluationUserId(prisma as any, "benchmark");
  const embedder = createDefaultEmbeddingProvider();
  const rows: BenchmarkRow[] = [];

  try {
    if (userId) {
      for (const question of questions) {
        const totalStart = performance.now();

        const embeddingStart = performance.now();
        const embedding = await embedder.embedQuery(question);
        const embeddingMs = elapsedSince(embeddingStart);

        const retrievalStart = performance.now();
        const chunks = await retrieveMemoryWithEmbedding(
          question,
          userId,
          prisma,
          embedding,
          {
            limit: Number(process.env.MEMORY_BENCHMARK_LIMIT ?? 8),
            maxDistance: process.env.MEMORY_MAX_DISTANCE
              ? Number(process.env.MEMORY_MAX_DISTANCE)
              : undefined,
          },
        );
        const retrievalMs = elapsedSince(retrievalStart);

        const totalRecallMs = embeddingMs + retrievalMs;
        const answerStart = performance.now();
        const answer = includeAnswer ? await answerFromChunks(question, chunks) : null;
        const answerMs = answer ? elapsedSince(answerStart) : null;

        rows.push({
          question,
          embeddingMs,
          retrievalMs,
          totalRecallMs,
          answerMs,
          totalMs: elapsedSince(totalStart),
          sourceCount: answer?.citations.length ?? chunks.length,
          memoryRecallTargetMs: 500,
          memoryRecallPass: retrievalMs <= 500,
          answerGenerationIncluded: includeAnswer,
          note: includeAnswer
            ? "memoryRecallPass only evaluates DB retrieval after query embedding; totalMs includes Gemini embedding + answer generation."
            : "Recall-only benchmark: totalRecallMs = embeddingMs + retrievalMs. Set MEMORY_BENCHMARK_INCLUDE_ANSWER=true to include answer generation.",
        });

        if (delayMs > 0 && question !== questions.at(-1)) {
          await sleep(delayMs);
        }
      }

      console.log(JSON.stringify(rows.length === 1 ? rows[0] : rows, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

function getQuestions(): string[] {
  const cliQuestion = process.argv.slice(2).join(" ").trim();
  if (cliQuestion) return [cliQuestion];

  const envQuestions = process.env.MEMORY_BENCHMARK_QUESTIONS?.trim();
  if (envQuestions) {
    return envQuestions
      .split("|")
      .map((question) => question.trim())
      .filter(Boolean);
  }

  return DEFAULT_QUESTIONS;
}

function elapsedSince(start: number): number {
  return Math.round(performance.now() - start);
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
