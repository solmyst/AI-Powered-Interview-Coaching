import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./tests/media",
  timeout: 300000,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-video-capture=${resolve("tests/fixtures/camera.y4m")}`,
        `--use-file-for-fake-audio-capture=${resolve("tests/fixtures/jfk.wav")}`,
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
