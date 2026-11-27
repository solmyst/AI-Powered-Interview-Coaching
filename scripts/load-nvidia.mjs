// Capacity probe for the hosted model: node --env-file=.env scripts/load-nvidia.mjs
// Sends interview-shaped scoring calls at increasing concurrency and reports latency and rate-limit errors.
import { createAI } from "../server/ai.js";
import { evaluate } from "../server/scoring.js";
const ai = createAI({ ...process.env, AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || "60000" });
const rubric = [
  { key: "product_thinking", label: "Product thinking", description: "Frames the problem and prioritises.", weight: 3 },
  { key: "ai_judgment", label: "AI judgment", description: "Knows limits of AI and how to test them.", weight: 3 },
  { key: "user_empathy", label: "User empathy", description: "Keeps the driver's trust in view.", weight: 2 },
  { key: "communication", label: "Communication", description: "Clear and structured.", weight: 2 },
];
const answer = "First I would refund the difference and apologise, because trust matters more than the amount. Then I would check the logs to see why the assistant quoted a stale price, pause fee answers for that lot, and make the assistant read the live fee from the gate system and show when it was last updated. I would track wrong-fee complaints per thousand conversations.";
const question = { question: "The assistant tells a driver parking costs ₹40, but the gate charges ₹120. What do you do in the next hour?", focus: "Judgment" };
const pct = (a, p) => a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
for (const n of (process.argv[2] || "1,10,25,50").split(",").map(Number)) {
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: n }, async (_, i) => {
    const t = Date.now();
    try {
      // a distinct question each time so the reference outline cache does not hide its cost
      await evaluate(ai, { rubric, question: { ...question, question: `${question.question} (${i}-${n}-${t0})` }, answer, exchanges: [], company: "Park+", role: "Product AI Intern" });
      return { ok: true, ms: Date.now() - t };
    } catch (e) { return { ok: false, ms: Date.now() - t, why: `${e.status || ""} ${String(e.message).slice(0, 60)}` }; }
  }));
  const ok = results.filter((r) => r.ok).map((r) => r.ms);
  const bad = results.filter((r) => !r.ok);
  console.log(`${String(n).padStart(3)} parallel answers (each = 1 reference + 3 judgements): ok ${ok.length}/${n}, wall ${((Date.now() - t0) / 1000).toFixed(1)} s, per-answer p50 ${ok.length ? (pct(ok, 50) / 1000).toFixed(1) : "-"} s p95 ${ok.length ? (pct(ok, 95) / 1000).toFixed(1) : "-"} s${bad.length ? `, failures: ${[...new Set(bad.map((b) => b.why))].join(" | ")}` : ""}`);
}
