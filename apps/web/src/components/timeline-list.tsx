"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@second-brain/shared";

type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  attachments?: string[];
  createdAt: Date | string;
  updatedAt?: Date | string;
};

type TimelineListProps = {
  entries: DiaryEntry[];
};

const PAGE_SIZE = 5;

export function TimelineList({ entries }: TimelineListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [currentPage, entries]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  return (
    <div className="relative">
      {/* Timeline vertical line */}
      {paginatedEntries.length > 1 && (
        <div className="absolute left-[19px] top-8 bottom-28 w-0.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200" />
      )}
      
      <ul className="space-y-6">
        {paginatedEntries.map((entry, index) => (
          <li key={entry.id} className="relative pl-14">
            {/* Timeline dot */}
            <div className="absolute left-0 top-6 w-10 h-10 rounded-full bg-indigo-500 shadow-lg flex items-center justify-center text-white font-bold border-4 border-white z-10">
              <span className="text-lg">📝</span>
            </div>
            
            {/* Card */}
            <div className="group relative rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm shadow-slate-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
              {/* Entry number badge */}
              <div className="absolute -top-3 right-6">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 shadow-sm">
                  Entry #{entries.length - index}
                </span>
              </div>
              
              {/* Header */}
              <div className="flex flex-col gap-2 mb-4">
                <h3 className="text-xl font-bold text-slate-900 pr-24">
                  {entry.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <time className="font-medium">{formatDateTime(entry.createdAt)}</time>
                </div>
              </div>
              
              {/* Content */}
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-200"></div>
                <p className="pl-4 text-sm text-slate-700 leading-relaxed">
                  {entry.content}
                </p>
              </div>

              {/* Attachments */}
              {entry.attachments && entry.attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">Attachments:</p>
                  <div className="flex flex-wrap gap-2">
                    {entry.attachments.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        File {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Footer decoration */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No entries yet</h3>
          <p className="text-slate-500">Start by creating your first diary entry</p>
        </div>
      )}

      {entries.length > PAGE_SIZE && (
        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, entries.length)} of {entries.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
