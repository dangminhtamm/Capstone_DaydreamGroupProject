import type { MemoryIntent } from "./answer-memory-types.ts";
import { getIntentProfile } from "./answer-memory-intent-profiles.ts";

export function detectMemoryIntent(question: string): MemoryIntent {
  const normalizedQuestion = normalizeForIntent(question);

  if (isGoogleContactsIntent(normalizedQuestion)) return "google_contacts";
  if (isGmailIntent(normalizedQuestion)) return "gmail";
  if (isDriveIntent(normalizedQuestion)) return "drive";
  if (isLatencyIntent(normalizedQuestion)) return "latency";
  if (isBlockerIntent(normalizedQuestion)) return "blocker";
  if (isFeedbackIntent(normalizedQuestion)) return "feedback";
  if (isMoodIntent(normalizedQuestion)) return "mood";
  if (isCalendarIntent(normalizedQuestion)) return "calendar";
  if (isDecisionIntent(normalizedQuestion)) return "decision";
  if (isTaskIntent(normalizedQuestion)) return "task";
  if (isAttachmentIntent(normalizedQuestion)) return "attachment";
  if (isProgressIntent(normalizedQuestion)) return "progress";

  return "generic";
}

export function isFeedbackIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "feedback",
    "mentor",
    "review",
    "comment",
    "comments",
    "góp ý",
    "gop y",
    "nhận xét",
    "nhan xet",
  ]);
}

export function isLatencyIntent(normalizedQuestion: string): boolean {
  if (includesAny(normalizedQuestion, [
    "retrieval latency",
    "answer generation",
    "generation latency",
    "p95",
    "500ms",
    "500 ms",
    "500 millisecond",
    "latency",
    "separate retrieval",
    "embedding time",
    "database retrieval",
    "indexing performance",
    "index performance",
    "reranking",
    "time to first result",
    "độ trễ",
    "do tre",
  ])) {
    return true;
  }

  const hasBroadLatencyCue = includesAny(normalizedQuestion, [
    "separate",
    "separately",
    "tách",
    "tach",
    "performance",
    "hnsw",
    "gin index",
  ]);

  return hasBroadLatencyCue && includesAny(normalizedQuestion, [
    "retrieval",
    "generation",
    "embedding",
    "database",
    "reranking",
    "latency",
    "p95",
    "metric",
    "metrics",
    "timing",
    "response time",
    "query time",
    "speed",
    "slow",
    "fast",
    "vector",
    "semantic search",
    "độ trễ",
    "do tre",
  ]);
}

function isCalendarIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "calendar",
    "google calendar",
    "scheduled",
    "schedule",
    "appointment",
    "meeting",
    "lịch",
    "lich",
    "có sự kiện",
    "co su kien",
    "sự kiện gì",
    "su kien gi",
  ]);
}

function isDriveIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "google drive",
    "drive file",
    "drive files",
    "drive document",
    "drive documents",
    "drive folder",
    "drive",
    "google docs",
    "google slides",
    "google sheets",
    "tệp drive",
    "tep drive",
    "file drive",
    "tài liệu drive",
    "tai lieu drive",
  ]);
}

function isAttachmentIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "attachment",
    "attachments",
    "file",
    "pdf",
    "document",
    "upload",
    "uploaded",
    "tệp",
    "tep",
    "file đính kèm",
    "file dinh kem",
    "đính kèm",
    "dinh kem",
    "tai lieu",
    "tài liệu",
  ]);
}

function isProgressIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "progress",
    "work on",
    "worked on",
    "working on",
    "what did i work",
    "what have i worked",
    "accomplish",
    "accomplished",
    "achievement",
    "achievements",
    "completed",
    "summary",
    "summarize",
    "retrospective",
    "tiến độ",
    "tien do",
    "lam gi gan day",
    "làm gì gần đây",
    "lam duoc gi",
    "làm được gì",
    "da lam gi",
    "đã làm gì",
    "hoàn thành",
    "hoan thanh",
    "thành tựu",
    "thanh tuu",
    "tóm tắt",
    "tom tat",
  ]);
}

function isTaskIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "task",
    "action item",
    "assigned",
    "follow up",
    "remaining",
    "pending",
    "việc cần",
    "viec can",
    "cần làm",
    "can lam",
  ]);
}

function isDecisionIntent(normalizedQuestion: string): boolean {
  if (includesAny(normalizedQuestion, [
    "decide",
    "decision",
    "agreed",
    "scope decision",
    "future plan",
    "roadmap",
    "quyết định",
    "quyet dinh",
    "thống nhất",
    "thong nhat",
  ])) {
    return true;
  }

  if (includesAny(normalizedQuestion, [
    "plan for",
    "planned to",
    "planning to",
    "kế hoạch cho",
    "ke hoach cho",
  ])) {
    return true;
  }

  const hasPlanCue = includesAny(normalizedQuestion, [
    "plan",
    "planned",
    "planning",
    "kế hoạch",
    "ke hoach",
  ]);

  return hasPlanCue && includesAny(normalizedQuestion, [
    "future",
    "scope",
    "roadmap",
    "strategy",
    "prioritize",
    "priority",
    "next step",
    "next steps",
    "mvp",
    "demo",
    "project",
    "capstone",
    "triển khai",
    "trien khai",
  ]);
}

export function isBlockerIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "blocker",
    "blockers",
    "risk",
    "risks",
    "challenge",
    "challenges",
    "stuck",
    "problem",
    "issue",
    "trở ngại",
    "tro ngai",
    "rủi ro",
    "rui ro",
    "khó khăn",
    "kho khan",
    "vướng",
    "vuong",
  ]);
}

export function isMoodIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "mood",
    "emotion",
    "emotional",
    "feel",
    "felt",
    "stress",
    "stressed",
    "tâm trạng",
    "tam trang",
    "cảm xúc",
    "cam xuc",
    "cảm thấy",
    "cam thay",
    "căng thẳng",
    "cang thang",
  ]);
}

export function isGoogleContactsIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "google contacts",
    "contacts",
    "contact",
    "people api",
    "danh bạ",
    "danh ba",
  ]);
}

export function isGmailIntent(normalizedQuestion: string): boolean {
  if (includesAny(normalizedQuestion, [
    "google mail",
    "email",
    "e-mail",
    "inbox",
    "mail thread",
    "mail message",
    "email thread",
    "email message",
    "subject",
    "sender",
    "người gửi",
    "nguoi gui",
    "email gửi",
    "email gui",
    "thư gửi",
    "thu gui",
    "hộp thư",
    "hop thu",
  ])) {
    return true;
  }

  const asksAboutSentOrReceivedFeedback = includesAny(normalizedQuestion, [
    "send",
    "sent",
    "wrote",
    "emailed",
    "from",
    "gửi",
    "gui",
  ]) && includesAny(normalizedQuestion, [
    "feedback",
    "comment",
    "comments",
    "review",
    "mentor",
    "góp ý",
    "gop y",
    "nhận xét",
    "nhan xet",
    "phản hồi",
    "phan hoi",
  ]);

  const namesGmailAsSource = includesAny(normalizedQuestion, [
    "gmail",
    "google mail",
  ]) && includesAny(normalizedQuestion, [
    "feedback",
    "comment",
    "comments",
    "review",
    "mentor",
    "message",
    "messages",
    "thread",
    "inbox",
    "email",
    "sender",
    "sent",
    "send",
    "from",
    "góp ý",
    "gop y",
    "nhận xét",
    "nhan xet",
    "phản hồi",
    "phan hoi",
    "tin nhắn",
    "tin nhan",
    "người gửi",
    "nguoi gui",
    "hộp thư",
    "hop thu",
  ]);

  return asksAboutSentOrReceivedFeedback || namesGmailAsSource;
}

export function isCitationQuestion(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "citation",
    "citations",
    "cite",
    "source",
    "sources",
    "trich dan",
    "trích dẫn",
  ]);
}

export function hasCitationEvidence(searchable: string): boolean {
  return includesAny(searchable, [
    "citation",
    "citations",
    "citation cards",
    "citation ui",
    "evaluators can trust",
    "clear citations",
    "sources",
    "grounded",
    "trust",
    "citation support",
    "trich dan",
    "trích dẫn",
  ]);
}

export function hasBlockerEvidence(searchable: string): boolean {
  return includesAny(searchable, getEvidenceKeywords("blocker"));
}

export function hasLatencyEvidence(searchable: string): boolean {
  return includesAny(searchable, getEvidenceKeywords("latency"));
}

export function hasGmailEvidence(searchable: string): boolean {
  const hasIndexedGmailMessage = includesAny(searchable, [
    "gmail email from",
    "gmail message",
    "email from",
    "mail.google.com",
    "subject",
    "snippet",
    "sender",
    "inbox",
  ]) && includesAny(searchable, [
    "gmail",
    "email",
    "mail",
  ]);

  const hasGmailScopeDecision =
    includesAny(searchable, ["gmail", "google mail"]) &&
    includesAny(searchable, [
      "future work",
      "scope decision",
      "scope creep",
      "not add gmail",
      "stay as future work",
    ]);

  return hasIndexedGmailMessage || hasGmailScopeDecision;
}

export function hasDecisionEvidence(searchable: string): boolean {
  return includesAny(searchable, getEvidenceKeywords("decision"));
}

export function matchesDecisionSubject(normalizedQuestion: string, searchable: string): boolean {
  if (isGmailIntent(normalizedQuestion)) return hasGmailEvidence(searchable);
  if (isGoogleContactsIntent(normalizedQuestion)) return isGoogleContactsSearchText(searchable);
  if (isLatencyIntent(normalizedQuestion)) return hasLatencyEvidence(searchable);
  return true;
}

export function hasMoodEvidenceForQuestion(normalizedQuestion: string, searchable: string): boolean {
  if (isStressIntent(normalizedQuestion)) {
    return hasStressEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
  }

  return includesAny(searchable, getEvidenceKeywords("mood"));
}

export function isStressIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "stress",
    "stressed",
    "cang thang",
    "căng thẳng",
    "made me feel stressed",
    "lam toi cang thang",
    "làm tôi căng thẳng",
  ]);
}

function hasStressEvidence(searchable: string): boolean {
  return includesAny(searchable, [
    "felt stressed",
    "feel stressed",
    "stress because",
    "stressed because",
    "worried",
    "anxious",
    "cang thang",
    "căng thẳng",
    "lo lang",
    "lo lắng",
  ]);
}

export function hasOnlyQuestionListEvidence(searchable: string): boolean {
  return includesAny(searchable, [
    "demo account is ready",
    "best questions are",
    "sample questions",
    "test questions",
    "cau hoi test",
    "final ai memory checklist",
    "final checklist has six items",
    "checklist has six items",
    "asks search about",
    "ask search about",
    "asks about mentor feedback",
    "asks about blockers",
    "ask questions about feedback",
    "ask questions about feedback decisions blockers",
    "what feedback did",
    "what blockers did",
    "why did we separate",
    "what made me feel stressed",
  ]);
}

export function isGoogleContactsSearchText(searchable: string): boolean {
  return includesAny(searchable, [
    "google contacts",
    "people api",
    "contact names",
    "phone numbers",
    "organizations",
    "contact names emails",
    "danh bạ",
    "danh ba",
  ]);
}

export function hasRecentIntent(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return includesAny(normalized, [
    "recent",
    "recently",
    "latest",
    "last few",
    "this week",
    "tuần này",
    "tuan nay",
    "gần đây",
    "gan day",
    "mới nhất",
    "moi nhat",
  ]);
}

export function hasNormalizedPhrase(value: string, phrase: string): boolean {
  return normalizeForIntent(value).includes(normalizeForIntent(phrase));
}

export function normalizeForIntent(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalizeForIntent(needle)));
}

function getEvidenceKeywords(intent: MemoryIntent): string[] {
  const profile = getIntentProfile(intent).score;
  return profile?.directEvidenceKeywords ?? profile?.evidenceKeywords ?? [];
}
