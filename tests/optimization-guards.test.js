const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('characterization baseline was captured before optimization', () => {
  const contract = JSON.parse(read('tests/fixtures/baseline-contract.json'));
  assert.equal(contract.capturedBeforeOptimization, true);
  assert.equal(contract.existingTests, 54);
  assert.match(contract.baselineCommit, /^[a-f0-9]{12}$/);
});

test('login and listener hydration contain no automatic maintenance writes', () => {
  const app = read('app.js');
  const listeners = read('db/listeners.js');
  for (const forbidden of ['touchCurrentUserProfile(', 'archivePreviousDayStars(', 'repairStudentGender', 'migrateGuildGloryIfNeeded(', 'markTeacherOnboardingComplete(', 'claimFoundingSchoolAdmin(']) {
    assert.equal(app.includes(forbidden), false, `${forbidden} must not run from login`);
    assert.equal(listeners.includes(forbidden), false, `${forbidden} must not run from snapshot hydration`);
  }
  assert.match(listeners, /registerFeatureListener\("assessments"/);
  assert.match(listeners, /registerFeatureListener\("attendance"/);
  assert.match(listeners, /registerFeatureListener\("guilds"/);
  assert.match(listeners, /export function deactivateDataFeature/);
  assert.match(read('ui/tabs/navigation.js'), /deactivateDataFeature\('guilds'\)/);
});

test('normal startup is fail-closed and server-filtered to the active year', () => {
  const listeners = read('db/listeners.js');
  const schoolYear = read('utils/schoolYear.js');
  assert.match(listeners, /where\("activeSchoolYearKey", "==", activeYearKey\)/);
  assert.match(listeners, /where\("schoolYearKey", "==", activeYearKey\)/);
  assert.doesNotMatch(listeners, /collection\(db, `\$\{publicDataPath\}\/school_years`\)/);
  assert.match(schoolYear, /activeYearKey: null/);
  assert.match(schoolYear, /Data is read-only until the school-year configuration reconnects/);
});

test('historical monthly reads include an explicit school-year constraint', () => {
  const state = read('state.js');
  assert.match(state, /where\("schoolYearKey", "==", activeYearKey\)/);
  assert.match(state, /where\("month", "==", monthKey\)/);
  assert.doesNotMatch(state, /offset\s*\(/);
});

test('all application Firebase calls go through the shared adapters', () => {
  const allowed = new Set(['firebase.js', 'firebaseAuth.js', 'firebaseAppCheck.js']);
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git', 'scratch'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.name.endsWith('.js')) files.push(absolute);
    }
  };
  walk(root);
  const offenders = files
    .filter((file) => !allowed.has(path.basename(file)))
    .filter((file) => /firebase\/(?:firestore|auth|storage|functions|app-check)/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(root, file));
  assert.deepEqual(offenders, []);
});

test('service worker uses revisioned caches and safe request strategies', () => {
  const worker = read('service-worker.js');
  assert.match(worker, /gcq-static-\$\{BUILD_ID\}/);
  assert.doesNotMatch(worker, /v0\.1\.0/);
  assert.match(worker, /request\.mode === 'navigate'[\s\S]*networkFirst/);
  assert.match(worker, /config\.json'[\s\S]*networkFirst/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /SKIP_WAITING/);
});

test('service-worker update control mounts in the header without covering app actions', () => {
  const bootstrap = read('bootstrap.js');
  const header = read('templates/app/header.js');
  const navStyles = read('styles/nav.css');
  assert.match(header, /id="gcq-update-ready-mount"/);
  assert.match(bootstrap, /getElementById\('gcq-update-ready-mount'\)/);
  assert.match(bootstrap, /gcq-update-ready-button/);
  assert.match(bootstrap, /watchForServiceWorkerUpdates/);
  assert.match(bootstrap, /registration\.update\(\)/);
  assert.match(bootstrap, /visibilitychange/);
  assert.doesNotMatch(bootstrap, /fixed bottom-4 right-4/);
  assert.match(navStyles, /@keyframes gcqUpdateGlow/);
  assert.match(navStyles, /prefers-reduced-motion: reduce/);
});

test('authenticated home readiness cannot fail on optional decoration or browser storage', () => {
  const app = read('app.js');
  const home = read('features/home.js');
  assert.match(app, /hasAttribute\('data-gcq-home-ready'\)/);
  assert.match(app, /removeAttribute\('data-gcq-home-ready'\)/);
  assert.doesNotMatch(app, /Home decoration exceeded the readiness window/);
  assert.doesNotMatch(app, /showInitializationRecovery\(new Error\('Home readiness timed out'\)\)/);
  assert.match(home, /keeping the usable dashboard shell/);
  assert.match(home, /announceHomeRendered\(\{ degraded: true \}\)/);
  assert.match(home, /setAttribute\('data-gcq-home-ready', 'true'\)/);
  assert.match(home, /The coherent dashboard is now visible/);
  assert.match(home, /Storage may be unavailable in hardened\/private browser profiles/);
});

test('device cache choice clearly recommends teacher-only school devices', () => {
  const app = read('app.js');
  const deviceCache = read('utils/deviceCache.js');
  assert.match(deviceCache, /Keep this teacher device fast\?/);
  assert.match(deviceCache, /Yes — teacher device/);
  assert.match(deviceCache, /students, parents, guests, or unrelated accounts/);
  assert.match(deviceCache, /not login, permissions, school-year data, or app features/);
  assert.doesNotMatch(app, /stageLoadingPersonalization\([\s\S]{0,160}offerDeviceCacheChoice\(\)/);
  assert.match(app, /await routeAuthenticatedParent\([\s\S]{0,160}offerDeviceCacheChoice\(\)/);
  assert.match(app, /await routeAuthenticatedTeacher\([\s\S]{0,300}offerDeviceCacheChoice\(\)/);
});

test('authorization rules deny missing profiles and archived-year mutations', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /function hasActiveProfile\(\)/);
  assert.match(rules, /currentProfile\(\)\.status == 'active'/);
  assert.match(rules, /data\.status in \['archived', 'closed'\]/);
  assert.match(rules, /allow read: if hasActiveProfile\(\).*request\.auth\.uid == userId/);
  assert.match(rules, /\(isTeacher\(\) && \(/);
});

test('billing and generation requests require verified identities and idempotency', () => {
  const billing = read('billing/server.js');
  const api = read('api.js');
  assert.match(billing, /verifyIdToken/);
  assert.match(billing, /stripe\.webhooks\.constructEvent/);
  assert.match(billing, /billing_webhook_events/);
  assert.match(billing, /idempotencyKey/);
  assert.match(api, /Authorization: `Bearer \$\{token\}`/);
  assert.match(api, /X-GCQ-Request-ID/);
  assert.match(api, /getIdToken\(forceRefresh\)/);
  assert.match(api, /error\?\.errorSource !== 'firebase-token'/);
  assert.match(api, /normalizedError\?\.retryable === false/);
  const functionsSource = read('functions/index.js');
  assert.match(functionsSource, /SECRETARY_ROLE_DOC/);
  assert.match(functionsSource, /roleSnap\.data\(\)\?\.uid !== caller\.uid/);
  assert.doesNotMatch(functionsSource, /profile\.schoolAdmin\s*===\s*true/);
});

test('live sources contain no obsolete school-year fallback', () => {
  const targets = ['constants.js', 'functions/index.js', 'utils/schoolYear.js', 'scripts/backfill-school-year-data.cjs'];
  for (const file of targets) {
    const source = read(file);
    assert.doesNotMatch(source, /2025-2026|2026-2027|2027-2028|2025-11-01|2026-06-30/, file);
  }
});

test('a confirmed year close seeds the following planned year without overwriting it', () => {
  const functions = read('functions/index.js');
  assert.match(functions, /function getFollowingSchoolYearKey\(yearKey\)/);
  assert.match(functions, /Number\(match\[2\]\) !== Number\(match\[1\]\) \+ 1/);
  assert.match(functions, /async function ensurePlannedSchoolYearRecord\(yearKey\)[\s\S]*if \(yearSnap\.exists\) return \{ created: false \};/);
  assert.match(functions, /await yearRef\.create\(\{[\s\S]*status: 'planned'/);
  assert.match(functions, /const followingYearKey = getFollowingSchoolYearKey\(nextYearKey\);/);
  assert.match(functions, /await ensurePlannedSchoolYearRecord\(followingYearKey\);/);
  assert.match(functions, /activeYearKey: nextYearKey,[\s\S]*nextYearKey: followingYearKey/);
  assert.doesNotMatch(functions, /onSchedule|functions\.pubsub\.schedule|scheduler\.onSchedule/);
});
