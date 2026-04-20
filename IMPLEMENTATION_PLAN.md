# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-20
ARCH-5 erledigt: `SpielSonderpunktEntity` wurde aufgelöst und wird nun als JSON-Blob in der `spiel`-Tabelle persisitiert (via `SonderpunktJsonEintrag`), um den DDD-Vorgaben zu entsprechen. Nächster logischer Schritt ist REGELN-1 (Schweinchen-Logik & Test-Fix).

## Zusammenfassung Ist-Zustand
- Backend: DDD-Struktur umgesetzt. Pragmatische Abhängigkeitsregel erlaubt es dem `spieler/` Modul nun offiziell, auf Events aus `partie/` zu lauschen.
- Partie/Regeln: Kernlogik stabil. Schweinchen-Event-Generierung fehlt im Kern (`Spiel.spieleKarte`). KI hängt bei bestimmten Sonderpunkten.
- Frontend: Phaser 3 weit fortgeschritten. Inkonsistenz im Loco-Blatt Preset (ohneNeunen).
- Kritisch: Der Blocker in REGELN-1 bezüglich instabiler Integrationstests (Kartenzahl-Fehler) muss aktiv gefixt werden, statt ihn zu ignorieren.

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
- [ ] **REGELN-1** Schweinchen-Logik & Test-Fix: Das Domain-Event `SchweinchenGemeldet` wird laut Spec beim Ausspielen des ersten Karo-Asses erwartet. Es muss in `Spiel.spieleKarte()` erzeugt und der `SpielAktion` hinzugefügt werden. Zudem muss das fehlschlagende Test-Setup (Kartenzahl-Fehler), das diesen Task blockiert hat, repariert werden (Blocker aufgehoben, da es behoben werden muss).
- [ ] **REGELN-2** KI-Hänger beheben: Der `KiEventAdapter` oder `SpielAktionsService` triggert das `NaechsterSpielerErwartet`-Event nicht zuverlässig, wenn Sonderpunkte (z.B. "Fuchs gefangen") ausgewertet werden oder Phasenwechsel stattfinden (z.B. Hochzeit-Partner gefunden). Dies führt zum Stillstand der KI. Das Event muss in diesen Edge-Cases verlässlich ausgelöst werden.
- [ ] **REGELN-3** KI-Strategie Tuning: In `StandardKiStrategie.soloSchwelle()` überprüfen, ob die Schwelle hardcodiert (46) ist oder dynamisch angehoben wird, wie in `ki-strategie.md` gefordert (Anhebung um +15% bei Schweinchen oder 30-Augen-Pflicht). Wenn hardcodiert, Logik entsprechend anpassen.

## Phase 4 — Frontend UI-Migration (UI-NATIVE)
- [ ] **UI-NATIVE-1** HTML-Hybrid-Rückbau: Seitenlade und Einstellungsmenüs vollständig auf Phaser-Container umstellen.
- [ ] **UI-NATIVE-2** Preset-Auswahl & Bugfix: "Ohne Neunen" Option in Tisch-Konfiguration (Phaser) hinzufügen. Bugfix in `frontend/src/modelle/regelPresets.ts`: Für `LOCO_BLAT_REGELN` ist `ohneNeunen: true` gesetzt. Laut `regelkatalog.md` muss dies `false` sein. Das muss korrigiert werden.
- [ ] **UI-NATIVE-3** Native UI-Tests: Vision Loop für alle Overlays etablieren.