import { generateGeminiJsonWithMeta } from "./gemini-json.ts";
import { getGeminiAnswerModel } from "./gemini-models.ts";
import {
  retrieveMemoryWithEmbedding,
  type MemorySearchHit,
} from "./retrieval.ts";
import { createDefaultEmbeddingProvider } from "./embedding.ts";
import type { MemoryDbClient } from "./types.ts";
import {
  buildCitations,
  classifyRetrievalConfidence,
} from "./answer-utils.ts";
import type {
  AnswerMemoryOptions,
  AnswerMemoryResult,
  AnswerStrategy,
  ResponseLanguage,
} from "./answer-memory-types.ts";
import { detectMemoryIntent } from "./answer-memory-intents.ts";
import {
  formatDateForAnswer,
  trimPromptQuote,
} from "./answer-memory-format.ts";
import {
  inferRetrievalFilters,
  resolveMemoryTimeZone,
} from "./answer-memory-temporal.ts";
import { translateFastAnswerIfUseful } from "./answer-memory-translation.ts";
import {
  GeminiGroundedAnswerResponseSchema,
  GroundedAnswerSchema,
  type GroundedAnswer,
} from "./answer-memory-schema.ts";
import {
  DEFAULT_MAX_DISTANCE,
  DEFAULT_RETRIEVAL_CANDIDATE_LIMIT,
  MIN_TOP_SIMILARITY,
} from "./answer-memory-config.ts";
import {
  buildDebugTrace,
  buildQueryAnalytics,
  classifyModelError,
  noMemoryResult,
} from "./answer-memory-result.ts";
import {
  getMemoryIndexDiagnostics,
  shouldAttachMemoryIndexDiagnostics,
} from "./answer-memory-diagnostics.ts";
import {
  answerFastExtractiveFromChunks,
  answerSingleDayFastPath,
  answerTemporalRangeFastPath,
} from "./answer-memory-fast-path.ts";
import {
  buildExpandedTemporalFilters,
  buildIntentInstruction,
  isBroadTemporalSynthesisQuestion,
  selectMaxAnswerTokens,
  selectPromptSourceLimit,
  shouldExpandTemporalEvidenceSearch,
  shouldUseAutoFastPath,
  shouldUseIntentEvidenceFastPath,
} from "./answer-memory-routing.ts";
import {
  answerIntentEvidenceFastPath,
  buildUnsupportedIntentNoMemoryResult,
} from "./answer-memory-evidence.ts";
import {
  buildExtractiveFallbackAnswer,
  buildInsufficientModelAnswer,
  buildValidationFallbackAnswer,
  canUseExtractiveFallback,
  recoverCitationsForAnswer,
} from "./answer-memory-fallback.ts";
import { rerankMemoryHits } from "./answer-memory-rerank.ts";
import {
  answerPassesEvidenceChecks,
  hasAdequateSemanticSupport,
  isAnswerGroundedByCitations,
  isClaimSupportedByQuote,
  isIncompleteGeneratedAnswer,
  isInsufficientAnswer,
  reconcileConfidence,
} from "./answer-memory-validation.ts";
import {
  findDiariesCreatedInRangeWithDifferentEntryDate,
  retrieveUnindexedDiaryFallbackHits,
  type CreatedDiaryDateMismatch,
} from "./answer-memory-unindexed.ts";

type RoutingTrace = NonNullable<NonNullable<AnswerMemoryResult["debugTrace"]>["routingTrace"]>;

export type {
  AnswerMemoryOptions,
  AnswerMemoryResult,
  AnswerStrategy,
  MemoryDebugTrace,
  QueryAnalytics,
  ResponseLanguage,
} from "./answer-memory-types.ts";
export { inferRetrievalFilters, resolveMemoryTimeZone } from "./answer-memory-temporal.ts";
export { answerSingleDayFastPath, answerTemporalRangeFastPath } from "./answer-memory-fast-path.ts";
export { rerankMemoryHits } from "./answer-memory-rerank.ts";

export async function answerMemory(
  question: string,
  userId: string,
  dbClient: MemoryDbClient,
  options: AnswerMemoryOptions = {},
): Promise<AnswerMemoryResult> {
  const totalStart = performance.now();
  const normalizedQuestion = question.trim();
  const lang = options.responseLanguage ?? "en";
  const answerStrategy = options.answerStrategy ?? "auto";
  const timeZone = resolveMemoryTimeZone(options.timeZone);
  const intent = detectMemoryIntent(normalizedQuestion);

  if (!normalizedQuestion) {
    return noMemoryResult(lang === "vi" ? "Bạn chưa nhập câu hỏi." : "Please enter a question.", lang);
  }

  const inferredFilters = inferRetrievalFilters(
    normalizedQuestion,
    options.now ?? new Date(),
    timeZone,
  );
  const broadTemporalSynthesis = isBroadTemporalSynthesisQuestion(
    normalizedQuestion,
    intent,
    inferredFilters,
  );
  const appliedFilters = {
    ...inferredFilters,
    ...options.filters,
    limit: Math.min(
      Math.max(
        options.limit ?? (broadTemporalSynthesis ? 20 : DEFAULT_RETRIEVAL_CANDIDATE_LIMIT),
        DEFAULT_RETRIEVAL_CANDIDATE_LIMIT,
      ),
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

  const useAutoFastPath = answerStrategy === "auto" &&
    shouldUseAutoFastPath(normalizedQuestion, intent, appliedFilters);
  const canUseFastPath = answerStrategy === "fast" || useAutoFastPath;
  const baseRoutingTrace = {
    intent,
    requestedStrategy: answerStrategy,
    autoFastEligible: useAutoFastPath,
    fastPathEligible: canUseFastPath,
  } satisfies Pick<
    RoutingTrace,
    "intent" | "requestedStrategy" | "autoFastEligible" | "fastPathEligible"
  >;

  const unindexedFastPathResult = canUseFastPath
    ? answerSingleDayFastPath(
        normalizedQuestion,
        unindexedDiaryChunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
        timeZone,
      ) ?? answerTemporalRangeFastPath(
        normalizedQuestion,
        unindexedDiaryChunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
        timeZone,
      )
    : null;
  if (unindexedFastPathResult) {
    const translatedUnindexedFastPathResult = await translateFastAnswerIfUseful(
      unindexedFastPathResult,
      {
        question: normalizedQuestion,
        responseLanguage: lang,
      },
    );

    if (unindexedFastPathResult.analytics) {
      translatedUnindexedFastPathResult.analytics!.timing.embedMs = 0;
      translatedUnindexedFastPathResult.analytics!.timing.retrieveMs = Math.round(preRetrieveMs);
      translatedUnindexedFastPathResult.analytics!.timing.totalMs = Math.round(performance.now() - totalStart);
      translatedUnindexedFastPathResult.analytics!.tokenUsage.model =
        translatedUnindexedFastPathResult.analytics!.tokenUsage.model === "temporal-fast-path"
          ? "unindexed-diary-temporal-fast-path"
          : translatedUnindexedFastPathResult.analytics!.tokenUsage.model === "fast-path"
            ? "unindexed-diary-fast-path"
            : translatedUnindexedFastPathResult.analytics!.tokenUsage.model;
    }

    translatedUnindexedFastPathResult.debugTrace = buildDebugTrace({
      question: normalizedQuestion,
      inferredFilters,
      appliedFilters,
      chunks: unindexedDiaryChunks,
      result: translatedUnindexedFastPathResult,
      routingTrace: {
        ...baseRoutingTrace,
        selectedPath: "unindexed_fast_path",
        reason: "A direct date/range question matched diary rows that were saved but not indexed yet.",
        usedUnindexedDiary: true,
        translationRan: didTranslationRun(unindexedFastPathResult, translatedUnindexedFastPathResult),
      },
    });

    return translatedUnindexedFastPathResult;
  }

  const embedStart = performance.now();
  let embedding: number[];
  try {
    embedding = await createDefaultEmbeddingProvider().embedQuery(normalizedQuestion);
  } catch (error) {
    const embedMs = performance.now() - embedStart;
    const modelError = classifyModelError(error);
    const fallbackSources = buildCitations(unindexedDiaryChunks);
    const unavailableMessage = modelError.kind === "quota"
      ? lang === "vi"
        ? "Tuturuuu AI đang bị giới hạn quota/rate limit nên mình chưa thể tìm kiếm AI lúc này."
        : "Tuturuuu AI is currently quota/rate limited, so AI search is unavailable right now."
      : lang === "vi"
        ? "Tuturuuu AI hiện không khả dụng, nên mình chưa thể tìm kiếm AI lúc này."
        : "Tuturuuu AI is currently unavailable, so AI search is unavailable right now.";
    const result = fallbackSources.length
      ? buildExtractiveFallbackAnswer(
          lang,
          fallbackSources,
          unindexedDiaryChunks.length,
          modelError,
          {},
          normalizedQuestion,
          timeZone,
        )
      : noMemoryResult(
          unavailableMessage,
          lang,
        );

    result.modelError = modelError;
    result.analytics = result.analytics ?? buildQueryAnalytics({
      model: "n/a",
      chunksRetrieved: unindexedDiaryChunks.length,
      status: "error",
      answerMode: result.answerMode,
    });
    result.analytics.timing.embedMs = Math.round(embedMs);
    result.analytics.timing.retrieveMs = Math.round(preRetrieveMs);
    result.analytics.timing.totalMs = Math.round(performance.now() - totalStart);
    result.analytics.status = "error";

    result.debugTrace = buildDebugTrace({
      question: normalizedQuestion,
      inferredFilters,
      appliedFilters,
      chunks: unindexedDiaryChunks,
      result,
      routingTrace: {
        ...baseRoutingTrace,
        selectedPath: "embedding_error_fallback",
        reason: "Embedding failed before indexed memory retrieval, so only available unindexed diary fallback evidence could be used.",
        usedUnindexedDiary: unindexedDiaryChunks.length > 0,
        translationRan: false,
      },
      diagnostics: await maybeGetMemoryIndexDiagnostics(
        dbClient,
        userId,
        appliedFilters,
        result,
        unindexedDiaryChunks.length,
      ),
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

  if (!chunks.length) {
    const createdDateMismatchResult = await maybeBuildCreatedDateMismatchResult(
      dbClient,
      userId,
      appliedFilters,
      lang,
      timeZone,
      {
        embedMs,
        retrieveMs,
        totalMs: performance.now() - totalStart,
      },
    );

    if (createdDateMismatchResult) {
      createdDateMismatchResult.debugTrace = buildDebugTrace({
        question: normalizedQuestion,
        inferredFilters,
        appliedFilters,
        chunks,
        result: createdDateMismatchResult,
        routingTrace: {
          ...baseRoutingTrace,
          selectedPath: "created_date_mismatch",
          reason: "No memory matched the requested memory date, but diary rows created on that date had a different entry date.",
          usedUnindexedDiary: false,
          translationRan: false,
        },
        diagnostics: await maybeGetMemoryIndexDiagnostics(
          dbClient,
          userId,
          appliedFilters,
          createdDateMismatchResult,
          chunks.length,
        ),
      });
      return createdDateMismatchResult;
    }
  }

  const fastPathResult = canUseFastPath
    ? answerSingleDayFastPath(
        normalizedQuestion,
        chunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
        timeZone,
      ) ?? answerTemporalRangeFastPath(
        normalizedQuestion,
        chunks,
        appliedFilters,
        lang,
        options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
        timeZone,
      )
    : null;

  let selectedPath: RoutingTrace["selectedPath"] =
    fastPathResult || canUseFastPath ? "indexed_fast_path" : "deep_generation";
  let result = fastPathResult ??
    (canUseFastPath
      ? answerFastExtractiveFromChunks(
          normalizedQuestion,
          chunks,
          lang,
          options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
          timeZone,
        )
      : await answerFromChunks(normalizedQuestion, chunks, {
          minTopSimilarity: options.minTopSimilarity ?? MIN_TOP_SIMILARITY,
          responseLanguage: lang,
          answerStrategy,
          timeZone,
        }));
  if (result.answerMode === "extractive_fallback") {
    selectedPath = result.modelError?.kind === "validation"
      ? "deep_validation_fallback"
      : "deep_model_error_fallback";
  } else if (result.answerMode === "no_memory") {
    selectedPath = "no_memory";
  } else if (result.answerMode === "gemini") {
    selectedPath = "deep_generation";
  } else if (result.answerMode === "fast_path") {
    selectedPath = "indexed_fast_path";
  }

  const beforeTranslation = result;
  result = await translateFastAnswerIfUseful(result, {
    question: normalizedQuestion,
    responseLanguage: lang,
  });

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
    routingTrace: {
      ...baseRoutingTrace,
      selectedPath,
      reason: describeSelectedPath(selectedPath, canUseFastPath, answerStrategy),
      usedUnindexedDiary: unindexedDiaryChunks.length > 0,
      translationRan: didTranslationRun(beforeTranslation, result),
    },
    diagnostics: await maybeGetMemoryIndexDiagnostics(
      dbClient,
      userId,
      appliedFilters,
      result,
      chunks.length,
    ),
  });

  return result;
}

export async function answerFromChunks(
  question: string,
  chunks: MemorySearchHit[],
  options: {
    minTopSimilarity?: number;
    responseLanguage?: ResponseLanguage;
    answerStrategy?: AnswerStrategy;
    timeZone?: string;
    generateAnswer?: typeof generateGeminiJsonWithMeta<GroundedAnswer>;
  } = {},
): Promise<AnswerMemoryResult> {
  const minTopSimilarity = options.minTopSimilarity ?? MIN_TOP_SIMILARITY;
  const lang = options.responseLanguage ?? "en";
  const answerStrategy = options.answerStrategy ?? "auto";
  const timeZone = resolveMemoryTimeZone(options.timeZone);
  const intent = detectMemoryIntent(question);

  if (!chunks.length) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình chưa tìm thấy ký ức đủ liên quan để trả lời chắc chắn."
        : "I couldn't find any relevant memories to answer your question.",
      lang,
    );
    result.analytics = buildQueryAnalytics({
      model: "n/a",
      chunksRetrieved: 0,
      status: "no_memory",
      answerMode: "no_memory",
    });
    return result;
  }

  const sortedChunks = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = sortedChunks[0]?.similarity ?? 0;

  if (topSimilarity < minTopSimilarity || !hasAdequateSemanticSupport(sortedChunks)) {
    const result = noMemoryResult(
      lang === "vi"
        ? "Mình tìm thấy một vài ký ức gần nghĩa, nhưng độ liên quan chưa đủ cao để trả lời chắc chắn."
        : "I found some loosely related memories, but the relevance isn't strong enough for a confident answer.",
      lang,
    );
    result.analytics = buildQueryAnalytics({
      model: "n/a",
      chunksRetrieved: chunks.length,
      status: "no_memory",
      answerMode: "no_memory",
    });
    return result;
  }

  const sources = buildCitations(sortedChunks);
  const shouldTryIntentFastPath = shouldUseIntentEvidenceFastPath(
    question,
    intent,
    answerStrategy,
  );
  if (shouldTryIntentFastPath) {
    const intentEvidenceAnswer = answerIntentEvidenceFastPath(
      question,
      sources,
      chunks.length,
      lang,
      intent,
      timeZone,
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

  if (
    answerStrategy === "fast" ||
    (answerStrategy === "auto" && shouldUseAutoFastPath(question, intent))
  ) {
    return answerFastExtractiveFromChunks(question, chunks, lang, minTopSimilarity, timeZone);
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

  const languageInstruction = lang === "vi"
    ? '- PHẢI trả lời bằng tiếng Việt tự nhiên. Dùng "mình" cho assistant và "bạn" cho user.'
    : "- You MUST answer in natural English.";
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
- Keep answer concise: at most 120 words or 5 short bullets.
- Include at most 4 citation objects unless more are absolutely necessary.
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
      return buildValidationFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        "Generated answer appeared incomplete.",
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
        timeZone,
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
          analytics: buildQueryAnalytics({
            model: tokenUsage.model,
            tokenUsage,
            timing: { generateMs: Math.round(generateMs) },
            chunksRetrieved: chunks.length,
            status: "success",
            answerMode: "gemini",
          }),
        };
      }

      return buildValidationFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        "Generated answer did not include usable grounded citations.",
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
        timeZone,
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
    const augmentedCitations = mergeRecoveredCitations(
      citations,
      recoverCitationsForAnswer(output.answer, promptSources, question, intent),
    );

    const retrievalConfidence = classifyRetrievalConfidence(
      topSimilarity,
      augmentedCitations.length,
    );
    if (!answerGrounded) {
      return buildValidationFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        "Generated answer was not sufficiently grounded in its citations.",
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
        timeZone,
      );
    }

    if (!answerPassesEvidenceChecks(output.answer, augmentedCitations)) {
      return buildValidationFallbackAnswer(
        lang,
        promptSources,
        chunks.length,
        "Generated answer mentioned dates or named entities that were not supported by evidence.",
        {
          generateMs: Math.round(generateMs),
          tokenUsage,
        },
        question,
        timeZone,
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
      citations: augmentedCitations,
      answerMode: "gemini",
      analytics: buildQueryAnalytics({
        model: tokenUsage.model,
        tokenUsage,
        timing: { generateMs: Math.round(generateMs) },
        chunksRetrieved: chunks.length,
        status: "success",
        answerMode: "gemini",
      }),
    };
  } catch (error) {
    const modelError = classifyModelError(error);
    console.warn(
      `[AnswerMemory] Failed to generate grounded answer (${modelError.kind}${modelError.status ? ` ${modelError.status}` : ""}): ${modelError.message}`,
    );

    if (canUseExtractiveFallback(modelError, promptSources)) {
      return buildExtractiveFallbackAnswer(lang, promptSources, chunks.length, modelError, {}, question, timeZone);
    }

    return {
      answer:
        lang === "vi"
          ? "Mình đã tìm thấy ký ức liên quan, nhưng không thể tạo câu trả lời có cấu trúc đáng tin cậy ở lần này."
          : "I found relevant memories, but was unable to generate a structured answer this time.",
      confidence: "low",
      citations: [],
      answerMode: "extractive_fallback",
      modelError,
      analytics: buildQueryAnalytics({
        model: "n/a",
        chunksRetrieved: chunks.length,
        status: "error",
        answerMode: "extractive_fallback",
      }),
    };
  }
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

async function maybeBuildCreatedDateMismatchResult(
  dbClient: MemoryDbClient,
  userId: string,
  filters: AnswerMemoryOptions["filters"],
  lang: ResponseLanguage,
  timeZone: string,
  timing: {
    embedMs: number;
    retrieveMs: number;
    totalMs: number;
  },
): Promise<AnswerMemoryResult | null> {
  if (!filters?.startDate || !filters.endDate) return null;

  const rows = await findDiariesCreatedInRangeWithDifferentEntryDate(
    dbClient,
    userId,
    filters,
  );
  if (!rows.length) return null;

  const labels = rows
    .map((row) => formatDateForAnswer(row.entryDate, lang, timeZone))
    .filter(Boolean);
  const uniqueLabels = [...new Set(labels)];
  const primaryLabel = uniqueLabels[0];
  const createdLabel = formatDateForAnswer(rows[0]!.createdAt, lang, timeZone);
  const message = buildCreatedDateMismatchMessage(
    rows,
    primaryLabel,
    createdLabel,
    lang,
    timeZone,
  );
  const result = noMemoryResult(message, lang);

  result.suggestions = primaryLabel
    ? lang === "vi"
      ? [
          `Hỏi: ngày ${primaryLabel} tôi làm gì?`,
          "Kiểm tra Memory date trên diary card",
          "Sửa entry date nếu diary đang sai ngày",
        ]
      : [
          `Ask: what did I do on ${primaryLabel}?`,
          "Check the Memory date on the diary card",
          "Edit the entry date if the diary is dated incorrectly",
        ]
    : result.suggestions;
  result.analytics = buildQueryAnalytics({
    model: "n/a",
    chunksRetrieved: 0,
    status: "no_memory",
    answerMode: "no_memory",
    timing: {
      embedMs: Math.round(timing.embedMs),
      retrieveMs: Math.round(timing.retrieveMs),
      generateMs: 0,
      totalMs: Math.round(timing.totalMs),
    },
  });

  return result;
}

function buildCreatedDateMismatchMessage(
  rows: CreatedDiaryDateMismatch[],
  primaryLabel: string | undefined,
  createdLabel: string,
  lang: ResponseLanguage,
  timeZone: string,
): string {
  const titles = rows
    .map((row) => extractDiaryTitle(row.rawText))
    .filter(Boolean)
    .slice(0, 2);
  const titleSuffix = titles.length ? ` (${titles.join(", ")})` : "";
  const dateList = rows
    .map((row) => formatDateForAnswer(row.entryDate, lang, timeZone))
    .filter(Boolean);
  const uniqueDateList = [...new Set(dateList)].join(", ");

  if (lang === "vi") {
    return [
      `Mình không tìm thấy ký ức có memory date là ${createdLabel}.`,
      `Có diary được tạo ngày đó${titleSuffix}, nhưng diary này đang được lưu với memory date ${uniqueDateList || primaryLabel}.`,
      primaryLabel
        ? `Hãy hỏi "ngày ${primaryLabel} tôi làm gì?" hoặc sửa entry date nếu bạn muốn nó thuộc ngày ${createdLabel}.`
        : "Hãy kiểm tra lại entry date của diary này.",
    ].join(" ");
  }

  return [
    `I couldn't find memories whose memory date is ${createdLabel}.`,
    `I did find diary entries created on that date${titleSuffix}, but they are stored with memory date ${uniqueDateList || primaryLabel}.`,
    primaryLabel
      ? `Try asking "what did I do on ${primaryLabel}?" or edit the entry date if it should belong to ${createdLabel}.`
      : "Check the diary entry date for that entry.",
  ].join(" ");
}

function extractDiaryTitle(rawText: string): string {
  return trimPromptQuote(rawText.split(/\r?\n/, 1)[0]?.trim() ?? "", 80);
}

function mergeRecoveredCitations<T extends { chunkId: string; similarity: number }>(
  citations: T[],
  recoveredCitations: T[],
): T[] {
  if (!recoveredCitations.length) return citations;

  const byChunkId = new Map<string, T>();
  for (const citation of citations) {
    byChunkId.set(citation.chunkId, citation);
  }

  for (const citation of recoveredCitations) {
    if (byChunkId.has(citation.chunkId)) continue;
    byChunkId.set(citation.chunkId, citation);
  }

  return [...byChunkId.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);
}

function didTranslationRun(
  before: AnswerMemoryResult,
  after: AnswerMemoryResult,
): boolean {
  if (before.answerMode !== "fast_path" || after.answerMode !== "fast_path") return false;
  return (
    before.answer !== after.answer ||
    (after.analytics?.tokenUsage.totalTokens ?? 0) > (before.analytics?.tokenUsage.totalTokens ?? 0)
  );
}

function describeSelectedPath(
  selectedPath: RoutingTrace["selectedPath"],
  canUseFastPath: boolean,
  answerStrategy: AnswerStrategy,
): string {
  switch (selectedPath) {
    case "indexed_fast_path":
      return canUseFastPath
        ? "The requested strategy allowed Fast path, so the answer was assembled from retrieved evidence without full generation."
        : "The result used an indexed Fast path.";
    case "deep_generation":
      return answerStrategy === "deep"
        ? "Deep was requested explicitly, so the answer used grounded model generation."
        : "Auto routing required synthesis/reasoning, so the answer used grounded model generation.";
    case "deep_validation_fallback":
      return "Grounded model generation ran, but validation rejected unsupported or incomplete output, so evidence fallback replaced the answer.";
    case "deep_model_error_fallback":
      return "Grounded model generation failed, so evidence fallback replaced the answer.";
    case "no_memory":
      return "Retrieval did not provide enough supported evidence to answer.";
    case "unindexed_fast_path":
      return "A direct date/range question matched unindexed diary evidence.";
    case "embedding_error_fallback":
      return "Embedding failed before indexed retrieval, so fallback evidence was used.";
    case "created_date_mismatch":
      return "The requested created date did not match stored memory dates.";
    default:
      return "Answer routing completed.";
  }
}

async function maybeGetMemoryIndexDiagnostics(
  dbClient: MemoryDbClient,
  userId: string,
  filters: AnswerMemoryOptions["filters"],
  result: AnswerMemoryResult,
  chunksRetrieved: number,
) {
  if (!filters) return undefined;
  if (
    !shouldAttachMemoryIndexDiagnostics({
      chunksRetrieved,
      status: result.analytics?.status,
      noMemory: result.noMemory,
      hasModelError: Boolean(result.modelError),
    })
  ) {
    return undefined;
  }

  try {
    return await getMemoryIndexDiagnostics(dbClient, userId, filters);
  } catch (error) {
    console.warn("[AnswerMemory] Failed to load memory index diagnostics:", error);
    return undefined;
  }
}
