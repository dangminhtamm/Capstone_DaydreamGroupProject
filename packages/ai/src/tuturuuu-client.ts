import { randomUUID } from "node:crypto";

export const DEFAULT_TUTURUUU_API_BASE_URL = "https://ai.tuturuuu.com/v1";
export const DEFAULT_TUTURUUU_RESPONSE_MODEL = "google/gemini-3.5-flash-lite";
export const DEFAULT_TUTURUUU_EMBEDDING_MODEL = "google/gemini-embedding-2";

export interface TuturuuuTokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface TuturuuuGenerateTextOptions {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  idempotencyKey?: string;
  requestId?: string;
  responseInput?: TuturuuuResponseInput;
}

export interface TuturuuuGenerateTextResult {
  output: string;
  finishReason?: string;
  usage?: TuturuuuTokenUsage;
  model: string;
  requestId?: string;
}

export interface TuturuuuEmbeddingOptions {
  input: string | string[];
  model?: string;
  dimensions?: number;
  idempotencyKey?: string;
  requestId?: string;
}

export interface TuturuuuEmbeddingResult {
  embeddings: number[][];
  usage?: TuturuuuTokenUsage;
  model: string;
  requestId?: string;
}

export type TuturuuuResponseInput =
  | string
  | Array<{
      role: "user" | "system" | "assistant";
      content: Array<
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string }
        | {
            type: "input_audio";
            input_audio: {
              data: string;
              format: "mp3" | "wav";
            };
          }
        | {
            type: "input_file";
            filename: string;
            file_data?: string;
            file_url?: string;
          }
      >;
    }>;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value.replace(/^"|"$/g, "") : undefined;
}

export function getTuturuuuApiKey(): string | undefined {
  return readEnv("TUTURUUU_AI_API_KEY");
}

export function requireTuturuuuApiKey(): string {
  const apiKey = getTuturuuuApiKey();
  if (!apiKey) {
    throw new Error(
      "TUTURUUU_AI_API_KEY is required to call the metered Tuturuuu AI API.",
    );
  }
  return apiKey;
}

export function canUseTuturuuuApi(): boolean {
  return Boolean(getTuturuuuApiKey());
}

export function getTuturuuuApiBaseUrl(): string {
  return (
    readEnv("TUTURUUU_AI_BASE_URL") ?? DEFAULT_TUTURUUU_API_BASE_URL
  ).replace(/\/+$/g, "");
}

export function normalizeTuturuuuModelName(
  model: string | undefined,
  fallback: string,
): string {
  const value = model?.trim();
  if (!value) return fallback;

  const normalized = value.startsWith("google/") ? value : `google/${value}`;

  if (
    normalized === "google/gemini-embedding-001" ||
    normalized === "google/text-embedding-004"
  ) {
    return DEFAULT_TUTURUUU_EMBEDDING_MODEL;
  }

  return normalized;
}

export async function generateTuturuuuText(
  options: TuturuuuGenerateTextOptions,
): Promise<TuturuuuGenerateTextResult> {
  const model = normalizeTuturuuuModelName(
    options.model,
    DEFAULT_TUTURUUU_RESPONSE_MODEL,
  );
  const requestId = options.requestId ?? randomUUID();
  const payload = await requestTuturuuuJson("/responses", {
    method: "POST",
    requestId,
    idempotencyKey: options.idempotencyKey ?? requestId,
    body: {
      model,
      instructions: options.systemPrompt,
      input: options.responseInput ?? options.prompt,
      max_output_tokens: options.maxOutputTokens,
    },
  });

  const output = extractOutputText(payload).trim();
  if (!output) {
    throw new Error("Tuturuuu AI API returned an empty output_text.");
  }

  return {
    output,
    finishReason:
      readString(payload, "finish_reason") ??
      readString(payload, "finishReason"),
    usage: normalizeUsage((payload as Record<string, unknown>).usage),
    model: readString(payload, "model") ?? model,
    requestId: payload.requestId,
  };
}

export async function generateTuturuuuVisionText(options: {
  prompt: string;
  base64Data?: string;
  imageUrl?: string;
  mimeType: string;
  model?: string;
  maxOutputTokens?: number;
  idempotencyKey?: string;
  requestId?: string;
}): Promise<TuturuuuGenerateTextResult> {
  const imageUrl =
    options.imageUrl ??
    (options.base64Data
      ? `data:${options.mimeType};base64,${options.base64Data}`
      : undefined);
  if (!imageUrl) {
    throw new Error("Vision input requires imageUrl or base64Data.");
  }

  return generateTuturuuuText({
    model: options.model,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens,
    idempotencyKey: options.idempotencyKey,
    requestId: options.requestId,
    responseInput: [
      {
        role: "user",
        content: [
          { type: "input_text", text: options.prompt },
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
  });
}

export async function generateTuturuuuFileText(options: {
  prompt: string;
  fileName: string;
  fileUrl?: string;
  base64Data?: string;
  mimeType: string;
  model?: string;
  maxOutputTokens?: number;
  idempotencyKey?: string;
  requestId?: string;
}): Promise<TuturuuuGenerateTextResult> {
  const fileInput = options.fileUrl
    ? {
        type: "input_file" as const,
        filename: options.fileName,
        file_url: options.fileUrl,
      }
    : options.base64Data
      ? {
          type: "input_file" as const,
          filename: options.fileName,
          file_data: `data:${options.mimeType};base64,${options.base64Data}`,
        }
      : null;
  if (!fileInput) {
    throw new Error("File input requires fileUrl or base64Data.");
  }

  return generateTuturuuuText({
    model: options.model,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens,
    idempotencyKey: options.idempotencyKey,
    requestId: options.requestId,
    responseInput: [
      {
        role: "user",
        content: [{ type: "input_text", text: options.prompt }, fileInput],
      },
    ],
  });
}

export async function generateTuturuuuAudioTranscript(options: {
  prompt: string;
  base64Data: string;
  mimeType: string;
  fileName: string;
  model?: string;
  maxOutputTokens?: number;
  idempotencyKey?: string;
  requestId?: string;
}): Promise<TuturuuuGenerateTextResult> {
  const format = getAudioInputFormat(options.mimeType, options.fileName);

  return generateTuturuuuText({
    model: options.model,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens,
    idempotencyKey: options.idempotencyKey,
    requestId: options.requestId,
    responseInput: [
      {
        role: "user",
        content: [
          { type: "input_text", text: options.prompt },
          {
            type: "input_audio",
            input_audio: {
              data: options.base64Data,
              format,
            },
          },
        ],
      },
    ],
  });
}

function getAudioInputFormat(
  mimeType: string,
  fileName: string,
): "mp3" | "wav" {
  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedFileName = fileName.toLowerCase();
  if (
    normalizedMimeType === "audio/wav" ||
    normalizedMimeType === "audio/x-wav" ||
    normalizedFileName.endsWith(".wav")
  ) {
    return "wav";
  }
  if (
    normalizedMimeType === "audio/mpeg" ||
    normalizedMimeType === "audio/mp3" ||
    normalizedFileName.endsWith(".mp3")
  ) {
    return "mp3";
  }

  throw new Error(
    `Audio input must be normalized to MP3 or WAV before transcription (received ${mimeType}).`,
  );
}

export async function embedTuturuuu(
  options: TuturuuuEmbeddingOptions,
): Promise<TuturuuuEmbeddingResult> {
  const model = normalizeTuturuuuModelName(
    options.model,
    DEFAULT_TUTURUUU_EMBEDDING_MODEL,
  );
  const requestId = options.requestId ?? randomUUID();
  const payload = await requestTuturuuuJson("/embeddings", {
    method: "POST",
    requestId,
    idempotencyKey: options.idempotencyKey ?? requestId,
    body: {
      model,
      input: options.input,
      dimensions: options.dimensions,
    },
  });

  const embeddings = extractEmbeddings(payload);
  if (!embeddings.length) {
    throw new Error("Tuturuuu AI embeddings request returned no vectors.");
  }

  return {
    embeddings,
    usage: normalizeUsage((payload as Record<string, unknown>).usage),
    model: readString(payload, "model") ?? model,
    requestId: payload.requestId,
  };
}

async function requestTuturuuuJson(
  path: string,
  options: {
    method: "GET" | "POST";
    requestId: string;
    idempotencyKey?: string;
    body?: Record<string, unknown>;
  },
): Promise<Record<string, unknown> & { requestId?: string }> {
  const response = await fetch(`${getTuturuuuApiBaseUrl()}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${requireTuturuuuApiKey()}`,
      "Content-Type": "application/json",
      "X-Request-Id": options.requestId,
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
    },
    body: options.body
      ? JSON.stringify(stripUndefined(options.body))
      : undefined,
  });

  const payload = await response.json().catch(() => null);
  const responseRequestId =
    response.headers.get("x-request-id") ?? options.requestId;
  if (!response.ok) {
    const error = buildTuturuuuError(
      payload,
      response.status,
      responseRequestId,
    );
    throw error;
  }

  if (!payload || typeof payload !== "object") {
    throw new Error(
      `Tuturuuu AI API returned a non-JSON response (${responseRequestId}).`,
    );
  }

  return {
    ...(payload as Record<string, unknown>),
    requestId: responseRequestId,
  };
}

function buildTuturuuuError(
  payload: unknown,
  status: number,
  requestId: string,
): Error {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : {};
  const code =
    readString(nested, "code") ??
    readString(record, "code") ??
    "request_failed";
  const message =
    readString(nested, "message") ??
    readString(record, "message") ??
    readString(record, "error") ??
    `HTTP ${status}`;
  const error = new Error(`${code}: ${message} (${requestId})`);
  (error as { status?: number }).status = status;
  return error;
}

function extractOutputText(payload: Record<string, unknown>): string {
  const direct =
    readString(payload, "output_text") ?? readString(payload, "outputText");
  if (direct) return direct;

  const output = payload.output;
  if (typeof output === "string") return output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content.map((part) => {
        if (!part || typeof part !== "object") return "";
        const record = part as Record<string, unknown>;
        return (
          readString(record, "text") ?? readString(record, "output_text") ?? ""
        );
      });
    })
    .filter(Boolean)
    .join("\n");
}

function extractEmbeddings(payload: Record<string, unknown>): number[][] {
  if (Array.isArray(payload.embedding)) {
    return [coerceNumberArray(payload.embedding)];
  }

  const data = payload.data;
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (!item || typeof item !== "object") return [];
      const embedding = (item as Record<string, unknown>).embedding;
      return Array.isArray(embedding) ? coerceNumberArray(embedding) : [];
    })
    .filter((embedding) => embedding.length > 0);
}

function normalizeUsage(value: unknown): TuturuuuTokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    inputTokens: readNumber(record.input_tokens ?? record.inputTokens),
    outputTokens: readNumber(record.output_tokens ?? record.outputTokens),
    reasoningTokens: readNumber(
      record.reasoning_tokens ?? record.reasoningTokens,
    ),
    totalTokens: readNumber(record.total_tokens ?? record.totalTokens),
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function coerceNumberArray(value: unknown[]): number[] {
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
