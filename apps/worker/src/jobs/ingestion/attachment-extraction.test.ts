import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  extractAttachmentContent,
  isAudioMimeType,
  prepareImageForExtraction,
  transcribeAudioChunks,
} from "./attachment-extraction.ts";

test("isAudioMimeType recognizes supported browser and mobile audio formats", () => {
  assert.equal(isAudioMimeType("audio/mpeg"), true);
  assert.equal(isAudioMimeType("audio/mp4"), true);
  assert.equal(isAudioMimeType("audio/x-m4a"), true);
  assert.equal(isAudioMimeType("audio/wav"), true);
  assert.equal(isAudioMimeType("application/pdf"), false);
});

test("extractAttachmentContent sends optimized images as base64 image inputs", async () => {
  const requests = await captureExtractionRequests(async () => {
    const result = await extractAttachmentContent({
      attachmentId: "image-1",
      fileName: "receipt.png",
      base64Data: "b3B0aW1pemVkLWltYWdl",
      mimeType: "image/jpeg",
      maxOutputTokens: 800,
    });
    assert.equal(result, "Extracted attachment text");
  });

  const input = requests[0]?.input[0].content[1];
  assert.equal(input.type, "input_image");
  assert.equal(input.image_url, "data:image/jpeg;base64,b3B0aW1pemVkLWltYWdl");
});

test("prepareImageForExtraction keeps the AI request payload below its size budget", async () => {
  const source = await sharp({
    create: {
      width: 3200,
      height: 2400,
      channels: 3,
      background: { r: 230, g: 235, b: 240 },
    },
  })
    .png()
    .toBuffer();

  const result = await prepareImageForExtraction(source);

  assert.equal(result.mimeType, "image/jpeg");
  assert.ok(result.buffer.length <= 1_000_000);
  const metadata = await sharp(result.buffer).metadata();
  assert.ok((metadata.width ?? 0) <= 2200);
  assert.ok((metadata.height ?? 0) <= 2200);
});

test("extractAttachmentContent rejects provider placeholders", async () => {
  await assert.rejects(
    captureExtractionRequests(
      () =>
        extractAttachmentContent({
          attachmentId: "image-placeholder",
          fileName: "receipt.jpg",
          base64Data: "aW1hZ2U=",
          mimeType: "image/jpeg",
          maxOutputTokens: 800,
        }),
      "It looks like your message came through as [object Object]. Please retype your question.",
    ),
    /provider placeholder/,
  );
});

test("extractAttachmentContent sends PDFs as file inputs by URL", async () => {
  const requests = await captureExtractionRequests(async () => {
    const result = await extractAttachmentContent({
      attachmentId: "pdf-1",
      fileName: "project-plan.pdf",
      fileUrl: "https://storage.test/signed/project-plan.pdf",
      mimeType: "application/pdf",
      maxOutputTokens: 1600,
    });
    assert.equal(result, "Extracted attachment text");
  });

  const input = requests[0]?.input[0].content[1];
  assert.equal(input.type, "input_file");
  assert.equal(input.filename, "project-plan.pdf");
  assert.equal(input.file_url, "https://storage.test/signed/project-plan.pdf");
  assert.equal(input.file_data, undefined);
});

test("transcribeAudioChunks sends ordered requests with unique idempotency keys", async () => {
  const previousApiKey = process.env.TUTURUUU_AI_API_KEY;
  const previousBaseUrl = process.env.TUTURUUU_AI_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body: any; headers: Record<string, string> }> = [];

  process.env.TUTURUUU_AI_API_KEY = "test-key";
  process.env.TUTURUUU_AI_BASE_URL = "https://unit.test/v1";
  globalThis.fetch = (async (_url, init) => {
    requests.push({
      body: JSON.parse(String(init?.body)),
      headers: init?.headers as Record<string, string>,
    });
    return new Response(
      JSON.stringify({
        output_text: `Transcript ${requests.length}`,
        model: "google/gemini-3.5-flash-lite",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const transcript = await transcribeAudioChunks({
      attachmentId: "attachment-1",
      fileName: "meeting.m4a",
      maxOutputTokens: 1200,
      chunks: [
        { buffer: Buffer.from("part-one"), mimeType: "audio/mpeg" },
        { buffer: Buffer.from("part-two"), mimeType: "audio/mpeg" },
      ],
    });

    assert.equal(transcript, "Transcript 1\n\nTranscript 2");
    assert.equal(requests.length, 2);
    assert.equal(
      requests[0]?.headers["Idempotency-Key"],
      "attachment-transcription-attachment-1-part-1",
    );
    assert.equal(
      requests[1]?.headers["Idempotency-Key"],
      "attachment-transcription-attachment-1-part-2",
    );
    assert.deepEqual(requests[0]?.body.input[0].content[1], {
      type: "input_audio",
      input_audio: {
        data: Buffer.from("part-one").toString("base64"),
        format: "mp3",
      },
    });
    assert.match(requests[1]?.body.input[0].content[0].text, /segment 2 of 2/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.TUTURUUU_AI_API_KEY;
    else process.env.TUTURUUU_AI_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.TUTURUUU_AI_BASE_URL;
    else process.env.TUTURUUU_AI_BASE_URL = previousBaseUrl;
  }
});

test("transcribeAudioChunks rejects provider placeholders", async () => {
  await assert.rejects(
    captureExtractionRequests(
      () =>
        transcribeAudioChunks({
          attachmentId: "attachment-placeholder",
          fileName: "recording.mp3",
          maxOutputTokens: 1200,
          chunks: [
            { buffer: Buffer.from("audio"), mimeType: "audio/mpeg" },
          ],
        }),
      "It looks like your message came through as [object Object],[object Object].",
    ),
    /provider did not process segment 1/,
  );
});

async function captureExtractionRequests(
  run: () => Promise<unknown>,
  outputText = "Extracted attachment text",
) {
  const previousApiKey = process.env.TUTURUUU_AI_API_KEY;
  const previousBaseUrl = process.env.TUTURUUU_AI_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: any[] = [];

  process.env.TUTURUUU_AI_API_KEY = "test-key";
  process.env.TUTURUUU_AI_BASE_URL = "https://unit.test/v1";
  globalThis.fetch = (async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        output_text: outputText,
        model: "google/gemini-3.5-flash-lite",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    await run();
    return requests;
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.TUTURUUU_AI_API_KEY;
    else process.env.TUTURUUU_AI_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.TUTURUUU_AI_BASE_URL;
    else process.env.TUTURUUU_AI_BASE_URL = previousBaseUrl;
  }
}
