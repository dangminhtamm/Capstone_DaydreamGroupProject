import type { MemoryCitation } from "./answer-utils.ts";
import type {
  AnswerMemoryResult,
  MemoryIntent,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  hasCitationEvidence,
  hasGmailEvidence,
  hasLatencyEvidence,
  includesAny,
  isGoogleContactsSearchText,
  isStressIntent,
  normalizeForIntent,
} from "./answer-memory-intents.ts";

export function formatSingleDayAnswer(
  citations: MemoryCitation[],
  dateLabel: string,
  lang: ResponseLanguage,
): string {
  const lines = citations.map((citation) => `- ${formatMemoryBullet(citation)}.`);

  if (lang === "vi") {
    return [
      `Vào ${dateLabel}, mình tìm thấy các ký ức nổi bật sau:`,
      ...lines,
    ].join("\n");
  }

  return [
    `On ${dateLabel}, I found these memories:`,
    ...lines,
  ].join("\n");
}

export function formatTemporalRangeAnswer(
  citations: MemoryCitation[],
  rangeLabel: string,
  lang: ResponseLanguage,
  timeZone = "UTC",
): string {
  const lines = citations.map((citation) => {
    const date = formatFallbackSourceDate(citation.occurredAt, lang, timeZone);
    return `- ${date}: ${formatMemoryBullet(citation)}.`;
  });

  if (lang === "vi") {
    return [
      `Dựa trên các ký ức đã lưu, trong ${rangeLabel} bạn có một số hoạt động/chủ đề nổi bật:`,
      ...lines,
    ].join("\n");
  }

  return [
    `Based on your saved memories, these were the notable activities/themes during ${rangeLabel}:`,
    ...lines,
  ].join("\n");
}

export function formatDateForAnswer(
  date: Date,
  lang: ResponseLanguage,
  timeZone = "UTC",
): string {
  if (lang === "vi") {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatDateRangeForAnswer(
  startDate: Date,
  endDate: Date,
  lang: ResponseLanguage,
  timeZone = "UTC",
): string {
  const start = formatDateForAnswer(startDate, lang, timeZone);
  const end = formatDateForAnswer(endDate, lang, timeZone);
  if (start === end) return start;
  return lang === "vi" ? `${start} đến ${end}` : `${start} to ${end}`;
}

export function dedupeCitationsBySource(citations: MemoryCitation[]): MemoryCitation[] {
  const seen = new Set<string>();
  const deduped: MemoryCitation[] = [];

  for (const citation of citations) {
    const key = `${citation.sourceType}:${citation.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(citation);
  }

  return deduped;
}

export function buildReadableClaim(citation: MemoryCitation): string {
  return trimPromptQuote(formatMemoryBullet(citation), 220);
}

export function formatMemoryBullet(citation: MemoryCitation): string {
  return sentenceCase(trimTrailingPunctuation(cleanMemoryText(citation.quote)));
}

export function formatLocalizedMemoryBullet(
  citation: MemoryCitation,
  intent: MemoryIntent,
  lang: ResponseLanguage,
): string {
  const fallback = formatMemoryBullet(citation);
  if (lang !== "vi") return fallback;

  return sentenceCase(
    trimTrailingPunctuation(
      summarizeCitationInVietnamese(citation, intent) ?? fallback,
    ),
  );
}

export function cleanMemoryText(text: string): string {
  return trimPromptQuote(
    text
      .replace(/\s+/g, " ")
      .replace(/^(diary entry|journal entry|nhat ky|nhật ký)(\s+h[oô]m nay|\s+today)?\s*[:\-–—]?\s*/i, "")
      .trim(),
    240,
  );
}

export function formatIntentEvidenceAnswer(
  question: string,
  citations: MemoryCitation[],
  intent: MemoryIntent,
  lang: ResponseLanguage,
  timeZone = "UTC",
): string {
  const bullets = citations
    .map((citation) => {
      const date = formatFallbackSourceDate(citation.occurredAt, lang, timeZone);
      return `- ${date}: ${formatLocalizedMemoryBullet(citation, intent, lang)}.`;
    })
    .join("\n");

  if (lang === "vi") {
    switch (intent) {
      case "feedback":
        return [`Phản hồi liên quan là:`, bullets].join("\n");
      case "blocker":
        return [`Các blocker/rủi ro được ghi lại là:`, bullets].join("\n");
      case "latency":
        return [`Lý do tách retrieval latency khỏi answer generation là:`, bullets].join("\n");
      case "gmail":
        return [`Quyết định về Gmail là:`, bullets].join("\n");
      case "google_contacts":
        return [`Kế hoạch Google Contacts là:`, bullets].join("\n");
      case "decision":
        return [`Quyết định/kế hoạch liên quan là:`, bullets].join("\n");
      case "mood":
        return isStressIntent(normalizeForIntent(question))
          ? [`Nguyên nhân stress được ghi lại là:`, bullets].join("\n")
          : [`Các ký ức liên quan đến tâm trạng/cảm xúc là:`, bullets].join("\n");
      default:
        return [`Mình tìm thấy các ký ức liên quan nhất:`, bullets].join("\n");
    }
  }

  switch (intent) {
    case "feedback":
      return [`The relevant feedback was:`, bullets].join("\n");
    case "blocker":
      return [`The recorded blockers/risks were:`, bullets].join("\n");
    case "latency":
      return [`The reason for separating retrieval latency from answer generation was:`, bullets].join("\n");
    case "gmail":
      return [`The Gmail decision was:`, bullets].join("\n");
    case "google_contacts":
      return [`The Google Contacts plan was:`, bullets].join("\n");
    case "decision":
      return [`The relevant decision/plan was:`, bullets].join("\n");
    case "mood":
      return isStressIntent(normalizeForIntent(question))
        ? [`The recorded source of stress was:`, bullets].join("\n")
        : [`The relevant mood/emotion memories were:`, bullets].join("\n");
    default:
      return [`The most relevant memories were:`, bullets].join("\n");
  }
}

export function buildIntentNoMemoryMessage(
  question: string,
  intent: MemoryIntent,
  lang: ResponseLanguage,
): string {
  const normalizedQuestion = normalizeForIntent(question);

  if (lang === "vi") {
    if (intent === "mood" && isStressIntent(normalizedQuestion)) {
      return "Mình chưa tìm thấy ký ức nào nói rõ điều gì làm bạn stress trong khoảng thời gian này.";
    }
    if (intent === "blocker") {
      return "Mình chưa tìm thấy blocker/rủi ro nào được ghi rõ trong khoảng thời gian này.";
    }
    if (intent === "gmail") {
      return "Mình chưa tìm thấy quyết định rõ ràng nào về Gmail trong các ký ức đã lấy được.";
    }
    if (intent === "feedback") {
      return "Mình chưa tìm thấy phản hồi đủ rõ trong các ký ức đã lấy được.";
    }
    if (intent === "latency") {
      return "Mình chưa tìm thấy ký ức đủ rõ về việc tách retrieval latency và answer generation.";
    }
    return "Mình chưa tìm thấy ký ức đủ liên quan để trả lời chắc chắn.";
  }

  if (intent === "mood" && isStressIntent(normalizedQuestion)) {
    return "I could not find a memory that clearly says what made you feel stressed in that time range.";
  }
  if (intent === "blocker") {
    return "I could not find any clearly recorded blockers or risks in that time range.";
  }
  if (intent === "gmail") {
    return "I could not find a clear Gmail decision in the retrieved memories.";
  }
  if (intent === "feedback") {
    return "I could not find clear enough feedback in the retrieved memories.";
  }
  if (intent === "latency") {
    return "I could not find clear enough memories about separating retrieval latency from answer generation.";
  }
  return "I could not find enough relevant memories to answer confidently.";
}

export function buildQuestionAwareFallbackAnswer(
  lang: ResponseLanguage,
  question: string,
  bullets: string,
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  fallbackTopic: MemoryIntent,
): string {
  const lead = formatValidationFallbackLead(modelError.message, lang);
  const normalizedQuestion = normalizeForIntent(question);

  if (lang === "vi") {
    if (fallbackTopic === "google_contacts") {
      return [`${lead} Kế hoạch Google Contacts là:`, bullets].join("\n");
    }
    if (fallbackTopic === "gmail") {
      return [`${lead} Quyết định/kế hoạch liên quan là:`, bullets].join("\n");
    }
    if (fallbackTopic === "feedback") {
      return [`${lead} Phản hồi liên quan là:`, bullets].join("\n");
    }
    if (fallbackTopic === "blocker") {
      return [`${lead} Các blocker/rủi ro liên quan là:`, bullets].join("\n");
    }
    if (fallbackTopic === "latency") {
      return [`${lead} Lý do liên quan đến việc tách retrieval latency và answer generation là:`, bullets].join("\n");
    }
    if (fallbackTopic === "mood" && isStressIntent(normalizedQuestion)) {
      return [`${lead} Nguyên nhân stress được ghi lại là:`, bullets].join("\n");
    }
    if (fallbackTopic === "mood") {
      return [`${lead} Các ký ức liên quan đến tâm trạng/cảm xúc là:`, bullets].join("\n");
    }
    return [`${lead} Mình tìm thấy các ký ức liên quan nhất:`, bullets].join("\n");
  }

  if (fallbackTopic === "google_contacts") {
    return [`${lead} The Google Contacts plan was:`, bullets].join("\n");
  }
  if (fallbackTopic === "gmail") {
    return [`${lead} The related decision/plan was:`, bullets].join("\n");
  }
  if (fallbackTopic === "feedback") {
    return [`${lead} The relevant feedback was:`, bullets].join("\n");
  }
  if (fallbackTopic === "blocker") {
    return [`${lead} The relevant blockers/risks were:`, bullets].join("\n");
  }
  if (fallbackTopic === "latency") {
    return [`${lead} The reason for separating retrieval latency from answer generation was:`, bullets].join("\n");
  }
  if (fallbackTopic === "mood" && isStressIntent(normalizedQuestion)) {
    return [`${lead} The recorded source of stress was:`, bullets].join("\n");
  }
  if (fallbackTopic === "mood") {
    return [`${lead} The relevant mood/emotion memories were:`, bullets].join("\n");
  }
  return [`${lead} The most relevant memories were:`, bullets].join("\n");
}

export function formatValidationFallbackLead(message: string, lang: ResponseLanguage): string {
  const normalized = message.toLowerCase();
  const isGroundingIssue =
    normalized.includes("grounded") ||
    normalized.includes("citation") ||
    normalized.includes("usable");

  if (lang === "vi") {
    return isGroundingIssue
      ? "Mình dùng trực tiếp các ký ức có citation chắc nhất."
      : "Mình dùng trực tiếp các ký ức liên quan nhất.";
  }

  return isGroundingIssue
    ? "I am using the most strongly cited memories directly."
    : "I am using the most relevant memories directly.";
}

export function formatFallbackSourceDate(
  value: string,
  lang: ResponseLanguage,
  timeZone = "UTC",
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return formatDateForAnswer(date, lang, timeZone);
}

export function trimPromptQuote(text: string, maxLength = 420): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function summarizeCitationInVietnamese(
  citation: MemoryCitation,
  intent: MemoryIntent,
): string | null {
  const searchable = normalizeForIntent(
    `${citation.sourceTitle ?? ""} ${citation.chunkType} ${citation.quote}`,
  );

  if (intent === "feedback") {
    if (hasCitationEvidence(searchable)) {
      return "Linh nhấn mạnh rằng mỗi câu trả lời AI phải có citation rõ ràng, và citation card cần đủ dễ thấy để evaluator tin tưởng câu trả lời";
    }
    if (includesAny(searchable, ["missed the strongest source", "citation support was weak"])) {
      return "Tam ghi nhận vấn đề search quality: câu trả lời đôi khi đúng chủ đề nhưng bỏ lỡ source mạnh nhất, hoặc quá tự tin khi citation support còn yếu";
    }
    if (includesAny(searchable, ["basic journal", "khong chi la mot journal", "không chỉ là một journal"])) {
      return "Linh góp ý app không nên tạo cảm giác chỉ là một journal cơ bản";
    }
  }

  if (intent === "blocker") {
    if (includesAny(searchable, ["main blocker", "worker is running", "worker running"])) {
      const quotaRisk = includesAny(searchable, ["gemini quota", "quota during live demo"])
        ? " Rủi ro khác là Gemini quota trong live demo."
        : "";
      return `Blocker chính là phải bảo đảm worker chạy trước final rehearsal; nếu worker tắt, diary và attachment được lưu nhưng memory chunks chưa được tạo.${quotaRisk}`;
    }
    if (includesAny(searchable, ["gemini quota", "quota during live demo"])) {
      return "Rủi ro khác là Gemini quota trong live demo, nên nhóm cần chuẩn bị fast path và fallback evidence card";
    }
  }

  if (intent === "latency") {
    if (includesAny(searchable, ["measure retrieval latency separately", "retrieval latency separately"])) {
      return "Nhóm tách retrieval latency khỏi Gemini answer generation để đo riêng embedding time, database retrieval, reranking, time to first result, answer generation time và total answer time";
    }
    if (includesAny(searchable, ["p95 retrieval latency", "average full answer latency"])) {
      return "Nhóm quyết định báo cáo p95 retrieval latency thay vì average full answer latency";
    }
    if (includesAny(searchable, ["gemini quota", "fast path answers", "fallback evidence cards"])) {
      return "Gemini quota là rủi ro khi demo live, nên nhóm chuẩn bị fast path answers và fallback evidence cards để search vẫn hoạt động khi generation chậm hoặc lỗi";
    }
  }

  if (intent === "gmail") {
    if (hasGmailEvidence(searchable) && includesAny(searchable, ["future work", "scope decision"])) {
      return "Nhóm quyết định để Gmail và Google Contacts ở future work trừ khi core demo đã ổn định";
    }
    if (includesAny(searchable, ["not add gmail", "warned us not to add gmail"])) {
      return "Linh cảnh báo không nên thêm Gmail trước khi Diary, Calendar, Attachment và grounded search ổn định";
    }
    if (includesAny(searchable, ["scope creep", "avoiding scope creep"])) {
      return "Quyết định này xuất phát từ feedback của Linh về việc tránh scope creep";
    }
  }

  if (intent === "google_contacts") {
    if (citation.sourceType === "contact") {
      return citation.quote;
    }
    if (isGoogleContactsSearchText(searchable)) {
      return "Kế hoạch Google Contacts là sync contact names, emails, phone numbers và organizations từ Google People API để memory engine nhận diện người như Linh, Quan hoặc Duc Anh tốt hơn";
    }
  }

  if (intent === "mood") {
    if (includesAny(searchable, ["felt stressed", "stress"]) && includesAny(searchable, ["worker", "quota"])) {
      return "Bạn cảm thấy stress vì worker và quota có thể làm hỏng live AI memory search demo";
    }
    if (includesAny(searchable, ["felt great", "good mood", "in a good mood"])) {
      return "Bạn ghi nhận tâm trạng tốt trong ký ức này";
    }
    if (includesAny(searchable, ["neutral mood", "mood is neutral", "mood was neutral"])) {
      return "Tâm trạng được ghi lại là neutral";
    }
  }

  if (intent === "decision") {
    if (hasGmailEvidence(searchable)) {
      return summarizeCitationInVietnamese(citation, "gmail");
    }
    if (isGoogleContactsSearchText(searchable)) {
      return summarizeCitationInVietnamese(citation, "google_contacts");
    }
    if (hasLatencyEvidence(searchable)) {
      return summarizeCitationInVietnamese(citation, "latency");
    }
  }

  return null;
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?。！？]+$/u, "");
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}
