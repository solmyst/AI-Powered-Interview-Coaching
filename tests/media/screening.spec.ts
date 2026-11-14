import { test, expect, type Page } from "@playwright/test";

// A candidate opens an invite link: notice, consent, device check, a typed answer, then a visible focus note.
const summary = (over = {}) => ({
  company: "Northwind", roleTitle: "Backend engineer", questionCount: 3, minutes: 12, expires: Date.now() + 5 * 86400000,
  status: "pending", consentVersion: "v1", consented: false, retentionDays: 180, contactEmail: "hr@northwind.test",
  answered: 0, state: null, feedback: null, noteSent: false, ...over,
});
const question = { lead: "Hi, I'm Maya.", question: "Imagine a payment is retried. How do you avoid charging twice?", focus: "Judgment", difficulty: "Intermediate" };
const view = (turns: { question: typeof question; answer: string }[] = []) => ({
  id: "s1", state: "active", created: new Date().toISOString(),
  setup: { role: "Backend", track: "Technical", questionCount: 3, company: "Northwind" },
  currentQuestion: question, turns, clarifications: {},
});

async function candidate(page: Page, seen: { answers: unknown[]; events: unknown[]; tokenInUrl: string[] }) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() {}, speak(utterance: SpeechSynthesisUtterance) { setTimeout(() => utterance.onend?.(new Event("end") as never), 30); },
    } });
  });
  await page.route("**/api/health", (route) => route.fulfill({ json: { ready: true, transcription: { ready: true }, speech: { ready: false } } }));
  await page.route("**/api/candidate/session", (route) => {
    seen.tokenInUrl.push(page.url());
    return route.fulfill({ json: summary() });
  });
  await page.route("**/api/candidate/consent", (route) => route.fulfill({ json: summary({ consented: true }) }));
  await page.route("**/api/candidate/interview", (route) => route.fulfill({ json: view() }));
  await page.route("**/api/candidate/interview/answers", (route) => {
    seen.answers.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: "Stop here for the test." } });
  });
  await page.route("**/api/candidate/integrity-events", (route) => {
    seen.events.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
}

test("candidate consents, sees company wording, types an answer without delivery metrics, and focus notes are reported", async ({ page }) => {
  const seen = { answers: [] as unknown[], events: [] as unknown[], tokenInUrl: [] as string[] };
  await candidate(page, seen);
  await page.goto("/interviewace/join#t=" + "a".repeat(64));
  await expect(page.getByRole("heading", { name: "Before you start: Backend engineer" })).toBeVisible();
  // The token never stays in the address bar.
  expect(page.url()).not.toContain("a".repeat(64));
  await expect(page.getByText("A person at Northwind reads your transcript and makes every decision.")).toBeVisible();
  const accept = page.getByRole("button", { name: "Accept and continue" });
  await expect(accept).toBeDisabled();
  await page.getByLabel(/I understand an AI conducts/).check();
  await expect(accept).toBeDisabled();
  await page.getByLabel(/I agree to the processing/).check();
  await accept.click();

  await expect(page.getByText("NORTHWIND · BACKEND")).toBeVisible();
  await expect(page.getByText("What Northwind sees")).toBeVisible();
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await page.getByRole("button", { name: "Join interview" }).click();
  await expect(page.getByRole("button", { name: /Focus notes on/ })).toBeVisible();

  await page.getByRole("button", { name: "Type your answer instead" }).click();
  const box = page.getByLabel("Type your answer");
  await box.fill("I would use an idempotency key.");
  // A large paste is noted for the reviewer, and the candidate is told.
  await box.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text", "x".repeat(80));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
  });
  await expect(page.getByRole("status").filter({ hasText: "large paste" })).toBeVisible();
  await expect.poll(() => seen.events).toEqual([{ events: [{ kind: "paste", turn: 0 }] }]);
  await page.getByRole("button", { name: "Send answer" }).click();
  await expect.poll(() => seen.answers.length).toBeGreaterThan(0);
  // Delivery metrics (gaze, framing, filler words) are never sent for screening.
  expect(seen.answers[0]).toEqual({ answer: "I would use an idempotency key.", expectedTurn: 0 });
});

test("an expired or replaced link explains itself instead of asking to sign in", async ({ page }) => {
  await page.route("**/api/health", (route) => route.fulfill({ json: { ready: true, transcription: { ready: true }, speech: { ready: false } } }));
  await page.route("**/api/candidate/session", (route) => route.fulfill({ status: 401, json: { error: "This link has expired or was replaced on another device." } }));
  await page.goto("/interviewace/join");
  await expect(page.getByRole("heading", { name: "This link can’t be used" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("replaced on another device");
  await expect(page.getByText("Sign in")).toHaveCount(0);
});
