import { test, expect, type Page } from "@playwright/test";

const health = { ready: true, provider: "fixture", model: "fixture", message: "Ready", transcription: { ready: true, provider: "assemblyai", model: "fixture" }, speech: { ready: false, provider: "elevenlabs", model: "fixture" } };
async function workspace(page: Page) {
  await page.route("**/api/health", (route) => route.fulfill({ json: health }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: "recovery", name: "Browser Test", email: "fixture@example.test" }, usage: { used: 1, limit: 5 } } }));
  await page.route("**/api/bookmarks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interviews", (route) => route.fulfill({ json: { sessions: [{ id: "expired", role: "Backend", track: "Technical", state: "active", created: new Date().toISOString(), answered: 1, total: 3, score: null }], usage: { used: 1, limit: 5 } } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good to see you");
}

test("expired sessions return to sign-in; incorrect credentials remain actionable", async ({ page }) => {
  await workspace(page);
  await page.route("**/api/interviews/expired", (route) => route.fulfill({ status: 401, json: { error: "Please sign in" } }));
  await page.getByRole("button", { name: "Open Backend interview" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("session has expired");
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 401, json: { error: "Email or password is incorrect." } }));
  await page.getByLabel("Email address").fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

test("setup locks settings while submitting and restores them after provider failure", async ({ page }) => {
  await workspace(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/interviews", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await pending;
    return route.fulfill({ status: 503, json: { error: "The interview engine is busy. Please retry shortly." } });
  });
  await page.getByRole("button", { name: "New interview", exact: true }).click();
  await page.getByLabel("Resume or project highlights").fill("Built a reliable API.");
  await page.getByRole("button", { name: "Begin interview", exact: true }).click();
  await expect(page.getByLabel("Target role")).toBeDisabled();
  await expect(page.getByLabel("Resume or project highlights")).toBeDisabled();
  await expect(page.getByLabel("Number of questions")).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("engine is busy");
  await expect(page.getByLabel("Target role")).toBeEnabled();
  await expect(page.getByLabel("Resume or project highlights")).toHaveValue("Built a reliable API.");
  await expect(page.getByRole("button", { name: "Begin interview", exact: true })).toBeEnabled();
});

test("unreadable server responses show recovery instead of opening a broken interview", async ({ page }) => {
  await workspace(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/interviews/expired", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html>Proxy response</html>" }));
  await page.getByRole("button", { name: "Open Backend interview" }).click();
  await expect(page.getByRole("alert")).toContainText("unreadable response");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good to see you");
  expect(errors).toEqual([]);
});

test("privacy settings that block localStorage do not break startup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }); });
  await workspace(page);
  expect(errors).toEqual([]);
});
