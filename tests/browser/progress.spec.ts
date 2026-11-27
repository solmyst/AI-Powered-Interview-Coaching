import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("practice chart preserves exact scores, report controls, responsive layout and reduced motion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ready: true,
        provider: "fixture",
        model: "fixture",
        message: "Ready",
        transcription: { ready: true },
        speech: { ready: false },
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "chart", name: "Chart Test", email: "chart@example.test" },
        usage: { used: 3, limit: 5, reset: "00:00 UTC" },
      },
    }),
  );
  await page.route("**/api/orgs", (route) =>
    route.fulfill({ json: { canCreate: false, requested: false, orgs: [] } }),
  );
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) =>
    route.fulfill({
      json: {
        sessions: [80, 65, 50].map((score, index) => ({
          id: `chart-${index}`,
          role: "Backend",
          track: "Technical",
          created: new Date(Date.UTC(2026, 10, 27 - index)).toISOString(),
          state: "complete",
          answered: 3,
          total: 3,
          score,
        })),
        usage: { used: 3, limit: 5, reset: "00:00 UTC" },
      },
    }),
  );
  await page.goto("/practice");
  await expect(
    page.getByRole("heading", { name: "Your practice timeline" }),
  ).toBeVisible();
  await expect(page.locator(".progress-chart svg")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Session 1, score 50, Backend" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Session 3, score 80, Backend" }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".progress-chart svg")).toBeVisible();
  }
  expect(
    await page
      .locator(".shine-border")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/ui-stack-dashboard.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
