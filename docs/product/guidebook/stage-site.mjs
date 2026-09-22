import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GUIDEBOOK = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(GUIDEBOOK, '../../..');
const OUT = path.join(ROOT, '.guidebook-dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const file of ['index.html', 'print.html', 'guidebook.css', 'guidebook.js', 'print.css']) {
  fs.copyFileSync(path.join(GUIDEBOOK, file), path.join(OUT, file));
}

fs.cpSync(path.join(GUIDEBOOK, 'media'), path.join(OUT, 'media'), { recursive: true });

console.log(`Staged guidebook site at ${OUT}`);
