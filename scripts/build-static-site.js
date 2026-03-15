#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

const deployEntries = [
  'index.html',
  'bootstrap.js',
  'app.js',
  'api.js',
  'audio.js',
  'constants.js',
  'firebase.js',
  'state.js',
  'utils.js',
  'style.css',
  'assets',
  'config',
  'db',
  'features',
  'styles',
  'templates',
  'ui',
  'utils',
];

function copyEntry(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const destination = path.join(distDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing deploy entry: ${relativePath}`);
  }
  fs.cpSync(source, destination, { recursive: true });
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of deployEntries) {
  copyEntry(entry);
}

fs.writeFileSync(path.join(distDir, '.nojekyll'), '\n', 'utf8');

const configResult = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'write-config.js')], {
  cwd: repoRoot,
  env: {
    ...process.env,
    GCQ_CONFIG_OUTPUT_PATH: path.join('dist', 'config.json'),
  },
  stdio: 'inherit',
});

if (configResult.status !== 0) {
  process.exit(configResult.status || 1);
}

console.log('build-static-site: prepared dist for static hosting');
