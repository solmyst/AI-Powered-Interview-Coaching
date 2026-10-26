import { test } from "node:test";
import assert from "node:assert/strict";
import { createTranscriber } from "../server/transcription.js";

test("AssemblyAI transcription keeps credentials server-side and steers English and Hindi", async () => {
  let captured;
  const transcriber = createTranscriber(
    {
      ASSEMBLYAI_API_KEY: "test-key",
      ASSEMBLYAI_MODEL: "universal-3-5-pro",
    },
    {
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return new Response(
          JSON.stringify({
            text: "I built यह service.",
            confidence: 0.97,
            audio_duration_ms: 1400,
            session_id: "session-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );

  const result = await transcriber.transcribe(Buffer.from("wav"));
  assert.equal(captured.url, "https://sync.assemblyai.com/transcribe");
  assert.equal(captured.options.headers.Authorization, "test-key");
  assert.equal(captured.options.headers["X-AAI-Model"], "universal-3-5-pro");
  assert.equal(captured.options.body.get("language_codes"), '["en","hi"]');
  assert.equal(captured.options.body.get("audio").type, "audio/wav");
  assert.deepEqual(result, {
    text: "I built यह service.",
    confidence: 0.97,
    durationMs: 1400,
  });
});

test("AssemblyAI transcription fails closed when the key is unavailable", async () => {
  const transcriber = createTranscriber({}, { fetchImpl: async () => assert.fail() });
  assert.deepEqual(transcriber.status(), {
    provider: "assemblyai",
    model: "universal-3-5-pro",
    ready: false,
  });
  await assert.rejects(
    transcriber.transcribe(Buffer.from("wav")),
    /not configured/i,
  );
});

test("AssemblyAI errors are sanitized", async () => {
  const transcriber = createTranscriber(
    { ASSEMBLYAI_API_KEY: "secret" },
    {
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "internal provider detail" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    },
  );
  await assert.rejects(
    transcriber.transcribe(Buffer.from("wav")),
    /temporarily unavailable/i,
  );
});
