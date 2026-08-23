import type { MemoryIntent } from "./answer-memory-types.ts";
import type { RetrievalFilters } from "./retrieval.ts";

type RetrievalProfile = Pick<
  RetrievalFilters,
  "sourceTypes" | "preferredSourceTypes" | "preferredChunkTypes" | "vectorWeight" | "lexicalWeight"
>;

type QueryEvidenceMatch = {
  questionKeywords: string[];
  evidenceKeywords: string[];
  boost: number;
};

type ScoreProfile = {
  directEvidenceKeywords?: string[];
  evidenceKeywords?: string[];
  evidenceBoost?: number;
  queryEvidenceMatches?: QueryEvidenceMatch[];
  chunkTypeBoosts?: Record<string, number>;
  sourceTypeBoosts?: Record<string, number>;
  sourceTypePenalties?: Record<string, number>;
  sourceChunkTypeBoosts?: Record<string, Record<string, number>>;
  noDirectSupportPenalty?: number;
  onlyQuestionListPenalty?: number;
  googleContactsOffIntentPenalty?: number;
  latencyWithoutEvidencePenalty?: number;
};

type EvidenceSelectionProfile = {
  evidenceFirst?: boolean;
  directSupportBoost?: number;
  groupMaxDrop?: number;
  maxGroups?: number;
  maxCitations?: number;
  perGroupCitationLimit?: number;
};

type FallbackProfile = {
  minimumScore?: number;
  maxScoreDrop?: number;
  maxSources?: number;
  broadMaxSources?: number;
};

type FastProfile = {
  temporalMaxCitations?: number;
  temporalBroadMaxCitations?: number;
  genericMaxCitations?: number;
  genericBroadMaxCitations?: number;
  perSourceLimitByType?: Record<string, number>;
};

export type IntentProfile = {
  retrieval?: RetrievalProfile;
  score?: ScoreProfile;
  rerank?: ScoreProfile;
  evidenceSelection?: EvidenceSelectionProfile;
  fallback?: FallbackProfile;
  fast?: FastProfile;
};

const CITATION_QUESTION_KEYWORDS = ["citation", "citations", "trich dan", "trích dẫn"];
const CITATION_EVIDENCE_KEYWORDS = [
  "citation",
  "citations",
  "cite",
  "source",
  "trust",
  "ui",
  "trich dan",
  "trích dẫn",
];

const BLOCKER_EVIDENCE_KEYWORDS = [
  "main blocker",
  "main risk",
  "another risk",
  "risk is",
  "risk was",
  "blocked by",
  "blocked on",
  "blocker",
  "risk",
  "challenge is",
  "challenge was",
  "challenge",
  "stuck",
  "quota",
  "worker",
  "indexing",
  "fallback",
  "blocked",
  "worker is off",
  "worker is running",
  "not created yet",
  "slow or unavailable",
  "tro ngai chinh",
  "trở ngại",
  "trở ngại chính",
  "rui ro chinh",
  "rủi ro",
  "rủi ro chính",
  "rủi ro là",
  "kho khan la",
  "khó khăn",
  "khó khăn là",
  "bi ket",
  "bị kẹt",
];

const BLOCKER_DIRECT_EVIDENCE_KEYWORDS = [
  "main blocker",
  "main risk",
  "another risk",
  "risk is",
  "risk was",
  "blocked by",
  "blocked on",
  "challenge is",
  "challenge was",
  "stuck",
  "quota",
  "worker",
  "indexing",
  "worker is off",
  "worker is running",
  "not created yet",
  "slow or unavailable",
  "trở ngại chính",
  "rủi ro chính",
  "rủi ro là",
  "khó khăn là",
  "bị kẹt",
  "bi ket",
];

const LATENCY_EVIDENCE_KEYWORDS = [
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
  "total answer time",
  "p95 retrieval latency",
  "average full answer latency",
  "separate",
  "separately",
];

const LATENCY_DIRECT_EVIDENCE_KEYWORDS = [
  "retrieval latency",
  "answer generation",
  "generation latency",
  "embedding time",
  "database retrieval",
  "reranking",
  "time to first result",
  "total answer time",
  "p95 retrieval latency",
  "average full answer latency",
  "500 millisecond",
  "500 ms",
];

const FEEDBACK_EVIDENCE_KEYWORDS = [
  "feedback",
  "mentor",
  "review",
  "gop y",
  "góp ý",
  "nhan xet",
  "nhận xét",
];

const GMAIL_QUERY_KEYWORDS = ["feedback", "comment", "review", "gop y", "nhan xet"];

const MOOD_EVIDENCE_KEYWORDS = [
  "felt",
  "feel",
  "stress",
  "stressed",
  "worried",
  "confident",
  "relieved",
  "great",
  "good mood",
  "neutral",
  "mood",
  "emotion",
  "căng thẳng",
  "tâm trạng",
  "cảm xúc",
];

const MOOD_DIRECT_EVIDENCE_KEYWORDS = [
  "mood",
  "felt",
  "feel",
  "emotion",
  "stressed",
  "stress",
  "relieved",
  "worried",
  "great",
  "good mood",
  "neutral",
  "tâm trạng",
  "cảm xúc",
  "căng thẳng",
];

const MOOD_RERANK_EVIDENCE_KEYWORDS = [
  ...MOOD_EVIDENCE_KEYWORDS,
  "blocker",
  "risk",
  "weak",
  "quota",
  "bad",
];

const DECISION_EVIDENCE_KEYWORDS = [
  "decided",
  "decide",
  "decision",
  "agreed",
  "scope decision",
  "future plan",
  "plan for",
  "will stay",
  "will not",
  "should prioritize",
  "quyet dinh",
  "quyết định",
  "ke hoach",
  "kế hoạch",
  "thong nhat",
  "thống nhất",
];

const DECISION_DIRECT_EVIDENCE_KEYWORDS = [
  "decided",
  "decision",
  "agreed",
  "scope decision",
  "future plan",
  "plan for",
  "will stay",
  "will not",
  "should prioritize",
  "quyết định",
  "thống nhất",
  "kế hoạch",
];

const PROGRESS_EVIDENCE_KEYWORDS = [
  "accomplished",
  "built",
  "completed",
  "finished",
  "implemented",
  "improved",
  "made progress",
  "next step",
  "next steps",
  "planned",
  "progress",
  "shipped",
  "worked on",
  "hoan thanh",
  "ke hoach",
  "lam",
  "tien do",
];

const GOOGLE_CONTACTS_EVIDENCE_KEYWORDS = [
  "google contacts",
  "contacts",
  "people api",
  "contact names",
  "emails",
  "phone numbers",
  "organizations",
  "danh bạ",
  "danh ba",
];

const DEFAULT_FAST_PROFILE: Required<FastProfile> = {
  temporalMaxCitations: 3,
  temporalBroadMaxCitations: 6,
  genericMaxCitations: 1,
  genericBroadMaxCitations: 6,
  perSourceLimitByType: {
    attachment: 2,
    calendar: 2,
  },
};

const DEFAULT_EVIDENCE_SELECTION: Required<EvidenceSelectionProfile> = {
  evidenceFirst: false,
  directSupportBoost: 0.5,
  groupMaxDrop: 0.22,
  maxGroups: 1,
  maxCitations: 2,
  perGroupCitationLimit: 2,
};

const DEFAULT_FALLBACK: Required<FallbackProfile> = {
  minimumScore: 0.38,
  maxScoreDrop: 0.28,
  maxSources: 4,
  broadMaxSources: 6,
};

export const SOURCE_RELIABILITY_BOOSTS: Record<string, number> = {
  attachment: 0.025,
  calendar: 0.03,
  diary: 0.035,
  gmail: 0.045,
  summary: -0.015,
};

export const DRIVE_RETRIEVAL_PROFILE: RetrievalProfile = {
  sourceTypes: ["drive"],
  preferredSourceTypes: ["drive"],
  preferredChunkTypes: ["general_note", "general"],
  vectorWeight: 0.62,
  lexicalWeight: 0.38,
};

export const DIARY_RETRIEVAL_PROFILE: RetrievalProfile = {
  sourceTypes: ["diary"],
  preferredSourceTypes: ["diary"],
  preferredChunkTypes: ["general", "general_note", "reflection", "event"],
  vectorWeight: 0.65,
  lexicalWeight: 0.35,
};

export const PEOPLE_RETRIEVAL_PROFILE: RetrievalProfile = {
  preferredSourceTypes: ["diary", "calendar", "contact"],
  preferredChunkTypes: ["event", "feedback", "decision", "general", "general_note"],
  vectorWeight: 0.6,
  lexicalWeight: 0.4,
};

export const INTENT_PROFILES: Record<MemoryIntent, IntentProfile> = {
  attachment: {
    retrieval: {
      sourceTypes: ["attachment"],
      preferredSourceTypes: ["attachment"],
      preferredChunkTypes: ["general_note", "general"],
      vectorWeight: 0.62,
      lexicalWeight: 0.38,
    },
  },
  blocker: {
    retrieval: {
      sourceTypes: ["diary", "calendar", "summary"],
      preferredSourceTypes: ["diary", "summary"],
      preferredChunkTypes: ["reflection", "action_item", "general", "general_note"],
      vectorWeight: 0.62,
      lexicalWeight: 0.38,
    },
    score: {
      directEvidenceKeywords: BLOCKER_DIRECT_EVIDENCE_KEYWORDS,
      evidenceKeywords: BLOCKER_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.45,
      chunkTypeBoosts: { action_item: 0.08, reflection: 0.08 },
      onlyQuestionListPenalty: 0.5,
    },
    rerank: {
      evidenceKeywords: BLOCKER_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.16,
      chunkTypeBoosts: { action_item: 0.05, reflection: 0.05 },
      onlyQuestionListPenalty: 0.24,
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.7,
      groupMaxDrop: 0.2,
    },
    fallback: {
      minimumScore: 0.5,
      maxScoreDrop: 0.22,
    },
  },
  calendar: {
    retrieval: {
      sourceTypes: ["calendar"],
      preferredSourceTypes: ["calendar"],
      preferredChunkTypes: ["event", "general"],
      vectorWeight: 0.6,
      lexicalWeight: 0.4,
    },
    rerank: {
      sourceTypeBoosts: { calendar: 0.34 },
      sourceTypePenalties: { diary: 0.24, summary: 0.24, drive: 0.14, attachment: 0.14, gmail: 0.14 },
    },
  },
  decision: {
    retrieval: {
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["decision", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    },
    score: {
      directEvidenceKeywords: DECISION_DIRECT_EVIDENCE_KEYWORDS,
      evidenceKeywords: DECISION_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.32,
      chunkTypeBoosts: { decision: 0.1 },
    },
    evidenceSelection: {
      evidenceFirst: true,
    },
    fallback: {
      minimumScore: 0.5,
      maxScoreDrop: 0.22,
    },
  },
  feedback: {
    retrieval: {
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["feedback", "general", "general_note"],
      vectorWeight: 0.55,
      lexicalWeight: 0.45,
    },
    score: {
      evidenceKeywords: FEEDBACK_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.35,
      queryEvidenceMatches: [
        {
          questionKeywords: CITATION_QUESTION_KEYWORDS,
          evidenceKeywords: CITATION_EVIDENCE_KEYWORDS,
          boost: 0.28,
        },
      ],
      chunkTypeBoosts: { feedback: 0.12 },
      googleContactsOffIntentPenalty: 0.55,
    },
    rerank: {
      evidenceKeywords: [...FEEDBACK_EVIDENCE_KEYWORDS, "citation", "citations", "trust", "ui"],
      evidenceBoost: 0.18,
      queryEvidenceMatches: [
        {
          questionKeywords: CITATION_QUESTION_KEYWORDS,
          evidenceKeywords: CITATION_EVIDENCE_KEYWORDS,
          boost: 0.16,
        },
      ],
      chunkTypeBoosts: { feedback: 0.08 },
      googleContactsOffIntentPenalty: 0.34,
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.7,
      groupMaxDrop: 0.28,
      maxGroups: 2,
      maxCitations: 3,
    },
    fallback: {
      minimumScore: 0.5,
      maxScoreDrop: 0.22,
    },
  },
  generic: {
    fast: {
      perSourceLimitByType: { diary: 2 },
    },
  },
  drive: {
    retrieval: DRIVE_RETRIEVAL_PROFILE,
    score: {
      sourceTypeBoosts: { drive: 0.65 },
      sourceTypePenalties: { diary: 0.35, summary: 0.35, calendar: 0.2, attachment: 0.18 },
    },
    rerank: {
      sourceTypeBoosts: { drive: 0.34 },
      sourceTypePenalties: { diary: 0.24, summary: 0.24, calendar: 0.14, attachment: 0.12 },
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.65,
      groupMaxDrop: 0.2,
    },
    fallback: {
      minimumScore: 0.48,
      maxScoreDrop: 0.22,
    },
  },
  gmail: {
    retrieval: {
      sourceTypes: ["gmail"],
      preferredSourceTypes: ["gmail"],
      preferredChunkTypes: ["general_note", "feedback", "general", "decision"],
      vectorWeight: 0.5,
      lexicalWeight: 0.5,
    },
    score: {
      evidenceBoost: 0.35,
      sourceTypeBoosts: { gmail: 0.75 },
      sourceTypePenalties: { diary: 0.45, summary: 0.45, calendar: 0.24, drive: 0.24, attachment: 0.24 },
      noDirectSupportPenalty: 0.45,
      queryEvidenceMatches: [
        {
          questionKeywords: GMAIL_QUERY_KEYWORDS,
          evidenceKeywords: ["gmail"],
          boost: 0.2,
        },
      ],
      chunkTypeBoosts: { decision: 0.08, feedback: 0.08 },
      sourceChunkTypeBoosts: { gmail: { general_note: 0.06 } },
      latencyWithoutEvidencePenalty: 0.35,
    },
    rerank: {
      evidenceBoost: 0.12,
      sourceTypeBoosts: { gmail: 0.36 },
      sourceTypePenalties: { diary: 0.32, summary: 0.32, calendar: 0.18, drive: 0.18, attachment: 0.18 },
      noDirectSupportPenalty: 0.2,
      queryEvidenceMatches: [
        {
          questionKeywords: GMAIL_QUERY_KEYWORDS,
          evidenceKeywords: ["gmail"],
          boost: 0.12,
        },
      ],
      chunkTypeBoosts: { decision: 0.06, feedback: 0.06 },
      sourceChunkTypeBoosts: { gmail: { general_note: 0.04 } },
      latencyWithoutEvidencePenalty: 0.18,
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.7,
      groupMaxDrop: 0.2,
      perGroupCitationLimit: 2,
    },
    fallback: {
      minimumScore: 0.5,
      maxScoreDrop: 0.22,
    },
  },
  google_contacts: {
    retrieval: {
      preferredSourceTypes: ["contact", "diary"],
      preferredChunkTypes: ["general_note", "general", "decision"],
      vectorWeight: 0.58,
      lexicalWeight: 0.42,
    },
    score: {
      evidenceBoost: 0.6,
      noDirectSupportPenalty: 0.45,
    },
    rerank: {
      evidenceKeywords: GOOGLE_CONTACTS_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.2,
      sourceTypeBoosts: { contact: 0.28 },
      chunkTypeBoosts: { action_item: 0.05, decision: 0.05 },
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.7,
      groupMaxDrop: 0.2,
    },
    fallback: {
      minimumScore: 0.5,
      maxScoreDrop: 0.22,
    },
  },
  latency: {
    retrieval: {
      preferredSourceTypes: ["diary", "summary"],
      preferredChunkTypes: ["decision", "general_note", "general", "action_item"],
      vectorWeight: 0.55,
      lexicalWeight: 0.45,
    },
    score: {
      directEvidenceKeywords: LATENCY_DIRECT_EVIDENCE_KEYWORDS,
      evidenceKeywords: LATENCY_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.55,
      chunkTypeBoosts: { decision: 0.06, general_note: 0.06 },
      onlyQuestionListPenalty: 0.45,
    },
    rerank: {
      evidenceKeywords: LATENCY_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.22,
      chunkTypeBoosts: { decision: 0.04, general_note: 0.04 },
      onlyQuestionListPenalty: 0.22,
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.7,
      groupMaxDrop: 0.28,
      maxGroups: 2,
      maxCitations: 4,
      perGroupCitationLimit: 3,
    },
    fallback: {
      minimumScore: 0.5,
      maxScoreDrop: 0.22,
    },
  },
  mood: {
    retrieval: {
      sourceTypes: ["diary", "summary"],
      preferredSourceTypes: ["diary", "summary"],
      preferredChunkTypes: ["reflection", "general", "general_note"],
      vectorWeight: 0.68,
      lexicalWeight: 0.32,
    },
    score: {
      directEvidenceKeywords: MOOD_DIRECT_EVIDENCE_KEYWORDS,
      evidenceKeywords: MOOD_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.38,
      chunkTypeBoosts: { reflection: 0.08 },
    },
    rerank: {
      evidenceKeywords: MOOD_RERANK_EVIDENCE_KEYWORDS,
      evidenceBoost: 0.12,
      chunkTypeBoosts: { reflection: 0.06 },
      onlyQuestionListPenalty: 0.22,
    },
    evidenceSelection: {
      evidenceFirst: true,
      directSupportBoost: 0.65,
      groupMaxDrop: 0.2,
    },
    fallback: {
      minimumScore: 0.45,
    },
  },
  progress: {
    retrieval: {
      sourceTypes: ["diary", "calendar", "summary"],
      preferredSourceTypes: ["diary", "calendar"],
      preferredChunkTypes: ["event", "decision", "action_item", "reflection", "general", "general_note"],
      vectorWeight: 0.64,
      lexicalWeight: 0.36,
    },
    score: {
      sourceTypeBoosts: { calendar: 0.14, diary: 0.14 },
      sourceTypePenalties: { attachment: 0.22, drive: 0.22, summary: 0.16 },
      queryEvidenceMatches: [
        {
          questionKeywords: ["progress", "week", "across"],
          evidenceKeywords: PROGRESS_EVIDENCE_KEYWORDS,
          boost: 0.14,
        },
      ],
    },
    fallback: {
      broadMaxSources: 6,
      maxSources: 6,
    },
    fast: {
      temporalBroadMaxCitations: 6,
      temporalMaxCitations: 6,
      perSourceLimitByType: { diary: 2 },
    },
  },
  task: {
    retrieval: {
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["action_item", "task_update", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    },
    fast: {
      perSourceLimitByType: { diary: 2 },
    },
  },
};

export function getIntentProfile(intent: MemoryIntent): IntentProfile {
  return INTENT_PROFILES[intent] ?? INTENT_PROFILES.generic;
}

export function getIntentRetrievalProfile(intent: MemoryIntent): RetrievalProfile | undefined {
  return getIntentProfile(intent).retrieval;
}

export function getIntentEvidenceSelection(intent: MemoryIntent): Required<EvidenceSelectionProfile> {
  return {
    ...DEFAULT_EVIDENCE_SELECTION,
    ...(getIntentProfile(intent).evidenceSelection ?? {}),
  };
}

export function getIntentFallbackProfile(intent: MemoryIntent): Required<FallbackProfile> {
  return {
    ...DEFAULT_FALLBACK,
    ...(getIntentProfile(intent).fallback ?? {}),
  };
}

export function getTemporalFastMaxCitations(intent: MemoryIntent, broadSynthesis: boolean): number {
  const fastProfile = getFastProfile(intent);
  return broadSynthesis
    ? fastProfile.temporalBroadMaxCitations
    : fastProfile.temporalMaxCitations;
}

export function getGenericFastMaxCitations(intent: MemoryIntent, broadSynthesis: boolean): number {
  const fastProfile = getFastProfile(intent);
  return broadSynthesis
    ? fastProfile.genericBroadMaxCitations
    : fastProfile.genericMaxCitations;
}

export function getFastPerSourceLimit(intent: MemoryIntent, sourceType: string): number {
  const profileLimit = getIntentProfile(intent).fast?.perSourceLimitByType?.[sourceType];
  if (profileLimit !== undefined) return profileLimit;
  return DEFAULT_FAST_PROFILE.perSourceLimitByType[sourceType] ?? 1;
}

export function getSourceReliabilityBoost(sourceType: string): number {
  return SOURCE_RELIABILITY_BOOSTS[sourceType] ?? 0;
}

function getFastProfile(intent: MemoryIntent): Required<FastProfile> {
  const profile = getIntentProfile(intent).fast ?? {};
  return {
    ...DEFAULT_FAST_PROFILE,
    ...profile,
    perSourceLimitByType: {
      ...DEFAULT_FAST_PROFILE.perSourceLimitByType,
      ...(profile.perSourceLimitByType ?? {}),
    },
  };
}
