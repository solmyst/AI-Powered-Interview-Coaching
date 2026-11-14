import { test, expect } from "@playwright/test";

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

  await page.goto("/");
  await page.getByRole("button", { name: "Hiring" }).click();
  await expect(
    page.getByRole("heading", { name: "Your open roles." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Backend engineer/ }).click();

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

  await rows.nth(0).click();
  await expect(page.getByRole("heading", { name: "Asha Rao" })).toBeVisible();
  await expect(
    page.getByText("A person makes every decision", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Little caching experience")).toBeVisible();
  await expect(page.getByText("My connection dropped once.")).toBeVisible();
  await expect(page.getByText("“use an idempotency key”")).toBeVisible();
  await expect(page.getByText("Left the tab · 14s")).toBeVisible();

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

test("people without company access do not see Hiring", async ({ page }) => {
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
    route.fulfill({ json: { canCreate: false, orgs: [] } }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good to see you",
  );
  await expect(page.getByRole("button", { name: "Hiring" })).toHaveCount(0);
});
