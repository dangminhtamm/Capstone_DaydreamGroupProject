import {
  type MemoryCitation,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";
import type {
  AnswerMemoryResult,
  MemoryIntent,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  buildIntentNoMemoryMessage,
  buildReadableClaim,
  formatIntentEvidenceAnswer,
} from "./answer-memory-format.ts";
import {
  hasBlockerEvidence,
  hasCitationEvidence,
  hasDecisionEvidence,
  hasGmailEvidence,
  hasLatencyEvidence,
  hasMoodEvidenceForQuestion,
  hasOnlyQuestionListEvidence,
  includesAny,
  isCitationQuestion,
  isGoogleContactsSearchText,
  matchesDecisionSubject,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import {
  countOverlap,
  importantTokens,
  scoreSourceForIntent,
} from "./answer-memory-scoring.ts";
import {
  buildQueryAnalytics,
  noMemoryResult,
} from "./answer-memory-result.ts";
import {
  getIntentEvidenceSelection,
  getIntentProfile,
} from "./answer-memory-intent-profiles.ts";

export function answerIntentEvidenceFastPath(
  question: string,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  lang: ResponseLanguage,
  intent: MemoryIntent,
  timeZone = "UTC",
): AnswerMemoryResult | null {
  if (!isEvidenceFirstIntent(intent)) return null;

  const citations = selectIntentEvidenceSources(question, sources, intent).map((source) => ({
    ...source,
    claim: buildReadableClaim(source),
  }));
  if (!citations.length) return null;

  const answer = formatIntentEvidenceAnswer(question, citations, intent, lang, timeZone);
  const confidence = classifyRetrievalConfidence(
    citations[0]?.similarity ?? 0,
    citations.length,
  );

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: buildQueryAnalytics({
      model: "intent-evidence-fast-path",
      chunksRetrieved,
      status: "success",
      answerMode: "fast_path",
    }),
  };
}

export function buildUnsupportedIntentNoMemoryResult(
  question: string,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  lang: ResponseLanguage,
  intent: MemoryIntent,
): AnswerMemoryResult | null {
  if (!isEvidenceFirstIntent(intent)) return null;
  if (selectIntentEvidenceSources(question, sources, intent).length > 0) return null;

  const result = noMemoryResult(
    buildIntentNoMemoryMessage(question, intent, lang),
    lang,
  );
  result.analytics = buildQueryAnalytics({
    model: "intent-evidence-fast-path",
    chunksRetrieved,
    status: "no_memory",
    answerMode: "no_memory",
  });
  return result;
}

export function isEvidenceFirstIntent(intent: MemoryIntent): boolean {
  return getIntentEvidenceSelection(intent).evidenceFirst;
}

export function selectIntentEvidenceSources(
  question: string,
  sources: MemoryCitation[],
  intent: MemoryIntent,
): MemoryCitation[] {
  if (!sources.length || !isEvidenceFirstIntent(intent)) return [];

  const normalizedQuestion = normalizeForIntent(question);
  const groups = buildCitationGroups(sources)
    .map((group) => scoreCitationGroup(normalizedQuestion, group, intent))
    .filter((group) => group.directSupport)
    .sort((a, b) => b.score - a.score || b.topSimilarity - a.topSimilarity);

  if (!groups.length) return [];

  const topScore = groups[0]?.score ?? 0;
  const evidenceSelection = getIntentEvidenceSelection(intent);
  const maxGroupDrop = evidenceSelection.groupMaxDrop;
  const maxGroups = evidenceSelection.maxGroups;
  const maxCitations = evidenceSelection.maxCitations;

  const selectedGroups = groups
    .filter((group) => group.score >= topScore - maxGroupDrop)
    .slice(0, maxGroups);

  const selected = selectedGroups.flatMap((group) =>
    selectRepresentativeCitationsFromGroup(normalizedQuestion, group, intent),
  );

  return dedupeCitationsByChunk(selected).slice(0, maxCitations);
}

type CitationGroup = {
  key: string;
  citations: MemoryCitation[];
  searchable: string;
  topSimilarity: number;
};

type ScoredCitationGroup = CitationGroup & {
  score: number;
  directSupport: boolean;
};

function buildCitationGroups(sources: MemoryCitation[]): CitationGroup[] {
  const groups = new Map<string, MemoryCitation[]>();

  for (const source of sources) {
    const key = `${source.sourceType}:${source.sourceId}`;
    const group = groups.get(key) ?? [];
    group.push(source);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, citations]) => ({
    key,
    citations,
    searchable: normalizeForIntent(
      citations
        .map((citation) => `${citation.sourceTitle ?? ""} ${citation.chunkType} ${citation.quote}`)
        .join(" "),
    ),
    topSimilarity: Math.max(...citations.map((citation) => citation.similarity)),
  }));
}

function scoreCitationGroup(
  normalizedQuestion: string,
  group: CitationGroup,
  intent: MemoryIntent,
): ScoredCitationGroup {
  const queryTokens = new Set(importantTokens(normalizedQuestion));
  const groupTokens = new Set(importantTokens(group.searchable));
  const overlapRatio = queryTokens.size
    ? countOverlap(queryTokens, groupTokens) / queryTokens.size
    : 0;
  const bestCitationScore = Math.max(
    ...group.citations.map((citation) =>
      scoreSourceForIntent(normalizedQuestion, citation, intent),
    ),
  );
  const directSupport = groupDirectlySupportsIntent(normalizedQuestion, group, intent);

  return {
    ...group,
    score:
      bestCitationScore +
      overlapRatio * 0.35 +
      (directSupport ? getIntentEvidenceSelection(intent).directSupportBoost : -0.6),
    directSupport,
  };
}

function groupDirectlySupportsIntent(
  normalizedQuestion: string,
  group: CitationGroup,
  intent: MemoryIntent,
): boolean {
  const searchable = group.searchable;

  switch (intent) {
    case "feedback":
      return (
        includesAny(searchable, getFeedbackEvidenceKeywords()) &&
        (!isCitationQuestion(normalizedQuestion) || hasCitationEvidence(searchable))
      );
    case "blocker":
      return hasBlockerEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "latency":
      return hasLatencyEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "gmail":
      return group.citations.some((citation) => citation.sourceType === "gmail") ||
        hasGmailEvidence(searchable);
    case "google_contacts":
      return isGoogleContactsSearchText(searchable);
    case "decision":
      return hasDecisionEvidence(searchable) && matchesDecisionSubject(normalizedQuestion, searchable);
    case "mood":
      return hasMoodEvidenceForQuestion(normalizedQuestion, searchable);
    default:
      return false;
  }
}

function selectRepresentativeCitationsFromGroup(
  normalizedQuestion: string,
  group: ScoredCitationGroup,
  intent: MemoryIntent,
): MemoryCitation[] {
  const perGroupLimit = getIntentEvidenceSelection(intent).perGroupCitationLimit;
  const scored = group.citations
    .map((citation) => {
      const searchable = normalizeForIntent(
        `${citation.sourceTitle ?? ""} ${citation.chunkType} ${citation.quote}`,
      );
      const relevance =
        scoreSourceForIntent(normalizedQuestion, citation, intent) +
        (citationDirectlySupportsIntent(normalizedQuestion, searchable, intent, citation.sourceType) ? 0.45 : 0);

      return { citation, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance || b.citation.similarity - a.citation.similarity);

  return scored
    .filter((item, index) => {
      if (index === 0) return true;
      return citationDirectlySupportsIntent(
        normalizedQuestion,
        normalizeForIntent(`${item.citation.sourceTitle ?? ""} ${item.citation.chunkType} ${item.citation.quote}`),
        intent,
        item.citation.sourceType,
      );
    })
    .slice(0, perGroupLimit)
    .map((item) => item.citation);
}

function citationDirectlySupportsIntent(
  normalizedQuestion: string,
  searchable: string,
  intent: MemoryIntent,
  sourceType?: string,
): boolean {
  switch (intent) {
    case "feedback":
      return (
        includesAny(searchable, getFeedbackEvidenceKeywords()) ||
        (isCitationQuestion(normalizedQuestion) && hasCitationEvidence(searchable))
      );
    case "blocker":
      return hasBlockerEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "latency":
      return hasLatencyEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "gmail":
      return sourceType === "gmail" || hasGmailEvidence(searchable);
    case "google_contacts":
      return isGoogleContactsSearchText(searchable);
    case "decision":
      return hasDecisionEvidence(searchable) && matchesDecisionSubject(normalizedQuestion, searchable);
    case "mood":
      return hasMoodEvidenceForQuestion(normalizedQuestion, searchable);
    default:
      return false;
  }
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

function getFeedbackEvidenceKeywords(): string[] {
  return getIntentProfile("feedback").score?.evidenceKeywords ?? [
    "feedback",
    "mentor",
    "review",
    "gop y",
    "nhan xet",
  ];
}
