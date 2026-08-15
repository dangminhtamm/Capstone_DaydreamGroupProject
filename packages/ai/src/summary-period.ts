export type SummaryPeriodType = "daily" | "weekly" | "monthly" | "yearly";

export type SummaryPeriod = {
  start: Date;
  end: Date;
  timeZone: string;
  localStart: string;
  localEnd: string;
};

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

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function resolveSummaryTimeZone(timeZone?: string | null): string {
  const configured = timeZone?.trim() || process.env.APP_TIMEZONE?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured }).format(new Date());
    return configured;
  } catch {
    return "UTC";
  }
}

export function getSummaryPeriod(
  type: SummaryPeriodType,
  anchor: Date,
  timeZone = resolveSummaryTimeZone(),
): SummaryPeriod {
  const resolvedTimeZone = resolveSummaryTimeZone(timeZone);
  const localAnchor = getZonedDateParts(anchor, resolvedTimeZone);
  const localStart = getLocalPeriodStart(type, localAnchor);
  const nextLocalStart = getNextLocalPeriodStart(type, localStart);
  const start = zonedDateTimeToUtc(localStart, resolvedTimeZone);
  const nextStart = zonedDateTimeToUtc(nextLocalStart, resolvedTimeZone);
  const end = new Date(nextStart.getTime() - 1);

  return {
    start,
    end,
    timeZone: resolvedTimeZone,
    localStart: formatLocalDate(localStart),
    localEnd: formatLocalDate(addLocalDays(nextLocalStart, -1)),
  };
}

export function isLastLocalDayOfMonth(
  date: Date,
  timeZone = resolveSummaryTimeZone(),
): boolean {
  const resolvedTimeZone = resolveSummaryTimeZone(timeZone);
  const localDate = getZonedDateParts(date, resolvedTimeZone);
  const tomorrow = addLocalDays(localDate, 1);
  return tomorrow.month !== localDate.month || tomorrow.year !== localDate.year;
}

export function formatSummaryDateTime(
  date: Date | string,
  timeZone = resolveSummaryTimeZone(),
): string {
  const resolvedTimeZone = resolveSummaryTimeZone(timeZone);
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) return String(date);

  const parts = getZonedDateTimeParts(value, resolvedTimeZone);
  return `${formatLocalDate(parts)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(
    parts.second,
  )} ${resolvedTimeZone}`;
}

export function formatSummaryPeriodRange(period: Pick<SummaryPeriod, "start" | "end" | "timeZone">): string {
  return `${formatSummaryDateTime(period.start, period.timeZone)} to ${formatSummaryDateTime(
    period.end,
    period.timeZone,
  )} (UTC ${period.start.toISOString()} to ${period.end.toISOString()})`;
}

function getLocalPeriodStart(type: SummaryPeriodType, localAnchor: LocalDateParts): LocalDateParts {
  if (type === "daily") {
    return localAnchor;
  }

  if (type === "weekly") {
    const weekday = getLocalWeekday(localAnchor);
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    return addLocalDays(localAnchor, mondayOffset);
  }

  if (type === "monthly") {
    return { year: localAnchor.year, month: localAnchor.month, day: 1 };
  }

  return { year: localAnchor.year, month: 1, day: 1 };
}

function getNextLocalPeriodStart(type: SummaryPeriodType, localStart: LocalDateParts): LocalDateParts {
  if (type === "daily") return addLocalDays(localStart, 1);
  if (type === "weekly") return addLocalDays(localStart, 7);
  if (type === "monthly") return normalizeMonthStart(localStart.year, localStart.month + 1);
  return { year: localStart.year + 1, month: 1, day: 1 };
}

function normalizeMonthStart(year: number, nextOneBasedMonth: number): LocalDateParts {
  const date = new Date(Date.UTC(year, nextOneBasedMonth - 1, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: 1,
  };
}

function getLocalWeekday(date: LocalDateParts): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
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

function formatLocalDate(date: LocalDateParts): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
