"use client";

import { FormEvent, useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSearchHistory,
  clearSearchHistory as apiClearHistory,
  deleteSearchHistoryItem as apiDeleteHistoryItem,
  type SearchHistoryEntry,
} from "@/lib/api-client";

type SearchCitation = {
  marker: string;
  chunkId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  occurredAt: string;
  chunkType: string;
  quote: string;
  similarity: number;
  claim?: string;
};

type QueryAnalytics = {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
  };
  timing: {
    embedMs: number;
    retrieveMs: number;
    generateMs: number;
    totalMs: number;
  };
  chunksRetrieved: number;
  status: "success" | "no_memory" | "error";
};

type MemoryDebugTrace = {
  question: string;
  inferredFilters: Record<string, unknown>;
  appliedFilters: Record<string, unknown>;
  status: "success" | "no_memory" | "error";
  reason: string;
  chunksRetrieved: number;
  topChunks: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    sourceTitle?: string;
    chunkType: string;
    occurredAt: string;
    retrievalMode: string;
    similarity: number;
    vectorSimilarity: number;
    lexicalScore: number;
    distance: number | null;
    quote: string;
  }>;
};

type SearchResponse = {
  answer: string;
  confidence: "high" | "medium" | "low";
  sources: SearchCitation[];
  noMemory?: boolean;
  suggestions?: string[];
  analytics?: QueryAnalytics | null;
  debugTrace?: MemoryDebugTrace | null;
  cached?: boolean;
  cachedAt?: string;
};

type ResponseLanguage = "en" | "vi";


const suggestedQuestions = [
  "What did I work on recently?",
  "What important events happened this week?",
  "Summarize my latest diary memories.",
];

const confidenceStyles = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700",
  medium: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-700",
  low: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-700",
};

export default function SearchPage() {
  const { isAuthenticated, isLoading: isAuthLoading, getAccessToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>("en");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Load language preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("dd-response-lang") as ResponseLanguage | null;
    if (saved === "en" || saved === "vi") setResponseLanguage(saved);
  }, []);

  // Load search history from server when authenticated
  const loadServerHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = getAccessToken();
      const history = await getSearchHistory(token);
      setSearchHistory(history);
    } catch {
      // Silently fail — not critical
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      loadServerHistory();
    }
  }, [isAuthLoading, isAuthenticated, loadServerHistory]);

  const handleClearHistory = useCallback(async () => {
    try {
      const token = getAccessToken();
      await apiClearHistory(token);
      setSearchHistory([]);
    } catch {
      // Silently fail
    }
  }, [getAccessToken]);

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    try {
      const token = getAccessToken();
      await apiDeleteHistoryItem(id, token);
      setSearchHistory((prev) => prev.filter((h) => h.id !== id));
    } catch {
      // Silently fail
    }
  }, [getAccessToken]);

  const toggleLanguage = () => {
    const next = responseLanguage === "en" ? "vi" : "en";
    setResponseLanguage(next);
    localStorage.setItem("dd-response-lang", next);
  };

  const canSubmit = useMemo(
    () => question.trim().length > 0 && !isSearching,
    [question, isSearching],
  );

  const runSearch = useCallback(async (normalizedQuestion: string) => {
    if (!normalizedQuestion) {
      setError("Please enter a question before searching.");
      return;
    }

    // Gate: must be signed in to search
    if (!isAuthenticated) {
      setError(null);
      setShowAuthPrompt(true);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("Session expired. Please sign in again.");
      return;
    }

    setShowAuthPrompt(false);

    setIsSearching(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: normalizedQuestion,
          limit: 8,
          responseLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = (await response.json()) as SearchResponse;
      setResult(data);

      // Refresh history from server (backend auto-saved)
      loadServerHistory();

      // Persist token usage for sidebar widget
      if (data.analytics?.tokenUsage) {
        try {
          const todayKey = new Date().toISOString().slice(0, 10);
          const stored = JSON.parse(localStorage.getItem("dd-token-usage") || "{}");
          const today = stored[todayKey] || { tokens: 0, queries: 0 };
          today.tokens += data.analytics.tokenUsage.totalTokens;
          today.queries += 1;
          stored[todayKey] = today;
          localStorage.setItem("dd-token-usage", JSON.stringify(stored));
        } catch { /* ignore localStorage errors */ }
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed. Please try again.");
      setResult(null);
    } finally {
      setIsSearching(false);
    }
  }, [getAccessToken, isAuthenticated, loadServerHistory, responseLanguage]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(question.trim());
  }

  return (
    <DashboardShell
      title="Memory Search"
      description="Ask a question and get an answer grounded in your saved memories."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/30 dark:shadow-slate-900/40">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">AI-powered recall</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Ask your Second Brain</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Type a natural-language question. Your memories will surface the most relevant answer.
              </p>
            </div>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30"
              title={`AI responds in ${responseLanguage === "en" ? "English" : "Vietnamese"}. Click to toggle.`}
            >
              {responseLanguage === "en" ? (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <clipPath id="flag-us-clip"><circle cx="12" cy="12" r="12"/></clipPath>
                  <g clipPath="url(#flag-us-clip)">
                    <rect width="24" height="24" fill="#B22234"/>
                    <rect y="1.85" width="24" height="1.85" fill="white"/>
                    <rect y="5.54" width="24" height="1.85" fill="white"/>
                    <rect y="9.23" width="24" height="1.85" fill="white"/>
                    <rect y="12.92" width="24" height="1.85" fill="white"/>
                    <rect y="16.62" width="24" height="1.85" fill="white"/>
                    <rect y="20.31" width="24" height="1.85" fill="white"/>
                    <rect width="10" height="12.92" fill="#3C3B6E"/>
                    <g fill="white">{[...Array(5)].map((_, r) => [...Array(r % 2 === 0 ? 6 : 5)].map((_, c) => <circle key={`${r}-${c}`} cx={r % 2 === 0 ? 0.8 + c * 1.6 : 1.6 + c * 1.6} cy={0.7 + r * 1.2} r="0.45"/>))}</g>
                  </g>
                </svg>
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <clipPath id="flag-vn-clip"><circle cx="12" cy="12" r="12"/></clipPath>
                  <g clipPath="url(#flag-vn-clip)">
                    <rect width="24" height="24" fill="#DA251D"/>
                    <polygon points="12,4.8 13.76,10.22 19.44,10.22 14.84,13.58 16.6,18.98 12,15.62 7.4,18.98 9.16,13.58 4.56,10.22 10.24,10.22" fill="#FFFF00"/>
                  </g>
                </svg>
              )}
              <span className="hidden sm:inline">{responseLanguage === "en" ? "English" : "Tiếng Việt"}</span>
            </button>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Question</span>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Example: What did I write about my capstone progress?"
                  className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:ring-indigo-900/40"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuestion(suggestion)}
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Recent Searches
                      <svg className={`h-3 w-3 transition-transform ${showHistory ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="cursor-pointer text-[11px] font-medium text-slate-400 transition hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
                    >
                      Clear All
                    </button>
                  </div>
                  {showHistory && (
                    <div className="space-y-1.5">
                      {searchHistory.map((item) => (
                        <div
                          key={item.id}
                          className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setQuestion(item.question);
                              void runSearch(item.question);
                            }}
                            className="flex flex-1 cursor-pointer items-center gap-2 text-left text-xs text-slate-600 transition hover:text-indigo-700 dark:text-slate-400 dark:hover:text-indigo-300"
                          >
                            <svg className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <span className="flex-1 truncate pr-2">{item.question}</span>
                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistoryItem(item.id);
                            }}
                            className="ml-2 shrink-0 cursor-pointer p-1 text-slate-400 opacity-0 transition hover:text-rose-500 group-hover:opacity-100 dark:text-slate-500 dark:hover:text-rose-400"
                            title="Delete item"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                  {error}
                </div>
              ) : null}

              {/* Guest sign-in prompt (shown when attempting to search without auth) */}
              {showAuthPrompt && (
                <div className="flex items-center gap-3 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 dark:border-indigo-600 dark:bg-indigo-900/30">
                  <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Sign in to search your memories</p>
                    <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-400">Search requires authentication to access your private memories.</p>
                  </div>
                  <a
                    href="/login"
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Sign in
                  </a>
                </div>
              )}

              {/* Inline guest hint (always visible when not authed and no auth prompt) */}
              {!isAuthLoading && !isAuthenticated && !showAuthPrompt && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  You&apos;re exploring as a guest — <a href="/login" className="font-medium text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400">sign in</a> to search your personal memories.
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0 dark:shadow-indigo-900/30 dark:disabled:bg-slate-600"
              >
                {isSearching ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching memories...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Ask question
                  </>
                )}
              </button>
            </form>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:shadow-slate-900/40">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Answer</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Grounded response</h3>
            </div>
            {result ? (
              <div className="flex items-center gap-2">
                {result.cached && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Cached
                  </span>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${confidenceStyles[result.confidence]}`}>
                  {result.confidence} confidence
                </span>
              </div>
            ) : null}
          </div>

          {result ? (
            <div className={`mb-4 rounded-2xl border p-3 ${
              result.debugTrace
                ? "border-sky-200 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/30"
                : "border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30"
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`text-sm font-bold ${
                  result.debugTrace
                    ? "text-sky-900 dark:text-sky-200"
                    : "text-amber-900 dark:text-amber-200"
                }`}>
                  Memory Debug
                </p>
                {result.debugTrace ? (
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">status: {result.debugTrace.status}</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">chunks: {result.debugTrace.chunksRetrieved}</span>
                  </div>
                ) : (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-slate-900/70 dark:text-amber-300">
                    debugTrace missing
                  </span>
                )}
              </div>
              <p className={`mt-2 text-xs leading-5 ${
                result.debugTrace
                  ? "text-sky-800 dark:text-sky-300"
                  : "text-amber-800 dark:text-amber-300"
              }`}>
                {result.debugTrace
                  ? result.debugTrace.reason
                  : "Frontend đã nhận answer nhưng API chưa trả debugTrace. Restart API/dev server rồi hỏi lại để thấy pipeline chi tiết."}
              </p>
            </div>
          ) : null}

          {isSearching ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/30">
                <svg className="h-4 w-4 shrink-0 animate-spin text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Searching through your memories…</p>
              </div>
              <div className="space-y-2.5">
                <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-3.5 w-9/12 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-3.5 w-10/12 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-3.5 w-7/12 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ) : result?.noMemory ? (
            /* No Relevant Memories — Special UX */
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-700/60 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">No relevant memories found</p>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{result.answer}</p>
                  </div>
                </div>
              </div>

              {/* Actionable suggestions */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Suggested actions
                </p>
                <div className="space-y-2">
                  <Link
                    href="/diary"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                  >
                    <svg className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    {responseLanguage === "vi" ? "Thêm nhật ký mới về chủ đề này" : "Add a new diary entry about this topic"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      const textarea = document.querySelector("textarea");
                      textarea?.focus();
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                  >
                    <svg className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    {responseLanguage === "vi" ? "Thử diễn đạt lại câu hỏi" : "Try rephrasing your question"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion(suggestedQuestions[0])}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                  >
                    <svg className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    {responseLanguage === "vi" ? "Thử một câu hỏi gợi ý" : "Try a suggested question instead"}
                  </button>
                </div>
              </div>
            </div>
          ) : result ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{result.answer}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-200">No answer yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submit a question to see the AI answer here.</p>
            </div>
          )}

          {result?.debugTrace ? (
            <details open className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-800 dark:bg-sky-950/30">
              <summary className="cursor-pointer text-sm font-bold text-sky-900 dark:text-sky-200">
                Memory Debug
              </summary>

              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Status</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{result.debugTrace.status}</p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Chunks</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{result.debugTrace.chunksRetrieved}</p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Confidence</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{result.confidence}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Reason</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{result.debugTrace.reason}</p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Inferred filters</p>
                    <pre className="mt-2 max-h-36 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{JSON.stringify(result.debugTrace.inferredFilters, null, 2)}</pre>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Applied filters</p>
                    <pre className="mt-2 max-h-36 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{JSON.stringify(result.debugTrace.appliedFilters, null, 2)}</pre>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Top retrieved chunks</p>
                  {result.debugTrace.topChunks.length ? (
                    <div className="space-y-3">
                      {result.debugTrace.topChunks.map((chunk, index) => (
                        <article key={`${chunk.id}-${index}`} className="rounded-xl border border-sky-100 bg-white/90 p-3 dark:border-sky-900 dark:bg-slate-900/70">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">#{index + 1}</span>
                            <span>{chunk.sourceTitle || `${chunk.sourceType}/${chunk.chunkType}`}</span>
                            <span>{new Date(chunk.occurredAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">mode: {chunk.retrievalMode}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">sim: {Math.round(chunk.similarity * 100)}%</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">vector: {Math.round(chunk.vectorSimilarity * 100)}%</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">lexical: {Math.round(chunk.lexicalScore * 100)}%</span>
                          </div>
                          <blockquote className="mt-3 rounded-r-lg border-l-4 border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-slate-700 dark:border-sky-800 dark:bg-slate-800 dark:text-slate-300">
                            {chunk.quote}
                          </blockquote>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-sky-200 p-4 text-sm text-slate-500 dark:border-sky-800 dark:text-slate-400">
                      No chunks survived retrieval thresholds.
                    </div>
                  )}
                </div>
              </div>
            </details>
          ) : null}
        </section>
      </div>

      {/* ── Query Analytics Panel (Order 1: 3a+3b+3c) ── */}
      {result?.analytics && (
        <section className="animate-fade-in mt-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/20 dark:shadow-slate-900/40">
          <button
            type="button"
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
            className="flex w-full cursor-pointer items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Query Analytics</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {result.analytics.tokenUsage.totalTokens} tokens · {(result.analytics.timing.totalMs / 1000).toFixed(1)}s · {result.analytics.chunksRetrieved} chunks
                </p>
              </div>
            </div>
            <svg className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${analyticsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {analyticsOpen && (
            <div className="mt-5 space-y-3 animate-fade-in">
              {/* Pipeline Steps */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pipeline Steps</p>
                <div className="space-y-2.5">
                  {/* Embedding */}
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">Embedding query</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {result.analytics.timing.embedMs > 0 ? `${result.analytics.timing.embedMs}ms` : 'included'}
                    </span>
                  </div>
                  {/* Retrieval */}
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                      Retrieved {result.analytics.chunksRetrieved} memory chunks
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {result.analytics.timing.retrieveMs}ms
                    </span>
                  </div>
                  {/* Generation */}
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">Generating answer</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {result.analytics.timing.generateMs > 1000
                        ? `${(result.analytics.timing.generateMs / 1000).toFixed(1)}s`
                        : `${result.analytics.timing.generateMs}ms`}
                    </span>
                  </div>
                  {/* Confidence */}
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">Confidence</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${confidenceStyles[result.confidence]}`}>
                      {result.confidence}
                    </span>
                  </div>
                  {/* Tokens */}
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">Tokens</span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {result.analytics.tokenUsage.promptTokens} prompt + {result.analytics.tokenUsage.completionTokens} completion = {result.analytics.tokenUsage.totalTokens}
                    </span>
                  </div>
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    {result.analytics.status === 'success' ? (<svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>) : result.analytics.status === 'no_memory' ? (<svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>) : (<svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)}
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">Status</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      result.analytics.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : result.analytics.status === 'no_memory'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}>
                      {result.analytics.status}
                    </span>
                  </div>
                  {/* Total */}
                  <div className="flex items-center gap-3 border-t border-slate-200 pt-2.5 dark:border-slate-700">
                    <svg className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Total</span>
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white dark:bg-slate-200 dark:text-slate-900">
                      {(result.analytics.timing.totalMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Model info */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400">Model</span>
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  {result.analytics.tokenUsage.model}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/30 dark:shadow-slate-900/40">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Citations</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Sources used for the answer</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {result?.sources.length ?? 0} sources
          </span>
        </div>

        {result?.sources.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {result.sources.map((source) => (
              <article
                key={`${source.marker}-${source.chunkId}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-indigo-500/50"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                    {source.marker}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {source.sourceType}
                  </span>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800">
                    {source.chunkType.replaceAll("_", " ")}
                  </span>
                  <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                    {new Date(source.occurredAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-slate-100">
                  {source.sourceTitle || "Untitled memory"}
                </p>
                {source.claim ? (
                  <p className="mt-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm leading-6 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200">
                    {source.claim}
                  </p>
                ) : null}
                <blockquote className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  {source.quote}
                </blockquote>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-700">
                    source id: {source.sourceId.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800">
                    match {Math.round(source.similarity * 100)}%
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Citations will appear here after a successful search.
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
