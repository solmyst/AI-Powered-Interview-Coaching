import { test, expect } from "@playwright/test";

test("camera renders real frames before and after joining the interview", async ({ page }) => {
  const id = "camera-acceptance";
  const session = {
    id,
    created: new Date().toISOString(),
    state: "active",
    setup: {
      role: "Frontend",
      experience: "Student / graduate",
      track: "Behavioral",
      difficulty: "Foundational",
      industry: "Technology",
      company: "",
      resume: "",
      jobDescription: "",
      questionCount: 3,
    },
    currentQuestion: {
      question: "Tell me about a project you are proud of.",
      focus: "Communication",
      difficulty: "Foundational",
    },
    turns: [],
    report: null,
    model: "fixture",
    provider: "fixture",
  };
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          setTimeout(() => utterance.onend?.(new Event("end") as never), 250);
        },
      },
    });
  });
  await page.route("**/api/health", (route) => route.fulfill({
    json: {
      ready: true,
      provider: "fixture",
      model: "fixture",
      message: "Ready",
      transcription: { ready: true, provider: "assemblyai", model: "universal-3-5-pro" },
      speech: { ready: false, provider: "elevenlabs", model: "eleven_v4_turbo", voiceId: "" },
    },
  }));
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: {
      user: { id: "camera-user", name: "Camera Test", email: "camera@example.test" },
      usage: { used: 1, limit: 5, reset: "00:00 UTC" },
    },
  }));
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) => route.fulfill({
    json: {
      sessions: [{
        id,
        created: session.created,
        state: "active",
        role: session.setup.role,
        track: session.setup.track,
        answered: 0,
        total: 3,
        score: null,
      }],
      usage: { used: 1, limit: 5, reset: "00:00 UTC" },
    },
  }));
  await page.route(`**/api/interviews/${id}`, (route) => route.fulfill({ json: session }));
  await page.route("**/api/transcribe", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ text: "I built an accessible interface.", confidence: 0.98, durationMs: 6200 }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Open Frontend interview" }).click();
  await page.getByRole("button", { name: "Allow camera & microphone" }).click();
  await expect(page.getByText("Camera and microphone ready")).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.getByLabel("Camera preview").evaluate(
    (video: HTMLVideoElement) => ({ width: video.videoWidth, readyState: video.readyState }),
  )).toMatchObject({ width: 640, readyState: 4 });
  await page.screenshot({ path: "test-results/camera-preflight-fixture.png", fullPage: true });

  await page.getByRole("button", { name: "Join interview" }).click();
  await expect(page.getByText("VIDEO LIVE").or(page.getByText("LIVE · LOCAL ONLY"))).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.getByLabel("Your live camera preview").evaluate(
    (video: HTMLVideoElement) => ({ width: video.videoWidth, readyState: video.readyState }),
  )).toMatchObject({ width: 640, readyState: 4 });
  await page.screenshot({ path: "test-results/camera-live-fixture.png", fullPage: true });
});
