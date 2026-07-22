"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DiaryMood } from "@/lib/api-client";

const MOOD_OPTIONS: Array<{
  value: DiaryMood;
  label: string;
  className: string;
}> = [
  {
    value: "great",
    label: "Great",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    value: "good",
    label: "Good",
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  },
  {
    value: "neutral",
    label: "Neutral",
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200",
  },
  {
    value: "bad",
    label: "Bad",
    className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  },
];

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

type EditDiaryModalProps = {
  isOpen: boolean;
  initialTitle: string;
  initialContent: string;
  initialMood?: DiaryMood | null;
  initialTags?: string[];
  isLoading?: boolean;
  onSave: (data: { title: string; content: string; mood: DiaryMood; tags: string[] }) => void;
  onCancel: () => void;
};

export function EditDiaryModal({
  isOpen,
  initialTitle,
  initialContent,
  initialMood = "neutral",
  initialTags = [],
  isLoading = false,
  onSave,
  onCancel,
}: EditDiaryModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [mood, setMood] = useState<DiaryMood>(initialMood ?? "neutral");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with external state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setContent(initialContent);
      setMood(initialMood ?? "neutral");
      setTags(initialTags);
      setTagInput("");
    }
  }, [isOpen, initialTitle, initialContent, initialMood, initialTags]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen || !mounted) return null;

  const canSave = title.trim().length > 0 && content.trim().length > 0;

  function addTag(value = tagInput) {
    const normalized = normalizeTag(value);
    if (!normalized || tags.includes(normalized) || tags.length >= 12) {
      setTagInput("");
      return;
    }

    setTags((current) => [...current, normalized]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function handleTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }

    if (event.key === "Backspace" && !tagInput && tags.length) {
      setTags((current) => current.slice(0, -1));
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!isLoading) onCancel(); }}
      />

      {/* Modal */}
      <div className="animate-modal-in relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Diary Entry</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
            />
          </div>
          <div>
            <label htmlFor="edit-content" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Content
            </label>
            <textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
            />
          </div>
          <div>
            <p className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mood
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOOD_OPTIONS.map((option) => {
                const isSelected = mood === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setMood(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      isSelected
                        ? `${option.className} ring-2 ring-indigo-300 dark:ring-indigo-600`
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-indigo-900/20"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="edit-tags" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tags
            </label>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-900/40">
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800"
                  >
                    #{tag}
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => removeTag(tag)}
                      className="rounded-full text-indigo-400 transition hover:text-indigo-700 disabled:opacity-50 dark:hover:text-indigo-100"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  id="edit-tags"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={() => addTag()}
                  disabled={isLoading}
                  maxLength={32}
                  placeholder={tags.length ? "Add another tag" : "project, health, meeting"}
                  className="min-w-32 flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave || isLoading}
            onClick={() => onSave({ title: title.trim(), content: content.trim(), mood, tags })}
            className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {isLoading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
