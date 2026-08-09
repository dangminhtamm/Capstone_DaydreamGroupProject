import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { generateGeminiJson } from "./gemini-json.ts";
import { getGeminiChunkModel } from "./gemini-models.ts";
import { withMemoryDate, type MemoryChunkMetadata } from "./types.ts";

const ALLOWED_CHUNK_TYPES = [
  "feedback",
  "decision",
  "action_item",
  "reflection",
  "event",
  "general",
] as const;

type SemanticChunkType = typeof ALLOWED_CHUNK_TYPES[number];

export function normalizeSemanticChunkType(value: unknown): SemanticChunkType {
  if (typeof value !== "string") return "general";

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if ((ALLOWED_CHUNK_TYPES as readonly string[]).includes(normalized)) {
    return normalized as SemanticChunkType;
  }

  const aliases: Record<string, SemanticChunkType> = {
    action: "action_item",
    task: "action_item",
    todo: "action_item",
    to_do: "action_item",
    follow_up: "action_item",
    followup: "action_item",
    assignment: "action_item",
    feedback_received: "feedback",
    feedback_given: "feedback",
    choice: "decision",
    commitment: "decision",
    agreement: "decision",
    insight: "reflection",
    emotion: "reflection",
    mood: "reflection",
    activity: "event",
    meeting: "event",
    appointment: "event",
    note: "general",
    general_note: "general",
    memory: "general",
    fact: "general",
  };

  return aliases[normalized] ?? "general";
}

const SemanticChunkSchema = z.object({
  chunks: z.array(
    z.object({
      chunkType: z.preprocess(
        normalizeSemanticChunkType,
        z.enum(ALLOWED_CHUNK_TYPES),
      ),
      text: z.string().min(1),
      evidence: z.string().min(1).describe("Exact or near-exact source snippet from the diary"),
      people: z.array(z.string()).default([]),
      projects: z.array(z.string()).default([]),
      goals: z.array(z.string()).default([]),
      habits: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      importance: z.preprocess(
        (value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return 3;
          return Math.min(5, Math.max(1, Math.round(parsed)));
        },
        z.number().int().min(1).max(5),
      ),
    }),
  ),
});

const GeminiSemanticChunkResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    chunks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          chunkType: {
            type: SchemaType.STRING,
            description:
              "One of feedback, decision, action_item, reflection, event, general.",
          },
          text: { type: SchemaType.STRING },
          evidence: {
            type: SchemaType.STRING,
            description: "Exact or near-exact source snippet from the diary.",
          },
          people: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          projects: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          goals: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Goals, targets, or objectives mentioned (e.g., 'graduate by June', 'lose 5kg').",
          },
          habits: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Recurring habits or routines mentioned (e.g., 'morning jog', 'daily reading').",
          },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          importance: { type: SchemaType.INTEGER },
        },
        required: [
          "chunkType",
          "text",
          "evidence",
          "people",
          "projects",
          "goals",
          "habits",
          "tags",
          "importance",
        ],
      },
    },
  },
  required: ["chunks"],
};

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
- importance must be an integer from 1 to 5.
- goals: extract any mentioned objectives, targets, or aspirations (e.g., "finish capstone by June", "save 10M VND").
- habits: extract any recurring routines or behavioural patterns (e.g., "morning run", "daily journaling", "weekly review").
- If the diary has no useful memory, return an empty chunks array.

Base metadata:
${JSON.stringify(baseMetadata, null, 2)}

Diary:
<diary>
${rawText}
</diary>
`.trim();

  const output = await generateGeminiJson({
    model: getGeminiChunkModel(),
    prompt,
    responseSchema: GeminiSemanticChunkResponseSchema,
    validator: SemanticChunkSchema,
  });

  return output.chunks.map((chunk, index) => ({
    text: chunk.text,
    evidence: chunk.evidence,
    metadata: withMemoryDate({
      ...baseMetadata,
      chunkIndex: index,
      chunkType: chunk.chunkType,
      people: chunk.people,
      projects: chunk.projects,
      goals: chunk.goals,
      habits: chunk.habits,
      tags: chunk.tags,
      importance: chunk.importance,
    } satisfies MemoryChunkMetadata),
  }));
}
