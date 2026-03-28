import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
    timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Festes Viewport auf Spiel-Dimensionen — Phaser FIT-Modus skaliert den Canvas exakt 1:1
    viewport: { width: 1280, height: 720 },
  },
  reporter: [['html', { open: 'never' }]],
});
