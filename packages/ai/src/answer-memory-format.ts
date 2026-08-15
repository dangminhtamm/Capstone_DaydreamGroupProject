import type { MemoryCitation } from "./answer-utils.ts";
import type {
  AnswerMemoryResult,
  MemoryIntent,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  isStressIntent,
  normalizeForIntent,
} from "./answer-memory-intents.ts";

export function formatSingleDayAnswer(
  citations: MemoryCitation[],
  dateLabel: string,
  lang: ResponseLanguage,
): string {
  const facts = dedupeSimilarFacts(citations.map((citation) => formatSingleDayFact(citation, lang)))
    .slice(0, 4);

  if (!facts.length) {
    return lang === "vi"
      ? `Ngày ${dateLabel}, mình tìm thấy ký ức liên quan nhưng nội dung không đủ rõ để tóm tắt.`
      : `On ${dateLabel}, I found a related memory, but it was not clear enough to summarize.`;
  }

  if (lang === "vi") {
    return `Ngày ${dateLabel}, ${formatVietnameseDayFacts(facts)}`;
  }

  return `On ${dateLabel}, ${formatEnglishDayFacts(facts)}`;
}

export function selectSingleDayCitations(citations: MemoryCitation[]): MemoryCitation[] {
  const hasDiarySource = citations.some((citation) => citation.sourceType === "diary");
  const candidates = hasDiarySource
    ? citations.filter((citation) => citation.sourceType !== "summary")
    : citations;

  const selected: MemoryCitation[] = [];
  const selectedFingerprints: Array<Set<string>> = [];

  for (const citation of candidates) {
    const fingerprint = buildTextFingerprint(
      `${citation.sourceTitle ?? ""} ${citation.chunkType} ${citation.quote}`,
    );
    if (fingerprint.size === 0) continue;

    const isDuplicate = selectedFingerprints.some(
      (existing) => jaccardSimilarity(existing, fingerprint) >= 0.72,
    );
    if (isDuplicate) continue;

    selected.push(citation);
    selectedFingerprints.push(fingerprint);
  }

  return selected.length ? selected : citations;
}

function formatTemporalRangeAnswer(
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

function formatMemoryBullet(citation: MemoryCitation, maxLength = 240): string {
  return sentenceCase(
    trimTrailingPunctuation(
      stripSourceTitlePrefix(cleanMemoryText(citation.quote, maxLength), citation.sourceTitle),
    ),
  );
}

export function formatLocalizedMemoryBullet(
  citation: MemoryCitation,
  intent: MemoryIntent,
  lang: ResponseLanguage,
): string {
  const fallback = formatMemoryBullet(citation);
  if (lang !== "vi") {
    return sentenceCase(
      trimTrailingPunctuation(
        citation.sourceType === "diary"
          ? fallback
          : formatSourceLabeledMemoryBullet(citation, fallback, lang),
      ),
    );
  }

  return sentenceCase(
    trimTrailingPunctuation(
      summarizeCitationInVietnamese(citation, intent) ?? fallback,
    ),
  );
}

export function cleanMemoryText(text: string, maxLength = 240): string {
  const withoutTitle = stripDiaryTitlePrefix(text);

  return trimPromptQuote(
    withoutTitle
      .replace(/\*\*/g, "")
      .replace(/\s+\*\s+/g, ". ")
      .replace(/^[-*]\s+/g, "")
      .replace(/\s+/g, " ")
      .replace(/^daily log:\s*\d{4}-\d{2}-\d{2}\s*\.?\s*/i, "")
      .replace(/^weekly review:\s*\d{4}-\d{2}-\d{2}\s*(?:to|-)\s*\d{4}-\d{2}-\d{2}\s*\.?\s*/i, "")
      .replace(/^monthly retrospective:\s*[a-z]+\s+\d{4}\s*\.?\s*/i, "")
      .replace(/^(diary entry|journal entry|nhat ky|nhật ký)(\s+h[oô]m nay|\s+today)?\s*[:\-–—]?\s*/i, "")
      .trim(),
    maxLength,
  );
}

function stripDiaryTitlePrefix(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const match = normalized.match(/^([^\n]{3,120})\n{2,}([\s\S]{20,})$/u);
  if (!match) return text;

  const title = match[1]?.trim() ?? "";
  const body = match[2]?.trim() ?? "";
  if (!title || !body) return text;

  const titleLooksLikeHeading =
    title.length <= 90 &&
    !/[.!?。！？]$/u.test(title) &&
    !title.includes(":");

  return titleLooksLikeHeading ? body : text;
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
        return [
          citations.some((citation) => citation.sourceType === "gmail")
            ? "Email Gmail liên quan là:"
            : "Quyết định về Gmail là:",
          bullets,
        ].join("\n");
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
      return [
        citations.some((citation) => citation.sourceType === "gmail")
          ? "The relevant Gmail email was:"
          : "The Gmail decision was:",
        bullets,
      ].join("\n");
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
    if (fallbackTopic === "progress") {
      return [`${lead} Các việc nổi bật mình tìm thấy trong khoảng thời gian này là:`, bullets].join("\n");
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
  if (fallbackTopic === "progress") {
    return [`${lead} The main things I found across that time range were:`, bullets].join("\n");
  }
  if (fallbackTopic === "mood" && isStressIntent(normalizedQuestion)) {
    return [`${lead} The recorded source of stress was:`, bullets].join("\n");
  }
  if (fallbackTopic === "mood") {
    return [`${lead} The relevant mood/emotion memories were:`, bullets].join("\n");
  }
  return [`${lead} The most relevant memories were:`, bullets].join("\n");
}

export function buildQuestionAwareFallbackAnswerFromSources(
  lang: ResponseLanguage,
  question: string,
  sources: MemoryCitation[],
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  fallbackTopic: MemoryIntent,
  options: {
    broadSynthesis?: boolean;
    timeZone?: string;
  } = {},
): string {
  const bullets = sources
    .map((source) => {
      const date = formatFallbackSourceDate(source.occurredAt, lang, options.timeZone);
      return `- ${date}: ${formatLocalizedMemoryBullet(source, fallbackTopic, lang)}.`;
    })
    .join("\n");

  if (options.broadSynthesis || shouldGroupFallbackSummary(question, fallbackTopic, sources)) {
    const grouped = buildGroupedSynthesisFallbackAnswer(
      lang,
      sources,
      modelError,
      fallbackTopic,
      options.timeZone,
    );
    if (grouped) return grouped;
  }

  return buildQuestionAwareFallbackAnswer(lang, question, bullets, modelError, fallbackTopic);
}

function formatValidationFallbackLead(message: string, lang: ResponseLanguage): string {
  const normalized = message.toLowerCase();
  const isGroundingIssue =
    normalized.includes("grounded") ||
    normalized.includes("citation") ||
    normalized.includes("usable");

  if (lang === "vi") {
    return isGroundingIssue
      ? "Mình dùng trực tiếp các ký ức có nguồn chắc chắn nhất."
      : "Mình dùng trực tiếp các ký ức liên quan nhất.";
  }

  return isGroundingIssue
    ? "I am using the most strongly cited memories directly."
    : "I am using the most relevant memories directly.";
}

function shouldGroupFallbackSummary(
  question: string,
  fallbackTopic: MemoryIntent,
  sources: MemoryCitation[],
): boolean {
  if (sources.length < 2) return false;
  if (fallbackTopic === "progress") return true;

  const normalized = normalizeForIntent(question);
  return /\b(summarize|summary|tong hop|tom tat|tóm tắt|weekly|monthly|yearly|week|month|year|tuan|tuần|thang|tháng|nam|năm)\b/u
    .test(normalized);
}

function buildGroupedSynthesisFallbackAnswer(
  lang: ResponseLanguage,
  sources: MemoryCitation[],
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  fallbackTopic: MemoryIntent,
  timeZone = "UTC",
): string | null {
  const groups = groupSourcesForSynthesis(sources, fallbackTopic);
  const sections = [
    formatSynthesisSection(lang, "mainWork", groups.mainWork, fallbackTopic, timeZone),
    formatSynthesisSection(lang, "blockers", groups.blockers, fallbackTopic, timeZone),
    formatSynthesisSection(lang, "decisions", groups.decisions, fallbackTopic, timeZone),
    formatSynthesisSection(lang, "nextSteps", groups.nextSteps, fallbackTopic, timeZone),
  ].filter((section): section is string => Boolean(section));

  if (!sections.length) return null;

  const lead = formatValidationFallbackLead(modelError.message, lang);
  const intro = lang === "vi"
    ? `${lead} Mình gom lại theo nhóm để dễ đọc:`
    : `${lead} I grouped the strongest evidence into:`;

  return [intro, ...sections].join("\n\n");
}

type SynthesisGroupKey = "mainWork" | "blockers" | "decisions" | "nextSteps";

function groupSourcesForSynthesis(
  sources: MemoryCitation[],
  fallbackTopic: MemoryIntent,
): Record<SynthesisGroupKey, MemoryCitation[]> {
  const groups: Record<SynthesisGroupKey, MemoryCitation[]> = {
    mainWork: [],
    blockers: [],
    decisions: [],
    nextSteps: [],
  };
  const seen = new Set<string>();

  for (const source of sources) {
    const key = `${source.sourceType}:${source.sourceId}:${source.chunkId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const group = classifySynthesisSource(source, fallbackTopic);
    groups[group].push(source);
  }

  return {
    mainWork: groups.mainWork.slice(0, 6),
    blockers: groups.blockers.slice(0, 3),
    decisions: groups.decisions.slice(0, 3),
    nextSteps: groups.nextSteps.slice(0, 3),
  };
}

function classifySynthesisSource(
  source: MemoryCitation,
  fallbackTopic: MemoryIntent,
): SynthesisGroupKey {
  const normalized = normalizeForIntent(
    `${source.sourceType} ${source.chunkType} ${source.sourceTitle ?? ""} ${source.claim ?? ""} ${source.quote}`,
  );
  const chunkType = source.chunkType.toLowerCase();

  if (
    fallbackTopic === "blocker" ||
    chunkType.includes("blocker") ||
    includesSynthesisCue(normalized, BLOCKER_CUES)
  ) {
    return "blockers";
  }

  if (
    fallbackTopic === "task" ||
    chunkType.includes("action") ||
    chunkType.includes("task") ||
    chunkType.includes("follow") ||
    includesSynthesisCue(normalized, NEXT_STEP_CUES)
  ) {
    return "nextSteps";
  }

  if (
    fallbackTopic === "decision" ||
    chunkType.includes("decision") ||
    includesSynthesisCue(normalized, DECISION_CUES)
  ) {
    return "decisions";
  }

  return "mainWork";
}

function formatSynthesisSection(
  lang: ResponseLanguage,
  group: SynthesisGroupKey,
  sources: MemoryCitation[],
  fallbackTopic: MemoryIntent,
  timeZone: string,
): string | null {
  if (!sources.length) return null;

  const title = getSynthesisSectionTitle(group, lang);
  const bullets = sources
    .map((source) => {
      const date = formatFallbackSourceDate(source.occurredAt, lang, timeZone);
      return `- ${date}: ${formatLocalizedMemoryBullet(source, fallbackTopic, lang)}.`;
    })
    .join("\n");

  return `${title}\n${bullets}`;
}

function getSynthesisSectionTitle(group: SynthesisGroupKey, lang: ResponseLanguage): string {
  if (lang === "vi") {
    switch (group) {
      case "mainWork":
        return "Công việc chính";
      case "blockers":
        return "Blockers/rủi ro";
      case "decisions":
        return "Quyết định quan trọng";
      case "nextSteps":
        return "Next steps";
    }
  }

  switch (group) {
    case "mainWork":
      return "Main work";
    case "blockers":
      return "Blockers/risks";
    case "decisions":
      return "Key decisions";
    case "nextSteps":
      return "Next steps";
  }
}

function includesSynthesisCue(normalized: string, cues: readonly string[]): boolean {
  return cues.some((cue) => normalized.includes(cue));
}

const BLOCKER_CUES = [
  "blocker",
  "blocked",
  "risk",
  "issue",
  "problem",
  "failed",
  "failure",
  "error",
  "missing",
  "stuck",
  "chua xong",
  "chưa xong",
  "loi",
  "lỗi",
  "rui ro",
  "rủi ro",
  "kẹt",
  "ket",
];

const DECISION_CUES = [
  "decide",
  "decided",
  "decision",
  "agreed",
  "choose",
  "chosen",
  "plan",
  "planned",
  "scope",
  "priority",
  "prioritize",
  "quyet dinh",
  "quyết định",
  "ke hoach",
  "kế hoạch",
  "uu tien",
  "ưu tiên",
];

const NEXT_STEP_CUES = [
  "next step",
  "next steps",
  "todo",
  "to do",
  "follow up",
  "follow-up",
  "need to",
  "needs to",
  "remaining",
  "prepare",
  "should",
  "must",
  "action item",
  "can lam",
  "cần làm",
  "viec tiep theo",
  "việc tiếp theo",
  "tiep theo",
  "tiếp theo",
  "chuan bi",
  "chuẩn bị",
];

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
  const cleaned = formatMemoryBullet(citation, getVietnameseCitationMaxLength(intent));
  if (!cleaned) return null;

  if (citation.sourceType === "diary" && looksVietnameseText(cleaned)) {
    return naturalizeVietnameseDayFact(cleaned);
  }

  return formatSourceLabeledMemoryBullet(citation, cleaned, "vi");
}

export function formatSourceLabeledMemoryBullet(
  citation: Pick<MemoryCitation, "sourceType">,
  text: string,
  lang: ResponseLanguage,
): string {
  const cleaned = trimTrailingPunctuation(text);
  if (citation.sourceType === "diary") return cleaned;
  return lang === "vi"
    ? `${getVietnameseSourceLabel(citation.sourceType)} ghi: ${cleaned}`
    : `${getEnglishSourceLabel(citation.sourceType)}: ${cleaned}`;
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?。！？]+$/u, "");
}

function getVietnameseCitationMaxLength(intent: MemoryIntent): number {
  if (intent === "generic" || intent === "progress") return 280;
  return 240;
}

function getVietnameseSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "diary":
      return "Nhật ký";
    case "summary":
      return "Tóm tắt";
    case "calendar":
      return "Lịch";
    case "gmail":
      return "Email";
    case "drive":
      return "Tài liệu";
    case "attachment":
      return "Tệp đính kèm";
    case "contact":
      return "Danh bạ";
    default:
      return "Nguồn";
  }
}

function getEnglishSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "diary":
      return "Diary";
    case "summary":
      return "Summary";
    case "calendar":
      return "Calendar";
    case "gmail":
      return "Email";
    case "drive":
      return "Drive file";
    case "attachment":
      return "Attachment";
    case "contact":
      return "Contact";
    default:
      return "Source";
  }
}

function looksVietnameseText(value: string): boolean {
  const normalized = normalizeForIntent(value);
  const tokens = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));
  return (
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(value) ||
    VIETNAMESE_TEXT_SIGNALS.some((signal) =>
      signal.includes(" ") ? normalized.includes(signal) : tokens.has(signal),
    )
  );
}

const VIETNAMESE_TEXT_SIGNALS = [
  "ban",
  "cua ban",
  "da",
  "dang",
  "de",
  "duoc",
  "hom nay",
  "khong",
  "lam",
  "minh",
  "nhat ky",
  "ngay",
  "nhom",
  "toi",
  "trong",
  "ve",
];

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function stripSourceTitlePrefix(text: string, sourceTitle?: string): string {
  const title = sourceTitle?.replace(/\s+/g, " ").trim();
  if (!title) return text;

  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (normalizedText === title) return text;
  if (!normalizedText.toLowerCase().startsWith(`${title.toLowerCase()} `)) {
    return text;
  }

  return normalizedText.slice(title.length).trim();
}

function formatSingleDayFact(citation: MemoryCitation, lang: ResponseLanguage): string {
  const cleaned = formatMemoryBullet(citation, 520);
  if (citation.sourceType !== "diary") {
    return formatSourceLabeledMemoryBullet(citation, cleaned, lang);
  }

  return lang === "vi"
    ? naturalizeVietnameseDayFact(cleaned)
    : naturalizeEnglishDayFact(cleaned);
}

function formatVietnameseDayFacts(facts: string[]): string {
  const normalizedFacts = facts.map(trimTrailingPunctuation).filter(Boolean);
  if (!normalizedFacts.length) return "mình chưa thấy nội dung đủ rõ trong nhật ký ngày này.";

  if (normalizedFacts.length === 1) {
    return `${lowercaseFirst(normalizedFacts[0])}.`;
  }

  return normalizedFacts
    .map((fact, index) => {
      if (index === 0) return `${lowercaseFirst(fact)}.`;
      return `${sentenceCase(fact)}.`;
    })
    .join(" ");
}

function formatEnglishDayFacts(facts: string[]): string {
  const normalizedFacts = facts.map(trimTrailingPunctuation).filter(Boolean);
  if (!normalizedFacts.length) return "the saved memory was not clear enough to summarize.";

  if (normalizedFacts.length === 1) {
    return `${lowercaseFirst(normalizedFacts[0])}.`;
  }

  return normalizedFacts
    .map((fact, index) => {
      if (index === 0) return `${lowercaseFirst(fact)}.`;
      return `${sentenceCase(fact)}.`;
    })
    .join(" ");
}

function naturalizeVietnameseDayFact(value: string): string {
  return trimTrailingPunctuation(value)
    .replace(/^h[oô]m nay\s+/i, "")
    .replace(/\bh[oô]m nay\b/gi, "hôm đó")
    .replace(/\btôi\b/gi, "bạn")
    .replace(/\bmình\b/gi, "bạn")
    .replace(/\bcủa tôi\b/gi, "của bạn")
    .replace(/\s+/g, " ")
    .trim();
}

function naturalizeEnglishDayFact(value: string): string {
  return trimTrailingPunctuation(value)
    .replace(/\btoday\b/gi, "that day")
    .replace(/\bI am\b/g, "you are")
    .replace(/\bI'm\b/g, "you're")
    .replace(/\bI was\b/g, "you were")
    .replace(/\bI\b/g, "you")
    .replace(/\bmy\b/gi, "your")
    .replace(/\bme\b/gi, "you")
    .replace(/\s+/g, " ")
    .trim();
}

function lowercaseFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toLowerCase() + trimmed.slice(1);
}

function dedupeSimilarFacts(facts: string[]): string[] {
  const selected: string[] = [];
  const fingerprints: Array<Set<string>> = [];

  for (const fact of facts) {
    const cleaned = trimTrailingPunctuation(fact);
    const fingerprint = buildTextFingerprint(cleaned);
    if (!cleaned || fingerprint.size === 0) continue;

    const duplicate = fingerprints.some(
      (existing) => jaccardSimilarity(existing, fingerprint) >= 0.82,
    );
    if (duplicate) continue;

    selected.push(cleaned);
    fingerprints.push(fingerprint);
  }

  return selected;
}

function buildTextFingerprint(value: string): Set<string> {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const stopWords = new Set([
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "today",
    "hom",
    "nay",
    "toi",
    "minh",
    "ban",
    "ngay",
    "daily",
    "log",
    "events",
    "weather",
  ]);

  const words = normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stopWords.has(word));

  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}
