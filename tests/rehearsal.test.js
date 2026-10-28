import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyEvidence, generateVerified, rehearsalPlanSchema, rehearsalResultSchema } from "../server/rehearsal.js";

test("Answer Lab refuses fabricated, empty, or missing positive evidence", () => {
  const answer = "I used a TTL and invalidated on writes.";
  assert.doesNotThrow(() => verifyEvidence([{ status: "partial", evidence: "used a TTL" }], answer));
  assert.doesNotThrow(() => verifyEvidence([{ status: "not_yet", evidence: null }], answer));
  for (const evidence of ["I tested race conditions", "", null])
    assert.throws(() => verifyEvidence([{ status: "demonstrated", evidence }], answer), /verify/);
});

test("Answer Lab repairs translated Hindi quotes once, accounts usage and fails closed if still invented", async () => {
  const answer = "PostgreSQL source of truth है।";
  let calls = 0;
  const ai = { generate: async (_schema, task) => {
    calls++;
    if (calls === 2) assert.match(task, /ORIGINAL SCRIPT/);
    return { value: { summary: "Review", checks: Array.from({ length: 3 }, () => ({ status: "partial", evidence: calls === 1 ? "PostgreSQL is the source of truth." : "source of truth है", reason: "Identifies authority." })), nextStep: "Explain failure." }, usage: { input: 10, output: 5 } };
  } };
  const generated = await generateVerified(ai, rehearsalResultSchema, "Evaluate", { answer }, answer, (v) => v.checks);
  assert.equal(calls, 2);
  assert.deepEqual(generated.usage, { input: 20, output: 10 });
  calls = 0;
  const bad = { generate: async () => { calls++; return { value: { summary: "Review", checks: Array.from({ length: 3 }, () => ({ status: "demonstrated", evidence: "invented", reason: "Bad" })), nextStep: "Try" }, usage: { input: 1, output: 1 } }; } };
  await assert.rejects(generateVerified(bad, rehearsalResultSchema, "Evaluate", { answer }, answer, (v) => v.checks), /verify/);
  assert.equal(calls, 2);
});

test("Answer Lab requires exactly three checkpoints and observations", () => {
  assert.equal(rehearsalPlanSchema.safeParse({ focus: "Cache", coaching: "Explain", checkpoints: [], transferQuestion: "What changes?" }).success, false);
  assert.equal(rehearsalResultSchema.safeParse({ summary: "Good", checks: [], nextStep: "Try" }).success, false);
});
