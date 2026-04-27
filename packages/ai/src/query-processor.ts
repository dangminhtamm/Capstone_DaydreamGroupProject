import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmbeddingProvider, QueryResult, SearchResult } from "./types.ts";

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

/**
 * The RAG system prompt.
 *
 * Design principles:
 *  - Answer ONLY from the provided context chunks (prevents hallucination)
 *  - Always cite which chunk(s) the answer comes from using [Source N]
 *  - If the context is insufficient, say so honestly
 *  - Keep answers concise but complete
 *  - Works for both Vietnamese and English input
 */
const SYSTEM_PROMPT = `You are "Second Brain", a personal AI memory assistant.
Your job is to answer questions about the user's diary entries, meetings, tasks, and decisions.

Rules you MUST follow:
1. Answer ONLY using information from the CONTEXT CHUNKS provided below.
2. If the context does not contain enough information to answer the question, respond with:
   "I don't have enough information in your notes to answer that."
3. Always cite your sources using [Source N] after every statement that comes from a chunk.
4. Be concise. Do not add advice, opinions, or information not present in the context.
5. If the question is in Vietnamese, answer in Vietnamese. Otherwise, answer in English.
6. At the end of your answer, include a "Sources used:" section listing each [Source N] you cited.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A function that takes a query embedding and returns the most relevant chunks.
 * By accepting this as a parameter, the query processor stays fully decoupled
 * from the DB package — you can swap out any retrieval backend.
 */
export type SearchFn = (queryEmbedding: number[]) => Promise<SearchResult[]>;

export interface ProcessQueryOptions {
  /** The natural language question from the user. */
  query: string;

  /** Embedding provider used to embed the query before searching. */
  embeddingProvider: EmbeddingProvider;

  /**
   * The retrieval function. Called with the query embedding; must return
   * the top-K most relevant chunks (already filtered & ranked by the caller).
   *
   * @example
   * ```ts
   * searchFn: (embedding) =>
   *   vectorSearch(prisma, embedding, { userId, topK: 8, minSimilarity: 0.5 })
   * ```
   */
  searchFn: SearchFn;

  /**
   * Gemini text model to use for answer generation.
   * Defaults to the GEMINI_TEXT_MODEL env var, or "gemini-2.5-flash".
   */
  model?: string;

  /** Gemini API key. Defaults to process.env.GEMINI_API_KEY. */
  apiKey?: string;
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/**
 * Formats the retrieved chunks into a numbered context block for the prompt.
 * Each chunk becomes a clearly-labelled [Source N] that the model can cite.
 */
function buildContextBlock(chunks: SearchResult[]): string {
  if (chunks.length === 0) {
    return "(No relevant chunks found in memory.)";
  }

  return chunks
    .map((chunk, index) => {
      const date =
        typeof chunk.metadata["date"] === "string"
          ? chunk.metadata["date"]
          : chunk.createdAt.toISOString().slice(0, 10);

      return [
        `[Source ${index + 1}]`,
        `Type: ${chunk.chunkType}`,
        `Source: ${chunk.sourceType} / ${chunk.sourceId}`,
        `Date: ${date}`,
        `Similarity: ${chunk.similarity.toFixed(4)}`,
        `Content: ${chunk.text}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * The full RAG pipeline in one call:
 *
 * 1. Embeds the user's question with the provided embedding provider.
 * 2. Calls `searchFn` to retrieve the most relevant memory chunks.
 * 3. Injects those chunks into a structured prompt as numbered [Source N] blocks.
 * 4. Sends the prompt to Gemini and returns its grounded answer.
 * 5. Returns both the answer text and the source chunks (for UI citation rendering).
 *
 * @example
 * ```ts
 * const { answer, sources } = await processQuery({
 *   query: "What did I decide about the sprint last week?",
 *   embeddingProvider: new GeminiEmbeddingProvider(apiKey),
 *   searchFn: (emb) => vectorSearch(prisma, emb, { userId, topK: 8 }),
 * });
 *
 * console.log(answer);
 * // "You decided to postpone the notification redesign until next sprint [Source 1]."
 * ```
 */
export async function processQuery(options: ProcessQueryOptions): Promise<QueryResult> {
  const {
    query,
    embeddingProvider,
    searchFn,
    model = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
    apiKey = process.env.GEMINI_API_KEY ?? "",
  } = options;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for answer generation.");
  }

  // Step 1 — Embed the user's question
  const queryEmbedding = await embeddingProvider.embed(query);

  // Step 2 — Retrieve the most relevant chunks
  const sources = await searchFn(queryEmbedding);

  // Step 3 — Build the context block from retrieved chunks
  const contextBlock = buildContextBlock(sources);

  // Step 4 — Assemble the full prompt
  const userPrompt = `CONTEXT CHUNKS FROM USER'S MEMORY:
${contextBlock}

---

QUESTION: ${query}

Answer (remember to cite [Source N] for every claim):`;

  // Step 5 — Call Gemini for the grounded answer
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await geminiModel.generateContent(userPrompt);
  const answer = result.response.text().trim();

  return { answer, sources };
}
