export const CHUNK_TYPES = [
  "meeting_outcome",
  "feedback",
  "task_update",
  "decision",
  "action_item",
  "emotional_reflection",
  "general_note",
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number];
