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
test("NVIDIA Lightning disables reasoning and uses its documented sampling settings", async () => {
  const original = globalThis.fetch;
  let body;
  try {
    globalThis.fetch = async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  question: "How would you invalidate that cache?",
                  focus: "Caching",
                  difficulty: "Intermediate",
                }),
              },
            },
          ],
        }),
      );
    };
    await createAI({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-only-key",
      NVIDIA_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
    }).generate(questionSchema, "Ask one question", {});
    assert.equal(body.temperature, 1);
    assert.equal(body.top_p, 0.95);
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.name, "interview_response");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.type, "object");
  } finally {
    globalThis.fetch = original;
  }
});
test("configured NVIDIA status reports ready without setup instructions", async () => {
  const status = await createAI({
    AI_PROVIDER: "nvidia",
    NVIDIA_API_KEY: "test-only-key",
    NVIDIA_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
  }).status();
  assert.equal(status.ready, true);
  assert.equal(status.message, "NVIDIA hosted inference is configured.");
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
