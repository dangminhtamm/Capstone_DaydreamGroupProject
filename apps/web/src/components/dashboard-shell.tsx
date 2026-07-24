"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { BrainLogo } from "@/components/brain-logo";

type DashboardShellProps = {
  children: ReactNode;
  title: string;
  description: string;
};

type SidebarItem = {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  match?: (pathname: string) => boolean;
};

type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

const mainNavItems: SidebarItem[] = [
  {
    href: "/diary",
    label: "Diary",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  {
    href: "/timeline",
    label: "Timeline",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    href: "/summary",
    label: "Summary",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
];

const sidebarSections: SidebarSection[] = [
  {
    label: "Main",
    items: mainNavItems,
  },
  {
    label: "System",
    items: [
      {
        href: "/settings",
        label: "Settings",
        match: (pathname) => pathname === "/settings",
        icon: (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
          </svg>
        ),
      },
    ],
  },
];

// useTheme is now imported from @/contexts/ThemeContext

export function DashboardShell({ children, title, description }: DashboardShellProps) {
  const { user, isAuthenticated, isLoading, signInWithGoogle, signOut } = useAuth();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<"settings" | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dd-sidebar-collapsed") === "true";
  });
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Token usage widget state (Order 2: 3d)
  const [tokenStats, setTokenStats] = useState<{ today: number; week: number; queries: number } | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("dd-token-usage") || "{}");
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayData = stored[todayKey] || { tokens: 0, queries: 0 };
      const now = new Date();
      let weekTokens = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        weekTokens += (stored[key]?.tokens || 0);
      }
      if (todayData.tokens > 0 || weekTokens > 0) {
        setTokenStats({ today: todayData.tokens, week: weekTokens, queries: todayData.queries });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("dd-sidebar-collapsed", sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed]);

  const avatarUrl: string | undefined =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? undefined;
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "User";
  const displayEmail: string = user?.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950" onClick={() => setOpenMenu(null)}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={(e) => { e.stopPropagation(); setMobileSidebarOpen(false); }}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex-shrink-0 border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-700 dark:bg-slate-900 lg:static lg:translate-x-0 ${
        sidebarCollapsed ? "lg:w-20" : "lg:w-64"
      } ${
        mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={`relative border-b border-slate-200 py-4 dark:border-slate-700 ${sidebarCollapsed ? "lg:px-3 px-6" : "px-6"}`}>
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? "lg:justify-center" : "justify-between"}`}>
              <div className={sidebarCollapsed ? "lg:hidden" : ""}>
                <BrainLogo size="sm" variant="badge" showText={true} subText="Second Brain" href="/" />
              </div>
              <div className={`hidden ${sidebarCollapsed ? "lg:block" : ""}`}>
                <BrainLogo size="sm" variant="badge" showText={false} href="/" />
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSidebarCollapsed((value) => !value);
                }}
                className="absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm shadow-slate-200/70 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:shadow-slate-950/40 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/70 dark:hover:text-indigo-300 lg:inline-flex"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg className={`h-3.5 w-3.5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-5 ${sidebarCollapsed ? "lg:px-3 px-4" : "px-4"}`}>
            <Link
              href="/diary"
              onClick={() => setMobileSidebarOpen(false)}
              className={`mb-5 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 dark:shadow-indigo-950/40 ${sidebarCollapsed ? "lg:px-0 px-4" : "px-4"}`}
              title="New Diary"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
              </svg>
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>New Diary</span>
            </Link>

            <div className={sidebarCollapsed ? "space-y-4 lg:space-y-3" : "space-y-5"}>
              {sidebarSections.map((section) => (
                <div key={section.label}>
                  <p className={`mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ${sidebarCollapsed ? "lg:sr-only" : ""}`}>
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = item.match
                        ? item.match(pathname)
                        : pathname === item.href;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.description ? `${item.label} - ${item.description}` : item.label}
                          aria-label={item.label}
                          onClick={() => {
                            setMobileSidebarOpen(false);
                          }}
                          className={`group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-800"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          } ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-3 gap-3" : "gap-3 px-3"}`}
                        >
                          <span className={`shrink-0 transition ${isActive ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"}`}>
                            {item.icon}
                          </span>
                          <span className={`min-w-0 flex-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                            <span className="block truncate">{item.label}</span>
                            {item.description ? (
                              <span className={`mt-0.5 block truncate text-[11px] font-medium ${isActive ? "text-indigo-500 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500"}`}>
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                          {isActive ? (
                            <span className={`h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-300 ${sidebarCollapsed ? "lg:hidden" : ""}`} />
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Token Usage Widget (Order 2: 3d) */}
          {tokenStats && (
            <div className={`mx-4 mb-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/50 p-3 dark:border-slate-700 dark:from-slate-800 dark:to-indigo-950/30 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Token Usage</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Today</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{tokenStats.today.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">This week</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{tokenStats.week.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Queries today</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{tokenStats.queries}</span>
                </div>
              </div>
            </div>
          )}

          {/* User section */}
          <div className={`border-t border-slate-200 py-4 dark:border-slate-700 ${sidebarCollapsed ? "lg:px-3 px-4" : "px-4"}`}>
            {isLoading ? (
              <div className={`flex items-center gap-3 px-2 ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className={`flex-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ) : isAuthenticated ? (
              <div className="space-y-2">
                <div className={`flex items-center gap-3 px-2 ${sidebarCollapsed ? "lg:justify-center" : ""}`} title={displayEmail || displayName}>
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-indigo-100 dark:ring-slate-700"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`flex-1 min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                    <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">{displayEmail}</p>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className={`w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 ${sidebarCollapsed ? "lg:px-0 px-4" : "px-4"}`}
                title="Sign in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className={sidebarCollapsed ? "lg:hidden" : ""}>Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-5 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Hamburger - mobile only */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMobileSidebarOpen(!mobileSidebarOpen); }}
                className="cursor-pointer rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
                aria-label="Toggle sidebar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            </div>

            <div className="relative flex items-center gap-1">
              {/* Settings button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "settings" ? null : "settings"); }}
                className="cursor-pointer rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {/* Settings dropdown */}
              {openMenu === "settings" && (
                <div className="animate-slide-down absolute right-0 top-11 z-20 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/60">
                  {/* Profile section */}
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-indigo-100 dark:ring-indigo-800"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-base font-bold text-white">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-100">{displayName}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{displayEmail || "Not signed in"}</p>
                    </div>
                  </div>

                  <div className="space-y-0.5 p-2">
                    {/* Profile */}
                    <Link
                      href="/settings"
                      onClick={() => setOpenMenu(null)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="flex-1 text-left">Settings</span>
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>

                    {/* Theme toggle */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {isDark ? (
                        <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      )}
                      <span className="flex-1 text-left">Theme</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${isDark ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
                        {isDark ? "Dark" : "Light"}
                      </span>
                    </button>

                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

                    {/* Logout */}
                    <button
                      type="button"
                      onClick={() => { setOpenMenu(null); signOut(); }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="animate-fade-in px-6 py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
