# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-29 (Plan-Überarbeitung nach Gesamt-Review). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**Session 26 (2026-05-29):** Vollständiger Code- & Spec-Review durchgeführt (Bericht: `specs/review-2026-05-28.md`). Ergebnis: Modulgrenzen sauber, Spielkern regelkonform (`PunkteRechner`, `Stich` geprüft), keine offenen Korrektheits-Bugs. Backend `mvn test` grün, Frontend 221 grün. Der abgeschlossene REFACTOR-DOMAIN-Block (P1–P4, Session 17–25) wurde ins Archiv verschoben. Aus dem Review entstanden 6 neue Tasks (Doku-Hygiene + Code-Qualität + 2 mittlere Refactorings), siehe unten.

**Nächster Schritt:** Build-Reihenfolge strikt von oben nach unten abarbeiten — erst die risikoarmen DOC/SPEC-Tasks, dann `REFACTOR-SAGEAN`, zuletzt die zwei mittleren Refactorings (`REFACTOR-JSONB-CONVERTER`, `REFACTOR-TISCHVERWALTUNG`).

**Offene Fragen für User:** Keine — Build-Modus kann starten. SMOKE-UI-1 bleibt user-getrieben.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

## Empfohlene Build-Reihenfolge (verbindlich)

1. DOC-PUNKTE-HINWEISE
2. SPEC-ARCH-HIERARCHIE
3. DOC-AGENTS-DEDUP
4. REFACTOR-SAGEAN
5. REFACTOR-JSONB-CONVERTER
6. REFACTOR-TISCHVERWALTUNG

---

## Offene Aufgaben

### Priorität 1 — Doku-Hygiene (klein, risikoarm)

- [x] **DOC-PUNKTE-HINWEISE** — `specs/punkteberechnung.md` „Technische Hinweise" an den Code angleichen.

  Die Spec nennt unverbindlich `PunkteRechner.berechneErgebnis(Spiel) → SpielErgebnis`. Real: `PunkteRechner.berechneNormalspielErgebnis(stiche, parteien, trumpfOrdnung, ansagen, spielregeln) → Spielergebnis` (reine Funktion, kein `Spiel`-Parameter). Die normativen Anforderungen 1–20 sind korrekt umgesetzt — nur die Hinweise driften.

  **Erste Datei zuerst:** `specs/punkteberechnung.md`, Abschnitt „Technische Hinweise" (Z. ~89–96): Methodensignatur + Rückgabetyp korrigieren, Klassennamen `SpielErgebnis` → `Spielergebnis`.

  **DoD:** `grep -rn "berechneErgebnis\|SpielErgebnis\b" specs/punkteberechnung.md` liefert nichts Veraltetes mehr; Hinweise stimmen mit `PunkteRechner.java` überein. Kein Code-Change → keine Tests, nur `grep`-Konsistenzcheck.

- [x] **SPEC-ARCH-HIERARCHIE** — Eindeutige Hierarchie der Architektur-Specs herstellen.

  Es existieren sechs `architektur*.md`; vier tragen Status „Aktive Vorgabe / Kritisch". `architektur-unified.md` („Unified Architecture") überlappt inhaltlich stark mit `architektur.md` (Snapshot+Hint, DB-as-Source-of-Truth, `@Version`) — der Name suggeriert fälschlich, *es* sei kanonisch, während `architektur.md` der „Kompass" ist.

  **Erste Datei zuerst:** `specs/architektur.md` — Status-Feld auf „Aktive Vorgabe — Single Source of Truth" präzisieren; im Detail-Specs-Block klar benennen, welche Dokumente reine Detail-Specs sind. Dann in `architektur-unified.md`, `architektur-domain-events.md`, `architektur-spielkern.md` die Status-Zeile auf „Detail-Spec (konsolidiert in architektur.md)" setzen (analog zu `architektur-ddd.md`); in `architektur-unified.md` die mit `architektur.md` redundanten Passagen auf Verweise kürzen.

  **DoD:** Genau ein Architektur-Dokument trägt Status „Single Source"; alle übrigen „Detail-Spec". `specs/README.md` bleibt konsistent (`grep -n "architektur" specs/README.md` prüfen). Kein Code-Change.

- [x] **DOC-AGENTS-DEDUP** — Doppelpflege von `CLAUDE.md`/`AGENTS.md` beenden.

  `CLAUDE.md` und `AGENTS.md` sind byte-identisch (`diff` leer) und werden bei jedem Build-Commit beide getrackt → Drift-Quelle. `GEMINI.md` weicht inhaltlich ab und bleibt eigenständig.

  **Erste Datei zuerst:** `AGENTS.md` durch einen Git-Symlink auf `CLAUDE.md` ersetzen (`ln -sf CLAUDE.md AGENTS.md`), sodass nur noch eine Quelle gepflegt wird. Prüfen, dass alle Verweise (`PROMPT_build.md` referenziert `AGENTS.md`) weiterhin auflösen.

  **DoD:** `readlink AGENTS.md` → `CLAUDE.md`; `diff CLAUDE.md AGENTS.md` leer; `git status` zeigt AGENTS.md als geänderten Symlink. Kein Test, nur Konsistenzcheck.

### Priorität 2 — Code-Qualität

- [ ] **REFACTOR-SAGEAN** — Einrückung + Extraktion in `Spiel.sageAn`.

  Im `try`-Block von `Spiel.sageAn` (≈ Z. 414–433) ist `Ansagen neueAnsagen = …` eingerückt, die folgenden Anweisungen springen auf Methoden-Ebene zurück — funktional korrekt, aber irreführend. Der Pflichtansage-Abzug (Z. ~418–425) gehört in eine eigene private Methode.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/partie/Spiel.java`, Methode `sageAn` — Block konsistent einrücken, Pflichtansage-Logik in private Methode (z.B. `entferneErfuellteGrundansagePflicht(Set<Partei>, SpielerPosition)`) auslagern.

  **DoD:** Einrückung korrekt, neue private Hilfsmethode, Verhalten unverändert; `cd /home/agent/workspace && mvn test` grün.

### Priorität 3 — Refactorings (mittel, je eigene Iteration)

- [ ] **REFACTOR-JSONB-CONVERTER** — Boilerplate in `JsonbConverter.java` (1131 Z.) reduzieren.

  Pro Domänentyp existieren ~3 nahezu identische Converter-Klassen (`…SchreibConverter` / `…LeseConverter`(PGobject) / `…StringLeseConverter`(String)) über ~12 Typen ⇒ ~36 Klassen mit gleichem Rumpf (`toJsonString` / `fromPGobject` / `fromString`).

  **Erste Datei zuerst:** `src/main/java/de/locodoko/tisch/persistenz/JsonbConverter.java` — generische Basisklassen einführen (`JsonbSchreibConverter<T>`, `JsonbPGobjectLeseConverter<T>`, `JsonbStringLeseConverter<T>` mit `ObjectMapper` + `JavaType`/`TypeReference<T>`). Zuerst EINEN Typ (z.B. `Stich`) umstellen, Roundtrip-Test grün, dann sukzessive die übrigen; Registrierung über eine Typliste statt Einzelklassen.

  **DoD:** Datei deutlich < 1131 Z., keine Verhaltensänderung. `PartieStandAntwortWireFormatTest` + alle JSONB-Roundtrip-Tests + `mvn test` grün. **Risiko:** mittel — pro Typ ein Schritt, Tests zwischen jedem Schritt.

- [ ] **REFACTOR-TISCHVERWALTUNG** — `TischVerwaltungsService` (542 Z., 14 public-Methoden) aufteilen.

  Der Service mischt Tisch-Lebenszyklus, Konfiguration und Beitritt/Schnellstart/Einladung. Architektur-Prinzip 9 (≤ ~300 Z.) verletzt.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/tisch/TischVerwaltungsService.java` — Verantwortlichkeiten gruppieren, die kleinste kohärente Einheit zuerst extrahieren (Konfiguration: `ladeKonfiguration`, `aktualisiereKonfiguration`, `gibPresets` → `TischKonfigurationsService`). Aufrufer in `TischController`/`PartieController` umstellen. Pro Extraktion ein Commit + `mvn test`.

  **DoD:** Jede resultierende Klasse ≤ ~300 Z.; alle Aufrufer angepasst; `cd /home/agent/workspace && mvn test` grün. **Risiko:** mittel.

### Offen — user-getrieben

- [ ] **SMOKE-UI-1** — User-getriebener manueller Smoke-Test:
  - `mvn spring-boot:run` starten.
  - Browser öffnen, Schnellstart, eine Partie gegen 3 KI-Spieler spielen.
  - Profil-Modal öffnen, drei Tabs durchklicken.
  - Ungültige Karte spielen — Toast erwartet.
  - Befunde als BUG-…-Tasks im Plan aufnehmen.

---

## Entdeckungen (Gesamt-Review Session 26, 2026-05-29)

Siehe vollständigen Bericht `specs/review-2026-05-28.md`. Bestätigte, **nicht** als akute Tasks geführte Befunde:

### Klassengrößen über Richtwert (~300 Z.) — beobachten, kein akuter Rückstand

| Klasse | Zeilen | Hinweis |
|---|---|---|
| `JsonbConverter.java` | 1131 | → REFACTOR-JSONB-CONVERTER |
| `TischVerwaltungsService.java` | 542 | → REFACTOR-TISCHVERWALTUNG |
| `PartieStandAntwort.java` | 529 | durch >10 nested Wire-Format-DTOs begründet — kein Rückstand |
| `Spiel.java` | 526 | Domain-Komplexität, REFACTOR-DOMAIN erledigt |
| `StandardKiStrategie.java` | 504 | bei Bedarf |
| `Partie.java` | 452 | bei Bedarf |

### Keine Befunde (geprüft, konsistent)
- Modulgrenzen: keine verbotenen Imports zwischen `karten`/`partie`/`ki`/`spieler`/`tisch`.
- Spielkern: `PunkteRechner` (Re≥121/Kontra≥120, Ansagen ×2/×4, Absagen, Gegen-die-Alten, Solo ×3, Nullsumme), `Stich` (Trumpf-/Fehl-/Dullen-Logik) regelkonform.
- Point Provenance: korrekt im Wire-DTO `PartieStandAntwort` (`PunkteKomponenteAntwort[]`).
- Keine TODO/FIXME/`System.out`/`printStackTrace` im Produktivcode.

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
