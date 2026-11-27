import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assertControlLayout } from "../ui-layout";
import { readFileSync } from "node:fs";

async function account(page: Page, company = true) {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ready: true,
        provider: "fixture",
        model: "fixture",
        message: "Ready",
        transcription: { ready: true, provider: "fixture", model: "fixture" },
        speech: { ready: false, provider: "fixture", model: "fixture" },
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "workspace",
          name: "Workspace Test",
          email: "workspace@example.test",
        },
        usage: { used: 0, limit: 5, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route("**/api/orgs", (route) =>
    route.fulfill({
      json: {
        canCreate: true,
        requested: false,
        orgs: company
          ? [
              {
                id: "workspace-org",
                name: "Northwind",
                role: "owner",
                contactEmail: "hr@example.test",
                retentionDays: 180,
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/orgs/workspace-org/roles", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/orgs/workspace-org/activity", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/interviews", (route) =>
    route.fulfill({
      json: { sessions: [], usage: { used: 0, limit: 5, reset: "00:00 UTC" } },
    }),
  );
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
}
async function inspect(page: Page, name: string) {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertControlLayout(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${name}: overflow at ${width}`,
    ).toBe(true);
    if (width !== 768) {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze()
        ).violations,
        `${name}: accessibility at ${width}`,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/workspace-${name}-${width}.png`,
        fullPage: true,
      });
    }
  }
}
test("public home has distinct practice and hiring doors, including sign-in destinations", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Great interviews",
  );
  await inspect(page, "homepage");
  await page.getByRole("link", { name: "Hiring sign in" }).click();
  await expect(page).toHaveURL(/\/hiring\?auth=signin$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByText("FOR HIRING TEAMS", { exact: true }),
  ).toBeVisible();
  await inspect(page, "hiring-signin");
  await page.getByRole("button", { name: "Back to home" }).click();
  await page
    .getByRole("button", { name: "Start your first interview" })
    .click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByText("FOR HIRING TEAMS", { exact: true })).toHaveCount(
    0,
  );
  await inspect(page, "practice-signup");
});
test("practice remains practice even for company members, with separate history, library and profile", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page);
  let hiringRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/orgs") hiringRequests++;
  });
  await page.goto("/practice");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good to see you",
  );
  await expect(
    page.getByRole("button", { name: "Hiring", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Hiring navigation" }),
  ).toHaveCount(0);
  await inspect(page, "practice-dashboard");
  await page
    .getByRole("button", { name: "New interview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Begin interview" }),
  ).toBeVisible();
  await inspect(page, "practice-setup");
  for (const [button, title, image] of [
    ["My interviews", "Your interview history.", "history"],
    ["Revision library", "Your revision library.", "library"],
    ["Profile", "A space for your progress.", "practice-profile"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await inspect(page, image);
  }
  expect(hiringRequests).toBe(0);
});
test("hiring has its own overview, role form and company settings without practice data", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page);
  let practiceRequests = 0;
  page.on("request", (request) => {
    if (
      ["/api/interviews", "/api/bookmarks"].includes(
        new URL(request.url()).pathname,
      )
    )
      practiceRequests++;
  });
  await page.goto("/hiring");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice interviews" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Profile", exact: true }),
  ).toHaveCount(0);
  await inspect(page, "hiring-overview");
  await page
    .getByRole("navigation", { name: "Hiring navigation" })
    .getByRole("button", { name: "New role", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What are you hiring for?" }),
  ).toBeVisible();
  await inspect(page, "hiring-role-form");
  await page
    .getByRole("button", { name: "Add a question", exact: true })
    .click();
  await inspect(page, "hiring-question-form");
  await page
    .getByRole("navigation", { name: "Hiring navigation" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Company settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Practice access" }),
  ).toHaveCount(0);
  await inspect(page, "hiring-settings");
  expect(practiceRequests).toBe(0);
});

test("new company setup remains in the hiring shell", async ({ page }) => {
  test.setTimeout(60000);
  await account(page, false);
  await page.goto("/hiring");
  await expect(
    page.getByRole("heading", { name: "Set up your company." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await inspect(page, "company-setup");
});

test("populated history and revision notes keep long content and actions aligned", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page);
  const sample = JSON.parse(
    readFileSync("docs/live-smoke-result.json", "utf8"),
  ).session;
  const role = "Backend engineering and distributed systems";
  await page.route("**/api/interviews", (route) =>
    route.fulfill({
      json: {
        sessions: [
          {
            id: sample.id,
            role,
            track: "Technical",
            state: "complete",
            created: sample.created,
            score: 72,
            answered: 3,
            total: 3,
          },
        ],
        usage: { used: 1, limit: 5 },
      },
    }),
  );
  await page.route("**/api/bookmarks", (route) =>
    route.fulfill({
      json: [{ ...sample.turns[0], interviewId: sample.id, turn: 0 }],
    }),
  );
  await page.goto("/practice");
  await page
    .getByRole("button", { name: "My interviews", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Delete ${role} interview` }),
  ).toBeVisible();
  await inspect(page, "populated-history");
  await page.getByRole("button", { name: `Delete ${role} interview` }).click();
  await inspect(page, "history-delete-confirmation");
  await page
    .getByRole("button", { name: "Keep interview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revision library", exact: true })
    .click();
  await page.locator("details.panel > summary").click();
  await page.getByText("Reveal example answer", { exact: true }).click();
  await inspect(page, "populated-revision-library");
});

test("candidate notice, submitted and invalid-link pages remain isolated and accessible", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ready: true,
        transcription: { ready: true },
        speech: { ready: false },
      },
    }),
  );
  let stage = "notice";
  await page.route("**/api/candidate/session", (route) => {
    if (stage === "invalid")
      return route.fulfill({
        status: 401,
        json: {
          error: "This link has expired or was replaced on another device.",
        },
      });
    return route.fulfill({
      json: {
        company: "Northwind",
        roleTitle: "Backend engineer",
        questionCount: 3,
        minutes: 12,
        expires: Date.now() + 86400000,
        opensAt: 0,
        proctoring: "standard",
        status: stage === "submitted" ? "completed" : "pending",
        consentVersion: "v1",
        consented: false,
        retentionDays: 180,
        contactEmail: "hr@example.test",
        answered: stage === "submitted" ? 3 : 0,
        state: stage === "submitted" ? "complete" : null,
        feedback: null,
        noteSent: false,
      },
    });
  });
  for (const state of ["notice", "submitted", "invalid"]) {
    stage = state;
    await page.goto("/interviewace/join");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await inspect(page, `candidate-${state}`);
  }
});
