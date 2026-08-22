import {
  generateTuturuuuAudioTranscript,
  generateTuturuuuVisionText,
  getTuturuuuTranscriptionModel,
  getTuturuuuVisionModel,
} from '@second-brain/ai';
import { isAudioAttachmentMimeType } from '@second-brain/shared';
import {
  prepareAudioChunks,
  type PreparedAudioChunk,
} from './audio-compression';

export const isAudioMimeType = isAudioAttachmentMimeType;

export async function extractAudioAttachmentContent(input: {
  attachmentId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  maxOutputTokens: number;
}) {
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
      base64Data: chunk.buffer.toString('base64'),
      mimeType: chunk.mimeType,
      fileName: buildChunkFileName(input.fileName, partNumber, input.chunks.length),
      maxOutputTokens: input.maxOutputTokens,
      idempotencyKey: input.chunks.length === 1
        ? `attachment-transcription-${input.attachmentId}`
        : `attachment-transcription-${input.attachmentId}-part-${partNumber}`,
    });

    const transcript = result.output.trim();
    if (!transcript) {
      throw new Error(`Audio transcription returned empty text for part ${partNumber}.`);
    }
    transcripts.push(transcript);
  }

  return transcripts.join('\n\n');
}

export async function extractAttachmentContent(input: {
  attachmentId: string;
  base64Data: string;
  mimeType: string;
  fileName: string;
  maxOutputTokens: number;
}) {
  const audio = isAudioMimeType(input.mimeType);
  const prompt = audio
    ? buildAudioTranscriptionPrompt()
    : buildDocumentExtractionPrompt();
  const result = audio
    ? await generateTuturuuuAudioTranscript({
        model: getTuturuuuTranscriptionModel(),
        prompt,
        base64Data: input.base64Data,
        mimeType: input.mimeType,
        fileName: input.fileName,
        maxOutputTokens: input.maxOutputTokens,
        idempotencyKey: `attachment-transcription-${input.attachmentId}`,
      })
    : await generateTuturuuuVisionText({
        model: getTuturuuuVisionModel(),
        prompt,
        base64Data: input.base64Data,
        mimeType: input.mimeType,
        maxOutputTokens: input.maxOutputTokens,
        idempotencyKey: `attachment-extraction-${input.attachmentId}`,
      });

  const extractedText = result.output.trim();
  if (!extractedText) {
    throw new Error(audio
      ? 'Audio transcription returned empty text.'
      : 'Attachment extraction returned empty text.');
  }

  return extractedText;
}

function buildAudioTranscriptionPrompt(partNumber = 1, partCount = 1) {
  return [
    'Transcribe this audio recording accurately for a personal Second Brain memory.',
    partCount > 1
      ? `This is chronological segment ${partNumber} of ${partCount}; transcribe only this segment.`
      : '',
    'Preserve the spoken language and meaning; do not translate unless the speaker translates themselves.',
    'Add speaker labels only when speakers are clearly distinguishable.',
    'Include meaningful spoken dates, names, decisions, tasks, and action items exactly as heard.',
    'Mark unclear words briefly as [unclear] instead of inventing content.',
    'Return only the transcript, without commentary or markdown fences.',
  ].filter(Boolean).join(' ');
}

function buildChunkFileName(fileName: string, partNumber: number, partCount: number) {
  if (partCount === 1) return fileName;
  const extensionIndex = fileName.lastIndexOf('.');
  const suffix = `.part-${String(partNumber).padStart(4, '0')}`;
  return extensionIndex > 0
    ? `${fileName.slice(0, extensionIndex)}${suffix}${fileName.slice(extensionIndex)}`
    : `${fileName}${suffix}.mp3`;
}

function buildDocumentExtractionPrompt() {
  return [
    'You are an extraction engine for a personal Second Brain app.',
    'Extract all readable text, headings, labels, and meaningful textual content from this attachment.',
    'For images with little or no visible text, provide a concise factual description of what is shown.',
    'Do not invent names, dates, or claims that are not visible in the file.',
    'Return only the extracted text or factual description.',
  ].join(' ');
}
