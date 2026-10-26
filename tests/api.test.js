import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { dimensions } from "../server/schemas.js";
const origin = "http://localhost:5173";
const question = {
  question: "How would you handle a stale cache?",
  focus: "Cache invalidation",
  difficulty: "Intermediate",
};
const evaluation = {
  scores: Object.fromEntries(dimensions.map((d) => [d, 65])),
  rationale:
    "The TTL example explains staleness but omits consistency trade-offs.",
  strengths: ["Explains TTL"],
  improvements: ["Compare invalidation strategies"],
  missingConcepts: ["Race conditions"],
  modelAnswer:
    "Use a TTL with invalidation on write; explain consistency trade-offs.",
};
const report = {
  summary: "Practice cache consistency.",
  strengths: ["Concrete example"],
  improvements: ["Explain race conditions"],
  studyPlan: [1, 2, 3].map((day) => ({
    day,
    topic: "Caching",
    task: "Compare write-through and cache-aside",
    practiceQuestion: "How can a cache return stale data?",
  })),
};
let badAI = false,
  calls = 0,
  delay = 0,
  transcribedBytes = 0,
  server,
  base,
  db;
const ai = {
  provider: "test-double",
  model: "fixture",
  status: async () => ({ ready: true }),
  generate: async (schema) => {
    calls++;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (badAI)
      throw Object.assign(new Error("Provider unavailable"), { status: 503 });
    const shape = schema.shape;
    return {
      value: shape.nextQuestion
        ? { evaluation, nextQuestion: question }
        : shape.scores
          ? evaluation
          : shape.summary
            ? report
            : question,
      usage: { input: 10, output: 5 },
    };
  },
};
const transcriber = {
  status: () => ({
    provider: "assemblyai",
    model: "universal-3-5-pro",
    ready: true,
  }),
  transcribe: async (audio) => {
    transcribedBytes = audio.length;
    return { text: "मैंने a cache service बनाई.", confidence: 0.96, durationMs: 2300 };
  },
};
const speech = {
  status: () => ({
    provider: "elevenlabs",
    model: "eleven_v4_turbo",
    voiceId: "fixture-voice",
    ready: true,
  }),
  synthesize: async () => ({ audio: new Uint8Array([1, 2, 3]), contentType: "audio/mpeg" }),
};
before(async () => {
  const result = createApp({
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      APP_ORIGIN: origin,
      DAILY_INTERVIEW_LIMIT: "2",
    },
    ai,
    transcriber,
    speech,
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
async function request(
  path,
  { method = "GET", body, cookie, headers = {} } = {},
) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: res.status,
    body: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
    headers: res.headers,
  };
}
async function account(email) {
  return request("/auth/register", {
    method: "POST",
    body: { name: "Test Candidate", email, password: "long-test-password" },
  });
}
const setup = {
  role: "Backend",
  experience: "Early career",
  track: "Technical",
  difficulty: "Intermediate",
  industry: "Technology",
  company: "",
  resume: "Built a cache",
  jobDescription: "",
  questionCount: 3,
};
const create = (cookie, id = crypto.randomUUID()) =>
  request("/interviews", {
    method: "POST",
    cookie,
    body: setup,
    headers: { "Idempotency-Key": id },
  });
test("authentication, session cookies, invalid credentials and CSRF", async () => {
  assert.equal((await request("/interviews")).status, 401);
  const a = await account("auth@example.test");
  assert.equal(a.status, 201);
  assert.match(a.headers.get("set-cookie"), /HttpOnly/);
  assert.match(a.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(
    (await request("/me", { cookie: a.cookie })).body.user.email,
    "auth@example.test",
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "auth@example.test", password: "wrong-password" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "auth@example.test", password: "long-test-password" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/me", {
        method: "PATCH",
        cookie: a.cookie,
        body: { name: "Hacker" },
        headers: { Origin: "https://evil.test" },
      })
    ).status,
    403,
  );
  await request("/auth/logout", { method: "POST", cookie: a.cookie, body: {} });
  assert.equal((await request("/me", { cookie: a.cookie })).status, 401);
});
test("authenticated WAV transcription returns only the safe transcript contract", async () => {
  const a = await account("speech@example.test");
  const wav = Buffer.alloc(44);
  wav.write("RIFF");
  wav.write("WAVE", 8);
  const unauthorized = await fetch(base + "/api/transcribe", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "audio/wav" },
    body: wav,
  });
  assert.equal(unauthorized.status, 401);

  const response = await fetch(base + "/api/transcribe", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: a.cookie,
      "Content-Type": "audio/wav",
    },
    body: wav,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: "मैंने a cache service बनाई.",
    confidence: 0.96,
    durationMs: 2300,
  });
  assert.equal(transcribedBytes, 44);
});
test("authenticated interviewer speech returns audio without exposing provider credentials", async () => {
  const a = await account("tts@example.test");
  const unauthorized = await fetch(base + "/api/speech", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Welcome" }),
  });
  assert.equal(unauthorized.status, 401);
  const response = await fetch(base + "/api/speech", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: a.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: "नमस्ते. Welcome to your interview." }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
});
test("complete interview, grounded evaluations, report, bookmarks, ownership and deletion", async () => {
  const a = await account("flow@example.test"),
    b = await account("other@example.test");
  const id = crypto.randomUUID();
  const first = await create(a.cookie, id);
  assert.equal(first.status, 201);
  assert.equal((await create(a.cookie, id)).status, 200);
  assert.equal((await request("/me", { cookie: a.cookie })).body.usage.used, 1);
  assert.equal(
    (await request(`/interviews/${id}`, { cookie: b.cookie })).status,
    404,
  );
  assert.equal(
    (
      await request(`/interviews/${id}/answers`, {
        method: "POST",
        cookie: b.cookie,
        body: { answer: "Use TTL", expectedTurn: 0 },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/interviews/${id}/report`, {
        method: "POST",
        cookie: a.cookie,
        body: {},
      })
    ).status,
    400,
  );
  for (let i = 0; i < 3; i++) {
    const next = await request(`/interviews/${id}/answers`, {
      method: "POST",
      cookie: a.cookie,
      body: { answer: "Use a TTL to expire stale entries.", expectedTurn: i },
    });
    assert.equal(next.status, 200);
    assert.equal(next.body.turns.length, i + 1);
    assert.equal(next.body.state, i === 2 ? "report_pending" : "active");
  }
  assert.equal(
    (
      await request(`/interviews/${id}/answers`, {
        method: "POST",
        cookie: a.cookie,
        body: { answer: "duplicate", expectedTurn: 0 },
      })
    ).status,
    409,
  );
  const result = await request(`/interviews/${id}/report`, {
    method: "POST",
    cookie: a.cookie,
    body: {},
  });
  assert.equal(result.body.report.overall, 65);
  assert.equal(result.body.setup.resume, "");
  assert.equal(result.body.state, "complete");
  const beforeCalls = calls;
  await request(`/interviews/${id}/report`, {
    method: "POST",
    cookie: a.cookie,
    body: {},
  });
  assert.equal(calls, beforeCalls);
  await request(`/interviews/${id}/bookmarks`, {
    method: "POST",
    cookie: a.cookie,
    body: { turn: 0, saved: true },
  });
  assert.equal(
    (await request("/bookmarks", { cookie: a.cookie })).body.length,
    1,
  );
  assert.equal(
    (await request("/bookmarks", { cookie: b.cookie })).body.length,
    0,
  );
  await request(`/interviews/${id}`, { method: "DELETE", cookie: a.cookie });
  assert.equal(
    (await request("/bookmarks", { cookie: a.cookie })).body.length,
    0,
  );
  assert.equal((await request("/me", { cookie: a.cookie })).body.usage.used, 1);
});
test("provider failure does not consume quota or advance answers; quota survives deletion", async () => {
  const a = await account("failure@example.test");
  badAI = true;
  assert.equal((await create(a.cookie)).status, 503);
  badAI = false;
  assert.equal((await request("/me", { cookie: a.cookie })).body.usage.used, 0);
  const first = await create(a.cookie);
  badAI = true;
  assert.equal(
    (
      await request(`/interviews/${first.body.id}/answers`, {
        method: "POST",
        cookie: a.cookie,
        body: { answer: "TTL", expectedTurn: 0 },
      })
    ).status,
    503,
  );
  badAI = false;
  assert.equal(
    (await request(`/interviews/${first.body.id}`, { cookie: a.cookie })).body
      .turns.length,
    0,
  );
  assert.equal((await create(a.cookie)).status, 201);
  assert.equal((await create(a.cookie)).status, 429);
  await request(`/interviews/${first.body.id}`, {
    method: "DELETE",
    cookie: a.cookie,
  });
  assert.equal((await create(a.cookie)).status, 429);
});
test("concurrent creation and answer submissions are serialized", async () => {
  const a = await account("concurrency@example.test");
  delay = 100;
  const results = await Promise.all([create(a.cookie), create(a.cookie)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const id = results.find((r) => r.status === 201).body.id;
  const answers = await Promise.all(
    [0, 1].map(() =>
      request(`/interviews/${id}/answers`, {
        method: "POST",
        cookie: a.cookie,
        body: { answer: "TTL expiry", expectedTurn: 0 },
      }),
    ),
  );
  assert.deepEqual(answers.map((r) => r.status).sort(), [200, 409]);
  delay = 0;
});
test("validation, export and account deletion", async () => {
  const a = await account("delete@example.test");
  assert.equal(
    (
      await request("/interviews", {
        method: "POST",
        cookie: a.cookie,
        body: { ...setup, questionCount: 100 },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
    ).status,
    400,
  );
  await create(a.cookie);
  const data = await request("/me/export", { cookie: a.cookie });
  assert.equal(data.body.interviews.length, 1);
  assert.equal(data.body.user.password, undefined);
  await request("/me", { method: "DELETE", cookie: a.cookie });
  assert.equal((await request("/me", { cookie: a.cookie })).status, 401);
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM users WHERE email=?")
      .get("delete@example.test").n,
    0,
  );
});
