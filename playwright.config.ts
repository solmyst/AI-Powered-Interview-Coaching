import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  workers: 1,
  use: { baseURL: "http://localhost:5173", headless: true },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_PATH: "./data/e2e.db" },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
