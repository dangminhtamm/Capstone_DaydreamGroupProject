import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  answerFromChunks,
  answerMemory,
  answerSingleDayFastPath,
  inferRetrievalFilters,
} from "../src/answer-memory.ts";
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
  deepResult.answerMode === "tuturuuu",
  `Auto summarize question should produce a Deep answer, got ${deepResult.answerMode}.`,
);

const regressionChecks = [
  runSpecificDateRegression(),
  await runMonthlySummaryRegression(),
  await runGmailSourceRegression(),
  await runEmbeddingFailureRegression(),
  await runVietnameseDeepValidationRegression(),
];

console.log(JSON.stringify({
  status: "ok",
  checks: {
    datasetQuestions: questions.length,
    latestReportValid: latestReport.summary.validRun,
    fastRouting: fastResult.answerMode,
    deepRouting: deepResult.answerMode,
    regressionCases: regressionChecks.map((check) => check.name),
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

function runSpecificDateRegression(): { name: string } {
  const dateQuestions = [
    { question: "what did i do on 9/7", lang: "en" as const },
    { question: "ngày chín tháng bảy tôi làm gì", lang: "vi" as const },
    { question: "What did I do on July ninth?", lang: "en" as const },
  ];
  const now = new Date("2026-07-26T12:00:00.000Z");
  const july9Diary = makeHit({
    id: "eval-july-9-diary",
    sourceId: "diary-2026-07-09",
    text: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối. Thời tiết hôm nay không đẹp, trời mưa nguyên ngày.",
    evidence: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
    occurredAt: new Date("2026-07-09T12:00:00.000Z"),
    similarity: 0.91,
    vectorSimilarity: 0.86,
    lexicalScore: 1,
    retrievalMode: "hybrid",
  });

  for (const { question, lang } of dateQuestions) {
    const filters = inferRetrievalFilters(question, now, "UTC");
    assert(
      filters.startDate?.toISOString() === "2026-07-09T00:00:00.000Z",
      `Specific-date eval should parse ${question} as July 9, 2026.`,
    );
    assert(
      filters.endDate?.toISOString() === "2026-07-09T23:59:59.999Z",
      `Specific-date eval should end ${question} on July 9, 2026.`,
    );

    const result = answerSingleDayFastPath(
      question,
      [july9Diary],
      filters,
      lang,
      0.62,
      "UTC",
    );
    assert(result, `Specific-date eval should answer ${question} without generation.`);
    assert(
      result.answerMode === "fast_path",
      `Specific-date eval should use Fast path, got ${result.answerMode}.`,
    );
    assert(
      result.citations[0]?.sourceId === "diary-2026-07-09",
      `Specific-date eval should cite the July 9 diary for ${question}.`,
    );
    assert(
      /ngủ từ sáng tới tối|sleep/i.test(result.answer),
      `Specific-date eval answer should mention the July 9 diary fact for ${question}.`,
    );
  }

  return { name: "specific-date-variants" };
}

async function runMonthlySummaryRegression(): Promise<{ name: string }> {
  const question = "tóm tắt tháng 7 tôi làm gì?";
  const filters = inferRetrievalFilters(
    question,
    new Date("2026-08-06T12:00:00.000Z"),
    "UTC",
  );
  assert(
    filters.startDate?.toISOString() === "2026-07-01T00:00:00.000Z",
    "Monthly eval should parse the start of July 2026.",
  );
  assert(
    filters.endDate?.toISOString() === "2026-07-31T23:59:59.999Z",
    "Monthly eval should parse the end of July 2026.",
  );

  const result = await answerFromChunks(
    question,
    [
      makeHit({
        id: "monthly-summary",
        sourceType: "summary",
        sourceId: "summary-july",
        chunkType: "reflection",
        text: "Monthly Retrospective: July 2026. The insights are primarily derived from weekly summaries.",
        evidence: "Monthly Retrospective: July 2026. The insights are primarily derived from weekly summaries.",
        similarity: 0.96,
        vectorSimilarity: 0.96,
        occurredAt: new Date("2026-07-01T02:00:00.000Z"),
      }),
      makeHit({
        id: "july-capstone-paper",
        sourceId: "diary-2026-07-01",
        text: "I stayed home today to edit my capstone paper.",
        evidence: "I stayed home today to edit my capstone paper.",
        similarity: 0.91,
        vectorSimilarity: 0.91,
        lexicalScore: 1,
        occurredAt: new Date("2026-07-01T02:00:00.000Z"),
      }),
      makeHit({
        id: "july-sleep",
        sourceId: "diary-2026-07-09",
        text: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
        evidence: "Hôm nay tôi không làm gì, chỉ nằm ngủ từ sáng tới tối.",
        similarity: 0.89,
        vectorSimilarity: 0.89,
        lexicalScore: 1,
        occurredAt: new Date("2026-07-09T02:00:00.000Z"),
      }),
      makeHit({
        id: "july-cafe-project",
        sourceId: "diary-2026-07-14",
        text: "Tôi chỉ đi ra ngoài ngồi Café và cố gắng hoàn thành project.",
        evidence: "Tôi chỉ đi ra ngoài ngồi Café và cố gắng hoàn thành project.",
        similarity: 0.88,
        vectorSimilarity: 0.88,
        lexicalScore: 1,
        occurredAt: new Date("2026-07-14T02:00:00.000Z"),
      }),
    ],
    {
      responseLanguage: "vi",
      minTopSimilarity: 0.62,
      timeZone: "UTC",
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Trong tháng 8, Martin làm deployment với Zoe.",
          confidence: "medium",
          citations: [],
        }),
        tokenUsage: {
          promptTokens: 120,
          completionTokens: 18,
          totalTokens: 138,
          model: "ci-smoke-generator",
        },
      }),
    },
  );

  assert(
    result.answerMode === "extractive_fallback",
    `Monthly eval should recover to evidence fallback, got ${result.answerMode}.`,
  );
  assert(
    result.citations.filter((citation) => citation.sourceType === "diary").length >= 3,
    "Monthly eval should keep July diary entries as primary evidence.",
  );
  assert(
    /capstone paper|ngủ từ sáng tới tối|Café/i.test(result.answer),
    "Monthly eval answer should include concrete July diary evidence.",
  );
  assert(
    !/Monthly Retrospective|Weekly Review/i.test(result.answer),
    "Monthly eval should not expose raw generated summary boilerplate as the answer.",
  );

  return { name: "monthly-july-summary" };
}

async function runGmailSourceRegression(): Promise<{ name: string }> {
  const result = await answerFromChunks(
    "What feedback did Linh send?",
    [
      makeHit({
        id: "linh-gmail-feedback",
        sourceType: "gmail",
        sourceId: "gmail-linh-feedback",
        chunkType: "general_note",
        text: "Gmail email from Linh. Subject: Citation feedback. Linh sent feedback that citation cards must be easy to see so evaluators can trust the answer.",
        evidence: "Linh sent feedback that citation cards must be easy to see so evaluators can trust the answer.",
        metadata: { sourceTitle: "Citation feedback from Linh" },
        occurredAt: new Date("2026-07-06T09:00:00.000Z"),
        similarity: 0.91,
        vectorSimilarity: 0.86,
        lexicalScore: 1,
        retrievalMode: "hybrid",
      }),
      makeHit({
        id: "gmail-future-work-diary",
        sourceId: "diary-gmail-future-work",
        text: "We kept Gmail as future work until the core demo was stable.",
        evidence: "kept Gmail as future work",
        occurredAt: new Date("2026-07-14T09:00:00.000Z"),
        similarity: 0.86,
        vectorSimilarity: 0.82,
        lexicalScore: 0.5,
      }),
    ],
    {
      answerStrategy: "auto",
      responseLanguage: "en",
      minTopSimilarity: 0.62,
    },
  );

  assert(
    result.citations[0]?.sourceType === "gmail",
    "Gmail eval should cite the synced Gmail source first.",
  );
  assert(
    result.citations[0]?.sourceId === "gmail-linh-feedback",
    "Gmail eval should preserve the Gmail source id for source cards.",
  );
  assert(
    /citation cards|evaluators/i.test(result.answer),
    "Gmail eval should answer from the email feedback, not the diary future-work note.",
  );

  return { name: "gmail-source-aware-retrieval" };
}

async function runEmbeddingFailureRegression(): Promise<{ name: string }> {
  const fakeDb = {
    $queryRaw: async () => [
      makeHit({
        id: "lexical-gmail-feedback",
        sourceType: "gmail",
        sourceId: "gmail-lexical-feedback",
        chunkType: "general_note",
        text: "Gmail email from Linh. Linh sent feedback that source cards must show citations clearly.",
        evidence: "Linh sent feedback that source cards must show citations clearly.",
        metadata: { sourceTitle: "Source card feedback" },
        occurredAt: new Date("2026-07-06T09:00:00.000Z"),
        distance: null,
        vectorSimilarity: 0,
        lexicalScore: 1,
        retrievalMode: "lexical",
        similarity: 0.86,
      }),
    ],
  };
  const embeddingError = Object.assign(new Error("embedding unavailable"), {
    status: 503,
  });
  const result = await answerMemory("What feedback did Linh send?", "eval-user", fakeDb as any, {
    responseLanguage: "en",
    minTopSimilarity: 0.62,
    embeddingProvider: {
      embedQuery: async () => {
        throw embeddingError;
      },
    },
  });

  assert(
    result.debugTrace?.routingTrace?.selectedPath === "embedding_error_fallback",
    "Embedding-failure eval should use lexical fallback.",
  );
  assert(
    result.citations[0]?.retrievalMode === "lexical",
    "Embedding-failure eval should surface lexical citations.",
  );
  assert(
    result.answerMode === "fast_path",
    `Embedding-failure eval should still answer when lexical evidence is strong, got ${result.answerMode}.`,
  );

  return { name: "embedding-error-lexical-fallback" };
}

async function runVietnameseDeepValidationRegression(): Promise<{ name: string }> {
  const result = await answerFromChunks(
    "Phân tích feedback Linh gửi về citation cards.",
    [
      makeHit({
        id: "vi-deep-linh-feedback",
        sourceType: "gmail",
        sourceId: "gmail-linh-citations",
        chunkType: "general_note",
        text: "Linh sent feedback that citation cards must be easy to see so evaluators can trust the AI answer.",
        evidence: "citation cards must be easy to see so evaluators can trust the AI answer",
        metadata: { sourceTitle: "Citation feedback from Linh" },
        occurredAt: new Date("2026-07-06T09:00:00.000Z"),
        similarity: 0.91,
        vectorSimilarity: 0.88,
        lexicalScore: 1,
      }),
    ],
    {
      answerStrategy: "deep",
      responseLanguage: "vi",
      minTopSimilarity: 0.62,
      generateAnswer: async (options: any) => ({
        data: options.validator.parse({
          answer: "Linh góp ý rằng citation cards phải dễ thấy để evaluator có thể tin câu trả lời AI.",
          confidence: "high",
          citations: [
            {
              marker: "S1",
              claim: "citation cards must be easy to see so evaluators can trust the AI answer",
            },
          ],
        }),
        tokenUsage: {
          promptTokens: 72,
          completionTokens: 28,
          totalTokens: 100,
          model: "ci-smoke-generator",
        },
      }),
    },
  );

  assert(
    result.answerMode === "tuturuuu",
    `Vietnamese Deep eval should pass validation without fallback, got ${result.answerMode}.`,
  );
  assert(
    result.citations[0]?.sourceType === "gmail",
    "Vietnamese Deep eval should preserve source-card citation metadata.",
  );
  assert(
    result.analytics?.tokenUsage.totalTokens === 100,
    "Vietnamese Deep eval should report generation token usage.",
  );

  return { name: "vietnamese-deep-validation" };
}

function makeHit(overrides: Partial<MemorySearchHit>): MemorySearchHit {
  return {
    id: "eval-smoke-hit",
    sourceType: "diary",
    sourceId: "eval-smoke-source",
    chunkType: "general",
    text: "Evaluation memory text",
    evidence: null,
    metadata: {},
    occurredAt: new Date("2026-07-09T09:00:00.000Z"),
    distance: 0.08,
    vectorSimilarity: 0.92,
    lexicalScore: 1,
    retrievalMode: "hybrid",
    similarity: 0.92,
    ...overrides,
  };
}
