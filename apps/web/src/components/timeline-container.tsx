"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getDiaryEntries, updateDiaryEntry, deleteDiaryEntry, type DiaryEntry, type UpdateDiaryPayload } from "@/lib/api-client";
import { TimelineList } from "./timeline-list";

type LoadState = "idle" | "loading" | "success" | "error";

function SkeletonCards() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="relative pl-14">
          <div className="absolute left-0 top-6 h-10 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 space-y-2">
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-3.5 w-1/3 animate-pulse rounded-full bg-slate-100 dark:bg-slate-600" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-600" />
              <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-slate-100 dark:bg-slate-600" />
              <div className="h-3.5 w-9/12 animate-pulse rounded-full bg-slate-100 dark:bg-slate-600" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Mini Calendar ─── */
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function MiniCalendar({
  entryDates,
  selectedDate,
  onSelect,
}: {
  entryDates: Set<string>;
  selectedDate: string | null;
  onSelect: (dateKey: string | null) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthLabel = viewMonth.toLocaleString("default", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="cursor-pointer rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="cursor-pointer rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{d}</span>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;

          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasEntry = entryDates.has(dateKey);
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === todayKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(isSelected ? null : (hasEntry ? dateKey : null))}
              disabled={!hasEntry}
              className={`relative mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition
                ${isSelected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : hasEntry
                    ? "text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
                    : "cursor-default text-slate-300 dark:text-slate-600"
                }
                ${isToday && !isSelected ? "ring-1 ring-indigo-400 dark:ring-indigo-500" : ""}
              `}
            >
              {day}
              {hasEntry && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Show All */}
      {selectedDate && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-3 w-full cursor-pointer rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          Show all entries
        </button>
      )}
    </div>
  );
}

export function TimelineContainer() {
  const { getAccessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const accessToken = getAccessToken();
      const data = await getDiaryEntries(accessToken);
      setEntries(data);
      setState("success");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to load entries");
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setEntries([]);
      setState("idle");
      return;
    }
    fetchEntries();
  }, [isAuthenticated, authLoading, fetchEntries]);

  const handleUpdate = useCallback(async (id: string, payload: UpdateDiaryPayload) => {
    const accessToken = getAccessToken();
    const updated = await updateDiaryEntry(id, payload, accessToken);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
  }, [getAccessToken]);

  const handleDelete = useCallback(async (id: string) => {
    const accessToken = getAccessToken();
    await deleteDiaryEntry(id, accessToken);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, [getAccessToken]);

  // Build set of date keys that have entries
  const entryDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      set.add(new Date(e.createdAt).toISOString().slice(0, 10));
    }
    return set;
  }, [entries]);

  // Filter entries by selected date
  const filteredEntries = useMemo(() => {
    if (!selectedDate) return entries;
    return entries.filter((e) => new Date(e.createdAt).toISOString().slice(0, 10) === selectedDate);
  }, [entries, selectedDate]);

  if (authLoading) {
    return <SkeletonCards />;
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        {/* Demo cards (faded) */}
        <div className="pointer-events-none select-none opacity-50 blur-[1px]">
          {[1, 2].map((i) => (
            <div key={i} className="relative mb-6 pl-14">
              <div className="absolute left-0 top-6 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500" />
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-2 h-5 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="mb-1 h-3.5 w-1/3 rounded-full bg-slate-100 dark:bg-slate-600" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-600" />
                  <div className="h-3.5 w-10/12 rounded-full bg-slate-100 dark:bg-slate-600" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overlay CTA */}
        <div className="-mt-32 relative z-10 rounded-3xl border border-indigo-200/70 bg-white/90 p-8 text-center shadow-lg backdrop-blur dark:border-indigo-700/50 dark:bg-slate-800/90">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">Your timeline will appear here</h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Sign in to see your saved diary entries in a beautiful timeline.</p>
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

  if (state === "loading") {
    return <SkeletonCards />;
  }

  if (state === "error") {
    return (
      <div className="rounded-3xl border border-rose-200/70 bg-rose-50/60 p-12 text-center dark:border-rose-700/50 dark:bg-rose-900/20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">Could not load entries</h3>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{errorMessage}</p>
        <button
          onClick={() => fetchEntries()}
          className="mt-5 cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        {selectedDate && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-2 dark:border-indigo-800 dark:bg-indigo-900/20">
            <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              Showing entries for {new Date(selectedDate + "T00:00:00").toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span className="ml-1 text-xs text-indigo-500 dark:text-indigo-400">({filteredEntries.length})</span>
          </div>
        )}
        <TimelineList entries={filteredEntries} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
      <aside className="order-first lg:order-last">
        <div className="sticky top-28">
          <MiniCalendar
            entryDates={entryDates}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
          {/* Quick stats */}
          <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Stats</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{entries.length}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Total entries</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{entryDates.size}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Days written</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
