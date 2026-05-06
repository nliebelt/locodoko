# E2E-Tests mit Playwright

| Feld           | Wert                                               |
|----------------|----------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                               |
| Abhängigkeiten | spieler-session.md, lobby.md, spielablauf.md, ki-strategie.md, frontend-tischansicht.md, frontend-tastatursteuerung.md |

## Beschreibung

End-to-End-Tests mit Playwright sichern den kritischen Spielpfad ab. Die Tests laufen separat vom Maven-Build gegen eine laufende Anwendung und können lokal sowie gegen ein Testsystem ausgeführt werden.

## Teststrategie

### Stabilität durch die JavaScript-Bridge

In Headless-Umgebungen ohne GPU-Beschleunigung (CI-Pipelines) ist das Rendering von Phaser (WebGL/Canvas) oft zeitverzögert, was Tastatur- und Maussimulationen unzuverlässig macht ("GPU stalls"). 

Locodoko nutzt daher das **Bridge Pattern**:
- **Interaktion**: Statt `page.keyboard.press()` werden Aktionen direkt über die Bridge ausgelöst (z.B. `window.__locodoko.appStore.spieleKarte(id)`). Dies garantiert eine sofortige Verarbeitung in der Engine unabhängig von den FPS.
- **Synchronisation (Quiescence Pattern)**: Tests warten nicht auf fixe Timeouts, sondern fragen den Zustand `window.__locodoko.appStore.isIdle()` ab. Erst wenn dieser `true` liefert (keine laufenden Animationen, leere Event-Queue), wird der nächste Testschritt ausgeführt.

Die Tastatursteuerung bleibt als sekundärer Pfad für lokale UX-Tests erhalten, für die automatisierte Absicherung der Spiellogik ist die Bridge jedoch die **Single Source of Truth**.

### Bridge API über Helper-Funktionen

Da die gesamte Spieloberfläche in Phaser (Canvas) gerendert wird, gibt es keine DOM-Elemente mit `data-testid`. Die **JavaScript-Bridge** (`window.__locodoko`) ist der einzige stabile Zugangspunkt für Playwright-Tests.

Tests verwenden **Wrapper-Funktionen** aus `helpers.ts` statt direkter `page.evaluate()`-Aufrufe:

| Helper-Funktion                              | Beschreibung                                                                             |
|----------------------------------------------|------------------------------------------------------------------------------------------|
| `getBridge(page)`                            | Warte bis `window.__locodoko.appStore` verfügbar ist                                    |
| `warteAufSzene(page, szeneName, timeout)`    | Warte auf Szene (`'TischSzene'`, `'SpielverwaltungsSzene'`)                            |
| `warteAufNaechstesEreignis(page, timeout)`   | Warte bis App idle ist (`isIdle()` == true)                                             |
| `warteAufPhase(page, phase, timeout)`        | Warte auf Spiel-Phase (z.B. `'VORBEHALT_ANSAGE'`, `'STICHPHASE'`)                      |
| `warteAufEigenenVorbehalt(page, timeout)`    | Warte bis der aktuelle Spieler einen Vorbehalt melden kann                              |
| `warteAufEigenenZug(page, timeout)`          | Warte bis der aktuelle Spieler eine Karte spielen kann                                  |
| `leseSpielZustand(page)`                     | Lese aktuellen Zustand: Phase, Spieltyp, spielbare Karten, mögliche Vorbehalte          |
| `leseHudZustand(page)`                       | Lese HUD-State: Stichzähler, Spieltyp, Button-Sichtbarkeiten                           |
| `alsGastStarten(page)`                       | Session als Gast initialisieren                                                          |
| `erstelleQuickGame(page)`                    | Schnellstart: Tisch erstellen, KI auffüllen, Partie starten                             |
| `erstelleKonfiguriertenTisch(page, n, c, p)` | Tisch mit Konfiguration erstellen (z.B. ohneNeunen, anzahlSpiele, kiSchwierigkeit)     |
| `starteAktuellenTisch(page)`                 | Warte-Tisch starten                                                                      |
| `spieleErsteHandkarte(page)`                 | Spiele erste verfügbare Karte                                                            |
| `spieleKarte(page, karteId)`                 | Spiele Karte per ID                                                                      |
| `meldeVorbehalt(page, vorbehalt)`            | Melde Vorbehalt (z.B. `'GESUND'`, `'SOLO_DAME'`)                                       |
| `beantworteArmut(page, annehmen, karten)`    | Antworte auf Armutangebot                                                                |
| `aktiviereTurbo(page)`                       | Setze Animationsgeschwindigkeit auf `Infinity` (testet schneller)                        |
| `schliesseRundenEndeModal(page)`             | Schließe Rundenende-Modal programmatisch                                                 |
| `leseRundenEndeModalCount(page)`             | Lese wie oft das Modal seit Start angezeigt wurde                                       |
| `leseRundenauswertung(page)`                 | Lese Rundenauswertung: spieltypLabel, multiplikator                                     |
| `aktiviereConsoleCapture(page, testName)`    | Erfasse console-Logs in `e2e/test-results/console-{testName}.log`                       |

## Projektstruktur

```text
locodoko/
├── e2e/
│   ├── package.json               # eigenes npm-Projekt
│   ├── playwright.config.ts       # baseURL via ENV konfigurierbar
│   └── tests/
│       ├── partie-gegen-ki.spec.ts      # Testfall 1: Kritischer Pfad
│       └── rundenauswertung.spec.ts     # Testfall 2: Rundenauswertung
```

Das `e2e/`-Verzeichnis ist ein eigenständiges npm-Projekt und **nicht** Teil des `frontend/`-Projekts. Es wird **nicht** von `mvn verify` ausgeführt.

## Ausführung

```bash
# Lokal (setzt laufende Anwendung auf Port 8081 voraus)
cd e2e && npx playwright test

# Gegen Testsystem
BASE_URL=https://test.locodoko.example.com cd e2e && npx playwright test

# Mit UI-Modus zum Debuggen
cd e2e && npx playwright test --ui
```

---

## Testfall 1: Kritischer Pfad — erste Partie bis zum ersten Stich

**Implementierung:** `e2e/tests/partie-gegen-ki.spec.ts`

**Szenario:** Spieler meldet Vorbehalt, spielt erste Karte, Stich wird abgeschlossen

```gherkin
Given
  - Anwendung ist erreichbar
  - Keine bestehende Session (Test startet frisch)
  - KI-Spieler sind konfiguriert

When
  - Spieler verbindet sich als Gast
  - Tisch wird erstellt und gestartet
  - Vorbehalt-Phase erreicht wird
  - Spieler meldet Vorbehalt (z.B. GESUND)
  - Spieler ist dran und spielt erste verfügbare Karte
  - KI spielt ihre Karten

Then
  - TischSzene wird geladen (nicht SpielverwaltungsSzene)
  - Spieler erhält Vorbehalt-Zug (moeglicheVorbehalte.length > 0)
  - Spieler erhält Spielzug (spielbareKarten.length > 0)
  - Stich wird abgeschlossen (mindestens ein Spieler hat gewonneneStiche > 0)
  - Keine JavaScript-Fehler in Browser-Konsole
```

**Kritischer Testpunkt:** Validiert dass grundlegender Spielablauf funktioniert (Vorbehalt → Kartenspiel → Stichlogik)

---

## Testfall 2: Rundenauswertung und Rundenende

**Implementierung:** `e2e/tests/rundenauswertung.spec.ts`

**Szenario:** Komplettes Spiel wird bis zum Rundenende gespielt, Auswertung wird angezeigt

```gherkin
Given
  - Anwendung ist erreichbar
  - Tisch mit KI-Spielern erstellt
  - Spiel wird gestartet (Vorbehalt-Phase erreicht)

When
  - Alle 12 Stiche werden nacheinander gespielt
  - Spieler und KI spielen ihre Karten reihum
  - Vorbehalte und Armut-Phasen werden gehandhabt
  - Spiel erreicht STICHPHASE und endet

Then
  - Nach letztem Stich wechselt Phase zurück zu VORBEHALT_ANSAGE
  - Rundenauswertungs-Overlay wird angezeigt (Modal-Count > 0)
  - Overlay zeigt Spieltyp-Label (z.B. "Normales Spiel", "Damensolo")
  - Overlay kann geschlossen werden
  - Nach Schließen startet neue Runde (Phase = VORBEHALT_ANSAGE)
  - Keine JavaScript-Fehler während gesamtem Spiel
```

**Kritischer Testpunkt:** Validiert dass volle Partie bis zum Ende spielbar ist und Rundenauswertung korrekt angezeigt wird

> **Hinweis:** Dieser Test ist langsamer als Testfall 1 (ca. 60–90s für ein komplettes Spiel), daher `timeout: 90_000` auf Test-Ebene.

---

## Testfall 3: Solo-Spielfluss — vollständige Solo-Runde

**Implementierung:** `e2e/tests/solo-spielfluss.spec.ts` (ggf. zu implementieren)

**Szenario:** Spieler erhält Solo-Hand, meldet Solo, spielt bis zum Ende, Auswertung zeigt korrekte Solo-Multiplikation

```gherkin
Given
  - Anwendung ist erreichbar
  - Spieler erhält Solo-Hand (SOLO_DAME, SOLO_BUBE, TRUMPF-SOLO, etc.)
  - Falls keine Solo-Hand: Test wird übersprungen

When
  - Spieler ist in Vorbehalt-Phase und hat Solo-Option
  - Spieler meldet Solo-Vorbehalt
  - HUD zeigt neuen Spieltyp (z.B. "Damensolo")
  - Alle 12 Stiche werden gespielt (nur Solist vs. alle anderen)
  - Runde endet

Then
  - Spieltyp im HUD enthält Solo-Typ-Zeichen
  - Rundenauswertung zeigt Spieltyp-Label mit Solo (z.B. "Damensolo")
  - Rundenauswertung zeigt Multiplikator = 3 (Solo-Faktor)
  - Nach Schließen startet neue Runde
  - Geberrotation bleibt beim selben Geber (nächste Runde hat gleicher Geber)
  - Keine JavaScript-Fehler
```

**Kritischer Testpunkt:** Validiert dass Solo-Logik separaten Spieltyp, Punktemultiplikation und Geberrotation korrekt handhaben

> **Hinweis:** Dieser Test wartet auf eine zufällige Solo-Hand oder wird übersprungen. Es wird nicht erzwungen, dass ein Solo auftritt.

---

## Konfiguration: `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,   // 5 Min — Standard-Timeout für längere Tests (z.B. volles Spiel)
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  reporter: [['html', { open: 'never' }]],
});
```

> **Wichtig:** 
> - Standard-Timeout: 300_000ms = 5min (global konfiguriert)
> - Längere Tests (vollständiges Spiel): `test.setTimeout(90_000)` direkt im Test setzen
> - KI-Karten-Delay: 800ms/Karte in STICHPHASE; ein Spiel mit 3 KI-Mitspielern ≈ 30–60s reine KI-Wartezeit
> - Testschleifen nutzen `leseSpielZustand()` + `warteAufNaechstesEreignis()` um KI-Stiche korrekt abzuwarten (nicht mit festen Delays)

## Akzeptanzkriterien

- Tests laufen lokal mit `cd e2e && npx playwright test` durch
- Tests laufen gegen beliebiges System mit `BASE_URL=https://... npx playwright test`
- **Testfall 1:** Vorbehalt → Kartenspiel → Stichlogik funktioniert (kein JS-Fehler)
- **Testfall 2:** Komplettes Spiel spielbar, Rundenauswertung wird angezeigt (kein JS-Fehler)
- **Testfall 3** (optional): Solo-Spieltyp, Multiplikator, Geberrotation funktionieren
- Fehler-Debugging möglich via Screenshots, Videos, Console-Logs

## Definition of Done

- [x] Bridge-Pattern implementiert (Interaktion via `window.__locodoko` statt Tastatur/Maus)
- [x] Quiescence-Pattern für Synchronisation (`isIdle()` vor Tests)
- [x] `helpers.ts` mit stabilen Wrapper-Funktionen
- [x] `partie-gegen-ki.spec.ts` — Testfall 1 läuft und validiert kritischen Pfad
- [x] `rundenauswertung.spec.ts` — Testfall 2 läuft und validiert Spielende + Auswertung
- [ ] `solo-spielfluss.spec.ts` — Testfall 3 (optional: bei Bedarf implementieren)
- [x] `e2e/` Projektstruktur mit `package.json` und `playwright.config.ts`
- [x] Specs dokumentieren WAS und WARUM, nicht HOW

## Technische Hinweise

**Warum Bridge-Pattern statt Tastatur/Maus?**
- Phaser rendert auf Canvas → keine DOM-Elemente zum Klicken
- In Headless-Umgebungen (CI) ist GPU-Rendering oft verzögert → Tastatur-Input unzuverlässig
- Bridge bietet direkten Zugriff: Befehle werden sofort verarbeitet, unabhängig von Rendering-FPS

**Warum Quiescence-Pattern?**
- `isIdle()` prüft: alle Animationen fertig + Event-Queue leer
- Garantiert dass nächster Test-Schritt nicht in Animation startet → zuverlässigere Assertions

**KI-Wartezeiten richtig handhaben:**
- Nicht: `await page.waitForTimeout(1000)` (unkontrollierbar, flaky)
- Ja: Schleife mit `leseSpielZustand()` + `warteAufNaechstesEreignis()` (adaptive Wartezeit)

**Debugging bei Fehlern:**
- `aktiviereConsoleCapture()` schreibt Browser-Logs → `e2e/test-results/console-{testName}.log`
- Playwright speichert Screenshots + Videos bei Fehler automatisch
- Logfiles zeigen was die App getan hat, wenn Test fehlschlägt
