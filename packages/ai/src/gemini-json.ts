import {
  GoogleGenerativeAI,
  type ResponseSchema,
} from "@google/generative-ai";
import type { z } from "zod";

export interface GenerateGeminiJsonOptions<T> {
  model: string;
  prompt: string;
  responseSchema: ResponseSchema;
  validator: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export interface GeminiJsonResultWithMeta<T> {
  data: T;
  tokenUsage: GeminiTokenUsage;
}

// Singleton Gemini client — avoids re-initialization overhead per request
let _geminiJsonClient: GoogleGenerativeAI | null = null;
function getGeminiJsonClient(): GoogleGenerativeAI {
  if (!_geminiJsonClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required to call Gemini.");
    _geminiJsonClient = new GoogleGenerativeAI(apiKey);
  }
  return _geminiJsonClient;
}

/**
 * Original function — returns only the parsed & validated JSON.
 * Preserved for backward compatibility with existing callers.
 */
export async function generateGeminiJson<T>(
  options: GenerateGeminiJsonOptions<T>,
): Promise<T> {
  const result = await generateGeminiJsonWithMeta(options);
  return result.data;
}

/**
 * Enhanced version — returns parsed JSON **plus** token usage metadata
 * from the Gemini API response. Used by answerMemory for observability.
 */
export async function generateGeminiJsonWithMeta<T>(
  options: GenerateGeminiJsonOptions<T>,
): Promise<GeminiJsonResultWithMeta<T>> {

  const ai = getGeminiJsonClient();
  const modelName = options.model;
  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
    },
  });

  let lastError: Error | null = null;
  const configuredRetries = Number(process.env.GEMINI_JSON_MAX_RETRIES ?? 2);
  const maxRetries = Number.isFinite(configuredRetries)
    ? Math.max(0, Math.floor(configuredRetries))
    : 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(options.prompt);
      const response = result.response;
      const text = response.text();
      const parsed = parseJsonResponse(text);
      const validated = options.validator.parse(parsed);

      // Extract token usage metadata from the Gemini response
      const usage = response.usageMetadata;
      const tokenUsage: GeminiTokenUsage = {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
        model: modelName,
      };

      return { data: validated, tokenUsage };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on transient/network errors, not on validation failures.
      const isTransient = isTransientGeminiError(lastError);

      if (!isTransient || attempt === maxRetries) break;

      const delayMs = getRetryDelayMs(lastError, attempt);
      console.warn(
        `[GeminiJSON] ${summarizeTransientError(lastError)}; retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1}).`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}

function isTransientGeminiError(error: Error): boolean {
  const status = getErrorStatus(error);
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    error.message.includes("ECONNRESET") ||
    error.message.includes("fetch failed")
  );
}

function getRetryDelayMs(error: Error, attempt: number): number {
  const configuredMax = Number(process.env.GEMINI_JSON_MAX_RETRY_DELAY_MS ?? 60_000);
  const maxDelayMs = Number.isFinite(configuredMax) ? configuredMax : 60_000;
  const status = getErrorStatus(error);
  const retryInfoDelay = extractRetryInfoDelayMs(error);

  if (retryInfoDelay !== null) {
    return clampDelay(retryInfoDelay, 1_000, maxDelayMs);
  }

  const baseDelayMs = status === 429 ? 15_000 : 5_000;
  const exponentialDelayMs = baseDelayMs * 2 ** attempt;
  return clampDelay(exponentialDelayMs, 1_000, maxDelayMs);
}

function extractRetryInfoDelayMs(error: Error): number | null {
  const details = (error as { errorDetails?: unknown }).errorDetails;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = (detail as { retryDelay?: unknown })?.retryDelay;
      const parsed = parseDurationToMs(retryDelay);
      if (parsed !== null) return parsed;
    }
  }

  const fromJson = error.message.match(/"retryDelay"\s*:\s*"([^"]+)"/);
  const parsedJsonDelay = parseDurationToMs(fromJson?.[1]);
  if (parsedJsonDelay !== null) return parsedJsonDelay;

  const fromText = error.message.match(/Please retry in ([\d.]+)s/i);
  if (fromText?.[1]) {
    return Math.ceil(Number(fromText[1]) * 1000);
  }

  return null;
}

function parseDurationToMs(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const seconds = value.match(/^([\d.]+)s$/);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000);

  const millis = value.match(/^([\d.]+)ms$/);
  if (millis) return Math.ceil(Number(millis[1]));

  return null;
}

function getErrorStatus(error: Error): number | undefined {
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status;

  const statusMatch = error.message.match(/\[(429|500|503)[^\]]*\]/);
  return statusMatch?.[1] ? Number(statusMatch[1]) : undefined;
}

function clampDelay(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function summarizeTransientError(error: Error): string {
  const status = getErrorStatus(error);
  const label =
    status === 429
      ? "429 quota/rate limit"
      : status === 503
        ? "503 service unavailable"
        : status === 500
          ? "500 server error"
          : "transient Gemini error";

  return `${label}: ${error.message.replace(/\s+/g, " ").slice(0, 180)}`;
}

function parseJsonResponse(text: string): unknown {
  let normalized = text.trim();

  // Step 1: Strip markdown fences if present
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    normalized = fenced[1].trim();
  }

  // Step 2: Try direct parse
  try {
    return JSON.parse(normalized);
  } catch {
    // continue to fallback
  }

  // Step 3: Attempt to repair truncated JSON by closing open brackets
  const repaired = attemptJsonRepair(normalized);
  if (repaired !== null) {
    return repaired;
  }

  // Step 4: Try to extract the first JSON-like object or array
  const objectMatch = normalized.match(/(\{[\s\S]*)/)
    || normalized.match(/(\[[\s\S]*)/);
  if (objectMatch) {
    const fragment = objectMatch[1];
    const repairedFragment = attemptJsonRepair(fragment);
    if (repairedFragment !== null) {
      return repairedFragment;
    }
  }

  throw new Error(`Gemini returned invalid JSON that could not be repaired: ${normalized.slice(0, 500)}`);
}

/**
 * Attempt to repair truncated JSON by appending missing closing brackets.
 * Returns the parsed object on success, or null if repair fails.
 */
function attemptJsonRepair(text: string): unknown | null {
  // Count open vs close brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const char of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") braces++;
    else if (char === "}") braces--;
    else if (char === "[") brackets++;
    else if (char === "]") brackets--;
  }

  // If already balanced, nothing to repair
  if (braces === 0 && brackets === 0) return null;

  // Only attempt repair for truncated output (missing closing chars)
  if (braces < 0 || brackets < 0) return null;

  // Close any open string
  let repaired = inString ? text + '"' : text;

  // Append missing brackets/braces in the correct order
  repaired += "]".repeat(brackets);
  repaired += "}".repeat(braces);

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}
