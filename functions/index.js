const admin = require('firebase-admin');
const functionsV1 = require('firebase-functions/v1');
const { HttpsError } = require('firebase-functions/v1/https');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const FUNCTIONS_REGION = process.env.GCQ_FIREBASE_FUNCTIONS_REGION || 'europe-west1';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const PROFILE_COLLECTION = 'user_profiles';
const SUBSCRIPTION_DOC = 'appConfig/subscription';

function getProjectId() {
  return admin.app().options.projectId || process.env.GCLOUD_PROJECT || 'gcq-school';
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
  const profile = profileSnap.exists ? profileSnap.data() : { role: 'teacher', schoolAdmin: false };
  return { uid: request.auth.uid, profile };
}

async function getSubscriptionConfig() {
  const snap = await db.doc(SUBSCRIPTION_DOC).get();
  return snap.exists ? (snap.data() || {}) : {};
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

function callable(handler) {
  return functionsV1.region(FUNCTIONS_REGION).https.onCall(async (data, context) => {
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
  const isSecretary = caller.profile.role === 'secretary';
  const isAdmin = caller.profile.schoolAdmin === true;
  if (!isSecretary && !isAdmin && student.createdBy?.uid !== caller.uid) {
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
  const isSecretary = caller.profile.role === 'secretary';
  const isAdmin = caller.profile.schoolAdmin === true;
  if (!isSecretary && !isAdmin && classData.createdBy?.uid !== caller.uid) {
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
    .get();
  const absences = snap.size;
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
    .get();
  return snap.size;
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
    await threadRef.set({
      scopeType,
      scopeId: scopeId || studentId,
      studentId,
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
  await messageRef.set({
    threadId,
    studentId,
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
    previewText: body.slice(0, 160),
    status: 'open'
  }, { merge: true });
}

exports.claimFoundingSchoolAdmin = callable(async (request) => {
  const caller = await requireAuthedCaller(request);
  if (caller.profile.role && caller.profile.role !== 'teacher') {
    throw new HttpsError('permission-denied', 'Only teachers can claim the founding school admin role.');
  }
  if (caller.profile.schoolAdmin === true) {
    return { ok: true, schoolAdmin: true, alreadyClaimed: true };
  }

  const existingAdmin = await db.collection(PROFILE_COLLECTION)
    .where('schoolAdmin', '==', true)
    .limit(1)
    .get();

  if (!existingAdmin.empty) {
    throw new HttpsError('failed-precondition', 'A school admin already exists for this school.');
  }

  await db.collection(PROFILE_COLLECTION).doc(caller.uid).set({
    role: 'teacher',
    loginMode: 'email',
    status: caller.profile.status || 'active',
    schoolAdmin: true,
    linkedStudentId: null,
    displayName: caller.profile.displayName || '',
    lastSeenAt: FieldValue.serverTimestamp(),
    createdAt: caller.profile.createdAt || FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, schoolAdmin: true };
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
    schoolAdmin: false,
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

exports.createOrReplaceSecretaryAccess = callable(async (request) => {
  await requireFeatureEnabled('secretaryAccess');
  const username = sanitizeUsername(request.data?.username);
  const password = String(request.data?.password || '').trim();
  if (!username || !password) {
    throw new HttpsError('invalid-argument', 'Username and password are required.');
  }
  const caller = await requireAuthedCaller(request);
  const canManage = caller.profile.schoolAdmin === true || caller.profile.role === 'secretary';
  if (!canManage) {
    throw new HttpsError('permission-denied', 'Only the school admin can manage the secretary account.');
  }

  const secretaryRef = db.doc(`${PUBLIC_DATA_PATH}/school_roles/secretary`);
  const existing = await secretaryRef.get();
  const email = buildSyntheticRoleEmail('secretary', username);
  const secretaryUid = await resolveRoleUser({
    desiredUid: existing.exists ? existing.data().uid : null,
    email,
    password,
    displayName: 'School Secretary',
    roleLabel: 'secretary'
  });

  await secretaryRef.set({
    uid: secretaryUid,
    username,
    status: 'active',
    createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection(PROFILE_COLLECTION).doc(secretaryUid).set({
    role: 'secretary',
    displayName: 'School Secretary',
    loginMode: 'username',
    status: 'active',
    schoolAdmin: false,
    linkedStudentId: null,
    createdBy: { uid: caller.uid, role: caller.profile.role || 'teacher' },
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: null
  }, { merge: true });

  return { ok: true, uid: secretaryUid, username };
});

exports.disableSecretaryAccess = callable(async (request) => {
  await requireFeatureEnabled('secretaryAccess');
  const caller = await requireAuthedCaller(request);
  const canManage = caller.profile.schoolAdmin === true || caller.profile.role === 'secretary';
  if (!canManage) {
    throw new HttpsError('permission-denied', 'Only the school admin can manage the secretary account.');
  }
  const secretaryRef = db.doc(`${PUBLIC_DATA_PATH}/school_roles/secretary`);
  const existing = await secretaryRef.get();
  if (existing.exists && existing.data().uid) {
    await auth.updateUser(existing.data().uid, { disabled: true });
    await db.collection(PROFILE_COLLECTION).doc(existing.data().uid).set({ status: 'disabled' }, { merge: true });
  }
  await secretaryRef.set({ status: 'disabled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

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
  await db.collection(`${PUBLIC_DATA_PATH}/parent_homework`).add({
    studentId,
    classId,
    lessonDate,
    title,
    body,
    status: 'published',
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
  await requireFeatureEnabled(caller.profile.role === 'secretary' ? 'secretaryAccess' : 'parentAccess');
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
  const isSecretary = caller.profile.role === 'secretary';
  const isParent = caller.profile.role === 'parent';
  const canManage = isSecretary || caller.profile.schoolAdmin === true;
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
  if (!(caller.profile.schoolAdmin === true || caller.profile.role === 'secretary')) {
    throw new HttpsError('permission-denied', 'Only a school admin or secretary can run the role backfill.');
  }

  const studentsSnap = await db.collection(`${PUBLIC_DATA_PATH}/students`).get();
  let snapshotCount = 0;
  for (const studentDoc of studentsSnap.docs) {
    await upsertParentSnapshot(studentDoc.id);
    snapshotCount += 1;
  }

  return {
    ok: true,
    parentSnapshotsUpdated: snapshotCount
  };
});
