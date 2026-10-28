// Opt-in acceptance against configured providers using an isolated in-memory DB.
// Never opens production accounts or changes production candidate records.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app.js";

const origin = "http://localhost:5173";
const { app, db } = createApp({ env: { ...process.env, NODE_ENV: "test", DATABASE_PATH: ":memory:", APP_ORIGIN: origin } });
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
let cookie = "";
async function call(path, body, headers = {}) {
  const start = Date.now();
  const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.headers.get("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
  const value = await response.json();
  assert.ok(response.ok, `${path}: ${response.status}: ${value.error}`);
  console.log(JSON.stringify({ path, ms: Date.now() - start, status: response.status }));
  return value;
}
try {
  await call("/auth/register", { name: "Isolated Lab Acceptance", email: `lab-${randomUUID()}@example.test`, password: randomUUID() });
  let session = await call("/interviews", { role: "Backend", experience: "Early career", track: "Technical", difficulty: "Intermediate", industry: "Technology", company: "", resume: "Built a PostgreSQL inventory API with Redis caching.", jobDescription: "Build reliable backend APIs and explain consistency trade-offs.", questionCount: 3 }, { "Idempotency-Key": randomUUID() });
  const id = session.id;
  await call(`/interviews/${id}/clarify`, { expectedTurn: 0 });
  const answers = [
    "I used Redis with a 60 second TTL. Reads check the cache first. If the cache misses, I read PostgreSQL and fill Redis. I deleted the cache after writes. I did not test concurrent readers or measure error rates.",
    "A reader may refill the cache with an older value after the writer invalidates it. I would use versioned cache values and bypass Redis for checkout. Stock decrement needs an atomic SQL update with a stock greater than or equal to quantity condition.",
    "I would test concurrent checkout, Redis downtime and delayed invalidation. PostgreSQL remains the source of truth. I would measure stale-read rate, database load and outbox lag. I cannot claim an improvement without measuring it.",
  ];
  for (let i = 0; i < answers.length; i++) session = await call(`/interviews/${id}/answers`, { answer: answers[i], expectedTurn: i });
  session = await call(`/interviews/${id}/report`, {});
  const originalScore = session.report.overall;
  session = await call(`/interviews/${id}/rehearsal/0`, {});
  assert.equal(session.rehearsals[0].plan.checkpoints.length, 3);
  console.log("FOCUS:", session.rehearsals[0].plan.focus);
  const retry = "मेरे design में PostgreSQL source of truth है। Redis miss पर database read करके cache भरता हूँ। Concurrent stale refill रोकने के लिए version check करता हूँ। Checkout में cache bypass करके atomic SQL update करता हूँ ताकि stock negative न हो। Trade-off: database load बढ़ता है, इसलिए latency और stale-read rate को load test में measure करूँगा।";
  session = await call(`/interviews/${id}/rehearsal/0/answers`, { answer: retry, expectedAttempt: 0 });
  session = await call(`/interviews/${id}/rehearsal/0/answers`, { answer: "I would identify the source of truth and the failure window first. I would use an atomic conditional database write and an idempotency key. On cache failure I would bypass it with bounded database concurrency, accepting higher latency. I would test delayed and duplicated events, stale refills and recovery under load, then measure stale reads, error rates and queue lag before claiming success.", expectedAttempt: 1 });
  assert.equal(session.report.overall, originalScore);
  assert.equal(session.rehearsals[0].attempts.length, 2);
  console.log("PASS:", JSON.stringify({ provider: session.provider, model: session.model, originalScore, stages: session.rehearsals[0].attempts.map((a) => ({ stage: a.stage, observations: a.result.checks.map((c) => c.status) })), quoteVerification: "all accepted by server" }));
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
}
