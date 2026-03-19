const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const admin = require('firebase-admin');
const { JWT, GoogleAuth } = require('google-auth-library');

const repoRoot = path.resolve(__dirname, '..', '..');
const billingDir = path.join(repoRoot, 'billing');
const billingKeysDir = path.join(billingDir, 'keys');
const defaultsPath = path.join(repoRoot, 'tools', 'billing-config.local.json');
const schoolsLocalPath = path.join(billingDir, 'schools.local.json');
const schoolsJsonPath = path.join(billingDir, 'schools.json');
const schoolsExamplePath = path.join(billingDir, 'schools.example.json');
const renderPastePath = path.join(billingDir, 'render-paste.txt');
const priceIdsLocalPath = path.join(billingDir, 'price-ids.local.json');
const firestoreIndexesPath = path.join(repoRoot, 'firestore.indexes.json');
const firestoreRulesPath = path.join(repoRoot, 'firestore.rules');
const storageRulesPath = path.join(repoRoot, 'storage.rules');
const tierConfigDir = path.join(repoRoot, 'config', 'tiers');
const pendingTierPath = path.join(repoRoot, 'config', 'tiers', 'pending.json');
const SCHOOL_SETTINGS_DOC = 'artifacts/great-class-quest/public/data/school_settings/holidays';

const DEFAULT_DEFAULTS = {
  renderUrl: '',
  siteDomain: '',
  priceIds: {
    starter: '',
    pro: '',
    elite: '',
  },
  lastSchoolLabel: '',
  lastProjectId: '',
  firebaseLocation: 'europe-west1',
  readinessTarget: 'starter',
};

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/service.management',
];

let bootstrapAdminAuthPromise = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function loadJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return readJson(filePath);
}

function normalizePriceIds(priceIds = {}) {
  return {
    starter: String(priceIds.starter || '').trim(),
    pro: String(priceIds.pro || '').trim(),
    elite: String(priceIds.elite || '').trim(),
  };
}

function mergePriceIdsPreservingExisting(existingPriceIds = {}, incomingPriceIds = {}) {
  const existing = normalizePriceIds(existingPriceIds);
  const incoming = normalizePriceIds(incomingPriceIds);
  return {
    starter: incoming.starter || existing.starter || '',
    pro: incoming.pro || existing.pro || '',
    elite: incoming.elite || existing.elite || '',
  };
}

function validateProjectId(projectId) {
  const value = String(projectId || '').trim();
  if (!value) {
    return 'Please enter the Firebase project ID for this school.';
  }
  if (!/^[a-z0-9-]{4,40}$/.test(value)) {
    return 'The project ID should usually use lowercase letters, numbers, and hyphens only.';
  }
  return '';
}

function validateRenderUrl(renderUrl) {
  const value = String(renderUrl || '').trim();
  if (!value) {
    return 'Please enter your Render billing URL.';
  }
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) {
      return 'The Render billing URL should start with http:// or https://.';
    }
  } catch (error) {
    return 'That Render billing URL does not look valid yet.';
  }
  return '';
}

function normalizeSiteDomain(siteDomain) {
  const value = String(siteDomain || '').trim();
  if (!value) return '';
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    return parsed.hostname.toLowerCase();
  } catch (error) {
    return value.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }
}

function validateSiteDomain(siteDomain) {
  const normalized = normalizeSiteDomain(siteDomain);
  if (!normalized) {
    return 'Please enter the live school site domain for this host.';
  }
  if (normalized === 'localhost' || normalized === '127.0.0.1') {
    return '';
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return 'The school site domain should look like gcq-school.netlify.app, your-school.pages.dev, or your-user.github.io.';
  }
  return '';
}

function validatePriceIds(priceIds = {}) {
  const normalized = normalizePriceIds(priceIds);
  const errors = [];
  for (const [tier, value] of Object.entries(normalized)) {
    if (!value) {
      errors.push(`Please add the Stripe Price ID for ${capitalize(tier)}.`);
      continue;
    }
    if (!/^price_/i.test(value)) {
      errors.push(`${capitalize(tier)} should usually start with "price_".`);
    }
  }
  return errors;
}

function validateSchoolLabel(label) {
  const value = String(label || '').trim();
  if (!value) {
    return 'Please give this school a friendly name so you can recognise it later.';
  }
  return '';
}

function normalizeReadinessTarget(value) {
  return value === 'pro' || value === 'elite' ? 'pro' : 'starter';
}

function normalizeFirebaseLocation(value) {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_DEFAULTS.firebaseLocation;
}

function normalizeDateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('That date is not valid yet. Please use a real calendar date.');
  }
  return parsed.toISOString();
}

function extractProjectNumber(projectMetadata) {
  const candidates = [
    projectMetadata && projectMetadata.projectNumber,
    projectMetadata && projectMetadata.project_number,
    projectMetadata && projectMetadata.resources && projectMetadata.resources.projectNumber,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (/^\d+$/.test(value)) {
      return value;
    }
  }
  return '';
}

function buildServiceUsageConsumerName(projectMetadata) {
  const projectNumber = extractProjectNumber(projectMetadata);
  if (!projectNumber) {
    throw new Error('Google did not return a project number for this Firebase project yet.');
  }
  return `projects/${projectNumber}`;
}

async function getBootstrapAdminAuth() {
  if (!bootstrapAdminAuthPromise) {
    bootstrapAdminAuthPromise = (async () => {
      const auth = new GoogleAuth({
        scopes: OAUTH_SCOPES,
      });
      const client = await auth.getClient();
      return {
        kind: 'bootstrap_admin',
        auth,
        client,
      };
    })().catch((error) => {
      bootstrapAdminAuthPromise = null;
      throw error;
    });
  }
  return bootstrapAdminAuthPromise;
}

async function getOptionalBootstrapAdminAuth() {
  try {
    return await getBootstrapAdminAuth();
  } catch (error) {
    return null;
  }
}

async function inspectBootstrapAdminAuth() {
  try {
    const auth = await getBootstrapAdminAuth();
    const headers = await getAuthHeaders(auth, 'https://cloudresourcemanager.googleapis.com/');
    return {
      available: Boolean(headers.Authorization),
      source: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'credentials_file' : 'google_login',
      message: process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? 'Bootstrap admin access is ready from your local Google credentials file.'
        : 'Bootstrap admin access is ready from your Google login on this machine.',
      actionHint: '',
      technicalDetails: '',
    };
  } catch (error) {
    return {
      available: false,
      source: 'missing',
      message: 'Bootstrap admin access is not ready on this machine yet.',
      actionHint: 'Run `gcloud auth application-default login` with the Google account that manages this Firebase project, then restart the onboarding console.',
      technicalDetails: error.message || '',
    };
  }
}

function inspectGcloudCli() {
  const candidates = [
    'gcloud',
    path.join(process.env.HOME || '', 'google-cloud-sdk', 'bin', 'gcloud'),
  ].filter(Boolean);

  let resolvedPath = '';
  let result = null;
  for (const candidate of candidates) {
    result = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!result.error && result.status === 0) {
      resolvedPath = candidate;
      break;
    }
  }

  if (result.error || result.status !== 0) {
    return {
      installed: false,
      command: 'gcloud auth application-default login',
      message: 'Google Cloud CLI is not installed on this machine yet.',
      actionHint: 'Install Google Cloud CLI first, then use the one-click Google sign-in button here.',
      technicalDetails: result.error ? result.error.message : String(result.stderr || result.stdout || '').trim(),
    };
  }
  const versionLine = String(result.stdout || '').split('\n').find((line) => /Google Cloud SDK/i.test(line)) || '';
  return {
    installed: true,
    resolvedPath,
    command: 'gcloud auth application-default login',
    message: versionLine || 'Google Cloud CLI is installed on this machine.',
    actionHint: '',
    technicalDetails: '',
  };
}

function startBootstrapAdminLogin() {
  const gcloud = inspectGcloudCli();
  if (!gcloud.installed) {
    throw new Error('Google Cloud CLI is not installed on this machine yet. Install it first, then try the Google sign-in button again.');
  }
  if (process.platform !== 'darwin') {
    throw new Error('One-click Google sign-in is currently only wired for macOS. Run `gcloud auth application-default login` in your terminal.');
  }

  const command = [
    `${JSON.stringify(gcloud.resolvedPath || 'gcloud')} auth application-default login`,
    'echo',
    'echo "When Google sign-in finishes, return to the GCQ onboarding console and press Refresh Google Login Status."',
  ].join('; ');
  const appleScript = [
    'tell application "Terminal"',
    'activate',
    `do script ${JSON.stringify(command)}`,
    'end tell',
  ].join('\n');

  const child = spawn('osascript', ['-e', appleScript], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return {
    started: true,
    message: 'A new Terminal window was opened to start Google sign-in for one-time project setup.',
    actionHint: 'Finish the Google sign-in in that Terminal window, then come back here and refresh the login status.',
  };
}

function setBootstrapQuotaProject(projectId) {
  const value = String(projectId || '').trim();
  if (!value) {
    throw new Error('Choose or type the Firebase project ID first so the Google login can use the right quota project.');
  }
  const gcloud = inspectGcloudCli();
  if (!gcloud.installed) {
    throw new Error('Google Cloud CLI is not installed on this machine yet.');
  }
  const result = spawnSync(gcloud.resolvedPath || 'gcloud', ['auth', 'application-default', 'set-quota-project', value], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || result.error?.message || 'The quota project could not be set.').trim());
  }
  return {
    ok: true,
    message: `The Google login quota project was set to ${value}.`,
  };
}

function parseServiceAccount(serviceAccountInput) {
  let parsed = serviceAccountInput;
  if (typeof parsed === 'string') {
    const raw = parsed.trim();
    if (!raw) {
      throw new Error('Please upload or paste the Firebase service account JSON file first.');
    }
    parsed = JSON.parse(raw);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The Firebase service account file could not be read.');
  }
  const required = ['type', 'project_id', 'private_key', 'client_email'];
  for (const field of required) {
    if (!parsed[field]) {
      throw new Error(`The Firebase service account JSON is missing "${field}".`);
    }
  }
  if (parsed.type !== 'service_account') {
    throw new Error('This JSON file is not a Firebase service account key.');
  }
  return parsed;
}

function validateSetupInput(input, options = {}) {
  const errors = [];
  const requireSchoolLabel = options.requireSchoolLabel !== false;
  if (requireSchoolLabel) {
    const schoolLabelError = validateSchoolLabel(input.schoolLabel);
    if (schoolLabelError) errors.push(schoolLabelError);
  }
  const projectIdError = validateProjectId(input.projectId);
  if (projectIdError) errors.push(projectIdError);
  const renderUrlError = validateRenderUrl(input.renderUrl);
  if (renderUrlError) errors.push(renderUrlError);
  const siteDomainError = validateSiteDomain(input.siteDomain);
  if (siteDomainError) errors.push(siteDomainError);
  errors.push(...validatePriceIds(input.priceIds));
  try {
    const serviceAccount = parseServiceAccount(input.serviceAccount);
    if (input.projectId && serviceAccount.project_id !== String(input.projectId).trim()) {
      errors.push('The Firebase key belongs to a different project. Please use the key for the same school project ID.');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return {
    ok: errors.length === 0,
    errors,
  };
}

function getRequiredServices(readinessTarget) {
  const target = normalizeReadinessTarget(readinessTarget);
  const base = [
    'serviceusage.googleapis.com',
    'firebase.googleapis.com',
    'identitytoolkit.googleapis.com',
    'firebaserules.googleapis.com',
    'firestore.googleapis.com',
  ];
  if (target === 'pro') {
    base.push('firebasestorage.googleapis.com');
  }
  return base;
}

function loadDefaults() {
  const fileDefaults = loadJsonIfExists(defaultsPath, {});
  const localPriceIds = loadJsonIfExists(priceIdsLocalPath, {});
  const editableSchoolsConfig = ensureEditableSchoolsConfig();
  const savedSchoolPriceIds = normalizePriceIds(editableSchoolsConfig.data?.priceIds || {});
  const normalizedLocalPriceIds = normalizePriceIds(localPriceIds);
  const normalizedFilePriceIds = normalizePriceIds(fileDefaults.priceIds || {});
  return {
    ...clone(DEFAULT_DEFAULTS),
    ...fileDefaults,
    priceIds: {
      ...clone(DEFAULT_DEFAULTS.priceIds),
      ...normalizedFilePriceIds,
      starter: normalizedFilePriceIds.starter || normalizedLocalPriceIds.starter || savedSchoolPriceIds.starter || '',
      pro: normalizedFilePriceIds.pro || normalizedLocalPriceIds.pro || savedSchoolPriceIds.pro || '',
      elite: normalizedFilePriceIds.elite || normalizedLocalPriceIds.elite || savedSchoolPriceIds.elite || '',
    },
    firebaseLocation: normalizeFirebaseLocation(fileDefaults.firebaseLocation),
    readinessTarget: normalizeReadinessTarget(fileDefaults.readinessTarget),
    siteDomain: String(fileDefaults.siteDomain || '').trim(),
  };
}

function saveDefaults(nextDefaults = {}) {
  const currentDefaults = loadDefaults();
  const mergedPriceIds = mergePriceIdsPreservingExisting(currentDefaults.priceIds, nextDefaults.priceIds || {});
  const merged = {
    ...currentDefaults,
    ...nextDefaults,
    priceIds: mergedPriceIds,
    firebaseLocation: normalizeFirebaseLocation(nextDefaults.firebaseLocation || currentDefaults.firebaseLocation),
    readinessTarget: normalizeReadinessTarget(nextDefaults.readinessTarget || currentDefaults.readinessTarget),
    siteDomain: normalizeSiteDomain(nextDefaults.siteDomain || currentDefaults.siteDomain),
  };
  writeJson(defaultsPath, merged);
  writeJson(priceIdsLocalPath, merged.priceIds);
  return merged;
}

function ensureEditableSchoolsConfig() {
  if (fs.existsSync(schoolsLocalPath)) {
    return { path: schoolsLocalPath, data: readJson(schoolsLocalPath) };
  }
  const seed = fs.existsSync(schoolsJsonPath)
    ? readJson(schoolsJsonPath)
    : fs.existsSync(schoolsExamplePath)
      ? readJson(schoolsExamplePath)
      : { schools: [], priceIds: clone(DEFAULT_DEFAULTS.priceIds) };
  writeJson(schoolsLocalPath, seed);
  return { path: schoolsLocalPath, data: seed };
}

function normalizeSchoolRecord(record = {}) {
  return {
    schoolId: String(record.schoolId || record.firebaseProjectId || '').trim(),
    schoolLabel: String(record.schoolLabel || record.schoolId || '').trim(),
    stripeCustomerId: record.stripeCustomerId || null,
    firebaseProjectId: String(record.firebaseProjectId || record.schoolId || '').trim(),
    firebaseServiceAccountPath: record.firebaseServiceAccountPath || '',
    siteDomain: normalizeSiteDomain(record.siteDomain),
  };
}

function saveServiceAccountKey(projectId, serviceAccount) {
  ensureDir(billingKeysDir);
  const keyPath = path.join(billingKeysDir, `${projectId}.json`);
  const incoming = JSON.stringify(serviceAccount, null, 2) + '\n';
  const alreadyExists = fs.existsSync(keyPath);
  const existing = alreadyExists ? fs.readFileSync(keyPath, 'utf8') : null;
  const changed = existing !== incoming;
  if (!alreadyExists || changed) {
    fs.writeFileSync(keyPath, incoming, 'utf8');
  }
  return {
    keyPath,
    relativeKeyPath: `./keys/${projectId}.json`,
    status: !alreadyExists ? 'done' : changed ? 'done' : 'already_done',
    message: !alreadyExists
      ? 'The Firebase key was saved safely in your local billing folder.'
      : changed
        ? 'The saved Firebase key was updated with the latest version you provided.'
        : 'The same Firebase key was already saved for this school.',
  };
}

function upsertSchoolConfig(configData, schoolRecord, priceIds) {
  const normalizedPriceIds = normalizePriceIds(priceIds);
  const schools = Array.isArray(configData.schools) ? configData.schools.map(normalizeSchoolRecord) : [];
  const existingIndex = schools.findIndex(
    (item) => item.schoolId === schoolRecord.schoolId || item.firebaseProjectId === schoolRecord.firebaseProjectId
  );
  if (existingIndex >= 0) {
    const existing = schools[existingIndex];
    schools[existingIndex] = {
      ...existing,
      ...schoolRecord,
      stripeCustomerId: existing.stripeCustomerId || schoolRecord.stripeCustomerId || null,
    };
  } else {
    schools.push(normalizeSchoolRecord(schoolRecord));
  }
  return {
    schools,
    priceIds: normalizedPriceIds,
  };
}

function buildRenderPayload(configData) {
  const schools = (configData.schools || []).map((school) => {
    const output = { ...school };
    delete output.firebaseServiceAccountPath;
    if (school.firebaseServiceAccountPath) {
      const keyPath = school.firebaseServiceAccountPath.startsWith('.')
        ? path.join(billingDir, school.firebaseServiceAccountPath.replace(/^\.\//, ''))
        : school.firebaseServiceAccountPath;
      if (fs.existsSync(keyPath)) {
        output.firebaseServiceAccountKey = readJson(keyPath);
      }
    }
    return output;
  });
  return {
    schools,
    priceIds: normalizePriceIds(configData.priceIds || {}),
  };
}

function writeRenderPaste(configData) {
  const renderPayload = buildRenderPayload(configData);
  const renderJson = JSON.stringify(renderPayload);
  fs.writeFileSync(renderPastePath, renderJson + '\n', 'utf8');
  return {
    renderPayload,
    renderJson,
    path: renderPastePath,
  };
}

function readRuleSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function hashRuleSource(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('base64');
}

function normalizeRulesSource(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function buildFirestoreReleaseName(projectId) {
  return `projects/${projectId}/releases/cloud.firestore`;
}

function buildStorageReleaseName(projectId, bucketName) {
  return `projects/${projectId}/releases/firebase.storage/${bucketName}`;
}

function getAdminApp(projectId, serviceAccount) {
  const appName = `gcq-onboarding-${String(projectId).replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
  const existing = admin.apps.find((app) => app.name === appName);
  if (existing) return existing;
  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId,
    },
    appName
  );
}

function getRulesAdminApp(projectId, authInput) {
  const authKind = authInput && authInput.kind === 'bootstrap_admin' ? 'bootstrap' : 'service';
  const appName = `gcq-rules-${String(projectId).replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-${authKind}`;
  const existing = admin.apps.find((app) => app.name === appName);
  if (existing) return existing;
  return admin.initializeApp(
    {
      credential: authKind === 'bootstrap'
        ? admin.credential.applicationDefault()
        : admin.credential.cert(authInput),
      projectId,
    },
    appName
  );
}

function parseRulesReleaseContext(releaseName, sourcePath) {
  const projectId = String(releaseName || '').split('/')[1] || '';
  if (releaseName === buildFirestoreReleaseName(projectId)) {
    return {
      projectId,
      type: 'firestore',
      bucketName: '',
      sourceName: path.basename(sourcePath) || 'firestore.rules',
    };
  }
  const storagePrefix = `projects/${projectId}/releases/firebase.storage/`;
  if (releaseName.startsWith(storagePrefix)) {
    return {
      projectId,
      type: 'storage',
      bucketName: releaseName.slice(storagePrefix.length),
      sourceName: path.basename(sourcePath) || 'storage.rules',
    };
  }
  throw new Error(`Unsupported Firebase rules release name: ${releaseName}`);
}

async function writePendingSubscription(projectId, serviceAccount) {
  const app = getAdminApp(projectId, serviceAccount);
  const db = app.firestore();
  const pendingPreset = readJson(pendingTierPath);
  const ref = db.collection('appConfig').doc('subscription');
  const snap = await ref.get();
  const alreadyPending = snap.exists && snap.data() && snap.data().tier === 'pending';
  await ref.set(pendingPreset, { merge: false });
  return {
    status: alreadyPending ? 'already_done' : 'done',
    message: alreadyPending
      ? 'The school was already set to show the paywall first.'
      : 'The school was set to show the paywall first until payment happens.',
  };
}

async function readSubscriptionStatus(projectId, serviceAccount) {
  const app = getAdminApp(projectId, serviceAccount);
  const db = app.firestore();
  const snap = await db.collection('appConfig').doc('subscription').get();
  if (!snap.exists) {
    return { exists: false, tier: null, data: null };
  }
  const data = snap.data() || null;
  return { exists: true, tier: data && data.tier ? data.tier : null, data };
}

function loadTierPresetByName(tier) {
  const normalizedTier = String(tier || '').trim().toLowerCase();
  const presetPath = path.join(tierConfigDir, `${normalizedTier}.json`);
  if (!fs.existsSync(presetPath)) {
    throw new Error(`No subscription preset was found for "${normalizedTier}".`);
  }
  return readJson(presetPath);
}

function buildManualSubscriptionPayload(input = {}) {
  const tier = String(input.tier || '').trim().toLowerCase();
  if (!tier) {
    throw new Error('Choose a subscription tier first.');
  }
  const preset = loadTierPresetByName(tier);
  const startsAt = normalizeDateInput(input.startsAt);
  const endsAt = normalizeDateInput(input.endsAt);
  if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    throw new Error('The end date must be after the start date.');
  }
  const notes = String(input.notes || '').trim();
  const source = String(input.source || 'manual').trim() || 'manual';
  const now = new Date().toISOString();
  return {
    ...preset,
    source,
    assignedTier: tier,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
    notes: notes || '',
    updatedAt: now,
    grantedAt: now,
  };
}

function formatSubscriptionSummary(subscription) {
  if (!subscription || !subscription.exists) {
    return {
      exists: false,
      tier: 'missing',
      effectiveTier: 'pending',
      startsAt: null,
      endsAt: null,
      notes: '',
      source: '',
      message: 'No subscription document exists yet for this school.',
    };
  }
  const data = subscription.data || {};
  const startsAt = data.startsAt || null;
  const endsAt = data.endsAt || null;
  const now = Date.now();
  let effectiveTier = data.tier || 'pending';
  if (startsAt && new Date(startsAt).getTime() > now) {
    effectiveTier = 'pending';
  }
  if (endsAt && new Date(endsAt).getTime() <= now) {
    effectiveTier = 'expired';
  }
  return {
    exists: true,
    tier: data.tier || 'pending',
    effectiveTier,
    startsAt,
    endsAt,
    notes: data.notes || '',
    source: data.source || '',
    updatedAt: data.updatedAt || null,
    message: `Current saved subscription tier is "${data.tier || 'pending'}".`,
    data,
  };
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatGraceSummary(raw) {
  const startsAt = toIsoString(raw?.onboardingGraceStartedAt);
  const endsAt = toIsoString(raw?.onboardingGraceEndsAt);
  const startMs = startsAt ? new Date(startsAt).getTime() : null;
  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  const now = Date.now();
  return {
    startsAt,
    endsAt,
    active: Boolean(endMs && endMs > now),
    expired: Boolean(endMs && endMs <= now),
    used: Boolean(startMs || endMs),
    remainingMs: endMs && endMs > now ? endMs - now : 0,
    message: endMs && endMs > now
      ? 'A grace period is active for this school right now.'
      : startMs || endMs
        ? 'This school has already used its grace period.'
        : 'This school has not used its grace period yet.',
  };
}

function summarizeAssessmentDefaults(raw) {
  const defaults = raw && typeof raw === 'object' ? raw.assessmentDefaultsByLeague : null;
  if (!defaults || typeof defaults !== 'object') {
    return {
      configured: false,
      leagueCount: 0,
      leagues: [],
      message: 'No custom assessment defaults are saved yet.',
    };
  }

  const leagues = Object.entries(defaults)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([league, value]) => {
      const tests = value.tests && typeof value.tests === 'object' ? value.tests : null;
      const dictations = value.dictations && typeof value.dictations === 'object' ? value.dictations : null;
      const describeScheme = (scheme) => {
        if (!scheme || typeof scheme !== 'object') return 'not set';
        if (scheme.mode === 'qualitative') {
          const count = Array.isArray(scheme.scale) ? scheme.scale.filter((entry) => entry && entry.label).length : 0;
          return `${count || 0} labels`;
        }
        const maxScore = Number(scheme.maxScore);
        return Number.isFinite(maxScore) && maxScore > 0 ? `/${maxScore}` : 'numeric';
      };
      return {
        league,
        tests: describeScheme(tests),
        dictations: describeScheme(dictations),
      };
    });

  return {
    configured: leagues.length > 0,
    leagueCount: leagues.length,
    leagues,
    message: leagues.length > 0
      ? `Assessment defaults are saved for ${leagues.length} league${leagues.length === 1 ? '' : 's'}.`
      : 'No custom assessment defaults are saved yet.',
  };
}

async function fetchGraceWindow(projectId, serviceAccount) {
  const app = getAdminApp(projectId, serviceAccount);
  const snap = await app.firestore().doc(SCHOOL_SETTINGS_DOC).get();
  return formatGraceSummary(snap.exists ? snap.data() : null);
}

async function fetchAssessmentDefaultsSummary(projectId, serviceAccount) {
  const app = getAdminApp(projectId, serviceAccount);
  const snap = await app.firestore().doc(SCHOOL_SETTINGS_DOC).get();
  return summarizeAssessmentDefaults(snap.exists ? snap.data() : null);
}

async function fetchBillingSubscriptionInfo(projectId) {
  const configuredUrl = String(process.env.ONBOARDING_CONSOLE_BILLING_URL || loadDefaults().renderUrl || '').trim();
  const checkedAt = new Date().toISOString();
  if (!configuredUrl) {
    return {
      available: false,
      checkedAt,
      source: '',
      message: 'Add your Render billing URL in this tool first if you want Stripe payment history here too.',
    };
  }

  let baseUrl;
  try {
    baseUrl = new URL(configuredUrl);
  } catch (error) {
    return {
      available: false,
      checkedAt,
      source: configuredUrl,
      message: 'The saved billing URL is not valid, so Stripe payment details could not be checked.',
    };
  }

  const requestUrl = new URL('/subscription-info', baseUrl);
  requestUrl.searchParams.set('schoolId', projectId);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        accept: 'application/json',
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'The billing server did not return subscription info.');
    }
    return {
      available: true,
      checkedAt,
      source: baseUrl.origin,
      ...payload,
    };
  } catch (error) {
    return {
      available: false,
      checkedAt,
      source: baseUrl.origin,
      message: error.message || 'Stripe payment details could not be loaded from the billing server.',
    };
  }
}

async function getSavedSchoolDetails(projectId) {
  const schools = getSavedSchools();
  const school = schools.find((item) => item.schoolId === projectId || item.firebaseProjectId === projectId);
  if (!school) {
    throw new Error('That school is not in your saved local billing list yet.');
  }
  if (!school.firebaseServiceAccountPath) {
    throw new Error('This saved school does not have a Firebase key path yet.');
  }
  const keyPath = school.firebaseServiceAccountPath.startsWith('.')
    ? path.join(billingDir, school.firebaseServiceAccountPath.replace(/^\.\//, ''))
    : school.firebaseServiceAccountPath;
  if (!fs.existsSync(keyPath)) {
    throw new Error('The saved Firebase key file for this school could not be found.');
  }
  const serviceAccount = readJson(keyPath);
  const subscription = await readSubscriptionStatus(projectId, serviceAccount);
  const billing = await fetchBillingSubscriptionInfo(projectId);
  const grace = await fetchGraceWindow(projectId, serviceAccount);
  const assessmentSummary = await fetchAssessmentDefaultsSummary(projectId, serviceAccount);
  return {
    school,
    serviceAccount,
    subscription: formatSubscriptionSummary(subscription),
    billing,
    grace,
    assessmentSummary,
  };
}

async function updateSavedSchoolSubscription(projectId, input = {}) {
  const details = await getSavedSchoolDetails(projectId);
  const payload = buildManualSubscriptionPayload(input);
  const app = getAdminApp(projectId, details.serviceAccount);
  await app.firestore().collection('appConfig').doc('subscription').set(payload, { merge: false });
  const nextSubscription = await readSubscriptionStatus(projectId, details.serviceAccount);
  const billing = await fetchBillingSubscriptionInfo(projectId);
  return {
    school: details.school,
    subscription: formatSubscriptionSummary(nextSubscription),
    billing,
    grace: details.grace,
    message: 'The school subscription was updated successfully.',
  };
}

function removeSchoolFromLocalConfig(projectId) {
  const editable = ensureEditableSchoolsConfig();
  const nextSchools = (editable.data.schools || []).filter((school) => {
    const normalized = normalizeSchoolRecord(school);
    return normalized.schoolId !== projectId && normalized.firebaseProjectId !== projectId;
  });
  const nextConfig = {
    ...editable.data,
    schools: nextSchools,
  };
  writeJson(editable.path, nextConfig);
  const keyPath = path.join(billingKeysDir, `${projectId}.json`);
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
  }
  const renderOutput = writeRenderPaste(nextConfig);
  return {
    schools: nextSchools.map(normalizeSchoolRecord),
    renderJson: renderOutput.renderJson,
  };
}

async function getAuthHeaders(authInput, url = '') {
  if (authInput && authInput.kind === 'bootstrap_admin' && authInput.client) {
    const headers = await authInput.client.getRequestHeaders(url);
    const directAuthorization = headers.Authorization || headers.authorization || '';
    if (directAuthorization) {
      return {
        Authorization: directAuthorization,
      };
    }

    const tokenResult = await authInput.client.getAccessToken();
    const directToken = typeof tokenResult === 'string'
      ? tokenResult
      : tokenResult && (tokenResult.token || tokenResult.access_token || '');
    if (directToken) {
      return {
        Authorization: `Bearer ${directToken}`,
      };
    }

    const authToken = await authInput.auth.getAccessToken();
    const fallbackToken = typeof authToken === 'string'
      ? authToken
      : authToken && (authToken.token || authToken.access_token || '');
    if (fallbackToken) {
      return {
        Authorization: `Bearer ${fallbackToken}`,
      };
    }

    throw new Error('Your local Google admin login did not provide an OAuth access token.');
  }

  const client = new JWT({
    email: authInput.client_email,
    key: authInput.private_key,
    scopes: OAUTH_SCOPES,
  });
  client.useJWTAccessWithScope = false;
  const tokens = await client.authorize();
  const accessToken = tokens && tokens.access_token ? tokens.access_token : '';
  if (!accessToken) {
    throw new Error('The Firebase service account key could not create a Google OAuth access token.');
  }
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function googleJsonRequest(url, authInput, options = {}) {
  const headers = {
    ...(await getAuthHeaders(authInput, url)),
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.quotaProject) {
    headers['x-goog-user-project'] = options.quotaProject;
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      json = { raw: text };
    }
  }
  if (!response.ok) {
    const detail = json && json.error
      ? json.error.message || JSON.stringify(json.error)
      : summarizeGoogleErrorText(text, response.statusText);
    const err = new Error(detail || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.payload = json;
    throw err;
  }
  return json;
}

function summarizeGoogleErrorText(text, fallback = '') {
  const raw = String(text || '').trim();
  if (!raw) {
    return fallback;
  }
  if (!/<html/i.test(raw)) {
    return raw;
  }

  const requestedUrlMatch = raw.match(/requested URL <code>([^<]+)<\/code>/i);
  const titleMatch = raw.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Google returned an HTML error page';
  const requestedUrl = requestedUrlMatch ? requestedUrlMatch[1].trim() : '';

  return requestedUrl
    ? `${title}. Requested URL: ${requestedUrl}`
    : title;
}

async function getFirestoreDatabaseInfo(projectId, serviceAccount) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)`;
  return googleJsonRequest(url, serviceAccount);
}

async function getProjectMetadata(projectId, serviceAccount) {
  const requestOptions = { quotaProject: projectId };
  const urls = [
    `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`,
    `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}`,
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const metadata = await googleJsonRequest(url, serviceAccount, requestOptions);
      const projectNumber = extractProjectNumber(metadata);
      if (projectNumber) {
        return {
          ...metadata,
          projectNumber,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('The Firebase project metadata could not be loaded yet.');
}

async function getProjectIamPolicy(projectId, authInput) {
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:getIamPolicy`;
  return googleJsonRequest(url, authInput, {
    method: 'POST',
    body: {},
    quotaProject: projectId,
  });
}

async function setProjectIamPolicy(projectId, authInput, policy) {
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:setIamPolicy`;
  return googleJsonRequest(url, authInput, {
    method: 'POST',
    body: {
      policy,
    },
    quotaProject: projectId,
  });
}

async function deleteGoogleProject(projectId, authInput) {
  const projectMetadata = await getProjectMetadata(projectId, authInput);
  const projectName = buildServiceUsageConsumerName(projectMetadata);
  const url = `https://cloudresourcemanager.googleapis.com/v3/${projectName}`;
  const operation = await googleJsonRequest(url, authInput, {
    method: 'DELETE',
    quotaProject: projectId,
  });
  return {
    projectName,
    operation,
  };
}

function ensurePolicyBinding(policy, role, member) {
  const nextPolicy = {
    ...policy,
    bindings: Array.isArray(policy.bindings) ? policy.bindings.map((binding) => ({
      ...binding,
      members: Array.isArray(binding.members) ? [...binding.members] : [],
    })) : [],
  };
  const existing = nextPolicy.bindings.find((binding) => binding.role === role);
  if (existing) {
    if (existing.members.includes(member)) {
      return {
        changed: false,
        policy: nextPolicy,
      };
    }
    existing.members.push(member);
    return {
      changed: true,
      policy: nextPolicy,
    };
  }
  nextPolicy.bindings.push({
    role,
    members: [member],
  });
  return {
    changed: true,
    policy: nextPolicy,
  };
}

async function ensureBootstrapServiceUsageAccess(projectId, serviceAccount, bootstrapAuth) {
  const member = `serviceAccount:${serviceAccount.client_email}`;
  const roles = [
    'roles/serviceusage.serviceUsageConsumer',
    'roles/serviceusage.serviceUsageAdmin',
  ];
  const currentPolicy = await getProjectIamPolicy(projectId, bootstrapAuth);
  let nextPolicy = currentPolicy;
  let changed = false;
  for (const role of roles) {
    const result = ensurePolicyBinding(nextPolicy, role, member);
    nextPolicy = result.policy;
    changed = changed || result.changed;
  }
  if (!changed) {
    return {
      status: 'already_done',
      member,
      roles,
      message: 'The school Firebase key already has the Google service permissions it needs for future setup runs.',
    };
  }
  await setProjectIamPolicy(projectId, bootstrapAuth, nextPolicy);
  return {
    status: 'done',
    member,
    roles,
    message: 'The school Firebase key was granted the Google service permissions it needs for future setup runs.',
  };
}

async function deleteSavedSchool(projectId, options = {}) {
  const schoolId = String(projectId || '').trim();
  if (!schoolId) {
    throw new Error('Choose a saved school first.');
  }
  const school = getSavedSchools().find((item) => item.schoolId === schoolId || item.firebaseProjectId === schoolId);
  if (!school) {
    throw new Error('That school is not in your saved local billing list yet.');
  }

  let projectDeletion = null;
  if (options.deleteProject === true) {
    const bootstrapAdmin = await getOptionalBootstrapAdminAuth();
    if (!bootstrapAdmin) {
      throw new Error('Deleting the whole Firebase/Google project needs your local Google admin login first.');
    }
    projectDeletion = await deleteGoogleProject(schoolId, bootstrapAdmin);
  }

  const local = removeSchoolFromLocalConfig(schoolId);
  return {
    schoolId,
    deleteProject: options.deleteProject === true,
    projectDeletion,
    schools: local.schools,
    renderJson: local.renderJson,
    message: options.deleteProject === true
      ? 'The Google/Firebase project was marked for deletion and the school was removed from your local saved list.'
      : 'The school was removed from your local saved list only.',
  };
}

async function createFirestoreDatabase(projectId, serviceAccount, locationId) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases?databaseId=(default)`;
  return googleJsonRequest(url, serviceAccount, {
    method: 'POST',
    body: {
      type: 'FIRESTORE_NATIVE',
      locationId,
    },
  });
}

async function getStorageDefaultBucket(projectId, serviceAccount) {
  const url = `https://firebasestorage.googleapis.com/v1alpha/projects/${encodeURIComponent(projectId)}/defaultBucket`;
  return googleJsonRequest(url, serviceAccount);
}

async function createStorageDefaultBucket(projectId, serviceAccount, location) {
  const url = `https://firebasestorage.googleapis.com/v1alpha/projects/${encodeURIComponent(projectId)}/defaultBucket?location=${encodeURIComponent(location)}`;
  return googleJsonRequest(url, serviceAccount, {
    method: 'POST',
    body: {},
  });
}

async function createRuleset(projectId, serviceAccount, sourceContent) {
  const url = `https://firebaserules.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/rulesets`;
  return googleJsonRequest(url, serviceAccount, {
    method: 'POST',
    body: {
      source: {
        files: [
          {
            name: 'rules',
            content: sourceContent,
            fingerprint: hashRuleSource(sourceContent),
          },
        ],
      },
    },
  });
}

async function getRulesRelease(releaseName, serviceAccount) {
  return googleJsonRequest(`https://firebaserules.googleapis.com/v1/${releaseName}`, serviceAccount);
}

async function getRuleset(rulesetName, serviceAccount) {
  return googleJsonRequest(`https://firebaserules.googleapis.com/v1/${rulesetName}`, serviceAccount);
}

async function upsertRulesRelease(releaseName, rulesetName, serviceAccount) {
  try {
    const patchAttempts = [
      {
        url: `https://firebaserules.googleapis.com/v1/${releaseName}`,
        body: {
          release: {
            name: releaseName,
            rulesetName,
          },
          updateMask: 'release.rulesetName',
        },
      },
      {
        url: `https://firebaserules.googleapis.com/v1/${releaseName}`,
        body: {
          release: {
            name: releaseName,
            rulesetName,
          },
          updateMask: 'release.ruleset_name',
        },
      },
      {
        url: `https://firebaserules.googleapis.com/v1/${releaseName}?updateMask=release.rulesetName`,
        body: {
          release: {
            name: releaseName,
            rulesetName,
          },
        },
      },
      {
        url: `https://firebaserules.googleapis.com/v1/${releaseName}?updateMask=release.ruleset_name`,
        body: {
          release: {
            name: releaseName,
            rulesetName,
          },
        },
      },
    ];

    let lastPatchError = null;
    for (const attempt of patchAttempts) {
      try {
        return await googleJsonRequest(attempt.url, serviceAccount, {
          method: 'PATCH',
          body: attempt.body,
        });
      } catch (error) {
        lastPatchError = error;
        const message = String(error.message || '');
        if (!/invalid argument|unknown name/i.test(message)) {
          throw error;
        }
      }
    }
    throw lastPatchError || new Error('The live rules release could not be updated.');
  } catch (error) {
    if (error.status !== 404) throw error;
    return googleJsonRequest(`https://firebaserules.googleapis.com/v1/projects/${releaseName.split('/')[1]}/releases`, serviceAccount, {
      method: 'POST',
      body: {
        name: releaseName,
        rulesetName,
      },
    });
  }
}

async function inspectRulesRelease(releaseName, sourcePath, serviceAccount) {
  const context = parseRulesReleaseContext(releaseName, sourcePath);
  const localSource = readRuleSource(sourcePath);
  try {
    const app = getRulesAdminApp(context.projectId, serviceAccount);
    const securityRules = admin.securityRules(app);
    const ruleset = context.type === 'firestore'
      ? await securityRules.getFirestoreRuleset()
      : await securityRules.getStorageRuleset(context.bucketName);
    const remoteSource = (ruleset.source || []).map((file) => file.content || '').join('\n');
    const matches = normalizeRulesSource(remoteSource) === normalizeRulesSource(localSource);
    return {
      exists: true,
      matches,
      release: {
        name: releaseName,
      },
      rulesetName: ruleset.name,
      localSource,
      remoteSource,
    };
  } catch (error) {
    if (error.status === 404 || /not[- ]found/i.test(String(error.code || '')) || /not[- ]found/i.test(String(error.message || ''))) {
      return {
        exists: false,
        matches: false,
        release: null,
        rulesetName: '',
        localSource,
        remoteSource: '',
      };
    }
    throw error;
  }
}

async function deployRulesRelease(projectId, releaseName, sourcePath, serviceAccount) {
  const context = parseRulesReleaseContext(releaseName, sourcePath);
  const before = await inspectRulesRelease(releaseName, sourcePath, serviceAccount);
  if (before.exists && before.matches) {
    return {
      status: 'already_done',
      message: 'The live rules already match the safe version saved in this repo.',
      before,
      after: before,
    };
  }
  const app = getRulesAdminApp(projectId, serviceAccount);
  const securityRules = admin.securityRules(app);
  const source = readRuleSource(sourcePath);
  const ruleset = context.type === 'firestore'
    ? await securityRules.releaseFirestoreRulesetFromSource(source)
    : await securityRules.releaseStorageRulesetFromSource(source, context.bucketName);
  const after = await inspectRulesRelease(releaseName, sourcePath, serviceAccount);
  return {
    status: before.exists ? 'done' : 'done',
    message: before.exists
      ? 'The live rules were updated to match the safe version saved in this repo.'
      : 'The live rules were deployed for this school.',
    before,
    after: {
      ...after,
      rulesetName: ruleset.name || after.rulesetName,
    },
  };
}

async function waitForGoogleOperation(url, serviceAccount, options = {}) {
  const attempts = options.attempts || 12;
  const delayMs = options.delayMs || 2000;
  const requestOptions = options.requestOptions || {};
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await googleJsonRequest(url, serviceAccount, requestOptions);
    if (last.done === true || last.state === 'SUCCESSFUL' || last.response || last.error) {
      return last;
    }
    await wait(delayMs);
  }
  return last;
}

async function enableRequiredServices(projectId, serviceAccount, readinessTarget) {
  const services = getRequiredServices(readinessTarget);
  const projectMetadata = await getProjectMetadata(projectId, serviceAccount);
  const consumerName = buildServiceUsageConsumerName(projectMetadata);
  const requestOptions = {
    quotaProject: projectId,
  };
  const url = `https://serviceusage.googleapis.com/v1/${consumerName}/services:batchEnable`;
  try {
    const operation = await googleJsonRequest(url, serviceAccount, {
      method: 'POST',
      body: {
        serviceIds: services,
      },
      quotaProject: requestOptions.quotaProject,
    });
    if (operation && operation.name) {
      const finalOperation = await waitForGoogleOperation(
        `https://serviceusage.googleapis.com/v1/${operation.name}`,
        serviceAccount,
        {
          attempts: 15,
          delayMs: 2000,
          requestOptions,
        }
      );
      return {
        services,
        consumerName,
        operation: finalOperation,
      };
    }
    return {
      services,
      consumerName,
      operation,
    };
  } catch (error) {
    if (error.status === 400 && /already enabled/i.test(error.message || '')) {
      return {
        services,
        consumerName,
        operation: { done: true },
      };
    }
    throw error;
  }
}

async function ensureFirestoreReady(projectId, serviceAccount, locationId) {
  try {
    const firestore = await getFirestoreDatabaseInfo(projectId, serviceAccount);
    return {
      status: 'already_done',
      firestore,
      created: false,
    };
  } catch (error) {
    const message = error.message || '';
    if (error.status !== 404 && !/not been used/i.test(message) && !/disabled/i.test(message)) {
      throw error;
    }
  }

  const operation = await createFirestoreDatabase(projectId, serviceAccount, locationId);
  const finalOperation = operation?.name
    ? await waitForGoogleOperation(`https://firestore.googleapis.com/v1/${operation.name}`, serviceAccount, {
        attempts: 20,
        delayMs: 3000,
      })
    : operation;
  const firestore = await getFirestoreDatabaseInfo(projectId, serviceAccount);
  return {
    status: 'done',
    firestore,
    created: true,
    operation: finalOperation,
  };
}

async function ensureStorageReady(projectId, serviceAccount, locationId, readinessTarget) {
  const target = normalizeReadinessTarget(readinessTarget);
  try {
    const storageBucket = await getStorageDefaultBucket(projectId, serviceAccount);
    return {
      status: 'already_done',
      storageBucket,
      created: false,
      target,
    };
  } catch (error) {
    if (target !== 'pro') {
      return {
        status: 'skipped',
        storageBucket: null,
        created: false,
        target,
        reason: 'Starter flow does not require Firebase Storage yet.',
      };
    }
    if (error.status !== 404 && !/not found/i.test(error.message || '')) {
      throw error;
    }
  }

  const created = await createStorageDefaultBucket(projectId, serviceAccount, locationId);
  const storageBucket = await getStorageDefaultBucket(projectId, serviceAccount);
  return {
    status: 'done',
    storageBucket,
    created: true,
    operation: created,
    target,
  };
}

function getExpectedAuthorizedDomains(projectId, siteDomain) {
  const domains = new Set([
    'localhost',
    '127.0.0.1',
    `${projectId}.firebaseapp.com`,
    `${projectId}.web.app`,
  ]);
  const normalizedSiteDomain = normalizeSiteDomain(siteDomain);
  if (normalizedSiteDomain) {
    domains.add(normalizedSiteDomain);
  }
  return Array.from(domains).filter(Boolean);
}

async function getFirebaseAuthConfig(projectId, serviceAccount) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`;
  return googleJsonRequest(url, serviceAccount, {
    quotaProject: projectId,
  });
}

async function updateFirebaseAuthConfig(projectId, serviceAccount, body, updateMask) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config?updateMask=${encodeURIComponent(updateMask)}`;
  return googleJsonRequest(url, serviceAccount, {
    method: 'PATCH',
    quotaProject: projectId,
    body,
  });
}

function summarizeFirebaseAuthConfig(config = {}, siteDomain = '') {
  const emailEnabled = config?.signIn?.email?.enabled === true;
  const authorizedDomains = Array.isArray(config?.authorizedDomains) ? config.authorizedDomains : [];
  const normalizedSiteDomain = normalizeSiteDomain(siteDomain);
  const siteDomainAuthorized = normalizedSiteDomain
    ? authorizedDomains.includes(normalizedSiteDomain)
    : false;
  return {
    emailEnabled,
    authorizedDomains,
    siteDomainAuthorized,
    siteDomain: normalizedSiteDomain,
  };
}

function isFirebaseAuthMissingError(error) {
  const message = String(error?.message || '');
  return error?.status === 404 || /configuration-not-found/i.test(message) || /not found/i.test(message);
}

function buildFirebaseAuthSetupError(error) {
  const message = String(error?.message || '').trim();
  if (/BILLING_NOT_ENABLED/i.test(message)) {
    return new Error('The tool hit an Identity Platform billing-only API by mistake. Firebase Authentication itself does not need billing for this setup.');
  }
  if (isFirebaseAuthMissingError(error)) {
    return new Error('Firebase Authentication has not been opened for this project yet. Open Firebase Console -> Authentication -> Get started once, then rerun the setup.');
  }
  return error;
}

async function ensureFirebaseAuthReady(projectId, serviceAccount, siteDomain) {
  let config;
  let initialized = false;
  let hadConfig = true;

  try {
    config = await getFirebaseAuthConfig(projectId, serviceAccount);
  } catch (error) {
    if (!isFirebaseAuthMissingError(error)) {
      throw buildFirebaseAuthSetupError(error);
    }
    hadConfig = false;
    config = {};
  }

  const before = summarizeFirebaseAuthConfig(config, siteDomain);
  const expectedDomains = getExpectedAuthorizedDomains(projectId, siteDomain);
  const mergedDomains = Array.from(new Set([...(before.authorizedDomains || []), ...expectedDomains])).sort();
  const needsEmail = !before.emailEnabled;
  const needsDomains = expectedDomains.some((domain) => !before.authorizedDomains.includes(domain));

  if (needsEmail || needsDomains) {
    try {
      config = await updateFirebaseAuthConfig(
        projectId,
        serviceAccount,
        {
          signIn: {
            ...(config.signIn || {}),
            email: {
              ...((config.signIn && config.signIn.email) || {}),
              enabled: true,
              passwordRequired: true,
            },
          },
          authorizedDomains: mergedDomains,
        },
        'signIn.email,authorizedDomains'
      );
    } catch (error) {
      throw buildFirebaseAuthSetupError(error);
    }
  }

  const after = summarizeFirebaseAuthConfig(config, siteDomain);
  initialized = !hadConfig && (after.emailEnabled || after.authorizedDomains.length > 0);
  return {
    initialized,
    before,
    after,
    expectedDomains,
    emailChanged: needsEmail,
    domainsChanged: needsDomains,
  };
}

async function inspectFirebaseServices(projectId, serviceAccount) {
  const firestore = await getFirestoreDatabaseInfo(projectId, serviceAccount);
  let storageBucket = null;
  let storageMissing = false;
  let storageError = null;
  try {
    storageBucket = await getStorageDefaultBucket(projectId, serviceAccount);
  } catch (error) {
    if (error.status === 404) {
      storageMissing = true;
    } else {
      storageError = error;
    }
  }

  return {
    firestore,
    storageBucket,
    storageMissing,
    storageError,
  };
}

function loadRequiredIndexes() {
  const raw = readJson(firestoreIndexesPath);
  return (raw.indexes || []).map((index) => ({
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope || 'COLLECTION',
    fields: (index.fields || []).map((field) => ({
      fieldPath: field.fieldPath,
      ...(field.order ? { order: field.order } : {}),
      ...(field.arrayConfig ? { arrayConfig: field.arrayConfig } : {}),
    })),
  }));
}

function normalizeIndex(index) {
  return JSON.stringify({
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope || 'COLLECTION',
    fields: (index.fields || [])
      .filter((field) => field.fieldPath !== '__name__')
      .map((field) => ({
        fieldPath: field.fieldPath,
        order: field.order || null,
        arrayConfig: field.arrayConfig || null,
      })),
  });
}

function normalizeIndexForLookup(index) {
  const normalized = JSON.parse(normalizeIndex(index));
  normalized.fields = normalized.fields
    .slice()
    .sort((a, b) => {
      if (a.fieldPath === b.fieldPath) {
        return String(a.order || a.arrayConfig || '').localeCompare(String(b.order || b.arrayConfig || ''));
      }
      return String(a.fieldPath).localeCompare(String(b.fieldPath));
    });
  return JSON.stringify(normalized);
}

function getCollectionGroupFromIndex(index) {
  if (index && index.collectionGroup) {
    return index.collectionGroup;
  }
  const name = String(index && index.name ? index.name : '');
  const match = name.match(/\/collectionGroups\/([^/]+)\/indexes\//);
  return match ? decodeURIComponent(match[1]) : '';
}

function mapIndexState(state) {
  if (state === 'READY') return 'done';
  if (state === 'CREATING') return 'building';
  if (state === 'NEEDS_REPAIR') return 'needs_attention';
  return 'waiting';
}

async function listIndexesForCollectionGroup(projectId, serviceAccount, collectionGroup) {
  const indexes = [];
  let pageToken = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/collectionGroups/${encodeURIComponent(collectionGroup)}/indexes`
    );
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await googleJsonRequest(url.toString(), serviceAccount);
    for (const index of payload.indexes || []) {
      indexes.push(index);
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return indexes;
}

async function listAllIndexes(projectId, serviceAccount, requiredIndexes) {
  const collectionGroups = Array.from(new Set(requiredIndexes.map((index) => index.collectionGroup)));
  const results = [];
  for (const collectionGroup of collectionGroups) {
    const indexes = await listIndexesForCollectionGroup(projectId, serviceAccount, collectionGroup);
    results.push(...indexes);
  }
  return results;
}

function compareRequiredIndexes(requiredIndexes, existingIndexes) {
  const existingMap = new Map();
  for (const index of existingIndexes) {
    existingMap.set(
      normalizeIndexForLookup({
        collectionGroup: getCollectionGroupFromIndex(index),
        queryScope: index.queryScope || 'COLLECTION',
        fields: index.fields || [],
      }),
      index
    );
  }

  return requiredIndexes.map((required) => {
    const existing = existingMap.get(normalizeIndexForLookup(required));
    const rawState = existing ? existing.state || 'UNKNOWN' : 'MISSING';
    const status = existing ? mapIndexState(rawState) : 'missing';
    return {
      ...required,
      rawState,
      status,
      existing,
    };
  });
}

async function createIndex(projectId, serviceAccount, requiredIndex) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/collectionGroups/${encodeURIComponent(requiredIndex.collectionGroup)}/indexes`;
  try {
    return await googleJsonRequest(url, serviceAccount, {
      method: 'POST',
      body: {
        queryScope: requiredIndex.queryScope,
        fields: requiredIndex.fields,
      },
    });
  } catch (error) {
    if (error.status === 409) {
      return { alreadyExists: true };
    }
    throw error;
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureFirestoreIndexes(projectId, serviceAccount, options = {}) {
  const requiredIndexes = loadRequiredIndexes();
  const before = compareRequiredIndexes(requiredIndexes, await listAllIndexes(projectId, serviceAccount, requiredIndexes));
  const missing = before.filter((item) => item.status === 'missing');

  const createErrors = [];
  const createOperations = [];
  for (const item of missing) {
    try {
      const result = await createIndex(projectId, serviceAccount, item);
      if (result && result.name) {
        createOperations.push({
          index: item,
          operationName: result.name,
        });
      }
    } catch (error) {
      createErrors.push({
        index: item,
        message: error.message,
      });
    }
  }

  const operationAttempts = options.operationAttempts || 20;
  const operationDelayMs = options.operationDelayMs || 3000;
  for (const operation of createOperations) {
    try {
      const operationUrl = operation.operationName.startsWith('http')
        ? operation.operationName
        : `https://firestore.googleapis.com/v1/${operation.operationName}`;
      operation.result = await waitForGoogleOperation(operationUrl, serviceAccount, {
        attempts: operationAttempts,
        delayMs: operationDelayMs,
      });
    } catch (error) {
      createErrors.push({
        index: operation.index,
        message: error.message,
      });
    }
  }

  const maxAttempts = options.maxAttempts || 8;
  const delayMs = options.delayMs || 3000;
  let after = before;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    after = compareRequiredIndexes(requiredIndexes, await listAllIndexes(projectId, serviceAccount, requiredIndexes));
    const stillTransitioning = after.some((item) => item.status === 'missing' || item.status === 'building');
    if (!stillTransitioning) break;
    await wait(delayMs);
  }

  return {
    requiredIndexes,
    before,
    after,
    createdCount: missing.length - createErrors.length,
    missingCount: after.filter((item) => item.status === 'missing').length,
    buildingCount: after.filter((item) => item.status === 'building').length,
    readyCount: after.filter((item) => item.status === 'done').length,
    createErrors,
    createOperations,
  };
}

async function inspectFirestoreIndexes(projectId, serviceAccount) {
  const requiredIndexes = loadRequiredIndexes();
  const existing = await listAllIndexes(projectId, serviceAccount, requiredIndexes);
  const compared = compareRequiredIndexes(requiredIndexes, existing);
  return {
    requiredIndexes,
    compared,
    missingCount: compared.filter((item) => item.status === 'missing').length,
    buildingCount: compared.filter((item) => item.status === 'building').length,
    readyCount: compared.filter((item) => item.status === 'done').length,
  };
}

async function fetchFirebaseWebAppConfig(projectId, serviceAccount) {
  const listUrl = `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}/webApps`;
  const listPayload = await googleJsonRequest(listUrl, serviceAccount);
  const apps = listPayload.apps || [];
  if (apps.length === 0) {
    return {
      ok: false,
      message: 'No Firebase Web App was found for this project yet.',
      actionHint: 'Open Firebase Console, create a Web App for this school project, then rerun this tool.',
      config: null,
    };
  }
  const appId = apps[0].appId;
  const configUrl = `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}/webApps/${encodeURIComponent(appId)}/config`;
  const configPayload = await googleJsonRequest(configUrl, serviceAccount);
  return {
    ok: true,
    message: 'Firebase web app settings were found automatically for this school.',
    actionHint: '',
    appId,
    config: {
      apiKey: configPayload.apiKey || '',
      authDomain: configPayload.authDomain || `${projectId}.firebaseapp.com`,
      projectId: configPayload.projectId || projectId,
      storageBucket: configPayload.storageBucket || `${projectId}.appspot.com`,
      messagingSenderId: configPayload.messagingSenderId || '',
      appId: configPayload.appId || appId || '',
      measurementId: configPayload.measurementId || '',
    },
  };
}

function formatHostedEnvironmentVariables(webConfig, renderUrl, projectId) {
  if (!webConfig) return '';
  const lines = [
    `GCQ_FIREBASE_API_KEY=${webConfig.apiKey || ''}`,
    `GCQ_FIREBASE_AUTH_DOMAIN=${webConfig.authDomain || ''}`,
    `GCQ_FIREBASE_PROJECT_ID=${webConfig.projectId || projectId}`,
    `GCQ_FIREBASE_STORAGE_BUCKET=${webConfig.storageBucket || ''}`,
    `GCQ_FIREBASE_MESSAGING_SENDER_ID=${webConfig.messagingSenderId || ''}`,
    `GCQ_FIREBASE_APP_ID=${webConfig.appId || ''}`,
    `GCQ_FIREBASE_MEASUREMENT_ID=${webConfig.measurementId || ''}`,
    `GCQ_BILLING_BASE_URL=${String(renderUrl || '').trim().replace(/\/$/, '')}`,
    `GCQ_BILLING_SCHOOL_ID=${projectId}`,
  ];
  return lines.join('\n');
}

function formatNetlifyVariables(webConfig, renderUrl, projectId) {
  return formatHostedEnvironmentVariables(webConfig, renderUrl, projectId);
}

function buildHostingTargets(webConfig, renderUrl, projectId) {
  const envText = formatHostedEnvironmentVariables(webConfig, renderUrl, projectId);
  return {
    netlify: {
      key: 'netlify',
      label: 'Netlify',
      envText,
      envFilename: `${projectId}.netlify.env`,
      intro:
        'Open the school site in Netlify, add these environment variables, then redeploy the site.',
      instructions: [
        'Site configuration -> Environment variables -> add every GCQ_* value below',
        'Build command: node scripts/build-static-site.js',
        'Publish directory: dist',
      ],
      confirmLabel: 'I pasted these into Netlify',
      copyLabel: 'Copy Netlify Values',
      downloadLabel: 'Download Netlify .env',
    },
    githubPages: {
      key: 'githubPages',
      label: 'GitHub Pages',
      envText,
      envFilename: `${projectId}.github-pages.env`,
      intro:
        'Add these as GitHub Actions repository secrets, then let the included workflow build and publish the school site.',
      instructions: [
        'Repository -> Settings -> Secrets and variables -> Actions -> create one repository secret for each GCQ_* value below',
        'Repository -> Settings -> Pages -> Build and deployment -> Source: GitHub Actions',
        'Commit and push with .github/workflows/deploy-github-pages.yml in the repo',
      ],
      confirmLabel: 'I added these GitHub Pages secrets',
      copyLabel: 'Copy GitHub Pages Values',
      downloadLabel: 'Download GitHub Pages env',
    },
    cloudflarePages: {
      key: 'cloudflarePages',
      label: 'Cloudflare Pages',
      envText,
      envFilename: `${projectId}.cloudflare-pages.env`,
      intro:
        'Open the school project in Cloudflare Pages, add these environment variables, then redeploy with the build settings below.',
      instructions: [
        'Settings -> Environment variables -> add every GCQ_* value below',
        'Framework preset: None',
        'Build command: node scripts/build-static-site.js',
        'Build output directory: dist',
      ],
      confirmLabel: 'I pasted these into Cloudflare Pages',
      copyLabel: 'Copy Cloudflare Pages Values',
      downloadLabel: 'Download Cloudflare Pages env',
    },
  };
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function makeTask(task, status, title, message, extras = {}) {
  return {
    task,
    status,
    title,
    message,
    actionHint: extras.actionHint || '',
    technicalDetails: extras.technicalDetails || '',
  };
}

function summarizeIndexCheck(indexReport) {
  if (indexReport.missingCount === 0 && indexReport.buildingCount === 0) {
    return makeTask(
      'checkIndexes',
      'done',
      'Check Firestore indexes',
      `All ${indexReport.readyCount} required Firestore indexes are ready for this school.`
    );
  }
  if (indexReport.missingCount > 0) {
    return makeTask(
      'checkIndexes',
      'needs_attention',
      'Check Firestore indexes',
      `${indexReport.missingCount} required Firestore indexes are still missing.`,
      {
        actionHint: 'Run the automatic setup to create the missing indexes for you.',
        technicalDetails: JSON.stringify(indexReport.compared, null, 2),
      }
    );
  }
  return makeTask(
    'checkIndexes',
    'working',
    'Check Firestore indexes',
    `${indexReport.buildingCount} Firestore indexes are still building. This is normal right after creation.`,
    {
      actionHint: 'Wait a little and run the check again if needed.',
      technicalDetails: JSON.stringify(indexReport.compared, null, 2),
    }
  );
}

function summarizeFirestoreRulesInspection(inspectResult) {
  if (inspectResult.exists && inspectResult.matches) {
    return makeTask(
      'firestoreRules',
      'done',
      'Check Firestore rules',
      'Firestore security rules already match the safe version saved in this repo.'
    );
  }
  return makeTask(
    'firestoreRules',
    'needs_attention',
    'Check Firestore rules',
    inspectResult.exists
      ? 'Firestore rules are live, but they do not match the safe version saved in this repo.'
      : 'Firestore rules have not been deployed for this school yet.',
    {
      actionHint: 'Run the automatic setup to deploy the rules automatically.',
    }
  );
}

function summarizeStorageRulesResult(bucketName, result) {
  if (!bucketName) {
    return makeTask(
      'storageRules',
      'needs_attention',
      'Check Storage bucket and rules',
      'No Firebase Storage bucket was found for this project.',
      {
        actionHint: 'This is okay for paywall and Starter setup, but Pro/Elite image features like avatars, story images, and Familiar sprites will need Firebase Storage enabled later.',
      }
    );
  }

  if (result.exists && result.matches) {
    return makeTask(
      'storageRules',
      'done',
      'Check Storage bucket and rules',
      `Storage bucket "${bucketName}" exists and its rules already match the safe version in this repo.`
    );
  }

  return makeTask(
    'storageRules',
    'needs_attention',
    'Check Storage bucket and rules',
    `Storage bucket "${bucketName}" exists, but its rules do not match the safe version saved in this repo yet.`,
    {
      actionHint: 'Run the automatic setup to deploy the Storage rules automatically.',
    }
  );
}

async function runAutomaticSetup(input) {
  const validation = validateSetupInput(input);
  if (!validation.ok) {
    const error = new Error(validation.errors.join(' '));
    error.validationErrors = validation.errors;
    throw error;
  }

  const serviceAccount = parseServiceAccount(input.serviceAccount);
  const readinessTarget = normalizeReadinessTarget(input.readinessTarget);
  const firebaseLocation = normalizeFirebaseLocation(input.firebaseLocation);
  const defaults = saveDefaults({
    renderUrl: input.renderUrl,
    siteDomain: input.siteDomain,
    priceIds: input.priceIds,
    lastProjectId: input.projectId,
    lastSchoolLabel: input.schoolLabel,
    readinessTarget,
    firebaseLocation,
  });

  const tasks = [];
  const editable = ensureEditableSchoolsConfig();
  const bootstrapAdmin = await getOptionalBootstrapAdminAuth();
  const bootstrapStatus = await inspectBootstrapAdminAuth();
  const provisioningAuth = bootstrapAdmin || serviceAccount;
  const savedKey = saveServiceAccountKey(input.projectId, serviceAccount);
  tasks.push(makeTask('copyKey', savedKey.status, 'Save the Firebase key safely', savedKey.message));
  tasks.push(
    makeTask(
      'bootstrapLogin',
      bootstrapStatus.available ? 'done' : 'working',
      'Use your Google admin login for one-time project setup',
      bootstrapStatus.available
        ? bootstrapStatus.message
        : 'No local Google admin login was found, so the console will try the school key. Brand-new projects are much smoother if you first sign in with your Google admin account on this machine.',
      {
        actionHint: bootstrapStatus.available ? '' : bootstrapStatus.actionHint,
        technicalDetails: bootstrapStatus.technicalDetails || '',
      }
    )
  );

  const nextConfig = upsertSchoolConfig(
    editable.data,
    {
      schoolId: input.projectId,
      schoolLabel: input.schoolLabel,
      stripeCustomerId: null,
      firebaseProjectId: input.projectId,
      firebaseServiceAccountPath: savedKey.relativeKeyPath,
      siteDomain: input.siteDomain,
    },
    input.priceIds
  );
  writeJson(editable.path, nextConfig);
  tasks.unshift(
    makeTask(
      'saveSchool',
      'done',
      'Save this school in your local billing records',
      'This school is now stored locally, so you can rerun checks later without typing everything again.'
    )
  );

  if (bootstrapAdmin) {
    try {
      const iamResult = await ensureBootstrapServiceUsageAccess(input.projectId, serviceAccount, bootstrapAdmin);
      tasks.push(
        makeTask(
          'grantServiceUsageRoles',
          iamResult.status,
          'Let the school Firebase key use Google services later',
          iamResult.message,
          {
            technicalDetails: JSON.stringify({
              member: iamResult.member,
              roles: iamResult.roles,
            }, null, 2),
          }
        )
      );
    } catch (error) {
      tasks.push(
        makeTask(
          'grantServiceUsageRoles',
          'working',
          'Let the school Firebase key use Google services later',
          'Your Google admin login is ready, but it could not automatically grant the extra Google service roles to the school key yet.',
          {
            actionHint: 'That is not fatal right now because the console can keep using your Google admin login for the one-time provisioning tasks.',
            technicalDetails: error.message || '',
          }
        )
      );
    }
  }

  try {
    const enabledServices = await enableRequiredServices(input.projectId, provisioningAuth, readinessTarget);
    tasks.push(
      makeTask(
        'enableApis',
        'done',
        'Enable the Google and Firebase services this school needs',
        readinessTarget === 'pro'
          ? 'The required Google/Firebase services were enabled for paywall, Firestore, rules, and Pro/Elite storage features.'
          : 'The required Google/Firebase services were enabled for paywall, Firestore, and rules.',
        {
          technicalDetails: JSON.stringify(enabledServices.services, null, 2),
        }
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'enableApis',
        'needs_attention',
        'Enable the Google and Firebase services this school needs',
        error.message || 'The required Google/Firebase services could not be enabled automatically.',
        {
          actionHint: 'This usually means the service account does not have enough Google Cloud permission. The project should allow Service Usage Admin actions.',
          technicalDetails: error.message || '',
        }
      )
    );
    return {
      defaults,
      tasks,
      outputs: {
        renderJson: '',
        netlifyVars: '',
        webConfig: null,
        renderPath: renderPastePath,
        firebaseWebConfigStatus: 'missing',
      },
      finalStatus: 'needs_attention',
      summary: 'Google/Firebase services could not be enabled automatically yet.',
    };
  }

  try {
    const firestoreReady = await ensureFirestoreReady(input.projectId, provisioningAuth, firebaseLocation);
    tasks.push(
      makeTask(
        'ensureFirestore',
        firestoreReady.status,
        'Create or confirm the Firestore database',
        firestoreReady.created
          ? `A Firestore database was created for this school in ${firebaseLocation}.`
          : 'The Firestore database already exists for this school.'
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'ensureFirestore',
        'needs_attention',
        'Create or confirm the Firestore database',
        error.message || 'The Firestore database could not be created automatically.',
        {
          actionHint: 'If this project is brand new, check Google Cloud/Firebase permissions and try again. Database location is a one-time choice.',
          technicalDetails: error.message || '',
        }
      )
    );
    return {
      defaults,
      tasks,
      outputs: {
        renderJson: '',
        netlifyVars: '',
        webConfig: null,
        renderPath: renderPastePath,
        firebaseWebConfigStatus: 'missing',
      },
      finalStatus: 'needs_attention',
      summary: 'The Firestore database is not ready for this school yet.',
    };
  }

  let firebaseServices;
  let authProvisioning = null;
  try {
    firebaseServices = await inspectFirebaseServices(input.projectId, provisioningAuth);
    tasks.push(
      makeTask(
        'checkFirebase',
        'done',
        'Check Firebase services',
        'Cloud Firestore is enabled for this project and can be reached.',
        {
          actionHint: firebaseServices.storageMissing
            ? 'Firebase Storage is not set up yet. That is okay for paywall and Starter setup, but Pro/Elite image features and Familiar sprites will need it later.'
            : '',
        }
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'checkFirebase',
        'needs_attention',
        'Check Firebase services',
        error.message || 'Firebase services could not be reached yet.',
        {
          actionHint: 'Enable Cloud Firestore and create the Firestore database for this project, wait a minute, then click Try Again.',
          technicalDetails: error.message || '',
        }
      )
    );
    return {
      defaults,
      tasks,
      outputs: {
        renderJson: '',
        netlifyVars: '',
        webConfig: null,
        renderPath: renderPastePath,
        firebaseWebConfigStatus: 'missing',
      },
      finalStatus: 'needs_attention',
      summary: 'Cloud Firestore is not ready for this school yet. Enable it first, then rerun the setup.',
    };
  }

  try {
    authProvisioning = await ensureFirebaseAuthReady(input.projectId, provisioningAuth, input.siteDomain);
    tasks.push(
      makeTask(
        'ensureAuth',
        authProvisioning.initialized ? 'done' : 'already_done',
        'Create or confirm Firebase Authentication',
        authProvisioning.initialized
          ? 'Firebase Authentication was initialized for this school project.'
          : 'Firebase Authentication is already available for this school project.'
      )
    );
    tasks.push(
      makeTask(
        'enableEmailPassword',
        authProvisioning.emailChanged ? 'done' : 'already_done',
        'Enable Email/Password sign-in',
        authProvisioning.after.emailEnabled
          ? (authProvisioning.emailChanged
            ? 'Email/Password sign-in was enabled for this school.'
            : 'Email/Password sign-in was already enabled for this school.')
          : 'Email/Password sign-in is still not enabled.',
        {
          technicalDetails: JSON.stringify({
            emailEnabled: authProvisioning.after.emailEnabled,
          }, null, 2),
        }
      )
    );
    tasks.push(
      makeTask(
        'authorizeSchoolDomain',
        authProvisioning.after.siteDomainAuthorized ? (authProvisioning.domainsChanged ? 'done' : 'already_done') : 'needs_attention',
        'Authorize the school site domain for sign-in',
        authProvisioning.after.siteDomainAuthorized
          ? `${authProvisioning.after.siteDomain} is authorized in Firebase Authentication.`
          : 'The school site domain is still not authorized for sign-in.',
        {
          actionHint: authProvisioning.after.siteDomainAuthorized ? '' : 'Check the public school domain for this hosting provider, then rerun the setup.',
          technicalDetails: JSON.stringify({
            expectedDomains: authProvisioning.expectedDomains,
            authorizedDomains: authProvisioning.after.authorizedDomains,
          }, null, 2),
        }
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'ensureAuth',
        'needs_attention',
        'Create or confirm Firebase Authentication',
        error.message || 'Firebase Authentication could not be prepared automatically.',
        {
          actionHint: 'This project may still need extra Firebase/Google setup permissions. If the school site already exists, also check the exact public host/domain.',
          technicalDetails: error.message || '',
        }
      )
    );
    tasks.push(
      makeTask(
        'enableEmailPassword',
        'needs_attention',
        'Enable Email/Password sign-in',
        'Email/Password sign-in could not be confirmed automatically.',
        {
          technicalDetails: error.message || '',
        }
      )
    );
    tasks.push(
      makeTask(
        'authorizeSchoolDomain',
        'needs_attention',
        'Authorize the school site domain for sign-in',
        'The school site domain could not be authorized automatically yet.',
        {
          actionHint: 'Check the school site domain carefully, then rerun the setup.',
          technicalDetails: error.message || '',
        }
      )
    );
  }

  const firestoreRulesBefore = await inspectRulesRelease(
    buildFirestoreReleaseName(input.projectId),
    firestoreRulesPath,
    provisioningAuth
  );
  tasks.push(summarizeFirestoreRulesInspection(firestoreRulesBefore));

  const deployedFirestoreRules = await deployRulesRelease(
    input.projectId,
    buildFirestoreReleaseName(input.projectId),
    firestoreRulesPath,
    provisioningAuth
  );
  tasks.push(
    makeTask(
      'deployFirestoreRules',
      deployedFirestoreRules.status,
      'Deploy Firestore rules',
      deployedFirestoreRules.message,
      {
        technicalDetails: JSON.stringify({
          beforeMatched: deployedFirestoreRules.before.matches,
          afterMatched: deployedFirestoreRules.after.matches,
          release: deployedFirestoreRules.after.release?.name || '',
        }, null, 2),
      }
    )
  );

  const pendingResult = await writePendingSubscription(input.projectId, serviceAccount);
  tasks.push(
    makeTask(
      'writePending',
      pendingResult.status,
      'Create or confirm the paywall-first setting',
      pendingResult.message
    )
  );

  const beforeIndexReport = await inspectFirestoreIndexes(input.projectId, provisioningAuth);
  tasks.push(summarizeIndexCheck(beforeIndexReport));

  const ensuredIndexes = await ensureFirestoreIndexes(input.projectId, provisioningAuth);
  let createIndexesTask;
  if (ensuredIndexes.createErrors.length > 0) {
    createIndexesTask = makeTask(
      'createIndexes',
      'needs_attention',
      'Create missing Firestore indexes',
      'Some Firestore indexes could not be created automatically yet.',
      {
        actionHint: 'Open the details, fix the reported issue, and click Try again.',
        technicalDetails: JSON.stringify(ensuredIndexes.createErrors, null, 2),
      }
    );
  } else if (ensuredIndexes.missingCount > 0) {
    createIndexesTask = makeTask(
      'createIndexes',
      'working',
      'Create missing Firestore indexes',
      `${ensuredIndexes.createdCount} Firestore indexes were requested. ${ensuredIndexes.missingCount} still have not appeared yet.`,
      {
        actionHint: 'Wait a little and run the setup again if the school is still not ready.',
        technicalDetails: JSON.stringify(ensuredIndexes.after, null, 2),
      }
    );
  } else if (ensuredIndexes.buildingCount > 0) {
    createIndexesTask = makeTask(
      'createIndexes',
      'working',
      'Create missing Firestore indexes',
      `${ensuredIndexes.createdCount} Firestore indexes were created. ${ensuredIndexes.buildingCount} are still building.`,
      {
        actionHint: 'You can finish the deploy steps now, but some app screens may need a little time before they work.',
        technicalDetails: JSON.stringify(ensuredIndexes.after, null, 2),
      }
    );
  } else {
    createIndexesTask = makeTask(
      'createIndexes',
      ensuredIndexes.createdCount > 0 ? 'done' : 'already_done',
      'Create missing Firestore indexes',
      ensuredIndexes.createdCount > 0
        ? `All missing Firestore indexes were created and are ready.`
        : 'All needed Firestore indexes were already there.',
      {
        technicalDetails: JSON.stringify(ensuredIndexes.after, null, 2),
      }
    );
  }
  tasks.push(createIndexesTask);

  let storageBucketName = '';
  let storageRulesStatus = makeTask(
    'storageRules',
    'needs_attention',
    'Check Storage bucket and rules',
    'No Firebase Storage bucket was found for this project.',
    {
      actionHint: 'This is okay for paywall and Starter setup, but Pro/Elite image features and Familiar sprites will need Firebase Storage enabled later.',
    }
  );

  if (!firebaseServices.storageMissing && firebaseServices.storageBucket) {
    storageBucketName = firebaseServices.storageBucket.bucket?.name || firebaseServices.storageBucket.name || '';
    const storageRulesBefore = await inspectRulesRelease(
      buildStorageReleaseName(input.projectId, storageBucketName),
      storageRulesPath,
      provisioningAuth
    );
    tasks.push(summarizeStorageRulesResult(storageBucketName, storageRulesBefore));

    const deployedStorageRules = await deployRulesRelease(
      input.projectId,
      buildStorageReleaseName(input.projectId, storageBucketName),
      storageRulesPath,
      provisioningAuth
    );
    storageRulesStatus = makeTask(
      'deployStorageRules',
      deployedStorageRules.status,
      'Deploy Storage rules',
      deployedStorageRules.message,
      {
        actionHint: 'Storage is mainly needed for Pro/Elite image features such as avatars, story images, and Familiar sprites.',
        technicalDetails: JSON.stringify({
          bucket: storageBucketName,
          beforeMatched: deployedStorageRules.before.matches,
          afterMatched: deployedStorageRules.after.matches,
          release: deployedStorageRules.after.release?.name || '',
        }, null, 2),
      }
    );
  } else {
    tasks.push(storageRulesStatus);
  }

  const renderOutput = writeRenderPaste(nextConfig);
  tasks.push(
    makeTask(
      'renderOutput',
      'done',
      'Rebuild the Render billing box value',
      'The exact value to paste into Render was rebuilt from your saved local records.'
    )
  );

  let webConfigResult;
  try {
    webConfigResult = await fetchFirebaseWebAppConfig(input.projectId, provisioningAuth);
  } catch (error) {
    webConfigResult = {
      ok: false,
      message: 'Firebase web app settings could not be loaded automatically.',
      actionHint: 'Create or check the Firebase Web App for this school, then rerun the setup.',
      technicalDetails: error.message,
      config: null,
    };
  }

  tasks.push(
    makeTask(
      'hostingOutput',
      webConfigResult.ok ? 'done' : 'needs_attention',
      'Prepare the hosting values',
      webConfigResult.ok
        ? 'The Firebase and billing values for Netlify, GitHub Pages, and Cloudflare Pages are ready to copy.'
        : webConfigResult.message,
      {
        actionHint: webConfigResult.actionHint,
        technicalDetails: webConfigResult.technicalDetails || '',
      }
    )
  );

  if (!firebaseServices.storageMissing && firebaseServices.storageBucket) {
    tasks.push(storageRulesStatus);
  }

  const subscriptionStatus = await readSubscriptionStatus(input.projectId, serviceAccount);
  const coreReady = Boolean(
    renderOutput.renderJson &&
    webConfigResult.ok &&
    subscriptionStatus.exists &&
    subscriptionStatus.tier === 'pending' &&
    ensuredIndexes.missingCount === 0 &&
    deployedFirestoreRules.after.matches &&
    authProvisioning &&
    authProvisioning.after.emailEnabled &&
    authProvisioning.after.siteDomainAuthorized
  );
  const futureProReady = Boolean(
    readinessTarget !== 'pro' ||
    (storageBucketName && storageRulesStatus.status !== 'needs_attention')
  );

  tasks.push(
    makeTask(
      'finalHealth',
      coreReady ? 'done' : 'needs_attention',
      'Run the final health check',
      coreReady
        ? readinessTarget === 'pro'
          ? 'This school is ready, including the Storage pieces needed for Pro/Elite image features and Familiar sprites.'
          : futureProReady
            ? 'This school is ready for paywall and Starter flow.'
            : 'This school is ready for paywall and Starter flow. Create Firebase Storage later before using Pro/Elite image features or Familiar sprites.'
        : 'Almost ready: one or more setup checks still need attention before this school is fully ready.',
      {
        actionHint: coreReady
          ? readinessTarget === 'pro'
            ? ''
            : 'When you are ready to sell Pro/Elite image features, rerun the setup with “Pro / Elite ready” and the tool will prepare Firebase Storage for avatars, story images, and Familiar sprites too.'
          : 'Look at the tasks above marked “Needs attention” or “Working”, then rerun the check.',
      }
    )
  );

  return {
    defaults,
    tasks,
    outputs: {
      renderJson: renderOutput.renderJson,
      hostingTargets: buildHostingTargets(webConfigResult.config, input.renderUrl, input.projectId),
      hostingEnvVars: formatHostedEnvironmentVariables(webConfigResult.config, input.renderUrl, input.projectId),
      netlifyVars: formatNetlifyVariables(webConfigResult.config, input.renderUrl, input.projectId),
      webConfig: webConfigResult.config,
      renderPath: renderOutput.path,
      firebaseWebConfigStatus: webConfigResult.ok ? 'ready' : 'missing',
    },
    finalStatus: coreReady && futureProReady ? 'ready' : 'needs_attention',
    summary: coreReady
      ? readinessTarget === 'pro'
        ? 'This school is ready for Pro or Elite. Paste the Render value, configure your hosting provider, and you are done.'
        : futureProReady
          ? 'This school is ready for Starter. Paste the Render value, configure your hosting provider, and you are done.'
          : 'This school is ready for Starter flow. Later, when the school upgrades, rerun the setup with “Pro / Elite ready” and the tool will prepare Firebase Storage too.'
      : 'The setup is close, but one thing still needs attention before the school is fully ready.',
  };
}

function getSavedSchools() {
  const editable = ensureEditableSchoolsConfig();
  return (editable.data.schools || []).map((school) => normalizeSchoolRecord(school));
}

async function recheckExistingSchool(projectId, options = {}) {
  const schools = getSavedSchools();
  const school = schools.find((item) => item.schoolId === projectId || item.firebaseProjectId === projectId);
  if (!school) {
    throw new Error('That school is not in your saved local billing list yet.');
  }
  if (!school.firebaseServiceAccountPath) {
    throw new Error('This saved school does not have a Firebase key path yet.');
  }
  const keyPath = school.firebaseServiceAccountPath.startsWith('.')
    ? path.join(billingDir, school.firebaseServiceAccountPath.replace(/^\.\//, ''))
    : school.firebaseServiceAccountPath;
  if (!fs.existsSync(keyPath)) {
    throw new Error('The saved Firebase key file for this school could not be found.');
  }

  const serviceAccount = readJson(keyPath);
  const bootstrapAdmin = await getOptionalBootstrapAdminAuth();
  const bootstrapStatus = await inspectBootstrapAdminAuth();
  const provisioningAuth = bootstrapAdmin || serviceAccount;
  const defaults = saveDefaults({
    readinessTarget: options.readinessTarget,
    firebaseLocation: options.firebaseLocation,
  });
  const readinessTarget = normalizeReadinessTarget(options.readinessTarget || defaults.readinessTarget);
  const firebaseLocation = normalizeFirebaseLocation(options.firebaseLocation || defaults.firebaseLocation);
  const tasks = [];

  tasks.push(
    makeTask(
      'savedSchool',
      'done',
      'Find this school in your local billing records',
      'The school was found in your saved local setup list.'
    )
  );
  tasks.push(
    makeTask(
      'bootstrapLogin',
      bootstrapStatus.available ? 'done' : 'working',
      'Use your Google admin login for one-time project setup',
      bootstrapStatus.available
        ? bootstrapStatus.message
        : 'No local Google admin login was found. The console will try the school key, but Starter-to-Pro upgrades are much smoother if you first sign in with your Google admin account on this machine.',
      {
        actionHint: bootstrapStatus.available ? '' : bootstrapStatus.actionHint,
        technicalDetails: bootstrapStatus.technicalDetails || '',
      }
    )
  );

  if (bootstrapAdmin) {
    try {
      const iamResult = await ensureBootstrapServiceUsageAccess(projectId, serviceAccount, bootstrapAdmin);
      tasks.push(
        makeTask(
          'grantServiceUsageRoles',
          iamResult.status,
          'Let the school Firebase key use Google services later',
          iamResult.message,
          {
            technicalDetails: JSON.stringify({
              member: iamResult.member,
              roles: iamResult.roles,
            }, null, 2),
          }
        )
      );
    } catch (error) {
      tasks.push(
        makeTask(
          'grantServiceUsageRoles',
          'working',
          'Let the school Firebase key use Google services later',
          'Your Google admin login is ready, but it could not automatically grant the extra Google service roles to the school key yet.',
          {
            actionHint: 'That is not fatal right now because the console can keep using your Google admin login for the one-time provisioning tasks.',
            technicalDetails: error.message || '',
          }
        )
      );
    }
  }

  try {
    const enabledServices = await enableRequiredServices(projectId, provisioningAuth, readinessTarget);
    tasks.push(
      makeTask(
        'enableApis',
        'done',
        'Enable the Google and Firebase services this school needs',
        readinessTarget === 'pro'
          ? 'The required Google/Firebase services were enabled or already ready for Pro/Elite features.'
          : 'The required Google/Firebase services were enabled or already ready for Starter flow.',
        {
          technicalDetails: JSON.stringify(enabledServices.services, null, 2),
        }
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'enableApis',
        'needs_attention',
        'Enable the Google and Firebase services this school needs',
        error.message || 'The required Google/Firebase services could not be enabled automatically.',
        {
          actionHint: 'This usually means the service account does not have enough Google Cloud permission.',
          technicalDetails: error.message || '',
        }
      )
    );
  }

  try {
    const firestoreReady = await ensureFirestoreReady(projectId, provisioningAuth, firebaseLocation);
    tasks.push(
      makeTask(
        'ensureFirestore',
        firestoreReady.status,
        'Create or confirm the Firestore database',
        firestoreReady.created
          ? `A Firestore database was created for this school in ${firebaseLocation}.`
          : 'The Firestore database already exists for this school.'
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'ensureFirestore',
        'needs_attention',
        'Create or confirm the Firestore database',
        error.message || 'The Firestore database could not be confirmed automatically.',
        {
          actionHint: 'Check permissions and rerun this school check.',
          technicalDetails: error.message || '',
        }
      )
    );
  }

  let firebaseServices;
  let authProvisioning = null;
  try {
    firebaseServices = await inspectFirebaseServices(projectId, provisioningAuth);
    tasks.push(
      makeTask(
        'checkFirebase',
        'done',
        'Check Firebase services',
        'Cloud Firestore is enabled for this project and can be reached.',
        {
          actionHint: firebaseServices.storageMissing
            ? 'Firebase Storage is not set up yet. That is okay for paywall and Starter flow, but Pro/Elite image features and Familiar sprites will need it later.'
            : '',
        }
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'checkFirebase',
        'needs_attention',
        'Check Firebase services',
        error.message || 'Firebase services could not be reached yet.',
        {
          actionHint: 'Enable Cloud Firestore and create the Firestore database for this project, then rerun this school check.',
          technicalDetails: error.message || '',
        }
      )
    );
    return {
      defaults,
      school,
      tasks,
      outputs: {
        renderJson: '',
        netlifyVars: '',
        webConfig: null,
        renderPath: renderPastePath,
        firebaseWebConfigStatus: 'missing',
      },
      finalStatus: 'needs_attention',
      summary: 'Cloud Firestore is not ready for this school yet.',
    };
  }

  try {
    authProvisioning = await ensureFirebaseAuthReady(projectId, provisioningAuth, school.siteDomain);
    tasks.push(
      makeTask(
        'ensureAuth',
        authProvisioning.initialized ? 'done' : 'already_done',
        'Create or confirm Firebase Authentication',
        authProvisioning.initialized
          ? 'Firebase Authentication was initialized for this school project.'
          : 'Firebase Authentication is already available for this school project.'
      )
    );
    tasks.push(
      makeTask(
        'enableEmailPassword',
        authProvisioning.emailChanged ? 'done' : 'already_done',
        'Enable Email/Password sign-in',
        authProvisioning.after.emailEnabled
          ? (authProvisioning.emailChanged
            ? 'Email/Password sign-in was enabled for this school.'
            : 'Email/Password sign-in was already enabled for this school.')
          : 'Email/Password sign-in is still not enabled.',
        {
          technicalDetails: JSON.stringify({
            emailEnabled: authProvisioning.after.emailEnabled,
          }, null, 2),
        }
      )
    );
    tasks.push(
      makeTask(
        'authorizeSchoolDomain',
        authProvisioning.after.siteDomainAuthorized ? (authProvisioning.domainsChanged ? 'done' : 'already_done') : 'needs_attention',
        'Authorize the school site domain for sign-in',
        authProvisioning.after.siteDomainAuthorized
          ? `${authProvisioning.after.siteDomain} is authorized in Firebase Authentication.`
          : 'The saved school site domain is still not authorized for sign-in.',
        {
          actionHint: authProvisioning.after.siteDomainAuthorized ? '' : 'Save the correct public school domain for this host, then rerun the check.',
          technicalDetails: JSON.stringify({
            expectedDomains: authProvisioning.expectedDomains,
            authorizedDomains: authProvisioning.after.authorizedDomains,
          }, null, 2),
        }
      )
    );
  } catch (error) {
    tasks.push(
      makeTask(
        'ensureAuth',
        'needs_attention',
        'Create or confirm Firebase Authentication',
        error.message || 'Firebase Authentication could not be prepared automatically.',
        {
          technicalDetails: error.message || '',
        }
      )
    );
    tasks.push(
      makeTask(
        'enableEmailPassword',
        'needs_attention',
        'Enable Email/Password sign-in',
        'Email/Password sign-in could not be confirmed automatically.',
        {
          technicalDetails: error.message || '',
        }
      )
    );
    tasks.push(
      makeTask(
        'authorizeSchoolDomain',
        'needs_attention',
        'Authorize the school site domain for sign-in',
        'The saved school site domain could not be authorized automatically yet.',
        {
          technicalDetails: error.message || '',
        }
      )
    );
  }

  let storageBucketName = '';
  try {
    const storageReady = await ensureStorageReady(projectId, provisioningAuth, firebaseLocation, readinessTarget);
    tasks.push(
      makeTask(
        'ensureStorage',
        storageReady.status === 'skipped' ? 'already_done' : storageReady.status,
        'Create or confirm the Firebase Storage bucket',
        storageReady.status === 'skipped'
          ? 'Starter flow does not require Firebase Storage yet.'
          : storageReady.created
            ? `A Firebase Storage bucket was created for this school in ${firebaseLocation}.`
            : 'The Firebase Storage bucket already exists for this school.',
        {
          actionHint: readinessTarget === 'pro'
            ? 'Pro and Elite image features need Storage to exist.'
            : '',
        }
      )
    );
    if (storageReady.storageBucket) {
      firebaseServices.storageBucket = storageReady.storageBucket;
      firebaseServices.storageMissing = false;
      storageBucketName = storageReady.storageBucket.bucket?.name || storageReady.storageBucket.name || '';
    }
  } catch (error) {
    tasks.push(
      makeTask(
        'ensureStorage',
        readinessTarget === 'pro' ? 'needs_attention' : 'already_done',
        'Create or confirm the Firebase Storage bucket',
        readinessTarget === 'pro'
          ? (error.message || 'The Firebase Storage bucket could not be created automatically.')
          : 'Starter flow does not require Firebase Storage yet.',
        {
          actionHint: readinessTarget === 'pro'
            ? 'This often means billing/Blaze is not enabled yet for this Firebase project.'
            : '',
          technicalDetails: readinessTarget === 'pro' ? (error.message || '') : '',
        }
      )
    );
  }

  let firestoreRulesCheck = await inspectRulesRelease(
    buildFirestoreReleaseName(projectId),
    firestoreRulesPath,
    provisioningAuth
  );
  tasks.push(summarizeFirestoreRulesInspection(firestoreRulesCheck));
  if (!firestoreRulesCheck.matches) {
    const deployedFirestoreRules = await deployRulesRelease(
      projectId,
      buildFirestoreReleaseName(projectId),
      firestoreRulesPath,
      provisioningAuth
    );
    tasks.push(
      makeTask(
        'deployFirestoreRules',
        deployedFirestoreRules.status,
        'Deploy Firestore rules',
        deployedFirestoreRules.message
      )
    );
    firestoreRulesCheck = deployedFirestoreRules.after;
  }

  const subscription = await readSubscriptionStatus(projectId, serviceAccount);
  if (subscription.exists) {
    tasks.push(
      makeTask(
        'subscriptionCheck',
        subscription.tier === 'pending' ? 'done' : 'already_done',
        'Check the paywall setting',
        subscription.tier === 'pending'
          ? 'The school is still set to show the paywall first.'
          : `The school subscription document exists and currently says "${subscription.tier}".`
      )
    );
  } else {
    tasks.push(
      makeTask(
        'subscriptionCheck',
        'needs_attention',
        'Check the paywall setting',
        'The subscription document is missing from Firestore.',
        {
          actionHint: 'Run the full automatic setup again to recreate the paywall-first setting.',
        }
      )
    );
  }

  let indexReport = await inspectFirestoreIndexes(projectId, provisioningAuth);
  tasks.push(summarizeIndexCheck(indexReport));
  if (indexReport.missingCount > 0) {
    const ensuredIndexes = await ensureFirestoreIndexes(projectId, provisioningAuth);
    tasks.push(
      makeTask(
        'createIndexes',
        ensuredIndexes.missingCount === 0 ? (ensuredIndexes.createdCount > 0 ? 'done' : 'already_done') : 'working',
        'Create missing Firestore indexes',
        ensuredIndexes.missingCount === 0
          ? 'All needed Firestore indexes are ready for this school.'
          : `${ensuredIndexes.createdCount} missing indexes were requested. Some are still building.`,
        {
          actionHint: ensuredIndexes.missingCount === 0 ? '' : 'Wait a little, then rerun this school check if needed.',
          technicalDetails: JSON.stringify(ensuredIndexes.after, null, 2),
        }
      )
    );
    indexReport = {
      ...indexReport,
      missingCount: ensuredIndexes.missingCount,
    };
  }

  if (!firebaseServices.storageMissing && firebaseServices.storageBucket) {
    storageBucketName = firebaseServices.storageBucket.bucket?.name || firebaseServices.storageBucket.name || storageBucketName;
    let storageRulesCheck = await inspectRulesRelease(
      buildStorageReleaseName(projectId, storageBucketName),
      storageRulesPath,
      provisioningAuth
    );
    tasks.push(summarizeStorageRulesResult(storageBucketName, storageRulesCheck));
    if (!storageRulesCheck.matches) {
      const deployedStorageRules = await deployRulesRelease(
        projectId,
        buildStorageReleaseName(projectId, storageBucketName),
        storageRulesPath,
        provisioningAuth
      );
      tasks.push(
        makeTask(
          'deployStorageRules',
          deployedStorageRules.status,
          'Deploy Storage rules',
          deployedStorageRules.message,
          {
            actionHint: 'Storage is mainly needed for Pro/Elite image features and Familiar sprites.',
          }
        )
      );
      storageRulesCheck = deployedStorageRules.after;
    }
  } else {
    tasks.push(
      makeTask(
        'storageRules',
        readinessTarget === 'pro' ? 'needs_attention' : 'already_done',
        'Check Storage bucket and rules',
        readinessTarget === 'pro'
          ? 'No Firebase Storage bucket was found for this project.'
          : 'Starter flow does not require Firebase Storage yet.',
        {
          actionHint: readinessTarget === 'pro'
            ? 'Pro/Elite image features and Familiar sprites need Firebase Storage.'
            : 'When a school upgrades later, rerun this tool with “Pro / Elite ready”.',
        }
      )
    );
  }

  const editable = ensureEditableSchoolsConfig();
  const renderOutput = writeRenderPaste(editable.data);
  let webConfigResult;
  try {
    webConfigResult = await fetchFirebaseWebAppConfig(projectId, provisioningAuth);
  } catch (error) {
    webConfigResult = {
      ok: false,
      config: null,
      message: 'Firebase web app settings could not be loaded automatically.',
      actionHint: 'Check that this Firebase project has a Web App configured.',
      technicalDetails: error.message,
    };
  }

  const ready = Boolean(
    subscription.exists &&
    renderOutput.renderJson &&
    authProvisioning &&
    authProvisioning.after.emailEnabled &&
    authProvisioning.after.siteDomainAuthorized &&
    firestoreRulesCheck.exists &&
    firestoreRulesCheck.matches &&
    indexReport.missingCount === 0 &&
    webConfigResult.ok &&
    (readinessTarget !== 'pro' || Boolean(storageBucketName))
  );

  tasks.push(
    makeTask(
      'finalHealth',
      ready ? 'done' : 'needs_attention',
      'Run the final health check',
      ready
        ? readinessTarget === 'pro'
          ? 'This saved school looks ready for Pro/Elite, including Storage.'
          : 'This saved school looks ready for Starter flow.'
        : 'This school still needs attention before it is fully ready.',
      {
        actionHint: ready ? '' : 'Fix the checks above, then rerun this school check.',
      }
    )
  );

  return {
    defaults,
    school,
    tasks,
    outputs: {
      renderJson: renderOutput.renderJson,
      hostingTargets: buildHostingTargets(webConfigResult.config, defaults.renderUrl, projectId),
      hostingEnvVars: formatHostedEnvironmentVariables(webConfigResult.config, defaults.renderUrl, projectId),
      netlifyVars: formatNetlifyVariables(webConfigResult.config, defaults.renderUrl, projectId),
      webConfig: webConfigResult.config,
      renderPath: renderOutput.path,
      firebaseWebConfigStatus: webConfigResult.ok ? 'ready' : 'missing',
    },
    finalStatus: ready ? 'ready' : 'needs_attention',
    summary: ready
      ? readinessTarget === 'pro'
        ? 'This school looks ready for Pro or Elite.'
        : 'This school looks ready for Starter flow.'
      : 'This school still needs attention.',
  };
}

async function getBootstrapData() {
  return {
    defaults: loadDefaults(),
    schools: getSavedSchools().map((school) => ({
      schoolId: school.schoolId,
      schoolLabel: school.schoolLabel,
      firebaseProjectId: school.firebaseProjectId,
    })),
    bootstrapAdmin: await inspectBootstrapAdminAuth(),
    gcloud: inspectGcloudCli(),
  };
}

module.exports = {
  DEFAULT_DEFAULTS,
  defaultsPath,
  schoolsLocalPath,
  renderPastePath,
  firestoreIndexesPath,
  firestoreRulesPath,
  storageRulesPath,
  normalizePriceIds,
  validateProjectId,
  validateRenderUrl,
  validatePriceIds,
  validateSchoolLabel,
  validateSetupInput,
  parseServiceAccount,
  loadDefaults,
  saveDefaults,
  ensureEditableSchoolsConfig,
  normalizeSchoolRecord,
  saveServiceAccountKey,
  upsertSchoolConfig,
  buildRenderPayload,
  buildManualSubscriptionPayload,
  buildFirestoreReleaseName,
  buildStorageReleaseName,
  extractProjectNumber,
  buildServiceUsageConsumerName,
  summarizeAssessmentDefaults,
  summarizeGoogleErrorText,
  inspectBootstrapAdminAuth,
  inspectGcloudCli,
  startBootstrapAdminLogin,
  setBootstrapQuotaProject,
  getSavedSchoolDetails,
  updateSavedSchoolSubscription,
  deleteSavedSchool,
  writeRenderPaste,
  inspectFirebaseServices,
  inspectRulesRelease,
  deployRulesRelease,
  loadRequiredIndexes,
  normalizeIndex,
  compareRequiredIndexes,
  formatHostedEnvironmentVariables,
  formatNetlifyVariables,
  buildHostingTargets,
  fetchFirebaseWebAppConfig,
  inspectFirestoreIndexes,
  ensureFirestoreIndexes,
  writePendingSubscription,
  readSubscriptionStatus,
  runAutomaticSetup,
  recheckExistingSchool,
  getSavedSchools,
  getBootstrapData,
};
