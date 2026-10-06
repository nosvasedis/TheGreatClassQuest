// Operator console (create and manage schools) and teacher join codes.
//
// The operator is the person who runs the platform. Operator uids live in platform/operators,
// which no client can read or write. The first operator is claimed once, by the founding
// school's active Secretary; nobody can claim it after that.
const crypto = require('node:crypto');
const {
  SCHOOL_STATUSES,
  cleanSchoolName,
  validateNewSchool,
  validateTier,
  parsePlanEnd,
  buildSchoolPlan,
  generateJoinCode,
  hashJoinCode,
  joinCodeMatches,
} = require('./platformCore.cjs');
const TIER_PRESETS = require('./tierPresets');
const { FOUNDING_SCHOOL_ID, normalizeSchoolId, currentSchoolId, runInSchool } = require('./tenant');

const OPERATORS_DOC = 'platform/operators';
const SETUP_LINK_DAYS = 7;

function createPlatformHandlers({
  db, FieldValue, Timestamp, HttpsError,
  requireAuthedCaller, isCanonicalSecretaryCaller, hashSecretarySetupToken,
  PROFILE_COLLECTION, SCHOOLS_COLLECTION,
}) {
  const schoolRoot = (schoolId) => `artifacts/${schoolId}/public/data`;
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const asInput = (fn) => {
    try { return fn(); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
  };

  async function readOperatorUids() {
    const snap = await db.doc(OPERATORS_DOC).get();
    return { exists: snap.exists, uids: Array.isArray(snap.data()?.uids) ? snap.data().uids : [] };
  }

  async function requireOperator(request) {
    const caller = await requireAuthedCaller(request);
    const { uids } = await readOperatorUids();
    if (!uids.includes(caller.uid)) fail('permission-denied', 'Only the platform operator can do this.');
    return caller;
  }

  async function canClaimOperator(caller) {
    return currentSchoolId() === FOUNDING_SCHOOL_ID && await isCanonicalSecretaryCaller(caller);
  }

  function managedSchoolId(value) {
    const schoolId = normalizeSchoolId(value);
    if (!schoolId) fail('invalid-argument', 'Choose a school.');
    // The founding school's plan and office are managed where they always were, never from here.
    if (schoolId === FOUNDING_SCHOOL_ID) fail('failed-precondition', 'The founding school is managed outside the operator console.');
    return schoolId;
  }

  async function writeSetupLink(schoolId, transaction = null) {
    const roleRef = db.doc(`${schoolRoot(schoolId)}/school_roles/secretary`);
    const roleSnap = transaction ? await transaction.get(roleRef) : await roleRef.get();
    const activeUid = roleSnap.exists && roleSnap.data()?.status === 'active' ? roleSnap.data()?.uid : null;
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Timestamp.fromMillis(Date.now() + SETUP_LINK_DAYS * 24 * 60 * 60 * 1000);
    const payload = {
      tokenHash: hashSecretarySetupToken(token),
      purpose: activeUid ? 'recovery' : 'founding',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
      ...(activeUid ? { targetUid: activeUid } : {}),
    };
    const ref = db.doc(`${schoolRoot(schoolId)}/admin_bootstrap/secretary`);
    if (transaction) transaction.set(ref, payload, { merge: false });
    else await ref.set(payload, { merge: false });
    return { setupToken: token, purpose: payload.purpose, expiresAt: expiresAt.toDate().toISOString() };
  }

  // School is open to teachers only when it is active and its office has been activated.
  async function readJoinableSchool(schoolId) {
    const [schoolSnap, roleSnap] = await Promise.all([
      db.collection(SCHOOLS_COLLECTION).doc(schoolId).get(),
      db.doc(`${schoolRoot(schoolId)}/school_roles/secretary`).get(),
    ]);
    const school = schoolSnap.exists ? schoolSnap.data() || {} : null;
    if (!school || school.status !== 'active' || roleSnap.data()?.status !== 'active') return null;
    return school;
  }

  async function checkJoinCode(data) {
    const schoolId = normalizeSchoolId(data?.schoolId);
    const wrong = () => fail('permission-denied', 'That school code or teacher code is not right. Ask your school office for both.');
    if (!schoolId || schoolId === FOUNDING_SCHOOL_ID) wrong();
    const school = await readJoinableSchool(schoolId);
    if (!school || !joinCodeMatches(schoolId, data?.joinCode, school.teacherJoinCodeHash)) wrong();
    return { schoolId, school };
  }

  return {
    async getOperatorStatus(request) {
      const caller = await requireAuthedCaller(request);
      const { exists, uids } = await readOperatorUids();
      return {
        uid: caller.uid,
        isOperator: uids.includes(caller.uid),
        canClaim: !exists && await canClaimOperator(caller),
      };
    },

    async claimOperator(request) {
      const caller = await requireAuthedCaller(request);
      if (!await canClaimOperator(caller)) {
        fail('permission-denied', 'Only the founding school’s Secretary can claim the operator console.');
      }
      const ref = db.doc(OPERATORS_DOC);
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (snap.exists) fail('failed-precondition', 'The operator console has already been claimed.');
        transaction.set(ref, { uids: [caller.uid], claimedAt: FieldValue.serverTimestamp() });
      });
      return { ok: true, uid: caller.uid };
    },

    async listSchools(request) {
      await requireOperator(request);
      const snap = await db.collection(SCHOOLS_COLLECTION).get();
      const schools = await Promise.all(snap.docs.map(async (schoolDoc) => {
        const data = schoolDoc.data() || {};
        const [roleSnap, teacherCount] = await Promise.all([
          db.doc(`${schoolRoot(schoolDoc.id)}/school_roles/secretary`).get(),
          db.collection(PROFILE_COLLECTION).where('schoolId', '==', schoolDoc.id).where('role', '==', 'teacher').count().get()
            .then((agg) => agg.data().count).catch(() => null),
        ]);
        return {
          schoolId: schoolDoc.id,
          name: data.name || schoolDoc.id,
          status: data.status || 'active',
          tier: data.subscription?.tier || 'pending',
          endsAt: data.subscription?.endsAt || null,
          officeActive: roleSnap.data()?.status === 'active',
          teacherCount,
          createdAt: data.createdAt?.toDate?.().toISOString() || null,
        };
      }));
      schools.sort((a, b) => a.name.localeCompare(b.name));
      return { schools };
    },

    async createSchool(request) {
      const caller = await requireOperator(request);
      const input = asInput(() => validateNewSchool(request.data || {}));
      const plan = asInput(() => buildSchoolPlan(input.tier, input.endsAt, TIER_PRESETS));
      const joinCode = generateJoinCode();
      const schoolRef = db.collection(SCHOOLS_COLLECTION).doc(input.schoolId);
      let link;
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(schoolRef);
        if (existing.exists) fail('already-exists', 'A school with that code already exists. Choose another code.');
        link = await writeSetupLink(input.schoolId, transaction);
        transaction.set(schoolRef, {
          name: input.name,
          status: 'active',
          subscription: plan,
          teacherJoinCodeHash: hashJoinCode(input.schoolId, joinCode),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: caller.uid,
        });
      });
      return { schoolId: input.schoolId, name: input.name, joinCode, ...link };
    },

    async updateSchool(request) {
      await requireOperator(request);
      const schoolId = managedSchoolId(request.data?.schoolId);
      const schoolRef = db.collection(SCHOOLS_COLLECTION).doc(schoolId);
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(schoolRef);
        if (!snap.exists) fail('not-found', 'That school could not be found.');
        const updates = { updatedAt: FieldValue.serverTimestamp() };
        const data = request.data || {};
        if (data.name !== undefined) {
          const name = cleanSchoolName(data.name);
          if (name.length < 2) fail('invalid-argument', 'Type the school name.');
          updates.name = name;
        }
        if (data.status !== undefined) {
          if (!SCHOOL_STATUSES.includes(data.status)) fail('invalid-argument', 'A school is either active or suspended.');
          updates.status = data.status;
        }
        if (data.tier !== undefined || data.endsAt !== undefined) {
          const current = snap.data()?.subscription || {};
          const tier = asInput(() => validateTier(data.tier ?? current.tier));
          const endsAt = data.endsAt !== undefined ? asInput(() => parsePlanEnd(data.endsAt)) : (current.endsAt || null);
          updates.subscription = buildSchoolPlan(tier, endsAt, TIER_PRESETS);
        }
        transaction.update(schoolRef, updates);
      });
      return { ok: true };
    },

    async issueSecretaryLink(request) {
      await requireOperator(request);
      const schoolId = managedSchoolId(request.data?.schoolId);
      const schoolSnap = await db.collection(SCHOOLS_COLLECTION).doc(schoolId).get();
      if (!schoolSnap.exists) fail('not-found', 'That school could not be found.');
      return { schoolId, ...await writeSetupLink(schoolId) };
    },

    async resetTeacherJoinCode(request) {
      await requireOperator(request);
      const schoolId = managedSchoolId(request.data?.schoolId);
      const schoolRef = db.collection(SCHOOLS_COLLECTION).doc(schoolId);
      const joinCode = generateJoinCode();
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(schoolRef);
        if (!snap.exists) fail('not-found', 'That school could not be found.');
        transaction.update(schoolRef, { teacherJoinCodeHash: hashJoinCode(schoolId, joinCode), updatedAt: FieldValue.serverTimestamp() });
      });
      return { schoolId, joinCode };
    },

    // Signup checks the codes before creating the login, so a typo never leaves a half-made account.
    async verifyTeacherJoinCode(request) {
      const { school } = await checkJoinCode(request.data);
      return { ok: true, schoolName: school.name || '' };
    },

    async joinSchoolAsTeacher(request) {
      if (!request.auth?.uid) fail('unauthenticated', 'You must be signed in first.');
      const { schoolId } = await checkJoinCode(request.data);
      const displayName = cleanSchoolName(request.data?.displayName) || 'Quest Master';
      const profileRef = db.collection(PROFILE_COLLECTION).doc(request.auth.uid);
      await runInSchool(schoolId, () => db.runTransaction(async (transaction) => {
        const existing = await transaction.get(profileRef);
        if (existing.exists) fail('already-exists', 'This account already belongs to a school.');
        transaction.set(profileRef, {
          role: 'teacher',
          schoolId,
          displayName,
          loginMode: 'email',
          status: 'active',
          linkedStudentId: null,
          createdBy: { type: 'teacher_join_code' },
          createdAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        });
      }));
      return { ok: true, schoolId };
    },
  };
}

module.exports = { createPlatformHandlers, OPERATORS_DOC };
