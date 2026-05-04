# IMPLEMENTATION_PLAN — Plan-Run #100

> Stand: 2026-05-04. Fokus: DOM-Eliminierung (Phaser-native UI), Quick Play & Rundenauswertung 2.0.

Dieses Jubiläums-Run verfolgt die Strategie „Phaser, Phaser, Phaser“. Ziel ist die vollständige Entfernung von HTML-DOM-Manipulationen aus den Szenen und die Umsetzung einer rein Canvas-basierten UI inkl. moderner Features.

---

## Legende

- [ ] Offen
- [~] In Arbeit
- [x] Erledigt

---

## P1 — Backend & Daten-Grundlage

### FEAT-POINT-LABELS: Transparente Punkteberechnung
- [ ] **Backend:** `de.locodoko.partie.PunkteRechner` erweitern, um für jeden Punktwert ein fachliches Label zu liefern (z.B. „Gegen die Alten", „Fuchs gefangen").
- [ ] **DTO:** `punkteAufschluesselung` in `LetztesSpielergebnisAntwort` vollständig befüllen.

### FEAT-QUICK-PLAY-SYNC:
- [ ] **Frontend:** `appStore.erstelleQuickGame()` verifizieren, dass es den `/api/tische/schnellstart` Endpunkt korrekt nutzt.
- [ ] **Frontend:** Lade-Status im Store während des Schnellstarts setzen.

---

## P2 — Phaser UI Komponenten (Scaffolding)

### FEAT-PHASER-MODAL: Basis-Komponente für Dialoge
- [ ] Neue Klasse `PhaserModal` (Container):
  - Abdunkelnder Backdrop (Rectangle mit Interactive blocker).
  - Zentriertes Panel im Neo-Brutalism Style (Harter Rahmen, Schatten).
  - Titel, Content-Bereich (flexibel) und Action-Buttons.
  - Fokus-Management (Tastatur-Navigation innerhalb des Modals).

### FEAT-PHASER-LIST: Scrollbare Listen
- [ ] Implementierung einer scrollbaren Liste (`PhaserList`) mit Masking für:
  - Tischliste in der SpielverwaltungsSzene.
  - Punkte-Aufschlüsselung im Auswertungs-Modal.

---

## P3 — Refactoring & Feature-Rollout

### REFACTOR-LOBBY: SpielverwaltungsSzene rein Phaser
- [ ] Entfernung aller DOM-Elemente in `SpielverwaltungsSzene.ts`.
- [ ] Haupt-Navigation (Quick Play, Neuer Tisch, Offene Tische) via `PhaserButton`.
- [ ] „Tisch erstellen"-Modal als `PhaserModal` umsetzen.
  - *Hinweis:* Für Texteingaben wird Phaser's `add.dom('input')` deklarativ genutzt, um native Tastatur-Interaktion zu behalten, aber ohne manuelles DOM-Gefriemel.

### REFACTOR-EVALUATION: Rundenauswertung 2.0
- [ ] Re-Implementierung des Rundenende-Modals als `PhaserModal`.
- [ ] Dynamische Anzeige der `punkteAufschluesselung` aus dem Backend.
- [ ] **Polishing:** „Count-up" Animation der Punkte und Akzentfarben für Parteien.

### REFACTOR-UI-CLEANUP: DOM Elimination
- [ ] **TischUIManager:** Vollsändige Entfernung der DOM-Abhängigkeiten.
- [ ] **ToastManager:** Review und ggf. finale Bereinigung (sollte bereits rein Phaser sein).
- [ ] **E2E-Tests:** Umstellung der Playwright-Tests auf die JavaScript-Bridge (`window.__locodoko`), da `data-testid` im Canvas nicht mehr direkt selektierbar ist.

---

## Akzeptanzkriterien

1.  **Kein DOM-Code:** In `SpielverwaltungsSzene.ts`, `TischSzene.ts` und `TischUIManager.ts` finden sich keine `document.createElement` Aufrufe mehr.
2.  **Quick Play:** Ein Klick auf „Quick Game" startet sofort eine Partie (Join -> Fill -> Start).
3.  **Transparenz:** Die Rundenauswertung zeigt eine detaillierte Liste der Punkteherkunft.
4.  **Stabilität:** Alle 94+ Unit-Tests und die migrierten E2E-Tests sind grün.

---

## TODO Liste

- [ ] Task 1: Backend Punkte-Labels implementieren & DTO befüllen.
- [ ] Task 2: `PhaserModal` & `PhaserList` Scaffolding.
- [ ] Task 3: `SpielverwaltungsSzene` auf Phaser-native umstellen.
- [ ] Task 4: `Rundenauswertung` auf Phaser-native umstellen.
- [ ] Task 5: `TischUIManager` und E2E-Bridge Migration.
