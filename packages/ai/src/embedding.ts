import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmbeddingProvider } from "./types.ts";

export type EmbeddingProviderName = "mock" | "gemini";

async function retry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (retries === 0) throw err;

    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      err.status === 503
    ) {
      console.warn("Retrying Gemini...");
      await new Promise((r) => setTimeout(r, 1000));
      return retry(fn, retries - 1);
    }

    throw err;
  }
}

export const DEFAULT_EMBEDDING_DIMENSION = 768;
export const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProviderName = "mock";
export const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimension: number;

  constructor(dimension: number = DEFAULT_EMBEDDING_DIMENSION) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const seed = Array.from(text).reduce(
      (total, character, index) => total + character.charCodeAt(0) * (index + 1),
      0
    );

    return Array.from({ length: this.dimension }, (_, index) => {
      const value = ((seed + (index + 1) * 31) % 1000) / 1000;
      return Number(value.toFixed(6));
    });
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private ai: GoogleGenerativeAI;
  readonly dimension = DEFAULT_EMBEDDING_DIMENSION;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error("GEMINI_API_KEY is required.");
    }

    this.ai = new GoogleGenerativeAI(key);
  }

  async embed(text: string): Promise<number[]> {
    const model = this.ai.getGenerativeModel({
      model: GEMINI_EMBEDDING_MODEL,
    });

    const result = await retry(async () =>
      model.embedContent({
        content: {
          role: "user",
          parts: [{ text }],
        },
        outputDimensionality: DEFAULT_EMBEDDING_DIMENSION,
      } as never)
    );

    if (!result.embedding?.values?.length) {
      throw new Error(
        `Gemini embedding request succeeded but returned no values for model "${GEMINI_EMBEDDING_MODEL}".`
      );
    }

    if (result.embedding.values.length !== DEFAULT_EMBEDDING_DIMENSION) {
      throw new Error(
        `Gemini embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSION}, got ${result.embedding.values.length}.`
      );
    }

    return result.embedding.values;
  }
}

export function getEmbeddingProviderName(
  providerName: string | undefined = process.env.AI_EMBEDDING_PROVIDER
): EmbeddingProviderName {
  return providerName === "gemini" ? "gemini" : "mock";
}

export function createEmbeddingProvider(
  providerName?: string,
  apiKey?: string
): EmbeddingProvider {
  const resolvedProvider = getEmbeddingProviderName(providerName);

  if (resolvedProvider === "gemini") {
    return new GeminiEmbeddingProvider(apiKey);
  }

  return new MockEmbeddingProvider();
}

export function createDefaultEmbeddingProvider(): EmbeddingProvider {
  return createEmbeddingProvider();
}
