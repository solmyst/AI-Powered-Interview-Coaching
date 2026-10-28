import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
      question: "Can you describe a specific academic project or coursework where you had to debug a challenging issue? What was the problem, which alternatives did you consider, and how did you approach solving it?",
      focus: "Communication",
      difficulty: "Foundational",
    },
    turns: [{
      question: { question: "Tell me about yourself.", focus: "Communication", difficulty: "Foundational" },
      answer: "I am a frontend engineering student.",
      evaluation: {
        scores: {}, rationale: "Fixture", strengths: [], improvements: [], missingConcepts: [], modelAnswer: "Fixture",
      },
    }],
    report: null,
    model: "fixture",
    provider: "fixture",
  };
  await page.addInitScript(() => {
    (window as unknown as { __fullscreenRequests: number }).__fullscreenRequests = 0;
    let activeFullscreen: Element | null = null;
    Object.defineProperty(Document.prototype, "fullscreenElement", {
      configurable: true,
      get: () => activeFullscreen,
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {
        (window as unknown as { __fullscreenRequests: number }).__fullscreenRequests++;
        activeFullscreen = document.documentElement;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    Object.defineProperty(Document.prototype, "exitFullscreen", {
      configurable: true,
      value: async () => {
        activeFullscreen = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
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
  await page.route(`**/api/interviews/${id}/clarify`, (route) => route.fulfill({ json: { question: "Tell me about a bug in your project and how you fixed it." } }));
  let reportRequests = 0;
  await page.route(`**/api/interviews/${id}/report`, async (route) => {
    reportRequests++;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (reportRequests === 1) return route.fulfill({ status: 503, json: { error: "The briefing service is temporarily unavailable." } });
    await route.fulfill({ json: { ...session, state: "complete", currentQuestion: null, report: { summary: "Fixture", overall: 65, answered: 1, scores: {}, strengths: [], improvements: [], studyPlan: [] } } });
  });
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
  await expect.poll(() => page.evaluate(
    () => (window as unknown as { __fullscreenRequests: number }).__fullscreenRequests,
  )).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /full screen/ })).toBeVisible();
  await expect(page.locator(".question-caption")).toHaveClass(/question-very-long/);
  await expect(page.getByText("VIDEO LIVE").or(page.getByText("LIVE · LOCAL ONLY"))).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.getByLabel("Your live camera preview").evaluate(
    (video: HTMLVideoElement) => ({ width: video.videoWidth, readyState: video.readyState }),
  )).toMatchObject({ width: 640, readyState: 4 });
  await page.screenshot({ path: "test-results/camera-live-fixture.png", fullPage: true });
  await page.getByRole("button", { name: "Pause interview", exact: true }).click();
  await expect(page.getByText("Paused · take your time", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  for (const [width, height] of [[320, 480], [320, 568], [320, 740], [390, 844], [768, 650], [1024, 600], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const tile = document.querySelector(".interviewer-tile")!.getBoundingClientRect();
      const question = document.querySelector(".question-caption")!.getBoundingClientRect();
      const controls = document.querySelector(".call-controls")!.getBoundingClientRect();
      return { tileTop: tile.top, tileBottom: tile.bottom, questionTop: question.top, questionBottom: question.bottom, controlsBottom: controls.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout.overflow, `${width}x${height}: horizontal overflow`).toBe(false);
    expect(layout.questionTop, `${width}x${height}: question clipped above tile`).toBeGreaterThanOrEqual(layout.tileTop);
    expect(layout.questionBottom, `${width}x${height}: question clipped below tile`).toBeLessThanOrEqual(layout.tileBottom);
    expect(layout.controlsBottom, `${width}x${height}: controls below viewport`).toBeLessThanOrEqual(height);
    await expect(page.getByRole("button", { name: "End interview" })).toBeInViewport();
    if (width === 390 || height === 390) await page.screenshot({ path: `test-results/call-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Turn camera off", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable camera coaching", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable camera coaching", exact: true }).click();
  await expect.poll(() => page.getByLabel("Your live camera preview").evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(640);
  await page.getByRole("button", { name: "Resume interview", exact: true }).click();
  await expect(page.getByText("Listening to you", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clarify question", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell me about a bug in your project and how you fixed it." })).toBeVisible();
  await expect(page.getByText("Question 2 of 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "End interview" })).toBeEnabled();
  await page.getByRole("button", { name: "End interview" }).click();
  await expect(page.getByRole("heading", { name: "Interview complete" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => page.getByLabel("Your live camera preview").evaluate(
    (video: HTMLVideoElement) => (video.srcObject as MediaStream)?.getTracks().every((track) => track.readyState === "ended"),
  )).toBe(true);
  await expect(page.getByText("preparing your briefing", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try preparing briefing again" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Try preparing briefing again" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Return to dashboard", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Try preparing briefing again" }).click();
  await expect(page.getByRole("heading", { name: "Practice with a purpose." })).toBeVisible();
  expect(reportRequests).toBe(2);
});
