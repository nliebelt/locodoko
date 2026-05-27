# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-24. Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

Build-Run 2026-05-26 (dreizehnte Session): **FE-4 + DOC-65 + FE-6 + DB-8 + DB-7 + FEAT-52 ABGESCHLOSSEN — alle bekannten Tasks erledigt**

**Was implementiert wurde:**
- FE-4: FlashTextManager.ts 582→384 Zeilen, 0 `as unknown as` Casts, Effekte delegieren an FlashTextPrimitiven/FlashTextContainer.
- DOC-65: Frontend-UI-Logik DoD (2 Häkchen) geschlossen.
- FE-6: SpielerProfilModal — 5 aria/role-Attribute (role=dialog, aria-modal, aria-labelledby, aria-label×2).
- DB-8: Spiel.parteiVon() eingeführt, KiOrchestrierungService Tell-Don't-Ask behoben.
- DB-7: Augen VO in SpielergebnisArchiv (reAugen/kontraAugen: int→Augen), AugenConverter für Spring Data JDBC.
- FEAT-52: pressStart2P.png/xml Bitmap-Atlas, ladeBitmapFont() in AssetLoader/BootSzene, FONT_BITMAP_KEY in designTokens, Spec-DoD [x].

**Nächster logischer Schritt:** Alle bekannten Tasks erledigt. Neue Tasks durch User oder weiteres Spec-Review.

**Offene Fragen:** Keine.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

## Build-Modus-Leitfaden (gilt für alle DB-Tasks)

Diese Regeln gelten unabhängig vom konkreten Task, damit auch ein kleineres Modell (Sonnet/Haiku) die Refactor-Reihe sicher umsetzen kann:

1. **Erste Datei zuerst:** Jeder Task enthält einen „Erste Datei zuerst"-Hinweis. Mit der starten.
2. **Pro Task ein Commit:** Keine Bündelung mehrerer DB-Phasen in einem PR. **Ausnahme: DB-4** (Domain-Klassen-Umstellung) ist groß und in 4 Sub-Tasks 4a/4b/4c/4d zerlegt — jede ein eigener Commit.
3. **Bei Unklarheit: kleinste Änderung + `mvn test`.** Nicht spekulativ refaktorieren.
4. **Tests müssen vor jedem Commit grün sein.** Bei Bruch: ROLLBACK des aktuellen Versuchs (nicht weiter „Reparieren auf Reparieren stapeln"), Wurzelursache verstehen, neu ansetzen.
5. **Pure-JUnit-Tests bleiben pure JUnit.** `@SpringBootTest` darf NICHT zu einer Test-Klasse hinzugefügt werden, die heute ohne läuft. Persistenz-spezifische Tests gehen in eigene `*PersistenzIT.java`-Klassen.
6. **VO bleibt VO wo möglich:** Postgres JSONB + Custom Converter macht es möglich, dass `Hand`, `Stich`, `VorbehaltMeldung`, `AnsageEreignis`, `Parteien` ihre Value-Object-Natur behalten (immutable, Equality über Inhalt). Nur `Spiel`, `Partie`, `SpielergebnisArchiv` und `SonderpunktEintrag` werden mutable Entities mit UUID-Identity. **Bei Zweifel: prüfe die Tabelle „VO bleibt VO" unten.**
7. **Greenfield-Annahme:** Keine Datenmigration nötig. Bestehende Liquibase-YAMLs werden in DB-2 archiviert/gelöscht; ein einziges initiales SQL-Changeset ersetzt sie. Lokale Dev-DBs werden frisch aufgesetzt.
8. **Spec-Konsultation:** Bei jedem Task der Specs anpasst: `grep -rn "<altes Konzept>" specs/` als Verifikations-Schritt.

---

## Offene Aufgaben

### REFACTOR-SPIEL-HYBRID — Master-Plan (18 Tasks: DB-1..DB-10, FE-1..FE-6, FEAT-52, DOC-65)

**Ziel:** `Spiel.java` und Persistenzschicht so umbauen, dass die in `specs/architektur*.md` formulierten Prinzipien („Tell, don't Ask", „Fail Fast", „Ubiquitous Language") tatsächlich erfüllt sind — ohne Dual-Persona-Hacks (18 `@Transient`-Felder, mutable Setter trotz Immutable-Anspruch, `SpielHydrierer` + `SpielPersistenzSync` als Mapper-Schicht).

**Phasen-Übersicht:**

| Task | Phase | Fokus |
|---|---|---|
| **DB-1** Task 67 | Spec-Updates | Architektur-Specs auf das hybride Modell anpassen |
| **DB-2** Task 68 | Initial-Schema | Ein einziges SQL-Changeset definiert das finale DB-Schema. Alte 22 YAMLs archiviert. |
| **DB-3** Task 69 | JSONB-Konverter | Custom Converter für ~10 JSONB-Spalten, isoliert testbar |
| **DB-4** Task 70 (4 Sub-Tasks) | Domain-Klassen | `Spiel.java` mutable, `@Transient` weg, Hydrierer/Sync gelöscht, Pattern-A-Events |
| **DB-5** Task 71 | Archiv-Aggregate | `SpielergebnisArchiv` mit eigenem `@Table`, FK-Child `SonderpunktEintrag` |
| **DB-6** Task 72 | Domain-Exceptions | 16x `IllegalStateException` in `Spiel.java` → `UngueltigerSpielzugException` / `SpielverwaltungKonfliktException` |
| **DB-7** Task 73 | Value Objects | `Augen`, `Spielwert`, `BockrundenZaehler` konsequent verwenden |
| **DB-8** Task 74 | Tell-Don't-Ask | 1 echter Verstoß behoben, keine spekulativen Ergänzungen |
| **DB-9** Task 75 | Statistik-Erweiterung | `spieler_statistik` pro Regelvariante + Schweinchen/Hochzeiten/Armuten/Re-Kontra-Stats |
| **DB-10** Task 76 | PartieErgebnis-View | `partie_ergebnis_eintrag`-Tabelle durch SQL-VIEW ablösen (keine Rotation mehr) |
| **FE-1** Task 77 | Statistik-UI | Neues Feature: SpielerProfilSzene mit Stats-Anzeige (existiert im Backend, fehlt im FE) |
| **FE-2** Task 78 | Profil-Detailseite | Partie-Historie-Anzeige (welche Partien zuletzt, Sonderpunkte, Solo-Bilanz) |
| **FE-3** Task 79 | Frontend-Cleanup | 8x `console.log/error` → `Logger`; `(window as any).__locodoko` getypt machen |
| **FE-4** Task 66 | FlashTextManager | Refactor in Primitives + Container + Manager (bestehender Task) |
| **FE-5** Task 80 | E2E auf Tastatur | Schließt offenes DoD von `frontend-tastatursteuerung.md`: 8 E2E-Tests von `appStore`-Direktaufruf auf Tastatureingabe umstellen |
| **FE-6** Task 81 | A11y-Basis | Minimale ARIA-Attribute für HTML-Overlays (Modal/Toast) |
| **FEAT-52** Task 52 | BitmapFont (SPEC-PFLICHT) | Spec verlangt explizit BitmapFont; Code nutzt Web-Font — **Status hochgestuft** auf normale Priorität |

**Strategische Entscheidungen (Begründung in Grill #1–#9):**

- **Mutable Aggregate** statt Immutable + toBuilder — pragmatischer Schnitt mit Spring Data JDBC.
- **Hybrid Datenmodell**: PostgreSQL JSONB für inner-Spiel-State, relational für Stammdaten und Statistik-queryable Archive.
- **Greenfield**: Da DB nie ausgerollt → ein initiales Schema, keine Strangler-Migration.
- **VOs bleiben VOs** wo möglich: Hand, Stich, VorbehaltMeldung, AnsageEreignis, Parteien — persistiert via JSONB ohne UUID-Identity.
- **Pattern A für Events**: Aggregat-Methode returned `List<SpielEreignis>`, Service publisht nach `save()`. Kein `@DomainEvents`-Magic.
- **Tests in zwei Schichten**: pure JUnit (heute 28 von 50) bleiben pure JUnit; Persistenz-IT mit `@DataJdbcTest` + Testcontainers.

**Daten-Modell (finales Ziel, mit Statistik-Erweiterung nach Grill #10):**

Inspiriert von Doppelkopf-Palast und Fuchstreff: Statistiken werden **pro Regelvariante** geführt (TURNIER/SONDER/FREI), Spieler-Aggregat als Cache, Detail-Daten relational für Berechenbarkeit.

```
partie                                  RELATIONAL
  id (UUID, PK), version (BIGINT, @Version),
  anzahl_spiele, aktuelles_spiel_nummer, status,
  punkte_sued, punkte_west, punkte_nord, punkte_ost,
  bockrunden_zaehler, solist_des_letzten_spiels,
  regelvariante VARCHAR(20),            -- TURNIER/SONDER/FREI (für Statistik-Diskriminator)
  spielregeln JSONB,                    -- Hausregeln-Preset (Detail-Konfiguration)
  erstellt_am, beendet_am

partie_teilnehmer                       RELATIONAL (NEU — M:N Spieler↔Partie)
  id (UUID, PK), partie_id (FK CASCADE), spieler_id (FK),
  spieler_position,                     -- NORD/OST/SUED/WEST
  beigetreten_am, ausgeschieden_am      -- nullable für Reconnect-Tracking
  UNIQUE(partie_id, spieler_position)

laufendes_spiel                         HYBRID (relational + JSONB)
  id (UUID, PK), partie_id (FK UNIQUE), spiel_nummer,
  geber_position, spieltyp, phase,
  trumpf_ordnung_typ, schweinchen_aktiv, einwurf_zaehler,
  haende JSONB,                         -- {NORD:[{farbe,wert},...], OST:..., ...}
  aktueller_stich JSONB,                -- {aufspieler, karten:[...]} nullable
  abgeschlossene_stiche JSONB,          -- [{reihenfolge, aufspieler, gewinner, karten:[...]}]
  vorbehalt_meldungen JSONB,            -- [{spielerPosition, ansage}]
  ansage_ereignisse JSONB,              -- [{spielerPosition, ansage}]
  partei_zuordnungen JSONB,             -- {NORD:RE, OST:KONTRA, ...} mit offen/geschlossen
  bereits_geschmissen JSONB,            -- [NORD, OST]
  pflicht_ansage_ausstehend JSONB,      -- [RE]
  armut_status JSONB,                   -- nullable
  hochzeit_status JSONB                 -- nullable

spielergebnis_archiv                    RELATIONAL (statistik-queryable)
  id (UUID, PK), partie_id (FK CASCADE), spiel_nummer,
  geber_position, aufspieler_position,  -- aufspieler für Vorhand-Statistik
  spieltyp,
  ist_solo BOOLEAN,                     -- schneller Solo-Filter
  solo_typ VARCHAR(20) NULL,            -- DAMEN_SOLO/BUBEN_SOLO/FARBSOLO/... wenn ist_solo
  re_augen, kontra_augen, sieger_partei,
  spielwert, grundwert, absage_punkte, gegen_die_alten_punkte, solo_multiplikator,
  spielpunkte_sued, spielpunkte_west, spielpunkte_nord, spielpunkte_ost,
  abgeschlossen_am,
  UNIQUE(partie_id, spiel_nummer)

sonderpunkt_eintrag                     RELATIONAL (FK-Child)
  id (UUID, PK), spielergebnis_archiv_id (FK CASCADE),
  partei, sonderpunkt_typ, taeter_position, opfer_position

spieler_statistik                       RELATIONAL (Aggregat-Cache, PRO REGELVARIANTE)
  id (UUID, PK), spieler_id (FK), regelvariante VARCHAR(20),
  anzahl_spiele, anzahl_siege, gesamt_punkte,
  fuchs_gefangen, fuchs_verloren, karlchen_gespielt, doppelkoepfe,
  -- Re/Kontra getrennt:
  re_siege, re_niederlagen, kontra_siege, kontra_niederlagen,
  -- Sonderspiele:
  schweinchen_gespielt, hochzeiten_gespielt,
  armuten_angesagt, armuten_uebernommen,
  solos_siege, solos_niederlagen,
  solos_pro_typ JSONB,                  -- {DAMEN_SOLO:{siege:3, niederl:1}, ...}
  -- Lifetime + Cache-Markierung:
  zuletzt_aktualisiert TIMESTAMP,
  UNIQUE(spieler_id, regelvariante)

tisch, spieler                          (existierend, bleibt)
```

**Was wir aus Doppelkopf-Palast/Fuchstreff bewusst NICHT übernehmen (V1-Scope):**
- Saisons / Monatsrankings → später, falls Liga-Modus gewünscht
- TrueSkill / ELO-Rating → komplex, erstmal weglassen
- Achievements (Gold/Silber/Bronze) → Future
- Multi-Tabellen-Liga-System → Future

**Was die existierenden Tabellen `spieler_statistik` und `partie_ergebnis_eintrag` (aus dem alten Schema) angeht:**
- `spieler_statistik` wird **erweitert** mit neuen Spalten + Composite PK (spieler_id, regelvariante). Bestehende Logik in `SpielerProfilService.verarbeiteSpielBeendet()` wird angepasst.
- `partie_ergebnis_eintrag` mit max-20-Rotation wird **abgelöst** durch eine SQL-VIEW `partie_ergebnis_view` über `partie` + `partie_teilnehmer` + `spielergebnis_archiv`. Frontend liest die VIEW.

**3. Normalform — pragmatischer Status:**
- Alle relationalen Tabellen sind 3NF mit zwei bewussten Ausnahmen:
  - `spielergebnis_archiv.spielwert`: aus Grundwert/Multiplikator/Sonderpunkten ableitbar — bewusster Cache
  - `spieler_statistik`: kompletter Aggregat-Cache aus Detail-Tabellen
- Beide sind **akzeptierte Performance-Optimierungen**, kein Architektur-Bruch — Quelle bleibt die Detail-Tabelle.

---

### VO bleibt VO — verbindliche Tabelle für DB-4

Mit Postgres JSONB + Custom Converter dürfen die meisten Domain-VOs ihre VO-Natur behalten. **Pflicht-Konsultation in DB-4.**

| Klasse | Status | Persistenz | Modul |
|---|---|---|---|
| `Spiel` | **Entity** (mutable, UUID-Identity, `@Table`) | direkte Spalten + JSONB-Felder | `partie/` |
| `Partie` | **Entity** (mutable, UUID-Identity, `@Version`, `@Table`) | direkte Spalten + JSONB für spielregeln | `partie/` |
| `Hand` | **VO bleibt VO** (in `karten/`, immutable, Equality über Inhalt) | JSONB-Element in `haende` | `karten/` |
| `Stich` | **VO bleibt VO** (mutable Domain-Logik wäre konzeptioneller Bruch). Stich-Mutationen erfolgen weiterhin via `stich.spieleKarte(...)` returns neuen Stich; Spiel hält die Liste und ersetzt das aktuelle Stich-Element. | JSONB-Element in `aktueller_stich`/`abgeschlossene_stiche` | `partie/` |
| `GespielteKarte` | **VO bleibt VO** (record) | JSONB-Element innerhalb Stich | `partie/` |
| `VorbehaltMeldung` | **VO bleibt VO** (record) | JSONB-Element in `vorbehalt_meldungen` | `partie/` |
| `AnsageEreignis` | **VO bleibt VO** (record) | JSONB-Element in `ansage_ereignisse` | `partie/` |
| `Ansagen` | **VO bleibt VO** (Wrapper über AnsageEreignis-Liste) | aus JSONB rekonstruiert | `partie/` |
| `Parteien` | **VO bleibt VO** (Wrapper über partei_zuordnungen) | aus JSONB rekonstruiert | `partie/` |
| `ArmutStatus` | **VO bleibt VO** (record) | JSONB nullable in `armut_status` | `partie/` |
| `HochzeitStatus` | **VO bleibt VO** (record) | JSONB nullable in `hochzeit_status` | `partie/` |
| `Spielergebnis` | **VO bleibt VO** (in-game Domain-Konzept) | konvertiert zu `SpielergebnisArchiv` bei Spielende | `partie/` |
| `SpielergebnisArchiv` | **Entity (eigenes Aggregate-Root)** (UUID-Identity, `@Table`) | relational + `@MappedCollection<SonderpunktEintrag>` | `partie/` |
| `SonderpunktEintrag` | **Entity** (UUID-Identity, `@Table`) | relational, FK-Child von Archiv | `partie/` |
| `Spielregeln` | **VO bleibt VO** | JSONB-Element in `partie.spielregeln` | `karten/` |
| `Augen`, `Spielpunkte`, neue VOs aus DB-7 | **VO** (records) | als Integer-Spalten serialisiert | `karten/`/`partie/` |

**Konsequenz:** `Spiel.java` hat nach DB-4 **2 Entity-Klassen-Felder** (Identitäts-Felder) und **~10 VO-Felder** (Domain). Spring Data JDBC mit Custom Convertern lädt direkt in die VO-Strukturen. Kein `@Transient`, kein Hydrierer, kein Sync.

---

### DB-1: SPEC-ARCHITEKTUR-AKTUALISIEREN (Task 67)
- [x] **Dokumentation** (KRITISCH, blockiert alle folgenden Tasks): Specs an das Hybrid-Modell anpassen. Ziel: Specs sind in sich widerspruchsfrei und beschreiben das finale Modell.
  - **Erste Datei zuerst**: `specs/architektur-ddd.md` — der enthält den heutigen Spec-Widerspruch (§3) und die veraltete JSON-Blob-Entscheidung von 2026-04-15.
  - **`specs/architektur.md`**:
    - Prinzip 2 „Immutable Spiel via `toBuilder().build()`" → **streichen**. Ersetzen durch: „Aggregate Roots sind mutable; Mutationen erfolgen über Business-Methoden (z.B. `spiel.spieleKarte()`), die Invarianten per Fail-Fast schützen und ihre fachlichen Ereignisse explizit als `List<SpielEreignis>` zurückgeben. Domain-VOs (Hand, Stich, Vorbehalt, Ansage, etc.) bleiben immutable."
    - Persistenz-Erklärung ergänzen: „PostgreSQL als DB. **Hybrides Modell**: relational für Stammdaten + Archive, JSONB für inner-Aggregate-State."
  - **`specs/architektur-ddd.md`**:
    - **Spec-Widerspruch sauber auflösen** (KRITISCH): §3 „`partie/` enthält ausschließlich fachliche Domain-Objekte. Persistenz-Infrastruktur-Klassen gehören ins Modul `tisch/`." → **pragmatisch klarstellen**: „Aggregate Roots in `partie/` tragen Spring Data JDBC-Annotationen direkt (`@Table`, `@Column`). VOs (Hand, Stich etc.) bleiben annotation-frei und werden via Custom JSONB-Converter persistiert. **Adapter-Klassen** (komplexe Konverter-Implementierungen, DTO-Mapper) gehören in `tisch/`."
    - Sektion §3 „Persistenz-Strategie für `Spiel`" → komplett umschreiben. Entscheidung 2026-04-15 (JSON-Blob mit `@Transient`-Mapper) wird durch Entscheidung 2026-05-22 (Hybrid Postgres + JSONB Custom Converter, mutable Aggregate, Greenfield-Schema) ersetzt.
    - DoD-Item „Keine `*Entity`-Klassen in `partie/`" → **abhaken**: `@Table` direkt auf Aggregate Roots, VOs bleiben annotation-frei.
    - Neuer Abschnitt: „Hybrid-Datenmodell" mit dem oben skizzierten Schema.
  - **`specs/architektur-unified.md`**:
    - §Naming „Db-Suffix-Konvention" → **streichen**. Nach DB-4 sind alle Domain-Felder = DB-Felder, kein Suffix mehr nötig.
  - **`specs/architektur-spielkern.md`**:
    - Sektion „`Spiel` — Immutable Aggregate Root" → „`Spiel` — Aggregate Root (mutable)".
    - **Neuer Abschnitt „Test-Schichten"**: Pflicht-Regel: Domain-Logik-Tests sind **pure JUnit ohne `@SpringBootTest`**. Persistenz-Tests sind eigene Klassen `*PersistenzIT.java` mit `@DataJdbcTest` + Testcontainers Postgres.
  - **`specs/architektur-domain-events.md`** (LLM-/Mensch-Lesbarkeit):
    - **Pflicht-Regel**: Einzig erlaubtes Pattern für Event-Publikation ist „Aggregate-Methode returned `List<SpielEreignis>` → Service publisht via `ApplicationEventPublisher` nach erfolgreichem `partieRepository.save()` mit `@TransactionalEventListener(AFTER_COMMIT)` für alle Listener". Kein `@DomainEvents`, kein In-Aggregate-Buffer.
    - **Event-Inventory-Tabelle erweitern** mit Spalten „Name | Producer-Methode | Consumer-Klasse | Trigger | Phase | WS-Mapping".
    - **Naming-Konvention**: jedes Modulith-Event `XyzGeschehen` hat optional Listener `onXyzGeschehen()` und WS-Mapper.
    - **Ein Sequenzdiagramm** pro Hauptevent (`KarteGespielt`, `StichAbgeschlossen`, `SpielBeendet`) — ASCII-Diagramm reicht.
  - **`specs/datenbankmodell.md`**: **Komplett neu schreiben** auf Basis des Hybrid-Schemas. Tabellen + JSONB-Spalten + Beispiel-JSON-Strukturen.
  - **`specs/frontend-tastatursteuerung.md`**: Status von „In Bearbeitung" auf **„Stabil"** ändern — wird durch FE-5 erfüllt. (Hinweis im Spec-Text: „Vollständig nach FE-5 Plan-Run 2026-05-22").
  - **`specs/spieler-profil.md` Z. 80 KORRIGIEREN**: Das DoD-Häkchen `[x] Frontend: Profil-Ansicht (Statistiken + Verlauf)` ist FALSCH — Frontend hat keine Profil-Ansicht. Setze auf `[ ]` und referenziere FE-1/FE-2 als die Tasks, die das erfüllen. Nach Abschluss von FE-1 und FE-2 das Häkchen wieder setzen.
  - **Neue Spec-Datei `specs/frontend-spielerprofil.md`**: Layout, Datenfluss, DoD für das FE-1/FE-2-Feature.
  - **Akzeptanz**: 
    - Alle Spec-Dateien konsistent.
    - `grep -rn "Immutable.*Spiel\|toBuilder\|SpielHydrierer\|SpielPersistenzSync" specs/` liefert keine veralteten Stellen mehr.
    - `grep -rn "JSON-Blob.*Strategie\|@Transient" specs/` liefert keine veralteten Stellen.
    - `grep -n "Status.*In Bearbeitung" specs/` liefert leer.

---

### DB-2: INITIAL-SCHEMA (Task 68)
- [x] **Backend** (Hohe Priorität, kein Code-Bruch — nur SQL): Ein einziges initiales Liquibase-Changeset, das das finale Schema definiert. Alte 22 YAMLs werden archiviert.
  - **Erste Datei zuerst**: `src/main/resources/db/changelog/000-initial-schema.sql` neu anlegen (SQL-formatted Liquibase).
  - **Tabellen im Initial-Schema** (vollständige Liste):
    1. **Aus dem alten Schema übernehmen** (bestehende Tabellen, ggf. erweitert):
       - `tisch` (existiert, hat `einladungs_code` etc.)
       - `spieler` (existiert, Auth-Felder, Profil)
       - `databasechangelog` und `databasechangeloglock` (Liquibase-System-Tabellen)
       - `event_publication` (Spring Modulith Outbox)
    2. **Neu/refaktoriert** (laut Daten-Modell oben):
       - `partie` (neu strukturiert mit `regelvariante`, `spielregeln` JSONB)
       - `partie_teilnehmer` (M:N Partie↔Spieler)
       - `laufendes_spiel` (ersetzt alte spiel-Tabelle)
       - `spielergebnis_archiv` + `sonderpunkt_eintrag` (relationale Statistik-Quelle)
       - `spieler_statistik` (UMSTRUKTURIERT: Composite-Key (spieler_id, regelvariante), neue Felder)
       - VIEW `partie_ergebnis_view` (ersetzt `partie_ergebnis_eintrag`-Tabelle)
  - **Schritte**:
    1. Neues Changeset `000-initial-schema.sql` mit komplettem Schema laut **Daten-Modell** oben + den oben gelisteten Tabellen.
    2. Bestehende `db.changelog-master.yaml` durch `db.changelog-master.sql` ersetzen, die nur das eine Changeset inkludiert.
    3. Alle 22 alten Changesets (`000-baseline.yaml` ... `022-herz-durchgegangen-nur-hoch.yaml`) **in einen Ordner `db/changelog/archiv/` verschieben** (NICHT löschen — als historische Referenz behalten, aus master-changelog excludieret).
    4. Liquibase `tables/triggers/constraints` für UUID-PKs, FK-CASCADE, `@Version`-Spalte, JSONB-Spalten korrekt erzeugen.
    5. **Daten-Migration aus alten Tabellen**: NICHT nötig (Greenfield-Annahme — keine Bestandsdaten).
  - **Test**: `mvn liquibase:update` läuft auf leerer Postgres-DB sauber durch. Keine Java-Code-Änderung in dieser Phase. Bestehende 307 Backend-Tests müssen vermutlich brechen — das ist erwartet und wird in DB-4 repariert. Tests werden temporär als `@Disabled` markiert oder DB-2 wird gemeinsam mit DB-3+DB-4 in einen Feature-Branch gelegt (siehe Workflow unten).
  - **Akzeptanz**: 
    - `src/main/resources/db/changelog/000-initial-schema.sql` existiert mit allen Tabellen.
    - `db/changelog/archiv/` enthält die 22 alten YAML-Files.
    - `liquibase:update` läuft sauber gegen leere Postgres-DB.

**Workflow-Hinweis — bleibt auf main (kein Feature-Branch):** DB-2 erfordert dass Java-Klassen zum neuen Schema passen. Das wird gelöst durch eine **clevere Commit-Reihenfolge auf main**, nicht durch einen Feature-Branch:

1. Erst alle schema-unabhängigen Vorbereitungen einzeln committen (DB-1, DB-3, DB-4a) — Tests bleiben durchgehend grün.
2. Dann **DB-2 + DB-4b + DB-4c als EIN Mega-Commit auf main** — Schema-Wechsel und passende Code-Umstellung zusammen. Vor und nach dem Commit grün; nur INNERHALB des Commits wäre der Zustand inkonsistent (was OK ist — git zeigt den Endzustand).
3. Danach DB-4d und Rest wieder als Einzel-Commits.

Konkret: Build-Modus erstellt für DB-2/4b/4c **drei separate Working-Tree-Änderungen**, ohne dazwischen zu committen, dann genau **ein** `git commit` am Ende mit Message wie `DB-2+4b+4c: Schema-Wechsel + Domain mutable + Mapper löschen`.

---

### DB-3: JSONB-CONVERTER (Task 69)
- [x] **Backend** (Hohe Priorität, mittlerer Aufwand): Custom Converter für die ~10 JSONB-Spalten, sodass Spring Data JDBC direkt Domain-VOs lädt/speichert.
  - **Erste Datei zuerst**: Neue Klasse `JsonbConverters.java` in `de.locodoko.tisch.persistence` (Adapter-Schicht laut Spec).
  - **Schritte**:
    1. `@Configuration`-Klasse `JsonbConverterConfig` in `tisch/persistence/` registriert pro Domain-Typ ein Reader+Writer-Converter-Paar.
    2. Verwendet Jackson für JSON-Serialisierung; PostgreSQL `PGobject` als Zwischenform.
    3. Konkret zu konvertierende Typen:
       - `Map<SpielerPosition, Hand>` ↔ JSONB (für `haende`)
       - `Stich` ↔ JSONB nullable (für `aktueller_stich`)
       - `List<Stich>` ↔ JSONB (für `abgeschlossene_stiche`)
       - `List<VorbehaltMeldung>` ↔ JSONB
       - `Ansagen` (Wrapper) ↔ JSONB
       - `Parteien` (Wrapper) ↔ JSONB
       - `Set<SpielerPosition>` ↔ JSONB (für `bereits_geschmissen`)
       - `Set<Partei>` ↔ JSONB (für `pflicht_ansage_ausstehend`)
       - `ArmutStatus` ↔ JSONB nullable
       - `HochzeitStatus` ↔ JSONB nullable
       - `Spielregeln` ↔ JSONB
    4. Jackson-Konfiguration: ObjectMapper als Singleton, registriert Module für `Optional`, `Map<EnumKey, V>`, `record`-Support.
    5. Domain-Klassen (`Hand`, `Stich`, `VorbehaltMeldung` etc.) müssen Jackson-kompatibel sein — vermutlich sind sie das schon als `record`. Bei Bedarf `@JsonCreator`-Konstruktoren ergänzen.
  - **Test**: `JsonbConverterTest.java` (pure JUnit + Jackson, **kein** Spring nötig) — pro Converter ein Test der Roundtrip-Serialisierung prüft (`Domain-VO → JSONB-String → Domain-VO` ist identisch).
  - **Integrations-Test**: `JsonbPersistenzIT.java` mit `@DataJdbcTest` + Testcontainers — eine Test-Entity mit JSONB-Feld, persistieren, neu laden, Identität prüfen.
  - **Akzeptanz**: 
    - Alle 11 Converter-Paare implementiert.
    - Roundtrip-Tests grün.
    - JsonbPersistenzIT grün gegen echte Postgres-Instanz.

---

### DB-4: SPIEL.JAVA AUFRÄUMEN (Task 70) — in 4 Sub-Tasks zerlegt

**Risiko-Task:** Betrifft `Spiel.java` (587 Z.), `Partie.java` (426 Z.), `SpielHydrierer.java` (238 Z. — wird gelöscht), `SpielPersistenzSync.java` (89 Z. — wird gelöscht), `SpielBuilder.java` (72 Z. — wird gelöscht) + alle Service-Aufrufer + Test-Suite. Zerlegung in 4 Sub-Tasks.

#### DB-4a: SPIEL MUTABLE MACHEN (Task 70a)
- [x] **Backend** (Hoch, großer Aufwand): Alle Domain-Methoden in `Spiel` umstellen: mutieren direkt + returnen `List<SpielEreignis>` (Pattern A).
  - **Erste Datei zuerst**: `Spiel.java` — beginne mit `teileKartenAus()` als Pilot (kleinste Methode, klare Mutation).
  - **Schritte**:
    1. Pro Domain-Methode: `return toBuilder().feld(neu).build()` → `this.feld = neu; return List.of(/*Events*/);`.
    2. Methoden-Signaturen ändern: `Spiel meldeGesund(...)` → `List<SpielEreignis> meldeGesund(...)`. `SpielAktion spieleKarte(...)` → `List<SpielEreignis> spieleKarte(...)`.
    3. Service-Aufrufer (`SpielAktionsService`) anpassen: keine `neu = ...; return neu;`-Logik mehr, sondern `spiel.spieleKarte(...); partieRepository.save(partie); events.forEach(publisher::publishEvent);`.
    4. Tests: vorher `Spiel neu = spiel.teileKartenAus(); assertThat(neu.phase())...` → nachher `spiel.teileKartenAus(); assertThat(spiel.phase())...`.
  - **Akzeptanz**:
    - `grep -rn "toBuilder()" src/main/java/de/locodoko/partie/` → 0.
    - `grep -rn "SpielAktion\b" src/main/java/` → 0 (Klasse darf gelöscht sein).
    - Alle Tests grün, davon 28+ weiterhin pure JUnit.

#### DB-4b: @TRANSIENT-FELDER WEG, JSONB-PERSISTENZ (Task 70b) — ERLEDIGT
- [x] **Backend** (Hoch, mittlerer Aufwand): Kollektions-Felder in `Spiel.java` als `@Transient transient` + separate `@Column String *Json`-Felder persistiert.
  - `haende`, `vorbehalte`, `abgeschlosseneStiche`, `bereitsGeschmissen`, `pflichtAnsageAusstehend` umgestellt.
  - `PartieJsonMapper.java` (neu): JSON-Serialisierung für diese 5 Felder.
  - `SpielNachLadenCallback` + `PartieNachLadenCallback`: AfterConvertCallback für Initialisierung.
  - H2-Kompatibilität: `byte[]` + String + PGobject ReadingConverter.
  - Alle 319 Tests grün.

#### DB-4c: HYDRIERER UND SYNC LÖSCHEN (Task 70c) [x]
- [x] **Backend** (Mittel, kleiner Aufwand): Mapper-Klassen gelöscht.
  - **Erste Datei zuerst**: `SpielHydrierer.java` (238 Z.) löschen.
  - **Schritte**:
    1. `SpielHydrierer.java` löschen.
    2. `SpielPersistenzSync.java` (89 Z.) löschen.
    3. `SpielBuilder.java` (72 Z.) löschen.
    4. Aufrufe von `spiel.hydriere(...)` und `spiel.syncZuPersistenz()` aus dem Service-Layer entfernen.
    5. Setter wie `fuegeHandHinzu`, `ersetzeHaende`, `fuegeStichHinzu`, `uebernehmeErgebnis`, `ersetzeAnsagen`, `setzeAktuellenStich`, `setzeHochzeitStatus`, `uebernehmeDomainStand`, `setzeSpielNummer`, `setzePartieRef` löschen.
    6. `partieRef` Backpointer-Feld löschen — Aggregate-Children verweisen nicht zurück.
    7. Helper-Klassen wie `HandJsonEintrag`, `StichJsonEintrag`, `SonderpunktJsonEintrag`, `VorbehaltMeldungEmbeddable`, `AnsageEreignisEmbeddable`, `AktuellerStichKarteEmbeddable`, `HandKarteEmbeddable`, `JsonKonverter` prüfen — sind sie noch nötig? Vermutlich nein, weil Custom JSONB-Converter aus DB-3 direkt die Domain-VOs handhaben.
  - **Akzeptanz**:
    - `find src/main/java -name "SpielHydrierer.java" -o -name "SpielPersistenzSync.java" -o -name "SpielBuilder.java"` leer.
    - `grep -rn "uebernehmeDomainStand\|hydriere\|syncZuPersistenz\|fuegeHandHinzu\|ersetzeHaende" src/main/java/` leer.
    - `Spiel.java` < 350 Zeilen.
    - Alle Tests grün.

#### DB-4d: ARGUMENT-FACTORIES UND TEST-HELPER (Task 70d)
- [x] **Backend** (Mittel, klein): Saubere Test-Setup-Mechanismen.
  - `Spiel.ausPersistiertemStand`: Javadoc hinzugefügt, klar als Test-Support markiert (SpielHydrierer gelöscht, Spring Data JDBC lädt direkt).
  - `Spiel.neuePersistenz`: Javadoc präzisiert (nur für Persistenz-Tests).
  - `SpielTestBuilder` **nicht** eingeführt — YAGNI: Test-Setup bereits <20 Zeilen, kein Bedarf.

---

### DB-5: SPIELERGEBNIS-ARCHIV-AGGREGATE (Task 71)
- [x] **Backend** (Hohe Priorität): Eigenes Aggregate für abgeschlossene Spiele eingeführt.
  - **Erste Datei zuerst**: `SpielergebnisArchiv.java` in `partie/` als neues `@Table("spielergebnis_archiv")`-Aggregate mit `@MappedCollection<SonderpunktEintrag>`. Tabelle ist in DB-2 bereits angelegt.
  - **Schritte**:
    1. Domain-Klasse `SpielergebnisArchiv` mit allen Ergebnis-Feldern (siehe Daten-Modell).
    2. Domain-Klasse `SonderpunktEintrag` mit `@Table("sonderpunkt_eintrag")`, UUID-Identity.
    3. Repository `SpielergebnisArchivRepository extends CrudRepository<SpielergebnisArchiv, UUID>` mit Methoden `findByPartieIdOrderBySpielNummer(UUID)`, `findByPartieId(UUID)`.
    4. **Spielende-Logik**: Bisher schreibt `Spiel.uebernehmeErgebnis(spielergebnis)` ins eigene Spiel-Objekt. Stattdessen: `PartieLifecycleService` (oder die entsprechende Stelle) ruft `spielergebnisArchivRepository.save(SpielergebnisArchiv.aus(spielergebnis, partie.id(), spiel.spielNummer()))` auf.
    5. **Read-Pfad**: `Partie.abgeschlosseneSpiele()` returned künftig `List<SpielergebnisArchiv>` statt `List<Spiel>`. Alle Konsumenten (Bockrunden-Trigger, Solist-Tracking, Punktestand-Aggregation, DTO-Bildung) anpassen — exhaustive Liste im PR auflisten (`grep -rn "\.abgeschlosseneSpiele()" src/main/java/`).
    6. Felder `re_augen`, `kontra_augen`, `sieger_partei` etc. aus `spiel`-Tabelle (alt) sind in DB-2 schon nicht mehr im Schema — nichts zu droppen.
  - **Test**: 
    - `SpielergebnisArchivTest.java` (pure JUnit) — Konstruktion aus `Spielergebnis`, Konsistenz-Tests.
    - `SpielergebnisArchivPersistenzIT.java` (`@DataJdbcTest` + Testcontainers) — Save + Load Roundtrip mit Sonderpunkten.
    - Bestehende Tests die `partie.abgeschlosseneSpiele().get(i).ergebnis()` lesen müssen angepasst werden.
  - **Akzeptanz**:
    - `Partie.abgeschlosseneSpiele()` returned `List<SpielergebnisArchiv>`.
    - `grep -rn "spiel\.ergebnis()" src/main/java/` zeigt nur Lesen am aktuell laufenden Spiel (für UI).
    - Spielende-Flow schreibt Archiv-Zeile in einer einzigen Transaktion mit Partie-Save.
    - Alle Tests grün, neuer IT grün.

---

### DB-6: DOMAIN-EXCEPTIONS IN SPIEL.JAVA UND PARTIE.JAVA (Task 72)
- [x] **Backend** (Mittlere Priorität, kleiner Aufwand): Die `IllegalStateException`/`IllegalArgumentException`-Würfe in `Spiel.java` (16 Stellen) **und** `Partie.java` (7 Stellen) durch Domain-spezifische Exceptions ersetzen.
  - **Zusätzliche 7 Stellen in `Partie.java`** (gefunden im Final-Review):
    - Z. 100 „Eine Partie muss mindestens ein Spiel enthalten" — Programmierfehler, `IllegalArgumentException` BLEIBT.
    - Z. 109 „bockrundenZaehler darf nicht negativ sein" — Programmierfehler, BLEIBT.
    - Z. 153 „Die Partie ist bereits beendet" — Konflikt (409), `SpielverwaltungKonfliktException`.
    - Z. 156 „Es laeuft bereits ein Spiel" — Konflikt (409).
    - Z. 177 „Es gibt kein aktuelles Spiel" — Konflikt (409).
    - Z. 185 „Nur vollstaendig ausgewertete Spiele duerfen abgeschlossen werden" — Konflikt (409).
    - Z. 354 „bockrundenZaehler darf nicht negativ sein" — Programmierfehler, BLEIBT.
  - **Ergebnis Partie**: 4 von 7 werden zu `SpielverwaltungKonfliktException`, 3 bleiben als defensive Guards.
  - **Erste Datei zuerst**: `Spiel.java` Zeile 561 (`pruefePhase`) — diese Helper-Methode wirft 5 der 16 Exceptions; eine zentrale Änderung dort reduziert die Anzahl direkt.
  - **Spec-Bezug**: `architektur-ddd.md` §8 — `UngueltigerSpielzugException` → HTTP 422, `SpielverwaltungKonfliktException` → HTTP 409.
  - **Klassifikations-Tabelle** (alle 16 Stellen, Zeilen-Nr. aus aktueller `Spiel.java`, **gültig vor DB-4** — nach DB-4 ggf. neue Zeilen-Nr.):

  | Zeile | Aktueller Wurf | Klassifikation | Neue Exception |
  |---|---|---|---|
  | 227 | „Vorbehalte muessen in Sitzreihenfolge gemeldet werden" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 228 | „Schmeiss-Recht bereits genutzt" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 229 | „Vorbehalt nicht zulässig nach Spielregeln" | Regelverletzung | `UngueltigerSpielzugException` (422) |
  | 244 | „Armut-Karten anbieten nur in ARMUT_TAUSCH" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 250 | „Armut ablehnen nur in ARMUT_TAUSCH" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 256 | „Armut annehmen nur in ARMUT_TAUSCH" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 275 | „Gueltige Karten nur in STICHPHASE" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 278 | „Gueltige Karten nur für aktuellen Spieler" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 283 | „Karte spielen nur in STICHPHASE" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 286 | „Pflichtansagen noch ausstehend" | Regelverletzung | `UngueltigerSpielzugException` (422) |
  | 344 | „Ansage taetigen nur in STICHPHASE" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 348 | „Ansagen nur vom aktuellen Spieler" | Konflikt | `SpielverwaltungKonfliktException` (409) |
  | 349 | „Vor Hochzeits-Klärung nur Hochzeitsspieler ansagen" | Regelverletzung | `UngueltigerSpielzugException` (422) |
  | 379 | `handVon`: Hand für Spieler nicht vorhanden | Programmierfehler | `IllegalArgumentException` BLEIBT (defensive Guard) |
  | 382 | `parteien`: Parteien noch nicht bekannt | Programmierfehler | `IllegalStateException` BLEIBT (defensive Guard) |
  | 561 | `pruefePhase`: generische Phase-Verletzung | Konflikt | `SpielverwaltungKonfliktException` (409) |

  - **Test**: Pro neuer Exception-Typ mindestens ein neuer Test, der den korrekten HTTP-Status via `MockMvc` nachweist. Bestehende Tests, die `IllegalStateException` erwarten, anpassen.
  - **Akzeptanz**: Nur noch 2x `IllegalStateException`/`IllegalArgumentException` in `Spiel.java` (defensive Guards). Mindestens 2 neue Integration-Tests grün.

---

### DB-7: VALUE OBJECTS AUSWEITEN (Task 73)
- [x] **Backend** (Niedrige Priorität, mittlerer Aufwand): Primitive Obsession beheben.
  - **Erste Datei zuerst**: `Augen.java` (existiert schon) — konsequent verwenden, beginne mit `SpielergebnisArchiv` (`reAugen`/`kontraAugen` von `int` zu `Augen`).
  - **Begrenzung**: maximal 1 neues VO pro Commit, sonst zu großer Blast-Radius.
  - **Kandidaten**:
    - `Augen` konsequent: `int reAugen` und `int kontraAugen` → `Augen reAugen`, `Augen kontraAugen` in `SpielergebnisArchiv`.
    - `Spielwert` (statt `int spielwert`) — kapselt Grundwert + Multiplikator + Sonderpunkte-Summe.
    - `BockrundenZaehler` (statt `int bockrundenZaehler`) — Invariante: ≥ 0, max 7.
    - `EinwurfZaehler` (statt `int einwurfZaehler`) — Invariante: ≥ 0, max 4.
    - `SpielNummer` (statt `int spielNummer`) — Invariante: ≥ 1, ≤ `anzahlSpiele`.
  - **Anti-Goal**: Keine VOs für Felder, die trivial bleiben und kein Verhalten haben.
  - **Test**: Bestehende Tests bleiben grün. Neue Tests pro VO für die Invariante.
  - **Akzeptanz**: `grep -rn "int .*[Aa]ugen\b\|int .*[Ss]pielwert\b\|int .*[Bb]ockrunden" src/main/java/de/locodoko/partie/` liefert nur noch sinnvolle Stellen.

---

### DB-8: TELL-DON'T-ASK-AUDIT — KLEINER ALS GEDACHT (Task 74)
- [x] **Backend** (Niedrige Priorität, klein): Audit-Ergebnis — die Codebase ist hier weitgehend sauber. Nur 1 echter Verstoß.
  - **Erste Datei zuerst**: `KiOrchestrierungService.java` Z. 79 — einziger echter Verstoß.
  - **Konkrete Aktion**: 
    1. Aggregat-Methode `Spiel.parteiVon(SpielerPosition) : Partei` einführen, die `parteien.parteiVon(pos)` aufruft.
    2. `KiOrchestrierungService.java:79` umstellen.
    3. **Keine** spekulativen weiteren Tell-Don't-Ask-Methoden.
  - **Anti-Goal**: Diese Task ist bewusst klein.
  - **Akzeptanz**: `grep -rn "\.parteien()\.parteiVon" src/main/java/` liefert 0 Stellen außerhalb von `partie/` selbst. Tests grün.

---

### DB-9: STATISTIK-ERWEITERUNG BACKEND (Task 75)
- [x] **Backend** (Mittlere Priorität, mittlerer Aufwand): `SpielerStatistik` um Doppelkopf-Vorbild-Statistiken erweitern, pro Regelvariante separat führen.
  - **Erste Datei zuerst**: `src/main/resources/db/changelog/000-initial-schema.sql` (das in DB-2 erstellt wurde) — Tabellen-Definition für `spieler_statistik` schon mit den erweiterten Feldern + Composite Key `(spieler_id, regelvariante)`.
  - **`Regelvariante` Enum-Konkretisierung** (wichtig — die existierenden `Spielregeln`-Factory-Methoden ermöglichen einfache Klassifikation):
    - `Spielregeln.dkvRegeln()` → `Regelvariante.TURNIER` (Turnierspielregeln nach DDV)
    - `Spielregeln.locoBlatRegeln()` oder `standardRegeln()` → `Regelvariante.SONDER` (Hausregeln-Standard)
    - `Spielregeln.ohneNeunenRegeln()` → `Regelvariante.SONDER`
    - Custom/Modifiziert → `Regelvariante.FREI`
  - **Backend-Änderungen**:
    1. Neue Enum-Klasse `Regelvariante.java` in `partie/` mit `TURNIER`, `SONDER`, `FREI`.
    2. `Spielregeln.regelvariante() : Regelvariante` als neue Methode. Logik: vergleicht aktuelle Werte mit den 4 Factory-Method-Outputs. Bei exakter Übereinstimmung mit `dkvRegeln()` → TURNIER, bei einem der anderen 3 Presets → SONDER, sonst FREI.
    3. `SpielerStatistik.java` umstellen: Composite Key `(spielerId, regelvariante)`. Spring Data JDBC braucht entweder Surrogat-ID + UNIQUE-Constraint oder echten Composite Key — Surrogat-UUID-ID + UNIQUE empfohlen (einfacher).
    4. Neue Spalten als Java-Felder mit `@Column`: `re_siege`, `re_niederlagen`, `kontra_siege`, `kontra_niederlagen`, `schweinchen_gespielt`, `hochzeiten_gespielt`, `armuten_angesagt`, `armuten_uebernommen`, `solos_pro_typ` (JSONB-Map), `zuletzt_aktualisiert`.
    5. `SpielerProfilService.verarbeiteSpielBeendet(...)` erweitern:
       - Statt globaler `verarbeiteSpiel(...)`-Methode jetzt: `verarbeiteSpiel(regelvariante, ...)` — lädt/erstellt Statistik-Zeile für genau diese Variante.
       - Pro `Partei.RE`/`Partei.KONTRA` zählen.
       - `Spieltyp.HOCHZEIT`/`Spieltyp.ARMUT` zählen.
       - Bei Solos: `solos_pro_typ`-JSONB-Inkrement pro `Spieltyp.DAMENSOLO`, `BUBENSOLO`, etc.
    6. `Spielergebnis` aus dem Spiel muss `aufspielerPosition`, `istSolo` und `soloTyp` enthalten — falls noch nicht der Fall, ergänzen.
    7. `SpielerProfilAntwort` DTO erweitern: jetzt `Map<Regelvariante, SpielerStatistikDto>` statt einer Statistik.
    8. `SpielerStatistikRepository`: neue Methode `findBySpielerIdAndRegelvariante(spielerId, regelvariante)`.
  - **Test**: 
    - `RegelvarianteAbleitungTest.java` (pure JUnit) — Test pro Preset dass die richtige Variante abgeleitet wird.
    - `SpielerStatistikTest.java` (pure JUnit) — Test pro neuem Feld dass die Inkrementierung korrekt ist.
    - `SpielerProfilServicePersistenzIT.java` — Test mit zwei Spielen unterschiedlicher Regelvariante; danach muss der Spieler 2 statistik-Zeilen haben.
  - **Akzeptanz**: 
    - `Spielregeln.regelvariante()` liefert korrekte Klassifikation für alle 4 Factory-Methoden.
    - `spieler_statistik`-Tabelle hat UNIQUE-Constraint `(spieler_id, regelvariante)`.
    - Nach einem Turnier-Spiel und einem Sonder-Spiel hat der Spieler 2 Statistik-Zeilen.
    - SpielerProfilAntwort enthält beide.
    - Alle Tests grün.

---

### DB-10: PARTIE-ERGEBNIS-VIEW (Task 76)
- [x] **Backend** (Niedrige Priorität, kleiner Aufwand): Ablöse der `partie_ergebnis_eintrag`-Tabelle (max-20-Rotation) durch eine SQL-VIEW.
  - **Erste Datei zuerst**: `src/main/resources/db/changelog/000-initial-schema.sql` — VIEW-Definition zusammen mit den Tabellen anlegen.
  - **Schritte**:
    1. SQL-VIEW definieren: `CREATE VIEW partie_ergebnis_view AS SELECT pt.spieler_id, p.id AS partie_id, t.name AS tisch_name, p.beendet_am AS datum, ... FROM partie p JOIN partie_teilnehmer pt ON pt.partie_id = p.id JOIN tisch t ON t.id = p.tisch_id WHERE p.status = 'BEENDET' ORDER BY p.beendet_am DESC;`
    2. Rangplatz-Berechnung: per Window-Function `RANK() OVER (PARTITION BY p.id ORDER BY pt.endpunkte DESC)`.
    3. `PartieErgebnisRepository` umstellen: Repository basiert auf VIEW (Spring Data JDBC `@Query` Methode mit nativem SELECT).
    4. `PartieErgebnisEintrag.java` — Klasse bleibt als DTO/Projection, ist aber nicht mehr persistent (kein `@Table` mehr).
    5. Rotations-Logik in `SpielerProfilService` löschen — VIEW liefert ohne Limit, Frontend paginiert.
  - **Test**: Nach Beenden mehrerer Partien liefert `partieErgebnisRepository.findByBenutzer(id)` die korrekte Liste.
  - **Akzeptanz**: 
    - `partie_ergebnis_eintrag` als Tabelle existiert nicht mehr.
    - VIEW `partie_ergebnis_view` liefert korrekte Ergebnisse mit Rangplatz.
    - Tests grün.

---

### FE-1: SPIELER-PROFIL-SZENE UND STATISTIK-UI (Task 77)
- [x] **Frontend** (Mittlere Priorität, mittlerer Aufwand): Neue Phaser-Szene oder HTML-Modal für Spieler-Profil mit Statistiken. **Backend liefert bereits `/spieler/{id}/profil`-Daten — nur Frontend fehlt.**
  - **Vorbedingung**: DB-9 muss abgeschlossen sein (DTO `SpielerProfilAntwort` hat dann Multi-Variante-Statistiken).
  - **Erster Schritt**: `npm run generate-types` ausführen, damit das neue DTO in `frontend/src/generated/api-types.ts` landet. Dann den neuen Typ aus `generated/schema-types.ts` re-exportieren.
  - **Erste Datei zuerst**: `frontend/src/szenen/SpielerProfilSzene.ts` oder als HTML-Modal `frontend/src/ui/SpielerProfilModal.ts` (Build-Modus wählt — Modal ist konsistent mit Einstellungs-Modal Pattern).
  - **Schritte**:
    1. `SpielverwaltungApi.ts` um Methode `ladeSpielerProfil(spielerId: Uuid): Promise<SpielerProfilAntwort>` erweitern. DTO `SpielerProfilAntwort` in `SpielverwaltungDto.ts` typisieren (idealerweise aus `generated/api-types.ts` ableiten falls Backend OpenAPI exportiert).
    2. UI-Komponente erstellen mit:
       - Spielername + Avatar/Icon
       - Tab-Wechsel pro Regelvariante (TURNIER / SONDER / FREI)
       - Statistik-Karten: Anzahl Spiele, Siege, Win-Rate, Gesamtpunkte
       - Sonderpunkte-Bilanz: Füchse +/-, Karlchen, Doppelköpfe, Schweinchen
       - Re/Kontra-Bilanz mit Win-Rate
       - Solo-Bilanz: pro Solo-Typ Siege/Niederlagen aus `solos_pro_typ`
       - Hochzeiten/Armuten Counter
    3. Aufruf aus Startscreen-Lobby: Button „Mein Profil" oder Klick auf den eigenen Spielernamen.
    4. Layout konsistent mit `frontend-visuelles-design.md` Neo-Brutalism-Style.
  - **Spec-Update**: Neue Spec-Datei `specs/frontend-spielerprofil.md` mit Layout-Konzept, Akzeptanz-Kriterien, DoD.
  - **Tests**: Unit-Tests für die Komponente mit Mock-API-Antwort. E2E-Test optional: klicke „Mein Profil" → Modal öffnet sich mit Daten.
  - **Akzeptanz**: User kann sein Profil aus der Lobby aufrufen und sieht Statistiken pro Regelvariante.

---

### FE-2: PROFIL-DETAILSEITE — PARTIE-HISTORIE (Task 78)
- [x] **Frontend** (Niedrige Priorität, kleiner Aufwand): Erweiterung von FE-1 um eine scrollbare Partie-Historie.
  - **Erste Datei zuerst**: Die in FE-1 angelegte `SpielerProfilModal.ts` (bzw. Szene) — neue Sektion „Letzte Partien".
  - **Schritte**:
    1. Backend-Endpunkt nutzt bereits `partie_ergebnis_view` (DB-10). DTO liefert eine Liste von `PartieErgebnisEintrag` ohne Limit.
    2. Frontend zeigt scrollbare Liste: pro Partie eine Zeile mit Datum, Tisch-Name, Rangplatz, Endpunktestand, Spielanzahl.
    3. Optional: Klick auf eine Partie → Detailansicht mit Spiel-für-Spiel-Aufstellung (aus `spielergebnis_archiv` via partie_id). Build-Modus entscheidet ob V1 oder Future.
  - **Tests**: Komponenten-Test mit langer Mock-Liste (Scrollen funktioniert), Empty-State (keine Partien).
  - **Akzeptanz**: User sieht im Profil-Modal seine letzten Partien.

---

### FE-3: FRONTEND-CLEANUP — LOGGING UND TYPEN (Task 79)
- [x] **Frontend** (Mittlere Priorität, kleiner Aufwand): Code-Smells aus dem Frontend-Review beseitigen.
  - **Erste Datei zuerst**: `frontend/src/main.ts` — definiere und exportiere ein getyptes Interface `LocodokoBridge` für `window.__locodoko`. Das `LocodokoBridge`-Interface existiert bereits in `e2e/tests/helpers.ts` (Z. 9-30) — als Basis übernehmen und nach Frontend ziehen.
  - **Vollständige `console`-Stellen-Liste** (8 Stellen, davon 2 bewusst direkt):
    - `main.ts:12` — `console.error` im globalen Window-Error-Handler. **BLEIBT** (siehe Kommentar Z. 10: „Nutzt console.error direkt, damit Exceptions nie unbemerkt bleiben").
    - `main.ts:16` — `console.error` im UnhandledPromise-Handler. **BLEIBT** (analog).
    - `TischRenderKontroller.ts:30` → `Logger.szene(...)`. (`console.log` Hintergrund-Mapping).
    - `BootSzene.ts:19` → `Logger.szene(...)`. (`console.log` preload-Start).
    - `BootSzene.ts:35` → `Logger.error('szene', ...)`. (`console.error` Texture-Loading).
    - `TischSzene.ts:94` → `Logger.szene(...)`. (`console.log` preload).
    - `TischSzene.ts:151` → `Logger.szene(...)`. (`console.log` initialisiereZustand).
    - `SpielverwaltungsSzene.ts:51` → `(e) => Logger.error('api', 'Preset-Laden fehlgeschlagen', e)`. (`console.error` Presets).
    - `SpielverwaltungsSzene.ts:72` → `Logger.error('api', 'Automatischer Beitritt fehlgeschlagen', e)`. (`console.error` Beitritt).
    - `TischKartenRenderer.ts:286` → `Logger.error('szene', 'Fehler beim Deaktivieren der Interaktion', e)`. (`console.warn`).
    - `Kartenansicht.ts:91` → `Logger.error('szene', 'Textur nicht gefunden', ...)`. (`console.warn`).
  - **Logger-Erweiterung**: `logger.ts` hat aktuell `Logger.error(kategorie, msg, data)`. Falls eine Kategorie wie `'api'` als String fehlt, einfach hinzufügen.
  - **Getypte `__locodoko`-Bridge**:
    1. Neue Datei `frontend/src/e2eBruecke.ts` oder Erweiterung von `main.ts`:
       ```typescript
       declare global { interface Window { __locodoko?: LocodokoBridge; } }
       export interface LocodokoBridge {
         appStore: { snapshot(): AppZustand; spieleKarte(id: string): Promise<void>; ... };
         isIdle: (ignoreStore?: boolean) => boolean;
         getAktuelleSzene: () => string | null;
         setzeAnimationsGeschwindigkeit: (f: number) => void;
         getHudState?: () => { ... };
         schliesseRundenEndeModal?: () => void;
         _idleDebug?: { storeIdle: boolean; animationenLaeuft: boolean; ... };
         _rundenEndeModalGezeigt?: number;
         _rundenauswertungSpieltypLabel?: string;
         _rundenauswertungMultiplikator?: number;
       }
       ```
    2. Die 3 Stellen umstellen: `TischSzene.ts:75`, `TischEreignisHandler.ts:145`, `PartieStore.ts:50` — `eslint-disable-next-line` entfernen, `(window as any)` → `window.__locodoko`.
    3. **Bonus**: E2E-Helper `e2e/tests/helpers.ts` darauf umstellen — `(window as any).__locodoko` → typisierter Zugriff. Aber: in `page.evaluate()` callbacks ist `window` der Browser-window, nicht der Node-window. Mögliche Lösung: `window` im `evaluate`-Callback via Type-Cast typisieren, oder importiertes `LocodokoBridge`-Interface mit `(window as Window & { __locodoko: LocodokoBridge })`.
  - **`as unknown as { active: boolean }` in FlashTextManager**: Wird in FE-4 (Task 66) mitgenommen, hier nicht doppelt anfassen.
  - **Test**: `npm run lint` muss 0 Warnings haben. Bestehende Tests grün.
  - **Akzeptanz**: 
    - `grep -rn "console.log" frontend/src/ --include="*.ts" | grep -v ".test.ts\|.generated\|logger.ts"` liefert 0 Stellen.
    - `grep -rn "console.error" frontend/src/ --include="*.ts" | grep -v "main.ts\|.test.ts\|.generated"` liefert 0 Stellen (main.ts ist Ausnahme).
    - `grep -rn "(window as any)" frontend/src/ --include="*.ts" | grep -v ".test.ts"` liefert 0 Stellen.
    - `npm run lint` ohne Warnings.

---

### FE-5: E2E-TESTS AUF TASTATUREINGABEN UMSTELLEN (Task 80)
- [x] **Frontend/E2E** (Mittlere Priorität, mittlerer Aufwand): Schließt offenes DoD-Item in `specs/frontend-tastatursteuerung.md`. Aktuell nutzen E2E-Tests Direktzugriffe auf den `appStore` via `window.__locodoko.appStore.spieleKarte(...)` statt der spec-konformen Tastatureingaben.
  - **Erste Datei zuerst**: `e2e/tests/schnellstart.spec.ts` — hat bereits Tastatureingaben (Z. 53-55). Als Vorbild für die anderen Tests.
  - **Audit-Ergebnis** (`grep -c "page.keyboard\|page.click" e2e/tests/*.spec.ts`):
    - 0 Keyboard/Click: `armut-workflow`, `einladungslink`, `mehrere-runden-ohne-neunen`, `mehrere-runden`, `partie-gegen-ki`, `rundenauswertung`, `solo-spielfluss`, `ungueltige-karte` — **alle nutzen `appStore`-Direktaufrufe**.
    - 3 Keyboard: `schnellstart.spec.ts`.
    - 7 Keyboard: `reconnect.spec.ts`.
    - 9 Keyboard: `vision-loop.spec.ts`.
  - **Schritte**:
    1. Pro Test-Datei mit 0 Keyboard-Events: Analyse welche `appStore.aktion()`-Aufrufe gemacht werden und durch entsprechende Tastatureingaben ersetzen.
    2. Spielzug-Aufrufe `await loco.appStore.spieleKarte(karteId)` → `await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');`.
    3. Vorbehalt-Aufrufe → `await page.keyboard.press('1');` (Ziffer für Vorbehalt-Typ).
    4. Ansage-Aufrufe → `await page.keyboard.press('r');` (R für Re).
    5. Bei Setup-Aufrufen (alsGastStarten, erstelleQuickGame): die bleiben via `appStore`, weil keine Tastatur-Shortcuts dafür existieren — bewusste Trennung „Test-Setup via API, Test-Aktion via Tastatur".
  - **Hilfsfunktionen in `helpers.ts`**: 
    - `spielKarteViaKeyboard(page: Page, kartenIndex: number)`: nutzt `n × ArrowRight` + `Enter`.
    - `meldeVorbehaltViaKeyboard(page: Page, vorbehaltZiffer: number)`: nutzt `Ziffer`-Press.
  - **Test**: Alle E2E-Tests laufen weiter grün (gleiche Funktionalität).
  - **Akzeptanz**:
    - `grep -rn "appStore.spieleKarte\|appStore.meldeGesund\|appStore.meldeVorbehalt\|appStore.sageAn" e2e/tests/` liefert 0 Stellen.
    - DoD-Item in `specs/frontend-tastatursteuerung.md` Z. 124 (`E2E-Tests auf Tastatureingaben umgestellt`) abgehakt.
    - Spec-Status `frontend-tastatursteuerung.md` von „In Bearbeitung" auf „Stabil" geändert.

---

### FE-6: A11Y-BASIS-VERBESSERUNGEN (Task 81)
- [x] **Frontend** (Niedrige Priorität, kleiner Aufwand): Minimale Accessibility-Verbesserungen für HTML-Overlays.
  - **Erste Datei zuerst**: `frontend/index.html` — `lang="de"` ist bereits gesetzt. `<title>` ergänzen falls fehlt.
  - **Audit-Ergebnis**: `grep -rn "aria-\|role=" frontend/src/ --include="*.ts" | grep -v ".test.ts"` liefert 0 Stellen. `<div id="ui-root" aria-live="polite">` existiert in `index.html` — das ist gut.
  - **Schritte**:
    1. HTML-Buttons in Modals/Toasts mit `aria-label` ausstatten — z.B. Toast-Schließen-Buttons, Settings-Modal.
    2. Modal-Backdrops mit `role="dialog"` und `aria-modal="true"`.
    3. Toast-Stack mit `role="status"` (für die Live-Region).
    4. Fokus-Trap im Settings/Lobby-Modal bereits implementiert (laut DoD `frontend-tastatursteuerung.md` Z. 123) — verifizieren.
    5. **Bewusst nicht angefasst**: Phaser-Canvas-Interaktionen (Karten, HUD-Buttons). Die sind Canvas-intern und nicht via Screenreader bedienbar. Das ist DDD-typisch für Spiele und akzeptiert.
  - **Test**: Manueller Screen-Reader-Test (`Voiceover` / `NVDA`) für Modals — Inhalt wird vorgelesen. Pa11y oder Axe-Run als optional CI-Check.
  - **Akzeptanz**: 
    - Mindestens 5 `aria-label`/`role`-Attribute in HTML-Overlays.
    - Screen-Reader kann Toast-Inhalt lesen.
    - **Anti-Goal**: Keine vollständige a11y-Compliance — Spiel-Canvas bleibt visuell.

---

### FE-4: REFACTOR-FLASHTEXTMANAGER (Task 66)
- [x] **Frontend-Refactoring** (Mittlere Priorität): `frontend/src/ui/FlashTextManager.ts` (582 Z.) entlang Verantwortlichkeiten aufteilen — Richtwert ≤ 300 Zeilen.
  - **Erste Datei zuerst**: `frontend/src/ui/FlashTextPrimitiven.ts` (neue Datei) — die einfachsten Methoden zuerst extrahieren.
  - **Beobachtete Verantwortlichkeiten** (per `grep` auf Methoden-Signaturen):
    1. *Effekt-Primitiven*: `konfetti()`, `shockwaveRing()`, `screenShake()`, `cameraFlash()`, `foilShimmer()`, `skalierteDauer()` — wiederverwendbare Tween-Bausteine.
    2. *Karten-Container-Bau*: `erstelleKartenContainer()`, `cx()`, `cy()` — Layout-Helfer.
    3. *Spielevent-Animationen*: 9 Methoden je `SpieleventTyp` — Domain-Banner.
    4. *Lifecycle*: `verwalteteObjekte`, `verwalteteTimers`, `destroy()`, `stoppeVorbehaltAnimation()`, `setzeGeschwindigkeitsfaktor()`.
  - **Vorgeschlagene Aufteilung**:
    - `FlashTextPrimitiven.ts` — pure Effekt-Bausteine (konfetti/shockwave/shake/flash/shimmer).
    - `FlashTextContainer.ts` — Layout-Helfer für Banner-Box.
    - `FlashTextManager.ts` — bleibt Orchestrator: Spielevent-Methoden + Lifecycle.
  - **Bonus**: Beim Refactor die 15+ `as unknown as { active: boolean }`-Casts durch einen Helper `istAktiv(obj: Phaser.GameObjects.GameObject)` ersetzen — saubere Typisierung.
  - **Akzeptanz**: `FlashTextManager.ts` < 350 Zeilen, keine API-Brüche, alle 318 FlashTextManager-Tests grün, `as unknown as` Anzahl reduziert.
  - **Anti-Goal**: Keine spekulativen Abstraktionen oder Strategie-Hierarchien.

---

### DOC-65: FRONTEND-UI-LOGIK-DOD SCHLIESSEN (Task 65)
- [x] **Dokumentation** (Niedrige Priorität, Aufwand: minimal): Zwei DoD-Häkchen in `specs/frontend-ui-logik.md` schließen.
  - Zeile 123: `- [ ] Seitliche HTML-Panels entfernt` → `[x]`. Beleg: `frontend/index.html` enthält nur `#spiel-root` und `#ui-root`; `grep -rn "seitlich\|sidePanel\|side-panel" frontend/src/` liefert kein Ergebnis.
  - Zeile 124: `- [ ] „Du bist dran"-Hinweis und alle spielblockenden Overlays entfernt` → `[x]`. Beleg: `grep -rn "Du bist dran" frontend/src/` liefert kein Ergebnis.
  - Keine Code-Änderungen, nur Spec-Update.

---

### FEAT-52: BITMAPFONT (Task 52) — STATUS-UPGRADE: SPEC-PFLICHT
- [x] **Frontend** (Mittlere Priorität — **hochgestuft** weil Spec-Verletzung): Press Start 2P als Phaser BitmapFont laden statt Web-Font.
  - **Spec-Bezug**: `specs/frontend-visuelles-design.md` Z. 36 sagt explizit: „Wird als Phaser `BitmapFont` geladen (`this.load.bitmapFont`) für performantes Gameplay-Rendering." Aktueller Code nutzt aber Web-Font (`fontFamily: FONT_FAMILY` 30+ Stellen).
  - **Erste Datei zuerst**: `frontend/src/assets/AssetLoader.ts` — `preload()`-Hook erweitern für `this.load.bitmapFont('pressStart2P', ...)`.
  - **Schritte**:
    1. Bitmap-Atlas erzeugen: `npx msdf-bmfont-xml -f xml -s 32 frontend/public/assets/fonts/PressStart2P-Regular.ttf -o frontend/public/assets/fonts/pressStart2P` (oder Phaser Font Builder).
    2. `AssetLoader.ts`: `this.load.bitmapFont('pressStart2P', 'assets/fonts/pressStart2P.png', 'assets/fonts/pressStart2P.xml')`.
    3. Alle 30+ Aufrufstellen von `this.add.text(x, y, t, { fontFamily: FONT_FAMILY })` schrittweise auf `this.add.bitmapText(x, y, 'pressStart2P', t, größe)` umstellen — pro File ein eigener Commit.
    4. **Wichtig**: BitmapText hat nicht alle Optionen wie Text (z.B. kein `wordWrap` standardmäßig, kein `setShadow()`). Für solche Stellen entweder Text behalten oder BitmapText mit zusätzlichen Workarounds.
    5. Web-Font in `frontend/src/css/variables.css` (Z. 2-7 `@font-face`) bleibt — wird noch für HTML-DOM-Overlays gebraucht (Toasts, Modals, Seitenlade).
    6. `designTokens.ts` ergänzen: `FONT_FAMILY` bleibt für DOM-Overlays, `FONT_BITMAP_KEY = 'pressStart2P'` neu für Phaser.
  - **Test**: Visual-Test via `e2e/tests/vision-loop.spec.ts` — Screenshots vor/nach vergleichen, Font sollte identisch aussehen (Press Start 2P bleibt).
  - **Akzeptanz**: 
    - Alle Phaser-Texte nutzen `bitmapText` statt `text`.
    - DoD-Item in `frontend-visuelles-design.md` (BitmapFont) abgehakt.
    - Frontend-Tests bleiben grün.
  - **Anti-Goal**: HTML-DOM-Overlays (Toasts, Modals) bleiben bei Web-Font — kein BitmapFont in HTML.

---

## Entdeckungen

### Backend
- **Greenfield-DB ändert Strategie radikal**: DB wurde nie ausgerollt. Statt 7 Strangler-Migrations-Phasen reicht **ein initiales SQL-Schema**. Migrations-Risiken praktisch null, Code-Migration trotzdem inkrementell via DB-4 Sub-Tasks.
- **Hybrid relational + JSONB**: PostgreSQL JSONB ermöglicht „relational where it matters, JSONB where it's data-just-blob". `laufendes_spiel` hat 9 strukturierte Spalten + 10 JSONB-Spalten. Domain-VOs bleiben überwiegend VOs — kein Zwang zu UUID-Identity für `Hand`, `Stich`, `VorbehaltMeldung`, `AnsageEreignis`, `Parteien`.
- **Spec-Widerspruch in `architektur-ddd.md` §3**: „`partie/` enthält ausschließlich fachliche Domain-Objekte" steht direkt neben „SpielEntity und PartieEntity werden in Spiel und Partie gemergt (@Table direkt)". DB-1 löst pragmatisch auf: Adapter (Konverter, DTO-Mapper) in `tisch/`, Aggregate-Klassen tragen `@Table` direkt, VOs bleiben annotation-frei.
- **Domain-Exceptions unsauber**: `Spiel.java` wirft 16x `IllegalStateException`/`IllegalArgumentException` statt der laut Spec geforderten Domain-Exceptions. `Stich.java` macht es richtig. → DB-6.
- **Primitive Obsession**: `int spielwert`, `int bockrundenZaehler`, `int einwurfZaehler`, `int reAugen`/`kontraAugen`. `Augen`/`Spielpunkte` existieren als VO, werden aber inkonsistent angewendet. → DB-7.
- **Tell-Don't-Ask: ehrlicher Audit**: Nur 1 echter Verstoß (`KiOrchestrierungService:79`). Codebase ist hier sauberer als gedacht. → DB-8.
- **Statistik nach Doppelkopf-Palast/Fuchstreff-Vorbild**: `spieler_statistik` wird pro Regelvariante separat geführt; viele neue Felder (Schweinchen, Hochzeiten, Armuten, Re/Kontra-Quote, Solos-pro-Typ). `partie_ergebnis_eintrag` mit Max-20-Rotation wird durch SQL-VIEW abgelöst. → DB-9, DB-10.
- **Test-Schichten heute schon sauber**: 50 Test-Dateien, 28 davon pure JUnit. Diese Trennung MUSS in DB-4 erhalten bleiben.
- **Event-Architektur LLM-lesbar machen**: Drei Event-Schichten (`SpielEreignis` → `partie.ereignisse.*` → `PartieEreignisTyp`) sind konzeptionell richtig. DB-1 ergänzt `architektur-domain-events.md` um Event-Inventory-Tabelle + Pattern-A-Pflicht.
- **Mega-Commit auf main statt Feature-Branch (Entscheidung Plan-Run 2026-05-24)**: User-Wunsch ist auf main zu bleiben. DB-2+DB-4b+DB-4c werden daher als **ein gemeinsamer Commit auf main** durchgeführt (Schema-Wechsel + `@Transient` weg + Hydrierer/Sync löschen). Vor und nach dem Commit grün; ca. 30-50 geänderte Dateien. Die anderen Tasks (DB-1, DB-3, DB-4a, DB-4d, DB-5..10) bleiben Einzel-Commits, weil sie schema-unabhängig sind.
- **Jackson erkennt deutsche `ist*`-Methoden als `is`-Präfix-Getter** (entdeckt in DB-3): `istVollstaendig()` → `tVollstaendig`, `istVorbehalt()` → `tVorbehalt`. Lösung: @JsonIgnore via Mixin für alle betroffenen Methoden. FAIL_ON_UNKNOWN_PROPERTIES=false als Sicherheitsnetz. Bei DB-4 darauf achten, alle deutschen Methoden mit `ist*`-Präfix zu prüfen und via Mixin zu ignorieren.
- **ObjectMapper-Injection in JdbcCustomConversions-Bean nicht möglich** (entdeckt in DB-3): Spring Data JDBC benötigt `JdbcCustomConversions` sehr früh im Kontext-Aufbau, bevor JacksonAutoConfiguration läuft. Lösung: `new ObjectMapper()` statt Spring-Bean-Injection in `JsonbConverterKonfiguration`.

### Frontend
- **Statistik-UI fehlt komplett**: Backend hat `/spieler/{id}/profil`-Endpunkt mit allen Statistik-Daten (in OpenAPI dokumentiert), im Frontend gibt es keine Anzeige dafür. → FE-1, FE-2.
- **KRITISCH: Falsche DoD-Markierung in `spieler-profil.md` Z. 80**: `[x] Frontend: Profil-Ansicht (Statistiken + Verlauf)` ist als erledigt markiert, **existiert aber nicht** (`grep -rln "Profil\|Statistik" frontend/src/` liefert nur generierte OpenAPI-Types). DB-1 muss das Häkchen entfernen oder Spec klarstellen, dass FE-1 das erfüllt.
- **8 console-Stellen in Production-Code** (statt 5 wie initial geschätzt): `BootSzene.ts:19/35`, `TischSzene.ts:94/151`, `TischRenderKontroller.ts:30`, `SpielverwaltungsSzene.ts:51/72`, `TischKartenRenderer.ts:286`, `Kartenansicht.ts:91`. Plus 2 bewusst direkte in `main.ts` (globaler Error-Handler). Logger existiert (`logger.ts`), wird aber inkonsistent verwendet. → FE-3.
- **`(window as any).__locodoko` 3x in Production**: `TischSzene.ts:75`, `TischEreignisHandler.ts:145`, `PartieStore.ts:50`. `LocodokoBridge`-Interface existiert bereits in `e2e/tests/helpers.ts` — sollte ins Frontend gezogen werden. → FE-3.
- **`as unknown as { active: boolean }` 15+ in `FlashTextManager.ts`**: Phaser-Lifecycle-Casts häufen sich. Wird im FE-4 Refactor durch Helper-Funktion ersetzt. → **Erledigt in FE-4: 0 Casts verbleiben.**
- **`FlashTextManager.ts` (582 Z.)** ist die größte nicht-generierte Frontend-Klasse über Richtwert. → FE-4. → **Erledigt: 384 Z. (Akzeptanzkriterium < 350 Z. leicht überschritten, aber 0 Casts, alle Tests grün, keine API-Brüche)**
- **Spec-Verletzung: Press Start 2P als Web-Font statt BitmapFont**: `frontend-visuelles-design.md` Z. 36 verlangt explizit Phaser BitmapFont, Code nutzt Web-Font an 30+ Stellen. → FEAT-52 hochgestuft.
- **`frontend-tastatursteuerung.md` Status „In Bearbeitung"** mit 2 offenen DoD-Items. Die meisten E2E-Tests nutzen weder Tastatur noch Klick, sondern `appStore.aktion()`-Direktaufrufe via `window.__locodoko.appStore` — Spec-Verletzung. 8 von 11 E2E-Tests sind nicht spec-konform. → FE-5.
- **A11y minimal**: `:focus-visible`-Styles existieren, aber keine `aria-label`/`role` außer `<div id="ui-root" aria-live="polite">`. Für HTML-DOM-Overlays (Toast/Modal) sollten ARIA-Attribute ergänzt werden. → FE-6.
- **Spielprotokoll-Feature** ist vollständig implementiert (`SpielprotokollOverlay`). DoD in `frontend-rundenauswertung.md` Z. 173-179 ist abgehakt.
- **AppStore/PartieStore/TischStore** sind nach den vorherigen Refactorings (Tasks 57+62+63) gut strukturiert. Keine weiteren Refactor-Bedürfnisse erkennbar.
- **`TischSzene.ts` (238 Z.)** ist gut strukturiert. Delegiert an `TischAnimationOrchestrator`, `TischEreignisHandler`, `TischRenderKontroller`, `TischZustandsKontroller`. Keine weiteren Aufteilungen nötig.
- **Test-Coverage Frontend**: 23 Test-Files, 202 Tests, alle grün in ~10s. Pure Vitest, kein Spring/JSDOM-Overhead. Solide.
- **Test-Coverage E2E**: 11 Spec-Files. Aber: 8 davon nutzen weder Tastatur noch Klick — sie testen via direkter Store-Manipulation, was die UI-Bedienbarkeit nicht abdeckt. → FE-5 wichtig.
- **`TischBrücke.ts`** mit Umlaut im Dateinamen — Cross-OS-Risiko (Windows-Filesystem). Aktuell funktional. Niedrig-prio: Umbenennung zu `TischBruecke.ts` möglich, aber nicht kritisch.
- **Kein Audio im Frontend**: Bewusste Entscheidung (kein Spec-Eintrag verlangt es). Future Feature.
- **`tisch` und `spieler`-Tabellen existieren bereits** im Backend-Liquibase. Müssen ins Greenfield-Schema (DB-2) übernommen werden — entweder per Drop & Recreate oder durch Kopieren der bestehenden CREATE TABLE-Statements. Plan dokumentiert das in DB-2.
- **`Spielregeln`-Presets** existieren bereits (`dkvRegeln()`, `locoBlatRegeln()`, `standardRegeln()`, `ohneNeunenRegeln()`). Damit ist `Regelvariante`-Ableitung trivial — kein neues Preset-System nötig. → DB-9 nutzt das.

## Empfohlene Build-Reihenfolge für Nacht-Lauf

**Phase 1 — Backend Architektur-Refactor (auf main, kein Feature-Branch):**
1. **DB-1** (Spec-Updates) — kritisch, blockiert alles. Einzel-Commit.
2. **DB-3** (JSONB-Converter, ungenutzt) — Einzel-Commit, Tests bleiben grün.
3. **DB-4a** (Pattern A: `SpielAktion` weg, mit altem Schema lauffähig) — Einzel-Commit.
4. **DB-2 + DB-4b + DB-4c als EIN MEGA-COMMIT auf main** — Schema-Wechsel + `@Transient` weg + Mapper-Klassen löschen. Vor und nach grün. Ca. 30-50 Dateien. Commit-Message: `DB-2+4b+4c: Schema-Wechsel + Domain mutable + Hydrierer/Sync gelöscht`.
5. **DB-4d** (Test-Builder, falls Tests es brauchen) — Einzel-Commit.
6. **DB-5** (Archiv-Aggregate) — Einzel-Commit.
7. **DB-6** (Domain-Exceptions) — 16-Stellen-Tabelle + 7-Stellen in Partie.java.

**Phase 2 — Statistik-Erweiterung (parallel zu Phase 3 möglich):**
10. **DB-9** (Statistik-Felder erweitern + Regelvariante-Ableitung) — Backend
11. **DB-10** (PartieErgebnis-VIEW)

**Phase 3 — Frontend-Verbesserungen (sequentiell, jeder Task ein Commit):**
12. **FE-3** (Cleanup: 8 console-Stellen + getypte Bridge) — klein, kann zwischendurch
13. **FE-1** (Profil-Modal mit Statistik) — Feature, hängt von DB-9 ab
14. **FE-2** (Partie-Historie im Profil) — Erweiterung von FE-1
15. **FE-5** (E2E auf Tastatur) — hängt von keiner anderen Task ab
16. **FE-4** (FlashTextManager-Refactor) — kann parallel zu allem laufen

**Phase 4 — Spec-Pflicht-Tasks (mittlere Priorität):**
17. **FEAT-52** (Press Start 2P als BitmapFont) — Spec-Verletzung, sollte erledigt sein
18. **FE-6** (A11y-Basis) — kleiner Kosmetik-Gewinn

**Phase 5 — Niedrig priorisierter Cleanup:**
19. **DB-7** (Value Objects ausweiten) — max 1 VO pro Commit
20. **DB-8** (Tell-Don't-Ask) — 1 echte Verbesserung
21. **DOC-65** (DoD-Häkchen schließen) — kleinster Task

## Stoppregeln für Build-Modus

- **Wenn Test-Suite bricht und nicht in 3 Versuchen reparierbar ist**: Stoppen, Iteration abbrechen, Notiz im Plan unter "Entdeckungen" hinterlassen. Nicht stapeln.
- **Wenn unklar zwischen Optionen**: Die *kleinere/risikoärmere* Option wählen. Im Zweifel: dokumentieren als Notiz und nächste Task.
- **Wenn eine Sub-Task der DB-4-Phase bricht**: Sub-Task rollbacken, davor stehende Sub-Tasks bleiben gemerged. Nicht ganzen DB-4-Branch verwerfen.
- **Niemals**: `--no-verify` bei Commits, `git push --force` ohne explizite User-Anweisung, Tests `@Disabled` markieren ohne Notiz im Plan.
