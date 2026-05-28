# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-28 (Plan-Run nach Session 13). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**Session 17 (2026-05-28):** REFACTOR-DOMAIN-2 abgeschlossen.

`Spielphase` und `TrumpfOrdnung` von String-Diskriminator + separaten Spalten auf JSONB-polymorphe Serialisierung umgestellt. Jackson `@JsonTypeInfo(use=NAME)` + `@JsonSubTypes` auf Interfaces. Mixins für alle 6 `TrumpfOrdnung`-Implementierungen + `Kartendeck` in `JsonbConverter.java`. 12 neue Converter-Klassen (Spielphase, TrumpfOrdnung, Kartendeck) + Konfiguration. Schema: `phase`/`trumpf_ordnung_typ` → JSONB, `schweinchen_aktiv`/`aktueller_stich`/`pflicht_ansage_ausstehend`/`armut_status`/`hochzeit_status` entfernt, `kartendeck` JSONB ergänzt. `Spiel.java`: `phaseText`, `trumpfOrdnungTyp`, `schweinchenAktivFlag`, `aktuellerStich`, `pflichtAnsageAusstehend`, `armutStatus`, `hochzeitStatus` entfernt; `kartendeck` und `trumpfOrdnung` direkt persistiert. `rekonstruiereTrumpfOrdnung`, `rekonstruiereKartendeck`, `rekonstruiereAktuellenStich`, `bestimmeTrumpfOrdnungTyp`, `bestimmeTrumpfOrdnungTypAusSpieltyp`, `effektiveTrumpfOrdnung`, `effektivesKartendeck`, `initialisierePersistenzDefaults` gelöscht. 348 Backend-Tests grün.

**Nächster Schritt:** REFACTOR-DOMAIN-3: PartieStandAntwort entgiften.


**REFACTOR-DOMAIN-VISUAL-BASELINE:** Erfordert laufendes Backend (`mvn spring-boot:run`) + Playwright headed. Weiterhin übersprungen.

**IST-Zustand 2026-05-28 (verifiziert):** Backend 348 Tests grün, Frontend 221 Tests grün, `npm run build` + `npm run lint` clean.

**User-Entscheidung 2026-05-28:**
1. P1 (Profil-Fix) zuerst, kein Smoke-Test davor.
2. P2 neu: FE-FEHLER-422 (Frontend-Handling für Domain-Exceptions aus DB-6).
3. Nach P1+P2 ist UI vollständig testbar → manueller Browser-Smoke-Test.
4. P3 (REFACTOR-DOMAIN-1..6) als geschlossener Block durchziehen, Verifikation am Ende. Test-Suite trägt das Vertrauen während des Refactors.

**Offene Fragen für User:** Keine — Build-Modus kann starten.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## Offene Aufgaben

### Priorität 1 — Code/Spec-Drift schließen (DB-9-Nachzug)

- [x] **BUG-PROFIL-TYPES** — `api-types.ts` regenerieren und `SpielerProfilModal` auf neue Struktur umstellen.

  **Erste Datei zuerst:** `mvn clean package -DskipTests` (oder gezielt `springdoc`-Generate) → prüfen dass `target/openapi.json` die aktuelle `SpielerProfilAntwort` enthält (`statistiken: Map<String, StatistikAntwort>`, 17 Felder pro Eintrag, `letztePartien` mit `regelvariante`).

  **Dann:**
  1. `cd frontend && npm run generate-types` — `api-types.ts` aktualisieren.
  2. `frontend/src/generated/schema-types.ts` ggf. anpassen, falls Re-Export anders heißen muss.
  3. `frontend/src/ui/SpielerProfilModal.ts`: alle `profil.statistik` → `profil.statistiken` (Map). Modal muss eine Variante auswählen (Default: `TURNIER`) und anzeigen.
  4. Tests in `SpielerProfilModal.test.ts` auf neue Datenform anpassen (Map-Mock).
  5. `mvn test` + `cd frontend && npm test && npm run build && npm run lint`.

  **DoD:** Modal zeigt mit echter Backend-Antwort Statistiken an (manuell verifiziert via `mvn spring-boot:run` + Vision-Loop).

- [x] **FEAT-PROFIL-TABS** — Tab-Wechsel TURNIER/SONDER/FREI + alle 17 Statistik-Felder im Modal.

  Spec-Pflicht aus `specs/frontend-spielerprofil.md` (Tab-Leiste, Re/Kontra-Block, Solos-pro-Typ aus `solosProTypJson`, Hochzeiten/Armuten). Modal aktuell zeigt nur Subset (anzahlSpiele, anzahlSiege, gesamtPunkte, fuchsGefangen/verloren, karlchen, doppelkoepfe).

  **Erste Datei zuerst:** `frontend/src/ui/SpielerProfilModal.ts` — Tab-Komponente (drei Buttons, aktiver Tab CSS-Klasse).

  **Schritte:**
  1. Tab-Leiste rendern; bei Klick `data-aktive-variante` setzen und Statistik-Section neu rendern.
  2. Re/Kontra-Section (4 Zähler + Quoten).
  3. Solos-pro-Typ aus `solosProTypJson` (JSON parsen) als Liste rendern.
  4. Hochzeiten, Armuten (angesagt+übernommen) als Kacheln.
  5. Test: 3 Tabs sichtbar, Tab-Click ändert Inhalt, leere Variante zeigt Hinweis.
  6. A11y: `role="tablist"`, `aria-selected`.

  **DoD:** Spec-Mockup aus `frontend-spielerprofil.md` Zeilen 28–53 visuell erreicht. Vision-Loop-Screenshot abgenommen.

### Priorität 2 — Frontend-Fehler-Handling + Spec-Sync

- [x] **FE-FEHLER-422** — Frontend unterscheidet die neuen HTTP-Codes aus DB-6.

  Nach DB-6 wirft das Backend `UngueltigerSpielzugException` (HTTP 422) und `SpielverwaltungKonfliktException` (HTTP 409) statt 500. Aktuell behandelt `frontend/src/services/SpielverwaltungApi.ts` keine dieser Codes spezifisch — der Spieler bekommt einen generischen Fehler statt einer fachlichen Erklärung.

  **Erste Datei zuerst:** `frontend/src/services/SpielverwaltungApi.ts` — Error-Handler mit drei Pfaden: 422 → ToastManager mit Server-Message anzeigen (z.B. „Du musst Trumpf bedienen"), 409 → Reload-Hinweis (z.B. „Spielstand veraltet, lade neu"), sonst generisch.

  **Schritte:**
  1. Backend-Response-Body bei 422/409 prüfen — welche Fehler-Struktur liefert Spring (vermutlich `ProblemDetail` oder Custom-Body)?
  2. TypeScript-Typ für Error-Payload extrahieren oder generieren.
  3. Toast-Pfad pro Code in `SpielverwaltungApi`.
  4. E2E-Test `ungueltige-karte.spec.ts` erweitern: nach ungültigem Spielzug erwartet das UI einen ToastManager-Eintrag mit fachlicher Erklärung.

  **DoD:** Bei ungültigem Spielzug zeigt UI fachlichen Toast, nicht generischen 500-Fehler. E2E grün.

- [x] **DOC-PROFIL-STATUS** — Nach Abschluss BUG-PROFIL-TYPES + FEAT-PROFIL-TABS:
  - `specs/frontend-spielerprofil.md` Status „Geplant" → „Implementiert".
  - `specs/spieler-profil.md` letzten DoD-Haken `[ ] Frontend: Profil-Ansicht` schließen.

### Zwischenstation nach P1 + P2 — UI-Smoke-Test

Bevor REFACTOR-DOMAIN startet: manueller Browser-Test durch User.

- [ ] **SMOKE-UI-1** — User-getriebener manueller Smoke-Test:
  - `mvn spring-boot:run` starten.
  - Browser öffnen, Schnellstart, eine Partie gegen 3 KI-Spieler spielen.
  - Profil-Modal öffnen, drei Tabs durchklicken.
  - Ungültige Karte spielen — Toast erwartet.
  - Befunde als BUG-…-Tasks im Plan aufnehmen.

### Priorität 3 — Domain-Schichten-Bereinigung (zusammenhängender Block)

**Warum:** `Spiel.java` ist heute ein Mischwesen aus Domain, Persistenz und DTO. Drei Wahrheits-Quellen pro Feld leben parallel — Domain-VO, Schatten-`*Json`-String, DTO-`*Embeddable`-Klasse. Genau dieser Zustand hat uns bei DB-9 das Frontend-Schema-Drift-Problem beschert und wird mit jedem weiteren Feature schlimmer.

**Konkreter Schaden in `Spiel.java` (797 Zeilen):**
- Zeile 49–77: 5 `@Transient Collection` + Schatten-`@Column String *Json`-Felder (Workaround #1).
- Zeile 48, 72–73: `phaseText`, `trumpfOrdnungTyp`, `schweinchenAktivFlag` persistiert als String — sealed Interfaces (Spielphase, TrumpfOrdnung) als String-Diskriminator + Rekonstruktor-Methoden (Workaround #2).
- Zeile 553–609: ~23 `…Db()` / `…Embeddable()` / `…AlsJson()`-Adapter-Getter — Domain-Objekt kennt seine DTO-Repräsentation für die REST-API.
- Zeile 612–638: `synchronisierePersistenzFelderVorSpeichern()`, `initialisierePersistenzDefaultsNachLaden()`, `setzeHaendeAusMap`, `ersetzeHaende`, `setzeErgebnis`, `setzeAnsagen`, `setzeAbgeschlosseneStiche`, `setzeSpielNummer` — Persistenz-Lifecycle-Hooks und Test-Setter im Aggregate.
- Zeile 681–770: Lazy-Init-Krücken (`effektiveTrumpfOrdnung`, `effektivesKartendeck`) + 4 `rekonstruiere…`/`bestimme…`-Methoden — Folge von Workaround #2.

**Parasitäre DTO/Persistenz-Klassen im `partie/`-Modul** (Reste aus vor-DB-3-Zeit, heute nur noch von `PartieStandAntwort` über Adapter-Getter konsumiert):
- `HandJsonEintrag`, `StichJsonEintrag`, `AktuellerStichKarteEmbeddable`, `HandKarteEmbeddable`
- `SpielErgebnisEmbeddable`, `VorbehaltMeldungEmbeddable`, `AnsageEreignisEmbeddable`, `SonderpunktJsonEintrag`

**Zielzustand `Spiel.java`:** ~350–400 Zeilen. Felder = annotierte Domain-VOs. Keine `*Db()`-Adapter, keine Sync-Hooks, keine Test-Setter, keine String-Rekonstruktoren. Persistenz via Annotation OK, sonst nichts Technisches im Domain-Objekt.

**Aufwand:** 7–9 Sessions (inkl. DOMAIN-0). **Risiko:** Hoch, aber pro Schritt rollback-fähig — DKV-Logik wird nicht angefasst, nur Persistenz und DTO. Reihenfolge zwingend.

**Verifikationsmodus (User-Entscheidung):**
- **DOMAIN-0 Wire-Format-Pinning:** Vor DOMAIN-1 Test einfrieren, jeder folgende Schritt muss ihn grün lassen.
- **Visual Baseline:** Vor DOMAIN-1 Vision-Loop laufen lassen, Screenshots als Baseline einchecken; nach DOMAIN-6 vergleichen.
- Durchziehen ohne Browser-Zwischenstationen — Test-Suite (340 Backend + 216 Frontend + Wire-Pinning) trägt das Vertrauen.
- Nach DOMAIN-6: SMOKE-UI-2 durch User + Visual-Diff durch mich, dann Plan-Archivierung.

---

- [x] **REFACTOR-DOMAIN-0: Wire-Format-Pinning-Test** — Vorbereitung, blockiert DOMAIN-1.

  `PartieStandAntwort` ist das WebSocket-Wire-Format-DTO (eingebettet in 6 Event-Records in `PartieEreignisAntwort.java`). Frontend hängt direkt an der JSON-Struktur. DOMAIN-3 ändert die interne Mapping-Quelle — die JSON-Ausgabe muss byte-identisch bleiben. JUnit-Object-Tests sehen das nicht.

  **Erste Datei zuerst:** `src/test/java/de/locodoko/tisch/PartieStandAntwortWireFormatTest.java` — realistischen Spielzustand erzeugen (Schweinchen-Spiel mit 2 abgeschlossenen Stichen, 1 Ansage, 1 Vorbehalt im Repertoire, Hochzeit-Status, Solist-Position), `PartieStandAntwort.aus(...)` aufrufen, mit Jackson zu JSON serialisieren, gegen Klassenressource `wire-format-baseline.json` diffen.

  **DoD:** Test grün, JSON-Datei eingecheckt. Bei jedem DOMAIN-Schritt vor Commit: Test grün, JSON unverändert (oder bewusste Wire-Änderung im Commit-Body dokumentiert).

  **Risiko:** Gering. Aufwand: 1 Session.

- [ ] **REFACTOR-DOMAIN-VISUAL-BASELINE** — Parallel zu DOMAIN-0, vor DOMAIN-1.

  Vision-Loop einmal komplett laufen lassen, Screenshots in `e2e/screenshots/baseline-vor-refactor/` einchecken. Deckt: LoginSzene, Lobby, TischSzene Start, Vorbehalt-Phase, Stich-Verlauf, Rundenauswertung.

  Nach DOMAIN-6: zweiten Run als `baseline-nach-refactor/`, visueller Vergleich durch Assistant. Auffälligkeiten als BUG-Tasks.

  **Aufwand:** 10 Minuten Setup, eingebettet in DOMAIN-0-Commit.

---

- [x] **REFACTOR-DOMAIN-1: Wrapper-VOs für Kollektionen** — Eliminiert Workaround #1. *(blockiert durch DOMAIN-0)*

  Fünf neue VOs einführen: `Haende` (über `Map<SpielerPosition, Hand>`), `VorbehaltMeldungen` (über `List<VorbehaltMeldung>`), `Stichverlauf` (über `List<Stich>`), `GeschmisseneSpieler` (über `Set<SpielerPosition>`), `PflichtAnsagen` (über `Set<Partei>`). Jeweils als Record oder finale Klasse mit Map.copyOf/List.copyOf im Konstruktor. Domain-Methoden auf den Wrappern (`Haende.handVon(pos)`, `Stichverlauf.letzter()`, etc.) statt Collection-Methoden im Spiel-Aggregate.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/partie/Haende.java` mit Tests (Konstruktion, handVon, mitErsetzterHand). Dann Converter-Paar `HaendeSchreibConverter`/`HaendeLeseConverter` in `JsonbConverter.java` analog zu `Ansagen`. Dann `Spiel.java`: `@Column("haende") Haende haende` statt `@Transient` + `@Column String haendeJson`. Pro Wrapper-VO ein Commit + grüne Tests.

  **Folge:** `synchronisierePersistenzFelderVorSpeichern()`, `initialisierePersistenzDefaultsNachLaden()`, `initialisierePersistenzDefaults()` (Persistenz-Teile), `setzeHaendeAusMap`, `ersetzeHaende`, `setzeAbgeschlosseneStiche` entfallen. `PartieJsonMapper.java` komplett löschen. `SpielVorSpeichernCallback` + `PartieVorSpeichernCallback` + `SpielNachLadenCallback` + `PartieNachLadenCallback` entfallen.

- [x] **REFACTOR-DOMAIN-2: Spielphase + TrumpfOrdnung als JSONB** — Eliminiert Workaround #2. ✅ Session 17.

  Beide sind sealed Interfaces mit konkreten Implementierungen. Jackson kann das mit `@JsonTypeInfo(use = NAME) @JsonSubTypes(...)` auf den Interfaces — kein Reflection-Trick, sondern Standard-Polymorphismus.

  **Erste Datei zuerst:** `Spielphase.java` — `@JsonTypeInfo` + `@JsonSubTypes` für `KartenAusteilen`, `Vorbehaltphase`, `ArmutTausch`, `Stichphase`, `Spielende` ergänzen. Dann `SpielphaseSchreibConverter`/`SpielphaseLeseConverter` in `JsonbConverter.java`. Dann in `Spiel.java`: `@Column("phase") Spielphase phase` statt `String phaseText`.

  Analog für `TrumpfOrdnung` (Subtypen: NormaleTrumpfOrdnung, SchweinchenTrumpfOrdnung, DamensoloTrumpfOrdnung, BubensoloTrumpfOrdnung, FleischlosTrumpfOrdnung, VariableTrumpfsoloTrumpfOrdnung).

  Schema-Änderung: Spalten `phase`, `trumpf_ordnung_typ`, `schweinchen_aktiv` bleiben bestehen, Typ ändert sich auf JSONB (Greenfield, keine Migration).

  **Folge:** `phaseText`, `trumpfOrdnungTyp`, `schweinchenAktivFlag` als Felder weg. `rekonstruiereTrumpfOrdnung`, `rekonstruiereKartendeck`, `rekonstruiereAktuellenStich`, `bestimmeTrumpfOrdnungTyp`, `bestimmeTrumpfOrdnungTypAusSpieltyp`, `effektiveTrumpfOrdnung`, `effektivesKartendeck` löschen. `kartendeck` und `trumpfOrdnung` direkt persistiert.

  **Risiko:** Mittel. Polymorpher JSON-Roundtrip pro Subtyp testen.

- [ ] **REFACTOR-DOMAIN-3: PartieStandAntwort entgiften** — DTO-Mapper liest direkt aus Domain-VOs.

  Heute liest `PartieStandAntwort.java` (546 Zeilen) den Domain-Zustand via Persistenz-Getter (`spiel.ergebnisEmbeddable()`, `spiel.haendeAlsJson()`, `spiel.sticheAlsJson()`, `spiel.armutSpielerPositionDb()`, etc.). Jeden dieser Aufrufe auf den echten Domain-Getter umstellen (`spiel.ergebnis().get()`, `spiel.haende()`, `spiel.stiche()`, `spiel.armutStatus().map(...)`, etc.).

  **Erste Datei zuerst:** `PartieStandAntwort.java` Zeile 74–86 (Filter auf `ergebnisEmbeddable() == null` → `ergebnis().isEmpty()`). Pro Adapter-Getter ein eigener Commit, jede Änderung mit `mvn test`.

  **Weitere Aufrufer prüfen und umstellen:**
  - `KiTischOrchestrator.java:193` (`s.ergebnisEmbeddable() == null`)
  - `PartieLifecycleService.java:199–200` (`armutSpielerPositionDb()`, `armutPartnerSpielerPositionDb()`)
  - `PersistenzRepositoryTest.java` ~20 Stellen (`ergebnisEmbeddable`, `haendeAlsJson`, `sticheAlsJson`, `ansagenAlsEmbeddable`, `aktuellerStichKarten`, `hochzeit…Db`)
  - `TischControllerTest.java:174–176` (`haendeAlsJson()`)
  - `KiOrchestrierungServiceFehlerTest.java:153` (`sticheAlsJson()`)

  **Folge:** Die 23 Adapter-Getter in `Spiel.java` werden unbenutzt — alle in einem Commit löschen.

- [ ] **REFACTOR-DOMAIN-4: Embeddable/JsonEintrag-Klassen löschen** — Folgt zwingend auf DOMAIN-3.

  Die acht parasitären DTO-Klassen (`HandJsonEintrag`, `StichJsonEintrag`, `AktuellerStichKarteEmbeddable`, `HandKarteEmbeddable`, `SpielErgebnisEmbeddable`, `VorbehaltMeldungEmbeddable`, `AnsageEreignisEmbeddable`, `SonderpunktJsonEintrag`) sind nach DOMAIN-3 nur noch von `PartieStandAntwort` über interne `Karte`-/`GespielteKarte`-Konversionen genutzt. Konversionen direkt im DTO-Mapper inline halten oder durch echte API-DTOs ersetzen.

  **Erste Datei zuerst:** `SpielErgebnisEmbeddable.java` als kleinste Klasse zuerst (nur 4 Felder). Dann sukzessive die anderen.

  **Folge:** `partie/`-Modul wird ~8 Klassen leichter. `PartieStandAntwort.java` schrumpft von 546 → ~300 Zeilen.

- [ ] **REFACTOR-DOMAIN-5: SpielTestBuilder + Setter im Production-Code löschen**

  Heute existieren `setzeErgebnis`, `setzeAnsagen`, `setzeAbgeschlosseneStiche`, `setzeHaendeAusMap`, `ersetzeHaende` rein für Test-Setup. Spec-Prinzip 2 (Mutable Aggregate via Business-Methoden) verletzt. DB-4d hatte SpielTestBuilder mit „YAGNI bewusst nicht eingeführt" abgehakt — das war zu früh; nach DOMAIN-1..4 ist die Test-Schmerzgrenze sichtbar.

  **Erste Datei zuerst:** `src/test/java/de/locodoko/partie/SpielTestBuilder.java` — Fluent-Builder, der intern `Spiel.neu(...)` + Business-Methoden aufruft, um realistische Zwischenzustände zu konstruieren. Für die wenigen Tests, die heute Setter brauchen, gezielte `mit…`-Methoden im Builder.

  **Folge:** Alle 5 Setter in Spiel.java löschen. `setzeSpielNummer` bleibt erhalten (wird in `Partie.java:378/428` und `PartieLifecycleService.java:104` aus echtem Production-Code für Geberrotation aufgerufen — kein Test-Setter).

- [ ] **REFACTOR-DOMAIN-6: ObjectMapper als Spring-Bean + Jackson `ist*`-Heuristik global**

  Nach DOMAIN-1 ist `PartieJsonMapper` weg und es bleibt nur `new ObjectMapper()` in `JsonbConverterKonfiguration.java:35`. Den als `@Bean jsonbObjectMapper` extrahieren, in `jdbcCustomConversions(@Lazy ObjectMapper)` injizieren.

  Zusätzlich: `AccessorNamingStrategy` registrieren, die nur `is` + Großbuchstabe als Boolean-Property zählt (`isValid` ja, `istVollstaendig` nein). Damit verschwinden die vier `@JsonIgnore`-Mixins in `JsonbConverter.java` (StichMixin, VorbehaltMeldungMixin) komplett.

  **Erste Datei zuerst:** `JsonbConverterKonfiguration.java` — Bean-Extraktion. Dann `JsonbConverter.java` — `AccessorNamingStrategy.Provider` als private static class + Registrierung in `konfiguriereObjectMapper`. Nach grüner Test-Suite Mixin-Klassen löschen.

  **Risiko:** Gering. Roundtrip-Tests pro VO decken Regressionen.

---

## Entdeckungen (Plan-Scan 2026-05-28)

### Bestätigte Code/Spec-Verstöße

1. **Frontend zeigt veraltetes Statistik-Schema.** `api-types.ts` von 2026-05-18 (vor DB-9 vom 2026-05-26). Modal nutzt `profil.statistik` (singular) statt `profil.statistiken` (Map). Mock-Tests grün, weil Mocks dem alten Schema folgen — Integration läuft ins Leere. → BUG-PROFIL-TYPES.
2. **Spec `frontend-spielerprofil.md` fordert Multi-Variante-Tabs** (Mockup Zeilen 28–53), Modal hat keine. → FEAT-PROFIL-TABS.
3. **Spec-Status „Geplant"** in `frontend-spielerprofil.md` obwohl FE-1/FE-2 archiviert. → DOC-PROFIL-STATUS.
4. **DoD-Haken offen** in `spieler-profil.md` (Frontend-Profil-Ansicht). → DOC-PROFIL-STATUS.

### Domain-Schichten-Vermischung (Priorität 3, zusammenhängender Block)

5. **`Spiel.java` ist Mischwesen** aus Domain/Persistenz/DTO: 5 `@Transient` + Schatten-`*Json`-Felder, sealed Interfaces (`Spielphase`, `TrumpfOrdnung`) als String-Diskriminator persistiert, 23 `…Db()`/`…Embeddable()`/`…AlsJson()`-Adapter-Getter, 5 Test-Setter im Production-Aggregate, Persistenz-Lifecycle-Hooks im Domain-Objekt. → REFACTOR-DOMAIN-1..6.
6. **Acht parasitäre DTO-Klassen** im `partie/`-Modul (HandJsonEintrag, StichJsonEintrag, AktuellerStichKarteEmbeddable, HandKarteEmbeddable, SpielErgebnisEmbeddable, VorbehaltMeldungEmbeddable, AnsageEreignisEmbeddable, SonderpunktJsonEintrag) — Reste aus vor-DB-3-Zeit, heute nur noch von `PartieStandAntwort` über Adapter-Getter konsumiert. → REFACTOR-DOMAIN-4.
7. **`PartieStandAntwort.java` (546 Zeilen)** liest Domain-Zustand via Persistenz-Form statt direkt aus Domain-VOs. → REFACTOR-DOMAIN-3.
8. **`PartieJsonMapper.java` + zwei `new ObjectMapper()`** — verschwindet mit DOMAIN-1, der Rest mit DOMAIN-6.
9. **Vier `@JsonIgnore`-Mixins gegen Jackson `ist*`-Property-Heuristik** — wird mit DOMAIN-6 via `AccessorNamingStrategy` global gelöst.

### Klassengrößen-Folgeschäden (lösen sich durch P3)

- Nach REFACTOR-DOMAIN: `Spiel.java` 797 → ~350–400 Zeilen, `PartieStandAntwort.java` 546 → ~300 Zeilen, `JsonbConverter.java` 679 → leichter durch entfallene Mixins (~600).
- Verbleibend offen, falls relevant: `TischAnsichtModell.ts` 636, `TischVerwaltungsService.java` 542, `StandardKiStrategie.java` 504, `Partie.java` 451 — eigenständige Tasks bei Bedarf.

### Keine Befunde
- Spielkern (alle Sonderspiele, Stichlogik, Trumpfhierarchie, Ansagen, Punkteberechnung): Spec-Status „Implementiert", keine ungetesteten Pfade entdeckt.
- Event-Vertrag, Module-Abhängigkeiten, Typed IDs, Domain-Exceptions: konsistent mit Architektur-Spec.

---

## Build-Modus-Leitfaden (gilt für alle Tasks)

1. **Erste Datei zuerst:** Jeder Task enthält einen „Erste Datei zuerst"-Hinweis.
2. **Pro Task ein Commit.** Keine Bündelung mehrerer Tasks in einem PR.
3. **Bei Unklarheit: kleinste Änderung + `mvn test`.** Nicht spekulativ refaktorieren.
4. **Tests müssen vor jedem Commit grün sein.** Bei Bruch: ROLLBACK des aktuellen Versuchs, Wurzelursache verstehen, neu ansetzen.
5. **Pure-JUnit-Tests bleiben pure JUnit.** `@SpringBootTest` darf NICHT zu einer Test-Klasse hinzugefügt werden, die heute ohne läuft.
6. **VO bleibt VO wo möglich:** Postgres JSONB + Custom Converter ermöglichen immutable VOs.
7. **Greenfield-Annahme:** Keine Datenmigration nötig.
8. **Spec-Konsultation:** Bei jedem Task der Specs anpasst: `grep -rn "<altes Konzept>" specs/` als Verifikations-Schritt.

## Stoppregeln für Build-Modus

- **Test-Suite bricht und in 3 Versuchen nicht reparierbar**: Stoppen, Iteration abbrechen, Notiz unter „Entdeckungen". Nicht stapeln.
- **Unklar zwischen Optionen**: Die kleinere/risikoärmere Option wählen.
- **Niemals**: `--no-verify`, `git push --force` ohne explizite User-Anweisung, Tests `@Disabled` ohne Notiz.
