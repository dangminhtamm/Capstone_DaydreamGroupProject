import { z } from "zod";
import { normalizeForIntent } from "./answer-memory-intents.ts";

const GroundedCitationSchema = z.object({
  marker: z.preprocess(normalizeCitationMarker, z.string().regex(/^S\d+$/)),
  claim: z.preprocess(
    normalizeCitationClaim,
    z.string().min(1).describe("The specific claim supported by this source"),
  ),
});

export const GroundedAnswerSchema = z.object({
  answer: z.preprocess(normalizeAnswerText, z.string().min(1)),
  confidence: z.preprocess(
    normalizeModelConfidence,
    z.enum(["high", "medium", "low"]).default("low"),
  ),
  citations: z.preprocess(
    normalizeModelCitations,
    z.array(GroundedCitationSchema).default([]),
  ),
});

export type GroundedAnswer = z.infer<typeof GroundedAnswerSchema>;

export const TuturuuuGroundedAnswerResponseSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: {
      type: "string",
      description: "One of high, medium, low.",
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          marker: {
            type: "string",
            description: "Citation marker matching S1, S2, S3, etc.",
          },
          claim: {
            type: "string",
            description: "The specific claim supported by this source.",
          },
        },
        required: ["marker", "claim"],
      },
    },
  },
  required: ["answer", "confidence", "citations"],
};

function normalizeModelConfidence(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    if (value >= 0.75) return "high";
    if (value >= 0.4) return "medium";
    return "low";
  }
  if (typeof value !== "string") return value;
  const normalized = normalizeForIntent(value).trim();

  if (
    normalized === "high" ||
    normalized.includes("high") ||
    normalized.includes("cao")
  ) {
    return "high";
  }

  if (
    normalized === "medium" ||
    normalized.includes("medium") ||
    normalized.includes("moderate") ||
    normalized.includes("trung binh") ||
    normalized.includes("vua")
  ) {
    return "medium";
  }

  if (
    normalized === "low" ||
    normalized.includes("low") ||
    normalized.includes("thap") ||
    normalized.includes("yeu")
  ) {
    return "low";
  }

  return "low";
}

function normalizeAnswerText(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["answer", "text", "response", "summary", "content"]) {
      if (typeof record[key] === "string") return record[key].trim();
    }
  }
  return value;
}

function normalizeModelCitations(value: unknown): unknown {
  const parsed = parsePossibleJson(value);

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => normalizeCitationEntry(item));
  }

  if (parsed && typeof parsed === "object") {
    const direct = normalizeCitationEntry(parsed);
    if (direct.length) return direct;

    return Object.entries(parsed as Record<string, unknown>).flatMap(([key, item]) => {
      if (typeof item === "string") {
        return [{ marker: key, claim: item }];
      }

      if (item && typeof item === "object") {
        return [{ ...(item as Record<string, unknown>), marker: (item as Record<string, unknown>).marker ?? key }];
      }

      return [];
    });
  }

  return [];
}

function normalizeCitationEntry(value: unknown): Array<{ marker?: unknown; claim?: unknown }> {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const marker =
    record.marker ??
    record.source ??
    record.sourceMarker ??
    record.citation ??
    record.ref ??
    record.reference ??
    record.id;
  const claim =
    record.claim ??
    record.evidence ??
    record.quote ??
    record.text ??
    record.support ??
    record.reason;

  if (marker === undefined && claim === undefined) return [];
  return [{ marker, claim }];
}

function normalizeCitationMarker(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `S${Math.trunc(value)}`;
  }

  if (typeof value !== "string") return value;

  const normalized = value.trim();
  const markerMatch = normalized.match(/s\s*(\d+)/i);
  if (markerMatch?.[1]) return `S${Number(markerMatch[1])}`;

  const numericMatch = normalized.match(/^\[?\s*(\d+)\s*\]?$/);
  if (numericMatch?.[1]) return `S${Number(numericMatch[1])}`;

  return normalized.toUpperCase();
}

function normalizeCitationClaim(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("; ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["claim", "evidence", "quote", "text", "summary"]) {
      if (typeof record[key] === "string") return record[key].trim();
    }
  }
  return value;
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
