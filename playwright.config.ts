import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end flows against a production build (npm run build first, or let
 * the webServer below build it). External APIs (Open-Meteo, Copernicus,
 * CelesTrak, Telegram) are NOT mocked: tests assert the honest UI either way.
 */
const PORT = 3200;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
      ADMIN_PASSCODE: "e2e-officer-passcode",
      CRON_SECRET: "e2e-cron-secret",
      // Link codes are created locally; no call reaches Telegram in these tests.
      TELEGRAM_BOT_TOKEN: "e2e-not-a-real-token",
      TELEGRAM_WEBHOOK_SECRET: "e2e-webhook-secret",
      NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "neerakshi_e2e_bot",
    },
  },
});
