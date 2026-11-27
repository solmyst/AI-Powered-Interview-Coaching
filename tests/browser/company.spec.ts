import { test, expect } from "@playwright/test";
import { reviewPageLayout } from "../ui-layout";

// The company console against fixture API responses: roles, ranked candidates, report, human decision.
const rubric = [
  {
    key: "problem_solving",
    label: "Problem solving",
    description: "Breaks problems down.",
    weight: 3,
  },
  {
    key: "communication",
    label: "Communication",
    description: "Explains clearly.",
    weight: 2,
  },
];
const ranked = [
  {
    id: "a",
    name: "Asha Rao",
    email: "asha@example.test",
    status: "completed",
    score: 71,
    competencyScores: { problem_solving: 75, communication: 66 },
    answered: 3,
    questionCount: 3,
    unreviewedFlags: 1,
    decision: null,
    expires: Date.now() + 1e9,
  },
  {
    id: "c",
    name: "Dev Patel",
    email: "dev@example.test",
    status: "completed",
    score: 30,
    competencyScores: { problem_solving: 30, communication: 30 },
    answered: 1,
    questionCount: 3,
    unreviewedFlags: 0,
    decision: null,
    expires: Date.now() + 1e9,
  },
  {
    id: "b",
    name: "Ravi Shah",
    email: "ravi@example.test",
    status: "started",
    score: null,
    competencyScores: null,
    answered: 1,
    questionCount: 3,
    unreviewedFlags: 0,
    decision: null,
    expires: Date.now() + 1e9,
  },
];
const report = {
  invite: {
    id: "a",
    name: "Asha Rao",
    email: "asha@example.test",
    status: "completed",
    decision: null,
    candidateNote: "My connection dropped once.",
    consent: { version: "v", acceptedAt: new Date().toISOString() },
  },
  role: { id: "r1", title: "Backend engineer", rubric, questionCount: 3 },
  screening: {
    state: "complete",
    currentQuestion: null,
    deliverySummary: {
      answers: 1,
      spokenAnswers: 1,
      typedAnswers: 0,
      words: 52,
      fillerTotal: 4,
      fillers: { um: 3, "you know": 1 },
      fillersPer100Words: 7.7,
      wpm: 128,
      cameraAnswers: 1,
      awayEpisodes: 3,
      awaySeconds: 9,
      lostEpisodes: 1,
      lostSeconds: 4,
      observedSeconds: 24,
    },
    report: {
      summary: "Structured answers with good instincts.",
      strengths: ["Idempotency"],
      concerns: ["Little caching experience"],
      suggestedFollowUps: ["Ask about cache invalidation."],
      competencyScores: { problem_solving: 75, communication: 66 },
      overall: 71,
    },
    turns: [
      {
        question: {
          question: "How do you avoid charging twice?",
          focus: "Judgment",
        },
        answer: "I would use an idempotency key stored with the request.",
        attention: { eyeContact: 71, inFrame: 96 },
        delivery: {
          spoken: true,
          words: 52,
          fillers: { um: 3, "you know": 1 },
          fillerTotal: 4,
          captureMs: 24000,
          wpm: 130,
          observedMs: 24000,
          awayEpisodes: 3,
          awayMs: 9000,
          lostEpisodes: 1,
          lostMs: 4000,
        },
        exchanges: [
          { said: "What do you mean?", reply: "I mean a retried payment." },
        ],
        evaluation: {
          scores: { problem_solving: 75, communication: 66 },
          evidence: [
            {
              competency: "problem_solving",
              quote: "use an idempotency key",
              supports: "strength",
            },
          ],
          rationale: "Sound approach.",
          followUpForHuman: "Ask about races.",
        },
        events: [],
      },
    ],
  },
  events: [
    {
      id: 1,
      at: new Date().toISOString(),
      turn: 0,
      kind: "tab_hidden",
      durationMs: 14000,
      reviewedAt: null,
      verdict: null,
      reviewNote: null,
    },
  ],
};

test("a reviewer sees a ranked list, evidence and flags, and records a human decision", async ({
  page,
}) => {
  test.setTimeout(90000);
  const calls: { path: string; body: unknown }[] = [];
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ready: true,
        provider: "f",
        model: "f",
        message: "",
        transcription: { ready: true, provider: "a", model: "f" },
        speech: { ready: false, provider: "s", model: "f", voiceId: "" },
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "u", name: "Priya", email: "owner@example.test" },
        usage: { used: 0, limit: null, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) =>
    route.fulfill({
      json: {
        sessions: [],
        usage: { used: 0, limit: null, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route("**/api/orgs", (route) =>
    route.fulfill({
      json: {
        canCreate: true,
        orgs: [
          {
            id: "o1",
            name: "Northwind",
            contactEmail: "hr@northwind.test",
            retentionDays: 180,
            role: "owner",
          },
        ],
      },
    }),
  );
  await page.route("**/api/orgs/o1/roles", (route) =>
    route.fulfill({
      json: [
        {
          id: "r1",
          title: "Backend engineer",
          status: "open",
          role: "Backend",
          track: "Technical",
          questionCount: 3,
          total: 2,
          pending: 0,
          started: 1,
          completed: 1,
        },
      ],
    }),
  );
  await page.route("**/api/roles/r1/candidates", (route) =>
    route.fulfill({
      json: {
        role: {
          id: "r1",
          title: "Backend engineer",
          status: "open",
          rubric,
          questionCount: 3,
        },
        candidates: ranked,
      },
    }),
  );
  await page.route("**/api/orgs/o1/activity", (route) =>
    route.fulfill({
      json: [
        {
          id: "x",
          roleId: "r1",
          roleTitle: "Backend engineer",
          name: "Anush",
          status: "started",
          at: Date.now() - 20 * 60000,
          leftAt: Date.now() - 20 * 60000,
          answered: 0,
          questionCount: 3,
          score: null,
        },
      ],
    }),
  );
  await page.route("**/api/roles/r1/open-link", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        link: "https://x.test/interviewace/join#r=abc",
        cap: 50,
        used: 3,
      },
    }),
  );
  await page.route("**/api/invites/a/report", (route) =>
    route.fulfill({ json: report }),
  );
  await page.route("**/api/invites/a/decision", (route) => {
    calls.push({ path: "decision", body: route.request().postDataJSON() });
    return route.fulfill({ json: {} });
  });
  await page.route("**/api/invites/a/integrity-review", (route) => {
    calls.push({ path: "review", body: route.request().postDataJSON() });
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/hiring");
  // Company members land in their own workspace: no practice navigation.
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  // Anyone who stepped away shows up in the activity feed instead of looking like they are still answering.
  await expect(page.getByText("left after 0 of 3 answers")).toBeVisible();
  await reviewPageLayout(page, "hiring-populated-overview");
  await expect(page.getByRole("button", { name: "My interviews" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Practice interviews" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Hiring navigation" })
    .getByRole("button", { name: /Backend engineer/ })
    .click();
  // One link for many candidates, and one private link per person.
  await expect(
    page.getByText("https://x.test/interviewace/join#r=abc"),
  ).toBeVisible();
  await expect(
    page.getByText("3 of 50 places used.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Invite candidates" }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: /In progress/ }).click();
  await expect(page.locator(".co-table tbody tr")).toHaveCount(1);
  await page.getByRole("tab", { name: /All/ }).click();

  await expect(
    page.getByText("Scores are AI estimates against your rubric", {
      exact: false,
    }),
  ).toBeVisible();
  const rows = page.locator(".co-table tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Asha Rao");
  await expect(rows.nth(0)).toContainText("71");
  await expect(rows.nth(0)).toContainText("1 to review");
  await expect(rows.nth(1)).toContainText("Ended early · 1 of 3 answered");
  await expect(rows.nth(2)).toContainText("1 of 3 answered");
  await expect(page.locator(".co-table")).not.toContainText("undefined%");
  await reviewPageLayout(page, "hiring-candidate-list");
  await page
    .getByRole("button", { name: "Invite candidates", exact: true })
    .first()
    .click();
  await reviewPageLayout(page, "hiring-invite-form");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await rows.nth(0).click();
  await expect(page.getByRole("heading", { name: "Asha Rao" })).toBeVisible();
  await expect(
    page.getByText("A person makes every decision", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Little caching experience")).toBeVisible();
  // One scorecard with the delivery signals beside the content score.
  const card = page.getByRole("region", { name: "Evaluation scorecard" });
  await expect(card).toContainText("Times looked away");
  await expect(card).toContainText("9 s total");
  await expect(card).toContainText("Filler words used");
  await expect(card).toContainText("“um” ×3");
  await expect(card).toContainText("not part of the estimate");
  await expect(page.getByText("My connection dropped once.")).toBeVisible();
  await expect(page.getByText("“use an idempotency key”")).toBeVisible();
  await expect(page.getByText("Left the tab · 14s")).toBeVisible();
  await reviewPageLayout(page, "hiring-candidate-report");

  await page
    .getByRole("button", { name: "No concern", exact: true })
    .first()
    .click();
  await page.getByLabel("Note for your team").fill("Strong on payments");
  await page.getByRole("button", { name: "Advance" }).click();
  expect(calls).toEqual([
    {
      path: "review",
      body: { eventIds: [1], verdict: "no_concern", note: "" },
    },
    {
      path: "decision",
      body: { status: "advance", note: "Strong on payments" },
    },
  ]);
});

test("people without company access can request it from Hiring", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ready: true,
        provider: "f",
        model: "f",
        message: "",
        transcription: { ready: true, provider: "a", model: "f" },
        speech: { ready: false, provider: "s", model: "f", voiceId: "" },
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "u", name: "Student", email: "s@example.test" },
        usage: { used: 0, limit: 5, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) =>
    route.fulfill({
      json: { sessions: [], usage: { used: 0, limit: 5, reset: "00:00 UTC" } },
    }),
  );
  await page.route("**/api/orgs", (route) =>
    route.fulfill({ json: { canCreate: false, requested: false, orgs: [] } }),
  );
  let asked: unknown = null;
  await page.route("**/api/orgs/request", (route) => {
    asked = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { requested: true } });
  });
  await page.goto("/hiring");
  await expect(
    page.getByRole("heading", { name: "Request access" }),
  ).toBeVisible();
  await page.getByLabel("Company name").fill("Acme");
  await reviewPageLayout(page, "hiring-request-access");
  await page.getByRole("button", { name: "Request access" }).click();
  await expect
    .poll(() => asked)
    .toEqual({ company: "Acme", teamSize: "", note: "" });
});

test("a shared link asks for a name and email, then opens the candidate's own notice", async ({
  page,
}) => {
  const link = "a".repeat(64);
  const mine = "b".repeat(64);
  let posted: unknown = null;
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ready: true,
        transcription: { ready: true },
        speech: { ready: false },
      },
    }),
  );
  await page.route(`**/api/candidate/open/${link}`, (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          company: "Park+",
          roleTitle: "Product AI Intern",
          questionCount: 5,
          full: false,
        },
      });
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { token: mine } });
  });
  let session: unknown = null;
  await page.route("**/api/candidate/session", (route) => {
    session = route.request().postDataJSON();
    return route.fulfill({
      json: {
        company: "Park+",
        roleTitle: "Product AI Intern",
        questionCount: 5,
        minutes: 20,
        expires: Date.now() + 1e9,
        opensAt: 0,
        proctoring: "standard",
        status: "pending",
        consentVersion: "v1",
        consented: false,
        retentionDays: 180,
        contactEmail: "",
        answered: 0,
        state: null,
        feedback: null,
        noteSent: false,
      },
    });
  });
  await page.goto(`/interviewace/join#r=${link}`);
  await expect(
    page.getByRole("heading", { name: "Product AI Intern" }),
  ).toBeVisible();
  await page.getByLabel("Your name").fill("Tess Tester");
  await page.getByLabel("Email address").fill("tess@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Before you start", { exact: false }),
  ).toBeVisible();
  expect(posted).toEqual({ name: "Tess Tester", email: "tess@example.test" });
  expect(session).toEqual({ token: mine });
  // The shared token never stays in the address bar.
  expect(page.url()).not.toContain(link);
});
