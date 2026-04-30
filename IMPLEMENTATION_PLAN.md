# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-30 (Plan-Run #95 — F6 implementiert, F1–F6 alle erledigt)

**Was wurde implementiert:** F6 (Toast-Notifications spec-konform korrigiert).

Drei Spec-Verstöße in `ToastManager.ts` + `TischSzene.ts` behoben:
1. Toast-Position: zentriert → **oben rechts** (rechte Kante mit 16px Abstand)
2. Toast-Duration: 3000ms → **4000ms** (Spec: 4 Sekunden)
3. Dedup-Bug: `appStore.quittiereMeldung()` nach `toastManager.zeige()` → verhindert Toast-Spam.
Nebenentdeckung: F1–F5 waren bereits vollständig implementiert (Plan-Noten veraltet).

**Nächster logischer Schritt:** S1 (authentifizierung.md Status aktualisieren) oder S2
(Sonderspiel-Specs Status-Prüfung). S1 ist schnell (nur Spec lesen + aktualisieren).

**Offene Fragen:** WebSocket-Disconnect → Toast ist noch offen (verbindung-State wird
in TischSzene nicht für Toast genutzt). Separater Task wenn gewünscht.

---

## P1 — Kritische Bugs (Spielbarkeit blockiert)

### ~~B1: KI hängt nach Fuchs gefangen / Hochzeit-Partner gefunden~~ ✅ ERLEDIGT

**Ergebnis:** Kein aktiver Bug. Integration-Test `spieltKiWeiterNachFuchsGefangenWennKiDenStichGewinnt`
(in `KiOrchestrierungServiceIntegrationTest`) beweist, dass die KI korrekt weiterläuft:

- Gezielt konstruierter Stich (WEST=Karo-As-1, NORD=Karo-Neun-1, OST=Pik-Bube-1 gewinnt mit FuchsGefangen)
  mit korrektem interleaved Deck (neuer Helfer `gesundesStichspielInterleavt`).
- SUED (Mensch) spielt letzten Zug → `spielAktionsService.spieleKarte()` → `NaechsterSpielerErwartet`
  wird AFTER_COMMIT korrekt getriggert → KiEventAdapter feuert → OST (neuer Aufspieler) spielt.
- Nach dem Aufruf: SUED ist 2. Spieler im neuen Stich (OST → SUED → WEST → NORD), 1 Karte im Stich.

**Nebenentdeckung:** Der bestehende Test `spieltKiWeiterNachFuchsGefangenDurchMensch` leidet unter
einem Deck-Building-Bug: `gesundesStichspiel()` stapelt Hände sequential, `anVierSpielerAusteilen()`
verteilt Round-Robin → Karten landen nicht bei den gewünschten Spielern. Der alte Test testet daher
de facto keinen Fuchs-gefangen-Fall. Der neue Helfer `gesundesStichspielInterleavt()` löst das korrekt
mit `deckReihenfolgeFuerHaende()`.

---

### ~~B2: Schweinchen zeigt keine Wirkung~~ ✅ ERLEDIGT

**Ergebnis:** Bug lag ausschließlich im Frontend. `normaleTrumpfRang()` in `TischAnsichtModell.ts`
ignorierte `schweinchenAktiv` — Karo-Asse wurden immer mit Rang 4 sortiert (unter der Dulle).

**Fix:**
- `LaufendesSpielAntwort` (Backend-DTO + Frontend-Interface) um `schweinchenAktiv: boolean` erweitert.
- `schweinchenAktiv` durch die gesamte Karten-Sortier-Pipeline gezogen:
  `mappeSpielerAusPartie → sortiereSichtbareHandkarten → vergleicheKarten → trumpfRang → normaleTrumpfRang`.
- `normaleTrumpfRang()` berücksichtigt jetzt `exemplarIndex`: bei aktivem Schweinchen erhält
  Karo-As mit exemplarIndex 2 → Rang 15, exemplarIndex 1 → Rang 14 (über Dulle=13).
- Überflüssiger TODO-Kommentar in `NormaleTrumpfOrdnung.java` entfernt (SchweinchenTrumpfOrdnung existiert).
- Neue Tests: Sortier-Test mit `schweinchenAktiv=true`, Backend-Test für `schweinchenAktiv`-Feld.

---

### ~~B3: Browser-Reload zeigt alten State (Overlays/Animationen des vorherigen Spiels)~~ ✅ ERLEDIGT

**Ergebnis:** Bug lag in `TischSzene.ts`. `initialisiereZustand()` fehlten Resets für `armutAnnahmeAktiv`, `ausgewaehlteArmutKarten` und `letzterStichTimer`. Außerdem wurde `initialisiereZustand()` nie beim In-App-Reconnect aufgerufen.

**Fix:**
- `initialisiereZustand()` erweitert um `armutAnnahmeAktiv = false`, `ausgewaehlteArmutKarten.clear()`, `letzterStichTimer?.remove(false)`.
- Store-Subscriber reagiert auf `aktuellerTisch: null`-Transition (Übergang von verbundenem Tisch → Reconnect-Warten) mit Aufruf von `initialisiereZustand()`.
- Guard: nur bei echter Transition `(letzterZustand?.aktuellerTisch !== null → aktuellerTisch === null)`, nicht beim initialen Laden.

---

### ~~B4: Animations-Queue-Aufstauung bei schnellen KI-Zügen~~ ✅ ERLEDIGT

**Ergebnis:** Race Condition in `AppStore._verarbeiteEventQueue()` behoben.
State-Patch kam vor Event-Listener-Aufruf → `triggerRender()` feuerte ohne `_animationLaeuft = true` Guard.
Fix: Listener vor Patch + RAF-Callback Guard in `TischSzene.ts`.

---

## P2 — Fehlende Features

### ~~F1: Self-Healing Event-Queue im Frontend~~ ✅ ERLEDIGT

**Ergebnis:** Bereits vollständig implementiert und getestet (wurde bei Plan-Erstellung übersehen).
`AppStore.ts` Z. 571–576: TODO war schon aktiviert. `setzeTischAbosZurueck()` leert Queue +
resettet `_letztePartieVersion = -1` → impliziter Doppel-Reconnect-Schutz via `_letztePartieVersion >= 0`-Guard.
Test `Self-Healing: fordert automatisch Snapshot an wenn Versionsluecke erkannt wird` vorhanden.

---

### ~~F2: Armut ANBIETEN-Modus — Kartenauswahl-UI prüfen~~ ✅ ERLEDIGT

**Ergebnis:** Bereits vollständig implementiert. `renderArmutBereich()` ANBIETEN-Branch zeigt
Zähler "(X/N gewaehlt)" + "Trumpfkarten anbieten"-Button (aktiv nur bei korrekter Anzahl).
Backend unterscheidet ANBIETEN vs. ANTWORTEN am selben `/armut-antwort`-Endpoint via
`armutSpieler() && !angebotLiegtVor()`. Tests in `TischAnsichtModell.test.ts` vorhanden.

---

### ~~F3: Bockrunden-Zustand persistent im UI anzeigen~~ ✅ ERLEDIGT

**Ergebnis:** Spec `frontend-tischansicht.md` erfordert KEINE persistente HUD-Anzeige.
Nur die 2.5-Sekunden-Animation bei `SPIEL_GESTARTET` ist spezifiziert — diese ist in
`TischSzene.ts` Z. 416–421 korrekt implementiert (nach Austeilen-Animation, wenn
`bockrundenZaehler > 0`). Kein weiterer Handlungsbedarf.

---

### ~~F4: Space Grotesk Schriftart laden~~ ✅ ERLEDIGT

**Ergebnis:** Schriftart wird bereits via Google Fonts CDN-Link in `index.html` mit
`display=swap` geladen. `variables.css` und Phaser-Code referenzieren sie korrekt.

---

### ~~F5: CSS Custom Properties für Farbpalette~~ ✅ ERLEDIGT

**Ergebnis:** CSS Custom Properties sind vollständig in `src/css/variables.css` definiert
(`--farbe-hintergrund`, `--farbe-surface`, etc.). Phaser-Code und CSS verwenden sie bereits.

---

### ~~F6: Toast-Notifications vollständig integrieren~~ ✅ ERLEDIGT

**Ergebnis:** Drei Spec-Verstöße behoben:
1. **Position**: Toast von zentriert auf **oben rechts** korrigiert (16px Randabstand)
2. **Duration**: Standard von 3000ms auf **4000ms** erhöht (Spec: 4 Sekunden)
3. **Dedup**: `appStore.quittiereMeldung()` wird nach `toastManager.zeige()` aufgerufen —
   verhindert Toast-Spam bei Folge-Renders wenn `meldung` im Store gesetzt bleibt.
Neuer Test: "Toast: Meldung wird nach Anzeige quittiert" in `TischSzene.test.ts`.
`AKTION_ABGELEHNT` → Toast läuft bereits via `/user/queue/fehler` (authoritative path).

---

## P3 — Spec-Korrekturen (Inkonsistenzen Spec ↔ Code)

### S1: authentifizierung.md — Status aktualisieren

**Befund:** `authentifizierung.md` hat Status „Zu implementieren", aber OAuth2 (Google) +
Passwort-Auth + SpielerEntity sind vollständig implementiert.

**Aktion:** Spec lesen, tatsächlichen Implementierungsumfang prüfen, Status auf
„Abgeschlossen" oder „Aktive Vorgabe" setzen und Implementierungsnotizen ergänzen.

---

### S2: Sonderspiel-Specs — Status-Prüfung

**Befund:** `hochzeit.md`, `armut.md`, `solo-bube.md`, `solo-dame.md`, `solo-farbsolo.md`,
`solo-fleischlos.md`, `solo-trumpf.md`, `schweinchen.md`, `bockrunden.md`, `sonderpunkte.md`
— alle noch Status „Zu prüfen", obwohl Backend ~85% implementiert ist.

**Aktion:** Jede Spec lesen, gegen Code-Implementation gegenchecken, Status aktualisieren.
Konkrete Lücken (z.B. Frontend-Feedback, Bockrunden-Multiplikation) als eigene Aufgaben
in P1/P2 eintragen, falls noch nicht geschehen.

---

## Erledigte Aufgaben (Referenz)

- DKV-Turnier-Preset: Spiel schließt nicht ab → **BEHOBEN** (laut Tests + `regelkatalog.md`)
- Spring Boot 4 / Java 25 Migration → **Abgeschlossen**
- Vision Loop Bridge → **Aktiv, stabil**
- Alle Solo-Typen (10 Spieltypen) → **Implementiert**
- Stichlogik, Bedienpflicht, Augenverteilung → **Implementiert**
- REST-API, WebSocket STOMP → **Vollständig implementiert**
- AnimationenService FIFO-Queue → **Implementiert** (Race Conditions unter B4 dokumentiert)
- Tastatursteuerung (inkl. Armut A/N-Shortcuts) → **Implementiert**
- Session-Recovery (aktiverTischId, reconnecteTisch) → **Implementiert**
- KI-Orchestrierung (automatisiereTisch-Loop) → **Implementiert**
