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
import { trimPromptQuote } from "./answer-memory-format.ts";
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
import { retrieveUnindexedDiaryFallbackHits } from "./answer-memory-unindexed.ts";

export type {
  AnswerMemoryOptions,
  AnswerMemoryResult,
  AnswerMode,
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

  const inferredFilters = inferRetrievalFilters(normalizedQuestion, new Date(), timeZone);
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
