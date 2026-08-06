/**
 * Writes config.json from environment variables for hosted school deployments.
 * Supported hosts include Netlify, GitHub Pages, and Cloudflare Pages.
 * If required values are missing, local builds may use the development fallback.
 * Hosted CI sets GCQ_REQUIRE_CONFIG=1 so a deploy can never silently target the wrong project.
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
  const message = 'write-config: missing env: ' + missing.join(', ');
  if (env.GCQ_REQUIRE_CONFIG === '1') {
    console.error(message);
    process.exit(1);
  }
  console.log(message + ' (local build will use the development fallback)');
  process.exit(0);
}

const config = {
  firebaseConfig,
  billingBaseUrl: env.GCQ_BILLING_BASE_URL || '',
  billingSchoolId: env.GCQ_BILLING_SCHOOL_ID || firebaseConfig.projectId || '',
  functionsRegion: env.GCQ_FIREBASE_FUNCTIONS_REGION || 'europe-west1',
  appCheckSiteKey: env.GCQ_APP_CHECK_SITE_KEY || '',
  certificateImageProxyUrl: env.GCQ_CERTIFICATE_IMAGE_PROXY_URL || '',
  aiTextConfig: {
    providers: [
      {
        id: 'gcq-primary',
        label: 'GCQ Primary Proxy',
        url: env.GCQ_AI_PRIMARY_URL || '',
        model: env.GCQ_AI_PRIMARY_MODEL || '',
        payloadMode: 'openrouter'
      },
      {
        id: 'gcq-backup',
        label: 'GCQ Backup Proxy',
        url: env.GCQ_AI_BACKUP_URL || '',
        model: env.GCQ_AI_BACKUP_MODEL || '',
        payloadMode: 'openrouter'
      }
    ].filter((provider) => provider.url)
  }
};
const outPath = path.resolve(process.cwd(), env.GCQ_CONFIG_OUTPUT_PATH || 'config.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf8');
console.log('write-config: wrote config.json for project', firebaseConfig.projectId, 'at', outPath);
