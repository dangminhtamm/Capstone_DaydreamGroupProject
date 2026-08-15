"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getDemoReadiness,
  getIndexingStatus,
  getAdminDiagnostics,
  requeueDeadLetterIndexingJobs,
  requeueIndexingJob,
  type DemoReadiness,
  type IndexingStatus,
  type AdminDiagnostics,
} from "@/lib/api-client";
import { GoogleWorkspaceCard } from "@/components/integrations/google-workspace-card";
import { fetchCalendarStatus } from "@/features/google-calendar/google-calendar-api";
import { fetchContactStatus } from "@/features/google-contacts/google-contacts-api";
import { fetchDriveStatus } from "@/features/google-drive/google-drive-api";
import { fetchGmailStatus } from "@/features/google-gmail/google-gmail-api";

type TokenStats = {
  today: number;
  week: number;
  month: number;
  queriesToday: number;
};

type GoogleSourceHealth = {
  source: "Calendar" | "Gmail" | "Drive" | "Contacts";
  connected: boolean;
  importedCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type SettingsTab = "profile" | "google" | "memory" | "preferences" | "admin";
type HealthTone = "ready" | "working" | "attention" | "idle";

const baseSettingsTabs: Array<{
  id: SettingsTab;
  label: string;
  description: string;
}> = [
  { id: "profile", label: "Profile", description: "Account and password" },
  { id: "google", label: "Google Workspace", description: "Calendar, Contacts, Drive" },
  { id: "preferences", label: "Preferences", description: "Theme, language, usage" },
];

const memorySettingsTab: {
  id: SettingsTab;
  label: string;
  description: string;
} = {
  id: "memory",
  label: "Memory & Indexing",
  description: "Simple readiness",
};

const adminSettingsTab: {
  id: SettingsTab;
  label: string;
  description: string;
} = {
  id: "admin",
  label: "Admin",
  description: "Queue, health, readiness",
};

function getTokenStats(): TokenStats {
  try {
    const stored = JSON.parse(localStorage.getItem("dd-token-usage") || "{}");
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const todayData = stored[todayKey] || { tokens: 0, queries: 0 };

    let weekTokens = 0;
    let monthTokens = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayTokens = stored[key]?.tokens || 0;
      monthTokens += dayTokens;
      if (i < 7) weekTokens += dayTokens;
    }

    return { today: todayData.tokens, week: weekTokens, month: monthTokens, queriesToday: todayData.queries };
  } catch {
    return { today: 0, week: 0, month: 0, queriesToday: 0 };
  }
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-rose-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-sky-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

function healthToneBadgeClass(tone: HealthTone) {
  if (tone === "ready") return "status-badge-success";
  if (tone === "attention") return "status-badge-danger";
  if (tone === "working") return "status-badge-warning";
  return "";
}

function healthPanelClass(tone: HealthTone) {
  if (tone === "ready") return "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20";
  if (tone === "attention") return "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20";
  if (tone === "working") return "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20";
  return "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60";
}

function healthDotClass(tone: HealthTone) {
  if (tone === "ready") return "bg-emerald-500";
  if (tone === "attention") return "bg-rose-500";
  if (tone === "working") return "bg-amber-500";
  return "bg-slate-300 dark:bg-slate-600";
}

function friendlyJobStatus(status: string) {
  const normalized = status.replaceAll("_", " ");
  if (status === "succeeded" || status === "completed") return "Searchable";
  if (status === "processing") return "Processing";
  if (status === "pending") return "Queued";
  if (status === "retry") return "Retry scheduled";
  if (status === "dead_letter") return "Needs requeue";
  if (status === "failed") return "Failed";
  return normalized;
}

function jobTone(status: string): HealthTone {
  if (status === "succeeded" || status === "completed") return "ready";
  if (status === "dead_letter" || status === "failed") return "attention";
  if (status === "processing" || status === "retry" || status === "pending") return "working";
  return "idle";
}

function formatConfigStatus(ok: boolean | undefined, optional = false) {
  if (ok) return { label: "Ready", tone: "ready" as HealthTone };
  if (optional) return { label: "Optional", tone: "idle" as HealthTone };
  return { label: "Missing", tone: "attention" as HealthTone };
}

function HealthSnapshotCard({
  label,
  value,
  detail,
  tone,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  tone: HealthTone;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${healthPanelClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${healthDotClass(tone)}`} aria-hidden />
      </div>
      {loading ? (
        <>
          <div className="skeleton-line mt-3 h-5 w-24" />
          <div className="skeleton-line mt-2 h-3 w-36" />
        </>
      ) : (
        <>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-slate-100">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{detail}</p>
        </>
      )}
    </div>
  );
}

function ConfigCheckRow({
  label,
  detail,
  ok,
  optional = false,
}: {
  label: string;
  detail: string;
  ok: boolean | undefined;
  optional?: boolean;
}) {
  const status = formatConfigStatus(ok, optional);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <span className={`shrink-0 status-badge ${healthToneBadgeClass(status.tone)}`}>
        {status.label}
      </span>
    </div>
  );
}

async function getGoogleSourceHealth(accessToken: string | null): Promise<GoogleSourceHealth[]> {
  const results = await Promise.allSettled([
    fetchCalendarStatus(accessToken),
    fetchGmailStatus(accessToken),
    fetchDriveStatus(accessToken),
    fetchContactStatus(accessToken),
  ]);

  const defaults: GoogleSourceHealth[] = [
    { source: "Calendar", connected: false, importedCount: 0, lastSyncedAt: null, lastError: null },
    { source: "Gmail", connected: false, importedCount: 0, lastSyncedAt: null, lastError: null },
    { source: "Drive", connected: false, importedCount: 0, lastSyncedAt: null, lastError: null },
    { source: "Contacts", connected: false, importedCount: 0, lastSyncedAt: null, lastError: null },
  ];

  return defaults.map((fallback, index) => {
    const result = results[index];
    if (!result || result.status === "rejected") {
      return {
        ...fallback,
        lastError: result?.status === "rejected"
          ? result.reason instanceof Error
            ? result.reason.message
            : "Could not load Google source status."
          : "Could not load Google source status.",
      };
    }

    const value = result.value;
    const importedCount =
      "eventCount" in value
        ? value.eventCount
        : "messageCount" in value
          ? value.messageCount
          : "fileCount" in value
            ? value.fileCount
            : value.contactCount;

    return {
      ...fallback,
      connected: Boolean(value.connected),
      importedCount,
      lastSyncedAt: value.lastSyncedAt,
      lastError: value.lastError ?? null,
    };
  });
}

function DemoStatusTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: HealthTone;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${healthPanelClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${healthDotClass(tone)}`} aria-hidden />
      </div>
      <p className="mt-2 text-sm font-bold text-slate-950 dark:text-slate-100">{value}</p>
      <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, supabase, getAccessToken, role, isAdmin } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [tokenStats, setTokenStats] = useState<TokenStats>({ today: 0, week: 0, month: 0, queriesToday: 0 });
  const [displayNameEdit, setDisplayNameEdit] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameUpdateResult, setNameUpdateResult] = useState<"success" | "error" | null>(null);
  const [responseLang, setResponseLang] = useState<"en" | "vi">("en");
  const [systemHealth, setSystemHealth] = useState<AdminDiagnostics | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
  const [demoReadiness, setDemoReadiness] = useState<DemoReadiness | null>(null);
  const [googleSourceHealth, setGoogleSourceHealth] = useState<GoogleSourceHealth[] | null>(null);
  const [isLoadingSystemStatus, setIsLoadingSystemStatus] = useState(false);
  const [isRequeueingIndexing, setIsRequeueingIndexing] = useState(false);
  const [systemStatusMsg, setSystemStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const visibleSettingsTabs = useMemo(
    () => (isAdmin ? [...baseSettingsTabs.slice(0, 2), memorySettingsTab, ...baseSettingsTabs.slice(2), adminSettingsTab] : baseSettingsTabs),
    [isAdmin],
  );

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const avatarUrl: string | undefined =
    avatarPreview ?? user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? undefined;
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "User";
  const displayEmail: string = user?.email ?? "";
  const provider = user?.app_metadata?.provider ?? "email";
  const createdAt = user?.created_at ? new Date(user.created_at) : null;

  useEffect(() => {
    setTokenStats(getTokenStats());
    const saved = localStorage.getItem("dd-response-lang") as "en" | "vi" | null;
    if (saved === "en" || saved === "vi") setResponseLang(saved);

    if (window.location.hash === "#google-workspace") {
      setActiveTab("google");
    } else if (window.location.hash === "#memory-status") {
      setActiveTab("memory");
    } else if (window.location.hash === "#admin-status") {
      setActiveTab("admin");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin && (activeTab === "admin" || activeTab === "memory")) {
      setActiveTab("profile");
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    setDisplayNameEdit(displayName);
  }, [displayName]);

  const refreshSystemStatus = useCallback(async () => {
    setIsLoadingSystemStatus(true);
    setSystemStatusMsg(null);
    try {
      const token = getAccessToken();
      const [health, indexing, readiness, googleHealth] = await Promise.all([
        isAuthenticated && isAdmin ? getAdminDiagnostics(token) : Promise.resolve(null),
        isAuthenticated ? getIndexingStatus(token) : Promise.resolve(null),
        isAuthenticated ? getDemoReadiness(token) : Promise.resolve(null),
        isAuthenticated ? getGoogleSourceHealth(token) : Promise.resolve(null),
      ]);

      setSystemHealth(health);
      setIndexingStatus(indexing);
      setDemoReadiness(readiness);
      setGoogleSourceHealth(googleHealth);
    } catch (error) {
      setSystemStatusMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not load system health.",
      });
    } finally {
      setIsLoadingSystemStatus(false);
    }
  }, [getAccessToken, isAdmin, isAuthenticated]);

  useEffect(() => {
    void refreshSystemStatus();
  }, [refreshSystemStatus]);

  const handleRequeueDeadLetterJobs = useCallback(async () => {
    setIsRequeueingIndexing(true);
    setSystemStatusMsg(null);
    try {
      const result = await requeueDeadLetterIndexingJobs(getAccessToken());
      setSystemStatusMsg({
        type: "success",
        text: result.requeued > 0 ? `Requeued ${result.requeued} dead-letter indexing job(s).` : "No dead-letter indexing jobs to requeue.",
      });
      await refreshSystemStatus();
    } catch (error) {
      setSystemStatusMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not requeue dead-letter jobs.",
      });
    } finally {
      setIsRequeueingIndexing(false);
    }
  }, [getAccessToken, refreshSystemStatus]);

  const handleRequeueJob = useCallback(async (jobId: string) => {
    setIsRequeueingIndexing(true);
    setSystemStatusMsg(null);
    try {
      await requeueIndexingJob(getAccessToken(), jobId);
      setSystemStatusMsg({ type: "success", text: "Indexing job requeued." });
      await refreshSystemStatus();
    } catch (error) {
      setSystemStatusMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not requeue indexing job.",
      });
    } finally {
      setIsRequeueingIndexing(false);
    }
  }, [getAccessToken, refreshSystemStatus]);

  const handleUpdateDisplayName = async () => {
    if (!supabase || !displayNameEdit.trim()) return;
    setIsUpdatingName(true);
    setNameUpdateResult(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayNameEdit.trim() },
      });
      setNameUpdateResult(error ? "error" : "success");
      if (!error) setTimeout(() => setNameUpdateResult(null), 3000);
    } catch {
      setNameUpdateResult("error");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    if (!file.type.startsWith("image/")) {
      setAvatarMsg({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg({ type: "error", text: "Image must be under 2MB." });
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarMsg(null);

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const userId = user?.id;
      if (!userId) throw new Error("No user");
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `avatars/${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;
      setAvatarPreview(publicUrl);
      setAvatarMsg({ type: "success", text: "Avatar updated!" });
      setTimeout(() => setAvatarMsg(null), 3000);
    } catch (err) {
      setAvatarMsg({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!supabase) return;
    setPwMsg(null);
    if (newPassword.length < 6) {
      setPwMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMsg({
        type: "success", text: provider === "google"
          ? "Password set! You can now also sign in with email + password."
          : "Password updated successfully."
      });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwMsg(null), 5000);
    } catch (err) {
      setPwMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleChangeLanguage = (lang: "en" | "vi") => {
    setResponseLang(lang);
    localStorage.setItem("dd-response-lang", lang);
  };

  const handleClearTokenHistory = () => {
    localStorage.removeItem("dd-token-usage");
    setTokenStats({ today: 0, week: 0, month: 0, queriesToday: 0 });
  };

  const hasNameChanged = useMemo(() => displayNameEdit.trim() !== displayName, [displayNameEdit, displayName]);
  const outboxCounts = systemHealth?.indexingOutbox.counts ?? {};
  const userIndexingCounts = indexingStatus?.counts ?? {};
  const workerStatus = systemHealth?.worker;
  const userEmbeddingIndex = indexingStatus?.embeddingIndex;
  const globalEmbeddingIndex = systemHealth?.embeddingIndex;
  const activeEmbeddingIndex = userEmbeddingIndex ?? globalEmbeddingIndex;
  const coreEnvironmentChecks = [
    {
      label: "Database URL",
      detail: "API can locate the primary Postgres connection.",
      ok: systemHealth?.environment.databaseConfigured,
    },
    {
      label: "Supabase service",
      detail: "Auth sync and private storage operations can run.",
      ok: systemHealth?.environment.supabaseConfigured,
    },
    {
      label: "AI gateway",
      detail: "Tuturuuu AI gateway is configured for embedding and answer generation.",
      ok: systemHealth?.environment.tuturuuuConfigured,
    },
    {
      label: "Google OAuth",
      detail: "Calendar, Gmail, Drive, and Contacts can request Google access.",
      ok: systemHealth?.environment.googleOAuthConfigured,
    },
  ];
  const enterpriseEnvironmentChecks = [
    {
      label: "Redis",
      detail: systemHealth?.environment.redisReachable
        ? "Rate limit and search cache are using Redis."
        : "Falls back to local/database behavior when Redis is unavailable.",
      ok: Boolean(systemHealth?.environment.redisConfigured && systemHealth?.environment.redisReachable),
      optional: false,
    },
    {
      label: "Temporal",
      detail: "Optional orchestration layer for production-grade workflows.",
      ok: systemHealth?.environment.temporalConfigured,
      optional: true,
    },
    {
      label: "Sentry",
      detail: "Optional error reporting for deployed API and worker runtime.",
      ok: systemHealth?.environment.sentryConfigured,
      optional: true,
    },
    {
      label: "OpenTelemetry",
      detail: "Optional distributed tracing for enterprise observability.",
      ok: systemHealth?.environment.openTelemetryConfigured,
      optional: true,
    },
  ];
  const userPendingJobs = (userIndexingCounts.pending ?? 0) + (userIndexingCounts.retry ?? 0);
  const userProcessingJobs = userIndexingCounts.processing ?? 0;
  const userFailedJobs = (userIndexingCounts.dead_letter ?? 0) + (userIndexingCounts.failed ?? 0);
  const userDoneJobs = userIndexingCounts.succeeded ?? 0;
  const totalActiveJobs = userPendingJobs + userProcessingJobs;
  const outboxFailedJobs = (outboxCounts.dead_letter ?? 0) + (outboxCounts.failed ?? 0);
  const outboxActiveJobs = (outboxCounts.pending ?? 0) + (outboxCounts.retry ?? 0) + (outboxCounts.processing ?? 0);
  const staleProcessingJobs = Math.max(indexingStatus?.staleProcessingCount ?? 0, systemHealth?.indexingOutbox.staleProcessingCount ?? 0);
  const embeddingIssueCount =
    (activeEmbeddingIndex?.missingEmbeddingChunks ?? 0) +
    (activeEmbeddingIndex?.staleEmbeddingModelChunks ?? 0);
  const coreMissingCount = coreEnvironmentChecks.filter((check) => !check.ok).length;
  const workerTone: HealthTone = workerStatus?.ok ? "ready" : workerStatus ? "attention" : "idle";
  const embeddingOverallTone: HealthTone = activeEmbeddingIndex?.healthy
    ? "ready"
    : activeEmbeddingIndex
      ? embeddingIssueCount > 0
        ? "attention"
        : "idle"
      : "idle";
  const systemOverallTone: HealthTone = systemHealth?.status === "ok" && coreMissingCount === 0 && userFailedJobs === 0 && workerTone !== "attention" && embeddingOverallTone !== "attention"
    ? "ready"
    : systemHealth || indexingStatus
      ? "attention"
      : "idle";
  const indexingOverallTone: HealthTone = userFailedJobs > 0 || outboxFailedJobs > 0 || staleProcessingJobs > 0
    ? "attention"
    : totalActiveJobs > 0 || outboxActiveJobs > 0
      ? "working"
      : indexingStatus?.available
        ? "ready"
        : "idle";
  const demoOverallTone: HealthTone = demoReadiness?.ready
    ? "ready"
    : demoReadiness
      ? "working"
      : "idle";
  const googleConnectedCount = googleSourceHealth?.filter((source) => source.connected).length ?? 0;
  const googleImportedCount = googleSourceHealth?.filter((source) => source.importedCount > 0 || source.lastSyncedAt).length ?? 0;
  const googleAttentionCount = googleSourceHealth?.filter((source) => source.lastError && !source.connected).length ?? 0;
  const googleOverallTone: HealthTone = googleConnectedCount > 0
    ? "ready"
    : googleAttentionCount > 0
      ? "attention"
      : googleSourceHealth
        ? "idle"
        : "idle";
  const workerFriendlyValue = workerStatus?.ok
    ? "Worker running"
    : workerStatus?.status === "missing"
      ? "Start worker"
      : workerStatus?.status === "stale"
        ? "Restart worker"
        : workerStatus
          ? "Worker needs attention"
          : "Worker unknown";
  const indexingFriendlyValue = indexingOverallTone === "ready"
    ? "Indexing clean"
    : indexingOverallTone === "working"
      ? "Indexing running"
      : indexingOverallTone === "attention"
        ? "Indexing needs action"
        : "Indexing unknown";
  const googleFriendlyValue = googleConnectedCount > 0
    ? "Google connected"
    : googleAttentionCount > 0
      ? "Reconnect Google"
      : "Connect Google";
  const schemaChecks = Object.entries({
    ...(systemHealth?.schema.tables ?? {}),
    ...(systemHealth?.schema.indexes ?? {}),
  });
  const formatDuration = (ms: number | null | undefined) => {
    if (ms == null) return null;
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };
  return (
    <DashboardShell
      title="Settings"
      description="Manage your profile, preferences, and application settings."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="enterprise-card p-1.5">
          <div className={`grid gap-2 ${isAdmin ? "md:grid-cols-5" : "md:grid-cols-3"}`}>
            {visibleSettingsTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer rounded-xl px-3.5 py-3 text-left transition ${
                    isActive
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/60"
                      : "text-slate-600 hover:bg-blue-50/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className="block text-sm font-bold">{tab.label}</span>
                  <span className={`mt-0.5 block text-xs ${isActive ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {tab.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Profile Section ─── */}
        {activeTab === "profile" ? (
        <section className="enterprise-card p-5">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Account</p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Your Profile</h3>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-4">
              <div className="skeleton-line h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-line h-4 w-32" />
                <div className="skeleton-line h-3 w-48" />
              </div>
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-5">
              {/* Avatar + Info */}
              <div className="flex items-center gap-5">
                {/* Clickable avatar with upload overlay */}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="group relative shrink-0 cursor-pointer"
                  title="Click to change avatar"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-2xl object-cover ring-4 ring-indigo-100 dark:ring-indigo-900/50"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-2xl font-bold text-white dark:bg-slate-700">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    {isUploadingAvatar ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white">Saving</span>
                    ) : (
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{displayEmail}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${provider === "google"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>
                      {provider === "google" ? (
                        <svg className="h-3 w-3" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      )}
                      {provider === "google" ? "Google" : "Email"}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isAdmin
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}>
                      {isAdmin ? "Admin" : "User"}
                    </span>
                  </div>
                </div>
              </div>
              {avatarMsg && (
                <p className={`text-xs font-medium ${avatarMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {avatarMsg.text}
                </p>
              )}

              {/* Edit display name */}
              <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
                <label htmlFor="settings-display-name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Display Name</label>
                <div className="flex gap-3">
                  <input
                    id="settings-display-name"
                    type="text"
                    value={displayNameEdit}
                    onChange={(e) => setDisplayNameEdit(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                    placeholder="Your name"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateDisplayName}
                    disabled={!hasNameChanged || isUpdatingName}
                    className="action-primary shrink-0 disabled:cursor-not-allowed"
                  >
                    {isUpdatingName ? "Saving..." : "Update"}
                  </button>
                </div>
                {nameUpdateResult === "success" && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Name updated successfully
                  </p>
                )}
                {nameUpdateResult === "error" && (
                  <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">Failed to update name. Please try again.</p>
                )}
              </div>

              {/* Password change/set */}
              <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Change Password
                </p>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                      placeholder="New password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  {/* Password strength indicator */}
                  {newPassword && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-600">
                          <div
                            className={`h-1.5 rounded-full transition-all ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{passwordStrength.label}</span>
                      </div>
                    </div>
                  )}
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                    className="action-primary disabled:cursor-not-allowed"
                  >
                    {isUpdatingPassword ? "Updating..." : "Change Password"}
                  </button>
                </div>
                {pwMsg && (
                  <p className={`mt-2 text-xs font-medium ${pwMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {pwMsg.text}
                  </p>
                )}
              </div>


            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
              <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-200">Not signed in</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to manage your profile.</p>
              <a href="/login" className="action-primary mt-4">
                Sign in
              </a>
            </div>
          )}
        </section>
        ) : null}

        {activeTab === "google" ? (
        <Suspense fallback={null}>
          <GoogleWorkspaceCard indexingStatus={indexingStatus} variant={isAdmin ? "admin" : "user"} />
        </Suspense>
        ) : null}

        {/* ─── Admin Memory Status ─── */}
        {isAdmin && activeTab === "memory" ? (
        <section id="memory-status" className="scroll-mt-24 enterprise-card p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Memory</p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Memory & Indexing Status</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Simple readiness for diary, attachments, Google imports, and AI Recall.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void refreshSystemStatus()}
                disabled={isLoadingSystemStatus}
                className="action-secondary disabled:cursor-not-allowed"
              >
                {isLoadingSystemStatus ? "Checking..." : "Refresh"}
              </button>
            </div>
          </div>

          {systemStatusMsg && (
            <p className={`mb-4 text-sm font-medium ${systemStatusMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {systemStatusMsg.text}
            </p>
          )}

          <div className={`rounded-2xl border p-4 ${healthPanelClass(systemOverallTone)}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${healthDotClass(systemOverallTone)}`} aria-hidden />
                  <p className="text-sm font-bold text-slate-950 dark:text-slate-100">
                    {systemOverallTone === "ready"
                      ? "Memory is ready"
                      : isLoadingSystemStatus
                        ? "Checking memory status"
                        : "Memory needs attention"}
                  </p>
                  <span className={`status-badge ${healthToneBadgeClass(systemOverallTone)}`}>
                    {systemHealth?.status ?? "unknown"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {systemOverallTone === "ready"
                    ? "New entries and imports are ready to become searchable AI memory."
                    : isAdmin
                      ? "Open the Admin tab for queue details, requeue actions, and readiness checks."
                      : "Some memory operations need attention. If jobs are stuck, ask an admin to inspect the queue."}
                </p>
              </div>
              {systemHealth?.checkedAt ? (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Checked {new Date(systemHealth.checkedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DemoStatusTile
              label="Worker"
              value={workerFriendlyValue}
              detail={
                workerStatus?.heartbeatAgeMs != null
                  ? `Last heartbeat ${formatDuration(workerStatus.heartbeatAgeMs)} ago.`
                  : workerStatus?.detail ?? "Run API and worker together before the demo."
              }
              tone={workerTone}
            />
            <DemoStatusTile
              label="Indexing"
              value={indexingFriendlyValue}
              detail={
                indexingOverallTone === "ready"
                  ? "No queued, failed, or stuck memory jobs."
                  : indexingOverallTone === "working"
                    ? `${totalActiveJobs + outboxActiveJobs} job(s) still becoming searchable memory.`
                    : indexingOverallTone === "attention"
                      ? `${userFailedJobs + outboxFailedJobs + staleProcessingJobs} job(s) need requeue or worker attention.`
                      : "Refresh after signing in to inspect memory jobs."
              }
              tone={indexingOverallTone}
            />
            <DemoStatusTile
              label="Search memory"
              value={
                embeddingOverallTone === "ready"
                  ? "Ready"
                  : embeddingIssueCount > 0
                    ? "Re-embed needed"
                    : activeEmbeddingIndex
                      ? "No chunks yet"
                      : "Unknown"
              }
              detail={
                activeEmbeddingIndex
                  ? `${activeEmbeddingIndex.currentEmbeddingModelChunks}/${activeEmbeddingIndex.totalChunks} chunks use ${activeEmbeddingIndex.embeddingModel}.`
                  : "Refresh after adding diary entries or importing Google data."
              }
              tone={embeddingOverallTone}
            />
            <DemoStatusTile
              label="Google"
              value={googleFriendlyValue}
              detail={
                googleConnectedCount > 0
                  ? `${googleConnectedCount}/4 sources connected, ${googleImportedCount}/4 imported for AI.`
                  : systemHealth?.environment.googleOAuthConfigured
                    ? "OAuth is configured. Connect Google, then import each source."
                    : "Google OAuth env vars are missing."
              }
              tone={googleOverallTone}
            />
          </div>

          {indexingOverallTone === "attention" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Indexing needs attention
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-700 dark:text-amber-300">
                {userFailedJobs + outboxFailedJobs + staleProcessingJobs} job(s) need review. {isAdmin ? "Use the Admin tab to inspect and requeue failed jobs." : `Signed in as ${role}. An admin can inspect and requeue failed jobs.`}
              </p>
            </div>
          ) : null}

          {isAdmin ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Admin operations are separated
              </p>
              <p className="mt-1 text-sm leading-6 text-blue-700 dark:text-blue-300">
                Queue details, schema checks, enterprise controls, demo readiness, and requeue actions are now in the Admin tab.
              </p>
            </div>
          ) : null}
        </section>
        ) : null}

        {isAdmin && activeTab === "admin" ? (
        <section id="admin-status" className="scroll-mt-24 enterprise-card p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Admin</p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Operations Console</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Worker health, indexing queue, readiness, schema checks, and enterprise controls.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleRequeueDeadLetterJobs()}
                disabled={!isAuthenticated || isRequeueingIndexing || userFailedJobs === 0}
                className="action-secondary border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                {isRequeueingIndexing
                  ? "Requeueing..."
                  : userFailedJobs > 0
                    ? `Requeue dead-letter (${userFailedJobs})`
                    : "No dead-letter jobs"}
              </button>
              <button
                type="button"
                onClick={() => void refreshSystemStatus()}
                disabled={isLoadingSystemStatus}
                className="action-secondary disabled:cursor-not-allowed"
              >
                {isLoadingSystemStatus ? "Checking..." : "Refresh"}
              </button>
            </div>
          </div>

          {systemStatusMsg && (
            <p className={`mb-4 text-sm font-medium ${systemStatusMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {systemStatusMsg.text}
            </p>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <HealthSnapshotCard
              label="API"
              value={systemHealth ? systemHealth.status.toUpperCase() : "Unknown"}
              detail={systemHealth?.checkedAt ? "Health endpoint responded." : "Refresh to check the API health endpoint."}
              tone={systemHealth?.status === "ok" ? "ready" : systemHealth ? "attention" : "idle"}
              loading={isLoadingSystemStatus && !systemHealth}
            />
            <HealthSnapshotCard
              label="Database"
              value={systemHealth?.database.ok ? "Connected" : "Needs attention"}
              detail={systemHealth?.database.detail ?? "Prisma can read/write the app database."}
              tone={systemHealth?.database.ok ? "ready" : systemHealth ? "attention" : "idle"}
              loading={isLoadingSystemStatus && !systemHealth}
            />
            <HealthSnapshotCard
              label="Worker"
              value={
                workerStatus?.ok
                  ? "Running"
                  : workerStatus?.status === "missing"
                    ? "Missing"
                    : workerStatus?.status === "stale"
                      ? "Stale"
                      : workerStatus
                        ? "Needs attention"
                        : "Unknown"
              }
              detail={
                workerStatus?.heartbeatAgeMs != null
                  ? `Last heartbeat ${formatDuration(workerStatus.heartbeatAgeMs)} ago.`
                  : workerStatus?.detail ?? "Start the worker to drain indexing jobs."
              }
              tone={workerTone}
              loading={isLoadingSystemStatus && !systemHealth}
            />
            <HealthSnapshotCard
              label="Indexing"
              value={
                indexingOverallTone === "ready"
                  ? "Queue clear"
                  : indexingOverallTone === "working"
                    ? "Working"
                    : indexingOverallTone === "attention"
                      ? "Needs action"
                      : "Unknown"
              }
              detail={
                indexingOverallTone === "ready"
                  ? "No failed or active indexing jobs for your account."
                  : indexingOverallTone === "working"
                    ? `${totalActiveJobs} user job(s) and ${outboxActiveJobs} outbox job(s) are queued or processing.`
                  : indexingOverallTone === "attention"
                      ? staleProcessingJobs > 0
                        ? `${staleProcessingJobs} processing job(s) are stale. Worker may need restart.`
                        : `${userFailedJobs + outboxFailedJobs} failed job(s) need review or requeue.`
                      : "Refresh after signing in to inspect indexing jobs."
              }
              tone={indexingOverallTone}
              loading={isLoadingSystemStatus && !indexingStatus}
            />
            <HealthSnapshotCard
              label="Embeddings"
              value={
                embeddingOverallTone === "ready"
                  ? "Aligned"
                  : embeddingIssueCount > 0
                    ? "Re-embed"
                    : userEmbeddingIndex || globalEmbeddingIndex
                      ? "No chunks"
                      : "Unknown"
              }
              detail={
                activeEmbeddingIndex
                  ? `${activeEmbeddingIndex.currentEmbeddingModelChunks}/${activeEmbeddingIndex.totalChunks} current for ${activeEmbeddingIndex.embeddingModel}.`
                  : "Refresh to inspect memory chunk embeddings."
              }
              tone={embeddingOverallTone}
              loading={isLoadingSystemStatus && !indexingStatus && !systemHealth}
            />
            <HealthSnapshotCard
              label="Google"
              value={googleFriendlyValue}
              detail={
                googleSourceHealth
                  ? `${googleConnectedCount}/4 connected · ${googleImportedCount}/4 imported.`
                  : "Refresh to check Google source connection status."
              }
              tone={googleOverallTone}
              loading={isLoadingSystemStatus && !googleSourceHealth}
            />
            <HealthSnapshotCard
              label="Demo"
              value={demoReadiness?.ready ? "Ready" : demoReadiness ? "Needs work" : "Unknown"}
              detail={
                demoReadiness
                  ? `${demoReadiness.checks.filter((check) => check.ok).length}/${demoReadiness.checks.length} readiness checks passing.`
                  : "Run a readiness check to verify demo data and memory indexing."
              }
              tone={demoOverallTone}
              loading={isLoadingSystemStatus && !demoReadiness}
            />
          </div>

          {demoReadiness ? (
            <div className={`mt-4 rounded-2xl border p-4 ${
              demoReadiness.ready
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
            }`}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-bold ${
                    demoReadiness.ready
                      ? "text-emerald-800 dark:text-emerald-300"
                      : "text-amber-800 dark:text-amber-300"
                  }`}>
                    Demo readiness: {demoReadiness.ready ? "Ready" : "Needs work"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Diary {demoReadiness.counts.diaryEntries} · Memory chunks {demoReadiness.counts.memoryChunks} · Queue {demoReadiness.counts.pendingOutbox} pending · Embeddings {demoReadiness.counts.currentEmbeddingModelChunks ?? 0}/{demoReadiness.counts.memoryChunks} current
                  </p>
                </div>
                <span className={`self-start status-badge ${
                  demoReadiness.ready
                    ? "status-badge-success"
                    : "status-badge-warning"
                }`}>
                  {demoReadiness.checks.filter((check) => check.ok).length}/{demoReadiness.checks.length} checks
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {demoReadiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      check.ok
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                    }`}>
                      {check.ok ? "OK" : "!"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {check.label}
                        {!check.required ? (
                          <span className="ml-2 status-badge">
                            stretch
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {demoReadiness.nextActions.length ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Next actions
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    {demoReadiness.nextActions.slice(0, 4).map((action) => (
                      <li key={action}>- {action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Required for MVP</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">These should be ready before demo.</p>
                </div>
                <span className={`status-badge ${coreMissingCount === 0 ? "status-badge-success" : "status-badge-danger"}`}>
                  {coreMissingCount === 0 ? "All ready" : `${coreMissingCount} missing`}
                </span>
              </div>
              <div className="grid gap-2">
                {coreEnvironmentChecks.map((check) => (
                  <ConfigCheckRow
                    key={check.label}
                    label={check.label}
                    detail={check.detail}
                    ok={check.ok}
                  />
                ))}
              </div>
            </div>

            <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enterprise add-ons</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Useful for production proof, not all required for MVP.</p>
                </div>
              </div>
              <div className="grid gap-2">
                {enterpriseEnvironmentChecks.map((check) => (
                  <ConfigCheckRow
                    key={check.label}
                    label={check.label}
                    detail={check.detail}
                    ok={check.ok}
                    optional={check.optional}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 enterprise-panel bg-white p-4 dark:bg-slate-950">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Database schema checks</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Required tables and indexes used by memory indexing.</p>
              </div>
              {schemaChecks.length ? (
                <span className={`status-badge ${schemaChecks.every(([, check]) => check.ok) ? "status-badge-success" : "status-badge-danger"}`}>
                  {schemaChecks.filter(([, check]) => check.ok).length}/{schemaChecks.length} OK
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {schemaChecks.map(([name, check]) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-600 dark:text-slate-400">{name}</span>
                  <span className={`shrink-0 status-badge ${check.ok ? "status-badge-success" : "status-badge-danger"}`}>
                    {check.ok ? "OK" : "Missing"}
                  </span>
                </div>
              ))}
              {!systemHealth && (
                <p className="text-sm text-slate-500 dark:text-slate-400">No health check loaded yet.</p>
              )}
            </div>
          </div>

          {systemHealth?.warnings.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Warnings</p>
              <div className="space-y-1">
                {systemHealth.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-amber-700 dark:text-amber-300">{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          {systemHealth?.enterpriseControls ? (
            <div className="mt-4 enterprise-panel bg-white p-4 dark:bg-slate-950">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enterprise Controls</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Request tracing, API protection, audit logging, and observability readiness.</p>
                </div>
                <span className="status-badge status-badge-success">
                  active
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Traceability</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {systemHealth.enterpriseControls.requestId.enabled ? "Request ID enabled" : "Request ID disabled"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{systemHealth.enterpriseControls.requestId.header}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">API Rate Limit</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {systemHealth.enterpriseControls.rateLimit.enabled ? "Enabled" : "Disabled"} · {systemHealth.enterpriseControls.rateLimit.storage}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Redis {systemHealth.enterpriseControls.rateLimit.redisConnected ? "connected" : "fallback"} · AI {systemHealth.enterpriseControls.rateLimit.profiles.ai?.max ?? "-"} req/min
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Search Cache</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {systemHealth.enterpriseControls.searchCache?.enabled ? "Enabled" : "Disabled"} · {systemHealth.enterpriseControls.searchCache?.storage ?? "database-fallback"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    TTL {systemHealth.enterpriseControls.searchCache?.ttlSeconds ?? "-"}s · exact answer cache
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Audit Logging</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {systemHealth.enterpriseControls.auditLogging.enabled ? "Enabled" : "Disabled"} · {systemHealth.enterpriseControls.auditLogging.sink}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {systemHealth.enterpriseControls.auditLogging.piiSafe ? "PII-safe request metadata only" : "Review log payload policy"}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Security Headers</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {systemHealth.enterpriseControls.securityHeaders.enabled ? "Enabled" : "Disabled"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {systemHealth.enterpriseControls.securityHeaders.headers.slice(0, 3).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 enterprise-panel bg-white p-4 dark:bg-slate-950">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Memory indexing queue</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  This shows whether new diary, attachment, Google, and summary data has become searchable memory.
                </p>
              </div>
              <span className={`status-badge ${healthToneBadgeClass(indexingOverallTone)}`}>
                {indexingOverallTone === "ready"
                  ? "Ready"
                  : indexingOverallTone === "working"
                    ? "Working"
                    : indexingOverallTone === "attention"
                      ? "Needs action"
                      : "Unknown"}
              </span>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-4">
              {[
                {
                  label: "Queued",
                  value: userPendingJobs,
                  detail: userPendingJobs ? "Waiting for worker" : "Nothing waiting",
                  tone: userPendingJobs ? "working" as HealthTone : "ready" as HealthTone,
                },
                {
                  label: "Processing",
                  value: userProcessingJobs,
                  detail: userProcessingJobs ? "Worker is indexing" : "No active locks",
                  tone: userProcessingJobs ? "working" as HealthTone : "ready" as HealthTone,
                },
                {
                  label: "Needs action",
                  value: userFailedJobs,
                  detail: userFailedJobs ? "Requeue or inspect error" : "No failed jobs",
                  tone: userFailedJobs ? "attention" as HealthTone : "ready" as HealthTone,
                },
                {
                  label: "Searchable",
                  value: userDoneJobs,
                  detail: "Finished jobs",
                  tone: "ready" as HealthTone,
                },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg border px-3 py-2 ${healthPanelClass(item.tone)}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-3">
              {[
                {
                  label: "Worker process",
                  value: workerStatus?.ok ? "Heartbeat fresh" : workerStatus ? "Not healthy" : "Unknown",
                  detail: workerStatus?.detail ?? "Start API and worker together before importing memory.",
                  tone: workerTone,
                },
                {
                  label: "Due jobs",
                  value: `${systemHealth?.indexingOutbox.dueJobCount ?? userPendingJobs}`,
                  detail: systemHealth?.indexingOutbox.oldestPendingAgeMs
                    ? `Oldest queued job has waited ${formatDuration(systemHealth.indexingOutbox.oldestPendingAgeMs)}.`
                    : "No overdue indexing jobs detected.",
                  tone: (systemHealth?.indexingOutbox.dueJobCount ?? 0) > 0 && workerTone === "attention" ? "attention" as HealthTone : userPendingJobs ? "working" as HealthTone : "ready" as HealthTone,
                },
                {
                  label: "Embedding model",
                  value: activeEmbeddingIndex?.embeddingModel ?? "Unknown",
                  detail: activeEmbeddingIndex
                    ? `${activeEmbeddingIndex.missingEmbeddingChunks} missing · ${activeEmbeddingIndex.staleEmbeddingModelChunks} stale · ${activeEmbeddingIndex.currentEmbeddingModelChunks} current.`
                    : "No embedding health data loaded yet.",
                  tone: embeddingOverallTone,
                },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg border px-3 py-2 ${healthPanelClass(item.tone)}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>

            {!isAuthenticated ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Sign in to inspect your indexing jobs.</p>
              </div>
            ) : indexingStatus && !indexingStatus.available ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{indexingStatus.reason}</p>
              </div>
            ) : indexingStatus?.recent.length ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {indexingStatus.recent.map((job) => (
                  <div key={job.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">
                            {job.sourceType} memory
                          </p>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                            {job.jobType.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          Updated {new Date(job.updatedAt).toLocaleString()} · source {job.sourceId}
                        </p>
                      </div>
                      <span className={`shrink-0 status-badge ${healthToneBadgeClass(jobTone(job.status))}`}>
                        {friendlyJobStatus(job.status)}
                      </span>
                    </div>
                    {job.error && (
                      <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/20">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Last error</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-rose-600 dark:text-rose-300">{job.error}</p>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Retry {job.retryCount}/{job.maxRetries} · age {formatDuration(job.ageMs) ?? "unknown"}
                        {job.nextRunAfter ? ` · next run ${new Date(job.nextRunAfter).toLocaleString()}` : ""}
                        {job.processingAgeMs ? ` · processing for ${formatDuration(job.processingAgeMs)}` : ""}
                        {job.lastErrorAt ? ` · last error ${new Date(job.lastErrorAt).toLocaleString()}` : ""}
                      </p>
                      {isAdmin && ["dead_letter", "failed", "retry", "processing"].includes(job.status) ? (
                        <button
                          type="button"
                          onClick={() => void handleRequeueJob(job.id)}
                          disabled={isRequeueingIndexing}
                          className="action-secondary min-h-9 px-3 py-1 text-xs disabled:cursor-not-allowed"
                        >
                          Requeue
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No indexing jobs found for your account.</p>
              </div>
            )}

            {indexingStatus?.staleProcessingCount ? (
              <p className="mt-3 text-sm font-medium text-amber-600 dark:text-amber-400">
                {indexingStatus.staleProcessingCount} processing jobs have been locked for more than 10 minutes.
              </p>
            ) : null}
            {!isAdmin && isAuthenticated ? (
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Signed in as {role}. Admin role is required to requeue indexing jobs.
              </p>
            ) : null}
          </div>
        </section>
        ) : null}

        {/* ─── Appearance ─── */}
        {activeTab === "preferences" ? (
        <>
        <section className="enterprise-card p-5">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Appearance</p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Theme & Language</h3>
          </div>

          <div className="space-y-4">
            {/* Theme selector */}
            <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Color Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "light" as const, label: "Light", icon: (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>) },
                  { value: "dark" as const, label: "Dark", icon: (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>) },
                  { value: "system" as const, label: "System", icon: (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>) },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${theme === opt.value
                        ? "border-slate-900 bg-slate-100 text-slate-950 dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                      }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language preference */}
            <div className="enterprise-panel bg-white p-4 dark:bg-slate-950">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">AI Response Language</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "en" as const, label: "English", flag: (<svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><clipPath id="s-flag-us"><circle cx="12" cy="12" r="12" /></clipPath><g clipPath="url(#s-flag-us)"><rect width="24" height="24" fill="#B22234" /><rect y="1.85" width="24" height="1.85" fill="white" /><rect y="5.54" width="24" height="1.85" fill="white" /><rect y="9.23" width="24" height="1.85" fill="white" /><rect y="12.92" width="24" height="1.85" fill="white" /><rect y="16.62" width="24" height="1.85" fill="white" /><rect y="20.31" width="24" height="1.85" fill="white" /><rect width="10" height="12.92" fill="#3C3B6E" /></g></svg>) },
                  { value: "vi" as const, label: "Tiếng Việt", flag: (<svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><clipPath id="s-flag-vn"><circle cx="12" cy="12" r="12" /></clipPath><g clipPath="url(#s-flag-vn)"><rect width="24" height="24" fill="#DA251D" /><polygon points="12,4.8 13.76,10.22 19.44,10.22 14.84,13.58 16.6,18.98 12,15.62 7.4,18.98 9.16,13.58 4.56,10.22 10.24,10.22" fill="#FFFF00" /></g></svg>) },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChangeLanguage(opt.value)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition ${responseLang === opt.value
                        ? "border-slate-900 bg-slate-100 text-slate-950 dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                      }`}
                  >
                    {opt.flag}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── AI Usage Stats ─── */}
        <section className="enterprise-card p-5">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Usage</p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">AI Token Usage</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Today", value: tokenStats.today.toLocaleString(), sub: "tokens" },
              { label: "This Week", value: tokenStats.week.toLocaleString(), sub: "tokens" },
              { label: "This Month", value: tokenStats.month.toLocaleString(), sub: "tokens" },
              { label: "Queries Today", value: tokenStats.queriesToday.toString(), sub: "searches" },
            ].map((stat) => (
              <div key={stat.label} className="enterprise-panel bg-white p-4 text-center dark:bg-slate-950">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleClearTokenHistory}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              Clear Usage History
            </button>
          </div>
        </section>
        </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
