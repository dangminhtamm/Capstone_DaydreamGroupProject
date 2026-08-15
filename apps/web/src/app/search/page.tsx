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

type AnswerMode = "cache" | "fast_path" | "tuturuuu" | "extractive_fallback" | "no_memory";
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
  cacheVersion?: string;
};

type MemoryIndexDiagnostics = {
  embeddingModel: string;
  totalChunks: number;
  embeddedChunks: number;
  currentEmbeddingModelChunks: number;
  staleEmbeddingModelChunks: number;
  latestOccurredAt?: string | null;
  issue: "none" | "empty_index" | "missing_embeddings" | "stale_embeddings" | "mixed_embeddings";
};

type MemoryDebugTrace = {
  question: string;
  inferredFilters: Record<string, unknown>;
  appliedFilters: Record<string, unknown>;
  status: "success" | "no_memory" | "error";
  reason: string;
  routingTrace?: {
    intent: string;
    requestedStrategy: AnswerStrategy;
    selectedPath:
      | "unindexed_fast_path"
      | "embedding_error_fallback"
      | "created_date_mismatch"
      | "indexed_fast_path"
      | "deep_generation"
      | "deep_validation_fallback"
      | "deep_model_error_fallback"
      | "no_memory";
    reason: string;
    autoFastEligible: boolean;
    fastPathEligible: boolean;
    usedUnindexedDiary: boolean;
    translationRan: boolean;
  };
  chunksRetrieved: number;
  diagnostics?: MemoryIndexDiagnostics;
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
    entityScore?: number;
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
    kind: "auth" | "quota" | "billing" | "model_config" | "service_unavailable" | "validation" | "transient" | "unknown";
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

const sourceAccentStyles: Record<string, string> = {
  diary: "from-indigo-500 to-blue-500",
  calendar: "from-sky-500 to-cyan-500",
  contact: "from-fuchsia-500 to-pink-500",
  drive: "from-lime-500 to-emerald-500",
  gmail: "from-rose-500 to-orange-500",
  attachment: "from-emerald-500 to-teal-500",
  summary: "from-amber-500 to-yellow-500",
};

const sourceShortLabels: Record<string, string> = {
  diary: "Diary",
  calendar: "Calendar",
  contact: "Contact",
  drive: "Drive",
  gmail: "Gmail",
  attachment: "File",
  summary: "Summary",
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
    case "tuturuuu":
      return "Tuturuuu AI";
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
  if (error.kind === "auth") return "AI key needs attention";
  if (error.kind === "billing") return "AI billing needs attention";
  if (error.kind === "model_config") return "AI model needs attention";
  if (error.kind === "quota") return "Using retrieved evidence";
  if (error.kind === "service_unavailable") return "Using retrieved evidence";
  if (error.kind === "validation") {
    return isJsonFormatModelError(error) ? "Using retrieved evidence" : "Answer grounded with direct evidence";
  }
  return "Using retrieved evidence";
}

function formatModelErrorMessage(error: NonNullable<SearchResponse["modelError"]>) {
  if (error.kind === "auth") {
    return "Tuturuuu rejected the API key. Create or rotate a valid metered key, set TUTURUUU_AI_API_KEY, then restart the API and worker.";
  }

  if (error.kind === "model_config") {
    return "Tuturuuu rejected the selected model. Use google/gemini-3.5-flash-lite for answers and google/gemini-embedding-2 for embeddings.";
  }

  if (error.kind === "billing") {
    return "Tuturuuu could not settle AI usage for this workspace. Check Tuturuuu billing/credits, or use google/gemini-3.5-flash-lite.";
  }

  if (error.kind === "quota") {
    return "Tuturuuu AI generation hit quota/rate limits, so the answer is assembled from the strongest retrieved memories.";
  }

  if (error.kind === "service_unavailable") {
    const message = error.message.toLowerCase();
    if (message.includes("tls") || message.includes("certificate")) {
      return "Tuturuuu AI generation could not connect because the gateway TLS/certificate is not trusted. The answer below is assembled from retrieved evidence.";
    }
    return "Tuturuuu AI generation was unavailable, so the answer is assembled from the strongest retrieved memories.";
  }

  if (error.kind === "validation") {
    if (error.message.toLowerCase().includes("truncated")) {
      return "The generated response was incomplete, so the answer is assembled from the strongest grounded memories.";
    }

    return isJsonFormatModelError(error)
      ? "The generated response was not structured enough, so the answer is assembled from grounded memories."
      : "The generated response did not pass citation validation, so the answer uses direct evidence.";
  }

  return "Tuturuuu AI generation was unavailable, so the answer is assembled from retrieved evidence.";
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

function formatSourceChunk(value: string) {
  return value.replaceAll("_", " ");
}

function formatSimilarityScore(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSourceReliability(value: number) {
  if (value >= 0.78) return "Strong citation";
  if (value >= 0.55) return "Useful evidence";
  return "Context evidence";
}

function sourceCardTone(sourceType: string) {
  return sourceToneStyles[sourceType] ?? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function sourceCardAccent(sourceType: string) {
  return sourceAccentStyles[sourceType] ?? "from-slate-500 to-slate-400";
}

function sourceShortLabel(sourceType: string) {
  return sourceShortLabels[sourceType] ?? formatSourceType(sourceType);
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

function indexDiagnosticsState(issue?: MemoryIndexDiagnostics["issue"]): DebugPipelineState {
  if (!issue || issue === "none") return "ok";
  if (issue === "mixed_embeddings") return "warning";
  return "error";
}

function formatIndexIssue(issue: MemoryIndexDiagnostics["issue"]) {
  switch (issue) {
    case "empty_index":
      return "No indexed memories";
    case "missing_embeddings":
      return "Missing embeddings";
    case "stale_embeddings":
      return "Stale embeddings";
    case "mixed_embeddings":
      return "Mixed embeddings";
    default:
      return "Healthy";
  }
}

function formatIndexAction(issue: MemoryIndexDiagnostics["issue"], model: string) {
  switch (issue) {
    case "empty_index":
      return "Add diary, attachment, calendar, summary, or Gmail data, then drain indexing jobs.";
    case "missing_embeddings":
      return `Drain indexing jobs or re-embed chunks with ${model}.`;
    case "stale_embeddings":
      return `Re-embed existing memory chunks with ${model}.`;
    case "mixed_embeddings":
      return `Some chunks still need re-embedding with ${model}.`;
    default:
      return "Index and embedding model look aligned for these filters.";
  }
}

type SimpleMemoryTone = "ready" | "attention" | "empty";

function simpleMemoryToneClass(tone: SimpleMemoryTone) {
  switch (tone) {
    case "ready":
      return "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300";
    case "attention":
      return "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300";
    case "empty":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300";
  }
}

function simpleIndexLabel(issue: MemoryIndexDiagnostics["issue"] | undefined, lang: ResponseLanguage) {
  if (!issue || issue === "none") {
    return lang === "vi" ? "Sẵn sàng" : "Ready";
  }

  if (issue === "empty_index") {
    return lang === "vi" ? "Chưa có memory" : "No memory yet";
  }

  if (issue === "mixed_embeddings" || issue === "stale_embeddings") {
    return lang === "vi" ? "Cần cập nhật index" : "Index needs refresh";
  }

  return lang === "vi" ? "Cần xử lý index" : "Index needs attention";
}

function latestMemoryDate(result: SearchResponse) {
  const diagnosticsDate = result.debugTrace?.diagnostics?.latestOccurredAt;
  if (diagnosticsDate) return diagnosticsDate;

  const latestSource = result.sources
    .map((source) => source.occurredAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return latestSource ?? null;
}

function simpleMemoryStatus(result: SearchResponse, lang: ResponseLanguage) {
  const diagnostics = result.debugTrace?.diagnostics;
  const issue = diagnostics?.issue;
  const sourceCount = result.sources.length;
  const answerMode = result.answerMode ?? result.analytics?.answerMode;
  const date = latestMemoryDate(result);
  const hasIndexIssue = Boolean(issue && issue !== "none");
  const tone: SimpleMemoryTone = result.noMemory
    ? "empty"
    : result.modelError || hasIndexIssue
      ? "attention"
      : "ready";

  if (lang === "vi") {
    return {
      tone,
      title: result.noMemory
        ? "Chưa tìm thấy memory phù hợp"
        : result.modelError
          ? "Đang trả lời bằng nguồn đã lưu"
          : hasIndexIssue
            ? "Memory cần cập nhật"
            : "Memory sẵn sàng",
      detail: result.noMemory
        ? "Hệ thống đã tìm trong memory nhưng chưa có nguồn đủ liên quan cho câu hỏi này."
        : result.modelError
          ? "AI generation không hoàn tất, nên câu trả lời dùng các citation mạnh nhất đã tìm được."
          : hasIndexIssue
            ? "Một phần memory index cần được cập nhật để tìm kiếm ổn định hơn."
            : "Câu trả lời đã được nối với các nguồn liên quan trong memory của bạn.",
      items: [
        { label: "Nguồn dùng", value: `${sourceCount}` },
        { label: "Trạng thái index", value: simpleIndexLabel(issue, lang) },
        { label: "Cách trả lời", value: formatAnswerMode(answerMode) },
        { label: "Memory mới nhất", value: date ? formatSourceDate(date) : "Chưa có" },
      ],
    };
  }

  return {
    tone,
    title: result.noMemory
      ? "No matching memory found"
      : result.modelError
        ? "Answer uses saved sources"
        : hasIndexIssue
          ? "Memory needs refresh"
          : "Memory is ready",
    detail: result.noMemory
      ? "Second Brain searched your memory but did not find enough relevant sources for this question."
      : result.modelError
        ? "AI generation did not fully complete, so the answer uses the strongest cited memories."
        : hasIndexIssue
          ? "Part of the memory index should be refreshed for more reliable search."
          : "The answer is connected to relevant sources from your saved memory.",
    items: [
      { label: "Sources used", value: `${sourceCount}` },
      { label: "Index status", value: simpleIndexLabel(issue, lang) },
      { label: "Answer mode", value: formatAnswerMode(answerMode) },
      { label: "Latest memory", value: date ? formatSourceDate(date) : "None yet" },
    ],
  };
}

function SimpleMemoryStatusPanel({ result, lang }: { result: SearchResponse; lang: ResponseLanguage }) {
  const status = simpleMemoryStatus(result, lang);

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 ${simpleMemoryToneClass(status.tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
            {lang === "vi" ? "Trạng thái memory" : "Memory status"}
          </p>
          <h4 className="mt-1 text-sm font-semibold">{status.title}</h4>
          <p className="mt-1 text-sm leading-6 opacity-90">{status.detail}</p>
        </div>
        <div className="grid min-w-full gap-2 sm:min-w-[28rem] sm:grid-cols-4">
          {status.items.map((item) => (
            <div key={item.label} className="rounded-lg border border-current/10 bg-white/60 px-3 py-2 dark:bg-slate-950/40">
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{item.label}</p>
              <p className="mt-1 truncate text-xs font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatRoutingPath(value: NonNullable<MemoryDebugTrace["routingTrace"]>["selectedPath"]) {
  switch (value) {
    case "unindexed_fast_path":
      return "Unindexed diary fast path";
    case "embedding_error_fallback":
      return "Embedding fallback";
    case "created_date_mismatch":
      return "Date mismatch helper";
    case "indexed_fast_path":
      return "Indexed fast path";
    case "deep_generation":
      return "Deep generation";
    case "deep_validation_fallback":
      return "Deep validation fallback";
    case "deep_model_error_fallback":
      return "Deep model fallback";
    case "no_memory":
      return "No memory";
    default:
      return value;
  }
}

function traceMissingMessage(result: SearchResponse) {
  if (result.cached) {
    return "This response came from cache, so the backend may skip a fresh retrieval trace.";
  }

  return "API did not return debugTrace. Set MEMORY_DEBUG_TRACE=true and restart the API/dev server to inspect filters and retrieved chunks.";
}

function AiDebugPanel({ result }: { result: SearchResponse }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const analytics = result.analytics ?? null;
  const trace = result.debugTrace ?? null;
  const diagnostics = trace?.diagnostics ?? null;
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
          ? "Fast path used retrieved evidence without model generation."
          : answerMode === "extractive_fallback"
            ? "Fallback answer assembled from retrieved evidence."
            : result.modelError
              ? "Tuturuuu AI generation failed, but retrieved evidence is still shown."
              : "Tuturuuu AI or grounded composer produced the final answer.",
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
        entityScore: 0,
        distance: null,
        quote: source.quote,
      }));

  async function handleCopyDebugTrace() {
    const report = {
      copiedAt: new Date().toISOString(),
      answerMode,
      confidence: result.confidence,
      cached: result.cached ?? false,
      cacheStorage: result.cacheStorage ?? null,
      analytics,
      modelError: result.modelError ?? null,
      debugTrace: trace,
      citations: result.sources.map((source) => ({
        marker: source.marker,
        chunkId: source.chunkId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceTitle: source.sourceTitle ?? null,
        occurredAt: source.occurredAt,
        chunkType: source.chunkType,
        similarity: source.similarity,
        claim: source.claim ?? null,
      })),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
    }
  }

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
          <button
            type="button"
            onClick={() => void handleCopyDebugTrace()}
            className="status-badge cursor-pointer transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
            </svg>
            {copyStatus === "copied"
              ? "Copied trace"
              : copyStatus === "failed"
                ? "Copy failed"
                : "Copy debug trace"}
          </button>
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

      {trace?.routingTrace ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">Routing</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
                {formatRoutingPath(trace.routingTrace.selectedPath)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="status-badge">Strategy: {trace.routingTrace.requestedStrategy}</span>
              <span className="status-badge">Intent: {trace.routingTrace.intent}</span>
              <span className={`status-badge ${trace.routingTrace.translationRan ? "status-badge-success" : ""}`}>
                Translation: {trace.routingTrace.translationRan ? "ran" : "skipped"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {trace.routingTrace.reason}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 dark:border-blue-900/50 dark:bg-slate-950">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Auto Fast</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {trace.routingTrace.autoFastEligible ? "Eligible" : "Not eligible"}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 dark:border-blue-900/50 dark:bg-slate-950">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fast Path</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {trace.routingTrace.fastPathEligible ? "Allowed" : "Blocked"}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 dark:border-blue-900/50 dark:bg-slate-950">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Unindexed Diary</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {trace.routingTrace.usedUnindexedDiary ? "Used" : "Not used"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {diagnostics ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Index health</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
                {diagnostics.totalChunks} chunks · {diagnostics.currentEmbeddingModelChunks} current · {diagnostics.staleEmbeddingModelChunks} stale
              </p>
            </div>
            <span className={`status-badge ${debugStateClass(indexDiagnosticsState(diagnostics.issue))}`}>
              {formatIndexIssue(diagnostics.issue)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current model</p>
              <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{diagnostics.embeddingModel}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Embedded</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{diagnostics.embeddedChunks}/{diagnostics.totalChunks}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Latest memory</p>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {diagnostics.latestOccurredAt ? formatSourceDate(diagnostics.latestOccurredAt) : "n/a"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {formatIndexAction(diagnostics.issue, diagnostics.embeddingModel)}
          </p>
        </div>
      ) : null}

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
                  {(chunk.entityScore ?? 0) > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">entity: {formatPercent(chunk.entityScore ?? 0)}</span>
                  ) : null}
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

function EvidenceSourceCard({ source }: { source: SearchCitation }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-blue-800">
      <div className={`h-1.5 bg-gradient-to-r ${sourceCardAccent(source.sourceType)}`} />
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-950 px-2 py-1 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-950">
            Citation {source.marker}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${sourceCardTone(source.sourceType)}`}>
            {sourceShortLabel(source.sourceType)}
          </span>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {formatSourceReliability(source.similarity)}
        </span>
      </div>
      <div className="p-4">
        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950 dark:text-slate-100">
          {source.sourceTitle || "Untitled memory"}
        </h4>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Memory date</p>
            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{formatSourceDate(source.occurredAt)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Match</p>
            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{formatSimilarityScore(source.similarity)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Chunk</p>
            <p className="mt-1 text-xs font-semibold capitalize text-slate-800 dark:text-slate-200">{formatSourceChunk(source.chunkType)}</p>
          </div>
        </div>

        {source.claim ? (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 dark:border-blue-900/60 dark:bg-blue-950/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">
              Grounded claim
            </p>
            <p className="mt-1 line-clamp-3 text-xs font-medium leading-5 text-blue-950 dark:text-blue-100">
              {source.claim}
            </p>
          </div>
        ) : null}

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Quoted evidence
          </p>
          <blockquote className="max-h-44 overflow-auto text-sm leading-6 text-slate-700 dark:text-slate-300">
            {highlightQuote(source.quote, source.claim)}
          </blockquote>
        </div>
      </div>
    </article>
  );
}

export default function SearchPage() {
  const { isAuthenticated, isLoading: isAuthLoading, getAccessToken, isAdmin } = useAuth();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>("en");
  const [answerStrategy, setAnswerStrategy] = useState<AnswerStrategy>("auto");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showAiDebug, setShowAiDebug] = useState(false);

  // Load language preference on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const saved = localStorage.getItem("dd-response-lang") as ResponseLanguage | null;
      if (saved === "en" || saved === "vi") {
        setResponseLanguage(saved);
      } else if (localStorage.getItem("dd-response-lang") === "auto") {
        localStorage.setItem("dd-response-lang", "en");
        setResponseLanguage("en");
      }

      const savedStrategy = localStorage.getItem("dd-answer-strategy") as AnswerStrategy | null;
      if (savedStrategy === "auto" || savedStrategy === "fast" || savedStrategy === "deep") {
        setAnswerStrategy(savedStrategy);
      }

      setShowAiDebug(localStorage.getItem("dd-show-ai-debug") === "true");

      const initialQuestion = new URLSearchParams(window.location.search).get("q");
      if (initialQuestion?.trim()) {
        setQuestion(initialQuestion.trim());
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
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
      const timeoutId = window.setTimeout(() => {
        void loadServerHistory();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
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
        if (response.status === 401) {
          throw new Error("Session expired or invalid. Please sign in again.");
        }

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

  const displayLanguage = responseLanguage;

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
                {isAdmin ? (
                  <label className="status-badge cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAiDebug}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setShowAiDebug(enabled);
                        localStorage.setItem("dd-show-ai-debug", enabled ? "true" : "false");
                      }}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    Show AI debug
                  </label>
                ) : null}
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
                    {displayLanguage === "vi" ? "Thêm nhật ký mới về chủ đề này" : "Add a new diary entry about this topic"}
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
                    {displayLanguage === "vi" ? "Thử diễn đạt lại câu hỏi" : "Try rephrasing your question"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion(suggestedQuestions[0])}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                  >
                    <svg className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    {displayLanguage === "vi" ? "Thử một câu hỏi gợi ý" : "Try a suggested question instead"}
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

          {result ? <SimpleMemoryStatusPanel result={result} lang={displayLanguage} /> : null}

          {result && isAdmin && showAiDebug ? <AiDebugPanel result={result} /> : null}
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
              <EvidenceSourceCard key={`${source.marker}-${source.chunkId}`} source={source} />
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
