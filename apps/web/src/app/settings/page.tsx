"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getCalendarEvents,
  getCalendarStatus,
  getIndexingStatus,
  getGoogleCalendarConnectUrl,
  getSystemHealth,
  syncGoogleCalendar,
  type CalendarConnectionStatus,
  type CalendarEventRecord,
  type IndexingStatus,
  type SystemHealth,
} from "@/lib/api-client";

type TokenStats = {
  today: number;
  week: number;
  month: number;
  queriesToday: number;
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

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, supabase, getAccessToken } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [tokenStats, setTokenStats] = useState<TokenStats>({ today: 0, week: 0, month: 0, queriesToday: 0 });
  const [displayNameEdit, setDisplayNameEdit] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameUpdateResult, setNameUpdateResult] = useState<"success" | "error" | null>(null);
  const [responseLang, setResponseLang] = useState<"en" | "vi">("en");
  const [calendarStatus, setCalendarStatus] = useState<CalendarConnectionStatus | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
  const [isLoadingSystemStatus, setIsLoadingSystemStatus] = useState(false);
  const [systemStatusMsg, setSystemStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  }, []);

  useEffect(() => {
    setDisplayNameEdit(displayName);
  }, [displayName]);

  const refreshCalendarStatus = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingCalendar(true);
    try {
      const token = getAccessToken();
      const status = await getCalendarStatus(token);
      const events = await getCalendarEvents(token);
      setCalendarStatus(status);
      setCalendarEvents(events);
    } catch (error) {
      setCalendarMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not load Calendar status.",
      });
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    void refreshCalendarStatus();
  }, [refreshCalendarStatus]);

  const refreshSystemStatus = useCallback(async () => {
    setIsLoadingSystemStatus(true);
    setSystemStatusMsg(null);
    try {
      const [health, indexing] = await Promise.all([
        getSystemHealth(),
        isAuthenticated ? getIndexingStatus(getAccessToken()) : Promise.resolve(null),
      ]);

      setSystemHealth(health);
      setIndexingStatus(indexing);
    } catch (error) {
      setSystemStatusMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not load system health.",
      });
    } finally {
      setIsLoadingSystemStatus(false);
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    void refreshSystemStatus();
  }, [refreshSystemStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const calendarResult = params.get("calendar");
    if (!calendarResult) return;

    if (calendarResult === "connected") {
      setCalendarMsg({ type: "success", text: "Google Calendar connected." });
      void refreshCalendarStatus();
    } else {
      const reason = params.get("reason");
      setCalendarMsg({
        type: "error",
        text: reason ? `Google Calendar connection failed: ${reason}` : "Google Calendar connection failed.",
      });
    }

    params.delete("calendar");
    params.delete("reason");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [refreshCalendarStatus]);

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

  const handleConnectCalendar = async () => {
    setIsConnectingCalendar(true);
    setCalendarMsg(null);
    try {
      const url = await getGoogleCalendarConnectUrl(getAccessToken());
      window.location.href = url;
    } catch (error) {
      setCalendarMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not start Google Calendar connection.",
      });
      setIsConnectingCalendar(false);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncingCalendar(true);
    setCalendarMsg(null);
    try {
      const result = await syncGoogleCalendar(getAccessToken());
      setCalendarMsg({
        type: "success",
        text: `Calendar synced: ${result.syncedCount} events, ${result.queuedIndexingJobs ?? 0} queued for memory indexing.`,
      });
      await refreshCalendarStatus();
    } catch (error) {
      setCalendarMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Could not sync Google Calendar.",
      });
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const hasNameChanged = useMemo(() => displayNameEdit.trim() !== displayName, [displayNameEdit, displayName]);
  const calendarLastSynced = calendarStatus?.lastSyncedAt
    ? new Date(calendarStatus.lastSyncedAt).toLocaleString()
    : "Not synced yet";
  const outboxCounts = systemHealth?.indexingOutbox.counts ?? {};
  const userIndexingCounts = indexingStatus?.counts ?? {};
  const environmentChecks: Array<[string, boolean | undefined]> = [
    ["Database URL", systemHealth?.environment.databaseConfigured],
    ["Supabase service", systemHealth?.environment.supabaseConfigured],
    ["Gemini API", systemHealth?.environment.geminiConfigured],
    ["Google OAuth", systemHealth?.environment.googleOAuthConfigured],
  ];
  const schemaChecks = Object.entries({
    ...(systemHealth?.schema.tables ?? {}),
    ...(systemHealth?.schema.indexes ?? {}),
  });
  const formatCounts = (counts: Record<string, number>) => {
    const entries = Object.entries(counts);
    if (entries.length === 0) return "0 jobs";
    return entries.map(([status, count]) => `${status}: ${count}`).join(" · ");
  };
  const formatCalendarEventTime = (event: CalendarEventRecord) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    return `${start.toLocaleString()} - ${end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <DashboardShell
      title="Settings"
      description="Manage your profile, preferences, and application settings."
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ─── Profile Section ─── */}
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/30 dark:shadow-slate-900/40">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Account</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Your Profile</h3>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-2xl font-bold text-white shadow-lg">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    {isUploadingAvatar ? (
                      <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
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
                  </div>
                </div>
              </div>
              {avatarMsg && (
                <p className={`text-xs font-medium ${avatarMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {avatarMsg.text}
                </p>
              )}

              {/* Edit display name */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                    className="shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
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
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                    className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
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
              <a href="/login" className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                Sign in
              </a>
            </div>
          )}
        </section>

        {/* ─── Integrations ─── */}
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-sky-950/20 dark:shadow-slate-900/40">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">Integrations</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Google Calendar</h3>
          </div>

          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Connection</p>
                  <p className={`mt-1 text-lg font-bold ${calendarStatus?.connected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {isLoadingCalendar ? "Checking..." : calendarStatus?.connected ? "Connected" : "Not connected"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Events in DB</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {calendarStatus?.eventCount ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Sync</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {calendarLastSynced}
                  </p>
                </div>
              </div>

              {calendarMsg && (
                <p className={`text-sm font-medium ${calendarMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {calendarMsg.text}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConnectCalendar}
                  disabled={isConnectingCalendar}
                  className="cursor-pointer rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isConnectingCalendar ? "Connecting..." : calendarStatus?.connected ? "Reconnect Calendar" : "Connect Calendar"}
                </button>
                <button
                  type="button"
                  onClick={handleSyncCalendar}
                  disabled={!calendarStatus?.connected || isSyncingCalendar}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {isSyncingCalendar ? "Syncing..." : "Sync Now"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Synced Events</p>
                  <button
                    type="button"
                    onClick={() => void refreshCalendarStatus()}
                    disabled={isLoadingCalendar}
                    className="cursor-pointer text-xs font-semibold text-sky-600 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    {isLoadingCalendar ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {calendarEvents.length > 0 ? (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {calendarEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {event.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {formatCalendarEventTime(event)}
                            </p>
                          </div>
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              Open
                            </a>
                          )}
                        </div>
                        {event.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {calendarStatus?.connected ? "No synced events yet." : "Connect Calendar to load events."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Sign in to connect Google Calendar.</p>
            </div>
          )}
        </section>

        {/* ─── System Health ─── */}
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-cyan-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-cyan-950/20 dark:shadow-slate-900/40">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">System</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Health & Indexing</h3>
            </div>
            <button
              type="button"
              onClick={() => void refreshSystemStatus()}
              disabled={isLoadingSystemStatus}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {isLoadingSystemStatus ? "Checking..." : "Refresh"}
            </button>
          </div>

          {systemStatusMsg && (
            <p className={`mb-4 text-sm font-medium ${systemStatusMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {systemStatusMsg.text}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">API Health</p>
              <p className={`mt-1 text-lg font-bold ${systemHealth?.status === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {systemHealth ? systemHealth.status.toUpperCase() : isLoadingSystemStatus ? "CHECKING" : "UNKNOWN"}
              </p>
              {systemHealth?.checkedAt && (
                <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                  {new Date(systemHealth.checkedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Database</p>
              <p className={`mt-1 text-lg font-bold ${systemHealth?.database.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {systemHealth?.database.ok ? "Connected" : "Needs attention"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Outbox</p>
              <p className={`mt-1 text-lg font-bold ${systemHealth?.indexingOutbox.available ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {systemHealth?.indexingOutbox.available ? "Available" : "Unavailable"}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{formatCounts(outboxCounts)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Environment</p>
              <div className="grid gap-2 text-sm">
                {environmentChecks.map(([label, ok]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 dark:text-slate-400">{label}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"}`}>
                      {ok ? "Configured" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Schema</p>
              <div className="grid gap-2 text-sm">
                {schemaChecks.map(([name, check]) => (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-400">{name}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${check.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"}`}>
                      {check.ok ? "OK" : "Missing"}
                    </span>
                  </div>
                ))}
                {!systemHealth && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No health check loaded yet.</p>
                )}
              </div>
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

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your Indexing Jobs</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{formatCounts(userIndexingCounts)}</p>
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
                  <div key={job.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {job.sourceType} · {job.jobType}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {job.sourceId} · updated {new Date(job.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${job.status === "completed" || job.status === "succeeded" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : job.status === "failed" ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                        {job.status}
                      </span>
                    </div>
                    {job.error && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-rose-600 dark:text-rose-300">{job.error}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      retries {job.retryCount}/{job.maxRetries}
                      {job.lockedAt ? ` · locked ${new Date(job.lockedAt).toLocaleString()}` : ""}
                    </p>
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
          </div>
        </section>

        {/* ─── Appearance ─── */}
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-purple-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-purple-950/20 dark:shadow-slate-900/40">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">Appearance</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Theme & Language</h3>
          </div>

          <div className="space-y-4">
            {/* Theme selector */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${theme === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                      }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language preference */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${responseLang === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800"
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
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/20 dark:shadow-slate-900/40">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Usage</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">AI Token Usage</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Today", value: tokenStats.today.toLocaleString(), sub: "tokens" },
              { label: "This Week", value: tokenStats.week.toLocaleString(), sub: "tokens" },
              { label: "This Month", value: tokenStats.month.toLocaleString(), sub: "tokens" },
              { label: "Queries Today", value: tokenStats.queriesToday.toString(), sub: "searches" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
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
      </div>
    </DashboardShell>
  );
}
