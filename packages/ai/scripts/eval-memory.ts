import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiGatewayEnvHint, hasAiGatewayKey, loadLocalEnv } from "./env.ts";
import { resolveEvaluationUserId } from "./eval-user.ts";

loadLocalEnv();

type EvaluationQuestion = {
  id: string;
  category: string;
  question: string;
  expectedKeywords: string[];
  expectedSourceTypes?: string[];
  expectedChunkTypes?: string[];
  expectedSourceIds?: string[];
  expectedNoSources?: boolean;
  acceptableConfidence?: Array<"high" | "medium" | "low">;
};

type EvaluationDataset = {
  questions: EvaluationQuestion[];
};

type EvaluationResult = {
  id: string;
  category: string;
  question: string;
  correctAnswer: boolean;
  hasCitation: boolean;
  sourceRelevant: boolean;
  confidenceOk: boolean;
  confidence: "high" | "medium" | "low";
  keywordHits: string[];
  expectedKeywords: string[];
  sourceCount: number;
  modelError?: {
    kind: string;
    status?: number;
    message: string;
  };
};

const datasetPath =
  process.env.MEMORY_EVAL_DATASET ??
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../evaluation/memory-evaluation.dataset.json",
  );
const evalLimit = process.env.MEMORY_EVAL_LIMIT
  ? parseEvalLimit(process.env.MEMORY_EVAL_LIMIT)
  : undefined;
const evalDelayMs = Number(process.env.MEMORY_EVAL_DELAY_MS ?? 13_000);

if (!hasAiGatewayKey()) {
  console.error(aiGatewayEnvHint("running answer evaluation"));
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running answer evaluation.");
  process.exitCode = 1;
} else {
  const [db, { answerMemory }] = await Promise.all([
    import("@second-brain/db"),
    import("../src/index.ts"),
  ]);
  const prisma = db.createPrismaClient();
  const userId = await resolveEvaluationUserId(prisma as any, "evaluate");
  const dataset = JSON.parse(
    readFileSync(datasetPath, "utf8"),
  ) as EvaluationDataset;

  try {
    if (userId) {
      const results: EvaluationResult[] = [];
      const questions = Number.isFinite(evalLimit)
        ? dataset.questions.slice(0, Math.max(0, evalLimit ?? 0))
        : dataset.questions;

      for (const item of questions) {
        try {
          const result = await answerMemory(item.question, userId, prisma);
          const answerText = normalize(result.answer);
          const citationText = normalize(
            result.citations.map((citation) => citation.quote).join(" "),
          );
          const combinedText = `${answerText} ${citationText}`;

          const keywordHits = item.expectedKeywords.filter((keyword) =>
            combinedText.includes(normalize(keyword)),
          );
          const sourceRelevant = hasRelevantSource(item, result.citations);
          const hasCitation = item.expectedNoSources
            ? result.citations.length === 0
            : result.citations.length > 0;
          const confidenceOk = (
            item.acceptableConfidence ?? ["high", "medium"]
          ).includes(result.confidence);

          results.push({
            id: item.id,
            category: item.category,
            question: item.question,
            correctAnswer: keywordHits.length === item.expectedKeywords.length,
            hasCitation,
            sourceRelevant,
            confidenceOk,
            confidence: result.confidence,
            keywordHits,
            expectedKeywords: item.expectedKeywords,
            sourceCount: result.citations.length,
            modelError: result.modelError,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            id: item.id,
            category: item.category,
            question: item.question,
            correctAnswer: false,
            hasCitation: Boolean(item.expectedNoSources),
            sourceRelevant: Boolean(item.expectedNoSources),
            confidenceOk: (item.acceptableConfidence ?? ["low"]).includes("low"),
            confidence: "low",
            keywordHits: [],
            expectedKeywords: item.expectedKeywords,
            sourceCount: 0,
            modelError: {
              kind: "script_error",
              message: message.replace(/\s+/g, " ").slice(0, 240),
            },
          });
        }

        if (evalDelayMs > 0 && item !== questions.at(-1)) {
          await sleep(evalDelayMs);
        }
      }

      const summary = {
        mode: "answer",
        total: results.length,
        correctAnswer: countPass(results, "correctAnswer"),
        hasCitation: countPass(results, "hasCitation"),
        sourceRelevant: countPass(results, "sourceRelevant"),
        confidenceOk: countPass(results, "confidenceOk"),
        modelErrors: countModelErrors(results),
        delayMs: evalDelayMs,
        limit: evalLimit ?? null,
        note:
          "Answer evaluation calls Tuturuuu answer generation. Use eval:retrieval to evaluate source matching without answer generation.",
      };

      console.log(JSON.stringify({ summary, results }, null, 2));
      failIfRequested(summary, results);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function hasRelevantSource(
  item: EvaluationQuestion,
  citations: Array<{
    sourceType: string;
    sourceId: string;
    chunkType: string;
  }>,
): boolean {
  if (item.expectedNoSources) {
    return citations.length === 0;
  }

  if (
    !item.expectedSourceTypes?.length &&
    !item.expectedChunkTypes?.length &&
    !item.expectedSourceIds?.length
  ) {
    return citations.length > 0;
  }

  return citations.some((citation) => {
    const sourceTypeOk =
      !item.expectedSourceTypes?.length ||
      item.expectedSourceTypes.includes(citation.sourceType);
    const chunkTypeOk =
      !item.expectedChunkTypes?.length ||
      item.expectedChunkTypes.includes(citation.chunkType);
    const sourceIdOk =
      !item.expectedSourceIds?.length ||
      item.expectedSourceIds.includes(citation.sourceId);

    return sourceTypeOk && chunkTypeOk && sourceIdOk;
  });
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFC");
}

function countPass<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): number {
  return rows.filter((row) => Boolean(row[key])).length;
}

function countModelErrors(rows: EvaluationResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.modelError) continue;
    counts[row.modelError.kind] = (counts[row.modelError.kind] ?? 0) + 1;
  }
  return counts;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEvalLimit(value: string): number | undefined {
  if (value.toLowerCase() === "all") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function failIfRequested(
  summary: {
    total: number;
    correctAnswer: number;
    hasCitation: number;
    sourceRelevant: number;
    confidenceOk: number;
    modelErrors: Record<string, number>;
  },
  results: EvaluationResult[],
): void {
  if (process.env.MEMORY_EVAL_FAIL_ON_ERROR !== "1") return;

  const modelErrorCount = Object.values(summary.modelErrors).reduce(
    (sum, value) => sum + value,
    0,
  );
  const failed = results.filter(
    (row) =>
      !row.correctAnswer ||
      !row.hasCitation ||
      !row.sourceRelevant ||
      !row.confidenceOk ||
      row.modelError,
  );

  if (
    modelErrorCount > 0 ||
    summary.correctAnswer < summary.total ||
    summary.hasCitation < summary.total ||
    summary.sourceRelevant < summary.total ||
    summary.confidenceOk < summary.total
  ) {
    console.error(
      `Answer evaluation failed: ${failed.length} failed cases, ${modelErrorCount} model/script errors.`,
    );
    process.exitCode = 1;
  }
}
