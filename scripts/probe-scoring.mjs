// Real-model scoring probe: node --env-file=.env scripts/probe-scoring.mjs [module]
// Runs fixed answers of known quality through the scoring used by the app and prints scores, so changes to
// the method can be judged against what a careful human would give.
import { createAI } from "../server/ai.js";
import { screeningEvaluationSchema } from "../server/schemas.js";
import options from "../shared/interview-options.json" with { type: "json" };
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
// expected = what a careful human interviewer would give overall (0-100)
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
    "15-30",
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
const task =
  "Score the candidate's answer against each rubric competency (0-100), quote evidence verbatim from the answer for strengths and concerns, and add a short rationale. If the answer is empty or evasive, score low and say so; do not invent evidence.";
const mod = process.argv[2] ? await import(process.argv[2]) : null;
const weights = rubric.reduce((n, r) => n + r.weight, 0);
for (const [name, answer, expected] of cases) {
  if (
    process.env.PROBE_ONLY &&
    !process.env.PROBE_ONLY.split(",").some((k) => name.includes(k))
  )
    continue;
  const run = async () => {
    if (mod)
      return (
        await mod.evaluate(ai, {
          rubric,
          question: { question, focus: "Judgment" },
          answer,
          exchanges: [],
          company: "Park+",
          role: "Product AI Intern",
        })
      ).value;
    const g = await ai.generate(
      screeningEvaluationSchema(rubric),
      task,
      {
        company: "Park+",
        role: "Product AI Intern",
        rubric,
        question: { question, focus: "Judgment" },
        conversationBeforeAnswer: [],
        answer,
      },
      { mode: "screening" },
    );
    return g.value;
  };
  const values = [];
  for (let i = 0; i < Number(process.env.PROBE_RUNS || 2); i++) {
    const v = await run();
    const overall = Math.round(
      rubric.reduce((n, r) => n + (v.scores[r.key] ?? 0) * r.weight, 0) /
        weights,
    );
    values.push({
      overall,
      scores: rubric.map((r) => v.scores[r.key]).join("/"),
    });
  }
  console.log(
    `${name.padEnd(22)} expected ${expected.padEnd(6)} got ${values.map((v) => `${v.overall} (${v.scores})`).join("  |  ")}`,
  );
}
