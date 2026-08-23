import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_WHISPER_MODEL = "Xenova/whisper-tiny";
const WHISPER_SAMPLE_RATE = 16_000;

let transcriberPromise: Promise<any> | undefined;

export async function transcribeAudioLocally(input: {
  buffer: Buffer;
  fileName: string;
}) {
  const audio = await convertToWhisperPcm(input.buffer, input.fileName);
  const transcriber = await getWhisperTranscriber();
  const language = process.env.AUDIO_TRANSCRIPTION_LANGUAGE?.trim();
  const result = await transcriber(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
    task: "transcribe",
    ...(language ? { language } : {}),
  });
  const text = readTranscriptionText(result);
  if (!text) {
    throw new Error("Local Whisper transcription returned empty text.");
  }
  return text;
}

async function getWhisperTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.cacheDir =
        process.env.WHISPER_CACHE_DIR?.trim() ||
        join(tmpdir(), "second-brain-whisper-cache");
      const model =
        process.env.WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL;
      console.log(`[Audio Transcription] Loading local model ${model}`);
      return pipeline("automatic-speech-recognition", model, {
        dtype: "q8",
      });
    })().catch((error) => {
      transcriberPromise = undefined;
      throw error;
    });
  }
  return transcriberPromise;
}

async function convertToWhisperPcm(buffer: Buffer, fileName: string) {
  const tempDir = await mkdtemp(join(tmpdir(), "local-whisper-"));
  const extension = safeAudioExtension(fileName);
  const inputPath = join(tempDir, `input${extension}`);
  const outputPath = join(tempDir, "audio.f32le");

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(WHISPER_SAMPLE_RATE),
      "-acodec",
      "pcm_f32le",
      "-f",
      "f32le",
      outputPath,
    ]);
    const pcm = await readFile(outputPath);
    const copy = pcm.buffer.slice(
      pcm.byteOffset,
      pcm.byteOffset + pcm.byteLength,
    );
    return new Float32Array(copy);
  } catch (error) {
    throw new Error(
      `Local audio preparation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function safeAudioExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : ".audio";
}

function readTranscriptionText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const text = (result as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}
