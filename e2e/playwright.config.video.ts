import { defineConfig, devices } from '@playwright/test';

// Video-basierter Vision-Loop: nimmt einen kompletten Spielablauf als .webm auf,
// damit flüchtige Animationen/Tweens/Flash-Texte hinterher Bild für Bild geprüft werden
// können (siehe extrahiere-video-frames.mjs + specs/frontend-vision-loop-video.md).
//
// Unterschied zur Screenshot-Config (playwright.config.vision.ts): KEIN Turbo, KEINE
// diskreten Screenshots — der Test spielt in Echtzeit, Playwright zeichnet durchgehend auf.
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/vision-video.spec.ts'],
  timeout: 600_000,
  retries: 0,
  outputDir: './test-results/video',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    headless: true,
    screenshot: 'off',
    trace: 'off',
    // Durchgehende Video-Aufnahme. 'on' = immer behalten (auch bei grünem Test),
    // da das Video das eigentliche Artefakt ist, nicht nur Fehler-Diagnose.
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  reporter: [['list']],
});
