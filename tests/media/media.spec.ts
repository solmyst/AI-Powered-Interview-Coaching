import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("real MediaPipe and local Whisper pipelines using prerecorded camera/audio fixtures", async ({
  page,
}) => {
  const origin = "http://localhost:5173";
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
    await page.getByRole("button", { name: "Enable camera coaching" }).click();
    await expect(page.locator(".camera-state")).toContainText(
      "Tracking your face",
      { timeout: 90000 },
    );
    await expect(page.locator(".camera-signals")).toContainText("from level");
    await page.screenshot({
      path: "test-results/camera-live-fixture.png",
      fullPage: true,
    });
    await page.getByLabel("Enable optional dictation").check();
    await page.getByLabel("Speech engine").selectOption("whisper");
    await page.getByRole("button", { name: "Load local Whisper" }).click();
    await expect(
      page.getByRole("button", { name: "Record answer with Whisper" }),
    ).toBeVisible({ timeout: 120000 });
    await page
      .getByRole("button", { name: "Record answer with Whisper" })
      .click();
    await expect(
      page.getByRole("button", { name: "Stop & transcribe" }),
    ).toBeVisible();
    // Intentionally capture a known prerecorded microphone signal; no human is recorded.
    await page.waitForTimeout(10000);
    await page.getByRole("button", { name: "Stop & transcribe" }).click();
    await expect(page.locator("#answer")).not.toHaveValue("", {
      timeout: 120000,
    });
    const transcript = await page.locator("#answer").inputValue();
    console.log("Actual local Whisper transcript:", transcript);
    expect(transcript.toLowerCase()).toMatch(/country|americans|ask|fellow/);
    await page.getByRole("button", { name: "Turn camera off" }).click();
    await expect(page.getByText("CAMERA OFF", { exact: true })).toBeVisible();
    await page.getByLabel("Confidence check-in").selectOption("3");
    await page
      .getByRole("button", { name: "Submit answer", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Finish early/ }),
    ).toBeVisible({ timeout: 150000 });
    const s = await (
      await page.request.get(`/api/interviews/${(await created.json()).id}`)
    ).json();
    expect(s.turns[0].delivery.visual.faceSamples).toBeGreaterThan(20);
    expect(s.turns[0].delivery.speech.source).toBe("whisper");
    expect(s.turns[0].delivery.speech.captureMs).toBeGreaterThan(5000);
    expect(s.turns[0].delivery.selfConfidence).toBe(3);
    await page.getByRole("button", { name: /Finish early/ }).click();
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
