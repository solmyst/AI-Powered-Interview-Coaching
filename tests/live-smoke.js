// Real-provider acceptance check. No fixtures or canned fallback answers.
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const origin = process.env.APP_ORIGIN || "http://localhost:5173";
let cookie;
async function call(path, method = "GET", body, headers = {}) {
  const start = Date.now();
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status}: ${data.error}`);
  console.log(path, `${Date.now() - start}ms`);
  return data;
}
const email = `acceptance-${Date.now()}@example.test`;
await call("/auth/register", "POST", {
  name: "Acceptance Test",
  email,
  password: randomUUID(),
});
let session;
try {
  session = await call(
    "/interviews",
    "POST",
    {
      role: "Backend",
      experience: "Early career",
      track: "Technical",
      difficulty: "Intermediate",
      industry: "Technology",
      company: "",
      resume:
        "Built a Node.js inventory API with PostgreSQL. Used Redis to cache product inventory for 60 seconds.",
      jobDescription:
        "Backend engineer focused on reliable APIs and consistency.",
      questionCount: 3,
    },
    { "Idempotency-Key": randomUUID() },
  );
  console.log("FIRST QUESTION:", session.currentQuestion.question);
  const answers = [
    "For my inventory API I used Redis cache-aside with a 60-second TTL. Reads check Redis first and query PostgreSQL on a cache miss. Writes commit to PostgreSQL before deleting the Redis key. I would use transactions for stock updates and an idempotency key for checkout. My first implementation did not handle concurrent cache refills, which could reintroduce stale inventory.",
    "A reader can fetch old data before a write commits, then populate the cache after invalidation. For checkout I would bypass the cache and use an atomic SQL update with a stock >= quantity condition. For browsing, a short TTL bounds the stale window. Versioned cache values or an outbox-driven invalidation event can help, but event ordering and retry handling need care.",
    "I would load-test concurrent checkout requests for the same SKU, assert stock never goes negative, and inject Redis downtime and delayed invalidation. PostgreSQL remains the source of truth. I would monitor stale-read rate, database latency, error rate and outbox lag. I cannot claim exact improvements without measuring a baseline. Cache stampedes can be limited with per-key request coalescing.",
  ];
  for (let i = 0; i < answers.length; i++) {
    session = await call(`/interviews/${session.id}/answers`, "POST", {
      answer: answers[i],
      expectedTurn: i,
    });
    console.log("EVALUATION:", session.turns[i].evaluation.rationale);
    if (session.currentQuestion)
      console.log("FOLLOW-UP:", session.currentQuestion.question);
  }
  session = await call(`/interviews/${session.id}/report`, "POST", {});
  writeFileSync(
    "docs/live-smoke-result.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        provider: session.provider,
        model: session.model,
        session,
      },
      null,
      2,
    ),
  );
  console.log(
    "COMPLETE:",
    session.report.overall,
    session.report.studyPlan.length,
    "study tasks",
  );
} finally {
  await call("/me", "DELETE");
}
