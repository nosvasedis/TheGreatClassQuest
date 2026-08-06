const { before, beforeEach, after, test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} = require('firebase/firestore');
const {
  ref,
  uploadBytes,
  getBytes,
} = require('firebase/storage');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = 'artifacts/great-class-quest/public/data';
let env;
const rulesTest = process.env.FIRESTORE_EMULATOR_HOST ? test : test.skip;

if (process.env.FIRESTORE_EMULATOR_HOST) before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gcq',
    firestore: { rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8') },
  });
});

if (process.env.FIRESTORE_EMULATOR_HOST) beforeEach(async () => {
  await Promise.all([env.clearFirestore(), env.clearStorage()]);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'user_profiles/teacher'), {
        role: 'teacher', status: 'active', schoolAdmin: false,
      }),
      setDoc(doc(db, 'user_profiles/secretary'), {
        role: 'secretary', status: 'active', schoolAdmin: false,
      }),
      setDoc(doc(db, 'user_profiles/parent'), {
        role: 'parent', status: 'active', schoolAdmin: false, linkedStudentId: 'student-1',
      }),
      setDoc(doc(db, 'user_profiles/inactive'), {
        role: 'teacher', status: 'disabled', schoolAdmin: false,
      }),
      setDoc(doc(db, `${DATA}/school_year_state/current`), {
        activeYearKey: '2026-2027', nextYearKey: '2027-2028', status: 'active',
      }),
      setDoc(doc(db, `${DATA}/school_settings/holidays`), { ranges: [] }),
      setDoc(doc(db, 'teachers/orphan'), { displayName: 'No profile' }),
      setDoc(doc(db, `${DATA}/students/student-1`), {
        name: 'Student', schoolYearKey: '2026-2027', activeSchoolYearKey: '2026-2027',
        createdBy: { uid: 'teacher' }, enrollmentStatus: 'active',
      }),
      setDoc(doc(db, `${DATA}/award_log/archived-log`), {
        schoolYearKey: '2025-2026', status: 'archived', createdBy: { uid: 'teacher' }, stars: 1,
      }),
    ]);
    await uploadBytes(
      ref(context.storage(), 'avatars/legacy-avatar.png'),
      new Uint8Array([137, 80, 78, 71]),
      { contentType: 'image/png' },
    );
  });
});

after(async () => {
  await env?.cleanup();
});

rulesTest('missing and inactive profiles cannot read protected school data', async () => {
  const missingDb = env.authenticatedContext('orphan').firestore();
  const inactiveDb = env.authenticatedContext('inactive').firestore();
  await assertFails(getDoc(doc(missingDb, `${DATA}/school_settings/holidays`)));
  await assertFails(getDoc(doc(missingDb, 'teachers/orphan')));
  await assertFails(getDoc(doc(inactiveDb, `${DATA}/school_settings/holidays`)));
});

rulesTest('active teacher and secretary retain legitimate reads', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const secretaryDb = env.authenticatedContext('secretary').firestore();
  await assertSucceeds(getDoc(doc(teacherDb, `${DATA}/school_settings/holidays`)));
  await assertSucceeds(getDoc(doc(secretaryDb, `${DATA}/students/student-1`)));
});

rulesTest('public self-registration can create only the fixed teacher profile', async () => {
  const signupDb = env.authenticatedContext('new-teacher').firestore();
  const fixedProfile = {
    role: 'teacher',
    displayName: 'New Teacher',
    loginMode: 'email',
    status: 'active',
    schoolAdmin: false,
    linkedStudentId: null,
    createdBy: null,
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(signupDb, 'user_profiles/new-teacher'), fixedProfile));

  const forgedDb = env.authenticatedContext('forged-admin').firestore();
  await assertFails(setDoc(doc(forgedDb, 'user_profiles/forged-admin'), {
    ...fixedProfile,
    role: 'secretary',
    schoolAdmin: true,
  }));
});

rulesTest('teacher writes stay in the active year and immutable ownership cannot change', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const activeClass = doc(teacherDb, `${DATA}/classes/class-active`);
  await assertSucceeds(setDoc(activeClass, {
    name: 'Class', schoolYearKey: '2026-2027', createdBy: { uid: 'teacher' },
  }));
  await assertFails(setDoc(doc(teacherDb, `${DATA}/classes/class-archived`), {
    name: 'Old', schoolYearKey: '2025-2026', createdBy: { uid: 'teacher' },
  }));
  await assertFails(updateDoc(activeClass, { createdBy: { uid: 'someone-else' } }));
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/award_log/archived-log`), { stars: 2 }));
});

rulesTest('parent cannot forge authoritative guild state while secretary retains settings access', async () => {
  const parentDb = env.authenticatedContext('parent').firestore();
  const secretaryDb = env.authenticatedContext('secretary').firestore();
  await assertFails(setDoc(doc(parentDb, `${DATA}/guild_scores/forged`), {
    activeSchoolYearKey: '2026-2027', score: 999,
  }));
  await assertSucceeds(updateDoc(doc(secretaryDb, `${DATA}/school_settings/holidays`), {
    ranges: [{ start: '2026-12-24', end: '2027-01-07' }],
  }));
});

rulesTest('storage preserves legacy reads while enforcing profile, ownership, MIME, and size limits', async () => {
  const teacherStorage = env.authenticatedContext('teacher').storage();
  const parentStorage = env.authenticatedContext('parent').storage();
  const missingStorage = env.authenticatedContext('orphan').storage();
  const validImage = new Uint8Array([82, 73, 70, 70]);

  await assertSucceeds(uploadBytes(
    ref(teacherStorage, 'avatars/student-1/avatar.webp'),
    validImage,
    { contentType: 'image/webp' },
  ));
  await assertFails(uploadBytes(
    ref(parentStorage, 'avatars/student-1/avatar.webp'),
    validImage,
    { contentType: 'image/webp' },
  ));
  await assertFails(uploadBytes(
    ref(teacherStorage, 'avatars/student-1/avatar.txt'),
    validImage,
    { contentType: 'text/plain' },
  ));
  await assertFails(uploadBytes(
    ref(teacherStorage, 'avatars/student-1/oversized.webp'),
    new Uint8Array((1024 * 1024) + 1),
    { contentType: 'image/webp' },
  ));
  await assertSucceeds(getBytes(ref(teacherStorage, 'avatars/legacy-avatar.png')));
  await assertFails(getBytes(ref(missingStorage, 'avatars/legacy-avatar.png')));
});
