// packages/ai/src/index.ts
export {
  CHUNK_TYPES,
  type ChunkType,
  type SemanticChunk,
  type MemoryChunkMetadata,
} from "./types.ts";
export {
  generateDeterministicDiaryChunks,
  generateSemanticChunks,
  type GenerateSemanticChunksOptions,
} from "./chunker.ts";
export {
  retrieveMemory,
  retrieveMemoryLexicalOnly,
  retrieveMemoryWithEmbedding,
  extractEntityQueryTerms,
  type RetrievalFilters,
} from "./retrieval.ts";
export {
  answerFromChunks,
  answerMemory,
  inferRetrievalFilters,
  resolveMemoryTimeZone,
  type AnswerMemoryOptions,
  type AnswerMemoryResult,
  type MemoryDebugTrace,
  type QueryAnalytics,
  type ResponseLanguage,
} from "./answer-memory.ts";
export {
  INTENT_PROFILES,
  getIntentProfile,
  getIntentRetrievalProfile,
  type IntentProfile,
} from "./answer-memory-intent-profiles.ts";
export { type MemoryCitation } from "./answer-utils.ts";
export {
  answerMemoryStream,
  type AnswerMemoryStreamOptions,
  type AnswerMemoryStreamResult,
} from "./answer-memory-stream.ts";
export {
  indexMemoryFromDiary,
  type ExtractedEntityMention,
  type ExtractedEntityMentionWithChunkIndex,
  type IndexedMemoryChunk,
  type IndexMemoryFromDiaryInput,
  type IndexMemoryFromDiaryResult,
  type PersistedMemoryChunkPayload,
} from "./memory-indexer.ts";
export { extractEntityMentionsFromMetadata } from "./indexing-utils.ts";
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
  indexMemoryFromGmail,
  type GmailMessageInput,
  type IndexMemoryFromGmailInput,
  type IndexMemoryFromGmailResult,
} from "./gmail-indexer.ts";
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
  TUTURUUU_EMBEDDING_MODEL,
  TuturuuuEmbeddingProvider,
  createEmbeddingProvider,
  createDefaultEmbeddingProvider,
  getEmbeddingProviderName,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
export type {
  ChunkedMemoryChunk,
  ChunkingOptions,
  EmbeddingProvider,
  MemoryChunk,
} from "./types.ts";
export {
  type TuturuuuJsonTokenUsage,
  type TuturuuuJsonResultWithMeta,
} from "./tuturuuu-json.ts";
export {
  DEFAULT_TUTURUUU_API_BASE_URL,
  DEFAULT_TUTURUUU_EMBEDDING_MODEL,
  DEFAULT_TUTURUUU_RESPONSE_MODEL,
  canUseTuturuuuApi,
  embedTuturuuu,
  generateTuturuuuAudioTranscript,
  generateTuturuuuFileText,
  generateTuturuuuText,
  generateTuturuuuVisionText,
  getTuturuuuApiBaseUrl,
  getTuturuuuApiKey,
  requireTuturuuuApiKey,
  type TuturuuuGenerateTextOptions,
  type TuturuuuGenerateTextResult,
  type TuturuuuEmbeddingOptions,
  type TuturuuuEmbeddingResult,
  type TuturuuuResponseInput,
  type TuturuuuTokenUsage,
} from "./tuturuuu-client.ts";
export {
  generateAiText,
  type GenerateAiTextOptions,
} from "./ai-text.ts";
export {
  formatSummaryDateTime,
  formatSummaryPeriodRange,
  getSummaryPeriod,
  isLastLocalDayOfMonth,
  resolveSummaryTimeZone,
  type SummaryPeriod,
  type SummaryPeriodType,
} from "./summary-period.ts";
export {
  DEFAULT_TUTURUUU_ANSWER_MODEL,
  DEFAULT_TUTURUUU_CHUNK_MODEL,
  DEFAULT_TUTURUUU_TRANSCRIPTION_MODEL,
  DEFAULT_TUTURUUU_VISION_MODEL,
  getTuturuuuAnswerModel,
  getTuturuuuChunkModel,
  getTuturuuuSummaryModel,
  getTuturuuuTranscriptionModel,
  getTuturuuuVisionModel,
} from "./tuturuuu-models.ts";
