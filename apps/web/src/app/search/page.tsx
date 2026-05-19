"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/contexts/AuthContext";

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

type SearchResponse = {
  answer: string;
  confidence: "high" | "medium" | "low";
  sources: SearchCitation[];
  noMemory?: boolean;
  suggestions?: string[];
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

  // Persist language preference
  useEffect(() => {
    const saved = localStorage.getItem("dd-response-lang") as ResponseLanguage | null;
    if (saved === "en" || saved === "vi") setResponseLanguage(saved);
  }, []);

  const toggleLanguage = () => {
    const next = responseLanguage === "en" ? "vi" : "en";
    setResponseLanguage(next);
    localStorage.setItem("dd-response-lang", next);
  };

  const canSubmit = useMemo(
    () => question.trim().length > 0 && !isSearching,
    [question, isSearching],
  );

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuestion = question.trim();
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
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed. Please try again.");
      setResult(null);
    } finally {
      setIsSearching(false);
    }
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
              <span className="text-lg">{responseLanguage === "en" ? "🇺🇸" : "🇻🇳"}</span>
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  💡 You&apos;re exploring as a guest — <a href="/login" className="font-medium text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400">sign in</a> to search your personal memories.
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
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${confidenceStyles[result.confidence]}`}>
                {result.confidence} confidence
              </span>
            ) : null}
          </div>

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
                    <span className="text-lg">📝</span>
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
                    <span className="text-lg">🔄</span>
                    {responseLanguage === "vi" ? "Thử diễn đạt lại câu hỏi" : "Try rephrasing your question"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion(suggestedQuestions[0])}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                  >
                    <span className="text-lg">💡</span>
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
        </section>
      </div>

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
              <article key={`${source.marker}-${source.chunkId}`} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50 dark:hover:border-indigo-500/50">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400 dark:ring-indigo-700">
                    [{source.marker}]
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(source.occurredAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                  {source.sourceTitle || `${source.sourceType} • ${source.chunkType}`}
                </p>
                {source.claim ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{source.claim}</p> : null}
                <blockquote className="mt-3 rounded-r-xl border-l-4 border-indigo-200 bg-white px-3 py-2 text-sm italic text-slate-600 dark:border-indigo-700 dark:bg-slate-700/50 dark:text-slate-400">
                  &ldquo;{source.quote}&rdquo;
                </blockquote>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-700">type: {source.sourceType}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-700">
                    similarity: {Math.round(source.similarity * 100)}%
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
