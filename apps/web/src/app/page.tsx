"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { BrainLogo } from "@/components/brain-logo";

export default function Home() {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorDescription = params.get("error_description");
    const errorCode = params.get("error_code");

    if (errorDescription) {
      setAuthError(errorCode ? `${errorCode}: ${errorDescription}` : errorDescription);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f8fb] dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <BrainLogo size="sm" variant="badge" showText={true} href="/" />

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="action-quiet cursor-pointer p-2"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {isLoading ? (
              <div className="skeleton-line h-8 w-8 rounded-full" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</span>
                <Link
                  href="/diary"
                  className="action-primary"
                >
                  Go to App
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="action-primary"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-6 py-16">
        {authError && (
          <div className="mx-auto mb-8 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
            {authError}
          </div>
        )}

        <div className="text-center">
          <h1 className="text-4xl font-semibold leading-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
            Your Personal
            <span className="text-indigo-600 dark:text-indigo-400"> Second Brain</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Capture your thoughts, track your mood, and build a timeline of your life.
            DayDreamer helps you remember what matters most.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/diary"
                  className="action-primary px-5"
                >
                  Create New Entry
                </Link>
                <Link
                  href="/timeline"
                  className="action-secondary px-5"
                >
                  View Timeline
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="action-primary px-5"
                >
                  Get Started Free
                </Link>
                <button
                  onClick={signInWithGoogle}
                  className="action-secondary cursor-pointer px-5"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              </>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/diary" className="group enterprise-card p-5 transition hover:border-indigo-200 dark:hover:border-indigo-800">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Daily Diary</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Capture your thoughts and experiences with our intuitive diary interface.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100 dark:text-indigo-400">Try it out →</span>
          </Link>

          <Link href="/search" className="group enterprise-card p-5 transition hover:border-purple-200 dark:hover:border-purple-800">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-purple-100 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Search</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Ask questions and get answers grounded in your saved memories.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 opacity-0 transition group-hover:opacity-100 dark:text-purple-400">Try it out →</span>
          </Link>

          <Link href="/timeline" className="group enterprise-card p-5 transition hover:border-emerald-200 dark:hover:border-emerald-800">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Timeline View</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Browse your memories in a beautiful, chronological timeline.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 opacity-0 transition group-hover:opacity-100 dark:text-emerald-400">Try it out →</span>
          </Link>

          <Link href="/summary" className="group enterprise-card p-5 transition hover:border-amber-200 dark:hover:border-amber-800">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Summary Dashboard</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">See your writing stats, streaks, and activity trends at a glance.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 opacity-0 transition group-hover:opacity-100 dark:text-amber-400">Try it out →</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
