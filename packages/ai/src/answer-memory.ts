import { generateGeminiJsonWithMeta, type GeminiTokenUsage } from "./gemini-json.ts";
import { getGeminiAnswerModel } from "./gemini-models.ts";
import {
  retrieveMemoryWithEmbedding,
  type MemorySearchHit,
  type RetrievalFilters,
} from "./retrieval.ts";
import { createDefaultEmbeddingProvider } from "./embedding.ts";
import type { MemoryDbClient } from "./types.ts";
import {
  type MemoryCitation,
  buildCitations,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";
import type {
  AnswerMemoryOptions,
  AnswerMemoryResult,
  AnswerStrategy,
  MemoryDebugTrace,
  MemoryIntent,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import {
  detectMemoryIntent,
  hasBlockerEvidence,
  hasCitationEvidence,
  hasDecisionEvidence,
  hasGmailEvidence,
  hasLatencyEvidence,
  hasMoodEvidenceForQuestion,
  hasNormalizedPhrase,
  hasOnlyQuestionListEvidence,
  hasRecentIntent,
  includesAny,
  isAttachmentIntent,
  isBlockerIntent,
  isCalendarIntent,
  isCitationQuestion,
  isFeedbackIntent,
  isGmailIntent,
  isGoogleContactsIntent,
  isGoogleContactsSearchText,
  isLatencyIntent,
  isMoodIntent,
  isProgressIntent,
  isStressIntent,
  isTaskIntent,
  matchesDecisionSubject,
  normalizeForIntent,
} from "./answer-memory-intents.ts";
import {
  buildIntentNoMemoryMessage,
  buildQuestionAwareFallbackAnswer,
  buildReadableClaim,
  dedupeCitationsBySource,
  formatDateForAnswer,
  formatDateRangeForAnswer,
  formatFallbackSourceDate,
  formatIntentEvidenceAnswer,
  formatLocalizedMemoryBullet,
  formatMemoryBullet,
  formatSingleDayAnswer,
  formatTemporalRangeAnswer,
  trimPromptQuote,
} from "./answer-memory-format.ts";
import {
  detectMonth,
  inferRetrievalFilters,
} from "./answer-memory-temporal.ts";
import {
  GeminiGroundedAnswerResponseSchema,
  GroundedAnswerSchema,
  type GroundedAnswer,
} from "./answer-memory-schema.ts";

export type {
  AnswerMemoryOptions,
  AnswerMemoryResult,
  AnswerMode,
  AnswerStrategy,
  MemoryDebugTrace,
  QueryAnalytics,
  ResponseLanguage,
} from "./answer-memory-types.ts";
export { inferRetrievalFilters } from "./answer-memory-temporal.ts";

const MIN_TOP_SIMILARITY = Number(
  process.env.MEMORY_MIN_TOP_SIMILARITY ?? 0.62,
);
const DEFAULT_MAX_DISTANCE = Number(process.env.MEMORY_MAX_DISTANCE ?? 0.42);
const DEFAULT_PROMPT_SOURCE_LIMIT = Number(process.env.MEMORY_PROMPT_SOURCE_LIMIT ?? 4);
const DEFAULT_MAX_ANSWER_TOKENS = Number(process.env.MEMORY_MAX_ANSWER_TOKENS ?? 512);
const DEFAULT_REASONING_MAX_ANSWER_TOKENS = Number(
  process.env.MEMORY_REASONING_MAX_ANSWER_TOKENS ??
    Math.max(DEFAULT_MAX_ANSWER_TOKENS, 768),
);
const DEFAULT_RETRIEVAL_CANDIDATE_LIMIT = Number(process.env.MEMORY_RETRIEVAL_CANDIDATE_LIMIT ?? 12);

export async function answerMemory(
  question: string,
  userId: string,
  dbClient: MemoryDbClient,
  options: AnswerMemoryOptions = {},
): Promise<AnswerMemoryResult> {
  const totalStart = performance.now();
  const normalizedQuestion = question.trim();
  const lang = options.responseLanguage ?? 'en';
  const answerStrategy = options.answerStrategy ?? "auto";
  const intent = detectMemoryIntent(normalizedQuestion);

  if (!normalizedQuestion) {
    return noMemoryResult(lang === 'vi' ? 'Bạn chưa nhập câu hỏi.' : 'Please enter a question.', lang);
  }

  const inferredFilters = inferRetrievalFilters(normalizedQuestion);
  const appliedFilters = {
    ...inferredFilters,
    ...options.filters,
    limit: Math.min(
      Math.max(options.limit ?? DEFAULT_RETRIEVAL_CANDIDATE_LIMIT, DEFAULT_RETRIEVAL_CANDIDATE_LIMIT),
      20,
    ),
    maxDistance: options.maxDistance ?? DEFAULT_MAX_DISTANCE,
  };

  const preRetrieveStart = performance.now();
  const unindexedDiaryChunks = await retrieveUnindexedDiaryFallbackHits(
    dbClient,
    userId,
    appliedFilters,
  );
  const preRetrieveMs = performance.now() - preRetrieveStart;

  const unindexedFastPathResult = answerStrategy === "deep"
    ? null
    : answerSingleDayFastPath(
        normalizedQuestion,
        unindexedDiaryChunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      ) ?? answerTemporalRangeFastPath(
        normalizedQuestion,
        unindexedDiaryChunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      );
  if (unindexedFastPathResult) {
    if (unindexedFastPathResult.analytics) {
      unindexedFastPathResult.analytics.timing.embedMs = 0;
      unindexedFastPathResult.analytics.timing.retrieveMs = Math.round(preRetrieveMs);
      unindexedFastPathResult.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
      unindexedFastPathResult.analytics.tokenUsage.model =
        unindexedFastPathResult.analytics.tokenUsage.model === "temporal-fast-path"
          ? "unindexed-diary-temporal-fast-path"
          : "unindexed-diary-fast-path";
    }

    unindexedFastPathResult.debugTrace = buildDebugTrace({
      question: normalizedQuestion,
      inferredFilters,
      appliedFilters,
      chunks: unindexedDiaryChunks,
      result: unindexedFastPathResult,
    });

    return unindexedFastPathResult;
  }

  // ── Embed + Retrieve ─────────────────────────────────────────────────────
  const embedStart = performance.now();
  let embedding: number[];
  try {
    embedding = await createDefaultEmbeddingProvider().embedQuery(normalizedQuestion);
  } catch (error) {
    const embedMs = performance.now() - embedStart;
    const modelError = classifyModelError(error);
    const fallbackSources = buildCitations(unindexedDiaryChunks);
    const result = fallbackSources.length
      ? buildExtractiveFallbackAnswer(
          lang,
          fallbackSources,
          unindexedDiaryChunks.length,
          modelError,
          {},
          normalizedQuestion,
        )
      : noMemoryResult(
          lang === 'vi'
            ? 'Gemini đang bị giới hạn quota/rate limit nên mình chưa thể tìm kiếm AI lúc này.'
            : 'Gemini is currently quota/rate limited, so AI search is unavailable right now.',
          lang,
        );

    result.modelError = modelError;
    result.analytics = result.analytics ?? {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: unindexedDiaryChunks.length,
      status: 'error',
      answerMode: result.answerMode,
    };
    result.analytics.timing.embedMs = Math.round(embedMs);
    result.analytics.timing.retrieveMs = Math.round(preRetrieveMs);
    result.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
    result.analytics.status = 'error';

    result.debugTrace = buildDebugTrace({
      question: normalizedQuestion,
      inferredFilters,
      appliedFilters,
      chunks: unindexedDiaryChunks,
      result,
    });

    return result;
  }
  const embedMs = performance.now() - embedStart;

  const retrieveStart = performance.now();
  let retrievedChunks = rerankMemoryHits(
    normalizedQuestion,
    await retrieveMemoryWithEmbedding(
      normalizedQuestion,
      userId,
      dbClient,
      embedding,
      appliedFilters,
    ),
    appliedFilters,
  );
  let chunks = rerankMemoryHits(
    normalizedQuestion,
    [...unindexedDiaryChunks, ...retrievedChunks],
    appliedFilters,
  );

  if (
    shouldExpandTemporalEvidenceSearch(
      normalizedQuestion,
      intent,
      chunks,
      appliedFilters,
    )
  ) {
    const expandedFilters = buildExpandedTemporalFilters(appliedFilters);
    const expandedRetrievedChunks = rerankMemoryHits(
      normalizedQuestion,
      await retrieveMemoryWithEmbedding(
        normalizedQuestion,
        userId,
        dbClient,
        embedding,
        expandedFilters,
      ),
      expandedFilters,
    );

    retrievedChunks = dedupeMemoryHits([
      ...retrievedChunks,
      ...expandedRetrievedChunks,
    ]);
    chunks = rerankMemoryHits(
      normalizedQuestion,
      dedupeMemoryHits([...unindexedDiaryChunks, ...retrievedChunks]),
      appliedFilters,
    );
  }
  const retrieveMs = performance.now() - retrieveStart;

  const fastPathResult = answerStrategy === "deep"
    ? null
    : answerSingleDayFastPath(
        normalizedQuestion,
        chunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      ) ?? answerTemporalRangeFastPath(
        normalizedQuestion,
        chunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
      );

  const result = fastPathResult ??
    (answerStrategy === "fast"
      ? answerFastExtractiveFromChunks(
          normalizedQuestion,
          chunks,
          lang,
          options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
        )
      : await answerFromChunks(normalizedQuestion, chunks, {
    minTopSimilarity: options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
    responseLanguage: lang,
    answerStrategy,
  }));

  // Patch analytics timing: answerFromChunks already set generateMs,
  // but we need to fill in embed/retrieve timings and total.
  if (result.analytics) {
    result.analytics.timing.embedMs = Math.round(embedMs);
    result.analytics.timing.retrieveMs = Math.round(retrieveMs);
    result.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
  }

  result.debugTrace = buildDebugTrace({
    question: normalizedQuestion,
    inferredFilters,
    appliedFilters,
    chunks,
    result,
  });

  return result;
}

function shouldExpandTemporalEvidenceSearch(
  question: string,
  intent: MemoryIntent,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  if (!["blocker", "mood"].includes(intent)) return false;
  if (!includesAny(normalizeForIntent(question), ["this week", "tuan nay", "tuần này"])) {
    return false;
  }

  const currentSources = buildCitations(chunks);
  return selectIntentEvidenceSources(question, currentSources, intent).length === 0;
}

function buildExpandedTemporalFilters(filters: RetrievalFilters): RetrievalFilters {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDate = filters.startDate
    ? new Date(filters.startDate.getTime() - 7 * dayMs)
    : filters.startDate;

  return {
    ...filters,
    startDate,
    limit: Math.min(Math.max(filters.limit ?? DEFAULT_RETRIEVAL_CANDIDATE_LIMIT, 16), 20),
  };
}

function dedupeMemoryHits(chunks: MemorySearchHit[]): MemorySearchHit[] {
  const seen = new Set<string>();
  const deduped: MemorySearchHit[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    deduped.push(chunk);
  }

  return deduped;
}

export function answerSingleDayFastPath(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
  lang: ResponseLanguage,
  minTopSimilarity: number,
): AnswerMemoryResult | null {
  if (!isSingleDayRange(filters) || !chunks.length || requiresGenerativeReasoning(question)) {
    return null;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    return null;
  }

  const citations = buildCitations(sortedChunks)
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: citation.quote,
    }));

  if (!citations.length) return null;

  const dateLabel = formatDateForAnswer(filters.startDate!, lang);
  const answer = formatSingleDayAnswer(citations, dateLabel, lang);
  const confidence = classifyRetrievalConfidence(topSimilarity, citations.length);

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: {
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: 'fast-path',
      },
      timing: {
        embedMs: 0,
        retrieveMs: 0,
        generateMs: 0,
        totalMs: 0,
      },
      chunksRetrieved: chunks.length,
      status: 'success',
      answerMode: "fast_path",
    },
  };
}

export function answerTemporalRangeFastPath(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters,
  lang: ResponseLanguage,
  minTopSimilarity: number,
): AnswerMemoryResult | null {
  if (
    !isMultiDayRange(filters) ||
    !chunks.length ||
    requiresGenerativeReasoning(question) ||
    process.env.MEMORY_TEMPORAL_FAST_PATH === "false"
  ) {
    return null;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    return null;
  }

  const citations = dedupeCitationsBySource(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: buildReadableClaim(citation),
    }));

  if (!citations.length) return null;

  const answer = formatTemporalRangeAnswer(
    citations,
    formatDateRangeForAnswer(filters.startDate!, filters.endDate!, lang),
    lang,
  );
  const confidence = classifyRetrievalConfidence(topSimilarity, citations.length);

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: {
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "temporal-fast-path",
      },
      timing: {
        embedMs: 0,
        retrieveMs: 0,
        generateMs: 0,
        totalMs: 0,
      },
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
    },
  };
}

function isSingleDayRange(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;

  const maxOneDayRangeMs = 24 * 60 * 60 * 1000;
  return end - start <= maxOneDayRangeMs;
}

function isMultiDayRange(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  const start = filters.startDate.getTime();
  const end = filters.endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;

  return end - start > 24 * 60 * 60 * 1000;
}

function requiresGenerativeReasoning(question: string): boolean {
  const normalized = normalizeForIntent(question);
  return includesAny(normalized, [
    "why",
    "how",
    "compare",
    "comparison",
    "difference",
    "similar",
    "pattern",
    "trend",
    "analyze",
    "analysis",
    "insight",
    "blocker",
    "blockers",
    "risk",
    "risks",
    "challenge",
    "challenges",
    "stuck",
    "stress",
    "stressed",
    "mood",
    "feel",
    "felt",
    "emotion",
    "trở ngại",
    "tro ngai",
    "rủi ro",
    "rui ro",
    "khó khăn",
    "kho khan",
    "vướng",
    "vuong",
    "căng thẳng",
    "cang thang",
    "tâm trạng",
    "tam trang",
    "vì sao",
    "vi sao",
    "tại sao",
    "tai sao",
    "như thế nào",
    "nhu the nao",
    "so sánh",
    "so sanh",
    "khác gì",
    "khac gi",
    "phân tích",
    "phan tich",
    "cảm thấy",
    "cam thay",
    "cảm xúc",
    "cam xuc",
  ]);
}

function selectPromptSourceLimit(question: string, intent = detectMemoryIntent(question)): number {
  const configured = Math.min(Math.max(DEFAULT_PROMPT_SOURCE_LIMIT, 2), 6);
  if (["feedback", "blocker", "latency"].includes(intent)) return Math.max(configured, 6);
  if (!requiresGenerativeReasoning(question)) return configured;
  return Math.max(configured, 6);
}

function selectMaxAnswerTokens(question: string): number {
  const configured = Math.min(Math.max(DEFAULT_MAX_ANSWER_TOKENS, 256), 2048);
  if (!requiresGenerativeReasoning(question)) return configured;
  return Math.min(
    Math.max(DEFAULT_REASONING_MAX_ANSWER_TOKENS, configured),
    2048,
  );
}

function buildIntentInstruction(intent: MemoryIntent, lang: ResponseLanguage): string {
  const vi = lang === "vi";

  switch (intent) {
    case "feedback":
      return vi
        ? "Tập trung vào phản hồi/góp ý được hỏi. Bỏ qua ký ức chỉ nhắc tên người trong bối cảnh không liên quan như Google Contacts."
        : "Focus on the requested feedback. Ignore memories that only mention a person's name in unrelated contexts such as Google Contacts.";
    case "blocker":
      return vi
        ? "Chỉ trả lời bằng blocker/rủi ro/vấn đề thật. Bỏ qua ký ức chỉ liệt kê câu hỏi demo hoặc nói rằng user đã hỏi về blockers."
        : "Answer with actual blockers/risks/issues. Ignore memories that only list demo questions or say the user asked about blockers.";
    case "latency":
      return vi
        ? "Tập trung vào lý do đo retrieval latency tách khỏi answer generation và các metric timing liên quan."
        : "Focus on why retrieval latency is measured separately from answer generation and on the related timing metrics.";
    case "gmail":
      return vi
        ? "Tập trung vào quyết định/phạm vi liên quan đến Gmail. Bỏ qua nguồn chỉ nói về latency, benchmark, hoặc câu hỏi demo."
        : "Focus on the decision or scope related to Gmail. Ignore sources that only discuss latency, benchmarks, or demo questions.";
    case "google_contacts":
      return vi
        ? "Tập trung vào kế hoạch Google Contacts/People API, không lẫn với Calendar hoặc Diary chung."
        : "Focus on the Google Contacts/People API plan, not general Calendar or Diary notes.";
    case "mood":
      return vi
        ? "Tập trung vào cảm xúc, stress, mood, confidence hoặc relief được ghi rõ trong memory."
        : "Focus on explicitly recorded emotions, stress, mood, confidence, or relief.";
    default:
      return vi
        ? "Nếu nhiều nguồn liên quan, ưu tiên nguồn trả lời trực tiếp câu hỏi thay vì nguồn chỉ trùng từ khóa."
        : "If several sources are related, prefer the source that directly answers the question rather than a source that only shares keywords.";
  }
}

export async function answerFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  options: {
    minTopSimilarity?: number;
    responseLanguage?: ResponseLanguage;
    answerStrategy?: AnswerStrategy;
    generateAnswer?: typeof generateGeminiJsonWithMeta<GroundedAnswer>;
  } = {},
): Promise<AnswerMemoryResult> {
  const minTopSimilarity = options.minTopSimilarity ?? MIN_TOP_SIMILARITY;
  const lang = options.responseLanguage ?? 'en';
  const intent = detectMemoryIntent(question);

  if (!chunks.length) {
    const result = noMemoryResult(
      lang === 'vi'
        ? 'Mình chưa tìm thấy ký ức đủ liên quan để trả lời chắc chắn.'
        : 'I couldn\'t find any relevant memories to answer your question.',
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: 0,
      status: 'no_memory',
      answerMode: "no_memory",
    };
    return result;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;

  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    const result = noMemoryResult(
      lang === 'vi'
        ? 'Mình tìm thấy một vài ký ức gần nghĩa, nhưng độ liên quan chưa đủ cao để trả lời chắc chắn.'
        : 'I found some loosely related memories, but the relevance isn\'t strong enough for a confident answer.',
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: chunks.length,
      status: 'no_memory',
      answerMode: "no_memory",
    };
    return result;
  }

  const sources = buildCitations(sortedChunks);
  if (options.answerStrategy !== "deep") {
    const intentEvidenceAnswer = answerIntentEvidenceFastPath(
      question,
      sources,
      chunks.length,
      lang,
      intent,
    );
    if (intentEvidenceAnswer) return intentEvidenceAnswer;

    const unsupportedIntentAnswer = buildUnsupportedIntentNoMemoryResult(
      question,
      sources,
      chunks.length,
      lang,
      intent,
    );
    if (unsupportedIntentAnswer) return unsupportedIntentAnswer;
  }

  if (options.answerStrategy === "fast") {
    return answerFastExtractiveFromChunks(question, chunks, lang, minTopSimilarity);
  }

  const promptSourceLimit = selectPromptSourceLimit(question, intent);
  const promptSources = sources.slice(0, promptSourceLimit);
  const sourceContext = promptSources
    .map((source) => {
      return [
        `[${source.marker}]`,
        `date: ${source.occurredAt}`,
        `type: ${source.sourceType}/${source.chunkType}`,
        `memory: ${trimPromptQuote(source.quote)}`,
      ].join("\n");
    })
    .join("\n\n");

  const languageInstruction = lang === 'vi'
    ? '- PHẢI trả lời bằng tiếng Việt tự nhiên. Dùng "mình" cho assistant và "bạn" cho user.'
    : '- You MUST answer in natural English.';
  const intentInstruction = buildIntentInstruction(intent, lang);

  const prompt = `
You are the grounded answer generator for a personal Second Brain memory system.

Question:
${question}

Retrieved memory sources:
${sourceContext}

Rules:
- Answer ONLY using the retrieved memory sources.
- Do not invent dates, people, events, decisions, emotions, or outcomes.
- Answer naturally without adding any citation markers (like [S1]) in your text.
- However, you MUST still provide the citations in the JSON output with their respective claims.
- Each citations.claim MUST be a short exact quote or near-exact phrase copied from the source memory. Do not translate citation claims.
- If the sources do not answer the question, say that the memory is insufficient and set confidence to "low".
- Prefer a warm, concise answer over a fluent but unsupported answer.
- For "what did I do" timeline/range questions, summarize the main activities first, then use short bullets only when helpful.
- Do not mention Gemini, model errors, retrieval, debug trace, or implementation details.
- Return a compact JSON object with exactly these top-level fields: answer, confidence, citations.
- Return ONLY JSON. Do not wrap it in markdown.
- Required JSON shape:
  {"answer":"...","confidence":"high|medium|low","citations":[{"marker":"S1","claim":"..."}]}
- Use citation markers exactly as S1, S2, S3, etc. Do not include square brackets in marker values.
- It is okay to answer in Vietnamese while citation claims remain in the source language.
- ${intentInstruction}
${languageInstruction}
`.trim();

  try {
    const generateStart = performance.now();
    const geminiResult = await (options.generateAnswer ?? generateGeminiJsonWithMeta)({
      model: getGeminiAnswerModel(),
      prompt,
      responseSchema: GeminiGroundedAnswerResponseSchema,
      validator: GroundedAnswerSchema,
      temperature: 0.1,
      maxOutputTokens: selectMaxAnswerTokens(question),
    });
    const generateMs = performance.now() - generateStart;

    const output = geminiResult.data;
    const tokenUsage = geminiResult.tokenUsage;

    if (isIncompleteGeneratedAnswer(output.answer)) {
      return buildExtractiveFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        {
          kind: "validation",
          message: "Generated answer appeared incomplete.",
        },
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
      );
    }

    const allowedMarkers = new Set(promptSources.map((source) => source.marker));
    const validModelCitations = output.citations.filter((citation) =>
      allowedMarkers.has(citation.marker),
    );
    const sourceByMarker = new Map(
      promptSources.map((source) => [source.marker, source]),
    );
    const supportedModelCitations = validModelCitations.filter((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return source ? isClaimSupportedByQuote(citation.claim, source.quote) : false;
    });

    if (!supportedModelCitations.length && isInsufficientAnswer(output.answer)) {
      return buildInsufficientModelAnswer(lang, output.answer, chunks.length, {
        generateMs: Math.round(generateMs),
        tokenUsage,
      });
    }

    if (!supportedModelCitations.length) {
      const recoveredCitations = recoverCitationsForAnswer(
        output.answer,
        promptSources,
        question,
        intent,
      );

      if (
        recoveredCitations.length &&
        answerPassesEvidenceChecks(output.answer, recoveredCitations)
      ) {
        const recoveredRetrievalConfidence = classifyRetrievalConfidence(
          recoveredCitations[0]?.similarity ?? topSimilarity,
          recoveredCitations.length,
        );

        return {
          answer: output.answer,
          confidence: reconcileConfidence(
            output.confidence,
            recoveredRetrievalConfidence,
            output.answer,
            false,
          ),
          citations: recoveredCitations,
          answerMode: "gemini",
          analytics: {
            tokenUsage,
            timing: {
              embedMs: 0,
              retrieveMs: 0,
              generateMs: Math.round(generateMs),
              totalMs: 0,
            },
            chunksRetrieved: chunks.length,
            status: "success",
            answerMode: "gemini",
          },
        };
      }

      return buildExtractiveFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        {
          kind: "validation",
          message: "Generated answer did not include usable grounded citations.",
        },
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
      );
    }
    const answerGrounded = isAnswerGroundedByCitations(
      output.answer,
      supportedModelCitations,
      sourceByMarker,
      lang,
    );

    const citedMarkerToClaim = new Map(
      supportedModelCitations.map((citation) => [citation.marker, citation.claim]),
    );

    const citations = promptSources
      .filter((source) => citedMarkerToClaim.has(source.marker))
      .map((source) => ({
        ...source,
        claim: citedMarkerToClaim.get(source.marker),
      }));

    const retrievalConfidence = classifyRetrievalConfidence(
      topSimilarity,
      citations.length,
    );
    if (!answerGrounded) {
      return buildExtractiveFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        {
          kind: "validation",
          message: "Generated answer was not sufficiently grounded in its citations.",
        },
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
      );
    }

    if (!answerPassesEvidenceChecks(output.answer, citations)) {
      return buildExtractiveFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        {
          kind: "validation",
          message: "Generated answer mentioned dates or named entities that were not supported by evidence.",
        },
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
      );
    }

    const finalConfidence = reconcileConfidence(
      output.confidence,
      retrievalConfidence,
      output.answer,
      supportedModelCitations.length < validModelCitations.length,
    );

    return {
      answer: output.answer,
      confidence: finalConfidence,
      citations,
      answerMode: "gemini",
      analytics: {
        tokenUsage,
        timing: {
          embedMs: 0,
          retrieveMs: 0,
          generateMs: Math.round(generateMs),
          totalMs: 0,
        },
        chunksRetrieved: chunks.length,
        status: 'success',
        answerMode: "gemini",
      },
    };
  } catch (error) {
    const modelError = classifyModelError(error);
    console.warn(
      `[AnswerMemory] Failed to generate grounded answer (${modelError.kind}${modelError.status ? ` ${modelError.status}` : ""}): ${modelError.message}`,
    );

    if (canUseExtractiveFallback(modelError, promptSources)) {
      return buildExtractiveFallbackAnswer(lang, promptSources, chunks.length, modelError, {}, question);
    }

    return {
      answer:
        lang === 'vi'
          ? 'Mình đã tìm thấy ký ức liên quan, nhưng không thể tạo câu trả lời có cấu trúc đáng tin cậy ở lần này.'
          : 'I found relevant memories, but was unable to generate a structured answer this time.',
      confidence: "low",
      citations: [],
      answerMode: "extractive_fallback",
      modelError,
      analytics: {
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'n/a' },
        timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
        chunksRetrieved: chunks.length,
        status: 'error',
        answerMode: "extractive_fallback",
      },
    };
  }
}

function answerIntentEvidenceFastPath(
  question: string,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  lang: ResponseLanguage,
  intent: MemoryIntent,
): AnswerMemoryResult | null {
  if (!isEvidenceFirstIntent(intent)) return null;

  const citations = selectIntentEvidenceSources(question, sources, intent).map((source) => ({
    ...source,
    claim: buildReadableClaim(source),
  }));
  if (!citations.length) return null;

  const answer = formatIntentEvidenceAnswer(question, citations, intent, lang);
  const confidence = classifyRetrievalConfidence(
    citations[0]?.similarity ?? 0,
    citations.length,
  );

  return {
    answer,
    confidence,
    citations,
    answerMode: "fast_path",
    analytics: {
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "intent-evidence-fast-path",
      },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved,
      status: "success",
      answerMode: "fast_path",
    },
  };
}

function buildUnsupportedIntentNoMemoryResult(
  question: string,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  lang: ResponseLanguage,
  intent: MemoryIntent,
): AnswerMemoryResult | null {
  if (!isEvidenceFirstIntent(intent)) return null;
  if (selectIntentEvidenceSources(question, sources, intent).length > 0) return null;

  const result = noMemoryResult(
    buildIntentNoMemoryMessage(question, intent, lang),
    lang,
  );
  result.analytics = {
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      model: "intent-evidence-fast-path",
    },
    timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
    chunksRetrieved,
    status: "no_memory",
    answerMode: "no_memory",
  };
  return result;
}

function isEvidenceFirstIntent(intent: MemoryIntent): boolean {
  return [
    "feedback",
    "blocker",
    "latency",
    "gmail",
    "google_contacts",
    "decision",
    "mood",
  ].includes(intent);
}

function selectIntentEvidenceSources(
  question: string,
  sources: MemoryCitation[],
  intent: MemoryIntent,
): MemoryCitation[] {
  if (!sources.length || !isEvidenceFirstIntent(intent)) return [];

  const normalizedQuestion = normalizeForIntent(question);
  const groups = buildCitationGroups(sources)
    .map((group) => scoreCitationGroup(normalizedQuestion, group, intent))
    .filter((group) => group.directSupport)
    .sort((a, b) => b.score - a.score || b.topSimilarity - a.topSimilarity);

  if (!groups.length) return [];

  const topScore = groups[0]?.score ?? 0;
  const maxGroupDrop = getIntentEvidenceGroupMaxDrop(intent);
  const maxGroups = getIntentEvidenceMaxGroups(intent);
  const maxCitations = getIntentEvidenceMaxCitations(intent);

  const selectedGroups = groups
    .filter((group) => group.score >= topScore - maxGroupDrop)
    .slice(0, maxGroups);

  const selected = selectedGroups.flatMap((group) =>
    selectRepresentativeCitationsFromGroup(normalizedQuestion, group, intent),
  );

  return dedupeCitationsByChunk(selected).slice(0, maxCitations);
}

type CitationGroup = {
  key: string;
  citations: MemoryCitation[];
  searchable: string;
  topSimilarity: number;
};

type ScoredCitationGroup = CitationGroup & {
  score: number;
  directSupport: boolean;
};

function buildCitationGroups(sources: MemoryCitation[]): CitationGroup[] {
  const groups = new Map<string, MemoryCitation[]>();

  for (const source of sources) {
    const key = `${source.sourceType}:${source.sourceId}`;
    const group = groups.get(key) ?? [];
    group.push(source);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, citations]) => ({
    key,
    citations,
    searchable: normalizeForIntent(
      citations
        .map((citation) => `${citation.sourceTitle ?? ""} ${citation.chunkType} ${citation.quote}`)
        .join(" "),
    ),
    topSimilarity: Math.max(...citations.map((citation) => citation.similarity)),
  }));
}

function scoreCitationGroup(
  normalizedQuestion: string,
  group: CitationGroup,
  intent: MemoryIntent,
): ScoredCitationGroup {
  const queryTokens = new Set(importantTokens(normalizedQuestion));
  const groupTokens = new Set(importantTokens(group.searchable));
  const overlapRatio = queryTokens.size
    ? countOverlap(queryTokens, groupTokens) / queryTokens.size
    : 0;
  const bestCitationScore = Math.max(
    ...group.citations.map((citation) =>
      scoreSourceForIntent(normalizedQuestion, citation, intent),
    ),
  );
  const directSupport = groupDirectlySupportsIntent(normalizedQuestion, group, intent);

  return {
    ...group,
    score:
      bestCitationScore +
      overlapRatio * 0.35 +
      (directSupport ? getDirectSupportBoost(intent) : -0.6),
    directSupport,
  };
}

function groupDirectlySupportsIntent(
  normalizedQuestion: string,
  group: CitationGroup,
  intent: MemoryIntent,
): boolean {
  const searchable = group.searchable;

  switch (intent) {
    case "feedback":
      return (
        includesAny(searchable, ["feedback", "mentor", "review", "linh", "gop y", "nhan xet"]) &&
        (!isCitationQuestion(normalizedQuestion) || hasCitationEvidence(searchable))
      );
    case "blocker":
      return hasBlockerEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "latency":
      return hasLatencyEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "gmail":
      return hasGmailEvidence(searchable);
    case "google_contacts":
      return isGoogleContactsSearchText(searchable);
    case "decision":
      return hasDecisionEvidence(searchable) && matchesDecisionSubject(normalizedQuestion, searchable);
    case "mood":
      return hasMoodEvidenceForQuestion(normalizedQuestion, searchable);
    default:
      return false;
  }
}

function selectRepresentativeCitationsFromGroup(
  normalizedQuestion: string,
  group: ScoredCitationGroup,
  intent: MemoryIntent,
): MemoryCitation[] {
  const perGroupLimit = getIntentPerGroupCitationLimit(intent);
  const scored = group.citations
    .map((citation) => {
      const searchable = normalizeForIntent(
        `${citation.sourceTitle ?? ""} ${citation.chunkType} ${citation.quote}`,
      );
      const relevance =
        scoreSourceForIntent(normalizedQuestion, citation, intent) +
        (citationDirectlySupportsIntent(normalizedQuestion, searchable, intent) ? 0.45 : 0);

      return { citation, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance || b.citation.similarity - a.citation.similarity);

  return scored
    .filter((item, index) => {
      if (index === 0) return true;
      return citationDirectlySupportsIntent(
        normalizedQuestion,
        normalizeForIntent(`${item.citation.sourceTitle ?? ""} ${item.citation.chunkType} ${item.citation.quote}`),
        intent,
      );
    })
    .slice(0, perGroupLimit)
    .map((item) => item.citation);
}

function citationDirectlySupportsIntent(
  normalizedQuestion: string,
  searchable: string,
  intent: MemoryIntent,
): boolean {
  switch (intent) {
    case "feedback":
      return (
        includesAny(searchable, ["feedback", "mentor", "review", "linh", "gop y", "nhan xet"]) ||
        (isCitationQuestion(normalizedQuestion) && hasCitationEvidence(searchable))
      );
    case "blocker":
      return hasBlockerEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "latency":
      return hasLatencyEvidence(searchable) && !hasOnlyQuestionListEvidence(searchable);
    case "gmail":
      return hasGmailEvidence(searchable);
    case "google_contacts":
      return isGoogleContactsSearchText(searchable);
    case "decision":
      return hasDecisionEvidence(searchable) && matchesDecisionSubject(normalizedQuestion, searchable);
    case "mood":
      return hasMoodEvidenceForQuestion(normalizedQuestion, searchable);
    default:
      return false;
  }
}

function dedupeCitationsByChunk(citations: MemoryCitation[]): MemoryCitation[] {
  const seen = new Set<string>();
  const deduped: MemoryCitation[] = [];

  for (const citation of citations) {
    if (seen.has(citation.chunkId)) continue;
    seen.add(citation.chunkId);
    deduped.push(citation);
  }

  return deduped;
}

function getDirectSupportBoost(intent: MemoryIntent): number {
  switch (intent) {
    case "feedback":
    case "blocker":
    case "latency":
    case "gmail":
    case "google_contacts":
      return 0.7;
    case "mood":
      return 0.65;
    default:
      return 0.5;
  }
}

function getIntentEvidenceGroupMaxDrop(intent: MemoryIntent): number {
  switch (intent) {
    case "gmail":
    case "google_contacts":
    case "blocker":
    case "mood":
      return 0.2;
    case "feedback":
    case "latency":
      return 0.28;
    default:
      return 0.22;
  }
}

function getIntentEvidenceMaxGroups(intent: MemoryIntent): number {
  switch (intent) {
    case "feedback":
    case "latency":
      return 2;
    default:
      return 1;
  }
}

function getIntentEvidenceMaxCitations(intent: MemoryIntent): number {
  switch (intent) {
    case "latency":
      return 4;
    case "feedback":
      return 3;
    default:
      return 2;
  }
}

function getIntentPerGroupCitationLimit(intent: MemoryIntent): number {
  switch (intent) {
    case "latency":
      return 3;
    case "feedback":
    case "gmail":
      return 2;
    default:
      return 2;
  }
}

function canUseExtractiveFallback(
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  sources: MemoryCitation[],
): boolean {
  return (
    sources.length > 0 &&
    ["quota", "service_unavailable", "transient", "validation"].includes(modelError.kind)
  );
}

function recoverCitationsForAnswer(
  answer: string,
  sources: MemoryCitation[],
  question: string,
  intent: MemoryIntent,
): MemoryCitation[] {
  if (isInsufficientAnswer(answer) || !sources.length) return [];

  const normalizedQuestion = normalizeForIntent(question);
  const normalizedAnswer = normalizeForIntent(answer);
  const answerTokens = new Set(importantTokens(normalizedAnswer));
  const scored = dedupeCitationsBySource(sources)
    .map((source) => {
      const searchable = normalizeForIntent(
        `${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`,
      );
      const sourceTokens = new Set(importantTokens(searchable));
      const answerOverlap = answerTokens.size
        ? countOverlap(answerTokens, sourceTokens) / answerTokens.size
        : 0;
      const intentScore = scoreSourceForIntent(normalizedQuestion, source, intent);

      return {
        source,
        score: intentScore + answerOverlap * 0.45,
      };
    })
    .sort((a, b) => b.score - a.score || b.source.similarity - a.source.similarity);

  const recovered = scored
    .filter((item) => item.score >= 0.48)
    .slice(0, 3)
    .map(({ source }) => ({
      ...source,
      claim: buildReadableClaim(source),
    }));

  return recovered;
}

function buildExtractiveFallbackAnswer(
  lang: ResponseLanguage,
  sources: MemoryCitation[],
  chunksRetrieved: number,
  modelError: NonNullable<AnswerMemoryResult["modelError"]>,
  meta: {
    generateMs?: number;
    tokenUsage?: GeminiTokenUsage;
  } = {},
  question = "",
): AnswerMemoryResult {
  const fallbackTopic = detectFallbackTopic(question);
  const fallbackSources = selectFallbackSources(question, sources, fallbackTopic).map((source) => ({
    ...source,
    claim: buildReadableClaim(source),
  }));

  if (!fallbackSources.length) {
    const result = noMemoryResult(
      buildIntentNoMemoryMessage(question, fallbackTopic, lang),
      lang,
    );
    result.modelError = modelError;
    result.analytics = {
      tokenUsage: meta.tokenUsage ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "extractive-fallback",
      },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: meta.generateMs ?? 0, totalMs: 0 },
      chunksRetrieved,
      status: "no_memory",
      answerMode: "no_memory",
    };
    return result;
  }

  const bullets = fallbackSources
    .map((source) => {
      const date = formatFallbackSourceDate(source.occurredAt, lang);
      return `- ${date}: ${formatLocalizedMemoryBullet(source, fallbackTopic, lang)}.`;
    })
    .join("\n");

  const answer = buildQuestionAwareFallbackAnswer(lang, question, bullets, modelError, fallbackTopic);

  return {
    answer,
    confidence: classifyFallbackConfidence(fallbackSources),
    citations: fallbackSources,
    answerMode: "extractive_fallback",
    modelError,
    analytics: {
      tokenUsage: meta.tokenUsage ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: "extractive-fallback",
      },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: meta.generateMs ?? 0, totalMs: 0 },
      chunksRetrieved,
      status: "success",
      answerMode: "extractive_fallback",
    },
  };
}

type FallbackTopic = MemoryIntent;

function detectFallbackTopic(question: string): FallbackTopic {
  return detectMemoryIntent(question);
}

function selectFallbackSources(
  question: string,
  sources: MemoryCitation[],
  fallbackTopic: FallbackTopic,
): MemoryCitation[] {
  const normalizedQuestion = normalizeForIntent(question);
  const deduped = dedupeCitationsBySource(sources);
  const scored = deduped
    .map((source) => ({
      source,
      score: scoreSourceForIntent(normalizedQuestion, source, fallbackTopic),
    }))
    .sort((a, b) => b.score - a.score || b.source.similarity - a.source.similarity);

  const topScore = scored[0]?.score ?? 0;
  const minimumScore = getFallbackMinimumScore(fallbackTopic);
  const maxDrop = getFallbackMaxScoreDrop(fallbackTopic);
  const stronglyRelevant = scored.filter(
    (item) => item.score >= minimumScore && item.score >= topScore - maxDrop,
  );
  const nonNoisy = scored.filter((item) => !isNoisyFallbackSource(item.source));
  const pool = stronglyRelevant.length
    ? stronglyRelevant
    : nonNoisy.length
      ? nonNoisy
      : scored;

  return pool.slice(0, 4).map((item) => item.source);
}

function getFallbackMinimumScore(fallbackTopic: FallbackTopic): number {
  switch (fallbackTopic) {
    case "feedback":
    case "blocker":
    case "latency":
    case "gmail":
    case "google_contacts":
    case "decision":
      return 0.5;
    case "mood":
      return 0.45;
    default:
      return 0.38;
  }
}

function getFallbackMaxScoreDrop(fallbackTopic: FallbackTopic): number {
  switch (fallbackTopic) {
    case "feedback":
    case "blocker":
    case "latency":
    case "gmail":
    case "google_contacts":
    case "decision":
      return 0.22;
    default:
      return 0.28;
  }
}

function scoreSourceForIntent(
  normalizedQuestion: string,
  source: MemoryCitation,
  fallbackTopic: FallbackTopic,
): number {
  const searchable = normalizeForIntent(
    `${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`,
  );
  const queryTokens = new Set(importantTokens(normalizedQuestion));
  const sourceTokens = new Set(importantTokens(searchable));
  const overlapRatio = queryTokens.size
    ? countOverlap(queryTokens, sourceTokens) / queryTokens.size
    : 0;

  let score = source.similarity * 0.55 + overlapRatio * 0.35;
  if (source.retrievalMode === "hybrid") score += 0.05;
  if (source.retrievalMode === "lexical") score += 0.03;
  if (source.sourceType === "summary") score -= 0.04;
  if (isNoisyFallbackSource(source)) score -= 0.4;

  if (fallbackTopic === "google_contacts") {
    return score + (isGoogleContactsSource(source) ? 0.6 : -0.45);
  }

  if (fallbackTopic === "blocker") {
    if (includesAny(searchable, [
      "blocker",
      "risk",
      "challenge",
      "stuck",
      "quota",
      "worker",
      "indexing",
      "fallback",
      "blocked",
      "trở ngại",
      "rủi ro",
      "khó khăn",
    ])) score += 0.45;
    if (source.chunkType === "action_item" || source.chunkType === "reflection") score += 0.08;
    if (includesAny(searchable, ["asks search about", "asks about blockers", "best questions are"])) {
      score -= 0.5;
    }
    return score;
  }

  if (fallbackTopic === "feedback") {
    if (includesAny(searchable, ["feedback", "mentor", "review", "linh", "gop y", "góp ý", "nhan xet", "nhận xét"])) {
      score += 0.35;
    }
    if (
      includesAny(normalizedQuestion, ["citation", "citations", "trich dan", "trích dẫn"]) &&
      includesAny(searchable, ["citation", "citations", "cite", "source", "trust", "ui", "trich dan", "trích dẫn"])
    ) {
      score += 0.28;
    }
    if (source.chunkType === "feedback") score += 0.12;
    if (isGoogleContactsSource(source) && !isGoogleContactsIntent(normalizedQuestion)) score -= 0.55;
    return score;
  }

  if (fallbackTopic === "latency") {
    if (includesAny(searchable, [
      "retrieval latency",
      "answer generation",
      "generation latency",
      "embedding time",
      "database retrieval",
      "reranking",
      "p95",
      "500 millisecond",
      "500 ms",
      "time to first result",
      "separate",
      "separately",
    ])) {
      score += 0.55;
    }
    if (hasOnlyQuestionListEvidence(searchable)) score -= 0.45;
    if (source.chunkType === "decision" || source.chunkType === "general_note") score += 0.06;
    return score;
  }

  if (fallbackTopic === "gmail") {
    if (hasGmailEvidence(searchable)) {
      score += 0.65;
    } else {
      score -= 0.45;
    }
    if (source.chunkType === "decision" || source.chunkType === "feedback") score += 0.08;
    if (hasLatencyEvidence(searchable) && !hasGmailEvidence(searchable)) score -= 0.35;
    return score;
  }

  if (fallbackTopic === "mood") {
    if (includesAny(searchable, [
      "stress",
      "stressed",
      "worried",
      "confident",
      "relieved",
      "mood",
      "emotion",
      "căng thẳng",
      "tâm trạng",
      "cảm xúc",
    ])) score += 0.38;
    if (source.chunkType === "reflection") score += 0.08;
    return score;
  }

  if (fallbackTopic === "decision") {
    if (includesAny(searchable, ["decide", "decision", "agreed", "scope decision", "quyet dinh", "quyết định", "thong nhat", "thống nhất"])) {
      score += 0.32;
    }
    if (source.chunkType === "decision") score += 0.1;
  }

  if (isGoogleContactsSource(source)) {
    score -= 0.18;
  }

  return score;
}

function classifyFallbackConfidence(citations: MemoryCitation[]): "high" | "medium" | "low" {
  if (!citations.length) return "low";
  const topSimilarity = citations[0]?.similarity ?? 0;
  if (topSimilarity >= 0.78 && citations.length >= 1) return "medium";
  return "low";
}

function isGoogleContactsSource(source: MemoryCitation): boolean {
  if (source.sourceType === "contact") return true;
  const searchable = normalizeForIntent(
    `${source.sourceTitle ?? ""} ${source.chunkType} ${source.quote}`,
  );
  return isGoogleContactsSearchText(searchable);
}

function isNoisyFallbackSource(source: MemoryCitation): boolean {
  const searchable = normalizeForIntent(`${source.sourceTitle ?? ""} ${source.quote}`);
  return includesAny(searchable, [
    "demo account is ready",
    "final ai memory checklist",
    "final checklist has six items",
    "best questions are",
    "asks search about",
    "ask search about",
    "asks about mentor feedback",
    "asks about blockers",
    "what feedback did",
    "what blockers did",
    "why did we separate",
    "sample questions",
    "test questions",
  ]);
}

function answerFastExtractiveFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  lang: ResponseLanguage,
  minTopSimilarity: number,
): AnswerMemoryResult {
  if (!chunks.length) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình chưa tìm thấy ký ức đủ liên quan để trả lời nhanh."
        : "I could not find enough relevant memories for a fast answer.",
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "fast-extractive" },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: 0,
      status: "no_memory",
      answerMode: "no_memory",
    };
    return result;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;
  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình tìm thấy một vài ký ức gần nghĩa, nhưng chưa đủ chắc để trả lời nhanh."
        : "I found loosely related memories, but not enough support for a fast answer.",
      lang,
    );
    result.analytics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "fast-extractive" },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: chunks.length,
      status: "no_memory",
      answerMode: "no_memory",
    };
    return result;
  }

  const citations = dedupeCitationsBySource(buildCitations(sortedChunks))
    .slice(0, 6)
    .map((citation) => ({
      ...citation,
      claim: buildReadableClaim(citation),
    }));

  const bullets = citations
    .map((citation) => {
      const date = formatFallbackSourceDate(citation.occurredAt, lang);
      return `- ${date}: ${formatLocalizedMemoryBullet(citation, detectMemoryIntent(question), lang)}.`;
    })
    .join("\n");

  return {
    answer: lang === "vi"
      ? ["Mình trả lời nhanh từ các ký ức liên quan nhất:", bullets].join("\n")
      : ["Fast answer from the most relevant memories:", bullets].join("\n"),
    confidence: classifyRetrievalConfidence(topSimilarity, citations.length),
    citations,
    answerMode: "fast_path",
    analytics: {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "fast-extractive" },
      timing: { embedMs: 0, retrieveMs: 0, generateMs: 0, totalMs: 0 },
      chunksRetrieved: chunks.length,
      status: "success",
      answerMode: "fast_path",
    },
  };
}

function buildInsufficientModelAnswer(
  lang: ResponseLanguage,
  answer: string,
  chunksRetrieved: number,
  meta: {
    generateMs: number;
    tokenUsage: GeminiTokenUsage;
  },
): AnswerMemoryResult {
  return {
    answer: normalizeInsufficientAnswer(answer, lang),
    confidence: "low",
    citations: [],
    noMemory: true,
    answerMode: "gemini",
    analytics: {
      tokenUsage: meta.tokenUsage,
      timing: { embedMs: 0, retrieveMs: 0, generateMs: meta.generateMs, totalMs: 0 },
      chunksRetrieved,
      status: "no_memory",
      answerMode: "gemini",
    },
  };
}

function normalizeInsufficientAnswer(answer: string, lang: ResponseLanguage): string {
  const trimmed = answer.trim();
  if (trimmed && !isIncompleteGeneratedAnswer(trimmed)) return trimmed;
  return lang === "vi"
    ? "Mình chưa tìm thấy ký ức đủ cụ thể để trả lời chắc chắn."
    : "I could not find enough specific memories to answer confidently.";
}

type UnindexedDiaryRow = {
  id: string;
  raw_text: string;
  entry_date: Date | string | null;
  created_at: Date | string;
  job_status: string | null;
};

async function retrieveUnindexedDiaryFallbackHits(
  dbClient: MemoryDbClient,
  userId: string,
  filters: RetrievalFilters,
): Promise<MemorySearchHit[]> {
  if (!shouldReadUnindexedDiaries(filters)) return [];

  const queryRawUnsafe = (dbClient as {
    $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  }).$queryRawUnsafe?.bind(dbClient);
  if (!queryRawUnsafe) return [];

  let rows: UnindexedDiaryRow[] = [];
  try {
    rows = await queryRawUnsafe<UnindexedDiaryRow[]>(
      `
        SELECT
          d.id,
          d.raw_text,
          d.entry_date,
          d.created_at,
          j.status AS job_status
        FROM diary_entries d
        LEFT JOIN indexing_outbox j
          ON j.job_type = 'index_memory'
         AND j.source_type = 'diary'
         AND j.source_id = d.id
        WHERE d.user_id = $1
          AND (
            d.entry_date BETWEEN $2 AND $3
            OR (d.entry_date IS NULL AND d.created_at BETWEEN $2 AND $3)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM memory_chunks m
            WHERE m.user_id = d.user_id
              AND m.source_type = 'diary'
              AND m.source_id = d.id
          )
        ORDER BY COALESCE(d.entry_date, d.created_at) DESC, d.created_at DESC
        LIMIT $4
      `,
      userId,
      filters.startDate,
      filters.endDate,
      Math.min(filters.limit ?? 8, 8),
    );
  } catch (error) {
    console.warn("[AnswerMemory] Unindexed diary fallback failed:", error);
    return [];
  }

  return rows
    .map((row, index) => buildUnindexedDiaryHit(row, index))
    .filter((hit): hit is MemorySearchHit => hit !== null);
}

function shouldReadUnindexedDiaries(filters: RetrievalFilters): boolean {
  if (!filters.startDate || !filters.endDate) return false;
  if (filters.sourceType && filters.sourceType !== "diary") return false;
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes("diary")) return false;
  if (
    filters.preferredSourceTypes?.length &&
    !filters.preferredSourceTypes.includes("diary")
  ) {
    return false;
  }

  return true;
}

function buildUnindexedDiaryHit(row: UnindexedDiaryRow, index: number): MemorySearchHit | null {
  const rawText = row.raw_text.trim();
  if (!rawText) return null;

  const title = extractDiaryTitle(rawText);
  const occurredAt = row.entry_date ? new Date(row.entry_date) : new Date(row.created_at);

  return {
    id: `unindexed-diary:${row.id}`,
    sourceType: "diary",
    sourceId: row.id,
    chunkType: "general",
    text: trimPromptQuote(rawText, 1200),
    evidence: trimPromptQuote(rawText, 600),
    metadata: {
      sourceType: "diary",
      sourceId: row.id,
      sourceTitle: title,
      chunkIndex: index,
      chunkType: "general",
      date: occurredAt.toISOString(),
      indexingStatus: row.job_status ?? "missing",
      fallback: "unindexed_diary",
    },
    occurredAt,
    distance: null,
    vectorSimilarity: 0,
    lexicalScore: 1,
    retrievalMode: "temporal",
    similarity: 0.72,
  };
}

function extractDiaryTitle(rawText: string): string {
  const firstLine = rawText.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine) return "Diary entry";
  return trimPromptQuote(firstLine, 80);
}

export function rerankMemoryHits(
  question: string,
  chunks: MemorySearchHit[],
  filters: RetrievalFilters = {},
): MemorySearchHit[] {
  if (chunks.length <= 1) return chunks;

  const queryTokens = new Set(importantTokens(question));
  const latestTimestamp = Math.max(
    ...chunks.map((chunk) => new Date(chunk.occurredAt).getTime()).filter(Number.isFinite),
  );
  const hasPrimarySources = chunks.some((chunk) => chunk.sourceType !== "summary");
  const recentIntent = hasRecentIntent(question);
  const normalizedQuestion = normalizeForIntent(question);
  const preferredSourceTypes = new Set(filters.preferredSourceTypes ?? []);
  const preferredChunkTypes = new Set(filters.preferredChunkTypes ?? []);
  const hasTimeFilter = Boolean(filters.startDate && filters.endDate);

  return chunks
    .map((chunk) => {
      const evidenceTokens = new Set(importantTokens(`${chunk.text} ${chunk.evidence ?? ""}`));
      const titleTokens = new Set(importantTokens(getMetadataString(chunk.metadata, "sourceTitle")));
      const metadataTokens = new Set(importantTokens(getMetadataSearchText(chunk.metadata)));
      const overlap = countOverlap(queryTokens, evidenceTokens);
      const titleOverlap = countOverlap(queryTokens, titleTokens);
      const metadataOverlap = countOverlap(queryTokens, metadataTokens);
      const overlapRatio = queryTokens.size ? overlap / queryTokens.size : 0;
      const titleRatio = queryTokens.size ? titleOverlap / queryTokens.size : 0;
      const metadataRatio = queryTokens.size ? metadataOverlap / queryTokens.size : 0;
      const occurredAt = new Date(chunk.occurredAt).getTime();
      const ageDays = Number.isFinite(occurredAt) && Number.isFinite(latestTimestamp)
        ? Math.max(0, (latestTimestamp - occurredAt) / (24 * 60 * 60 * 1000))
        : 0;
      const recencyBoost = recentIntent ? Math.max(0, 0.08 - ageDays * 0.01) : 0;
      const preferredSourceBoost = preferredSourceTypes.has(chunk.sourceType) ? 0.06 : 0;
      const preferredChunkBoost = preferredChunkTypes.has(chunk.chunkType) ? 0.05 : 0;
      const lexicalBoost = Math.min(0.1, overlapRatio * 0.1);
      const titleBoost = Math.min(0.04, titleRatio * 0.04);
      const metadataBoost = Math.min(0.08, metadataRatio * 0.08);
      const importanceBoost = getMetadataImportance(chunk.metadata) * 0.012;
      const sourceReliabilityBoost = getSourceReliabilityBoost(chunk.sourceType);
      const timeMatchBoost = hasTimeFilter ? 0.03 : 0;
      const intentBoost = getIntentSpecificBoost(normalizedQuestion, chunk);
      const noisePenalty = getMemoryNoisePenalty(chunk);
      const summaryPenalty = hasPrimarySources && chunk.sourceType === "summary" ? 0.06 : 0;

      const rerankScore =
        chunk.similarity +
        recencyBoost +
        preferredSourceBoost +
        preferredChunkBoost +
        lexicalBoost +
        titleBoost +
        metadataBoost +
        importanceBoost +
        sourceReliabilityBoost +
        timeMatchBoost +
        intentBoost -
        noisePenalty -
        summaryPenalty;

      return {
        ...chunk,
        similarity: clampScore(rerankScore),
        rerankScore,
      };
    })
    .sort(
      (a, b) =>
        b.rerankScore - a.rerankScore ||
        b.similarity - a.similarity ||
        b.occurredAt.getTime() - a.occurredAt.getTime(),
    )
    .map(({ rerankScore: _rerankScore, ...chunk }) => chunk);
}

function countOverlap(first: Set<string>, second: Set<string>): number {
  let hits = 0;
  for (const token of first) {
    if (second.has(token)) hits += 1;
  }
  return hits;
}

function getMetadataString(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getMetadataSearchText(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = metadata as Record<string, unknown>;
  return ["people", "projects", "goals", "habits", "tags"]
    .flatMap((key) => {
      const item = value[key];
      if (Array.isArray(item)) return item.filter((entry): entry is string => typeof entry === "string");
      return typeof item === "string" ? [item] : [];
    })
    .join(" ");
}

function getMetadataImportance(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const raw = (metadata as Record<string, unknown>).importance;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

function getSourceReliabilityBoost(sourceType: string): number {
  switch (sourceType) {
    case "diary":
      return 0.035;
    case "calendar":
      return 0.03;
    case "attachment":
      return 0.025;
    case "summary":
      return -0.015;
    default:
      return 0;
  }
}

function getIntentSpecificBoost(normalizedQuestion: string, chunk: MemorySearchHit): number {
  const searchable = normalizeForIntent(
    `${chunk.text} ${chunk.evidence ?? ""} ${getMetadataSearchText(chunk.metadata)} ${getMetadataString(chunk.metadata, "sourceTitle")}`,
  );

  if (isFeedbackIntent(normalizedQuestion)) {
    let boost = 0;
    if (includesAny(searchable, ["feedback", "mentor", "review", "linh", "citation", "citations", "trust", "ui", "gop y", "góp ý", "nhan xet", "nhận xét"])) {
      boost += 0.18;
    }
    if (
      includesAny(normalizedQuestion, ["citation", "citations", "trich dan", "trích dẫn"]) &&
      includesAny(searchable, ["citation", "citations", "cite", "source", "trust", "ui", "trich dan", "trích dẫn"])
    ) {
      boost += 0.16;
    }
    if (chunk.chunkType === "feedback") {
      boost += 0.08;
    }
    if (isGoogleContactsSearchText(searchable) && !isGoogleContactsIntent(normalizedQuestion)) {
      boost -= 0.34;
    }
    return boost;
  }

  if (isBlockerIntent(normalizedQuestion)) {
    let boost = 0;
    if (includesAny(searchable, ["blocker", "risk", "challenge", "stuck", "quota", "worker", "indexing", "fallback", "blocked", "trở ngại", "rủi ro", "khó khăn"])) {
      boost += 0.16;
    }
    if (chunk.chunkType === "action_item" || chunk.chunkType === "reflection") {
      boost += 0.05;
    }
    if (includesAny(searchable, ["asks search about", "asks about blockers", "best questions are", "sample questions"])) {
      boost -= 0.24;
    }
    return boost;
  }

  if (isLatencyIntent(normalizedQuestion)) {
    let boost = 0;
    if (hasOnlyQuestionListEvidence(searchable)) {
      boost -= 0.22;
    }
    if (includesAny(searchable, [
      "retrieval latency",
      "answer generation",
      "generation latency",
      "embedding time",
      "database retrieval",
      "reranking",
      "p95",
      "500 millisecond",
      "500 ms",
      "time to first result",
      "separate",
      "separately",
    ])) {
      boost += 0.22;
    }
    if (chunk.chunkType === "decision" || chunk.chunkType === "general_note") {
      boost += 0.04;
    }
    return boost;
  }

  if (isGmailIntent(normalizedQuestion)) {
    let boost = 0;
    if (hasGmailEvidence(searchable)) {
      boost += 0.24;
    } else {
      boost -= 0.12;
    }
    if (chunk.chunkType === "decision" || chunk.chunkType === "feedback") {
      boost += 0.06;
    }
    if (hasLatencyEvidence(searchable) && !hasGmailEvidence(searchable)) {
      boost -= 0.18;
    }
    return boost;
  }

  if (isMoodIntent(normalizedQuestion)) {
    let boost = 0;
    if (isStressIntent(normalizedQuestion) && hasOnlyQuestionListEvidence(searchable)) {
      boost -= 0.22;
    }
    if (includesAny(searchable, ["stress", "stressed", "worried", "confident", "relieved", "mood", "emotion", "blocker", "risk", "weak", "quota", "bad", "căng thẳng", "tâm trạng", "cảm xúc"])) {
      boost += 0.12;
    }
    if (chunk.chunkType === "reflection") {
      boost += 0.06;
    }
    return boost;
  }

  if (isGoogleContactsIntent(normalizedQuestion)) {
    let boost = 0;
    if (chunk.sourceType === "contact") {
      boost += 0.28;
    }
    if (includesAny(searchable, ["google contacts", "contacts", "people api", "contact names", "emails", "phone numbers", "organizations", "danh bạ", "danh ba"])) {
      boost += 0.2;
    }
    if (chunk.chunkType === "decision" || chunk.chunkType === "action_item") {
      boost += 0.05;
    }
    return boost;
  }

  return 0;
}

function getMemoryNoisePenalty(chunk: MemorySearchHit): number {
  const searchable = normalizeForIntent(
    `${chunk.text} ${chunk.evidence ?? ""} ${getMetadataString(chunk.metadata, "sourceTitle")}`,
  );

  if (
    includesAny(searchable, [
      "best questions are",
      "sample questions",
      "test questions",
      "cau hoi test",
      "asks search about",
      "asks about mentor feedback",
      "asks about blockers",
      "what feedback did",
      "what blockers did",
      "why did we separate",
    ])
  ) {
    return 0.22;
  }

  if (/^(the mood is|my mood is|the mood was)\b/u.test(searchable.trim())) {
    return 0.14;
  }

  if (includesAny(searchable, ["final ai memory checklist", "final checklist has six items"])) {
    return 0.06;
  }

  return 0;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function reconcileConfidence(
  modelConfidence: "high" | "medium" | "low",
  retrievalConfidence: "high" | "medium" | "low",
  answer: string,
  hadUnsupportedClaims = false,
): "high" | "medium" | "low" {
  if (hadUnsupportedClaims) return "low";

  if (
    modelConfidence === "low" &&
    retrievalConfidence !== "low" &&
    !isInsufficientAnswer(answer)
  ) {
    return "medium";
  }

  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[modelConfidence] <= rank[retrievalConfidence]
    ? modelConfidence
    : retrievalConfidence;
}

function hasAdequateSemanticSupport(chunks: MemorySearchHit[]): boolean {
  const top = chunks[0];
  if (!top) return false;

  if (top.retrievalMode === "lexical" && top.vectorSimilarity < 0.3) {
    return false;
  }

  if (top.retrievalMode === "temporal") {
    return chunks.some((chunk) => chunk.retrievalMode === "temporal");
  }

  return chunks.some((chunk) => chunk.vectorSimilarity >= 0.5);
}

function isClaimSupportedByQuote(claim: string, quote: string): boolean {
  const claimTokens = importantTokens(claim);
  if (claimTokens.length <= 2) return quoteContainsMeaningfulPhrase(claim, quote);

  const quoteTokens = new Set(importantTokens(quote));
  const hits = claimTokens.filter((token) => quoteTokens.has(token)).length;
  const coverage = hits / claimTokens.length;

  return hits >= 2 && coverage >= 0.45;
}

function isAnswerGroundedByCitations(
  answer: string,
  citations: Array<{ marker: string; claim: string }>,
  sourceByMarker: Map<string, MemoryCitation>,
  lang: ResponseLanguage,
): boolean {
  if (isInsufficientAnswer(answer)) return false;
  if (lang === "vi" && citations.length > 0) {
    return true;
  }

  const citedEvidence = citations
    .map((citation) => {
      const source = sourceByMarker.get(citation.marker);
      return `${citation.claim} ${source?.quote ?? ""}`;
    })
    .join(" ");
  const answerTokens = importantTokens(answer);

  if (answerTokens.length <= 4) {
    return quoteContainsMeaningfulPhrase(answer, citedEvidence);
  }

  const evidenceTokens = new Set(importantTokens(citedEvidence));
  const hits = answerTokens.filter((token) => evidenceTokens.has(token)).length;
  return hits >= 3 && hits / answerTokens.length >= 0.35;
}

function answerPassesEvidenceChecks(
  answer: string,
  citations: MemoryCitation[],
): boolean {
  if (isIncompleteGeneratedAnswer(answer)) return false;
  if (isInsufficientAnswer(answer)) return true;

  const evidenceText = citations
    .map((citation) => `${citation.claim ?? ""} ${citation.quote} ${citation.sourceTitle ?? ""} ${citation.occurredAt}`)
    .join(" ");
  const normalizedEvidence = normalizeForIntent(evidenceText);

  const answerDateTokens = extractDateLikeTokens(answer);
  if (answerDateTokens.some((token) => !dateTokenSupportedByEvidence(token, normalizedEvidence))) {
    return false;
  }

  const answerNames = extractNamedEntityTokens(answer);
  const unsupportedNames = answerNames.filter((name) => {
    const normalizedName = normalizeForIntent(name);
    return normalizedName.length >= 3 && !normalizedEvidence.includes(normalizedName);
  });

  return unsupportedNames.length === 0;
}

function dateTokenSupportedByEvidence(token: string, normalizedEvidence: string): boolean {
  const normalizedToken = normalizeForIntent(token).replace(/\s+/g, " ").trim();
  if (!normalizedToken) return true;
  if (normalizedEvidence.includes(normalizedToken)) return true;

  const month = detectMonth(normalizedToken);
  if (month !== null) {
    const monthNumber = String(month + 1).padStart(2, "0");
    if (normalizedEvidence.includes(`-${monthNumber}-`)) return true;
    if (normalizedEvidence.includes(`/${monthNumber}/`)) return true;
  }

  const numeric = normalizedToken.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-]((?:20)?\d{2}))?\b/u);
  if (numeric) {
    const day = String(Number(numeric[1])).padStart(2, "0");
    const monthNumber = String(Number(numeric[2])).padStart(2, "0");
    if (normalizedEvidence.includes(`-${monthNumber}-${day}`)) return true;
    if (normalizedEvidence.includes(`${day}/${monthNumber}`)) return true;
  }

  return false;
}

function extractDateLikeTokens(value: string): string[] {
  const tokens = new Set<string>();
  const normalized = normalizeForIntent(value);

  for (const match of normalized.matchAll(/\b20\d{2}-\d{1,2}-\d{1,2}\b/gu)) {
    tokens.add(match[0]);
  }

  for (const match of normalized.matchAll(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-](?:20)?\d{2})?\b/gu)) {
    tokens.add(match[0]);
  }

  for (const match of normalized.matchAll(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|thang\s+\d{1,2})(?:\s+20\d{2})?\b/gu)) {
    tokens.add(match[0].replace(/\s+/g, " ").trim());
  }

  return [...tokens];
}

function extractNamedEntityTokens(value: string): string[] {
  const ignored = new Set([
    "I",
    "You",
    "The",
    "This",
    "That",
    "On",
    "In",
    "Based",
    "Mình",
    "Bạn",
    "Dựa",
    "Vào",
    "Trong",
  ]);

  const matches = value.match(/\b[\p{Lu}][\p{L}\p{M}\p{N}_-]*(?:\s+[\p{Lu}][\p{L}\p{M}\p{N}_-]*){0,3}\b/gu) ?? [];

  return [...new Set(
    matches
      .map((match) => match.trim())
      .filter((match) => match.length >= 3 && !ignored.has(match)),
  )];
}

function quoteContainsMeaningfulPhrase(value: string, quote: string): boolean {
  const normalizedValue = normalizeForIntent(value).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const normalizedQuote = normalizeForIntent(quote).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const compactValue = normalizedValue.replace(/\s+/g, " ").trim();
  return compactValue.length >= 4 && normalizedQuote.includes(compactValue);
}

function importantTokens(value: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "about",
    "as",
    "be",
    "but",
    "by",
    "can",
    "cua",
    "cho",
    "co",
    "da",
    "dang",
    "de",
    "did",
    "do",
    "for",
    "from",
    "gi",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "is",
    "it",
    "la",
    "lam",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "so",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "toi",
    "trong",
    "va",
    "ve",
    "voi",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "who",
    "why",
    "will",
    "with",
    "you",
  ]);

  return normalizeForIntent(value)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function isInsufficientAnswer(answer: string): boolean {
  const normalized = normalizeForIntent(answer);
  return includesAny(normalized, [
    "insufficient",
    "not enough",
    "not found",
    "khong du",
    "chua tim thay",
    "khong tim thay",
    "khong co thong tin",
    "khong co du lieu",
    "chua co thong tin",
    "chua co du lieu",
    "khong co thong tin cu the",
    "khong co du thong tin",
  ]);
}

function isIncompleteGeneratedAnswer(answer: string): boolean {
  const trimmed = answer.replace(/\s+/g, " ").trim();
  if (!trimmed) return true;
  const hasTerminalPunctuation = /[.!?…。！？]$/u.test(trimmed);

  const normalized = normalizeForIntent(trimmed);
  if (includesAny(normalized, [
    "ky uc hien tai khong co thong tin ve bat ky",
    "dua tren cac ghi chep tuan nay minh",
    "dua tren cac ky uc da luu minh",
  ])) {
    return true;
  }

  const lastWord = normalized.split(/\s+/).filter(Boolean).at(-1) ?? "";
  if (!hasTerminalPunctuation && lastWord.length <= 1) return true;
  if (
    !hasTerminalPunctuation &&
    /\b(?:to claim|claim|because|because of|due to|in order to|so that|such as|for example|including|include)$/iu.test(normalized)
  ) {
    return true;
  }

  return /\b(?:mình|minh|bạn|ban|về|ve|vì|vi|bởi|boi|any|about|because|the|a|an|is|are|was|were|to|for|of|and|or)$/iu.test(
    normalized,
  );
}

function classifyModelError(
  error: unknown,
): NonNullable<AnswerMemoryResult["modelError"]> {
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : undefined;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429 || message.includes("429")) {
    return { status: status ?? 429, kind: "quota", message: summarizeError(message) };
  }

  if (status === 503 || message.includes("503")) {
    return {
      status: status ?? 503,
      kind: "service_unavailable",
      message: summarizeError(message),
    };
  }

  if (error && typeof error === "object" && error.constructor?.name === "ZodError") {
    return { kind: "validation", message: summarizeError(message) };
  }

  if (isModelValidationErrorMessage(message)) {
    return { kind: "validation", message: summarizeError(message) };
  }

  if (
    message.includes("500") ||
    message.includes("ECONNRESET") ||
    message.includes("fetch failed")
  ) {
    return { status, kind: "transient", message: summarizeError(message) };
  }

  return { status, kind: "unknown", message: summarizeError(message) };
}

function isModelValidationErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid json") ||
    normalized.includes("could not be repaired") ||
    normalized.includes("truncated") ||
    normalized.includes("finishreason") ||
    normalized.includes("did not finish normally") ||
    normalized.includes("validation") ||
    normalized.includes("zoderror")
  );
}

function summarizeError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid json") ||
    normalized.includes("could not be repaired") ||
    normalized.includes("invalid_type") ||
    normalized.includes("nonoptional") ||
    normalized.includes("received undefined") ||
    normalized.includes("expected nonoptional")
  ) {
    return "Generated answer JSON was invalid and could not be parsed safely.";
  }

  return message.replace(/\s+/g, " ").slice(0, 240);
}

function buildDebugTrace(input: {
  question: string;
  inferredFilters: RetrievalFilters;
  appliedFilters: RetrievalFilters;
  chunks: MemorySearchHit[];
  result: AnswerMemoryResult;
}): MemoryDebugTrace {
  return {
    question: input.question,
    inferredFilters: serializeFilters(input.inferredFilters),
    appliedFilters: serializeFilters(input.appliedFilters),
    status: input.result.analytics?.status ?? "error",
    reason: explainResult(input.result, input.chunks),
    chunksRetrieved: input.chunks.length,
    topChunks: buildCitations([...input.chunks].sort((a, b) => b.similarity - a.similarity))
      .slice(0, 8)
      .map((citation) => ({
        id: citation.chunkId,
        sourceType: citation.sourceType,
        sourceId: citation.sourceId,
        sourceTitle: citation.sourceTitle,
        chunkType: citation.chunkType,
        occurredAt: citation.occurredAt,
        retrievalMode: citation.retrievalMode ?? "unknown",
        similarity: roundScore(citation.similarity),
        vectorSimilarity: roundScore(citation.vectorSimilarity ?? 0),
        lexicalScore: roundScore(citation.lexicalScore ?? 0),
        distance:
          input.chunks.find((chunk) => chunk.id === citation.chunkId)?.distance ?? null,
        quote: citation.quote,
      })),
  };
}

function serializeFilters(filters: RetrievalFilters): Record<string, unknown> {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined);
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}

function explainResult(result: AnswerMemoryResult, chunks: MemorySearchHit[]): string {
  if (result.analytics?.status === "success") {
    if (result.answerMode === "extractive_fallback") {
      return result.modelError
        ? `Extractive fallback used after ${result.modelError.kind}: ${result.modelError.message}`
        : "Answer assembled directly from retrieved memories.";
    }

    if (
      result.answerMode === "fast_path" ||
      result.analytics.tokenUsage.model === "fast-path" ||
      result.analytics.tokenUsage.model === "temporal-fast-path"
    ) {
      return "Answer assembled from retrieved chunks without model generation.";
    }

    if (result.answerMode === "gemini") {
      return "Answer generated with supported citations.";
    }

    return "Memory search completed successfully.";
  }

  if (!chunks.length) {
    return "Retrieval returned zero chunks after filters and thresholds.";
  }

  if (result.citations.length === 0 && result.analytics?.tokenUsage.totalTokens) {
    return "Chunks were retrieved, but the generated answer did not pass citation/evidence validation.";
  }

  if (result.noMemory) {
    return "Chunks were retrieved, but top similarity or semantic support was below the answer threshold.";
  }

  if (result.analytics?.status === "error") {
    return result.modelError
      ? `Model error: ${result.modelError.kind}`
      : "Answer generation failed after retrieval.";
  }

  return "Memory search completed with low confidence.";
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function noMemoryResult(message: string, lang: ResponseLanguage): AnswerMemoryResult {
  const suggestions = lang === 'vi'
    ? [
        'Thêm nhật ký mới về chủ đề này',
        'Thử diễn đạt lại câu hỏi',
        'Đồng bộ Google Calendar để thêm ký ức',
      ]
    : [
        'Add a new diary entry about this topic',
        'Try rephrasing your question',
        'Sync your Google Calendar for more memories',
      ];

  return {
    answer: message,
    confidence: "low",
    citations: [],
    noMemory: true,
    suggestions,
    answerMode: "no_memory",
  };
}
