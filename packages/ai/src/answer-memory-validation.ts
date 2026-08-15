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

  if (chunks.some((chunk) => (chunk.entityScore ?? 0) >= 0.8)) {
    return true;
  }

  if (top.retrievalMode === "lexical" && top.vectorSimilarity < 0.3) {
    return chunks.some((chunk) =>
      isEmbeddingErrorLexicalFallbackHit(chunk) &&
      chunk.retrievalMode === "lexical" &&
      chunk.lexicalScore >= 0.75
    );
  }

  if (top.retrievalMode === "temporal") {
    return chunks.some((chunk) => chunk.retrievalMode === "temporal");
  }

  return chunks.some((chunk) => chunk.vectorSimilarity >= 0.5);
}

function isEmbeddingErrorLexicalFallbackHit(chunk: MemorySearchHit): boolean {
  const metadata = chunk.metadata;
  return Boolean(
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as { retrievalFallback?: unknown }).retrievalFallback === "embedding_error_lexical",
  );
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
  if (citations.length === 0) return false;

  const citedEvidence = citations
    .map((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return `${citation.claim} ${source?.quote ?? ""}`;
    })
    .join(" ");
  if (!citedEvidence.trim()) return false;

  const hasSupportedCitation = citations.some((citation) => {
    const source = sourceByMarker.get(citation.marker);
    return source ? isClaimSupportedByQuote(citation.claim, source.quote) : false;
  });
  if (!hasSupportedCitation) return false;

  const answerTokens = importantTokens(answer);

  if (answerTokens.length <= 4) {
    if (lang === "vi") {
      const groundingAnswerTokens = groundingTokens(answer);
      const groundingEvidenceTokens = new Set(groundingTokens(citedEvidence));
      return (
        quoteContainsMeaningfulPhrase(answer, citedEvidence) ||
        groundingAnswerTokens.some((token) => groundingEvidenceTokens.has(token))
      );
    }

    return quoteContainsMeaningfulPhrase(answer, citedEvidence);
  }

  const evidenceTokens = new Set(importantTokens(citedEvidence));
  const hits = answerTokens.filter((token) => evidenceTokens.has(token)).length;
  const coverage = hits / answerTokens.length;

  if (lang === "vi") {
    const groundingAnswerTokens = groundingTokens(answer);
    const groundingEvidenceTokens = new Set(groundingTokens(citedEvidence));
    const groundingHits = groundingAnswerTokens.filter((token) =>
      groundingEvidenceTokens.has(token),
    ).length;
    const groundingCoverage = groundingHits / groundingAnswerTokens.length;

    const conciseTranslatedAnswer =
      answerTokens.length <= 8 &&
      groundingHits >= 2 &&
      groundingCoverage >= 0.25;

    return (
      conciseTranslatedAnswer ||
      (hits >= 2 && groundingHits >= 3 && groundingCoverage >= 0.2)
    );
  }

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

  // Date check: tolerate 1 unsupported date if the answer has multiple
  const answerDateTokens = extractDateLikeTokens(answer);
  const unsupportedDates = answerDateTokens.filter(
    (token) => !dateTokenSupportedByEvidence(token, normalizedEvidence),
  );
  if (unsupportedDates.length > 1) return false;
  if (unsupportedDates.length === 1 && answerDateTokens.length <= 1) return false;

  // Entity check: allow a tolerance based on answer length
  const answerNames = extractNamedEntityTokens(answer);
  const unsupportedNames = answerNames.filter((name) => {
    const normalizedName = normalizeForIntent(name);
    return (
      normalizedName.length >= 3 &&
      !namedEntitySupportedByEvidence(normalizedName, normalizedEvidence)
    );
  });

  // Short answers (few entities) — strict; longer answers — allow some tolerance
  const maxUnsupported = answerNames.length <= 3 ? 0 : Math.min(2, Math.floor(answerNames.length * 0.3));
  return unsupportedNames.length <= maxUnsupported;
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
  // Common sentence-starting words, conjunctions, and generic terms
  // that are often capitalized but are NOT named entities
  const ignored = new Set([
    // English common words
    "I", "You", "We", "He", "She", "It", "They", "My", "Your", "Our",
    "The", "This", "That", "These", "Those", "Here", "There",
    "And", "But", "Or", "So", "Yet", "For", "Nor",
    "Is", "Are", "Was", "Were", "Has", "Have", "Had", "Do", "Does", "Did",
    "Will", "Would", "Could", "Should", "May", "Might", "Can", "Must",
    "Not", "No", "Yes", "All", "Some", "Any", "Each", "Every", "Many", "Much",
    "On", "In", "At", "To", "From", "By", "With", "About", "Into", "Through",
    "Of", "As", "If", "When", "While", "After", "Before", "Since", "Until",
    "Also", "However", "Therefore", "Moreover", "Furthermore", "Nevertheless",
    "Additionally", "Meanwhile", "Otherwise", "Consequently", "Subsequently",
    "Based", "According", "Overall", "Specifically", "Generally", "Typically",
    "Note", "Key", "Main", "Important", "Several", "Various", "Both",
    "First", "Second", "Third", "Next", "Last", "Finally",
    "New", "Other", "More", "Most", "Such", "One", "Two", "Three",
    // Vietnamese common words
    "Mình", "Bạn", "Tôi", "Chúng",
    "Dựa", "Dựa Trên", "Vào", "Trong", "Nhóm", "Theo",
    "Quyết", "Quyết Định", "Kế Hoạch", "Tóm Tắt",
    "Với", "Của", "Cho", "Từ", "Về", "Như", "Và", "Hoặc",
    "Đây", "Đó", "Này", "Khi", "Nếu", "Sau", "Trước",
    "Cũng", "Ngoài", "Tuy", "Nhưng", "Vì", "Nên",
    "Các", "Những", "Một", "Hai", "Ba",
    "Rất", "Khá", "Nhiều", "Ít", "Hơn",
  ]);

  const matches = value.match(/\b[\p{Lu}][\p{L}\p{M}\p{N}_-]*(?:\s+[\p{Lu}][\p{L}\p{M}\p{N}_-]*){0,3}\b/gu) ?? [];

  return [...new Set(
    matches
      .map((match) => match.trim())
      .filter((match) => match.length >= 3 && !ignored.has(match)),
  )];
}

function namedEntitySupportedByEvidence(
  normalizedName: string,
  normalizedEvidence: string,
): boolean {
  // Exact match
  if (normalizedEvidence.includes(normalizedName)) return true;

  // Alias match
  const aliases = namedEntityAliases(normalizedName);
  if (aliases.some((alias) => normalizedEvidence.includes(alias))) return true;

  // Partial word match: for multi-word entities like "Ho Chi Minh City",
  // check if most individual words appear in evidence
  const words = normalizedName.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length >= 2) {
    const hits = words.filter((word) => normalizedEvidence.includes(word)).length;
    if (hits >= Math.ceil(words.length * 0.6)) return true;
  }

  // Single-word entity: check if it appears as a substring of a longer word
  // in the evidence (e.g., "RMIT" in "rmit capabilities")
  if (words.length === 1 && normalizedName.length >= 3) {
    // Check the evidence for the entity as part of a compound word or phrase
    const nameRegex = new RegExp(`\\b${escapeRegex(normalizedName)}`, "u");
    if (nameRegex.test(normalizedEvidence)) return true;
  }

  return false;
}

function namedEntityAliases(normalizedName: string): string[] {
  const aliasesByName: Record<string, string[]> = {
    "ai": ["artificial intelligence"],
    "ai memory": ["memory", "grounded search", "second brain"],
    "ask your second brain": ["second brain", "grounded search", "ai memory"],
    "attachment": ["attachments", "file dinh kem", "tep dinh kem", "uploaded file", "upload"],
    "attachments": ["attachment", "file dinh kem", "tep dinh kem", "uploaded file", "upload"],
    "calendar": ["google calendar", "lich", "su kien", "events"],
    "diary": ["diary entries", "nhat ky", "journal"],
    "google calendar": ["calendar", "lich", "su kien"],
    "google contacts": ["contacts", "danh ba", "people api"],
    "search": ["grounded search", "ai memory", "semantic search"],
  };

  return aliasesByName[normalizedName] ?? [];
}

const crossLanguageGroundingConcepts = [
  ["ai", "artificial intelligence"],
  ["attachment", "attachments", "file dinh kem", "tep dinh kem", "uploaded file", "upload"],
  ["calendar", "google calendar", "lich", "su kien", "event", "events", "meeting", "meetings", "cuoc hop"],
  ["citation", "citations", "cite", "source", "sources", "trich dan", "nguon"],
  ["decision", "decided", "quyet dinh", "thong nhat"],
  ["diary", "journal", "memory", "memories", "nhat ky", "ky uc"],
  ["feedback", "comment", "comments", "review", "gop y", "nhan xet", "phan hoi"],
  ["fix", "fixed", "fixing", "repair", "sua", "sua loi", "khac phuc"],
  ["index", "indexed", "indexing", "chunk", "chunks", "embedding", "lap chi muc"],
  ["mood", "emotion", "feeling", "feelings", "tam trang", "cam xuc"],
  ["quota", "rate limit", "billing", "credit", "credits", "gioi han"],
  ["relieved", "relief", "nhe nhom", "do ap luc"],
  ["search", "semantic search", "retrieval", "tim kiem"],
  ["stress", "stressed", "anxious", "pressure", "cang thang", "lo lang", "ap luc"],
  ["summary", "summaries", "summarize", "tom tat"],
  ["task", "todo", "action item", "viec", "nhiem vu", "can lam"],
  ["trust", "trusted", "reliable", "tin tuong", "dang tin"],
  ["ui", "ux", "interface", "giao dien"],
  ["worker", "outbox", "pipeline", "heartbeat"],
] as const;

function groundingTokens(value: string): string[] {
  const normalized = normalizeForIntent(value).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const tokens = new Set(importantTokens(value));

  for (const conceptTerms of crossLanguageGroundingConcepts) {
    const normalizedTerms = conceptTerms.map((term) => normalizeForIntent(term));
    if (!normalizedTerms.some((term) => normalized.includes(term))) continue;

    tokens.add(`concept:${normalizedTerms[0].replace(/\s+/g, "_")}`);
  }

  return [...tokens];
}

function quoteContainsMeaningfulPhrase(value: string, quote: string): boolean {
  const normalizedValue = normalizeForIntent(value).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const normalizedQuote = normalizeForIntent(quote).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const compactValue = normalizedValue.replace(/\s+/g, " ").trim();
  return compactValue.length >= 4 && normalizedQuote.includes(compactValue);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
