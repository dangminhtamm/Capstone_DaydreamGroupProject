import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import {
  generateGeminiJsonWithMeta,
  type GeminiJsonResultWithMeta,
} from "./gemini-json.ts";
import { getGeminiAnswerModel } from "./gemini-models.ts";
import type {
  AnswerMemoryResult,
  ResponseLanguage,
} from "./answer-memory-types.ts";

const FastTranslatedAnswerSchema = z.object({
  answer: z.preprocess(normalizeTranslatedAnswer, z.string().min(1)),
});

type FastTranslatedAnswer = z.infer<typeof FastTranslatedAnswerSchema>;

const GeminiFastTranslatedAnswerResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: {
      type: SchemaType.STRING,
      description: "The translated or lightly polished answer.",
    },
  },
  required: ["answer"],
};

export type FastTranslationGenerator = (
  options: Parameters<typeof generateGeminiJsonWithMeta<FastTranslatedAnswer>>[0],
) => Promise<GeminiJsonResultWithMeta<FastTranslatedAnswer>>;

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
    const geminiResult = await (options.generateTranslation ?? generateGeminiJsonWithMeta)({
      model: getGeminiAnswerModel(),
      prompt: buildFastTranslationPrompt({
        question: options.question,
        answer: result.answer,
        responseLanguage: options.responseLanguage,
      }),
      responseSchema: GeminiFastTranslatedAnswerResponseSchema,
      validator: FastTranslatedAnswerSchema,
      temperature: 0,
      maxOutputTokens: getFastTranslationMaxTokens(),
      maxRetries: 0,
      maxFormatRetries: 0,
    });
    const generateMs = Math.round(performance.now() - generateStart);
    const translatedAnswer = sanitizeTranslatedAnswer(geminiResult.data.answer);
    if (!translatedAnswer) return result;

    return {
      ...result,
      answer: translatedAnswer,
      analytics: result.analytics
        ? {
            ...result.analytics,
            tokenUsage: geminiResult.tokenUsage,
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
  if (result.answerMode !== "fast_path") return false;
  if (!result.citations.length) return false;
  if (result.analytics?.tokenUsage.totalTokens) return false;

  return responseLanguage === "vi"
    ? hasEnglishDominantSegment(result.answer)
    : hasVietnameseDominantSegment(result.answer);
}

function buildFastTranslationPrompt(input: {
  question: string;
  answer: string;
  responseLanguage: ResponseLanguage;
}): string {
  const targetLanguage = input.responseLanguage === "vi" ? "Vietnamese" : "English";
  const styleInstruction = input.responseLanguage === "vi"
    ? 'Viết tiếng Việt tự nhiên, dùng "mình" cho assistant và "bạn" cho user.'
    : "Write natural English.";

  return `
You are a tiny translation/polishing layer for a personal memory search system.

Question:
${input.question}

Existing fast answer:
${input.answer}

Task:
- Translate or lightly polish the existing fast answer into ${targetLanguage}.
- ${styleInstruction}
- Do not add, remove, or infer facts.
- Preserve all dates, names, project names, and technical terms exactly when appropriate.
- Keep the answer concise and natural.
- Do not mention citations, source ids, Gemini, retrieval, or implementation details.
- Return ONLY a compact JSON object with exactly this shape: {"answer":"..."}.
`.trim();
}

function getFastTranslationMaxTokens(): number {
  const configured = Number(process.env.MEMORY_FAST_TRANSLATION_MAX_TOKENS ?? 180);
  if (!Number.isFinite(configured)) return 180;
  return Math.min(Math.max(Math.trunc(configured), 80), 320);
}

function sanitizeTranslatedAnswer(answer: string): string {
  return answer
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  "cache",
  "chunk",
  "chunks",
  "ci",
  "debug",
  "demo",
  "fast",
  "gemini",
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
