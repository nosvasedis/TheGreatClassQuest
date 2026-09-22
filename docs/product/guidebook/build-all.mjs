import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(DIR, file)], {
      stdio: 'inherit',
      cwd: path.resolve(DIR, '../../..')
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with ${code}`));
    });
  });
}

await run('capture-ui.mjs');
await run('build.mjs');
await run('print-pdf.mjs');
