"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DiaryInputForm } from "@/components/diary-input-form";
import { MoodTracker } from "@/components/mood-tracker";

type DiaryTab = "diary" | "mood";

export default function DiaryPage() {
  const [activeTab, setActiveTab] = useState<DiaryTab>("diary");

  return (
    <DashboardShell
      title="Diary"
      description="Capture a memory with mood, tags, attachments, and calendar context."
    >
      {/* Tab Bar */}
      <div className="mb-5 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/70">
        <button
          type="button"
          onClick={() => setActiveTab("diary")}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "diary"
              ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Diary
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mood")}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "mood"
              ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Mood Tracker
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "diary" ? <DiaryInputForm /> : <MoodTracker />}
    </DashboardShell>
  );
}
