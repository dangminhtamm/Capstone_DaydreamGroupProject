// packages/ai/src/index.ts
export {
  CHUNK_TYPES,
  type ChunkType,
  type SemanticChunk,
  type MemoryChunkMetadata,
} from "./types.ts";
export { generateSemanticChunks } from "./chunker.ts";
export {
  retrieveMemory,
  retrieveMemoryWithEmbedding,
  type RetrievalFilters,
} from "./retrieval.ts";
export {
  answerFromChunks,
  answerMemory,
  inferRetrievalFilters,
  type AnswerMemoryOptions,
  type AnswerMemoryResult,
  type MemoryDebugTrace,
  type QueryAnalytics,
  type ResponseLanguage,
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
  indexMemoryFromContact,
  type GoogleContactInput,
  type IndexMemoryFromContactInput,
  type IndexMemoryFromContactResult,
} from "./contact-indexer.ts";
export {
  indexMemoryFromDrive,
  type IndexMemoryFromDriveInput,
  type IndexMemoryFromDriveResult,
} from "./drive-indexer.ts";
export {
  indexMemoryFromAttachment,
  type IndexMemoryFromAttachmentInput,
  type IndexMemoryFromAttachmentResult,
} from "./attachment-indexer.ts";
export {
  indexMemoryFromSummary,
  type IndexMemoryFromSummaryInput,
  type IndexMemoryFromSummaryResult,
} from "./summary-indexer.ts";
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
export {
  type GeminiTokenUsage,
  type GeminiJsonResultWithMeta,
} from "./gemini-json.ts";
export {
  DEFAULT_GEMINI_ANSWER_MODEL,
  DEFAULT_GEMINI_CHUNK_MODEL,
  DEFAULT_GEMINI_VISION_MODEL,
  getGeminiAnswerModel,
  getGeminiChunkModel,
  getGeminiSummaryModel,
  getGeminiVisionModel,
} from "./gemini-models.ts";
