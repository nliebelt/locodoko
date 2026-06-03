# In-App-Bugreport + Fehlererfassung

| Feld           | Wert                                                          |
|----------------|---------------------------------------------------------------|
| Status         | Entwurf — Design entschieden (2026-06-03)                     |
| Priorität      | Mittel (M2; Vortask `OBS-CORRELATION-ID` schon M1-nützlich)   |
| Abhängigkeiten | betrieb-monitoring.md (Loki), spieler-session.md, rest-api.md |

## Zweck & Abgrenzung

Zwei sich **ergänzende** Kanäle:

- **User-initiierter Bugreport** (diese Spec) — der Nutzer meldet aktiv „was nervt / ist falsch",
  mit Freitext + automatisch gesammeltem technischem Kontext.
- **Sentry-Auto-Erfassung** — fängt *automatisch* alle Frontend-/Backend-Fehler (Crashes,
  Exceptions), auch die, die der User nicht meldet.

Abgrenzung zum bereits gebauten **FEAT-FEEDBACK** (`FeedbackController`): Das ist der *leichte*
Freitext-Kanal ohne technischen Kontext. Der Bugreport hier ist die *schwere* Variante mit
Request-/Session-Korrelation und Issue-Anlage.

---

## Trigger & Flow

- **Trigger:** unaufdringlicher Floating-Button („🐞 Bug melden") **plus** Hotkey.
  **Nicht F12** — das ist fest die Browser-DevTools-Taste und nicht zuverlässig abfangbar.
  Gewählt: **`Shift+F1`** (alternativ `Strg+Shift+B`).
- **Overlay (Phaser):** Beschreibungs-Textfeld + Schweregrad-Auswahl. **Kein Screenshot in M1**
  (WebGL-Canvas-Capture + Redaktion → M2).
- **Absenden:** Frontend schickt Beschreibung + Auto-Kontext an den Backend-Endpoint.

---

## Auto-Kontext (vom System gesammelt)

| Feld | Quelle |
|---|---|
| `correlationId`(s) | Ringpuffer der letzten N im AppStore (s. Vortask) |
| `sessionId` | bestehende Session |
| `tischId` / `partieId` | bereits im AppStore-Snapshot |
| Browser / Viewport / UA | Client |
| Build / Git-SHA | `/actuator/info` (seit `OPS-BUILD-INFO`) |
| redigierter AppStore-Zustand | Client, **ohne** Passwörter/fremde Hände |

---

## Vortask: `CorrelationIdFilter` (eigenständig, auch ohne Bugreport wertvoll)

Ist-Stand: MDC trägt `tischId`/`partieId`, **aber keine request-weite `correlationId`** und keinen
Logging-Filter. Das ist der fehlende Baustein, der Frontend-Aktion und Server-Logs verbindet —
zugleich Voraussetzung für `OPS-LOGS-LOKI`.

- **Backend** `CorrelationIdFilter` (`OncePerRequestFilter`): liest `X-Correlation-Id` aus dem
  Request oder erzeugt eine UUID, legt sie ins **MDC** (neben `tischId`/`partieId`) **und** gibt
  sie als **`X-Correlation-Id`-Response-Header** zurück. → erscheint automatisch im JSON-Log,
  per LogQL filterbar.
- **Frontend:** Header aus jeder Response lesen, die **letzten N** correlationIds als Ringpuffer
  im AppStore halten.

---

## Backend-Endpoint (`BugReportController`)

Muster: bestehender `FeedbackController`.

- **Auth erforderlich**; `RateLimitingFilter` wiederverwenden.
- **Anreicherung serverseitig:** Log-Ausschnitt zur/zu den `correlationId`(s) (in den Issue-Body
  **snapshotten**, nicht nur verlinken — Loki-Retention ist begrenzt) + **Grafana-Loki-LogQL-Deep-Link**.
- **Issue-Anlage:** GitHub-Issue via **serverseitigem Token** (ENV, nie im Frontend) in einem
  **separaten privaten Repo** (s. Entscheidung Issue-Ziel).

---

## Datenschutz & Redaktion

- **Auth erforderlich** — kein anonymes Melden.
- **Redaktion (zwingend):** keine Passwörter, **keine fremden Hände** (Snapshot+Hint-Sicht kennt
  die eigene vs. fremde Sicht), keine sonstigen PII über den meldenden Spieler hinaus.
- **Issue-Ziel privat** — Reports enthalten Session-Kontext = Nutzerdaten, dürfen nicht
  world-readable sein. **Unabhängig von der Code-Lizenz.**

---

## Sentry (parallel, automatische Fehlererfassung)

- **Free-Tier, EU-Region** (Datenresidenz EU/DE), **AVV** abschließen — passt zur „EU-Ops
  pragmatisch"-Linie.
- **Frontend** (`@sentry/browser`) + **Backend** (`sentry-spring-boot`).
- **`correlationId` als Sentry-Tag/Context** setzen → beide Kanäle verweisen aufeinander
  (Sentry-Event ↔ Bugreport-Issue ↔ Loki-Logs).
- **Session-Replay bewusst AUS** (Datenschutz — kein Mitschnitt fremder Hände/Eingaben).

---

## Entscheidungen

- **Issue-Ziel** — ✓ **Option A: öffentliches Code-Repo + separates *privates* Bugreport-Repo**
  (Arbeitsannahme 2026-06-03; bestätigen). Zusätzlich im öffentlichen Repo `.github/ISSUE_TEMPLATE/`
  für *manuelle* externe Bugs (getrennt vom In-App-Flow).
- **Screenshot** — ✗ nicht in M1, → M2 (Canvas-Capture + Redaktion).
- **Sentry parallel** — ✓ ja (Free, EU-Region, AVV), **ohne** Session-Replay.
- **Trigger-Hotkey** — `Shift+F1` (nicht F12).
- **Code-Lizenz** — offen (`DECISION-LIZENZ`), **blockiert den Bugreport nicht**.

---

## Definition of Done

- [x] Design + Datenschutz-/Redaktionsregeln + Issue-Ziel entschieden
- [ ] **OBS-CORRELATION-ID** (Vortask): Filter + MDC + Response-Header + Frontend-Ringpuffer
- [ ] **FEAT-BUGREPORT**: Overlay (`Shift+F1`, kein Screenshot) + `BugReportController` +
      Issue-Anlage im privaten Repo + Loki-Deep-Link
- [ ] **OBS-SENTRY**: Sentry FE+BE, EU-Region, correlationId-Tag, kein Replay
- [ ] Nachweis: ein Report erzeugt ein Issue mit redigiertem Kontext; keine sensiblen Daten geleakt
