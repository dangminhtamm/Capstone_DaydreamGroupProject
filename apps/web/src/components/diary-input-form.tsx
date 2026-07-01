"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createDiaryEntry,
  copilotDiaryText,
  processDiaryAttachment,
  uploadDiaryAttachment,
  type AttachmentUploadResponse,
  type CreateDiaryPayload,
} from "@/lib/api-client";

type DiaryDraft = {
  title: string;
  content: string;
  entryDate: string;
};

type SaveState = "idle" | "saving" | "success" | "error";
type AttachmentStatus = "queued" | "uploading" | "extracting" | "indexed" | "pending" | "error";

type AttachmentQueueItem = {
  id: string;
  file: File;
  status: AttachmentStatus;
  message: string;
  attachmentId?: string;
  memoryChunkCount?: number;
};

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  return "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800";
}

const initialDraft: DiaryDraft = {
  title: "",
  content: "",
  entryDate: getLocalDateInputValue(),
};

type TemplateLang = "en" | "vi";

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

const TEMPLATES_VI: TemplateItem[] = [
  {
    id: "brain-dump",
    name: "Ghi chép Ý tưởng",
    icon: "💡",
    description: "Thu thập kiến thức & ý tưởng",
    title: "Ghi chép & Thu thập Kiến thức",
    content: [
      "🧠 Bài học lớn nhất của tôi hôm nay (tóm gọn trong 1 câu):",
      "- ",
      "",
      "📌 Các sự kiện, trích dẫn hoặc ý tưởng tôi muốn ghi nhớ:",
      "- ",
      "",
      "🔗 Tôi có thể áp dụng kiến thức này vào dự án hoặc mục tiêu hiện tại như thế nào?",
      "- ",
      "",
      "🔍 Chủ đề tôi muốn tìm hiểu sâu hơn trong tương lai:",
      "- ",
    ].join("\n"),
  },
  {
    id: "stoic-reflection",
    name: "Suy ngẫm Nội tâm",
    icon: "🧘",
    description: "Giải tỏa cảm xúc & suy nghĩ",
    title: "Nhật ký Suy ngẫm & Nội tâm",
    content: [
      "⛈️ Điều gì đang khiến tôi lo lắng hoặc mất tập trung nhất hôm nay?",
      "- ",
      "",
      "⚖️ Trong chuyện này, điều gì NẰM TRONG và NGOÀI tầm kiểm soát của tôi?",
      "- Trong tầm kiểm soát: ",
      "- Ngoài tầm kiểm soát: ",
      "",
      "🌟 Một điều tích cực tôi có thể tập trung vào dù có khó khăn:",
      "- ",
      "",
      "🕊️ Nếu nhìn lại chuyện này vào 1 năm sau, tôi sẽ nghĩ gì?",
      "- ",
    ].join("\n"),
  },
  {
    id: "five-minute",
    name: "Nhật ký 5 Phút",
    icon: "🎯",
    description: "Bắt đầu & kết thúc ngày có chủ đích",
    title: "Khởi động & Nhìn lại trong 5 Phút",
    content: [
      "☀️ BUỔI SÁNG — Thiết lập Ý định",
      "",
      "3 điều tôi cảm thấy biết ơn hôm nay:",
      "1. ",
      "2. ",
      "3. ",
      "",
      "Nhiệm vụ DUY NHẤT nếu hoàn thành sẽ khiến hôm nay trở nên tuyệt vời:",
      "- ",
      "",
      "Tư duy hoặc lời khẳng định tôi muốn mang theo hôm nay:",
      "- ",
      "",
      "🌙 BUỔI TỐI — Nhìn lại",
      "",
      "Trở ngại lớn nhất hôm nay và cách tôi đã xử lý:",
      "- ",
      "",
      "Một điều tôi có thể làm tốt hơn vào ngày mai:",
      "- ",
    ].join("\n"),
  },
  {
    id: "project-review",
    name: "Nhật ký Dự án",
    icon: "🚀",
    description: "Theo dõi tiến độ & trở ngại",
    title: "Tiến độ & Đánh giá Dự án",
    content: [
      "📈 Tiến độ — Hôm nay tôi đã hoàn thành hoặc thúc đẩy được điều gì?",
      "- ",
      "",
      "🚧 Trở ngại — Tôi gặp phải khó khăn hoặc vướng mắc gì?",
      "- ",
      "",
      "💡 Ý tưởng — Có phát hiện mới, giải pháp, hoặc khoảnh khắc 'eureka' nào không?",
      "- ",
      "",
      "📋 Bước tiếp theo — Ưu tiên của tôi cho ngày mai là gì?",
      "- ",
    ].join("\n"),
  },
];

const TEMPLATES_MAP: Record<TemplateLang, TemplateItem[]> = {
  en: TEMPLATES_EN,
  vi: TEMPLATES_VI,
};

export function DiaryInputForm() {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [draft, setDraft] = useState<DiaryDraft>(initialDraft);
  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [activeCopilotAction, setActiveCopilotAction] = useState("");
  const [templateLang, setTemplateLang] = useState<TemplateLang>("vi");
  const [attachmentItems, setAttachmentItems] = useState<AttachmentQueueItem[]>([]);

  // Sync template language from system preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("dd-response-lang");
    if (saved === "en" || saved === "vi") setTemplateLang(saved);
  }, []);

  function toggleTemplateLang() {
    setTemplateLang((prev) => (prev === "en" ? "vi" : "en"));
  }

  const activeTemplates = TEMPLATES_MAP[templateLang];

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
    setAttachmentItems(
      selectedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: "queued",
        message: "Ready to attach",
      })),
    );
  }

  function removeAttachment(id: string) {
    setAttachmentItems((current) => current.filter((item) => item.id !== id));
  }

  function getAttachmentMessage(response: AttachmentUploadResponse) {
    if (response.processingError) {
      return `${response.processingError}. Worker will retry later.`;
    }

    if (response.memoryIndexed) {
      return `Indexed ${response.memoryChunkCount} memory chunks`;
    }

    if (response.extractionStatus === "pending") {
      return "Saved; extraction pending";
    }

    return "Extracted text but no memory chunks were created";
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
      };

      const diaryEntry = await createDiaryEntry(payload, accessToken);

      const queuedAttachments = attachmentItems.filter((item) => item.status === "queued");
      for (const item of queuedAttachments) {
        try {
          updateAttachmentItem(item.id, {
            status: "uploading",
            message: "Uploading to storage",
          });

          const uploadResult = await uploadDiaryAttachment(diaryEntry.id, item.file, accessToken);
          updateAttachmentItem(item.id, {
            attachmentId: uploadResult.attachment.id,
            status: uploadResult.extractionStatus === "pending" ? "extracting" : "indexed",
            message:
              uploadResult.extractionStatus === "pending"
                ? "Extracting text with AI"
                : getAttachmentMessage(uploadResult),
            memoryChunkCount: uploadResult.memoryChunkCount,
          });

          if (uploadResult.extractionStatus === "pending") {
            const processResult = await processDiaryAttachment(uploadResult.attachment.id, accessToken);
            updateAttachmentItem(item.id, {
              status: processResult.processingError
                ? "pending"
                : processResult.memoryIndexed
                  ? "indexed"
                  : "pending",
              message: getAttachmentMessage(processResult),
              memoryChunkCount: processResult.memoryChunkCount,
            });
          }
        } catch (attachmentError) {
          updateAttachmentItem(item.id, {
            status: "error",
            message: attachmentError instanceof Error ? attachmentError.message : "Attachment upload failed",
          });
        }
      }

      setState("success");
      setDraft(initialDraft);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save diary entry");
    }
  }

  const wordCount = useMemo(() => {
    return draft.content.trim().split(/\s+/).filter(Boolean).length;
  }, [draft.content]);

  function applyTemplate(template: TemplateItem) {
    if (draft.content.trim() && !window.confirm(templateLang === "vi" ? "Nội dung hiện tại sẽ bị thay thế. Bạn có chắc không?" : "This will overwrite your current entry. Are you sure?")) {
      return;
    }
    setDraft((prev) => ({ ...prev, title: template.title, content: template.content }));
    setErrorMessage("");
  }

  return (
    <div className="w-full">
      {/* Prompt Templates */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {templateLang === "vi" ? "Bắt đầu nhanh với mẫu gợi ý" : "Kickstart your entry with a template"}
          </p>
          <button
            type="button"
            onClick={toggleTemplateLang}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-700 dark:hover:border-indigo-500"
          >
            <span className={`rounded-full px-1.5 py-0.5 transition ${templateLang === "en" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500"}`}>🇺🇸 EN</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className={`rounded-full px-1.5 py-0.5 transition ${templateLang === "vi" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500"}`}>🇻🇳 VI</span>
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {activeTemplates.map((tpl) => (
            <button
              key={`${templateLang}-${tpl.id}`}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="group flex w-[180px] shrink-0 cursor-pointer flex-col items-start gap-3 rounded-3xl border border-slate-200/80 bg-white/60 p-5 text-left shadow-sm shadow-slate-200/50 backdrop-blur-sm transition-all hover:-translate-y-1.5 hover:border-indigo-300 hover:bg-white hover:shadow-lg hover:shadow-indigo-100 dark:border-slate-700/60 dark:bg-slate-800/40 dark:shadow-slate-900/40 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800/80 dark:hover:shadow-indigo-900/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 transition-colors group-hover:bg-indigo-100 dark:bg-slate-700 dark:group-hover:bg-indigo-900/50">
                <span className="text-xl transition-transform group-hover:scale-110">{tpl.icon}</span>
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {tpl.name}
              </span>
              <span className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                {tpl.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <form className="space-y-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/30 dark:shadow-slate-900/40" onSubmit={onSubmit}>
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Title
          </label>
          <input
            id="title"
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:ring-indigo-900/40"
            placeholder="What happened today?"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="entryDate" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Memory date
          </label>
          <input
            id="entryDate"
            type="date"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:ring-indigo-900/40"
            value={draft.entryDate}
            onChange={(event) => setDraft((prev) => ({ ...prev, entryDate: event.target.value }))}
          />
        </div>

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
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:ring-indigo-900/40"
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
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
              >
                {activeCopilotAction === 'continue' ? '✨ Thinking...' : '✨ Continue'}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('fix_grammar')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              >
                {activeCopilotAction === 'fix_grammar' ? '🪄 Fixing...' : '🪄 Fix Grammar'}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('expand')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
              >
                {activeCopilotAction === 'expand' ? '📝 Expanding...' : '📝 Expand'}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('summarize')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                {activeCopilotAction === 'summarize' ? '✂️ Summarizing...' : '✂️ Summarize'}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <label htmlFor="attachments" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Attach files
            </label>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              PDF, image, Word, or plain text · up to 5MB each
            </span>
          </div>
          <label
            htmlFor="attachments"
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-600 dark:bg-slate-700/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20"
          >
            <svg className="h-8 w-8 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Choose attachments for this diary
            </span>
            <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Text files index immediately; PDF/image/doc files are extracted and indexed after upload.
            </span>
          </label>
          <input
            id="attachments"
            type="file"
            multiple
            accept=".txt,.pdf,.png,.jpg,.jpeg,.doc,.docx,text/plain,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={handleAttachmentSelection}
          />

          {attachmentItems.length ? (
            <div className="mt-3 space-y-2">
              {attachmentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{item.file.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {(item.file.size / 1024).toFixed(1)} KB · {item.file.type || "unknown type"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getAttachmentStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.message}
                    </span>
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
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-700">
          <button
            type="submit"
            disabled={!canSubmit || state === "saving"}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0 dark:shadow-indigo-900/30 dark:disabled:bg-slate-600"
          >
            {state === "saving" ? "Saving..." : "Save Diary Entry"}
          </button>

          {state === "success" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Saved successfully
            </span>
          )}
          {state === "error" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-700">
              {errorMessage || "Save failed."}
            </span>
          )}
          {!isAuthenticated && (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 transition-all dark:border-indigo-700 dark:bg-indigo-900/20">
              <svg className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
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
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                Sign in
              </a>
            </div>
          )}
        </div>
      </form>
      <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: (<svg className="h-5 w-5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>),
            title: "Write", desc: "Save your thoughts as diary entries."
          },
          {
            icon: (<svg className="h-5 w-5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>),
            title: "Search", desc: "Ask questions grounded in your memories."
          },
          {
            icon: (<svg className="h-5 w-5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>),
            title: "Summarize", desc: "See writing stats and weekly trends."
          },
        ].map((step) => (
          <div key={step.title} className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
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
