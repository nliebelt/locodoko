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

### `tisch` (existierend, unverändert)

```sql
tisch (
  id               UUID PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  status           VARCHAR(20) NOT NULL,           -- WARTEND | IM_SPIEL | BEENDET
  zugangsmodus     VARCHAR(10) NOT NULL DEFAULT 'OFFEN',  -- OFFEN | PRIVAT
  einladungs_code  VARCHAR(8) UNIQUE,
  erstellt_von_spieler_id UUID NOT NULL,
  erstellt_am      TIMESTAMP NOT NULL DEFAULT NOW()
)
```

### `spieler` (existierend, unverändert)

```sql
spieler (
  id              UUID PRIMARY KEY,
  benutzername    VARCHAR(50) UNIQUE NOT NULL,
  anzeige_name    VARCHAR(20) NOT NULL,
  avatar_farbe    VARCHAR(7) NOT NULL,             -- Hex-Farbe z.B. #e63946
  ist_ki          BOOLEAN NOT NULL DEFAULT FALSE,
  erstellt_am     TIMESTAMP NOT NULL DEFAULT NOW()
)
```

### `partie` (RELATIONAL — Stammdaten)

```sql
partie (
  id                        UUID PRIMARY KEY,
  version                   BIGINT NOT NULL DEFAULT 0,   -- @Version Optimistic Locking
  tisch_id                  UUID NOT NULL REFERENCES tisch(id),
  anzahl_spiele             INT NOT NULL,
  aktuelles_spiel_nummer    INT NOT NULL DEFAULT 0,
  status                    VARCHAR(20) NOT NULL,         -- LAUFEND | BEENDET
  punkte_sued               INT NOT NULL DEFAULT 0,
  punkte_west               INT NOT NULL DEFAULT 0,
  punkte_nord               INT NOT NULL DEFAULT 0,
  punkte_ost                INT NOT NULL DEFAULT 0,
  bockrunden_zaehler        INT NOT NULL DEFAULT 0,
  solist_des_letzten_spiels VARCHAR(10),                  -- SpielerPosition nullable
  regelvariante             VARCHAR(20) NOT NULL,         -- TURNIER | SONDER | FREI
  spielregeln               JSONB NOT NULL,               -- Hausregeln-Konfiguration
  erstellt_am               TIMESTAMP NOT NULL DEFAULT NOW(),
  beendet_am                TIMESTAMP
)
```

### `partie_teilnehmer` (RELATIONAL — M:N Spieler↔Partie)

```sql
partie_teilnehmer (
  id                UUID PRIMARY KEY,
  partie_id         UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
  spieler_id        UUID NOT NULL REFERENCES spieler(id),
  spieler_position  VARCHAR(10) NOT NULL,           -- NORD | OST | SUED | WEST
  beigetreten_am    TIMESTAMP NOT NULL DEFAULT NOW(),
  ausgeschieden_am  TIMESTAMP,                      -- nullable (Reconnect-Tracking)
  UNIQUE (partie_id, spieler_position)
)
```

### `laufendes_spiel` (HYBRID — relational + JSONB)

```sql
laufendes_spiel (
  id                    UUID PRIMARY KEY,
  partie_id             UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE UNIQUE,
  spiel_nummer          INT NOT NULL,
  geber_position        VARCHAR(10) NOT NULL,
  spieltyp              VARCHAR(30) NOT NULL,
  phase                 VARCHAR(30) NOT NULL,
  trumpf_ordnung_typ    VARCHAR(30) NOT NULL,
  schweinchen_aktiv     BOOLEAN NOT NULL DEFAULT FALSE,
  einwurf_zaehler       INT NOT NULL DEFAULT 0,
  -- JSONB-Felder (Custom Converter in JsonbConverters.java):
  haende                JSONB NOT NULL,              -- Map<SpielerPosition, Hand>
  aktueller_stich       JSONB,                       -- Stich nullable
  abgeschlossene_stiche JSONB NOT NULL DEFAULT '[]', -- List<Stich>
  vorbehalt_meldungen   JSONB NOT NULL DEFAULT '[]', -- List<VorbehaltMeldung>
  ansage_ereignisse     JSONB NOT NULL DEFAULT '[]', -- Ansagen (Wrapper)
  partei_zuordnungen    JSONB NOT NULL DEFAULT '{}', -- Parteien (Wrapper)
  bereits_geschmissen   JSONB NOT NULL DEFAULT '[]', -- Set<SpielerPosition>
  pflicht_ansage_ausstehend JSONB NOT NULL DEFAULT '[]', -- Set<Partei>
  armut_status          JSONB,                       -- ArmutStatus nullable
  hochzeit_status       JSONB                        -- HochzeitStatus nullable
)
```

**JSONB-Beispiele:**

```json
// haende
{"NORD": [{"farbe": "KREUZ", "wert": "DAME"}, ...],
 "OST":  [...], "SUED": [...], "WEST": [...]}

// aktueller_stich
{"aufspieler": "NORD",
 "karten": [{"spielerPosition": "NORD", "karte": {"farbe": "KREUZ", "wert": "DAME"}}]}

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
  aufspieler_position     VARCHAR(10) NOT NULL,    -- Vorhand (für Statistik)
  spieltyp                VARCHAR(30) NOT NULL,
  ist_solo                BOOLEAN NOT NULL,
  solo_typ                VARCHAR(30),             -- nullable, nur wenn ist_solo=true
  re_augen                INT NOT NULL,
  kontra_augen            INT NOT NULL,
  sieger_partei           VARCHAR(10) NOT NULL,    -- RE | KONTRA
  spielwert               INT NOT NULL,            -- berechneter Gesamtwert
  grundwert               INT NOT NULL,
  absage_punkte           INT NOT NULL DEFAULT 0,
  gegen_die_alten_punkte  INT NOT NULL DEFAULT 0,
  solo_multiplikator      INT NOT NULL DEFAULT 1,
  spielpunkte_sued        INT NOT NULL DEFAULT 0,
  spielpunkte_west        INT NOT NULL DEFAULT 0,
  spielpunkte_nord        INT NOT NULL DEFAULT 0,
  spielpunkte_ost         INT NOT NULL DEFAULT 0,
  abgeschlossen_am        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (partie_id, spiel_nummer)
)
```

### `sonderpunkt_eintrag` (RELATIONAL — FK-Child)

```sql
sonderpunkt_eintrag (
  id                       UUID PRIMARY KEY,
  spielergebnis_archiv_id  UUID NOT NULL REFERENCES spielergebnis_archiv(id) ON DELETE CASCADE,
  partei                   VARCHAR(10) NOT NULL,   -- RE | KONTRA
  sonderpunkt_typ          VARCHAR(30) NOT NULL,   -- FUCHS_GEFANGEN | KARLCHEN | DOPPELKOPF | ...
  taeter_position          VARCHAR(10),            -- nullable
  opfer_position           VARCHAR(10)             -- nullable
)
```

### `spieler_statistik` (RELATIONAL — Aggregat-Cache, pro Regelvariante)

```sql
spieler_statistik (
  id                    UUID PRIMARY KEY,
  spieler_id            UUID NOT NULL REFERENCES spieler(id),
  regelvariante         VARCHAR(20) NOT NULL,           -- TURNIER | SONDER | FREI
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
  solos_pro_typ         JSONB NOT NULL DEFAULT '{}',  -- {DAMEN_SOLO:{siege:3,niederl:1},...}
  zuletzt_aktualisiert  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (spieler_id, regelvariante)
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
JOIN tisch t ON t.id = p.tisch_id
WHERE p.status = 'BEENDET'
ORDER BY p.beendet_am DESC;
```

### `event_publication` (Spring Modulith Outbox — unverändert)

```sql
event_publication (
  id               UUID PRIMARY KEY,
  listener_id      VARCHAR(255) NOT NULL,
  event_type       VARCHAR(255) NOT NULL,
  serialized_event TEXT NOT NULL,
  publication_date TIMESTAMP NOT NULL,
  completion_date  TIMESTAMP
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
- **Master-Changelog**: `db.changelog-master.sql` (SQL-Format, inkludiert nur `000-initial-schema.sql`)
- **Archiv**: Alle 22 alten YAML-Changesets in `db/changelog/archiv/` (historische Referenz, nicht aktiv)
- **Neue Changesets**: Nummeriert ab `001-*.sql` für spätere Schema-Erweiterungen

---

## Definition of Done

- [x] Spring Data JDBC (kein JPA) in `pom.xml`
- [x] `event_publication`-Tabelle via Liquibase angelegt
- [x] Repositories für alle Aggregate Roots vorhanden
- [ ] `000-initial-schema.sql` mit vollständigem Hybrid-Schema (Task DB-2, Task 68)
- [ ] JSONB Custom Converter für alle ~10 JSONB-Felder (Task DB-3, Task 69)
- [ ] `spielergebnis_archiv` + `sonderpunkt_eintrag` als eigenes Aggregate (Task DB-5, Task 71)
- [ ] `spieler_statistik` mit Composite-Key (spieler_id, regelvariante) (Task DB-9, Task 75)
- [ ] VIEW `partie_ergebnis_view` (Task DB-10, Task 76)
