import {
  hasGmailEvidence,
  hasLatencyEvidence,
  hasOnlyQuestionListEvidence,
  hasRecentIntent,
  includesAny,
  isBlockerIntent,
  isFeedbackIntent,
  isGmailIntent,
  isGoogleContactsIntent,
  isGoogleContactsSearchText,
  isLatencyIntent,
  isMoodIntent,
  isStressIntent,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import {
  countOverlap,
  importantTokens,
} from "./answer-memory-scoring.ts";
import type { MemorySearchHit, RetrievalFilters } from "./retrieval.ts";

export function rerankMemoryHits(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters = {},
): MemorySearchHit[] {
  if (chunks.length <= 1) return chunks;

  const queryTokens = new Set(importantTokens(question));
  const latestTimestamp = Math.max(
    ...chunks.map((chunk) => new Date(chunk.occurredAt).getTime()).filter(Number.isFinite),
  );
  const hasPrimarySources = chunks.some((chunk) => chunk.sourceType !== "summary");
  const recentIntent = hasRecentIntent(question);
  const normalizedQuestion = normalizeForIntent(question);
  const preferredSourceTypes = new Set(filters.preferredSourceTypes ?? []);
  const preferredChunkTypes = new Set(filters.preferredChunkTypes ?? []);
  const hasTimeFilter = Boolean(filters.startDate && filters.endDate);

  return chunks
    .map((chunk) => {
      const evidenceTokens = new Set(importantTokens(`${chunk.text} ${chunk.evidence ?? ""}`));
      const titleTokens = new Set(importantTokens(getMetadataString(chunk.metadata, "sourceTitle")));
      const metadataTokens = new Set(importantTokens(getMetadataSearchText(chunk.metadata)));
      const overlap = countOverlap(queryTokens, evidenceTokens);
      const titleOverlap = countOverlap(queryTokens, titleTokens);
      const metadataOverlap = countOverlap(queryTokens, metadataTokens);
      const overlapRatio = queryTokens.size ? overlap / queryTokens.size : 0;
      const titleRatio = queryTokens.size ? titleOverlap / queryTokens.size : 0;
      const metadataRatio = queryTokens.size ? metadataOverlap / queryTokens.size : 0;
      const occurredAt = new Date(chunk.occurredAt).getTime();
      const ageDays = Number.isFinite(occurredAt) && Number.isFinite(latestTimestamp)
        ? Math.max(0, (latestTimestamp - occurredAt) / (24 * 60 * 60 * 1000))
        : 0;
      const recencyBoost = recentIntent ? Math.max(0, 0.08 - ageDays * 0.01) : 0;
      const preferredSourceBoost = preferredSourceTypes.has(chunk.sourceType) ? 0.06 : 0;
      const preferredChunkBoost = preferredChunkTypes.has(chunk.chunkType) ? 0.05 : 0;
      const lexicalBoost = Math.min(0.1, overlapRatio * 0.1);
      const titleBoost = Math.min(0.04, titleRatio * 0.04);
      const metadataBoost = Math.min(0.08, metadataRatio * 0.08);
      const importanceBoost = getMetadataImportance(chunk.metadata) * 0.012;
      const sourceReliabilityBoost = getSourceReliabilityBoost(chunk.sourceType);
      const timeMatchBoost = hasTimeFilter ? 0.03 : 0;
      const intentBoost = getIntentSpecificBoost(normalizedQuestion, chunk);
      const noisePenalty = getMemoryNoisePenalty(chunk);
      const summaryPenalty = hasPrimarySources && chunk.sourceType === "summary" ? 0.06 : 0;

      const rerankScore =
        chunk.similarity +
        recencyBoost +
        preferredSourceBoost +
        preferredChunkBoost +
        lexicalBoost +
        titleBoost +
        metadataBoost +
        importanceBoost +
        sourceReliabilityBoost +
        timeMatchBoost +
        intentBoost -
        noisePenalty -
        summaryPenalty;

      return {
        ...chunk,
        similarity: clampScore(rerankScore),
        rerankScore,
      };
    })
    .sort(
      (a, b) =>
        b.rerankScore - a.rerankScore ||
        b.similarity - a.similarity ||
        b.occurredAt.getTime() - a.occurredAt.getTime(),
    )
    .map(({ rerankScore: _rerankScore, ...chunk }) => chunk);
}

function getMetadataString(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getMetadataSearchText(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = metadata as Record<string, unknown>;
  return ["people", "projects", "goals", "habits", "tags"]
    .flatMap((key) => {
      const item = value[key];
      if (Array.isArray(item)) return item.filter((entry): entry is string => typeof entry === "string");
      return typeof item === "string" ? [item] : [];
    })
    .join(" ");
}

function getMetadataImportance(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const raw = (metadata as Record<string, unknown>).importance;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

function getSourceReliabilityBoost(sourceType: string): number {
  switch (sourceType) {
    case "diary":
      return 0.035;
    case "calendar":
      return 0.03;
    case "attachment":
      return 0.025;
    case "summary":
      return -0.015;
    default:
      return 0;
  }
}

function getIntentSpecificBoost(normalizedQuestion: string, chunk: MemorySearchHit): number {
  const searchable = normalizeForIntent(
    `${chunk.text} ${chunk.evidence ?? ""} ${getMetadataSearchText(chunk.metadata)} ${getMetadataString(chunk.metadata, "sourceTitle")}`,
  );

  if (isFeedbackIntent(normalizedQuestion)) {
    let boost = 0;
    if (includesAny(searchable, ["feedback", "mentor", "review", "linh", "citation", "citations", "trust", "ui", "gop y", "góp ý", "nhan xet", "nhận xét"])) {
      boost += 0.18;
    }
    if (
      includesAny(normalizedQuestion, ["citation", "citations", "trich dan", "trích dẫn"]) &&
      includesAny(searchable, ["citation", "citations", "cite", "source", "trust", "ui", "trich dan", "trích dẫn"])
    ) {
      boost += 0.16;
    }
    if (chunk.chunkType === "feedback") {
      boost += 0.08;
    }
    if (isGoogleContactsSearchText(searchable) && !isGoogleContactsIntent(normalizedQuestion)) {
      boost -= 0.34;
    }
    return boost;
  }

  if (isBlockerIntent(normalizedQuestion)) {
    let boost = 0;
    if (includesAny(searchable, ["blocker", "risk", "challenge", "stuck", "quota", "worker", "indexing", "fallback", "blocked", "trở ngại", "rủi ro", "khó khăn"])) {
      boost += 0.16;
    }
    if (chunk.chunkType === "action_item" || chunk.chunkType === "reflection") {
      boost += 0.05;
    }
    if (hasOnlyQuestionListEvidence(searchable)) {
      boost -= 0.24;
    }
    return boost;
  }

  if (isLatencyIntent(normalizedQuestion)) {
    let boost = 0;
    if (hasOnlyQuestionListEvidence(searchable)) {
      boost -= 0.22;
    }
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
      boost += 0.22;
    }
    if (chunk.chunkType === "decision" || chunk.chunkType === "general_note") {
      boost += 0.04;
    }
    return boost;
  }

  if (isGmailIntent(normalizedQuestion)) {
    let boost = 0;
    if (hasGmailEvidence(searchable)) {
      boost += 0.24;
    } else {
      boost -= 0.12;
    }
    if (chunk.chunkType === "decision" || chunk.chunkType === "feedback") {
      boost += 0.06;
    }
    if (hasLatencyEvidence(searchable) && !hasGmailEvidence(searchable)) {
      boost -= 0.18;
    }
    return boost;
  }

  if (isMoodIntent(normalizedQuestion)) {
    let boost = 0;
    if (isStressIntent(normalizedQuestion) && hasOnlyQuestionListEvidence(searchable)) {
      boost -= 0.22;
    }
    if (includesAny(searchable, ["stress", "stressed", "worried", "confident", "relieved", "mood", "emotion", "blocker", "risk", "weak", "quota", "bad", "căng thẳng", "tâm trạng", "cảm xúc"])) {
      boost += 0.12;
    }
    if (chunk.chunkType === "reflection") {
      boost += 0.06;
    }
    return boost;
  }

  if (isGoogleContactsIntent(normalizedQuestion)) {
    let boost = 0;
    if (chunk.sourceType === "contact") {
      boost += 0.28;
    }
    if (includesAny(searchable, ["google contacts", "contacts", "people api", "contact names", "emails", "phone numbers", "organizations", "danh bạ", "danh ba"])) {
      boost += 0.2;
    }
    if (chunk.chunkType === "decision" || chunk.chunkType === "action_item") {
      boost += 0.05;
    }
    return boost;
  }

  return 0;
}

function getMemoryNoisePenalty(chunk: MemorySearchHit): number {
  const searchable = normalizeForIntent(
    `${chunk.text} ${chunk.evidence ?? ""} ${getMetadataString(chunk.metadata, "sourceTitle")}`,
  );

  if (hasOnlyQuestionListEvidence(searchable)) {
    return 0.22;
  }

  if (/^(the mood is|my mood is|the mood was)\b/u.test(searchable.trim())) {
    return 0.14;
  }

  return 0;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
