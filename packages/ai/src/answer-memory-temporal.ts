import type { RetrievalFilters } from "./retrieval.ts";
import {
  detectMemoryIntent,
  hasNormalizedPhrase,
  includesAny,
  normalizeForIntent,
} from "./answer-memory-intents.ts";

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type ZonedDateTimeParts = LocalDateParts & {
  hour: number;
  minute: number;
  second: number;
};

const DEFAULT_MEMORY_TIME_ZONE = "UTC";
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function inferRetrievalFilters(
  question: string,
  now = new Date(),
  timeZone = resolveMemoryTimeZone(),
): RetrievalFilters {
  const resolvedTimeZone = resolveMemoryTimeZone(timeZone);
  const normalized = normalizeForIntent(question);
  const intent = detectMemoryIntent(normalized);
  const temporalFilters = inferTemporalFilters(normalized, now, resolvedTimeZone);

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

  if (intent === "google_contacts") {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["contact", "diary"],
      preferredChunkTypes: ["general_note", "general", "decision"],
      vectorWeight: 0.58,
      lexicalWeight: 0.42,
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

  if (includesAny(normalized, ["google drive", "drive file", "drive files", "drive", "tệp drive", "tep drive"])) {
    return {
      ...temporalFilters,
      preferredSourceTypes: ["drive"],
      preferredChunkTypes: ["general_note", "general"],
      vectorWeight: 0.62,
      lexicalWeight: 0.38,
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
      preferredSourceTypes: ["diary", "calendar", "contact"],
      preferredChunkTypes: ["event", "feedback", "decision", "general", "general_note"],
      vectorWeight: 0.6,
      lexicalWeight: 0.4,
    };
  }

  return temporalFilters;
}

export function resolveMemoryTimeZone(timeZone?: string | null): string {
  const configured =
    timeZone?.trim() ||
    process.env.APP_TIMEZONE?.trim() ||
    DEFAULT_MEMORY_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured }).format(new Date());
    return configured;
  } catch {
    return DEFAULT_MEMORY_TIME_ZONE;
  }
}

function inferTemporalFilters(
  normalizedQuestion: string,
  now = new Date(),
  timeZone = resolveMemoryTimeZone(),
): RetrievalFilters {
  const explicitDate = detectExplicitDate(normalizedQuestion, now, timeZone);
  if (explicitDate) {
    return zonedDayRange(explicitDate, timeZone);
  }

  const localToday = getZonedDateParts(now, timeZone);

  if (includesAny(normalizedQuestion, ["today", "hôm nay", "hom nay"])) {
    return zonedDayRange(localToday, timeZone);
  }

  if (includesAny(normalizedQuestion, ["tomorrow", "ngày mai", "ngay mai"])) {
    return zonedDayRange(addLocalDays(localToday, 1), timeZone);
  }

  if (includesAny(normalizedQuestion, ["yesterday", "hôm qua", "hom qua", "hôm trước", "hom truoc"])) {
    return zonedDayRange(addLocalDays(localToday, -1), timeZone);
  }

  if (includesAny(normalizedQuestion, ["this week", "tuần này", "tuan nay"])) {
    const start = startOfZonedWeek(localToday);
    return zonedRangeFromStartAndLocalDayCount(start, 7, timeZone);
  }

  if (includesAny(normalizedQuestion, ["last week", "tuần trước", "tuan truoc"])) {
    const currentWeekStart = startOfZonedWeek(localToday);
    const start = addLocalDays(currentWeekStart, -7);
    return zonedRangeFromStartAndLocalDayCount(start, 7, timeZone);
  }

  if (includesAny(normalizedQuestion, ["next week", "tuần sau", "tuan sau"])) {
    const currentWeekStart = startOfZonedWeek(localToday);
    const start = addLocalDays(currentWeekStart, 7);
    return zonedRangeFromStartAndLocalDayCount(start, 7, timeZone);
  }

  if (includesAny(normalizedQuestion, ["last month", "tháng trước", "thang truoc"])) {
    return zonedMonthRange(localToday.year, localToday.month - 2, timeZone);
  }

  if (includesAny(normalizedQuestion, ["this month", "tháng này", "thang nay"])) {
    return zonedMonthRange(localToday.year, localToday.month - 1, timeZone);
  }

  if (includesAny(normalizedQuestion, ["next month", "tháng sau", "thang sau"])) {
    return zonedMonthRange(localToday.year, localToday.month, timeZone);
  }

  const month = detectMonth(normalizedQuestion);
  if (month !== null) {
    const year = mostRecentPastMonthYear(month, now, timeZone);
    return zonedMonthRange(year, month, timeZone);
  }

  if (includesAny(normalizedQuestion, ["recently", "recent", "gần đây", "gan day"])) {
    return {
      startDate: zonedDateTimeToUtc(addLocalDays(localToday, -30), timeZone),
      endDate: new Date(zonedDateTimeToUtc(addLocalDays(localToday, 1), timeZone).getTime() - 1),
    };
  }

  return {};
}

function startOfZonedWeek(date: LocalDateParts): LocalDateParts {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  const diffToMonday = (day + 6) % 7;
  return addLocalDays(date, -diffToMonday);
}

function zonedDayRange(date: LocalDateParts, timeZone: string): RetrievalFilters {
  return zonedRangeFromStartAndLocalDayCount(date, 1, timeZone);
}

function zonedRangeFromStartAndLocalDayCount(
  startDate: LocalDateParts,
  dayCount: number,
  timeZone: string,
): RetrievalFilters {
  const start = zonedDateTimeToUtc(startDate, timeZone);
  const nextStart = zonedDateTimeToUtc(addLocalDays(startDate, dayCount), timeZone);
  return {
    startDate: start,
    endDate: new Date(nextStart.getTime() - 1),
  };
}

function zonedMonthRange(year: number, monthIndex: number, timeZone: string): RetrievalFilters {
  const normalizedStart = normalizeMonthStart(year, monthIndex);
  const normalizedNext = normalizeMonthStart(year, monthIndex + 1);
  const start = zonedDateTimeToUtc(normalizedStart, timeZone);
  const nextStart = zonedDateTimeToUtc(normalizedNext, timeZone);
  return {
    startDate: start,
    endDate: new Date(nextStart.getTime() - 1),
  };
}

function normalizeMonthStart(year: number, monthIndex: number): LocalDateParts {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: 1,
  };
}

function addLocalDays(date: LocalDateParts, days: number): LocalDateParts {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedDateTimeToUtc(
  date: LocalDateParts,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const desiredAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second);
  const guessedUtc = new Date(desiredAsUtc);
  const offsetMs = getTimeZoneOffsetMs(guessedUtc, timeZone);
  let candidate = new Date(desiredAsUtc - offsetMs);
  const actual = getZonedDateTimeParts(candidate, timeZone);
  const actualAsUtc = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
  );
  const correctionMs = desiredAsUtc - actualAsUtc;

  if (correctionMs !== 0) {
    candidate = new Date(candidate.getTime() + correctionMs);
  }

  return candidate;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedDateTimeParts(date, timeZone);
  const utcFromParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return utcFromParts - Math.floor(date.getTime() / 1000) * 1000;
}

function getZonedDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = getZonedDateTimeParts(date, timeZone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = getDateTimeFormatter(timeZone);
  const formatted = formatter.formatToParts(date);
  const values = Object.fromEntries(
    formatted
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
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

function detectExplicitDate(value: string, now: Date, timeZone: string): LocalDateParts | null {
  const localNow = getZonedDateParts(now, timeZone);
  const iso = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/u);
  if (iso) {
    return buildLocalDateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const numeric = value.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-]((?:20)?\d{2}))?\b/u);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = numeric[3]
      ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
      : localNow.year;
    return buildLocalDateFromParts(year, month, day);
  }

  const written = value.match(/\b(?:ngay\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:thang\s+)?([a-z]+|\d{1,2})(?:\s+(20\d{2}))?\b/u);
  if (written) {
    const day = Number(written[1]);
    const monthToken = written[2];
    const parsedMonth = /^\d+$/.test(monthToken)
      ? Number(monthToken) - 1
      : detectMonth(monthToken);
    const year = written[3] ? Number(written[3]) : localNow.year;

    if (parsedMonth !== null) {
      return buildLocalDateFromParts(year, parsedMonth + 1, day);
    }
  }

  return null;
}

function buildLocalDateFromParts(year: number, month: number, day: number): LocalDateParts | null {
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

  return { year, month, day };
}

function mostRecentPastMonthYear(month: number, now: Date, timeZone: string): number {
  const localNow = getZonedDateParts(now, timeZone);
  return month <= localNow.month - 1 ? localNow.year : localNow.year - 1;
}
