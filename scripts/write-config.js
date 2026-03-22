/**
 * Writes config.json from environment variables for hosted school deployments.
 * Supported hosts include Netlify, GitHub Pages, and Cloudflare Pages.
 * If required values are missing, config.json is not written and the app uses the default in constants.js.
 * Override the output path with GCQ_CONFIG_OUTPUT_PATH when a build should emit config.json somewhere else.
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
  billingSchoolId: env.GCQ_BILLING_SCHOOL_ID || firebaseConfig.projectId || '',
  functionsRegion: env.GCQ_FIREBASE_FUNCTIONS_REGION || 'europe-west1'
};
const outPath = path.resolve(process.cwd(), env.GCQ_CONFIG_OUTPUT_PATH || 'config.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf8');
console.log('write-config: wrote config.json for project', firebaseConfig.projectId, 'at', outPath);
