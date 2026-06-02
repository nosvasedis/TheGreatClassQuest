/**
 * One-time script: create or overwrite appConfig/subscription in Firestore.
 * Uses Firebase Admin SDK. Run from project root.
 *
 * 1. In Firebase Console: Project settings → Service accounts → Generate new private key.
 * 2. Save the JSON file somewhere safe (e.g. project folder). Add *.serviceAccount.json to .gitignore.
 * 3. Run: node scripts/set-subscription.js path/to/your-key.json [tier]
 *    Tier defaults to "elite". Options: starter | pro | elite
 *
 * Example: node scripts/set-subscription.js ./my-school-key.json elite
 */

const fs = require('fs');
const path = require('path');

const keyPath = process.argv[2];
const tier = (process.argv[3] || 'elite').toLowerCase();

if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('Usage: node scripts/set-subscription.js <path-to-service-account-key.json> [tier]');
  console.error('Tier: pending | starter | pro | elite (default: elite)');
  process.exit(1);
}

const presetPath = path.join(process.cwd(), 'config', 'tiers', `${tier}.json`);
if (!fs.existsSync(presetPath)) {
  console.error('Preset not found:', presetPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

async function main() {
  const admin = require('firebase-admin');
  const key = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), keyPath), 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();

  const ref = db.collection('appConfig').doc('subscription');
  await ref.set(data);

  console.log('Done. Written appConfig/subscription with', tier, 'preset to project', key.project_id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
