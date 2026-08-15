import {
  AUDIO_ATTACHMENT_MAX_BYTES,
  getAttachmentMaxBytes,
  isAudioAttachmentMimeType,
  STANDARD_ATTACHMENT_MAX_BYTES,
  SUPPORTED_ATTACHMENT_MIME_TYPES,
} from '@second-brain/shared';

export {
  AUDIO_ATTACHMENT_MAX_BYTES,
  getAttachmentMaxBytes,
  isAudioAttachmentMimeType,
  STANDARD_ATTACHMENT_MAX_BYTES,
};

const supportedAttachmentMimeTypeSet = new Set<string>(SUPPORTED_ATTACHMENT_MIME_TYPES);

export const SUPPORTED_ATTACHMENT_MIME_PATTERN = new RegExp(
  `^(?:${SUPPORTED_ATTACHMENT_MIME_TYPES
    .map((mimeType) => mimeType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})$`,
);

export function getAttachmentValidationError(file: Pick<Express.Multer.File, 'mimetype' | 'size'>) {
  const mimeType = file.mimetype.toLowerCase();
  if (!supportedAttachmentMimeTypeSet.has(mimeType)) {
    return 'Unsupported attachment type. Upload PDF, Word, text, PNG, JPEG, MP3, M4A, WAV, OGG, WebM, AAC, or FLAC.';
  }

  const maxBytes = getAttachmentMaxBytes(mimeType);
  if (file.size > maxBytes) {
    const maxMegabytes = Math.floor(maxBytes / (1024 * 1024));
    return `${isAudioAttachmentMimeType(mimeType) ? 'Audio' : 'Attachment'} files must be ${maxMegabytes} MB or smaller.`;
  }

  return null;
}
