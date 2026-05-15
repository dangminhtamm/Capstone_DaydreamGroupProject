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
    return draft.title.trim().length > 0 && draft.content.trim().length > 0 && isAuthenticated;
  }, [draft, isAuthenticated]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!canSubmit) {
      return;
    }

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

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          placeholder="What happened today?"
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="content" className="mb-2 block text-sm font-medium text-slate-700">
          Diary Content
        </label>
        <textarea
          id="content"
          rows={7}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          placeholder="Write your day in detail..."
          value={draft.content}
          onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || state === "saving"}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Saving..." : "Save Diary"}
        </button>

        {state === "success" && <p className="text-sm text-emerald-600">Diary saved successfully!</p>}
        {state === "error" && <p className="text-sm text-rose-600">{errorMessage || "Save failed."}</p>}
        {!isAuthenticated && <p className="text-sm text-amber-600">Please login to save diary entries.</p>}
      </div>
    </form>
  );
}
