"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "@second-brain/shared";
import {
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Inbox,
  Music2,
  Paperclip,
  PencilLine,
  Trash2,
  X,
} from "lucide-react";
import { EditDiaryModal } from "./edit-diary-modal";
import { ConfirmDialog } from "./confirm-dialog";
import type { DiaryAttachment, DiaryCalendarEvent, DiaryMood, UpdateDiaryPayload } from "@/lib/api-client";
import { MOOD_META } from "@/lib/mood-meta";

type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  mood?: DiaryMood | null;
  tags?: string[];
  attachments?: Array<string | DiaryAttachment>;
  calendarEvents?: DiaryCalendarEvent[];
  entryDate?: Date | string;
  createdAt: Date | string;
  updatedAt?: Date | string;
};

type TimelineListProps = {
  entries: DiaryEntry[];
  onUpdate?: (id: string, payload: UpdateDiaryPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onLoadAttachmentAudio?: (attachmentId: string) => Promise<Blob>;
  isAdmin?: boolean;
};

type AudioPlaybackState = "loading" | "ready" | "retrying" | "error";

type TimelineGroup = {
  key: string;
  label: string;
  items: Array<{ entry: DiaryEntry; index: number }>;
};

const PAGE_SIZE = 5;

function isAttachmentObject(value: string | DiaryAttachment): value is DiaryAttachment {
  return typeof value === "object" && value !== null;
}

function getAttachmentHref(attachment: string | DiaryAttachment) {
  return isAttachmentObject(attachment) ? attachment.signedUrl : attachment;
}

function getAttachmentLabel(attachment: string | DiaryAttachment, index: number) {
  if (!isAttachmentObject(attachment)) return `File ${index + 1}`;
  return attachment.fileName || `File ${index + 1}`;
}

function getAttachmentStatus(attachment: string | DiaryAttachment) {
  if (!isAttachmentObject(attachment)) return "linked";
  if (attachment.indexingStatus === "succeeded") return "indexed";
  if (attachment.indexingStatus === "processing") return "processing";
  if (attachment.indexingStatus === "retry") return "retry";
  if (attachment.indexingStatus === "dead_letter" || attachment.indexingStatus === "failed") return "failed";
  return attachment.extractionStatus === "extracted" ? "queued" : "extracting";
}

function isAudioAttachment(attachment: string | DiaryAttachment): attachment is DiaryAttachment {
  return isAttachmentObject(attachment) && attachment.fileType.startsWith("audio/");
}

function getStatusTextClass(status: string) {
  if (status === "indexed") {
    return "text-emerald-700 dark:text-emerald-300";
  }

  if (status === "failed") {
    return "text-rose-700 dark:text-rose-300";
  }

  if (status === "processing") {
    return "text-sky-700 dark:text-sky-300";
  }

  return "text-amber-700 dark:text-amber-300";
}

function getIndexStatusLabel(status: string) {
  if (status === "indexed") return "Indexed for AI";
  if (status === "processing") return "Indexing";
  if (status === "retry") return "Index retry";
  if (status === "failed") return "Index failed";
  if (status === "queued") return "Queued for index";
  if (status === "extracting") return "Extracting";
  return "Linked";
}

function formatEventTime(event: DiaryCalendarEvent) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function getEntryActivityDate(entry: DiaryEntry, isAdmin: boolean) {
  return isAdmin ? entry.entryDate ?? entry.createdAt : entry.createdAt;
}

function isDifferentTimestamp(first: Date | string, second: Date | string) {
  return new Date(first).getTime() !== new Date(second).getTime();
}

function formatDiaryDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEntryTime(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimelineGroup(value: Date | string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { key: "earlier", label: "Earlier" };

  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (day.getTime() === today.getTime()) return { key: "today", label: "Today" };
  if (day.getTime() === yesterday.getTime()) return { key: "yesterday", label: "Yesterday" };

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  if (day >= weekStart && day < nextWeekStart) return { key: "this-week", label: "This week" };

  return {
    key: `${date.getFullYear()}-${date.getMonth()}`,
    label: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes < 1) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatDuration(seconds?: number) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function getAttachmentKind(attachment: string | DiaryAttachment) {
  if (!isAttachmentObject(attachment)) return "file";
  if (attachment.fileType.startsWith("audio/")) return "audio";
  if (attachment.fileType.startsWith("image/")) return "image";
  if (attachment.fileType === "application/pdf") return "pdf";
  if (attachment.fileType.includes("word") || attachment.fileType.includes("document")) return "document";
  if (attachment.fileType.startsWith("text/")) return "text";
  return "file";
}

function getAttachmentTypeLabel(attachment: string | DiaryAttachment) {
  if (!isAttachmentObject(attachment)) return "File";
  const extension = attachment.fileName.split(".").pop();
  if (extension && extension !== attachment.fileName && extension.length <= 5) return extension.toUpperCase();
  const subtype = attachment.fileType.split("/").pop();
  return subtype ? subtype.replace("vnd.openxmlformats-officedocument.", "").toUpperCase() : "File";
}

function AttachmentTypeIcon({ kind }: { kind: ReturnType<typeof getAttachmentKind> }) {
  const className = "h-5 w-5";

  if (kind === "audio") {
    return <Music2 className={className} aria-hidden="true" />;
  }
  if (kind === "image") {
    return <ImageIcon className={className} aria-hidden="true" />;
  }
  if (kind === "pdf" || kind === "document" || kind === "text") {
    return <FileText className={className} aria-hidden="true" />;
  }
  return <Paperclip className={className} aria-hidden="true" />;
}

function getAttachmentIconClass(kind: ReturnType<typeof getAttachmentKind>) {
  if (kind === "audio") return "bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300";
  if (kind === "image") return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300";
  if (kind === "pdf") return "bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300";
  if (kind === "document") return "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export function TimelineList({
  entries,
  onUpdate,
  onDelete,
  onLoadAttachmentAudio,
  isAdmin = false,
}: TimelineListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());
  const [attachmentSizes, setAttachmentSizes] = useState<Record<string, number>>({});
  const [audioPlaybackStates, setAudioPlaybackStates] = useState<Record<string, AudioPlaybackState>>({});
  const [audioPlaybackUrls, setAudioPlaybackUrls] = useState<Record<string, string>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioCurrentTimes, setAudioCurrentTimes] = useState<Record<string, number>>({});
  const loadingAudioIds = useRef(new Set<string>());
  const audioObjectUrls = useRef<Record<string, string>>({});
  const requestedAttachmentSizeUrls = useRef(new Set<string>());
  const audioElements = useRef<Record<string, HTMLAudioElement | null>>({});
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [currentPage, entries]);
  const groupedPaginatedEntries = useMemo<TimelineGroup[]>(() => {
    const groups: TimelineGroup[] = [];
    const groupsByKey = new Map<string, TimelineGroup>();

    paginatedEntries.forEach((entry, index) => {
      const groupMeta = getTimelineGroup(getEntryActivityDate(entry, isAdmin));
      let group = groupsByKey.get(groupMeta.key);
      if (!group) {
        group = { ...groupMeta, items: [] };
        groupsByKey.set(groupMeta.key, group);
        groups.push(group);
      }
      group.items.push({ entry, index });
    });

    return groups;
  }, [isAdmin, paginatedEntries]);

  const loadAttachmentAudio = useCallback(async (
    attachment: DiaryAttachment,
    retrying = false,
  ) => {
    if (loadingAudioIds.current.has(attachment.id)) return;
    if (!onLoadAttachmentAudio) {
      setAudioPlaybackStates((current) => ({ ...current, [attachment.id]: "error" }));
      return;
    }

    loadingAudioIds.current.add(attachment.id);
    setAudioPlaybackStates((current) => ({
      ...current,
      [attachment.id]: retrying ? "retrying" : "loading",
    }));

    try {
      const content = await onLoadAttachmentAudio(attachment.id);
      const objectUrl = URL.createObjectURL(content);
      const previousUrl = audioObjectUrls.current[attachment.id];
      audioObjectUrls.current[attachment.id] = objectUrl;
      if (previousUrl) URL.revokeObjectURL(previousUrl);

      setAttachmentSizes((current) => ({ ...current, [attachment.id]: content.size }));
      setAudioPlaybackUrls((current) => ({ ...current, [attachment.id]: objectUrl }));
      setAudioPlaybackStates((current) => ({ ...current, [attachment.id]: "loading" }));
    } catch {
      setAudioPlaybackStates((current) => ({ ...current, [attachment.id]: "error" }));
    } finally {
      loadingAudioIds.current.delete(attachment.id);
    }
  }, [onLoadAttachmentAudio]);

  useEffect(() => {
    paginatedEntries.forEach((entry) => {
      entry.attachments?.forEach((attachment) => {
        if (!isAudioAttachment(attachment)) return;
        if (audioPlaybackUrls[attachment.id]) return;
        if (audioPlaybackStates[attachment.id] === "error") return;
        void loadAttachmentAudio(attachment);
      });
    });
  }, [audioPlaybackStates, audioPlaybackUrls, loadAttachmentAudio, paginatedEntries]);

  useEffect(() => () => {
    Object.values(audioObjectUrls.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    paginatedEntries.forEach((entry) => {
      entry.attachments?.forEach((attachment) => {
        if (!isAttachmentObject(attachment)) return;
        const href = attachment.signedUrl;
        if (!href) return;
        const requestKey = `${attachment.id}:${href}`;
        if (requestedAttachmentSizeUrls.current.has(requestKey)) return;
        requestedAttachmentSizeUrls.current.add(requestKey);

        void fetch(href, { method: "HEAD", signal: controller.signal })
          .then((response) => {
            if (!response.ok) return;
            const bytes = Number(response.headers.get("content-length"));
            if (!Number.isFinite(bytes) || bytes <= 0) return;
            setAttachmentSizes((current) => ({ ...current, [attachment.id]: bytes }));
          })
          .catch(() => undefined);
      });
    });

    return () => controller.abort();
  }, [paginatedEntries]);

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog state
  const [deletingEntry, setDeletingEntry] = useState<DiaryEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveEdit = async (data: { title: string; content: string; mood: DiaryMood; tags: string[] }) => {
    if (!editingEntry || !onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate(editingEntry.id, data);
      showToast("success", "Entry updated successfully");
      setEditingEntry(null);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEntry || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(deletingEntry.id);
      showToast("success", "Entry deleted successfully");
      setDeletingEntry(null);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  const toggleEntryExpanded = (id: string) => {
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="relative">
      {/* Toast notification */}
      {toast && (
        <div className={`animate-fade-in fixed top-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-sm ${
          toast.type === "success"
            ? "bg-emerald-600 text-white"
            : "bg-rose-600 text-white"
        }`}>
          {toast.type === "success" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4" aria-hidden="true" />
          )}
          {toast.message}
        </div>
      )}

      <div className="space-y-8">
        {groupedPaginatedEntries.map((group) => (
          <section key={group.key} aria-labelledby={`timeline-group-${group.key}`}>
            <div className="mb-3 flex items-center gap-3 pl-10">
              <h2 id={`timeline-group-${group.key}`} className="shrink-0 text-base font-bold text-slate-950 dark:text-slate-100">
                {group.label}
              </h2>
              <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                {group.items.length} {group.items.length === 1 ? "memory" : "memories"}
              </span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
            </div>
            <div className="relative">
              {group.items.length > 1 ? (
                <div className="absolute bottom-6 left-[14px] top-7 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
              ) : null}
              <ul className="space-y-4">
        {group.items.map(({ entry, index }) => {
          const activityDate = getEntryActivityDate(entry, isAdmin);
          const showCreatedDate = isDifferentTimestamp(activityDate, entry.createdAt);
          const isExpanded = expandedEntryIds.has(entry.id);
          const shouldClamp = entry.content.trim().length > 360;
          const MoodIcon = entry.mood ? MOOD_META[entry.mood].icon : null;

          return (
          <li key={entry.id} className="relative pl-10">
            {/* Timeline dot */}
            <div className="absolute left-0 top-5 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-pink-600 text-white dark:border-slate-950 dark:bg-pink-500">
              <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            
            {/* Card */}
            <div className="group relative enterprise-card p-4 transition hover:border-pink-200 dark:hover:border-pink-900/70">
              {/* Entry number badge + action buttons */}
              {isAdmin ? (
              <div className="absolute -top-3 right-6 flex items-center gap-2">
                <span className="status-badge">
                  Entry #{entries.length - ((currentPage - 1) * PAGE_SIZE + index)}
                </span>
              </div>
              ) : null}

              {/* Header */}
              <div className="mb-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold leading-7 text-slate-900 dark:text-slate-100">
                    {entry.title}
                  </h3>

                  {/* Action buttons */}
                  {(onUpdate || onDelete) && (
                    <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      {onUpdate && (
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                          title="Edit entry"
                          aria-label={`Edit ${entry.title}`}
                        >
                          <PencilLine className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => setDeletingEntry(entry)}
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                          title="Delete entry"
                          aria-label={`Delete ${entry.title}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {isAdmin ? "Memory time" : "Created time"}
                  </span>
                  <time className="font-medium">
                    {formatDiaryDate(activityDate)} · {formatEntryTime(activityDate)}
                  </time>
                </div>
                {(entry.mood || entry.tags?.length) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {entry.mood ? (
                      <span className={`status-badge ${MOOD_META[entry.mood].className}`}>
                        {MoodIcon ? <MoodIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                        {MOOD_META[entry.mood].label}
                      </span>
                    ) : null}
                    {entry.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="status-badge"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="relative">
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-pink-500"></div>
                <p className={`pl-4 text-sm leading-7 text-slate-700 dark:text-slate-300 ${shouldClamp && !isExpanded ? "line-clamp-4" : ""}`}>
                  {entry.content}
                </p>
                {shouldClamp ? (
                  <button
                    type="button"
                    onClick={() => toggleEntryExpanded(entry.id)}
                    className="mt-2 cursor-pointer pl-4 text-xs font-semibold text-pink-600 transition hover:text-pink-700 dark:text-pink-300 dark:hover:text-pink-200"
                  >
                    {isExpanded ? "Show less" : "View more"}
                  </button>
                ) : null}
              </div>

              {/* Linked calendar events */}
              {entry.calendarEvents && entry.calendarEvents.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <p className="mb-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Linked calendar events
                  </p>
                  <div className="grid gap-2">
                    {entry.calendarEvents.map((event) => {
                      const content = (
                        <>
                          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
                          <span className="shrink-0 text-slate-500 dark:text-slate-400">{formatEventTime(event)}</span>
                        </>
                      );

                      return event.htmlLink ? (
                        <a
                          key={event.id}
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800 transition hover:border-sky-200 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-900/40"
                        >
                          {content}
                        </a>
                      ) : (
                        <div
                          key={event.id}
                          className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {entry.attachments && entry.attachments.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <p className="mb-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Attachments
                  </p>
                  <div className="grid gap-2">
                    {entry.attachments.map((attachment, i) => {
                      const status = getAttachmentStatus(attachment);
                      const href = getAttachmentHref(attachment);
                      const label = getAttachmentLabel(attachment, i);
                      const indexStatusLabel = getIndexStatusLabel(status);
                      const attachmentKind = getAttachmentKind(attachment);
                      const attachmentTypeLabel = getAttachmentTypeLabel(attachment);
                      const attachmentId = isAttachmentObject(attachment) ? attachment.id : undefined;
                      const fileSizeLabel = attachmentId ? formatFileSize(attachmentSizes[attachmentId]) : undefined;
                      const duration = attachmentId ? audioDurations[attachmentId] : undefined;
                      const durationLabel = attachmentKind === "audio" && duration ? formatDuration(duration) : undefined;
                      const attachmentHeader = (
                        <>
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${getAttachmentIconClass(attachmentKind)}`}>
                            <AttachmentTypeIcon kind={attachmentKind} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{attachmentTypeLabel}</span>
                              {fileSizeLabel ? <><span aria-hidden="true">·</span><span>{fileSizeLabel}</span></> : null}
                              {durationLabel ? <><span aria-hidden="true">·</span><span>{durationLabel}</span></> : null}
                              <span aria-hidden="true">·</span>
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${getStatusTextClass(status)}`}
                                aria-label={`Memory indexing status: ${indexStatusLabel}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                                {indexStatusLabel}
                              </span>
                            </span>
                          </span>
                        </>
                      );

                      if (isAudioAttachment(attachment)) {
                        const audioSource = audioPlaybackUrls[attachment.id];
                        const playbackState = audioPlaybackStates[attachment.id] ?? "loading";
                        const showPlayer = Boolean(audioSource)
                          && playbackState !== "retrying"
                          && playbackState !== "error";

                        return (
                          <div
                            key={attachment.id}
                            className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                          >
                            <div className="mb-3 flex min-w-0 items-center gap-3">
                              {attachmentHeader}
                            </div>
                            {audioSource ? (
                              <audio
                                key={audioSource}
                                ref={(element) => {
                                  audioElements.current[attachment.id] = element;
                                }}
                                controls
                                preload="metadata"
                                src={audioSource}
                                onError={() => {
                                  setAudioPlaybackStates((current) => ({
                                    ...current,
                                    [attachment.id]: "error",
                                  }));
                                }}
                                onLoadedMetadata={(event) => {
                                  const nextDuration = event.currentTarget.duration;
                                  if (Number.isFinite(nextDuration)) {
                                    setAudioDurations((current) => ({ ...current, [attachment.id]: nextDuration }));
                                  }
                                  setAudioPlaybackStates((current) => ({
                                    ...current,
                                    [attachment.id]: "ready",
                                  }));
                                }}
                                onTimeUpdate={(event) => {
                                  setAudioCurrentTimes((current) => ({
                                    ...current,
                                    [attachment.id]: event.currentTarget.currentTime,
                                  }));
                                }}
                                aria-label={`Play ${label}`}
                                className={showPlayer ? "h-9 w-full" : "hidden"}
                              >
                                Your browser does not support audio playback.
                              </audio>
                            ) : null}
                            <div className={playbackState === "ready" ? "sr-only" : "mt-2"} aria-live="polite">
                              {playbackState === "loading" ? (
                                <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-600 dark:border-t-indigo-400" aria-hidden="true" />
                                  Loading audio
                                </p>
                              ) : null}
                              {playbackState === "retrying" ? (
                                <p className="flex min-h-10 items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-medium text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600 dark:border-sky-700 dark:border-t-sky-300" aria-hidden="true" />
                                  Retrying audio
                                </p>
                              ) : null}
                              {playbackState === "error" ? (
                                <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs dark:border-rose-900/60 dark:bg-rose-950/30">
                                  <span className="font-medium text-rose-700 dark:text-rose-300">Playback unavailable</span>
                                  <button
                                    type="button"
                                    onClick={() => void loadAttachmentAudio(attachment, true)}
                                    className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-rose-300 bg-white px-3 font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : null}
                              {playbackState === "ready" ? "Audio ready to play" : null}
                            </div>
                            {showPlayer && duration && duration > 0 ? (
                              <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                <span className="w-9 text-right tabular-nums">{formatDuration(audioCurrentTimes[attachment.id])}</span>
                                <input
                                  type="range"
                                  min="0"
                                  max={duration}
                                  step="0.1"
                                  value={Math.min(audioCurrentTimes[attachment.id] ?? 0, duration)}
                                  onChange={(event) => {
                                    const nextTime = Number(event.target.value);
                                    const audio = audioElements.current[attachment.id];
                                    if (audio) audio.currentTime = nextTime;
                                    setAudioCurrentTimes((current) => ({ ...current, [attachment.id]: nextTime }));
                                  }}
                                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-indigo-600"
                                  aria-label={`Seek ${label}`}
                                />
                                <span className="w-9 tabular-nums">{formatDuration(duration)}</span>
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      return href ? (
                        <a
                          key={isAttachmentObject(attachment) ? attachment.id : `${attachment}-${i}`}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
                        >
                          {attachmentHeader}
                          <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        </a>
                      ) : (
                        <div
                          key={isAttachmentObject(attachment) ? attachment.id : i}
                          className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                        >
                          {attachmentHeader}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Footer decoration */}
              {isAdmin && showCreatedDate ? (
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Created {formatDateTime(entry.createdAt)}</span>
                </div>
              ) : null}
            </div>
          </li>
          );
        })}
              </ul>
            </div>
          </section>
        ))}
      </div>
      
      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300">
            <Inbox className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2 dark:text-slate-100">No entries yet</h3>
          <p className="text-slate-500 dark:text-slate-400">Start by creating your first diary entry</p>
        </div>
      )}

      {entries.length > PAGE_SIZE && (
        <div className="mt-8 flex flex-col items-center justify-between gap-4 enterprise-card p-4 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, entries.length)} of {entries.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditDiaryModal
        isOpen={editingEntry !== null}
        initialTitle={editingEntry?.title ?? ""}
        initialContent={editingEntry?.content ?? ""}
        initialMood={editingEntry?.mood ?? "neutral"}
        initialTags={editingEntry?.tags ?? []}
        isLoading={isSaving}
        onSave={handleSaveEdit}
        onCancel={() => setEditingEntry(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingEntry !== null}
        title="Delete Diary Entry"
        message={`Are you sure you want to delete "${deletingEntry?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingEntry(null)}
      />
    </div>
  );
}
