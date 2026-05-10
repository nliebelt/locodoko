import { defineConfig, devices } from './node_modules/@playwright/test';
export default defineConfig({
  testDir: '/home/agent/workspace/e2e/tests',
  testMatch: ['**/vision-loop.spec.ts'],
  timeout: 300_000,
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list']],
});
