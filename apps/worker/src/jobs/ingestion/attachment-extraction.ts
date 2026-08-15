import {
  generateTuturuuuAudioTranscript,
  generateTuturuuuVisionText,
  getTuturuuuTranscriptionModel,
  getTuturuuuVisionModel,
} from '@second-brain/ai';
import { isAudioAttachmentMimeType } from '@second-brain/shared';

export const isAudioMimeType = isAudioAttachmentMimeType;

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

function buildAudioTranscriptionPrompt() {
  return [
    'Transcribe this audio recording accurately for a personal Second Brain memory.',
    'Preserve the spoken language and meaning; do not translate unless the speaker translates themselves.',
    'Add speaker labels only when speakers are clearly distinguishable.',
    'Include meaningful spoken dates, names, decisions, tasks, and action items exactly as heard.',
    'Mark unclear words briefly as [unclear] instead of inventing content.',
    'Return only the transcript, without commentary or markdown fences.',
  ].join(' ');
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
