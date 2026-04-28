# Spieler-Profil und Statistiken

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Abgeschlossen                                               |
| Priorität      | Mittel — nach Authentifizierung                             |
| Abhängigkeiten | authentifizierung.md, datenbankmodell.md                    |

## Beschreibung

Eingeloggte Spieler haben ein persistentes Profil mit Anzeigename, Avatar und Statistiken.
Kein Upload, kein CMS — alles serverside einfach und wartbar.

## Anforderungen

### Profil-Felder

1. **Anzeigename** (`anzeigeName: String`) — frei wählbar, 2–20 Zeichen, änderbar.
   Wird im HUD, Nameplate und Rundenauswertung angezeigt. Nicht identisch mit `benutzername`
   (Login-Name). Duplikate erlaubt (Anzeigename ist kein Login-Key).
2. **Avatar** — Auswahl aus einer festen Palette von 12 Farben (keine Bild-Uploads).
   Darstellung als farbiger Kreis neben dem Anzeigenamen. Farbe gespeichert als `avatarFarbe: String`
   (z.B. `"#e63946"`). Standard: zufällige Farbe aus Palette bei Registrierung.
3. **Mitglied seit** (`erstelltAm`) — automatisch gesetzt, schreibgeschützt.

### Statistiken (pro Spieler, aggregiert)

4. Statistiken werden nach **jedem abgeschlossenen Spiel** aktualisiert:

   | Feld | Beschreibung |
   |------|-------------|
   | `anzahlSpiele` | Gesamt gespielte Einzelspiele |
   | `anzahlSiege` | Spiele gewonnen (als Re oder Kontra mit positivem Ergebnis) |
   | `gesamtPunkte` | Summe aller erzielten Spielpunkte |
   | `fuchsGefangen` | Wie oft den gegnerischen Fuchs gefangen |
   | `fuchsVerloren` | Wie oft eigenen Fuchs verloren |
   | `karlchenGespielt` | Wie oft Karlchen (Kreuz-Bube im letzten Stich) gespielt |
   | `doppelkoepfe` | Wie oft Doppelkopf-Stich gewonnen |
   | `solosSiege` | Gewonnene Soli |
   | `solosNiederlagen` | Verlorene Soli |

5. Statistiken sind **append-only** — sie werden nie zurückgesetzt, nur erhöht.
6. Statistiken sind **öffentlich lesbar** über das Spieler-Profil (`GET /api/spieler/{id}/profil`).

### Partieverlauf

7. Die letzten **20 Partien** je Spieler werden gespeichert (Tabelle `partie_ergebnis`):
   - `partieId`, `tischName`, `datum`, `endPunktestand` (eigene Punkte), `rangplatz` (1–4), `spielanzahl`
8. Ältere Einträge werden automatically rotiert (keine unbegrenzte History in V1).

### Private Tische / Einladungslinks

9. `Tisch` erhält Feld `zugangsmodus: OFFEN | PRIVAT` (Standard: OFFEN).
10. Bei `PRIVAT`: Feld `einladungsCode: String` (8 alphanumerische Zeichen, einmalig generiert).
11. Einladungslink: `/join/{einladungsCode}` — leitet zur TischSzene weiter und tritt bei.
12. Nur eingeloggte Spieler können privaten Tischen beitreten.
13. Tisch-Ersteller = Gastgeber: Kann Spieler kicken (`DELETE /api/tisch/{id}/spieler/{spielerId}`).
14. Öffentliche Tischliste zeigt nur `OFFEN`-Tische — private sind nicht aufgelistet (nur via Link).

## Akzeptanzkriterien

- Anzeigename und Avatar sind im HUD sichtbar.
- Statistiken werden nach jedem Spiel korrekt erhöht.
- Profil-Seite zeigt Statistiken und letzte 20 Partien.
- Privater Tisch ist nicht in der Tischliste sichtbar.
- Einladungslink führt direkt zum Beitreten des privaten Tisches.
- Gastgeber kann Spieler kicken.

## Definition of Done

- [x] `Spieler`-Entität: `anzeigeName`, `avatarFarbe` Felder + Liquibase-Migration
- [x] `SpielerStatistik`-Tabelle in DB (1:1 mit Spieler)
- [x] `PartieErgebnis`-Tabelle (N:1 mit Spieler, max. 20 Einträge rotiert)
- [x] Statistik-Update nach `SpielBeendet`-Event (via `@ApplicationModuleListener`)
- [x] `GET /api/spieler/{id}/profil` Endpoint
- [x] `Tisch`-Entität: `zugangsmodus` + `einladungsCode` + Liquibase-Migration
- [x] `GET /join/{code}` → Redirect + Auto-Beitreten
- [x] Gastgeber-Kicken Endpoint
- [x] Frontend: Avatar + Anzeigename im HUD und Nameplate
- [x] Frontend: Profil-Ansicht (Statistiken + Verlauf)

## Technische Hinweise

- **Bounded Context**: `spieler/` für Profil + Statistiken; `tisch/` für Einladungs-Code.
- Statistik-Update über `@ApplicationModuleListener(SpielBeendet.class)` in `spieler/`-Modul —
  kein direkter Aufruf aus `tisch/` oder `partie/`.
- `einladungsCode` generieren: `RandomStringUtils.randomAlphanumeric(8).toUpperCase()` (Apache Commons).
  Eindeutigkeit über `UNIQUE`-Constraint in DB.
- Partieverlauf-Rotation: `DELETE FROM partie_ergebnis WHERE spieler_id = ? ORDER BY datum ASC LIMIT (COUNT(*) - 20)`.
