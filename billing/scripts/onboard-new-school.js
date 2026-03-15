#!/usr/bin/env node
/**
 * One-command onboarding for a new school: add to config, set Starter in Firestore,
 * and prepare the value to paste into Render (BILLING_SCHOOLS_JSON).
 *
 * Run from repo root:
 *   node billing/scripts/onboard-new-school.js --project-id YOUR_FIREBASE_PROJECT_ID --key path/to/service-account.json
 *
 * You still do once by hand: create the Firebase project and download the service account key.
 * This script does the rest: updates schools.json, copies the key to billing/keys/,
 * writes appConfig/subscription (Starter) to that Firestore, and writes the Render
 * env value to billing/render-paste.txt so you can paste it in Render.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const billingDir = join(__dirname, '..');
const repoRoot = join(billingDir, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  let projectId = null;
  let keyPath = null;
  let pending = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-id' && args[i + 1]) {
      projectId = args[i + 1];
      i++;
    } else if (args[i] === '--key' && args[i + 1]) {
      keyPath = args[i + 1];
      i++;
    } else if (args[i] === '--pending') {
      pending = true;
    }
  }
  return { projectId, keyPath, pending };
}

function loadSchoolsConfig() {
  const schoolsLocal = join(billingDir, 'schools.local.json');
  const schoolsJson = join(billingDir, 'schools.json');
  const path = existsSync(schoolsLocal) ? schoolsLocal : schoolsJson;
  if (!existsSync(path)) {
    const example = join(billingDir, 'schools.example.json');
    if (!existsSync(example)) {
      console.error('No billing/schools.json or schools.example.json found.');
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(example, 'utf8'));
    writeFileSync(schoolsJson, JSON.stringify(raw, null, 2));
    console.log('Created billing/schools.json from example. Add your Stripe priceIds if not set.');
    return { path: schoolsJson, data: raw };
  }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return { path, data };
}

function buildRenderJson(schoolsPath) {
  const path = schoolsPath;
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const schools = (raw.schools || []).map((s) => {
    const out = { ...s };
    delete out.firebaseServiceAccountPath;
    if (s.firebaseServiceAccountPath) {
      const keyPath = s.firebaseServiceAccountPath.startsWith('.')
        ? join(billingDir, s.firebaseServiceAccountPath.replace(/^\.\//, ''))
        : s.firebaseServiceAccountPath;
      if (existsSync(keyPath)) {
        out.firebaseServiceAccountKey = JSON.parse(readFileSync(keyPath, 'utf8'));
      }
    }
    return out;
  });
  return JSON.stringify({ schools, priceIds: raw.priceIds || {} });
}

async function main() {
  const { projectId, keyPath, pending } = parseArgs();

  if (!projectId || !keyPath) {
    console.error('Usage: node billing/scripts/onboard-new-school.js --project-id <firebase-project-id> --key <path-to-service-account.json> [--pending]');
    console.error('  --pending  Write appConfig/subscription as Pending (paywall: they must pay via Stripe before using the app). Omit to grant Starter immediately.');
    console.error('Example: node billing/scripts/onboard-new-school.js --project-id my-school-prod --key ./Downloads/my-school-prod-firebase-adminsdk-xxx.json --pending');
    process.exit(1);
  }

  const keyPathResolved = join(process.cwd(), keyPath.replace(/^\.\//, ''));
  if (!existsSync(keyPathResolved)) {
    console.error('Key file not found:', keyPathResolved);
    process.exit(1);
  }

  const { path: schoolsPath, data: config } = loadSchoolsConfig();
  const schools = config.schools || [];

  if (schools.some((s) => s.schoolId === projectId || s.firebaseProjectId === projectId)) {
    console.error('School with project id', projectId, 'already exists in', schoolsPath);
    process.exit(1);
  }

  const keysDir = join(billingDir, 'keys');
  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true });
  }
  const keyFileName = `${projectId}.json`;
  const keyDest = join(keysDir, keyFileName);
  copyFileSync(keyPathResolved, keyDest);
  console.log('Copied key to', keyDest);

  const newSchool = {
    schoolId: projectId,
    stripeCustomerId: null,
    firebaseProjectId: projectId,
    firebaseServiceAccountPath: `./keys/${keyFileName}`,
  };
  schools.push(newSchool);
  config.schools = schools;
  writeFileSync(schoolsPath, JSON.stringify(config, null, 2));
  console.log('Added school to', schoolsPath);

  const key = JSON.parse(readFileSync(keyDest, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();
  const tierFile = pending ? 'pending.json' : 'starter.json';
  const tierPath = join(repoRoot, 'config', 'tiers', tierFile);
  if (!existsSync(tierPath)) {
    console.warn('config/tiers/' + tierFile + ' not found; skipping Firestore write.');
  } else {
    const preset = JSON.parse(readFileSync(tierPath, 'utf8'));
    await db.collection('appConfig').doc('subscription').set(preset);
    console.log('Written appConfig/subscription (' + (pending ? 'Pending' : 'Starter') + ') to Firestore for', projectId);
  }

  const renderJson = buildRenderJson(schoolsPath);
  const renderPastePath = join(billingDir, 'render-paste.txt');
  writeFileSync(renderPastePath, renderJson);
  console.log('Saved Render env value to', renderPastePath);

  console.log('\n--- Next steps ---');
  console.log('1. Open Render → your billing service → Environment.');
  console.log('2. Set BILLING_SCHOOLS_JSON to the contents of billing/render-paste.txt (one line).');
  console.log('3. Deploy your app (e.g. Netlify) with:');
  console.log('   BILLING_BASE_URL = your Render billing URL');
  console.log('   BILLING_SCHOOL_ID = ' + projectId);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
