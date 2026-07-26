"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createDiaryEntry,
  getDiaryEntries,
  type CreateDiaryPayload,
  type DiaryEntry,
  type DiaryMood,
} from "@/lib/api-client";

type SaveState = "idle" | "saving" | "success" | "error";

const MOOD_OPTIONS: Array<{
  value: DiaryMood;
  emoji: string;
  label: string;
  description: string;
  bgClass: string;
  ringClass: string;
}> = [
  {
    value: "great",
    emoji: "😄",
    label: "Great",
    description: "Energized & happy",
    bgClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    ringClass: "ring-emerald-300 dark:ring-emerald-600",
  },
  {
    value: "good",
    emoji: "🙂",
    label: "Good",
    description: "Steady & content",
    bgClass: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    ringClass: "ring-sky-300 dark:ring-sky-600",
  },
  {
    value: "neutral",
    emoji: "😐",
    label: "Neutral",
    description: "Balanced",
    bgClass: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200",
    ringClass: "ring-slate-300 dark:ring-slate-600",
  },
  {
    value: "bad",
    emoji: "😞",
    label: "Bad",
    description: "Difficult day",
    bgClass: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    ringClass: "ring-rose-300 dark:ring-rose-600",
  },
];

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMoodEmoji(mood?: string | null): string {
  return MOOD_OPTIONS.find((o) => o.value === mood)?.emoji ?? "😐";
}

function getMoodBgClass(mood?: string | null): string {
  return MOOD_OPTIONS.find((o) => o.value === mood)?.bgClass ?? MOOD_OPTIONS[2].bgClass;
}

export function MoodTracker() {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [selectedMood, setSelectedMood] = useState<DiaryMood>("neutral");
  const [note, setNote] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [recentEntries, setRecentEntries] = useState<DiaryEntry[]>([]);
  const [loadedHistory, setLoadedHistory] = useState(false);

  // Load recent mood entries on first render
  useMemo(() => {
    if (loadedHistory || !isAuthenticated) return;
    setLoadedHistory(true);

    async function loadRecent() {
      try {
        const entries = await getDiaryEntries(getAccessToken());
        const moodEntries = entries
          .filter((e: DiaryEntry) => e.mood)
          .slice(0, 7);
        setRecentEntries(moodEntries);
      } catch {
        // Silently fail — not critical
      }
    }

    void loadRecent();
  }, [isAuthenticated, getAccessToken, loadedHistory]);

  async function handleSave() {
    if (!isAuthenticated) {
      setErrorMessage("Sign in to log your mood.");
      return;
    }

    setState("saving");
    setErrorMessage("");

    try {
      const accessToken = getAccessToken();
      const today = getLocalDateInputValue();
      const payload: CreateDiaryPayload = {
        title: `Mood check-in: ${MOOD_OPTIONS.find((o) => o.value === selectedMood)?.label ?? selectedMood}`,
        content: note.trim() || `Feeling ${selectedMood} today.`,
        entryDate: new Date(`${today}T12:00:00`).toISOString(),
        mood: selectedMood,
        tags: ["mood-tracker"],
      };

      const newEntry = await createDiaryEntry(payload, accessToken);
      setState("success");
      setNote("");
      setRecentEntries((prev) => [newEntry, ...prev].slice(0, 7));

      setTimeout(() => setState("idle"), 3000);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save mood.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Mood Selector */}
      <div className="enterprise-card p-5">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Quick check-in
          </p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            How are you feeling?
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Log your mood quickly. It will be saved as a diary entry and indexed for your memory search.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MOOD_OPTIONS.map((option) => {
            const isSelected = selectedMood === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedMood(option.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                  isSelected
                    ? `${option.bgClass} ring-2 ${option.ringClass}`
                    : "border-slate-200 bg-white/70 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
                }`}
                aria-pressed={isSelected}
              >
                <span className="text-3xl">{option.emoji}</span>
                <span className="text-sm font-bold">{option.label}</span>
                <span className="text-[11px] opacity-70">{option.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="mood-note" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Quick note <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="mood-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's on your mind? A few words about your day..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={state === "saving"}
            className="action-primary px-5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "saving" ? "Saving..." : "Log Mood"}
          </button>

          {state === "success" && (
            <span className="status-badge status-badge-success">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Mood logged!
            </span>
          )}
          {state === "error" && (
            <span className="status-badge status-badge-danger">
              {errorMessage || "Save failed."}
            </span>
          )}

          {!isAuthenticated && (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 dark:border-indigo-700 dark:bg-indigo-900/20">
              <svg className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Sign in to track your mood</p>
              </div>
              <a href="/login" className="action-primary shrink-0 min-h-10 px-3 text-xs">Sign in</a>
            </div>
          )}
        </div>
      </div>

      {/* Recent Mood Timeline */}
      {recentEntries.length > 0 && (
        <div className="enterprise-card p-5">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Recent moods
            </p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              Your mood timeline
            </h3>
          </div>

          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${getMoodBgClass(entry.mood)}`}
              >
                <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{entry.title}</p>
                  <p className="mt-0.5 truncate text-xs opacity-70">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {entry.content && entry.content.length > 0 && ` · ${entry.content.slice(0, 60)}${entry.content.length > 60 ? "..." : ""}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/50 px-2 py-0.5 text-[11px] font-bold capitalize dark:bg-black/20">
                  {entry.mood ?? "neutral"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
