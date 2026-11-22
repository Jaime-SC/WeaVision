import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:4173" },
  webServer: { command: "npx vite build && npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: false },
  projects: [
    { name: "tv", use: { viewport: { width: 960, height: 540 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
