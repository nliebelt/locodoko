#!/usr/bin/env node
// Zerlegt ein (Playwright-)Video in PNG-Einzelframes, die der Agent visuell sichten kann.
//
// Hintergrund: Der Vision-Loop nimmt einen Spielablauf als .webm (VP8) auf. Der Agent
// kann Videos nicht direkt lesen — nur Standbilder. Dieses Skript schneidet das Video
// mit einer festen Bildrate in nummerierte PNGs, sodass der Agent flüchtige Animationen,
// Tween-Übergänge und Flash-Texte Bild für Bild prüfen kann.
//
// ffmpeg-Quelle: Playwright bringt einen passend kompilierten ffmpeg mit
// (matroska/webm-Demux + libvpx_vp8-Decode + png-Encode) — kein System-ffmpeg nötig.
//
// Aufruf:
//   node extrahiere-video-frames.mjs --video <pfad.webm> [--out <dir>] [--fps 4] [--max 60]
//
// Defaults: --out test-results/frames/<videoname>/, --fps 4, --max 0 (= alle).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

function parseArgs(argv) {
  const args = { fps: 4, max: 0, out: null, video: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--video') args.video = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--fps') args.fps = Number(argv[++i]);
    else if (a === '--max') args.max = Number(argv[++i]);
    else if (!args.video) args.video = a; // erstes positionales Argument = Video
  }
  return args;
}

// Findet einen ffmpeg-Binary: zuerst den von Playwright gebündelten (~/.cache/ms-playwright/
// ffmpeg-*/ffmpeg-linux|mac|win.exe), dann System-ffmpeg im PATH.
function findeFfmpeg() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const eintrag of readdirSync(cache)) {
      if (!eintrag.startsWith('ffmpeg-')) continue;
      const dir = join(cache, eintrag);
      for (const bin of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe', 'ffmpeg']) {
        const p = join(dir, bin);
        if (existsSync(p)) return p;
      }
    }
  }
  // Fallback: System-ffmpeg
  try {
    const p = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim();
    if (p) return p;
  } catch { /* nicht im PATH */ }
  throw new Error('Kein ffmpeg gefunden (weder Playwright-Bundle noch System). ' +
    'Playwright-Browser installieren (npm run install:browsers) oder ffmpeg ins PATH legen.');
}

const args = parseArgs(process.argv.slice(2));
if (!args.video) {
  console.error('Fehler: --video <pfad.webm> ist erforderlich.');
  console.error('Aufruf: node extrahiere-video-frames.mjs --video <pfad.webm> [--out <dir>] [--fps 4] [--max 60]');
  process.exit(1);
}
const videoPfad = resolve(args.video);
if (!existsSync(videoPfad)) {
  console.error(`Fehler: Video nicht gefunden: ${videoPfad}`);
  process.exit(1);
}

const ffmpeg = findeFfmpeg();
const name = basename(videoPfad).replace(/\.[^.]+$/, '');
const outDir = resolve(args.out || join('test-results', 'frames', name));

// Output-Verzeichnis frisch anlegen (alte Frames entfernen, sonst mischen sich Läufe).
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const ffmpegArgs = ['-y', '-i', videoPfad, '-r', String(args.fps)];
if (args.max > 0) ffmpegArgs.push('-frames:v', String(args.max));
ffmpegArgs.push(join(outDir, 'frame_%04d.png'));

console.log(`ffmpeg:  ${ffmpeg}`);
console.log(`Video:   ${videoPfad}`);
console.log(`Output:  ${outDir}`);
console.log(`Bildrate: ${args.fps} fps${args.max > 0 ? `, max ${args.max} Frames` : ''}`);

try {
  execFileSync(ffmpeg, ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (e) {
  console.error('ffmpeg-Extraktion fehlgeschlagen:');
  console.error(e.stderr ? e.stderr.toString().split('\n').slice(-8).join('\n') : e.message);
  process.exit(1);
}

const frames = readdirSync(outDir).filter(f => f.endsWith('.png')).sort();
const gesamtBytes = frames.reduce((s, f) => s + statSync(join(outDir, f)).size, 0);
console.log(`\n✓ ${frames.length} Frames extrahiert (${(gesamtBytes / 1024).toFixed(0)} KB gesamt).`);
console.log(`  Erster: ${join(outDir, frames[0] ?? '—')}`);
console.log(`  Letzter: ${join(outDir, frames.at(-1) ?? '—')}`);
console.log(`\nFrames mit dem Read-Tool sichten — z. B. jeden 4. zur Übersicht, dann dichter um auffällige Stellen.`);
