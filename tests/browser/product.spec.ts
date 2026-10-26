import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/auth/session");
  const data = await response.json();
  if (data.user?.email?.startsWith("e2e-"))
    await page.request.delete("/api/me", {
      headers: { Origin: "http://localhost:5173" },
    });
});
test("landing is accessible and responsive at mobile, tablet and desktop widths", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Great interviews",
  );
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Start your first interview" }),
    ).toBeVisible();
  }
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("account onboarding, dashboard, setup, history, library and profile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start your first interview" })
    .click();
  await page.getByLabel("Your name").fill("Browser Test");
  await page.getByLabel("Email address").fill(`e2e-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("automated-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good to see you",
  );
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "New interview", exact: true })
    .click();
  await page.getByRole("combobox").nth(0).selectOption("Backend");
  await page
    .getByLabel("Resume or project highlights")
    .fill("Built a Node.js API.");
  await expect(
    page.getByRole("button", { name: "Begin interview" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "My interviews", exact: true })
    .click();
  await expect(
    page.getByText("Your story starts with one session."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revision library", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "revision library",
  );
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Updated Tester");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Updated",
  );
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete my account" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Great interviews",
  );
  expect(errors).toEqual([]);
});

test("report and interview room layouts, including unsupported voice fallback (test fixtures)", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  const sample = JSON.parse(
    readFileSync("docs/live-smoke-result.json", "utf8"),
  ).session;
  let room = false;
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "test-fixture",
          name: "Fixture Candidate",
          email: "fixture@example.test",
        },
        usage: { used: 1, limit: 5, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) =>
    route.fulfill({
      json: {
        sessions: [
          {
            id: sample.id,
            created: sample.created,
            state: "complete",
            role: sample.setup.role,
            track: sample.setup.track,
            answered: 3,
            total: 3,
            score: sample.report.overall,
          },
        ],
        usage: { used: 1, limit: 5, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route(`**/api/interviews/${sample.id}`, (route) =>
    route.fulfill({
      json: room
        ? {
            ...sample,
            state: "active",
            report: null,
            currentQuestion: sample.turns[0].question,
            turns: [],
          }
        : sample,
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: `Open ${sample.setup.role} interview` })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Practice with a purpose",
  );
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/report-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  room = true;
  await page
    .getByRole("button", { name: `Open ${sample.setup.role} interview` })
    .click();
  await expect(
    page.getByText("Dictation isn’t supported here.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dictate answer" }),
  ).toBeDisabled();
  await page
    .locator("#answer")
    .fill("A text answer remains available without a microphone.");
  await expect(
    page.getByRole("button", { name: "Submit answer", exact: true }),
  ).toBeEnabled();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/room-desktop.png",
    fullPage: true,
  });
});
