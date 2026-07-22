import type { RetrievalFilters } from "./retrieval.ts";
import {
  detectMemoryIntent,
  hasNormalizedPhrase,
  includesAny,
  normalizeForIntent,
} from "./answer-memory-intents.ts";

export function inferRetrievalFilters(question: string, now = new Date()): RetrievalFilters {
  const normalized = normalizeForIntent(question);
  const intent = detectMemoryIntent(normalized);
  const temporalFilters = inferTemporalFilters(normalized, now);

  if (intent === "latency") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary", "summary"],
      preferredChunkTypes: ["decision", "general_note", "general", "action_item"],
      vectorWeight: 0.55,
      lexicalWeight: 0.45,
    };
  }

  if (intent === "gmail") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["decision", "feedback", "general", "general_note"],
      vectorWeight: 0.55,
      lexicalWeight: 0.45,
    };
  }

  if (intent === "calendar") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["calendar"],
      preferredChunkTypes: ["event", "general"],
      vectorWeight: 0.6,
      lexicalWeight: 0.4,
    };
  }

  if (intent === "attachment") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["attachment"],
      preferredChunkTypes: ["general_note", "general"],
      vectorWeight: 0.62,
      lexicalWeight: 0.38,
    };
  }

  if (intent === "feedback") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["feedback", "general", "general_note"],
      vectorWeight: 0.55,
      lexicalWeight: 0.45,
    };
  }

  if (intent === "blocker") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary", "summary"],
      preferredChunkTypes: ["reflection", "action_item", "general", "general_note"],
      vectorWeight: 0.62,
      lexicalWeight: 0.38,
    };
  }

  if (intent === "mood") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary", "summary"],
      preferredChunkTypes: ["reflection", "general", "general_note"],
      vectorWeight: 0.68,
      lexicalWeight: 0.32,
    };
  }

  if (intent === "progress") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary", "calendar", "summary"],
      preferredChunkTypes: ["event", "decision", "action_item", "reflection", "general", "general_note"],
      vectorWeight: 0.64,
      lexicalWeight: 0.36,
    };
  }

  if (intent === "task") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["action_item", "task_update", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (includesAny(normalized, ["diary", "journal", "nhật ký", "nhat ky"])) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["general", "general_note", "reflection", "event"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (intent === "decision") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary"],
      preferredChunkTypes: ["decision", "general", "general_note"],
      vectorWeight: 0.65,
      lexicalWeight: 0.35,
    };
  }

  if (
    includesAny(normalized, [
      "person",
      "people",
      "who",
      "whom",
      "met",
      "meet",
      "talked",
      "with",
      "ai",
      "người",
      "nguoi",
      "gặp",
      "gap",
      "nói chuyện",
      "noi chuyen",
    ])
  ) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["diary", "calendar"],
      preferredChunkTypes: ["event", "feedback", "decision", "general", "general_note"],
      vectorWeight: 0.6,
      lexicalWeight: 0.4,
    };
  }

  return temporalFilters;
}

function inferTemporalFilters(normalizedQuestion: string, now = new Date()): RetrievalFilters {
  const explicitDate = detectExplicitDate(normalizedQuestion, now);
  if (explicitDate) {
    return {
      startDate: startOfUtcDay(explicitDate),
      endDate: new Date(Date.UTC(
        explicitDate.getUTCFullYear(),
        explicitDate.getUTCMonth(),
        explicitDate.getUTCDate(),
        23,
        59,
        59,
        999,
      )),
    };
  }

  if (includesAny(normalizedQuestion, ["today", "hôm nay", "hom nay"])) {
    const start = startOfUtcDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["tomorrow", "ngày mai", "ngay mai"])) {
    const start = startOfUtcDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["yesterday", "hôm qua", "hom qua", "hôm trước", "hom truoc"])) {
    const start = startOfUtcDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["this week", "tuần này", "tuan nay"])) {
    const start = startOfUtcWeek(now);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["last week", "tuần trước", "tuan truoc"])) {
    const currentWeekStart = startOfUtcWeek(now);
    const start = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const end = new Date(currentWeekStart.getTime() - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["next week", "tuần sau", "tuan sau"])) {
    const currentWeekStart = startOfUtcWeek(now);
    const start = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["last month", "tháng trước", "thang truoc"])) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["this month", "tháng này", "thang nay"])) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["next month", "tháng sau", "thang sau"])) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1) - 1);
    return { startDate: start, endDate: end };
  }

  const month = detectMonth(normalizedQuestion);
  if (month !== null) {
    const year = mostRecentPastMonthYear(month, now);
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1) - 1);
    return { startDate: start, endDate: end };
  }

  if (includesAny(normalizedQuestion, ["recently", "recent", "gần đây", "gan day"])) {
    const day = 24 * 60 * 60 * 1000;
    const today = startOfUtcDay(now);
    const start = new Date(today.getTime() - 30 * day);
    const end = new Date(today.getTime() + day - 1);
    return { startDate: start, endDate: end };
  }

  return {};
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  return startOfUtcDay(new Date(date.getTime() - diffToMonday * 24 * 60 * 60 * 1000));
}

export function detectMonth(value: string): number | null {
  const monthNames = [
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
  ];

  for (const [index, name] of monthNames.entries()) {
    if (hasNormalizedPhrase(value, name)) return index;
  }

  const vietnameseMonth = value.match(/\bthang\s+(\d{1,2})\b/u);
  if (vietnameseMonth) {
    const month = Number(vietnameseMonth[1]);
    if (month >= 1 && month <= 12) return month - 1;
  }

  return null;
}

function detectExplicitDate(value: string, now: Date): Date | null {
  const iso = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/u);
  if (iso) {
    return buildUtcDateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const numeric = value.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-]((?:20)?\d{2}))?\b/u);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = numeric[3]
      ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
      : now.getUTCFullYear();
    return buildUtcDateFromParts(year, month, day);
  }

  const written = value.match(/\b(?:ngay\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:thang\s+)?([a-z]+|\d{1,2})(?:\s+(20\d{2}))?\b/u);
  if (written) {
    const day = Number(written[1]);
    const monthToken = written[2];
    const parsedMonth = /^\d+$/.test(monthToken)
      ? Number(monthToken) - 1
      : detectMonth(monthToken);
    const year = written[3] ? Number(written[3]) : now.getUTCFullYear();

    if (parsedMonth !== null) {
      return buildUtcDateFromParts(year, parsedMonth + 1, day);
    }
  }

  return null;
}

function buildUtcDateFromParts(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function mostRecentPastMonthYear(month: number, now: Date): number {
  return month <= now.getUTCMonth() ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}
