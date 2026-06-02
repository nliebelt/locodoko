# Statistik & Ranking — Benchmark + Soll-Modell

| Feld           | Wert                                                              |
|----------------|-------------------------------------------------------------------|
| Status         | Entschieden — Stufe 0+1 (TrueSkill), Saison/Liga aufgeschoben (2026-06-02) |
| Priorität      | Mittel (Stufe 0+1; Build M1/M2)                                   |
| Abhängigkeiten | datenbankmodell.md, spieler-profil.md, punkteberechnung.md        |

## Zweck

Festhalten, wie etablierte Online-Doppelkopf-Plattformen Statistik & Wertung umsetzen,
unseren Ist-Stand dagegen halten und das **Soll-Schema im Greenfield-Fenster reservieren**.
Nach dem ersten echten Deploy kostet jede Erweiterung eine Migration gegen Live-Daten —
deshalb wird hier zumindest die *Schema-Form* für Rating + Saison jetzt festgelegt, auch
wenn der Build der Wertungslogik erst später (M2) erfolgt.

---

## Benchmark — andere Plattformen (Recherche 2026-06-02)

| Plattform | Wertungsmodell | Zeit-Dimension | Besonderheiten |
|---|---|---|---|
| **Doppelkopf-Palast** | **TrueSkill** (bayessches Rating, Microsoft) | Liga-Saisons | Chips, Turniere, fremde Statistik nur mit Premium; Rating steigt stärker gegen starke Gegner |
| **FuchsTreff** | Monatswertung mit **Vielspielfaktor** `VSF = √(4·n/(n+600))` (K=600) | **Monats-Reset** | 3 Ligen mit Auf-/Abstieg; Detailstatistik erst ab ~200 Spielen aussagekräftig |
| **Online-Doppelkopf.com** | Punktewertung | **Ewige Liste + Mannschaftsliga + Monatslisten** | Team-/Mannschaftsliga zusätzlich zum Einzel-Ranking |

**Gemeinsame Muster:**
1. **Skill-Rating** statt nur Roh-Punkte (TrueSkill bzw. handgebauter Vielspielfaktor).
2. **Zeit-Dimension**: Saison/Monat *neben* einer ewigen Wertung — nicht nur Lebenszeit-Summen.
3. **Unsicherheits-/Vielspiel-Korrektur**: Wenig-Spieler werden nicht über- oder unterbewertet
   (TrueSkill via σ; FuchsTreff via VSF-Formel).
4. **Ligen/Auf-Abstieg** als Engagement-Mechanik (FuchsTreff, Palast) — Komfort, kein Muss.

---

## Ist-Stand (was wir schon haben)

`spieler_statistik` ist pro `(spieler_id, regelvariante)` und bereits ungewöhnlich reich:
Spiele/Siege, Gesamtpunkte, Re-/Kontra-Quoten, Solos pro Typ, Füchse, Karlchen,
Doppelköpfe, Hochzeiten, Armuten, Schweinchen. Punkt-Provenance liegt detailliert im
Wire-DTO `PartieStandAntwort`.

**Stärke:** fachliche Tiefe (Sonderpunkte/Solo-Typen) ist besser als bei vielen Plattformen.
**Schwäche:** alles **Lebenszeit-Summe**, **kein Skill-Rating**, **keine Zeit-Dimension**,
keine abgeleiteten Kennzahlen (Ø, Streaks), keine Partner-/Gegner-Sicht.

---

## Gap-Analyse

| Lücke | Plattform-Referenz | Bewertung |
|---|---|---|
| **Kein Skill-Rating** | Palast (TrueSkill), FuchsTreff (VSF) | **Größter Gap** — Schema jetzt reservieren |
| **Keine Saison/Periode** | alle drei | **Schema jetzt reservieren** (Saison-Dimension) |
| Ø Punkte/Spiel, Ø Augen | Standard | ableitbar — als View/Aggregat, kein neues Schema |
| Streaks (längste Serie) | verbreitet | klein, später |
| Partner-/Gegner-Statistik | Premium-Plattformen | nice-to-have, M2+ |
| Ligen/Auf-Abstieg | FuchsTreff, Palast | Feature M2+, baut auf Rating auf |

---

## Entschiedener Umfang (2026-06-02)

**Stufe 0 + 1 jetzt, Saison/Liga aufgeschoben.** Begründung: In einer Closed Beta mit Kollegen,
die sich kennen, ersetzt der soziale Kontext die Ranglisten-Leiter — Saison/Liga sind der
Retention-Haken kommerzieller Plattformen für *Fremde*. Aufschieben ist hier **billig und sicher**:

- Saison/Liga wäre eine rein **additive** Erweiterung (neue Tabellen + nullable Spalte) — auch
  gegen Live-Daten risikoarm, nicht die gefährliche Typänderungs-Sorte.
- **Sicherheitsnetz:** `spielergebnis_archiv` hält *jedes* Spiel (Positionen→Punkte via
  `partie_teilnehmer`, Sieger, Spielwert, Zeitstempel). Ein Saison-Rating ist daraus jederzeit
  **rückwirkend** berechenbar. Wir verlieren durch Warten keine Historie.

| Stufe | Umfang | Status |
|---|---|---|
| **0** | Abgeleitete Kennzahlen (Ø Punkte/Spiel, Siegquote, Ø Augen) im Profil | **jetzt** |
| **1** | TrueSkill-Rating + ewige Bestenliste (1 neue UI-Szene) | **jetzt** |
| 2 | Saisons (Reset, Saison-Listen, Rollover-Job) | aufgeschoben (additiv) |
| 3 | Ligen + Auf-/Abstieg | aufgeschoben (additiv) |

## Soll-Modell (Stufe 0 + 1)

### Rating — TrueSkill, an die bestehende Tabelle gehängt

Algorithmus **entschieden: TrueSkill** (4-Spieler mit wechselnden Parteien; ELO ist 1-gegen-1).
TrueSkill hält pro Spieler `μ` (Stärke) und `σ` (Unsicherheit); öffentliche Wertung konservativ
`μ − 3σ`. TrueSkill-Defaults: `μ=25`, `σ=25/3≈8.333`.

**Kein neues Tabellen-Konstrukt nötig:** `spieler_statistik` ist bereits pro
`(spieler_id, regelvariante)` und wird pro Spiel fortgeschrieben — genau die richtige Granularität.
Wir hängen nur zwei Spalten an (im Greenfield in `000-initial-schema.sql`):

```sql
ALTER TABLE spieler_statistik ADD COLUMN rating_mu    NUMERIC(8,4) NOT NULL DEFAULT 25.0;
ALTER TABLE spieler_statistik ADD COLUMN rating_sigma NUMERIC(8,4) NOT NULL DEFAULT 8.3333;
```

Das Rating-Update läuft im **selben Pfad**, der die Statistik pro Spiel aktualisiert. Falls je
auf ELO gewechselt würde: `rating_mu` bleibt die Zahl, `rating_sigma` ungenutzt — kein Schema-Bruch.

**Bestenliste:** Endpoint sortiert nach `rating_mu − 3·rating_sigma` (pro Regelvariante),
eine neue Frontend-Szene (`FE-LEADERBOARD`). Keine Saison-Dimension in Stufe 1 → „ewige" Liste.

### Abgeleitete Kennzahlen (Stufe 0, kein neues Schema)

Ø Punkte/Spiel, Siegquote, Ø Augen → als SQL-View oder berechnet im Profil-Endpoint
analog `partie_ergebnis_view`. Streaks → optional kleiner Zähler, später.

## Spieler-Statistik (DB) vs. Betriebsmetriken (Prometheus/Grafana)

**Architektonische Trennung — nicht vermischen:**

- **Per-Spieler-Daten** (Rating, Siege/Spieler, Profil-Kennzahlen) → **Postgres**, per API an
  Profil/Bestenliste. **Niemals nach Prometheus** — `spieler_id` als Label = Kardinalitätsexplosion,
  das klassische Prometheus-Antipattern.
- **Aggregierte, niedrig-kardinale Domain-Metriken** → **Prometheus/Grafana** (Micrometer).
  Beschreibt „wie wird die Plattform genutzt", nicht „wie spielt Spieler X".

**Dasselbe Domain-Event füttert beide:** Beim Event „Spiel abgeschlossen" wird die DB-Statistik
+ Rating fortgeschrieben *und* ein Micrometer-Counter inkrementiert. Ein Event, zwei Konsumenten.

**Loco-Domain-Metriken (gehören in `betrieb-monitoring.md` / `OPS-GRAFANA-MONITORING`):**

| Metrik | Micrometer-Typ | Label (niedrig-kardinal) |
|---|---|---|
| Spieltyp-Verteilung | Counter | `spieltyp` (Normal / Solo-Typen) |
| Re- vs. Kontra-Siege | Counter | `partei` |
| Sonderpunkte | Counter | `typ` (Fuchs/Karlchen/Doppelkopf) |
| Hochzeiten / Armuten angesagt | Counter | — |
| Augen pro Spiel | Histogram/Summary | — |
| Aktive Tische / laufende Partien | Gauge | — |
| Spiele pro Stunde | Counter (rate) | `regelvariante` |
| Bockrunden ausgelöst | Counter | — |

Kein PII, keine Per-Spieler-Kardinalität → unbedenklich und billig (Meter an bestehende Events hängen).

---

## Entscheidungen & offene Punkte

- **Rating-Algorithmus** — ✓ **TrueSkill** (2026-06-02).
- **Umfang** — ✓ **Stufe 0 + 1** jetzt, Saison/Liga aufgeschoben (additiv später).
- **Saison/Liga** — aufgeschoben; Reaktivierung falls öffentlich/wachsend. Archiv erlaubt rückwirkende Berechnung.
- **Sichtbarkeit fremder Bestenliste/Statistik** — offen (Datenschutz/UX); bei Palast Premium-gated, für Beta vermutlich offen.

---

## Definition of Done

- [x] Benchmark der relevanten Plattformen dokumentiert
- [x] Gap-Analyse gegen `spieler_statistik` erstellt
- [x] Umfang + Algorithmus entschieden (Stufe 0+1, TrueSkill)
- [ ] **STAT-DERIVED** (Stufe 0): abgeleitete Kennzahlen im Profil
- [ ] **STAT-RATING** (Stufe 1): `rating_mu`/`rating_sigma` in `000`; TrueSkill-Update im Pro-Spiel-Statistikpfad
- [ ] **FE-LEADERBOARD** (Stufe 1): Bestenlisten-Szene + Endpoint (`μ−3σ`)
- [ ] Loco-Domain-Metriken in `betrieb-monitoring.md` (Teil von `OPS-GRAFANA-MONITORING`)

## Quellen

- Doppelkopf-Palast — https://www.doppelkopf-palast.de/ ; Liga-System: https://www.spiele-palast.de/info-seite-liga/
- FuchsTreff Liga/VSF — https://www.fuchstreff.de/ ; https://www.fuchstreff.de/forum/diskussionen/1610-monatswertung-und-vielspielfaktor/kommentare
- Online-Doppelkopf.com — https://www.online-doppelkopf.com/liga ; https://www.online-doppelkopf.com/liga/ewige-bestenliste
