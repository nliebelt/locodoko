import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/vision-loop.spec.ts', '**/vision-loop-szenen.spec.ts'],
  timeout: 360_000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-portrait',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }, // Force a portrait aspect ratio for mobile
      },
    },
  ],
  reporter: [['list']],
});
