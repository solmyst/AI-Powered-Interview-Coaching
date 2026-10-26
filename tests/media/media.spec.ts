import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("real MediaPipe and local Whisper pipelines using prerecorded camera/audio fixtures", async ({
  page,
}) => {
  const origin = "http://localhost:5173";
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
  await page.request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      name: "Media acceptance test",
      email: `media-${Date.now()}@example.test`,
      password: randomUUID(),
    },
  });
  try {
    const created = await page.request.post("/api/interviews", {
      headers: { Origin: origin, "Idempotency-Key": randomUUID() },
      data: {
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
      timeout: 150000,
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    await page.goto("/");
    await page.getByRole("button", { name: "Open Frontend interview" }).click();
    await page.getByRole("button", { name: "Allow camera & microphone" }).click();
    await expect(page.getByText("Camera and microphone ready")).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel("Camera preview")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join interview" })).toBeEnabled({ timeout: 120000 });
    await page.getByRole("button", { name: "Join interview" }).click();
    await expect(page.getByText("LIVE · LOCAL ONLY")).toBeVisible({ timeout: 90000 });
    await expect(page.getByText("Listening to you")).toBeVisible({ timeout: 30000 });
    await page.screenshot({
      path: "test-results/camera-live-fixture.png",
      fullPage: true,
    });
    await expect.poll(async () => {
      const value = await (await page.request.get(`/api/interviews/${(await created.json()).id}`)).json();
      return value.turns.length;
    }, { timeout: 180000 }).toBeGreaterThan(0);
    const s = await (
      await page.request.get(`/api/interviews/${(await created.json()).id}`)
    ).json();
    console.log("Actual local Whisper transcript:", s.turns[0].answer);
    expect(s.turns[0].answer.toLowerCase()).toMatch(/country|americans|ask|fellow/);
    expect(s.turns[0].delivery.visual.faceSamples).toBeGreaterThan(20);
    expect(s.turns[0].delivery.speech.source).toBe("whisper");
    expect(s.turns[0].delivery.speech.captureMs).toBeGreaterThan(5000);
    await page.getByRole("button", { name: "End interview" }).click();
    await expect(
      page.getByRole("heading", { name: "How you delivered your answers" }),
    ).toBeVisible({ timeout: 150000 });
    await expect(
      page.getByText("No reliable camera summary", { exact: false }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "test-results/media-report-fixture.png",
      fullPage: true,
    });
  } finally {
    await page.request.delete("/api/me", { headers: { Origin: origin } });
  }
});
