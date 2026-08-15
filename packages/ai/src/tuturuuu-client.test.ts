import assert from "node:assert/strict";
import test from "node:test";
import {
  generateTuturuuuAudioTranscript,
  generateTuturuuuVisionText,
} from "./tuturuuu-client.ts";

test("generateTuturuuuVisionText sends image input through Tuturuuu Responses API", async () => {
  const previousApiKey = process.env.TUTURUUU_AI_API_KEY;
  const previousBaseUrl = process.env.TUTURUUU_AI_BASE_URL;
  const originalFetch = globalThis.fetch;
  let capturedRequest:
    | {
        url: string;
        init: RequestInit;
      }
    | undefined;

  process.env.TUTURUUU_AI_API_KEY = "test-tuturuuu-key";
  process.env.TUTURUUU_AI_BASE_URL = "https://unit.test/v1";
  globalThis.fetch = (async (url, init) => {
    capturedRequest = {
      url: String(url),
      init: init ?? {},
    };

    return new Response(
      JSON.stringify({
        output_text: "Visible attachment text",
        model: "google/gemini-3.5-flash-lite",
        usage: {
          input_tokens: 10,
          output_tokens: 4,
          total_tokens: 14,
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-test",
        },
      },
    );
  }) as typeof fetch;

  try {
    const result = await generateTuturuuuVisionText({
      model: "gemini-3.5-flash-lite",
      prompt: "Extract text.",
      base64Data: "abc123",
      mimeType: "image/png",
      maxOutputTokens: 300,
    });

    assert.equal(result.output, "Visible attachment text");
    assert.equal(result.model, "google/gemini-3.5-flash-lite");
    assert.equal(capturedRequest?.url, "https://unit.test/v1/responses");

    const body = JSON.parse(String(capturedRequest?.init.body));
    assert.equal(body.model, "google/gemini-3.5-flash-lite");
    assert.equal(body.max_output_tokens, 300);
    assert.equal(body.input[0].role, "user");
    assert.equal(body.input[0].content[0].type, "input_text");
    assert.equal(body.input[0].content[0].text, "Extract text.");
    assert.equal(body.input[0].content[1].type, "input_image");
    assert.equal(body.input[0].content[1].image_url, "data:image/png;base64,abc123");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.TUTURUUU_AI_API_KEY;
    else process.env.TUTURUUU_AI_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.TUTURUUU_AI_BASE_URL;
    else process.env.TUTURUUU_AI_BASE_URL = previousBaseUrl;
  }
});

test("generateTuturuuuAudioTranscript sends audio as a Responses API file input", async () => {
  const previousApiKey = process.env.TUTURUUU_AI_API_KEY;
  const previousBaseUrl = process.env.TUTURUUU_AI_BASE_URL;
  const originalFetch = globalThis.fetch;
  let capturedRequest: { url: string; init: RequestInit } | undefined;

  process.env.TUTURUUU_AI_API_KEY = "test-tuturuuu-key";
  process.env.TUTURUUU_AI_BASE_URL = "https://unit.test/v1";
  globalThis.fetch = (async (url, init) => {
    capturedRequest = { url: String(url), init: init ?? {} };
    return new Response(JSON.stringify({
      output_text: "Xin chao, day la ban ghi am.",
      model: "google/gemini-3.5-flash-lite",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await generateTuturuuuAudioTranscript({
      model: "gemini-3.5-flash-lite",
      prompt: "Transcribe this recording.",
      base64Data: "YXVkaW8=",
      mimeType: "audio/mpeg",
      fileName: "meeting.mp3",
      maxOutputTokens: 1200,
      idempotencyKey: "attachment-audio-1",
    });

    assert.equal(result.output, "Xin chao, day la ban ghi am.");
    assert.equal(capturedRequest?.url, "https://unit.test/v1/responses");

    const body = JSON.parse(String(capturedRequest?.init.body));
    const filePart = body.input[0].content[1];
    assert.equal(filePart.type, "input_file");
    assert.equal(filePart.filename, "meeting.mp3");
    assert.equal(filePart.file_data, "data:audio/mpeg;base64,YXVkaW8=");

    const headers = capturedRequest?.init.headers as Record<string, string>;
    assert.equal(headers["Idempotency-Key"], "attachment-audio-1");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.TUTURUUU_AI_API_KEY;
    else process.env.TUTURUUU_AI_API_KEY = previousApiKey;
    if (previousBaseUrl === undefined) delete process.env.TUTURUUU_AI_BASE_URL;
    else process.env.TUTURUUU_AI_BASE_URL = previousBaseUrl;
  }
});
