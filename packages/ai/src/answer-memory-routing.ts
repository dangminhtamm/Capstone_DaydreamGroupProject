import { buildCitations } from "./answer-utils.ts";
import type {
  AnswerStrategy,
  MemoryIntent,
} from "./answer-memory-types.ts";
import {
  DEFAULT_MAX_ANSWER_TOKENS,
  DEFAULT_PROMPT_SOURCE_LIMIT,
  DEFAULT_REASONING_MAX_ANSWER_TOKENS,
  DEFAULT_RETRIEVAL_CANDIDATE_LIMIT,
} from "./answer-memory-config.ts";
import {
  includesAny,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import { selectIntentEvidenceSources, isEvidenceFirstIntent } from "./answer-memory-evidence.ts";
import type { MemorySearchHit, RetrievalFilters } from "./retrieval.ts";

export function shouldExpandTemporalEvidenceSearch(
  question: string,
  intent: MemoryIntent,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  if (!["blocker", "mood"].includes(intent)) return false;
  if (!includesAny(normalizeForIntent(question), ["this week", "tuan nay", "tuần này"])) {
    return false;
  }

  const currentSources = buildCitations(chunks);
  return selectIntentEvidenceSources(question, currentSources, intent).length === 0;
}

export function buildExpandedTemporalFilters(filters: RetrievalFilters): RetrievalFilters {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDate = filters.startDate
    ? new Date(filters.startDate.getTime() - 7 * dayMs)
    : filters.startDate;

  return {
    ...filters,
    startDate,
    limit: Math.min(Math.max(filters.limit ?? DEFAULT_RETRIEVAL_CANDIDATE_LIMIT, 16), 20),
  };
}

export function requiresGenerativeReasoning(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return includesAny(normalized, [
    "why",
    "how",
    "compare",
    "comparison",
    "difference",
    "similar",
    "pattern",
    "trend",
    "analyze",
    "analysis",
    "insight",
    "blocker",
    "blockers",
    "risk",
    "risks",
    "challenge",
    "challenges",
    "stuck",
    "stress",
    "stressed",
    "mood",
    "feel",
    "felt",
    "emotion",
    "trở ngại",
    "tro ngai",
    "rủi ro",
    "rui ro",
    "khó khăn",
    "kho khan",
    "vướng",
    "vuong",
    "căng thẳng",
    "cang thang",
    "tâm trạng",
    "tam trang",
    "vì sao",
    "vi sao",
    "tại sao",
    "tai sao",
    "như thế nào",
    "nhu the nao",
    "so sánh",
    "so sanh",
    "khác gì",
    "khac gi",
    "phân tích",
    "phan tich",
    "cảm thấy",
    "cam thay",
    "cảm xúc",
    "cam xuc",
  ]);
}

export function selectPromptSourceLimit(question: string, intent: MemoryIntent): number {
  const configured = Math.min(Math.max(DEFAULT_PROMPT_SOURCE_LIMIT, 2), 8);
  if (isBroadTemporalSynthesisQuestion(question, intent)) return Math.max(configured, 8);
  if (intent === "progress") return Math.max(configured, 8);
  if (["feedback", "blocker", "latency"].includes(intent)) return Math.max(configured, 6);
  if (!requiresGenerativeReasoning(question)) return configured;
  return Math.max(configured, 6);
}

export function selectMaxAnswerTokens(question: string): number {
  const configured = Math.min(Math.max(DEFAULT_MAX_ANSWER_TOKENS, 256), 2048);
  if (isBroadTemporalSynthesisQuestion(question)) {
    return Math.min(
      Math.max(DEFAULT_REASONING_MAX_ANSWER_TOKENS, configured),
      4096,
    );
  }
  if (!requiresGenerativeReasoning(question)) return configured;
  return Math.min(
    Math.max(DEFAULT_REASONING_MAX_ANSWER_TOKENS, configured),
    4096,
  );
}

export function shouldUseIntentEvidenceFastPath(
  question: string,
  intent: MemoryIntent,
  answerStrategy: AnswerStrategy = "auto",
): boolean {
  if (answerStrategy === "deep") return false;
  if (answerStrategy === "fast") return true;
  if (!isEvidenceFirstIntent(intent)) return false;

  // Auto should stay cheap for direct lookup questions, but use Gemini when the
  // user explicitly asks for synthesis, causality, comparison, or analysis.
  return !hasAutoDeepReasoningCue(question);
}

export function shouldUseAutoFastPath(
  question: string,
  intent: MemoryIntent,
  filters: RetrievalFilters = {},
): boolean {
  if (hasAutoDeepReasoningCue(question)) return false;
  if (hasExplicitTemporalFilter(filters)) {
    return !requiresGenerativeReasoning(question) &&
      !isBroadTemporalSynthesisQuestion(question, intent, filters);
  }
  if (isBroadTemporalSynthesisQuestion(question, intent, filters)) return false;
  if (isEvidenceFirstIntent(intent)) return true;
  if (["calendar", "attachment", "task"].includes(intent)) {
    return hasDirectLookupCue(question);
  }

  return hasDirectLookupCue(question) || hasExplicitDateCue(question);
}

export function isBroadTemporalSynthesisQuestion(
  question: string,
  intent: MemoryIntent = "generic",
  filters: RetrievalFilters = {},
): boolean {
  const normalized = normalizeForIntent(question);
  const broadTemporalCue = includesAny(normalized, [
    "recently",
    "recent",
    "lately",
    "latest",
    "newest",
    "this week",
    "last week",
    "this month",
    "last month",
    "gần đây",
    "gan day",
    "gần nhất",
    "gan nhat",
    "mới nhất",
    "moi nhat",
    "tuần này",
    "tuan nay",
    "tuần trước",
    "tuan truoc",
    "tháng này",
    "thang nay",
    "tháng trước",
    "thang truoc",
  ]);
  const workOrSynthesisCue = intent === "progress" || includesAny(normalized, [
    "work on",
    "worked on",
    "working on",
    "what did i work",
    "what have i worked",
    "what did i do",
    "what have i done",
    "summarize",
    "summary",
    "progress",
    "accomplish",
    "accomplished",
    "làm gì",
    "lam gi",
    "làm được gì",
    "lam duoc gi",
    "đã làm gì",
    "da lam gi",
    "tóm tắt",
    "tom tat",
    "tiến độ",
    "tien do",
  ]);
  const temporalSpanMs = filters.startDate && filters.endDate
    ? filters.endDate.getTime() - filters.startDate.getTime()
    : 0;
  const broadFilter = temporalSpanMs > 2 * 24 * 60 * 60 * 1000;

  return workOrSynthesisCue && (broadTemporalCue || broadFilter);
}

export function buildIntentInstruction(intent: MemoryIntent, lang: "en" | "vi"): string {
  const vi = lang === "vi";

  switch (intent) {
    case "feedback":
      return vi
        ? "Tập trung vào phản hồi/góp ý được hỏi. Bỏ qua ký ức chỉ nhắc tên người trong bối cảnh không liên quan như Google Contacts."
        : "Focus on the requested feedback. Ignore memories that only mention a person's name in unrelated contexts such as Google Contacts.";
    case "blocker":
      return vi
        ? "Chỉ trả lời bằng blocker/rủi ro/vấn đề thật. Bỏ qua ký ức chỉ liệt kê câu hỏi demo hoặc nói rằng user đã hỏi về blockers."
        : "Answer with actual blockers/risks/issues. Ignore memories that only list demo questions or say the user asked about blockers.";
    case "latency":
      return vi
        ? "Tập trung vào lý do đo retrieval latency tách khỏi answer generation và các metric timing liên quan."
        : "Focus on why retrieval latency is measured separately from answer generation and on the related timing metrics.";
    case "gmail":
      return vi
        ? "Tập trung vào quyết định/phạm vi liên quan đến Gmail. Bỏ qua nguồn chỉ nói về latency, benchmark, hoặc câu hỏi demo."
        : "Focus on the decision or scope related to Gmail. Ignore sources that only discuss latency, benchmarks, or demo questions.";
    case "google_contacts":
      return vi
        ? "Tập trung vào kế hoạch Google Contacts/People API, không lẫn với Calendar hoặc Diary chung."
        : "Focus on the Google Contacts/People API plan, not general Calendar or Diary notes.";
    case "mood":
      return vi
        ? "Tập trung vào cảm xúc, stress, mood, confidence hoặc relief được ghi rõ trong memory."
        : "Focus on explicitly recorded emotions, stress, mood, confidence, or relief.";
    default:
      return vi
        ? "Nếu nhiều nguồn liên quan, ưu tiên nguồn trả lời trực tiếp câu hỏi thay vì nguồn chỉ trùng từ khóa."
        : "If several sources are related, prefer the source that directly answers the question rather than a source that only shares keywords.";
  }
}

function hasAutoDeepReasoningCue(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return includesAny(normalized, [
    "why",
    "how",
    "compare",
    "comparison",
    "difference",
    "similar",
    "pattern",
    "trend",
    "analyze",
    "analysis",
    "insight",
    "summarize",
    "summary",
    "vì sao",
    "vi sao",
    "tại sao",
    "tai sao",
    "như thế nào",
    "nhu the nao",
    "so sánh",
    "so sanh",
    "khác gì",
    "khac gi",
    "phân tích",
    "phan tich",
    "tổng hợp",
    "tong hop",
    "tóm tắt",
    "tom tat",
    "xu hướng",
    "xu huong",
  ]);
}

function hasExplicitTemporalFilter(filters: RetrievalFilters): boolean {
  return Boolean(filters.startDate && filters.endDate);
}

function hasDirectLookupCue(question: string): boolean {
  const normalized = normalizeForIntent(question).replace(/[^\p{Letter}\p{Number}\s\/.-]/gu, " ");
  const compact = normalized.replace(/\s+/g, " ").trim();

  if (!compact) return false;

  return (
    /^(what|when|who|where|which)\b/u.test(compact) ||
    /\b(what happened|what did|what was|what were|when was|when did|who was|who did|where was|which)\b/u.test(compact) ||
    /\b(did i|did we|was i|were we)\b/u.test(compact) ||
    /\b(khi nao|luc nao|ai la|ai da|o dau|lam gi|da lam gi|hom nay|hom qua|hom truoc|ngay nao|su kien nao|lich nao)\b/u.test(compact)
  );
}

function hasExplicitDateCue(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return (
    /\b20\d{2}-\d{1,2}-\d{1,2}\b/u.test(normalized) ||
    /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-](?:20)?\d{2})?\b/u.test(normalized) ||
    includesAny(normalized, [
      "today",
      "yesterday",
      "tomorrow",
      "this week",
      "last week",
      "this month",
      "last month",
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
      "hom nay",
      "hom qua",
      "hom truoc",
      "ngay",
      "tuan nay",
      "tuan truoc",
      "thang",
    ])
  );
}
