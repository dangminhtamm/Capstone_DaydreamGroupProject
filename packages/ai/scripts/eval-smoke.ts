import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answerFromChunks } from "../src/answer-memory.ts";
import type { MemorySearchHit } from "../src/retrieval.ts";

type EvaluationDataset = {
  name?: string;
  questions?: Array<{ id?: string; category?: string; question?: string }>;
};

type LatestReport = {
  summary?: {
    validRun?: boolean;
    quality?: {
      recallAt5?: number;
      citationPrecision?: number;
      summaryCoverage?: number;
    };
    latency?: {
      retrievalP95Ms?: number;
    };
  };
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(scriptDir, "../evaluation/memory-evaluation.dataset.json");
const latestReportPath = resolve(
  scriptDir,
  "../evaluation/reports/memory-evaluation-latest-valid.json",
);

const dataset = readJson<EvaluationDataset>(datasetPath);
const latestReport = readJson<LatestReport>(latestReportPath);

const questions = dataset.questions ?? [];
assert(questions.length >= 10, "Evaluation dataset must contain at least 10 questions.");
for (const category of ["calendar", "feedback", "summary"]) {
  assert(
    questions.some((question) => question.category === category),
    `Evaluation dataset must include a ${category} question.`,
  );
}

assert(
  latestReport.summary?.validRun === true,
  "Latest memory evaluation report must be a valid run.",
);
assertNumber(latestReport.summary?.quality?.recallAt5, "quality.recallAt5");
assertNumber(
  latestReport.summary?.quality?.citationPrecision,
  "quality.citationPrecision",
);
assertNumber(
  latestReport.summary?.quality?.summaryCoverage,
  "quality.summaryCoverage",
);
assertNumber(
  latestReport.summary?.latency?.retrievalP95Ms,
  "latency.retrievalP95Ms",
);

const smokeChunks: MemorySearchHit[] = [
  {
    id: "ci-smoke-calendar-api-check",
    sourceType: "calendar",
    sourceId: "eval-calendar-api-check",
    chunkType: "event",
    text: "Backend API Check was scheduled on May 12, 2026 at 08:00 UTC. Quan reviews diary CRUD, upload attachment response, auth ownership, and summary API contract.",
    evidence: null,
    metadata: {
      sourceTitle: "Backend API Check",
    },
    occurredAt: new Date("2026-05-12T08:00:00.000Z"),
    distance: 0.08,
    vectorSimilarity: 0.92,
    lexicalScore: 1,
    retrievalMode: "hybrid",
    similarity: 0.93,
  },
];

const fastResult = await answerFromChunks(
  "When was the Backend API Check scheduled?",
  smokeChunks,
  {
    answerStrategy: "auto",
    minTopSimilarity: 0.5,
    responseLanguage: "en",
  },
);
assert(
  fastResult.answerMode === "fast_path",
  `Auto fact/date question should use Fast, got ${fastResult.answerMode}.`,
);
assert(
  fastResult.citations.length > 0,
  "Fast smoke answer should preserve at least one citation.",
);

let deepGeneratorCalled = false;
const deepResult = await answerFromChunks(
  "Summarize the latest calendar memory.",
  smokeChunks,
  {
    answerStrategy: "auto",
    minTopSimilarity: 0.5,
    responseLanguage: "en",
    generateAnswer: async () => {
      deepGeneratorCalled = true;
      return {
        data: {
          answer:
            "The latest calendar memory is the Backend API Check scheduled on May 12, 2026.",
          confidence: "medium",
          citations: [
            {
              marker: "S1",
              claim: "Backend API Check was scheduled on May 12, 2026",
            },
          ],
        },
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 18,
          totalTokens: 38,
          model: "ci-smoke-generator",
        },
      };
    },
  },
);
assert(deepGeneratorCalled, "Auto summarize question should call the Deep generator.");
assert(
  deepResult.answerMode === "gemini",
  `Auto summarize question should produce a Deep answer, got ${deepResult.answerMode}.`,
);

console.log(JSON.stringify({
  status: "ok",
  checks: {
    datasetQuestions: questions.length,
    latestReportValid: latestReport.summary.validRun,
    fastRouting: fastResult.answerMode,
    deepRouting: deepResult.answerMode,
  },
}, null, 2));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[memory-eval-smoke] ${message}`);
  }
}

function assertNumber(value: unknown, label: string) {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number.`);
}
