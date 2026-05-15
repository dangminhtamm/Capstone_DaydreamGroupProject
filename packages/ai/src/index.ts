// packages/ai/src/index.ts
export { CHUNK_TYPES, type ChunkType } from "./chunk-types.ts";
export { type SemanticChunk } from "./types.ts";
export { type MemoryChunkMetadata } from "./types.ts";
export { generateSemanticChunks } from "./chunker.ts";
export { retrieveMemory, type RetrievalFilters } from "./retrieval.ts";
export {
  answerFromChunks,
  answerMemory,
  type AnswerMemoryOptions,
  type AnswerMemoryResult,
  type MemoryCitation,
} from "./answer-memory.ts";
export {
  indexMemoryFromDiary,
  type IndexedMemoryChunk,
  type IndexMemoryFromDiaryInput,
  type IndexMemoryFromDiaryResult,
  type PersistedMemoryChunkPayload,
} from "./memory-indexer.ts";
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
