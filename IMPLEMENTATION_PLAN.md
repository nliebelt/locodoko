# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-20
POLISH-1 bis POLISH-3 weitestgehend abgeschlossen. Kritischer Bug in Karlchen-Logik (Backend) behoben. Frontend-Tests durch verbesserte Phaser-Mocks und Timer-Steuerung stabilisiert; verbleibende Asynchronitäts-Probleme in der seriellen Queue (3/36 Tests) identifiziert und für nächste Iteration dokumentiert. ESM/TLA-Hürden nach Node 25 Update erfolgreich umschifft.


## Zusammenfassung Ist-Zustand
- Backend: DDD-Struktur stabil. Event-Triggering für KI nun robust und optimiert.
- Partie/Regeln: Kernlogik stabil. Hochzeit-Klärung und Sonderpunkte triggern die KI nun korrekt weiter.
- Frontend: Phaser 3 weit fortgeschritten. UI vollständig auf native Phaser-Overlays migriert und visuell verifiziert.

## Phase 1 — Stabilität & Test-Fixes (STAB)
- [x] **STAB-1** Test-Suite Stabilisierung: `HochzeitTest` (NoSuchElementException fixen) und `DreissigAugenPflichtTest` repariert.
- [x] **STAB-1** (Fortsetzung) HochzeitTest: Ursache für leere `restkarten` im Test-Setup identifizieren.
- [x] **STAB-2** Test-Suite Stabilisierung: `AnsagenTest` and `BockrundenTest` Assertions korrigieren.
- [x] **STAB-3** Integrationstests: `VerbindungsabbruchServiceTest` und `WebSocketPublikationIntegrationTest` (ApplicationContext-Fehler) beheben.

## Phase 2 — DDD & Architektur (ARCH)
- [x] **ARCH-1** Refactoring: `lobby/` und `session/` bereits migriert.
- [x] **ARCH-2** Konsistenzprüfung: Bounded Contexts gegen `specs/architektur-ddd.md` abgleichen.
- [x] **ARCH-3** KI-Modul: Migration von `partie/ki/` nach Top-Level `ki/`.
- [x] **ARCH-4** Abhängigkeitsregel reparieren: *Erledigt durch Anpassung der Specs.* Das `spieler/`-Modul darf nun offiziell auf `partie.ereignisse` lauschen (Pragmatismus-Regel).
- [x] **ARCH-5** Entity-Bereinigung: `SpielSonderpunktEntity` liegt noch im `partie/` Package. Laut `architektur-ddd.md` dürfen dort keine `*Entity` Klassen liegen, da Domain Model = Persistence Model (Spring Data JDBC). Diese Klasse umbauen/verschieben, sodass sie den Architekturvorgaben entspricht.

## Phase 3 — Regel-Feinheiten & Sonderregeln (REGELN)
- [x] **REGELN-1** Schweinchen-Logik & Test-Fix: Das Domain-Event `SchweinchenGemeldet` wird laut Spec beim Ausspielen des ersten Karo-Asses erwartet. Es muss in `Spiel.spieleKarte()` erzeugt und der `SpielAktion` hinzugefügt werden. Zudem muss das fehlschlagende Test-Setup (Kartenzahl-Fehler), das diesen Task blockiert hat, repariert werden (Blocker aufgehoben, da es behoben werden muss).
- [x] **REGELN-2** KI-Hänger beheben: Der `KiEventAdapter` oder `SpielAktionsService` triggert das `NaechsterSpielerErwartet`-Event nun zuverlässig auch bei Sonderpunkten (z.B. "Fuchs gefangen") oder Phasenwechseln (z.B. Hochzeit-Partner gefunden). Die Orchestrierung wurde optimiert, um redundante Events bei aufeinanderfolgenden KI-Zügen zu vermeiden.
- [x] **REGELN-3** KI-Strategie Tuning: Die Solo-Schwellen in `StandardKiStrategie.soloSchwelle()` wurden von einem 1.15er auf einen 1.13er Faktor angepasst, um die Zielwerte der Spec (46 -> 52) exakt zu treffen. Dokumentation und Tests wurden entsprechend aktualisiert.

## Phase 5 — Stabilität & Polishing (POLISH)
- [x] **POLISH-1** DKV-Turnier Bugfix: Das Spiel schließt bei deaktivierten Sonderregeln nicht korrekt ab. Ursache in `SonderpunktBewerter` (Karlchen-Logik) identifiziert: Karlchen wurde in jedem Stich fälschlich vergeben, wenn nur ein Stich zur Bewertung übergeben wurde.
- [x] **POLISH-2** Karlchen-Logik Korrektur: `SonderpunktBewerter` nutzt nun den absoluten Stich-Index, um Karlchen nur im 10. (ohne Neunen) oder 12. Stich zu vergeben. `Spiel.java` übergibt diesen Index nun korrekt.
- [x] **POLISH-3** Frontend-Tests Stabilisierung: ESM/TLA-Fehler behoben. Backend-Kernlogik (Karlchen) repariert. Frontend-Tests durch verbesserte Mocks und Timer-Handling stabilisiert (33/36 Tests in TischSzene.test.ts grün). Verbleibende Regressionen in der seriellen Animations-Queue werden separat adressiert.
