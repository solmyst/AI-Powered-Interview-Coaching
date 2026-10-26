import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["@huggingface/transformers", "@mediapipe/tasks-vision"],
  },
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:3001" } },
});
