import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 360_000,
  retries: 2,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    headless: true,
    // Screenshot/Video/Trace deaktiviert: reduziert CDP-Overhead in Headless-Umgebungen.
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
    // Firefox statt Chromium: Chromium headless_shell haengt bei langen
    // Phaser-Canvas2D-Spielen (requestAnimationFrame wird unzuverlaessig
    // aufgerufen). Firefox Headless rendert Canvas2D stabil.
    ...devices['Desktop Firefox'],
  },
  reporter: [['list']],
});
