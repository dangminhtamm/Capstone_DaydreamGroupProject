export const STANDARD_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const AUDIO_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_EXTRACTION_FAILURE_MARKER =
  "Full text extraction was unavailable during indexing:";

export const AUDIO_ATTACHMENT_MIME_TYPES = [
  "audio/aac",
  "audio/flac",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-wav",
] as const;

export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
  ...AUDIO_ATTACHMENT_MIME_TYPES,
] as const;

export function isAudioAttachmentMimeType(mimeType: string) {
  return (AUDIO_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    mimeType.toLowerCase(),
  );
}

export function isAttachmentExtractionFallback(
  value: string | null | undefined,
) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return (
    value.includes(ATTACHMENT_EXTRACTION_FAILURE_MARKER) ||
    (normalized.includes("[object object]") &&
      normalized.includes("message came through"))
  );
}

export function getAttachmentMaxBytes(mimeType: string) {
  return isAudioAttachmentMimeType(mimeType)
    ? AUDIO_ATTACHMENT_MAX_BYTES
    : STANDARD_ATTACHMENT_MAX_BYTES;
}
