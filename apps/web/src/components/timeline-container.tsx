"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getDiaryEntries, type DiaryEntry } from "@/lib/api-client";
import { TimelineList } from "./timeline-list";

type LoadState = "idle" | "loading" | "success" | "error";

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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Login Required</h3>
        <p className="text-slate-500">Please login to view your diary entries</p>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        <span className="ml-3 text-slate-600">Loading entries...</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Entries</h3>
        <p className="text-slate-500 mb-4">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return <TimelineList entries={entries} />;
}
