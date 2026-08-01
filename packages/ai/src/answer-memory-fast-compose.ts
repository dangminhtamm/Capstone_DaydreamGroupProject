import type { MemoryCitation } from "./answer-utils.ts";
import type {
  MemoryIntent,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  buildReadableClaim,
  cleanMemoryText,
  formatFallbackSourceDate,
  formatLocalizedMemoryBullet,
} from "./answer-memory-format.ts";
import {
  includesAny,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import { isNoisyFallbackSource } from "./answer-memory-scoring.ts";

export function prepareFastCitations(
  sources: MemoryCitation[],
  options: {
    intent: MemoryIntent;
    maxCitations?: number;
  },
): MemoryCitation[] {
  const maxCitations = Math.min(Math.max(options.maxCitations ?? 5, 1), 8);
  const nonNoisySources = sources.filter((source) => !isNoisyFallbackSource(source));
  const candidates = nonNoisySources.length ? nonNoisySources : sources;
  const selected: MemoryCitation[] = [];
  const fingerprints: Array<Set<string>> = [];
  const perSourceCount = new Map<string, number>();

  for (const source of candidates) {
    const sourceKey = `${source.sourceType}:${source.sourceId}`;
    const currentSourceCount = perSourceCount.get(sourceKey) ?? 0;
    if (currentSourceCount >= getPerSourceLimit(source, options.intent)) continue;

    const fingerprint = buildFastFactFingerprint(source);
    if (!fingerprint.size) continue;
    const duplicate = fingerprints.some(
      (existing) => jaccardSimilarity(existing, fingerprint) >= 0.82,
    );
    if (duplicate) continue;

    selected.push({
      ...source,
      claim: source.claim ?? buildReadableClaim(source),
    });
    fingerprints.push(fingerprint);
    perSourceCount.set(sourceKey, currentSourceCount + 1);

    if (selected.length >= maxCitations) break;
  }

  return renumberCitations(selected.length ? selected : candidates.slice(0, maxCitations));
}

export function formatTemporalFastAnswer(input: {
  question: string;
  citations: MemoryCitation[];
  rangeLabel: string;
  lang: ResponseLanguage;
  intent: MemoryIntent;
  timeZone?: string;
}): string {
  return formatFastAnswer({
    ...input,
    context: "temporal",
  });
}

export function formatGenericFastAnswer(input: {
  question: string;
  citations: MemoryCitation[];
  lang: ResponseLanguage;
  intent: MemoryIntent;
  timeZone?: string;
}): string {
  return formatFastAnswer({
    ...input,
    context: "generic",
  });
}

function formatFastAnswer(input: {
  question: string;
  citations: MemoryCitation[];
  lang: ResponseLanguage;
  intent: MemoryIntent;
  context: "generic" | "temporal";
  rangeLabel?: string;
  timeZone?: string;
}): string {
  const facts = input.citations
    .map((citation) => ({
      citation,
      fact: formatFastFact(citation, input.intent, input.lang),
    }))
    .filter((item) => item.fact.length > 0);

  if (!facts.length) {
    return input.lang === "vi"
      ? "Mình tìm thấy ký ức liên quan, nhưng nội dung chưa đủ rõ để tóm tắt nhanh."
      : "I found a related memory, but it was not clear enough to summarize quickly.";
  }

  if (facts.length === 1) {
    const date = formatFallbackSourceDate(
      facts[0].citation.occurredAt,
      input.lang,
      input.timeZone,
    );
    return input.lang === "vi"
      ? `${buildSingleFactLead(input.intent, input.lang)} ngày ${date}, ${lowercaseFirst(facts[0].fact)}.`
      : `${buildSingleFactLead(input.intent, input.lang)} ${date}: ${lowercaseFirst(facts[0].fact)}.`;
  }

  const lead = buildMultiFactLead(input);
  const bullets = facts
    .map(({ citation, fact }) => {
      const date = formatFallbackSourceDate(citation.occurredAt, input.lang, input.timeZone);
      return `- ${date}: ${fact}.`;
    })
    .join("\n");

  return [lead, bullets].join("\n");
}

function buildSingleFactLead(
  intent: MemoryIntent,
  lang: ResponseLanguage,
): string {
  if (lang === "vi") {
    switch (intent) {
      case "calendar":
        return "Lịch liên quan nhất là";
      case "attachment":
        return "Điểm liên quan nhất trong tài liệu là";
      case "task":
        return "Việc cần chú ý nhất là";
      case "progress":
        return "Điểm tiến độ nổi bật nhất là";
      default:
        return "Mình tìm thấy ký ức khớp nhất:";
    }
  }

  switch (intent) {
    case "calendar":
      return "The strongest matching calendar memory is from";
    case "attachment":
      return "The strongest matching document memory is from";
    case "task":
      return "The clearest follow-up is from";
    case "progress":
      return "The strongest progress memory is from";
    default:
      return "The strongest match is from";
  }
}

function buildMultiFactLead(input: {
  context: "generic" | "temporal";
  rangeLabel?: string;
  lang: ResponseLanguage;
  intent: MemoryIntent;
}): string {
  if (input.context === "temporal" && input.rangeLabel) {
    return input.lang === "vi"
      ? `Mình thấy trong ${input.rangeLabel} có vài điểm nổi bật:`
      : `Across ${input.rangeLabel}, the main saved memories are:`;
  }

  if (input.lang === "vi") {
    switch (input.intent) {
      case "calendar":
        return "Các lịch/sự kiện liên quan nhất là:";
      case "attachment":
        return "Trong tài liệu/attachment, mình thấy các điểm liên quan nhất:";
      case "task":
        return "Các việc cần chú ý nhất là:";
      case "progress":
        return "Các điểm tiến độ nổi bật là:";
      case "decision":
        return "Các quyết định/kế hoạch liên quan là:";
      default:
        return "Mình tìm thấy các ký ức liên quan nhất:";
    }
  }

  switch (input.intent) {
    case "calendar":
      return "The most relevant calendar memories are:";
    case "attachment":
      return "The most relevant document memories are:";
    case "task":
      return "The clearest follow-ups are:";
    case "progress":
      return "The strongest progress memories are:";
    case "decision":
      return "The relevant decisions or plans are:";
    default:
      return "The most relevant memories are:";
  }
}

function formatFastFact(
  citation: MemoryCitation,
  intent: MemoryIntent,
  lang: ResponseLanguage,
): string {
  const base = lang === "vi"
    ? formatLocalizedMemoryBullet(citation, intent, lang)
    : cleanMemoryText(citation.quote);
  const cleaned = trimTrailingPunctuation(base);

  if (lang === "vi") {
    return sentenceCase(naturalizeVietnameseFactIfVietnamese(cleaned));
  }

  return sentenceCase(naturalizeEnglishFactIfEnglish(cleaned));
}

function naturalizeVietnameseFactIfVietnamese(value: string): string {
  if (!looksVietnamese(value)) return value;

  return value
    .replace(/^h[oô]m nay\s+/i, "")
    .replace(/\bh[oô]m nay\b/gi, "hôm đó")
    .replace(/\btôi\b/gi, "bạn")
    .replace(/\bmình\b/gi, "bạn")
    .replace(/\bcủa tôi\b/gi, "của bạn")
    .replace(/\s+/g, " ")
    .trim();
}

function naturalizeEnglishFactIfEnglish(value: string): string {
  if (looksVietnamese(value)) return value;

  return value
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

function getPerSourceLimit(
  source: MemoryCitation,
  intent: MemoryIntent,
): number {
  if (source.sourceType === "diary" && ["generic", "progress", "task"].includes(intent)) {
    return 2;
  }
  if (source.sourceType === "calendar" || source.sourceType === "attachment") {
    return 2;
  }
  return 1;
}

function buildFastFactFingerprint(source: MemoryCitation): Set<string> {
  const normalized = normalizeForIntent(`${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`)
    .replace(/[^a-z0-9\s]/g, " ");
  const words = normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !FAST_FACT_STOP_WORDS.has(word));

  return new Set(words);
}

function renumberCitations(citations: MemoryCitation[]): MemoryCitation[] {
  return citations.map((citation, index) => ({
    ...citation,
    marker: `S${index + 1}`,
  }));
}

function looksVietnamese(value: string): boolean {
  const normalized = normalizeForIntent(value);
  return (
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(value) ||
    includesAny(normalized, [
      "hom nay",
      "nhat ky",
      "toi",
      "minh",
      "ban",
      "khong",
      "lam gi",
      "thoi tiet",
      "du an",
      "tien do",
      "can lam",
    ])
  );
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?。！？]+$/u, "");
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function lowercaseFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toLowerCase() + trimmed.slice(1);
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

const FAST_FACT_STOP_WORDS = new Set([
  "about",
  "after",
  "and",
  "are",
  "ban",
  "but",
  "cua",
  "daily",
  "day",
  "for",
  "from",
  "general",
  "hom",
  "log",
  "memory",
  "minh",
  "nay",
  "ngay",
  "nhat",
  "source",
  "summary",
  "that",
  "the",
  "this",
  "toi",
  "was",
  "were",
  "with",
]);
