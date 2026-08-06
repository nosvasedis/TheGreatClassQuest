const { getApp, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const crypto = require('node:crypto');
const functionsV1 = require('firebase-functions/v1');
const { HttpsError } = require('firebase-functions/v1/https');

initializeApp();

const db = getFirestore();
const auth = getAuth();
const FUNCTIONS_REGION = process.env.GCQ_FIREBASE_FUNCTIONS_REGION || 'europe-west1';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const PROFILE_COLLECTION = 'user_profiles';
const SUBSCRIPTION_DOC = 'appConfig/subscription';
const SECRETARY_ROLE_DOC = `${PUBLIC_DATA_PATH}/school_roles/secretary`;
const SECRETARY_BOOTSTRAP_DOC = `${PUBLIC_DATA_PATH}/admin_bootstrap/secretary`;
const RECENT_AUTH_WINDOW_SECONDS = 10 * 60;

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

async function requireAuthedCaller(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in first.');
  }
  const profileSnap = await db.collection(PROFILE_COLLECTION).doc(request.auth.uid).get();
  if (!profileSnap.exists) {
    throw new HttpsError('permission-denied', 'This account is missing its required access profile.');
  }
  const profile = profileSnap.data() || {};
  if (profile.status !== 'active' || !['teacher', 'secretary', 'parent'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'This account is inactive or has an invalid role.');
  }
  return { uid: request.auth.uid, profile };
}

async function isCanonicalSecretaryCaller(caller) {
  if (!caller || caller.profile?.role !== 'secretary') return false;
  const roleSnap = await db.doc(SECRETARY_ROLE_DOC).get();
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

async function getSubscriptionConfig() {
  const snap = await db.doc(SUBSCRIPTION_DOC).get();
  return snap.exists ? (snap.data() || {}) : {};
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

  throw new HttpsError('failed-precondition', 'This school plan does not include that access feature yet.');
}

function callable(handler, options = {}) {
  let builder = functionsV1.region(FUNCTIONS_REGION);
  if (options.timeoutSeconds || options.memory) {
    builder = builder.runWith({
      timeoutSeconds: options.timeoutSeconds || 60,
      memory: options.memory || '256MB'
    });
  }
  return builder.https.onCall(async (data, context) => {
    return handler({
      data,
      auth: context.auth || null,
      rawRequest: context.rawRequest || null
    });
  });
}

async function getStudent(studentId) {
  const snap = await db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'That student could not be found.');
  }
  return { id: snap.id, ...snap.data() };
}

async function requireStudentManager(request, studentId) {
  const caller = await requireAuthedCaller(request);
  const student = await getStudent(studentId);
  const isSecretary = await isCanonicalSecretaryCaller(caller);
  if (!isSecretary && student.createdBy?.uid !== caller.uid) {
    throw new HttpsError('permission-denied', 'You can only manage access for your own students.');
  }
  return { caller, student };
}

async function requireClassManager(request, classId) {
  const caller = await requireAuthedCaller(request);
  const classSnap = await db.doc(`${PUBLIC_DATA_PATH}/classes/${classId}`).get();
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
    .limit(8)
    .get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function getAttendanceSummary(studentId) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/attendance`)
    .where('studentId', '==', studentId)
    .count()
    .get();
  const absences = Number(snap.data().count || 0);
  return {
    absences,
    lessonsHeld: null,
    rateLabel: absences === 0 ? 'Perfect so far' : `${absences} absence${absences === 1 ? '' : 's'}`
  };
}

async function getRecentCelebrations(studentId) {
  const snap = await db.collection(`${PUBLIC_DATA_PATH}/award_log`)
    .where('studentId', '==', studentId)
    .orderBy('date', 'desc')
    .limit(6)
    .get();
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      title: data.reason || 'Award',
      description: data.note || `${data.stars || 0} star${Number(data.stars || 0) === 1 ? '' : 's'} awarded`,
      date: data.date || ''
    };
  });
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

async function buildParentSnapshot(studentId, extra = {}) {
  const student = await getStudent(studentId);
  const [score, assessments, attendanceSummary, recentCelebrations, parentLink] = await Promise.all([
    getScore(studentId),
    getRecentAssessments(studentId),
    getAttendanceSummary(studentId),
    getRecentCelebrations(studentId),
    getParentLink(studentId)
  ]);
  const classSnap = await db.doc(`${PUBLIC_DATA_PATH}/classes/${student.classId}`).get();
  const classData = classSnap.exists ? classSnap.data() : {};
  const homeworkCount = await countPublishedHomework(studentId);
  const latestGrade = assessments[0] || null;
  const previousSnap = await db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`).get();
  const existing = previousSnap.exists ? previousSnap.data() : {};

  return {
    studentId,
    studentName: student.name || '',
    classId: student.classId,
    className: classData.name || '',
    heroClass: student.heroClass || '',
    progress: {
      totalStars: score.totalStars || 0,
      monthlyStars: score.monthlyStars || 0,
      heroLevel: score.heroLevel || 0,
      gold: score.gold || 0
    },
    attendanceSummary,
    latestGrade: latestGrade
      ? {
          label: latestGrade.scoreQualitative || `${latestGrade.scoreNumeric || 0}${latestGrade.maxScore ? ` / ${latestGrade.maxScore}` : ''}`,
          title: latestGrade.title || latestGrade.type || 'Assessment'
        }
      : null,
    gradeAverageLabel: assessments.length ? `${Math.round(assessments.length)} recent item${assessments.length === 1 ? '' : 's'}` : 'N/A',
    gradeHistory: assessments.map((item) => ({
      title: item.title || item.type || 'Assessment',
      type: item.type || '',
      date: item.date || '',
      scoreLabel: item.scoreQualitative || `${item.scoreNumeric || 0}${item.maxScore ? ` / ${item.maxScore}` : ''}`
    })),
    recentCelebrations,
    homeworkCount,
    nextLessonLabel: classData.timeStart ? `${classData.timeStart}` : 'See homework feed',
    linkedParentUid: parentLink?.parentUid || null,
    publishedNotes: existing.publishedNotes || [],
    latestParentSummary: existing.latestParentSummary || null,
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
  await messageRef.set({
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
  await threadRef.set({
    lastMessageAt: FieldValue.serverTimestamp(),
    schoolYearKey,
    previewText: body.slice(0, 160),
    status: 'open'
  }, { merge: true });
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
  const { caller, student } = await requireStudentManager(request, studentId);
  const link = await getParentLink(studentId);
  const email = buildSyntheticRoleEmail('parent', username);
  const displayName = `Parent of ${student.name}`;
  const parentUid = await resolveRoleUser({
    desiredUid: link?.parentUid || null,
    email,
    password,
    displayName,
    roleLabel: 'parent'
  });

  await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).set({
    studentId,
    classId: student.classId,
    parentUid,
    username,
    status: 'active',
    createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher', name: caller.profile.displayName || '' },
    createdAt: FieldValue.serverTimestamp(),
    lastPasswordResetAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection(PROFILE_COLLECTION).doc(parentUid).set({
    role: 'parent',
    displayName,
    loginMode: 'username',
    status: 'active',
    linkedStudentId: studentId,
    createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: null
  }, { merge: true });

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
  await requireStudentManager(request, studentId);
  const link = await getParentLink(studentId);
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
  const link = await getParentLink(studentId);
  if (link?.parentUid) {
    await auth.updateUser(link.parentUid, { disabled: true });
    await db.collection(PROFILE_COLLECTION).doc(link.parentUid).set({ status: 'disabled' }, { merge: true });
  }
  await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).set({ status: 'disabled' }, { merge: true });
  return { ok: true };
});

exports.deleteParentAccess = callable(async (request) => {
  await requireFeatureEnabled('parentAccess');
  const studentId = String(request.data?.studentId || '').trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  await requireStudentManager(request, studentId);
  const link = await getParentLink(studentId);
  const parentUid = link?.parentUid || null;
  if (parentUid) {
    await deleteAuthUserIfExists(parentUid);
    await db.collection(PROFILE_COLLECTION).doc(parentUid).delete();
  }
  await db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`).delete();
  await db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`).set({
    linkedParentUid: FieldValue.delete(),
    parentAccessDeletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
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
  const { caller } = await requireStudentManager(request, studentId);
  const link = await getParentLink(studentId);
  const snapshot = await upsertParentSnapshot(studentId);
  const notes = Array.isArray(snapshot.publishedNotes) ? snapshot.publishedNotes : [];
  const nextNotes = [{ label: 'Parent Summary', body: summary, createdAt: new Date().toISOString() }, ...notes].slice(0, 6);

  await db.doc(`${PUBLIC_DATA_PATH}/parent_snapshots/${studentId}`).set({
    latestParentSummary: summary,
    publishedNotes: nextNotes
  }, { merge: true });

  if (link?.parentUid) {
    const { threadId } = await ensureCommunicationThread({
      studentId,
      threadType: 'progress-share',
      participantUids: [caller.uid, link.parentUid],
      participantRoles: [caller.profile.role || 'teacher', 'parent'],
      createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher' }
    });
    await addCommunicationMessage({
      threadId,
      studentId,
      body: summary,
      authorUid: caller.uid,
      authorRole: caller.profile.role || 'teacher',
      messageType: 'progress-share'
    });
  }

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
  const { caller } = await requireStudentManager(request, studentId);
  const link = await getParentLink(studentId);
  const schoolYearKey = await getActiveSchoolYearKey();
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
  await upsertParentSnapshot(studentId);

  if (link?.parentUid) {
    const { threadId } = await ensureCommunicationThread({
      studentId,
      threadType: 'homework',
      participantUids: [caller.uid, link.parentUid],
      participantRoles: [caller.profile.role || 'teacher', 'parent'],
      createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher' }
    });
    await addCommunicationMessage({
      threadId,
      studentId,
      body: `${title}\n\n${body}`,
      authorUid: caller.uid,
      authorRole: caller.profile.role || 'teacher',
      messageType: 'homework'
    });
  }

  return { ok: true };
});

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

  const studentsSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`)
    .where('classId', '==', classId)
    .get();

  let syncedCount = 0;
  for (const studentDoc of studentsSnap.docs) {
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
      schoolYearKey: classData.schoolYearKey || await getActiveSchoolYearKey(),
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
  }

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
  const threadSnap = await threadRef.get();
  if (!threadSnap.exists) {
    throw new HttpsError('not-found', 'That communication thread no longer exists.');
  }
  const thread = threadSnap.data() || {};
  const isParent = caller.profile.role === 'parent';
  const canManage = isSecretary;
  const ownsStudent = !isParent ? (await getStudent(studentId)).createdBy?.uid === caller.uid : false;
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
        previousClassId: student.classId || null,
        previousClassName: classData.name || '',
        previousQuestLevel: classData.questLevel || '',
        previousTeacher: student.createdBy || null,
        classId: null,
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
        gold: score.gold || 0,
        inventory: [],
        starsByReason: {},
        heroLevel: 0,
        heroSkills: [],
        pendingSkillChoice: false,
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

  const [todayStarsSnap, fortuneWheelLogSnap] = await Promise.all([
    db.collection(`${PUBLIC_DATA_PATH}/today_stars`).get(),
    db.collection(`${PUBLIC_DATA_PATH}/fortune_wheel_log`).get()
  ]);
  todayStarsSnap.docs.forEach((docSnap) => deleteWrites.push({ ref: docSnap.ref }));
  fortuneWheelLogSnap.docs.forEach((docSnap) => deleteWrites.push({ ref: docSnap.ref }));

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
      clearedTodayStars: todayStarsSnap.size,
      clearedFortuneWheelLogs: fortuneWheelLogSnap.size
    },
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, jobId };
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
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`),
      payload: {
        classId,
        createdBy: owner,
        activeSchoolYearKey: yearKey,
        enrollmentStatus: 'active',
        placedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }
    });
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/student_scores/${studentId}`),
      payload: {
        createdBy: owner,
        activeSchoolYearKey: yearKey,
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
    writes.push({
      ref: db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`),
      payload: { classId, updatedAt: FieldValue.serverTimestamp() }
    });
  }

  await commitBatchChunks(writes);
  for (const studentId of studentIds) {
    await upsertParentSnapshot(studentId, {
      activeSchoolYearKey: yearKey,
      classId,
      className: classData.name || ''
    });
  }
  return { ok: true, placedCount: studentIds.length };
});

exports.markStudentLeftSchool = callable(async (request) => {
  await requireYearOperator(request);
  const studentId = String(request.data?.studentId || '').trim();
  const yearKey = String(request.data?.schoolYearKey || await getPlannedSchoolYearKey()).trim();
  if (!studentId) throw new HttpsError('invalid-argument', 'Student is required.');
  await db.doc(`${PUBLIC_DATA_PATH}/students/${studentId}`).set({
    activeSchoolYearKey: yearKey,
    enrollmentStatus: 'inactive',
    classId: null,
    leftSchoolAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.doc(`${PUBLIC_DATA_PATH}/student_year_enrollments/${studentId}_${yearKey}`).set(withYear({
    studentId,
    enrollmentStatus: 'inactive',
    leftSchoolAt: FieldValue.serverTimestamp()
  }, yearKey), { merge: true });
  await upsertParentSnapshot(studentId, { activeSchoolYearKey: yearKey, enrollmentStatus: 'inactive' });
  return { ok: true };
});

exports.transferStudentToClass = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  const studentId = String(request.data?.studentId || '').trim();
  const classId = String(request.data?.classId || '').trim();
  if (!studentId || !classId) {
    throw new HttpsError('invalid-argument', 'Student and target class are required.');
  }
  const student = await getStudent(studentId);
  const classSnap = await db.doc(`${PUBLIC_DATA_PATH}/classes/${classId}`).get();
  if (!classSnap.exists) throw new HttpsError('not-found', 'Target class was not found.');
  const classData = classSnap.data() || {};
  if (classData.status === 'archived') throw new HttpsError('failed-precondition', 'Target class is archived.');
  const isSecretary = await isCanonicalSecretaryCaller(caller);
  if (isSecretary) await requireFeatureEnabled('secretaryAccess');
  const canMove = isSecretary || student.createdBy?.uid === caller.uid;
  if (!canMove) {
    throw new HttpsError('permission-denied', 'You can only transfer students you currently own.');
  }

  const owner = classData.createdBy || null;
  const schoolYearKey = classData.schoolYearKey || student.activeSchoolYearKey || await getActiveSchoolYearKey();
  await commitBatchChunks([
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
      ref: db.doc(`${PUBLIC_DATA_PATH}/parent_links/${studentId}`),
      payload: { classId, updatedAt: FieldValue.serverTimestamp() }
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
  ]);
  await upsertParentSnapshot(studentId, {
    activeSchoolYearKey: schoolYearKey,
    classId,
    className: classData.name || ''
  });
  return { ok: true };
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
