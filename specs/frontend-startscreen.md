# Frontend: Start-Screen

| Feld           | Wert                              |
|----------------|-----------------------------------|
| Status         | Neu                               |
| Priorität      | Hoch                              |
| Abhängigkeiten | frontend-visuelles-design.md, lobby.md |

## Beschreibung

Der Start-Screen ist die erste Seite die ein Spieler sieht. Er ersetzt die bisherige technisch anmutende Lobby-Szene. Die Seite vermittelt sofort die Energie des Spiels: fett, klar, einladend. Von hier aus gelangt man entweder an einen neuen Tisch oder setzt sich an einen bereits offenen.

## Layout-Übersicht

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                                                                  │
│                    L O C O   D O K O                             │  ← großes Logo
│              Dullen. Füchse. Wahnsinn.                           │  ← Slogan
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   + Neuen Tisch erstellen   │                    │  ← Primary Button
│              └─────────────────────────────┘                    │
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   ⊞  Offene Tische          │                    │  ← Secondary Button
│              └─────────────────────────────┘                    │
│                                                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Anforderungen

### Allgemein

1. Der Start-Screen füllt die **gesamte Canvas-Fläche** (1280×720px).
2. Hintergrund: Tisch-Textur (Standard: Grüner Filz), identisch zum Spielfeld-Hintergrund.
3. Alle Texte und Buttons sind **horizontal zentriert**.

### Logo und Slogan

1. „LOCO DOKO" wird als **großer, fetter Schriftzug** dargestellt (`font-weight: 900`, `font-size: min(80px, 7vw)`).
2. Schriftart: Space Grotesk (siehe `frontend-visuelles-design.md`).
3. Farbe: `#f8f9fa` (fast Weiß), optional mit hartem Textschatten `3px 3px 0 #000`.
4. Darunter der Slogan **„Dullen. Füchse. Wahnsinn."** in kleinerer Schrift (`font-size: min(22px, 1.8vw)`), Farbe `#a3c4a8`.
5. Beide Texte sind **nicht interaktiv**.

### Haupt-Buttons

1. **„+ Neuen Tisch erstellen"** (Primary Button): öffnet das Tisch-Konfigurations-Modal.
2. **„⊞ Offene Tische"** (Secondary Button): zeigt die Liste offener Tische.
3. Buttons sind breit, klar beschriftet, Neo-Brutalism-Stil (`border: 2px solid #f8f9fa`, `box-shadow: 4px 4px 0 #000`).
4. Hover-Effekt: Offset-Schatten verschwindet, Button verschiebt sich um `4px 4px` (pressed-Feeling).
5. Beide Buttons sind **per Tastatur fokussierbar** (Tab-Reihenfolge, Enter zum Auslösen).

### Tisch-Konfigurations-Modal

1. Öffnet sich als **zentriertes Modal** auf dem Start-Screen (Backdrop abdunkelt den Hintergrund).
2. Titel: „Neuen Tisch erstellen".
3. Felder:
   - Tischname (Text-Input, Pflichtfeld)
   - Anzahl Spiele / Rundenanzahl (Auswahl: 12, 24, 36, ...)
   - KI-Schwierigkeit (Auswahl: Leicht, Standard, Schwer)
   - Tischhintergrund (Auswahl: Grüner Filz, Dunkles Holz, Blaue Grafik)
4. **Sonderregeln** (Checkboxen, Details in einer späteren Iteration):
   - Placeholder-Sektion „Sonderregeln" mit Hinweis „Konfiguration folgt".
5. Buttons: „Tisch erstellen" (Primary) und „Abbrechen" (Secondary / Escape).
6. Nach erfolgreichem Erstellen wechselt die Szene direkt zur **TischSzene**.

### Offene-Tische-Liste

1. Klappt als **Bereich unterhalb der Buttons** aus (kein Modal — bleibt auf dem Start-Screen).
2. Zeigt alle offenen Tische mit Status WARTEND als Liste.
3. Jeder Listeneintrag zeigt: Tischname, Anzahl Spieler (z.B. `2/4`), KI-Schwierigkeit.
4. Button „Beitreten" pro Eintrag — wechselt direkt zur TischSzene.
5. Wenn keine offenen Tische vorhanden: Hinweistext „Keine offenen Tische. Erstelle einen neuen!".
6. Die Liste **aktualisiert sich automatisch** alle 5 Sekunden (Polling via REST-API).
7. Erneuter Klick auf „⊞ Offene Tische" klappt die Liste wieder ein.

### Session-Recovery

1. Wenn der Spieler bereits einem Tisch zugeordnet ist (Session-Cookie vorhanden und Tisch aktiv), erscheint **zusätzlich** ein dritter Button: „↩ Zurück zu [Tischname]".
2. Dieser Button ist prominent (zwischen Logo und den anderen Buttons) und führt direkt zur TischSzene.

## Akzeptanzkriterien

- Logo und Slogan sind auf Anhieb lesbar und füllen die Seite angemessen.
- „Neuen Tisch erstellen" öffnet das Konfigurations-Modal.
- Konfiguration kann abgeschlossen werden, danach Wechsel zur TischSzene.
- „Offene Tische" klappt die Liste aus, Beitreten führt zur TischSzene.
- Session-Recovery-Button erscheint wenn eine aktive Tisch-Session vorliegt.
- Alle Aktionen sind per Tastatur erreichbar.

## Definition of Done

- [ ] Start-Screen Szene/Ansicht implementiert (ersetzt bisherige LobbySzene oder wird neue Phaser-Szene)
- [ ] Logo und Slogan korrekt dargestellt
- [ ] „Neuen Tisch erstellen" Modal implementiert (Pflichtfelder: Name, Rundenanzahl)
- [ ] Tisch-Erstellung schließt Modal und wechselt zur TischSzene
- [ ] „Offene Tische" Liste implementiert mit Polling
- [ ] Session-Recovery-Button implementiert
- [ ] Keyboard-Navigation (Tab, Enter)
- [ ] Visuelles Review

## Technische Hinweise

- Die bisherige `LobbySzene` wird **zu einem Start-Screen** umgebaut — kein separates HTML-Template nötig.
- Tisch-Konfigurations-Modal als HTML-Overlay über der Phaser-Canvas (`#ui-root`).
- REST-Polling für offene Tische: `GET /api/tische` alle 5 Sekunden, nur wenn Liste offen ist.
- Sonderregeln-Konfiguration folgt in einer eigenen Spec-Iteration.
