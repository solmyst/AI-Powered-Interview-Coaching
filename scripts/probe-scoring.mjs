// Real-model scoring probe: node --env-file=.env scripts/probe-scoring.mjs [module]
// Synthetic regression fixtures, NOT an expert-labelled calibration set. The suggested ranges are provisional.
// Repeats actual application scoring; no answer-score cache is used to hide model variation.
import { createAI } from "../server/ai.js";
import { writeFileSync } from "node:fs";
const ai = createAI();
const rubric = [
  {
    key: "product_thinking",
    label: "Product thinking",
    description:
      "Frames the driver's problem, picks sensible data and a first step, and prioritises.",
    weight: 3,
  },
  {
    key: "ai_judgment",
    label: "AI judgment",
    description:
      "Knows what an AI assistant can and cannot do reliably, and how to limit and test it.",
    weight: 3,
  },
  {
    key: "user_empathy",
    label: "User empathy",
    description: "Keeps the driver's situation, money and trust in view.",
    weight: 2,
  },
  {
    key: "communication",
    label: "Communication",
    description:
      "Explains ideas clearly, in a structured way, and stays on the question.",
    weight: 2,
  },
];
const question =
  "The assistant tells a driver parking costs ₹40, but the gate charges ₹120 and the driver is angry. What do you do in the next hour?";
// expected = an illustrative acceptance range; requires independent human review before use as gold data.
const cases = [
  ["empty / no attempt", "I don't know.", "0-5"],
  [
    "filler only",
    "Um, so, uh, basically, you know, it is like, hmm, matlab I think, okay so yeah.",
    "0-5",
  ],
  [
    "off topic",
    "I went hiking last weekend with my friends and the weather was amazing, we cooked food outside and it was a lot of fun.",
    "0-5",
  ],
  [
    "restates the question",
    "So the assistant told the driver parking costs forty rupees but the gate charged one hundred twenty and the driver is angry and I need to do something in the next hour.",
    "5-15",
  ],
  [
    "vague generic",
    "I would try to fix the problem quickly and make sure the customer is happy. I would talk to the team and see what went wrong and make it better for the future.",
    "0-5",
  ],
  [
    "wrong and confident",
    "I would just tell the driver the assistant is always right and that the gate is wrong. Drivers should trust the app more. I would not change anything.",
    "5-20",
  ],
  [
    "decent",
    "First I would apologise to the driver and refund the difference so they are not out of pocket. Then I would look at the logs to see where the assistant got forty rupees, probably an outdated price, and turn off fee answers until it is fixed. Afterwards I would make the assistant read the live fee from the gate system and tell users when it is not sure.",
    "60-75",
  ],
  [
    "strong",
    "In the first ten minutes I would make the driver whole: apologise, refund the difference and log the case, because trust is on the line and the amount is small. In the next fifty minutes I would find the cause: pull the conversation, check whether the fee came from a stale cache, a hallucinated number or a different lot, and see how many other drivers got the same answer. I would pause fee answers for that lot, and tell support what to say. Afterwards the fix is that the assistant never states a price it cannot read from the live fee source, and shows when it was last updated. I would measure wrong-fee complaints per thousand conversations as the success metric.",
    "80-95",
  ],
];
const mod = await import(process.argv[2] || "../server/scoring.js");
const runs = Number(process.env.PROBE_RUNS || 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 10)
  throw new Error("PROBE_RUNS must be an integer from 1 to 10");
const maxSpread = Number(process.env.PROBE_MAX_SPREAD || 8);
const weights = rubric.reduce((n, r) => n + r.weight, 0);
const report = {
  generatedAt: new Date().toISOString(),
  provider: ai.provider,
  model: ai.assessmentModel || ai.model,
  scoringVersion: mod.SCORING_VERSION,
  fixtureVersion: "illustrative-product-v1",
  humanReviewed: false,
  releaseReady: false,
  runs,
  maxSpread,
  cases: [],
};
console.log(
  "Synthetic fixtures: expected ranges are illustrative, not expert calibration. Errors are assessment failures, not candidate zeros.",
);
for (const [name, answer, expected] of cases) {
  if (
    process.env.PROBE_ONLY &&
    !process.env.PROBE_ONLY.split(",").some((k) => name.includes(k))
  )
    continue;
  const values = [];
  for (let i = 0; i < runs; i++) {
    const started = Date.now();
    try {
      const { value, usage } = await mod.evaluate(ai, {
        rubric,
        question: { question, focus: "Judgment" },
        answer,
        exchanges: [],
        company: "Park+",
        role: "Product AI Intern",
        experience: "Student / graduate",
        track: "Product sense",
        difficulty: "Intermediate",
      });
      if (process.env.PROBE_DETAILS === "1")
        console.log(JSON.stringify({ name, evaluation: value }, null, 2));
      values.push({
        overall: Math.round(
          rubric.reduce((n, r) => n + value.scores[r.key] * r.weight, 0) /
            weights,
        ),
        scores: value.scores,
        durationMs: Date.now() - started,
        usage,
        reviewRequired: Boolean(value.confidence?.reviewRequired),
        panelRange: value.confidence?.scoreRange,
        referenceFingerprint: value.assessment?.referenceFingerprint,
      });
    } catch (error) {
      values.push({
        error: error.message,
        failures: error.assessmentFailures,
        durationMs: Date.now() - started,
      });
    }
  }
  const scores = values.filter((v) => !v.error).map((v) => v.overall);
  const spread = scores.length
    ? Math.max(...scores) - Math.min(...scores)
    : null;
  const range = expected.split("-").map(Number);
  const complete = scores.length === runs;
  const inIllustrativeRange =
    complete && scores.every((score) => score >= range[0] && score <= range[1]);
  const stable = complete && spread <= maxSpread;
  report.cases.push({
    name,
    expected,
    values,
    spread,
    complete,
    stable,
    inIllustrativeRange,
  });
  console.log(
    `${name.padEnd(22)} expected ${expected.padEnd(6)} got ${values.map((v) => (v.error ? "ASSESSMENT ERROR" : `${v.overall} (${Object.values(v.scores).join("/")})`)).join("  |  ")} spread=${spread ?? "n/a"}`,
  );
}
report.passesIllustrativeChecks =
  report.cases.length > 0 &&
  report.cases.every((c) => c.complete && c.stable && c.inIllustrativeRange);
if (process.env.PROBE_OUTPUT)
  writeFileSync(process.env.PROBE_OUTPUT, JSON.stringify(report, null, 2));
if (process.env.PROBE_ENFORCE === "1" && !report.passesIllustrativeChecks)
  process.exitCode = 1;
