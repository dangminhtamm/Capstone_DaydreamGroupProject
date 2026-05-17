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

export async function generateGeminiJson<T>(
  options: GenerateGeminiJsonOptions<T>,
): Promise<T> {

  const ai = getGeminiJsonClient();
  const model = ai.getGenerativeModel({
    model: options.model,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
    },
  });

  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(options.prompt);
      const text = result.response.text();
      const parsed = parseJsonResponse(text);

      return options.validator.parse(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on transient/network errors, not on validation failures
      const isTransient =
        lastError.message.includes("500") ||
        lastError.message.includes("503") ||
        lastError.message.includes("429") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("fetch failed");

      if (!isTransient || attempt === maxRetries) break;

      const delayMs = 1000 * (attempt + 1);
      console.warn(
        `[GeminiJSON] Transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms:`,
        lastError.message,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
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
