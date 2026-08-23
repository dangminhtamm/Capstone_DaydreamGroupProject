"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PencilLine,
  Plus,
  Search,
  Settings,
  Sun,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarState } from "@/contexts/SidebarContext";
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
  icon: LucideIcon;
  accent: "cyan" | "indigo" | "pink";
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
    icon: PencilLine,
    accent: "cyan",
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    accent: "indigo",
  },
  {
    href: "/timeline",
    label: "Timeline",
    icon: Clock3,
    accent: "pink",
  },
  {
    href: "/summary",
    label: "Summary",
    icon: ChartNoAxesColumnIncreasing,
    accent: "indigo",
  },
];

const sidebarMainNavItems: SidebarItem[] = [
  {
    href: "/",
    label: "Today",
    icon: CalendarDays,
    accent: "indigo",
  },
  ...mainNavItems,
];

const navAccentStyles = {
  cyan: {
    active: "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900/60",
    icon: "text-cyan-600 dark:text-cyan-300",
    dot: "bg-cyan-500 dark:bg-cyan-300",
    mobile: "text-cyan-700 dark:text-cyan-300",
    pill: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300",
  },
  indigo: {
    active: "bg-indigo-50 text-indigo-800 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/60",
    icon: "text-indigo-600 dark:text-indigo-300",
    dot: "bg-indigo-500 dark:bg-indigo-300",
    mobile: "text-indigo-700 dark:text-indigo-300",
    pill: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300",
  },
  pink: {
    active: "bg-pink-50 text-pink-800 ring-pink-100 dark:bg-pink-950/40 dark:text-pink-200 dark:ring-pink-900/60",
    icon: "text-pink-600 dark:text-pink-300",
    dot: "bg-pink-500 dark:bg-pink-300",
    mobile: "text-pink-700 dark:text-pink-300",
    pill: "bg-pink-50 text-pink-600 dark:bg-pink-950/60 dark:text-pink-300",
  },
} as const;

const sidebarSections: SidebarSection[] = [
  {
    label: "Main",
    items: sidebarMainNavItems,
  },
  {
    label: "System",
    items: [
      {
        href: "/settings",
        label: "Settings",
        accent: "indigo",
        match: (pathname) => pathname === "/settings",
        icon: Settings,
      },
    ],
  },
];

// useTheme is now imported from @/contexts/ThemeContext

export function DashboardShell({ children, title, description }: DashboardShellProps) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<"settings" | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileSidebarToggleRef = useRef<HTMLButtonElement>(null);
  const wasMobileSidebarOpen = useRef(false);
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebarState();
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
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => {
      setIsDesktopViewport(mediaQuery.matches);
      if (mediaQuery.matches) setMobileSidebarOpen(false);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (isDesktopViewport) {
      wasMobileSidebarOpen.current = false;
      return;
}
    if (!mobileSidebarOpen) {
      if (wasMobileSidebarOpen.current) mobileSidebarToggleRef.current?.focus();
      wasMobileSidebarOpen.current = false;
      return;
    }

    wasMobileSidebarOpen.current = true;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const getFocusableElements = () => Array.from(
      sidebar.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    getFocusableElements()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileSidebarOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = getFocusableElements();
      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDesktopViewport, mobileSidebarOpen]);

  const avatarUrl: string | undefined =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? undefined;
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "User";
  const displayEmail: string = user?.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f8fb] dark:bg-slate-950" onClick={() => setOpenMenu(null)}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={(e) => { e.stopPropagation(); setMobileSidebarOpen(false); }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        aria-hidden={!isDesktopViewport && !mobileSidebarOpen}
        inert={!isDesktopViewport && !mobileSidebarOpen ? true : undefined}
        className={`fixed inset-y-0 left-0 z-30 w-64 flex-shrink-0 border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 lg:static lg:translate-x-0 ${
        sidebarCollapsed ? "lg:w-20" : "lg:w-64"
      } ${
        mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={`relative border-b border-slate-200 py-3 dark:border-slate-800 ${sidebarCollapsed ? "lg:px-3 px-5" : "px-5"}`}>
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
                className="absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 lg:inline-flex"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <ChevronLeft className={`h-3.5 w-3.5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-4 ${sidebarCollapsed ? "lg:px-3 px-3" : "px-3"}`}>
            <Link
              href="/diary"
              onClick={() => setMobileSidebarOpen(false)}
              className={`action-primary mb-4 w-full ${sidebarCollapsed ? "lg:px-0 px-4" : "px-4"}`}
              title="New Diary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>New Diary</span>
            </Link>

            <div className={sidebarCollapsed ? "space-y-4 lg:space-y-3" : "space-y-5"}>
              {sidebarSections.map((section) => (
                <div key={section.label}>
                  <p className={`mb-2 px-2 text-xs font-semibold text-slate-400 dark:text-slate-500 ${sidebarCollapsed ? "lg:sr-only" : ""}`}>
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = item.match
                        ? item.match(pathname)
                        : pathname === item.href;
                      const ItemIcon = item.icon;
                      const accentStyle = navAccentStyles[item.accent];

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.description ? `${item.label} - ${item.description}` : item.label}
                          aria-label={item.label}
                          onClick={() => {
                            setMobileSidebarOpen(false);
                          }}
                          className={`group flex items-center rounded-lg py-2 text-sm font-medium transition-all ${
                            isActive
                              ? `${accentStyle.active} ring-1`
                              : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                          } ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-2 gap-3" : "gap-3 px-2"}`}
                        >
                          <span className={`shrink-0 transition ${isActive ? accentStyle.icon : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"}`}>
                            <ItemIcon className="h-5 w-5" aria-hidden="true" />
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
                            <span className={`h-1.5 w-1.5 rounded-full ${accentStyle.dot} ${sidebarCollapsed ? "lg:hidden" : ""}`} />
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
            <div className={`mx-3 mb-3 enterprise-panel p-3 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">Token usage</span>
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
          <div className={`border-t border-slate-200 py-3 dark:border-slate-800 ${sidebarCollapsed ? "lg:px-3 px-3" : "px-3"}`}>
            {isLoading ? (
              <div className={`flex items-center gap-3 px-2 ${sidebarCollapsed ? "lg:justify-center" : ""}`}>
                <div className="skeleton-line h-8 w-8 rounded-full" />
                <div className={`flex-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                  <div className="skeleton-line h-4 w-20" />
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold dark:bg-slate-700">
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
                className={`action-primary w-full ${sidebarCollapsed ? "lg:px-0 px-4" : "px-4"}`}
                title="Sign in"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span className={sidebarCollapsed ? "lg:hidden" : ""}>Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* Hamburger - mobile only */}
              <button
                ref={mobileSidebarToggleRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setMobileSidebarOpen(!mobileSidebarOpen); }}
                className="action-quiet cursor-pointer p-2 lg:hidden"
                aria-label={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-controls="app-sidebar"
                aria-expanded={mobileSidebarOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-1">
              {/* Settings button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "settings" ? null : "settings"); }}
                className="action-quiet cursor-pointer p-2"
                aria-label="Settings"
              >
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </button>

              {/* Settings dropdown */}
              {openMenu === "settings" && (
                <div className="animate-slide-down absolute right-0 top-11 z-20 w-80 enterprise-card bg-white dark:bg-slate-950">
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white dark:bg-slate-700">
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
                      className="action-quiet flex w-full justify-start px-3"
                    >
                      <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <span className="flex-1 text-left">Settings</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    </Link>

                    {/* Theme toggle */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="action-quiet flex w-full cursor-pointer justify-start px-3"
                    >
                      {isDark ? (
                        <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      ) : (
                        <Moon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      )}
                      <span className="flex-1 text-left">Theme</span>
                      <span className="status-badge">
                        {isDark ? "Dark" : "Light"}
                      </span>
                    </button>

                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />

                    {/* Logout */}
                    <button
                      type="button"
                      onClick={() => { setOpenMenu(null); signOut(); }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="animate-fade-in px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-5">
          {children}
        </div>
      </main>

      {!mobileSidebarOpen ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
          aria-label="Primary navigation"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid h-16 grid-cols-4 px-2">
            {mainNavItems.map((item) => {
              const isActive = item.match ? item.match(pathname) : pathname === item.href;
              const ItemIcon = item.icon;
              const accentStyle = navAccentStyles[item.accent];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    isActive
                      ? accentStyle.mobile
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  <span className={`flex h-7 w-10 items-center justify-center rounded-lg transition-colors ${
                    isActive ? accentStyle.pill : ""
                  }`}>
                    <ItemIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
