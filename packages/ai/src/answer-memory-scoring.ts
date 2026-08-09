import type { MemoryCitation } from "./answer-utils.ts";
import type { MemoryIntent } from "./answer-memory-types.ts";
import {
  hasGmailEvidence,
  hasLatencyEvidence,
  hasOnlyQuestionListEvidence,
  includesAny,
  isGoogleContactsIntent,
  isGoogleContactsSearchText,
  normalizeForIntent,
} from "./answer-memory-intents.ts";

export type FallbackTopic = MemoryIntent;

export function countOverlap(first: Set<string>, second: Set<string>): number {
  let hits = 0;
  for (const token of first) {
    if (second.has(token)) hits += 1;
  }
  return hits;
}

export function importantTokens(value: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "about",
    "as",
    "be",
    "but",
    "by",
    "can",
    "cua",
    "cho",
    "co",
    "da",
    "dang",
    "de",
    "did",
    "do",
    "for",
    "from",
    "gi",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "is",
    "it",
    "la",
    "lam",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "so",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "toi",
    "trong",
    "va",
    "ve",
    "voi",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "who",
    "why",
    "will",
    "with",
    "you",
  ]);

  return normalizeForIntent(value)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

export function scoreSourceForIntent(
  normalizedQuestion: string,
  source: MemoryCitation,
  fallbackTopic: FallbackTopic,
): number {
  const searchable = normalizeForIntent(
    `${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`,
  );
  const queryTokens = new Set(importantTokens(normalizedQuestion));
  const sourceTokens = new Set(importantTokens(searchable));
  const overlapRatio = queryTokens.size
    ? countOverlap(queryTokens, sourceTokens) / queryTokens.size
    : 0;

  let score = source.similarity * 0.55 + overlapRatio * 0.35;
  if (source.retrievalMode === "hybrid") score += 0.05;
  if (source.retrievalMode === "lexical") score += 0.03;
  if (source.sourceType === "summary") score -= 0.04;
  if (isNoisyFallbackSource(source)) score -= 0.4;

  if (fallbackTopic === "google_contacts") {
    return score + (isGoogleContactsSource(source) ? 0.6 : -0.45);
  }

  if (fallbackTopic === "blocker") {
    if (includesAny(searchable, [
      "blocker",
      "risk",
      "challenge",
      "stuck",
      "quota",
      "worker",
      "indexing",
      "fallback",
      "blocked",
      "trở ngại",
      "rủi ro",
      "khó khăn",
    ])) score += 0.45;
    if (source.chunkType === "action_item" || source.chunkType === "reflection") score += 0.08;
    if (hasOnlyQuestionListEvidence(searchable)) {
      score -= 0.5;
    }
    return score;
  }

  if (fallbackTopic === "feedback") {
    if (includesAny(searchable, ["feedback", "mentor", "review", "linh", "gop y", "góp ý", "nhan xet", "nhận xét"])) {
      score += 0.35;
    }
    if (
      includesAny(normalizedQuestion, ["citation", "citations", "trich dan", "trích dẫn"]) &&
      includesAny(searchable, ["citation", "citations", "cite", "source", "trust", "ui", "trich dan", "trích dẫn"])
    ) {
      score += 0.28;
    }
    if (source.chunkType === "feedback") score += 0.12;
    if (isGoogleContactsSource(source) && !isGoogleContactsIntent(normalizedQuestion)) score -= 0.55;
    return score;
  }

  if (fallbackTopic === "latency") {
    if (includesAny(searchable, [
      "retrieval latency",
      "answer generation",
      "generation latency",
      "embedding time",
      "database retrieval",
      "reranking",
      "p95",
      "500 millisecond",
      "500 ms",
      "time to first result",
      "separate",
      "separately",
    ])) {
      score += 0.55;
    }
    if (hasOnlyQuestionListEvidence(searchable)) score -= 0.45;
    if (source.chunkType === "decision" || source.chunkType === "general_note") score += 0.06;
    return score;
  }

  if (fallbackTopic === "gmail") {
    if (hasGmailEvidence(searchable)) {
      score += 0.65;
    } else {
      score -= 0.45;
    }
    if (source.chunkType === "decision" || source.chunkType === "feedback") score += 0.08;
    if (hasLatencyEvidence(searchable) && !hasGmailEvidence(searchable)) score -= 0.35;
    return score;
  }

  if (fallbackTopic === "mood") {
    if (includesAny(searchable, [
      "stress",
      "stressed",
      "worried",
      "confident",
      "relieved",
      "mood",
      "emotion",
      "căng thẳng",
      "tâm trạng",
      "cảm xúc",
    ])) score += 0.38;
    if (source.chunkType === "reflection") score += 0.08;
    return score;
  }

  if (fallbackTopic === "decision") {
    if (includesAny(searchable, ["decide", "decision", "agreed", "scope decision", "quyet dinh", "quyết định", "thong nhat", "thống nhất"])) {
      score += 0.32;
    }
    if (source.chunkType === "decision") score += 0.1;
  }

  if (fallbackTopic === "progress") {
    if (source.sourceType === "diary" || source.sourceType === "calendar") {
      score += 0.14;
    }
    if (source.sourceType === "summary") {
      score -= 0.16;
    }
    if (source.sourceType === "drive" || source.sourceType === "attachment") {
      score -= 0.22;
    }
    if (
      includesAny(normalizedQuestion, ["frontend", "duc anh", "nhan"]) &&
      includesAny(searchable, ["diary input", "loading", "empty states", "timeline", "search page", "frontend flow"])
    ) {
      score += 0.28;
    }
    if (
      includesAny(normalizedQuestion, ["progress", "week", "across"]) &&
      includesAny(searchable, ["ai memory", "backend", "frontend", "calendar", "search", "citation"])
    ) {
      score += 0.18;
    }
  }

  if (isGoogleContactsSource(source)) {
    score -= 0.18;
  }

  return score;
}

export function classifyFallbackConfidence(citations: MemoryCitation[]): "high" | "medium" | "low" {
  if (!citations.length) return "low";
  const topSimilarity = citations[0]?.similarity ?? 0;
  if (topSimilarity >= 0.78 && citations.length >= 1) return "medium";
  return "low";
}

function isGoogleContactsSource(source: MemoryCitation): boolean {
  if (source.sourceType === "contact") return true;
  const searchable = normalizeForIntent(
    `${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`,
  );
  return isGoogleContactsSearchText(searchable);
}

export function isNoisyFallbackSource(source: MemoryCitation): boolean {
  const searchable = normalizeForIntent(`${source.sourceTitle ?? ""} ${source.quote}`);
  return hasOnlyQuestionListEvidence(searchable);
}
