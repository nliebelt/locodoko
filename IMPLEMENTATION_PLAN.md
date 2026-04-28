# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-28 (Plan-Run #67 — Fokus: BUG-SCHWEINCHEN)

**Was wurde implementiert:**
- BUG-SCHWEINCHEN: Karo-Asse werden jetzt als höchste Trümpfe behandelt wenn Schweinchen aktiv.
  - `trumpfOrdnungFuer(SOLO_TRUMPF)` → jetzt `hatSchweinchen()` ? SchweinchenTrumpfOrdnung : NormaleTrumpfOrdnung (vorher immer NormaleTrumpfOrdnung)
  - `trumpfOrdnungFuer(HOCHZEIT/ARMUT)` → jetzt immer NormaleTrumpfOrdnung (vorher fälschlicherweise Schweinchen aktiv)
  - `nimmArmutAn()` → jetzt immer NormaleTrumpfOrdnung (kein Schweinchen in Armut nach Kartentausch)
  - `trumpfOrdnungFuerPersistiertenStand()` → HOCHZEIT/ARMUT liefern jetzt NormaleTrumpfOrdnung
  - 3 fehlerhafte Tests korrigiert, 2 neue Tests hinzugefügt (stichGewinner, armutDeaktiviert)
- SPEC-SCHWEINCHEN: specs/schweinchen.md bereinigt (Widerspruch zwischen Beschreibung und Anforderungen behoben, SOLO_TRUMPF korrekt eingeschlossen, Bug-Eintrag entfernt)
- 283 Tests grün.

**Nächste Priorität:** BUG-FE-SORTIERUNG (Farbsoli werden wie Normalspiele sortiert), dann BUG-SICHERHEIT-PROFIL (fehlende @PreAuthorize auf SpielerProfilController).

---

## Phase 1 — Kern-Stabilität & Spec-Fixes (PRIO)

### BUG-KI-HAENGER-FUCHS (Backend)
**Problem:** KI bleibt stehen nach Sonderpunkten (Fuchs gefangen etc.).
- [x] Backend: `triggereKi()` wird korrekt via `finally`-Block in `automatisiereTisch()` aufgerufen. Behoben in Commit `4f705b1 REGELN-2`.
- [x] Validation: `KiOrchestrierungServiceIntegrationTest` — alle 5 Tests grün.

### FEAT-LOCO-PRESET (Backend)
**Problem:** Code nutzte 48 Karten, Spec fordert 40 (ohne Neunen).
- [x] Backend: `Spielregeln.locoBlatRegeln()` auf `ohneNeunen = true`, Ansagegrenzen `9,8,7,6,5`.
- [x] Backend: Kommentar verweist auf `specs/regelkatalog.md`.
- [x] Spec: `specs/tischkonfiguration.md` — `ohneNeunen` auf `true` korrigiert.
- [x] Tests: Alle betroffenen Tests angepasst.
- [x] Validation: `mvn test` — alle 282 Tests grün.

### BUG-SCHWEINCHEN (Backend)
**Problem:** Karo-Asse werden trotz aktivem Schweinchen nicht als höchste Trümpfe behandelt.
Analyse (Plan-Run #65): `SchweinchenTrumpfOrdnung` weist korrekte Ränge 14/15 zu — der Bug lag in der Spieltyp-Zuordnung, nicht in der Trumpfordnung selbst.
- [x] Backend: `trumpfOrdnungFuer(SOLO_TRUMPF)` → `hatSchweinchen()` ? SchweinchenTrumpfOrdnung : NormaleTrumpfOrdnung (vorher ignoriert).
- [x] Backend: `trumpfOrdnungFuer(HOCHZEIT/ARMUT)` → immer NormaleTrumpfOrdnung (vorher fälschlicherweise Schweinchen aktiv).
- [x] Backend: `nimmArmutAn()` → immer NormaleTrumpfOrdnung nach Kartentausch (Armut nutzt nie Schweinchen).
- [x] Backend: `trumpfOrdnungFuerPersistiertenStand()` → HOCHZEIT/ARMUT liefern NormaleTrumpfOrdnung.
- [x] Validation: 3 fehlerhafte Tests korrigiert, 2 neue Tests (Stichgewinner + Armut-Ausschluss). 283 Tests grün.

### BUG-FE-SORTIERUNG (Frontend)
**Problem:** Farbsoli werden wie Normalspiele sortiert (Herz-10 falsch oben).
- [ ] Frontend: `TischAnsichtModell.ts` — `istTrumpfFuerSpieltyp()` und `trumpfRang()` für Farbsoli (HERZ, PIK, KREUZ, KARO) implementieren.
- [ ] Validation: Manueller Test im Farbsolo.

### BUG-SICHERHEIT-PROFIL (Backend)
**Problem (neu — Plan-Run #65):** `SpielerProfilController` PUT-Endpoint hat keine Autorisierungsprüfung — jeder Spieler kann fremde Profile überschreiben.
Entscheidung: Spec ist korrekt (nur eigenes Profil darf geändert werden).
- [ ] Backend: `SpielerProfilController.aktualisiereSpielerprofil()` — `@PreAuthorize("@tischSicherheit.istSpielerSelbst(#spielerId)")` oder analoge ABAC-Prüfung ergänzen.
- [ ] Validation: `mvn test` + Test mit falschem Spieler-Token ergibt HTTP 403.

### BUG-DTO-MASKIERUNG (Backend)
**Problem (neu — Plan-Run #65):** `sichtbareHandkarten` in der Snapshot-Antwort darf für andere Spieler keine `karteId` enthalten (sonst können andere Spieler Karten einsehen).
Entscheidung: Spec ist korrekt — karteId ist nur dem Karteninhaber sichtbar.
- [ ] Backend: Snapshot-DTO / `PartieStandAntwort` — für fremde Handkarten `karteId = null` setzen (nur Anzahl/Rücken sichtbar).
- [ ] Validation: Integration-Test: Spieler B erhält Snapshot → `handkarten` von Spieler A haben keine karteId.

---

## Phase 2 — KI-Kalibrierung & Bockrunden (UX)

### FEAT-KI-SOLO-VORSICHT (Backend)
**Problem:** KI spielt zu viele (verlierende) Soli, besonders ohne Neunen.
Hinweis (Plan-Run #65): `specs/solo-farbsolo.md` definiert eine 46-Punkte-Schwelle für KI-Farbsolo-Bewertung — prüfen ob diese in `StandardKiStrategie` fehlt (separate Logik von `soloSchwelle`).
- [ ] Backend: `StandardKiStrategie.java` — `soloSchwelle` Erhöhung von 13% auf 25% (Sicherheitsmarge).
- [ ] Backend: Zusätzlichen Malus (z.B. +5 Punkte auf Schwelle) einbauen, wenn `ohneNeunen` aktiv ist.
- [ ] Backend: Farbsolo-Bewertung prüfen — laut `specs/solo-farbsolo.md` soll KI Farbsolo nur spielen wenn ≥46 Punkte in der Farbe zu holen sind. Fehlende Methode ergänzen.
- [ ] Validation: Beobachtung im Testlauf (Solo-Frequenz prüfen).

### FEAT-SCHWEINCHEN-ANSAGE (Backend)
**Problem (neu — Plan-Run #65):** DKV-Regel: Wenn ein Spieler das erste Karo-As ausspielt und Schweinchen aktiv ist, soll eine explizite `SCHWEINCHEN_GEMELDET`-Meldung ans Frontend gesendet werden (Anzeige "Schweinchen!").
Entscheidung: Spec ist korrekt, bisher nur implizit.
- [ ] Backend: `SpielAktionsService.spieleKarte()` — beim Ausspielen des ersten Karo-As und aktivem Schweinchen ein `SchweinchenGemeldet`-Event publizieren.
- [ ] Backend: `KiOrchestrierungService` — Event als WebSocket-Nachricht an alle Spieler senden.
- [ ] Frontend: Toast/Anzeige "Schweinchen!" im `TischUIManager` bei Empfang des Events.
- [ ] Validation: `mvn test` + E2E-Test mit Schweinchen-Szenario.

### FEAT-BOCK-CONFIG (Backend)
**Problem:** "Herz durchgegangen" soll konfigurierbar sein.
- [ ] Backend: `TischKonfiguration` um `herzDurchgegangenNurHoch: boolean` erweitern.
- [ ] Backend: `Spiel.java` — Trigger-Bedingung für Bockrunde von dieser Option abhängig machen.

---

## Phase 3 — Spielfluss-Automatisierung

### FEAT-COUNTDOWN (Backend + Frontend)
- [ ] Backend: `TischEreignisTyp.COUNTDOWN_TICK` einführen.
- [ ] Backend: Nach `markiereAlsBeendet()` einen Timer (10s) starten, der jede Sekunde ein Event sendet.
- [ ] Backend: Bei Ablauf neue Partie automatisch starten.
- [ ] Frontend: Countdown-Anzeige im Rundenauswertungs-Overlay.

---

## Phase 4 — Offene UI-Punkte

- [ ] FEAT-HUD-SIDEBAR: "Letzte 3 Stiche" in der Phaser-Sidebar implementieren (derzeit leer).
- [ ] BUG-STICH-UMDREHEN: Erlauben, alle Stiche umzudrehen (nicht nur den eigenen).
- [ ] FEAT-LOBBY-POLLING: Liste offener Tische im Startscreen funktional machen.

### FEAT-ANSAGEN-FAB (Frontend)
**Problem (neu — Plan-Run #65):** `frontend-ui-logik.md` fordert eine "Floating Action Bar" für Re/Kontra-Ansagen zwischen Stichmitte und Kartenfächer. Aktuell nur `//TODO`-Kommentar in `TischUIManager.ts`.
- [ ] Frontend: `TischUIManager.ts` — Floating Action Bar mit Re/Kontra-Buttons implementieren (nur sichtbar wenn `kannAnsagen()` true).
- [ ] Frontend: Buttons triggern WebSocket-Message `/ansage` mit Ansagetyp.
- [ ] Validation: `npm test` + `npm run build`.

### FEAT-SEITENLADE (Frontend)
**Problem (neu — Plan-Run #65):** Info-Panel (Spielerstand, Ansagehistorie, Stichübersicht) ist laut `frontend-ui-logik.md` spezifiziert, aktuell nur Stub.
- [ ] Frontend: `[≡]`-Button öffnet Panel mit aktuellem Spielerstand (Augen pro Partei), Ansagehistorie und letzten Stichen.
- [ ] Frontend: Panel schließt sich bei erneutem Klick oder Escape.
- [ ] Validation: `npm test` + `npm run build`.

### FEAT-EINSTELLUNGS-MODAL (Frontend)
**Problem (neu — Plan-Run #65):** Einstellungs-Modal (`[⚙]`) für Hintergrund, KI-Schwierigkeit und Animationsgeschwindigkeit ist laut `frontend-ui-logik.md` spezifiziert, aktuell nur `getEinstellungsModalEl()` ohne Implementierung.
- [ ] Frontend: Einstellungs-Modal mit drei Optionen implementieren.
- [ ] Frontend: Animationsgeschwindigkeit persistiert in `localStorage` und wird beim Start aus `AppStore` übernommen.
- [ ] Validation: `npm test` + `npm run build`.

---

## Phase 5 — Backlog (kein aktueller Blocker)

### FEAT-SCHMEISSEN (Backend)
**Problem (neu — Plan-Run #65):** `specs/spielablauf.md` definiert Schmeißen-Regeln ("Fünf Neunen", "Wenig Trumpf"), aber nicht implementiert.
- [ ] Backend: `Vorbehalt.java` / `VorbehaltPhase` — Schmeißen als höchste Priorität (Prio 4) implementieren.
- [ ] Backend: Zwei Schmeißen-Gründe: `FUENF_NEUNEN` (≥5 Neunen auf Hand) und `WENIG_TRUMPF` (≤2 Trümpfe).
- [ ] Backend: Bei Schmeißen: Karten neu mischen und verteilen (neue VorbehaltRunde).
- [ ] Validation: Unit-Tests für beide Schmeißen-Fälle.

### TASK-AUTH-FORMLOGIN (Backend)
**Problem (neu — Plan-Run #65):** `authentifizierung.md` spricht von Username/Passwort parallel zu OAuth2, aber `formLogin` ist im Code disabled. Prüfen ob dies Absicht ist.
- [ ] Backend: `SecurityConfiguration.java` — `formLogin` und `LocodokoBenutzerdienst` prüfen: ist Passwort-Auth explizit deaktiviert oder vergessen?
- [ ] Entscheidung dokumentieren (Kommentar im Code oder Spec-Update).

---

## Spec-Updates
- [x] SPEC-SOLO: Text an 25% Anpassung anpassen.
- [x] SPEC-LOCO: Im Code dokumentiert.
- [ ] SPEC-SCHWEINCHEN: `specs/schweinchen.md` — bekannten Bug-Eintrag entfernen sobald BUG-SCHWEINCHEN gefixt ist; Gültigkeit für Soli (Solo-Trumpf = AN, andere Soli = AUS) dokumentieren.
- [ ] SPEC-AUTH: `specs/authentifizierung.md` — nach TASK-AUTH-FORMLOGIN klären ob Passwort-Auth-Abschnitt entfernt oder aktualisiert werden muss.
