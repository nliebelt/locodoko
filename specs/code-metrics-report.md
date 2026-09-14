# Code-Metriken-Report — Locodoko

> Erstellt: 2026-09-14 (Session 157). Tools: JaCoCo 0.8.14, knip 6.35.1, madge 8.0.0, depcheck 1.4.7.
> Basis: `mvn clean verify` + `npm run knip/madge/depcheck` auf Branch `main`.

---

## 1. Backend — JaCoCo Testabdeckung

### Gesamtdeckung

| Metrik        | Gedeckt  | Nicht gedeckt | Gesamtdeckung | Handlungsbedarf |
|---------------|----------|---------------|---------------|-----------------|
| Instructions  | 23.648   | 3.640         | **86 %**      | Grün (> 60 %)   |
| Branches      | 1.528    | 508           | **75 %**      | Grün (> 60 %)   |
| Lines         | 2.536    | 649           | **80 %**      | Grün            |
| Methods       | 1.483    | 215           | **87 %**      | Grün            |
| Classes       | 339      | 34            | **91 %**      | Grün            |

### Paketdetails (Instructions % / Branches %)

| Paket                          | Instructions | Branches | Auffälligkeit                    |
|--------------------------------|-------------|----------|----------------------------------|
| de.locodoko.ki.orchestrierung  | 100 %       | 95 %     | Referenz — vollständig gedeckt   |
| de.locodoko.karten             | 94 %        | 80 %     | Gut                              |
| de.locodoko.ki                 | 93 %        | 77 %     | Gut                              |
| de.locodoko.betrieb            | 89 %        | 81 %     | Gut                              |
| de.locodoko.tisch.persistenz   | 89 %        | 75 %     | Gut                              |
| de.locodoko.partie             | 89 %        | 84 %     | Gut                              |
| de.locodoko.tisch              | 86 %        | 65 %     | Akzeptabel                       |
| de.locodoko                    | 82 %        | n/a      | Root-Paket, wenig Code           |
| de.locodoko.partie.ereignisse  | 76 %        | n/a      | Nur Daten-Klassen, okay          |
| de.locodoko.spieler            | 78 %        | 64 %     | Akzeptabel                       |
| de.locodoko.system             | 63 %        | 33 %     | Niedrige Branch-Coverage — Radar |

**Hinweis `de.locodoko.system`:** Branch-Coverage 33 % ist der niedrigste Wert im Projekt.
Das Paket ist klein (10 Klassen); es handelt sich um System-/Health-Infrastruktur,
die in Integrationstests schwer vollständig abzudecken ist. Kein Blocker, aber im Radar.

---

## 2. Frontend — knip (Dead Code)

| Befund                 | Anzahl | Beispiele                                               | Handlungsbedarf              |
|------------------------|-------:|--------------------------------------------------------|------------------------------|
| Ungenutzte Dateien     | 1      | `eslint-complexity.config.mjs`                         | Aufräumen oder löschen       |
| Ungenutzte Exports     | 57     | `designTokens.ts` (36), `AssetLoader.ts` (5), `SpielverwaltungDto.ts` (7) | Cleanup-Kandidaten |
| Ungenutzte Typen       | 50     | `schema-types.ts` (18), `api-types.ts` (5), `SpielverwaltungDto.ts` (13) | Cleanup-Kandidaten |

**Bewertung:** Die meisten ungenutzten Exports stammen aus `designTokens.ts` (Design-Token-Konstanten,
die für künftige UI-Erweiterungen vorgehalten werden) und aus generierten Typen (`schema-types.ts`,
`api-types.ts`). Kein funktionaler Defekt — rein kosmetischer Dead Code.
`eslint-complexity.config.mjs` ist eine aktiv ausgelagerte ESLint-Konfiguration;
prüfen ob sie über `extends` eingebunden ist oder entfernt werden kann.

Exit-Code: **1** (Befunde vorhanden, kein Abbruch des Builds).

---

## 3. Frontend — madge (Zirkuläre Abhängigkeiten)

| Befund               | Wert       | Handlungsbedarf |
|----------------------|-----------|-----------------|
| Zirkuläre Abhängigkeiten | **0** | Keiner          |

Exit-Code: **0** — keine Zyklen gefunden. Architektur bleibt azyklisch.

---

## 4. Frontend — depcheck (Ungenutzten Package-Dependencies)

| Befund                          | Wert | Handlungsbedarf |
|---------------------------------|------|-----------------|
| Ungenutzte Dependencies         | **0** | Keiner         |
| Fehlende Dependencies           | **0** | Keiner         |

Exit-Code: **0** — `package.json` ist aufgeräumt.

---

## 5. Zusammenfassung & kritische Befunde

| Metrik                  | Wert                     | Schwellenwert | Kritisch? |
|-------------------------|--------------------------|---------------|-----------|
| BE Instructions-Coverage | 86 %                    | < 60 %        | Nein      |
| BE Branch-Coverage       | 75 %                    | < 60 %        | Nein      |
| FE Zirkuläre Abhängigkeiten | 0                    | > 0           | Nein      |
| FE Ungenutzte Deps (depcheck) | 0                  | > 0           | Nein      |
| FE Dead Code (knip)      | 108 Exports/Typen + 1 Datei | —         | Nein (kosmetisch) |

**Keine kritischen Befunde.** Alle Schwellenwerte (Coverage ≥ 60 %, keine zirkulären Deps,
keine ungenutzten Package-Dependencies) sind eingehalten. Keine neuen Blocker-Tasks.

**Offene Radar-Punkte (kein Handlungszwang):**
- `de.locodoko.system`: Branch-Coverage 33 % — klein, Infrastruktur-Paket.
- `eslint-complexity.config.mjs`: Prüfen ob aktiv genutzt oder löschbar.
- `designTokens.ts`: 36 ungenutzte Exports — bewusst vorgehaltene Design-Tokens oder tote Konstanten?
