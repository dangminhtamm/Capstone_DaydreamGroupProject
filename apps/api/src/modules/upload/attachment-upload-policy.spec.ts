import {
  AUDIO_ATTACHMENT_MAX_BYTES,
  getAttachmentMaxBytes,
  getAttachmentValidationError,
  isAudioAttachmentMimeType,
  STANDARD_ATTACHMENT_MAX_BYTES,
  SUPPORTED_ATTACHMENT_MIME_PATTERN,
} from './attachment-upload-policy';

describe('attachment upload policy', () => {
  it.each([
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/flac',
  ])('accepts supported audio MIME type %s', (mimeType) => {
    expect(isAudioAttachmentMimeType(mimeType)).toBe(true);
    expect(SUPPORTED_ATTACHMENT_MIME_PATTERN.test(mimeType)).toBe(true);
    expect(getAttachmentValidationError({ mimetype: mimeType, size: 1024 })).toBeNull();
  });

  it('keeps the smaller limit for non-audio files', () => {
    expect(getAttachmentMaxBytes('application/pdf')).toBe(STANDARD_ATTACHMENT_MAX_BYTES);
    expect(getAttachmentValidationError({
      mimetype: 'application/pdf',
      size: STANDARD_ATTACHMENT_MAX_BYTES + 1,
    })).toContain('5 MB');
  });

  it('allows larger audio files up to the audio limit', () => {
    expect(getAttachmentMaxBytes('audio/mpeg')).toBe(AUDIO_ATTACHMENT_MAX_BYTES);
    expect(getAttachmentValidationError({
      mimetype: 'audio/mpeg',
      size: STANDARD_ATTACHMENT_MAX_BYTES + 1,
    })).toBeNull();
    expect(getAttachmentValidationError({
      mimetype: 'audio/mpeg',
      size: AUDIO_ATTACHMENT_MAX_BYTES + 1,
    })).toContain('20 MB');
  });

  it('rejects unsupported MIME types', () => {
    expect(getAttachmentValidationError({
      mimetype: 'video/mp4',
      size: 1024,
    })).toContain('Unsupported attachment type');
  });
});
