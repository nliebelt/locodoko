import { test } from '@playwright/test';
import {
  alsGastStarten,
  getBridge,
  warteAufSzene,
  aktiviereConsoleCapture,
  screenshot,
  erstelleKonfiguriertenTisch,
} from './helpers';

/**
 * Vision Loop — Szenen S-00 bis S-14 (Nicht-Spiel-Szenen).
 * Laufzeit-Ziel: < 30 s pro Projekt.
 * S-04 (Tischliste gefüllt) und S-05 (Session-Recovery) erfordern 2 Browser-Kontexte
 * und bleiben 🔲 bis zu einem separaten Folge-Task.
 */
test.describe('Vision Loop — Szenen S-00 bis S-14', () => {
  test('Nicht-Spiel-Szenen screenshotten', async ({ page, browser }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    const prefix = testInfo.project.name;

    // S-00: Login-Screen (vor alsGastStarten — App startet immer im Login)
    await page.goto('/');
    await getBridge(page);
    await warteAufSzene(page, 'LoginSzene');
    await page.waitForTimeout(500);
    await screenshot(page, '00-login-screen', prefix);

    // Als Gast einloggen → Lobby
    await alsGastStarten(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(1000);

    // S-01: Lobby Basis
    await screenshot(page, '01-lobby', prefix);

    // S-03: Tisch-Erstellen-Modal
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-neuer-tisch'));
    await page.waitForTimeout(800);
    await screenshot(page, '12-neuer-tisch-modal', prefix);
    // Tisch-Modal ist seit dem Redesign ein DOM-Overlay → über den DOM-Button schliessen,
    // nicht via Phaser-Helper (drueckeSzenenButton findet DOM-Buttons nicht → Dialog bliebe offen).
    // Programmatischer .click() statt locator-Klick, damit der Close-Handler auch dann feuert,
    // wenn ein anderes Overlay (z. B. Querformat-Hinweis auf Mobile) Pointer-Events abfängt.
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#tisch-abbrechen')?.click());
    await page.waitForTimeout(300);

    // S-06: HilfeSzene — Tab Trumpfhierarchie (Standard-Tab beim Öffnen)
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-spielregeln'));
    await warteAufSzene(page, 'HilfeSzene');
    await page.waitForTimeout(500);
    await screenshot(page, '20-hilfe-trumpf', prefix);

    // S-07: HilfeSzene — Tab Ansagen
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-tab-ansagen'));
    await page.waitForTimeout(400);
    await screenshot(page, '20b-hilfe-ansagen', prefix);

    // S-08: HilfeSzene — Tab Sonderspiele
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-tab-sonderspiele'));
    await page.waitForTimeout(400);
    await screenshot(page, '20c-hilfe-sonderspiele', prefix);

    // S-09: HilfeSzene — Tab Punktesystem
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-tab-punkte'));
    await page.waitForTimeout(400);
    await screenshot(page, '20d-hilfe-punkte', prefix);

    // Zurück zur Lobby
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-hilfe-zurueck'));
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(500);

    // S-10: BestenlisterSzene — Tab Turnier (Standard-Tab beim Öffnen)
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-rangliste'));
    await warteAufSzene(page, 'BestenlisterSzene');
    await page.waitForTimeout(800);
    await screenshot(page, '21-rangliste-turnier', prefix);

    // S-11: BestenlisterSzene — Tab Sonder
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-tab-sonder'));
    await page.waitForTimeout(400);
    await screenshot(page, '21b-rangliste-sonder', prefix);

    // S-12: BestenlisterSzene — Tab Frei
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-tab-frei'));
    await page.waitForTimeout(400);
    await screenshot(page, '21c-rangliste-frei', prefix);

    // Zurück zur Lobby
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-bestenliste-zurueck'));
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(500);

    // S-13: Spielerprofil-Modal (HTML-Overlay über Canvas)
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-mein-profil'));
    await page.waitForSelector('.ui-profil-schliessen', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await screenshot(page, '22-spielerprofil', prefix);
    // JS-click statt Locator-click: umgeht Playwright-Sichtbarkeitsprüfung robust
    // (z.B. wenn ein Overlay/Canvas den Button kurzzeitig überlagert).
    await page.evaluate(() => (document.querySelector('.ui-profil-schliessen') as HTMLElement)?.click());
    await page.waitForTimeout(300);

    // S-14: Tisch-Wartezimmer (WARTEND — KEIN starteAktuellenTisch)
    await erstelleKonfiguriertenTisch(page, 'VL-Wartezimmer', {
      ohneNeunen: false,
      anzahlSpiele: 8,
      tischhintergrund: 'FILZ_GRUEN',
      kiSchwierigkeit: 'STANDARD',
    }, false);
    // Warte auf Store-Update (bereich=TISCH), nicht auf Phaser-Szene:
    // getAktuelleSzene() kann während des SpielverwaltungsSzene-Cleanups vorübergehend
    // noch die alte Szene melden — der Store-Bereich ist die verlässlichere Quelle.
    await page.waitForFunction(
      () => (window as any).__locodoko?.appStore?.snapshot()?.bereich === 'TISCH',
      { timeout: 10_000 }
    );
    await page.waitForTimeout(1500);
    await screenshot(page, '13-tisch-wartezimmer', prefix);

    // S-04: Lobby mit gefüllter Tischliste (2. Browser-Kontext)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/');
    await getBridge(page2);
    await warteAufSzene(page2, 'LoginSzene');
    await alsGastStarten(page2);
    await warteAufSzene(page2, 'SpielverwaltungsSzene');
    await page2.waitForTimeout(1500);
    await screenshot(page2, '11b-offene-tische-gefuellt', prefix);
    await context2.close();

    // S-05: Session-Recovery-Button
    // Force transition to lobby while keeping aktiverTischId intact
    await page.evaluate(() => {
      (window as any).__locodoko.appStore.patch({ bereich: 'SPIELVERWALTUNG' });
    });
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(1000);
    await screenshot(page, '01b-lobby-recovery', prefix);
  });
});
