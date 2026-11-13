import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo. Usan una base de datos aparte (data/pgdata-e2e) que se reinicia con los datos de ejemplo,
 * así no alteran la base de la demostración. Requiere haber ejecutado antes: npm run build
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } }],
  webServer: {
    command: "node scripts/setup.mjs --reset && npx next start -p 3100",
    url: "http://localhost:3100",
    env: { DATA_DIR: "data/pgdata-e2e" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
