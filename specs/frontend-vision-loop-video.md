# Video-basierter Vision-Loop

> Status: **Verifiziert** — Session 118 (Infrastruktur) + Session 119 (2026-06-13, erster Echtlauf). Vollständige Runde aufgenommen (1.2 Minuten, 288 Frames @ 4fps), Flash-Texte sichtbar (Gesund, RE-Ansage, FUCHS, RE gewinnt!), Rundenende-Modal sauber.

## Motivation

Der Screenshot-Vision-Loop (`vision-loop.spec.ts`, `frontend-vision-loop.md`) friert den Spielablauf an diskreten, vorab definierten Zuständen ein. Alles *dazwischen* — Tween-Übergänge, Flash-Texte, Modal-Animationen — entgeht ihm. Genau dort lagen reale Bugs (`BUG-FE-MODAL-TWEEN-CLEANUP`; die „best-effort" Flash-Texte F-04…F-09, die so flüchtig sind, dass der Screenshot-Loop sie nur mit Timing-Tricks trifft).

Der video-basierte Loop nimmt den Ablauf **durchgehend** auf und sampelt ihn hinterher beliebig fein — kein Timing-Raten mehr.

## Kernidee & technische Kette

Der Agent kann Videos nicht direkt lesen, nur Standbilder. Deshalb:

1. **Aufnahme:** Playwright zeichnet den Playthrough als `.webm` (VP8) auf (`playwright.config.video.ts` → `video: 'on'`). Der Test (`vision-video.spec.ts`) spielt mit 3× Animationsgeschwindigkeit + reduziertem KI-Delay (400ms statt 800ms). Animationen sind bei 4fps noch sichtbar; eine Runde dauert typ. ~70–90s (288 Frames @ 4fps = 72s im ersten Echtlauf).
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

## Befunde aus dem Echtlauf (Session 119, 2026-06-13)

**Lauf:** 1.2 Minuten, 13 Zustands-Iterationen, 288 Frames @ 4fps. Spiel: Hochzeit (NORD), RE gewinnt mit +4 Punkten; Fuchs gefangen (Sonderpunkt).

**Flash-Texte sichtbar:**
- Frame ~0020: „Gesund"-Banner (Vorbehalt-Phase) — ✅ erfasst
- Frame ~0032: RE-Ansage-Text oben rechts — ✅ erfasst
- Frame ~0260: „FUCHS"-Flash in Magenta (Fuchs-gefangen-Sonderpunkt) — ✅ erfasst
- Frame ~0272: „RE gewinnt! +4 Punkte" (SpielBeendet) — ✅ erfasst

**Karten-Animationen:** Flüssig, keine sichtbaren Tween-Ruckler oder Glitches.

**Rundenende-Modal:** Erscheint sauber ab Frame ~0276 mit korrektem Titel „Hochzeit 1 Spiel 1/24" und Weiter-Button. CountUp-Animation bei 3× Geschwindigkeit + 4fps zu schnell für Frame-genaue Sichtung (aber kein Bug).

**Praxis-Hinweis Backend:** Das Backend muss **frisch gestartet** werden (bestehende Spring-Boot-Prozesse beenden: `kill $(lsof -ti :8081)`). Ein alter Backend-Prozess mit veralteten Klassen aus `target/` kann Schnellstart-Aufrufe mit `DataIntegrityViolationException` (CHECK-Constraint) fehlschlagen lassen — kein echter Bug im Code, sondern inkrementeller Build-Artefakt.

**Mehrwert vs. Screenshot-Loop:** Der Video-Loop liefert echten Zusatzwert: FUCHS-Flash und RE-gewinnt!-Text sind flüchtig genug (< 0.5s), dass der Screenshot-Loop sie regelmäßig verpasst. Empfehlung: Video-Loop bei verdächtigen Animations-Bugs einsetzen, Screenshot-Loop für reguläre Layout-Checks.

## Offen / nächste Schritte

- Optional: gezielte Kurz-Videos pro Szenario (Vorbehalt, Stich-Einzug, Rundenende-Modal) statt einer langen Gesamtaufnahme, falls das Kontext-Budget pro Befund zu groß wird.
