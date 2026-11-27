import { screeningJudgeSchema, referenceSchema } from "./schemas.js";

// Scoring of one screening answer. The design follows structured-interview practice and LLM-judge research:
// anchored ordinal levels instead of free 0-100 numbers, evidence required for any real credit, a reference
// outline of what a good answer contains, several independent judgements combined by their median, and
// server-side rules the model cannot talk its way around. Delivery (eye contact, pace, fillers) is never an input.

// Level 0-4 to a score. Level 1 is "touches the topic, nothing more", so it earns little.
export const LEVEL_SCORE = [0, 20, 45, 75, 95];
export const SAMPLES = 3;

export const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(
  "that with this have what your them they then were from about would could should there their which when will into more also just like very some been only over make sure need want know think because okay yeah well basically actually really maybe probably something anything thing things than these those been being does done after before first next".split(
    " ",
  ),
);
const GAVE_UP =
  /\b(don'?t know|do not know|no idea|no clue|can'?t answer|cannot answer|not sure|pass|skip|move on)\b/i;
const content = (text) =>
  new Set(
    (text.toLowerCase().match(/[\p{L}\p{M}\p{N}]{3,}/gu) || []).filter(
      (w) => !STOP.has(w),
    ),
  );

// Deterministic first gate: an answer that adds nothing beyond the question (or says "I don't know", or is only
// filler) is level 0 on everything, without asking a model whose scores for such answers vary widely.
// shortcut: counts distinct content words, so a long run of padding could pass; the model's own substantive
// flag is the second gate.
export function substanceGate(answer, question) {
  const asked = content(question);
  const novel = [...content(answer)].filter((w) => !asked.has(w));
  const words = answer.trim().split(/\s+/).length;
  if (words < 25 && GAVE_UP.test(answer))
    return "They said they did not know or could not answer.";
  if (novel.length < 8)
    return "The answer added nothing meaningful beyond the question (it restated it, was too short, or was only filler).";
  return null;
}

const SCALE = `Use this scale for every criterion:
0 = no credit: no attempt, unrelated, only restates the question, "I don't know", or filler.
1 = touches the topic but is generic: no specifics, no reasoning, could be said about any question.
2 = relevant and partly specific, with some reasoning, but with clear gaps or missing important points.
3 = specific and reasoned, covers most of what matters, with sound judgment.
4 = everything in 3, and also at least one of: a trade-off weighed, an edge case or risk anticipated, a concrete way to measure success, or a clear order of priorities. Give 4 when it is earned; do not hold it back out of caution.`;

const judgeTask = (points) =>
  `You are a strict, fair interview scorer. Score ONLY the content of candidateAnswer against each rubric criterion.
${SCALE}
Rules:
- Judge what the candidate actually said. Never reward length, confidence, fluency, accent, language or delivery.
- Do not give credit for restating the question, saying they do not know, filler, or an off-topic reply: those are 0 on every criterion, relevant false.
- Any level of 2 or more needs a verbatim quote from candidateAnswer in evidence, tagged with that criterion's key. If you cannot quote support, score at most 1.
- A criterion about communication is about how clearly the substance given is organised. With little or no substance it is 0 or 1, however fluent.
- Be consistent: the same answer must get the same levels. Judge against the scale, not against how other candidates might answer.
- substantive is false when the answer has no real content of its own.
${points.length ? `A strong answer to this question would likely make these points (a guide, not a checklist; accept equally good alternatives):\n${points.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}
Give a short rationale that names what was good and what was missing.`;

const references = new Map();
// What a good answer should contain, made once per question and role so every candidate is judged against the same
// outline. A failure here only means scoring without it.
async function referencePoints(ai, ctx) {
  const key = normalize(`${ctx.role}|${ctx.question.question}`);
  if (references.has(key))
    return { points: references.get(key), usage: { input: 0, output: 0 } };
  let points = [];
  let usage = { input: 0, output: 0 };
  try {
    const out = await ai.generate(
      referenceSchema,
      "List 3 to 5 specific points a strong answer to this interview question would make for this role. Short phrases about substance only, never about delivery or communication style.",
      {
        role: ctx.role,
        company: ctx.company,
        question: ctx.question,
        rubric: ctx.rubric,
      },
      { mode: "screening" },
    );
    points = out.value.points;
    usage = out.usage;
  } catch {
    /* score without a reference outline */
  }
  references.set(key, points);
  return { points, usage };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};
const isCommunication = (r) =>
  /communicat|clarity|articulat/i.test(`${r.key} ${r.label}`);

const zeros = (rubric) => Object.fromEntries(rubric.map((r) => [r.key, 0]));
function failed(rubric, why, extra = {}) {
  return {
    scores: zeros(rubric),
    levels: zeros(rubric),
    relevant: false,
    substantive: false,
    gate: why,
    evidence: [],
    evidenceDropped: 0,
    rationale: why,
    followUpForHuman:
      "Ask this question again in person; the interview gave no answer to judge.",
    confidence: { samples: 0, spread: 0, unsupported: [] },
    ...extra,
  };
}

// Pure combination step, separate from the model calls so the rules can be tested exactly.
export function combine(rubric, answer, samples) {
  const said = normalize(answer);
  const verified = new Map();
  let dropped = 0;
  for (const sample of samples)
    for (const e of sample.evidence) {
      if (said.includes(normalize(e.quote))) {
        const k = `${e.competency}|${normalize(e.quote)}`;
        if (!verified.has(k)) verified.set(k, e);
      } else dropped += 1;
    }
  const evidence = [...verified.values()];
  // Majority vote on the answer-level flags: one model's mood cannot zero or rescue an answer alone.
  const relevant =
    samples.filter((s) => s.relevant).length * 2 > samples.length;
  const substantive =
    samples.filter((s) => s.substantive).length * 2 > samples.length;
  if (!relevant || !substantive)
    return failed(
      rubric,
      relevant
        ? "The answer had no substance of its own."
        : "The answer did not address the question.",
      { evidence: [], evidenceDropped: dropped, samples: samples.length },
    );
  const levels = {};
  const unsupported = [];
  let spread = 0;
  for (const r of rubric) {
    const values = samples.map((s) => s.levels[r.key] ?? 0);
    spread = Math.max(spread, Math.max(...values) - Math.min(...values));
    let level = median(values);
    // Real credit needs a quote the candidate really said; otherwise the model is guessing.
    if (
      level >= 2 &&
      !evidence.some((e) => e.competency === r.key && e.supports === "strength")
    ) {
      level = 1;
      unsupported.push(r.key);
    }
    levels[r.key] = level;
  }
  // Fluency cannot outrun content: communication is capped just above the best content criterion.
  const others = rubric
    .filter((r) => !isCommunication(r))
    .map((r) => levels[r.key]);
  const ceiling = others.length ? Math.max(...others) + 1 : 4;
  for (const r of rubric)
    if (isCommunication(r)) levels[r.key] = Math.min(levels[r.key], ceiling);
  const total = (s) => rubric.reduce((n, r) => n + (s.levels[r.key] ?? 0), 0);
  const target = rubric.reduce((n, r) => n + levels[r.key], 0);
  // The rationale comes from the judgement closest to the combined levels.
  const nearest = [...samples].sort(
    (a, b) => Math.abs(total(a) - target) - Math.abs(total(b) - target),
  )[0];
  return {
    scores: Object.fromEntries(
      rubric.map((r) => [r.key, LEVEL_SCORE[levels[r.key]]]),
    ),
    levels,
    relevant: true,
    substantive: true,
    gate: null,
    evidence,
    evidenceDropped: dropped,
    rationale: nearest.rationale,
    followUpForHuman: nearest.followUpForHuman,
    confidence: { samples: samples.length, spread, unsupported },
  };
}

// Returns an evaluation plus the token usage it cost.
export async function evaluate(ai, ctx) {
  const { rubric, answer } = ctx;
  const why = substanceGate(answer, ctx.question.question);
  if (why)
    return {
      value: failed(rubric, why, { gate: why }),
      usage: { input: 0, output: 0 },
    };
  const ref = await referencePoints(ai, ctx);
  const task = judgeTask(ref.points);
  const context = {
    company: ctx.company,
    role: ctx.role,
    rubric: ctx.rubric,
    question: ctx.question,
    conversationBeforeAnswer: ctx.exchanges || [],
    candidateAnswer: answer,
  };
  // Independent judgements in parallel (no added wait); the median removes one-off swings.
  const results = await Promise.allSettled(
    Array.from({ length: SAMPLES }, () =>
      ai.generate(screeningJudgeSchema(rubric), task, context, {
        mode: "screening",
      }),
    ),
  );
  const ok = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  if (!ok.length) throw results[0].reason;
  const usage = ok.reduce(
    (n, r) => ({
      input: n.input + r.usage.input,
      output: n.output + r.usage.output,
    }),
    ref.usage,
  );
  return {
    value: combine(
      rubric,
      answer,
      ok.map((r) => r.value),
    ),
    usage,
  };
}

// Candidate-level result. Questions the candidate never answered count as 0, so ending early cannot lift a score
// (the average of answered questions is kept as a separate figure for context).
export function aggregate(rubric, turns, questionCount) {
  const weights = rubric.reduce((n, r) => n + r.weight, 0);
  const weighted = (get) =>
    Math.round(rubric.reduce((n, r) => n + get(r) * r.weight, 0) / weights);
  const slots = Math.max(questionCount, turns.length);
  const sum = (r) =>
    turns.reduce((n, t) => n + (t.evaluation.scores[r.key] ?? 0), 0);
  const competencyScores = Object.fromEntries(
    rubric.map((r) => [r.key, Math.round(sum(r) / slots)]),
  );
  const overall = weighted((r) => competencyScores[r.key]);
  const answeredAverage = turns.length
    ? weighted((r) => sum(r) / turns.length)
    : 0;
  const noContent = turns.filter(
    (t) => t.evaluation.gate || t.evaluation.substantive === false,
  ).length;
  const insufficient =
    turns.length < Math.ceil(questionCount / 2) ||
    noContent * 2 >= turns.length;
  const band = insufficient
    ? "insufficient"
    : overall >= 75
      ? "strong"
      : overall >= 60
        ? "promising"
        : overall >= 40
          ? "mixed"
          : "weak";
  const shaky = turns.filter(
    (t) =>
      (t.evaluation.confidence?.spread ?? 0) >= 2 ||
      (t.evaluation.confidence?.unsupported?.length ?? 0) > 0,
  ).length;
  return {
    competencyScores,
    overall,
    answeredAverage,
    band,
    coverage: { answered: turns.length, total: questionCount, noContent },
    confidence: shaky ? "low" : "high",
  };
}
