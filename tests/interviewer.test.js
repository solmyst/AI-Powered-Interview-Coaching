// Own file so this app has a fresh per-IP rate limiter.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp, repeats, tidyQuestion } from "../server/app.js";
import { dimensions } from "../server/schemas.js";
const origin = "http://localhost:5173";
const evaluation = {
  scores: Object.fromEntries(dimensions.map((d) => [d, 20])),
  rationale: "No answer was given.",
  strengths: ["Stayed in the conversation"],
  improvements: ["Give one concrete example"],
  missingConcepts: [],
  modelAnswer: "A short example answer.",
};
const ask = (question) => ({
  lead: "",
  question,
  focus: "Debugging",
  difficulty: "Intermediate",
});
const first = "Walk me through your resume and your most relevant project.";
const fresh =
  "No worries. Imagine production checkout fails after a deploy: what do you check first?";
const tasks = [];
// Scoring runs in the background; only the calls that produce Maya's reply matter for latency.
const replyCalls = () =>
  tasks.filter((t) => t.startsWith("You are mid-interview")).length;
let server, base, db;
let mode = "answer";
before(async () => {
  const result = createApp({
    env: { NODE_ENV: "test", DATABASE_PATH: ":memory:", APP_ORIGIN: origin },
    ai: {
      provider: "test-double",
      model: "fixture",
      status: async () => ({ ready: true }),
      generate: async (schema, task) => {
        tasks.push(task);
        const value = schema.shape.kind
          ? mode === "stuck"
            ? { kind: "answer", reply: "", nextQuestion: ask(first) }
            : mode === "conversation" && !/treat this as kind answer/.test(task)
              ? {
                  kind: "conversation",
                  reply:
                    "Good question. I mean a bug you found yourself. Go ahead when ready.",
                  nextQuestion: null,
                }
              : {
                  kind: "answer",
                  reply: "",
                  nextQuestion: ask(
                    /clearly different situation/.test(task)
                      ? fresh
                      : `Sure. ${first}`,
                  ),
                }
          : schema.shape.scores
            ? evaluation
            : ask(first);
        return { value, usage: { input: 1, output: 1 } };
      },
    },
    transcriber: {
      status: () => ({ ready: true }),
      transcribe: async () => ({}),
    },
    speech: { status: () => ({ ready: true }), synthesize: async () => ({}) },
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

test("repeats spots reworded questions but not new scenarios", () => {
  const asked = [ask(first)];
  assert.equal(
    repeats(`No problem. Can you ${first.toLowerCase()}`, asked),
    true,
  );
  assert.equal(repeats(fresh, asked), false);
  assert.equal(
    repeats("Tell me about a time you disagreed with a reviewer.", [
      ask("Tell me about yourself."),
    ]),
    false,
  );
});

test("leads never ask a second question", () => {
  assert.equal(tidyQuestion(ask("Q?")).lead, "");
  assert.equal(
    tidyQuestion({
      ...ask("Q?"),
      lead: "Hi, I'm Maya. What excites you about this role? Let's begin.",
    }).lead,
    "Hi, I'm Maya. Let's begin.",
  );
  assert.equal(
    tidyQuestion({
      ...ask("Tell me about a database project you've worked on recently."),
      lead: "No problem. Tell me about a database project you've worked on recently.",
    }).lead,
    "No problem.",
  );
});

test("tidyQuestion strips stray characters, requests and cut-off sentences", () => {
  const out = tidyQuestion({
    ...ask("What would you check first?"),
    lead: "Hi, I'm Maya. Could you tell me about yourself. Nice to meet you. Let's start with areas you like to work on, 兴趣在的",
  });
  assert.equal(out.lead, "Hi, I'm Maya. Nice to meet you.");
  assert.equal(tidyQuestion(ask("Why 兴趣 this?")).question, "Why this?");
});

test("a repeated follow-up is regenerated once and the new question is saved", async () => {
  const reg = await post("/auth/register", null, {
    name: "Tester",
    email: "repeat@example.test",
    password: "long-test-password",
  });
  const cookie = reg.headers.get("set-cookie").split(";")[0];
  const start = await post(
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
  const session = await start.json();
  assert.match(tasks[0], /situational question/);
  tasks.length = 0;
  const answered = await (
    await post(`/interviews/${session.id}/answers`, cookie, {
      answer:
        "I would read the logs, reproduce the failure and then write a regression test",
      expectedTurn: 0,
    })
  ).json();
  assert.equal(replyCalls(), 2);
  assert.match(tasks[0], /never repeat or reword anything in alreadyAsked/);
  assert.match(tasks[0], /refer to a specific detail the candidate actually said/);
  assert.equal(answered.currentQuestion.question, fresh);
});

test("questions back to Maya get a reply and keep the same question; scoring happens before the report", async () => {
  const reg = await post("/auth/register", null, {
    name: "Tester",
    email: "talk@example.test",
    password: "long-test-password",
  });
  const cookie = reg.headers.get("set-cookie").split(";")[0];
  const session = await (
    await post(
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
    )
  ).json();
  mode = "conversation";
  for (let i = 0; i < 3; i++) {
    const talk = await (
      await post(`/interviews/${session.id}/answers`, cookie, {
        answer: "Sorry, what do you mean?",
        expectedTurn: 0,
      })
    ).json();
    assert.match(talk.reply, /Go ahead/);
    assert.equal(talk.turns.length, 0);
    assert.equal(
      talk.currentQuestion.question,
      session.currentQuestion.question,
    );
  }
  // A fourth utterance on the same question is treated as the answer.
  const moved = await (
    await post(`/interviews/${session.id}/answers`, cookie, {
      answer: "I would check the logs first.",
      expectedTurn: 0,
    })
  ).json();
  mode = "answer";
  assert.equal(moved.turns.length, 1);
  assert.equal(moved.turns[0].exchanges.length, 3);
  assert.equal(moved.exchanges.length, 0);
  assert.equal(moved.reply, undefined);
  const report = await (
    await post(`/interviews/${session.id}/report`, cookie, {})
  ).json();
  assert.equal(report.state, "complete");
  assert.equal(report.turns[0].evaluation.rationale, evaluation.rationale);
});

test("an almost empty answer skips the retry and moves to a fresh scenario straight away", async () => {
  const reg = await post("/auth/register", null, {
    name: "Tester",
    email: "thin@example.test",
    password: "long-test-password",
  });
  const cookie = reg.headers.get("set-cookie").split(";")[0];
  const session = await (
    await post(
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
    )
  ).json();
  // The stub keeps repeating the first question unless it is told the draft was a repeat.
  mode = "stuck";
  tasks.length = 0;
  const moved = await (
    await post(`/interviews/${session.id}/answers`, cookie, {
      answer: "no idea",
      expectedTurn: 0,
    })
  ).json();
  mode = "answer";
  assert.equal(replyCalls(), 1);
  assert.notEqual(
    moved.currentQuestion.question,
    session.currentQuestion.question,
  );
  assert.match(moved.currentQuestion.lead, /different angle/);
});
