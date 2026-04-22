# E2E-Tests mit Playwright

| Feld           | Wert                                               |
|----------------|----------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                               |
| Abhängigkeiten | spieler-session.md, lobby.md, spielablauf.md, ki-strategie.md, frontend-tischansicht.md, frontend-tastatursteuerung.md |

## Beschreibung

End-to-End-Tests mit Playwright sichern den kritischen Spielpfad ab. Die Tests laufen separat vom Maven-Build gegen eine laufende Anwendung und können lokal sowie gegen ein Testsystem ausgeführt werden.

## Teststrategie

### Tastatur als primäre Eingabe

Playwright kann keine zuverlässigen Klicks auf Phaser-Canvas-Elemente senden (headless Chromium, Hit-Testing). Deshalb gilt:

- **Spielkarten werden per Tastatur** gespielt: `ArrowLeft`/`ArrowRight` + `Enter` (siehe `frontend-tastatursteuerung.md`)
- **Kein `window.__locodoko.appStore`-Hack mehr** — direkte Tastatureingaben sind sauberer und testen den echten Input-Pfad
- **Modals und Overlays** (Vorbehalt, Rundenauswertung) sind HTML-DOM und per Tastatur/Text-Selektor prüfbar

### `data-testid`-Attribute

Stabile Tests brauchen stabile Selektoren. Alle testbaren UI-Elemente bekommen ein `data-testid`-Attribut. Das sind **Implementierungsanforderungen** — Ralph muss diese Attribute beim Umbau der UI setzen:

| `data-testid`              | Element                                             | Szene        |
|----------------------------|-----------------------------------------------------|--------------|
| `startscreen`              | Start-Screen Wurzel-Container                       | Start-Screen |
| `btn-neuer-tisch`          | „+ Neuen Tisch erstellen"-Button                    | Start-Screen |
| `btn-offene-tische`        | „⊞ Offene Tische"-Button                           | Start-Screen |
| `btn-session-recovery`     | „↩ Zurück zu [Tischname]"-Button (wenn vorhanden)  | Start-Screen |
| `tisch-config-modal`       | Tisch-Konfigurations-Modal                          | Start-Screen |
| `input-tischname`          | Tischname-Eingabefeld im Modal                      | Start-Screen |
| `btn-tisch-erstellen`      | „Tisch erstellen"-Button im Modal                   | Start-Screen |
| `tischszene`               | TischSzene Wurzel-Container                         | Tischansicht |
| `hud-stichzaehler`         | Stich X/12 in der Top-Bar                           | Tischansicht |
| `hud-spieltyp`             | Spieltyp-Anzeige in der Top-Bar                     | Tischansicht |
| `hud-btn-einstellungen`    | `[⚙]`-Button in der Top-Bar                        | Tischansicht |
| `einstellungen-modal`      | Einstellungs-Modal                                  | Tischansicht |
| `btn-spiel-starten`        | „Spiel starten"-Button im Einstellungs-Modal        | Tischansicht |
| `vorbehalt-overlay`        | Vorbehalt-Overlay                                   | Tischansicht |
| `floating-action-bar`      | Floating Action Bar (Ansagen / Aktionshinweis)      | Tischansicht |
| `rundenauswertung-overlay` | Rundenauswertungs-Overlay                           | Tischansicht |
| `btn-rundenauswertung-weiter` | „Weiter →"-Button im Rundenauswertungs-Overlay   | Tischansicht |

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

### Vorbedingungen

- Anwendung läuft und ist erreichbar
- Keine Session-Cookies aus vorherigen Tests (jeder Test startet frisch)

### Schritte und Assertions

#### 1. Start-Screen laden

- Navigiere zu `BASE_URL`
- Assert: `[data-testid="startscreen"]` ist sichtbar
- Assert: `[data-testid="btn-neuer-tisch"]` ist sichtbar
- Assert: Session-Cookie wurde gesetzt

#### 2. Tisch erstellen

- Klicke `[data-testid="btn-neuer-tisch"]`
- Assert: `[data-testid="tisch-config-modal"]` ist sichtbar
- Fülle `[data-testid="input-tischname"]` mit `E2E-Test-Tisch`
- Klicke `[data-testid="btn-tisch-erstellen"]`
- Assert: `[data-testid="tischszene"]` ist sichtbar
- Assert: `[data-testid="hud-btn-einstellungen"]` ist sichtbar

#### 3. Spiel starten

- Klicke `[data-testid="hud-btn-einstellungen"]`
- Assert: `[data-testid="einstellungen-modal"]` ist sichtbar
- Klicke `[data-testid="btn-spiel-starten"]`
- Assert: `[data-testid="einstellungen-modal"]` ist nicht mehr sichtbar

#### 4. Vorbehalt-Phase

- Assert: `[data-testid="vorbehalt-overlay"]` wird sichtbar (timeout: 15s)
- Assert: Overlay enthält Button mit Text „Gesund"
- Drücke `1` (Zifferntaste für „Gesund") oder klicke den „Gesund"-Button
- Assert: `[data-testid="vorbehalt-overlay"]` verschwindet
- Assert: `[data-testid="hud-spieltyp"]` zeigt einen Spieltyp an (timeout: 15s)

#### 5. Erste Karte per Tastatur spielen

- Assert: `[data-testid="floating-action-bar"]` enthält Hinweis dass Spieler dran ist (timeout: 20s)
- Drücke `Enter` (spielt die automatisch vorausgewählte erste spielbare Karte)
- Assert: `[data-testid="hud-stichzaehler"]` zeigt `Stich 1/12`

#### 6. KI spielt den Stich zu Ende

- Assert: `[data-testid="hud-stichzaehler"]` zeigt `Stich 2/12` (timeout: 20s) — Stich wurde abgeschlossen, nächster beginnt
- Assert: Kein JavaScript-Fehler in der Browser-Konsole während des gesamten Tests

---

## Testfall 2: Rundenauswertung erscheint nach Spielende

> **Hinweis**: Dieser Test läuft gegen eine KI die alle 12 Stiche bis zum Ende spielt. Er ist langsamer als Testfall 1 (ca. 60–90s Timeout).

### Testablauf

#### 1–4. Wie Testfall 1 (Tisch erstellen, Spiel starten, Vorbehalt)

#### 5. Alle eigenen Karten spielen

- Wiederhole für jede Karte: warte auf Zug (`floating-action-bar`), drücke `Enter`
- Assert nach jeder gespielten Karte: `hud-stichzaehler` erhöht sich korrekt

#### 6. Rundenauswertung erscheint

- Assert: `[data-testid="rundenauswertung-overlay"]` wird sichtbar (timeout: 30s)
- Assert: Overlay enthält Spieltyp-Text (z.B. „Normales Spiel" oder „Trumpfsolo")
- Assert: Overlay enthält Text „RE" oder „KONTRA" (Gewinner sichtbar)
- Assert: Overlay enthält `[data-testid="btn-rundenauswertung-weiter"]`

#### 7. Weiter zur nächsten Runde

- Drücke `Enter` oder klicke `[data-testid="btn-rundenauswertung-weiter"]`
- Assert: `[data-testid="rundenauswertung-overlay"]` verschwindet
- Assert: `[data-testid="hud-spieltyp"]` zeigt neuen Spieltyp / `Vorbehalt läuft…`
- Assert: Kein JavaScript-Fehler

---

## Testfall 3: Solo-Spielfluss — vollständige Solo-Runde

> **Hinweis**: Dieser Test erzwingt kein Solo durch eine Tischkonfiguration — er wartet deterministisch
> auf eine Solo-Hand des Spielers, oder nutzt `meldeVorbehalt(page, 'SOLO_DAME')` wenn der Spieler
> die Wahl hat. Falls kein Solo möglich: `test.skip`.
>
> **Warum E2E für Solo wichtig:** Solo verändert drei Dinge die im Normalspiel nicht beobachtbar sind:
> - HUD zeigt anderen Spieltyp (z.B. „Damensolo")
> - Nur der Solist ist Re, alle anderen Kontra — Rundenauswertung zeigt das korrekt
> - Geberrotation bleibt nach Solo beim selben Geber — zweites Spiel bestätigt das

### Testablauf

#### 1–3. Wie Testfall 1 (Tisch erstellen, Spiel starten)

#### 4. Vorbehalt-Phase: Solo wählen

- Assert: `[data-testid="vorbehalt-overlay"]` wird sichtbar (timeout: 15s)
- Falls Spieler einen Solo-Vorbehalt hat: Drücke passende Ziffer (z.B. `3` für SOLO_DAME)
- Falls kein Solo möglich: `test.skip('Keine Solo-Hand — Test übersprungen')`
- Assert: `[data-testid="vorbehalt-overlay"]` verschwindet
- Assert: `[data-testid="hud-spieltyp"]` zeigt Solo-Spieltyp, z.B. `Damensolo` (timeout: 15s)

#### 5. Solo-Spielfluss: alle Stiche

- Wiederhole für jeden eigenen Zug: warte auf Zug, drücke `Enter`
- Assert nach Stich 1: `hud-stichzaehler` zeigt `Stich 2/12`
- Assert: Spieltyp im HUD wechselt nicht während der Runde

#### 6. Rundenauswertung: Solo-spezifische Anzeige

- Assert: `[data-testid="rundenauswertung-overlay"]` wird sichtbar (timeout: 120s)
- Assert: `[data-testid="rundenauswertung-spieltyp"]` enthält Solo-Typ (z.B. „Damensolo")
- Assert: Overlay enthält „RE" genau einmal (nur Solist) und „KONTRA" für die anderen drei
- Assert: `[data-testid="rundenauswertung-punktemultiplikator"]` zeigt `×3`

#### 7. Nächstes Spiel: Geber-Wiederholung nach Solo

- Drücke `Enter` um Overlay zu schließen
- Assert: Neues Vorbehalt-Overlay erscheint (neues Spiel gestartet)
- Assert: Kein JavaScript-Fehler im gesamten Test

### Neue data-testid-Attribute für Testfall 3

| `data-testid` | Element | Szene |
|---|---|---|
| `rundenauswertung-spieltyp` | Spieltyp-Text im Rundenauswertungs-Overlay | Tischansicht |
| `rundenauswertung-punktemultiplikator` | Multiplikator-Anzeige (×3 bei Solo) | Tischansicht |

---

## Konfiguration: `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,   // 5 Minuten — nötig wegen KI-Karten-Delay (800ms/Karte × 3 KI × 12 Stiche ≈ 30s reine KI-Zeit)
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

> **Wichtig:** Das Timeout muss ≥ 300_000ms sein. Der KI-Karten-Delay (800ms/Karte in STICHPHASE) führt dazu, dass ein vollständiges Spiel mit 3 KI-Mitspielern ca. 30–60s reine Wartezeit an KI-Aktionen hat. Testschleifen müssen so gebaut sein, dass sie rein-KI-Stiche (kein eigener Zug) korrekt abwarten, bevor sie zum nächsten Schritt fortschreiten.

## Akzeptanzkriterien

- `cd e2e && npx playwright test` läuft lokal durch ohne manuellen Eingriff
- `BASE_URL=https://... npx playwright test` läuft gegen ein Testsystem
- Testfall 1 schlägt reproduzierbar fehl wenn UI einfriert oder Karte nicht gespielt werden kann
- Testfall 2 schlägt fehl wenn Rundenauswertung nicht erscheint
- Kein JavaScript-Fehler in der Browser-Konsole
- Screenshots und Videos bei Fehler in `e2e/test-results/`

## Definition of Done

- [x] `e2e/`-Verzeichnis mit `package.json` und `playwright.config.ts` angelegt
- [x] `BASE_URL`-Unterstützung implementiert
- [x] `e2e/.gitignore` korrekt
- [x] `data-testid`-Attribute in TischSzene und SpielverwaltungsSzene für alle relevanten Elemente gesetzt (11 von 17 — rest in specs/e2e-tests.md Task 11)
- [~] `partie-gegen-ki.spec.ts` auf neue Selektoren und Tastatursteuerung umgestellt (weitgehend fertig)
- [x] `rundenauswertung.spec.ts` implementiert und stabil
- [x] Testfall 1 läuft lokal grün gegen `mvn spring-boot:run`
- [x] Testfall 2 läuft lokal grün gegen `mvn spring-boot:run`

## Technische Hinweise

- Wartezeiten für KI-Aktionen: `waitForSelector` statt fester `sleep`-Delays.
- WebSocket-Nachrichten sind asynchron — Assertions mit `expect.poll()` oder `waitFor` absichern.
- Jeder Test beginnt mit frischer Session (kein `storageState`).
- Browser-Konsolen-Fehler per `page.on('console', ...)` und `page.on('pageerror', ...)` abfangen.
- `window.__locodoko.appStore` bleibt als Notfall-Fallback verfügbar, wird aber nicht mehr als primärer Spielmechanismus genutzt.
- Testfall 2 benötigt `timeout: 90_000` auf Test-Ebene (überschreibt globale 30s).
