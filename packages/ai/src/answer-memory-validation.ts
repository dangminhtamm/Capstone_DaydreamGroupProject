import type { MemoryCitation } from "./answer-utils.ts";
import type { ResponseLanguage } from "./answer-memory-types.ts";
import { detectMonth } from "./answer-memory-temporal.ts";
import {
  includesAny,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import { importantTokens } from "./answer-memory-scoring.ts";
import type { MemorySearchHit } from "./retrieval.ts";

export function reconcileConfidence(
  modelConfidence: "high" | "medium" | "low",
  retrievalConfidence: "high" | "medium" | "low",
  answer: string,
  hadUnsupportedClaims = false,
): "high" | "medium" | "low" {
  if (hadUnsupportedClaims) return "low";

  if (
    modelConfidence === "low" &&
    retrievalConfidence !== "low" &&
    !isInsufficientAnswer(answer)
  ) {
    return "medium";
  }

  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[modelConfidence] <= rank[retrievalConfidence]
    ? modelConfidence
    : retrievalConfidence;
}

export function hasAdequateSemanticSupport(chunks: MemorySearchHit[]): boolean {
  const top = chunks[0];
  if (!top) return false;

  if (top.retrievalMode === "lexical" && top.vectorSimilarity < 0.3) {
    return false;
  }

  if (top.retrievalMode === "temporal") {
    return chunks.some((chunk) => chunk.retrievalMode === "temporal");
  }

  return chunks.some((chunk) => chunk.vectorSimilarity >= 0.5);
}

export function isClaimSupportedByQuote(claim: string, quote: string): boolean {
  const claimTokens = importantTokens(claim);
  if (claimTokens.length <= 2) return quoteContainsMeaningfulPhrase(claim, quote);

  const quoteTokens = new Set(importantTokens(quote));
  const hits = claimTokens.filter((token) => quoteTokens.has(token)).length;
  const coverage = hits / claimTokens.length;

  return hits >= 2 && coverage >= 0.45;
}

export function isAnswerGroundedByCitations(
  answer: string,
  citations: Array<{ marker: string; claim: string }>,
  sourceByMarker: Map<string, MemoryCitation>,
  lang: ResponseLanguage,
): boolean {
  if (isInsufficientAnswer(answer)) return false;
  if (lang === "vi" && citations.length > 0) {
    return true;
  }

  const citedEvidence = citations
    .map((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return `${citation.claim} ${source?.quote ?? ""}`;
    })
    .join(" ");
  const answerTokens = importantTokens(answer);

  if (answerTokens.length <= 4) {
    return quoteContainsMeaningfulPhrase(answer, citedEvidence);
  }

  const evidenceTokens = new Set(importantTokens(citedEvidence));
  const hits = answerTokens.filter((token) => evidenceTokens.has(token)).length;
  return hits >= 3 && hits / answerTokens.length >= 0.35;
}

export function answerPassesEvidenceChecks(
  answer: string,
  citations: MemoryCitation[],
): boolean {
  if (isIncompleteGeneratedAnswer(answer)) return false;
  if (isInsufficientAnswer(answer)) return true;

  const evidenceText = citations
    .map((citation) => `${citation.claim ?? ""} ${citation.quote} ${citation.sourceTitle ?? ""} ${citation.occurredAt}`)
    .join(" ");
  const normalizedEvidence = normalizeForIntent(evidenceText);

  const answerDateTokens = extractDateLikeTokens(answer);
  if (answerDateTokens.some((token) => !dateTokenSupportedByEvidence(token, normalizedEvidence))) {
    return false;
  }

  const answerNames = extractNamedEntityTokens(answer);
  const unsupportedNames = answerNames.filter((name) => {
    const normalizedName = normalizeForIntent(name);
    return normalizedName.length >= 3 && !normalizedEvidence.includes(normalizedName);
  });

  return unsupportedNames.length === 0;
}

export function isInsufficientAnswer(answer: string): boolean {
  const normalized = normalizeForIntent(answer);
  return includesAny(normalized, [
    "insufficient",
    "not enough",
    "not found",
    "khong du",
    "chua tim thay",
    "khong tim thay",
    "khong co thong tin",
    "khong co du lieu",
    "chua co thong tin",
    "chua co du lieu",
    "khong co thong tin cu the",
    "khong co du thong tin",
  ]);
}

export function isIncompleteGeneratedAnswer(answer: string): boolean {
  const trimmed = answer.replace(/\s+/g, " ").trim();
  if (!trimmed) return true;
  const hasTerminalPunctuation = /[.!?…。！？]$/u.test(trimmed);

  const normalized = normalizeForIntent(trimmed);
  if (includesAny(normalized, [
    "ky uc hien tai khong co thong tin ve bat ky",
    "dua tren cac ghi chep tuan nay minh",
    "dua tren cac ky uc da luu minh",
  ])) {
    return true;
  }

  const lastWord = normalized.split(/\s+/).filter(Boolean).at(-1) ?? "";
  if (!hasTerminalPunctuation && lastWord.length <= 1) return true;
  if (
    !hasTerminalPunctuation &&
    /\b(?:to claim|claim|because|because of|due to|in order to|so that|such as|for example|including|include)$/iu.test(normalized)
  ) {
    return true;
  }

  return /\b(?:mình|minh|bạn|ban|về|ve|vì|vi|bởi|boi|any|about|because|the|a|an|is|are|was|were|to|for|of|and|or)$/iu.test(
    normalized,
  );
}

function dateTokenSupportedByEvidence(token: string, normalizedEvidence: string): boolean {
  const normalizedToken = normalizeForIntent(token).replace(/\s+/g, " ").trim();
  if (!normalizedToken) return true;
  if (normalizedEvidence.includes(normalizedToken)) return true;

  const month = detectMonth(normalizedToken);
  if (month !== null) {
    const monthNumber = String(month + 1).padStart(2, "0");
    if (normalizedEvidence.includes(`-${monthNumber}-`)) return true;
    if (normalizedEvidence.includes(`/${monthNumber}/`)) return true;
  }

  const numeric = normalizedToken.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-]((?:20)?\d{2}))?\b/u);
  if (numeric) {
    const day = String(Number(numeric[1])).padStart(2, "0");
    const monthNumber = String(Number(numeric[2])).padStart(2, "0");
    if (normalizedEvidence.includes(`-${monthNumber}-${day}`)) return true;
    if (normalizedEvidence.includes(`${day}/${monthNumber}`)) return true;
  }

  return false;
}

function extractDateLikeTokens(value: string): string[] {
  const tokens = new Set<string>();
  const normalized = normalizeForIntent(value);

  for (const match of normalized.matchAll(/\b20\d{2}-\d{1,2}-\d{1,2}\b/gu)) {
    tokens.add(match[0]);
  }

  for (const match of normalized.matchAll(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-](?:20)?\d{2})?\b/gu)) {
    tokens.add(match[0]);
  }

  for (const match of normalized.matchAll(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|thang\s+\d{1,2})(?:\s+20\d{2})?\b/gu)) {
    tokens.add(match[0].replace(/\s+/g, " ").trim());
  }

  return [...tokens];
}

function extractNamedEntityTokens(value: string): string[] {
  const ignored = new Set([
    "I",
    "You",
    "The",
    "This",
    "That",
    "On",
    "In",
    "Based",
    "Mình",
    "Bạn",
    "Dựa",
    "Vào",
    "Trong",
  ]);

  const matches = value.match(/\b[\p{Lu}][\p{L}\p{M}\p{N}_-]*(?:\s+[\p{Lu}][\p{L}\p{M}\p{N}_-]*){0,3}\b/gu) ?? [];

  return [...new Set(
    matches
      .map((match) => match.trim())
      .filter((match) => match.length >= 3 && !ignored.has(match)),
  )];
}

function quoteContainsMeaningfulPhrase(value: string, quote: string): boolean {
  const normalizedValue = normalizeForIntent(value).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const normalizedQuote = normalizeForIntent(quote).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const compactValue = normalizedValue.replace(/\s+/g, " ").trim();
  return compactValue.length >= 4 && normalizedQuote.includes(compactValue);
}
