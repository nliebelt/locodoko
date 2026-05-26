# Frontend: UI-Logik

| Feld           | Wert                                                                                    |
|----------------|-----------------------------------------------------------------------------------------|
| Status         | Stabil |
| Priorität      | Hoch                                                                                    |
| Abhängigkeiten | frontend-tischansicht.md, websocket-kommunikation.md, stichlogik.md, ansagen.md, frontend-tastatursteuerung.md |

## Beschreibung

Die UI-Logik bestimmt, welche Interaktionen dem Spieler wann zur Verfügung stehen. Die Tischansicht verwendet ein hybrides Modell: Spielaktions-Elemente (Vorbehalt, Ansage, Armut, Stich-Feedback, Nameplates) sind in Phaser umgesetzt und rendern auf der Spielfläche. Meta-UI-Elemente (Seitenlade, Einstellungs-Modal, Rundenauswertung) sind als HTML-DOM über dem Canvas implementiert — sie benötigen keine Phaser-Migration da sie funktional vollständig sind und keinen Spielwert-Nutzen einer Migration hätte.

### Grundsatz: Event-Driven UI

Die UI reagiert nicht mehr auf Zustandsänderungen durch Diffing (Vergleich alter vs. neuer Snapshot), sondern **exklusiv auf dedizierte WebSocket-Push-Events**.

1. **Reaktive UI (Events):** Modals, Banner, Sonderpunkt-Feedback und Spiel-Übergänge werden *ausschließlich* durch dedizierte Ereignisse aus dem `AppStore.abonniereEvents()`-Stream ausgelöst (z.B. `SPIEL_BEENDET`, `SCHWEINCHEN_GEMELDET`).
2. **Snapshot-Rendering (Reconciliation):** Der `AppStore`-Snapshot ist für den statischen Tisch-Zustand verantwortlich. Die `TischSzene` implementiert ein **identitätsbasiertes Rendering**:
   - **Verbot:** Das pauschale Aufrufen von `container.destroy(true)` bei jedem Update ist untersagt.
   - **Wiederverwendung:** Karten-Objekte (Sprites) werden anhand ihrer `karteId` identifiziert und im Speicher behalten.
   - **Patching:** Bei einem Zustands-Update werden nur die Eigenschaften (Position, Sichtbarkeit, Textur) bestehender Sprites aktualisiert. Neue Objekte werden nur erzeugt, wenn die ID noch nicht existiert.
3. **UI-Guard:** Um "Springen" zu verhindern, darf `renderTisch()` während aktiver UI-Blocker (z.B. Rundenauswertung-Modal) keine Animationen oder Zustandsübergänge triggern, die mit dem Modal-Zustand kollidieren.

### Verarbeitung der Ereignisse

- **Kein Raten:** `ermittleNeuesSpiel()`, `ermittleNeuAbgeschlossenenStich()` und vergleichbare Diffing-Methoden in `TischSzene.ts` sind **verboten**. 
- **Explizite Trigger:** Die Szene implementiert einen Event-Handler, der bei `SPIEL_BEENDET` das entsprechende Modal öffnet.
- **Synchronisation:** Der Event-Handler sorgt für einen sauberen "Clean Slate" (Animationen abbrechen, HandKarten-Map leeren), bevor die neue Phase visualisiert wird.
- **Versionierung:** Der `AppStore` prüft die `version` jedes eingehenden Events — abgeleitet aus dem `@Version`-Feld des Partie-Aggregats im Backend (Optimistic Locking). `version` ist die **einzige Sequenznummer**, kein separater Zähler. Bei Lücken (`E > letzteVersion + 1`) fordert der Store automatisch einen HTTP-Snapshot an (Self-Healing). Stale-Events (`E ≤ letzteVersion`) werden verworfen.

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

- [x] Seitliche HTML-Panels entfernt
- [x] „Du bist dran"-Hinweis und alle spielblockenden Overlays entfernt
- [x] Floating Action Bar für Ansagen implementiert (auf Spielfläche, nicht blockierend)
- [x] Vorbehalt-Overlay implementiert (alle Optionen, Tastatur-Support, Karten bleiben sichtbar)
- [x] Armut-Dialog implementiert (auf Spielfläche)
- [x] Seitenlade implementiert
- [x] Einstellungs-Modal implementiert
- [x] Toast-Notifications implementiert
- [x] Rundenende-Overlay integriert (Aufruf nach Spielende)
- [x] Alle Aktionen auch per Tastatur auslösbar
- [x] Frontend-Tests geschrieben und bestanden

## Technische Hinweise

- Spielbare Karten: `setInteractive()` / `disableInteractive()` basierend auf Backend-Daten.
- Karten-Grayout: Alpha-Wert reduzieren (z.B. 0.45) oder Tint setzen.
- Hover-Effekt: `pointerover`/`pointerout`-Events mit Y-Verschiebung (-10px).
- Floating Action Bar als Phaser-Container oder eigener UI-Layer, gebunden an Canvas-Koordinaten.
- **Hybrid-Rendering:** Spielaktions-Elemente (Karten, Vorbehalt-Overlay, Armut-Overlay, Floating-Bar) sind als Phaser-Layer/Container umgesetzt. Meta-UI-Elemente (Seitenlade, Einstellungs-Modal, Rundenauswertung, Toast-Notifications) sind als HTML-DOM-Overlays über dem Canvas implementiert (`TischUIManager`, CSS-Klassen `ui-modal-backdrop` etc.).
- Kein Modal kann per Escape geschlossen werden wenn eine spielrelevante Entscheidung aussteht.
