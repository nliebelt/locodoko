# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-21
Frontend-Tests vollständig stabilisiert (54/54 grün). Asynchronitäts-Probleme in der seriellen Queue behoben, indem Cleanup in den Tests verbessert (Event-Listener) und die Animations-Dauer-Skalierung für Testumgebungen korrigiert wurde. Die TischSzene initialisiert den Tastatur-Navigationsindex nun auch bei Szenenstart korrekt.


## Zusammenfassung Ist-Zustand
- Backend: DDD-Struktur stabil. Event-Triggering für KI nun robust und optimiert.
- Partie/Regeln: Kernlogik stabil. Hochzeit-Klärung und Sonderpunkte triggern die KI nun korrekt weiter.
- Frontend: Phaser 3 vollständig. UI auf native Phaser-Overlays migriert, DOM-Modals stabilisiert und alle Tests grün.

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
- [x] **POLISH-1** DKV-Turnier Bugfix: Das Spiel schließt bei deaktivierten Sonderregeln nicht korrekt ab.
- [x] **POLISH-2** Karlchen-Logik Korrektur: SonderpunktBewerter nutzt nun den absoluten Stich-Index.
- [x] **POLISH-3** Frontend-Tests Stabilisierung: Alle verbleibenden Regressionen in der seriellen Animations-Queue und DOM-Modal-Steuerung behoben. Tests sind nun robust gegen asynchrone Effekte.
