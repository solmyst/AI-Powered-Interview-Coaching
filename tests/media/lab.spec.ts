import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

test("Answer Lab captures spoken retry and transfer, restores progress and stays accessible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const session = JSON.parse(readFileSync("docs/live-smoke-result.json", "utf8")).session;
  const baseline = { status: "partial", evidence: "Redis", reason: "Names the cache without discussing every failure." };
  const plan = {
    focus: "Explain what happens when the cache fails",
    coaching: "Name the source of truth, a fallback, and one trade-off.",
    checkpoints: ["Name the source of truth", "Explain a safe fallback", "Describe one trade-off"].map((criterion) => ({ criterion, baseline })),
    transferQuestion: "What changes if your second region loses its database connection?",
  };
  session.rehearsals = {};
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() {}, speak(utterance: SpeechSynthesisUtterance) { setTimeout(() => utterance.onend?.(new Event("end") as never), 50); },
    } });
  });
  await page.route("**/api/health", (route) => route.fulfill({ json: { ready: true, transcription: { ready: true }, speech: { ready: false } } }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: "lab-fixture", name: "Practice", email: "fixture@example.test" }, usage: { used: 1, limit: 5 } } }));
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) => route.fulfill({ json: { sessions: [{ id: session.id, state: "complete", role: session.setup.role, track: session.setup.track, answered: 3, total: 3, score: 65, created: session.created }], usage: { used: 1, limit: 5 } } }));
  await page.route(`**/api/interviews/${session.id}`, (route) => route.fulfill({ json: session }));
  await page.route(`**/api/interviews/${session.id}/rehearsal/*`, (route) => {
    const turn = new URL(route.request().url()).pathname.split("/").at(-1)!;
    session.rehearsals[turn] ||= { plan, attempts: [] };
    return route.fulfill({ json: session });
  });
  let captured = 0;
  await page.route("**/api/transcribe", (route) => {
    captured++;
    return route.fulfill({ json: { text: "PostgreSQL stays the source of truth. I bypass Redis if it fails, at the cost of more database load.", confidence: 0.97, durationMs: 2000 } });
  });
  await page.route(`**/api/interviews/${session.id}/rehearsal/*/answers`, (route) => {
    const turn = new URL(route.request().url()).pathname.split("/").at(-2)!;
    const lab = session.rehearsals[turn];
    const { answer } = route.request().postDataJSON();
    lab.attempts.push({ stage: lab.attempts.length ? "transfer" : "retry", question: "Cache failure", answer, result: {
      summary: "You explained a concrete fallback and its load trade-off.", nextStep: "Test a delayed invalidation event.",
      checks: plan.checkpoints.map(() => ({ status: "demonstrated", evidence: "source of truth", reason: "Explicitly explains the trade-off." })),
    } });
    return route.fulfill({ json: session });
  });
  await page.goto("/");
  await page.getByRole("button", { name: `Open ${session.setup.role} interview` }).click();
  await page.getByRole("button", { name: "Coach this answer" }).click();
  await expect(page.getByText(plan.focus, { exact: true })).toBeVisible();
  for (const button of ["Retry aloud", "Try a new scenario"]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("button", { name: "Done speaking", exact: true })).toBeVisible();
    await page.waitForTimeout(1600); // Capture actual fake-device audio before stopping.
    await page.getByRole("button", { name: "Done speaking", exact: true }).click();
    await expect(page.getByText("You explained a concrete fallback", { exact: false })).toHaveCount(button === "Retry aloud" ? 1 : 2);
  }
  expect(captured).toBe(2);
  await expect(page.getByText("You’ve practiced the change.")).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.locator(".answer-lab").screenshot({ path: "test-results/answer-lab.png" });
  await page.reload();
  await page.getByRole("button", { name: `Open ${session.setup.role} interview` }).click();
  await expect(page.getByText("You’ve practiced the change.")).toBeVisible();
  expect(errors).toEqual([]);
});
