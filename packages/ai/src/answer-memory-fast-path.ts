import {
  buildCitations,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";
import type {
  AnswerMemoryResult,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  buildReadableClaim,
  formatDateForAnswer,
  formatDateRangeForAnswer,
  formatSingleDayAnswer,
  selectSingleDayCitations,
} from "./answer-memory-format.ts";
import { detectMemoryIntent } from "./answer-memory-intents.ts";
import {
  formatGenericFastAnswer,
  formatTemporalFastAnswer,
  prepareFastCitations,
} from "./answer-memory-fast-compose.ts";
import {
  countOverlap,
  importantTokens,
} from "./answer-memory-scoring.ts";
import {
  buildQueryAnalytics,
  noMemoryResult,
} from "./answer-memory-result.ts";
import { hasAdequateSemanticSupport } from "./answer-memory-validation.ts";
import {
  isBroadTemporalSynthesisQuestion,
  requiresGenerativeReasoning,
} from "./answer-memory-routing.ts";
import {
  getGenericFastMaxCitations,
  getTemporalFastMaxCitations,
} from "./answer-memory-intent-profiles.ts";
import type { MemorySearchHit, RetrievalFilters } from "./retrieval.ts";

export function answerSingleDayFastPath(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
  lang: ResponseLanguage,
  minTopSimilarity: number,
  timeZone = "UTC",
): AnswerMemoryResult | null {
  if (!isSingleDayRange(filters) || !chunks.length || requiresGenerativeReasoning(question)) {
    return null;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    return null;
  }

  const citations = selectSingleDayCitations(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: citation.claim ?? buildReadableClaim(citation),
    }));

  if (!citations.length) return null;

  const dateLabel = formatDateForAnswer(filters.startDate!, lang, timeZone);
  const answer = formatSingleDayAnswer(citations, dateLabel, lang);
  const confidence = classifyRetrievalConfidence(topSimilarity, citations.length);

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: buildQueryAnalytics({
      model: "fast-path",
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
    }),
  };
}

export function answerTemporalRangeFastPath(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
  lang: ResponseLanguage,
  minTopSimilarity: number,
  timeZone = "UTC",
): AnswerMemoryResult | null {
  if (
    !isMultiDayRange(filters) ||
    !chunks.length ||
    requiresGenerativeReasoning(question) ||
    process.env.MEMORY_TEMPORAL_FAST_PATH === "false"
  ) {
    return null;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    return null;
  }

  const intent = detectMemoryIntent(question);
  const broadSynthesis = isBroadTemporalSynthesisQuestion(question, intent, filters);
  const citations = prepareFastCitations(buildCitations(sortedChunks), {
    intent,
    question,
    focused: !broadSynthesis,
    maxCitations: getTemporalFastMaxCitations(intent, broadSynthesis),
  });

  if (!citations.length) return null;

  const answer = formatTemporalFastAnswer({
    question,
    citations,
    rangeLabel: formatDateRangeForAnswer(filters.startDate!, filters.endDate!, lang, timeZone),
    lang,
    intent,
    timeZone,
  });
  const confidence = classifyRetrievalConfidence(topSimilarity, citations.length);

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: buildQueryAnalytics({
      model: "temporal-fast-path",
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
    }),
  };
}

export function answerFastExtractiveFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  lang: ResponseLanguage,
  minTopSimilarity: number,
  timeZone = "UTC",
): AnswerMemoryResult {
  if (!chunks.length) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình chưa tìm thấy ký ức đủ liên quan để trả lời nhanh."
        : "I could not find enough relevant memories for a fast answer.",
      lang,
    );
    result.analytics = buildQueryAnalytics({
      model: "fast-extractive",
      chunksRetrieved: 0,
      status: "no_memory",
      answerMode: "no_memory",
    });
    return result;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình tìm thấy một vài ký ức gần nghĩa, nhưng chưa đủ chắc để trả lời nhanh."
        : "I found loosely related memories, but not enough support for a fast answer.",
      lang,
    );
    result.analytics = buildQueryAnalytics({
      model: "fast-extractive",
      chunksRetrieved: chunks.length,
      status: "no_memory",
      answerMode: "no_memory",
    });
    return result;
  }

  const intent = detectMemoryIntent(question);
  const broadSynthesis = isBroadTemporalSynthesisQuestion(question, intent);
  const citations = prepareFastCitations(buildCitations(sortedChunks), {
    intent,
    question,
    focused: !broadSynthesis,
    maxCitations: getGenericFastMaxCitations(intent, broadSynthesis),
  });

  if (!hasFocusedFastSupport(question, citations, broadSynthesis)) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình chưa tìm thấy ký ức đủ liên quan để trả lời nhanh."
        : "I could not find enough relevant memories for a fast answer.",
      lang,
    );
    result.analytics = buildQueryAnalytics({
      model: "fast-extractive",
      chunksRetrieved: chunks.length,
      status: "no_memory",
      answerMode: "no_memory",
    });
    return result;
  }

  return {
    answer: formatGenericFastAnswer({
      question,
      citations,
      lang,
      intent,
      timeZone,
    }),
    confidence: classifyRetrievalConfidence(topSimilarity, citations.length),
    citations,
    answerMode: "fast_path",
    analytics: buildQueryAnalytics({
      model: "fast-extractive",
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
    }),
  };
}

function isSingleDayRange(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;

  const maxOneDayRangeMs = 24 * 60 * 60 * 1000;
  return end - start <= maxOneDayRangeMs;
}

function isMultiDayRange(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;

  return end - start > 24 * 60 * 60 * 1000;
}

function hasFocusedFastSupport(
  question: string,
  citations: Array<{
    quote: string;
    sourceTitle?: string;
    lexicalScore?: number;
  }>,
  broadSynthesis: boolean,
): boolean {
  if (!citations.length) return false;

  const queryTokens = new Set(getTopicalSupportTokens(question));
  if (queryTokens.size === 0) return true;

  const bestOverlapRatio = citations.reduce((best, citation) => {
    const sourceTokens = buildSupportTokenSet(`${citation.sourceTitle ?? ""} ${citation.quote}`);
    const overlapRatio = countOverlap(queryTokens, sourceTokens) / queryTokens.size;
    return Math.max(best, overlapRatio);
  }, 0);
  const hasLexicalSupport = citations.some((citation) => (citation.lexicalScore ?? 0) >= 0.25);

  if (broadSynthesis) return bestOverlapRatio >= 0.22;

  return hasLexicalSupport || bestOverlapRatio >= 0.22;
}

function getTopicalSupportTokens(question: string): string[] {
  return importantTokens(question)
    .map((token) => singularizeToken(token))
    .filter((token) => !FAST_SUPPORT_IGNORED_TOKENS.has(token) && !/^\d+$/u.test(token));
}

function buildSupportTokenSet(value: string): Set<string> {
  const tokens = new Set<string>();
  for (const token of importantTokens(value)) {
    tokens.add(token);
    tokens.add(singularizeToken(token));
  }
  return tokens;
}

function singularizeToken(token: string): string {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

const FAST_SUPPORT_IGNORED_TOKENS = new Set([
  "across",
  "during",
  "happen",
  "happened",
  "latest",
  "main",
  "mentioned",
  "month",
  "recent",
  "recently",
  "team",
  "week",
  "weekly",
  "year",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);
