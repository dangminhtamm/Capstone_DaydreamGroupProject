"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  generateSummary,
  getDiaryEntries,
  getSummaries,
  type DiaryEntry,
  type SummaryRecord,
  type SummaryType,
} from "@/lib/api-client";

type LoadState = "idle" | "loading" | "success" | "error";
type OverviewMode = "daily" | "weekly";

type DailySummary = {
  dateKey: string;
  label: string;
  entries: DiaryEntry[];
  wordCount: number;
  readingMinutes: number;
  topKeywords: string[];
};

type WeeklySummary = {
  weekKey: string;
  label: string;
  entries: DiaryEntry[];
  wordCount: number;
  activeDays: number;
  averageWords: number;
};

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "was",
  "were",
  "from",
  "have",
  "has",
  "had",
  "about",
  "into",
  "our",
  "you",
  "your",
  "today",
  "also",
  "will",
  "their",
  "there",
]);

const weekdayFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const weekFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

const summaryTypeOptions: SummaryType[] = ["daily", "weekly", "monthly", "yearly"];

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getEntryActivityDate(entry: DiaryEntry) {
  return entry.entryDate ?? entry.createdAt;
}

function getDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLatestEntryDateInputValue(entries: DiaryEntry[]) {
  const latest = [...entries].sort(
    (first, second) =>
      new Date(getEntryActivityDate(second)).getTime() - new Date(getEntryActivityDate(first)).getTime(),
  )[0];

  return latest ? getDateKey(getEntryActivityDate(latest)) : null;
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getTopKeywords(entries: DiaryEntry[]) {
  const counts = new Map<string, number>();

  entries.forEach((entry) => {
    `${entry.title} ${entry.content}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  });

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 4)
    .map(([word]) => word);
}

function buildDailySummaries(entries: DiaryEntry[]) {
  const grouped = new Map<string, DiaryEntry[]>();

  entries.forEach((entry) => {
    const key = getDateKey(getEntryActivityDate(entry));
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  });

  return [...grouped.entries()]
    .sort(([first], [second]) => second.localeCompare(first))
    .map(([dateKey, dayEntries]) => {
      const wordCount = dayEntries.reduce((total, entry) => total + countWords(`${entry.title} ${entry.content}`), 0);

      return {
        dateKey,
        label: weekdayFormatter.format(new Date(dateKey)),
        entries: dayEntries,
        wordCount,
        readingMinutes: Math.max(1, Math.ceil(wordCount / 200)),
        topKeywords: getTopKeywords(dayEntries),
      };
    });
}

function buildWeeklySummaries(entries: DiaryEntry[]) {
  const grouped = new Map<string, DiaryEntry[]>();

  entries.forEach((entry) => {
    const weekStart = getWeekStart(new Date(getEntryActivityDate(entry)));
    const key = weekStart.toISOString().slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  });

  return [...grouped.entries()]
    .sort(([first], [second]) => second.localeCompare(first))
    .map(([weekKey, weekEntries]) => {
      const start = new Date(weekKey);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const wordCount = weekEntries.reduce((total, entry) => total + countWords(`${entry.title} ${entry.content}`), 0);
      const activeDays = new Set(weekEntries.map((entry) => getDateKey(getEntryActivityDate(entry)))).size;

      return {
        weekKey,
        label: `${weekFormatter.format(start)} - ${weekFormatter.format(end)}`,
        entries: weekEntries,
        wordCount,
        activeDays,
        averageWords: Math.round(wordCount / Math.max(activeDays, 1)),
      };
    });
}

function StatCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:shadow-slate-900/40">
      <div className={`mb-4 h-2 w-12 rounded-full ${tone}`} />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function formatSummaryPeriod(summary: SummaryRecord) {
  const start = weekFormatter.format(new Date(summary.periodStart));
  const end = weekFormatter.format(new Date(summary.periodEnd));
  return start === end ? start : `${start} - ${end}`;
}

function AiSummaryList({ summaries }: { summaries: SummaryRecord[] }) {
  if (!summaries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
        No AI-generated summaries yet. Generate one now or wait for the background worker to add daily, weekly, monthly, and yearly reflections.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary) => (
        <article
          key={summary.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800">
              {summary.type}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {formatSummaryPeriod(summary)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
            {summary.content}
          </p>
        </article>
      ))}
    </div>
  );
}

function ActivityBars({ summaries }: { summaries: DailySummary[] }) {
  const recentDays = summaries.slice(0, 7).reverse();
  const maxEntries = Math.max(...recentDays.map((day) => day.entries.length), 1);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:shadow-slate-900/40">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Activity</p>
          <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-100">Last 7 days</h3>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
          daily trend
        </span>
      </div>
      <div className="flex h-48 items-end gap-3">
        {recentDays.length ? (
          recentDays.map((day) => (
            <div key={day.dateKey} className="flex flex-1 flex-col items-center gap-3">
              <div className="flex h-32 w-full items-end rounded-2xl bg-slate-50 px-2 py-2 dark:bg-slate-700/50">
                <div
                  className="w-full rounded-xl bg-gradient-to-t from-indigo-600 to-sky-400 shadow-sm transition-all"
                  style={{ height: `${Math.max((day.entries.length / maxEntries) * 100, 10)}%` }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{day.entries.length}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{day.label.split(",")[0]}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            No activity data yet
          </div>
        )}
      </div>
    </div>
  );
}

export function SummaryDashboard() {
  const { getAccessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [aiSummaries, setAiSummaries] = useState<SummaryRecord[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("daily");
  const [summaryType, setSummaryType] = useState<SummaryType>("daily");
  const [summaryDate, setSummaryDate] = useState(() => getLocalDateInputValue());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState("");
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setEntries([]);
      setAiSummaries([]);
      setState("idle");
      return;
    }

    async function fetchSummaryData() {
      setState("loading");
      setErrorMessage("");

      try {
        const accessToken = getAccessToken();
        const [diaryData, summaryData] = await Promise.all([
          getDiaryEntries(accessToken),
          getSummaries(accessToken, { limit: 20 }),
        ]);
        setEntries(diaryData);
        const latestEntryDate = getLatestEntryDateInputValue(diaryData);
        if (latestEntryDate) {
          setSummaryDate(latestEntryDate);
        }
        setAiSummaries(summaryData);
        setState("success");
      } catch (error) {
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load summary data");
      }
    }

    fetchSummaryData();
  }, [authLoading, getAccessToken, isAuthenticated]);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (first, second) =>
          new Date(getEntryActivityDate(second)).getTime() - new Date(getEntryActivityDate(first)).getTime(),
      ),
    [entries],
  );
  const dailySummaries = useMemo(() => buildDailySummaries(sortedEntries), [sortedEntries]);
  const weeklySummaries = useMemo(() => buildWeeklySummaries(sortedEntries), [sortedEntries]);
  const totalWords = useMemo(
    () => sortedEntries.reduce((total, entry) => total + countWords(`${entry.title} ${entry.content}`), 0),
    [sortedEntries],
  );
  const activeDays = dailySummaries.length;
  const latestEntry = sortedEntries[0];
  const visibleAiSummaries = useMemo(
    () => aiSummaries.filter((summary) => summary.type === summaryType).slice(0, 5),
    [aiSummaries, summaryType],
  );

  async function handleGenerateSummary() {
    setIsGenerating(true);
    setGenerateMessage("");
    setGenerateError("");

    try {
      const accessToken = getAccessToken();
      const selectedDate = new Date(`${summaryDate}T12:00:00`);
      const response = await generateSummary(
        {
          type: summaryType,
          date: selectedDate.toISOString(),
          force: true,
        },
        accessToken,
      );

      setAiSummaries((current) => [
        response.summary,
        ...current.filter((summary) => summary.id !== response.summary.id),
      ]);
      setGenerateMessage(
        response.memoryIndexingStatus === "queued"
          ? `${summaryType[0].toUpperCase()}${summaryType.slice(1)} summary generated and queued for memory indexing.`
          : `${summaryType[0].toUpperCase()}${summaryType.slice(1)} summary generated.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate summary";
      setGenerateError(
        message.includes("No diary, calendar, or lower-level summaries")
          ? `${message} Try selecting a date that has diary entries or synced calendar events.`
          : message,
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (authLoading || state === "loading") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        {/* Demo stat cards (blurred) */}
        <div className="pointer-events-none select-none opacity-50 blur-[1px]">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {['Total Entries', 'This Week', 'Words Written', 'Avg. Words'].map((label) => (
              <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <div className="mt-2 h-7 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>

        {/* Overlay CTA */}
        <div className="-mt-16 relative z-10 rounded-3xl border border-indigo-200/70 bg-white/90 p-8 text-center shadow-lg backdrop-blur dark:border-indigo-700/50 dark:bg-slate-800/90">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">Your insights will appear here</h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Sign in to see your writing stats, streaks, and activity trends.</p>
          <a
            href="/login"
            className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Sign in to get started
          </a>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-700 dark:bg-rose-900/20">
        <p className="text-lg font-semibold text-rose-950 dark:text-rose-300">Unable to load dashboard</p>
        <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/30 dark:shadow-slate-900/40">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Personal insights</p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Your activity at a glance</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Track diary volume, writing consistency, and weekly activity patterns from your saved entries.
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
            <span className="font-semibold">Latest update:</span>{" "}
            {latestEntry ? weekdayFormatter.format(new Date(getEntryActivityDate(latestEntry))) : "No entries yet"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total entries" value={String(sortedEntries.length)} helper="Diary memories saved" tone="bg-indigo-500" />
        <StatCard label="Active days" value={String(activeDays)} helper="Days with at least one entry" tone="bg-sky-500" />
        <StatCard label="Total words" value={totalWords.toLocaleString()} helper="Across titles and content" tone="bg-emerald-500" />
        <StatCard
          label="Avg words/day"
          value={String(Math.round(totalWords / Math.max(activeDays, 1)))}
          helper="Writing depth indicator"
          tone="bg-amber-500"
        />
      </section>

      {!sortedEntries.length ? (
        <section className="rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/50 p-6 text-center dark:border-indigo-800 dark:bg-indigo-950/20">
          <p className="text-base font-semibold text-indigo-950 dark:text-indigo-200">
            No diary activity to summarize yet
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-indigo-700/80 dark:text-indigo-300/80">
            Add a few diary entries or sync Calendar events first. Daily summaries use raw activity, while weekly and monthly summaries become stronger after lower-level summaries exist.
          </p>
          <a
            href="/diary"
            className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Write first diary entry
          </a>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:shadow-slate-900/40">
        <div className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">AI reflections</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-100">Generated summaries</h3>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="grid grid-cols-4 rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {summaryTypeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSummaryType(option)}
                  className={`cursor-pointer rounded-xl px-3 py-2 capitalize transition ${summaryType === option ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-600 dark:text-indigo-400" : "hover:text-slate-900 dark:hover:text-slate-100"}`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={summaryDate}
                onChange={(event) => setSummaryDate(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-indigo-900/50"
              />
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={isGenerating || !summaryDate}
                className="h-10 cursor-pointer rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {isGenerating ? "Generating..." : "Generate now"}
              </button>
            </div>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Generate uses the selected date as the anchor for the chosen daily, weekly, monthly, or yearly period.
        </p>
        {generateMessage ? (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            {generateMessage}
          </p>
        ) : null}
        {generateError ? (
          <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
            {generateError}
          </p>
        ) : null}
        <AiSummaryList summaries={visibleAiSummaries} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ActivityBars summaries={dailySummaries} />

        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:shadow-slate-900/40">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Overview</p>
              <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-100">Daily and weekly summaries</h3>
            </div>
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <button
                type="button"
                onClick={() => setOverviewMode("daily")}
                className={`cursor-pointer rounded-xl px-4 py-2 transition ${overviewMode === "daily" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-600 dark:text-indigo-400" : "hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setOverviewMode("weekly")}
                className={`cursor-pointer rounded-xl px-4 py-2 transition ${overviewMode === "weekly" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-600 dark:text-indigo-400" : "hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                Weekly
              </button>
            </div>
          </div>

          {overviewMode === "daily" ? (
            <div className="space-y-3">
              {dailySummaries.slice(0, 5).map((day) => (
                <article key={day.dateKey} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-950 dark:text-slate-100">{day.label}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {day.entries.length} entries · {day.wordCount} words · {day.readingMinutes} min read
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {day.topKeywords.map((keyword) => (
                        <span key={keyword} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
              {!dailySummaries.length ? <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">No daily summaries yet.</p> : null}
            </div>
          ) : (
            <div className="space-y-3">
              {weeklySummaries.slice(0, 5).map((week) => (
                <article key={week.weekKey} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950 dark:text-slate-100">{week.label}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{week.activeDays} active days · {week.entries.length} entries</p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-700">
                      {week.wordCount} words
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-600">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                      style={{ width: `${Math.min((week.activeDays / 7) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Average {week.averageWords} words per active day</p>
                </article>
              ))}
              {!weeklySummaries.length ? <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">No weekly summaries yet.</p> : null}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:shadow-slate-900/40">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Data source</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-100">Recent diary entries used</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {sortedEntries.length} entries loaded
          </span>
        </div>

        {sortedEntries.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedEntries.slice(0, 4).map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950 dark:text-slate-100">{entry.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{entry.content}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600">
                    {weekdayFormatter.format(new Date(getEntryActivityDate(entry)))}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Create diary entries to populate this dashboard.
          </p>
        )}
      </section>
    </div>
  );
}
