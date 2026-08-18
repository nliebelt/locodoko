import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/schnellstart.spec.ts', '**/partie-gegen-ki.spec.ts'],
  timeout: 180_000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'https://zock.locodoko.de',
    headless: true,
    screenshot: 'only-on-failure',
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
