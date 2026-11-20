// The read-only rules for the database move (scripts/lib/readonlyRules.cjs), run in the emulator
// next to the normal rules (npm run test:data-move; not part of npm test, it needs the emulator).
// Every read must give the same answer under both; every write the normal rules allow must be
// refused by the read-only rules.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, setLogLevel } = require('firebase/firestore');
const { makeReadonlyRules } = require('../../scripts/lib/readonlyRules.cjs');

setLogLevel('silent');
const ROOT = path.resolve(__dirname, '..', '..');
const DATA = 'artifacts/great-class-quest/public/data';
const normalRules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const readonlyRules = makeReadonlyRules(normalRules).rules;

async function seed(env) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'user_profiles/teacher'), { role: 'teacher', status: 'active' }),
      setDoc(doc(db, 'user_profiles/secretary'), { role: 'secretary', status: 'active' }),
      setDoc(doc(db, 'user_profiles/parent'), { role: 'parent', status: 'active', linkedStudentId: 'student-1' }),
      setDoc(doc(db, `${DATA}/school_roles/secretary`), { uid: 'secretary', status: 'active', username: 'office' }),
      setDoc(doc(db, 'appConfig/subscription'), { tier: 'elite', secretaryAccess: true, parentAccess: true }),
      setDoc(doc(db, `${DATA}/school_year_state/current`), { activeYearKey: '2026-2027', nextYearKey: '2027-2028', status: 'active' }),
      setDoc(doc(db, `${DATA}/school_settings/holidays`), { ranges: [] }),
      setDoc(doc(db, `${DATA}/students/student-1`), { name: 'Student', schoolYearKey: '2026-2027', activeSchoolYearKey: '2026-2027', createdBy: { uid: 'teacher' }, enrollmentStatus: 'active' }),
      setDoc(doc(db, `${DATA}/hero_chronicle_notes/old-note`), { studentId: 'student-1', teacherId: 'teacher', schoolYearKey: '2026-2027', category: 'Behavior', noteText: 'kind', createdAt: new Date() }),
    ]);
  });
}

const as = (env, who) => (who ? env.authenticatedContext(who) : env.unauthenticatedContext()).firestore();
const reads = [
  ['teacher', `${DATA}/school_settings/holidays`],
  ['teacher', `${DATA}/students/student-1`],
  ['teacher', 'user_profiles/teacher'],
  ['teacher', 'user_profiles/secretary'],
  ['teacher', `${DATA}/hero_chronicle_notes/old-note`],
  ['secretary', `${DATA}/students/student-1`],
  ['secretary', 'user_profiles/teacher'],
  ['parent', `${DATA}/students/student-1`],
  ['parent', `${DATA}/school_settings/holidays`],
  [null, `${DATA}/school_settings/holidays`],
  [null, 'appConfig/subscription'],
];
const writes = [
  ['teacher', 'set note', (db) => setDoc(doc(db, `${DATA}/hero_chronicle_notes/new-note`), { studentId: 'student-1', teacherId: 'teacher', schoolYearKey: '2026-2027', category: 'Behavior', noteText: 'ΠΟΛΥ ΖΩΗΡΟΣ', createdAt: serverTimestamp() })],
  ['teacher', 'note round cache', (db) => setDoc(doc(db, `${DATA}/daily_cache/note_round_teacher`), { type: 'note_round', teacherId: 'teacher', leaseUntil: 1 }, { merge: true })],
  ['teacher', 'edit own note', (db) => updateDoc(doc(db, `${DATA}/hero_chronicle_notes/old-note`), { noteText: 'kinder' })],
  ['teacher', 'delete own note', (db) => deleteDoc(doc(db, `${DATA}/hero_chronicle_notes/old-note`))],
  ['teacher', 'edit student', (db) => updateDoc(doc(db, `${DATA}/students/student-1`), { name: 'Renamed' })],
  ['secretary', 'edit student', (db) => updateDoc(doc(db, `${DATA}/students/student-1`), { name: 'Renamed' })],
  ['secretary', 'holidays', (db) => setDoc(doc(db, `${DATA}/school_settings/holidays`), { ranges: [] })],
];

const outcome = (promise) => promise.then(() => 'allowed', (error) => (/permission|PERMISSION_DENIED/i.test(String(error && (error.code || error.message))) ? 'denied' : `error: ${error && error.message}`));

let normal;
let readonly;
const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (emulated) before(async () => {
  normal = await initializeTestEnvironment({ projectId: 'demo-gcq-normal', firestore: { rules: normalRules } });
  readonly = await initializeTestEnvironment({ projectId: 'demo-gcq-readonly', firestore: { rules: readonlyRules } });
});
if (emulated) after(() => Promise.all([normal.cleanup(), readonly.cleanup()]));
const emuTest = emulated ? test : () => {};

emuTest('every read gives the same answer under the read-only rules', async () => {
  await Promise.all([seed(normal), seed(readonly)]);
  const results = [];
  for (const [who, p] of reads) {
    const a = await outcome(getDoc(doc(as(normal, who), p)));
    const b = await outcome(getDoc(doc(as(readonly, who), p)));
    results.push({ who, p, normal: a, readonly: b });
  }
  for (const r of results) assert.equal(r.readonly, r.normal, `${r.who} reading ${r.p}`);
  assert.ok(results.some((r) => r.normal === 'allowed') && results.some((r) => r.normal === 'denied'), JSON.stringify(results));
});

emuTest('every write the normal rules allow is refused by the read-only rules', async () => {
  const allowedNormally = [];
  for (const [who, label, write] of writes) {
    await seed(normal);
    if (await outcome(write(as(normal, who))) === 'allowed') allowedNormally.push(label + ' (' + who + ')');
    await seed(readonly);
    assert.equal(await outcome(write(as(readonly, who))), 'denied', `${who}: ${label}`);
  }
  assert.ok(allowedNormally.length >= 3, `the normal rules should allow some of these writes: ${allowedNormally.join(', ')}`);
});
