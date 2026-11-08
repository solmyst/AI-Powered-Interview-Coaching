// Own file so this app has a fresh per-IP rate limiter.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const origin = "http://localhost:5173";
let server, base, db;
before(async () => {
  const result = createApp({
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      APP_ORIGIN: origin,
      DAILY_INTERVIEW_LIMIT: "2",
      DAILY_SPEECH_LIMIT: "3",
      UNLIMITED_EMAILS: " Owner@Example.test ,other-owner@example.test",
    },
    ai: {
      provider: "test-double",
      model: "fixture",
      status: async () => ({ ready: true }),
      generate: async () => ({
        value: {
          question: "Why?",
          focus: "Reasoning",
          difficulty: "Intermediate",
        },
        usage: { input: 1, output: 1 },
      }),
    },
    transcriber: {
      status: () => ({ ready: true }),
      transcribe: async () => ({ text: "", confidence: null, durationMs: 0 }),
    },
    speech: {
      status: () => ({ ready: true }),
      synthesize: async () => ({
        audio: new Uint8Array([1]),
        contentType: "audio/wav",
      }),
    },
  });
  db = result.db;
  server = result.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  db.close();
});
const post = (path, cookie, body, headers = {}) =>
  fetch(base + "/api" + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
async function account(email) {
  const res = await post("/auth/register", null, {
    name: "Tester",
    email,
    password: "long-test-password",
  });
  return {
    cookie: res.headers.get("set-cookie").split(";")[0],
    usage: (await res.json()).usage,
  };
}
const create = (cookie) =>
  post(
    "/interviews",
    cookie,
    {
      role: "Backend",
      experience: "Early career",
      track: "Technical",
      difficulty: "Intermediate",
      industry: "Technology",
      questionCount: 3,
    },
    { "Idempotency-Key": crypto.randomUUID() },
  );
test("testing accounts skip trial caps while new sign-ups stay on the trial", async () => {
  const owner = await account("OWNER@example.test");
  const trial = await account("trial-user@example.test");
  assert.equal(owner.usage.limit, null);
  assert.equal(trial.usage.limit, 2);
  for (let i = 0; i < 3; i++)
    assert.equal((await create(owner.cookie)).status, 201);
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await post("/speech", owner.cookie, { text: "Hello" })).status,
      200,
    );
  assert.equal((await create(trial.cookie)).status, 201);
  assert.equal((await create(trial.cookie)).status, 201);
  assert.equal((await create(trial.cookie)).status, 429);
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await post("/speech", trial.cookie, { text: "Hello" })).status,
      200,
    );
  assert.equal(
    (await post("/speech", trial.cookie, { text: "Hello" })).status,
    429,
  );
});
