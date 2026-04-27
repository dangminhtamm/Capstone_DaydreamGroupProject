export { CHUNK_TYPES, type ChunkType } from "./chunk-types.ts";
export { chunkDiaryEntry, inferChunkType, splitIntoSentences } from "./chunker.ts";
export {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_PROVIDER,
  GEMINI_EMBEDDING_MODEL,
  GeminiEmbeddingProvider,
  MockEmbeddingProvider,
  createEmbeddingProvider,
  createDefaultEmbeddingProvider,
  getEmbeddingProviderName,
} from "./embedding.ts";
export { processQuery } from "./query-processor.ts";
export type {
  ChunkedMemoryChunk,
  ChunkingOptions,
  EmbeddingProvider,
  MemoryChunk,
  MemoryChunkMetadata,
  QueryResult,
  SearchFn,
  SearchResult,
} from "./types.ts";

