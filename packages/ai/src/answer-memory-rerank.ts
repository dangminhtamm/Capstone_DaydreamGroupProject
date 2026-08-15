import {
  detectMemoryIntent,
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
import {
  getIntentProfile,
  getSourceReliabilityBoost,
  type IntentProfile,
} from "./answer-memory-intent-profiles.ts";
import type { MemorySearchHit, RetrievalFilters } from "./retrieval.ts";

type ScoreProfile = NonNullable<IntentProfile["rerank"]>;

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
  const temporalSpanDays = filters.startDate && filters.endDate
    ? (filters.endDate.getTime() - filters.startDate.getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  const broadTemporalRange = temporalSpanDays > 2;
  const annualTemporalRange = temporalSpanDays >= 330;

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
      const entityBoost = Math.min(
        0.1,
        Math.max(0, chunk.entityScore ?? 0) * 0.1,
      );
      const importanceBoost = getMetadataImportance(chunk.metadata) * 0.012;
      const sourceReliabilityBoost = getSourceReliabilityBoost(chunk.sourceType);
      const timeMatchBoost = hasTimeFilter ? 0.03 : 0;
      const primaryTemporalBoost = broadTemporalRange && isPrimaryMemorySource(chunk.sourceType)
        ? 0.055
        : 0;
      const annualSummaryBoost = annualTemporalRange
        ? getAnnualSummaryBoost(chunk)
        : 0;
      const intentBoost = getIntentSpecificBoost(normalizedQuestion, chunk);
      const noisePenalty = getMemoryNoisePenalty(chunk);
      const summaryPenalty = hasPrimarySources && chunk.sourceType === "summary" && !annualTemporalRange
        ? broadTemporalRange
          ? 0.14
          : 0.06
        : 0;

      const rerankScore =
        chunk.similarity +
        recencyBoost +
        preferredSourceBoost +
        preferredChunkBoost +
        lexicalBoost +
        titleBoost +
        metadataBoost +
        entityBoost +
        importanceBoost +
        sourceReliabilityBoost +
        timeMatchBoost +
        primaryTemporalBoost +
        annualSummaryBoost +
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

function getAnnualSummaryBoost(chunk: MemorySearchHit): number {
  if (chunk.sourceType !== "summary") return 0;

  const summaryType = getMetadataString(chunk.metadata, "summaryType").toLowerCase();
  const sourceTitle = getMetadataString(chunk.metadata, "sourceTitle").toLowerCase();
  if (summaryType === "yearly" || sourceTitle.includes("yearly")) return 0.18;
  if (summaryType === "monthly" || sourceTitle.includes("monthly")) return 0.1;
  return 0;
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

function isPrimaryMemorySource(sourceType: string): boolean {
  return sourceType !== "summary";
}

function getIntentSpecificBoost(normalizedQuestion: string, chunk: MemorySearchHit): number {
  const searchable = normalizeForIntent(
    `${chunk.text} ${chunk.evidence ?? ""} ${getMetadataSearchText(chunk.metadata)} ${getMetadataString(chunk.metadata, "sourceTitle")}`,
  );

  if (isFeedbackIntent(normalizedQuestion)) {
    const profile = getIntentProfile("feedback").rerank;
    let boost = applyConfiguredRerankProfile(0, profile, normalizedQuestion, searchable, chunk);
    if (isGoogleContactsSearchText(searchable) && !isGoogleContactsIntent(normalizedQuestion)) {
      boost -= profile?.googleContactsOffIntentPenalty ?? 0.34;
    }
    return boost;
  }

  if (isBlockerIntent(normalizedQuestion)) {
    const profile = getIntentProfile("blocker").rerank;
    let boost = applyConfiguredRerankProfile(0, profile, normalizedQuestion, searchable, chunk);
    if (hasOnlyQuestionListEvidence(searchable)) {
      boost -= profile?.onlyQuestionListPenalty ?? 0.24;
    }
    return boost;
  }

  if (isLatencyIntent(normalizedQuestion)) {
    const profile = getIntentProfile("latency").rerank;
    let boost = 0;
    if (hasOnlyQuestionListEvidence(searchable)) {
      boost -= profile?.onlyQuestionListPenalty ?? 0.22;
    }
    boost = applyConfiguredRerankProfile(boost, profile, normalizedQuestion, searchable, chunk);
    return boost;
  }

  if (isGmailIntent(normalizedQuestion)) {
    const profile = getIntentProfile("gmail").rerank;
    let boost = 0;
    const isGmailSource = chunk.sourceType === "gmail";
    const hasEmailEvidence = hasGmailEvidence(searchable);

    if (isGmailSource) {
      boost += profile?.sourceTypeBoosts?.gmail ?? 0.36;
    } else if (hasEmailEvidence) {
      boost += profile?.evidenceBoost ?? 0.12;
    } else {
      boost -= profile?.noDirectSupportPenalty ?? 0.2;
    }

    if (isGmailSource) boost += getQuestionMatchBoost(profile, normalizedQuestion);

    boost += profile?.chunkTypeBoosts?.[chunk.chunkType] ?? 0;
    boost += profile?.sourceChunkTypeBoosts?.[chunk.sourceType]?.[chunk.chunkType] ?? 0;
    if (hasLatencyEvidence(searchable) && !hasEmailEvidence) {
      boost -= profile?.latencyWithoutEvidencePenalty ?? 0.18;
    }
    return boost;
  }

  if (isMoodIntent(normalizedQuestion)) {
    const profile = getIntentProfile("mood").rerank;
    let boost = 0;
    if (isStressIntent(normalizedQuestion) && hasOnlyQuestionListEvidence(searchable)) {
      boost -= profile?.onlyQuestionListPenalty ?? 0.22;
    }
    boost = applyConfiguredRerankProfile(boost, profile, normalizedQuestion, searchable, chunk);
    return boost;
  }

  if (isGoogleContactsIntent(normalizedQuestion)) {
    return applyConfiguredRerankProfile(
      0,
      getIntentProfile("google_contacts").rerank,
      normalizedQuestion,
      searchable,
      chunk,
    );
  }

  const detectedIntent = getDetectedProfileIntent(normalizedQuestion);
  if (detectedIntent) {
    return applyConfiguredRerankProfile(
      0,
      getIntentProfile(detectedIntent).rerank,
      normalizedQuestion,
      searchable,
      chunk,
    );
  }

  return 0;
}

function getDetectedProfileIntent(normalizedQuestion: string) {
  const intent = detectMemoryIntent(normalizedQuestion);
  return intent === "drive" || intent === "calendar" ? intent : null;
}

function applyConfiguredRerankProfile(
  boost: number,
  profile: ScoreProfile | undefined,
  normalizedQuestion: string,
  searchable: string,
  chunk: MemorySearchHit,
): number {
  if (!profile) return boost;

  let nextBoost = boost;
  if (profile.evidenceKeywords && includesAny(searchable, profile.evidenceKeywords)) {
    nextBoost += profile.evidenceBoost ?? 0;
  }

  nextBoost += getQuestionEvidenceMatchBoost(profile, normalizedQuestion, searchable);
  nextBoost += profile.chunkTypeBoosts?.[chunk.chunkType] ?? 0;
  nextBoost += profile.sourceTypeBoosts?.[chunk.sourceType] ?? 0;
  nextBoost += profile.sourceChunkTypeBoosts?.[chunk.sourceType]?.[chunk.chunkType] ?? 0;
  nextBoost -= profile.sourceTypePenalties?.[chunk.sourceType] ?? 0;

  return nextBoost;
}

function getQuestionEvidenceMatchBoost(
  profile: ScoreProfile | undefined,
  normalizedQuestion: string,
  searchable: string,
): number {
  return profile?.queryEvidenceMatches
    ?.filter(
      (match) =>
        includesAny(normalizedQuestion, match.questionKeywords) &&
        includesAny(searchable, match.evidenceKeywords),
    )
    .reduce((total, match) => total + match.boost, 0) ?? 0;
}

function getQuestionMatchBoost(
  profile: ScoreProfile | undefined,
  normalizedQuestion: string,
): number {
  return profile?.queryEvidenceMatches
    ?.filter((match) => includesAny(normalizedQuestion, match.questionKeywords))
    .reduce((total, match) => total + match.boost, 0) ?? 0;
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
