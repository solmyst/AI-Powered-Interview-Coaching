// Own file so this app has a fresh per-IP rate limiter.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import options from "../shared/interview-options.json" with { type: "json" };

const origin = "http://localhost:5173";
const answerText =
  "I would cache hot reads with a TTL and invalidate the key on every write.";
let server, base, db, sync;

const ai = {
  provider: "test-double",
  model: "fixture",
  status: async () => ({ ready: true }),
  generate: async (schema, _task, context) => {
    const usage = { input: 3, output: 2 };
    if (schema.shape.evidence && !schema.shape.levels && !schema.shape.scores)
      return {
        value: { relevant: true, evidence: context.evidenceSpans[0].id },
        usage,
      };
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
    if (schema.shape.points)
      return {
        value: {
          points: ["Refund first", "Find the cause", "Prevent a repeat"],
        },
        usage,
      };
    if (schema.shape.levels) {
      const keys = Object.keys(schema.shape.levels.shape);
      return {
        value: {
          relevant: true,
          substantive: true,
          levels: Object.fromEntries(
            keys.map((k) => [k, k === "problem_solving" ? 3 : 2]),
          ),
          // Every criterion above level 1 needs a quote the candidate really said.
          evidence: [
            ...keys.map((k) => ({
              competency: k,
              spanId: context.evidenceSpans[0].id,
              supports: "strength",
            })),
          ],
          rationale: "Mentions caching and invalidation.",
        },
        usage,
      };
    }
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
      SCREENING_EMAILS:
        "other-owner@example.test,unregistered-listed@example.test",
      CANDIDATE_SPEECH_LIMIT: "2",
      API_RATE_LIMIT: "5000",
    },
    ai,
    transcriber,
    speech,
  });
  db = result.db;
  sync = result.syncApprovals;
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
  // Approvals are pinned at startup in production; the sync stands in for the operator's restart.
  sync();
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
  candidateFeedback: "summary",
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
  // Not yet approved: they can ask for access, and the request is remembered.
  assert.equal(
    (
      await call("/orgs/request", {
        method: "POST",
        cookie: nobody,
        body: { company: "Nope Inc", teamSize: "11-50" },
      })
    ).status,
    201,
  );
  assert.equal(
    (await call("/orgs", { method: "GET", cookie: nobody })).body.requested,
    true,
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
  const cut = await call("/candidate/session", {
    method: "POST",
    body: { token: "abc123" },
  });
  assert.equal(cut.status, 404);
  assert.match(cut.body.error, /looks incomplete/);
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
  // Submitting returns at once; scoring runs in the background, so the candidate never waits for it.
  assert.equal(done.status, 200);
  assert.equal(done.body.state, "report_pending");
  assert.equal(done.body.feedback, null);
  assert.doesNotMatch(done.text, /"(overall|competencyScores)"/);

  const report = await call(`/invites/${invites[0].id}/report`, {
    cookie: owner,
  });
  // A role that opted in to candidate feedback shows it once the report exists, still without scores.
  const later = await call("/candidate/session", { cookie: asha });
  assert.equal(later.body.state, "complete");
  assert.deepEqual(Object.keys(later.body.feedback), [
    "strengths",
    "areasToPrepare",
  ]);
  assert.doesNotMatch(later.text, /"(overall|competencyScores)"/);
  const { turns, report: summary } = report.body.screening;
  // The server supplies the actual transcript text; the model can select only source IDs.
  assert.ok(turns[0].evaluation.evidence.every((e) => e.quote === answerText));
  assert.equal(turns[0].evaluation.evidence.length, 4);
  assert.equal(turns[0].evaluation.evidenceDropped, 0);
  assert.equal(turns[0].evaluation.evidence[0].quote, answerText);
  assert.equal(turns[0].evaluation.evidence[0].start, 0);
  assert.equal(turns[0].evaluation.evidence[0].end, answerText.length);
  // Anchored levels (3,2,2,2) become scores 75,45,45,45. Questions never answered count as 0, so ending
  // early lowers the overall; the average of answered questions is kept separately.
  assert.deepEqual(turns[0].evaluation.levels, {
    ...turns[0].evaluation.levels,
  });
  assert.deepEqual(summary.coverage, {
    answered: summary.coverage.total,
    total: summary.coverage.total,
    noContent: 0,
  });
  assert.equal(summary.competencyScores.problem_solving, 75);
  assert.equal(
    summary.overall,
    Math.round((75 * 3 + 45 * 3 + 45 * 2 + 45 * 2) / 10),
  );
  assert.equal(summary.answeredAverage, summary.overall);
  assert.equal(summary.band, "mixed");
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

test("company questions, résumé, interview window, eye contact and strict-proctoring termination", async () => {
  const questions = [
    "Tell us about the hardest production incident you handled.",
    "How would you design idempotent payment retries?",
  ];
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: { ...roleBody("Payments engineer"), questions, proctoring: "strict" },
  });
  assert.equal(made.status, 201);
  // More company questions than the question count is rejected.
  assert.equal(
    (
      await call(`/orgs/${orgId}/roles`, {
        method: "POST",
        cookie: owner,
        body: {
          ...roleBody("Too many"),
          questions: [...questions, ...questions],
        },
      })
    ).status,
    400,
  );
  const later = Date.now() + 86400000;
  const sent = await call(`/roles/${made.body.id}/invites`, {
    method: "POST",
    cookie: owner,
    body: {
      candidates: [
        {
          name: "Early",
          email: "early@example.test",
          resume: "Built a ledger at Acme Pay.",
        },
      ],
      opensAt: later,
      closesAt: later + 7200000,
    },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.invites[0].opensAt, later);
  const now = await call(`/roles/${made.body.id}/invites`, {
    method: "POST",
    cookie: owner,
    body: {
      candidates: [
        {
          name: "Now",
          email: "now@example.test",
          resume: "Built a ledger at Acme Pay.",
        },
      ],
    },
  });
  async function join(link) {
    const s = await call("/candidate/session", {
      method: "POST",
      body: { token: tokenOf(link) },
    });
    await call("/candidate/consent", {
      method: "POST",
      cookie: s.cookie,
      body: { accepted: true, version: s.body.consentVersion },
    });
    return s;
  }
  const early = await join(sent.body.invites[0].link);
  assert.equal(early.body.opensAt, later);
  assert.equal(early.body.proctoring, "strict");
  const blocked = await call("/candidate/interview", {
    method: "POST",
    cookie: early.cookie,
    body: {},
  });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /opens at/);

  const cand = await join(now.body.invites[0].link);
  const started = await call("/candidate/interview", {
    method: "POST",
    cookie: cand.cookie,
    body: {},
  });
  assert.equal(started.body.currentQuestion.question, questions[0]);
  const visual = {
    samples: 40,
    observedMs: 10000,
    faceSamples: 40,
    gazeSamples: 40,
    alignedGazeSamples: 30,
    centeredSamples: 40,
    headLevelSamples: 40,
    shoulderSamples: 40,
    levelShoulderSamples: 40,
  };
  const next = await call("/candidate/interview/answers", {
    method: "POST",
    cookie: cand.cookie,
    body: { answer: answerText, expectedTurn: 0, delivery: { visual } },
  });
  assert.equal(next.body.currentQuestion.question, questions[1]);
  assert.equal(
    next.body.turns[0].attention,
    undefined,
    "candidates never see their metrics",
  );
  const stored = JSON.parse(
    db
      .prepare("SELECT data FROM screenings WHERE invite_id=?")
      .get(now.body.invites[0].id).data,
  );
  assert.deepEqual(stored.turns[0].attention, { eyeContact: 75, inFrame: 100 });
  assert.equal(stored.setup.resume, "Built a ledger at Acme Pay.");

  const ended = await call("/candidate/interview/terminate", {
    method: "POST",
    cookie: cand.cookie,
    body: { reason: "fullscreen_exit" },
  });
  assert.equal(ended.body.status, "completed");
  const after = await call("/candidate/interview/answers", {
    method: "POST",
    cookie: cand.cookie,
    body: { answer: answerText, expectedTurn: 1 },
  });
  assert.equal(after.status, 409);
  const report = await call(`/invites/${now.body.invites[0].id}/report`, {
    cookie: owner,
  });
  assert.equal(report.body.screening.report.attention, 75);
  assert.ok(report.body.events.some((e) => e.kind === "terminated"));
  const list = await call(`/roles/${made.body.id}/candidates`, {
    cookie: owner,
  });
  const row = list.body.candidates.find((c) => c.email === "now@example.test");
  assert.equal(row.terminated, true);
  assert.equal(row.attention, 75);
});

test("a candidate session cannot use the API after the interview window closes", async () => {
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: roleBody("Window check"),
  });
  const sent = await call(`/roles/${made.body.id}/invites`, {
    method: "POST",
    cookie: owner,
    body: { candidates: [{ name: "Late", email: "late@example.test" }] },
  });
  const opened = await call("/candidate/session", {
    method: "POST",
    body: { token: tokenOf(sent.body.invites[0].link) },
  });
  await call("/candidate/consent", {
    method: "POST",
    cookie: opened.cookie,
    body: { accepted: true, version: opened.body.consentVersion },
  });
  await call("/candidate/interview", {
    method: "POST",
    cookie: opened.cookie,
    body: {},
  });
  const speak = () =>
    call("/speech", {
      method: "POST",
      cookie: opened.cookie,
      body: { text: "Hello" },
      raw: true,
    });
  assert.equal((await speak()).status, 200);
  // Window closed an hour ago (past the 15 minute grace): the session cookie is still valid but must not work.
  db.prepare("UPDATE invites SET expires=? WHERE id=?").run(
    Date.now() - 3600000,
    sent.body.invites[0].id,
  );
  assert.equal((await speak()).status, 401);
  for (const [path, body] of [
    ["/candidate/interview/answers", { answer: answerText, expectedTurn: 0 }],
    ["/candidate/interview/report", {}],
  ])
    assert.equal(
      (await call(path, { method: "POST", cookie: opened.cookie, body }))
        .status,
      401,
      path,
    );
});

test("listing an email grants nothing to an account that registers it later", async () => {
  // other-owner@ is listed but its account is created after the sync; a later registrant of a listed,
  // unused email must not be approved until the operator syncs.
  const res = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Squatter",
      email: "unregistered-listed@example.test",
      password: "long-test-password",
    },
  });
  const before = await call("/orgs", { cookie: res.cookie });
  assert.equal(before.body.canCreate, false);
});

test("an open link lets testers sign themselves up, within a cap, and the owner controls it", async () => {
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: roleBody("Open link role"),
  });
  const path = `/roles/${made.body.id}/open-link`;
  assert.equal((await call(path, { cookie: owner })).body.enabled, false);
  // Only an owner can switch it on; another company cannot even see it.
  assert.equal((await call(path, { cookie: other })).status, 404);
  const on = await call(path, {
    method: "PUT",
    cookie: owner,
    body: { enabled: true, cap: 2 },
  });
  assert.equal(on.status, 200);
  assert.match(on.body.link, /\/interviewace\/join#r=[a-f0-9]{64}$/);
  const token = on.body.link.split("#r=")[1];
  const info = await call(`/candidate/open/${token}`);
  assert.equal(info.body.roleTitle, "Open link role");
  const signUpLink = (name, email) =>
    call(`/candidate/open/${token}`, { method: "POST", body: { name, email } });
  const first = await signUpLink("Tess", "tess@example.test");
  assert.equal(first.status, 201);
  // The returned token opens the usual private invite flow.
  const opened = await call("/candidate/session", {
    method: "POST",
    body: { token: first.body.token },
  });
  assert.equal(opened.body.roleTitle, "Open link role");
  assert.equal(
    (await signUpLink("Tess again", "tess@example.test")).status,
    409,
  );
  assert.equal((await signUpLink("Uma", "uma@example.test")).status, 201);
  // Cap of two reached: a third is refused, and the failed attempts did not use up places.
  assert.equal((await signUpLink("Vic", "vic@example.test")).status, 409);
  assert.equal((await call(path, { cookie: owner })).body.used, 2);
  // Turning it off or rotating it kills the old link.
  await call(path, {
    method: "PUT",
    cookie: owner,
    body: { enabled: true, cap: 5, rotate: true },
  });
  assert.equal((await call(`/candidate/open/${token}`)).status, 404);
  await call(path, {
    method: "PUT",
    cookie: owner,
    body: { enabled: false, cap: 5 },
  });
  const list = await call(`/roles/${made.body.id}/candidates`, {
    cookie: owner,
  });
  assert.deepEqual(list.body.candidates.map((c) => c.name).sort(), [
    "Tess",
    "Uma",
  ]);
});

test("the company can tell a candidate who left from one who is answering, and sees recent activity", async () => {
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: roleBody("Activity check"),
  });
  const sent = await call(`/roles/${made.body.id}/invites`, {
    method: "POST",
    cookie: owner,
    body: { candidates: [{ name: "Leo", email: "leo@example.test" }] },
  });
  const opened = await call("/candidate/session", {
    method: "POST",
    body: { token: tokenOf(sent.body.invites[0].link) },
  });
  await call("/candidate/consent", {
    method: "POST",
    cookie: opened.cookie,
    body: { accepted: true, version: opened.body.consentVersion },
  });
  await call("/candidate/interview", {
    method: "POST",
    cookie: opened.cookie,
    body: {},
  });
  const row = async () =>
    (await call(`/roles/${made.body.id}/candidates`, { cookie: owner })).body
      .candidates[0];
  const answering = await row();
  assert.equal(answering.status, "started");
  assert.ok(answering.lastSeen > 0);
  assert.equal(answering.leftAt, 0);
  await call("/candidate/leave", {
    method: "POST",
    cookie: opened.cookie,
    body: {},
  });
  assert.ok((await row()).leftAt > 0);
  const feed = await call(`/orgs/${orgId}/activity`, { cookie: owner });
  const mine = feed.body.find((a) => a.name === "Leo");
  assert.equal(mine.status, "started");
  assert.ok(mine.leftAt > 0);
  // Another company cannot read this feed.
  assert.equal(
    (await call(`/orgs/${orgId}/activity`, { cookie: other })).status,
    404,
  );
  // Coming back clears the "left" mark.
  await call("/candidate/interview", {
    method: "POST",
    cookie: opened.cookie,
    body: {},
  });
  assert.equal((await row()).leftAt, 0);
});

test("delivery counts are stored per answer, summarised for the company, and never shown to the candidate", async () => {
  const { fillersOf, deliveryOf, deliverySummary } =
    await import("../server/screening.js");
  assert.deepEqual(
    fillersOf(
      "Um, so basically I think, uh, you know, matlab it is good. Ummm",
    ),
    {
      um: 2,
      basically: 1,
      uh: 1,
      "you know": 1,
      matlab: 1,
    },
  );
  const one = deliveryOf(
    {
      speech: { source: "assemblyai", captureMs: 30000, words: 60, fillers: 0 },
      visual: {
        samples: 56,
        observedMs: 28000,
        awayEpisodes: 2,
        awayMs: 5000,
        lostEpisodes: 1,
        lostMs: 3000,
      },
    },
    "Um we should look at funnel data, you know, and uh check drop off at the entry step. ".repeat(
      3,
    ),
  );
  assert.equal(one.spoken, true);
  assert.equal(one.fillerTotal, 9);
  assert.equal(one.wpm, Math.round(one.words / 0.5));
  const typed = deliveryOf(undefined, "A typed answer with no fillers at all.");
  assert.equal(typed.spoken, false);
  assert.equal(typed.wpm, null);
  const sum = deliverySummary([{ delivery: one }, { delivery: typed }]);
  assert.equal(sum.spokenAnswers, 1);
  assert.equal(sum.typedAnswers, 1);
  assert.equal(sum.awayEpisodes, 2);
  assert.equal(sum.lostEpisodes, 1);
  assert.equal(sum.fillerTotal, 9);

  // Through the API: the company report carries them, the candidate's own view does not.
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: roleBody("Delivery check"),
  });
  const sent = await call(`/roles/${made.body.id}/invites`, {
    method: "POST",
    cookie: owner,
    body: { candidates: [{ name: "Dee", email: "dee@example.test" }] },
  });
  const opened = await call("/candidate/session", {
    method: "POST",
    body: { token: tokenOf(sent.body.invites[0].link) },
  });
  await call("/candidate/consent", {
    method: "POST",
    cookie: opened.cookie,
    body: { accepted: true, version: opened.body.consentVersion },
  });
  await call("/candidate/interview", {
    method: "POST",
    cookie: opened.cookie,
    body: {},
  });
  const answered = await call("/candidate/interview/answers", {
    method: "POST",
    cookie: opened.cookie,
    body: {
      answer: answerText,
      expectedTurn: 0,
      delivery: {
        speech: {
          source: "assemblyai",
          captureMs: 20000,
          words: 40,
          fillers: 0,
        },
        visual: {
          samples: 40,
          observedMs: 20000,
          faceSamples: 38,
          gazeSamples: 36,
          alignedGazeSamples: 30,
          centeredSamples: 30,
          headLevelSamples: 30,
          shoulderSamples: 0,
          levelShoulderSamples: 0,
          awayEpisodes: 3,
          awayMs: 6000,
          awayRunMs: 0,
          lostEpisodes: 1,
          lostMs: 2500,
          lostRunMs: 0,
        },
      },
    },
  });
  assert.equal(JSON.stringify(answered.body).includes("awayEpisodes"), false);
  assert.equal(JSON.stringify(answered.body).includes("fillerTotal"), false);
  const invite = sent.body.invites[0].id;
  const report = await call(`/invites/${invite}/report`, { cookie: owner });
  const turn = report.body.screening.turns[0];
  assert.equal(turn.delivery.awayEpisodes, 3);
  assert.equal(turn.delivery.spoken, true);
  assert.equal(report.body.screening.deliverySummary.awayEpisodes, 3);
  assert.equal(report.body.screening.deliverySummary.cameraAnswers, 1);
  const csv = await call(`/roles/${made.body.id}/export.csv`, {
    cookie: owner,
    raw: true,
  });
  assert.match(csv.body.split("\r\n")[0], /Looked away \(times\)/);
});
test("an owner can delete a role with everything under it; another company cannot", async () => {
  const made = await call(`/orgs/${orgId}/roles`, {
    method: "POST",
    cookie: owner,
    body: roleBody("Role to delete"),
  });
  assert.equal(made.status, 201);
  const sent = await call(`/roles/${made.body.id}/invites`, {
    method: "POST",
    cookie: owner,
    body: { candidates: [{ name: "Ravi", email: "ravi-delete@example.com" }] },
  });
  const inviteId = sent.body.invites[0].id;
  assert.equal(
    (await call(`/roles/${made.body.id}`, { method: "DELETE", cookie: other }))
      .status,
    404,
  );
  assert.equal(
    (await call(`/roles/${made.body.id}`, { method: "DELETE", cookie: owner }))
      .status,
    200,
  );
  assert.equal(
    (await call(`/roles/${made.body.id}`, { cookie: owner })).status,
    404,
  );
  assert.equal(
    db.prepare("SELECT 1 FROM invites WHERE id=?").get(inviteId),
    undefined,
  );
  // Other roles are untouched.
  assert.equal((await call(`/roles/${roleId}`, { cookie: owner })).status, 200);
});
