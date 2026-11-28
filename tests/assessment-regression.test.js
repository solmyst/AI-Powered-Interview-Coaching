import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createAI } from "../server/ai.js";
import { combine, evaluate, substanceGate } from "../server/scoring.js";
import { decideTurn, tidyQuestion } from "../server/turn.js";

test("Hindi neutral transitions retain sentence punctuation", () => {
  const lead = "धन्यवाद। अब अगला सवाल सुनिए।";
  assert.equal(tidyQuestion({ question: "अगला सवाल?", lead }).lead, lead);
});

const rubric = [
  {
    key: "judgment",
    label: "Judgment",
    description: "Explains a safe, concrete decision.",
    weight: 1,
  },
];
const answer =
  "I would refund the difference, pause inaccurate quotes and verify the live fee source before restoring them.";
const context = {
  rubric,
  answer,
  role: "Product intern",
  question: {
    question: "A parking fee was quoted incorrectly. What would you do?",
  },
};
const sample = (level = 4, quote = "refund the difference") => ({
  relevant: true,
  substantive: true,
  levels: { judgment: level },
  evidence: [{ competency: "judgment", quote, supports: "strength" }],
  rationale: "Concrete containment and verification.",
});
const usage = { input: 1, output: 1 };
const judgeSample = (level = 4) => ({
  ...sample(level),
  evidence: [{ competency: "judgment", spanId: "s1", supports: "strength" }],
});

test("assessment requests use low-variance sampling and no conflicting global numeric scale", async () => {
  const original = globalThis.fetch;
  let body;
  try {
    globalThis.fetch = async (_url, init) => {
      body = JSON.parse(init.body);
      return Response.json({
        choices: [{ message: { content: '{"ok":true}' } }],
      });
    };
    await createAI({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "test-only",
      NVIDIA_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
    }).generate(
      z.object({ ok: z.boolean() }),
      "Use levels 0 to 4.",
      {},
      { purpose: "assessment" },
    );
    assert.equal(body.temperature, 0);
    assert.equal(body.top_p, 1);
    assert.doesNotMatch(body.messages[0].content, /90-100 exceptional/);
    assert.match(body.messages[0].content, /scale.*task/i);
  } finally {
    globalThis.fetch = original;
  }
});

test("fully supported top-anchor answers can earn the full scale", () => {
  assert.equal(
    combine(rubric, answer, [sample(), sample(), sample()]).scores.judgment,
    100,
  );
});

test("another judge's evidence cannot rescue two unsupported high ratings", () => {
  const unsupported = sample(4, "This quote does not exist in the answer");
  const result = combine(rubric, answer, [sample(), unsupported, unsupported]);
  assert.ok(result.scores.judgment <= 20);
  assert.ok(result.confidence.unsupported.includes("judgment"));
});

test("punctuation-only quotes never count as verified evidence", () => {
  const result = combine(rubric, answer, [
    sample(4, "!!!!!!!!"),
    sample(4, "!!!!!!!!"),
    sample(4, "!!!!!!!!"),
  ]);
  assert.ok(result.scores.judgment <= 20);
  assert.equal(result.evidence.length, 0);
});

test("a concise correct answer is not deterministically zeroed for using the question's vocabulary", () => {
  assert.equal(
    substanceGate(
      "Use a unique constraint on the idempotency key.",
      "How do you use a unique constraint on the idempotency key to prevent duplicate requests?",
    ),
    null,
  );
  assert.equal(
    substanceGate(
      "I am not sure about isolation levels, but an atomic update with a stock >= quantity condition prevents negative stock.",
      "How do you avoid negative inventory?",
    ),
    null,
  );
});

test("reference outlines are isolated by rubric and assessment calls are explicitly profiled", async () => {
  let references = 0;
  const ai = {
    provider: "test",
    model: "fixture",
    generate: async (schema, _task, _ctx, options) => {
      assert.equal(options.purpose, "assessment");
      if (schema.shape.points) {
        references++;
        return {
          value: {
            points: ["Contain harm", "Investigate cause", "Verify recovery"],
          },
          usage,
        };
      }
      return { value: judgeSample(), usage };
    },
  };
  await evaluate(ai, context);
  await evaluate(ai, {
    ...context,
    rubric: [
      {
        ...rubric[0],
        description: "Prioritizes investigation rather than compensation.",
      },
    ],
  });
  assert.equal(references, 2);
});

test("a partial judge panel does not silently publish a score", async () => {
  let calls = 0;
  const ai = {
    provider: "test",
    model: "quorum",
    generate: async (schema) => {
      if (schema.shape.points)
        return {
          value: {
            points: ["Contain harm", "Investigate cause", "Verify recovery"],
          },
          usage,
        };
      if (++calls > 1) throw new Error("provider unavailable");
      return { value: judgeSample(), usage };
    },
  };
  await assert.rejects(evaluate(ai, context), /judge|panel|assessment/i);
});

test("missing source support is repaired instead of reducing the candidate's grade", async () => {
  let repairs = 0;
  const ai = {
    provider: "test",
    model: "repair",
    generate: async (schema, task) => {
      if (schema.shape.points)
        return { value: { points: ["Contain harm"] }, usage };
      const repair = task.includes("EVIDENCE REPAIR");
      if (repair) repairs++;
      return {
        value: {
          ...judgeSample(),
          evidence: repair ? judgeSample().evidence : [],
        },
        usage,
      };
    },
  };
  const result = await evaluate(ai, context);
  assert.equal(result.value.scores.judgment, 100);
  assert.equal(repairs, 3);
  assert.equal(result.usage.input, 7);
});

test("unrepairable judge evidence is an assessment error, never a low candidate score", async () => {
  const ai = {
    provider: "test",
    model: "invalid",
    generate: async (schema) => ({
      value: schema.shape.points
        ? { points: ["Contain harm"] }
        : { ...judgeSample(), evidence: [] },
      usage,
    }),
  };
  await assert.rejects(evaluate(ai, context), /judge panel|assessment/i);
});

test("an off-topic flag from the interviewer does not zero an answer, but the judges' off-topic verdict does", async () => {
  const panel = (relevant) => ({
    generate: async (schema) => ({
      value: schema.shape.points
        ? { points: ["Contain harm"] }
        : { ...judgeSample(3), relevant },
      usage,
    }),
  });
  const kept = await evaluate(panel(true), { ...context, offTopic: true });
  assert.equal(kept.value.scores.judgment, 75);
  const dropped = await evaluate(panel(false), { ...context, offTopic: true });
  assert.equal(dropped.value.scores.judgment, 0);
  assert.match(dropped.value.gate, /did not address/);
});

test("a repair cannot hide missing evidence by quietly lowering the candidate's level", async () => {
  const ai = {
    generate: async (schema, task) => ({
      value: schema.shape.points
        ? { points: ["Contain harm"] }
        : {
            ...judgeSample(task.includes("EVIDENCE REPAIR") ? 1 : 4),
            evidence: [],
          },
      usage,
    }),
  };
  await assert.rejects(evaluate(ai, context), /judge panel|assessment/i);
});

test("assessment model routing keeps the interview and classification on the fast model", async () => {
  const original = globalThis.fetch;
  const bodies = [];
  try {
    globalThis.fetch = async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return Response.json({
        choices: [{ message: { content: '{"ok":true}' } }],
      });
    };
    const ai = createAI({
      AI_PROVIDER: "nvidia",
      AI_RPM: "0",
      NVIDIA_API_KEY: "test-only",
      NVIDIA_MODEL: "fast-interviewer",
      NVIDIA_ASSESSMENT_MODEL: "assessment-model",
    });
    const schema = z.object({ ok: z.boolean() });
    for (const purpose of ["interview", "classification", "assessment"])
      await ai.generate(schema, "Task", {}, { purpose });
    assert.deepEqual(
      bodies.map((body) => body.model),
      ["fast-interviewer", "fast-interviewer", "assessment-model"],
    );
    assert.equal(bodies[1].temperature, 0);
    assert.equal(bodies[2].temperature, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("quotes preserve Hindi marks and cannot match a different word's substring", async () => {
  const { quoteIn } = await import("../server/evidence.js");
  assert.equal(quoteIn("मैं गलत राशि वापस करूँगा।", "गलत राशि वापस"), true);
  assert.equal(quoteIn("The network is available", "work"), false);
  assert.equal(quoteIn("The answer", "........"), false);
});

test("source excerpts preserve every non-whitespace character, Hindi and emoji without invented text", async () => {
  const { evidenceSpans } = await import("../server/evidence.js");
  const text =
    "मैं गलत राशि वापस करूँगा। " +
    "A safe approach 🙂 with traceable evidence. ".repeat(18) +
    "x".repeat(500);
  const spans = evidenceSpans(text);
  for (const span of spans) {
    assert.equal(span.text, text.slice(span.start, span.end));
    assert.ok(span.text.length <= 220);
    assert.doesNotMatch(span.text, /[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/u);
  }
  for (let i = 0; i < text.length; i++)
    if (!/\s/u.test(text[i]))
      assert.ok(spans.some((span) => span.start <= i && i < span.end));
});

test("judge source IDs become exact server-owned transcript quotes and offsets", async () => {
  const ai = {
    generate: async (schema) => ({
      value: schema.shape.points ? { points: ["Contain harm"] } : judgeSample(),
      usage,
    }),
  };
  const result = await evaluate(ai, context);
  const quote = result.value.evidence[0];
  assert.equal(quote.quote, context.answer.slice(quote.start, quote.end));
  assert.equal(result.value.assessment.evidenceStrategy, "source_spans");
});

test("a judge cannot attach a quote from a fabricated transcript span", async () => {
  const ai = {
    generate: async (schema) => ({
      value: schema.shape.points
        ? { points: ["Contain harm"] }
        : {
            ...judgeSample(),
            evidence: [
              {
                competency: "judgment",
                spanId: "fabricated",
                supports: "strength",
              },
            ],
          },
      usage,
    }),
  };
  await assert.rejects(evaluate(ai, context), /judge panel|assessment/i);
});

const session = () => ({
  setup: { questionCount: 3, difficulty: "Intermediate" },
  turns: [],
  exchanges: [],
  currentQuestion: {
    question:
      "How would you prevent two concurrent payment requests from charging the customer twice?",
  },
});
const next = {
  lead: "You nailed that answer. Consider using a database lock next time.",
  question: "Suppose a service becomes unavailable. What would you do?",
  focus: "Reliability",
  difficulty: "Intermediate",
};
test("one shared keyword does not override semantic off-topic detection", async () => {
  const ai = {
    generate: async () => ({
      value: {
        relevant: false,
        evidence: "",
        kind: "answer",
        reply: "That sounds like a nice break from work.",
        nextQuestion: next,
      },
      usage,
    }),
  };
  const result = await decideTurn(
    ai,
    session(),
    "The payment at our hiking cafe was cheap and we spent the weekend cooking outdoors with friends.",
  );
  assert.equal(result.answered, false);
  assert.equal(result.redirect, true);
  assert.doesNotMatch(result.reply, /nice break|nailed|consider/i);
});

test("a classifier's fabricated relevance quote is a retryable system failure, not an off-topic candidate answer", async () => {
  const ai = {
    generate: async () => ({
      value: { relevant: true, evidence: "a quotation that was never said" },
      usage,
    }),
  };
  await assert.rejects(
    decideTurn(
      ai,
      session(),
      "I would store a payment token and return the previous result for a repeated token.",
    ),
    /relevance|verify/i,
  );
});

test("clarification cannot transmit a provider's praise or solution hints", async () => {
  const ai = {
    generate: async () => ({
      value: {
        kind: "conversation",
        reply:
          "Excellent reasoning. Use an idempotency key and a unique constraint.",
        nextQuestion: null,
      },
      usage,
    }),
  };
  const result = await decideTurn(ai, session(), "Can you give me an example?");
  assert.equal(result.answered, false);
  assert.doesNotMatch(result.reply, /excellent|idempotency|constraint/i);
});

test("spoken transitions do not expose generated praise or hints", async () => {
  const ai = {
    generate: async (schema, _task, ctx) => ({
      value:
        schema.shape.evidence && !schema.shape.levels
          ? { relevant: true, evidence: ctx.evidenceSpans[0].id }
          : { kind: "answer", relevant: true, reply: "", nextQuestion: next },
      usage,
    }),
  };
  const result = await decideTurn(
    ai,
    session(),
    "I would keep a unique payment token and save the result atomically before allowing a retry.",
  );
  assert.equal(result.answered, true);
  assert.doesNotMatch(result.nextQuestion.lead, /nailed|consider|lock/i);
});
