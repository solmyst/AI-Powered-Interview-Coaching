import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyEvidence, rehearsalPlanSchema, rehearsalResultSchema } from "../server/rehearsal.js";

test("Answer Lab refuses fabricated, empty, or missing positive evidence", () => {
  const answer = "I used a TTL and invalidated on writes.";
  assert.doesNotThrow(() => verifyEvidence([{ status: "partial", evidence: "used a TTL" }], answer));
  assert.doesNotThrow(() => verifyEvidence([{ status: "not_yet", evidence: null }], answer));
  for (const evidence of ["I tested race conditions", "", null])
    assert.throws(() => verifyEvidence([{ status: "demonstrated", evidence }], answer), /verify/);
});

test("Answer Lab requires exactly three checkpoints and observations", () => {
  assert.equal(rehearsalPlanSchema.safeParse({ focus: "Cache", coaching: "Explain", checkpoints: [], transferQuestion: "What changes?" }).success, false);
  assert.equal(rehearsalResultSchema.safeParse({ summary: "Good", checks: [], nextStep: "Try" }).success, false);
});
