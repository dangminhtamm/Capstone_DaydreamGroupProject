import {
  buildCitations,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";
import type {
  AnswerMemoryResult,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  dedupeCitationsBySource,
  buildReadableClaim,
  formatDateForAnswer,
  formatDateRangeForAnswer,
  formatFallbackSourceDate,
  formatLocalizedMemoryBullet,
  formatSingleDayAnswer,
  formatTemporalRangeAnswer,
} from "./answer-memory-format.ts";
import { detectMemoryIntent } from "./answer-memory-intents.ts";
import {
  buildQueryAnalytics,
  noMemoryResult,
} from "./answer-memory-result.ts";
import { hasAdequateSemanticSupport } from "./answer-memory-validation.ts";
import { requiresGenerativeReasoning } from "./answer-memory-routing.ts";
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

  const citations = buildCitations(sortedChunks)
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: citation.quote,
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

  const citations = dedupeCitationsBySource(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: buildReadableClaim(citation),
    }));

  if (!citations.length) return null;

  const answer = formatTemporalRangeAnswer(
    citations,
    formatDateRangeForAnswer(filters.startDate!, filters.endDate!, lang, timeZone),
    lang,
    timeZone,
  );
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

  const citations = dedupeCitationsBySource(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: buildReadableClaim(citation),
    }));

  const bullets = citations
    .map((citation) => {
      const date = formatFallbackSourceDate(citation.occurredAt, lang, timeZone);
      return `- ${date}: ${formatLocalizedMemoryBullet(citation, detectMemoryIntent(question), lang)}.`;
    })
    .join("\n");

  return {
    answer: lang === "vi"
      ? ["Mình trả lời nhanh từ các ký ức liên quan nhất:", bullets].join("\n")
      : ["Fast answer from the most relevant memories:", bullets].join("\n"),
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
