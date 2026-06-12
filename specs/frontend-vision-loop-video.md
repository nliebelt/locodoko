# Video-basierter Vision-Loop

> Status: **Implementiert (Infrastruktur)** — Session 118 (2026-06-12). Erster echter End-to-End-Lauf gegen das laufende Backend steht noch aus.

## Motivation

Der Screenshot-Vision-Loop (`vision-loop.spec.ts`, `frontend-vision-loop.md`) friert den Spielablauf an diskreten, vorab definierten Zuständen ein. Alles *dazwischen* — Tween-Übergänge, Flash-Texte, Modal-Animationen — entgeht ihm. Genau dort lagen reale Bugs (`BUG-FE-MODAL-TWEEN-CLEANUP`; die „best-effort" Flash-Texte F-04…F-09, die so flüchtig sind, dass der Screenshot-Loop sie nur mit Timing-Tricks trifft).

Der video-basierte Loop nimmt den Ablauf **durchgehend** auf und sampelt ihn hinterher beliebig fein — kein Timing-Raten mehr.

## Kernidee & technische Kette

Der Agent kann Videos nicht direkt lesen, nur Standbilder. Deshalb:

1. **Aufnahme:** Playwright zeichnet den Playthrough als `.webm` (VP8) auf (`playwright.config.video.ts` → `video: 'on'`). Der Test (`vision-video.spec.ts`) spielt **in Echtzeit, ohne Turbo** — gerade damit die Animationen im Bewegtbild landen.
2. **Extraktion:** `extrahiere-video-frames.mjs` zerlegt das `.webm` mit fester Bildrate in nummerierte PNGs.
3. **Sichtung:** Der Agent liest ausgewählte Frames mit dem Read-Tool.

**ffmpeg:** Kommt aus dem Playwright-Bundle (`~/.cache/ms-playwright/ffmpeg-*/ffmpeg-linux`) — passend kompiliert (matroska/webm-Demux + libvpx_vp8-Decode + png-Encode). Kein System-ffmpeg nötig; das Skript findet den Bundle-Binary automatisch und fällt sonst auf `which ffmpeg` zurück.

## Bedienung

```sh
cd e2e
# 1) Backend muss laufen (wie beim Screenshot-Loop: mvn spring-boot:run + frisches
#    dist nach target/classes/static kopieren + /actuator/health UP abwarten).
npm run test:video
# 2) Video → Frames (Pfad steht in der Test-Ausgabe)
npm run frames -- --video test-results/video/<...>/video.webm --fps 4
```

Optionen von `extrahiere-video-frames.mjs`:
- `--video <pfad>` (erforderlich) — das aufgenommene `.webm`.
- `--fps <n>` (Default 4) — Frames pro Sekunde. Höher = feiner, aber mehr Bilder.
- `--out <dir>` (Default `test-results/frames/<videoname>/`).
- `--max <n>` (Default 0 = alle) — Frame-Obergrenze.

## Sichtungsstrategie (wichtig — Kontext-Budget)

Ein 3-Minuten-Lauf bei 4 fps = ~720 Frames. Die kann der Agent **nicht** alle einlesen. Vorgehen:
1. **Grobdurchlauf:** jeden ~8.–10. Frame sichten, um Phasen zu lokalisieren.
2. **Verdichtung:** rund um auffällige Stellen (Modalwechsel, Flash, Tween) jeden Frame einlesen.

Da der Bundle-ffmpeg keinen Szenen-Differenz-Filter (`select='gt(scene,…)'`) mitbringt, erfolgt das Sampling über feste fps + manuelle Auswahl, nicht über automatische Szenenerkennung.

## Artefakte (nicht eingecheckt)

Video und Frames landen unter `e2e/test-results/` (bereits in `.gitignore`). Versioniert sind nur die Werkzeuge: `playwright.config.video.ts`, `tests/vision-video.spec.ts`, `extrahiere-video-frames.mjs`.

## Abgrenzung zum Screenshot-Loop

| | Screenshot-Loop | Video-Loop |
|---|---|---|
| Tempo | Turbo + gezielte 0.2×-Fenster | Echtzeit, durchgehend |
| Erfasst | diskrete Zustände | kontinuierlichen Verlauf |
| Stärke | schnell, deterministisch, Clipping/Layout | Animationen/Tweens/flüchtige Flashes |
| Kosten | wenige Bilder | viele Frames → gezielt sampeln |

Beide Loops bestehen nebeneinander — der Screenshot-Loop bleibt der schnelle Default für Layout-/Clipping-Checks, der Video-Loop ergänzt ihn für dynamische Befunde.

## Offen / nächste Schritte

- **Erster echter Lauf** gegen das laufende Backend (Infrastruktur ist verifiziert: Playwright-Video-Aufnahme → ffmpeg-Extraktion → lesbare PNGs nachgewiesen; nur der vollständige Spiel-Playthrough als Video fehlt noch).
- Optional: gezielte Kurz-Videos pro Szenario (Vorbehalt, Stich-Einzug, Rundenende-Modal) statt einer langen Gesamtaufnahme, falls das Kontext-Budget pro Befund zu groß wird.
