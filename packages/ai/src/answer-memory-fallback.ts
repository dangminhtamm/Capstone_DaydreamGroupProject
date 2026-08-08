import type { GeminiTokenUsage } from "./gemini-json.ts";
import type { MemoryCitation } from "./answer-utils.ts";
import type {
  AnswerMemoryResult,
  MemoryIntent,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  buildIntentNoMemoryMessage,
  buildQuestionAwareFallbackAnswer,
  buildReadableClaim,
  dedupeCitationsBySource,
  formatFallbackSourceDate,
  formatLocalizedMemoryBullet,
} from "./answer-memory-format.ts";
import {
  detectMemoryIntent,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import {
  classifyFallbackConfidence,
  countOverlap,
  importantTokens,
  isNoisyFallbackSource,
  scoreSourceForIntent,
  type FallbackTopic,
} from "./answer-memory-scoring.ts";
import { isBroadTemporalSynthesisQuestion } from "./answer-memory-routing.ts";
import {
  buildQueryAnalytics,
  noMemoryResult,
} from "./answer-memory-result.ts";
import {
  isIncompleteGeneratedAnswer,
  isInsufficientAnswer,
} from "./answer-memory-validation.ts";

export function canUseExtractiveFallback(
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  sources: MemoryCitation[],
): boolean {
  return (
    sources.length > 0 &&
    ["quota", "billing", "model_config", "service_unavailable", "transient", "validation"].includes(modelError.kind)
  );
}

export function recoverCitationsForAnswer(
  answer: string,
  sources: MemoryCitation[],
  question: string,
  intent: MemoryIntent,
): MemoryCitation[] {
  if (isInsufficientAnswer(answer) || !sources.length) return [];

  const normalizedQuestion = normalizeForIntent(question);
  const normalizedAnswer = normalizeForIntent(answer);
  const answerTokens = new Set(importantTokens(normalizedAnswer));
  const scored = dedupeCitationsByChunk(sources)
    .map((source) => {
      const searchable = normalizeForIntent(
        `${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`,
      );
      const sourceTokens = new Set(importantTokens(searchable));
      const answerOverlap = answerTokens.size
        ? countOverlap(answerTokens, sourceTokens) / answerTokens.size
        : 0;
      const intentScore = scoreSourceForIntent(normalizedQuestion, source, intent);

      return {
        source,
        score: intentScore + answerOverlap * 0.45,
        answerOverlap,
      };
    })
    .sort((a, b) => b.score - a.score || b.source.similarity - a.source.similarity);

  return scored
    .filter(
      (item) =>
        item.score >= 0.48 ||
        (item.answerOverlap >= 0.25 && item.source.similarity >= 0.55),
    )
    .slice(0, 3)
    .map(({ source }) => ({
      ...source,
      claim: buildReadableClaim(source),
    }));
}

function dedupeCitationsByChunk(citations: MemoryCitation[]): MemoryCitation[] {
  const seen = new Set<string>();
  const deduped: MemoryCitation[] = [];

  for (const citation of citations) {
    if (seen.has(citation.chunkId)) continue;
    seen.add(citation.chunkId);
    deduped.push(citation);
  }

  return deduped;
}

export function buildExtractiveFallbackAnswer(
  lang: ResponseLanguage,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  meta: {
    generateMs?: number;
    tokenUsage?: GeminiTokenUsage;
  } = {},
  question = "",
  timeZone = "UTC",
): AnswerMemoryResult {
  const fallbackTopic = detectFallbackTopic(question);
  const fallbackSources = selectFallbackSources(question, sources, fallbackTopic).map((source) => ({
    ...source,
    claim: buildReadableClaim(source),
  }));

  if (!fallbackSources.length) {
    const result = noMemoryResult(
      buildIntentNoMemoryMessage(question, fallbackTopic, lang),
      lang,
    );
    result.modelError = modelError;
    result.analytics = buildQueryAnalytics({
      model: "extractive-fallback",
      tokenUsage: meta.tokenUsage,
      timing: { generateMs: meta.generateMs ?? 0 },
      chunksRetrieved,
      status: "no_memory",
      answerMode: "no_memory",
    });
    return result;
  }

  const bullets = fallbackSources
    .map((source) => {
      const date = formatFallbackSourceDate(source.occurredAt, lang, timeZone);
      return `- ${date}: ${formatLocalizedMemoryBullet(source, fallbackTopic, lang)}.`;
    })
    .join("\n");

  const answer = buildQuestionAwareFallbackAnswer(lang, question, bullets, modelError, fallbackTopic);

  return {
    answer,
    confidence: classifyFallbackConfidence(fallbackSources),
    citations: fallbackSources,
    answerMode: "extractive_fallback",
    modelError,
    analytics: buildQueryAnalytics({
      model: "extractive-fallback",
      tokenUsage: meta.tokenUsage,
      timing: { generateMs: meta.generateMs ?? 0 },
      chunksRetrieved,
      status: "success",
      answerMode: "extractive_fallback",
    }),
  };
}

export function buildValidationFallbackAnswer(
  lang: ResponseLanguage,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  message: string,
  meta: {
    generateMs?: number;
    tokenUsage?: GeminiTokenUsage;
  },
  question = "",
  timeZone = "UTC",
): AnswerMemoryResult {
  return buildExtractiveFallbackAnswer(
    lang,
    sources,
    chunksRetrieved,
    {
      kind: "validation",
      message,
    },
    meta,
    question,
    timeZone,
  );
}

export function buildInsufficientModelAnswer(
  lang: ResponseLanguage,
  answer: string,
  chunksRetrieved: number,
  meta: {
    generateMs: number;
    tokenUsage: GeminiTokenUsage;
  },
): AnswerMemoryResult {
  return {
    answer: normalizeInsufficientAnswer(answer, lang),
    confidence: "low",
    citations: [],
    noMemory: true,
    answerMode: "gemini",
    analytics: buildQueryAnalytics({
      model: meta.tokenUsage.model,
      tokenUsage: meta.tokenUsage,
      timing: { generateMs: meta.generateMs },
      chunksRetrieved,
      status: "no_memory",
      answerMode: "gemini",
    }),
  };
}

function normalizeInsufficientAnswer(answer: string, lang: ResponseLanguage): string {
  const trimmed = answer.trim();
  if (trimmed && !isIncompleteGeneratedAnswer(trimmed)) return trimmed;
  return lang === "vi"
    ? "Mình chưa tìm thấy ký ức đủ cụ thể để trả lời chắc chắn."
    : "I could not find enough specific memories to answer confidently.";
}

function detectFallbackTopic(question: string): FallbackTopic {
  return detectMemoryIntent(question);
}

function selectFallbackSources(
  question: string,
  sources: MemoryCitation[],
  fallbackTopic: FallbackTopic,
): MemoryCitation[] {
  const normalizedQuestion = normalizeForIntent(question);
  const deduped = dedupeCitationsBySource(sources);
  const broadSynthesis = isBroadTemporalSynthesisQuestion(question, fallbackTopic);
  const maxSources = broadSynthesis || fallbackTopic === "progress" ? 8 : 4;
  const scored = deduped
    .map((source) => ({
      source,
      score: scoreSourceForIntent(normalizedQuestion, source, fallbackTopic),
    }))
    .sort((a, b) => b.score - a.score || b.source.similarity - a.source.similarity);

  const topScore = scored[0]?.score ?? 0;
  const minimumScore = getFallbackMinimumScore(fallbackTopic);
  const maxDrop = getFallbackMaxScoreDrop(fallbackTopic);
  const stronglyRelevant = scored.filter(
    (item) => item.score >= minimumScore && item.score >= topScore - maxDrop,
  );
  const nonNoisy = scored.filter((item) => !isNoisyFallbackSource(item.source));
  const pool = stronglyRelevant.length
    ? stronglyRelevant
    : nonNoisy.length
      ? nonNoisy
      : scored;

  if (broadSynthesis || fallbackTopic === "progress") {
    return diversifySourcesByDay(pool, maxSources);
  }

  return pool.slice(0, maxSources).map((item) => item.source);
}

function diversifySourcesByDay(
  scored: Array<{ source: MemoryCitation; score: number }>,
  maxSources: number,
): MemoryCitation[] {
  const selected: MemoryCitation[] = [];
  const selectedKeys = new Set<string>();
  const seenDays = new Set<string>();

  for (const item of scored) {
    const day = item.source.occurredAt.slice(0, 10);
    if (seenDays.has(day)) continue;
    selected.push(item.source);
    selectedKeys.add(item.source.chunkId);
    seenDays.add(day);
    if (selected.length >= maxSources) return selected;
  }

  for (const item of scored) {
    if (selectedKeys.has(item.source.chunkId)) continue;
    selected.push(item.source);
    if (selected.length >= maxSources) break;
  }

  return selected;
}

function getFallbackMinimumScore(fallbackTopic: FallbackTopic): number {
  switch (fallbackTopic) {
    case "feedback":
    case "blocker":
    case "latency":
    case "gmail":
    case "google_contacts":
    case "decision":
      return 0.5;
    case "mood":
      return 0.45;
    default:
      return 0.38;
  }
}

function getFallbackMaxScoreDrop(fallbackTopic: FallbackTopic): number {
  switch (fallbackTopic) {
    case "feedback":
    case "blocker":
    case "latency":
    case "gmail":
    case "google_contacts":
    case "decision":
      return 0.22;
    default:
      return 0.28;
  }
}
