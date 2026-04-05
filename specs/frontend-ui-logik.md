# Frontend: UI-Logik

| Feld           | Wert                                                                                    |
|----------------|-----------------------------------------------------------------------------------------|
| Status         | Implementiert — Spielaktions-UI in Phaser, Meta-UI als HTML-DOM                        |
| Priorität      | Hoch                                                                                    |
| Abhängigkeiten | frontend-tischansicht.md, websocket-kommunikation.md, stichlogik.md, ansagen.md, frontend-tastatursteuerung.md |

## Beschreibung

Die UI-Logik bestimmt, welche Interaktionen dem Spieler wann zur Verfügung stehen. Die Tischansicht verwendet ein hybrides Modell: Spielaktions-Elemente (Vorbehalt, Ansage, Armut, Stich-Feedback, Nameplates) sind in Phaser umgesetzt und rendern auf der Spielfläche. Meta-UI-Elemente (Seitenlade, Einstellungs-Modal, Rundenauswertung) sind als HTML-DOM über dem Canvas implementiert — sie benötigen keine Phaser-Migration da sie funktional vollständig sind und keinen Spielwert-Nutzen einer Migration hätte.

### Grundsatz: Hybride UI

**Spielaktions-UI** (Vorbehalt, Ansage, Armut, Stich-Feedback): Alle Elemente die direkt ins Spielgeschehen eingreifen, werden **auf der Spielfläche** dargestellt — sie dürfen die Karten nicht verdecken und gehören visuell zum Tisch.

**Meta-UI** (Seitenlade `[≡]`, Einstellungs-Modal `[⚙]`): Informations- und Konfigurationselemente sind als HTML-DOM-Elemente implementiert — sie liegen als CSS-Overlay über dem Phaser-Canvas und werden per JavaScript-Event-Handler gesteuert.

Hinweise die lediglich den Spielzug des Spielers ankündigen (z.B. „Du bist dran") **entfallen ersatzlos** — der aktive Spieler ist durch Nameplate-Hervorhebung erkennbar.

## Anforderungen

### Spielbare Karten

1. **Nur spielbare Karten** sind anklickbar/interagierbar.
2. Welche Karten spielbar sind, wird vom **Backend** bestimmt (Bedienpflicht, Trumpfzwang).
3. Das Backend sendet mit jedem Zustandsupdate die **Liste der spielbaren Karten** für den aktuellen Spieler.
4. **Nicht spielbare Karten** werden visuell ausgegraut (reduziertes Alpha).
5. Wenn der Spieler **nicht am Zug** ist, sind alle Karten nicht interagierbar.
6. Beim **Hovern** über eine spielbare Karte wird diese leicht angehoben (10px, visuelles Feedback).
7. Beim **Klicken** auf eine spielbare Karte wird das `KarteGespielt`-Event an das Backend gesendet.
8. Die aktuell per **Tastatur ausgewählte Karte** wird zusätzlich mit einem Rahmen hervorgehoben (siehe `frontend-tastatursteuerung.md`).

### Ansage-Buttons (Floating Action Bar)

1. Ansage-Buttons (Re, Kontra, Keine 90, Keine 60, Keine 30, Schwarz) erscheinen als **Floating Action Bar** zwischen Stichmitte und den eigenen Karten.
2. Buttons erscheinen **nur wenn eine Ansage regelkonform möglich** ist (Backend sendet verfügbare Ansagen).
3. Die Bar ist **nicht dauerhaft sichtbar** — sie verschwindet wenn keine Ansage möglich ist.
4. Nach einer Ansage verschwindet der entsprechende Button sofort.
5. Jeder Button zeigt den Ansagetext an (z.B. „Re", „Keine 90").
6. Buttons sind **zusätzlich per Tastatur** auslösbar (siehe `frontend-tastatursteuerung.md`).

### Vorbehalt-Phase

1. In der Vorbehalt-Phase erscheint ein **Overlay auf der Spielfläche** — das Spiel wartet auf die Entscheidung des Spielers.
2. Das Overlay ist **nicht fullscreen** — die eigenen Karten bleiben im Hintergrund sichtbar. Das Overlay erscheint als kompakter zentrierter Bereich zwischen Stichmitte und Kartenfächer.
3. Das Overlay zeigt alle verfügbaren Optionen:
   - „Gesund" (kein Vorbehalt)
   - Verfügbare Sonderspiele (Solo-Typen, Hochzeit, Armut) — nur wenn regelkonform und Tischkonfiguration erlaubt.
4. Jede Option ist ein großer, klar beschrifteter Phaser-Button (Rectangle + Text).
5. Der Spieler kann eine Option **per Klick oder Tastatur** auswählen (Pfeiltasten + Enter, oder Zifferntasten 1–N für die N Optionen).
6. Nach der Auswahl verschwindet das Overlay automatisch und das `SonderspielAngemeldet`-Event wird gesendet.
7. Das Overlay kann **nicht per Escape geschlossen** werden — eine Entscheidung ist zwingend.

### Armut-Interaktion

1. Wenn eine Armut angeboten wird, erscheint ein **Overlay auf der Spielfläche** mit „Annehmen" / „Ablehnen".
2. Der Dialog zeigt die Anzahl der Tauschkarten an.
3. Bei „Annehmen" erscheint eine **Kartenauswahl**: Der Spieler wählt die zurückzugebenden Karten aus (klickbar oder Tastatur).
4. Bestätigung per Button oder Enter sendet das `ArmutAngenommen`-Event.
5. Das Overlay kann **nicht per Escape geschlossen** werden — eine Entscheidung ist zwingend.

### Seitenlade (Info-Panel)

1. Öffnet sich per `[≡]`-Button in der Top-Bar oder per Tastatur-Shortcut.
2. Inhalt:
   - Spieler am Tisch mit Partei und Stichzahl
   - Gesamtpunktestand der laufenden Partie
   - Ansagehistorie der laufenden Runde
   - Letzte 3 abgeschlossene Stiche (aufklappbar)
3. Schließt per erneuten `[≡]`-Klick, Klick auf Backdrop oder Escape-Taste.
4. Die Seitenlade **blockiert keine Spielaktionen** — Karten können weiterhin gespielt werden.
5. Die Seitenlade ist als HTML-DOM-Panel implementiert (CSS slide-in über Canvas).
6. Zusätzliche Aktionen in der Seitenlade: Animationsgeschwindigkeit (1x / 2x / sofort), „Zur Lobby", „Tisch verlassen".

### Einstellungs-Modal

1. Öffnet sich per `[⚙]`-Button oder Tastatur-Shortcut.
2. Inhalt:
   - Tischhintergrund (Auswahl: Grüner Filz, Dunkles Holz, Blaue Grafik)
   - KI-Schwierigkeit (Auswahl: Leicht, Standard, Schwer) — nur wenn Tischersteller und WARTEND
   - Animationsgeschwindigkeit (Toggle: 1x / 2x / sofort)
   - Button „Tisch verlassen" (mit Bestätigungsdialog wenn Partie läuft)
   - Button „Zur Lobby"
3. Schließt per `[⚙]`-Klick, Klick auf Backdrop oder Escape-Taste.
4. Das Einstellungs-Modal ist als HTML-DOM-Modal implementiert (Backdrop + Dialog-Div über Canvas).
5. Aktionsbuttons (Tisch verlassen, Zur Lobby, Animationsgeschwindigkeit) befinden sich in der Seitenlade, nicht im Einstellungs-Modal.

### Fehlermeldungen

1. Fehlermeldungen vom Backend erscheinen als **Toast-Notification** oben rechts.
2. Toasts verschwinden nach 4 Sekunden automatisch.
3. Fehler-Toasts sind rot markiert, Info-Toasts neutral.

### Rundenende-Overlay

1. Nach jedem abgeschlossenen Spiel öffnet sich automatisch das **Rundenauswertungs-Overlay** (siehe `frontend-rundenauswertung.md`).
2. Das Overlay blockiert alle Spielaktionen bis es geschlossen wird.
3. Schließen per Button „Weiter" oder Enter-Taste.

## Akzeptanzkriterien

- Keine seitlichen HTML-Panels auf dem Spielfeld.
- Nur spielbare Karten sind anklickbar; nicht spielbare Karten sind ausgegraut.
- Ansage-Buttons erscheinen nur wenn eine Ansage möglich ist, als Floating Bar.
- Die Vorbehalt-Phase zeigt ein modales Overlay mit den korrekten Optionen.
- Der Armut-Dialog funktioniert korrekt (Annehmen/Ablehnen, Kartenauswahl).
- Fehlermeldungen erscheinen als Toasts.
- Seitenlade und Einstellungen sind über Icons erreichbar und blockieren das Spiel nicht dauerhaft.

## Definition of Done

- [ ] Seitliche HTML-Panels entfernt
- [ ] „Du bist dran"-Hinweis und alle spielblockenden Overlays entfernt
- [ ] Floating Action Bar für Ansagen implementiert (auf Spielfläche, nicht blockierend)
- [ ] Vorbehalt-Overlay implementiert (alle Optionen, Tastatur-Support, Karten bleiben sichtbar)
- [ ] Armut-Dialog implementiert (auf Spielfläche)
- [ ] Seitenlade implementiert
- [ ] Einstellungs-Modal implementiert
- [ ] Toast-Notifications implementiert
- [ ] Rundenende-Overlay integriert (Aufruf nach Spielende)
- [ ] Alle Aktionen auch per Tastatur auslösbar
- [ ] Frontend-Tests geschrieben und bestanden

## Technische Hinweise

- Spielbare Karten: `setInteractive()` / `disableInteractive()` basierend auf Backend-Daten.
- Karten-Grayout: Alpha-Wert reduzieren (z.B. 0.45) oder Tint setzen.
- Hover-Effekt: `pointerover`/`pointerout`-Events mit Y-Verschiebung (-10px).
- Floating Action Bar als Phaser-Container oder eigener UI-Layer, gebunden an Canvas-Koordinaten.
- Seitenlade, Modal-Dialoge und Overlays als Phaser-Layer/Container über dem Spielfeld.
- Kein Modal kann per Escape geschlossen werden wenn eine spielrelevante Entscheidung aussteht.
