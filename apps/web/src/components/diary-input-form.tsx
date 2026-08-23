"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  FileUp,
  LockKeyhole,
  Mic,
  Paperclip,
  PencilLine,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  AUDIO_ATTACHMENT_MAX_BYTES,
  isAudioAttachmentMimeType,
  STANDARD_ATTACHMENT_MAX_BYTES,
} from "@second-brain/shared";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearHomeDraft,
  readHomeDraft,
  storeHomeDraft,
} from "@/lib/home-draft";
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
type CaptureMode = "write" | "record" | "photo" | "file";
type AttachmentStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "indexed"
  | "pending"
  | "error";

type AttachmentQueueItem = {
  id: string;
  file: File;
  status: AttachmentStatus;
  message: string;
  attachmentId?: string;
  signedUrl?: string;
  memoryChunkCount?: number;
};

type SavedReflection = {
  entryId: string;
  entryTitle: string;
  mood: DiaryMood;
  question: string;
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

function getReflectionFallback(mood: DiaryMood) {
  if (mood === "great") {
    return "What helped create this energy, and how could you carry it forward?";
  }
  if (mood === "good") {
    return "What made this moment feel steady or meaningful to you?";
  }
  if (mood === "bad") {
    return "What felt heaviest here, and what support would have helped?";
  }
  return "What detail from this moment might matter more than it seems right now?";
}

function normalizeReflectionQuestion(value: string, fallback: string) {
  const firstLine = value
    .trim()
    .split(/\n+/)[0]
    ?.replace(/^[\s>*#-]+/, "")
    .replace(/^['\"]|['\"]$/g, "")
    .trim();

  if (!firstLine) return fallback;
  const shortened = firstLine.slice(0, 240).trim();
  return /[?？]$/.test(shortened) ? shortened : `${shortened}?`;
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

const CAPTURE_MODES = [
  { value: "write", label: "Write", icon: PencilLine },
  { value: "record", label: "Record", icon: Mic },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "file", label: "File", icon: FileUp },
] satisfies Array<{
  value: CaptureMode;
  label: string;
  icon: typeof PencilLine;
}>;

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
  const [attachmentItems, setAttachmentItems] = useState<AttachmentQueueItem[]>(
    [],
  );
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>(
    [],
  );
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("write");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [savedReflection, setSavedReflection] =
    useState<SavedReflection | null>(null);
  const [isReflectionLoading, setIsReflectionLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);

  useEffect(() => {
    const homeDraft = readHomeDraft();
    if (!homeDraft) return;
    setDraft(homeDraft);
  }, []);

  useEffect(() => {
    if (isAuthenticated || (!draft.title.trim() && !draft.content.trim()))
      return;
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

  useEffect(() => {
    if (!isRecording) return undefined;
    const timerId = window.setInterval(
      () => setRecordingSeconds((current) => current + 1),
      1000,
    );
    return () => window.clearInterval(timerId);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const activeTemplates = TEMPLATES_EN;

  const linkedCalendarEvents = useMemo(() => {
    return calendarEvents
      .filter((event) => isSameLocalDate(event.startTime, draft.entryDate))
      .slice(0, 3);
  }, [calendarEvents, draft.entryDate]);

  const canSubmit = useMemo(() => {
    const hasAttachment = attachmentItems.some(
      (item) => item.status !== "error",
    );
    return (
      draft.title.trim().length > 0 &&
      (draft.content.trim().length > 0 || hasAttachment) &&
      draft.entryDate.trim().length > 0
    );
  }, [attachmentItems, draft]);

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  function updateAttachmentItem(
    id: string,
    update: Partial<AttachmentQueueItem>,
  ) {
    setAttachmentItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  function queueAttachmentFiles(
    selectedFiles: File[],
    sourceMode: CaptureMode = captureMode,
  ) {
    if (!selectedFiles.length) return;

    setAttachmentItems((current) => [
      ...current,
      ...selectedFiles.map((file) => {
        const audio = isAudioFile(file);
        const maxBytes = audio
          ? AUDIO_ATTACHMENT_MAX_BYTES
          : STANDARD_ATTACHMENT_MAX_BYTES;
        const tooLarge = file.size > maxBytes;

        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          status: tooLarge ? ("error" as const) : ("queued" as const),
          message: tooLarge
            ? `${audio ? "Audio" : "File"} must be ${maxBytes / (1024 * 1024)} MB or smaller`
            : audio
              ? "Ready to upload and transcribe"
              : "Ready to attach",
        };
      }),
    ]);

    const firstFile = selectedFiles[0];
    const isAudio = isAudioFile(firstFile);
    const isImage = firstFile.type.startsWith("image/");
    const baseName = firstFile.name.replace(/\.[^.]+$/, "").trim();
    const defaultTitle = isAudio
      ? "Voice note"
      : isImage || sourceMode === "photo"
        ? "Photo memory"
        : baseName || "File memory";
    const defaultContent = isAudio
      ? "Voice note attached."
      : isImage || sourceMode === "photo"
        ? "Photo attached."
        : "File attached.";

    setDraft((current) => ({
      ...current,
      title: current.title.trim() ? current.title : defaultTitle,
      content: current.content.trim() ? current.content : defaultContent,
    }));
  }

  function handleAttachmentSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    queueAttachmentFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function formatRecordingTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function startRecording() {
    setRecordingError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecordingError("Audio recording is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      discardRecordingRef.current = false;
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingError("Recording failed. Please try again.");
        setIsRecording(false);
        stopMediaStream();
      };
      recorder.onstop = () => {
        setIsRecording(false);
        stopMediaStream();
        if (discardRecordingRef.current || !recordedChunksRef.current.length) {
          recordedChunksRef.current = [];
          return;
        }

        const mimeType = (recorder.mimeType || "audio/webm")
          .split(";", 1)[0]
          .toLowerCase();
        const extension = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : mimeType.includes("mpeg")
              ? "mp3"
              : "webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const file = new File(
          [blob],
          `voice-note-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
          { type: mimeType },
        );
        recordedChunksRef.current = [];
        queueAttachmentFiles([file], "record");
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      stopMediaStream();
      setRecordingError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access and try again."
          : "Could not start microphone recording.",
      );
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function discardRecording() {
    discardRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else stopMediaStream();
    setIsRecording(false);
    setRecordingSeconds(0);
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
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.filter((item) => item !== tag),
    }));
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

    if (response.extractionStatus === "failed") {
      return response.attachment.fileType.startsWith("audio/")
        ? "Audio transcription failed; retry from Timeline"
        : "AI could not read this file; retry the scan from Timeline";
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

    if (
      response.memoryIndexingStatus === "queued" ||
      response.memoryIndexingStatus === "pending"
    ) {
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
      if (
        response.attachment.fileType.startsWith("audio/") &&
        response.extractionStatus !== "extracted"
      ) {
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

  function getAttachmentStatus(
    response: AttachmentUploadResponse,
  ): AttachmentStatus {
    if (
      response.processingError ||
      response.extractionStatus === "failed" ||
      response.memoryIndexingStatus === "failed" ||
      response.memoryIndexingStatus === "dead_letter"
    )
      return "error";
    if (response.memoryIndexed || response.memoryIndexingStatus === "succeeded")
      return "indexed";
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
        accessToken,
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
      setErrorMessage(
        error instanceof Error ? error.message : "Copilot request failed",
      );
    } finally {
      setIsCopilotLoading(false);
      setActiveCopilotAction("");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (isRecording) {
      setState("error");
      setErrorMessage("Stop the recording before saving this memory.");
      return;
    }

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
      const firstUsableAttachment = attachmentItems.find(
        (item) => item.status !== "error",
      );
      const fallbackContent = firstUsableAttachment
        ? isAudioFile(firstUsableAttachment.file)
          ? "Voice note attached."
          : firstUsableAttachment.file.type.startsWith("image/")
            ? "Photo attached."
            : "File attached."
        : "Memory captured.";
      const payload: CreateDiaryPayload = {
        title: draft.title.trim(),
        content: draft.content.trim() || fallbackContent,
        entryDate: new Date(`${draft.entryDate}T12:00:00`).toISOString(),
        mood: draft.mood,
        tags: draft.tags,
      };

      const diaryEntry = await createDiaryEntry(payload, accessToken);
      const fallbackQuestion = getReflectionFallback(draft.mood);
      setSavedReflection({
        entryId: diaryEntry.id,
        entryTitle: payload.title,
        mood: draft.mood,
        question: fallbackQuestion,
      });
      setIsReflectionLoading(true);
      void copilotDiaryText(
        { text: `${payload.title}\n\n${payload.content}`, action: "reflect" },
        accessToken,
      )
        .then((response) => {
          setSavedReflection((current) =>
            current?.entryId === diaryEntry.id
              ? {
                  ...current,
                  question: normalizeReflectionQuestion(
                    response.result,
                    fallbackQuestion,
                  ),
                }
              : current,
          );
        })
        .catch(() => undefined)
        .finally(() => setIsReflectionLoading(false));

      const queuedAttachments = attachmentItems.filter(
        (item) => item.status === "queued",
      );
      let attachmentHadErrors = false;

      for (const item of queuedAttachments) {
        try {
          updateAttachmentItem(item.id, {
            status: "uploading",
            message: "Uploading to storage",
          });

          const uploadResult = await uploadDiaryAttachment(
            diaryEntry.id,
            item.file,
            accessToken,
          );
          updateAttachmentItem(item.id, {
            attachmentId: uploadResult.attachment.id,
            signedUrl: uploadResult.attachment.signedUrl,
            status: getAttachmentStatus(uploadResult),
            message: getAttachmentMessage(uploadResult),
            memoryChunkCount: uploadResult.memoryChunkCount,
          });

          if (uploadResult.extractionStatus === "pending") {
            const processResult = await processDiaryAttachment(
              uploadResult.attachment.id,
              accessToken,
            );
            updateAttachmentItem(item.id, {
              status: getAttachmentStatus(processResult),
              signedUrl:
                processResult.attachment.signedUrl ??
                uploadResult.attachment.signedUrl,
              message: getAttachmentMessage(processResult),
              memoryChunkCount: processResult.memoryChunkCount,
            });
          }
        } catch (attachmentError) {
          attachmentHadErrors = true;
          updateAttachmentItem(item.id, {
            status: "error",
            message:
              attachmentError instanceof Error
                ? attachmentError.message
                : "Attachment upload failed",
          });
        }
      }

      setDraft(initialDraft);
      clearHomeDraft();
      setTagInput("");
      if (attachmentHadErrors) {
        setState("error");
        setErrorMessage(
          "Diary saved, but one or more attachments failed. Check the file status above.",
        );
      } else {
        setState("success");
      }
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save diary entry",
      );
    }
  }

  const wordCount = useMemo(() => {
    return draft.content.trim().split(/\s+/).filter(Boolean).length;
  }, [draft.content]);

  function applyTemplate(template: TemplateItem) {
    if (
      draft.content.trim() &&
      !window.confirm("This will overwrite your current entry. Are you sure?")
    ) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      title: template.title,
      content: template.content,
    }));
    setErrorMessage("");
  }

  return (
    <div className="w-full">
      <form className="enterprise-card space-y-4 p-5" onSubmit={onSubmit}>
        <div
          className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900"
          role="group"
          aria-label="Capture mode"
        >
          {CAPTURE_MODES.map((mode) => {
            const ModeIcon = mode.icon;
            const isActive = captureMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={isActive}
                aria-label={mode.label}
                title={mode.label}
                onClick={() => {
                  if (isRecording && mode.value !== "record") return;
                  setCaptureMode(mode.value);
                  setRecordingError("");
                }}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                } ${isRecording && mode.value !== "record" ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <ModeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{mode.label}</span>
                <span className="sr-only sm:hidden">{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Title
            </label>
            <input
              id="title"
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              placeholder="What happened today?"
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>

          <div>
            <label
              htmlFor="entryDate"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Date
            </label>
            <input
              id="entryDate"
              type="date"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              value={draft.entryDate}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, entryDate: event.target.value }))
              }
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
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, mood: option.value }))
                  }
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
                  <span className="mt-1 block text-xs opacity-75">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="tags"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Tags
            </label>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {draft.tags.length}/12
            </span>
          </div>
          <div className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-900/40">
            <div className="flex flex-wrap items-center gap-2">
              {draft.tags.map((tag) => (
                <span key={tag} className="status-badge">
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
                placeholder={
                  draft.tags.length
                    ? "Add another tag"
                    : "project, health, meeting"
                }
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
                <span className="text-sky-600 dark:text-sky-300">
                  Loading synced events...
                </span>
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
                    <span className="shrink-0 text-sky-500 dark:text-sky-300">
                      {formatCompactEventTime(event)}
                    </span>
                  </a>
                ))
              )}
            </div>
          </div>
        )}

        {captureMode === "record" ? (
          <div className="flex flex-col gap-4 border-y border-slate-100 py-4 dark:border-slate-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  isRecording
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
                }`}
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isRecording ? "Recording voice note" : "Voice note"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {isRecording
                    ? formatRecordingTime(recordingSeconds)
                    : "Audio will be transcribed and indexed for AI."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRecording ? (
                <>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="action-primary bg-rose-600 px-4 hover:bg-rose-700"
                  >
                    <Square
                      className="h-4 w-4 fill-current"
                      aria-hidden="true"
                    />
                    Stop
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    className="action-quiet px-3 text-rose-600 dark:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Discard
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="action-primary px-4"
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Start recording
                </button>
              )}
            </div>
            {recordingError ? (
              <p
                className="text-xs font-medium text-rose-600 dark:text-rose-300 sm:basis-full"
                role="alert"
              >
                {recordingError}
              </p>
            ) : null}
          </div>
        ) : null}

        {captureMode === "photo" ? (
          <div className="flex flex-col gap-3 border-y border-slate-100 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300">
                <Camera className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Add a photo memory
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Images are scanned so their details can be recalled by AI.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="action-secondary px-4"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Choose photo
            </button>
          </div>
        ) : null}

        {captureMode === "file" ? (
          <div className="flex flex-col gap-3 border-y border-slate-100 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                <FileUp className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Attach a document or audio file
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  PDF, image, Word, text or supported audio.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="action-secondary px-4"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              Choose file
            </button>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="content"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {captureMode === "write" ? "Diary content" : "Notes"}
            </label>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {wordCount} words
            </span>
          </div>
          <textarea
            id="content"
            rows={captureMode === "write" ? 8 : 4}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
            placeholder={
              captureMode === "write"
                ? "Write your day in detail..."
                : "Add context or a note (optional)..."
            }
            value={draft.content}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, content: event.target.value }))
            }
          />

          {/* AI Copilot Toolbar */}
          {draft.content.trim().length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction("continue")}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === "continue"
                  ? "Thinking..."
                  : "Continue"}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction("fix_grammar")}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === "fix_grammar"
                  ? "Fixing..."
                  : "Fix Grammar"}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction("expand")}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === "expand" ? "Expanding..." : "Expand"}
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction("summarize")}
                className="action-secondary min-h-10 px-3 text-xs disabled:opacity-50"
              >
                {activeCopilotAction === "summarize"
                  ? "Summarizing..."
                  : "Summarize"}
              </button>
            </div>
          )}
        </div>

        <input
          ref={photoInputRef}
          id="photo-attachments"
          type="file"
          accept="image/png,image/jpeg"
          capture="environment"
          className="hidden"
          onChange={handleAttachmentSelection}
        />

        <input
          ref={fileInputRef}
          id="file-attachments"
          type="file"
          multiple
          accept=".txt,.pdf,.png,.jpg,.jpeg,.doc,.docx,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,text/plain,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/aac,audio/flac"
          className="hidden"
          onChange={handleAttachmentSelection}
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
          <button
            type="submit"
            disabled={!canSubmit || state === "saving" || isRecording}
            className="action-primary px-5 disabled:cursor-not-allowed"
          >
            {state === "saving" ? "Saving..." : "Save Diary Entry"}
          </button>

          {attachmentItems.length > 0 ? (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {attachmentItems.length}{" "}
              {attachmentItems.length === 1 ? "attachment" : "attachments"}
            </span>
          ) : null}

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
              <LockKeyhole
                className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  {showAuthPrompt
                    ? "Sign in to save your diary entry"
                    : "You're exploring as a guest"}
                </p>
                <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                  {showAuthPrompt
                    ? "Your entry is ready — just sign in to keep it!"
                    : "Feel free to write — sign in when you're ready to save."}
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
          <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {attachmentItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {item.file.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {(item.file.size / 1024).toFixed(1)} KB ·{" "}
                    {item.file.type || "unknown type"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    className={`status-badge ${getAttachmentStatusClass(item.status)}`}
                  >
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

      {savedReflection && state !== "saving" ? (
        <section
          className="enterprise-card mt-4 overflow-hidden"
          aria-labelledby="reflect-deeper-heading"
          aria-live="polite"
        >
          <div className="flex gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="reflect-deeper-heading"
                  className="text-sm font-semibold text-indigo-700 dark:text-indigo-300"
                >
                  Reflect deeper
                </h2>
                {isReflectionLoading ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Personalizing...
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-base leading-7 text-slate-800 dark:text-slate-200">
                {savedReflection.question}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode("write");
                    setDraft({
                      ...initialDraft,
                      title: `Reflection on ${savedReflection.entryTitle}`,
                      content: `${savedReflection.question}\n\n`,
                      mood: savedReflection.mood,
                    });
                    setAttachmentItems([]);
                    setState("idle");
                    setSavedReflection(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="action-primary px-4"
                >
                  Write a follow-up
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href={`/timeline#entry-${savedReflection.entryId}`}
                  className="action-quiet min-h-10 px-2 text-indigo-600 dark:text-indigo-300"
                >
                  View saved memory
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {captureMode === "write" ? (
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
      ) : null}
    </div>
  );
}
