"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { askSearch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

type SearchState = "idle" | "loading" | "success" | "error";

export default function SearchPage() {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question.trim()) return;

    setState("loading");
    setAnswer("");
    setSources([]);
    setErrorMessage("");

    try {
      const accessToken = getAccessToken();
      const result = await askSearch({ question: question.trim() }, accessToken);
      setAnswer(result.answer);
      setSources(result.sources ?? []);
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Search failed. Please try again.");
    }
  }

  return (
    <DashboardShell
      title="AI Search"
      description="Ask a question about your diary entries and get an intelligent, cited answer."
    >
      <div className="max-w-2xl space-y-6">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            id="search-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What have I been thinking about lately?"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={!question.trim() || state === "loading"}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-800 transition-colors"
          >
            {state === "loading" ? "Searching…" : "Ask"}
          </button>
        </form>

        {/* Loading */}
        {state === "loading" && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
            <span className="text-sm text-slate-600">Searching your memories…</span>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Answer */}
        {state === "success" && answer && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Answer</span>
              </div>
              <p className="text-slate-800 leading-relaxed">{answer}</p>
            </div>

            {sources.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sources</p>
                <ul className="space-y-1.5">
                  {sources.map((src, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <span>{src}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty idle state */}
        {state === "idle" && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Ask anything about your diary — your AI will recall and cite relevant entries.</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
