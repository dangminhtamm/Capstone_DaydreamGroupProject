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

type AnswerMode = "cache" | "fast_path" | "gemini" | "extractive_fallback" | "no_memory";
type AnswerStrategy = "auto" | "fast" | "deep";

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
  answerMode?: AnswerMode;
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
  modelError?: {
    status?: number;
    kind: "quota" | "service_unavailable" | "validation" | "transient" | "unknown";
    message: string;
  } | null;
  debugTrace?: MemoryDebugTrace | null;
  cached?: boolean;
  cachedAt?: string;
  answerMode?: AnswerMode;
  cacheStorage?: "redis" | "database";
};

type ResponseLanguage = "en" | "vi";


const suggestedQuestions = [
  "What did I work on recently?",
  "What important events happened this week?",
  "Summarize my latest diary memories.",
];

const answerStrategies: Array<{ value: AnswerStrategy; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "fast", label: "Fast" },
  { value: "deep", label: "Deep" },
];

const confidenceStyles = {
  high: "status-badge-success",
  medium: "status-badge-warning",
  low: "status-badge-danger",
};

const sourceToneStyles: Record<string, string> = {
  diary: "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300",
  calendar: "border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
  contact: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-300",
  drive: "border-lime-100 bg-lime-50 text-lime-700 dark:border-lime-900/50 dark:bg-lime-950/30 dark:text-lime-300",
  gmail: "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
  attachment: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  summary: "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
};

function formatSourceType(value: string) {
  return value.replaceAll("_", " ");
}

function formatSourceDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAnswerMode(value?: AnswerMode) {
  switch (value) {
    case "cache":
      return "Cache";
    case "fast_path":
      return "Fast path";
    case "gemini":
      return "Gemini";
    case "extractive_fallback":
      return "Extractive fallback";
    case "no_memory":
      return "No memory";
    default:
      return "Unknown";
  }
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function isJsonFormatModelError(error: NonNullable<SearchResponse["modelError"]>) {
  const message = error.message.toLowerCase();
  return (
    error.kind === "validation" &&
    (message.includes("json") ||
      message.includes("parse") ||
      message.includes("schema") ||
      message.includes("truncated") ||
      message.includes("finishreason") ||
      message.includes("max_tokens") ||
      message.includes("invalid_type") ||
      message.includes("nonoptional") ||
      message.includes("expected") ||
      message.includes("undefined"))
  );
}

function formatModelErrorTitle(error: NonNullable<SearchResponse["modelError"]>) {
  if (error.kind === "quota") return "Using retrieved evidence";
  if (error.kind === "service_unavailable") return "Using retrieved evidence";
  if (error.kind === "validation") {
    return isJsonFormatModelError(error) ? "Using retrieved evidence" : "Answer grounded with direct evidence";
  }
  return "Using retrieved evidence";
}

function formatModelErrorMessage(error: NonNullable<SearchResponse["modelError"]>) {
  if (error.kind === "quota") {
    return "Model generation was unavailable, so the answer is assembled from the strongest retrieved memories.";
  }

  if (error.kind === "validation") {
    if (error.message.toLowerCase().includes("truncated")) {
      return "The generated response was incomplete, so the answer is assembled from the strongest grounded memories.";
    }

    return isJsonFormatModelError(error)
      ? "The generated response was not structured enough, so the answer is assembled from grounded memories."
      : "The generated response did not pass citation validation, so the answer uses direct evidence.";
  }

  return "Model generation was unavailable, so the answer is assembled from retrieved evidence.";
}

function highlightQuote(quote: string, claim?: string) {
  const cleanClaim = claim?.replace(/\s+/g, " ").trim();
  if (!cleanClaim || cleanClaim.length < 8) return quote;

  const quoteLower = quote.toLowerCase();
  const claimLower = cleanClaim.toLowerCase();
  const start = quoteLower.indexOf(claimLower);

  if (start >= 0) {
    const end = start + cleanClaim.length;
    return [
      quote.slice(0, start),
      <mark key="claim" className="rounded bg-amber-200/80 px-1 text-slate-950 dark:bg-amber-300/30 dark:text-amber-100">
        {quote.slice(start, end)}
      </mark>,
      quote.slice(end),
    ];
  }

  const tokens = Array.from(new Set(cleanClaim.toLowerCase().match(/[\p{Letter}\p{Number}]{4,}/gu) ?? [])).slice(0, 4);
  if (!tokens.length) return quote;

  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return quote.split(pattern).map((part, index) =>
    tokens.includes(part.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-200/80 px-1 text-slate-950 dark:bg-amber-300/30 dark:text-amber-100">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

type DebugPipelineState = "ok" | "warning" | "error" | "skipped" | "unknown";

function formatDurationMs(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.max(0, Math.round(value))}ms`;
}

function formatPercent(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function debugStateClass(state: DebugPipelineState) {
  switch (state) {
    case "ok":
      return "status-badge-success";
    case "warning":
    case "skipped":
      return "status-badge-warning";
    case "error":
      return "status-badge-danger";
    default:
      return "";
  }
}

function analyticsStatusState(status?: QueryAnalytics["status"]): DebugPipelineState {
  if (status === "success") return "ok";
  if (status === "no_memory") return "warning";
  if (status === "error") return "error";
  return "unknown";
}

function traceMissingMessage(result: SearchResponse) {
  if (result.cached) {
    return "This response came from cache, so the backend may skip a fresh retrieval trace.";
  }

  return "API did not return debugTrace. Set MEMORY_DEBUG_TRACE=true and restart the API/dev server to inspect filters and retrieved chunks.";
}

function AiDebugPanel({ result }: { result: SearchResponse }) {
  const analytics = result.analytics ?? null;
  const trace = result.debugTrace ?? null;
  const answerMode = result.answerMode ?? analytics?.answerMode;
  const traceState: DebugPipelineState = trace
    ? analyticsStatusState(trace.status)
    : result.modelError
      ? "warning"
      : "unknown";
  const generateState: DebugPipelineState = result.modelError
    ? "warning"
    : answerMode === "fast_path" || answerMode === "extractive_fallback" || answerMode === "no_memory"
      ? "skipped"
      : analyticsStatusState(analytics?.status);

  const pipeline = [
    {
      label: "Embed query",
      value: analytics ? formatDurationMs(analytics.timing.embedMs) : "n/a",
      state: analytics ? "ok" : "unknown",
      detail: "Creates the vector used for semantic memory retrieval.",
    },
    {
      label: "Retrieve sources",
      value: analytics ? formatDurationMs(analytics.timing.retrieveMs) : "n/a",
      state: analyticsStatusState(analytics?.status),
      detail: `${trace?.chunksRetrieved ?? analytics?.chunksRetrieved ?? result.sources.length} chunks considered for grounding.`,
    },
    {
      label: "Ground answer",
      value: analytics ? formatDurationMs(analytics.timing.generateMs) : "n/a",
      state: generateState,
      detail:
        answerMode === "fast_path"
          ? "Fast path used retrieved evidence without Gemini generation."
          : answerMode === "extractive_fallback"
            ? "Fallback answer assembled from retrieved evidence."
            : result.modelError
              ? "Gemini generation failed, but retrieved evidence is still shown."
              : "Gemini or grounded composer produced the final answer.",
    },
  ] satisfies Array<{
    label: string;
    value: string;
    state: DebugPipelineState;
    detail: string;
  }>;

  const visibleChunks = trace?.topChunks?.length
    ? trace.topChunks.slice(0, 5)
    : result.sources.slice(0, 5).map((source) => ({
        id: source.chunkId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceTitle: source.sourceTitle,
        chunkType: source.chunkType,
        occurredAt: source.occurredAt,
        retrievalMode: "citation",
        similarity: source.similarity,
        vectorSimilarity: source.similarity,
        lexicalScore: 0,
        distance: null,
        quote: source.quote,
      }));

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            AI Debug
          </p>
          <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-100">
            Search pipeline visibility
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`status-badge ${debugStateClass(traceState)}`}>
            Trace: {trace ? "returned" : "missing"}
          </span>
          <span className={`status-badge ${debugStateClass(analyticsStatusState(analytics?.status))}`}>
            API: {analytics?.status ?? trace?.status ?? "unknown"}
          </span>
          <span className="status-badge">
            Mode: {formatAnswerMode(answerMode)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {pipeline.map((step) => (
          <div key={step.label} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.label}</p>
              <span className={`status-badge ${debugStateClass(step.state)}`}>{step.value}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total latency</p>
          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">{formatDurationMs(analytics?.timing.totalMs)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tokens</p>
          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
            {analytics ? analytics.tokenUsage.totalTokens : "n/a"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sources</p>
          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">{result.sources.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Model</p>
          <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-950 dark:text-slate-100">
            {analytics?.tokenUsage.model ?? "n/a"}
          </p>
        </div>
      </div>

      {!trace ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">debugTrace missing</p>
          <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">{traceMissingMessage(result)}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reason</p>
          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{trace.reason}</p>
        </div>
      )}

      {result.modelError ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-900/60 dark:bg-rose-950/20">
          <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
            Model error: {result.modelError.kind}{result.modelError.status ? ` (${result.modelError.status})` : ""}
          </p>
          <p className="mt-1 text-xs leading-5 text-rose-800 dark:text-rose-300">{result.modelError.message}</p>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Retrieved evidence
          </p>
          <span className="status-badge">{visibleChunks.length} shown</span>
        </div>
        {visibleChunks.length ? (
          <div className="space-y-2">
            {visibleChunks.map((chunk, index) => (
              <article key={`${chunk.id}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 font-bold text-white dark:bg-slate-100 dark:text-slate-950">#{index + 1}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{chunk.sourceTitle || `${chunk.sourceType}/${chunk.chunkType}`}</span>
                  <span>{formatSourceDate(chunk.occurredAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">mode: {chunk.retrievalMode}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">sim: {formatPercent(chunk.similarity)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">vector: {formatPercent(chunk.vectorSimilarity)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">lexical: {formatPercent(chunk.lexicalScore)}</span>
                </div>
                <blockquote className="mt-2 line-clamp-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {chunk.quote}
                </blockquote>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No retrieved chunks or citations were returned for this query.
          </div>
        )}
      </div>

      {trace ? (
        <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">
            Advanced filters JSON
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Inferred filters</p>
              <pre className="max-h-36 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{JSON.stringify(trace.inferredFilters, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Applied filters</p>
              <pre className="max-h-36 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{JSON.stringify(trace.appliedFilters, null, 2)}</pre>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  const { isAuthenticated, isLoading: isAuthLoading, getAccessToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>("en");
  const [answerStrategy, setAnswerStrategy] = useState<AnswerStrategy>("auto");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Load language preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("dd-response-lang") as ResponseLanguage | null;
    if (saved === "en" || saved === "vi") setResponseLanguage(saved);

    const savedStrategy = localStorage.getItem("dd-answer-strategy") as AnswerStrategy | null;
    if (savedStrategy === "auto" || savedStrategy === "fast" || savedStrategy === "deep") {
      setAnswerStrategy(savedStrategy);
    }

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
      const timeZone = getBrowserTimeZone();
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
          ...(timeZone ? { timeZone } : {}),
          ...(answerStrategy === "auto" ? {} : { answerStrategy }),
        }),
      });

      if (!response.ok) {
        const requestId = response.headers.get("x-request-id");
        const errorBody = await response.json().catch(() => null) as { message?: string; requestId?: string } | null;
        const detail = errorBody?.message || `Search failed with status ${response.status}`;
        throw new Error(requestId || errorBody?.requestId ? `${detail} (request ${requestId || errorBody?.requestId})` : detail);
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
  }, [answerStrategy, getAccessToken, isAuthenticated, loadServerHistory, responseLanguage]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(question.trim());
  }

  return (
    <DashboardShell
      title="Memory Search"
      description="Ask a question and get an answer grounded in your saved memories."
    >
      <div className="space-y-6">
        <section className="enterprise-card p-5">
          <div className="mb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">AI-powered recall</p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Ask your Second Brain</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Type a natural-language question. Your memories will surface the most relevant answer.
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Question</span>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Example: What did I write about my capstone progress?"
                  className="mt-2 min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mode</span>
                  <div className="segment-control">
                    {answerStrategies.map((strategy) => {
                      const active = answerStrategy === strategy.value;
                      return (
                        <button
                          key={strategy.value}
                          type="button"
                          onClick={() => {
                            setAnswerStrategy(strategy.value);
                            localStorage.setItem("dd-answer-strategy", strategy.value);
                          }}
                          className={`segment-option ${active ? "segment-option-active" : ""}`}
                        >
                          {strategy.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Language</span>
                  <div className="segment-control">
                    {(["en", "vi"] as const).map((language) => {
                      const active = responseLanguage === language;
                      return (
                        <button
                          key={language}
                          type="button"
                          onClick={() => {
                            setResponseLanguage(language);
                            localStorage.setItem("dd-response-lang", language);
                          }}
                          className={`segment-option ${active ? "segment-option-active" : ""}`}
                        >
                          {language.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuestion(suggestion)}
                    className="cursor-pointer rounded-full border border-blue-100 bg-blue-50/60 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/40"
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
                    className="action-primary shrink-0 min-h-10 px-3"
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
                className="action-primary cursor-pointer px-5"
              >
                {isSearching ? (
                  "Searching memories..."
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

        <section className="enterprise-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Answer</p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Grounded response</h3>
            </div>
            {result ? (
              <div className="flex items-center gap-2">
                {result.cached && (
                  <span className="status-badge">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Cached{result.cacheStorage ? `: ${result.cacheStorage}` : ""}
                  </span>
                )}
                <span className={`status-badge ${confidenceStyles[result.confidence]}`}>
                  {result.confidence} confidence
                </span>
              </div>
            ) : null}
          </div>

          {result ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="status-badge">
                Mode: {formatAnswerMode(result.answerMode ?? result.analytics?.answerMode)}
              </span>
              {result.analytics?.tokenUsage.totalTokens === 0 ? (
                <span className="status-badge status-badge-success">
                  0 generate tokens
                </span>
              ) : null}
            </div>
          ) : null}

          {isSearching ? (
            <div className="space-y-4">
              <div className="enterprise-panel px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Searching grounded memories</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ranking memory chunks, then composing a grounded answer.</p>
                  <div className="mt-3 space-y-2">
                    <div className="skeleton-line h-3 w-11/12" />
                    <div className="skeleton-line h-3 w-8/12" />
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Embed query", "Retrieve sources", "Ground answer"].map((step, index) => (
                  <div key={step} className="enterprise-panel p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{index + 1}</span>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{step}</p>
                    </div>
                    <div className="skeleton-line h-2" />
                  </div>
                ))}
              </div>
            </div>
          ) : result?.modelError ? (
            <div className="space-y-4">
              <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
                <p className="whitespace-pre-wrap text-base leading-8 text-slate-800 dark:text-slate-200">{result.answer}</p>
              </div>
              <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/20">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    {formatModelErrorTitle(result.modelError)}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
                    {formatModelErrorMessage(result.modelError)}
                  </p>
                </div>
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
            <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
              <p className="whitespace-pre-wrap text-base leading-8 text-slate-800 dark:text-slate-200">{result.answer}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-200">No answer yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submit a question to see the AI answer here.</p>
            </div>
          )}

          {result ? <AiDebugPanel result={result} /> : null}
        </section>
      </div>

      <section className="mt-6 enterprise-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Citations</p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Evidence used</h3>
          </div>
          <span className="status-badge">
            {result?.sources.length ?? 0} sources
          </span>
        </div>

        {result?.sources.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.sources.map((source) => (
              <article
                key={`${source.marker}-${source.chunkId}`}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition hover:border-indigo-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-800 dark:hover:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-950">
                        {source.marker}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${sourceToneStyles[source.sourceType] ?? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                        {formatSourceType(source.sourceType)}
                      </span>
                      <span className="status-badge">
                        {source.chunkType.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold leading-5 text-slate-950 dark:text-slate-100">
                      {source.sourceTitle || "Untitled memory"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span>{formatSourceDate(source.occurredAt)}</span>
                      <span>{Math.round(source.similarity * 100)}% match</span>
                    </div>
                  </div>
                </div>

                {source.claim ? (
                  <p className="mt-3 line-clamp-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs leading-5 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
                    {source.claim}
                  </p>
                ) : null}
                <blockquote className="mt-3 line-clamp-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  {highlightQuote(source.quote, source.claim)}
                </blockquote>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Citations will appear here after a successful search.
          </div>
        )}
      </section>

      {searchHistory.length > 0 && (
        <section className="mt-6 enterprise-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-indigo-700 dark:text-slate-200 dark:hover:text-indigo-300"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Recent Searches
              <svg className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              className="cursor-pointer text-xs font-medium text-slate-400 transition hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
            >
              Clear All
            </button>
          </div>

          {showHistory && (
            <div className="grid gap-2 md:grid-cols-2">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion(item.question);
                      void runSearch(item.question);
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-xs text-slate-600 transition hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <span className="truncate">{item.question}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteHistoryItem(item.id);
                    }}
                    className="ml-2 shrink-0 cursor-pointer p-1 text-slate-400 opacity-0 transition hover:text-rose-500 group-hover:opacity-100 dark:text-slate-500 dark:hover:text-rose-400"
                    title="Delete item"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
