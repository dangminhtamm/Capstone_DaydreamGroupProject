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
}

export async function generateGeminiJson<T>(
  options: GenerateGeminiJsonOptions<T>,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required to call Gemini.");
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: options.model,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
    },
  });

  const result = await model.generateContent(options.prompt);
  const text = result.response.text();
  const parsed = parseJsonResponse(text);

  return options.validator.parse(parsed);
}

function parseJsonResponse(text: string): unknown {
  const normalized = text.trim();

  try {
    return JSON.parse(normalized);
  } catch {
    const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }

    throw new Error(`Gemini returned invalid JSON: ${normalized.slice(0, 500)}`);
  }
}
