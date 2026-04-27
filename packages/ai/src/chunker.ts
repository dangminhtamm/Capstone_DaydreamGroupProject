import { GoogleGenerativeAI } from "@google/generative-ai";
import { CHUNK_TYPES, type ChunkType } from "./chunk-types.ts";
import type {
  ChunkedMemoryChunk,
  ChunkingOptions,
  MemoryChunkMetadata,
} from "./types.ts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
});

function inferChunkTypeLocally(sentence: string): ChunkType {
  const lowered = sentence.toLowerCase();

  if (/\b(decided|agreed|approved|settled|chốt|quyết định)\b/.test(lowered)) {
    return "decision";
  }

  if (/\b(met with|meeting|sync|discussed|standup|team|họp)\b/.test(lowered)) {
    return "meeting_outcome";
  }

  if (/\b(feedback|concern|confused|asked for|suggested|góp ý|phản hồi)\b/.test(lowered)) {
    return "feedback";
  }

  if (/\b(todo|need to|follow up|next step|action item|will do|phải|cần)\b/.test(lowered)) {
    return "action_item";
  }

  if (/\b(finished|completed|shipped|implemented|drafted|sent|xong|hoàn thành)\b/.test(lowered)) {
    return "task_update";
  }

  if (/\b(felt|feeling|worried|excited|calm|stressed|relieved|thoải mái|áp lực)\b/.test(lowered)) {
    return "emotional_reflection";
  }

  return "general_note";
}

function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map(normalizeSentence)
    .filter(Boolean);
}

export async function inferChunkType(sentence: string): Promise<ChunkType> {
  if (process.env.AI_CLASSIFIER_MODE === "local" || !process.env.GEMINI_API_KEY) {
    return inferChunkTypeLocally(sentence);
  }

  const prompt = `
You are an expert text classification assistant.
Categorize the following sentence (which may be in Vietnamese) into EXACTLY ONE of these categories:

- decision
- meeting_outcome
- feedback
- action_item
- task_update
- emotional_reflection
- general_note

Sentence: "${sentence}"

Respond ONLY with ONE word from the list above. No explanation.
`;

  try {
    const result = await model.generateContent(prompt);

    const rawText = result.response.text();
    const cleaned = rawText
      .replace(/[`"]/g, "")
      .trim()
      .toLowerCase();

    if (CHUNK_TYPES.includes(cleaned as ChunkType)) {
      return cleaned as ChunkType;
    }

    console.warn(
      `[AI Warning] Invalid category returned: "${rawText}" -> Cleaned: "${cleaned}"`
    );

    return "general_note";
  } catch (error) {
    console.warn("AI Classification failed, falling back to local classifier:", error);
    return inferChunkTypeLocally(sentence);
  }
}

async function buildChunk(
  sentence: string, 
  options: ChunkingOptions
): Promise<ChunkedMemoryChunk> {
  const chunkType = await inferChunkType(sentence);

  const sourceType = options.sourceType ?? "diary_entry";
  const sourceId = options.sourceId ?? "unknown-source";
  const metadata: MemoryChunkMetadata = {
    date: options.date ?? null,
    sourceType,
    sourceId,
  };

  return {
    chunkType,
    text: sentence,
    sourceType,
    sourceId,
    metadata,
  };
}

export async function chunkDiaryEntry(
  text: string,
  options: ChunkingOptions = {}
): Promise<ChunkedMemoryChunk[]> {
  const sentences = splitIntoSentences(text);
  
  // Process all sentences concurrently
  const chunkPromises = sentences.map((sentence) => buildChunk(sentence, options));
  return Promise.all(chunkPromises);
}
