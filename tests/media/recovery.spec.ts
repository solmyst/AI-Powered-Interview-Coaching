import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function room(page: Page, cloud = false) {
  const sample = JSON.parse(readFileSync("docs/live-smoke-result.json", "utf8")).session;
  const session = { ...sample, state: "active", report: null, turns: sample.turns.slice(0, 1), currentQuestion: sample.turns[1].question };
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() {}, speak(utterance: SpeechSynthesisUtterance) { setTimeout(() => utterance.onend?.(new Event("end") as never), 30); },
    } });
  });
  await page.route("**/api/health", (route) => route.fulfill({ json: { ready: true, transcription: { ready: true }, speech: { ready: cloud } } }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: "recovery", name: "Recovery", email: "fixture@example.test" }, usage: { used: 1, limit: 5 } } }));
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) => route.fulfill({ json: { sessions: [{ id: session.id, role: sample.setup.role, track: sample.setup.track, state: "active", created: sample.created, answered: 1, total: 3, score: null }], usage: { used: 1, limit: 5 } } }));
  await page.route(`**/api/interviews/${session.id}`, (route) => route.fulfill({ json: session }));
  await page.goto("/");
  await page.getByRole("button", { name: `Open ${session.setup.role} interview` }).click();
}

test("denied device permission gives a retry and keeps joining disabled", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
  await room(page);
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await expect(page.getByRole("alert")).toContainText("permission was denied");
  await expect(page.getByRole("button", { name: "Retry camera & microphone" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Complete device check first" })).toBeDisabled();
});

test("unsupported recording pauses the interview rather than claiming the mic is live", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "MediaRecorder", { configurable: true, value: undefined }); });
  await room(page);
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await page.getByRole("button", { name: "Join interview" }).click();
  await expect(page.getByRole("alert")).toContainText("Voice recording is unavailable");
  await expect(page.getByLabel("Microphone is paused", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume interview" })).toBeVisible();
});

test("a stalled cloud voice falls back to browser speech and starts the mic", async ({ page }) => {
  await page.route("**/api/speech", () => {});
  await room(page, true);
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await page.getByRole("button", { name: "Join interview" }).click();
  await expect(page.getByText("Preparing interviewer audio", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Microphone is recording", { exact: true })).toBeVisible({ timeout: 18000 });
});

test("transcription failure pauses with an actionable retry", async ({ page }) => {
  await page.route("**/api/transcribe", (route) => route.fulfill({ status: 503, json: { error: "Speech service temporarily unavailable." } }));
  await room(page);
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await page.getByRole("button", { name: "Join interview" }).click();
  await expect(page.getByLabel("Microphone is recording", { exact: true })).toBeVisible();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Done speaking", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Speech service temporarily unavailable");
  await expect(page.getByLabel("Microphone is paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry this question", exact: true }).click();
  await expect(page.getByLabel("Microphone is recording", { exact: true })).toBeVisible();
});

test("disconnected devices pause the call and reconnect without leaving the interview", async ({ page }) => {
  await room(page);
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await page.getByRole("button", { name: "Join interview" }).click();
  await expect(page.getByLabel("Microphone is recording", { exact: true })).toBeVisible();
  await page.getByLabel("Your live camera preview").evaluate((video: HTMLVideoElement) => {
    const track = (video.srcObject as MediaStream).getAudioTracks()[0];
    (window as unknown as { __oldTrack: MediaStreamTrack }).__oldTrack = track;
    track.dispatchEvent(new Event("ended"));
  });
  await expect(page.getByRole("alert")).toContainText("A camera or microphone disconnected");
  await expect(page.getByLabel("Microphone is paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reconnect camera & microphone" }).click();
  await expect.poll(() => page.getByLabel("Your live camera preview").evaluate((video: HTMLVideoElement) => {
    const track = (video.srcObject as MediaStream | null)?.getAudioTracks()[0];
    return Boolean(track && track !== (window as unknown as { __oldTrack: MediaStreamTrack }).__oldTrack);
  })).toBe(true);
  await page.getByRole("button", { name: "Resume interview", exact: true }).click();
  await expect(page.getByLabel("Microphone is recording", { exact: true })).toBeVisible();
});
