import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Base64 adds roughly 33% to the JSON request. Keeping raw chunks below 600 KB
// leaves room for the prompt and request envelope under a 1 MB gateway limit.
export const MAX_TRANSCRIPTION_CHUNK_BYTES = 600_000;

const TARGET_BITRATE = '48k';
const TARGET_SAMPLE_RATE = 16_000;
const TARGET_CHANNELS = 1;
const DEFAULT_SEGMENT_SECONDS = 75;

export interface PreparedAudioChunk {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Make audio safe to embed in the transcription API's JSON request.
 * Small files pass through unchanged; larger files are re-encoded and split.
 */
export async function prepareAudioChunks(
  inputBuffer: Buffer,
  inputMimeType: string,
): Promise<PreparedAudioChunk[]> {
  if (inputBuffer.length <= MAX_TRANSCRIPTION_CHUNK_BYTES) {
    return [{ buffer: inputBuffer, mimeType: inputMimeType }];
  }

  const FfmpegCommand = await loadFfmpeg();
  if (!await checkFfmpegAvailable(FfmpegCommand)) {
    throw new Error(
      'Audio is too large for one transcription request and ffmpeg is unavailable. Install ffmpeg on the worker to enable audio chunking.',
    );
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'audio-transcription-'));
  const inputPath = join(
    tempDir,
    `input-${randomUUID()}${mimeTypeToExtension(inputMimeType)}`,
  );
  const outputPattern = join(tempDir, 'segment-%04d.mp3');

  try {
    await writeFile(inputPath, inputBuffer);

    await new Promise<void>((resolve, reject) => {
      FfmpegCommand(inputPath)
        .noVideo()
        .outputOptions([
          '-ac', String(TARGET_CHANNELS),
          '-ar', String(TARGET_SAMPLE_RATE),
          '-b:a', TARGET_BITRATE,
          '-map_metadata', '-1',
          '-f', 'segment',
          '-segment_time', String(getSegmentSeconds()),
          '-reset_timestamps', '1',
        ])
        .on('error', (error: Error) => reject(error))
        .on('end', () => resolve())
        .save(outputPattern);
    });

    const segmentNames = (await readdir(tempDir))
      .filter((name) => /^segment-\d+\.mp3$/.test(name))
      .sort();
    if (segmentNames.length === 0) {
      throw new Error('ffmpeg produced no audio segments.');
    }

    const chunks = await Promise.all(
      segmentNames.map(async (name) => ({
        buffer: await readFile(join(tempDir, name)),
        mimeType: 'audio/mpeg',
      })),
    );
    const oversizedChunk = chunks.find((chunk) => (
      chunk.buffer.length > MAX_TRANSCRIPTION_CHUNK_BYTES
    ));
    if (oversizedChunk) {
      throw new Error(
        `An encoded audio segment is still too large (${oversizedChunk.buffer.length} bytes). Reduce AUDIO_TRANSCRIPTION_CHUNK_SECONDS.`,
      );
    }

    const outputBytes = chunks.reduce((total, chunk) => total + chunk.buffer.length, 0);
    console.log(
      `[Audio Preparation] ${Math.round(inputBuffer.length / 1024)} KB -> ${chunks.length} chunk(s), ${Math.round(outputBytes / 1024)} KB total`,
    );
    return chunks;
  } catch (error) {
    throw new Error(
      `Audio preparation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function loadFfmpeg(): Promise<any> {
  try {
    const ffmpegModule = await import('fluent-ffmpeg');
    return (ffmpegModule as any).default ?? ffmpegModule;
  } catch {
    throw new Error(
      'Audio is too large for one transcription request and fluent-ffmpeg is unavailable.',
    );
  }
}

function checkFfmpegAvailable(FfmpegCommand: any): Promise<boolean> {
  return new Promise((resolve) => {
    FfmpegCommand.getAvailableFormats((error: Error | null) => resolve(!error));
  });
}

function getSegmentSeconds() {
  const configured = Number(
    process.env.AUDIO_TRANSCRIPTION_CHUNK_SECONDS ?? DEFAULT_SEGMENT_SECONDS,
  );
  if (!Number.isFinite(configured)) return DEFAULT_SEGMENT_SECONDS;
  return Math.min(90, Math.max(30, Math.floor(configured)));
}

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'audio/mp3': '.mp3',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/webm': '.webm',
    'audio/x-flac': '.flac',
    'audio/x-m4a': '.m4a',
    'audio/x-wav': '.wav',
  };
  return map[mimeType.toLowerCase()] ?? '.bin';
}
