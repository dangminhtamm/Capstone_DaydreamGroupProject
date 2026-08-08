import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { aiGatewayEnvHint, hasAiGatewayKey, loadLocalEnv } from "./env.ts";
import type { AnswerStrategy } from "../src/answer-memory-types.ts";

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

type SummaryCoverageTarget = {
  id: string;
  summaryType: string;
  periodStart: string;
  periodEnd: string;
  expectedKeyEvents: Array<{
    label: string;
    anyOf: string[];
  }>;
};

type EvaluationDataset = {
  name?: string;
  description?: string;
  questions: EvaluationQuestion[];
  summaryCoverage?: SummaryCoverageTarget[];
};

type AiModule = typeof import("../src/index.ts");

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

type RetrievalReportRow = {
  id: string;
  category: string;
  question: string;
  embeddingMs: number;
  retrievalMs: number;
  totalRecallMs: number;
  sourceCount: number;
  topSimilarity: number;
  recallAt5: boolean;
  retrievalUnder500ms: boolean;
  topSources: TopSource[];
  error?: string;
};

type CitationReportRow = {
  id: string;
  category: string;
  question: string;
  answerMs: number;
  answerMode: string;
  confidence: "high" | "medium" | "low";
  keywordCoverage: number;
  keywordHits: string[];
  citationCount: number;
  relevantCitationCount: number;
  citationPrecision: number;
  sourceRelevant: boolean;
  confidenceOk: boolean;
  modelError?: {
    kind: string;
    status?: number;
    message: string;
  };
  error?: string;
};

type SummaryCoverageRow = {
  id: string;
  summaryType: string;
  periodStart: string;
  periodEnd: string;
  summaryCount: number;
  expectedKeyEventCount: number;
  matchedKeyEventCount: number;
  coverage: number;
  matched: Array<{ label: string; matchedBy: string[] }>;
  missed: Array<{ label: string; expectedAnyOf: string[] }>;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const datasetPath =
  process.env.MEMORY_EVAL_DATASET ??
  resolve(scriptDir, "../evaluation/memory-evaluation.dataset.json");
const outputDir =
  process.env.MEMORY_REPORT_OUTPUT_DIR ??
  resolve(scriptDir, "../evaluation/reports");
const answerStrategy = parseAnswerStrategy(
  process.env.MEMORY_REPORT_ANSWER_STRATEGY ?? "fast",
);
const retrievalLimit = Number(process.env.MEMORY_REPORT_RETRIEVAL_LIMIT ?? 8);
const questionLimit = process.env.MEMORY_REPORT_QUESTION_LIMIT
  ? Number(process.env.MEMORY_REPORT_QUESTION_LIMIT)
  : undefined;
const reportDelayMs = Number(process.env.MEMORY_REPORT_DELAY_MS ?? 0);
const noDataSimilarityThreshold = Number(
  process.env.MEMORY_RETRIEVAL_NO_DATA_MAX_SIMILARITY ?? 0.55,
);
const failOnThreshold = process.env.MEMORY_REPORT_FAIL_ON_THRESHOLD === "1";
const writeInvalidReports = process.env.MEMORY_REPORT_WRITE_INVALID === "1";

let answerMemory: AiModule["answerMemory"];
let inferRetrievalFilters: AiModule["inferRetrievalFilters"];
let retrieveMemoryWithEmbedding: AiModule["retrieveMemoryWithEmbedding"];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
} else if (!hasAiGatewayKey()) {
  console.error(aiGatewayEnvHint("running the evaluation report"));
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running the evaluation report.");
  process.exitCode = 1;
} else {
  const [db, ai] = await Promise.all([
    import("@second-brain/db"),
    import("../src/index.ts"),
  ]);
  answerMemory = ai.answerMemory;
  inferRetrievalFilters = ai.inferRetrievalFilters;
  retrieveMemoryWithEmbedding = ai.retrieveMemoryWithEmbedding;

  const prisma = db.prisma ?? db.createPrismaClient();
  const userId = await resolveReportUserId(prisma as any);
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as EvaluationDataset;
  const questions = Number.isFinite(questionLimit)
    ? dataset.questions.slice(0, Math.max(0, questionLimit ?? 0))
    : dataset.questions;
  const embedder = ai.createDefaultEmbeddingProvider();

  try {
    if (userId) {
      await assertEvaluationRuntime(embedder);

      const retrievalRows: RetrievalReportRow[] = [];
      const citationRows: CitationReportRow[] = [];

      for (const question of questions) {
        retrievalRows.push(
          await evaluateRetrieval(question, userId, prisma as any, embedder),
        );
        citationRows.push(
          await evaluateAnswerCitations(question, userId, prisma as any),
        );

        if (reportDelayMs > 0 && question !== questions.at(-1)) {
          await sleep(reportDelayMs);
        }
      }

      const summaryCoverageRows = await evaluateSummaryCoverage(
        dataset.summaryCoverage ?? [],
        userId,
        prisma as any,
      );

      const report = buildReport({
        dataset,
        userId,
        retrievalRows,
        citationRows,
        summaryCoverageRows,
      });

      const writtenFiles = writeReportArtifacts(report);

      console.log(JSON.stringify({
        summary: report.summary,
        files: writtenFiles,
      }, null, 2));

      if (failOnThreshold && !report.summary.overallPass) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(toShortError(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function assertEvaluationRuntime(
  embedder: { embedQuery: (text: string) => Promise<number[]> },
): Promise<void> {
  try {
    const embedding = await embedder.embedQuery("second brain evaluation credential preflight");
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Embedding preflight returned an empty vector.");
    }
  } catch (error) {
    throw new Error(
      [
        "Evaluation report aborted before writing artifacts because Gemini embeddings are unavailable.",
        "Fix TUTURUUU_AI_API_KEY, TUTURUUU_EMBEDDING_MODEL, or Tuturuuu quota, then rerun `pnpm --filter @second-brain/ai eval:report`.",
        `Preflight error: ${toShortError(error)}`,
      ].join(" "),
    );
  }
}

async function evaluateRetrieval(
  item: EvaluationQuestion,
  userId: string,
  prisma: any,
  embedder: { embedQuery: (text: string) => Promise<number[]> },
): Promise<RetrievalReportRow> {
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
        ...inferRetrievalFilters(item.question),
        limit: retrievalLimit,
        maxDistance: process.env.MEMORY_MAX_DISTANCE
          ? Number(process.env.MEMORY_MAX_DISTANCE)
          : undefined,
      },
    );
    const retrievalMs = elapsedSince(retrievalStart);
    const topSources = chunks.slice(0, 5).map((chunk: any) => ({
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      chunkType: chunk.chunkType,
      similarity: Number(chunk.similarity ?? 0),
      vectorSimilarity: Number(chunk.vectorSimilarity ?? 0),
      lexicalScore: Number(chunk.lexicalScore ?? 0),
      retrievalMode: chunk.retrievalMode ?? "unknown",
      occurredAt:
        chunk.occurredAt instanceof Date
          ? chunk.occurredAt.toISOString()
          : new Date(chunk.occurredAt).toISOString(),
    }));

    return {
      id: item.id,
      category: item.category,
      question: item.question,
      embeddingMs,
      retrievalMs,
      totalRecallMs: embeddingMs + retrievalMs,
      sourceCount: chunks.length,
      topSimilarity: Number(chunks[0]?.similarity ?? 0),
      recallAt5: hasExpectedSourceInTopK(item, topSources),
      retrievalUnder500ms: retrievalMs <= 500,
      topSources,
    };
  } catch (error) {
    return {
      id: item.id,
      category: item.category,
      question: item.question,
      embeddingMs: 0,
      retrievalMs: 0,
      totalRecallMs: 0,
      sourceCount: 0,
      topSimilarity: 0,
      recallAt5: false,
      retrievalUnder500ms: false,
      topSources: [],
      error: toShortError(error),
    };
  }
}

async function evaluateAnswerCitations(
  item: EvaluationQuestion,
  userId: string,
  prisma: any,
): Promise<CitationReportRow> {
  const started = performance.now();
  try {
    const result = await answerMemory(item.question, userId, prisma, {
      limit: retrievalLimit,
      answerStrategy,
    });
    const citations = result.citations ?? [];
    const relevantCitationCount = item.expectedNoSources
      ? citations.length === 0
        ? 0
        : 0
      : citations.filter((citation: any) => citationMatchesExpectation(item, citation)).length;
    const citationPrecision = item.expectedNoSources
      ? citations.length === 0
        ? 1
        : 0
      : citations.length
        ? relevantCitationCount / citations.length
        : 0;
    const combinedText = normalizeText(
      `${result.answer} ${citations.map((citation: any) => citation.quote).join(" ")}`,
    );
    const keywordHits = item.expectedKeywords.filter((keyword) =>
      combinedText.includes(normalizeText(keyword)),
    );

    return {
      id: item.id,
      category: item.category,
      question: item.question,
      answerMs: elapsedSince(started),
      answerMode: result.answerMode,
      confidence: result.confidence,
      keywordCoverage: item.expectedKeywords.length
        ? keywordHits.length / item.expectedKeywords.length
        : 1,
      keywordHits,
      citationCount: citations.length,
      relevantCitationCount,
      citationPrecision,
      sourceRelevant: item.expectedNoSources
        ? citations.length === 0
        : citations.some((citation: any) => citationMatchesExpectation(item, citation)),
      confidenceOk: (item.acceptableConfidence ?? ["high", "medium"]).includes(result.confidence),
      modelError: result.modelError,
    };
  } catch (error) {
    return {
      id: item.id,
      category: item.category,
      question: item.question,
      answerMs: elapsedSince(started),
      answerMode: "error",
      confidence: "low",
      keywordCoverage: 0,
      keywordHits: [],
      citationCount: 0,
      relevantCitationCount: 0,
      citationPrecision: item.expectedNoSources ? 1 : 0,
      sourceRelevant: Boolean(item.expectedNoSources),
      confidenceOk: (item.acceptableConfidence ?? ["low"]).includes("low"),
      error: toShortError(error),
    };
  }
}

async function evaluateSummaryCoverage(
  targets: SummaryCoverageTarget[],
  userId: string,
  prisma: any,
): Promise<SummaryCoverageRow[]> {
  const rows: SummaryCoverageRow[] = [];
  for (const target of targets) {
    const periodStart = new Date(target.periodStart);
    const periodEnd = new Date(target.periodEnd);
    const summaries = await prisma.summary.findMany({
      where: {
        user_id: userId,
        summary_type: target.summaryType,
        period_start: { lte: periodEnd },
        period_end: { gte: periodStart },
      },
      orderBy: { period_start: "asc" },
      select: {
        content: true,
      },
    });
    const combined = normalizeText(summaries.map((summary: any) => summary.content).join("\n\n"));
    const matched: SummaryCoverageRow["matched"] = [];
    const missed: SummaryCoverageRow["missed"] = [];

    for (const event of target.expectedKeyEvents) {
      const matchedBy = event.anyOf.filter((phrase) =>
        combined.includes(normalizeText(phrase)),
      );
      if (matchedBy.length) {
        matched.push({ label: event.label, matchedBy });
      } else {
        missed.push({ label: event.label, expectedAnyOf: event.anyOf });
      }
    }

    rows.push({
      id: target.id,
      summaryType: target.summaryType,
      periodStart: target.periodStart,
      periodEnd: target.periodEnd,
      summaryCount: summaries.length,
      expectedKeyEventCount: target.expectedKeyEvents.length,
      matchedKeyEventCount: matched.length,
      coverage: target.expectedKeyEvents.length
        ? matched.length / target.expectedKeyEvents.length
        : 1,
      matched,
      missed,
    });
  }

  return rows;
}

function buildReport(input: {
  dataset: EvaluationDataset;
  userId: string;
  retrievalRows: RetrievalReportRow[];
  citationRows: CitationReportRow[];
  summaryCoverageRows: SummaryCoverageRow[];
}) {
  const successfulRetrievalRows = input.retrievalRows.filter((row) => !row.error);
  const successfulCitationRows = input.citationRows.filter((row) => !row.error);
  const retrievalMs = successfulRetrievalRows.map((row) => row.retrievalMs);
  const totalRecallMs = successfulRetrievalRows.map((row) => row.totalRecallMs);
  const answerMs = successfulCitationRows.map((row) => row.answerMs);
  const nonNoDataCitationRows = input.citationRows.filter((row) => row.category !== "no_data");
  const totalCitations = nonNoDataCitationRows.reduce((sum, row) => sum + row.citationCount, 0);
  const totalRelevantCitations = nonNoDataCitationRows.reduce(
    (sum, row) => sum + row.relevantCitationCount,
    0,
  );
  const summaryCoverage = weightedAverage(
    input.summaryCoverageRows.map((row) => ({
      value: row.coverage,
      weight: row.expectedKeyEventCount,
    })),
  );
  const recallAt5 = ratio(count(input.retrievalRows, (row) => row.recallAt5), input.retrievalRows.length);
  const citationPrecision = totalCitations
    ? totalRelevantCitations / totalCitations
    : average(input.citationRows.map((row) => row.citationPrecision));
  const retrievalErrors = count(input.retrievalRows, (row) => Boolean(row.error));
  const answerErrors = count(input.citationRows, (row) => Boolean(row.error));
  const modelErrors = count(input.citationRows, (row) => Boolean(row.modelError));
  const hasCompleteQuestionSet =
    input.retrievalRows.length > 0 &&
    input.retrievalRows.length === input.citationRows.length;
  const summary = {
    generatedAt: new Date().toISOString(),
    dataset: input.dataset.name ?? "memory evaluation dataset",
    userId: input.userId,
    questionCount: input.retrievalRows.length,
    validRun: hasCompleteQuestionSet && retrievalErrors === 0 && answerErrors === 0 && modelErrors === 0,
    answerStrategy,
    config: {
      retrievalLimit,
      questionLimit: questionLimit ?? null,
      delayMs: reportDelayMs,
      noDataSimilarityThreshold,
      failOnThreshold,
      writeInvalidReports,
    },
    thresholds: {
      retrievalP95Ms: 500,
      recallAt5: 0.9,
      citationPrecision: 0.9,
      summaryCoverage: 0.9,
    },
    latency: {
      retrievalP50Ms: percentile(retrievalMs, 50),
      retrievalP95Ms: percentile(retrievalMs, 95),
      totalRecallP95Ms: percentile(totalRecallMs, 95),
      answerP95Ms: percentile(answerMs, 95),
    },
    quality: {
      recallAt5,
      citationPrecision,
      citationSourceRelevantRate: ratio(
        count(input.citationRows, (row) => row.sourceRelevant),
        input.citationRows.length,
      ),
      answerKeywordCoverage: average(input.citationRows.map((row) => row.keywordCoverage)),
      confidenceOkRate: ratio(
        count(input.citationRows, (row) => row.confidenceOk),
        input.citationRows.length,
      ),
      summaryCoverage,
    },
    failures: {
      retrievalErrors,
      answerErrors,
      modelErrors,
      distinctErrors: distinctRuntimeErrors(input.retrievalRows, input.citationRows),
      missedRecallAt5: input.retrievalRows
        .filter((row) => !row.recallAt5)
        .map((row) => row.id),
      lowCitationPrecision: input.citationRows
        .filter((row) => row.citationPrecision < 0.9)
        .map((row) => row.id),
      summaryCoverageMisses: input.summaryCoverageRows.flatMap((row) =>
        row.missed.map((missed) => `${row.id}: ${missed.label}`),
      ),
    },
    pass: {
      retrievalLatency: retrievalErrors === 0 && percentile(retrievalMs, 95) <= 500,
      recallAt5: retrievalErrors === 0 && recallAt5 >= 0.9,
      citationPrecision: answerErrors === 0 && modelErrors === 0 && citationPrecision >= 0.9,
      summaryCoverage: summaryCoverage >= 0.9,
    },
    overallPass: false,
  };
  summary.overallPass = Object.values(summary.pass).every(Boolean);

  return {
    summary,
    retrieval: input.retrievalRows,
    citations: input.citationRows,
    summaryCoverage: input.summaryCoverageRows,
  };
}

function writeReportArtifacts(report: ReturnType<typeof buildReport>) {
  if (!report.summary.validRun && !writeInvalidReports) {
    console.error(
      [
        "Evaluation report is runtime-invalid, so no report artifact was written.",
        "Set MEMORY_REPORT_WRITE_INVALID=1 only when you explicitly want to archive a failed diagnostic run.",
        `Runtime errors: ${report.summary.failures.distinctErrors.join(" | ") || "unknown"}`,
      ].join(" "),
    );
    process.exitCode = 1;
    return null;
  }

  const targetDir = report.summary.validRun ? outputDir : resolve(outputDir, "invalid");
  mkdirSync(targetDir, { recursive: true });

  const stamp = new Date(report.summary.generatedAt).toISOString().replace(/[:.]/g, "-");
  const json = JSON.stringify(report, null, 2);
  const markdown = renderMarkdown(report);
  const jsonPath = resolve(targetDir, `memory-evaluation-${stamp}.json`);
  const markdownPath = resolve(targetDir, `memory-evaluation-${stamp}.md`);
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);

  const files: {
    json: string;
    markdown: string;
    latestValidJson?: string;
    latestValidMarkdown?: string;
  } = {
    json: jsonPath,
    markdown: markdownPath,
  };

  if (report.summary.validRun) {
    const latestValidJson = resolve(outputDir, "memory-evaluation-latest-valid.json");
    const latestValidMarkdown = resolve(outputDir, "memory-evaluation-latest-valid.md");
    writeFileSync(latestValidJson, json);
    writeFileSync(latestValidMarkdown, markdown);
    files.latestValidJson = latestValidJson;
    files.latestValidMarkdown = latestValidMarkdown;
  }

  return files;
}

function renderMarkdown(report: ReturnType<typeof buildReport>): string {
  const s = report.summary;
  const lines = [
    "# Second Brain Memory Evaluation Report",
    "",
    `Generated at: ${s.generatedAt}`,
    `Dataset: ${s.dataset}`,
    `User ID: ${s.userId}`,
    `Answer strategy: ${s.answerStrategy}`,
    `Retrieval limit: ${s.config.retrievalLimit}`,
    "",
    "## Executive Summary",
    "",
    `- Valid run: ${s.validRun ? "YES" : "NO"}`,
    `- Overall pass: ${s.overallPass ? "PASS" : "NEEDS ATTENTION"}`,
    `- Retrieval latency p95: ${s.latency.retrievalP95Ms}ms / ${s.thresholds.retrievalP95Ms}ms`,
    `- Recall@5: ${formatPercent(s.quality.recallAt5)} / ${formatPercent(s.thresholds.recallAt5)}`,
    `- Citation precision: ${formatPercent(s.quality.citationPrecision)} / ${formatPercent(s.thresholds.citationPrecision)}`,
    `- Summary coverage: ${formatPercent(s.quality.summaryCoverage)} / ${formatPercent(s.thresholds.summaryCoverage)}`,
    "",
    "## Latency",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Retrieval p50 | ${s.latency.retrievalP50Ms}ms |`,
    `| Retrieval p95 | ${s.latency.retrievalP95Ms}ms |`,
    `| Total recall p95 (embedding + retrieval) | ${s.latency.totalRecallP95Ms}ms |`,
    `| Answer p95 | ${s.latency.answerP95Ms}ms |`,
    "",
    "## Quality",
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Recall@5 | ${formatPercent(s.quality.recallAt5)} |`,
    `| Citation precision | ${formatPercent(s.quality.citationPrecision)} |`,
    `| Citation source relevant rate | ${formatPercent(s.quality.citationSourceRelevantRate)} |`,
    `| Answer keyword coverage | ${formatPercent(s.quality.answerKeywordCoverage)} |`,
    `| Confidence OK rate | ${formatPercent(s.quality.confidenceOkRate)} |`,
    `| Summary coverage | ${formatPercent(s.quality.summaryCoverage)} |`,
    "",
    "## Summary Coverage Misses",
    "",
    ...(s.failures.summaryCoverageMisses.length
      ? s.failures.summaryCoverageMisses.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "## Retrieval Misses",
    "",
    ...(s.failures.missedRecallAt5.length
      ? s.failures.missedRecallAt5.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "## Citation Precision Below 90%",
    "",
    ...(s.failures.lowCitationPrecision.length
      ? s.failures.lowCitationPrecision.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "## Runtime Errors",
    "",
    ...(s.failures.distinctErrors.length
      ? s.failures.distinctErrors.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "## Notes",
    "",
    "- Retrieval latency is measured after query embedding, matching the sub-500ms memory recall target.",
    "- Total recall includes Gemini embedding latency and is reported separately.",
    "- Fast answer strategy avoids live Gemini answer generation; set `MEMORY_REPORT_ANSWER_STRATEGY=deep` for full generation evaluation.",
    "- Runtime-invalid reports are not published unless `MEMORY_REPORT_WRITE_INVALID=1` is set.",
    "- The stable demo artifact is `memory-evaluation-latest-valid.md`.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function hasExpectedSourceInTopK(item: EvaluationQuestion, sources: TopSource[]): boolean {
  if (item.expectedNoSources) {
    return sources.length === 0 || (sources[0]?.similarity ?? 0) < noDataSimilarityThreshold;
  }
  return sources.some((source) => citationMatchesExpectation(item, source));
}

function citationMatchesExpectation(
  item: EvaluationQuestion,
  citation: { sourceType: string; sourceId: string; chunkType: string },
): boolean {
  const sourceTypeOk =
    !item.expectedSourceTypes?.length ||
    item.expectedSourceTypes.includes(citation.sourceType);
  const sourceIdOk =
    !item.expectedSourceIds?.length ||
    item.expectedSourceIds.includes(citation.sourceId);
  const chunkTypeOk =
    !item.expectedChunkTypes?.length ||
    item.expectedChunkTypes.includes(citation.chunkType);

  return sourceTypeOk && sourceIdOk && chunkTypeOk;
}

function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
}

function percentile(values: number[], p: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function average(values: number[]): number {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

function count<T>(rows: T[], predicate: (row: T) => boolean): number {
  return rows.filter(predicate).length;
}

function distinctRuntimeErrors(
  retrievalRows: RetrievalReportRow[],
  citationRows: CitationReportRow[],
): string[] {
  return Array.from(
    new Set(
      [
        ...retrievalRows.map((row) => row.error),
        ...citationRows.map((row) => row.error),
        ...citationRows.map((row) =>
          row.modelError
            ? `${row.modelError.kind}${row.modelError.status ? ` ${row.modelError.status}` : ""}: ${row.modelError.message}`
            : undefined,
        ),
      ]
        .filter((error): error is string => Boolean(error))
        .map((error) => error.replace(/\s+/g, " ").slice(0, 180)),
    ),
  ).slice(0, 5);
}

function elapsedSince(start: number): number {
  return Math.round(performance.now() - start);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function toShortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function parseAnswerStrategy(value: string): AnswerStrategy {
  if (value === "auto" || value === "fast" || value === "deep") return value;
  return "fast";
}

async function resolveReportUserId(prisma: any): Promise<string | null> {
  const explicitInternalId = process.env.SAMPLE_USER_ID ?? process.env.USER_ID;
  if (explicitInternalId) return explicitInternalId;

  const supabaseId =
    process.env.DEMO_SUPABASE_USER_ID ??
    process.env.SAMPLE_SUPABASE_USER_ID ??
    process.env.TEST_SUPABASE_USER_ID ??
    process.env.SUPABASE_USER_ID;
  if (supabaseId) {
    const user = await prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (user) return user.id;
    console.error(`No user found for configured Supabase id ${supabaseId}.`);
    process.exitCode = 1;
    return null;
  }

  const email = process.env.SAMPLE_USER_EMAIL ?? process.env.USER_EMAIL ?? process.env.DEMO_EMAIL;
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) return user.id;
    console.error(`No user found for configured email ${email}.`);
    process.exitCode = 1;
    return null;
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, display_name: true },
    take: 2,
    orderBy: { created_at: "asc" },
  });

  if (users.length === 1) return users[0].id;

  console.error(
    "Set SAMPLE_USER_ID/USER_ID, DEMO_SUPABASE_USER_ID, or SAMPLE_USER_EMAIL/USER_EMAIL before running the evaluation report.",
  );
  if (users.length > 1) {
    console.error("Available users:");
    for (const user of users) {
      const name = user.display_name ? ` (${user.display_name})` : "";
      console.error(`- ${user.id} ${user.email}${name}`);
    }
  }
  process.exitCode = 1;
  return null;
}

function printHelp(): void {
  console.log(`
Second Brain memory evaluation report

Required env:
  TUTURUUU_AI_API_KEY
  DATABASE_URL
  SAMPLE_USER_ID or SAMPLE_USER_EMAIL

Optional env:
  MEMORY_EVAL_DATASET                  Path to dataset JSON
  MEMORY_REPORT_OUTPUT_DIR             Directory for JSON/Markdown reports
  MEMORY_REPORT_ANSWER_STRATEGY        fast | deep | auto (default: fast)
  MEMORY_REPORT_RETRIEVAL_LIMIT        Retrieved chunks per question (default: 8)
  MEMORY_REPORT_QUESTION_LIMIT         Limit question count for smoke runs
  MEMORY_REPORT_DELAY_MS               Delay between questions to reduce quota pressure
  MEMORY_REPORT_FAIL_ON_THRESHOLD=1    Exit non-zero if thresholds fail
  MEMORY_REPORT_WRITE_INVALID=1        Archive invalid diagnostic reports under reports/invalid

Example:
  SAMPLE_USER_EMAIL=you@example.com MEMORY_REPORT_DELAY_MS=2000 pnpm eval:report

Output:
  Timestamped valid report plus memory-evaluation-latest-valid.md/json.
  Runtime-invalid reports are not written by default.
`.trim());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
