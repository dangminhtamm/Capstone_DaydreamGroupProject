"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  Clock3,
  Flame,
  MessageCircleQuestion,
  Moon,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { BrainLogo } from "@/components/brain-logo";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getDiaryEntries,
  getSummaries,
  type DiaryEntry,
  type DiaryMood,
  type SummaryRecord,
} from "@/lib/api-client";
import { readHomeDraft, writeHomeDraft } from "@/lib/home-draft";
import { MOOD_META } from "@/lib/mood-meta";

const PERSONAL_QUESTIONS = [
  "What themes have appeared in my recent memories?",
  "How has my mood changed this week?",
  "What should I carry into next week?",
  "What deserves my attention tomorrow?",
];

function getEntryDate(entry: DiaryEntry) {
  return new Date(entry.createdAt);
}

function getStartOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getRecentDays(entries: DiaryEntry[]) {
  const today = getStartOfDay();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const count = entries.filter((entry) =>
      isSameLocalDay(getEntryDate(entry), date),
    ).length;

    return { date, count };
  });
}

function getCurrentStreak(entries: DiaryEntry[]) {
  const activeDates = new Set(
    entries.map((entry) => getStartOfDay(getEntryDate(entry)).getTime()),
  );
  const cursor = getStartOfDay();
  let streak = 0;

  if (!activeDates.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (activeDates.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getStartOfWeek() {
  const start = new Date();
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatMemoryDate(entry: DiaryEntry) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(getEntryDate(entry));
}

function formatCreatedTime(entry: DiaryEntry) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(getEntryDate(entry));
}

function formatTodayDate() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function formatSummaryType(type: SummaryRecord["type"]) {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} reflection`;
}

function getWeeklyRhythmNarrative({
  weekEntries,
  activeDays,
  mood,
  recentDays,
}: {
  weekEntries: number;
  activeDays: number;
  mood: DiaryMood | null;
  recentDays: Array<{ date: Date; count: number }>;
}) {
  if (!weekEntries) {
    return "This week is still open. One honest memory is enough to give it a shape.";
  }

  const busiestDay = [...recentDays].sort(
    (first, second) => second.count - first.count,
  )[0];
  const cadence =
    activeDays >= 5
      ? "You kept a steady thread"
      : activeDays >= 3
        ? "You returned to your memories several times"
        : "You captured a few meaningful moments";
  const moodSentence = mood
    ? `The emotional tone leaned ${MOOD_META[mood].label.toLocaleLowerCase()}.`
    : "Add a mood to make the emotional pattern easier to notice.";
  const busiestSentence =
    busiestDay?.count && busiestDay.count > 1
      ? `Your most reflective day was ${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(busiestDay.date)}.`
      : "";

  return `${cadence} across ${activeDays} active day${activeDays === 1 ? "" : "s"}. ${moodSentence} ${busiestSentence}`.trim();
}

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [authError, setAuthError] = useState("");
  const [captureText, setCaptureText] = useState("");
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [summaries, setSummaries] = useState<SummaryRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorDescription = params.get("error_description");
    const errorCode = params.get("error_code");
    if (errorDescription) {
      setAuthError(
        errorCode ? `${errorCode}: ${errorDescription}` : errorDescription,
      );
    }

    const savedDraft = readHomeDraft();
    if (savedDraft) setCaptureText(savedDraft.content);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setEntries([]);
      setSummaries([]);
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) return;
    let cancelled = false;
    setIsDataLoading(true);

    Promise.all([
      getDiaryEntries(accessToken, 50),
      getSummaries(accessToken, { limit: 5 }),
    ])
      .then(([nextEntries, nextSummaries]) => {
        if (cancelled) return;
        setEntries(
          [...nextEntries].sort(
            (a, b) => getEntryDate(b).getTime() - getEntryDate(a).getTime(),
          ),
        );
        setSummaries(nextSummaries);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setSummaries([]);
      })
      .finally(() => {
        if (!cancelled) setIsDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated]);

  const homeStats = useMemo(() => {
    const weekStart = getStartOfWeek();
    const weekEntries = entries.filter(
      (entry) => getEntryDate(entry) >= weekStart,
    );
    const today = new Date();
    const todayEntries = entries.filter((entry) =>
      isSameLocalDay(getEntryDate(entry), today),
    );
    const activeDays = new Set(
      weekEntries.map((entry) => getEntryDate(entry).toDateString()),
    ).size;
    const moodCounts: Record<DiaryMood, number> = {
      great: 0,
      good: 0,
      neutral: 0,
      bad: 0,
    };
    weekEntries.forEach((entry) => {
      if (entry.mood) moodCounts[entry.mood] += 1;
    });
    const dominantMood = (
      Object.entries(moodCounts) as Array<[DiaryMood, number]>
    ).sort((first, second) => second[1] - first[1])[0];

    return {
      weekEntries: weekEntries.length,
      todayEntries,
      activeDays,
      mood: dominantMood?.[1] ? dominantMood[0] : null,
      recentDays: getRecentDays(entries),
      streak: getCurrentStreak(entries),
    };
  }, [entries]);

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "there";
  const firstName = displayName.split(" ")[0];
  const latestEntry = entries[0];
  const latestSummary = summaries[0];
  const MoodIcon = homeStats.mood ? MOOD_META[homeStats.mood].icon : Sparkles;

  function handleQuickCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureText.trim()) return;
    writeHomeDraft(captureText);

    if (isAuthenticated) {
      router.push("/diary");
      return;
    }

    setShowGuestPrompt(true);
  }

  if (isAuthenticated) {
    return (
      <AuthenticatedToday
        firstName={firstName}
        captureText={captureText}
        setCaptureText={setCaptureText}
        onQuickCapture={handleQuickCapture}
        todayEntries={homeStats.todayEntries}
        latestEntry={latestEntry}
        latestSummary={latestSummary}
        isLoading={isDataLoading}
        weekEntries={homeStats.weekEntries}
        activeDays={homeStats.activeDays}
        streak={homeStats.streak}
        mood={homeStats.mood}
        recentDays={homeStats.recentDays}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="relative z-20 border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="hidden sm:block">
            <BrainLogo size="sm" variant="badge" showText href="/" />
          </div>
          <div className="sm:hidden">
            <BrainLogo size="sm" variant="badge" showText={false} href="/" />
          </div>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="action-quiet shrink-0 p-2"
              aria-label={isDark ? "Use light theme" : "Use dark theme"}
              title={isDark ? "Use light theme" : "Use dark theme"}
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {isLoading ? (
              <div className="skeleton-line h-9 w-24" />
            ) : isAuthenticated ? (
              <>
                <Link
                  href="/settings"
                  className="action-quiet hidden max-w-44 min-w-0 gap-2 px-3 sm:inline-flex"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{displayName}</span>
                </Link>
                <Link href="/diary" className="action-primary px-3 sm:px-4">
                  Open diary
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="action-quiet whitespace-nowrap px-2 text-[13px] sm:px-3 sm:text-sm"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="action-primary whitespace-nowrap px-2 text-[13px] sm:px-4 sm:text-sm"
                >
                  <span className="sm:hidden">Sign up</span>
                  <span className="hidden sm:inline">Create account</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate flex min-h-[calc(100svh-8rem)] max-h-[760px] items-center overflow-hidden border-b border-slate-200 dark:border-slate-800">
          <Image
            src="/daydreamer-hero.png"
            alt="An open journal and phone on a quiet writing desk"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-center dark:opacity-35"
          />
          <div
            className="absolute inset-0 -z-10 bg-white/72 dark:bg-slate-950/78"
            aria-hidden="true"
          />

          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            {authError ? (
              <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                {authError}
              </div>
            ) : null}

            <div className="mx-auto max-w-3xl text-center">
              {isAuthenticated ? (
                <>
                  <p className="mb-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                    Your memory desk
                  </p>
                  <h1 className="text-4xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-5xl">
                    {getGreeting()}, {firstName}
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                    {homeStats.weekEntries
                      ? `You captured ${homeStats.weekEntries} ${homeStats.weekEntries === 1 ? "memory" : "memories"} this week. Keep the thread going.`
                      : "A quiet place to capture what happened, find it later, and notice what is changing."}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-5xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-6xl">
                    Day
                    <span className="text-indigo-600 dark:text-indigo-300">
                      Dreamer
                    </span>
                  </h1>
                  <p className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100 sm:text-2xl">
                    Remember what mattered. Find it when you need it.
                  </p>
                  <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                    Capture a thought now. Your first draft stays on this device
                    until you are ready to keep it.
                  </p>
                </>
              )}

              <form
                onSubmit={handleQuickCapture}
                className="mx-auto mt-8 max-w-2xl text-left"
              >
                <label
                  htmlFor="home-capture"
                  className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-200"
                >
                  Quick capture
                </label>
                <div className="flex items-end gap-2 rounded-lg border border-slate-300 bg-white/94 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-950/90">
                  <textarea
                    id="home-capture"
                    rows={2}
                    value={captureText}
                    onChange={(event) => {
                      setCaptureText(event.target.value);
                      setShowGuestPrompt(false);
                    }}
                    placeholder={
                      isAuthenticated
                        ? "What do you want to remember?"
                        : "Write something you do not want to lose..."
                    }
                    className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!captureText.trim()}
                    className="action-primary h-11 w-11 shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={
                      isAuthenticated
                        ? "Continue memory in Diary"
                        : "Save draft"
                    }
                    title={isAuthenticated ? "Continue in Diary" : "Save draft"}
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </form>

              {showGuestPrompt ? (
                <div
                  className="mx-auto mt-3 flex max-w-2xl flex-col items-center justify-between gap-3 rounded-lg bg-indigo-50/90 px-4 py-3 text-sm text-indigo-900 sm:flex-row dark:bg-indigo-950/70 dark:text-indigo-100"
                  role="status"
                >
                  <span>Your draft is saved on this device.</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/diary"
                      className="font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-white"
                    >
                      Keep writing
                    </Link>
                    <span className="text-indigo-300 dark:text-indigo-700">
                      /
                    </span>
                    <Link
                      href="/login"
                      className="font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-white"
                    >
                      Sign in to keep it
                    </Link>
                  </div>
                </div>
              ) : null}

              {!isAuthenticated ? (
                <a
                  href="#how-it-works"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300"
                >
                  See how memories become useful
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}

              {isAuthenticated ? (
                <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 border-y border-slate-300/80 py-4 dark:border-slate-700/80">
                  <div>
                    <p className="text-xl font-bold text-slate-950 dark:text-white">
                      {isDataLoading ? "..." : homeStats.weekEntries}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      This week
                    </p>
                  </div>
                  <div className="border-x border-slate-300/80 dark:border-slate-700/80">
                    <p className="text-xl font-bold text-slate-950 dark:text-white">
                      {isDataLoading ? "..." : homeStats.activeDays}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Active days
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-950 dark:text-white">
                      <MoodIcon className="h-4 w-4" aria-hidden="true" />
                      {homeStats.mood
                        ? MOOD_META[homeStats.mood].label
                        : "No mood yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Mood trend
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <GuestHome />
      </main>
    </div>
  );
}

function AuthenticatedToday({
  firstName,
  captureText,
  setCaptureText,
  onQuickCapture,
  todayEntries,
  latestEntry,
  latestSummary,
  isLoading,
  weekEntries,
  activeDays,
  streak,
  mood,
  recentDays,
}: {
  firstName: string;
  captureText: string;
  setCaptureText: (value: string) => void;
  onQuickCapture: (event: FormEvent<HTMLFormElement>) => void;
  todayEntries: DiaryEntry[];
  latestEntry?: DiaryEntry;
  latestSummary?: SummaryRecord;
  isLoading: boolean;
  weekEntries: number;
  activeDays: number;
  streak: number;
  mood: DiaryMood | null;
  recentDays: Array<{ date: Date; count: number }>;
}) {
  const MoodIcon = mood ? MOOD_META[mood].icon : Sparkles;
  const maxDayCount = Math.max(1, ...recentDays.map((day) => day.count));
  const weeklyNarrative = getWeeklyRhythmNarrative({
    weekEntries,
    activeDays,
    mood,
    recentDays,
  });

  return (
    <DashboardShell title="Today" description={formatTodayDate()}>
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="flex min-w-0 flex-col justify-center">
            <p className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
              <Sun className="h-4 w-4" aria-hidden="true" />
              {formatTodayDate()}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white sm:text-4xl">
              {getGreeting()}, {firstName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              {isLoading
                ? "Gathering today's memories..."
                : todayEntries.length
                  ? `You captured ${todayEntries.length} ${todayEntries.length === 1 ? "memory" : "memories"} today.`
                  : "Your day is ready for its first memory."}
            </p>

            <form
              onSubmit={onQuickCapture}
              className="enterprise-card mt-5 flex items-end gap-2 p-2 shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
            >
              <label htmlFor="today-capture" className="sr-only">
                Quick capture
              </label>
              <textarea
                id="today-capture"
                rows={2}
                value={captureText}
                onChange={(event) => setCaptureText(event.target.value)}
                placeholder="What do you want to remember about today?"
                className="min-h-16 min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!captureText.trim()}
                className="action-primary h-11 w-11 shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Continue memory in Diary"
                title="Continue in Diary"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>

          <article className="enterprise-card flex min-w-0 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-cyan-700 dark:text-cyan-300">
                  <ChartNoAxesColumnIncreasing
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  Weekly rhythm
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  Keep the thread going
                </h2>
              </div>
              {streak > 0 ? (
                <span className="status-badge border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-200">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  {streak} day streak
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-3 border-y border-slate-200 py-2.5 text-center dark:border-slate-800">
              <div>
                <p className="text-xl font-bold text-slate-950 dark:text-white">
                  {isLoading ? "..." : weekEntries}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Memories
                </p>
              </div>
              <div className="border-x border-slate-200 dark:border-slate-800">
                <p className="text-xl font-bold text-slate-950 dark:text-white">
                  {isLoading ? "..." : activeDays}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Active days
                </p>
              </div>
              <div className="min-w-0 px-1">
                <p className="flex items-center justify-center gap-1.5 truncate text-sm font-bold text-slate-950 dark:text-white">
                  <MoodIcon
                    className={`h-4 w-4 shrink-0 ${mood ? MOOD_META[mood].iconClassName : "text-slate-400"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {mood ? MOOD_META[mood].label : "No mood"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  This week
                </p>
              </div>
            </div>

            <p className="mt-4 border-l-2 border-cyan-200 pl-3 text-sm leading-6 text-slate-600 dark:border-cyan-900 dark:text-slate-300">
              {isLoading ? "Reading this week's rhythm..." : weeklyNarrative}
            </p>

            <div
              className="mt-3 grid flex-1 grid-cols-7 gap-1.5"
              aria-label="Memory activity over the last seven days"
            >
              {recentDays.map((day) => {
                const isToday = isSameLocalDay(day.date, new Date());
                const height = day.count
                  ? Math.max(24, Math.round((day.count / maxDayCount) * 48))
                  : 8;

                return (
                  <div
                    key={day.date.toISOString()}
                    className="flex min-w-0 flex-col items-center justify-end gap-1.5"
                    title={`${day.count} ${day.count === 1 ? "memory" : "memories"}`}
                  >
                    <span className="text-[11px] font-semibold text-slate-400">
                      {day.count || ""}
                    </span>
                    <span
                      className={`w-full max-w-7 rounded-sm ${
                        day.count
                          ? isToday
                            ? "bg-indigo-500 dark:bg-indigo-400"
                            : "bg-cyan-400 dark:bg-cyan-600"
                          : "bg-slate-200 dark:bg-slate-800"
                      }`}
                      style={{ height }}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-[11px] font-semibold ${
                        isToday
                          ? "text-indigo-600 dark:text-indigo-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "narrow",
                      }).format(day.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
          <div className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-pink-600 dark:text-pink-300">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Today&apos;s memories
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  What you captured
                </h2>
              </div>
              <Link
                href="/timeline"
                className="text-sm font-semibold text-pink-600 transition hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-100"
              >
                View timeline
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((item) => (
                  <div key={item} className="enterprise-card p-5">
                    <div className="skeleton-line h-5 w-2/5" />
                    <div className="skeleton-line mt-3 h-4 w-full" />
                    <div className="skeleton-line mt-2 h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : todayEntries.length ? (
              <div className="space-y-3">
                {todayEntries.slice(0, 3).map((entry) => {
                  const entryMood = entry.mood ? MOOD_META[entry.mood] : null;
                  const EntryMoodIcon = entryMood?.icon;

                  return (
                    <Link
                      key={entry.id}
                      href={`/timeline#entry-${entry.id}`}
                      className="group block rounded-lg border border-slate-200 bg-white p-5 transition hover:border-pink-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-pink-900"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-slate-950 group-hover:text-pink-700 dark:text-white dark:group-hover:text-pink-200">
                            {entry.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {entry.content}
                          </p>
                        </div>
                        <ArrowRight
                          className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-pink-500 dark:text-slate-600"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatCreatedTime(entry)}
                        </span>
                        {entryMood && EntryMoodIcon ? (
                          <span
                            className={`flex items-center gap-1.5 ${entryMood.iconClassName}`}
                          >
                            <EntryMoodIcon
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {entryMood.label}
                          </span>
                        ) : null}
                        {entry.tags?.slice(0, 2).map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-5 py-6 text-center dark:border-slate-700 dark:bg-slate-900/30">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300">
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
                  Add today&apos;s first memory
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {latestEntry
                    ? `Your latest capture was ${formatMemoryDate(latestEntry)}.`
                    : "One honest sentence is enough to begin."}
                </p>
                <Link href="/diary" className="action-primary mt-4">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New memory
                </Link>
              </div>
            )}

            <MemoryQuestions />
          </div>

          <aside className="space-y-4">
            <article className="enterprise-card p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                {latestSummary ? (
                  <span className="status-badge">
                    {formatSummaryType(latestSummary.type)}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
                Latest reflection
              </h2>
              {isLoading ? (
                <div className="mt-4 space-y-2">
                  <div className="skeleton-line h-4 w-full" />
                  <div className="skeleton-line h-4 w-5/6" />
                  <div className="skeleton-line h-4 w-2/3" />
                </div>
              ) : (
                <p className="mt-3 line-clamp-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {latestSummary?.content ??
                    "Your next reflection will appear after your memories are summarized."}
                </p>
              )}
              <Link
                href="/summary"
                className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-pink-600 transition hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-100"
              >
                Open summary
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1 2xl:grid-cols-2">
              <Link
                href="/diary"
                className="group flex min-h-24 flex-col justify-between rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-100 dark:hover:bg-cyan-950/50"
              >
                <PencilLine className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-semibold">Write memory</span>
              </Link>
              <Link
                href="/search"
                className="group flex min-h-24 flex-col justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 text-indigo-900 transition hover:bg-indigo-100 dark:border-indigo-900/70 dark:bg-indigo-950/30 dark:text-indigo-100 dark:hover:bg-indigo-950/50"
              >
                <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-semibold">Ask memories</span>
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </DashboardShell>
  );
}

function MemoryQuestions() {
  return (
    <section className="mt-8" aria-labelledby="today-questions-heading">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-indigo-600 dark:text-indigo-300">
            <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
            Ask your memories
          </p>
          <h2
            id="today-questions-heading"
            className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white"
          >
            Questions worth asking today
          </h2>
        </div>
        <Link
          href="/search"
          className="hidden text-sm font-semibold text-indigo-600 hover:text-indigo-800 sm:inline dark:text-indigo-300 dark:hover:text-indigo-100"
        >
          Open AI Search
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {PERSONAL_QUESTIONS.map((question) => (
          <Link
            key={question}
            href={{ pathname: "/search", query: { q: question } }}
            className="group flex min-h-20 items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/20"
          >
            <span className="text-sm font-semibold leading-6 text-slate-700 group-hover:text-indigo-900 dark:text-slate-200 dark:group-hover:text-indigo-100">
              {question}
            </span>
            <Search
              className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

function GuestHome() {
  const journey = [
    {
      title: "Capture",
      description:
        "Write the moment while it is still clear. Add mood, context, or an attachment when it helps.",
      icon: PencilLine,
      className:
        "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    },
    {
      title: "Recall",
      description:
        "Ask a natural question and receive an answer grounded in memories you actually saved.",
      icon: Search,
      className:
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    },
    {
      title: "Reflect",
      description:
        "Notice mood, themes, and changes over time without turning your life into a spreadsheet.",
      icon: Sparkles,
      className:
        "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
    },
  ];

  return (
    <>
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20"
      >
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-300">
            From a moment to a memory
          </p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
            Capture, recall, reflect
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
            DayDreamer follows a simple rhythm. Write naturally first, then let
            your own history become searchable and useful.
          </p>
        </div>

        <div className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          <div
            className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-slate-200 md:block dark:bg-slate-800"
            aria-hidden="true"
          />
          {journey.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <article key={step.title} className="relative">
                <div
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-lg ${step.className}`}
                >
                  <StepIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-5 text-xs font-semibold text-slate-400">
                  0{index + 1}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <p className="text-[13px] font-semibold text-pink-600 dark:text-pink-300">
              Your history, in context
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
              A timeline that reads like your life
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Dates stay prominent. Technical metadata stays quiet. Each memory
              keeps its mood, tags, calendar context, and attachments nearby.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="action-primary">
                Create your account
              </Link>
              <Link href="/timeline" className="action-secondary">
                View timeline demo
              </Link>
            </div>
          </div>

          <div className="relative pl-9" aria-label="Example memory timeline">
            <div
              className="absolute bottom-8 left-[13px] top-8 w-px bg-pink-200 dark:bg-pink-900"
              aria-hidden="true"
            />
            {[
              {
                date: "Today",
                title: "A slower, clearer morning",
                text: "I left the phone on the desk and wrote down the idea before the day became noisy.",
                mood: "Calm",
              },
              {
                date: "Yesterday",
                title: "The presentation finally clicked",
                text: "The story became simpler when I focused on the decision instead of every detail.",
                mood: "Energized",
              },
            ].map((memory) => (
              <article
                key={memory.title}
                className="relative mb-4 rounded-lg border border-slate-200 bg-[#f8fafc] p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <span
                  className="absolute -left-[34px] top-6 h-4 w-4 rounded-full border-4 border-white bg-pink-500 dark:border-slate-900"
                  aria-hidden="true"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-pink-600 dark:text-pink-300">
                    {memory.date}
                  </span>
                  <span className="text-xs text-slate-400">{memory.mood}</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-950 dark:text-white">
                  {memory.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {memory.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-bold text-slate-950 dark:text-white">
          Start with one honest sentence
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          You do not need to organize everything today. Capture one memory and
          let DayDreamer build from there.
        </p>
        <Link href="/signup" className="action-primary mt-6">
          Create a free account
        </Link>
      </section>
    </>
  );
}
