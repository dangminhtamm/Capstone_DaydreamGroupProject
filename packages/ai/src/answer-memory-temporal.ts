import type { RetrievalFilters } from "./retrieval.ts";
import type { MemoryIntent } from "./answer-memory-types.ts";
import {
  detectMemoryIntent,
  hasNormalizedPhrase,
  includesAny,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import {
  DIARY_RETRIEVAL_PROFILE,
  DRIVE_RETRIEVAL_PROFILE,
  PEOPLE_RETRIEVAL_PROFILE,
  getIntentRetrievalProfile,
} from "./answer-memory-intent-profiles.ts";

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
  const intentRetrievalProfile = getIntentRetrievalProfile(intent);

  if (isHighPriorityRetrievalIntent(intent) && intentRetrievalProfile) {
    return { ...temporalFilters, ...intentRetrievalProfile };
  }

  if (includesAny(normalized, ["google drive", "drive file", "drive files", "drive", "tệp drive", "tep drive"])) {
    return { ...temporalFilters, ...DRIVE_RETRIEVAL_PROFILE };
  }

  if (isDiaryDateQuestion(normalized, intent, temporalFilters)) {
    return { ...temporalFilters, ...DIARY_RETRIEVAL_PROFILE };
  }

  if (isStandardPriorityRetrievalIntent(intent) && intentRetrievalProfile) {
    return { ...temporalFilters, ...intentRetrievalProfile };
  }

  if (includesAny(normalized, ["diary", "journal", "nhật ký", "nhat ky"])) {
    return { ...temporalFilters, ...DIARY_RETRIEVAL_PROFILE };
  }

  if (intent === "decision" && intentRetrievalProfile) {
    return { ...temporalFilters, ...intentRetrievalProfile };
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
    return { ...temporalFilters, ...PEOPLE_RETRIEVAL_PROFILE };
  }

  return temporalFilters;
}

function isHighPriorityRetrievalIntent(intent: MemoryIntent): boolean {
  return ["calendar", "gmail", "drive", "google_contacts", "latency"].includes(intent);
}

function isStandardPriorityRetrievalIntent(intent: MemoryIntent): boolean {
  return ["attachment", "blocker", "feedback", "mood", "progress", "task"].includes(intent);
}

function isDiaryDateQuestion(
  normalizedQuestion: string,
  intent: MemoryIntent,
  temporalFilters: RetrievalFilters,
): boolean {
  if (!temporalFilters.startDate || !temporalFilters.endDate) return false;
  if (!["generic", "progress", "task"].includes(intent)) return false;

  const spanMs = temporalFilters.endDate.getTime() - temporalFilters.startDate.getTime();
  if (!Number.isFinite(spanMs) || spanMs > 36 * 60 * 60 * 1000) return false;

  return includesAny(normalizedQuestion, [
    "what did i do",
    "what did i work on",
    "what happened",
    "what was i doing",
    "my day",
    "today",
    "yesterday",
    "hôm nay",
    "hom nay",
    "hôm qua",
    "hom qua",
    "ngày",
    "ngay",
    "tôi làm gì",
    "toi lam gi",
    "mình làm gì",
    "minh lam gi",
    "đã làm gì",
    "da lam gi",
    "làm gì",
    "lam gi",
  ]);
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
    return withTemporalFallback(zonedDayRange(explicitDate, timeZone));
  }

  const localToday = getZonedDateParts(now, timeZone);

  if (includesAny(normalizedQuestion, ["today", "hôm nay", "hom nay"])) {
    return withTemporalFallback(zonedDayRange(localToday, timeZone));
  }

  if (includesAny(normalizedQuestion, ["tomorrow", "ngày mai", "ngay mai"])) {
    return withTemporalFallback(zonedDayRange(addLocalDays(localToday, 1), timeZone));
  }

  if (includesAny(normalizedQuestion, ["yesterday", "hôm qua", "hom qua", "hôm trước", "hom truoc"])) {
    return withTemporalFallback(zonedDayRange(addLocalDays(localToday, -1), timeZone));
  }

  if (includesAny(normalizedQuestion, ["this week", "tuần này", "tuan nay"])) {
    const start = startOfZonedWeek(localToday);
    return withTemporalFallback(zonedRangeFromStartAndLocalDayCount(start, 7, timeZone));
  }

  if (includesAny(normalizedQuestion, ["last week", "tuần trước", "tuan truoc"])) {
    const currentWeekStart = startOfZonedWeek(localToday);
    const start = addLocalDays(currentWeekStart, -7);
    return withTemporalFallback(zonedRangeFromStartAndLocalDayCount(start, 7, timeZone));
  }

  if (includesAny(normalizedQuestion, ["next week", "tuần sau", "tuan sau"])) {
    const currentWeekStart = startOfZonedWeek(localToday);
    const start = addLocalDays(currentWeekStart, 7);
    return withTemporalFallback(zonedRangeFromStartAndLocalDayCount(start, 7, timeZone));
  }

  if (includesAny(normalizedQuestion, ["last month", "tháng trước", "thang truoc"])) {
    return withTemporalFallback(zonedMonthRange(localToday.year, localToday.month - 2, timeZone));
  }

  if (includesAny(normalizedQuestion, ["this month", "tháng này", "thang nay"])) {
    return withTemporalFallback(zonedMonthRange(localToday.year, localToday.month - 1, timeZone));
  }

  if (includesAny(normalizedQuestion, ["next month", "tháng sau", "thang sau"])) {
    return withTemporalFallback(zonedMonthRange(localToday.year, localToday.month, timeZone));
  }

  const month = detectMonth(normalizedQuestion);
  if (month !== null) {
    const year = detectExplicitYear(normalizedQuestion) ??
      resolveRelativeYear(normalizedQuestion, localToday.year) ??
      mostRecentPastMonthYear(month, now, timeZone);
    return withTemporalFallback(zonedMonthRange(year, month, timeZone));
  }

  const relativeYear = resolveRelativeYear(normalizedQuestion, localToday.year);
  if (relativeYear !== null) {
    return withTemporalFallback(zonedYearRange(relativeYear, timeZone));
  }

  const explicitYear = detectExplicitYear(normalizedQuestion);
  if (explicitYear !== null) {
    return withTemporalFallback(zonedYearRange(explicitYear, timeZone));
  }

  if (
    includesAny(normalizedQuestion, [
      "recently",
      "recent",
      "lately",
      "latest",
      "newest",
      "gần đây",
      "gan day",
      "gần nhất",
      "gan nhat",
      "mới nhất",
      "moi nhat",
    ])
  ) {
    return withTemporalFallback({
      startDate: zonedDateTimeToUtc(addLocalDays(localToday, -60), timeZone),
      endDate: new Date(zonedDateTimeToUtc(addLocalDays(localToday, 1), timeZone).getTime() - 1),
    });
  }

  return {};
}

function withTemporalFallback(filters: RetrievalFilters): RetrievalFilters {
  return {
    ...filters,
    allowTemporalFallback: true,
  };
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

function zonedYearRange(year: number, timeZone: string): RetrievalFilters {
  const start = zonedDateTimeToUtc({ year, month: 1, day: 1 }, timeZone);
  const nextStart = zonedDateTimeToUtc({ year: year + 1, month: 1, day: 1 }, timeZone);
  return {
    startDate: start,
    endDate: new Date(nextStart.getTime() - 1),
  };
}

function detectExplicitYear(value: string): number | null {
  const match = value.match(/\b20\d{2}\b/u);
  return match ? parseYearToken(match[0]) : null;
}

function resolveRelativeYear(value: string, currentYear: number): number | null {
  if (includesAny(value, ["this year", "current year", "năm nay", "nam nay", "năm hiện tại", "nam hien tai"])) {
    return currentYear;
  }
  if (includesAny(value, ["last year", "previous year", "năm trước", "nam truoc", "năm ngoái", "nam ngoai"])) {
    return currentYear - 1;
  }
  if (includesAny(value, ["next year", "năm sau", "nam sau"])) return currentYear + 1;
  return null;
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
  for (const [index, name] of ENGLISH_MONTH_NAMES.entries()) {
    if (hasNormalizedPhrase(value, name)) return index;
  }

  const vietnameseMonth = value.match(/\bthang\s+(\d{1,2})\b/u);
  if (vietnameseMonth) {
    const month = Number(vietnameseMonth[1]);
    if (month >= 1 && month <= 12) return month - 1;
  }

  const tokens = tokenizeTemporalText(value);
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index] !== "thang") continue;
    const parsed = parseDateNumberAt(tokens, index + 1, 2, 12);
    if (parsed) return parsed.value - 1;
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

  const englishWordDate = detectEnglishWordDate(value, localNow.year);
  if (englishWordDate) return englishWordDate;

  const vietnameseWordDate = detectVietnameseWordDate(value, localNow.year);
  if (vietnameseWordDate) return vietnameseWordDate;

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

function detectEnglishWordDate(value: string, defaultYear: number): LocalDateParts | null {
  const tokens = tokenizeTemporalText(value);
  if (!tokens.length) return null;

  for (let monthIndex = 0; monthIndex < tokens.length; monthIndex++) {
    const month = getEnglishMonthNumber(tokens[monthIndex]);
    if (month === null) continue;

    const dayBeforeMonth = parseEnglishDayBeforeMonth(tokens, monthIndex);
    if (dayBeforeMonth) {
      const year = parseYearAfterDateNumber(tokens, monthIndex + 1, defaultYear);
      return buildLocalDateFromParts(year, month, dayBeforeMonth.value);
    }

    const dayAfterMonth = parseEnglishDayAfterMonth(tokens, monthIndex);
    if (dayAfterMonth) {
      const year = parseYearAfterDateNumber(
        tokens,
        monthIndex + 1 + dayAfterMonth.offset + dayAfterMonth.length,
        defaultYear,
      );
      return buildLocalDateFromParts(year, month, dayAfterMonth.value);
    }
  }

  return null;
}

function parseEnglishDayBeforeMonth(
  tokens: string[],
  monthIndex: number,
): { value: number } | null {
  let end = monthIndex;
  while (end > 0 && ENGLISH_CONNECTOR_TOKENS.has(tokens[end - 1])) {
    end--;
  }

  for (let length = Math.min(4, end); length >= 1; length--) {
    const start = end - length;
    const candidate = trimLeadingEnglishDateMarkers(tokens.slice(start, end));
    if (!candidate.length) continue;

    const parsed = parseNumberTokens(candidate, 31);
    if (parsed !== null) return { value: parsed };
  }

  return null;
}

function parseEnglishDayAfterMonth(
  tokens: string[],
  monthIndex: number,
): { value: number; offset: number; length: number } | null {
  let start = monthIndex + 1;
  while (start < tokens.length && ENGLISH_DATE_MARKERS.has(tokens[start])) {
    start++;
  }

  for (let length = Math.min(4, tokens.length - start); length >= 1; length--) {
    const candidate = tokens.slice(start, start + length);
    const parsed = parseNumberTokens(candidate, 31);
    if (parsed !== null) {
      return {
        value: parsed,
        offset: start - (monthIndex + 1),
        length,
      };
    }
  }

  return null;
}

function detectVietnameseWordDate(value: string, defaultYear: number): LocalDateParts | null {
  const tokens = tokenizeTemporalText(value);
  if (!tokens.length) return null;

  for (let monthMarkerIndex = 0; monthMarkerIndex < tokens.length; monthMarkerIndex++) {
    if (tokens[monthMarkerIndex] !== "thang") continue;

    const month = parseDateNumberAt(tokens, monthMarkerIndex + 1, 2, 12);
    if (!month) continue;

    const day = parseVietnameseDayBeforeMonth(tokens, monthMarkerIndex);
    if (!day) continue;

    const year = parseYearAfterDateNumber(tokens, monthMarkerIndex + 1 + month.length, defaultYear);
    return buildLocalDateFromParts(year, month.value, day.value);
  }

  return null;
}

function parseVietnameseDayBeforeMonth(
  tokens: string[],
  monthMarkerIndex: number,
): { value: number } | null {
  const earliestCandidateStart = Math.max(0, monthMarkerIndex - 4);

  for (let start = earliestCandidateStart; start < monthMarkerIndex; start++) {
    const rawCandidate = tokens.slice(start, monthMarkerIndex);
    const candidate = trimLeadingDateMarkers(rawCandidate);
    if (!candidate.length) continue;

    const markerInside = rawCandidate.length !== candidate.length;
    const markerBefore = start > 0 && VIETNAMESE_DAY_MARKERS.has(tokens[start - 1]);
    const immediatelyBeforeMonth = start + candidate.length === monthMarkerIndex;
    if (!markerInside && !markerBefore && !immediatelyBeforeMonth) continue;

    const parsed = parseNumberTokens(candidate, 31);
    if (parsed !== null) return { value: parsed };
  }

  return null;
}

function parseYearAfterDateNumber(
  tokens: string[],
  start: number,
  defaultYear: number,
): number {
  const directYear = parseYearToken(tokens[start]);
  if (directYear !== null) return directYear;

  if (tokens[start] === "nam") {
    return parseYearToken(tokens[start + 1]) ?? defaultYear;
  }

  if (tokens[start] === "year") {
    return parseYearToken(tokens[start + 1]) ?? defaultYear;
  }

  return defaultYear;
}

function parseDateNumberAt(
  tokens: string[],
  start: number,
  maxTokens: number,
  maxValue: number,
): { value: number; length: number } | null {
  for (let length = Math.min(maxTokens, tokens.length - start); length >= 1; length--) {
    const value = parseNumberTokens(tokens.slice(start, start + length), maxValue);
    if (value !== null) return { value, length };
  }

  return null;
}

function parseNumberTokens(tokens: string[], maxValue: number): number | null {
  if (!tokens.length) return null;

  if (tokens.length === 1 && /^\d{1,2}$/u.test(tokens[0])) {
    const numeric = Number(tokens[0]);
    return numeric >= 1 && numeric <= maxValue ? numeric : null;
  }

  const units: Record<string, number> = {
    khong: 0,
    linh: 0,
    mot: 1,
    nhat: 1,
    hai: 2,
    ba: 3,
    bon: 4,
    tu: 4,
    nam: 5,
    lam: 5,
    sau: 6,
    bay: 7,
    tam: 8,
    chin: 9,
  };

  let value: number | null = null;
  if (tokens.length === 1) {
    value = units[tokens[0]] ??
      ENGLISH_NUMBER_WORDS[tokens[0]] ??
      (tokens[0] === "muoi" ? 10 : null);
  } else if (tokens[0] === "muoi" && tokens.length === 2) {
    const unit = units[tokens[1]];
    value = unit === undefined ? null : 10 + unit;
  } else if (
    tokens.length >= 2 &&
    tokens.length <= 3 &&
    units[tokens[0]] !== undefined &&
    tokens[1] === "muoi"
  ) {
    const tens = units[tokens[0]] * 10;
    const unit = tokens.length === 3 ? units[tokens[2]] : 0;
    value = unit === undefined ? null : tens + unit;
  } else if (tokens.length === 2 && ENGLISH_TENS_WORDS[tokens[0]] !== undefined) {
    const unit = ENGLISH_NUMBER_WORDS[tokens[1]];
    value = unit === undefined ? null : ENGLISH_TENS_WORDS[tokens[0]] + unit;
  } else if (
    tokens.length === 3 &&
    ENGLISH_TENS_WORDS[tokens[0]] !== undefined &&
    tokens[1] === "and"
  ) {
    const unit = ENGLISH_NUMBER_WORDS[tokens[2]];
    value = unit === undefined ? null : ENGLISH_TENS_WORDS[tokens[0]] + unit;
  }

  return value !== null && value >= 1 && value <= maxValue ? value : null;
}

function getEnglishMonthNumber(token: string): number | null {
  const index = ENGLISH_MONTH_NAMES.indexOf(token);
  return index >= 0 ? index + 1 : null;
}

function trimLeadingEnglishDateMarkers(tokens: string[]): string[] {
  let start = 0;
  while (start < tokens.length && ENGLISH_DATE_MARKERS.has(tokens[start])) {
    start++;
  }

  return tokens.slice(start);
}

function trimLeadingDateMarkers(tokens: string[]): string[] {
  let start = 0;
  while (start < tokens.length && VIETNAMESE_DAY_MARKERS.has(tokens[start])) {
    start++;
  }

  return tokens.slice(start);
}

function parseYearToken(token: string | undefined): number | null {
  if (!token || !/^(?:20)?\d{2}$/u.test(token)) return null;
  const year = Number(token.length === 2 ? `20${token}` : token);
  return year >= 2000 && year <= 2099 ? year : null;
}

function tokenizeTemporalText(value: string): string[] {
  return value.match(/[a-z0-9]+/gu) ?? [];
}

const VIETNAMESE_DAY_MARKERS = new Set(["ngay", "mung", "mong"]);
const ENGLISH_MONTH_NAMES = [
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
const ENGLISH_DATE_MARKERS = new Set(["on", "the"]);
const ENGLISH_CONNECTOR_TOKENS = new Set(["of", "in"]);
const ENGLISH_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
  thirteen: 13,
  thirteenth: 13,
  fourteen: 14,
  fourteenth: 14,
  fifteen: 15,
  fifteenth: 15,
  sixteen: 16,
  sixteenth: 16,
  seventeen: 17,
  seventeenth: 17,
  eighteen: 18,
  eighteenth: 18,
  nineteen: 19,
  nineteenth: 19,
  twenty: 20,
  twentieth: 20,
  thirty: 30,
  thirtieth: 30,
};
const ENGLISH_TENS_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
};

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
