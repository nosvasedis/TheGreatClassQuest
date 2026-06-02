#!/usr/bin/env node
/**
 * Interactive wizard: add a new school to billing and get copy-paste instructions.
 * Run from repo root:  node scripts/billing-wizard.js
 * Or:  npm run setup-school
 *
 * You need: Firebase project ID, and the service account JSON file (from Firebase Console).
 * The script adds the school, sets "pending" in Firestore (paywall), and creates
 * NEXT_STEPS.txt with exactly what to paste into Render and Netlify.
 */

import { createInterface } from 'readline';
import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const billingDir = join(repoRoot, 'billing');

function ask(rl, question, defaultAnswer = '') {
  const prompt = defaultAnswer ? `${question} [${defaultAnswer}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve((answer || defaultAnswer).trim()));
  });
}

function runOnboard(projectId, keyPath, pending) {
  return new Promise((resolve, reject) => {
    const args = ['billing/scripts/onboard-new-school.js', '--project-id', projectId, '--key', keyPath];
    if (pending) args.push('--pending');
    const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Script exited with ${code}`))));
    child.on('error', reject);
  });
}

function loadLocalPriceIds() {
  const path = join(billingDir, 'price-ids.local.json');
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return {
      starter: data.starter || '',
      pro: data.pro || '',
      elite: data.elite || ''
    };
  } catch (_) {
    return null;
  }
}

function updatePriceIdsAndRefreshRenderPaste(priceStarter, pricePro, priceElite) {
  const schoolsPath = join(billingDir, 'schools.json');
  const localPath = join(billingDir, 'schools.local.json');
  const path = existsSync(localPath) ? localPath : schoolsPath;
  if (!existsSync(path)) return;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!data.priceIds) data.priceIds = {};
  if (priceStarter) data.priceIds.starter = priceStarter;
  if (pricePro) data.priceIds.pro = pricePro;
  if (priceElite) data.priceIds.elite = priceElite;
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  const out = execSync('node billing/scripts/build-schools-json-for-render.js', { cwd: repoRoot, encoding: 'utf8' });
  writeFileSync(join(billingDir, 'render-paste.txt'), out.trim(), 'utf8');
}

function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const localPrices = loadLocalPriceIds();

  console.log('\n  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║   GCQ Billing – Add a new school (paywall until they pay)  ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝\n');
  console.log('  You will need:');
  console.log('    • Firebase project ID for this school');
  console.log('    • The service account JSON file (from Firebase Console)\n');

  Promise.resolve()
    .then(() => ask(rl, '  1. Firebase project ID (e.g. gcq-school-mytown)', ''))
    .then((projectId) => {
      if (!projectId) throw new Error('Project ID is required.');
      return ask(rl, '  2. Path to service account JSON file (e.g. ./Downloads/my-school-xxx.json)', '').then((keyPath) => ({ projectId, keyPath }));
    })
    .then(({ projectId, keyPath }) => {
      if (!keyPath) throw new Error('Key file path is required.');
      const resolved = join(process.cwd(), keyPath.replace(/^\.\//, ''));
      if (!existsSync(resolved)) throw new Error('File not found: ' + resolved);
      return ask(rl, '  3. Your Render billing URL (e.g. https://gcq-billing.onrender.com)', '').then((renderUrl) => ({ projectId, keyPath, renderUrl }));
    })
    .then(({ projectId, keyPath, renderUrl }) => {
      return ask(rl, '  4. Show paywall until they pay? (Y/n)', 'Y').then((yn) => ({
        projectId,
        keyPath,
        renderUrl: renderUrl.replace(/\/$/, ''),
        pending: yn.toLowerCase() !== 'n' && yn.toLowerCase() !== 'no'
      }));
    })
    .then(({ projectId, keyPath, renderUrl, pending }) => {
      if (localPrices && (localPrices.starter || localPrices.pro || localPrices.elite)) {
        console.log('\n  ✓ Using Stripe Price IDs from billing/price-ids.local.json\n');
        return {
          projectId, keyPath, renderUrl, pending,
          priceStarter: localPrices.starter, pricePro: localPrices.pro, priceElite: localPrices.elite
        };
      }
      console.log('\n  (No billing/price-ids.local.json found. Copy price-ids.example.json to price-ids.local.json and add your Stripe Price IDs to skip these questions next time.)\n');
      return ask(rl, '  5a. Stripe Price ID for Starter (or Enter to skip)', '').then((p1) =>
        ask(rl, '  5b. Stripe Price ID for Pro (or Enter to skip)', '').then((p2) =>
          ask(rl, '  5c. Stripe Price ID for Elite (or Enter to skip)', '').then((p3) => ({
            projectId, keyPath, renderUrl, pending,
            priceStarter: p1, pricePro: p2, priceElite: p3
          }))
        )
      );
    })
    .then(({ projectId, keyPath, renderUrl, pending, priceStarter, pricePro, priceElite }) => {
      rl.close();
      console.log('\n  Running setup...\n');
      return runOnboard(projectId, keyPath, pending).then(() => {
        if (priceStarter || pricePro || priceElite) {
          try {
            updatePriceIdsAndRefreshRenderPaste(priceStarter, pricePro, priceElite);
            console.log('  ✓ Price IDs updated; render-paste.txt refreshed.\n');
          } catch (e) {
            console.warn('  Could not update price IDs:', e.message);
          }
        }
        return { projectId, renderUrl };
      });
    })
    .then(({ projectId, renderUrl }) => {
      const nextSteps = `
╔══════════════════════════════════════════════════════════════════════════════╗
║  NEXT STEPS – do these 2 things (then you're done for this school)          ║
╚══════════════════════════════════════════════════════════════════════════════╝

  STEP 1 – RENDER
  ───────────────
  • Open: https://dashboard.render.com
  • Go to your billing service → Environment
  • Find (or add) variable: BILLING_SCHOOLS_JSON
  • Set its value to the ENTIRE contents of this file:
      billing/render-paste.txt
    (Open that file, copy all, paste into the value box.)
  • Click Save → then trigger a new Deploy

  STEP 2 – NETLIFY
  ────────────────
  • Open: https://app.netlify.com
  • Select the site for this school → Site configuration → Environment variables
  • Add these two variables:

      Key:   GCQ_BILLING_BASE_URL
      Value: ${renderUrl || 'https://YOUR-RENDER-URL.onrender.com'}

      Key:   GCQ_BILLING_SCHOOL_ID
      Value: ${projectId}

  • Save → Deploys → Trigger deploy → Deploy site

  DONE
  ────
  When someone opens this school's app and signs in, they'll see "Choose a plan".
  After they pay on Stripe, they refresh and can use the app.
`;
      const nextStepsPath = join(billingDir, 'NEXT_STEPS.txt');
      writeFileSync(nextStepsPath, nextSteps.trimStart(), 'utf8');
      console.log('\n  ═══════════════════════════════════════════════════════════');
      console.log('  DONE');
      console.log('  ═══════════════════════════════════════════════════════════\n');
      console.log('  Open this file and follow the 2 steps:\n');
      console.log('      billing/NEXT_STEPS.txt\n');
      console.log('  In short: paste render-paste.txt into Render, add 2 vars in Netlify, deploy both.\n');
    })
    .catch((err) => {
      rl.close();
      console.error('\nError:', err.message || err);
      process.exit(1);
    });
}

main();
