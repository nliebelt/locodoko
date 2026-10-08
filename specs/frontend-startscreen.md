# Frontend: Spielverwaltungs-Szene

| Feld           | Wert                              |
|----------------|-----------------------------------|
| Status         | Implementiert (Überarbeitung ausstehend — FE-LOBBY-REDESIGN) |
| Priorität      | Hoch                              |
| Abhängigkeiten | frontend-visuelles-design.md, lobby.md, frontend-tischliste.md |

## Beschreibung

Die Spielverwaltungs-Szene ist die **dritte Phaser-Szene** (nach BootSzene, vor TischSzene) und ersetzt die bisherige LobbySzene. Sie ist die erste Seite die ein Spieler aktiv sieht. Die Seite vermittelt sofort die Energie des Spiels: fett, klar, einladend. Von hier aus gelangt man entweder schnell in ein Einzelspieler-Spiel (Schnellstart), erstellt einen konfigurierten Tisch, oder tritt einem offenen Tisch bei.

## Layout-Übersicht

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                    L O C O   D O K O                             │  ← großes Logo
│              Dullen. Füchse. Wahnsinn.                           │  ← Slogan
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   ↩ Zurück zu [Tischname]   │                    │  ← Session-Recovery (nur wenn aktiv)
│              └─────────────────────────────┘                    │
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   ▶  Schnellstart           │                    │  ← Primary Button
│              └─────────────────────────────┘                    │
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   + Neuen Tisch erstellen   │                    │  ← Secondary Button
│              └─────────────────────────────┘                    │
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   ☰ Offene Tische →         │                    │  ← Secondary Button (neu)
│              └─────────────────────────────┘                    │
│                                                                  │
│              [Mein Profil]  [Abmelden]  [Spielregeln]           │  ← Tertiary-Zeile (klein)
│              [Feedback]  [Bug melden]                           │
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

1. **„▶ Schnellstart"** (Primary Button): Startet sofort einen Einzelspieler-Tisch gegen 3 KI-Spieler (Standardkonfiguration, kein Modal). Nach erfolgreichem Erstellen wechselt die Szene direkt zur TischSzene.
2. **„+ Neuen Tisch erstellen"** (Secondary Button): öffnet das Tisch-Konfigurations-Modal für vollständige Konfiguration.
3. **„☰ Offene Tische →"** (Secondary Button): navigiert zur `TischlisteSzene` mit vollständiger Tischübersicht (Spielernamen, Regeln, Beitreten). Ersetzt die bisherige eingebettete Liste.
4. Buttons sind breit, klar beschriftet, Neo-Brutalism-Stil (`border: 2px solid #f8f9fa`, `box-shadow: 4px 4px 0 #000`).
5. Hover-Effekt: Offset-Schatten verschwindet, Button verschiebt sich um `4px 4px` (pressed-Feeling).
6. Alle Buttons sind **per Tastatur fokussierbar** (Tab-Reihenfolge, Enter zum Auslösen).

### Tisch-Konfigurations-Modal

1. Öffnet sich als **zentriertes Modal** auf dem Start-Screen (Backdrop abdunkelt den Hintergrund).
2. Titel: „Neuen Tisch erstellen".
3. Felder:
   - Tischname (Text-Input, Pflichtfeld)
   - Anzahl Spiele / Rundenanzahl (Auswahl: 12, 24, 36, ...)
   - KI-Schwierigkeit (Auswahl: Leicht, Standard, Schwer)
   - Tischhintergrund (Auswahl: Grüner Filz, Dunkles Holz, Blaue Grafik)
4. **Regelset** (Preset-Auswahl + optionale Detailkonfiguration):
   - Dropdown: „Loco Blatt" (Standard) / „DKV-Turnier" / „Ohne Neunen" / „Benutzerdefiniert"
   - Bei „Benutzerdefiniert": Checkboxen für alle Einzeloptionen einblenden
     (Bockrunden, Schweinchen, 30-Augen-Pflicht, Sonderpunkte, Sonderspiele, Dulle-Regel)
   - Bei den anderen Presets: Optionen schreibgeschützt anzeigen (kein Bearbeiten)
   - Details zu Presets und Optionen: regelkatalog.md, tischkonfiguration.md
5. Buttons: „Tisch erstellen" (Primary) und „Abbrechen" (Secondary / Escape).
6. Nach erfolgreichem Erstellen wechselt die Szene direkt zur **TischSzene**.

### Sekundäre Aktionen (Tertiary-Zeile)

Weniger prominente Aktionen erscheinen unterhalb der drei Haupt-Buttons als kleinere, weniger kontraststarke Buttons in einer kompakten Zeile:

1. **Mein Profil** — öffnet das Profil-Overlay (Statistik, Nickname-Änderung).
2. **Abmelden** — meldet den Spieler ab und leitet zur LoginSzene.
3. **Spielregeln** — öffnet die HilfeSzene (alternativ: F1 / H-Taste).
4. **Feedback** / **Bug melden** — öffnet das Feedback-/Bugreport-Modal (Shift+F1).

Die Tertiary-Buttons sind kleiner als die Haupt-Buttons (`font-size` ~14px vs. 18px) und in geringerem Kontrast (`#a3c4a8` statt `#f8f9fa`) dargestellt, um den Fokus auf die primären Aktionen zu lenken.

### Offene-Tische-Liste (abgelöst)

Die eingebettete Tischliste auf der Hauptseite wurde durch die `TischlisteSzene` ersetzt (→ `specs/frontend-tischliste.md`). Der Button „☰ Offene Tische →" navigiert dorthin. Auf der Hauptseite erscheint keine Tischliste mehr.

### Session-Recovery

1. Wenn der Spieler bereits einem Tisch zugeordnet ist (Session-Cookie vorhanden und Tisch aktiv), erscheint **zusätzlich** ein dritter Button: „↩ Zurück zu [Tischname]".
2. Dieser Button ist prominent (zwischen Logo und den anderen Buttons) und führt direkt zur TischSzene.

## Akzeptanzkriterien

- Logo und Slogan sind auf Anhieb lesbar und füllen die Seite angemessen.
- „Neuen Tisch erstellen" öffnet das Konfigurations-Modal.
- Konfiguration kann abgeschlossen werden, danach Wechsel zur TischSzene.
- „☰ Offene Tische →" navigiert zur TischlisteSzene; keine eingebettete Liste mehr auf der Hauptseite.
- Session-Recovery-Button erscheint wenn eine aktive Tisch-Session vorliegt.
- Alle primären Aktionen sind per Tastatur erreichbar.
- Sekundäre Buttons (Mein Profil, Abmelden etc.) sind kleiner/weniger prominent dargestellt.

## Definition of Done

- [x] Spielverwaltungs-Szene als neue Phaser-Szene implementiert (ersetzt LobbySzene)
- [x] Logo und Slogan korrekt dargestellt
- [x] „▶ Schnellstart"-Button: startet sofort Einzelspieler-Tisch gegen 3 KI, wechselt zur TischSzene
- [x] „Neuen Tisch erstellen" Modal implementiert (Pflichtfelder: Name, Rundenanzahl, KI-Schwierigkeit)
- [x] Tisch-Erstellung schließt Modal und wechselt zur TischSzene
- [x] „Offene Tische" Liste war implementiert (eingebettete PhaserList) — wird durch TischlisteSzene ersetzt
- [x] „Zurückkehren"-Button für laufende eigene Tische
- [ ] **FE-LOBBY-REDESIGN**: eingebettete Tischliste entfernt, Button „☰ Offene Tische →" ergänzt, Tertiary-Buttons kleiner/dezenter
- [x] Session-Recovery-Button implementiert (erscheint wenn aktiverTischId vorhanden)
- [x] Keyboard-Navigation (Tab, Enter)
- [x] Visuelles Review (via Vision-Loop, mehrere Sessions)

## Technische Hinweise

- Die Startseite wird durch `SpielverwaltungsSzene` umgesetzt (kein separates Lobby-Modul).
- Tisch-Konfigurations-Modal als HTML-Overlay über der Phaser-Canvas (`#ui-root`).
- Schnellstart erstellt einen Tisch mit Standardkonfiguration ohne Modal und startet sofort.
- Die Tischliste ist in eine eigene `TischlisteSzene` ausgelagert (→ `specs/frontend-tischliste.md`).
- Sonderregeln-Konfiguration folgt in einer eigenen Spec-Iteration.
