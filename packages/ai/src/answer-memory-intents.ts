import type { MemoryIntent } from "./answer-memory-types.ts";

export function detectMemoryIntent(question: string): MemoryIntent {
  const normalizedQuestion = normalizeForIntent(question);

  if (isGoogleContactsIntent(normalizedQuestion)) return "google_contacts";
  if (isGmailIntent(normalizedQuestion)) return "gmail";
  if (isLatencyIntent(normalizedQuestion)) return "latency";
  if (isBlockerIntent(normalizedQuestion)) return "blocker";
  if (isFeedbackIntent(normalizedQuestion)) return "feedback";
  if (isMoodIntent(normalizedQuestion)) return "mood";
  if (isCalendarIntent(normalizedQuestion)) return "calendar";
  if (isAttachmentIntent(normalizedQuestion)) return "attachment";
  if (isDecisionIntent(normalizedQuestion)) return "decision";
  if (isTaskIntent(normalizedQuestion)) return "task";
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
    "citation",
    "citations",
    "cite",
    "source",
    "sources",
    "linh",
    "góp ý",
    "gop y",
    "nhận xét",
    "nhan xet",
    "trích dẫn",
    "trich dan",
  ]);
}

export function isLatencyIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "retrieval latency",
    "answer generation",
    "generation latency",
    "p95",
    "500ms",
    "500 ms",
    "500 millisecond",
    "latency",
    "separate retrieval",
    "separate",
    "separately",
    "embedding time",
    "database retrieval",
    "reranking",
    "time to first result",
    "độ trễ",
    "do tre",
    "tách",
    "tach",
  ]);
}

export function isCalendarIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "calendar",
    "google calendar",
    "scheduled",
    "appointment",
    "meeting",
    "event",
    "lịch",
    "lich",
    "sự kiện",
    "su kien",
  ]);
}

export function isAttachmentIntent(normalizedQuestion: string): boolean {
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

export function isProgressIntent(normalizedQuestion: string): boolean {
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

export function isTaskIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "task",
    "action item",
    "follow up",
    "remaining",
    "pending",
    "việc cần",
    "viec can",
    "cần làm",
    "can lam",
  ]);
}

export function isDecisionIntent(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, [
    "decide",
    "decision",
    "agreed",
    "scope decision",
    "plan",
    "planned",
    "future plan",
    "roadmap",
    "quyết định",
    "quyet dinh",
    "kế hoạch",
    "ke hoach",
    "thống nhất",
    "thong nhat",
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
  return includesAny(normalizedQuestion, [
    "gmail",
    "google mail",
  ]);
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
  return includesAny(searchable, [
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
  ]);
}

export function hasLatencyEvidence(searchable: string): boolean {
  return includesAny(searchable, [
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
  ]);
}

export function hasGmailEvidence(searchable: string): boolean {
  return (
    includesAny(searchable, ["gmail", "google mail"]) &&
    includesAny(searchable, [
      "future work",
      "scope decision",
      "scope creep",
      "not add gmail",
      "stay as future work",
    ])
  );
}

export function hasDecisionEvidence(searchable: string): boolean {
  return includesAny(searchable, [
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
  ]);
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

  return includesAny(searchable, [
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
  ]);
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

export function hasStressEvidence(searchable: string): boolean {
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
