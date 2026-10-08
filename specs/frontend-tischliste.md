# Frontend: Tischliste-Szene

| Feld           | Wert                                                      |
|----------------|-----------------------------------------------------------|
| Status         | Spezifikation (noch nicht implementiert)                  |
| Priorität      | Hoch                                                      |
| Abhängigkeiten | frontend-startscreen.md, lobby.md, frontend-visuelles-design.md |

## Beschreibung

Die `TischlisteSzene` ist eine **eigene Phaser-Szene** für die Übersicht offener Tische — analog zur `BestenlisterSzene` in Design und Struktur. Sie löst den bisherigen eingebetteten Tischlisten-Abschnitt auf der `SpielverwaltungsSzene` ab, der wegen des beschränkten Platzes und fehlender Informationen unbrauchbar war. Der Aufruf erfolgt über den neuen Button „Offene Tische" auf der Hauptseite.

## Layout

```text
┌──────────────────────────────────────────────────────────────────┐
│  ← Zurück               OFFENE TISCHE           + Neuen Tisch   │
│                                                                  │
│  Tischname          Spieler                 Regeln               │
│  ───────────────────────────────────────────────────────────     │
│  Gemütliche Runde   Max, Anna, ○ ○          10 Sp · m.9   [Bei] │
│  Schnelle Partie    KI, KI, KI, ○           24 Sp · o.9   [Bei] │
│  Mein Tisch ★       Du, ○ ○ ○               10 Sp · m.9   [For] │
│                                                                  │
│  (leer: „Keine offenen Tische — erstelle einen oder starte      │
│          ein Schnellspiel auf der Hauptseite.")                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Anforderungen

### Navigation
1. **„← Zurück"**-Button oben links → navigiert zur `SpielverwaltungsSzene`.
2. **„+ Neuen Tisch"**-Button oben rechts → öffnet das Tisch-Konfigurations-Modal (identisch zum Modal auf der Hauptseite).
3. Szenenname: `'TischlisteSzene'`.

### Tabellenkopf
1. Drei Spalten: **Tischname** (links) · **Spieler** (Mitte) · **Regeln** (Mitte-rechts).
2. Kopfzeile in `#a3c4a8` (Standardtext, klein), Trennlinie in `0x4a7c59`.

### Tischeinträge
1. Jede Zeile zeigt einen Tisch mit Status `WARTEND`.
2. **Tischname**: links ausgerichtet, max. Breite 280px (mit `kuerzeText`), gold (`#f8c94e`) wenn eigener Tisch, sonst `#f8f9fa`.
3. **Spieler-Spalte**: belegte Plätze als Namen, freie als `○`, getrennt durch Komma+Leerzeichen. KI-Spieler als `KI`. Maximal 4 Einträge. Beispiel: `Max, Anna, ○ ○` oder `KI, KI, KI, ○`.
4. **Regeln-Spalte**: Kurzdarstellung aus `kurzKonfiguration` — Format: `{anzahlSpiele} Sp · {m.9 | o.9}`. Beispiel: `10 Sp · m.9` (mit Neunen), `24 Sp · o.9` (ohne Neunen).
5. **[Beitreten]**-Button rechts (Primary). Für eigenen Tisch: **[Fortsetzen]** (Secondary), Zeile gold hervorgehoben.
6. Eigener aktiver Tisch (Status `IM_SPIEL`) wird ebenfalls angezeigt — Button „Fortsetzen".

### Leer-Zustand
1. Wenn keine Tische vorhanden: Hinweistext `Keine offenen Tische — erstelle einen oder starte ein Schnellspiel auf der Hauptseite.` (zentriert, `#a3c4a8`).

### Echtzeit-Updates
1. Die Szene abonniert den AppStore (analog `SpielverwaltungsSzene`) und rendert bei jeder Tischlisten-Änderung neu.
2. Wechselt automatisch zur `TischSzene`, sobald der Store in den `TISCH`-Bereich wechselt.

### Scrolling
1. Bei mehr als 8 Tischen: Scroll via Mausrad (analog zur scrollbaren Verlaufstabelle im RundenEnde-Overlay).
2. Sichtbarer Bereich: 8 Zeilen à 48px = 384px Höhe.

## Palette (identisch RundenEnde / BestenlisterSzene)
- Hintergrund: Grüner Filz (`TEXTUR_FILZ`, Alpha 0.95)
- Kopfzeile/Titel: `#f8f9fa` (weiß)
- Standardtext: `#a3c4a8`
- Gold (eigener Tisch, Überschriften): `#f8c94e`
- Trenner: `0x4a7c59`
- Zeilenhintergrund (alternierend, optional): `rgba(0,0,0,0.2)` / `rgba(0,0,0,0.35)`

## Akzeptanzkriterien
- Szene öffnet sich vom „Offene Tische"-Button der Hauptseite.
- Tabelle zeigt Tischname, Spielernamen (belegte Plätze) und Regelkurzinfo.
- Eigener Tisch ist gold hervorgehoben.
- Leer-Zustand zeigt Hinweistext.
- Echtzeit-Update: neuer Tisch erscheint ohne Seitenwechsel.
- „Beitreten" führt direkt zur TischSzene.

## Definition of Done
- [ ] Neue Szene `TischlisteSzene` in `frontend/src/szenen/` implementiert und in `main.ts` registriert
- [ ] In `SpielverwaltungsSzene` per Button navigierbar
- [ ] BE-Erweiterung `spielerNamen` in `TischListenEintragAntwort` genutzt
- [ ] Build + Lint grün, Tests grün
- [ ] Vision Loop: Szene auf Screen sichtbar, Tabelle korrekt gerendert
