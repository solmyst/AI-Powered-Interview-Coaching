import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
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
                  lead: "Let us start.",
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
                  lead: "Good point.",
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
test("only local Ollama limits concurrent generations", async () => {
  const realFetch = globalThis.fetch;
  const release = [];
  globalThis.fetch = () =>
    new Promise((resolve) =>
      release.push(() =>
        resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"ok":true}' } }],
            }),
          ),
        ),
      ),
    );
  try {
    const schema = z.object({ ok: z.boolean() });
    for (const [env, busy] of [
      [{ AI_PROVIDER: "ollama" }, true],
      [
        { AI_PROVIDER: "nvidia", NVIDIA_API_KEY: "k", NVIDIA_MODEL: "m" },
        false,
      ],
    ]) {
      const ai = createAI(env);
      const pending = [
        ai.generate(schema, "t", {}),
        ai.generate(schema, "t", {}),
      ];
      const third = ai.generate(schema, "t", {});
      if (busy) await assert.rejects(third, /busy/);
      else pending.push(third);
      await new Promise((r) => setTimeout(r, 0));
      release.splice(0).forEach((done) => done());
      const results = await Promise.allSettled(pending);
      if (!busy)
        assert.deepEqual(
          results.map((r) => r.status),
          ["fulfilled", "fulfilled", "fulfilled"],
        );
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("hosted calls wait for a free slot instead of failing, and replies go before background scoring", async () => {
  const { z } = await import("zod");
  const { createAI } = await import("../server/ai.js");
  const started = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    started.push({
      at: Date.now(),
      tag: JSON.parse(init.body).messages[1].content,
    });
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  };
  try {
    const ai = createAI({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "k",
      NVIDIA_MODEL: "m",
      AI_RPM: "2",
      AI_RATE_WINDOW_MS: "400",
    });
    const schema = z.object({ ok: z.boolean() });
    const t0 = Date.now();
    const run = (tag, priority) => ai.generate(schema, "t", tag, { priority });
    // Two take the budget; a background call and then a reply queue behind them.
    await Promise.all([
      run("a", "interactive"),
      run("b", "interactive"),
      run("scoring", "background"),
      run("reply", "interactive"),
    ]);
    assert.equal(started.length, 4);
    assert.ok(started[1].at - t0 < 200, "the first two start at once");
    const order = started.map((s) => JSON.parse(s.tag));
    assert.ok(
      order.indexOf("reply") < order.indexOf("scoring"),
      "a waiting reply goes first",
    );
    assert.ok(started[2].at - t0 >= 380, "the third waits for the window");
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("assessment calls go to the grader endpoint with its key; interview calls stay on NVIDIA", async () => {
  const original = globalThis.fetch;
  const calls = [];
  const schema = z.object({ ok: z.boolean() });
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({
        url,
        auth: options.headers.Authorization,
        body: JSON.parse(options.body),
      });
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
        { status: 200 },
      );
    };
    const ai = createAI({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "nv-key",
      NVIDIA_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
      GRADER_API_KEY: "grader-key",
      GRADER_BASE_URL: "https://gateway.example/v1/",
      GRADER_MODEL: "gemini/gemini-3.8-flash",
    });
    assert.equal(ai.assessmentModel, "gemini/gemini-3.8-flash");
    await ai.generate(schema, "", {}, { purpose: "assessment" });
    await ai.generate(schema, "", {}, { purpose: "interview" });
    await ai.generate(schema, "", {}, { purpose: "classification" });
    assert.equal(calls[0].url, "https://gateway.example/v1/chat/completions");
    assert.equal(calls[0].auth, "Bearer grader-key");
    assert.equal(calls[0].body.model, "gemini/gemini-3.8-flash");
    assert.equal(calls[0].body.temperature, 0);
    assert.equal(calls[0].body.chat_template_kwargs, undefined);
    for (const call of calls.slice(1)) {
      assert.match(call.url, /integrate\.api\.nvidia\.com/);
      assert.equal(call.auth, "Bearer nv-key");
    }
    await assert.rejects(
      createAI({
        AI_PROVIDER: "nvidia",
        NVIDIA_API_KEY: "k",
        NVIDIA_MODEL: "m",
        GRADER_API_KEY: "g",
        GRADER_BASE_URL: "https://gateway.example/v1",
      }).generate(schema, "", {}, { purpose: "assessment" }),
      /GRADER_MODEL/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
