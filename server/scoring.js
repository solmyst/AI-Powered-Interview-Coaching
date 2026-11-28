import { screeningJudgeSchema, referenceSchema } from "./schemas.js";
import { createHash } from "node:crypto";
import { ServiceError } from "./ai.js";
import { normalize, quoteIn, evidenceSpans } from "./evidence.js";
export { normalize } from "./evidence.js";

// Scoring of one screening answer. The design follows structured-interview practice and LLM-judge research:
// anchored ordinal levels instead of free 0-100 numbers, evidence required for any real credit, a reference
// outline of what a good answer contains, repeated rubric-rotated judgements combined by their median, and
// server-side rules the model cannot talk its way around. Delivery (eye contact, pace, fillers) is never an input.

// Level 0-4 to a score. Level 1 is "touches the topic, nothing more", so it earns little.
export const LEVEL_SCORE = [0, 20, 45, 75, 100];
export const SCORING_VERSION = "anchored-evidence-v2";
// An odd full panel is required; incomplete panels remain retryable rather than silently changing the method.
export const SAMPLES = Number(process.env.SCORING_SAMPLES || 3);
if (![3, 5].includes(SAMPLES))
  throw new Error("SCORING_SAMPLES must be 3 or 5.");
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const STOP = new Set(
  "that with this have what your them they then were from about would could should there their which when will into more also just like very some been only over make sure need want know think because okay yeah well basically actually really maybe probably something anything thing things than these those been being does done after before first next you hmm matlab uh um".split(
    " ",
  ),
);
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
  const mine = [...content(answer)];
  const novel = mine.filter((w) => !asked.has(w));
  if (
    /^(?:i (?:don'?t|do not) know|no idea|no clue|i can'?t answer|i cannot answer|pass|skip|next question)[.!\s]*$/i.test(
      answer.trim(),
    )
  )
    return "They said they did not know or could not answer.";
  // Mostly the question's own words with little added: a restatement, not an answer.
  const restates =
    mine.length > 0 &&
    (mine.length - novel.length) / mine.length >= 0.5 &&
    novel.length < 10;
  const action =
    /\b(use|refund|apologi[sz]e|check|first|because|if|would|should|implement|prevent|measure|compare|test)\b/i.test(
      answer,
    );
  if (
    !mine.length ||
    normalize(answer) === normalize(question) ||
    (restates && /^so\b/i.test(answer.trim()) && !action)
  )
    return "The answer added nothing meaningful beyond the question (it restated it, was too short, or was only filler).";
  return null;
}

const SCALE = `Use ONLY these criterion-specific anchors, independently for every criterion:
0 = no credit: no attempt, unrelated, only restates the question, "I don't know", or filler.
1 = touches the topic but is generic: no specifics, no reasoning, could be said about any question.
2 = relevant and partly specific, with some reasoning, but with clear gaps or missing important points.
3 = proficient: specific and substantially correct, covers most of the criterion, but leaves an important criterion-relevant explanation or action implicit.
4 = fully meets the criterion for this question and role: concrete, correct and sufficiently reasoned, with no material gap for that criterion. Where the criterion calls for judgment, look for a justified priority, trade-off, verification step, or relevant failure case. A clear concise answer can earn 4. Do not require exceptional accomplishments, every possible edge case, invented metrics, senior-level depth from an intern, or extra topics the question did not request.
Award 4 when supported; it is not reserved for a rare percentile of candidates. Do not award it for verbosity or merely mentioning many actions. Clear organisation can fully meet communication without adding a technical trade-off. Reasoning needs an actual explanation, not just a list. The server maps these anchors to percentages; do not invent numeric bands.`;

const judgeTask = (points) =>
  `You are an evidence-based criterion assessor, not a stack ranker. Score ONLY the content of candidateAnswer against each rubric criterion.
${SCALE}
Rules:
- Judge what the candidate actually said. Never reward length, confidence, fluency, accent, language or delivery.
- Do not give credit for restating the question, saying they do not know, filler, or an off-topic reply: those are 0 on every criterion, relevant false.
- Any level of 2 or more needs a strength evidence entry tagged with that criterion's key and an existing spanId from evidenceSpans that demonstrates it. Select source IDs; do not copy, paraphrase or invent quotes. The server attaches the original transcript text. If no source span supports the criterion, score at most 1.
- A criterion about communication is about how clearly the substance given is organised. With little or no substance it is 0 or 1, however fluent.
- Be consistent: the same answer must get the same levels. Judge against the scale, not against how other candidates might answer.
- Grade each criterion independently. A missing operational detail cannot lower communication if the answer itself is clear and organised. A proportionate remedy can fully demonstrate empathy without an additional gift. A sound alternative implementation can fully demonstrate correctness without the reference's preferred tool.
- A level below 4 must be justified by a MATERIAL gap for THAT criterion in the question's requested scope. Do not invent additional duties, require escalating to a particular team, demand an extra compensation gesture, or require unasked-for metrics just to avoid the highest level.
- substantive is false when the answer has no real content of its own.
${points.length ? `A strong answer to this question would likely make these points (a guide, not a checklist; accept equally good alternatives):\n${points.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}
Give a short rationale that names what was good and what was missing.`;

const references = new WeakMap();
// What a good answer should contain, made once per question and role so every candidate is judged against the same
// outline. A failure here only means scoring without it.
async function referencePoints(ai, ctx) {
  let cache = references.get(ai);
  if (!cache) {
    cache = new Map();
    references.set(ai, cache);
  }
  const referenceContext = {
    role: ctx.role,
    experience: ctx.experience || "",
    track: ctx.track || "",
    difficulty: ctx.difficulty || "",
    question: ctx.question,
    rubric: ctx.rubric,
  };
  const key = fingerprint({
    version: SCORING_VERSION,
    model: ai.assessmentModel || ai.model,
    ...referenceContext,
  });
  if (cache.has(key))
    return { points: await cache.get(key), usage: { input: 0, output: 0 } };
  const pending = ai.generate(
    referenceSchema.extend({
      points: referenceSchema.shape.points.length(ctx.rubric.length),
    }),
    "Return exactly ONE assessment anchor per rubric criterion, in the same order, prefixed with that criterion's key. Each anchor describes the observable content that would FULLY meet that criterion for THIS question, role and experience level. Extract the required scope from the question and criterion. Do not write a model-solution checklist or invent additional actions. Accept equivalent valid remedies and implementations; escalation to a specific team, extra goodwill gifts, named tools, or numerical outcomes are not mandatory unless explicitly required. For communication, judge organisation and clarity of the given substance, not whether a separate technical criterion is complete. Short substantive phrases, not delivery style or invented achievements.",
    referenceContext,
    {
      mode: ctx.mode || "screening",
      priority: "background",
      purpose: "assessment",
    },
  );
  cache.set(
    key,
    pending.then((out) => out.value.points),
  );
  // Avoid an unhandled rejection while the original request owns the failure.
  cache.get(key).catch(() => {});
  if (cache.size > 256) cache.delete(cache.keys().next().value);
  try {
    const out = await pending;
    return { points: out.value.points, usage: out.usage };
  } catch {
    cache.delete(key);
    throw new ServiceError(
      503,
      "The assessment reference could not be prepared. Retry scoring; no score has been published.",
    );
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};
const isCommunication = (r) =>
  /communicat|clarity|articulat|structure/i.test(`${r.key} ${r.label}`);

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
  if (!samples.length)
    throw new ServiceError(503, "The judge panel returned no assessments.");
  const verified = new Map();
  const unsupported = new Set();
  let dropped = 0;
  // Validate each judge BEFORE aggregation: another judge's quote cannot rescue an unsupported rating.
  const checked = samples.map((sample) => {
    const evidence = sample.evidence.filter((e) => {
      const valid =
        quoteIn(answer, e.quote) && rubric.some((r) => r.key === e.competency);
      if (!valid) dropped++;
      return valid;
    });
    const levels = Object.fromEntries(
      rubric.map((r) => {
        let level =
          sample.relevant && sample.substantive
            ? (sample.levels[r.key] ?? 0)
            : 0;
        if (
          level >= 2 &&
          !evidence.some(
            (e) => e.competency === r.key && e.supports === "strength",
          )
        ) {
          level = 1;
          unsupported.add(r.key);
        }
        return [r.key, level];
      }),
    );
    if (sample.relevant && sample.substantive)
      for (const e of evidence)
        verified.set(`${e.competency}|${e.supports}|${normalize(e.quote)}`, e);
    return { ...sample, levels };
  });
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
      {
        evidenceDropped: dropped,
        confidence: {
          samples: samples.length,
          spread: 0,
          unsupported: [...unsupported],
          reviewRequired: samples.some(
            (s) => s.relevant !== relevant || s.substantive !== substantive,
          ),
        },
      },
    );
  const levels = {};
  let spread = 0;
  for (const r of rubric) {
    const values = checked.map((s) => s.levels[r.key]);
    spread = Math.max(spread, Math.max(...values) - Math.min(...values));
    levels[r.key] = median(values);
  }
  const others = rubric
    .filter((r) => !isCommunication(r))
    .map((r) => levels[r.key]);
  const ceiling = others.length ? Math.max(...others) + 1 : 4;
  for (const r of rubric)
    if (isCommunication(r)) levels[r.key] = Math.min(levels[r.key], ceiling);
  const distance = (sample) =>
    rubric.reduce(
      (n, r) => n + Math.abs(sample.levels[r.key] - levels[r.key]),
      0,
    );
  const nearest = [...checked].sort((a, b) => distance(a) - distance(b))[0];
  const weights = rubric.reduce((n, r) => n + r.weight, 0);
  const judgeScores = checked.map((s) =>
    Math.round(
      rubric.reduce((n, r) => n + LEVEL_SCORE[s.levels[r.key]] * r.weight, 0) /
        weights,
    ),
  );
  return {
    scores: Object.fromEntries(
      rubric.map((r) => [r.key, LEVEL_SCORE[levels[r.key]]]),
    ),
    levels,
    relevant: true,
    substantive: true,
    gate: null,
    evidence: [...verified.values()],
    evidenceDropped: dropped,
    rationale: [...unsupported].some((key) => levels[key] < 2)
      ? `Verified quotes did not support higher credit for: ${[...unsupported].join(", ")}. Review the transcript before relying on these estimates.`
      : nearest.rationale,
    followUpForHuman: nearest.followUpForHuman,
    confidence: {
      samples: samples.length,
      spread,
      unsupported: [...unsupported],
      reviewRequired:
        spread > 0 ||
        unsupported.size > 0 ||
        samples.some((s) => !s.relevant || !s.substantive),
      scoreRange: {
        min: Math.min(...judgeScores),
        max: Math.max(...judgeScores),
      },
    },
  };
}

// Returns an evaluation plus the token usage it cost.
export async function evaluate(ai, ctx) {
  const { rubric, answer } = ctx;
  const manifest = {
    version: SCORING_VERSION,
    provider: ai.provider || "unknown",
    model: ai.assessmentModel || ai.model || "unknown",
    rubricFingerprint: fingerprint(rubric),
    inputFingerprint: fingerprint({
      role: ctx.role,
      question: ctx.question,
      answer,
      rubric,
    }),
    sampling: { temperature: 0, topP: 1 },
    requestedSamples: SAMPLES,
  };
  const why =
    ctx.offTopic === true
      ? "The answer did not address the question after a clarification opportunity."
      : substanceGate(answer, ctx.question.question);
  if (why)
    return {
      value: {
        ...failed(rubric, why, { gate: why }),
        assessment: { ...manifest, source: "deterministic_gate" },
      },
      usage: { input: 0, output: 0 },
    };
  const ref = await referencePoints(ai, ctx);
  const spans = evidenceSpans(answer);
  const sources = new Map(spans.map((span) => [span.id, span]));
  const materialize = (value) => ({
    ...value,
    evidence: value.evidence.map((entry) => {
      const source = sources.get(entry.spanId);
      if (!source)
        throw new ServiceError(
          503,
          "The judge cited an unknown transcript source. Retry assessment; no score was published.",
        );
      return {
        competency: entry.competency,
        supports: entry.supports,
        quote: source.text,
        spanId: source.id,
        start: source.start,
        end: source.end,
      };
    }),
  });
  const task = judgeTask(ref.points);
  const context = {
    role: ctx.role,
    experience: ctx.experience || "",
    track: ctx.track || "",
    difficulty: ctx.difficulty || "",
    rubric: ctx.rubric,
    question: ctx.question,
    conversationBeforeAnswer: ctx.exchanges || [],
    candidateAnswer: answer,
    evidenceSpans: spans,
  };
  // Independent judgements in parallel (no added wait); the median removes one-off swings.
  const results = await Promise.allSettled(
    Array.from({ length: SAMPLES }, async (_, index) => {
      const offset = index % rubric.length;
      const ordered = [...rubric.slice(offset), ...rubric.slice(0, offset)];
      const schema = screeningJudgeSchema(
        ordered,
        spans.map((span) => span.id),
      );
      const judgeContext = { ...context, rubric: ordered };
      const options = {
        mode: ctx.mode || "screening",
        priority: "background",
        purpose: "assessment",
      };
      let result = await ai.generate(schema, task, judgeContext, options);
      const rawAssessment = result.value;
      result = { ...result, value: materialize(result.value) };
      const missingSupport = (value) =>
        value.relevant && value.substantive
          ? rubric
              .filter(
                (r) =>
                  value.levels[r.key] >= 2 &&
                  !value.evidence.some(
                    (e) =>
                      e.competency === r.key &&
                      e.supports === "strength" &&
                      quoteIn(answer, e.quote),
                  ),
              )
              .map((r) => r.key)
          : [];
      const missing = missingSupport(result.value);
      if (missing.length) {
        const repaired = await ai.generate(
          schema,
          `${task} EVIDENCE REPAIR ONLY: the previous assessment did not select a supporting source span for ${missing.join(", ")}. Preserve all levels, relevant and substantive flags. Cite existing evidenceSpans IDs that support those criteria; do not invent IDs or lower a candidate's level to evade validation. This is an evaluator validation failure, not a candidate mistake.`,
          { ...judgeContext, invalidAssessment: rawAssessment },
          options,
        );
        if (
          rubric.some(
            (r) => repaired.value.levels[r.key] !== result.value.levels[r.key],
          ) ||
          repaired.value.relevant !== result.value.relevant ||
          repaired.value.substantive !== result.value.substantive
        )
          throw new ServiceError(
            503,
            "Evidence repair changed the judgement. Retry assessment or request human review; no score was published.",
          );
        result = {
          value: materialize(repaired.value),
          usage: {
            input: result.usage.input + repaired.usage.input,
            output: result.usage.output + repaired.usage.output,
          },
        };
        if (missingSupport(result.value).length)
          throw new ServiceError(
            503,
            "The judge could not ground its assessment in the transcript. Retry or request human review; no score was published.",
          );
      }
      return result;
    }),
  );
  const ok = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  if (ok.length !== SAMPLES) {
    const error = new ServiceError(
      503,
      "The full judge panel could not complete. Retry assessment; no partial-panel score has been published.",
    );
    error.assessmentFailures = results
      .filter((r) => r.status === "rejected")
      .map((r) =>
        r.reason?.message?.includes("Evidence repair changed")
          ? "evidence_repair_changed_rating"
          : r.reason?.message?.includes("ground its assessment")
            ? "ungrounded_judgement"
            : "provider_or_schema_error",
      );
    throw error;
  }
  const usage = ok.reduce(
    (n, r) => ({
      input: n.input + r.usage.input,
      output: n.output + r.usage.output,
    }),
    ref.usage,
  );
  return {
    value: {
      ...combine(
        rubric,
        answer,
        ok.map((r) => r.value),
      ),
      assessment: {
        ...manifest,
        source: "judge_panel",
        referencePoints: ref.points,
        referenceFingerprint: fingerprint(ref.points),
        evidenceStrategy: "source_spans",
      },
    },
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
      t.evaluation.confidence?.reviewRequired === true ||
      (t.evaluation.confidence?.unsupported?.length ?? 0) > 0,
  ).length;
  const versions = [
    ...new Set(turns.map((t) => t.evaluation.assessment?.version || "legacy")),
  ];
  const mixedScoringVersions = versions.length > 1;
  const methods = new Set(
    turns.map((t) =>
      JSON.stringify([
        t.evaluation.assessment?.version || "legacy",
        t.evaluation.assessment?.provider || "legacy",
        t.evaluation.assessment?.model || "legacy",
        t.evaluation.assessment?.rubricFingerprint || "legacy",
      ]),
    ),
  );
  const mixedAssessmentMethods = methods.size > 1;
  return {
    competencyScores,
    overall,
    answeredAverage,
    band,
    coverage: { answered: turns.length, total: questionCount, noContent },
    confidence: shaky || mixedAssessmentMethods ? "low" : "high",
    reviewRequired: shaky > 0 || mixedAssessmentMethods,
    scoringVersion: mixedScoringVersions
      ? "mixed"
      : versions[0] || SCORING_VERSION,
    mixedScoringVersions,
  };
}
