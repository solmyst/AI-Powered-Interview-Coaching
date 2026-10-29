import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpeech } from "../server/speech.js";

test("Sarvam TTS keeps credentials server-side and decodes bilingual WAV audio", async () => {
  let captured;
  const speech = createSpeech(
    {
      SARVAM_API_KEY: "test-key",
      SARVAM_MODEL: "bulbul:v4-flash",
      SARVAM_VOICE: "simran_enhi_customer",
    },
    {
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return Response.json({ audios: [Buffer.from("RIFF1234WAVEfmt ").toString("base64")] });
      },
    },
  );

  const result = await speech.synthesize("नमस्ते. Tell me about your project.");
  assert.equal(captured.url, "https://api.sarvam.ai/text-to-speech");
  assert.equal(captured.options.headers["api-subscription-key"], "test-key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    text: "नमस्ते. Tell me about your project.",
    language_code: "hi-IN",
    model: "bulbul:v4-flash",
    speaker: "simran_enhi_customer",
    speech_sample_rate: 24000,
    output_audio_codec: "wav",
    pace: 1,
  });
  assert.equal(result.contentType, "audio/wav");
  assert.equal(Buffer.from(result.audio).toString(), "RIFF1234WAVEfmt ");
  assert.equal(JSON.stringify(speech.status()).includes("test-key"), false);
});

test("Sarvam TTS reports readiness only with a key", async () => {
  assert.deepEqual(createSpeech({}).status(), {
    provider: "sarvam",
    model: "bulbul:v4-flash",
    voiceId: "simran_enhi_customer",
    ready: false,
  });
  await assert.rejects(createSpeech({}).synthesize("Hello"), /not configured/);
});

test("Sarvam TTS sanitizes provider failures", async () => {
  const speech = createSpeech(
    { SARVAM_API_KEY: "secret" },
    { fetchImpl: async () => new Response("provider detail", { status: 429 }) },
  );
  await assert.rejects(speech.synthesize("Question"), /busy/i);
});

test("Sarvam selects English for Latin text and respects configured voice", async () => {
  let request;
  const speech = createSpeech({ SARVAM_API_KEY: "key", SARVAM_VOICE: "simran_en_customer" }, {
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return Response.json({ audios: [Buffer.from("RIFF1234WAVEfmt ").toString("base64")] });
    },
  });
  await speech.synthesize("Describe your project.");
  assert.equal(request.language_code, "en-IN");
  assert.equal(request.model, "bulbul:v4-flash");
  assert.equal(request.speaker, "simran_en_customer");
});

test("Sarvam rejects malformed audio and hides provider error details", async () => {
  for (const response of [new Response("secret provider detail", { status: 403 }), Response.json({ audios: [] }), Response.json({ audios: ["not audio"] }), Response.json({ audios: [Buffer.from("not wav").toString("base64")] })]) {
    const speech = createSpeech({ SARVAM_API_KEY: "secret" }, { fetchImpl: async () => response });
    await assert.rejects(speech.synthesize("Question"), (error) => {
      assert.equal(error.status, 503);
      assert.doesNotMatch(error.message, /secret|provider detail/);
      return true;
    });
  }
});
