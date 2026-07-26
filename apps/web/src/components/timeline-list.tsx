"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@second-brain/shared";
import { EditDiaryModal } from "./edit-diary-modal";
import { ConfirmDialog } from "./confirm-dialog";
import type { DiaryAttachment, DiaryCalendarEvent, DiaryMood, UpdateDiaryPayload } from "@/lib/api-client";

type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  mood?: DiaryMood | null;
  tags?: string[];
  attachments?: Array<string | DiaryAttachment>;
  calendarEvents?: DiaryCalendarEvent[];
  createdAt: Date | string;
  updatedAt?: Date | string;
};

type TimelineListProps = {
  entries: DiaryEntry[];
  onUpdate?: (id: string, payload: UpdateDiaryPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

const PAGE_SIZE = 5;

const MOOD_META: Record<DiaryMood, { label: string; className: string }> = {
  great: {
    label: "Great",
    className: "status-badge-success",
  },
  good: {
    label: "Good",
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
  },
  neutral: {
    label: "Neutral",
    className: "",
  },
  bad: {
    label: "Bad",
    className: "status-badge-danger",
  },
};

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

function getStatusClass(status: string) {
  if (status === "indexed") {
    return "status-badge-success";
  }

  if (status === "failed") {
    return "status-badge-danger";
  }

  if (status === "processing") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300";
  }

  return "status-badge-warning";
}

function formatEventTime(event: DiaryCalendarEvent) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function TimelineList({ entries, onUpdate, onDelete }: TimelineListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [currentPage, entries]);

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
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Timeline vertical line */}
      {paginatedEntries.length > 1 && (
        <div className="absolute left-[19px] top-8 bottom-28 w-px bg-slate-200 dark:bg-slate-800" />
      )}
      
      <ul className="space-y-6">
        {paginatedEntries.map((entry, index) => (
          <li key={entry.id} className="relative pl-14">
            {/* Timeline dot */}
            <div className="absolute left-0 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-white dark:border-slate-950 dark:bg-slate-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </div>
            
            {/* Card */}
            <div className="group relative enterprise-card p-5 transition hover:border-indigo-200 dark:hover:border-indigo-800">
              {/* Entry number badge + action buttons */}
              <div className="absolute -top-3 right-6 flex items-center gap-2">
                <span className="status-badge">
                  Entry #{entries.length - ((currentPage - 1) * PAGE_SIZE + index)}
                </span>
              </div>

              {/* Header */}
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {entry.title}
                  </h3>

                  {/* Action buttons */}
                  {(onUpdate || onDelete) && (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {onUpdate && (
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                          title="Edit entry"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => setDeletingEntry(entry)}
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                          title="Delete entry"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <time className="font-medium">{formatDateTime(entry.createdAt)}</time>
                </div>
                {(entry.mood || entry.tags?.length) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {entry.mood ? (
                      <span className={`status-badge ${MOOD_META[entry.mood].className}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
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
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-indigo-500"></div>
                <p className="pl-4 text-sm text-slate-700 leading-relaxed dark:text-slate-300">
                  {entry.content}
                </p>
              </div>

              {/* Linked calendar events */}
              {entry.calendarEvents && entry.calendarEvents.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Linked calendar events
                  </p>
                  <div className="grid gap-2">
                    {entry.calendarEvents.map((event) => {
                      const content = (
                        <>
                          <svg className="h-4 w-4 shrink-0 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
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
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Attachments
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entry.attachments.map((attachment, i) => {
                      const status = getAttachmentStatus(attachment);
                      const href = getAttachmentHref(attachment);
                      const label = getAttachmentLabel(attachment, i);
                      const content = (
                        <>
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="max-w-[180px] truncate">{label}</span>
                          <span className={`status-badge ${getStatusClass(status)}`}>
                            {status}
                          </span>
                        </>
                      );

                      return href ? (
                        <a
                          key={isAttachmentObject(attachment) ? attachment.id : `${attachment}-${i}`}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {content}
                        </a>
                      ) : (
                        <span
                          key={isAttachmentObject(attachment) ? attachment.id : i}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {content}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Footer decoration */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span>Created {formatDateTime(entry.createdAt)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      
      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 dark:bg-slate-800">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
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
