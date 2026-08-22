"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  Check,
  LockKeyhole,
  Paperclip,
  PencilLine,
  Search,
  X,
} from "lucide-react";
import {
  AUDIO_ATTACHMENT_MAX_BYTES,
  isAudioAttachmentMimeType,
  STANDARD_ATTACHMENT_MAX_BYTES,
} from "@second-brain/shared";
import { useAuth } from "@/contexts/AuthContext";
import { clearHomeDraft, readHomeDraft, storeHomeDraft } from "@/lib/home-draft";
import { MOOD_OPTIONS } from "@/lib/mood-meta";
import {
  createDiaryEntry,
  copilotDiaryText,
  getCalendarEvents,
  processDiaryAttachment,
  uploadDiaryAttachment,
  type AttachmentUploadResponse,
  type CalendarEventRecord,
  type CreateDiaryPayload,
  type DiaryMood,
} from "@/lib/api-client";

type DiaryDraft = {
  title: string;
  content: string;
  entryDate: string;
  mood: DiaryMood;
  tags: string[];
};

type SaveState = "idle" | "saving" | "success" | "error";
type AttachmentStatus = "queued" | "uploading" | "extracting" | "indexed" | "pending" | "error";

type AttachmentQueueItem = {
  id: string;
  file: File;
  status: AttachmentStatus;
  message: string;
  attachmentId?: string;
  signedUrl?: string;
  memoryChunkCount?: number;
};

function isAudioFile(file: Pick<File, "type">) {
  return isAudioAttachmentMimeType(file.type);
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDate(isoDate: string, localDate: string) {
  return getLocalDateInputValue(new Date(isoDate)) === localDate;
}

function formatCompactEventTime(event: CalendarEventRecord) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${timeFormat.format(start)}-${timeFormat.format(end)}`;
}

function getAttachmentStatusClass(status: AttachmentStatus) {
  if (status === "indexed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800";
  }

  if (status === "error") {
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800";
  }

  if (status === "uploading" || status === "extracting") {
    return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800";
  }

  return "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800";
}

const initialDraft: DiaryDraft = {
  title: "",
  content: "",
  entryDate: getLocalDateInputValue(),
  mood: "neutral",
  tags: [],
};

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

interface TemplateItem {
  id: string;
  name: string;
  icon: string;
  title: string;
  content: string;
  description: string;
}

const TEMPLATES_EN: TemplateItem[] = [
  {
    id: "brain-dump",
    name: "Brain Dump",
    icon: "💡",
    description: "Capture knowledge & ideas",
    title: "Brain Dump & Knowledge Capture",
    content: [
      "🧠 The biggest lesson I learned today (in one sentence):",
      "- ",
      "",
      "📌 Key facts, quotes, or ideas I want to remember:",
      "- ",
      "",
      "🔗 How can I connect this knowledge to my current projects or goals?",
      "- ",
      "",
      "🔍 Topics I want to explore further in the future:",
      "- ",
    ].join("\n"),
  },
  {
    id: "stoic-reflection",
    name: "Mindful Reflection",
    icon: "🧘",
    description: "Process emotions & thoughts",
    title: "Mindful & Stoic Reflection",
    content: [
      "⛈️ What is weighing on my mind or causing me stress right now?",
      "- ",
      "",
      "⚖️ What is WITHIN my control vs. OUTSIDE my control in this situation?",
      "- Within my control: ",
      "- Outside my control: ",
      "",
      "🌟 What is one positive thing I can focus on despite the challenges?",
      "- ",
      "",
      "🕊️ If I look back at this situation a year from now, what would I tell myself?",
      "- ",
    ].join("\n"),
  },
  {
    id: "five-minute",
    name: "5-Minute Journal",
    icon: "🎯",
    description: "Start & end day with purpose",
    title: "The 5-Minute Setup & Review",
    content: [
      "☀️ MORNING — Setting Intentions",
      "",
      "3 things I am grateful for today:",
      "1. ",
      "2. ",
      "3. ",
      "",
      "The ONE task that will make today a great day:",
      "- ",
      "",
      "An affirmation or mindset I want to carry today:",
      "- ",
      "",
      "🌙 EVENING — Reflection",
      "",
      "The biggest obstacle I faced today and how I handled it:",
      "- ",
      "",
      "One thing I could do better tomorrow:",
      "- ",
    ].join("\n"),
  },
  {
    id: "project-review",
    name: "Project Review",
    icon: "🚀",
    description: "Track progress & blockers",
    title: "Project Progress & Review",
    content: [
      "📈 Progress — What did I accomplish or move forward today?",
      "- ",
      "",
      "🚧 Blockers — What challenges or obstacles did I encounter?",
      "- ",
      "",
      "💡 Insights — Any new ideas, solutions, or 'aha' moments?",
      "- ",
      "",
      "📋 Next Steps — What are my priorities for tomorrow?",
      "- ",
    ].join("\n"),
  },
];

export function DiaryInputForm() {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [draft, setDraft] = useState<DiaryDraft>(initialDraft);
  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [activeCopilotAction, setActiveCopilotAction] = useState("");
  const [attachmentItems, setAttachmentItems] = useState<AttachmentQueueItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const homeDraft = readHomeDraft();
    if (!homeDraft) return;
    setDraft(homeDraft);
  }, []);

  useEffect(() => {
    if (isAuthenticated || (!draft.title.trim() && !draft.content.trim())) return;
    storeHomeDraft(draft);
  }, [draft, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendarPreview() {
      if (!isAuthenticated) {
        setCalendarEvents([]);
        return;
      }

      setIsCalendarLoading(true);
      try {
        const events = await getCalendarEvents(getAccessToken());
        if (!cancelled) setCalendarEvents(events);
      } catch {
        if (!cancelled) setCalendarEvents([]);
      } finally {
        if (!cancelled) setIsCalendarLoading(false);
      }
    }

    void loadCalendarPreview();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated]);

  const activeTemplates = TEMPLATES_EN;

  const linkedCalendarEvents = useMemo(() => {
    return calendarEvents
      .filter((event) => isSameLocalDate(event.startTime, draft.entryDate))
      .slice(0, 3);
  }, [calendarEvents, draft.entryDate]);

  const canSubmit = useMemo(() => {
    return draft.title.trim().length > 0 && draft.content.trim().length > 0 && draft.entryDate.trim().length > 0;
  }, [draft]);

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  function updateAttachmentItem(id: string, update: Partial<AttachmentQueueItem>) {
    setAttachmentItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  function handleAttachmentSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setAttachmentItems((current) => [
      ...current,
      ...selectedFiles.map((file) => {
        const audio = isAudioFile(file);
        const maxBytes = audio ? AUDIO_ATTACHMENT_MAX_BYTES : STANDARD_ATTACHMENT_MAX_BYTES;
        const tooLarge = file.size > maxBytes;

        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          status: tooLarge ? "error" as const : "queued" as const,
          message: tooLarge
            ? `${audio ? "Audio" : "File"} must be ${maxBytes / (1024 * 1024)} MB or smaller`
            : audio
              ? "Ready to upload and transcribe"
              : "Ready to attach",
        };
      }),
    ]);
    event.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachmentItems((current) => current.filter((item) => item.id !== id));
  }

  function addTag(value = tagInput) {
    const normalized = normalizeTag(value);
    if (!normalized) return;

    setDraft((prev) => {
      if (prev.tags.includes(normalized) || prev.tags.length >= 12) return prev;
      return { ...prev, tags: [...prev.tags, normalized] };
    });
    setTagInput("");
  }

  function removeTag(tag: string) {
    setDraft((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }));
  }

  function handleTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }

    if (event.key === "Backspace" && !tagInput && draft.tags.length) {
      setDraft((prev) => ({ ...prev, tags: prev.tags.slice(0, -1) }));
    }
  }

  function getAttachmentMessage(response: AttachmentUploadResponse) {
    if (response.processingError) {
      return `${response.processingError}. Worker will retry later.`;
    }

    if (response.memoryIndexed) {
      return `Indexed ${response.memoryChunkCount} memory chunks`;
    }

    if (response.memoryIndexingStatus === "dead_letter") {
      return "Indexing failed after retries. Requeue from Settings or upload again.";
    }

    if (response.memoryIndexingStatus === "retry") {
      return "Worker hit a temporary error; retry is scheduled automatically.";
    }

    if (response.memoryIndexingStatus === "queued" || response.memoryIndexingStatus === "pending") {
      if (response.attachment.fileType.startsWith("audio/")) {
        return response.extractionStatus === "extracted"
          ? "Transcript ready; queued for memory indexing"
          : "Saved; queued for transcription and memory indexing";
      }
      return response.extractionStatus === "extracted"
        ? "Text extracted; queued for memory indexing"
        : "Saved; queued for text extraction and memory indexing";
    }

    if (response.memoryIndexingStatus === "processing") {
      if (response.attachment.fileType.startsWith("audio/") && response.extractionStatus !== "extracted") {
        return "Audio transcription in progress";
      }
      return response.extractionStatus === "extracted"
        ? "Text extracted; indexing in progress"
        : "Text extraction in progress";
    }

    if (response.memoryIndexingStatus === "failed") {
      return "Attachment indexing failed; try processing it again";
    }

    if (response.extractionStatus === "pending") {
      return "Saved; extraction pending";
    }

    return "Text extracted; waiting for memory indexing";
  }

  function getAttachmentStatus(response: AttachmentUploadResponse): AttachmentStatus {
    if (
      response.processingError ||
      response.memoryIndexingStatus === "failed" ||
      response.memoryIndexingStatus === "dead_letter"
    ) return "error";
    if (response.memoryIndexed || response.memoryIndexingStatus === "succeeded") return "indexed";
    if (response.memoryIndexingStatus === "processing") return "extracting";
    return "pending";
  }

  async function handleCopilotAction(action: string) {
    if (!draft.content.trim()) return;
    
    // Require auth to use Copilot
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    setIsCopilotLoading(true);
    setActiveCopilotAction(action);
    setErrorMessage("");
    setState("idle"); // Clear any previous save status

    try {
      const accessToken = getAccessToken();
      const response = await copilotDiaryText(
        { text: draft.content, action },
        accessToken
      );

      if (!response.result) {
        setErrorMessage("AI returned an empty response. Please try again.");
        return;
      }

      if (action === "continue") {
        setDraft((prev) => ({
          ...prev,
          content: prev.content.trimEnd() + " " + response.result,
        }));
      } else {
        setDraft((prev) => ({
          ...prev,
          content: response.result,
        }));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Copilot request failed");
    } finally {
      setIsCopilotLoading(false);
      setActiveCopilotAction("");
    }
  }

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
        entryDate: new Date(`${draft.entryDate}T12:00:00`).toISOString(),
        mood: draft.mood,
        tags: draft.tags,
      };

      const diaryEntry = await createDiaryEntry(payload, accessToken);

      const queuedAttachments = attachmentItems.filter((item) => item.status === "queued");
      let attachmentHadErrors = false;

      for (const item of queuedAttachments) {
        try {
          updateAttachmentItem(item.id, {
            status: "uploading",
            message: "Uploading to storage",
          });

          const uploadResult = await uploadDiaryAttachment(diaryEntry.id, item.file, accessToken);
          updateAttachmentItem(item.id, {
            attachmentId: uploadResult.attachment.id,
            signedUrl: uploadResult.attachment.signedUrl,
            status: getAttachmentStatus(uploadResult),
            message: getAttachmentMessage(uploadResult),
            memoryChunkCount: uploadResult.memoryChunkCount,
          });

          if (uploadResult.extractionStatus === "pending") {
            const processResult = await processDiaryAttachment(uploadResult.attachment.id, accessToken);
            updateAttachmentItem(item.id, {
              status: getAttachmentStatus(processResult),
              signedUrl: processResult.attachment.signedUrl ?? uploadResult.attachment.signedUrl,
              message: getAttachmentMessage(processResult),
              memoryChunkCount: processResult.memoryChunkCount,
            });
          }
        } catch (attachmentError) {
          attachmentHadErrors = true;
          updateAttachmentItem(item.id, {
            status: "error",
            message: attachmentError instanceof Error ? attachmentError.message : "Attachment upload failed",
          });
        }
      }

      setDraft(initialDraft);
      clearHomeDraft();
      setTagInput("");
      if (attachmentHadErrors) {
        setState("error");
        setErrorMessage("Diary saved, but one or more attachments failed. Check the file status above.");
      } else {
        setState("success");
      }
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save diary entry");
    }
  }

  const wordCount = useMemo(() => {
    return draft.content.trim().split(/\s+/).filter(Boolean).length;
  }, [draft.content]);

  function applyTemplate(template: TemplateItem) {
    if (draft.content.trim() && !window.confirm("This will overwrite your current entry. Are you sure?")) {
      return;
    }
    setDraft((prev) => ({ ...prev, title: template.title, content: template.content }));
    setErrorMessage("");
  }

  return (
    <div className="w-full">
      <form className="enterprise-card space-y-4 p-5" onSubmit={onSubmit}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              id="title"
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              placeholder="What happened today?"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="entryDate" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Date
            </label>
            <input
              id="entryDate"
              type="date"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              value={draft.entryDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, entryDate: event.target.value }))}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Mood
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MOOD_OPTIONS.map((option) => {
              const isSelected = draft.mood === option.value;
              const MoodIcon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, mood: option.value }))}
                  className={`min-h-14 rounded-lg border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? `${option.className} ring-2 ring-indigo-300 dark:ring-indigo-600`
                      : "border-slate-200 bg-white/70 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <MoodIcon className="h-4 w-4" aria-hidden="true" />
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs opacity-75">{option.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="tags" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tags
            </label>
            <span className="text-xs text-slate-400 dark:text-slate-500">{draft.tags.length}/12</span>
          </div>
          <div className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-900/40">
            <div className="flex flex-wrap items-center gap-2">
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  className="status-badge"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full text-indigo-400 transition hover:text-indigo-700 dark:hover:text-indigo-100"
                    aria-label={`Remove ${tag} tag`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                id="tags"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={() => addTag()}
                maxLength={32}
                placeholder={draft.tags.length ? "Add another tag" : "project, health, meeting"}
                className="min-w-40 flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {(isCalendarLoading || linkedCalendarEvents.length > 0) && (
          <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-800 dark:text-sky-200">
              <span className="font-semibold">Calendar context</span>
              {isCalendarLoading ? (
                <span className="text-sky-600 dark:text-sky-300">Loading synced events...</span>
              ) : (
                linkedCalendarEvents.map((event) => (
                  <a
                    key={event.id}
                    href={event.htmlLink ?? undefined}
                    target={event.htmlLink ? "_blank" : undefined}
                    rel={event.htmlLink ? "noopener noreferrer" : undefined}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-100 bg-white px-2.5 py-1 font-medium text-sky-700 transition hover:bg-white dark:border-sky-900/60 dark:bg-slate-950 dark:text-sky-200"
                  >
                    <span className="truncate">{event.title}</span>
                    <span className="shrink-0 text-sky-500 dark:text-sky-300">{formatCompactEventTime(event)}</span>
                  </a>
                ))
              )}
            </div>
          </div>
        )}

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
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
            placeholder="Write your day in detail..."
            value={draft.content}
            onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
          />
          
          {/* AI Copilot Toolbar */}
          {draft.content.trim().length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('continue')}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === 'continue' ? 'Thinking...' : 'Continue'}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('fix_grammar')}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === 'fix_grammar' ? 'Fixing...' : 'Fix Grammar'}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('expand')}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === 'expand' ? 'Expanding...' : 'Expand'}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('summarize')}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === 'summarize' ? 'Summarizing...' : 'Summarize'}
              </button>
            </div>
          )}
        </div>

        <input
          id="attachments"
          type="file"
          multiple
          accept=".txt,.pdf,.png,.jpg,.jpeg,.doc,.docx,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,text/plain,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/aac,audio/flac"
          className="sr-only"
          onChange={handleAttachmentSelection}
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
          <button
            type="submit"
            disabled={!canSubmit || state === "saving"}
            className="action-primary px-5 disabled:cursor-not-allowed"
          >
            {state === "saving" ? "Saving..." : "Save Diary Entry"}
          </button>

          <label
            htmlFor="attachments"
            className="action-secondary px-4"
          >
            <Paperclip className="h-4 w-4 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
            Attach
            {attachmentItems.length > 0 && (
              <span className="status-badge">
                {attachmentItems.length}
              </span>
            )}
          </label>

          <span className="text-xs text-slate-400 dark:text-slate-500">
            PDF, image, Word, text (5 MB) or audio (20 MB)
          </span>

          {state === "success" && (
            <span className="status-badge status-badge-success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Saved successfully
            </span>
          )}
          {state === "error" && (
            <span className="status-badge status-badge-danger">
              {errorMessage || "Save failed."}
            </span>
          )}
          {!isAuthenticated && (
            <div className="flex items-center gap-3 rounded-lg bg-indigo-50/70 px-4 py-3 transition-all dark:bg-indigo-950/30">
              <LockKeyhole className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  {showAuthPrompt ? 'Sign in to save your diary entry' : 'You\'re exploring as a guest'}
                </p>
                <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                  {showAuthPrompt ? 'Your entry is ready — just sign in to keep it!' : 'Feel free to write — sign in when you\'re ready to save.'}
                </p>
              </div>
              <a
                href="/login"
                className="action-primary shrink-0 min-h-10 px-3 text-xs"
              >
                Sign in
              </a>
            </div>
          )}
        </div>

        {attachmentItems.length ? (
          <div className="space-y-2">
            {attachmentItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{item.file.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {(item.file.size / 1024).toFixed(1)} KB · {item.file.type || "unknown type"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`status-badge ${getAttachmentStatusClass(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.message}
                  </span>
                  {item.signedUrl ? (
                    <a
                      href={item.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                    >
                      Open
                    </a>
                  ) : null}
                  {item.status === "queued" ? (
                    <button
                      type="button"
                      onClick={() => removeAttachment(item.id)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </form>

      <details className="mt-5 enterprise-card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span>Quick writing templates</span>
        </summary>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {activeTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="group flex w-[170px] shrink-0 cursor-pointer flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
            >
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {tpl.name}
              </span>
              <span className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                {tpl.description}
              </span>
            </button>
          ))}
        </div>
      </details>

      <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: (<PencilLine className="h-5 w-5 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />),
            title: "Write", desc: "Save your thoughts as diary entries."
          },
          {
            icon: (<Search className="h-5 w-5 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />),
            title: "Search", desc: "Ask questions grounded in your memories."
          },
          {
            icon: (<ChartNoAxesColumnIncreasing className="h-5 w-5 text-pink-500 dark:text-pink-300" aria-hidden="true" />),
            title: "Summarize", desc: "See writing stats and weekly trends."
          },
        ].map((step) => (
          <div key={step.title} className="enterprise-panel flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 shrink-0">{step.icon}</span>
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
