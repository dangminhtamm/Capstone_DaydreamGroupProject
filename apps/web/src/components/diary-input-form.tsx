"use client";

import { useMemo, useState } from "react";
import type { IDiaryDraft } from "@second-brain/shared";

type SaveState = "idle" | "saving" | "success" | "error";

const initialDraft: IDiaryDraft = {
  title: "",
  content: "",
  mood: "good",
};

export function DiaryInputForm() {
  const [draft, setDraft] = useState<IDiaryDraft>(initialDraft);
  const [state, setState] = useState<SaveState>("idle");

  const canSubmit = useMemo(() => {
    return draft.title.trim().length > 0 && draft.content.trim().length > 0;
  }, [draft]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setState("saving");

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setState("success");
      setDraft(initialDraft);
    } catch {
      setState("error");
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
        <label htmlFor="mood" className="mb-2 block text-sm font-medium text-slate-700">
          Mood
        </label>
        <select
          id="mood"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          value={draft.mood}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, mood: event.target.value as IDiaryDraft["mood"] }))
          }
        >
          <option value="great">Great</option>
          <option value="good">Good</option>
          <option value="neutral">Neutral</option>
          <option value="bad">Bad</option>
        </select>
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

        {state === "success" && <p className="text-sm text-emerald-600">Saved (mock).</p>}
        {state === "error" && <p className="text-sm text-rose-600">Save failed.</p>}
      </div>
    </form>
  );
}
