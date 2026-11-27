import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  combine,
  substanceGate,
  LEVEL_SCORE,
} from "../server/scoring.js";

const rubric = [
  { key: "product", label: "Product thinking", description: "d", weight: 3 },
  { key: "judgment", label: "AI judgment", description: "d", weight: 3 },
  { key: "communication", label: "Communication", description: "d", weight: 2 },
];
const question =
  "The assistant tells a driver parking costs 40 rupees but the gate charges 120. What do you do in the next hour?";
const answer =
  "First I would refund the difference and apologise, then check the logs to see why the assistant quoted a stale price, and pause fee answers until the fee comes from the live gate system.";
const sample = (levels, over = {}) => ({
  relevant: true,
  substantive: true,
  levels,
  evidence: Object.keys(levels).map((competency) => ({
    competency,
    quote: "refund the difference and apologise",
    supports: "strength",
  })),
  rationale: "r",
  ...over,
});

test("answers that add nothing to the question score zero before any model is asked", () => {
  for (const nothing of [
    "I don't know.",
    "Um, so, uh, basically, you know, it is like, hmm, matlab I think, okay so yeah.",
    "So the assistant told the driver parking costs forty and the gate charges one hundred twenty and I need to do something.",
    "ok",
  ])
    assert.ok(substanceGate(nothing, question), nothing);
  assert.equal(substanceGate(answer, question), null);
});

test("the median of independent judgements decides, and one outlier cannot move a score", () => {
  const r = combine(rubric, answer, [
    sample({ product: 3, judgment: 3, communication: 3 }),
    sample({ product: 3, judgment: 2, communication: 3 }),
    sample({ product: 1, judgment: 3, communication: 3 }),
  ]);
  assert.deepEqual(r.levels, { product: 3, judgment: 3, communication: 3 });
  assert.equal(r.scores.product, LEVEL_SCORE[3]);
  assert.equal(r.confidence.spread, 2);
});

test("credit of level 2 or more needs a quote the candidate really said", () => {
  const noQuote = (levels) =>
    sample(levels, {
      evidence: [
        {
          competency: "product",
          quote: "an invented sentence nobody said",
          supports: "strength",
        },
      ],
    });
  const r = combine(
    rubric,
    answer,
    [3, 3, 3].map(() => noQuote({ product: 3, judgment: 3, communication: 3 })),
  );
  assert.equal(r.levels.product, 1);
  assert.equal(r.levels.judgment, 1);
  assert.deepEqual(r.confidence.unsupported.sort(), [
    "communication",
    "judgment",
    "product",
  ]);
  assert.equal(r.evidenceDropped, 3);
});

test("fluency cannot outrun content, and an answer judged off-topic or empty is zero everywhere", () => {
  const talky = combine(
    rubric,
    answer,
    [3, 3, 3].map(() => sample({ product: 1, judgment: 0, communication: 4 })),
  );
  assert.equal(talky.levels.communication, 2); // best content level 1, plus one
  const off = combine(rubric, answer, [
    sample({ product: 3, judgment: 3, communication: 3 }, { relevant: false }),
    sample({ product: 3, judgment: 3, communication: 3 }, { relevant: false }),
    sample({ product: 3, judgment: 3, communication: 3 }),
  ]);
  assert.deepEqual(off.scores, { product: 0, judgment: 0, communication: 0 });
});

test("ending early cannot raise a score: unanswered questions count as zero", () => {
  const good = combine(
    rubric,
    answer,
    [3, 3, 3].map(() => sample({ product: 3, judgment: 3, communication: 3 })),
  );
  const turn = { evaluation: good };
  const all = aggregate(rubric, [turn, turn, turn, turn], 4);
  const early = aggregate(rubric, [turn], 4);
  assert.equal(all.overall, 75);
  assert.equal(early.overall, Math.round(75 / 4));
  assert.equal(early.answeredAverage, 75);
  assert.equal(all.band, "strong");
  assert.equal(early.band, "insufficient");
  assert.deepEqual(early.coverage, { answered: 1, total: 4, noContent: 0 });
  // A candidate who gave no substance at all is not scored as someone who merely left.
  const empty = {
    evaluation: {
      scores: { product: 0, judgment: 0, communication: 0 },
      gate: "x",
    },
  };
  const none = aggregate(rubric, [empty, empty, empty, empty], 4);
  assert.equal(none.overall, 0);
  assert.equal(none.band, "insufficient");
});
