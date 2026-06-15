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
      // Mobile wird bewusst nur im Querformat unterstützt (Orientierungssperre, siehe
      // DISCO-Entscheidung S126): ein 4-Spieler-Stichspiel mit Kartenreihe braucht Breite.
      // Daher Landscape-Viewport — im Hochformat würde nur das Dreh-Overlay fotografiert.
      name: 'mobile-landscape',
      use: {
        ...devices['Pixel 5 landscape'],
        viewport: { width: 851, height: 393 },
      },
    },
  ],
  reporter: [['list']],
});
