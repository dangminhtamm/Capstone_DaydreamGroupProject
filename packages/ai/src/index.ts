// packages/ai/src/index.ts
export { CHUNK_TYPES, type ChunkType, type SemanticChunk, type MemoryChunkMetadata } from "./types.ts";
export { generateSemanticChunks } from "./chunker.ts";
export { retrieveMemory, type RetrievalFilters } from "./retrieval.ts";
export {
  answerFromChunks,
  answerMemory,
  type AnswerMemoryOptions,
  type AnswerMemoryResult,
} from "./answer-memory.ts";
export { type MemoryCitation } from "./answer-utils.ts";
export {
  answerMemoryStream,
  type AnswerMemoryStreamOptions,
  type AnswerMemoryStreamResult,
} from "./answer-memory-stream.ts";
export {
  indexMemoryFromDiary,
  type ExtractedEntityMention,
  type IndexedMemoryChunk,
  type IndexMemoryFromDiaryInput,
  type IndexMemoryFromDiaryResult,
  type PersistedMemoryChunkPayload,
} from "./memory-indexer.ts";
export {
  indexMemoryFromCalendar,
  type CalendarEventInput,
  type IndexMemoryFromCalendarInput,
  type IndexMemoryFromCalendarResult,
} from "./calendar-indexer.ts";
export {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_PROVIDER,
  GEMINI_EMBEDDING_MODEL,
  GeminiEmbeddingProvider,
  createEmbeddingProvider,
  createDefaultEmbeddingProvider,
  getEmbeddingProviderName,
} from "./embedding.ts";
export type {
  ChunkedMemoryChunk,
  ChunkingOptions,
  EmbeddingProvider,
  MemoryChunk,
} from "./types.ts";
