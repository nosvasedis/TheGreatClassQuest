#!/usr/bin/env node
/**
 * Reads billing/schools.json (or billing/schools.local.json) and prints one line
 * suitable for Render env var BILLING_SCHOOLS_JSON. Inlines service account keys
 * from file paths so you never paste minified JSON by hand.
 *
 * Run from repo root: node billing/scripts/build-schools-json-for-render.js
 * Then copy the output and paste into Render → Environment → BILLING_SCHOOLS_JSON
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const billingDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const schoolsLocal = join(billingDir, 'schools.local.json');
const schoolsJson = join(billingDir, 'schools.json');

const path = existsSync(schoolsLocal) ? schoolsLocal : schoolsJson;
if (!existsSync(path)) {
  console.error('No billing/schools.json or billing/schools.local.json found. Copy from schools.example.json and add your schools.');
  process.exit(1);
}

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

const result = { schools, priceIds: raw.priceIds || {} };
console.log(JSON.stringify(result));
