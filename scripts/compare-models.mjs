// Compare hosted models on the two jobs the app gives them: judging an answer and running the conversation.
// node --env-file=.env scripts/compare-models.mjs "model/a,model/b" [viability|score|talk]
import { createAI } from "../server/ai.js";
import { screeningJudgeSchema } from "../server/schemas.js";
import { combine } from "../server/scoring.js";
import { decideTurn } from "../server/turn.js";

const rubric = [
  { key: "product_thinking", label: "Product thinking", description: "Frames the driver's problem, picks sensible data and a first step, and prioritises.", weight: 3 },
  { key: "ai_judgment", label: "AI judgment", description: "Knows what an AI assistant can and cannot do reliably, and how to limit and test it.", weight: 3 },
  { key: "user_empathy", label: "User empathy", description: "Keeps the driver's situation, money and trust in view.", weight: 2 },
  { key: "communication", label: "Communication", description: "Explains ideas clearly, in a structured way, and stays on the question.", weight: 2 },
];
const question = { question: "The assistant tells a driver parking costs ₹40, but the gate charges ₹120 and the driver is angry. What do you do in the next hour?", focus: "Judgment" };
// expected overall range from a careful human; order matters more than exact numbers
const cases = [
  ["off topic", "I went hiking last weekend with my friends and the weather was amazing, we cooked food outside and it was a lot of fun, then we drove back late.", [0, 5]],
  ["vague", "I would try to fix the problem quickly and make sure the customer is happy. I would talk to the team and see what went wrong and make it better for the future.", [10, 30]],
  ["wrong", "I would just tell the driver the assistant is always right and that the gate is wrong. Drivers should trust the app more. I would not change anything about the assistant.", [0, 20]],
  ["decent", "First I would apologise to the driver and refund the difference so they are not out of pocket. Then I would look at the logs to see where the assistant got forty rupees, probably an outdated price, and turn off fee answers until it is fixed. Afterwards I would make the assistant read the live fee from the gate system and tell users when it is not sure.", [45, 70]],
  ["strong", "In the first ten minutes I would make the driver whole: apologise, refund the difference and log the case, because trust is on the line and the amount is small. In the next fifty minutes I would find the cause: pull the conversation, check whether the fee came from a stale cache, a hallucinated number or a different lot, and see how many other drivers got the same answer. I would pause fee answers for that lot, and tell support what to say. Afterwards the fix is that the assistant never states a price it cannot read from the live fee source, and shows when it was last updated. I would measure wrong-fee complaints per thousand conversations as the success metric.", [70, 95]],
];
const task = `You are a strict, fair interview scorer. Score ONLY the content of candidateAnswer against each rubric criterion on this scale: 0 = no credit, unrelated, restates the question or filler; 1 = touches the topic but generic; 2 = relevant and partly specific with gaps; 3 = specific and reasoned, covers most of what matters; 4 = also weighs trade-offs, risks or concrete measures. Rules: judge only what was said, never fluency or length; any level of 2 or more needs a verbatim quote from candidateAnswer in evidence tagged with the criterion key; off-topic or no-substance answers are 0 and relevant false. Give a short rationale.`;
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
const LEVEL = [0, 20, 45, 75, 95];

async function score(ai, label) {
  const rows = [];
  const times = [];
  let failures = 0;
  for (const [name, answer, [lo, hi]] of cases) {
    const overalls = [];
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      try {
        const g = await ai.generate(screeningJudgeSchema(rubric), task, { role: "Product AI Intern", rubric, question, conversationBeforeAnswer: [], candidateAnswer: answer }, { mode: "screening", ...(process.env.TEMP0 ? { purpose: "assessment" } : {}) });
        times.push(Date.now() - t);
        const r = combine(rubric, answer, [g.value]);
        overalls.push(Math.round(rubric.reduce((n, c) => n + r.scores[c.key] * c.weight, 0) / 10));
      } catch (e) { failures++; times.push(Date.now() - t); }
    }
    rows.push({ name, overalls, lo, hi });
  }
  const inRange = rows.filter((r) => r.overalls.length && r.overalls.every((v) => v >= r.lo - 10 && v <= r.hi + 10)).length;
  const spread = Math.max(...rows.map((r) => (r.overalls.length ? Math.max(...r.overalls) - Math.min(...r.overalls) : 99)));
  const m = rows.map((r) => (r.overalls.length ? med(r.overalls) : null));
  const ordered = m.every((v) => v !== null) && m[0] <= m[1] + 10 && m[1] <= m[3] && m[2] <= m[3] && m[3] <= m[4] + 5;
  console.log(`${label.padEnd(46)} SCORE  ok-cases ${inRange}/5  worst-spread ${spread}  ordered ${ordered}  fail ${failures}/15  p50 ${(med(times) / 1000).toFixed(1)}s p90 ${(pct(times, 90) / 1000).toFixed(1)}s  | ${rows.map((r) => `${r.name}:${r.overalls.join("/") || "x"}`).join("  ")}`);
}

async function talk(ai, label) {
  const q = (question) => ({ question, focus: "Judgment", lead: "" });
  const base = () => ({
    setup: { role: "Product AI Intern", experience: "Student / graduate", track: "Product sense", difficulty: "Intermediate", industry: "Parking", company: "Park+", questionCount: 5 },
    turns: [{ question: q("A driver cannot find the mall entry and cancels. What data do you look at first?"), answer: "I would look at the funnel and where drivers drop off." }],
    currentQuestion: q("We want an AI assistant in the app. Name one question it should answer on day one and one it should refuse. Why those two?"),
    exchanges: [],
  });
  const tests = [
    ["answer", "It should answer parking location and price questions because they are factual and checkable. It should refuse refund decisions because a wrong answer costs real money, so it hands over to a person.", "answer"],
    ["idk", "I don't know, I have not worked on that.", "answer"],
    ["clarify", "What do you mean by refuse?", "conversation"],
    ["repeat", "Sorry, can you repeat the question?", "conversation"],
    ["example", "Can you give me an example?", "conversation"],
    ["offtopic", "I went hiking last weekend with my friends and the weather was amazing, we cooked food outside.", "redirect"],
  ];
  let right = 0, fails = 0, leaks = 0, praise = 0;
  const times = [];
  const notes = [];
  for (const [name, said, want] of tests) {
    const t = Date.now();
    try {
      const r = await decideTurn(ai, base(), said, {});
      times.push(Date.now() - t);
      const got = r.redirect ? "redirect" : r.answered ? "answer" : "conversation";
      if (got === want) right++;
      else notes.push(`${name}->${got}`);
      const text = r.reply || r.nextQuestion?.lead || "";
      if (/\b(good|great|excellent|solid|nice)\b/i.test(text) && want !== "conversation") praise++;
      if (name === "example" && /unique constraint|lock|idempot/i.test(text)) leaks++;
    } catch (e) { fails++; times.push(Date.now() - t); notes.push(`${name}!${String(e.message).slice(0, 30)}`); }
  }
  console.log(`${label.padEnd(46)} TALK   right ${right}/6  fail ${fails}  praise-in-lead ${praise}  p50 ${times.length ? (med(times) / 1000).toFixed(1) : "-"}s p90 ${times.length ? (pct(times, 90) / 1000).toFixed(1) : "-"}s  ${notes.join(" ")}`);
}

const models = (process.argv[2] || "").split(",").filter(Boolean);
const mode = process.argv[3] || "all";
for (const model of models) {
  const ai = createAI({ ...process.env, AI_PROVIDER: "nvidia", NVIDIA_MODEL: model, AI_TIMEOUT_MS: "45000" });
  try {
    if (mode === "viability") {
      const t = Date.now();
      const g = await ai.generate(screeningJudgeSchema(rubric), task, { role: "x", rubric, question, conversationBeforeAnswer: [], candidateAnswer: cases[4][1] }, { mode: "screening" });
      console.log(`${model.padEnd(46)} OK ${Date.now() - t} ms levels ${JSON.stringify(g.value.levels)}`);
    } else {
      if (mode === "all" || mode === "score") await score(ai, model);
      if (mode === "all" || mode === "talk") await talk(ai, model);
    }
  } catch (e) { console.log(`${model.padEnd(46)} FAIL ${String(e.message).slice(0, 80)}`); }
}
