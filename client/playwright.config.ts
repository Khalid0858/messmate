import { defineConfig } from "@playwright/test";
import path from "node:path";
const node = '"' + process.execPath + '"';
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5310",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: process.env.PW_EXTERNAL_SERVER
    ? undefined
    : [
        {
          command:
            node + " --experimental-transform-types src/local-preview.ts",
          cwd: path.resolve(import.meta.dirname, "../server"),
          url: "http://127.0.0.1:4310/api/health",
          timeout: 180000,
          env: {
            PREVIEW_PORT: "4310",
            PREVIEW_ORIGIN: "http://localhost:5310",
            NODE_ENV: "test",
          },
        },
        {
          command:
            node +
            " node_modules/vite/bin/vite.js --port 5310 --strictPort --host 127.0.0.1",
          url: "http://localhost:5310",
          timeout: 60000,
          env: { PREVIEW_API: "http://127.0.0.1:4310" },
        },
      ],
});
