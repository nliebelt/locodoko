/**
 * E2E-Test: Multiplayer-Verifikation — 2 menschliche Sessions spielen eine Partie.
 *
 * Warum dieser Test wichtig ist:
 * - Authentifizierung ist laut authentifizierung.md „Blocker für echten Multiplayer".
 * - Snapshot+Hint-Sync (WebSocket): Beide Clients müssen denselben Spielstand haben.
 * - Session-Isolation: Jeder Spieler darf nur seine eigenen spielbaren Karten sehen.
 * - Stichannahme reihum: spielbareKarten > 0 nur wenn der eigene Zug kommt.
 * - Kein Test deckte bisher echtes Mensch-gegen-Mensch über getrennte Sessions ab.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  getBridge,
  aktiviereTurbo,
  leseSpielZustand,
  meldeVorbehalt,
  spieleKarte,
  alsGastStarten,
  erstelleKonfiguriertenTisch,
  starteAktuellenTisch,
  aktiviereConsoleCapture,
  warteAufSzene,
  beantworteArmut,
} from './helpers';

async function leseEinladungsCode(page: Page): Promise<string> {
  const handle = await page.waitForFunction(
    () => {
      const loco = (window as any).__locodoko;
      const code = loco?.appStore?.snapshot()?.aktuellerTisch?.einladungsCode;
      return code && code.length === 8 ? code : null;
    },
    { timeout: 10_000 },
  );
  return (await handle.jsonValue()) as string;
}

/**
 * Spielt als ein Spieler bis das Rundenende-Overlay erscheint.
 * Maximal 600 Iterationen (≙ ~2 Minuten in Turbo-Modus, 200ms/Iteration im Wartefall).
 */
async function spieleAlsSpieler(page: Page): Promise<void> {
  for (let i = 0; i < 600; i++) {
    const zustand = await leseSpielZustand(page);
    if (zustand.overlayVisible) return;

    if (zustand.moeglicheVorbehalte.length > 0) {
      // Ersten angebotenen Vorbehalt melden (GESUND = Index 0 wenn kein Sonderspiel)
      await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);
    } else if (zustand.armutPhase) {
      // Armut-Tausch: Annahme ablehnen (falls dieser Spieler gefragt ist)
      await beantworteArmut(page, false, []);
    } else if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
      await spieleKarte(page);
    } else {
      // Warte auf Gegner oder KI
      await page.waitForTimeout(200);
    }
  }
}

test.describe('Multiplayer-Verifikation', () => {
  test(
    '2 menschliche Sessions spielen eine vollständige Runde bis zur Auswertung',
    async ({ page, browser }, testInfo) => {

      // ── JS-Fehler-Tracking Spieler 1 ─────────────────────────────────────────
      // Warum: Phaser-Spiele können Fehler stumm schlucken; explizite Prüfung nötig.
      aktiviereConsoleCapture(page, testInfo.title);
      const jsFehlerSpieler1: string[] = [];
      page.on('pageerror', (err) => jsFehlerSpieler1.push(`[pageerror] ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') jsFehlerSpieler1.push(`[console.error] ${msg.text()}`);
      });

      // ── 1. Spieler 1: App laden, als Gast anmelden, Tisch erstellen ──────────
      // Warum: Nicht-privater Tisch (false) ist via Einladungscode beitretbar.
      // kiSchwierigkeit: 'STANDARD' füllt die verbleibenden 2 Plätze beim Start.
      await page.goto('/');
      await getBridge(page);
      await alsGastStarten(page);
      await erstelleKonfiguriertenTisch(
        page,
        'Multiplayer-E2E',
        {
          ohneNeunen: false,
          anzahlSpiele: 2,
          tischhintergrund: 'FILZ_GRUEN',
          kiSchwierigkeit: 'STANDARD',
        },
        false,
      );

      await warteAufSzene(page, 'TischSzene', 15_000);
      const einladungsCode = await leseEinladungsCode(page);
      expect(einladungsCode).toMatch(/^[A-Za-z0-9]{8}$/);

      // ── 2. Spieler 2: Neuer Browser-Kontext (eigene HTTP-Session) ────────────
      // Warum: Neuer Kontext = eigener Cookie → simuliert echten zweiten Nutzer.
      const kontext2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const seite2 = await kontext2.newPage();

      aktiviereConsoleCapture(seite2, `${testInfo.title}-spieler2`);
      const jsFehlerSpieler2: string[] = [];
      seite2.on('pageerror', (err) => jsFehlerSpieler2.push(`[pageerror] ${err.message}`));
      seite2.on('console', (msg) => {
        if (msg.type() === 'error') jsFehlerSpieler2.push(`[console.error] ${msg.text()}`);
      });

      try {
        // ── 3. Spieler 2: Tisch via Einladungslink betreten ───────────────────
        // Warum: BootSzene parst den Hash #join/{code} und ruft betreteTischViaCode()
        // auf → vollständiger Beitritts-Flow ohne manuelles UI-Klicken.
        await seite2.goto(`/#join/${einladungsCode}`);
        await warteAufSzene(seite2, 'TischSzene', 20_000);

        // ── 4. Spieler 1 startet die Partie ──────────────────────────────────
        // Warum: Nur der Tisch-Ersteller darf starten; KI füllt die 2 freien Plätze.
        await starteAktuellenTisch(page);

        // ── 5. Beide Clients auf Turbo-Modus ─────────────────────────────────
        // Warum: Animationen auf Infinity → Test läuft in Sekunden statt Minuten.
        await Promise.all([aktiviereTurbo(page), aktiviereTurbo(seite2)]);

        // ── 6. Verifikation: Session-Isolation ───────────────────────────────
        // Warum: Der Server sendet spielbareKarten nur für den eigenen Spieler.
        // Kein Spieler-Eintrag im Snapshot darf fremde handKarten enthalten.
        // Prüfung sofort nach Start (Vorbehalt-Phase — Hände sind ausgeteilt).
        const [keinHandkartenLeckS1, keinHandkartenLeckS2] = await Promise.all([
          page.evaluate(() => {
            const spieler =
              (window as any).__locodoko?.appStore?.snapshot()
                ?.partieStand?.laufendesSpiel?.spieler ?? [];
            return spieler.every(
              (s: any) => !Array.isArray(s.handKarten) || s.handKarten.length === 0,
            );
          }),
          seite2.evaluate(() => {
            const spieler =
              (window as any).__locodoko?.appStore?.snapshot()
                ?.partieStand?.laufendesSpiel?.spieler ?? [];
            return spieler.every(
              (s: any) => !Array.isArray(s.handKarten) || s.handKarten.length === 0,
            );
          }),
        ]);
        expect(keinHandkartenLeckS1, 'Spieler 1 darf keine Handkarten anderer Spieler sehen').toBe(true);
        expect(keinHandkartenLeckS2, 'Spieler 2 darf keine Handkarten anderer Spieler sehen').toBe(true);

        // ── 7. Parallele Spielschleife: beide Spieler antworten auf ihre Züge ─
        // Warum: Simuliert echten Multiplayer — beide reagieren unabhängig auf
        // WebSocket-Events. Promise.all lässt beide Loops nebenläufig laufen.
        // Stichannahme reihum wird implizit verifiziert: spieleKarte() schlägt
        // fehl, wenn spielbareKarten leer ist (Guard in spieleErsteHandkarte).
        await Promise.all([
          spieleAlsSpieler(page),
          spieleAlsSpieler(seite2),
        ]);

        // ── 8. Verifikation: Beide Clients zeigen Rundenauswertung ───────────
        // Warum: overlayVisible === true beweist, dass das Rundenende-Overlay
        // bei BEIDEN Clients angekommen ist (Snapshot+Hint-Sync via WebSocket).
        const [overlay1, overlay2] = await Promise.all([
          page.evaluate(() => (window as any).__locodoko?.isOverlaySichtbar?.() === true),
          seite2.evaluate(() => (window as any).__locodoko?.isOverlaySichtbar?.() === true),
        ]);
        expect(overlay1, 'Spieler 1 muss Rundenauswertung sehen (Overlay sichtbar)').toBe(true);
        expect(overlay2, 'Spieler 2 muss Rundenauswertung sehen (Overlay sichtbar)').toBe(true);

        // ── 9. Verifikation: Snapshot+Hint-Sync ──────────────────────────────
        // Warum: Beide Clients müssen dieselbe SpielNummer haben. Divergenz
        // würde auf einen verlorenen oder doppelten WebSocket-Event hinweisen.
        const [spielNr1, spielNr2] = await Promise.all([
          page.evaluate(
            () =>
              (window as any).__locodoko?.appStore?.snapshot()?.partieStand?.laufendesSpiel
                ?.spielNummer,
          ),
          seite2.evaluate(
            () =>
              (window as any).__locodoko?.appStore?.snapshot()?.partieStand?.laufendesSpiel
                ?.spielNummer,
          ),
        ]);
        expect(spielNr1, 'Beide Clients müssen dieselbe SpielNummer haben (Sync-Prüfung)').toBe(
          spielNr2,
        );

        // ── Abschlusskontrolle Spieler 2 ─────────────────────────────────────
        expect(
          jsFehlerSpieler2,
          `JavaScript-Fehler bei Spieler 2:\n${jsFehlerSpieler2.join('\n')}`,
        ).toHaveLength(0);
      } finally {
        await kontext2.close();
      }

      // ── Abschlusskontrolle Spieler 1 ───────────────────────────────────────
      expect(
        jsFehlerSpieler1,
        `JavaScript-Fehler bei Spieler 1:\n${jsFehlerSpieler1.join('\n')}`,
      ).toHaveLength(0);
    },
  );
});
