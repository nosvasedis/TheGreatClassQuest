const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, '.vite', 'manifest.json'), 'utf8'));
const visited = new Set();
const initialFiles = new Set();

function collect(key) {
  if (!key || visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) return;
  if (entry.file && /\.(?:js|css)$/.test(entry.file)) initialFiles.add(entry.file);
  for (const css of entry.css || []) initialFiles.add(css);
  for (const imported of entry.imports || []) collect(imported);
}

collect('index.html');

const rows = [...initialFiles].map((file) => {
  const bytes = fs.readFileSync(path.join(dist, file));
  return { file, gzip: zlib.gzipSync(bytes, { level: 9 }).length };
});
const compressedBytes = rows.reduce((sum, row) => sum + row.gzip, 0);
const requestCount = rows.length + 3; // HTML, manifest, and runtime configuration.
const kib = (value) => (value / 1024).toFixed(1);

console.log(`bundle-budget: ${requestCount} initial requests; ${kib(compressedBytes)} KiB compressed JS/CSS`);
for (const row of rows.sort((a, b) => b.gzip - a.gzip)) {
  console.log(`  ${kib(row.gzip)} KiB  ${row.file}`);
}

if (requestCount > 30 || compressedBytes > 450 * 1024) {
  console.error('bundle-budget: FAILED (maximum 30 requests and 450 KiB compressed JS/CSS)');
  process.exit(1);
}
