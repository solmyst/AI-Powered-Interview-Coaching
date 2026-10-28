import { z } from "zod";
import { ServiceError } from "./ai.js";

const text = z.string().trim().min(1).max(1200);
const observation = z.object({
  status: z.enum(["demonstrated", "partial", "not_yet"]),
  evidence: z.string().max(800).nullable(),
  reason: text,
});
export const rehearsalPlanSchema = z.object({
  focus: text,
  coaching: z.string().trim().min(1).max(600),
  checkpoints: z.array(z.object({ criterion: text, baseline: observation })).length(3),
  transferQuestion: text,
});
export const rehearsalResultSchema = z.object({
  summary: text,
  checks: z.array(observation).length(3),
  nextStep: text,
});
export const rehearsalAnswerSchema = z.object({
  answer: z.string().trim().min(2).max(8000),
  expectedAttempt: z.number().int().min(0).max(1),
}).strict();

// Quotes are verified server-side; a fluent but invented citation must not be saved.
export function verifyEvidence(observations, answer) {
  for (const observation of observations) {
    const quote = observation.evidence;
    if ((quote !== null && (!quote.trim() || !answer.includes(quote))) ||
        (observation.status !== "not_yet" && quote === null))
      throw new ServiceError(502, "The coach could not verify its answer evidence. Please retry; your saved interview is unchanged.");
  }
}

export function registerRehearsal(app, { auth, locked, owned, save, recordUsage, ai }) {
  app.post("/api/interviews/:id/rehearsal/:turn", auth, async (req, res) =>
    locked(req.user.id, async () => {
      const session = owned(req);
      const index = z.coerce.number().int().min(0).max(7).parse(req.params.turn);
      if (session.state !== "complete") throw new ServiceError(409, "Finish your interview before starting the Answer Lab.");
      const turn = session.turns[index];
      if (!turn) throw new ServiceError(404, "Answer not found.");
      session.rehearsals ||= {};
      if (session.rehearsals[index]) return res.json(session);
      const generated = await ai.generate(rehearsalPlanSchema,
        "Build a focused Answer Lab for this specific answer. Pick ONE important weakness, give a short actionable coaching cue without supplying a script, and define exactly THREE observable checkpoints that apply to both a retry and a new scenario. Evaluate the original answer against each checkpoint. evidence must be an EXACT contiguous quote from the original answer, or null when evidence is absent. demonstrated/partial REQUIRE a quote. not_yet means not observed, not proof of inability. Create one NEW transferQuestion testing the same skill with a changed constraint; do not repeat the original question. Do not infer confidence or personality. Use the language of the candidate's answer, keeping technical terms natural.",
        { role: session.setup.role, track: session.setup.track, difficulty: session.setup.difficulty, ...turn });
      const plan = rehearsalPlanSchema.parse(generated.value);
      verifyEvidence(plan.checkpoints.map((c) => c.baseline), turn.answer);
      session.rehearsals[index] = { plan, attempts: [], created: new Date().toISOString() };
      save(session.id, session);
      recordUsage(req.user.id, generated.usage);
      res.json(session);
    }));

  app.post("/api/interviews/:id/rehearsal/:turn/answers", auth, async (req, res) =>
    locked(req.user.id, async () => {
      const session = owned(req);
      const index = z.coerce.number().int().min(0).max(7).parse(req.params.turn);
      const input = rehearsalAnswerSchema.parse(req.body);
      const lab = session.rehearsals?.[index];
      if (!lab || session.state !== "complete") throw new ServiceError(404, "Start this Answer Lab first.");
      if (lab.attempts.length !== input.expectedAttempt)
        throw new ServiceError(409, "This attempt is already saved. Reopen your report to continue.");
      const stage = lab.attempts.length === 0 ? "retry" : "transfer";
      const question = stage === "retry" ? session.turns[index].question.question : lab.plan.transferQuestion;
      const generated = await ai.generate(rehearsalResultSchema,
        "Evaluate this spoken practice answer against the provided THREE checkpoints, in EXACTLY the same order. Return checks with an EXACT contiguous quote from the submitted answer for every demonstrated/partial observation. Use null if no evidence. Evaluate substance, not verbosity or accent. Do not assume improvement. Do not award points for repeating coaching language without explaining it. Summarize what THIS answer demonstrates; earlier observations are compared separately in the UI. Transfer tests application in a new scenario, not a comparable numeric score. Give one practical nextStep. Use the language of the answer. Never invent experience or claim code execution.",
        { role: session.setup.role, stage, question, checkpoints: lab.plan.checkpoints.map((c) => c.criterion), answer: input.answer });
      const result = rehearsalResultSchema.parse(generated.value);
      verifyEvidence(result.checks, input.answer);
      lab.attempts.push({ stage, question, answer: input.answer, result, created: new Date().toISOString() });
      save(session.id, session);
      recordUsage(req.user.id, generated.usage);
      res.json(session);
    }));
}
