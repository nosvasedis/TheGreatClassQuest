// Operator management of one school: details, teacher accounts, full data export, and deleting a
// school with everything it owns. The founding school can be viewed but never changed here.
const crypto = require('node:crypto');
const { FOUNDING_SCHOOL_ID, normalizeSchoolId } = require('./tenant');

// Storage folders keyed by an id the school owns (see storage.rules).
const STUDENT_FOLDERS = ['avatars', 'familiars'];
const CLASS_FOLDERS = ['story_images'];
const USER_FOLDERS = ['adventure_logs', 'shop_items', 'quiz_images'];

function createPlatformAdminHandlers({
  db, auth, getBucket, FieldValue, HttpsError,
  requireOperator, PROFILE_COLLECTION, SCHOOLS_COLLECTION,
  cancelStripeSubscription = null,
}) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const schoolRoot = (schoolId) => `artifacts/${schoolId}/public/data`;
  const iso = (value) => value?.toDate?.().toISOString() || (typeof value === 'string' ? value : null);

  function readSchoolId(value, { allowFounding = false } = {}) {
    const schoolId = normalizeSchoolId(value);
    if (!schoolId) fail('invalid-argument', 'Choose a school.');
    if (!allowFounding && schoolId === FOUNDING_SCHOOL_ID) {
      fail('failed-precondition', 'The founding school is managed outside the operator console.');
    }
    return schoolId;
  }

  async function countOf(query) {
    try {
      return (await query.count().get()).data().count;
    } catch (_) {
      return null;
    }
  }

  // Every profile of a school. Founding-school profiles may have no schoolId, so only other schools.
  async function schoolProfiles(schoolId) {
    const snap = await db.collection(PROFILE_COLLECTION).where('schoolId', '==', schoolId).get();
    return snap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
  }

  async function authEmails(uids) {
    const emails = {};
    for (let i = 0; i < uids.length; i += 100) {
      const result = await auth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid }))).catch(() => ({ users: [] }));
      result.users.forEach((user) => { emails[user.uid] = { email: user.email || '', disabled: user.disabled === true, lastSignIn: user.metadata?.lastSignInTime || null }; });
    }
    return emails;
  }

  async function readDetails(schoolId) {
    const root = schoolRoot(schoolId);
    const isFounding = schoolId === FOUNDING_SCHOOL_ID;
    const [schoolSnap, roleSnap, classes, students, plan] = await Promise.all([
      db.collection(SCHOOLS_COLLECTION).doc(schoolId).get(),
      db.doc(`${root}/school_roles/secretary`).get(),
      countOf(db.collection(`${root}/classes`)),
      countOf(db.collection(`${root}/students`).where('enrollmentStatus', '==', 'active')),
      isFounding ? db.doc('appConfig/subscription').get() : null,
    ]);
    if (!isFounding && !schoolSnap.exists) fail('not-found', 'That school could not be found.');
    const school = schoolSnap.exists ? schoolSnap.data() || {} : {};
    const profiles = isFounding ? [] : await schoolProfiles(schoolId);
    const teachers = profiles.filter((profile) => profile.role === 'teacher');
    const parents = profiles.filter((profile) => profile.role === 'parent');
    const emails = await authEmails(teachers.map((teacher) => teacher.uid));
    const role = roleSnap.data() || {};
    const billing = school.billing || {};
    return {
      schoolId,
      founding: isFounding,
      name: school.name || (isFounding ? 'Founding school' : schoolId),
      status: school.status || 'active',
      createdAt: iso(school.createdAt),
      plan: isFounding ? { tier: plan?.data()?.tier || 'elite' } : { tier: school.subscription?.tier || 'pending', endsAt: school.subscription?.endsAt || null },
      billing: {
        interval: billing.interval || null,
        stripeStatus: billing.stripeStatus || null,
        stripeCustomerId: billing.stripeCustomerId || null,
        stripeSubscriptionId: billing.stripeSubscriptionId || null,
        livemode: billing.livemode === true,
      },
      office: { active: role.status === 'active', username: role.username || '', uid: role.uid || '' },
      counts: { classes, students, teachers: isFounding ? null : teachers.length, familyLogins: isFounding ? null : parents.length },
      teachers: teachers
        .map((teacher) => ({
          uid: teacher.uid,
          name: teacher.displayName || 'Teacher',
          email: emails[teacher.uid]?.email || '',
          status: teacher.status === 'active' && !emails[teacher.uid]?.disabled ? 'active' : 'disabled',
          lastSignIn: emails[teacher.uid]?.lastSignIn || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async function requireSchoolTeacher(schoolId, uid) {
    const snap = await db.collection(PROFILE_COLLECTION).doc(String(uid || '')).get();
    const profile = snap.data();
    if (!snap.exists || profile?.schoolId !== schoolId || profile?.role !== 'teacher') {
      fail('not-found', 'That teacher is not in this school.');
    }
    return { ref: snap.ref, profile };
  }

  // Every document under the school's data root, with its path, for export. listDocuments also
  // returns "empty" parents that only hold subcollections, so nothing nested is missed.
  async function collectDocuments(ref, out, limit) {
    for (const collection of await ref.listCollections()) {
      const refs = await collection.listDocuments();
      for (let i = 0; i < refs.length; i += 300) {
        const batch = refs.slice(i, i + 300);
        const snaps = await db.getAll(...batch);
        for (const snap of snaps) {
          if (out.length >= limit) return;
          if (snap.exists) out.push({ path: snap.ref.path, data: snap.data() });
          await collectDocuments(snap.ref, out, limit);
        }
      }
    }
  }

  async function deleteStoragePrefixes(prefixes) {
    const bucket = getBucket();
    let deleted = 0;
    for (const prefix of prefixes) {
      const [files] = await bucket.getFiles({ prefix });
      await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true }).then(() => { deleted += 1; })));
    }
    return deleted;
  }

  async function idsOf(collectionPath) {
    const refs = await db.collection(collectionPath).listDocuments();
    return refs.map((ref) => ref.id);
  }

  return {
    async getSchoolDetails(request) {
      await requireOperator(request);
      return readDetails(readSchoolId(request.data?.schoolId, { allowFounding: true }));
    },

    async setTeacherStatus(request) {
      await requireOperator(request);
      const schoolId = readSchoolId(request.data?.schoolId);
      const status = request.data?.status === 'active' ? 'active' : 'disabled';
      const { ref } = await requireSchoolTeacher(schoolId, request.data?.uid);
      await auth.updateUser(ref.id, { disabled: status !== 'active' });
      await ref.update({ status });
      // A switched-off teacher is signed out everywhere at once.
      if (status !== 'active') await auth.revokeRefreshTokens(ref.id).catch(() => {});
      return { ok: true, status };
    },

    async teacherPasswordLink(request) {
      await requireOperator(request);
      const schoolId = readSchoolId(request.data?.schoolId);
      const { ref } = await requireSchoolTeacher(schoolId, request.data?.uid);
      const user = await auth.getUser(ref.id);
      if (!user.email) fail('failed-precondition', 'This teacher has no email address.');
      return { link: await auth.generatePasswordResetLink(user.email), email: user.email };
    },

    // All of a school's data as one JSON file in Storage, with a private download link.
    async exportSchool(request) {
      await requireOperator(request);
      const schoolId = readSchoolId(request.data?.schoolId);
      const documents = [];
      await collectDocuments(db.doc(schoolRoot(schoolId)), documents, 200000);
      const [schoolSnap, profiles] = await Promise.all([db.collection(SCHOOLS_COLLECTION).doc(schoolId).get(), schoolProfiles(schoolId)]);
      const payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        schoolId,
        school: schoolSnap.data() || null,
        profiles,
        documents,
      }, (key, value) => (value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value));
      const token = crypto.randomUUID();
      const bucket = getBucket();
      const filePath = `exports/${schoolId}/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await bucket.file(filePath).save(payload, {
        contentType: 'application/json',
        metadata: { metadata: { firebaseStorageDownloadTokens: token }, contentDisposition: `attachment; filename="${schoolId}-export.json"` },
      });
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
      return { url, documents: documents.length, profiles: profiles.length, bytes: Buffer.byteLength(payload) };
    },

    // Deletes a school completely: its Stripe subscription, every login (office, teachers,
    // families), all its data and pictures. The operator must type the school code to confirm.
    async deleteSchool(request) {
      const caller = await requireOperator(request);
      const schoolId = readSchoolId(request.data?.schoolId);
      if (String(request.data?.confirm || '').trim().toLowerCase() !== schoolId) {
        fail('invalid-argument', 'Type the school code exactly to confirm.');
      }
      const schoolRef = db.collection(SCHOOLS_COLLECTION).doc(schoolId);
      const schoolSnap = await schoolRef.get();
      if (!schoolSnap.exists) fail('not-found', 'That school could not be found.');
      const school = schoolSnap.data() || {};

      // 1. Lock the school at once, so nobody keeps working while it is being removed.
      await schoolRef.update({ status: 'deleting', updatedAt: FieldValue.serverTimestamp() });

      // 2. Stop billing first, so a deleted school is never charged again.
      const subscriptionId = school.billing?.stripeSubscriptionId;
      if (subscriptionId) {
        if (!cancelStripeSubscription) fail('failed-precondition', 'This school pays online, but online payment is switched off here, so its Stripe subscription could not be cancelled. Cancel it in Stripe, then delete again.');
        await cancelStripeSubscription(subscriptionId);
      }

      // 3. Collect what the school owns before deleting the records that list it.
      const root = schoolRoot(schoolId);
      const [studentIds, classIds, profiles] = await Promise.all([
        idsOf(`${root}/students`), idsOf(`${root}/classes`), schoolProfiles(schoolId),
      ]);
      const roleSnap = await db.doc(`${root}/school_roles/secretary`).get();
      const uids = [...new Set([...profiles.map((profile) => profile.uid), roleSnap.data()?.uid].filter(Boolean))];

      // 4. Pictures.
      const filesDeleted = await deleteStoragePrefixes([
        ...studentIds.flatMap((id) => STUDENT_FOLDERS.map((folder) => `${folder}/${id}/`)),
        ...classIds.flatMap((id) => CLASS_FOLDERS.map((folder) => `${folder}/${id}/`)),
        ...uids.flatMap((uid) => USER_FOLDERS.map((folder) => `${folder}/${uid}/`)),
        `exports/${schoolId}/`,
      ]);

      // 5. Logins, and the per-user records at the root.
      for (let i = 0; i < uids.length; i += 1000) await auth.deleteUsers(uids.slice(i, i + 1000));
      const writer = db.bulkWriter();
      uids.forEach((uid) => {
        writer.delete(db.collection(PROFILE_COLLECTION).doc(uid));
        writer.delete(db.collection('teacher_metadata').doc(uid));
        writer.delete(db.collection('teachers').doc(uid));
      });
      const webhookEvents = await db.collection('billing_webhook_events').where('schoolId', '==', schoolId).get();
      webhookEvents.docs.forEach((doc) => writer.delete(doc.ref));
      await writer.close();

      // 6. All school data, then the school itself. A deletion record stays for your files.
      await db.recursiveDelete(db.doc(`artifacts/${schoolId}`));
      await db.collection('platform').doc('deletions').collection('schools').doc(`${schoolId}-${Date.now()}`).set({
        schoolId,
        name: school.name || schoolId,
        deletedBy: caller.uid,
        deletedAt: FieldValue.serverTimestamp(),
        logins: uids.length,
        students: studentIds.length,
        classes: classIds.length,
        files: filesDeleted,
      });
      await schoolRef.delete();
      return { ok: true, schoolId, logins: uids.length, students: studentIds.length, classes: classIds.length, files: filesDeleted };
    },
  };
}

module.exports = { createPlatformAdminHandlers };
