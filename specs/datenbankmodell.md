# Datenbankmodell

| Feld           | Wert                                                                            |
|----------------|---------------------------------------------------------------------------------|
| Status         | Aktive Vorgabe — Hybrid-Schema (Entscheidung 2026-05-22)                        |
| Priorität      | Hoch                                                                            |
| Abhängigkeiten | architektur-ddd.md, spieler-profil.md, architektur-spielkern.md                 |

## Beschreibung

**Greenfield-Annahme:** Das Schema wurde nie produktiv ausgerollt. Alle 22 alten YAML-Changesets
sind in `db/changelog/archiv/` archiviert. Ein einziges initiales SQL-Changeset
`000-initial-schema.sql` definiert das finale Schema.

**Technologie:** Spring Data JDBC (kein JPA/Hibernate) + Liquibase. PostgreSQL als Ziel-DB.

**Architektur:** Hybrides Modell — relational für Stammdaten und Statistik-queryable Archive,
JSONB für inner-Aggregate-State (Hände, Stiche, Vorbehalte, Ansagen, Parteien-Zuordnungen).

---

## Tabellen-Übersicht

### `tisch` (existierend, aktualisiert)

```sql
tisch (
  id               UUID PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'WARTEND',
  partie_id        UUID REFERENCES partie(id) ON DELETE SET NULL,
  ohne_neunen      BOOLEAN NOT NULL DEFAULT FALSE,
  anzahl_spiele    INT NOT NULL DEFAULT 24,
  tischhintergrund VARCHAR(50),
  hochzeit_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
  armut_erlaubt    BOOLEAN NOT NULL DEFAULT TRUE,
  damensolo_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
  bubensolo_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
  fleischlos_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
  trumpfsolo_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
  zweite_dulle_sticht BOOLEAN NOT NULL DEFAULT TRUE,
  fuchs_gefangen_aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  karlchen_aktiv   BOOLEAN NOT NULL DEFAULT TRUE,
  doppelkopf_aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  mindestkarten_re_kontra INT NOT NULL DEFAULT 11,
  mindestkarten_keine90 INT NOT NULL DEFAULT 10,
  mindestkarten_keine60 INT NOT NULL DEFAULT 9,
  mindestkarten_keine30 INT NOT NULL DEFAULT 8,
  mindestkarten_schwarz INT NOT NULL DEFAULT 7,
  ki_schwierigkeit VARCHAR(30),
  bockrunden_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
  schweinchen_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
  dreissig_augen_pflicht_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
  schmeissen_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
  herz_durchgegangen_nur_hoch BOOLEAN NOT NULL DEFAULT FALSE,
  einladungs_code  VARCHAR(20),
  zugangsmodus     VARCHAR(30) NOT NULL DEFAULT 'OFFEN',
  erstellt_am      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  aktualisiert_am  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  erstellt_von_spieler_id UUID REFERENCES spieler(id) ON DELETE SET NULL
)
```

### `spieler` (existierend, aktualisiert)

```sql
spieler (
  id              UUID PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  session_id      VARCHAR(255) UNIQUE,
  ki              BOOLEAN NOT NULL DEFAULT FALSE,
  external_id     VARCHAR(255),
  ki_uebernommen  BOOLEAN NOT NULL DEFAULT FALSE,
  passwort_hash   VARCHAR(255),
  authentifizierungs_methode VARCHAR(50),
  benutzername    VARCHAR(100),
  email           VARCHAR(255),
  anzeige_name    VARCHAR(100),
  avatar_farbe    VARCHAR(50),
  email_verifiziert BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_token_ablauf TIMESTAMP WITH TIME ZONE,
  erstellt_am     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
)
```

### `partie` (RELATIONAL — Stammdaten)

```sql
partie (
  id                        UUID PRIMARY KEY,
  version                   BIGINT NOT NULL DEFAULT 0,
  anzahl_spiele             INT NOT NULL,
  aktuelles_spiel_nummer    INT NOT NULL DEFAULT 0,
  status                    VARCHAR(30) NOT NULL,
  punkte_sued               INT NOT NULL DEFAULT 0,
  punkte_west               INT NOT NULL DEFAULT 0,
  punkte_nord               INT NOT NULL DEFAULT 0,
  punkte_ost                INT NOT NULL DEFAULT 0,
  bockrunden_zaehler        INT NOT NULL DEFAULT 0,
  solist_des_letzten_spiels VARCHAR(10),
  naechster_geber           VARCHAR(10),
  regelvariante             VARCHAR(20) NOT NULL,
  spielregeln               JSONB NOT NULL,
  erstellt_am               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  aktualisiert_am           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  beendet_am                TIMESTAMP WITH TIME ZONE,
  erstellt_von_spieler_id   UUID REFERENCES spieler(id) ON DELETE SET NULL
)
```

### `partie_teilnehmer` (RELATIONAL — M:N Spieler↔Partie)

```sql
partie_teilnehmer (
  id                UUID PRIMARY KEY,
  partie_id         UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
  spieler_id        UUID REFERENCES spieler(id) ON DELETE SET NULL,
  spieler_position  VARCHAR(10) NOT NULL,
  beigetreten_am    TIMESTAMP WITH TIME ZONE,
  ausgeschieden_am  TIMESTAMP WITH TIME ZONE,
  UNIQUE(partie_id, spieler_position)
)
```

### `laufendes_spiel` (HYBRID — relational + JSONB)

```sql
laufendes_spiel (
  id                    UUID PRIMARY KEY,
  partie_id             UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
  spiel_nummer          INT NOT NULL,
  geber_position        VARCHAR(10) NOT NULL,
  spieltyp              VARCHAR(30) NOT NULL,
  phase                 JSONB NOT NULL DEFAULT '{"typ":"VORBEHALT_ANSAGE"}',
  trumpf_ordnung_typ    JSONB NOT NULL DEFAULT '{"typ":"NORMAL"}',
  einwurf_zaehler       INT NOT NULL DEFAULT 0,
  solist_aufspieler     VARCHAR(10),
  armut_spieler_position VARCHAR(10),
  armut_partner_position VARCHAR(10),
  spielregeln           JSONB NOT NULL,
  haende                JSONB NOT NULL DEFAULT '{}',
  vorbehalt_meldungen   JSONB NOT NULL DEFAULT '[]',
  partei_zuordnungen    JSONB,
  ansage_ereignisse     JSONB NOT NULL DEFAULT '{"ereignisse":[]}',
  abgeschlossene_stiche JSONB NOT NULL DEFAULT '[]',
  bereits_geschmissen   JSONB NOT NULL DEFAULT '[]',
  kartendeck            JSONB,
  ergebnis              JSONB,
  erstellt_am           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  aktualisiert_am       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(partie_id, spiel_nummer)
)
```

**JSONB-Beispiele:**

```json
// haende
{"NORD": [{"farbe": "KREUZ", "wert": "DAME"}, ...],
 "OST":  [...], "SUED": [...], "WEST": [...]}

// vorbehalt_meldungen
[{"spielerPosition": "NORD", "ansage": "GESUND"},
 {"spielerPosition": "OST",  "ansage": "SOLO_DAMEN"}]

// partei_zuordnungen
{"NORD": {"partei": "RE",     "offen": true},
 "OST":  {"partei": "KONTRA", "offen": false}}
```

### `spielergebnis_archiv` (RELATIONAL — Statistik-queryable)

```sql
spielergebnis_archiv (
  id                      UUID PRIMARY KEY,
  partie_id               UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
  spiel_nummer            INT NOT NULL,
  geber_position          VARCHAR(10) NOT NULL,
  spieltyp                VARCHAR(30) NOT NULL,
  ist_solo                BOOLEAN NOT NULL DEFAULT FALSE,
  solo_typ                VARCHAR(30),
  re_augen                INT NOT NULL,
  kontra_augen            INT NOT NULL,
  sieger_partei           VARCHAR(10) NOT NULL,
  spielwert               INT NOT NULL,
  grundwert               INT NOT NULL,
  absage_punkte           INT NOT NULL DEFAULT 0,
  gegen_die_alten_punkte  INT NOT NULL DEFAULT 0,
  solo_multiplikator      INT NOT NULL DEFAULT 0,
  spielpunkte_sued        INT NOT NULL DEFAULT 0,
  spielpunkte_west        INT NOT NULL DEFAULT 0,
  spielpunkte_nord        INT NOT NULL DEFAULT 0,
  spielpunkte_ost         INT NOT NULL DEFAULT 0,
  abgeschlossen_am        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(partie_id, spiel_nummer)
)
```

### `sonderpunkt_eintrag` (RELATIONAL — FK-Child)

```sql
sonderpunkt_eintrag (
  id                       UUID PRIMARY KEY,
  spielergebnis_archiv_id  UUID NOT NULL REFERENCES spielergebnis_archiv(id) ON DELETE CASCADE,
  partei                   VARCHAR(10) NOT NULL,
  sonderpunkt_typ          VARCHAR(50) NOT NULL,
  taeter_position          VARCHAR(10),
  opfer_position           VARCHAR(10)
)
```

### `spieler_statistik` (RELATIONAL — Aggregat-Cache, pro Regelvariante)

```sql
spieler_statistik (
  id                    UUID PRIMARY KEY,
  spieler_id            UUID NOT NULL REFERENCES spieler(id) ON DELETE CASCADE,
  regelvariante         VARCHAR(20) NOT NULL DEFAULT 'FREI',
  anzahl_spiele         INT NOT NULL DEFAULT 0,
  anzahl_siege          INT NOT NULL DEFAULT 0,
  gesamt_punkte         INT NOT NULL DEFAULT 0,
  fuchs_gefangen        INT NOT NULL DEFAULT 0,
  fuchs_verloren        INT NOT NULL DEFAULT 0,
  karlchen_gespielt     INT NOT NULL DEFAULT 0,
  doppelkoepfe          INT NOT NULL DEFAULT 0,
  re_siege              INT NOT NULL DEFAULT 0,
  re_niederlagen        INT NOT NULL DEFAULT 0,
  kontra_siege          INT NOT NULL DEFAULT 0,
  kontra_niederlagen    INT NOT NULL DEFAULT 0,
  schweinchen_gespielt  INT NOT NULL DEFAULT 0,
  hochzeiten_gespielt   INT NOT NULL DEFAULT 0,
  armuten_angesagt      INT NOT NULL DEFAULT 0,
  armuten_uebernommen   INT NOT NULL DEFAULT 0,
  solos_siege           INT NOT NULL DEFAULT 0,
  solos_niederlagen     INT NOT NULL DEFAULT 0,
  solos_pro_typ         JSONB NOT NULL DEFAULT '{}',
  gesamt_augen          INT NOT NULL DEFAULT 0,
  rating_mu             NUMERIC(8,4) NOT NULL DEFAULT 25.0,
  rating_sigma          NUMERIC(8,4) NOT NULL DEFAULT 8.3333,
  zuletzt_aktualisiert  TIMESTAMP WITH TIME ZONE,
  erstellt_am           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  aktualisiert_am       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(spieler_id, regelvariante)
)
```

### `partie_ergebnis_view` (SQL-VIEW, ersetzt `partie_ergebnis_eintrag`)

```sql
CREATE VIEW partie_ergebnis_view AS
SELECT
  pt.spieler_id,
  p.id               AS partie_id,
  t.name             AS tisch_name,
  p.beendet_am       AS datum,
  p.regelvariante,
  (SELECT SUM(CASE pt2.spieler_position
              WHEN 'SUED' THEN p.punkte_sued
              WHEN 'WEST' THEN p.punkte_west
              WHEN 'NORD' THEN p.punkte_nord
              WHEN 'OST'  THEN p.punkte_ost END)
   FROM partie_teilnehmer pt2
   WHERE pt2.partie_id = p.id AND pt2.spieler_id = pt.spieler_id
   LIMIT 1)          AS endpunktestand,
  RANK() OVER (
    PARTITION BY p.id
    ORDER BY (CASE pt.spieler_position
              WHEN 'SUED' THEN p.punkte_sued
              WHEN 'WEST' THEN p.punkte_west
              WHEN 'NORD' THEN p.punkte_nord
              WHEN 'OST'  THEN p.punkte_ost END) DESC
  )                  AS rangplatz,
  p.aktuelles_spiel_nummer AS spielanzahl
FROM partie p
JOIN partie_teilnehmer pt ON pt.partie_id = p.id
LEFT JOIN tisch t ON t.partie_id = p.id
WHERE p.status = 'BEENDET';
```

### `event_publication` (Spring Modulith Outbox — aktualisiert)

```sql
event_publication (
  id               UUID PRIMARY KEY,
  listener_id      VARCHAR(512) NOT NULL,
  event_type       VARCHAR(512) NOT NULL,
  serialized_event TEXT NOT NULL,
  publication_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completion_date  TIMESTAMP WITH TIME ZONE,
  status           VARCHAR(20),
  completion_attempts INT,
  last_resubmission_date TIMESTAMP WITH TIME ZONE
)
```

---

## Regelvariante-Klassifikation

Die `regelvariante`-Spalte in `partie` und `spieler_statistik` wird aus den `Spielregeln`-Presets abgeleitet:

| `Spielregeln`-Factory | `Regelvariante` |
|-----------------------|-----------------|
| `dkvRegeln()`         | `TURNIER`       |
| `locoBlatRegeln()`    | `SONDER`        |
| `standardRegeln()`    | `SONDER`        |
| `ohneNeunenRegeln()`  | `SONDER`        |
| Custom (modifiziert)  | `FREI`          |

---

## Liquibase-Strategie

- **Einziges Changeset**: `src/main/resources/db/changelog/000-initial-schema.sql`
- **Master-Changelog**: `db.changelog-master.yaml` (YAML-Format, inkludiert nur `000-initial-schema.sql`)
- **Archiv**: Alle 22 alten YAML-Changesets in `db/changelog/archiv/` (historische Referenz, nicht aktiv)
- **Neue Changesets**: Nummeriert ab `001-*.sql` für spätere Schema-Erweiterungen

---

## Definition of Done

- [x] Spring Data JDBC (kein JPA) in `pom.xml`
- [x] `event_publication`-Tabelle via Liquibase angelegt
- [x] Repositories für alle Aggregate Roots vorhanden
- [x] `000-initial-schema.sql` mit vollständigem Hybrid-Schema
- [x] JSONB Custom Converter für alle JSONB-Felder (`JsonbConverter.java`)
- [x] `spielergebnis_archiv` + `sonderpunkt_eintrag` als eigenes Aggregate
- [x] `spieler_statistik` mit Composite-Key (spieler_id, regelvariante)
- [x] VIEW `partie_ergebnis_view`

---

## Schema-Review (SPEC-SQL-REVIEW, 2026-06-02)

> Greenfield-Fenster: Vor dem ersten echten Deploy ist Schema-Änderung kostenlos.
> Kanonische Quelle: `src/main/resources/db/changelog/000-initial-schema.sql`.
> Diese Sektion dokumentiert Soll-Stand, Abweichungen zur alten Spec-Beschreibung und offene Punkte.

### Positiv-Befunde (bereits korrekt)

- **TIMESTAMP WITH TIME ZONE** — alle Timestamp-Spalten nutzen korrekt `TIMESTAMP WITH TIME ZONE` (war in der Spec-Tabellen-Beschreibung fälschlich als `TIMESTAMP` dokumentiert)
- **UUID Primary Keys** — durchgängig UUID, keine Serial-Integers
- **ON DELETE CASCADE** — korrekt bei `laufendes_spiel`, `spielergebnis_archiv`, `sonderpunkt_eintrag`, `partie_teilnehmer`
- **JSONB statt flachem JSON** — alle State-Felder als `JSONB`, korrekte Default-Werte (`'{}'`, `'[]'`, strukturierte Defaults)
- **Optimistic Locking** — `partie.version BIGINT NOT NULL DEFAULT 0` für `@Version`
- **`partie_ergebnis_view`** — materialisiert Rang + Punkte live aus relativen Tabellen (kein Schreibaufwand mehr)
- **`event_publication`** — Spring Modulith Outbox-Tabelle vollständig (inkl. `status`, `completion_attempts`, `last_resubmission_date`)

### Abweichungen: Spec vs. tatsächliches SQL

| Thema | Spec (alt, falsch) | SQL (Wahrheit) |
|---|---|---|
| `spieler.benutzername` | `UNIQUE NOT NULL` | nullable (kein UNIQUE-Constraint) |
| `spieler.ist_ki` | Spaltenname | tatsächlich `ki` |
| `laufendes_spiel.phase` | `VARCHAR(30) NOT NULL` | `JSONB NOT NULL DEFAULT '{"typ":"VORBEHALT_ANSAGE"}'` |
| `laufendes_spiel.trumpf_ordnung_typ` | `VARCHAR(30) NOT NULL` | `JSONB NOT NULL DEFAULT '{"typ":"NORMAL"}'` |
| `laufendes_spiel.schweinchen_aktiv` | als Spalte beschrieben | nicht vorhanden (ist in `spielregeln` JSONB) |
| `laufendes_spiel.pflicht_ansage_ausstehend` | als Spalte beschrieben | nicht vorhanden |
| Master-Changelog | `db.changelog-master.sql` | `db.changelog-master.yaml` |

### Erledigte Punkte — REFACTOR-DB-Tasks (erledigt)

#### [x] REFACTOR-DB-1: FK-Spalten ohne Index (Abfrageperformance)

Folgende Fremdschlüssel-Spalten haben keinen Index. Bei wachsender Datenmenge entstehen Sequential-Scans:

| Tabelle | Spalte | Risiko |
|---|---|---|
| `tisch` | `partie_id` | Niedrig (max. 1 aktive Partie pro Tisch) |
| `partie_teilnehmer` | `spieler_id` | Mittel (Abfrage Spielerhistorie) |
| `spieler_statistik` | `spieler_id` | Mittel (Profilabfrage) |
| `spielergebnis_archiv` | `partie_id` | Mittel (Partiehistorie) |
| `sonderpunkt_eintrag` | `spielergebnis_archiv_id` | Niedrig (selten abgefragt) |

**Empfehlung:** Indexes vor Go-Live als `001-fk-indexes.sql` hinzufügen.

#### REFACTOR-DB-2: Nullable-Spalten in `spielergebnis_archiv` (Datenintegrität)

Spalten wie `re_augen`, `kontra_augen`, `sieger_partei`, `spielwert`, `grundwert` sind nullable, werden aber immer gesetzt wenn ein Spiel abgeschlossen ist. `NOT NULL`-Constraints würden Datenlücken verhindern.

**Empfehlung:** Constraints prüfen und per Changeset `002-archiv-not-null.sql` hinzufügen.

#### REFACTOR-DB-3: `spieler_statistik.solos_pro_typ` nullable

`solos_pro_typ JSONB` ist nullable, sollte `JSONB NOT NULL DEFAULT '{}'` sein (konsistent mit anderen Statistik-Feldern).

#### REFACTOR-DB-4: JSONB GIN-Indexes (optional, bei Abfragebedarf)

Wenn JSONB-Felder direkt abgefragt werden (z.B. `haende @> '{"NORD": ...}'`), sind GIN-Indexes sinnvoll. Aktuell kein bekannter Abfragepfad — zurückstellen bis konkrete Abfragen entstehen.

### Audit-Konzept (Ist-Stand)

Audit-Spalten sind vorhanden aber inkonsistent:

| Tabelle | `erstellt_am` | `aktualisiert_am` | Bemerkung |
|---|---|---|---|
| `spieler` | ✅ `TIMESTAMPTZ` nullable | ✅ `TIMESTAMPTZ` nullable | sollten NOT NULL sein |
| `partie` | ✅ `TIMESTAMPTZ` nullable | ✅ `TIMESTAMPTZ` nullable | sollten NOT NULL sein |
| `tisch` | ✅ `TIMESTAMPTZ` nullable | ✅ `TIMESTAMPTZ` nullable | sollten NOT NULL sein |
| `laufendes_spiel` | ✅ `TIMESTAMPTZ` nullable | ✅ `TIMESTAMPTZ` nullable | via App gesetzt |
| `spieler_statistik` | ✅ `TIMESTAMPTZ` nullable | ✅ + `zuletzt_aktualisiert` | leicht redundant |
| `spielergebnis_archiv` | `abgeschlossen_am TIMESTAMPTZ` nullable | — | ausreichend |
| `partie_teilnehmer` | `beigetreten_am TIMESTAMPTZ` nullable | — | fachliche Spalte |
| `sonderpunkt_eintrag` | — | — | keine nötig |
| `event_publication` | `publication_date TIMESTAMPTZ NOT NULL` | `completion_date TIMESTAMPTZ` | Spring Modulith managed |

**Befund:** `erstellt_am` ist auf allen Haupttabellen vorhanden und als `TIMESTAMP WITH TIME ZONE` korrekt. Nullable-Status ist leicht problematisch — in der App werden Werte gesetzt, aber die DB erzwingt es nicht.

---

## Gegencheck Opus (2026-06-02)

> Zweiter, unabhängiger Review gegen die **kanonische Quelle** `000-initial-schema.sql` *und*
> den Code (nicht nur gegen diese Spec, die nachweislich gedriftet war). Ralphs erste Befundliste
> war korrekt umgesetzt, aber unvollständig. Alle Punkte noch im Greenfield-Fenster.

### Erledigte Punkte — REFACTOR-DB-5…10 (erledigt)

#### [x] REFACTOR-DB-5: `benutzername` ohne UNIQUE — Korrektheit/Sicherheit (P-hoch)

`spieler.benutzername` hat **keinen** UNIQUE-Constraint. Die Registrierung
(`AuthentifizierungsController:72`) prüft Duplikate nur per `findByBenutzername(...).isPresent()`
→ **Race Condition**: zwei gleichzeitige Registrierungen mit gleichem Namen passieren beide
den Check und legen beide an. Danach ist `findByBenutzername` (erwartet `Optional`) mehrdeutig
→ Login-Bruch. **Fix:** partieller UNIQUE-Index `WHERE benutzername IS NOT NULL` (OAuth2-Spieler
haben NULL). `email` analog prüfen (für späteren Passwort-Reset). **Risiko:** niedrig im
Greenfield, hoch wenn übersehen.

#### [x] REFACTOR-DB-6: Audit-Spalten NOT NULL + DB-DEFAULT

`erstellt_am`/`aktualisiert_am` sind auf `spieler`, `partie`, `tisch`, `laufendes_spiel`,
`spieler_statistik` durchweg **nullable** (Audit-Tabelle oben sagt selbst „sollten NOT NULL sein").
**Fix:** `NOT NULL DEFAULT NOW()` — die DB erzwingt und befüllt, unabhängig von der App.

#### REFACTOR-DB-7: Audit-of-who (`erstellt_von`) + ON-DELETE-Politik

Nur `tisch.erstellt_von_spieler_id` hält den Akteur. **Fix:** `erstellt_von_spieler_id UUID`
auf `partie` ergänzen (der Spieler, der die Partie am Tisch startete). **Konvention:** nullable,
NULL = System/KI-Auslöser (kein Party-Pattern — bewusst pragmatisch-minimal). **ON DELETE für
alle Creator-FKs** auf `SET NULL` (Audit-Spur bleibt anonymisiert beim DSGVO-Löschen), nicht CASCADE.

#### REFACTOR-DB-8: NOT-NULL-Abdeckung vervollständigen

REFACTOR-DB-2 deckte nur 5 Archiv-Spalten. Weiterhin nullable, aber bei Spielabschluss **immer gesetzt**:
- `spielergebnis_archiv`: `geber_position`, `spieltyp`, `absage_punkte`, `gegen_die_alten_punkte`,
  `solo_multiplikator`, `spielpunkte_{sued,west,nord,ost}`, `abgeschlossen_am`
- `sonderpunkt_eintrag`: `partei`, `sonderpunkt_typ`
- `partie`: `regelvariante`, `spielregeln`
- `tisch`: `zugangsmodus` (→ `NOT NULL DEFAULT 'OFFEN'`)

#### REFACTOR-DB-9: `event_publication` ohne PRIMARY KEY

`event_publication.id UUID NOT NULL` hat **keinen PK** (nur ein Index auf `listener_id, serialized_event`).
Spring Moduliths Default-Schema definiert PK auf `id`. **Fix:** `PRIMARY KEY (id)` ergänzen.

#### REFACTOR-DB-10: ON-DELETE-Politik für DSGVO-Löschrecht

Keine Lösch-Logik im `spieler`-Paket vorhanden — das Löschrecht aus `recht-impressum-datenschutz.md`
ist ungebaut. **Jetzt** die FK-Politik festlegen, bevor gebaut wird: `partie_teilnehmer.spieler_id`,
`spieler_statistik.spieler_id`, `tisch_spieler.spieler_id`, `tisch.erstellt_von_spieler_id`,
`spieler_rating.spieler_id` (neu) — pro FK entscheiden SET NULL (Historie anonym erhalten) vs.
CASCADE (mitlöschen) vs. RESTRICT (aktiver Spieler nicht löschbar). Empfehlung: Statistik/Rating CASCADE,
Archiv/Teilnahme SET NULL (Spielhistorie der Mitspieler bleibt korrekt).

### Changelog-Konsolidierung — ✓ entschieden: konsolidieren (echtes Greenfield)

Alle Fixes (`002`–`004` + Gegencheck DB-5…10) werden **direkt in `000-initial-schema.sql`
eingepflegt**, additive Changesets `002`–`004` entfallen. Der erste reale Deploy bekommt *ein*
klares Initial-Schema. `001-spring-session-schema.sql` bleibt eigenständig (Fremd-Schema).
H2-Tests unkritisch (Neuaufbau je Lauf); persistente Dev-DB ggf. `clearCheckSums`.

### Ranking/Saison — Greenfield-Reservierung (siehe `statistik-ranking.md`)

Aus dem Plattform-Benchmark: `spieler_rating` (μ/σ), `saison`, `spielergebnis_archiv.saison_id`
**jetzt** als Schema reservieren (Build der Wertungslogik = M2). Details in `statistik-ranking.md`.
