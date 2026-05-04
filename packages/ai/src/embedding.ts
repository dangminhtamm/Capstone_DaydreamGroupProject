import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmbeddingProvider } from "./types.ts";

export type EmbeddingProviderName = "gemini";
export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

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
      console.warn("Retrying Gemini embedding request...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return retry(fn, retries - 1);
    }

    throw err;
  }
}

// Hàm chuẩn hóa Vector (Bắt buộc cho cosine distance của Gemini embedding)
function normalize(values: number[]): number[] {
  const norm = Math.hypot(...values);
  if (!norm) return values;
  return values.map((v) => v / norm);
}

export const DEFAULT_EMBEDDING_DIMENSION = 768;
export const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProviderName = "gemini";

export const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

export interface AdvancedEmbeddingProvider extends EmbeddingProvider {
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
}

export class GeminiEmbeddingProvider implements AdvancedEmbeddingProvider {
  private ai: GoogleGenerativeAI;
  readonly dimension = DEFAULT_EMBEDDING_DIMENSION;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is required. Embeddings cannot run without a real provider."
      );
    }

    this.ai = new GoogleGenerativeAI(key);
  }

  async embedDocument(text: string): Promise<number[]> {
    return this.embed(text, "RETRIEVAL_DOCUMENT");
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embed(text, "RETRIEVAL_QUERY");
  }

  async embed(text: string, taskType: EmbeddingTask = "RETRIEVAL_DOCUMENT"): Promise<number[]> {
    if (!text.trim()) {
      throw new Error("Cannot embed empty text.");
    }

    const model = this.ai.getGenerativeModel({
      model: GEMINI_EMBEDDING_MODEL,
    });

    const result = await retry(async () =>
      model.embedContent({
        content: {
          role: "user",
          parts: [{ text }],
        },
        taskType, 
        outputDimensionality: DEFAULT_EMBEDDING_DIMENSION,
      } as never)
    );

    const values = result.embedding?.values;

    if (!values?.length) {
      throw new Error(
        `Gemini embedding request succeeded but returned no values for model "${GEMINI_EMBEDDING_MODEL}".`
      );
    }

    if (values.length !== DEFAULT_EMBEDDING_DIMENSION) {
      throw new Error(
        `Gemini embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSION}, got ${values.length}.`
      );
    }

    return normalize(values);
  }
}

export function getEmbeddingProviderName(
  providerName: string | undefined = process.env.AI_EMBEDDING_PROVIDER
): EmbeddingProviderName {
  if (!providerName || providerName === "gemini") {
    return "gemini";
  }

  throw new Error(
    `Unsupported embedding provider "${providerName}". Only "gemini" is supported.`
  );
}

export function createEmbeddingProvider(
  providerName?: string,
  apiKey?: string
): AdvancedEmbeddingProvider {
  getEmbeddingProviderName(providerName);
  return new GeminiEmbeddingProvider(apiKey);
}

export function createDefaultEmbeddingProvider(): AdvancedEmbeddingProvider {
  return createEmbeddingProvider();
}