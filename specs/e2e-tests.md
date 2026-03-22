# E2E-Tests mit Playwright

| Feld           | Wert                                               |
|----------------|----------------------------------------------------|
| Status         | Neue Vorgabe                                       |
| Priorität      | Hoch                                               |
| Abhängigkeiten | spieler-session.md, lobby.md, spielablauf.md, ki-strategie.md |

## Beschreibung

End-to-End-Tests mit Playwright sichern den kritischen Pfad "Tisch erstellen → Partie gegen KI spielen bis zum ersten abgeschlossenen Stich" ab. Die Tests laufen separat vom Maven-Build gegen eine laufende Anwendung und können sowohl lokal als auch gegen ein Testsystem ausgeführt werden.

## Projektstruktur

```
locodoko/
├── e2e/
│   ├── package.json               # eigenes npm-Projekt
│   ├── playwright.config.ts       # baseURL via ENV konfigurierbar
│   └── tests/
│       └── partie-gegen-ki.spec.ts
```

Das `e2e/`-Verzeichnis ist ein eigenständiges npm-Projekt und **nicht** Teil des `frontend/`-Projekts. Es wird **nicht** von `mvn verify` ausgeführt.

## Ausführung

```bash
# Lokal (setzt laufende Anwendung auf Port 8080 voraus)
cd e2e && npx playwright test

# Gegen Testsystem
BASE_URL=https://test.locodoko.example.com cd e2e && npx playwright test

# Mit UI-Modus zum Debuggen
cd e2e && npx playwright test --ui
```

## Abhängigkeiten

- **Backend muss laufen**: `mvn spring-boot:run` (oder Testsystem)
- **`BASE_URL`**: Umgebungsvariable, Standard `http://localhost:8080`
- Playwright installiert Chromium als Standard-Browser

## Testfall: Erste Partie gegen KI bis zum ersten Stich

### Vorbedingungen

- Anwendung läuft und ist erreichbar
- Keine Session-Cookies aus vorherigen Tests vorhanden (jeder Test startet frisch)

### Schritte und Assertions

#### 1. Anwendung laden

- Navigiere zu `BASE_URL`
- Assert: Lobby-Ansicht ist sichtbar (z.B. "Tisch erstellen"-Button vorhanden)
- Assert: Session-Cookie wurde gesetzt (HTTP-Response `Set-Cookie`)

#### 2. Tisch erstellen

- Klicke "Tisch erstellen"
- Assert: Tischansicht lädt (URL oder DOM-Element für Tischszene sichtbar)
- Assert: Eigene Spielerposition ist sichtbar
- Assert: Mindestens 3 KI-Spieler erscheinen am Tisch
- Assert: **Kein "Blur"-Zustand** — UI ist interaktierbar, kein reiner Overlay ohne Inhalt

#### 3. Partie startet

- Assert: Spielphase wechselt zu `VORBEHALT_ANSAGE` (sichtbar im HUD oder via DOM)
- Assert: Eigene Hand enthält 12 Karten (Elemente für Karten vorhanden)
- Assert: KI-Spieler haben verdeckte Karten (Rückseitenelemente sichtbar)

#### 4. Vorbehaltsphase durchlaufen

- Wähle "Gesund" (kein Sonderspiel)
- Assert: Vorbehalt-Dialog verschwindet
- Assert: KI-Spieler spielen ihre Vorbehalte automatisch durch (Polling oder WebSocket-Event)
- Assert: Spielphase wechselt zu `STICH` (sichtbar im HUD)

#### 5. Erste Karte spielen

- Wähle eine spielbare Karte aus der eigenen Hand (erste klickbare Karte)
- Klicke die Karte
- Assert: Karte erscheint in der Stichmitte
- Assert: Hand hat jetzt 11 Karten

#### 6. KI spielt den Stich zu Ende

- Assert: Alle 4 Karten erscheinen in der Stichmitte (3 KI-Karten folgen automatisch)
- Assert: Stich wird dem Gewinner zugeschlagen (Stichmitte leert sich)
- Assert: Stich-Zähler erhöht sich (z.B. "Stiche: 1")
- Assert: **Kein JavaScript-Fehler** in der Browser-Konsole während des gesamten Tests

### Erfolgskriterium

Der Test gilt als bestanden, wenn alle Assertions ohne Fehler durchlaufen und kein unerwarteter UI-Zustand (Blur, leerer Screen, Fehlermeldung) auftritt.

## Konfiguration: `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['html', { open: 'never' }]],
});
```

## `e2e/package.json`

```json
{
  "name": "locodoko-e2e",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "install:browsers": "playwright install chromium"
  },
  "devDependencies": {
    "@playwright/test": "^1.x"
  }
}
```

## Akzeptanzkriterien

- `cd e2e && npx playwright test` läuft lokal durch ohne manuellen Eingriff
- `BASE_URL=https://... npx playwright test` läuft gegen ein Testsystem
- Test scheitert reproduzierbar, wenn der "Blur"-Zustand nach Tisch-Erstellen auftritt
- Kein JavaScript-Fehler in der Browser-Konsole während des Testlaufs
- Screenshots und Videos bei Fehler werden in `e2e/test-results/` gespeichert

## Definition of Done

- [ ] `e2e/` Verzeichnis mit `package.json` und `playwright.config.ts` angelegt
- [ ] `tests/partie-gegen-ki.spec.ts` implementiert alle 6 Schritte
- [ ] Test läuft lokal grün gegen `mvn spring-boot:run`
- [ ] `BASE_URL`-Unterstützung funktioniert
- [ ] `e2e/.gitignore` schließt `node_modules/`, `test-results/`, `playwright-report/` aus
- [ ] README oder CLAUDE.md Hinweis zur separaten Ausführung ergänzt

## Technische Hinweise

- Wartezeiten für KI-Aktionen: `waitForSelector` statt fester `sleep`-Delays
- WebSocket-Nachrichten sind asynchron — Assertions mit `expect.poll()` oder `waitFor` absichern
- Jeder Test beginnt mit frischer Session (kein `storageState`)
- Browser-Konsolen-Fehler per `page.on('console', ...)` abfangen und als Test-Fehler werten
