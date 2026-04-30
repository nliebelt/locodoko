# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-30 (Plan-Run #91 — B1 untersucht und abgeschlossen)

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

### B2: Schweinchen zeigt keine Wirkung

**Symptom:** Karo-Asse werden trotz aktivem Schweinchen nicht als höchste Trümpfe gewertet.

**Diagnose-Hinweis:**
`hatSchweinchen()` prüft `sr.schweinchenAktiv()` (aus Spielregeln/Config) UND ob ein Spieler
2 Karo-Asse hat. In `locoBlatRegeln()` ist `schweinchenAktiv=true`.
`teileKartenAus()` setzt `trumpfOrdnung = new SchweinchenTrumpfOrdnung(...)` wenn Schweinchen
erkannt. `uebernehmeDomainStand()` → `syncZuPersistenz()` speichert `schweinchenAktivFlag=true`.
Beim Laden: `hydriere()` restauriert `SchweinchenTrumpfOrdnung` aus `schweinchenAktivFlag`.

**Zu prüfen:**
- Integration-Test mit kontrollierten Händen (ein Spieler hat beide Karo-Asse), Loco-Blatt-Preset.
  Prüfen ob `Spiel.schweinchenAktiv()` nach `teileKartenAus()` + save + reload `true` zurückgibt.
- `SchweinchenTrumpfOrdnung.vergleiche()`: prüfen ob Karo-As tatsächlich Rang 14/15 hat und
  damit Dulle (höchsten Normaltrumpf) schlägt.
- Frontend: Schweinchen-Meldungs-Animation vorhanden? `SCHWEINCHEN_GEMELDET`-Event im
  AppStore vollständig verarbeitet und visuell angezeigt?

**Betroffene Dateien:**
`Spiel.java` (`teileKartenAus`, `hydriere`, `schweinchenAktiv`),
`SchweinchenTrumpfOrdnung.java`, `SchweinchenTest.java`, `Bugfix3Test.java`

---

### B3: Browser-Reload zeigt alten State (Overlays/Animationen des vorherigen Spiels)

**Symptom:** Nach `Strg+R` sind Overlays und Animationen des vorherigen Spiels noch sichtbar,
bevor der neue Snapshot verarbeitet wird.

**Ursache:** `reconnecteTisch()` setzt `partieStand: null` im AppStore, aber
`AnimationenService` hat noch laufende/geplante Animationen in der FIFO-Queue.
TischSzene-interne Zustände (`armutAnnahmeAktiv`, `ausgewaehlteArmutKarten`, offene Overlays)
werden nicht zurückgesetzt bevor der Snapshot rendert.

**Fix:**
1. In `reconnecteTisch()` (AppStore.ts): `AnimationenService.loeschWarteschlange()` aufrufen.
2. TischSzene auf `aktuellerTisch: null`-Patch reagieren: interne Overlay-Zustände zurücksetzen
   (`armutAnnahmeAktiv = false`, `ausgewaehlteArmutKarten.clear()`, offene DOM-Overlays entfernen).
3. `_letztePartieVersion = -1` beim Reconnect (bereits in `reset()` vorhanden, prüfen ob aufgerufen).

**Betroffene Dateien:**
`AppStore.ts` (`reconnecteTisch`), `TischSzene.ts` (Reconnect-Handler), `AnimationenService.ts`

---

### B4: Animations-Queue-Aufstauung bei schnellen KI-Zügen

**Symptom:** Zwei Stiche werden gleichzeitig animiert, wenn KI-Züge sehr schnell aufeinander folgen.

**Diagnose-Hinweis:** `AnimationenService` hat eine FIFO-Queue (`reiheEin`), aber zwischen
Event-Verarbeitung und `triggerRender()` könnte ein Re-Render stattfinden, der eine bereits
animierte Karte in den Endzustand springt, bevor die Animation abgeschlossen ist.

**Zu prüfen:**
- Spec `architektur-domain-events.md` Z. 29ff: "Render-Update für animierte Karte sperren
  bis Animation fertig". Ist diese Sperre für `KARTE_GESPIELT`-Events implementiert?
  (AppStore.ts Z. 586: `KARTE_GESPIELT` wird anders behandelt — prüfen ob das ausreicht)
- AnimationenService: Kann `loeschWarteschlange()` versehentlich laufende Animationen abbrechen?

**Betroffene Dateien:**
`AnimationenService.ts`, `AppStore.ts` (KARTE_GESPIELT-Handling), `TischSzene.ts`

---

## P2 — Fehlende Features

### F1: Self-Healing Event-Queue im Frontend

**Anforderung:** Spec `architektur-domain-events.md` Z. 29:
> Bei Lücken (`E > letzteVersion + 1`) fordert der Store automatisch einen HTTP-Snapshot an.

**Aktueller Stand:** `AppStore.ts` Z. 577–579: Lücke wird geloggt, aber TODO-Kommentar statt
echtem Self-Healing: `// TODO: this.reconnecteTisch(this.zustand.aktuellerTisch!.id);`

**Fix:**
```typescript
if (!istSnapshot && ereignis.version > this._letztePartieVersion + 1) {
  Logger.error(`Sequenz-Luecke erkannt! Erwartet ${this._letztePartieVersion + 1}, erhalten ${ereignis.version}`);
  const tischId = this.zustand.aktuellerTisch?.id;
  if (tischId) this.reconnecteTisch(tischId);
  return; // Dieses Event verwerfen, Snapshot wird neu geliefert
}
```
Sicherstellen dass `reconnecteTisch()` idempotent ist und keine Doppel-Reconnects auslöst.

**Betroffene Dateien:** `AppStore.ts`

---

### F2: Armut ANBIETEN-Modus — Kartenauswahl-UI prüfen

**Anforderung:** Spec `armut.md` vollständig lesen (Status: Zu prüfen). Der Armut-Spieler
muss im `ANBIETEN`-Modus genau 3 Trumpfkarten auswählen und zum Tausch anbieten.

**Aktueller Stand:** `renderArmutBereich()` zeigt Annehmen/Ablehnen-Buttons im `ANTWORTEN`-Modus.
Für `ANBIETEN`-Modus: `armutAnnahmeAktiv = false` gesetzt, Karten toggle-fähig via
`toggleArmutKarte()`. Ob ein "Anbieten"-Bestätigungs-Button und eindeutiger visueller Hinweis
vorhanden ist, unklar.

**Vorgehen:**
1. `armut.md` vollständig lesen.
2. `renderArmutBereich()` + `TischInputHandler.ts` für ANBIETEN-Flow nachverfolgen.
3. Falls Lücken: UI-Elemente für ANBIETEN ergänzen.

**Betroffene Dateien:** `TischSzene.ts` (`renderArmutBereich`), `TischInputHandler.ts`, `armut.md`

---

### F3: Bockrunden-Zustand persistent im UI anzeigen

**Anforderung:** Spec `frontend-tischansicht.md` (Status: Zu prüfen) — prüfen ob eine
persistente Bockrunden-Anzeige (z.B. Indikator im HUD) gefordert ist.

**Aktueller Stand:** `TischSzene.ts` Z. 403–406: Bockrunden-Animation wird nur beim
`SPIEL_GESTARTET`-Event kurz eingeblendet. Kein persistenter UI-Indikator erkennbar.

**Vorgehen:**
1. `frontend-tischansicht.md` vollständig lesen.
2. Falls HUD-Anzeige gefordert: kleinen Bockrunden-Counter im Tisch-HUD hinzufügen.

**Betroffene Dateien:** `TischSzene.ts`, `frontend-tischansicht.md`

---

### F4: Space Grotesk Schriftart laden

**Anforderung:** Spec `frontend-visuelles-design.md` — „Space Grotesk" Schriftart.

**Aktueller Stand:** Schriftart in CSS referenziert, aber nicht in `AssetLoader.ts` oder
`main.ts` via `document.fonts.load()` oder WebFont-Loader vorgeladen.

**Fix:** In `main.ts` oder `AssetLoader.ts` Space Grotesk via WebFont API vorladen, bevor
die erste Szene gerendert wird. Font-WOFF2-Datei in `/public/assets/fonts/` ablegen.

**Betroffene Dateien:** `main.ts`, `AssetLoader.ts` (falls vorhanden), CSS

---

### F5: CSS Custom Properties für Farbpalette

**Anforderung:** Spec `frontend-visuelles-design.md` — Farbpalette als CSS Custom Properties.

**Aktueller Stand:** Hex-Werte sind hardcoded im TypeScript-Code (`TischSzene.ts` etc.).

**Fix:** CSS-Variablen in `src/styles/variables.css` (oder ähnlich) definieren, in Phaser-
Code über `getComputedStyle(document.documentElement).getPropertyValue('--farbe-xyz')` lesen.

**Betroffene Dateien:** Neue CSS-Datei, `TischSzene.ts` und andere Szenen-Dateien

---

### F6: Toast-Notifications vollständig integrieren

**Anforderung:** Spec `frontend-ui-logik.md` — Toast-Notifications für Fehlermeldungen
und Spielereignisse.

**Aktueller Stand:** `ToastManager` existiert, ist aber laut Analyse nicht vollständig
integriert für alle Fehlermeldungen (z.B. WebSocket-Fehler, abgelehnte Aktionen).

**Vorgehen:**
1. `frontend-ui-logik.md` lesen (Status prüfen).
2. Offene Integration-Punkte identifizieren.
3. `AKTION_ABGELEHNT`-Events → Toast; WebSocket-Disconnect → Toast.

**Betroffene Dateien:** `ToastManager.ts`, `AppStore.ts`, `TischSzene.ts`

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
