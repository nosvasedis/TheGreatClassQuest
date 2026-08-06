#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function buildId() {
  const configured = String(process.env.GITHUB_SHA || process.env.GCQ_BUILD_ID || '').trim();
  if (configured) return `${pkg.version}-${configured.slice(0, 12)}`;
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    return sha ? `${pkg.version}-${sha}` : `${pkg.version}-local`;
  } catch {
    return `${pkg.version}-local`;
  }
}

function copy(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(dist, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Missing static asset: ${relativePath}`);
  fs.cpSync(source, target, { recursive: true });
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  throw new Error('Vite output is missing dist/index.html');
}

copy('assets');
copy('manifest.json');
fs.writeFileSync(path.join(dist, '.nojekyll'), '\n', 'utf8');

// Vite treats the web-app manifest as a module asset and rewrites it into the
// assets directory. Its relative icon URLs would then resolve as
// /assets/assets/.... Point the final HTML at the root copy instead. The ./
// prefix is intentionally portable across a Pages root and a GitHub subpath.
const indexPath = path.join(dist, 'index.html');
const builtHtml = fs.readFileSync(indexPath, 'utf8');
const manifestLinkPattern = /(<link\s+rel=["']manifest["']\s+href=)["'][^"']+["']/i;
if (!manifestLinkPattern.test(builtHtml)) {
  throw new Error('Vite output is missing the web-app manifest link');
}
fs.writeFileSync(indexPath, builtHtml.replace(manifestLinkPattern, '$1"./manifest.json"'), 'utf8');

const configResult = spawnSync(process.execPath, [path.join(root, 'scripts', 'write-config.js')], {
  cwd: root,
  env: { ...process.env, GCQ_CONFIG_OUTPUT_PATH: path.join('dist', 'config.json') },
  stdio: 'inherit',
});
if (configResult.status !== 0) process.exit(configResult.status || 1);

const manifestPath = path.join(dist, '.vite', 'manifest.json');
const viteManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const precache = new Set(['./', './index.html', './manifest.json']);

function addEntry(key) {
  const entry = viteManifest[key];
  if (!entry) return;
  if (entry.file) precache.add(`./${entry.file}`);
  for (const css of entry.css || []) precache.add(`./${css}`);
  // Fonts and decorative images referenced by CSS stay cache-on-demand. Preloading
  // every format/variant would create an avoidable request burst on the login page.
  for (const imported of entry.imports || []) addEntry(imported);
}

addEntry('index.html');

const swTemplate = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const sw = swTemplate
  .replaceAll('__GCQ_BUILD_ID__', buildId())
  .replace('__GCQ_PRECACHE_MANIFEST__', JSON.stringify([...precache].sort(), null, 2));
fs.writeFileSync(path.join(dist, 'service-worker.js'), sw, 'utf8');

console.log(`finalize-vite-build: ${buildId()} with ${precache.size} critical precache entries`);
