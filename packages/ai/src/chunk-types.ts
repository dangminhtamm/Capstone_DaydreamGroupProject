export const CHUNK_TYPES = [
  "meeting_outcome",
  "feedback",
  "task_update",
  "decision",
  "action_item",
  "emotional_reflection",
  "general_note",
  "reflection",
  "event",
  "general",
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number];
