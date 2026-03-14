/**
 * Writes config.json from environment variables (for Netlify / per-school deployments).
 * Set these in Netlify: GCQ_FIREBASE_API_KEY, GCQ_FIREBASE_AUTH_DOMAIN, GCQ_FIREBASE_PROJECT_ID,
 * GCQ_FIREBASE_STORAGE_BUCKET, GCQ_FIREBASE_MESSAGING_SENDER_ID, GCQ_FIREBASE_APP_ID, GCQ_FIREBASE_MEASUREMENT_ID
 * If any are missing, config.json is not written and the app uses the default in constants.js.
 */

const fs = require('fs');
const path = require('path');

const env = process.env;
const firebaseConfig = {
  apiKey: env.GCQ_FIREBASE_API_KEY,
  authDomain: env.GCQ_FIREBASE_AUTH_DOMAIN,
  projectId: env.GCQ_FIREBASE_PROJECT_ID,
  storageBucket: env.GCQ_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.GCQ_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.GCQ_FIREBASE_APP_ID,
  measurementId: env.GCQ_FIREBASE_MEASUREMENT_ID || null
};

const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = required.filter((k) => !firebaseConfig[k]);
if (missing.length) {
  console.log('write-config: skipping (missing env: ' + missing.join(', ') + ')');
  process.exit(0);
}

const config = {
  firebaseConfig,
  billingBaseUrl: env.GCQ_BILLING_BASE_URL || '',
  billingSchoolId: env.GCQ_BILLING_SCHOOL_ID || firebaseConfig.projectId || ''
};
const outPath = path.join(process.cwd(), 'config.json');
fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf8');
console.log('write-config: wrote config.json for project', firebaseConfig.projectId);
