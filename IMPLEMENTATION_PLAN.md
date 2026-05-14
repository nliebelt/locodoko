# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-14. Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## Offene Aufgaben

### FEAT-BITMAPFONT (Task 52)
- [ ] **Frontend** (Niedrige Priorität): Press Start 2P als Phaser BitmapFont laden statt als Web-Font.
  - Bitmap-Atlas erzeugen (z.B. mit Phaser Font Builder oder `msdf-bmfont-xml`) für die benötigten Größen (8, 10, 14, 20, 28 px).
  - `AssetLoader.ts`: `this.load.bitmapFont('pressStart2P', ...)` in `preload()`.
  - Alle `this.add.text(x, y, t, { fontFamily: FONT_FAMILY })` in `TischSzene.ts` und anderen Dateien auf `this.add.bitmapText(x, y, 'pressStart2P', t, size)` umstellen.
  - Aufwand: hoch (30+ Aufrufstellen). Nur umsetzen wenn messbare Performance-Probleme auf Schwachgeräten auftreten.
