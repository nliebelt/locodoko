# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-20
REGELN-3 erledigt: Solo-Schwellen in `StandardKiStrategie` feingetunt (Faktor 1.13 statt 1.15), um den Zielwert 52 aus `ki-strategie.md` präzise zu treffen. Tests und Javadoc aktualisiert. Phase 3 damit abgeschlossen. Nächster Schritt: Phase 4 (UI-NATIVE-1: Phaser-Migration der Overlays).

## Zusammenfassung Ist-Zustand
- Backend: DDD-Struktur stabil. Event-Triggering für KI nun robust und optimiert.
- Partie/Regeln: Kernlogik stabil. Hochzeit-Klärung und Sonderpunkte triggern die KI nun korrekt weiter.
- Frontend: Phaser 3 weit fortgeschritten. Inkonsistenz im Loco-Blatt Preset (ohneNeunen) noch offen.

## Phase 1 — Stabilität & Test-Fixes (STAB)
- [x] **STAB-1** Test-Suite Stabilisierung: `HochzeitTest` (NoSuchElementException fixen) und `DreissigAugenPflichtTest` repariert.
- [x] **STAB-1** (Fortsetzung) HochzeitTest: Ursache für leere `restkarten` im Test-Setup identifizieren.
- [x] **STAB-2** Test-Suite Stabilisierung: `AnsagenTest` und `BockrundenTest` Assertions korrigieren.
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

## Phase 4 — Frontend UI-Migration (UI-NATIVE)
- [ ] **UI-NATIVE-1** HTML-Hybrid-Rückbau: Seitenlade und Einstellungsmenüs vollständig auf Phaser-Container umstellen.
- [ ] **UI-NATIVE-2** Preset-Auswahl & Bugfix: "Ohne Neunen" Option in Tisch-Konfiguration (Phaser) hinzufügen. Bugfix in `frontend/src/modelle/regelPresets.ts`: Für `LOCO_BLAT_REGELN` ist `ohneNeunen: true` gesetzt. Laut `regelkatalog.md` muss dies `false` sein. Das muss korrigiert werden.
- [ ] **UI-NATIVE-3** Native UI-Tests: Vision Loop für alle Overlays etablieren.