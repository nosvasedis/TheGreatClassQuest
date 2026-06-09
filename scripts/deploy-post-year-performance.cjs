#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const projectId = process.env.FIREBASE_PROJECT || 'the-great-class-quest';
const firebaseBin = path.join(
  repoRoot,
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);

function runNodeScript(relativePath, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [path.join(repoRoot, relativePath)], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function runFirebase(args, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [firebaseBin, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function runNpmScript(scriptName, label) {
  console.log(`\n=== ${label} ===`);
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', scriptName], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

async function main() {
  runFirebase(
    ['deploy', '--only', 'firestore:indexes', '--project', projectId, '--non-interactive'],
    'Deploy Firestore indexes',
  );
  runNodeScript('scripts/wait-for-firestore-indexes.cjs', 'Wait for Firestore indexes');
  runFirebase(
    ['deploy', '--only', 'functions', '--project', projectId, '--non-interactive'],
    'Deploy Cloud Functions',
  );
  runNpmScript('build:static', 'Build static app into dist/');
  console.log('\nDeploy pipeline finished.');
  console.log('Firestore indexes and Cloud Functions are live on Firebase.');
  console.log('Static files are prepared in dist/. Publish dist/ through your normal host (Netlify/GitHub Pages).');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
