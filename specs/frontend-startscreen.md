# Frontend: Spielverwaltungs-Szene

| Feld           | Wert                              |
|----------------|-----------------------------------|
| Status         | Implementiert |
| Priorität      | Hoch                              |
| Abhängigkeiten | frontend-visuelles-design.md, lobby.md |

## Beschreibung

Die Spielverwaltungs-Szene ist die **dritte Phaser-Szene** (nach BootSzene, vor TischSzene) und ersetzt die bisherige LobbySzene. Sie ist die erste Seite die ein Spieler aktiv sieht. Die Seite vermittelt sofort die Energie des Spiels: fett, klar, einladend. Von hier aus gelangt man entweder schnell in ein Einzelspieler-Spiel (Quick Game), erstellt einen konfigurierten Tisch, oder tritt einem offenen Tisch bei.

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
│              │   ▶  Quick Game             │                    │  ← Primary Button
│              └─────────────────────────────┘                    │
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   + Neuen Tisch erstellen   │                    │  ← Secondary Button
│              └─────────────────────────────┘                    │
│                                                                  │
│              ┌─────────────────────────────┐                    │
│              │   ⊞  Offene Tische          │                    │  ← Secondary Button
│              └─────────────────────────────┘                    │
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

1. **„▶ Quick Game"** (Primary Button): Startet sofort einen Einzelspieler-Tisch gegen 3 KI-Spieler (Standardkonfiguration, kein Modal). Nach erfolgreichem Erstellen wechselt die Szene direkt zur TischSzene.
2. **„+ Neuen Tisch erstellen"** (Secondary Button): öffnet das Tisch-Konfigurations-Modal für vollständige Konfiguration.
3. **„⊞ Offene Tische"** (Secondary Button): zeigt die Liste offener und laufender Tische.
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

### Offene-Tische-Liste

1. Klappt als **Bereich unterhalb der Buttons** aus (kein Modal — bleibt auf dem Start-Screen).
2. Zeigt alle Tische in zwei Gruppen:
   - **Offene Tische** (Status WARTEND): Button „Beitreten" pro Eintrag.
   - **Laufende Tische** (Status IM_SPIEL): Button „Zurückkehren" pro Eintrag — nur für Spieler die diesem Tisch bereits zugeordnet sind. Für fremde Spieler nicht sichtbar.
3. Jeder Listeneintrag zeigt: Tischname, Anzahl Spieler (z.B. `2/4`), KI-Schwierigkeit.
4. „Beitreten" / „Zurückkehren" wechselt direkt zur TischSzene.
5. Wenn keine Tische vorhanden: Hinweistext „Keine offenen Tische. Starte ein Quick Game!".
6. Die Liste **aktualisiert sich automatisch in Echtzeit** via WebSocket (Topic `/topic/tische`).
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

- [x] Spielverwaltungs-Szene als neue Phaser-Szene implementiert (ersetzt LobbySzene)
- [x] Logo und Slogan korrekt dargestellt
- [x] „▶ Quick Game"-Button: startet sofort Einzelspieler-Tisch gegen 3 KI, wechselt zur TischSzene
- [x] „Neuen Tisch erstellen" Modal implementiert (Pflichtfelder: Name, Rundenanzahl, KI-Schwierigkeit)
- [x] Tisch-Erstellung schließt Modal und wechselt zur TischSzene
- [x] „Offene Tische" Liste implementiert mit WebSocket-Echtzeit-Updates (WARTEND + eigene IM_SPIEL-Tische)
- [x] „Zurückkehren"-Button für laufende eigene Tische
- [x] Session-Recovery-Button implementiert (erscheint wenn aktiverTischId vorhanden)
- [ ] Keyboard-Navigation (Tab, Enter)
- [ ] Visuelles Review

## Technische Hinweise

- Die bisherige `LobbySzene` wird durch eine neue `SpielVerwaltungsSzene` ersetzt.
- Tisch-Konfigurations-Modal als HTML-Overlay über der Phaser-Canvas (`#ui-root`).
- WebSocket `/topic/tische` für Echtzeit-Tischlisten-Updates (kein REST-Polling nötig), nur wenn Liste offen ist.
- Quick Game erstellt einen Tisch mit Standardkonfiguration ohne Modal und startet sofort.
- Die Tischliste zeigt laufende Tische nur dem Spieler der ihnen bereits zugeordnet ist.
- Sonderregeln-Konfiguration folgt in einer eigenen Spec-Iteration.
