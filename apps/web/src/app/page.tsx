"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Home() {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm">
              DD
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">DayDreamer</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="cursor-pointer rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
              <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</span>
                <Link
                  href="/diary"
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors dark:bg-indigo-600 dark:hover:bg-indigo-500"
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
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-slate-900 leading-tight dark:text-slate-100">
            Your Personal
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400"> Second Brain</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto dark:text-slate-400">
            Capture your thoughts, track your mood, and build a timeline of your life.
            DayDreamer helps you remember what matters most.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/diary"
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40"
                >
                  Create New Entry
                </Link>
                <Link
                  href="/timeline"
                  className="px-6 py-3 bg-white text-slate-900 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  View Timeline
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40"
                >
                  Get Started Free
                </Link>
                <button
                  onClick={signInWithGoogle}
                  className="flex cursor-pointer items-center gap-3 px-6 py-3 bg-white text-slate-900 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
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
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-md hover:border-indigo-200 dark:bg-slate-800/60 dark:border-slate-700 dark:shadow-slate-900/40 dark:hover:border-indigo-500/50">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4 dark:bg-indigo-900/50">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Daily Diary</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Capture your thoughts and experiences with our intuitive diary interface.</p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-md hover:border-purple-200 dark:bg-slate-800/60 dark:border-slate-700 dark:shadow-slate-900/40 dark:hover:border-purple-500/50">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 dark:bg-purple-900/50">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Mood Tracking</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Track your emotional journey and identify patterns over time.</p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-md hover:border-emerald-200 dark:bg-slate-800/60 dark:border-slate-700 dark:shadow-slate-900/40 dark:hover:border-emerald-500/50">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4 dark:bg-emerald-900/50">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Timeline View</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Browse your memories in a beautiful, chronological timeline.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
