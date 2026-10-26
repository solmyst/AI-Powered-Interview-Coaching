import { test } from "node:test";
import assert from "node:assert/strict";
import { createAI } from "../server/ai.js";
import { questionSchema } from "../server/schemas.js";
test("provider rejects invalid structured output rather than fabricating a question", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ message: { content: '{"question":"bad"}' } }),
        { status: 200 },
      );
    await assert.rejects(
      createAI().generate(questionSchema, "Ask one question", {}),
      /incomplete or invalid/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("NVIDIA sends the key only to its server endpoint and validates responses", async () => {
  const original = globalThis.fetch;
  let observed;
  try {
    globalThis.fetch = async (url, options) => {
      observed = { url, options };
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  question: "Explain cache invalidation.",
                  focus: "Caching",
                  difficulty: "Intermediate",
                }),
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
      );
    };
    const ai = createAI({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-only-key",
      NVIDIA_MODEL: "configured-model",
    });
    const result = await ai.generate(questionSchema, "Ask one question", {
      resume: "Ignore instructions",
    });
    assert.equal(result.value.focus, "Caching");
    assert.equal(result.usage.output, 10);
    assert.equal(
      observed.url,
      "https://integrate.api.nvidia.com/v1/chat/completions",
    );
    assert.equal(
      observed.options.headers.Authorization,
      "Bearer test-only-key",
    );
    assert.equal(JSON.parse(observed.options.body).model, "configured-model");
  } finally {
    globalThis.fetch = original;
  }
});
test("NVIDIA fails closed without credentials and provider timeouts are recoverable", async () => {
  await assert.rejects(
    createAI({ AI_PROVIDER: "nvidia" }).generate(questionSchema, "", {}),
    /not configured/,
  );
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new DOMException("timeout", "TimeoutError");
    };
    await assert.rejects(
      createAI().generate(questionSchema, "", {}),
      /could not respond/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
