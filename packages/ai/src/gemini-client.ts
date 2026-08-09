import { GoogleGenerativeAI, type RequestOptions } from "@google/generative-ai";

export const DEFAULT_TUTURUUU_GEMINI_BASE_URL =
  "https://api.tuturuuu.com/api/gproxy/gemini";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value.replace(/^"|"$/g, "") : undefined;
}

export function getGeminiCompatibleApiKey(): string | undefined {
  return readEnv("TUTURUUU_AI_API_KEY");
}

export function requireGeminiCompatibleApiKey(): string {
  const apiKey = getGeminiCompatibleApiKey();
  if (!apiKey) {
    throw new Error(
      "TUTURUUU_AI_API_KEY is required to call the Tuturuuu AI gateway.",
    );
  }
  return apiKey;
}

export function getGeminiCompatibleBaseUrl(
  apiKey = getGeminiCompatibleApiKey(),
): string {
  void apiKey;
  const explicitBaseUrl = readEnv("TUTURUUU_GEMINI_BASE_URL");

  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/g, "");
  return DEFAULT_TUTURUUU_GEMINI_BASE_URL;
}

export function getGeminiRequestOptions(
  apiKey = getGeminiCompatibleApiKey(),
): RequestOptions {
  const baseUrl = getGeminiCompatibleBaseUrl(apiKey);
  const apiVersion = readEnv("TUTURUUU_GEMINI_API_VERSION");

  return {
    baseUrl,
    ...(apiVersion ? { apiVersion } : {}),
  };
}

export function createGeminiCompatibleClient(
  apiKey = requireGeminiCompatibleApiKey(),
): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function explainGeminiGatewayError(error: unknown): Error {
  const original = error instanceof Error ? error : new Error(String(error));
  if (!isSelfSignedCertificateError(original) && !isTuturuuuFetchFailure(original)) {
    return original;
  }

  return new Error(
    [
      "AI gateway network/TLS request failed before a Gemini response was returned.",
      "For this local machine, the direct preflight showed Tuturuuu's certificate chain is not trusted by Node.js (self-signed certificate).",
      "Use a gateway URL with a valid public certificate, or start Node with NODE_EXTRA_CA_CERTS=/absolute/path/to/tuturuuu-ca.pem.",
      "Do not use NODE_TLS_REJECT_UNAUTHORIZED=0 with real API keys.",
    ].join(" "),
    { cause: original },
  );
}

function isSelfSignedCertificateError(error: Error): boolean {
  const parts = collectErrorText(error).join(" ").toLowerCase();

  return (
    parts.includes("self-signed certificate") ||
    parts.includes("self_signed_cert") ||
    parts.includes("self signed certificate") ||
    parts.includes("depth_zero_self_signed_cert")
  );
}

function isTuturuuuFetchFailure(error: Error): boolean {
  const parts = collectErrorText(error).join(" ").toLowerCase();
  return parts.includes("api.tuturuuu.com") && parts.includes("fetch failed");
}

function collectErrorText(error: unknown, seen = new Set<unknown>()): string[] {
  if (error == null || seen.has(error)) return [];
  seen.add(error);

  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    return [
      error.name,
      error.message,
      error.stack ?? "",
      String((error as { code?: unknown }).code ?? ""),
      ...collectErrorText(cause, seen),
    ];
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [
      String(record.name ?? ""),
      String(record.message ?? ""),
      String(record.code ?? ""),
      ...collectErrorText(record.cause, seen),
    ];
  }

  return [String(error)];
}
