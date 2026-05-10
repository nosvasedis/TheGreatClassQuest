#!/usr/bin/env node
/**
 * Single source of truth: root package.json "version".
 *
 *   npm run sync-version              — propagate that version everywhere
 *   node scripts/sync-app-version.js 0.2.0 — set root version, then propagate
 *
 * Then: refresh lockfiles under ., billing/, functions/
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

function readRootPkg() {
  const p = path.join(repoRoot, 'package.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeRootPkg(j) {
  const p = path.join(repoRoot, 'package.json');
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
}

function setNestedPackageVersion(rel, version) {
  const p = path.join(repoRoot, rel);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = version;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
}

function patchFile(rel, mutate) {
  const p = path.join(repoRoot, rel);
  const prev = fs.readFileSync(p, 'utf8');
  const next = mutate(prev);
  if (prev !== next) fs.writeFileSync(p, next, 'utf8');
}

function npmLockOnly(cwdRelative) {
  const cwd = path.join(repoRoot, cwdRelative);
  const r = spawnSync('npm', ['install', '--package-lock-only'], {
    cwd,
    stdio: 'inherit',
    shell: true
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function usage() {
  console.log(`
Usage:
  npm run sync-version
  node scripts/sync-app-version.js [<semver>]

  With no argument, reads version from ./package.json and updates dependents.
  With a semver argument, writes ./package.json first, then syncs.

  Examples:
  node scripts/sync-app-version.js 0.2.0
`);
}

function main() {
  const arg = process.argv[2];
  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  }

  let version;
  if (arg) {
    if (!SEMVER_RE.test(arg)) {
      console.error(`sync-app-version: invalid semver (${arg}). Use e.g. 0.2.0 or 1.0.0-rc.1`);
      process.exit(1);
    }
    const root = readRootPkg();
    root.version = arg;
    writeRootPkg(root);
    version = arg;
  } else {
    version = readRootPkg().version;
    if (!SEMVER_RE.test(version)) {
      console.error(`sync-app-version: invalid version in package.json: ${version}`);
      process.exit(1);
    }
  }

  console.log(`sync-app-version: applying ${version}`);

  patchFile('constants.js', s =>
    s.replace(/export const APP_VERSION = '[^']*'/, `export const APP_VERSION = '${version}'`)
  );

  patchFile(path.join('ui', 'tabs', 'navigation.js'), s =>
    s.replace(
      /(constants && constants\.APP_VERSION\) \|\| ')[^']+(')/,
      `$1${version}$2`
    )
  );

  patchFile('manifest.json', s =>
    s.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}"`)
  );

  patchFile(path.join('assets', 'favicon', 'site.webmanifest'), s =>
    s.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}"`)
  );

  patchFile('index.html', s =>
    s.replace(
      /(<meta name="application-version" content=")[^"]*(")/,
      `$1${version}$2`
    )
  );

  patchFile('service-worker.js', s =>
    s
      .replace(/const CACHE_NAME = 'gcq-static-v[^']+'/, `const CACHE_NAME = 'gcq-static-v${version}'`)
      .replace(/const CDN_CACHE = 'gcq-cdn-v[^']+'/, `const CDN_CACHE = 'gcq-cdn-v${version}'`)
  );

  setNestedPackageVersion('billing/package.json', version);
  setNestedPackageVersion('functions/package.json', version);

  for (const dir of ['.', 'billing', 'functions']) npmLockOnly(dir);

  console.log('sync-app-version: done');
}

main();
