"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Moon,
  PencilLine,
  Search,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { BrainLogo } from "@/components/brain-logo";
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
];

function getEntryDate(entry: DiaryEntry) {
  return new Date(entry.entryDate ?? entry.createdAt);
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
      setAuthError(errorCode ? `${errorCode}: ${errorDescription}` : errorDescription);
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
        setEntries([...nextEntries].sort((a, b) => getEntryDate(b).getTime() - getEntryDate(a).getTime()));
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
    const weekEntries = entries.filter((entry) => getEntryDate(entry) >= weekStart);
    const activeDays = new Set(weekEntries.map((entry) => getEntryDate(entry).toDateString())).size;
    const moodCounts: Record<DiaryMood, number> = { great: 0, good: 0, neutral: 0, bad: 0 };
    weekEntries.forEach((entry) => {
      if (entry.mood) moodCounts[entry.mood] += 1;
    });
    const dominantMood = (Object.entries(moodCounts) as Array<[DiaryMood, number]>)
      .sort((first, second) => second[1] - first[1])[0];

    return {
      weekEntries: weekEntries.length,
      activeDays,
      mood: dominantMood?.[1] ? dominantMood[0] : null,
    };
  }, [entries]);

  const displayName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split("@")[0]
    ?? "there";
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
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
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
          <div className="absolute inset-0 -z-10 bg-white/72 dark:bg-slate-950/78" aria-hidden="true" />

          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            {authError ? (
              <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                {authError}
              </div>
            ) : null}

            <div className="mx-auto max-w-3xl text-center">
              {isAuthenticated ? (
                <>
                  <p className="mb-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300">Your memory desk</p>
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
                    Day<span className="text-indigo-600 dark:text-indigo-300">Dreamer</span>
                  </h1>
                  <p className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100 sm:text-2xl">
                    Remember what mattered. Find it when you need it.
                  </p>
                  <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                    Capture a thought now. Your first draft stays on this device until you are ready to keep it.
                  </p>
                </>
              )}

              <form onSubmit={handleQuickCapture} className="mx-auto mt-8 max-w-2xl text-left">
                <label htmlFor="home-capture" className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
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
                    placeholder={isAuthenticated ? "What do you want to remember?" : "Write something you do not want to lose..."}
                    className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!captureText.trim()}
                    className="action-primary h-11 w-11 shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={isAuthenticated ? "Continue memory in Diary" : "Save draft"}
                    title={isAuthenticated ? "Continue in Diary" : "Save draft"}
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </form>

              {showGuestPrompt ? (
                <div className="mx-auto mt-3 flex max-w-2xl flex-col items-center justify-between gap-3 rounded-lg bg-indigo-50/90 px-4 py-3 text-sm text-indigo-900 sm:flex-row dark:bg-indigo-950/70 dark:text-indigo-100" role="status">
                  <span>Your draft is saved on this device.</span>
                  <div className="flex items-center gap-2">
                    <Link href="/diary" className="font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-white">
                      Keep writing
                    </Link>
                    <span className="text-indigo-300 dark:text-indigo-700">/</span>
                    <Link href="/login" className="font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-white">
                      Sign in to keep it
                    </Link>
                  </div>
                </div>
              ) : null}

              {!isAuthenticated ? (
                <a href="#how-it-works" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300">
                  See how memories become useful
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}

              {isAuthenticated ? (
                <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 border-y border-slate-300/80 py-4 dark:border-slate-700/80">
                  <div>
                    <p className="text-xl font-bold text-slate-950 dark:text-white">{isDataLoading ? "..." : homeStats.weekEntries}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This week</p>
                  </div>
                  <div className="border-x border-slate-300/80 dark:border-slate-700/80">
                    <p className="text-xl font-bold text-slate-950 dark:text-white">{isDataLoading ? "..." : homeStats.activeDays}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active days</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-950 dark:text-white">
                      <MoodIcon className="h-4 w-4" aria-hidden="true" />
                      {homeStats.mood ? MOOD_META[homeStats.mood].label : "No mood yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mood trend</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {isAuthenticated ? (
          <AuthenticatedHome
            latestEntry={latestEntry}
            latestSummary={latestSummary}
            isLoading={isDataLoading}
          />
        ) : (
          <GuestHome />
        )}
      </main>
    </div>
  );
}

function AuthenticatedHome({
  latestEntry,
  latestSummary,
  isLoading,
}: {
  latestEntry?: DiaryEntry;
  latestSummary?: SummaryRecord;
  isLoading: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="enterprise-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-cyan-700 dark:text-cyan-300">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Recent memory
            </div>
            {latestEntry ? <span className="text-xs text-slate-400">{formatMemoryDate(latestEntry)}</span> : null}
          </div>
          {isLoading ? (
            <div className="mt-5 space-y-3">
              <div className="skeleton-line h-5 w-1/2" />
              <div className="skeleton-line h-4 w-full" />
              <div className="skeleton-line h-4 w-4/5" />
            </div>
          ) : latestEntry ? (
            <>
              <h2 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{latestEntry.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{latestEntry.content}</p>
              <Link href="/timeline" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100">
                Continue your timeline <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <div className="mt-5">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">Your first memory starts here</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Write one honest sentence about today. You can add the details later.</p>
              <Link href="/diary" className="action-primary mt-5">Write a memory</Link>
            </div>
          )}
        </article>

        <article className="enterprise-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-pink-700 dark:text-pink-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI reflection
          </div>
          {isLoading ? (
            <div className="mt-5 space-y-3">
              <div className="skeleton-line h-4 w-full" />
              <div className="skeleton-line h-4 w-5/6" />
              <div className="skeleton-line h-4 w-2/3" />
            </div>
          ) : (
            <p className="mt-5 line-clamp-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
              {latestSummary?.content ?? "Your reflections will become more useful as you add memories. Generate a summary when you are ready to look for patterns."}
            </p>
          )}
          <Link href="/summary" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pink-700 hover:text-pink-900 dark:text-pink-300 dark:hover:text-pink-100">
            Open reflections <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section aria-labelledby="questions-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-300">Ask your memories</p>
            <h2 id="questions-heading" className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">A few places to begin</h2>
          </div>
          <Link href="/search" className="hidden text-sm font-semibold text-indigo-600 hover:text-indigo-800 sm:inline">Open AI Search</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {PERSONAL_QUESTIONS.map((question) => (
            <Link key={question} href="/search" className="group flex min-h-24 items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/20">
              <span className="text-sm font-semibold leading-6 text-slate-700 group-hover:text-indigo-900 dark:text-slate-200 dark:group-hover:text-indigo-100">{question}</span>
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function GuestHome() {
  const journey = [
    {
      title: "Capture",
      description: "Write the moment while it is still clear. Add mood, context, or an attachment when it helps.",
      icon: PencilLine,
      className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    },
    {
      title: "Recall",
      description: "Ask a natural question and receive an answer grounded in memories you actually saved.",
      icon: Search,
      className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    },
    {
      title: "Reflect",
      description: "Notice mood, themes, and changes over time without turning your life into a spreadsheet.",
      icon: Sparkles,
      className: "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
    },
  ];

  return (
    <>
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-300">From a moment to a memory</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Capture, recall, reflect</h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">DayDreamer follows a simple rhythm. Write naturally first, then let your own history become searchable and useful.</p>
        </div>

        <div className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          <div className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-slate-200 md:block dark:bg-slate-800" aria-hidden="true" />
          {journey.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <article key={step.title} className="relative">
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-lg ${step.className}`}>
                  <StepIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-5 text-xs font-semibold text-slate-400">0{index + 1}</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <p className="text-[13px] font-semibold text-pink-600 dark:text-pink-300">Your history, in context</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">A timeline that reads like your life</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">Dates stay prominent. Technical metadata stays quiet. Each memory keeps its mood, tags, calendar context, and attachments nearby.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="action-primary">Create your account</Link>
              <Link href="/timeline" className="action-secondary">View timeline demo</Link>
            </div>
          </div>

          <div className="relative pl-9" aria-label="Example memory timeline">
            <div className="absolute bottom-8 left-[13px] top-8 w-px bg-pink-200 dark:bg-pink-900" aria-hidden="true" />
            {[
              { date: "Today", title: "A slower, clearer morning", text: "I left the phone on the desk and wrote down the idea before the day became noisy.", mood: "Calm" },
              { date: "Yesterday", title: "The presentation finally clicked", text: "The story became simpler when I focused on the decision instead of every detail.", mood: "Energized" },
            ].map((memory) => (
              <article key={memory.title} className="relative mb-4 rounded-lg border border-slate-200 bg-[#f8fafc] p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="absolute -left-[34px] top-6 h-4 w-4 rounded-full border-4 border-white bg-pink-500 dark:border-slate-900" aria-hidden="true" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-pink-600 dark:text-pink-300">{memory.date}</span>
                  <span className="text-xs text-slate-400">{memory.mood}</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-950 dark:text-white">{memory.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{memory.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-bold text-slate-950 dark:text-white">Start with one honest sentence</h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">You do not need to organize everything today. Capture one memory and let DayDreamer build from there.</p>
        <Link href="/signup" className="action-primary mt-6">Create a free account</Link>
      </section>
    </>
  );
}
