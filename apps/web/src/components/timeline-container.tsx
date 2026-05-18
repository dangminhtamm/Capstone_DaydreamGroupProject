"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getDiaryEntries, type DiaryEntry } from "@/lib/api-client";
import { TimelineList } from "./timeline-list";

type LoadState = "idle" | "loading" | "success" | "error";

function SkeletonCards() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="relative pl-14">
          <div className="absolute left-0 top-6 h-10 w-10 animate-pulse rounded-full bg-slate-200" />
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-4 space-y-2">
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3.5 w-1/3 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-full animate-pulse rounded-full bg-slate-100" />
              <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3.5 w-9/12 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimelineContainer() {
  const { getAccessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setEntries([]);
      setState("idle");
      return;
    }

    async function fetchEntries() {
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
    }

    fetchEntries();
  }, [isAuthenticated, authLoading, getAccessToken]);

  if (authLoading) {
    return <SkeletonCards />;
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-amber-200/70 bg-amber-50/60 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-slate-900">Sign in to see your timeline</h3>
        <p className="mt-1.5 text-sm text-slate-500">Your diary entries will appear here after signing in.</p>
      </div>
    );
  }

  if (state === "loading") {
    return <SkeletonCards />;
  }

  if (state === "error") {
    return (
      <div className="rounded-3xl border border-rose-200/70 bg-rose-50/60 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-slate-900">Could not load entries</h3>
        <p className="mt-1.5 text-sm text-slate-500">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return <TimelineList entries={entries} />;
}
