import {
  generateTuturuuuAudioTranscript,
  generateTuturuuuFileText,
  generateTuturuuuVisionText,
  getTuturuuuTranscriptionModel,
  getTuturuuuVisionModel,
} from "@second-brain/ai";
import { isAudioAttachmentMimeType } from "@second-brain/shared";
import sharp from "sharp";
import {
  prepareAudioChunks,
  type PreparedAudioChunk,
} from "./audio-compression";
import { transcribeAudioLocally } from "./local-audio-transcription";

export const isAudioMimeType = isAudioAttachmentMimeType;

const MAX_AI_IMAGE_BYTES = 1_000_000;

export async function prepareImageForExtraction(buffer: Buffer) {
  const attempts = [
    { maxDimension: 2200, quality: 84 },
    { maxDimension: 1800, quality: 76 },
    { maxDimension: 1500, quality: 68 },
    { maxDimension: 1200, quality: 58 },
  ];
  let optimized = buffer;

  for (const attempt of attempts) {
    optimized = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: attempt.maxDimension,
        height: attempt.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "white" })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();

    if (optimized.length <= MAX_AI_IMAGE_BYTES) break;
  }

  if (optimized.length > MAX_AI_IMAGE_BYTES) {
    throw new Error(
      `Optimized image is still too large (${optimized.length} bytes).`,
    );
  }

  return { buffer: optimized, mimeType: "image/jpeg" };
}

export async function extractAudioAttachmentContent(input: {
  attachmentId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  maxOutputTokens: number;
}) {
  const provider =
    process.env.AUDIO_TRANSCRIPTION_PROVIDER?.trim().toLowerCase() || "local";
  if (provider === "local") {
    return transcribeAudioLocally({
      buffer: input.buffer,
      fileName: input.fileName,
    });
  }
  if (provider !== "tuturuuu") {
    throw new Error(
      `Unsupported AUDIO_TRANSCRIPTION_PROVIDER "${provider}". Use "local" or "tuturuuu".`,
    );
  }

  const chunks = await prepareAudioChunks(input.buffer, input.mimeType);
  return transcribeAudioChunks({
    attachmentId: input.attachmentId,
    chunks,
    fileName: input.fileName,
    maxOutputTokens: input.maxOutputTokens,
  });
}

export async function transcribeAudioChunks(input: {
  attachmentId: string;
  chunks: PreparedAudioChunk[];
  fileName: string;
  maxOutputTokens: number;
}) {
  const transcripts: string[] = [];

  for (const [index, chunk] of input.chunks.entries()) {
    const partNumber = index + 1;
    const result = await generateTuturuuuAudioTranscript({
      model: getTuturuuuTranscriptionModel(),
      prompt: buildAudioTranscriptionPrompt(partNumber, input.chunks.length),
      base64Data: chunk.buffer.toString("base64"),
      mimeType: chunk.mimeType,
      fileName: buildChunkFileName(
        input.fileName,
        partNumber,
        input.chunks.length,
      ),
      maxOutputTokens: input.maxOutputTokens,
      idempotencyKey:
        input.chunks.length === 1
          ? `attachment-transcription-${input.attachmentId}`
          : `attachment-transcription-${input.attachmentId}-part-${partNumber}`,
    });

    const transcript = result.output.trim();
    if (!transcript) {
      throw new Error(
        `Audio transcription returned empty text for part ${partNumber}.`,
      );
    }
    if (isInvalidExtractionResponse(transcript)) {
      throw new Error(
        `Audio transcription provider did not process segment ${partNumber}.`,
      );
    }
    transcripts.push(transcript);
  }

  return transcripts.join("\n\n");
}

export async function extractAttachmentContent(input: {
  attachmentId: string;
  base64Data?: string;
  fileUrl?: string;
  mimeType: string;
  fileName: string;
  maxOutputTokens: number;
}) {
  const audio = isAudioMimeType(input.mimeType);
  const image = input.mimeType.toLowerCase().startsWith("image/");
  const prompt = audio
    ? buildAudioTranscriptionPrompt()
    : buildDocumentExtractionPrompt();
  let result: { output: string };

  if (audio) {
    if (!input.base64Data) {
      throw new Error("Audio extraction requires base64Data.");
    }
    result = await generateTuturuuuAudioTranscript({
      model: getTuturuuuTranscriptionModel(),
      prompt,
      base64Data: input.base64Data,
      mimeType: input.mimeType,
      fileName: input.fileName,
      maxOutputTokens: input.maxOutputTokens,
      idempotencyKey: `attachment-transcription-${input.attachmentId}`,
    });
  } else if (image) {
    result = await generateTuturuuuVisionText({
      model: getTuturuuuVisionModel(),
      prompt,
      base64Data: input.base64Data,
      imageUrl: input.fileUrl,
      mimeType: input.mimeType,
      maxOutputTokens: input.maxOutputTokens,
      idempotencyKey: `attachment-extraction-${input.attachmentId}`,
    });
  } else {
    result = await generateTuturuuuFileText({
      model: getTuturuuuVisionModel(),
      prompt,
      base64Data: input.base64Data,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      maxOutputTokens: input.maxOutputTokens,
      idempotencyKey: `attachment-extraction-${input.attachmentId}`,
    });
  }

  const extractedText = result.output.trim();
  if (!extractedText) {
    throw new Error(
      audio
        ? "Audio transcription returned empty text."
        : "Attachment extraction returned empty text.",
    );
  }

  if (isInvalidExtractionResponse(extractedText)) {
    throw new Error(
      audio
        ? "Audio transcription returned a provider placeholder instead of a transcript."
        : "Attachment extraction returned a provider placeholder instead of file content.",
    );
  }

  return extractedText;
}

function isInvalidExtractionResponse(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("[object object]") ||
    (normalized.includes("retype") && normalized.includes("question")) ||
    normalized.includes("provide the file again")
  );
}

function buildAudioTranscriptionPrompt(partNumber = 1, partCount = 1) {
  return [
    "Transcribe this audio recording accurately for a personal Second Brain memory.",
    partCount > 1
      ? `This is chronological segment ${partNumber} of ${partCount}; transcribe only this segment.`
      : "",
    "Preserve the spoken language and meaning; do not translate unless the speaker translates themselves.",
    "Add speaker labels only when speakers are clearly distinguishable.",
    "Include meaningful spoken dates, names, decisions, tasks, and action items exactly as heard.",
    "Mark unclear words briefly as [unclear] instead of inventing content.",
    "Return only the transcript, without commentary or markdown fences.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildChunkFileName(
  fileName: string,
  partNumber: number,
  partCount: number,
) {
  if (partCount === 1) return fileName;
  const extensionIndex = fileName.lastIndexOf(".");
  const suffix = `.part-${String(partNumber).padStart(4, "0")}`;
  return extensionIndex > 0
    ? `${fileName.slice(0, extensionIndex)}${suffix}${fileName.slice(extensionIndex)}`
    : `${fileName}${suffix}.mp3`;
}

function buildDocumentExtractionPrompt() {
  return [
    "You are an extraction engine for a personal Second Brain app.",
    "Read every available page or visible region of this attachment.",
    "Extract readable text, headings, labels, table content, dates, names, decisions, tasks, and other meaningful details.",
    "Preserve the document order and use short markdown headings or bullets when they clarify the structure.",
    "For images with little or no visible text, provide a concise factual description of objects, setting, and visible activity.",
    "Do not invent names, dates, or claims that are not visible in the file.",
    "Return only the extracted content or factual description, without commentary about the extraction process.",
  ].join(" ");
}
