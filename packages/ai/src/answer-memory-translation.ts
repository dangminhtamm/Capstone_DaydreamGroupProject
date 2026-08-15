import { z } from "zod";
import {
  generateTuturuuuJsonWithMeta,
  type TuturuuuJsonResultWithMeta,
} from "./tuturuuu-json.ts";
import { getTuturuuuAnswerModel } from "./tuturuuu-models.ts";
import type {
  AnswerMemoryResult,
  ResponseLanguage,
} from "./answer-memory-types.ts";

const FastTranslatedAnswerSchema = z.object({
  answer: z.preprocess(normalizeTranslatedAnswer, z.string().min(1)),
});

type FastTranslatedAnswer = z.infer<typeof FastTranslatedAnswerSchema>;

const TuturuuuFastTranslatedAnswerResponseSchema = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "The translated or lightly polished answer.",
    },
  },
  required: ["answer"],
};

export type FastTranslationGenerator = (
  options: Parameters<typeof generateTuturuuuJsonWithMeta<FastTranslatedAnswer>>[0],
) => Promise<TuturuuuJsonResultWithMeta<FastTranslatedAnswer>>;

export async function translateFastAnswerIfUseful(
  result: AnswerMemoryResult,
  options: {
    question: string;
    responseLanguage: ResponseLanguage;
    generateTranslation?: FastTranslationGenerator;
  },
): Promise<AnswerMemoryResult> {
  if (!shouldTranslateFastAnswer(result, options.responseLanguage)) {
    return result;
  }

  const generateStart = performance.now();
  try {
    const tuturuuuResult = await (options.generateTranslation ?? generateTuturuuuJsonWithMeta)({
      model: getTuturuuuAnswerModel(),
      prompt: buildFastTranslationPrompt({
        question: options.question,
        answer: result.answer,
        answerMode: result.answerMode,
        responseLanguage: options.responseLanguage,
      }),
      responseSchema: TuturuuuFastTranslatedAnswerResponseSchema,
      validator: FastTranslatedAnswerSchema,
      temperature: 0,
      maxOutputTokens: getFastTranslationMaxTokens(result.answerMode),
      maxRetries: 0,
      maxFormatRetries: 0,
    });
    const generateMs = Math.round(performance.now() - generateStart);
    const translatedAnswer = sanitizeTranslatedAnswer(tuturuuuResult.data.answer);
    if (!translatedAnswer) return result;

    return {
      ...result,
      answer: translatedAnswer,
      analytics: result.analytics
        ? {
            ...result.analytics,
            tokenUsage: tuturuuuResult.tokenUsage,
            timing: {
              ...result.analytics.timing,
              generateMs,
            },
          }
        : result.analytics,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AnswerMemory] Fast translation skipped: ${message.replace(/\s+/g, " ").slice(0, 180)}`);
    return result;
  }
}

export function shouldTranslateFastAnswer(
  result: AnswerMemoryResult,
  responseLanguage: ResponseLanguage,
): boolean {
  if (process.env.MEMORY_FAST_TRANSLATION_ENABLED === "false") return false;
  if (
    result.answerMode !== "fast_path" &&
    result.answerMode !== "extractive_fallback" &&
    result.answerMode !== "tuturuuu"
  ) {
    return false;
  }
  if (!result.citations.length) return false;

  if (answerLanguageNeedsPolish(result.answer, responseLanguage)) return true;

  if (result.answerMode === "tuturuuu") return false;
  if (result.answerMode === "fast_path" && result.analytics?.tokenUsage.totalTokens) return false;

  return responseLanguage === "vi"
    ? result.citations.some((citation) => citationSourceLanguage(citation) === "en")
    : result.citations.some((citation) => citationSourceLanguage(citation) === "vi");
}

function buildFastTranslationPrompt(input: {
  question: string;
  answer: string;
  answerMode: AnswerMemoryResult["answerMode"];
  responseLanguage: ResponseLanguage;
}): string {
  const targetLanguage = input.responseLanguage === "vi" ? "Vietnamese" : "English";
  const styleInstruction = input.responseLanguage === "vi"
    ? [
        'Viết tiếng Việt tự nhiên, dùng "mình" cho assistant và "bạn" cho user.',
        "Dịch toàn bộ câu/cụm tiếng Anh thông thường sang tiếng Việt; không để sót câu tiếng Anh trong phần trả lời.",
        "Chỉ giữ nguyên tên riêng, ngày tháng, tên sản phẩm/kỹ thuật như API, Redis, Calendar, Gmail, Drive, worker, indexing outbox, source cards.",
      ].join(" ")
    : "Write natural English; translate ordinary Vietnamese sentences into English while preserving names, dates, products, and technical terms.";
  const structureInstruction = input.answerMode === "extractive_fallback"
    ? "Preserve paragraph breaks, section headings, and bullet list structure. Keep one bullet per source line."
    : "Preserve useful paragraph breaks when present.";

  return `
You are a tiny translation/polishing layer for a personal memory search system.

Question:
${input.question}

Existing answer:
${input.answer}

Task:
- Translate or lightly polish the existing retrieved answer into ${targetLanguage}.
- ${styleInstruction}
- ${structureInstruction}
- Do not add, remove, or infer facts.
- Preserve all dates, names, project names, and technical terms exactly when appropriate.
- Keep the answer concise and natural.
- Do not mention citations, source ids, Tuturuuu, retrieval, or implementation details.
- Return ONLY a compact JSON object with exactly this shape: {"answer":"..."}.
`.trim();
}

function getFastTranslationMaxTokens(answerMode: AnswerMemoryResult["answerMode"]): number {
  const defaultTokens = answerMode === "extractive_fallback" ? 360 : 180;
  const configured = Number(process.env.MEMORY_FAST_TRANSLATION_MAX_TOKENS ?? defaultTokens);
  if (!Number.isFinite(configured)) return defaultTokens;
  return Math.min(Math.max(Math.trunc(configured), 80), 520);
}

function sanitizeTranslatedAnswer(answer: string): string {
  return normalizeBulletLineBreaks(answer)
    .replace(/\*\*/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBulletLineBreaks(answer: string): string {
  return answer
    .replace(/([^\n])\s+(Công việc chính|Blockers\/rủi ro|Quyết định quan trọng|Next steps|Main work|Blockers\/risks|Key decisions)\s*\n?/g, "$1\n\n$2\n")
    .replace(/([^\n])\s+-\s+/g, "$1\n- ")
    .replace(/([^\n])\s+-\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}:)/g, "$1\n- $2")
    .replace(/([^\n])\s+-\s+(\d{4}-\d{2}-\d{2}:)/g, "$1\n- $2");
}

function normalizeTranslatedAnswer(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(" ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["answer", "text", "translation", "response"]) {
      if (typeof record[key] === "string") return record[key].trim();
    }
  }
  return value;
}

function hasEnglishDominantSegment(text: string): boolean {
  return splitAnswerSegments(text).some((segment) => {
    const english = countEnglishSignals(segment);
    const vietnamese = countVietnameseSignals(segment);
    return english >= 5 && english > vietnamese * 1.5;
  });
}

function hasVietnameseDominantSegment(text: string): boolean {
  return splitAnswerSegments(text).some((segment) => {
    const vietnamese = countVietnameseSignals(segment);
    const english = countEnglishSignals(segment);
    return vietnamese >= 3 && vietnamese > english;
  });
}

function answerLanguageNeedsPolish(
  answer: string,
  responseLanguage: ResponseLanguage,
): boolean {
  const normalized = answer.trim();
  if (!normalized) return false;

  return responseLanguage === "vi"
    ? hasEnglishDominantSegment(normalized)
    : hasVietnameseDominantSegment(normalized);
}

function citationSourceLanguage(
  citation: AnswerMemoryResult["citations"][number],
): ResponseLanguage | "unknown" {
  const sourceText = [
    citation.quote,
    citation.claim,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");

  if (!sourceText.trim()) return "unknown";
  const vietnamese = countVietnameseSignals(sourceText);
  const english = countEnglishSignals(sourceText);

  if (vietnamese >= 2 && vietnamese >= english) return "vi";
  if (english >= 2 && english > vietnamese * 1.5) return "en";
  if (hasVietnameseDominantSegment(sourceText)) return "vi";
  if (hasEnglishDominantSegment(sourceText)) return "en";
  return "unknown";
}

function splitAnswerSegments(text: string): string[] {
  return text
    .split(/[\n.!?。！？]+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 12);
}

function countEnglishSignals(text: string): number {
  const words = text.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [];
  return words.filter((word) => !isMostlyTechnicalToken(word)).length;
}

function countVietnameseSignals(text: string): number {
  const words = text.match(/[\p{Letter}][\p{Letter}'-]{1,}/gu) ?? [];
  return words.filter((word) => {
    const normalized = word.toLowerCase();
    return hasVietnameseDiacritic(normalized) || VIETNAMESE_COMMON_WORDS.has(normalized);
  }).length;
}

function hasVietnameseDiacritic(text: string): boolean {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(text);
}

function isMostlyTechnicalToken(word: string): boolean {
  return TECHNICAL_TOKENS.has(word.toLowerCase());
}

const VIETNAMESE_COMMON_WORDS = new Set([
  "ban",
  "bạn",
  "cua",
  "của",
  "da",
  "đã",
  "dang",
  "đang",
  "de",
  "để",
  "duoc",
  "được",
  "gi",
  "gì",
  "hom",
  "hôm",
  "khong",
  "không",
  "la",
  "là",
  "lam",
  "làm",
  "minh",
  "mình",
  "ngay",
  "ngày",
  "nhat",
  "nhật",
  "nhung",
  "nhưng",
  "tai",
  "tại",
  "thang",
  "tháng",
  "thi",
  "thì",
  "toi",
  "tôi",
  "tuan",
  "tuần",
  "va",
  "và",
  "ve",
  "về",
]);

const TECHNICAL_TOKENS = new Set([
  "api",
  "app",
  "attachment",
  "cache",
  "calendar",
  "chunk",
  "chunks",
  "ci",
  "debug",
  "demo",
  "diary",
  "drive",
  "fast",
  "gmail",
  "google",
  "indexing",
  "outbox",
  "tuturuuu",
  "json",
  "latency",
  "memory",
  "model",
  "p95",
  "redis",
  "retrieval",
  "source",
  "sources",
  "token",
  "tokens",
  "ui",
  "ux",
  "worker",
]);
