const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { JWT } = require('google-auth-library');

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
const pendingTierPath = path.join(repoRoot, 'config', 'tiers', 'pending.json');

const DEFAULT_DEFAULTS = {
  renderUrl: '',
  priceIds: {
    starter: '',
    pro: '',
    elite: '',
  },
  lastSchoolLabel: '',
  lastProjectId: '',
};

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase',
];

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

function loadDefaults() {
  const fileDefaults = loadJsonIfExists(defaultsPath, {});
  const localPriceIds = loadJsonIfExists(priceIdsLocalPath, {});
  return {
    ...clone(DEFAULT_DEFAULTS),
    ...fileDefaults,
    priceIds: {
      ...clone(DEFAULT_DEFAULTS.priceIds),
      ...normalizePriceIds(localPriceIds),
      ...normalizePriceIds(fileDefaults.priceIds || {}),
    },
  };
}

function saveDefaults(nextDefaults = {}) {
  const merged = {
    ...loadDefaults(),
    ...nextDefaults,
    priceIds: {
      ...loadDefaults().priceIds,
      ...normalizePriceIds(nextDefaults.priceIds || {}),
    },
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

async function getAuthHeaders(serviceAccount) {
  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: OAUTH_SCOPES,
  });
  return client.getRequestHeaders();
}

async function googleJsonRequest(url, serviceAccount, options = {}) {
  const headers = {
    ...(await getAuthHeaders(serviceAccount)),
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
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
    const detail = json && json.error ? json.error.message || JSON.stringify(json.error) : text || response.statusText;
    const err = new Error(detail || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.payload = json;
    throw err;
  }
  return json;
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
      normalizeIndex({
        collectionGroup: index.collectionGroup,
        queryScope: index.queryScope || 'COLLECTION',
        fields: index.fields || [],
      }),
      index
    );
  }

  return requiredIndexes.map((required) => {
    const existing = existingMap.get(normalizeIndex(required));
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
  for (const item of missing) {
    try {
      await createIndex(projectId, serviceAccount, item);
    } catch (error) {
      createErrors.push({
        index: item,
        message: error.message,
      });
    }
  }

  const maxAttempts = options.maxAttempts || 4;
  const delayMs = options.delayMs || 1500;
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

function formatNetlifyVariables(webConfig, renderUrl, projectId) {
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

async function runAutomaticSetup(input) {
  const validation = validateSetupInput(input);
  if (!validation.ok) {
    const error = new Error(validation.errors.join(' '));
    error.validationErrors = validation.errors;
    throw error;
  }

  const serviceAccount = parseServiceAccount(input.serviceAccount);
  const defaults = saveDefaults({
    renderUrl: input.renderUrl,
    priceIds: input.priceIds,
    lastProjectId: input.projectId,
    lastSchoolLabel: input.schoolLabel,
  });

  const tasks = [];
  const editable = ensureEditableSchoolsConfig();
  const savedKey = saveServiceAccountKey(input.projectId, serviceAccount);
  tasks.push(makeTask('copyKey', savedKey.status, 'Save the Firebase key safely', savedKey.message));

  const nextConfig = upsertSchoolConfig(
    editable.data,
    {
      schoolId: input.projectId,
      schoolLabel: input.schoolLabel,
      stripeCustomerId: null,
      firebaseProjectId: input.projectId,
      firebaseServiceAccountPath: savedKey.relativeKeyPath,
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

  const pendingResult = await writePendingSubscription(input.projectId, serviceAccount);
  tasks.push(
    makeTask(
      'writePending',
      pendingResult.status,
      'Create or confirm the paywall-first setting',
      pendingResult.message
    )
  );

  const beforeIndexReport = await inspectFirestoreIndexes(input.projectId, serviceAccount);
  tasks.push(summarizeIndexCheck(beforeIndexReport));

  const ensuredIndexes = await ensureFirestoreIndexes(input.projectId, serviceAccount);
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
    webConfigResult = await fetchFirebaseWebAppConfig(input.projectId, serviceAccount);
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
      'netlifyOutput',
      webConfigResult.ok ? 'done' : 'needs_attention',
      'Prepare the Netlify values',
      webConfigResult.ok
        ? 'The Firebase and billing values for Netlify are ready to copy.'
        : webConfigResult.message,
      {
        actionHint: webConfigResult.actionHint,
        technicalDetails: webConfigResult.technicalDetails || '',
      }
    )
  );

  const subscriptionStatus = await readSubscriptionStatus(input.projectId, serviceAccount);
  const finalReady = Boolean(
    renderOutput.renderJson &&
    webConfigResult.ok &&
    subscriptionStatus.exists &&
    subscriptionStatus.tier === 'pending' &&
    ensuredIndexes.missingCount === 0
  );

  tasks.push(
    makeTask(
      'finalHealth',
      finalReady ? 'done' : 'needs_attention',
      'Run the final health check',
      finalReady
        ? 'This school is ready. You only need to paste the final values into Render and Netlify.'
        : 'Almost ready: one or more setup checks still need attention before this school is fully ready.',
      {
        actionHint: finalReady ? '' : 'Look at the tasks above marked “Needs attention” or “Working”, then rerun the check.',
      }
    )
  );

  return {
    defaults,
    tasks,
    outputs: {
      renderJson: renderOutput.renderJson,
      netlifyVars: formatNetlifyVariables(webConfigResult.config, input.renderUrl, input.projectId),
      webConfig: webConfigResult.config,
      renderPath: renderOutput.path,
      firebaseWebConfigStatus: webConfigResult.ok ? 'ready' : 'missing',
    },
    finalStatus: finalReady ? 'ready' : 'needs_attention',
    summary: finalReady
      ? 'This school is ready. Paste the Render and Netlify values, deploy both, and you are done.'
      : 'The setup is close, but one thing still needs attention before the school is fully ready.',
  };
}

function getSavedSchools() {
  const editable = ensureEditableSchoolsConfig();
  return (editable.data.schools || []).map((school) => normalizeSchoolRecord(school));
}

async function recheckExistingSchool(projectId) {
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
  const defaults = loadDefaults();
  const tasks = [];

  tasks.push(
    makeTask(
      'savedSchool',
      'done',
      'Find this school in your local billing records',
      'The school was found in your saved local setup list.'
    )
  );

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

  const indexReport = await inspectFirestoreIndexes(projectId, serviceAccount);
  tasks.push(summarizeIndexCheck(indexReport));

  const editable = ensureEditableSchoolsConfig();
  const renderOutput = writeRenderPaste(editable.data);
  let webConfigResult;
  try {
    webConfigResult = await fetchFirebaseWebAppConfig(projectId, serviceAccount);
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
    indexReport.missingCount === 0 &&
    webConfigResult.ok
  );
  tasks.push(
    makeTask(
      'finalHealth',
      ready ? 'done' : 'needs_attention',
      'Run the final health check',
      ready
        ? 'This saved school looks ready.'
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
      netlifyVars: formatNetlifyVariables(webConfigResult.config, defaults.renderUrl, projectId),
      webConfig: webConfigResult.config,
      renderPath: renderOutput.path,
      firebaseWebConfigStatus: webConfigResult.ok ? 'ready' : 'missing',
    },
    finalStatus: ready ? 'ready' : 'needs_attention',
    summary: ready
      ? 'This school looks ready.'
      : 'This school still needs attention.',
  };
}

function getBootstrapData() {
  return {
    defaults: loadDefaults(),
    schools: getSavedSchools().map((school) => ({
      schoolId: school.schoolId,
      schoolLabel: school.schoolLabel,
      firebaseProjectId: school.firebaseProjectId,
    })),
  };
}

module.exports = {
  DEFAULT_DEFAULTS,
  defaultsPath,
  schoolsLocalPath,
  renderPastePath,
  firestoreIndexesPath,
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
  writeRenderPaste,
  loadRequiredIndexes,
  normalizeIndex,
  compareRequiredIndexes,
  formatNetlifyVariables,
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
