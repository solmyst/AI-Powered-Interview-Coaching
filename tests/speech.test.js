import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpeech } from "../server/speech.js";

test("ElevenLabs TTS keeps credentials server-side and uses the bilingual realtime model", async () => {
  let captured;
  const speech = createSpeech(
    {
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_MODEL: "eleven_v4_turbo",
      ELEVENLABS_VOICE_ID: "voice123",
    },
    {
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      },
    },
  );

  const result = await speech.synthesize("नमस्ते. Tell me about your project.");
  assert.match(captured.url, /\/v1\/text-to-speech\/voice123\/stream/);
  assert.equal(captured.options.headers["xi-api-key"], "test-key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    text: "नमस्ते. Tell me about your project.",
    model_id: "eleven_v4_turbo",
  });
  assert.equal(result.contentType, "audio/mpeg");
  assert.deepEqual([...result.audio], [1, 2, 3]);
});

test("ElevenLabs TTS reports readiness only with a key and voice", () => {
  assert.deepEqual(createSpeech({}).status(), {
    provider: "elevenlabs",
    model: "eleven_v4_turbo",
    voiceId: "",
    ready: false,
  });
});

test("ElevenLabs TTS sanitizes provider failures", async () => {
  const speech = createSpeech(
    { ELEVENLABS_API_KEY: "secret", ELEVENLABS_VOICE_ID: "voice123" },
    { fetchImpl: async () => new Response("provider detail", { status: 429 }) },
  );
  await assert.rejects(speech.synthesize("Question"), /busy/i);
});
