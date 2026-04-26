import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/vision-loop.spec.ts'],
  timeout: 360_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    headless: false,
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
