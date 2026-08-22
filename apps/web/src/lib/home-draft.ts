import type { DiaryMood } from "@/lib/api-client";

export const HOME_DRAFT_STORAGE_KEY = "daydreamer-home-draft-v1";

export type HomeDraft = {
  title: string;
  content: string;
  entryDate: string;
  mood: DiaryMood;
  tags: string[];
};

export function buildHomeDraft(content: string): HomeDraft {
  const trimmedContent = content.trim();
  const firstLine = trimmedContent.split(/\n|[.!?](?:\s|$)/)[0]?.trim() || "A new memory";

  return {
    title: firstLine.slice(0, 80),
    content: trimmedContent,
    entryDate: new Date().toISOString().slice(0, 10),
    mood: "neutral",
    tags: [],
  };
}

export function readHomeDraft(): HomeDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(HOME_DRAFT_STORAGE_KEY);
    if (!rawDraft) return null;
    const draft = JSON.parse(rawDraft) as Partial<HomeDraft>;
    if (typeof draft.content !== "string" || !draft.content.trim()) return null;

    return {
      title: typeof draft.title === "string" && draft.title.trim() ? draft.title : "A new memory",
      content: draft.content,
      entryDate: typeof draft.entryDate === "string" ? draft.entryDate : new Date().toISOString().slice(0, 10),
      mood: ["great", "good", "neutral", "bad"].includes(draft.mood ?? "")
        ? draft.mood as DiaryMood
        : "neutral",
      tags: Array.isArray(draft.tags) ? draft.tags.filter((tag): tag is string => typeof tag === "string") : [],
    };
  } catch {
    return null;
  }
}

export function writeHomeDraft(content: string) {
  const draft = buildHomeDraft(content);
  storeHomeDraft(draft);
  return draft;
}

export function storeHomeDraft(draft: HomeDraft) {
  window.localStorage.setItem(HOME_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearHomeDraft() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(HOME_DRAFT_STORAGE_KEY);
  }
}
