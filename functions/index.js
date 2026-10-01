const { getApp, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldPath, FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const crypto = require('node:crypto');
const { publicEmberNote, mergePublishedEmber } = require('./campfireCore.cjs');
const functionsV1 = require('firebase-functions/v1');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { HttpsError } = require('firebase-functions/v1/https');

initializeApp();

const db = getFirestore();
const auth = getAuth();
// Cloud Storage is only needed by a few functions (portraits, market pictures, purges), so its
// client loads on first use instead of slowing every function's cold start.
let storageClient = null;
function getStorageClient() {
  if (!storageClient) {
    const { getStorage } = require('firebase-admin/storage');
    storageClient = getStorage();
  }
  return storageClient;
}
const storage = { bucket: (...args) => getStorageClient().bucket(...args) };
const FUNCTIONS_REGION = process.env.GCQ_FIREBASE_FUNCTIONS_REGION || 'europe-west1';
const LEFT_SCHOOL_PURGE_DAYS = 30;
// Former students keep every record until the Secretary deletes them by hand.
// Flip to true to bring back the old automatic purge LEFT_SCHOOL_PURGE_DAYS after leaving.
const AUTO_PURGE_LEFT_STUDENTS = false;
const FORMER_STUDENT_REASONS = ['moved', 'graduated', 'other'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const PROFILE_COLLECTION = 'user_profiles';
const SUBSCRIPTION_DOC = 'appConfig/subscription';
const SECRETARY_ROLE_DOC = `${PUBLIC_DATA_PATH}/school_roles/secretary`;
const SECRETARY_BOOTSTRAP_DOC = `${PUBLIC_DATA_PATH}/admin_bootstrap/secretary`;
const RECENT_AUTH_WINDOW_SECONDS = 10 * 60;

/**
 * Non-blocking Special Quest effect observer. Core Stars/Gold are committed
 * by the teacher transaction; the browser applies the existing Guild/Familiar
 * adapters immediately, while this 2nd-gen trigger records that a retryable
 * action reached the backend without falsely marking failed effects complete.
 */
exports.reconcileSpecialQuestEffects = onDocumentCreated({
  document: `${PUBLIC_DATA_PATH}/quest_event_actions/{actionId}`,
  region: FUNCTIONS_REGION,
}, async (event) => {
  const action = event.data?.data();
  if (!action || action.coreStatus !== 'applied') return null;
  const actionRef = db.doc(`${PUBLIC_DATA_PATH}/quest_event_actions/${event.params.actionId}`);
  const receiptRef = db.doc(`${PUBLIC_DATA_PATH}/quest_effect_receipts/${event.params.actionId}`);
  await db.runTransaction(async (transaction) => {
    const receipt = await transaction.get(receiptRef);
    if (receipt.exists) return;
    transaction.set(receiptRef, {
      schemaVersion: 1,
      actionId: event.params.actionId,
      eventId: action.eventId,
      recipientIds: action.recipientIds || [],
      effectType: action.type === 'reversal' ? 'reversal' : 'completion',
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(actionRef, {
      workerObservedAt: FieldValue.serverTimestamp(),
    });
  });
  return null;
});

function getProjectId() {
  return getApp().options.projectId || process.env.GCLOUD_PROJECT || 'gcq-school';
}

function sanitizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^\.+|\.+$/g, '');
}

function buildSyntheticRoleEmail(role, username) {
  return `${role}.${sanitizeUsername(username)}@${getProjectId().toLowerCase()}.gcq.local`;
}

function hashSecretarySetupToken(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function tokenHashesMatch(expected, actual) {
  const left = Buffer.from(String(expected || ''), 'hex');
  const right = Buffer.from(String(actual || ''), 'hex');
  return left.length === 32 && right.length === 32 && crypto.timingSafeEqual(left, right);
}

function getAcademicYearKeys(date = new Date()) {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return {
    activeYearKey: `${startYear}-${startYear + 1}`,
    nextYearKey: `${startYear + 1}-${startYear + 2}`
  };
}

function mapAdminAuthError(error, fallbackMessage) {
  const code = String(error?.code || '');
  if (code === 'auth/email-already-exists') {
    return new HttpsError('already-exists', 'That username is already in use.');
  }
  if (code === 'auth/user-not-found') {
    return new HttpsError('not-found', 'That login account no longer exists and needs to be recreated.');
  }
  if (code === 'auth/invalid-password' || code === 'auth/password-too-short') {
    return new HttpsError('invalid-argument', 'Use a stronger password with at least 6 characters.');
  }
  if (code === 'auth/invalid-email') {
    return new HttpsError('invalid-argument', 'That username could not be turned into a valid login email.');
  }
  return new HttpsError('internal', fallbackMessage);
}

// Starts the reads every signed-in call needs (profile, Secretary role, school plan) the moment
// the call arrives, so they overlap with the plan check and the call's own reads instead of
// running one after another. A call checks them at most once, however many helpers ask.
function prefetchCallerReads(request) {
  if (!request.auth?.uid || request.callerReads) return;
  void getSubscriptionConfig().catch(() => {});
  const reads = Promise.all([
    db.collection(PROFILE_COLLECTION).doc(request.auth.uid).get(),
    db.doc(SECRETARY_ROLE_DOC).get()
  ]);
  reads.catch(() => {});
  request.callerReads = reads;
}

async function requireAuthedCaller(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in first.');
  }
  if (!request.callerPromise) {
    request.callerPromise = resolveAuthedCaller(request);
    request.callerPromise.catch(() => {});
  }
  return request.callerPromise;
}

async function resolveAuthedCaller(request) {
  prefetchCallerReads(request);
  const [profileSnap, secretaryRoleSnap] = await request.callerReads;
  if (!profileSnap.exists) {
    throw new HttpsError('permission-denied', 'This account is missing its required access profile.');
  }
  const profile = profileSnap.data() || {};
  if (profile.status !== 'active' || !['teacher', 'secretary', 'parent'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'This account is inactive or has an invalid role.');
  }
  return { uid: request.auth.uid, profile, secretaryRoleSnap };
}

async function isCanonicalSecretaryCaller(caller) {
  if (!caller || caller.profile?.role !== 'secretary') return false;
  const roleSnap = caller.secretaryRoleSnap || await db.doc(SECRETARY_ROLE_DOC).get();
  return roleSnap.exists &&
    roleSnap.data()?.uid === caller.uid &&
    roleSnap.data()?.status === 'active';
}

async function requireCanonicalSecretaryCaller(caller) {
  if (!await isCanonicalSecretaryCaller(caller)) {
    throw new HttpsError('permission-denied', 'Only the active canonical Secretary/admin can perform this action.');
  }
  return caller;
}

// The school plan changes rarely; a warm instance reuses it for a short while instead of
// reading it again on every call.
const SUBSCRIPTION_CACHE_MS = 30 * 1000;
let subscriptionCache = null;
function getSubscriptionConfig() {
  const now = Date.now();
  if (subscriptionCache && now - subscriptionCache.at < SUBSCRIPTION_CACHE_MS) return subscriptionCache.promise;
  const promise = db.doc(SUBSCRIPTION_DOC).get().then((snap) => (snap.exists ? (snap.data() || {}) : {}));
  subscriptionCache = { at: now, promise };
  promise.catch(() => {
    if (subscriptionCache?.promise === promise) subscriptionCache = null;
  });
  return promise;
}

async function getActiveSchoolYearKey() {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
  const yearKey = snap.exists ? String(snap.data()?.activeYearKey || '').trim() : '';
  if (!/^\d{4}-\d{4}$/.test(yearKey)) {
    throw new HttpsError('failed-precondition', 'The active school year is not configured. Year-scoped writes are blocked.');
  }
  return yearKey;
}

async function getPlannedSchoolYearKey() {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
  const yearKey = snap.exists ? String(snap.data()?.nextYearKey || '').trim() : '';
  if (!/^\d{4}-\d{4}$/.test(yearKey)) {
    throw new HttpsError('failed-precondition', 'The planned school year is not configured.');
  }
  return yearKey;
}

async function requireFeatureEnabled(featureKey) {
  const subscription = await getSubscriptionConfig();
  const tier = String(subscription.tier || '').trim().toLowerCase();
  const directFlag = subscription[featureKey];
  if (directFlag === true) return subscription;

  if (featureKey === 'parentAccess' && (tier === 'pro' || tier === 'elite')) return subscription;
  if (featureKey === 'secretaryAccess' && tier === 'elite') return subscription;
  if (featureKey === 'eliteAI' && tier === 'elite') return subscription;
  if (featureKey === 'heroCampfire' && directFlag === undefined && ['pro', 'elite'].includes(tier)) return subscription;

  throw new HttpsError('failed-precondition', 'This school plan does not include that access feature yet.');
}

// People wait on every callable, so each one runs on a 1GB instance: 1st gen functions get
// CPU in proportion to memory, and the 256MB default made cold starts and work several times slower.
const CALLABLE_MEMORY = '1GB';

function callable(handler, options = {}) {
  let builder = functionsV1.region(FUNCTIONS_REGION);
  const runWith = { memory: CALLABLE_MEMORY };
  if (options.timeoutSeconds) runWith.timeoutSeconds = options.timeoutSeconds;
  if (options.memory) runWith.memory = options.memory;
  if (options.secrets) runWith.secrets = options.secrets;
  if (Object.keys(runWith).length) {
    builder = builder.runWith(runWith);
  }
  return builder.https.onCall(async (data, context) => {
    const request = {
      data,
      auth: context.auth || null,
      rawRequest: context.rawRequest || null
    };
    prefetchCallerReads(request);
    return handler(request);
  });
}

async function getStudent(studentId) {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'That student could not be found.');
  }
  return { id: snap.id, ...snap.data() };
}

// Like Promise.all, but waits for every read and reports the first failure in list order.
// Permission checks go first in the list, so a caller who may not act never learns anything
// from the other reads (such as whether a record exists).
async function allInOrder(promises) {
  const results = await Promise.allSettled(promises);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results.map((result) => result.value);
}

function callerAnd(request, promise) {
  return allInOrder([requireAuthedCaller(request), promise]);
}

async function requireStudentManager(request, studentId) {
  const [caller, student] = await callerAnd(request, getStudent(studentId));
  const isSecretary = await isCanonicalSecretaryCaller(caller);
  if (!isSecretary && student.createdBy?.uid !== caller.uid) {
    throw new HttpsError('permission-denied', 'You can only manage access for your own students.');
  }
  return { caller, student };
}

async function requireClassManager(request, classId) {
  const [caller, classSnap] = await callerAnd(request, db.doc(`${PUBLIC_DATA_PATH}/classes/${classId}`).get());
  if (!classSnap.exists) {
    throw new HttpsError('not-found', 'That class could not be found.');
  }
  const classData = { id: classSnap.id, ...classSnap.data() };
  const isSecretary = await isCanonicalSecretaryCaller(caller);
  if (!isSecretary && classData.createdBy?.uid !== caller.uid) {
    throw new HttpsError('permission-denied', 'You can only manage homework sync for your own classes.');
  }
  return { caller, classData };
}

async function getParentLink(studentId) {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function buildPurgeAfterAt(fromMs = Date.now()) {
  return Timestamp.fromMillis(fromMs + (LEFT_SCHOOL_PURGE_DAYS * MS_PER_DAY));
}

async function disableParentAccessForStudent(studentId, { reason = null } = {}) {
  const link = await getParentLink(studentId);
  if (!link) return { disabled: false };
  // Leaving never relabels access someone had already switched off, so a return won't reopen it.
  if (reason && link.status === 'disabled') return { disabled: false, alreadyDisabled: true };
  if (link.parentUid) {
    try {
      await auth.updateUser(link.parentUid, { disabled: true });
    } catch (error) {
      if (String(error?.code || '') !== 'auth/user-not-found') throw error;
    }
    await db.collection(PROFILE_COLLECTION).doc(link.parentUid).set({ status: 'disabled' }, { merge: true });
  }
  await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).set({
    status: 'disabled',
    disabledReason: reason || FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { disabled: true };
}

// Only undoes a disable that leaving the school caused; access a teacher turned off stays off.
async function restoreParentAccessAfterReturn(studentId) {
  const link = await getParentLink(studentId);
  if (!link || link.status !== 'disabled' || link.disabledReason !== 'left-school') return { restored: false };
  if (link.parentUid) {
    try {
      await auth.updateUser(link.parentUid, { disabled: false });
      await db.collection(PROFILE_COLLECTION).doc(link.parentUid).set({ status: 'active' }, { merge: true });
    } catch (error) {
      if (String(error?.code || '') !== 'auth/user-not-found') throw error;
      return { restored: false };
    }
  }
  await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).set({
    status: 'active',
    disabledReason: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { restored: true };
}

async function deleteCollectionDocsByStudentId(collectionName, studentId) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/${collectionName}`)
    .where('studentId', '==', studentId)
    .get();
  if (snap.empty) return 0;
  await commitBatchChunks(snap.docs.map((docSnap) => ({ ref: docSnap.ref })), 'delete');
  return snap.size;
}

async function deleteSubcollection(parentRef, subcollectionName) {
  const snap = await parentRef.collection(subcollectionName).get();
  if (snap.empty) return 0;
  await commitBatchChunks(snap.docs.map((docSnap) => ({ ref: docSnap.ref })), 'delete');
  return snap.size;
}

async function scrubStudentFromGuildArchives(studentId) {
  const [liveGuilds, yearGuilds] = await Promise.all([
    db.collection(`${PUBLIC_DATA_PATH}/guild_scores`).get(),
    db.collection(`${PUBLIC_DATA_PATH}/guild_year_snapshots`).get()
  ]);
  const writes = [];
  [...liveGuilds.docs, ...yearGuilds.docs].forEach((docSnap) => {
    const data = docSnap.data() || {};
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : null;
    if (!memberIds || !memberIds.includes(studentId)) return;
    const nextIds = memberIds.filter((id) => id !== studentId);
    writes.push({
      ref: docSnap.ref,
      payload: {
        memberIds: nextIds,
        memberCount: nextIds.length,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });
  if (writes.length) await commitBatchChunks(writes);
  return writes.length;
}

async function deleteStudentStorageFiles(studentId) {
  if (!studentId) return;
  const bucket = storage.bucket();
  const prefixes = [`avatars/${studentId}/`, `familiars/${studentId}/`];
  await Promise.all(prefixes.map(async (prefix) => {
    try {
      await bucket.deleteFiles({ prefix, force: true });
    } catch (error) {
      console.warn(`Storage cleanup skipped for ${prefix}:`, error?.message || error);
    }
  }));
}

async function syncStudentThreadParticipants(studentId, { addUid = null, removeUid = null, keepUids = [] } = {}) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/communication_threads`)
    .where('studentId', '==', studentId)
    .get();
  if (snap.empty) return 0;
  const writes = [];
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    let uids = Array.isArray(data.participantUids) ? data.participantUids.filter(Boolean) : [];
    if (removeUid) uids = uids.filter((uid) => uid !== removeUid);
    if (addUid) uids.push(addUid);
    keepUids.forEach((uid) => {
      if (uid) uids.push(uid);
    });
    uids = Array.from(new Set(uids));
    let roles = Array.isArray(data.participantRoles) ? data.participantRoles.filter(Boolean) : [];
    if (addUid && !roles.includes('teacher')) roles.push('teacher');
    if (!roles.includes('parent') && keepUids.length) roles.push('parent');
    roles = Array.from(new Set(roles));
    writes.push({
      ref: docSnap.ref,
      payload: {
        participantUids: uids,
        participantRoles: roles,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });
  await commitBatchChunks(writes);
  return writes.length;
}

async function purgeStudentData(studentId) {
  const id = String(studentId || '').trim();
  if (!id) return { ok: false, reason: 'missing-student-id' };

  const link = await getParentLink(id);
  const parentUid = link?.parentUid || null;
  if (parentUid) {
    await deleteAuthUserIfExists(parentUid);
    try {
      await db.collection(PROFILE_COLLECTION).doc(parentUid).delete();
    } catch (error) {
      console.warn(`Could not delete parent profile ${parentUid}:`, error?.message || error);
    }
  }

  const studentKeyedCollections = [
    'parent_homework',
    'communication_threads',
    'communication_messages',
    'award_log',
    'adventure_logs',
    'attendance',
    'written_scores',
    'hero_chronicle_notes',
    'ember_oaths',
    'today_stars',
    'student_year_enrollments',
    'student_year_snapshots',
    'quest_assignments',
    'quest_events'
  ];
  for (const collectionName of studentKeyedCollections) {
    await deleteCollectionDocsByStudentId(collectionName, id);
  }

  const scoreRef = db.doc(`${PUBLIC_DATA_PATH}/student_scores/${id}`);
  await deleteSubcollection(scoreRef, 'monthly_history');

  const directDeletes = [
    db.doc(`${PUBLIC_DATA_PATH}/parent_links/${id}`),
    db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${id}`),
    scoreRef,
    db.doc(`${PUBLIC_DATA_PATH}/students/${id}`)
  ];
  await commitBatchChunks(directDeletes.map((ref) => ({ ref })), 'delete');

  await scrubStudentFromGuildArchives(id);
  await deleteStudentStorageFiles(id);

  return { ok: true, studentId: id, parentUid };
}

async function getUserByEmail(email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (String(error?.code || '') === 'auth/user-not-found') return null;
    throw error;
  }
}

async function deleteAuthUserIfExists(uid) {
  if (!uid) return false;
  try {
    await auth.deleteUser(uid);
    return true;
  } catch (error) {
    if (String(error?.code || '') === 'auth/user-not-found') return false;
    throw error;
  }
}

async function getScore(studentId) {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentId}`).get();
  return snap.exists ? snap.data() : {};
}

async function getRecentAssessments(studentId) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/written_scores`)
    .where('studentId', '==', studentId)
    .orderBy('date', 'desc')
    .limit(10)
    .get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

// Family-facing dates follow the school's clock, not the server's.
const SCHOOL_TIME_ZONE = 'Europe/Athens';

function schoolDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

// award_log and attendance store DD-MM-YYYY; written_scores store YYYY-MM-DD. Both become a sortable YYYY-MM-DD key.
function toIsoDateKey(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return '';
}

function isoDaysAgo(days) {
  const { year, month, day } = schoolDateParts();
  const date = new Date(Date.UTC(year, month - 1, day - days));
  return date.toISOString().slice(0, 10);
}

async function getAttendanceSummary(studentId) {
  // Only absences are stored, so the few docs a child has are cheap to read in full.
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/attendance`)
    .where('studentId', '==', studentId)
    .limit(60)
    .get();
  const absenceDates = snap.docs
    .map((docSnap) => toIsoDateKey(docSnap.data()?.date))
    .filter(Boolean)
    .sort()
    .reverse();
  const absences = absenceDates.length;
  return {
    absences,
    absenceDates: absenceDates.slice(0, 12),
    lessonsHeld: null,
    rateLabel: absences === 0 ? 'Perfect so far' : `${absences} absence${absences === 1 ? '' : 's'}`
  };
}

async function getRecentAwardLogs(studentId) {
  const collectionRef = db.collection(`${PUBLIC_DATA_PATH}/award_log`);
  try {
    // Newest first by creation time (the DD-MM-YYYY date field cannot be ordered).
    const snap = await collectionRef
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    return snap.docs.map((docSnap) => docSnap.data() || {});
  } catch (error) {
    // Until the (studentId, createdAt) index is built, read the latest dates and sort them here.
    console.warn('award_log createdAt index not ready, using the date index:', error?.message || error);
    const snap = await collectionRef.where('studentId', '==', studentId).limit(60).get();
    return snap.docs
      .map((docSnap) => docSnap.data() || {})
      .sort((a, b) => toIsoDateKey(b.date).localeCompare(toIsoDateKey(a.date)))
      .slice(0, 30);
  }
}

// Positive awards a family can celebrate; corrections and plain attendance marks stay out.
const NON_CELEBRATION_REASONS = new Set(['correction', 'wheel_curse', 'marked_present']);

function summarizeAwardLogs(logs) {
  const weekStart = isoDaysAgo(6);
  let weekStars = 0;
  const recentCelebrations = [];
  logs.forEach((data) => {
    const stars = Number(data.stars || 0);
    const dateKey = toIsoDateKey(data.date);
    if (dateKey && dateKey >= weekStart && stars > 0) weekStars += stars;
    if (stars <= 0 || NON_CELEBRATION_REASONS.has(data.reason)) return;
    if (recentCelebrations.length >= 8) return;
    recentCelebrations.push({
      title: data.reason || 'Award',
      reason: data.reason || 'excellence',
      stars,
      description: data.note || `${stars} star${stars === 1 ? '' : 's'} awarded`,
      note: data.note || '',
      date: dateKey || data.date || ''
    });
  });
  return { weekStars: Math.round(weekStars * 10) / 10, recentCelebrations };
}

async function getStarsHistory(studentId) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/student_scores/${studentId}/monthly_history`)
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(6)
    .get();
  return snap.docs
    .map((docSnap) => ({ month: String(docSnap.data()?.month || docSnap.id), stars: Number(docSnap.data()?.stars || 0) }))
    .filter((item) => /^\d{4}-\d{2}$/.test(item.month))
    .reverse();
}

// monthlyStars is only reset when a teacher opens the app in a new month; until then it still holds last month.
function currentMonthStars(score) {
  const { year, month } = schoolDateParts();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  if (score.lastMonthlyResetDate && score.lastMonthlyResetDate !== monthStart) return 0;
  return score.monthlyStars || 0;
}

async function getSchoolSettings() {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/school_settings/holidays`).get();
  return snap.exists ? (snap.data() || {}) : {};
}

function isEarlyLeagueName(league) {
  return league === 'Nursery' || league === 'Pre-Junior';
}

function schemeIsEnabled(scheme, league) {
  if (scheme?.mode === 'none') return false;
  if (scheme?.mode === 'numeric' || scheme?.mode === 'qualitative') return true;
  return !isEarlyLeagueName(league);
}

function resolveClassAssessmentUses(classData = {}, schoolSettings = {}) {
  const league = classData.questLevel || '';
  const migrated = schoolSettings.assessmentNoneMigrationV1 === true;
  if (isEarlyLeagueName(league) && !migrated) {
    return { tests: false, dictations: false };
  }
  const inherit = classData.assessmentConfig?.inheritSchoolDefaults !== false;
  const schoolLeague = schoolSettings.assessmentDefaultsByLeague?.[league] || {};
  const testsScheme = inherit ? schoolLeague.tests : (classData.assessmentConfig?.tests || schoolLeague.tests);
  const dictationsScheme = inherit ? schoolLeague.dictations : (classData.assessmentConfig?.dictations || schoolLeague.dictations);
  return {
    tests: schemeIsEnabled(testsScheme, league),
    dictations: schemeIsEnabled(dictationsScheme, league)
  };
}

async function countPublishedHomework(studentId) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/parent_homework`)
    .where('studentId', '==', studentId)
    .where('status', '==', 'published')
    .where('sourceType', '==', 'quest-assignment')
    .count()
    .get();
  return Number(snap.data().count || 0);
}

function assessmentPercent(item) {
  const percent = Number(item.normalizedPercent);
  if (Number.isFinite(percent)) return Math.max(0, Math.min(100, Math.round(percent)));
  const score = Number(item.scoreNumeric);
  const max = Number(item.maxScore);
  if (Number.isFinite(score) && max > 0) return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  return null;
}

function assessmentScoreLabel(item) {
  return item.scoreQualitative || `${item.scoreNumeric || 0}${item.maxScore ? ` / ${item.maxScore}` : ''}`;
}

async function buildParentSnapshot(studentId, extra = {}) {
  // Everything except the class is read at once; the class waits only for the student record.
  const studentPromise = getStudent(studentId);
  const classPromise = studentPromise.then((student) => db.doc(`${PUBLIC_DATA_PATH}/classes/${student.classId}`).get());
  const [student, classSnap, score, assessments, attendanceSummary, awardLogs, starsHistory, parentLink, schoolSettings, homeworkCount, previousSnap] = await Promise.all([
    studentPromise,
    classPromise,
    getScore(studentId),
    getRecentAssessments(studentId),
    getAttendanceSummary(studentId),
    getRecentAwardLogs(studentId),
    getStarsHistory(studentId).catch(() => []),
    getParentLink(studentId),
    getSchoolSettings(),
    countPublishedHomework(studentId),
    db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`).get()
  ]);
  const classData = classSnap.exists ? classSnap.data() : {};
  const assessmentUses = resolveClassAssessmentUses(classData, schoolSettings);
  const visibleAssessments = assessments.filter((item) => {
    if (item.type === 'dictation') return assessmentUses.dictations;
    if (item.type === 'test') return assessmentUses.tests;
    return assessmentUses.tests || assessmentUses.dictations;
  });
  const latestGrade = visibleAssessments[0] || null;
  const existing = previousSnap.exists ? previousSnap.data() : {};
  const { weekStars, recentCelebrations } = summarizeAwardLogs(awardLogs);
  const percents = visibleAssessments.map(assessmentPercent).filter((value) => value !== null);
  const gradeAveragePercent = percents.length
    ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
    : null;

  return {
    studentId,
    studentName: student.name || '',
    avatar: student.avatar || null,
    guildId: student.guildId || null,
    classId: student.classId,
    className: classData.name || '',
    classLogo: classData.logo || '',
    teacherName: classData.createdBy?.name || '',
    questLevel: classData.questLevel || '',
    scheduleDays: Array.isArray(classData.scheduleDays) ? classData.scheduleDays.map(String) : [],
    timeStart: classData.timeStart || '',
    timeEnd: classData.timeEnd || '',
    assessmentUses,
    heroClass: student.heroClass || '',
    progress: {
      totalStars: score.totalStars || 0,
      monthlyStars: currentMonthStars(score),
      heroLevel: score.heroLevel || 0,
      gold: score.gold || 0
    },
    weekStars,
    starsHistory,
    attendanceSummary,
    latestGrade: latestGrade
      ? {
          label: assessmentScoreLabel(latestGrade),
          title: latestGrade.title || latestGrade.type || 'Assessment',
          type: latestGrade.type || '',
          percent: assessmentPercent(latestGrade)
        }
      : null,
    gradeAverageLabel: gradeAveragePercent !== null ? `${gradeAveragePercent}%` : 'N/A',
    gradeAveragePercent,
    gradeHistory: visibleAssessments.map((item) => ({
      title: item.title || item.type || 'Assessment',
      type: item.type || '',
      date: item.date || '',
      scoreLabel: assessmentScoreLabel(item),
      percent: assessmentPercent(item)
    })),
    recentCelebrations,
    homeworkCount,
    nextLessonLabel: classData.timeStart ? `${classData.timeStart}` : 'See homework feed',
    linkedParentUid: parentLink?.parentUid || null,
    publishedNotes: existing.publishedNotes || [],
    latestParentSummary: existing.latestParentSummary || null,
    refreshedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra
  };
}

async function upsertParentSnapshot(studentId, extra = {}) {
  const payload = await buildParentSnapshot(studentId, extra);
  await db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`).set(payload, { merge: true });
  return payload;
}

async function resolveRoleUser({ desiredUid = null, email, password, displayName, roleLabel }) {
  const existingByEmail = await getUserByEmail(email);

  if (desiredUid) {
    try {
      await auth.updateUser(desiredUid, {
        email,
        password,
        displayName,
        disabled: false
      });
      return desiredUid;
    } catch (error) {
      const code = String(error?.code || '');
      if (code === 'auth/user-not-found') {
        if (existingByEmail && existingByEmail.uid !== desiredUid) {
          throw new HttpsError('already-exists', `That ${roleLabel} username is already linked to another account.`);
        }
        desiredUid = null;
      } else if (code === 'auth/email-already-exists') {
        if (existingByEmail && existingByEmail.uid !== desiredUid) {
          throw new HttpsError('already-exists', `That ${roleLabel} username is already linked to another account.`);
        }
      } else {
        throw mapAdminAuthError(error, `Could not update the ${roleLabel} account.`);
      }
    }
  }

  if (existingByEmail) {
    throw new HttpsError('already-exists', `That ${roleLabel} username is already in use.`);
  }

  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    return userRecord.uid;
  } catch (error) {
    throw mapAdminAuthError(error, `Could not create the ${roleLabel} account.`);
  }
}

function normalizeHomeworkTitleFromAssignment(className, testData) {
  if (String(testData?.title || '').trim()) {
    return `Quest Assignment: ${String(testData.title).trim()}`;
  }
  if (String(className || '').trim()) {
    return `${String(className).trim()} Homework`;
  }
  return 'Quest Assignment';
}

function normalizeHomeworkBodyFromAssignment(text, testData) {
  const bodyParts = [];
  const assignmentText = String(text || '').trim();
  if (assignmentText) bodyParts.push(assignmentText);

  if (testData?.date && testData?.title) {
    bodyParts.push(`Upcoming test: ${String(testData.title).trim()} on ${String(testData.date).trim()}.`);
    if (String(testData.curriculum || '').trim()) {
      bodyParts.push(`Curriculum: ${String(testData.curriculum).trim()}`);
    }
  }

  return bodyParts.join('\n\n').trim();
}

function buildThreadId(studentId, threadType) {
  return `${studentId}_${String(threadType || 'message').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`;
}

async function ensureCommunicationThread({ studentId, threadType, participantUids = [], participantRoles = [], createdBy, scopeType = 'student', scopeId = null }) {
  const threadId = buildThreadId(studentId, threadType);
  const threadRef = db.doc(`${PUBLIC_DATA_PATH}/communication_threads/${threadId}`);
  const existing = await threadRef.get();
  if (!existing.exists) {
    const schoolYearKey = await getActiveSchoolYearKey();
    await threadRef.set({
      scopeType,
      scopeId: scopeId || studentId,
      studentId,
      schoolYearKey,
      participantUids: Array.from(new Set(participantUids.filter(Boolean))),
      participantRoles: Array.from(new Set(participantRoles.filter(Boolean))),
      threadType,
      status: 'open',
      lastMessageAt: FieldValue.serverTimestamp(),
      previewText: '',
      createdBy,
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  return { threadId, threadRef };
}

async function addCommunicationMessage({ threadId, studentId, body, authorUid, authorRole, messageType, requiresReply = false }) {
  const threadRef = db.doc(`${PUBLIC_DATA_PATH}/communication_threads/${threadId}`);
  const threadSnap = await threadRef.get();
  if (!threadSnap.exists) {
    throw new HttpsError('not-found', 'That communication thread no longer exists.');
  }
  const thread = threadSnap.data() || {};
  const messageRef = db.collection(`${PUBLIC_DATA_PATH}/communication_messages`).doc();
  const schoolYearKey = thread.schoolYearKey || await getActiveSchoolYearKey();
  // The message and the thread's preview are saved in one commit.
  const batch = db.batch();
  batch.set(messageRef, {
    threadId,
    studentId,
    schoolYearKey,
    authorUid,
    authorRole,
    messageType,
    body,
    visibility: 'participants',
    participantUids: Array.isArray(thread.participantUids) ? thread.participantUids : [],
    participantRoles: Array.isArray(thread.participantRoles) ? thread.participantRoles : [],
    requiresReply,
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(threadRef, {
    lastMessageAt: FieldValue.serverTimestamp(),
    schoolYearKey,
    previewText: body.slice(0, 160),
    lastAuthorRole: authorRole,
    status: 'open'
  }, { merge: true });
  await batch.commit();
}

// Opens (or reuses) the student's thread of this type with the parent and posts one message.
async function notifyLinkedParent({ caller, studentId, parentUid, threadType, body }) {
  const role = caller.profile.role || 'teacher';
  const { threadId } = await ensureCommunicationThread({
    studentId,
    threadType,
    participantUids: [caller.uid, parentUid],
    participantRoles: [role, 'parent'],
    createdBy: { uid: caller.uid, role }
  });
  await addCommunicationMessage({
    threadId,
    studentId,
    body,
    authorUid: caller.uid,
    authorRole: role,
    messageType: threadType
  });
}

exports.getSecretaryBootstrapStatus = callable(async () => {
  const [roleSnap, bootstrapSnap] = await Promise.all([
    db.doc(SECRETARY_ROLE_DOC).get(),
    db.doc(SECRETARY_BOOTSTRAP_DOC).get()
  ]);
  if (roleSnap.exists && roleSnap.data()?.uid && roleSnap.data()?.status === 'active') {
    const profileSnap = await db.collection(PROFILE_COLLECTION).doc(roleSnap.data().uid).get();
    if (profileSnap.exists && profileSnap.data()?.role === 'secretary' && profileSnap.data()?.status === 'active') {
      return { state: 'active', requiresToken: false };
    }
  }

  const bootstrap = bootstrapSnap.exists ? (bootstrapSnap.data() || {}) : {};
  const expiresAtMs = bootstrap.expiresAt?.toMillis?.() || 0;
  const expired = expiresAtMs > 0 && expiresAtMs <= Date.now();
  const claimState = bootstrap.status === 'claiming' ? 'claiming' : 'unclaimed';
  return {
    state: expired || bootstrap.status === 'consumed' ? 'unclaimed' : claimState,
    requiresToken: true
  };
});

exports.activateSecretaryAdmin = callable(async (request) => {
  const token = String(request.data?.token || '').trim();
  const username = sanitizeUsername(request.data?.username);
  const password = String(request.data?.password || '');
  const displayName = String(request.data?.displayName || 'School Secretary').trim() || 'School Secretary';
  const schoolName = String(request.data?.schoolName || '').trim();
  if (token.length < 32 || !username || password.length < 6) {
    throw new HttpsError('invalid-argument', 'A valid setup link, username, and password of at least 6 characters are required.');
  }

  const bootstrapRef = db.doc(SECRETARY_BOOTSTRAP_DOC);
  const roleRef = db.doc(SECRETARY_ROLE_DOC);
  const tokenHash = hashSecretarySetupToken(token);
  let bootstrapData;

  await db.runTransaction(async (transaction) => {
    const [bootstrapSnap, roleSnap] = await Promise.all([
      transaction.get(bootstrapRef),
      transaction.get(roleRef)
    ]);
    if (!bootstrapSnap.exists) {
      throw new HttpsError('permission-denied', 'This Secretary setup link is invalid or no longer available.');
    }
    const data = bootstrapSnap.data() || {};
    const expiresAtMs = data.expiresAt?.toMillis?.() || 0;
    if (!tokenHashesMatch(data.tokenHash, tokenHash) || !expiresAtMs || expiresAtMs <= Date.now()) {
      throw new HttpsError('permission-denied', 'This Secretary setup link is invalid or expired.');
    }
    if (data.status === 'consumed') {
      throw new HttpsError('failed-precondition', 'This Secretary setup link has already been used.');
    }
    if (data.status === 'claiming' && data.claimUsername && data.claimUsername !== username) {
      throw new HttpsError('aborted', 'This setup link is already completing another Secretary activation.');
    }

    const purpose = String(data.purpose || 'founding');
    if (purpose === 'recovery') {
      const activeUid = roleSnap.exists ? roleSnap.data()?.uid : null;
      if (!activeUid || (data.targetUid && data.targetUid !== activeUid)) {
        throw new HttpsError('failed-precondition', 'The Secretary account linked to this recovery link has changed.');
      }
    } else if (roleSnap.exists && roleSnap.data()?.uid && roleSnap.data()?.status === 'active') {
      throw new HttpsError('failed-precondition', 'This school already has an active Secretary/admin.');
    }

    bootstrapData = { ...data, purpose };
    transaction.set(bootstrapRef, {
      status: 'claiming',
      claimUsername: username,
      claimStartedAt: data.claimStartedAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const email = buildSyntheticRoleEmail('secretary', username);
  let secretaryUid = bootstrapData.targetUid || bootstrapData.claimUid || null;
  let createdAuthUser = false;

  try {
    if (bootstrapData.purpose === 'recovery') {
      await auth.updateUser(secretaryUid, { email, password, displayName, disabled: false });
    } else {
      const existingByEmail = await getUserByEmail(email);
      if (existingByEmail) {
        const existingProfile = await db.collection(PROFILE_COLLECTION).doc(existingByEmail.uid).get();
        if (existingProfile.exists || (bootstrapData.claimUid && bootstrapData.claimUid !== existingByEmail.uid)) {
          throw new HttpsError('already-exists', 'That Secretary username is already in use.');
        }
        secretaryUid = existingByEmail.uid;
        await auth.updateUser(secretaryUid, { password, displayName, disabled: false });
      } else {
        try {
          const userRecord = await auth.createUser({ email, password, displayName });
          secretaryUid = userRecord.uid;
          createdAuthUser = true;
        } catch (createError) {
          if (createError?.code !== 'auth/email-already-exists') throw createError;
          const concurrentUser = await getUserByEmail(email);
          if (!concurrentUser) throw createError;
          secretaryUid = concurrentUser.uid;
          await auth.updateUser(secretaryUid, { password, displayName, disabled: false });
        }
      }
      await bootstrapRef.set({ claimUid: secretaryUid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    const legacyAdminSnap = await db.collection(PROFILE_COLLECTION).where('schoolAdmin', '==', true).get();
    const batch = db.batch();
    batch.set(roleRef, {
      uid: secretaryUid,
      username,
      status: 'active',
      activatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: false });
    batch.set(db.collection(PROFILE_COLLECTION).doc(secretaryUid), {
      role: 'secretary',
      displayName,
      loginMode: 'username',
      status: 'active',
      linkedStudentId: null,
      createdBy: { type: 'secretary_bootstrap', purpose: bootstrapData.purpose },
      createdAt: FieldValue.serverTimestamp(),
      lastSeenAt: null,
      schoolAdmin: FieldValue.delete()
    }, { merge: true });
    legacyAdminSnap.docs.forEach((docSnap) => {
      if (docSnap.id !== secretaryUid) batch.update(docSnap.ref, { schoolAdmin: FieldValue.delete() });
    });

    if (bootstrapData.purpose === 'founding') {
      if (!schoolName) {
        throw new HttpsError('invalid-argument', 'School name is required for the founding Secretary activation.');
      }
      const { activeYearKey, nextYearKey } = getAcademicYearKeys();
      batch.set(db.doc(`${PUBLIC_DATA_PATH}/school_settings/holidays`), {
        schoolName,
        ranges: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`), {
        activeYearKey,
        nextYearKey,
        closeDate: null,
        rolloverStatus: 'active',
        status: 'active',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: false });
      batch.set(db.doc(`${PUBLIC_DATA_PATH}/school_years/${activeYearKey}`), {
        yearKey: activeYearKey,
        status: 'active',
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(db.doc(`${PUBLIC_DATA_PATH}/school_years/${nextYearKey}`), {
        yearKey: nextYearKey,
        status: 'planned',
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    batch.set(bootstrapRef, {
      status: 'consumed',
      consumedByUid: secretaryUid,
      consumedAt: FieldValue.serverTimestamp(),
      tokenHash: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await batch.commit();
    return { ok: true, uid: secretaryUid, username, purpose: bootstrapData.purpose };
  } catch (error) {
    const activeRoleSnap = await roleRef.get().catch(() => null);
    const activationCompleted = activeRoleSnap?.exists
      && activeRoleSnap.data()?.status === 'active'
      && activeRoleSnap.data()?.uid === secretaryUid;
    if (createdAuthUser && secretaryUid && !activationCompleted) {
      await deleteAuthUserIfExists(secretaryUid).catch(() => {});
    }
    if (!activationCompleted) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(bootstrapRef);
        const currentData = current.exists ? (current.data() || {}) : {};
        if (currentData.status !== 'claiming' || !tokenHashesMatch(currentData.tokenHash, tokenHash)) return;
        if (currentData.claimUid && secretaryUid && currentData.claimUid !== secretaryUid) return;
        transaction.set(bootstrapRef, {
          status: 'pending',
          claimUid: FieldValue.delete(),
          claimUsername: FieldValue.delete(),
          claimStartedAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }).catch(() => {});
    }
    if (activationCompleted) {
      return { ok: true, uid: secretaryUid, username, purpose: bootstrapData?.purpose, resumed: true };
    }
    if (error instanceof HttpsError) throw error;
    throw mapAdminAuthError(error, 'Could not activate the Secretary/admin account.');
  }
});

exports.updateSecretaryCredentials = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  if (caller.profile.role !== 'secretary') {
    throw new HttpsError('permission-denied', 'Only the active Secretary/admin can change these credentials.');
  }
  const roleRef = db.doc(SECRETARY_ROLE_DOC);
  const roleSnap = await roleRef.get();
  if (!roleSnap.exists || roleSnap.data()?.uid !== caller.uid || roleSnap.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'This account is not the canonical Secretary/admin.');
  }
  const authTime = Number(request.auth?.token?.auth_time || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTime || nowSeconds - authTime > RECENT_AUTH_WINDOW_SECONDS) {
    throw new HttpsError('failed-precondition', 'Please confirm your current password before changing Secretary credentials.');
  }

  const requestedUsername = request.data?.username == null ? '' : sanitizeUsername(request.data.username);
  const requestedPassword = request.data?.password == null ? '' : String(request.data.password);
  if (!requestedUsername && !requestedPassword) {
    throw new HttpsError('invalid-argument', 'Enter a new username or password.');
  }
  if (request.data?.username != null && !requestedUsername) {
    throw new HttpsError('invalid-argument', 'Enter a valid username.');
  }
  if (requestedPassword && requestedPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Use a password with at least 6 characters.');
  }

  const currentUsername = sanitizeUsername(roleSnap.data()?.username);
  const nextUsername = requestedUsername || currentUsername;
  const update = { disabled: false };
  if (nextUsername !== currentUsername) {
    const nextEmail = buildSyntheticRoleEmail('secretary', nextUsername);
    const existing = await getUserByEmail(nextEmail);
    if (existing && existing.uid !== caller.uid) {
      throw new HttpsError('already-exists', 'That Secretary username is already in use.');
    }
    update.email = nextEmail;
  }
  if (requestedPassword) update.password = requestedPassword;
  await auth.updateUser(caller.uid, update);
  await roleRef.set({ username: nextUsername, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, username: nextUsername };
});

exports.claimFoundingSchoolAdmin = callable(async () => {
  throw new HttpsError('failed-precondition', 'Teacher administrators are retired. Activate the school Secretary/admin instead.');
});

exports.createParentAccess = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  const username = sanitizeUsername(request.data?.username);
  const password = String(request.data?.password || '').trim();
  if (!studentId || !username || !password) {
    throw new HttpsError('invalid-argument', 'Student, username, and password are required.');
  }
  const [{ caller, student }, link] = await allInOrder([
    requireStudentManager(request, studentId),
    getParentLink(studentId)
  ]);
  const email = buildSyntheticRoleEmail('parent', username);
  const displayName = `Parent of ${student.name}`;
  const parentUid = await resolveRoleUser({
    desiredUid: link?.parentUid || null,
    email,
    password,
    displayName,
    roleLabel: 'parent'
  });

  // The link and the parent's profile are saved in one commit.
  const accessBatch = db.batch();
  accessBatch.set(db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`), {
    studentId,
    classId: student.classId,
    parentUid,
    username,
    status: 'active',
    createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher', name: caller.profile.displayName || '' },
    createdAt: FieldValue.serverTimestamp(),
    lastPasswordResetAt: FieldValue.serverTimestamp()
  }, { merge: true });
  accessBatch.set(db.collection(PROFILE_COLLECTION).doc(parentUid), {
    role: 'parent',
    displayName,
    loginMode: 'username',
    status: 'active',
    linkedStudentId: studentId,
    createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: null
  }, { merge: true });
  await accessBatch.commit();

  await upsertParentSnapshot(studentId, { linkedParentUid: parentUid });

  return { ok: true, parentUid, username };
});

exports.resetParentAccessPassword = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  const password = String(request.data?.password || '').trim();
  if (!studentId || !password) {
    throw new HttpsError('invalid-argument', 'Student and password are required.');
  }
  const [, link] = await allInOrder([
    requireStudentManager(request, studentId),
    getParentLink(studentId)
  ]);
  if (!link?.parentUid) {
    throw new HttpsError('not-found', 'No parent account is linked to this student.');
  }
  await auth.updateUser(link.parentUid, { password, disabled: false });
  await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).set({
    lastPasswordResetAt: FieldValue.serverTimestamp(),
    status: 'active'
  }, { merge: true });
  return { ok: true };
});

exports.disableParentAccess = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  await requireStudentManager(request, studentId);
  await disableParentAccessForStudent(studentId);
  return { ok: true };
});

exports.deleteParentAccess = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  const [, link] = await allInOrder([
    requireStudentManager(request, studentId),
    getParentLink(studentId)
  ]);
  const parentUid = link?.parentUid || null;
  // The login is removed first; the records then go in one commit.
  if (parentUid) await deleteAuthUserIfExists(parentUid);
  const deleteBatch = db.batch();
  if (parentUid) deleteBatch.delete(db.collection(PROFILE_COLLECTION).doc(parentUid));
  deleteBatch.delete(db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`));
  deleteBatch.set(db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`), {
    linkedParentUid: FieldValue.delete(),
    parentAccessDeletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await deleteBatch.commit();
  return { ok: true, deletedUid: parentUid };
});

function rejectLegacySecretaryLifecycle() {
  throw new HttpsError(
    'failed-precondition',
    'The Secretary is now the school administrator and cannot be created, disabled, or deleted from inside the app.'
  );
}

exports.createOrReplaceSecretaryAccess = callable(rejectLegacySecretaryLifecycle);
exports.disableSecretaryAccess = callable(rejectLegacySecretaryLifecycle);
exports.deleteSecretaryAccess = callable(rejectLegacySecretaryLifecycle);

exports.publishParentSummary = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  const summary = String(request.data?.summary || '').trim();
  if (!studentId || !summary) {
    throw new HttpsError('invalid-argument', 'Student and summary are required.');
  }
  const [{ caller }, link] = await allInOrder([
    requireStudentManager(request, studentId),
    getParentLink(studentId)
  ]);
  const snapshot = await buildParentSnapshot(studentId);
  const notes = Array.isArray(snapshot.publishedNotes) ? snapshot.publishedNotes : [];
  const nextNotes = [{ label: 'Parent Summary', body: summary, createdAt: new Date().toISOString() }, ...notes].slice(0, 6);

  // The refreshed snapshot and the new summary are one write; the parent's message goes out alongside it.
  await Promise.all([
    db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`).set({
      ...snapshot,
      latestParentSummary: summary,
      publishedNotes: nextNotes
    }, { merge: true }),
    link?.parentUid
      ? notifyLinkedParent({ caller, studentId, parentUid: link.parentUid, threadType: 'progress-share', body: summary })
      : null
  ]);

  return { ok: true };
});

exports.publishEmberOath = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  await requireFeatureEnabled('heroCampfire');
  if (request.data?.confirmed !== true) throw new HttpsError('invalid-argument', 'Review the family message before publishing.');
  const [caller, schoolYearKey] = await allInOrder([requireAuthedCaller(request), getActiveSchoolYearKey()]);
  let note;
  try { note = publicEmberNote({ oathId: request.data?.oathId, summary: request.data?.summary, date: new Date().toISOString(), schoolYearKey }); }
  catch (error) { throw new HttpsError('invalid-argument', error.message); }
  const oathRef = db.doc(PUBLIC_DATA_PATH + '/ember_oaths/' + note.oathId);
  const oathSnap = await oathRef.get(), oath = oathSnap.data();
  if (!oath || caller.profile.role !== 'teacher' || oath.teacherId !== caller.uid || oath.schoolYearKey !== schoolYearKey) throw new HttpsError('permission-denied', 'Only the current teacher can publish this oath.');
  if (oath.status !== 'kept') throw new HttpsError('failed-precondition', 'Only a kept promise can be shared.');
  const { student } = await requireStudentManager(request, oath.studentId);
  if (student.activeSchoolYearKey !== schoolYearKey) throw new HttpsError('failed-precondition', 'This student belongs to another school year.');
  await upsertParentSnapshot(oath.studentId);
  const parentRef = db.doc(PUBLIC_DATA_PATH + '/parent_snapshots/' + oath.studentId);
  await db.runTransaction(async tx => {
    const [currentOath, currentStudent, snapshot] = await Promise.all([tx.get(oathRef), tx.get(db.doc(PUBLIC_DATA_PATH + '/students/' + oath.studentId)), tx.get(parentRef)]);
    if (currentOath.data()?.teacherId !== caller.uid || currentOath.data()?.status !== 'kept' ||
      currentStudent.data()?.createdBy?.uid !== caller.uid) throw new HttpsError('permission-denied', 'Ownership changed. Reopen the student record.');
    tx.set(parentRef, { publishedNotes: mergePublishedEmber(snapshot.data()?.publishedNotes, note), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true };
});

exports.publishParentHomework = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  const classId = String(request.data?.classId || '').trim();
  const lessonDate = String(request.data?.lessonDate || '').trim();
  const title = String(request.data?.title || '').trim();
  const body = String(request.data?.body || '').trim();
  if (!studentId || !classId || !lessonDate || !title || !body) {
    throw new HttpsError('invalid-argument', 'Student, class, date, title, and body are required.');
  }
  const [{ caller }, link, schoolYearKey] = await allInOrder([
    requireStudentManager(request, studentId),
    getParentLink(studentId),
    getActiveSchoolYearKey()
  ]);
  await db.collection(`${PUBLIC_DATA_PATH}/parent_homework`).add({
    studentId,
    classId,
    schoolYearKey,
    lessonDate,
    title,
    body,
    status: 'published',
    sourceType: 'manual',
    publishedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    publishedAt: FieldValue.serverTimestamp()
  });
  await Promise.all([
    upsertParentSnapshot(studentId),
    link?.parentUid
      ? notifyLinkedParent({ caller, studentId, parentUid: link.parentUid, threadType: 'homework', body: `${title}\n\n${body}` })
      : null
  ]);

  return { ok: true };
});

const HOMEWORK_SYNC_CONCURRENCY = 8;

// Runs worker over items with at most `limit` in flight; the first failure is thrown once all settle.
async function forEachLimited(items, limit, worker) {
  let next = 0;
  let firstError = null;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch (error) {
        if (!firstError) firstError = error;
      }
    }
  });
  await Promise.all(lanes);
  if (firstError) throw firstError;
}

exports.syncQuestAssignmentToParentHomework = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const classId = String(request.data?.classId || '').trim();
  const text = String(request.data?.text || '').trim();
  const lessonDate = String(request.data?.lessonDate || '').trim();
  const title = String(request.data?.title || '').trim();
  const testData = request.data?.testData && typeof request.data.testData === 'object'
    ? request.data.testData
    : null;

  if (!classId || !text) {
    throw new HttpsError('invalid-argument', 'Class and assignment text are required.');
  }

  const { caller, classData } = await requireClassManager(request, classId);
  const className = classData.name || '';
  const effectiveLessonDate = lessonDate || String(testData?.date || '').trim();
  const effectiveTitle = title || normalizeHomeworkTitleFromAssignment(className, testData);
  const effectiveBody = normalizeHomeworkBodyFromAssignment(text, testData);

  if (!effectiveLessonDate || !effectiveBody) {
    throw new HttpsError('invalid-argument', 'A lesson date and assignment details are required for the parent portal.');
  }

  const [studentsSnap, schoolYearKey] = await Promise.all([
    db.collection(`${PUBLIC_DATA_PATH}/students`).where('classId', '==', classId).get(),
    classData.schoolYearKey || getActiveSchoolYearKey()
  ]);

  // Students are synced several at a time rather than one after another, so a full class
  // takes about as long as a few students used to.
  let syncedCount = 0;
  await forEachLimited(studentsSnap.docs, HOMEWORK_SYNC_CONCURRENCY, async (studentDoc) => {
    const studentId = studentDoc.id;
    const existingSnap = await db.collection(`${PUBLIC_DATA_PATH}/parent_homework`)
      .where('studentId', '==', studentId)
      .where('sourceType', '==', 'quest-assignment')
      .where('sourceClassId', '==', classId)
      .limit(1)
      .get();

    const payload = {
      studentId,
      classId,
      schoolYearKey,
      lessonDate: effectiveLessonDate,
      title: effectiveTitle,
      body: effectiveBody,
      status: 'published',
      sourceType: 'quest-assignment',
      sourceClassId: classId,
      sourceTestDate: String(testData?.date || '').trim() || null,
      publishedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    if (existingSnap.empty) {
      await db.collection(`${PUBLIC_DATA_PATH}/parent_homework`).add(payload);
    } else {
      await existingSnap.docs[0].ref.set(payload, { merge: true });
    }
    await upsertParentSnapshot(studentId);
    syncedCount += 1;
  });

  return { ok: true, syncedCount };
});

exports.postCommunicationMessage = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  const isSecretary = await isCanonicalSecretaryCaller(caller);
  if (caller.profile.role === 'secretary' && !isSecretary) {
    throw new HttpsError('permission-denied', 'This is not the active canonical Secretary/admin account.');
  }
  await requireFeatureEnabled(isSecretary ? 'secretaryAccess' : 'parentAccess');
  const threadId = String(request.data?.threadId || '').trim();
  const studentId = String(request.data?.studentId || '').trim();
  const body = String(request.data?.body || '').trim();
  const messageType = String(request.data?.messageType || 'message').trim();
  if (!threadId || !studentId || !body) {
    throw new HttpsError('invalid-argument', 'Thread, student, and body are required.');
  }

  const threadRef = db.doc(`${PUBLIC_DATA_PATH}/communication_threads/${threadId}`);
  const isParent = caller.profile.role === 'parent';
  const [threadSnap, student] = await Promise.all([
    threadRef.get(),
    isParent ? null : getStudent(studentId).catch((error) => error)
  ]);
  if (!threadSnap.exists) {
    throw new HttpsError('not-found', 'That communication thread no longer exists.');
  }
  if (student instanceof Error) throw student;
  const thread = threadSnap.data() || {};
  const canManage = isSecretary;
  const ownsStudent = !isParent ? student.createdBy?.uid === caller.uid : false;
  const isParticipant = Array.isArray(thread.participantUids) && thread.participantUids.includes(caller.uid);

  if (!canManage && !ownsStudent && !isParticipant) {
    throw new HttpsError('permission-denied', 'You are not allowed to post in this thread.');
  }
  if (isParent && caller.profile.linkedStudentId !== studentId) {
    throw new HttpsError('permission-denied', 'Parents can only reply inside their linked student thread.');
  }

  await addCommunicationMessage({
    threadId,
    studentId,
    body,
    authorUid: caller.uid,
    authorRole: caller.profile.role || 'teacher',
    messageType,
    requiresReply: messageType === 'meeting-request'
  });

  return { ok: true };
});

async function requireLinkedParent(request) {
  const caller = await requireAuthedCaller(request);
  if (caller.profile.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only a family login can do this.');
  }
  const studentId = String(caller.profile.linkedStudentId || '').trim();
  if (!studentId) {
    throw new HttpsError('failed-precondition', 'This family login is not linked to a student yet.');
  }
  return { caller, studentId };
}

// A family opening the portal asks for a fresh summary; one rebuild every few minutes keeps
// stars and grades current without spending reads on every tap.
const FAMILY_REFRESH_MIN_MS = 5 * 60 * 1000;

exports.refreshFamilySnapshot = callable(async (request) => {
  const [{ studentId }] = await allInOrder([requireLinkedParent(request), requireFeatureEnabled('parentAccess')]);
  const snapRef = db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`);
  const current = await snapRef.get();
  const refreshedAt = current.exists ? current.data()?.refreshedAt : null;
  const refreshedMs = refreshedAt?.toMillis ? refreshedAt.toMillis() : 0;
  if (refreshedMs && Date.now() - refreshedMs < FAMILY_REFRESH_MIN_MS) {
    return { ok: true, refreshed: false };
  }
  await upsertParentSnapshot(studentId);
  return { ok: true, refreshed: true };
});

// What a family can start a conversation about. Each topic keeps one thread per child.
const FAMILY_TOPICS = {
  question: 'family-question',
  meeting: 'meeting-request',
  absence: 'absence-note',
  message: 'family-message'
};

exports.sendFamilyMessage = callable(async (request) => {
  const [{ caller, studentId }] = await allInOrder([requireLinkedParent(request), requireFeatureEnabled('parentAccess')]);
  const threadType = FAMILY_TOPICS[String(request.data?.topic || '').trim()];
  const body = String(request.data?.body || '').trim();
  if (!threadType) throw new HttpsError('invalid-argument', 'Choose what the message is about.');
  if (!body) throw new HttpsError('invalid-argument', 'Write a message first.');
  if (body.length > 2000) throw new HttpsError('invalid-argument', 'Keep the message under 2000 characters.');

  const student = await getStudent(studentId);
  // The child's teacher joins the thread; the School Office reads every family thread.
  const { threadId, threadRef } = await ensureCommunicationThread({
    studentId,
    threadType,
    participantUids: [caller.uid, student.createdBy?.uid],
    participantRoles: ['parent', 'teacher'],
    createdBy: { uid: caller.uid, role: 'parent' }
  });
  const threadSnap = await threadRef.get();
  const participants = Array.isArray(threadSnap.data()?.participantUids) ? threadSnap.data().participantUids : [];
  if (!participants.includes(caller.uid)) {
    await threadRef.set({ participantUids: FieldValue.arrayUnion(caller.uid) }, { merge: true });
  }
  await addCommunicationMessage({
    threadId,
    studentId,
    body,
    authorUid: caller.uid,
    authorRole: 'parent',
    messageType: threadType,
    requiresReply: threadType === 'meeting-request'
  });
  return { ok: true, threadId };
});

exports.backfillRoleAccessData = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  await requireCanonicalSecretaryCaller(caller);
  await requireFeatureEnabled('secretaryAccess');

  const studentsSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`).get();
  const studentDocs = studentsSnap.docs;
  const concurrency = 6;
  let snapshotCount = 0;

  for (let i = 0; i < studentDocs.length; i += concurrency) {
    const chunk = studentDocs.slice(i, i + concurrency);
    await Promise.all(chunk.map((studentDoc) => upsertParentSnapshot(studentDoc.id)));
    snapshotCount += chunk.length;
  }

  return {
    ok: true,
    parentSnapshotsUpdated: snapshotCount
  };
}, { timeoutSeconds: 540, memory: '1GB' });

function withYear(payload, yearKey) {
  const resolved = String(payload.schoolYearKey || yearKey || '').trim();
  if (!/^\d{4}-\d{4}$/.test(resolved)) {
    throw new HttpsError('failed-precondition', 'The active school year is unavailable.');
  }
  return { ...payload, schoolYearKey: resolved };
}

function withActiveYear(payload, yearKey) {
  const resolved = String(payload.activeSchoolYearKey || yearKey || '').trim();
  if (!/^\d{4}-\d{4}$/.test(resolved)) {
    throw new HttpsError('failed-precondition', 'The active school year is unavailable.');
  }
  return { ...payload, activeSchoolYearKey: resolved };
}

async function requireYearOperator(request) {
  const caller = await requireAuthedCaller(request);
  return requireCanonicalSecretaryCaller(caller);
}

function parseCloseDateFlexible(dateInput) {
  if (!dateInput) return null;
  const str = String(dateInput).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parts = str.split(/[^0-9]/).filter(Boolean);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (p2 >= 1 && p2 <= 12 && p3 > 1000) return new Date(p3, p2 - 1, p1);
    if (p1 > 1000) return new Date(p1, p2 - 1, p3);
  }
  const rawParse = new Date(str);
  return Number.isNaN(rawParse.getTime()) ? null : rawParse;
}

function formatCloseDateForMessage(dateInput) {
  const d = parseCloseDateFlexible(dateInput);
  if (!d || Number.isNaN(d.getTime())) return String(dateInput || 'not configured');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

function isCloseDateReached(closeDate) {
  const close = parseCloseDateFlexible(closeDate);
  if (!close || Number.isNaN(close.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closeDay = new Date(close);
  closeDay.setHours(0, 0, 0, 0);
  return today >= closeDay;
}

async function commitBatchChunks(refsAndPayloads, mode = 'set', chunkSize = 400) {
  let count = 0;
  for (let i = 0; i < refsAndPayloads.length; i += chunkSize) {
    const batch = db.batch();
    refsAndPayloads.slice(i, i + chunkSize).forEach((item) => {
      if (mode === 'update') batch.update(item.ref, item.payload);
      else if (mode === 'delete') batch.delete(item.ref);
      else batch.set(item.ref, item.payload, { merge: true });
      count += 1;
    });
    await batch.commit();
  }
  return count;
}

async function getConfiguredCloseDate() {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
  const closeDate = snap.data()?.closeDate;
  if (!parseCloseDateFlexible(closeDate)) {
    throw new HttpsError('failed-precondition', 'The school-year close date is not configured.');
  }
  return closeDate;
}

async function ensureSchoolYears(closingYearKey, nextYearKey, rolloverStatus = 'preparing') {
  const stateRef = db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`);
  const closingRef = db.doc(`${PUBLIC_DATA_PATH}/school_years/${closingYearKey}`);
  const nextRef = db.doc(`${PUBLIC_DATA_PATH}/school_years/${nextYearKey}`);
  const [stateSnap, closingSnap, nextSnap] = await Promise.all([
    stateRef.get(),
    closingRef.get(),
    nextRef.get()
  ]);
  const existingState = stateSnap.data() || {};
  const closeDate = existingState.closeDate;
  if (!parseCloseDateFlexible(closeDate)) {
    throw new HttpsError('failed-precondition', 'Configure the school-year close date before preparing rollover.');
  }
  const writes = [];
  const closing = {
    label: closingYearKey,
    startsAt: `${closingYearKey.slice(0, 4)}-09-01`,
    status: 'active',
    endsAt: closeDate,
    closeAvailableAt: closeDate,
    updatedAt: FieldValue.serverTimestamp()
  };
  const next = {
    label: nextYearKey,
    startsAt: `${nextYearKey.slice(0, 4)}-09-01`,
    endsAt: `${nextYearKey.slice(5)}-06-10`,
    closeAvailableAt: `${nextYearKey.slice(5)}-06-10`,
    status: 'planned',
    updatedAt: FieldValue.serverTimestamp()
  };

  if (!closingSnap.exists) writes.push({ ref: closingRef, payload: closing });
  if (!nextSnap.exists) writes.push({ ref: nextRef, payload: { ...next, status: 'planned' } });

  const statePayload = {
    activeYearKey: closingYearKey,
    nextYearKey,
    rolloverStatus,
    enforceActiveYearQueries: true,
    updatedAt: FieldValue.serverTimestamp()
  };
  statePayload.closeDate = closeDate;
  const stateNeedsUpdate = !stateSnap.exists ||
    existingState.activeYearKey !== closingYearKey ||
    existingState.nextYearKey !== nextYearKey ||
    existingState.rolloverStatus !== rolloverStatus ||
    existingState.closeDate !== closeDate ||
    existingState.enforceActiveYearQueries !== true;
  if (stateNeedsUpdate) writes.push({ ref: stateRef, payload: statePayload });
  if (writes.length) await commitBatchChunks(writes);
  return { writes: writes.length, activeExists: closingSnap.exists, nextExists: nextSnap.exists };
}

function getFollowingSchoolYearKey(yearKey) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(yearKey || '').trim());
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new HttpsError('failed-precondition', 'The planned school-year key is invalid.');
  }
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

async function ensurePlannedSchoolYearRecord(yearKey) {
  const yearRef = db.doc(`${PUBLIC_DATA_PATH}/school_years/${yearKey}`);
  const yearSnap = await yearRef.get();
  if (yearSnap.exists) return { created: false };
  try {
    await yearRef.create({
      label: yearKey,
      startsAt: `${yearKey.slice(0, 4)}-09-01`,
      endsAt: `${yearKey.slice(5)}-06-10`,
      closeAvailableAt: `${yearKey.slice(5)}-06-10`,
      status: 'planned',
      updatedAt: FieldValue.serverTimestamp()
    });
    return { created: true };
  } catch (error) {
    if (error?.code === 6 || error?.code === 'already-exists') return { created: false };
    throw error;
  }
}

async function countCollection(collectionName) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/${collectionName}`).count().get();
  return snap.data().count || 0;
}

async function buildRolloverPreview({ closingYearKey, nextYearKey }) {
  const [classesCount, studentsCount, scoresCount, parentLinksCount, guildScoresCount, awardLogsCount, missingScoresSnap, unguildedSnap] = await Promise.all([
    countCollection('classes'),
    countCollection('students'),
    countCollection('student_scores'),
    countCollection('parent_links'),
    countCollection('guild_scores'),
    countCollection('award_log'),
    db.collection(`${PUBLIC_DATA_PATH}/students`).limit(500).get(),
    db.collection(`${PUBLIC_DATA_PATH}/students`).where('guildId', '==', null).limit(25).get().catch(() => ({ docs: [] }))
  ]);

  const scoreRefs = await Promise.all(missingScoresSnap.docs.map((studentDoc) => db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentDoc.id}`).get()));
  const missingScores = missingScoresSnap.docs
    .filter((studentDoc, index) => !scoreRefs[index].exists)
    .map((studentDoc) => ({ id: studentDoc.id, name: studentDoc.data().name || 'Unnamed student' }));

  const blockers = [];
  const warnings = [];
  if (missingScores.length) {
    blockers.push({
      code: 'missing-score-docs',
      label: `${missingScores.length} students need score records before close.`,
      fix: 'Run the migration/backfill. The app can create missing score records automatically.'
    });
  }
  if (unguildedSnap.docs.length) {
    warnings.push({
      code: 'students-without-guilds',
      label: `${unguildedSnap.docs.length} students have no guild yet.`,
      fix: 'This is allowed, but returning students with guilds will keep them permanently.'
    });
  }

  return {
    ok: true,
    closingYearKey,
    nextYearKey,
    safeToClose: blockers.length === 0,
    counts: {
      classes: classesCount,
      students: studentsCount,
      studentScores: scoresCount,
      parentLinks: parentLinksCount,
      guildScores: guildScoresCount,
      awardLogsThisFeed: awardLogsCount
    },
    blockers,
    warnings,
    checklist: [
      { label: 'School years exist', status: 'ready' },
      { label: 'Students have score records', status: missingScores.length ? 'needs_attention' : 'ready' },
      { label: 'Parent links can be refreshed', status: 'ready' },
      { label: 'Guild membership will be preserved', status: 'ready' },
      { label: 'Gold and long-term belongings will remain', status: 'ready' }
    ]
  };
}

exports.previewYearRollover = callable(async (request) => {
  await requireYearOperator(request);
  const closingYearKey = String(request.data?.closingYearKey || await getActiveSchoolYearKey()).trim();
  const nextYearKey = String(request.data?.nextYearKey || await getPlannedSchoolYearKey()).trim();
  await ensureSchoolYears(closingYearKey, nextYearKey, 'preparing');
  return buildRolloverPreview({ closingYearKey, nextYearKey });
});

exports.ensureOpenSchoolYears = callable(async (request) => {
  await requireYearOperator(request);
  const stateSnap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
  const configured = stateSnap.data() || {};
  const activeYearKey = String(configured.activeYearKey || '').trim();
  const nextYearKey = String(configured.nextYearKey || '').trim();
  if (!/^\d{4}-\d{4}$/.test(activeYearKey) || !/^\d{4}-\d{4}$/.test(nextYearKey)) {
    throw new HttpsError('failed-precondition', 'Configure valid active and planned school-year keys first.');
  }
  const result = await ensureSchoolYears(
    activeYearKey,
    nextYearKey,
    String(configured.rolloverStatus || 'preparing')
  );
  return { ok: true, activeYearKey, nextYearKey, ...result };
});

exports.backfillSchoolYearData = callable(async (request) => {
  const caller = await requireYearOperator(request);
  const closingYearKey = String(request.data?.closingYearKey || await getActiveSchoolYearKey()).trim();
  const nextYearKey = String(request.data?.nextYearKey || await getPlannedSchoolYearKey()).trim();
  await ensureSchoolYears(closingYearKey, nextYearKey, 'preparing');

  const writes = [];
  const classesSnap = await db.collection(`${PUBLIC_DATA_PATH}/classes`).get();
  classesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    writes.push({
      ref: docSnap.ref,
      payload: {
        schoolYearKey: data.schoolYearKey || closingYearKey,
        status: data.status || 'active',
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });

  const studentsSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`).get();
  studentsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    writes.push({
      ref: docSnap.ref,
      payload: {
        activeSchoolYearKey: data.activeSchoolYearKey || closingYearKey,
        enrollmentStatus: data.enrollmentStatus || 'active',
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });

  const classById = new Map(classesSnap.docs.map((docSnap) => [docSnap.id, docSnap.data() || {}]));
  const studentById = new Map(studentsSnap.docs.map((docSnap) => [docSnap.id, docSnap.data() || {}]));
  const scoreSnap = await db.collection(`${PUBLIC_DATA_PATH}/student_scores`).get();
  const existingScoreIds = new Set(scoreSnap.docs.map((docSnap) => docSnap.id));
  scoreSnap.docs.forEach((docSnap) => {
    const student = studentById.get(docSnap.id) || {};
    writes.push({
      ref: docSnap.ref,
      payload: {
        activeSchoolYearKey: docSnap.data().activeSchoolYearKey || closingYearKey,
        createdBy: docSnap.data().createdBy || student.createdBy || null,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });
  studentsSnap.docs.forEach((studentDoc) => {
    if (existingScoreIds.has(studentDoc.id)) return;
    const student = studentDoc.data() || {};
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentDoc.id}`),
      payload: withActiveYear({
        totalStars: 0,
        monthlyStars: 0,
        gold: 0,
        inventory: [],
        starsByReason: {},
        heroLevel: 0,
        heroSkills: [],
        pendingSkillChoice: false,
        createdBy: student.createdBy || null,
        createdAt: FieldValue.serverTimestamp()
      }, closingYearKey)
    });
  });

  const yearCollections = [
    'ember_oaths',
    'campfire_sessions',
    'award_log',
    'attendance',
    'written_scores',
    'adventure_logs',
    'quest_events',
    'quest_assignments',
    'schedule_overrides',
    'shop_items',
    'fortune_wheel_log',
    'quest_history',
    'hero_chronicle_notes',
    'parent_homework',
    'communication_threads',
    'communication_messages',
    'quest_bounties',
    'completed_stories',
    'quiz_of_the_week'
  ];

  for (const collectionName of yearCollections) {
    const snap = await db.collection(`${PUBLIC_DATA_PATH}/${collectionName}`).get();
    snap.docs.forEach((docSnap) => {
      if (docSnap.data()?.schoolYearKey) return;
      writes.push({
        ref: docSnap.ref,
        payload: { schoolYearKey: closingYearKey, updatedAt: FieldValue.serverTimestamp() }
      });
    });
  }

  const parentLinkSnap = await db.collection(`${PUBLIC_DATA_PATH}/parent_links`).get();
  parentLinkSnap.docs.forEach((docSnap) => {
    const student = studentById.get(docSnap.id);
    if (!student) return;
    writes.push({
      ref: docSnap.ref,
      payload: {
        classId: student.classId || docSnap.data().classId || null,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });

  const written = await commitBatchChunks(writes);
  let parentSnapshotsUpdated = 0;
  for (const studentDoc of studentsSnap.docs) {
    await upsertParentSnapshot(studentDoc.id, {
      activeSchoolYearKey: closingYearKey,
      classId: studentDoc.data().classId || null,
      className: classById.get(studentDoc.data().classId)?.name || ''
    });
    parentSnapshotsUpdated += 1;
  }

  await db.doc(`${PUBLIC_DATA_PATH}/rollover_jobs/backfill_${closingYearKey}`).set({
    type: 'backfill',
    closingYearKey,
    nextYearKey,
    status: 'completed',
    startedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    writeCount: written,
    parentSnapshotsUpdated,
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, writeCount: written, parentSnapshotsUpdated };
});

exports.closeSchoolYear = callable(async (request) => {
  const caller = await requireYearOperator(request);
  const closingYearKey = String(request.data?.closingYearKey || await getActiveSchoolYearKey()).trim();
  const nextYearKey = String(request.data?.nextYearKey || await getPlannedSchoolYearKey()).trim();
  const followingYearKey = getFollowingSchoolYearKey(nextYearKey);
  const confirmation = String(request.data?.confirmation || '').trim();
  const allowEarlyClose = request.data?.allowEarlyClose === true;
  if (confirmation !== `CLOSE ${closingYearKey}`) {
    throw new HttpsError('invalid-argument', `Type CLOSE ${closingYearKey} to confirm.`);
  }
  const configuredCloseDate = await getConfiguredCloseDate();
  if (!allowEarlyClose && !isCloseDateReached(configuredCloseDate)) {
    throw new HttpsError('failed-precondition', `The final close unlocks on ${formatCloseDateForMessage(configuredCloseDate)}.`);
  }

  const preview = await buildRolloverPreview({ closingYearKey, nextYearKey });
  if (!preview.safeToClose) {
    throw new HttpsError('failed-precondition', 'Fix the rollover blockers before closing the school year.');
  }

  const jobId = `close_${closingYearKey}_${nextYearKey}`;
  const jobRef = db.doc(`${PUBLIC_DATA_PATH}/rollover_jobs/${jobId}`);
  const jobSnap = await jobRef.get();
  if (jobSnap.exists && jobSnap.data()?.status === 'completed') {
    return { ok: true, jobId, alreadyCompleted: true };
  }

  await jobRef.set({
    type: 'close',
    status: 'running',
    stage: 'starting',
    closingYearKey,
    nextYearKey,
    startedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    startedAt: FieldValue.serverTimestamp(),
    preview
  }, { merge: true });

  await ensureSchoolYears(closingYearKey, nextYearKey, 'closing');

  const [classesSnap, studentsSnap, scoresSnap, guildScoresSnap] = await Promise.all([
    db.collection(`${PUBLIC_DATA_PATH}/classes`).get(),
    db.collection(`${PUBLIC_DATA_PATH}/students`).get(),
    db.collection(`${PUBLIC_DATA_PATH}/student_scores`).get(),
    db.collection(`${PUBLIC_DATA_PATH}/guild_scores`).get()
  ]);

  const classById = new Map(classesSnap.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }]));
  const scoreById = new Map(scoresSnap.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }]));
  const studentWrites = [];
  const scoreWrites = [];
  const snapshotWrites = [];
  const classWrites = [];
  const guildWrites = [];
  const deleteWrites = [];

  classesSnap.docs.forEach((classDoc) => {
    const cls = classDoc.data() || {};
    snapshotWrites.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/class_year_snapshots/${classDoc.id}_${closingYearKey}`),
      payload: withYear({
        classId: classDoc.id,
        name: cls.name || '',
        questLevel: cls.questLevel || '',
        createdBy: cls.createdBy || null,
        scheduleDays: cls.scheduleDays || [],
        assessmentConfig: cls.assessmentConfig || null,
        archivedAt: FieldValue.serverTimestamp()
      }, closingYearKey)
    });
    classWrites.push({
      ref: classDoc.ref,
      payload: {
        schoolYearKey: cls.schoolYearKey || closingYearKey,
        status: 'archived',
        archivedAt: FieldValue.serverTimestamp()
      }
    });
  });

  studentsSnap.docs.forEach((studentDoc) => {
    const student = studentDoc.data() || {};
    const score = scoreById.get(studentDoc.id) || {};
    const classData = classById.get(student.classId) || {};
    snapshotWrites.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_year_snapshots/${studentDoc.id}_${closingYearKey}`),
      payload: withYear({
        studentId: studentDoc.id,
        name: student.name || '',
        classId: student.classId || null,
        className: classData.name || '',
        teacher: student.createdBy || null,
        questLevel: classData.questLevel || '',
        guildId: student.guildId || null,
        guildAssignmentDate: student.guildAssignmentDate || null,
        totalStars: score.totalStars || 0,
        monthlyStars: score.monthlyStars || 0,
        goldAtClose: score.gold || 0,
        heroOfDayWinsAtClose: score.heroOfDayWins || 0,
        heroClass: student.heroClass || '',
        heroLevel: score.heroLevel || 0,
        heroSkills: score.heroSkills || [],
        enrollmentStatusAtClose: student.enrollmentStatus || 'active',
        archivedAt: FieldValue.serverTimestamp()
      }, closingYearKey)
    });
    studentWrites.push({
      ref: studentDoc.ref,
      payload: {
        activeSchoolYearKey: nextYearKey,
        enrollmentStatus: 'pendingPlacement',
        // A student already waiting in placement keeps the class they were released from.
        previousClassId: student.classId || student.previousClassId || null,
        previousClassName: classData.name || student.previousClassName || '',
        previousQuestLevel: classData.questLevel || student.previousQuestLevel || '',
        previousTeacher: student.classId ? (student.createdBy || null) : (student.previousTeacher || student.createdBy || null),
        classId: null,
        releasedAt: FieldValue.delete(),
        releasedYearKey: FieldValue.delete(),
        releasedBy: FieldValue.delete(),
        heroClassChangeCount: 0,
        heroClassLockYearKey: nextYearKey,
        isHeroClassLocked: false,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
    scoreWrites.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentDoc.id}`),
      payload: withActiveYear({
        totalStars: 0,
        monthlyStars: 0,
        gold: 0,
        inventory: [],
        starsByReason: FieldValue.delete(),
        heroOfDayWins: 0,
        heroOfDayWinsYearKey: nextYearKey,
        heroLevel: 0,
        heroSkills: [],
        pendingSkillChoice: false,
        lastGuildBonusMonth: FieldValue.delete(),
        lastPatronPathCreditWeekKey: FieldValue.delete(),
        lastMonthlyResetDate: `${new Date().toISOString().slice(0, 7)}-01`,
        starfallCatalystActive: FieldValue.delete(),
        hasGildedEffect: FieldValue.delete(),
        luckDate: FieldValue.delete(),
        storyWeaverDoubleNext: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      }, nextYearKey)
    });
  });

  guildScoresSnap.docs.forEach((guildDoc) => {
    const guild = guildDoc.data() || {};
    snapshotWrites.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/guild_year_snapshots/${guildDoc.id}_${closingYearKey}`),
      payload: withYear({
        guildId: guildDoc.id,
        guildName: guild.guildName || guildDoc.id,
        totalStars: guild.totalStars || 0,
        totalGlory: guild.totalGlory || 0,
        monthlyGlory: guild.monthlyGlory || 0,
        weeklyGlory: guild.weeklyGlory || 0,
        memberIds: guild.memberIds || [],
        memberCount: guild.memberCount || 0,
        archivedAt: FieldValue.serverTimestamp()
      }, closingYearKey)
    });
    guildWrites.push({
      ref: guildDoc.ref,
      payload: withActiveYear({
        totalStars: 0,
        totalGlory: 0,
        monthlyGlory: 0,
        weeklyGlory: 0,
        previousWeekGlory: 0,
        gloryModifier: FieldValue.delete(),
        gloryModifierReason: FieldValue.delete(),
        chaliceLevel: 0,
        chaliceProgress: 0,
        weeklyActivity: {},
        memberIds: [],
        memberCount: 0,
        updatedAt: FieldValue.serverTimestamp()
      }, nextYearKey)
    });
  });

  const todayStarsSnap = await db.collection(`${PUBLIC_DATA_PATH}/today_stars`).get();
  todayStarsSnap.docs.forEach((docSnap) => deleteWrites.push({ ref: docSnap.ref }));

  await jobRef.set({ stage: 'writing_snapshots', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await commitBatchChunks(snapshotWrites);
  await jobRef.set({ stage: 'resetting_students', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await commitBatchChunks(studentWrites, 'update');
  await commitBatchChunks(scoreWrites);
  await commitBatchChunks(classWrites);
  await commitBatchChunks(guildWrites);
  await commitBatchChunks(deleteWrites, 'delete');

  await db.doc(`${PUBLIC_DATA_PATH}/school_years/${closingYearKey}`).set({
    status: 'closed',
    closedAt: FieldValue.serverTimestamp(),
    rolloverJobId: jobId
  }, { merge: true });
  await db.doc(`${PUBLIC_DATA_PATH}/school_years/${nextYearKey}`).set({
    status: 'active',
    activatedAt: FieldValue.serverTimestamp(),
    rolloverJobId: jobId
  }, { merge: true });
  await ensurePlannedSchoolYearRecord(followingYearKey);
  await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).set({
    activeYearKey: nextYearKey,
    nextYearKey: followingYearKey,
    rolloverStatus: 'september_setup',
    lastClosedYearKey: closingYearKey,
    rolloverJobId: jobId,
    enforceActiveYearQueries: true,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await jobRef.set({
    status: 'completed',
    stage: 'closed',
    counts: {
      studentSnapshots: studentsSnap.size,
      classSnapshots: classesSnap.size,
      guildSnapshots: guildScoresSnap.size,
      clearedTodayStars: todayStarsSnap.size
    },
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, jobId };
});

function isCarriedPriorYearGold(score, lastClosedYearKey) {
  if (!lastClosedYearKey) return false;
  const gold = Number(score?.gold || 0);
  if (!(gold > 0)) return false;
  return Number(score?.totalStars || 0) === 0 && Number(score?.monthlyStars || 0) === 0;
}

function isCarriedPriorYearLegendWins(score, lastClosedYearKey, activeYearKey) {
  if (!lastClosedYearKey) return false;
  const wins = Number(score?.heroOfDayWins || 0);
  if (!(wins > 0)) return false;
  const stampedYear = String(score?.heroOfDayWinsYearKey || '').trim();
  const active = String(activeYearKey || '').trim();
  if (stampedYear && active && stampedYear === active) return false;
  return true;
}

async function archiveCarriedLiveGoldBalances(stateData = {}) {
  const activeYearKey = String(stateData.activeYearKey || '').trim();
  const lastClosedYearKey = String(stateData.lastClosedYearKey || '').trim();
  if (!lastClosedYearKey) return { archivedCount: 0 };

  const scoresSnap = await db.collection(`${PUBLIC_DATA_PATH}/student_scores`).get();
  const scoreWrites = [];
  const parentWrites = [];
  scoresSnap.docs.forEach((docSnap) => {
    const score = docSnap.data() || {};
    if (score.activeSchoolYearKey && activeYearKey && score.activeSchoolYearKey !== activeYearKey) return;
    const payload = { updatedAt: FieldValue.serverTimestamp() };
    let changed = false;
    if (isCarriedPriorYearGold(score, lastClosedYearKey)) {
      payload.gold = 0;
      changed = true;
      parentWrites.push({
        ref: db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${docSnap.id}`),
        payload: {
          'progress.gold': 0,
          updatedAt: FieldValue.serverTimestamp()
        }
      });
    }
    if (isCarriedPriorYearLegendWins(score, lastClosedYearKey, activeYearKey)) {
      payload.heroOfDayWins = 0;
      payload.heroOfDayWinsYearKey = activeYearKey;
      changed = true;
    }
    if (!changed) return;
    scoreWrites.push({
      ref: docSnap.ref,
      payload
    });
  });

  await commitBatchChunks(scoreWrites);
  await commitBatchChunks(parentWrites);
  return { archivedCount: scoreWrites.length };
}

exports.archiveCarriedYearGold = callable(async (request) => {
  await requireYearOperator(request);
  const stateSnap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
  const stateData = stateSnap.exists ? (stateSnap.data() || {}) : {};
  const result = await archiveCarriedLiveGoldBalances(stateData);
  return { ok: true, ...result };
});

exports.openSchoolYear = callable(async (request) => {
  const caller = await requireYearOperator(request);
  const stateSnap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
  const stateData = stateSnap.exists ? (stateSnap.data() || {}) : {};
  const activeYearKey = String(request.data?.schoolYearKey || stateData.activeYearKey || '').trim();
  if (!/^\d{4}-\d{4}$/.test(activeYearKey)) {
    throw new HttpsError('failed-precondition', 'The active school year is unavailable.');
  }

  const archivedGold = await archiveCarriedLiveGoldBalances({
    ...stateData,
    activeYearKey
  });
  const currentStatus = String(stateData.rolloverStatus || '').toLowerCase();
  if (currentStatus === 'active') {
    return {
      ok: true,
      alreadyOpen: true,
      activeYearKey,
      rolloverStatus: 'active',
      archivedGoldBalances: archivedGold.archivedCount
    };
  }

  const startsAtInput = String(request.data?.startsAt || '').trim();
  const yearPayload = {
    status: 'active',
    openedAt: FieldValue.serverTimestamp(),
    openedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    updatedAt: FieldValue.serverTimestamp()
  };
  if (startsAtInput) {
    yearPayload.startsAt = startsAtInput;
  }

  await db.doc(`${PUBLIC_DATA_PATH}/school_years/${activeYearKey}`).set(yearPayload, { merge: true });
  await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).set({
    activeYearKey,
    rolloverStatus: 'active',
    openedAt: FieldValue.serverTimestamp(),
    openedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    enforceActiveYearQueries: true,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    alreadyOpen: false,
    activeYearKey,
    rolloverStatus: 'active'
  };
});

exports.allocateReturningStudents = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  const studentIds = Array.isArray(request.data?.studentIds) ? request.data.studentIds.map(String).filter(Boolean) : [];
  const classId = String(request.data?.classId || '').trim();
  if (!studentIds.length || !classId) {
    throw new HttpsError('invalid-argument', 'Choose students and a September class.');
  }
  const classSnap = await db.doc(`${PUBLIC_DATA_PATH}/classes/${classId}`).get();
  if (!classSnap.exists) throw new HttpsError('not-found', 'That September class was not found.');
  const classData = classSnap.data() || {};
  if (classData.status === 'archived') throw new HttpsError('failed-precondition', 'Choose an active September class.');
  const isOperator = await isCanonicalSecretaryCaller(caller);
  const ownerUid = classData.createdBy?.uid;
  if (!isOperator && ownerUid !== caller.uid) {
    throw new HttpsError('permission-denied', 'You can only place students into your own classes. Ask the Secretary if you need help.');
  }
  const yearKey = classData.schoolYearKey || String(request.data?.schoolYearKey || await getPlannedSchoolYearKey()).trim();
  const owner = classData.createdBy || null;

  const writes = [];
  const placementMeta = [];
  for (const studentId of studentIds) {
    const studentSnap = await db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`).get();
    if (!studentSnap.exists) {
      throw new HttpsError('not-found', 'One of the selected students was not found.');
    }
    const studentData = studentSnap.data() || {};
    if (studentData.enrollmentStatus !== 'pendingPlacement') {
      throw new HttpsError(
        'failed-precondition',
        `${studentData.name || 'That student'} is not waiting for September placement.`
      );
    }
    // A student released from a class earlier this same year (releaseStudentToPlacement)
    // is only changing class, so they keep this year's gold and hero progress.
    const releasedThisYear = Boolean(studentData.releasedYearKey) && studentData.releasedYearKey === yearKey;
    placementMeta.push({
      studentId,
      previousOwnerUid: studentData.createdBy?.uid || null,
      releasedThisYear
    });
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`),
      payload: {
        classId,
        createdBy: owner,
        activeSchoolYearKey: yearKey,
        enrollmentStatus: 'active',
        placedAt: FieldValue.serverTimestamp(),
        releasedAt: FieldValue.delete(),
        releasedYearKey: FieldValue.delete(),
        releasedBy: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      }
    });
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentId}`),
      payload: releasedThisYear ? {
        createdBy: owner,
        activeSchoolYearKey: yearKey,
        updatedAt: FieldValue.serverTimestamp()
      } : {
        createdBy: owner,
        activeSchoolYearKey: yearKey,
        gold: 0,
        heroLevel: 0,
        heroSkills: [],
        pendingSkillChoice: false,
        starsByReason: FieldValue.delete(),
        lastGuildBonusMonth: FieldValue.delete(),
        lastPatronPathCreditWeekKey: FieldValue.delete(),
        heroOfDayWins: 0,
        heroOfDayWinsYearKey: yearKey,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${yearKey}`),
      payload: withYear({
        studentId,
        classId,
        className: classData.name || '',
        teacher: owner,
        enrollmentStatus: 'active',
        placedAt: FieldValue.serverTimestamp()
      }, yearKey)
    });
    if (releasedThisYear) {
      // This year's Ember Oaths follow them to the new class, as they do on a direct transfer.
      const oathsSnap = await db.collection(PUBLIC_DATA_PATH + '/ember_oaths')
        .where('studentId', '==', studentId).where('schoolYearKey', '==', yearKey).get();
      oathsSnap.docs.forEach((oath) => writes.push({
        ref: oath.ref,
        payload: { classId, teacherId: owner?.uid || null, createdBy: owner, updatedAt: FieldValue.serverTimestamp() }
      }));
    }
    const parentLinkSnap = await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).get();
    if (parentLinkSnap.exists && (parentLinkSnap.data()?.parentUid || parentLinkSnap.data()?.username)) {
      writes.push({
        ref: parentLinkSnap.ref,
        payload: { classId, updatedAt: FieldValue.serverTimestamp() }
      });
    }
  }

  await commitBatchChunks(writes);
  for (const { studentId, previousOwnerUid } of placementMeta) {
    const link = await getParentLink(studentId);
    await syncStudentThreadParticipants(studentId, {
      addUid: owner?.uid || null,
      removeUid: previousOwnerUid && previousOwnerUid !== owner?.uid ? previousOwnerUid : null,
      keepUids: link?.parentUid ? [link.parentUid] : []
    });
    await upsertParentSnapshot(studentId, {
      activeSchoolYearKey: yearKey,
      classId,
      className: classData.name || ''
    });
  }
  return { ok: true, placedCount: studentIds.length };
});

exports.assignClassTeacher = callable(async (request) => {
  const caller = await requireYearOperator(request);
  await requireFeatureEnabled('secretaryAccess');
  const classId = String(request.data?.classId || '').trim();
  const teacherUid = String(request.data?.teacherUid || '').trim();
  const teacherName = String(request.data?.teacherName || '').trim();
  if (!classId || !teacherUid) {
    throw new HttpsError('invalid-argument', 'Choose a class and a teacher.');
  }

  const [classSnap, profileSnap] = await Promise.all([
    db.doc(`${PUBLIC_DATA_PATH}/classes/${classId}`).get(),
    db.collection(PROFILE_COLLECTION).doc(teacherUid).get()
  ]);
  if (!classSnap.exists) throw new HttpsError('not-found', 'That class was not found.');
  const classData = classSnap.data() || {};
  if (classData.status === 'archived') {
    throw new HttpsError('failed-precondition', 'That class is archived.');
  }

  const previousOwnerUid = classData.createdBy?.uid || null;
  const owner = {
    uid: teacherUid,
    name: teacherName || profileSnap.data()?.displayName || classData.createdBy?.name || 'Teacher'
  };

  if (previousOwnerUid === owner.uid && classData.createdBy?.name === owner.name) {
    return { ok: true, alreadyAssigned: true, movedStudents: 0 };
  }

  const [yearKey, studentsSnap] = await Promise.all([
    classData.schoolYearKey || getActiveSchoolYearKey(),
    db.collection(`${PUBLIC_DATA_PATH}/students`).where('classId', '==', classId).get()
  ]);
  const writes = [{
    ref: classSnap.ref,
    payload: {
      createdBy: owner,
      updatedAt: FieldValue.serverTimestamp()
    }
  }];

  const studentMeta = [];
  for (const studentDoc of studentsSnap.docs) {
    const studentData = studentDoc.data() || {};
    studentMeta.push({
      studentId: studentDoc.id,
      previousOwnerUid: studentData.createdBy?.uid || previousOwnerUid
    });
    writes.push({
      ref: studentDoc.ref,
      payload: {
        createdBy: owner,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentDoc.id}`),
      payload: {
        createdBy: owner,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentDoc.id}_${yearKey}`),
      payload: withYear({
        studentId: studentDoc.id,
        classId,
        className: classData.name || '',
        teacher: owner,
        updatedAt: FieldValue.serverTimestamp()
      }, yearKey)
    });
  }

  await commitBatchChunks(writes);
  // Each student's threads and family snapshot update together, several students at a time.
  await forEachLimited(studentMeta, HOMEWORK_SYNC_CONCURRENCY, async ({ studentId, previousOwnerUid: previousUid }) => {
    await Promise.all([
      getParentLink(studentId).then((link) => syncStudentThreadParticipants(studentId, {
        addUid: owner.uid,
        removeUid: previousUid && previousUid !== owner.uid ? previousUid : null,
        keepUids: link?.parentUid ? [link.parentUid] : []
      })),
      upsertParentSnapshot(studentId, {
        classId,
        className: classData.name || ''
      })
    ]);
  });

  return { ok: true, movedStudents: studentMeta.length, teacherName: owner.name };
});

exports.markStudentLeftSchool = callable(async (request) => {
  await requireYearOperator(request);
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  const student = await getStudent(studentId);
  const yearKey = String(request.data?.schoolYearKey || student.activeSchoolYearKey || await getPlannedSchoolYearKey()).trim();
  const rawReason = String(request.data?.reason || '').trim().toLowerCase();
  const reason = FORMER_STUDENT_REASONS.includes(rawReason) ? rawReason : 'moved';
  const note = String(request.data?.note || '').trim().slice(0, 240);
  let formerClassName = '';
  if (student.classId) {
    const classSnap = await db.doc(`${PUBLIC_DATA_PATH}/classes/${student.classId}`).get();
    formerClassName = classSnap.exists ? String(classSnap.data()?.name || '') : '';
  }
  const purgeAfterAt = AUTO_PURGE_LEFT_STUDENTS ? buildPurgeAfterAt() : FieldValue.delete();
  // Both records change in one commit, then parent access and the family snapshot update together.
  const leaveBatch = db.batch();
  leaveBatch.set(db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`), {
    activeSchoolYearKey: yearKey,
    enrollmentStatus: 'inactive',
    classId: null,
    leftReason: reason,
    leftNote: note || FieldValue.delete(),
    formerClassId: student.classId || student.formerClassId || null,
    formerClassName: formerClassName || student.formerClassName || '',
    formerTeacher: student.createdBy || null,
    formerEnrollmentStatus: student.enrollmentStatus || 'active',
    leftSchoolAt: FieldValue.serverTimestamp(),
    purgeAfterAt,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  leaveBatch.set(db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${yearKey}`), withYear({
    studentId,
    enrollmentStatus: 'inactive',
    leftReason: reason,
    leftSchoolAt: FieldValue.serverTimestamp(),
    purgeAfterAt
  }, yearKey), { merge: true });
  await leaveBatch.commit();
  await Promise.all([
    disableParentAccessForStudent(studentId, { reason: 'left-school' }),
    upsertParentSnapshot(studentId, { activeSchoolYearKey: yearKey, enrollmentStatus: 'inactive' })
  ]);
  return { ok: true, reason, purgeAfterAt: AUTO_PURGE_LEFT_STUDENTS ? purgeAfterAt.toDate().toISOString() : null };
});

// Brings a former student back. With a live class (the one they left, or one the
// Secretary picks) they return straight to that roster with their stars intact;
// otherwise they wait in Student placement for this year.
exports.restoreFormerStudent = callable(async (request) => {
  await requireYearOperator(request);
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  const [student, activeYearKey, parentLink] = await allInOrder([
    getStudent(studentId),
    getActiveSchoolYearKey(),
    getParentLink(studentId)
  ]);
  if ((student.enrollmentStatus || 'active') !== 'inactive') {
    throw new HttpsError('failed-precondition', `${student.name || 'That student'} is already enrolled.`);
  }
  const toPlacement = request.data?.toPlacement === true;
  const requestedClassId = toPlacement ? '' : String(request.data?.classId || '').trim();
  const candidateClassId = toPlacement ? '' : (requestedClassId || String(student.formerClassId || '').trim());
  let classData = null;
  if (candidateClassId) {
    const classSnap = await db.doc(`${PUBLIC_DATA_PATH}/classes/${candidateClassId}`).get();
    const data = classSnap.exists ? classSnap.data() || {} : null;
    const live = data && data.status !== 'archived' && data.status !== 'closed' &&
      (!data.schoolYearKey || data.schoolYearKey === activeYearKey) && data.createdBy?.uid;
    if (live) classData = { id: classSnap.id, ...data };
    else if (requestedClassId) throw new HttpsError('failed-precondition', 'Choose an active class for this year.');
  }

  const clearLeaving = {
    leftSchoolAt: FieldValue.delete(),
    leftReason: FieldValue.delete(),
    leftNote: FieldValue.delete(),
    purgeAfterAt: FieldValue.delete(),
    formerEnrollmentStatus: FieldValue.delete(),
    returnedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (!classData) {
    const pendingBatch = db.batch();
    pendingBatch.set(db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`), {
      ...clearLeaving,
      classId: null,
      activeSchoolYearKey: activeYearKey,
      enrollmentStatus: 'pendingPlacement'
    }, { merge: true });
    pendingBatch.set(db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${activeYearKey}`), withYear({
      studentId,
      enrollmentStatus: 'pendingPlacement',
      leftSchoolAt: FieldValue.delete(),
      purgeAfterAt: FieldValue.delete()
    }, activeYearKey), { merge: true });
    await pendingBatch.commit();
    await Promise.all([
      restoreParentAccessAfterReturn(studentId),
      upsertParentSnapshot(studentId, { activeSchoolYearKey: activeYearKey, enrollmentStatus: 'pendingPlacement' })
    ]);
    return { ok: true, placement: 'pending' };
  }

  const owner = classData.createdBy;
  const sameYear = student.activeSchoolYearKey === activeYearKey;
  const previousOwnerUid = student.createdBy?.uid || null;
  const scorePayload = {
    createdBy: owner,
    activeSchoolYearKey: activeYearKey,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!sameYear) {
    // A student coming back from an earlier year starts this year fresh, like placement does.
    Object.assign(scorePayload, {
      gold: 0,
      heroLevel: 0,
      heroSkills: [],
      pendingSkillChoice: false,
      starsByReason: FieldValue.delete(),
      lastGuildBonusMonth: FieldValue.delete(),
      lastPatronPathCreditWeekKey: FieldValue.delete(),
      heroOfDayWins: 0,
      heroOfDayWinsYearKey: activeYearKey
    });
  }
  const writes = [
    {
      ref: db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`),
      payload: {
        ...clearLeaving,
        classId: classData.id,
        createdBy: owner,
        activeSchoolYearKey: activeYearKey,
        enrollmentStatus: 'active'
      }
    },
    { ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentId}`), payload: scorePayload },
    {
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${activeYearKey}`),
      payload: withYear({
        studentId,
        classId: classData.id,
        className: classData.name || '',
        teacher: owner,
        enrollmentStatus: 'active',
        leftSchoolAt: FieldValue.delete(),
        purgeAfterAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      }, activeYearKey)
    }
  ];
  if (parentLink?.parentUid || parentLink?.username) {
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`),
      payload: { classId: classData.id, updatedAt: FieldValue.serverTimestamp() }
    });
  }
  await commitBatchChunks(writes);
  // Reopening parent access never changes which parent is linked, so the threads and the
  // family snapshot can update at the same time.
  await Promise.all([
    restoreParentAccessAfterReturn(studentId),
    syncStudentThreadParticipants(studentId, {
      addUid: owner.uid,
      removeUid: previousOwnerUid && previousOwnerUid !== owner.uid ? previousOwnerUid : null,
      keepUids: parentLink?.parentUid ? [parentLink.parentUid] : []
    }),
    upsertParentSnapshot(studentId, {
      activeSchoolYearKey: activeYearKey,
      enrollmentStatus: 'active',
      classId: classData.id,
      className: classData.name || ''
    })
  ]);
  return { ok: true, placement: 'class', classId: classData.id, className: classData.name || '' };
});

exports.transferStudentToClass = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  const studentId = String(request.data?.studentId || '').trim();
  const classId = String(request.data?.classId || '').trim();
  if (!studentId || !classId) {
    throw new HttpsError('invalid-argument', 'Student and target class are required.');
  }
  // Independent reads run together so a move waits for one round trip, not three.
  const [student, classSnap, isSecretary] = await Promise.all([
    getStudent(studentId),
    db.doc(`${PUBLIC_DATA_PATH}/classes/${classId}`).get(),
    isCanonicalSecretaryCaller(caller)
  ]);
  if (!classSnap.exists) throw new HttpsError('not-found', 'Target class was not found.');
  const classData = classSnap.data() || {};
  if (classData.status === 'archived') throw new HttpsError('failed-precondition', 'Target class is archived.');
  if (isSecretary) await requireFeatureEnabled('secretaryAccess');
  const canMove = isSecretary || student.createdBy?.uid === caller.uid;
  if (!canMove) {
    throw new HttpsError('permission-denied', 'You can only transfer students you currently own.');
  }

  const previousOwnerUid = student.createdBy?.uid || null;
  const owner = classData.createdBy || null;
  const schoolYearKey = classData.schoolYearKey || student.activeSchoolYearKey || await getActiveSchoolYearKey();
  const [parentLink, transferredOaths] = await Promise.all([
    getParentLink(studentId),
    db.collection(PUBLIC_DATA_PATH + '/ember_oaths')
      .where('studentId', '==', studentId).where('schoolYearKey', '==', schoolYearKey).get()
  ]);
  const transferWrites = [
    {
      ref: db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`),
      payload: {
        classId,
        createdBy: owner,
        activeSchoolYearKey: schoolYearKey,
        enrollmentStatus: 'active',
        updatedAt: FieldValue.serverTimestamp()
      }
    },
    {
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentId}`),
      payload: {
        createdBy: owner,
        activeSchoolYearKey: schoolYearKey,
        updatedAt: FieldValue.serverTimestamp()
      }
    },
    {
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${schoolYearKey}`),
      payload: withYear({
        studentId,
        classId,
        className: classData.name || '',
        teacher: owner,
        enrollmentStatus: 'active',
        updatedAt: FieldValue.serverTimestamp()
      }, schoolYearKey)
    }
  ];
  transferredOaths.docs.forEach(o => transferWrites.push({
    ref: o.ref, payload: { classId, teacherId: owner.uid, createdBy: owner, updatedAt: FieldValue.serverTimestamp() }
  }));
  if (parentLink?.parentUid || parentLink?.username) {
    transferWrites.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`),
      payload: { classId, updatedAt: FieldValue.serverTimestamp() }
    });
  }
  await commitBatchChunks(transferWrites);
  await Promise.all([
    syncStudentThreadParticipants(studentId, {
      addUid: owner?.uid || null,
      removeUid: previousOwnerUid && previousOwnerUid !== owner?.uid ? previousOwnerUid : null,
      keepUids: parentLink?.parentUid ? [parentLink.parentUid] : []
    }),
    upsertParentSnapshot(studentId, {
      activeSchoolYearKey: schoolYearKey,
      classId,
      className: classData.name || ''
    })
  ]);
  return { ok: true };
});

// A student who leaves their class mid-year but not the school goes back to the
// Student placement lot (the same "waiting for a class" list the September rollover
// fills). Their stars, gold, guild and notes stay on file; whoever seats them next
// takes them over, and a same-year seat keeps this year's progress (see
// allocateReturningStudents).
exports.releaseStudentToPlacement = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  const [student, isSecretary] = await Promise.all([
    getStudent(studentId),
    isCanonicalSecretaryCaller(caller)
  ]);
  if (isSecretary) await requireFeatureEnabled('secretaryAccess');
  if (!isSecretary && student.createdBy?.uid !== caller.uid) {
    throw new HttpsError('permission-denied', 'You can only release students from your own classes.');
  }
  const status = student.enrollmentStatus || 'active';
  if (status === 'inactive') {
    throw new HttpsError('failed-precondition', `${student.name || 'That student'} has left the school.`);
  }
  if (status === 'pendingPlacement' || !student.classId) {
    throw new HttpsError('failed-precondition', `${student.name || 'That student'} is already waiting for a class.`);
  }
  const [classSnap, activeYearKey] = await Promise.all([
    db.doc(`${PUBLIC_DATA_PATH}/classes/${student.classId}`).get(),
    getActiveSchoolYearKey()
  ]);
  const classData = classSnap.exists ? classSnap.data() || {} : {};
  const yearKey = student.activeSchoolYearKey || classData.schoolYearKey || activeYearKey;

  const batch = db.batch();
  batch.set(db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`), {
    classId: null,
    enrollmentStatus: 'pendingPlacement',
    activeSchoolYearKey: yearKey,
    previousClassId: student.classId,
    previousClassName: classData.name || '',
    previousQuestLevel: classData.questLevel || '',
    previousTeacher: classData.createdBy || student.createdBy || null,
    releasedAt: FieldValue.serverTimestamp(),
    releasedYearKey: yearKey,
    releasedBy: { uid: caller.uid, role: isSecretary ? 'secretary' : 'teacher' },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${yearKey}`), withYear({
    studentId,
    classId: null,
    className: '',
    enrollmentStatus: 'pendingPlacement',
    releasedFromClassId: student.classId,
    releasedFromClassName: classData.name || '',
    releasedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, yearKey), { merge: true });
  await batch.commit();
  await upsertParentSnapshot(studentId, {
    activeSchoolYearKey: yearKey,
    enrollmentStatus: 'pendingPlacement'
  });
  return { ok: true, placement: 'pending', previousClassId: student.classId, previousClassName: classData.name || '' };
});

exports.purgeStudent = callable(async (request) => {
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  await requireStudentManager(request, studentId);
  const result = await purgeStudentData(studentId);
  return result;
}, { timeoutSeconds: 120, memory: '512MB' });

exports.purgeLeftSchoolStudents = functionsV1.region(FUNCTIONS_REGION)
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 24 hours')
  .timeZone('Europe/Athens')
  .onRun(async () => {
    if (!AUTO_PURGE_LEFT_STUDENTS) {
      // Automatic deletion is off: clear any removal dates set by the old policy
      // so former students are only ever deleted by the Secretary.
      const markedSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`)
        .where('purgeAfterAt', '>', Timestamp.fromMillis(0))
        .get();
      if (!markedSnap.empty) {
        await commitBatchChunks(markedSnap.docs.map((studentDoc) => ({
          ref: studentDoc.ref,
          payload: { purgeAfterAt: FieldValue.delete() }
        })));
      }
      console.log(JSON.stringify({ event: 'purgeLeftSchoolStudents', autoPurge: false, cleared: markedSnap.size }));
      return null;
    }
    const now = Timestamp.now();
    const dueSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`)
      .where('purgeAfterAt', '<=', now)
      .get();
    let purged = 0;
    let skipped = 0;
    const errors = [];
    for (const studentDoc of dueSnap.docs) {
      const data = studentDoc.data() || {};
      if ((data.enrollmentStatus || 'active') !== 'inactive') {
        skipped += 1;
        continue;
      }
      try {
        await purgeStudentData(studentDoc.id);
        purged += 1;
      } catch (error) {
        console.error(`Failed to purge left-school student ${studentDoc.id}:`, error);
        errors.push({ studentId: studentDoc.id, message: error?.message || String(error) });
      }
    }
    console.log(JSON.stringify({
      event: 'purgeLeftSchoolStudents',
      due: dueSnap.size,
      purged,
      skipped,
      errorCount: errors.length
    }));
    return null;
  });

exports.finalizeRollover = callable(async (request) => {
  const caller = await requireYearOperator(request);
  const jobId = String(request.data?.jobId || '').trim() || `finalize_${Date.now()}`;
  const yearKey = String(request.data?.schoolYearKey || await getPlannedSchoolYearKey()).trim();
  const studentsSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`)
    .where('activeSchoolYearKey', '==', yearKey)
    .where('enrollmentStatus', '==', 'active')
    .get();

  const guildMembers = {};
  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data() || {};
    if (!student.guildId) continue;
    if (!guildMembers[student.guildId]) guildMembers[student.guildId] = [];
    guildMembers[student.guildId].push(studentDoc.id);
    await upsertParentSnapshot(studentDoc.id, { activeSchoolYearKey: yearKey });
  }

  const guildSnap = await db.collection(`${PUBLIC_DATA_PATH}/guild_scores`).get();
  const writes = guildSnap.docs.map((guildDoc) => {
    const memberIds = guildMembers[guildDoc.id] || [];
    return {
      ref: guildDoc.ref,
      payload: {
        activeSchoolYearKey: yearKey,
        memberIds,
        memberCount: memberIds.length,
        updatedAt: FieldValue.serverTimestamp()
      }
    };
  });
  await commitBatchChunks(writes);

  await db.doc(`${PUBLIC_DATA_PATH}/rollover_jobs/${jobId}`).set({
    type: 'finalize',
    status: 'completed',
    schoolYearKey: yearKey,
    finalizedBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    activeStudents: studentsSnap.size,
    guildsSynced: writes.length,
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, jobId, activeStudents: studentsSnap.size, guildsSynced: writes.length };
});

const { createShopEngine } = require('./shop/ensure');
const shopEngine = createShopEngine({
  db,
  storage,
  FieldValue,
  publicDataPath: PUBLIC_DATA_PATH
});

// Checks the teacher, the plan and the season together and returns the active year, so the
// Market reads the school-year record once per call.
async function requireEliteShopCaller(request) {
  const [caller, , yearSnap] = await allInOrder([
    requireAuthedCaller(request).then((resolved) => {
      if (resolved.profile.role !== 'teacher') {
        throw new HttpsError('permission-denied', 'Only teachers can restock the Mystic Market.');
      }
      return resolved;
    }),
    requireFeatureEnabled('eliteAI'),
    db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get()
  ]);
  const yearData = yearSnap.data() || {};
  const rolloverStatus = String(yearData.rolloverStatus || '').toLowerCase();
  if (rolloverStatus !== 'active') {
    throw new HttpsError('failed-precondition', 'The market stays sealed until the school year opens.');
  }
  const yearKey = String(yearData.activeYearKey || '').trim();
  if (!/^\d{4}-\d{4}$/.test(yearKey)) {
    throw new HttpsError('failed-precondition', 'The active school year is not configured. Year-scoped writes are blocked.');
  }
  return { caller, yearKey };
}

async function listShopStalls(yearKey) {
  const classesSnap = await db.collection(`${PUBLIC_DATA_PATH}/classes`).get();
  const stalls = new Map();
  classesSnap.docs.forEach((classDoc) => {
    const data = classDoc.data() || {};
    if (String(data.status || '').toLowerCase() === 'archived') return;
    if (data.schoolYearKey && data.schoolYearKey !== yearKey) return;
    const teacherId = data.createdBy?.uid;
    const league = String(data.questLevel || '').trim();
    if (!teacherId || !league) return;
    stalls.set(`${teacherId}::${league}`, {
      teacherId,
      teacherName: data.createdBy?.name || 'Teacher',
      league
    });
  });
  return [...stalls.values()];
}

exports.ensureShopStock = callable(async (request) => {
  const { caller, yearKey } = await requireEliteShopCaller(request);
  const league = String(request.data?.league || '').trim();
  const mode = String(request.data?.mode || 'ensure') === 'replace-monthly' ? 'replace-monthly' : 'ensure';
  if (!league) throw new HttpsError('invalid-argument', 'Choose a class or league first.');
  const result = await shopEngine.ensureStall({
    teacherId: caller.uid,
    teacherName: caller.profile.displayName || 'Teacher',
    league,
    yearKey,
    mode
  });
  return { ok: true, ...result };
}, { timeoutSeconds: 540, memory: '1GB', secrets: ['GCQ_AI_SERVICE_KEY'] });

exports.maintainShopStock = functionsV1.region(FUNCTIONS_REGION)
  .runWith({ timeoutSeconds: 540, memory: '1GB', secrets: ['GCQ_AI_SERVICE_KEY'] })
  // Just after midnight, Athens time, so a new month's stall and a festival's opening day are
  // stocked before the first lesson (the Market itself switches months at Athens midnight).
  .pubsub.schedule('10 0 * * *')
  .timeZone('Europe/Athens')
  .onRun(async () => {
    const yearSnap = await db.doc(`${PUBLIC_DATA_PATH}/school_year_state/current`).get();
    const yearData = yearSnap.data() || {};
    if (String(yearData.rolloverStatus || '').toLowerCase() !== 'active') {
      console.log(JSON.stringify({ event: 'maintainShopStock', skipped: 'season-sealed' }));
      return null;
    }
    try {
      await requireFeatureEnabled('eliteAI');
    } catch (_) {
      console.log(JSON.stringify({ event: 'maintainShopStock', skipped: 'not-elite' }));
      return null;
    }
    const yearKey = String(yearData.activeYearKey || '').trim();
    if (!/^\d{4}-\d{4}$/.test(yearKey)) {
      console.log(JSON.stringify({ event: 'maintainShopStock', skipped: 'no-year' }));
      return null;
    }
    const stalls = await listShopStalls(yearKey);
    const results = [];
    // On the 1st every stall needs a whole new month of pictures, which does not fit in one
    // run if stalls go one by one. Two at a time halves the wait; anything unfinished is
    // picked up by the next nightly run or when a teacher opens the Market.
    const queue = [...stalls];
    const runNext = async () => {
      while (queue.length) {
        const stall = queue.shift();
        try {
          const result = await shopEngine.ensureStall({
            ...stall,
            yearKey,
            mode: 'ensure'
          });
          results.push({ teacherId: stall.teacherId, league: stall.league, ok: true, result });
        } catch (error) {
          console.error(`maintainShopStock failed for ${stall.teacherId} ${stall.league}:`, error);
          results.push({ teacherId: stall.teacherId, league: stall.league, ok: false, message: error?.message || String(error) });
        }
      }
    };
    await Promise.all([runNext(), runNext()]);
    console.log(JSON.stringify({ event: 'maintainShopStock', stallCount: stalls.length, results }));
    return null;
  });

exports.manageShopItem = callable(async (request) => {
  const { caller, yearKey } = await requireEliteShopCaller(request);
  const itemId = String(request.data?.itemId || '').trim();
  const action = String(request.data?.action || '').trim();
  if (!itemId) throw new HttpsError('invalid-argument', 'Choose a treasure first.');
  if (action !== 'new-picture' && action !== 'replace') {
    throw new HttpsError('invalid-argument', 'Choose New picture or Replace this treasure.');
  }
  try {
    const result = await shopEngine.manageItem({
      teacherId: caller.uid,
      teacherName: caller.profile.displayName || 'Teacher',
      yearKey,
      itemId,
      action
    });
    if (result?.skipped) {
      return { ok: false, skipped: true, reason: result.reason || 'locked' };
    }
    return { ok: true, ...result };
  } catch (error) {
    const code = String(error?.code || '');
    if (code === 'not-found') throw new HttpsError('not-found', error.message);
    if (code === 'permission-denied') throw new HttpsError('permission-denied', error.message);
    if (code === 'failed-precondition') throw new HttpsError('failed-precondition', error.message);
    if (code === 'invalid-argument') throw new HttpsError('invalid-argument', error.message);
    console.error('manageShopItem failed:', error);
    throw new HttpsError('internal', 'The merchant could not finish that treasure.');
  }
}, { timeoutSeconds: 180, memory: '1GB', secrets: ['GCQ_AI_SERVICE_KEY'] });

// The Avatar Forge (and its AI client) loads only when a portrait is forged or saved.
let avatarForge = null;
function getAvatarForge() {
  if (!avatarForge) {
    const { createAvatarForgeHandlers } = require('./avatarForge');
    avatarForge = createAvatarForgeHandlers({
      requireStudentManager,
      requireFeatureEnabled,
      publicDataPath: PUBLIC_DATA_PATH
    });
  }
  return avatarForge;
}
// Browser calls to workers.dev and Firebase Storage uploads are what school networks
// report as CORS failures. These callables keep portrait generation and storage on the server.
exports.forgeStudentAvatar = callable((request) => getAvatarForge().forgeStudentAvatar(request), {
  timeoutSeconds: 180,
  memory: '1GB',
  secrets: ['GCQ_AI_SERVICE_KEY']
});
exports.saveStudentAvatar = callable((request) => getAvatarForge().saveStudentAvatar(request), {
  timeoutSeconds: 60
});
