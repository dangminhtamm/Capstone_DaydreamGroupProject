// packages/ai/src/index.ts
export { type ChunkType, type MemoryChunkMetadata, type SemanticChunk } from "./chunk-types.ts";
export { generateSemanticChunks } from "./chunker.ts";
export { retrieveMemory, type RetrievalFilters } from "./retrieval.ts";
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