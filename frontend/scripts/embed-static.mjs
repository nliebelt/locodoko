import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aktuellesVerzeichnis = dirname(fileURLToPath(import.meta.url));
const frontendWurzel = resolve(aktuellesVerzeichnis, '..');
const quellVerzeichnis = resolve(frontendWurzel, 'dist');
const zielVerzeichnis = resolve(frontendWurzel, '../src/main/resources/static/app');

await mkdir(zielVerzeichnis, { recursive: true });

for (const eintrag of await readdir(zielVerzeichnis)) {
  await rm(resolve(zielVerzeichnis, eintrag), { recursive: true, force: true });
}

await cp(quellVerzeichnis, zielVerzeichnis, { recursive: true });
console.log(`Frontend nach ${zielVerzeichnis} eingebettet.`);
