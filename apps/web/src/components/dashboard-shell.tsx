"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

type DashboardShellProps = {
  children: ReactNode;
  title: string;
  description: string;
};

const navItems = [
  { 
    href: "/diary", 
    label: "Diary Input",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
  { 
    href: "/search", 
    label: "Search",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
];

// useTheme is now imported from @/contexts/ThemeContext

export function DashboardShell({ children, title, description }: DashboardShellProps) {
  const { user, isAuthenticated, isLoading, signInWithGoogle, signOut } = useAuth();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<"notifications" | "settings" | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex-shrink-0 border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 lg:static lg:translate-x-0 ${
        mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-700">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-md">
                D
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide dark:text-slate-400">DayDreamer</p>
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Second Brain</h1>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-700">
            {isLoading ? (
              <div className="flex items-center gap-3 px-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ) : isAuthenticated ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-2">
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">{displayEmail}</p>
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="w-full cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign in
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
              {/* Notification button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "notifications" ? null : "notifications"); }}
                className="relative cursor-pointer rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
              </button>

              {/* Settings button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "settings" ? null : "settings"); }}
                className="cursor-pointer rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Notification dropdown */}
              {openMenu === "notifications" && (
                <div className="animate-slide-down absolute right-12 top-11 z-20 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/60">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-950 dark:text-slate-100">Notifications</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">App activity & tips</p>
                  </div>
                  <div className="space-y-1 p-2">
                    <Link
                      href="/search"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Memory Search ready</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ask questions about your diary and get AI-grounded answers.</p>
                      </div>
                    </Link>
                    <Link
                      href="/diary"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Write today's diary</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">New entries are indexed into your memory for search and summary.</p>
                      </div>
                    </Link>
                    <Link
                      href="/summary"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Summary dashboard</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">View writing stats, daily & weekly trends from your entries.</p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}

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
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="flex-1 text-left">Profile</span>
                      <span className="text-xs text-slate-400">Coming soon</span>
                    </button>

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
