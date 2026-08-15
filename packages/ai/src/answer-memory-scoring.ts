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
import {
  getIntentProfile,
  type IntentProfile,
} from "./answer-memory-intent-profiles.ts";

export type FallbackTopic = MemoryIntent;
type ScoreProfile = NonNullable<IntentProfile["score"]>;

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

  const scoreProfile = getIntentProfile(fallbackTopic).score;

  if (fallbackTopic === "google_contacts") {
    return score + (isGoogleContactsSource(source)
      ? (scoreProfile?.evidenceBoost ?? 0.6)
      : -(scoreProfile?.noDirectSupportPenalty ?? 0.45));
  }

  if (fallbackTopic === "blocker") {
    score = applyConfiguredScoreProfile(score, scoreProfile, normalizedQuestion, searchable, source);
    if (hasOnlyQuestionListEvidence(searchable)) {
      score -= scoreProfile?.onlyQuestionListPenalty ?? 0.5;
    }
    return score;
  }

  if (fallbackTopic === "feedback") {
    score = applyConfiguredScoreProfile(score, scoreProfile, normalizedQuestion, searchable, source);
    if (isGoogleContactsSource(source) && !isGoogleContactsIntent(normalizedQuestion)) {
      score -= scoreProfile?.googleContactsOffIntentPenalty ?? 0.55;
    }
    return score;
  }

  if (fallbackTopic === "latency") {
    score = applyConfiguredScoreProfile(score, scoreProfile, normalizedQuestion, searchable, source);
    if (hasOnlyQuestionListEvidence(searchable)) {
      score -= scoreProfile?.onlyQuestionListPenalty ?? 0.45;
    }
    return score;
  }

  if (fallbackTopic === "gmail") {
    const isGmailSource = source.sourceType === "gmail";
    const hasEmailEvidence = hasGmailEvidence(searchable);

    if (isGmailSource) {
      score += scoreProfile?.sourceTypeBoosts?.gmail ?? 0.75;
    } else if (hasEmailEvidence) {
      score += scoreProfile?.evidenceBoost ?? 0.35;
    } else {
      score -= scoreProfile?.noDirectSupportPenalty ?? 0.45;
    }

    if (isGmailSource) score += getQuestionMatchBoost(scoreProfile, normalizedQuestion);

    score += scoreProfile?.chunkTypeBoosts?.[source.chunkType] ?? 0;
    score += scoreProfile?.sourceChunkTypeBoosts?.[source.sourceType]?.[source.chunkType] ?? 0;
    if (hasLatencyEvidence(searchable) && !hasEmailEvidence) {
      score -= scoreProfile?.latencyWithoutEvidencePenalty ?? 0.35;
    }
    return score;
  }

  if (fallbackTopic === "mood") {
    score = applyConfiguredScoreProfile(score, scoreProfile, normalizedQuestion, searchable, source);
    return score;
  }

  if (fallbackTopic === "decision") {
    score = applyConfiguredScoreProfile(score, scoreProfile, normalizedQuestion, searchable, source);
  }

  if (fallbackTopic === "progress") {
    score = applyConfiguredScoreProfile(score, scoreProfile, normalizedQuestion, searchable, source);
  }

  if (isGoogleContactsSource(source)) {
    score -= 0.18;
  }

  return score;
}

function applyConfiguredScoreProfile(
  score: number,
  profile: ScoreProfile | undefined,
  normalizedQuestion: string,
  searchable: string,
  source: MemoryCitation,
): number {
  if (!profile) return score;

  let nextScore = score;
  if (profile.evidenceKeywords && includesAny(searchable, profile.evidenceKeywords)) {
    nextScore += profile.evidenceBoost ?? 0;
  }

  nextScore += getQuestionEvidenceMatchBoost(profile, normalizedQuestion, searchable);
  nextScore += profile.chunkTypeBoosts?.[source.chunkType] ?? 0;
  nextScore += profile.sourceTypeBoosts?.[source.sourceType] ?? 0;
  nextScore += profile.sourceChunkTypeBoosts?.[source.sourceType]?.[source.chunkType] ?? 0;
  nextScore -= profile.sourceTypePenalties?.[source.sourceType] ?? 0;

  return nextScore;
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
