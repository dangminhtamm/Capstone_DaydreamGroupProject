"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createDiaryEntry, type CreateDiaryPayload } from "@/lib/api-client";

type DiaryDraft = {
  title: string;
  content: string;
};

type SaveState = "idle" | "saving" | "success" | "error";

const initialDraft: DiaryDraft = {
  title: "",
  content: "",
};

export function DiaryInputForm() {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [draft, setDraft] = useState<DiaryDraft>(initialDraft);
  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const canSubmit = useMemo(() => {
    return draft.title.trim().length > 0 && draft.content.trim().length > 0;
  }, [draft]);

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!canSubmit) {
      return;
    }

    // Gate: must be signed in to save
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    setShowAuthPrompt(false);
    setState("saving");

    try {
      const accessToken = getAccessToken();
      const payload: CreateDiaryPayload = {
        title: draft.title.trim(),
        content: draft.content.trim(),
      };

      await createDiaryEntry(payload, accessToken);
      setState("success");
      setDraft(initialDraft);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save diary entry");
    }
  }

  const wordCount = useMemo(() => {
    return draft.content.trim().split(/\s+/).filter(Boolean).length;
  }, [draft.content]);

  return (
    <div className="w-full">
      <form className="space-y-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/30 dark:shadow-slate-900/40" onSubmit={onSubmit}>
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Title
          </label>
          <input
            id="title"
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:ring-indigo-900/40"
            placeholder="What happened today?"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="content" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Diary Content
            </label>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{wordCount} words</span>
          </div>
          <textarea
            id="content"
            rows={8}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:ring-indigo-900/40"
            placeholder="Write your day in detail..."
            value={draft.content}
            onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-700">
          <button
            type="submit"
            disabled={!canSubmit || state === "saving"}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0 dark:shadow-indigo-900/30 dark:disabled:bg-slate-600"
          >
            {state === "saving" ? "Saving..." : "Save Diary Entry"}
          </button>

          {state === "success" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Saved successfully
            </span>
          )}
          {state === "error" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-700">
              {errorMessage || "Save failed."}
            </span>
          )}
          {!isAuthenticated && (
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              showAuthPrompt
                ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/30'
                : 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
            }`}>
              <svg className={`h-4 w-4 shrink-0 ${showAuthPrompt ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1">
                <p className={`text-sm font-medium ${showAuthPrompt ? 'text-indigo-900 dark:text-indigo-200' : 'text-amber-800 dark:text-amber-300'}`}>
                  {showAuthPrompt ? 'Sign in to save your diary entry' : 'You\'re exploring as a guest'}
                </p>
                <p className={`mt-0.5 text-xs ${showAuthPrompt ? 'text-indigo-700 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {showAuthPrompt ? 'Your entry is ready — just sign in to keep it!' : 'Feel free to write — sign in when you\'re ready to save.'}
                </p>
              </div>
              <a
                href="/login"
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
                  showAuthPrompt ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Sign in
              </a>
            </div>
          )}
        </div>
      </form>
      <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: "✍️", title: "Write", desc: "Save your thoughts as diary entries." },
          { icon: "🔍", title: "Search", desc: "Ask questions grounded in your memories." },
          { icon: "📊", title: "Summarize", desc: "See writing stats and weekly trends." },
        ].map((step) => (
          <div key={step.title} className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
            <span className="text-xl leading-none">{step.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
