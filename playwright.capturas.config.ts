import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * Genera las capturas de evidencia de las pantallas principales en ../entregables/evidencias/.
 * Uso: npm run build  y luego  npx playwright test -c playwright.capturas.config.ts
 */
export default defineConfig({
  ...base,
  testDir: "./capturas",
  testMatch: "**/*.spec.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 } }],
});
