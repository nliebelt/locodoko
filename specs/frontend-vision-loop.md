# Vision-Loop — Vollständiger Screenshot-Katalog

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe — lebendes Dokument                          |
| Priorität      | Mittel                                                      |
| Letztes Update | 2026-06-06 (Session 79)                                     |
| Abhängigkeiten | frontend-visuelles-design.md, frontend-tischansicht.md      |

## Zweck

Der Vision-Loop (`e2e/tests/vision-loop.spec.ts`) ist das zentrale visuelle
Regressionswerkzeug. Er läuft nach jedem UI-relevanten Commit und macht
Screenshots aller relevanten Spielzustände, die dann gegen `specs/frontend-
visuelles-design.md` geprüft werden.

Dieses Dokument definiert **vollständig welche Screens existieren**, wie sie
im Test ausgelöst werden und welcher Test sie abdeckt. Es ist die Grundlage
für abgeleitete Build-Tasks.

## Test-Struktur (Ziel-Aufteilung)

Zwei Playwright-Specs:

| Datei | Inhalt | Laufzeit (Ziel) |
|-------|--------|-----------------|
| `e2e/tests/vision-loop-szenen.spec.ts` *(neu)* | Alle Nicht-Spiel-Screens: Login, Lobby inkl. aller Modals, Hilfe (alle Tabs), Rangliste (alle Tabs), Spielerprofil, Tisch-Wartezimmer | < 30 s |
| `e2e/tests/vision-loop.spec.ts` *(erweitern)* | Vollständiger Gameplay-Fluss: Vorbehalt, Stich, Ansagen, Armut, Spielprotokoll, alle Flash-Text-Events (best-effort), Auswertungs-Modals | < 5 min |

Beide Specs laufen in `playwright.config.vision.ts` unter den Projekten
`desktop` (1280×720) und `mobile-portrait` (393×851, Pixel 5).

## Voraussetzungen für die Umsetzung

Damit die neuen Tests die Nicht-Spiel-Szenen steuern können, brauchen einige
Buttons noch Test-IDs. Diese sind als **kleine API-Ergänzungen** aufgeführt
(eigener Task `VISION-LOOP-API`):

| Datei | Zu ergänzen |
|-------|-------------|
| `SpielverwaltungsSzene.ts` | `spielregelnBtn.setName('btn-spielregeln')` |
| `SpielverwaltungsSzene.ts` | `ranglisteBtn.setName('btn-rangliste')` |
| `HilfeSzene.ts` | Tab-Buttons setName: `btn-tab-trumpf`, `btn-tab-ansagen`, `btn-tab-sonderspiele`, `btn-tab-punkte` |
| `HilfeSzene.ts` | Zurück-Button: `btn-hilfe-zurueck` |
| `BestenlisterSzene.ts` | Tab-Buttons: `btn-tab-turnier`, `btn-tab-sonder`, `btn-tab-frei` |
| `BestenlisterSzene.ts` | Zurück-Button: `btn-bestenliste-zurueck` |
| `TischSzene.ts` / Bridge | `window.__locodoko.toggleSpielprotokoll()` für E2E-Zugriff |
| `TischBrücke.ts` | `bridge.isPartieEndeModalSichtbar` |
| `TischBrücke.ts` | `bridge.schliessePartieEndeModal()` |
| `e2e/tests/helpers.ts` | `warteAufSzene('HilfeSzene')`, `warteAufSzene('BestenlisterSzene')` (schon vorhanden) |

## Vollständiger Screen-Katalog

Legende: ✅ = abgedeckt | 🔲 = fehlt | 🎯 = Ziel

---

### Gruppe 1 — Nicht-Spiel-Szenen (→ `vision-loop-szenen.spec.ts`)

#### S-00 Login-Screen

- **Screenshot-ID:** `00-login-screen`
- **Trigger:** `page.goto('/')` vor `alsGastStarten()` — App startet ohne Session immer im Login
- **Elemente:** Titel "LOCO DOKO", Untertitel, Button "Als Gast spielen", optional "Mit Google anmelden" (nur wenn OAuth2 aktiv), "⚡ SCHNELLSTART (KI)"
- **Varianten:** ohne Google-Button (Standard im Test, weil kein OAuth-Secret gesetzt)
- **Status:** ✅ (S82 — vision-loop-szenen.spec.ts)
- **Test-Schritt:** `await warteAufSzene(page, 'LoginSzene'); await screenshot(page, '00-login-screen', ...);` — vor `alsGastStarten()`

#### S-01 Lobby — Basis

- **Screenshot-ID:** `01-lobby`
- **Trigger:** Nach `alsGastStarten()`, `warteAufSzene('SpielverwaltungsSzene')`
- **Status:** ✅ (vorhanden)

#### S-02 Lobby — Offene Tische

- **Screenshot-ID:** `11-offene-tische`
- **Trigger:** Wie S-01, Sicht auf leere Tischliste ("Keine offenen Tische")
- **Status:** ✅ (vorhanden)

#### S-03 Lobby — Tisch-Erstellen-Modal

- **Screenshot-ID:** `12-neuer-tisch-modal`
- **Trigger:** `drueckeSzenenButton('btn-neuer-tisch')` → Modal öffnet sich
- **Status:** ✅ (vorhanden)

#### S-04 Lobby — mit wartenden Tischen (Tischliste gefüllt)

- **Screenshot-ID:** `11b-offene-tische-gefuellt`
- **Trigger:** Eigenen Tisch erstellen (privat=false), dann in neuem Browser-Kontext Lobby öffnen → Tisch erscheint in der Liste des zweiten Kontexts. ODER: nach `erstelleKonfiguriertenTisch()` ohne Start → aus demselben Kontext die Tischliste per zweitem Konto abrufen.
- **Elemente:** Mindestens 1 Tischeintrag mit Name, Spieler, "Beitreten"-Button
- **Status:** ✅ (S86)
- **Hinweis:** Erfordert 2 Browser-Kontexte oder einen Workaround (Tisch erstellen, zur Lobby zurück, Tisch erscheint in eigener Liste nicht — aber `SpielverwaltungsSzene` zeigt fremde Tische). Alternativ: **tisch erstellen + Session 2 öffnet Lobby** als Mini-Flow.

#### S-05 Lobby — Session-Recovery-Button

- **Screenshot-ID:** `01b-lobby-recovery`
- **Trigger:** Spieler hat aktiven Tisch (`zustand.spieler.aktiverTischId` gesetzt). Tisch erstellen, dann direkt auf Lobby-URL navigieren ohne Tisch zu verlassen.
- **Elemente:** Zusätzlicher Button "Zurück zum Spiel" (btn-session-recovery) ganz oben
- **Status:** ✅ (S86)

#### S-06 Spielregeln — Tab Trumpfhierarchie

- **Screenshot-ID:** `20-hilfe-trumpf`
- **Trigger:** `drueckeSzenenButton('btn-spielregeln')` → `warteAufSzene('HilfeSzene')` → Tab 'Trumpfhierarchie' ist Standard
- **Benötigt API-Ergänzung:** `spielregelnBtn.setName('btn-spielregeln')`
- **Status:** ✅ (S82)

#### S-07 Spielregeln — Tab Ansagen

- **Screenshot-ID:** `20b-hilfe-ansagen`
- **Trigger:** `drueckeSzenenButton('btn-tab-ansagen')` in HilfeSzene
- **Status:** ✅ (S82)

#### S-08 Spielregeln — Tab Sonderspiele

- **Screenshot-ID:** `20c-hilfe-sonderspiele`
- **Trigger:** `drueckeSzenenButton('btn-tab-sonderspiele')` in HilfeSzene
- **Status:** ✅ (S82)

#### S-09 Spielregeln — Tab Punktesystem

- **Screenshot-ID:** `20d-hilfe-punkte`
- **Trigger:** `drueckeSzenenButton('btn-tab-punkte')` in HilfeSzene
- **Status:** ✅ (S82)

#### S-10 Rangliste — Tab Turnier

- **Screenshot-ID:** `21-rangliste-turnier`
- **Trigger:** `drueckeSzenenButton('btn-rangliste')` → `warteAufSzene('BestenlisterSzene')` → Standard-Tab Turnier
- **Benötigt API-Ergänzung:** `ranglisteBtn.setName('btn-rangliste')`
- **Status:** ✅ (S82)

#### S-11 Rangliste — Tab Sonder

- **Screenshot-ID:** `21b-rangliste-sonder`
- **Trigger:** `drueckeSzenenButton('btn-tab-sonder')` in BestenlisterSzene
- **Status:** ✅ (S82)

#### S-12 Rangliste — Tab Frei

- **Screenshot-ID:** `21c-rangliste-frei`
- **Trigger:** `drueckeSzenenButton('btn-tab-frei')` in BestenlisterSzene
- **Status:** ✅ (S82)

#### S-13 Spielerprofil-Modal

- **Screenshot-ID:** `22-spielerprofil`
- **Trigger:** `drueckeSzenenButton('btn-mein-profil')` → HTML-Overlay erscheint
- **Elemente:** Avatar, Name, Statistik-Tabs (TURNIER/SONDER/FREI), Kacheln
- **Status:** ✅ (S82)
- **Hinweis:** SpielerProfilModal ist ein HTML-DOM-Element, kein Phaser-Canvas-Objekt. Screenshot mit `page.screenshot()` erfasst es korrekt, da es über dem Canvas liegt.

#### S-14 Tisch-Wartezimmer (Ersteller, WARTEND)

- **Screenshot-ID:** `13-tisch-wartezimmer`
- **Trigger:** `erstelleKonfiguriertenTisch(page, 'VL-Wartezimmer', {...}, false)` → `warteAufSzene('TischSzene')` → NICHT `starteAktuellenTisch()`
- **Elemente:** TopBar mit "START"-Button + "🔗 LINK"-Button, Spielerplätze, 3 leere KI-Plätze
- **Status:** ✅ (S82)

---

### Gruppe 2 — TischSzene Spielphasen (→ `vision-loop.spec.ts`)

#### T-01 Vorbehalt-Auswahl (SUED am Zug)

- **Screenshot-ID:** `02-vorbehalt-phase`
- **Status:** ✅ (vorhanden)

#### T-02 Vorbehalt-Wechsel Keyframes

- **Screenshot-IDs:** `02-vorbehalt-wechsel-0/50/100`
- **Status:** ✅ (vorhanden)

#### T-03 Stichphase — eigener Zug

- **Screenshot-ID:** `03-stichphase-eigener-zug`
- **Status:** ✅ (vorhanden)

#### T-04 Karte-Ausspielen Animation

- **Screenshot-IDs:** `03-stich-ausspielen-0/50`
- **Status:** ✅ (vorhanden)

#### T-05 Stichphase — Gegner am Zug

- **Screenshot-ID:** `03b-stich-gegner-am-zug`
- **Trigger:** Karte gespielt haben, dann Screenshot bevor eigener nächster Zug kommt; keine spielbaren Karten für SUED
- **Elemente:** Gegner-Nameplate hervorgehoben, Karte auf Stichmitte
- **Status:** ✅ (S83)

#### T-06 Ansage-Buttons (Re/Kontra sichtbar)

- **Screenshot-ID:** `06-ansage-buttons`
- **Status:** ✅ (vorhanden, seit Session 79)

#### T-07 Armut-Tausch-UI

- **Screenshot-ID:** `04-armut-tausch-ui`
- **Status:** ✅ (vorhanden, seit Session 79, best-effort)

#### T-08 Spielprotokoll-Overlay

- **Screenshot-ID:** `09-spielprotokoll`
- **Trigger:** `window.__locodoko.toggleSpielprotokoll()` während Spiel läuft
- **Benötigt API-Ergänzung:** Bridge-Methode `toggleSpielprotokoll()` (Tisch-Brücke erweitern)
- **Elemente:** Backdrop + Panel, Spaltenheader, Zeilen (oder "Noch keine Spiele"-Text vor erstem Spiel; nach einer Runde mit gefüllter Liste)
- **Status:** ✅ (S83)

#### T-09 Einstellungs-Modal

- **Screenshot-ID:** `08-einstellungen-modal`
- **Status:** ✅ (vorhanden)

#### T-10 Seitenlade offen

- **Screenshot-ID:** `07-seitenlade-offen`
- **Status:** ✅ (vorhanden)

#### T-11 Letzter-Stich-Overlay

- **Screenshot-ID:** `10-letzter-stich-overlay`
- **Status:** ✅ (via Bridge-Methode `zeigeLetztesStichOverlay`)
- **Trigger:** Nach mindestens einem abgeschlossenen Stich auf den Stichstapel von SUED klicken
- **Elemente:** Backdrop, "Letzter Stich — X Augen", 4 Karten aufgedeckt
- **Hinweis:** Stichstapel liegt bei ca. `(B/2 - fHalbe - kGroesse.w/2 - 12, H*0.90)` gemäß `stichStapelPositionFuer`. Playwright-Klick mit `page.locator('canvas').click({ position: ... })` möglich, aber brittle. Alternative: Bridge-Methode `zeigeLetztesStichOverlay()` ergänzen.
- **Priorität:** Niedrig (aufwendiger Bridge-Aufwand für einen Screenshot)

#### T-12 Rundenauswertungs-Modal

- **Screenshot-ID:** `05-rundenauswertung-overlay`
- **Status:** ✅ (vorhanden)

#### T-13 Partie-Ende-Modal (partieBeendet = true)

- **Screenshot-ID:** `05b-partie-ende-modal`
- **Status:** ✅ (S88 — separater Test `Partie-Ende-Modal (T-13)` in `vision-loop.spec.ts`)
- **Trigger:** Tisch mit `anzahlSpiele: 1` erstellen → nach erstem Spiel erscheint das Partie-Ende-Modal statt des Rundenende-Modals
- **Elemente:** Titel "Partie beendet", Sieger farbig hervorgehoben, Gesamtstand-Tabelle, Countdown-Text, "Neue Partie" + "Tisch verlassen"
- **Benötigt API-Ergänzung:** `bridge.isPartieEndeModalSichtbar`, `bridge.schliessePartieEndeModal()`

---

### Gruppe 3 — Flash-Text-Animationen (→ `vision-loop.spec.ts`, best-effort)

Diese Animationen sind transient (1,5–4 Sekunden). Die Strategie: Animations-
geschwindigkeit auf `0.2×` setzen sobald der auslösende Event erkannt wird,
sofort Screenshot, dann Turbo zurück. Wenn der Kartenausfall den Event in
einer Runde nicht produziert: kein Screenshot für diese Ausführung — kein
Test-Fehler.

#### F-01 SpielGestartet-Flash

- **Screenshot-ID:** `f01-flash-spiel-gestartet`
- **Trigger:** SPIEL_GESTARTET-Event, Animation läuft `~2.5s`; bei `0.2×` → ~12s. Warten auf Event via `warteAufNaechstesEreignis()`, dann Screenshot bei `0.2×` *vor* Austeilen.
- **Elemente:** Cyan-Karte mittig: "SPIEL STARTET / TISCH BEREIT"
- **Status:** ✅

#### F-02 VorbehaltErwartet-Flash (persistent)

- **Screenshot-ID:** `f02-flash-vorbehalt-erwartet`
- **Trigger:** Dieser Flash ist persistent (bleibt bis Vorbehalt abgegeben). Bei `0.2×` gut photographierbar.
- **Elemente:** Blau-Karte oben: "VORBEHALT? / SPIELER AM ZUG", blinkend
- **Status:** ✅

#### F-03 NaechsterSpielerErwartet-Flash

- **Screenshot-ID:** `f03-flash-am-zug`
- **Trigger:** Erscheint kurz wenn SUED am Zug ist und auf eine Karte wartet. Bei `0.2×` ~10s sichtbar.
- **Elemente:** Blau-Karte oben: "AM ZUG / Spielername"
- **Status:** ✅

#### F-04 StichAbgeschlossen-Flash

- **Screenshot-ID:** `f04-flash-stich-abgeschlossen`
- **Trigger:** Nach STICH_ABGESCHLOSSEN-Event erscheint "+X"-Punkte-Text beim Gewinner-Nameplate
- **Elemente:** Grüner "+X"-Text schwebt hoch
- **Status:** ✅

#### F-05 SchweinchenGemeldet-Flash

- **Screenshot-ID:** `f05-flash-schweinchen` (best-effort, nur wenn Spiel Schweinchen produziert)
- **Trigger:** SCHWEINCHEN_GEMELDET-Event; tritt auf wenn jemand das erste Karo-As spielt und Schweinchen-Regel aktiv ist
- **Elemente:** Pink-Karte: "🐷 SCHWEINCHEN!" + Spielername, Shockwave + Screen Shake
- **Status:** ✅

#### F-06 FuchsGefangen-Flash

- **Screenshot-ID:** `f06-flash-fuchs` (best-effort, nur wenn Fuchs im Spiel gefangen wird)
- **Trigger:** SONDERPUNKT FUCHS_GEFANGEN
- **Elemente:** Orange-Karte: Buchstaben fallen ein, "FUCHS GEFANGEN · +1", Konfetti
- **Status:** ✅

#### F-07 KarlchenGespielt-Flash

- **Screenshot-ID:** `f07-flash-karlchen` (best-effort)
- **Trigger:** SONDERPUNKT KARLCHEN
- **Elemente:** Gold-Karte: "KARLCHEN" + Spielername, Shockwave
- **Status:** ✅

#### F-08 DoppelkopfGestochen-Flash

- **Screenshot-ID:** `f08-flash-doppelkopf` (best-effort)
- **Trigger:** SONDERPUNKT DOPPELKOPF
- **Elemente:** Gold-Karte: "DOPPEL-KOPF / GESTOCHEN · +2", Foil-Shimmer, 3× Shockwave, Konfetti, Camera-Flash
- **Status:** ✅

#### F-09 HochzeitPartnerGefunden-Flash

- **Screenshot-ID:** `f09-flash-hochzeit` (best-effort)
- **Trigger:** HOCHZEIT_PARTNER_GEFUNDEN-Event
- **Elemente:** Gold-Karte: "💍 HOCHZEIT! / PARTNER: NAME", Foil-Shimmer, Konfetti
- **Status:** ✅

#### F-10 SpielBeendet-Flash

- **Screenshot-ID:** `f10-flash-spiel-beendet`
- **Trigger:** SPIEL_BEENDET-Event; bei `0.2×` ~20s sichtbar → gut photographierbar. Kurz vor Rundenende-Modal.
- **Elemente:** Grün-Karte: "GEWONNEN / SPIEL BEENDET", Foil-Shimmer, Konfetti, Camera-Flash
- **Status:** ✅

---

### Gruppe 4 — Animations-Keyframes (→ `vision-loop.spec.ts`)

#### A-01 Karten-Austeilen (Mitte)

- **Screenshot-ID:** `a01-austeilen`
- **Trigger:** Nach SPIEL_GESTARTET bei `0.2×`; Austeilen dauert ~2s → bei `0.2×` ~10s. Screenshot nach ca. 3 von 10s.
- **Elemente:** Karten fliegen vom Geber zu allen Spielern, noch nicht alle angekommen
- **Status:** ✅

#### A-02 Ansage-Banner (Re / Kontra)

- **Screenshot-ID:** `a02-ansage-banner`
- **Trigger:** ANSAGE_ERFOLGT-Event bei `0.2×`; Banner erscheint ~1.2s → bei `0.2×` ~6s sichtbar
- **Elemente:** Großes "RE" (gold) oder "KONTRA" (blau) Banner mittig
- **Status:** ✅

#### A-03 Solo/Spieltyp-Ankündigung

- **Screenshot-ID:** `a03-solo-ankuendigung` (best-effort, nur bei Solo-Runde)
- **Trigger:** SPIEL_GESTARTET mit Spielankündigungstext, bei `0.2×`
- **Elemente:** Großer Text fährt von oben ein
- **Status:** 🔲

#### A-04 Bockrunden-Ankündigung

- **Screenshot-ID:** `a04-bockrunde` (best-effort, erst nach bockrundenauslösenden Ereignis)
- **Trigger:** Nächstes Spiel nach Bockrunden-auslösendem Ereignis (Re-Kontra-Spiel) mit aktivem `bockrundenZaehler > 0`
- **Elemente:** Bockrunden-Zähler-Animation
- **Status:** 🔲

#### A-05 Stich-Einziehen (Mitte der Animation)

- **Screenshot-ID:** `a05-stich-einziehen`
- **Trigger:** Nach STICH_ABGESCHLOSSEN bei `0.2×` — Karten bewegen sich gemeinsam zum Stichstapel
- **Elemente:** 4 Karten auf halber Strecke zwischen Stichmitte und Stapel
- **Status:** 🔲

---

### Gruppe 5 — Sonstige Zustände

#### X-01 Fehler-Toast

- **Screenshot-ID:** `x01-fehler-toast`
- **Trigger:** `spieleKarteViaTestApi(page, 'ungueltige-karte-id')` → AKTION_ABGELEHNT → roter Toast oben rechts
- **Elemente:** Rotes Toast-Panel mit Fehlermeldung
- **Status:** 🔲

#### X-02 Info-Toast

- **Screenshot-ID:** `x02-info-toast`
- **Trigger:** Schwerer auszulösen als Fehler-Toast. Alternativ via Bridge `window.__locodoko.appStore.setzeToast(...)` falls öffentlich.
- **Status:** 🔲
- **Priorität:** Niedrig

#### X-03 Debug-Modus (aufgedeckte Gegner-Karten)

- **Screenshot-ID:** `x03-debug-modus`
- **Trigger:** Während Stichphase: `drueckeSzenenButton('btn-debug-toggle')` (falls Bridge-Methode existiert) oder TopBar-Button
- **Elemente:** Alle 4 Hände sichtbar (Gegner-Karten aufgedeckt)
- **Status:** 🔲
- **Priorität:** Niedrig

---

## Übersichtstabelle

| ID | Screen | Test | Status |
|----|--------|------|--------|
| S-00 | Login-Screen | Szenen | ✅ |
| S-01 | Lobby Basis | Szenen | ✅ |
| S-02 | Lobby Tischliste leer | Szenen | ✅ |
| S-03 | Lobby Tisch-Erstellen-Modal | Szenen | ✅ |
| S-04 | Lobby Tischliste gefüllt | Szenen | ✅ |
| S-05 | Lobby Session-Recovery | Szenen | ✅ |
| S-06 | Hilfe — Trumpfhierarchie | Szenen | ✅ |
| S-07 | Hilfe — Ansagen | Szenen | ✅ |
| S-08 | Hilfe — Sonderspiele | Szenen | ✅ |
| S-09 | Hilfe — Punktesystem | Szenen | ✅ |
| S-10 | Rangliste — Turnier | Szenen | ✅ |
| S-11 | Rangliste — Sonder | Szenen | ✅ |
| S-12 | Rangliste — Frei | Szenen | ✅ |
| S-13 | Spielerprofil-Modal | Szenen | ✅ |
| S-14 | Tisch-Wartezimmer | Szenen | ✅ |
| T-01 | Vorbehalt-Auswahl | Gameplay | ✅ |
| T-02 | Vorbehalt-Wechsel Keyframes | Gameplay | ✅ |
| T-03 | Stichphase eigener Zug | Gameplay | ✅ |
| T-04 | Karte-Ausspielen Animation | Gameplay | ✅ |
| T-05 | Stichphase Gegner am Zug | Gameplay | ✅ |
| T-06 | Ansage-Buttons | Gameplay | ✅ |
| T-07 | Armut-Tausch-UI | Gameplay | ✅ |
| T-08 | Spielprotokoll-Overlay | Gameplay | ✅ |
| T-09 | Einstellungs-Modal | Gameplay | ✅ |
| T-10 | Seitenlade offen | Gameplay | ✅ |
| T-11 | Letzter-Stich-Overlay | Gameplay | ✅ |
| T-12 | Rundenauswertungs-Modal | Gameplay | ✅ |
| T-13 | Partie-Ende-Modal | Gameplay | ✅ |
| F-01 | Flash SpielGestartet | Gameplay | ✅ |
| F-02 | Flash VorbehaltErwartet | Gameplay | ✅ |
| F-03 | Flash NaechsterSpieler | Gameplay | ✅ |
| F-04 | Flash StichAbgeschlossen | Gameplay | ✅ |
| F-05 | Flash Schweinchen (best-effort) | Gameplay | ✅ |
| F-06 | Flash Fuchs (best-effort) | Gameplay | ✅ |
| F-07 | Flash Karlchen (best-effort) | Gameplay | ✅ |
| F-08 | Flash Doppelkopf (best-effort) | Gameplay | ✅ |
| F-09 | Flash Hochzeit (best-effort) | Gameplay | ✅ |
| F-10 | Flash SpielBeendet | Gameplay | ✅ |
| A-01 | Austeilen Keyframe | Gameplay | ✅ |
| A-02 | Ansage-Banner | Gameplay | ✅ |
| A-03 | Solo-Ankündigung (best-effort) | Gameplay | 🔲 |
| A-04 | Bockrunde (best-effort) | Gameplay | 🔲 |
| A-05 | Stich-Einziehen Keyframe | Gameplay | 🔲 |
| X-01 | Fehler-Toast | Gameplay | 🔲 |
| X-02 | Info-Toast | Gameplay | 🔲 |
| X-03 | Debug-Modus | Gameplay | 🔲 |

**Stand:** 40/46 abgedeckt → 6 offen. (S-00..S-14 ✅, T-01..T-13 ✅, F-01..F-10 ✅, A-01..A-02 ✅; offen: A-03, A-04, A-05, X-01, X-02, X-03)

## Abgeleitete Build-Tasks

### VISION-LOOP-API (Vorbedingung, niedrig-risiko)

Button-TestIDs und Bridge-Methoden ergänzen ohne fachliche Logik zu ändern:

- `SpielverwaltungsSzene`: `btn-spielregeln`, `btn-rangliste`
- `HilfeSzene`: Tab-Buttons `btn-tab-*`, Zurück-Button `btn-hilfe-zurueck`
- `BestenlisterSzene`: Tab-Buttons `btn-tab-*`, Zurück-Button `btn-bestenliste-zurueck`
- `TischBrücke`: `toggleSpielprotokoll()`, `isPartieEndeModalSichtbar`, `schliessePartieEndeModal()`
- `e2eBruecke.ts`: Typen ergänzen

**DoD:** Alle neuen Test-IDs existieren; bestehende Tests (240→294 FE + 365 BE) weiterhin grün.

### VISION-LOOP-SZENEN (neuer Test, autonom)

Neuer Test `e2e/tests/vision-loop-szenen.spec.ts`:
Screenshots S-00 bis S-14 (Login, Lobby, Hilfe alle 4 Tabs, Rangliste alle 3 Tabs,
Spielerprofil, Tisch-Wartezimmer).

**Hängt an:** `VISION-LOOP-API`

**DoD:** Test läuft grün (beide Projekte, < 30s), alle 15 Screenshots in `e2e/screenshots/` mit Präfix.

### VISION-LOOP-GAMEPLAY-ERWEITERN (erweitern, autonom)

Bestehenden `vision-loop.spec.ts` erweitern:
- T-05, T-08, T-13 (Partie-Ende-Modal, Spielprotokoll)
- F-01 bis F-10 (Flash-Texts bei 0.2×, best-effort, kein Testfehler wenn Event nicht produziert)
- A-01 bis A-05 (Animations-Keyframes)
- X-01 (Fehler-Toast via ungültige Karte)

**Hängt an:** `VISION-LOOP-API` (für Bridge-Methoden)

**DoD:** Test läuft grün (beide Projekte, < 5 min); neue Screenshots vorhanden wenn die
jeweiligen Ereignisse im Spielverlauf auftreten; kein Test-Fehler wenn best-effort-Events
ausbleiben.

## Hinweise zur Umsetzung

### Flash-Text-Screenshots (best-effort Strategie)

```typescript
let flashScreenshotGemacht = { spiel: false, stich: false, beendet: false, /* ... */ };

// Im Event-Handler (TischEreignisHandler abonnieren oder waitForFunction auf Bridge-State):
if (!flashScreenshotGemacht.beendet && zustand.phase === 'STICHPHASE') {
  // Auf SPIEL_BEENDET-Event warten (Bridge-State)
  // Bei 0.2×: Flash-Text ist ~20s sichtbar → einfach zu photographieren
}
```

Die Bridge muss keinen eigenen Event-Hook liefern — `waitForFunction` auf
`window.__locodoko._letzterFlashTyp` (neues Bridge-Feld) reicht.

### Animations-Keyframes (0.2× Strategie)

Für A-01 (Austeilen): Vor SPIEL_GESTARTET auf `0.2×` setzen, dann nach
~500ms Screenshot (Karten in der Luft), dann Turbo.

Für A-05 (Stich-Einziehen): Nach STICH_ABGESCHLOSSEN auf `0.2×`, kurz warten,
Screenshot, dann Turbo.
