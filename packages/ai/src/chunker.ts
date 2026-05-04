// packages/ai/src/chunker.ts
import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { MemoryChunkMetadata } from "./chunk-types.ts";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SemanticChunkSchema = z.object({
  chunks: z.array(
    z.object({
      chunkType: z.enum([
        "feedback",
        "decision",
        "action_item",
        "reflection",
        "event",
        "general",
      ]),
      text: z.string().min(1),
      evidence: z.string().min(1).describe("Exact or near-exact source snippet from the diary"),
      people: z.array(z.string()).default([]),
      projects: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      importance: z.number().int().min(1).max(5),
    }),
  ),
});

export async function generateSemanticChunks(
  rawText: string,
  baseMetadata: Pick<
    MemoryChunkMetadata,
    "date" | "sourceType" | "sourceId" | "sourceTitle"
  >,
) {
  if (!rawText.trim()) return [];

  const prompt = `
You are the Memory Chunker for a personal Second Brain system.

Goal:
Split the diary into semantic memory chunks, not arbitrary character chunks.

Allowed chunk types:
- feedback: feedback received or given
- decision: a decision, commitment, or agreement
- action_item: a task or follow-up
- reflection: emotion, self-reflection, personal insight
- event: meeting, class, activity, appointment
- general: useful fact that does not fit above

Rules:
- Every chunk must be grounded in the source diary.
- Do not invent people, projects, dates, or outcomes.
- Keep chunk text self-contained.
- evidence must be copied or tightly paraphrased from the source.
- If the diary has no useful memory, return an empty chunks array.

Base metadata:
${JSON.stringify(baseMetadata, null, 2)}

Diary:
<diary>
${rawText}
</diary>
`.trim();

  const { output } = await generateText({
    model: google(process.env.GEMINI_CHUNK_MODEL ?? "gemini-1.5-pro"),
    prompt,
    output: Output.object({
      schema: SemanticChunkSchema,
      name: "semantic_memory_chunks",
      description: "Semantic chunks extracted from a diary entry for grounded retrieval",
    }),
  });

  return output.chunks.map((chunk, index) => ({
    text: chunk.text,
    evidence: chunk.evidence,
    metadata: {
      ...baseMetadata,
      chunkIndex: index,
      chunkType: chunk.chunkType,
      people: chunk.people,
      projects: chunk.projects,
      tags: chunk.tags,
      importance: chunk.importance,
    } satisfies MemoryChunkMetadata,
  }));
}