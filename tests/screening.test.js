// Own file so this app has a fresh per-IP rate limiter.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import options from "../shared/interview-options.json" with { type: "json" };

const origin = "http://localhost:5173";
const answerText =
  "I would cache hot reads with a TTL and invalidate the key on every write.";
let server, base, db;

const ai = {
  provider: "test-double",
  model: "fixture",
  status: async () => ({ ready: true }),
  generate: async (schema) => {
    const usage = { input: 3, output: 2 };
    if (schema.shape.kind)
      return {
        value: {
          kind: "answer",
          reply: "",
          nextQuestion: {
            lead: "Thanks.",
            question: `Imagine scenario ${Math.random().toString(36).slice(2)} breaks in production. What do you check first?`,
            focus: "Judgment",
            difficulty: "Intermediate",
          },
        },
        usage,
      };
    if (schema.shape.scores)
      return {
        value: {
          scores: Object.fromEntries(
            Object.keys(schema.shape.scores.shape).map((k, i) => [
              k,
              60 + i * 10,
            ]),
          ),
          evidence: [
            {
              competency: Object.keys(schema.shape.scores.shape)[0],
              quote: "cache hot reads with a TTL",
              supports: "strength",
            },
            {
              competency: Object.keys(schema.shape.scores.shape)[0],
              quote: "I rewrote the whole kernel myself",
              supports: "strength",
            },
          ],
          rationale: "Mentions caching and invalidation.",
        },
        usage,
      };
    if (schema.shape.suggestedFollowUps)
      return {
        value: {
          summary: "Solid caching answers.",
          strengths: ["Caching"],
          concerns: [],
          suggestedFollowUps: ["Probe consistency"],
        },
        usage,
      };
    return {
      value: {
        lead: "Hello, I'm Maya.",
        question: "Imagine a cache serves stale data. What do you do?",
        focus: "Caching",
        difficulty: "Intermediate",
      },
      usage,
    };
  },
};
const transcriber = {
  status: () => ({ ready: true }),
  transcribe: async () => ({ text: "hi", confidence: 1, durationMs: 100 }),
};
const speech = {
  status: () => ({ ready: true }),
  synthesize: async () => ({
    audio: new Uint8Array([1]),
    contentType: "audio/wav",
  }),
};

before(async () => {
  const result = createApp({
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      APP_ORIGIN: origin,
      UNLIMITED_EMAILS: "owner@example.test",
      SCREENING_EMAILS: "other-owner@example.test",
      CANDIDATE_SPEECH_LIMIT: "2",
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

async function call(path, { method = "GET", body, cookie, raw } = {}) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: raw ? text : text ? JSON.parse(text) : null,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
    text,
  };
}
async function signUp(email) {
  const res = await call("/auth/register", {
    method: "POST",
    body: { name: "Person", email, password: "long-test-password" },
  });
  return res.cookie;
}
const roleBody = (title = "Backend engineer") => ({
  title,
  role: "Backend",
  experience: "Early career",
  track: "Technical",
  difficulty: "Intermediate",
  industry: "Technology",
  jobDescription:
    "Build and operate APIs for a payments product. Own reliability, caching and data models.",
  questionCount: 3,
  rubric: options.rubrics.Technical,
});
const tokenOf = (link) => link.split("#t=")[1];

let owner, other, orgId, roleId, invites;

test("only approved accounts can create a company; others cannot see it", async () => {
  owner = await signUp("owner@example.test");
  other = await signUp("other-owner@example.test");
  const nobody = await signUp("nobody@example.test");
  assert.equal(
    (
      await call("/orgs", {
        method: "POST",
        cookie: nobody,
        body: { name: "Nope Inc" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/orgs", { method: "GET", cookie: nobody })).body.canCreate,
    false,
  );
  orgId = (
    await call("/orgs", {
      method: "POST",
      cookie: owner,
      body: { name: "Acme", contactEmail: "hr@acme.test" },
    })
  ).body.id;
  const otherOrg = (
    await call("/orgs", {
      method: "POST",
      cookie: other,
      body: { name: "Rival" },
    })
  ).body.id;
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: roleBody(),
  });
  assert.equal(made.status, 201);
  roleId = made.body.id;
  const sent = await call(`/roles/${roleId}/invites`, {
    method: "POST",
    cookie: owner,
    body: {
      candidates: [
        { name: "Asha", email: "Asha@Example.test" },
        { name: "Ravi", email: "ravi@example.test" },
        { name: "Asha again", email: "asha@example.test" },
      ],
    },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.invites.length, 2);
  assert.equal(sent.body.skipped.length, 1);
  invites = sent.body.invites;
  // A member of another company gets 404 on every route that takes an id: ids must not leak.
  const id = invites[0].id;
  for (const [method, path, body] of [
    ["GET", `/orgs/${orgId}/roles`],
    ["GET", `/roles/${roleId}`],
    ["GET", `/roles/${roleId}/candidates`],
    ["GET", `/roles/${roleId}/export.csv`],
    [
      "POST",
      `/roles/${roleId}/invites`,
      { candidates: [{ name: "X", email: "x@example.test" }] },
    ],
    ["GET", `/invites/${id}/report`],
    ["POST", `/invites/${id}/decision`, { status: "reject" }],
    ["POST", `/invites/${id}/revoke`, {}],
    ["DELETE", `/invites/${id}`],
  ])
    assert.equal(
      (await call(path, { method, cookie: other, body })).status,
      404,
      `${method} ${path}`,
    );
  assert.equal(
    (await call(`/orgs/${otherOrg}/roles`, { cookie: owner })).status,
    404,
  );
});

test("invite links carry the token only in the fragment and only its hash is stored", () => {
  const token = tokenOf(invites[0].link);
  assert.match(invites[0].link, /\/interviewace\/join#t=[a-f0-9]{64}$/);
  const rows = db.prepare("SELECT token_hash FROM invites").all();
  assert.ok(
    rows.every((r) => r.token_hash !== token && r.token_hash.length === 64),
  );
  assert.equal(
    JSON.stringify(db.prepare("SELECT * FROM invites").all()).includes(token),
    false,
  );
});

let asha;
test("candidate flow: consent first, candidates never see scores, report verifies quotes", async () => {
  const token = tokenOf(invites[0].link);
  assert.equal(
    (
      await call("/candidate/session", {
        method: "POST",
        body: { token: "0".repeat(64) },
      })
    ).status,
    404,
  );
  const started = await call("/candidate/session", {
    method: "POST",
    body: { token },
  });
  assert.equal(started.status, 200);
  asha = started.cookie;
  assert.equal(started.body.company, "Acme");
  assert.equal(started.body.consented, false);
  // No interview before the notice is accepted, and an old notice version is not enough.
  assert.equal(
    (
      await call("/candidate/interview", {
        method: "POST",
        cookie: asha,
        body: {},
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/candidate/consent", {
        method: "POST",
        cookie: asha,
        body: { accepted: true, version: "old" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/candidate/consent", {
        method: "POST",
        cookie: asha,
        body: { accepted: true, version: started.body.consentVersion },
      })
    ).body.consented,
    true,
  );
  const opened = await call("/candidate/interview", {
    method: "POST",
    cookie: asha,
    body: {},
  });
  assert.equal(opened.status, 201);
  assert.equal(opened.body.setup.company, "Acme");
  assert.equal(opened.body.setup.jobDescription, undefined);
  let last;
  for (let i = 0; i < 3; i++) {
    last = await call("/candidate/interview/answers", {
      method: "POST",
      cookie: asha,
      body: { answer: answerText, expectedTurn: i },
    });
    assert.equal(last.status, 200);
    assert.equal(last.body.turns.length, i + 1);
    // Nothing the model produced about the candidate may reach the candidate.
    assert.doesNotMatch(
      last.text,
      /"(evaluation|scores?|rubric|rationale|report|delivery|evidence)"/,
    );
  }
  assert.equal(last.body.state, "report_pending");
  assert.equal(
    (
      await call("/candidate/interview/answers", {
        method: "POST",
        cookie: asha,
        body: { answer: answerText, expectedTurn: 0 },
      })
    ).status,
    409,
  );
  const done = await call("/candidate/interview/report", {
    method: "POST",
    cookie: asha,
    body: {},
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.state, "complete");
  assert.deepEqual(Object.keys(done.body.feedback), [
    "strengths",
    "areasToPrepare",
  ]);
  assert.doesNotMatch(done.text, /"(overall|competencyScores)"/);

  const report = await call(`/invites/${invites[0].id}/report`, {
    cookie: owner,
  });
  const { turns, report: summary } = report.body.screening;
  // The invented quote is dropped; the real one stays.
  assert.equal(turns[0].evaluation.evidence.length, 1);
  assert.equal(
    turns[0].evaluation.evidence[0].quote,
    "cache hot reads with a TTL",
  );
  assert.equal(turns[0].evaluation.evidenceDropped, 1);
  // Weighted by the rubric, computed by the server: scores 60,70,80,90 with weights 3,3,2,2.
  assert.equal(
    summary.overall,
    Math.round((60 * 3 + 70 * 3 + 80 * 2 + 90 * 2) / 10),
  );
  assert.equal(report.body.invite.status, "completed");
});

test("reconnect resumes the same interview; a second device replaces the first", async () => {
  const token = tokenOf(invites[1].link);
  const first = await call("/candidate/session", {
    method: "POST",
    body: { token },
  });
  await call("/candidate/consent", {
    method: "POST",
    cookie: first.cookie,
    body: { accepted: true, version: first.body.consentVersion },
  });
  const opened = await call("/candidate/interview", {
    method: "POST",
    cookie: first.cookie,
    body: {},
  });
  await call("/candidate/interview/answers", {
    method: "POST",
    cookie: first.cookie,
    body: { answer: answerText, expectedTurn: 0 },
  });
  const second = await call("/candidate/session", {
    method: "POST",
    body: { token },
  });
  assert.equal(second.body.answered, 1);
  assert.equal(
    (await call("/candidate/session", { cookie: first.cookie })).status,
    401,
  );
  const resumed = await call("/candidate/interview", {
    method: "POST",
    cookie: second.cookie,
    body: {},
  });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.id, opened.body.id);
  assert.equal(resumed.body.turns.length, 1);
  const kinds = db
    .prepare("SELECT kind FROM integrity_events WHERE invite_id=?")
    .all(invites[1].id)
    .map((e) => e.kind);
  assert.ok(kinds.includes("new_device") && kinds.includes("reconnect"));
  // Candidates can report browser events, but only known kinds.
  assert.equal(
    (
      await call("/candidate/integrity-events", {
        method: "POST",
        cookie: second.cookie,
        body: { events: [{ kind: "tab_hidden", turn: 1, durationMs: 12000 }] },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/candidate/integrity-events", {
        method: "POST",
        cookie: second.cookie,
        body: { events: [{ kind: "new_device", turn: 1 }] },
      })
    ).status,
    400,
  );
  // Candidate speech is metered per invite and cut off at the cap.
  const wav = Buffer.alloc(44);
  wav.write("RIFF");
  wav.write("WAVE", 8);
  const transcribe = () =>
    fetch(base + "/api/transcribe", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: second.cookie,
        "Content-Type": "audio/wav",
      },
      body: wav,
    });
  assert.equal((await transcribe()).status, 200);
  assert.equal((await transcribe()).status, 200);
  assert.equal((await transcribe()).status, 429);
  assert.equal(
    (await call("/speech", { method: "POST", body: { text: "hello" } })).status,
    401,
  );
  assert.equal(
    db.prepare("SELECT SUM(speech_calls) n FROM org_usage").get().n,
    2,
  );
});

test("company can rank, decide and review flags; decisions never change scores", async () => {
  const list = await call(`/roles/${roleId}/candidates`, { cookie: owner });
  assert.deepEqual(
    list.body.candidates.map((c) => [c.name, c.status]),
    [
      ["Asha", "completed"],
      ["Ravi", "started"],
    ],
  );
  assert.ok(list.body.candidates[0].score > 0);
  assert.equal(list.body.candidates[1].score, null);
  assert.equal(list.body.candidates[1].unreviewedFlags, 1);
  const before = list.body.candidates[0].score;
  const decided = await call(`/invites/${invites[0].id}/decision`, {
    method: "POST",
    cookie: owner,
    body: { status: "reject", note: "Not a fit for this team" },
  });
  assert.equal(decided.body.decision.by, "Person");
  const after = (await call(`/roles/${roleId}/candidates`, { cookie: owner }))
    .body.candidates[0];
  assert.equal(after.score, before);
  assert.equal(after.status, "completed");
  const report = await call(`/invites/${invites[1].id}/report`, {
    cookie: owner,
  });
  const flag = report.body.events.find((e) => e.kind === "tab_hidden");
  assert.equal(flag.durationMs, 12000);
  await call(`/invites/${invites[1].id}/integrity-review`, {
    method: "POST",
    cookie: owner,
    body: { eventIds: [flag.id], verdict: "no_concern", note: "Notification" },
  });
  assert.equal(
    (await call(`/roles/${roleId}/candidates`, { cookie: owner })).body
      .candidates[1].unreviewedFlags,
    0,
  );
});

test("a started role cannot change its rubric; links can be revoked and reissued", async () => {
  const patch = await call(`/roles/${roleId}`, {
    method: "PATCH",
    cookie: owner,
    body: { config: roleBody("Changed") },
  });
  assert.equal(patch.status, 409);
  const reissued = await call(`/invites/${invites[1].id}/reissue`, {
    method: "POST",
    cookie: owner,
    body: {},
  });
  assert.equal(
    (
      await call("/candidate/session", {
        method: "POST",
        body: { token: tokenOf(invites[1].link) },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/candidate/session", {
        method: "POST",
        body: { token: tokenOf(reissued.body.link) },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`/invites/${invites[1].id}/revoke`, {
        method: "POST",
        cookie: owner,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/candidate/session", {
        method: "POST",
        body: { token: tokenOf(reissued.body.link) },
      })
    ).status,
    410,
  );
});

test("CSV export neutralises spreadsheet formulas", async () => {
  const sent = await call(`/roles/${roleId}/invites`, {
    method: "POST",
    cookie: owner,
    body: {
      candidates: [{ name: '=HYPERLINK("x")', email: "csv@example.test" }],
    },
  });
  assert.equal(sent.status, 201);
  const csv = (
    await call(`/roles/${roleId}/export.csv`, { cookie: owner, raw: true })
  ).body;
  assert.match(csv, /"'=HYPERLINK/);
  assert.doesNotMatch(csv, /,"=HYPERLINK|^"=HYPERLINK/m);
});

test("declining deletes nothing the company did not create; retention purge cascades", async () => {
  const sent = await call(`/roles/${roleId}/invites`, {
    method: "POST",
    cookie: owner,
    body: { candidates: [{ name: "Dee", email: "dee@example.test" }] },
  });
  const session = await call("/candidate/session", {
    method: "POST",
    body: { token: tokenOf(sent.body.invites[0].link) },
  });
  const declined = await call("/candidate/consent", {
    method: "POST",
    cookie: session.cookie,
    body: { declined: true },
  });
  assert.equal(declined.body.contactEmail, "hr@acme.test");
  assert.equal(
    db
      .prepare("SELECT status FROM invites WHERE id=?")
      .get(sent.body.invites[0].id).status,
    "withdrawn",
  );
  assert.equal(
    (await call("/candidate/session", { cookie: session.cookie })).status,
    401,
  );
  // Retention: 30 days is the minimum; older invites and everything under them go.
  assert.equal(
    (
      await call(`/orgs/${orgId}`, {
        method: "PATCH",
        cookie: owner,
        body: { retentionDays: 5 },
      })
    ).status,
    400,
  );
  await call(`/orgs/${orgId}`, {
    method: "PATCH",
    cookie: owner,
    body: { retentionDays: 30 },
  });
  db.prepare("UPDATE invites SET created=? WHERE id=?").run(
    new Date(Date.now() - 40 * 86400000).toISOString(),
    invites[0].id,
  );
  await call("/orgs", { cookie: owner });
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM invites WHERE id=?").get(invites[0].id)
      .n,
    0,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM screenings WHERE invite_id=?")
      .get(invites[0].id).n,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM invites WHERE id=?").get(invites[1].id)
      .n,
    1,
  );
});
