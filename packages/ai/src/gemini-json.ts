import {
  GoogleGenerativeAI,
  type ResponseSchema,
} from "@google/generative-ai";
import { ZodError, type z } from "zod";

export interface GenerateGeminiJsonOptions<T> {
  model: string;
  prompt: string;
  responseSchema: ResponseSchema;
  validator: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  maxFormatRetries?: number;
  maxRetryDelayMs?: number;
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
  const configuredRetries = Number(options.maxRetries ?? process.env.GEMINI_JSON_MAX_RETRIES ?? 2);
  const maxRetries = Number.isFinite(configuredRetries)
    ? Math.max(0, Math.floor(configuredRetries))
    : 2;
  const configuredFormatRetries = Number(options.maxFormatRetries ?? process.env.GEMINI_JSON_FORMAT_RETRIES ?? 1);
  const maxFormatRetries = Number.isFinite(configuredFormatRetries)
    ? Math.max(0, Math.floor(configuredFormatRetries))
    : 1;
  let formatRetries = 0;
  let transientRetries = 0;
  const maxAttempts = maxRetries + maxFormatRetries;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const prompt = formatRetries > 0
        ? buildJsonOnlyRetryPrompt(options.prompt, lastError)
        : options.prompt;
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      assertGeminiResponseComplete(response, text);
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

      if (isJsonFormatError(lastError) && formatRetries < maxFormatRetries) {
        formatRetries++;
        maybeLogInvalidJson(lastError);
        continue;
      }

      // Only retry on transient/network errors after format repair attempts.
      const isTransient = isTransientGeminiError(lastError);
      if (isQuotaExhaustedError(lastError)) break;

      if (!isTransient || transientRetries >= maxRetries) break;

      const delayMs = getRetryDelayMs(lastError, transientRetries, options.maxRetryDelayMs);
      transientRetries++;
      console.warn(
        `[GeminiJSON] ${summarizeTransientError(lastError)}; retrying in ${delayMs}ms (attempt ${transientRetries}/${maxRetries}).`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}

function buildJsonOnlyRetryPrompt(originalPrompt: string, error: Error | null): string {
  const errorHint = error ? summarizeJsonFormatError(error) : "The previous response was not valid JSON.";

  return `
${originalPrompt}

The previous response could not be parsed by the application.
Reason: ${errorHint}

Return ONLY one valid JSON object.
Do not include markdown fences, prose, comments, trailing commas, or text before/after the JSON.
The JSON must match the requested schema exactly.
`.trim();
}

function isJsonFormatError(error: Error): boolean {
  return (
    error instanceof ZodError ||
    error.message.includes("Gemini returned invalid JSON") ||
    error.message.includes("could not be repaired") ||
    error.message.includes("truncated") ||
    error.message.includes("finishReason") ||
    error.message.includes("Unexpected token") ||
    error.message.includes("Unexpected end of JSON input")
  );
}

function assertGeminiResponseComplete(response: unknown, text: string): void {
  const finishReason = getGeminiFinishReason(response);
  if (!finishReason || finishReason === "STOP") return;

  const preview = text.replace(/\s+/g, " ").slice(0, 180);
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      `Gemini response was truncated before valid JSON could be completed (finishReason=${finishReason}). Partial output: ${preview}`,
    );
  }

  throw new Error(
    `Gemini response did not finish normally (finishReason=${finishReason}). Partial output: ${preview}`,
  );
}

function getGeminiFinishReason(response: unknown): string | undefined {
  const candidates = (response as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates)) return undefined;

  const finishReason = (candidates[0] as { finishReason?: unknown } | undefined)?.finishReason;
  return typeof finishReason === "string" ? finishReason : undefined;
}

function summarizeJsonFormatError(error: Error): string {
  if (error instanceof ZodError) {
    const issues = error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return `Schema validation failed${issues ? ` (${issues})` : ""}.`;
  }

  return error.message.replace(/\s+/g, " ").slice(0, 220);
}

function maybeLogInvalidJson(error: Error): void {
  if (process.env.GEMINI_JSON_LOG_INVALID !== "1") return;
  console.warn(`[GeminiJSON] Retrying because JSON output was invalid: ${summarizeJsonFormatError(error)}`);
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

function isQuotaExhaustedError(error: Error): boolean {
  const status = getErrorStatus(error);
  if (status !== 429) return false;

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("current quota") ||
    normalized.includes("plan and billing") ||
    normalized.includes("billing details")
  );
}

function getRetryDelayMs(
  error: Error,
  attempt: number,
  maxRetryDelayMs?: number,
): number {
  const configuredMax = Number(maxRetryDelayMs ?? process.env.GEMINI_JSON_MAX_RETRY_DELAY_MS ?? 60_000);
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

export function parseJsonResponse(text: string): unknown {
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

  // Step 3: Extract a valid JSON object/array from surrounding prose.
  const balancedCandidate = extractFirstBalancedJsonCandidate(normalized);
  if (balancedCandidate !== null && balancedCandidate !== normalized) {
    try {
      return JSON.parse(balancedCandidate);
    } catch {
      const repairedCandidate = attemptJsonRepair(balancedCandidate);
      if (repairedCandidate !== null) {
        return repairedCandidate;
      }
    }
  }

  // Step 4: Attempt to repair truncated JSON by closing open brackets
  const repaired = attemptJsonRepair(normalized);
  if (repaired !== null) {
    return repaired;
  }

  // Step 5: Try to extract the first JSON-like object or array
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

function extractFirstBalancedJsonCandidate(text: string): string | null {
  const start = findJsonStart(text);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];

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

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = stack.pop();
      if (expected !== char) return null;
      if (stack.length === 0) {
        return text.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

function findJsonStart(text: string): number {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");

  if (objectStart === -1) return arrayStart;
  if (arrayStart === -1) return objectStart;
  return Math.min(objectStart, arrayStart);
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
