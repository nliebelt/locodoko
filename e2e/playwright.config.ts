import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: [
    '**/vision-loop.spec.ts',
    '**/rundenauswertung.spec.ts',
    '**/mehrere-runden-ohne-neunen.spec.ts',
    '**/solo-spielfluss.spec.ts'
  ],
  timeout: 360_000,
  retries: 2,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['list']],
});
