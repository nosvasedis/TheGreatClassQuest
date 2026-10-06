// Which school a Cloud Function call is working for.
//
// Every school's data lives under `artifacts/{schoolId}/public/data`. The founding school keeps
// the original id, so its data never moved. A call learns its school from the caller's own
// profile (never from the request body), then runs inside `runInSchool`, so every helper that
// builds a path with `dataRoot()` stays inside that school, including work awaited later on.
const { AsyncLocalStorage } = require('node:async_hooks');

const FOUNDING_SCHOOL_ID = 'great-class-quest';
const SCHOOL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const schoolContext = new AsyncLocalStorage();

function normalizeSchoolId(value) {
  const id = String(value ?? '').trim().toLowerCase();
  return SCHOOL_ID_PATTERN.test(id) ? id : null;
}

// Profiles written before schools shared one project carry no schoolId: they are the founding
// school's. A schoolId that is present but malformed resolves to null so the call is refused.
function resolveProfileSchoolId(profile) {
  const raw = profile?.schoolId;
  if (raw === undefined || raw === null || raw === '') return FOUNDING_SCHOOL_ID;
  return normalizeSchoolId(raw);
}

function runInSchool(schoolId, fn) {
  const id = normalizeSchoolId(schoolId);
  if (!id) throw new Error(`Invalid school id: ${schoolId}`);
  return schoolContext.run({ schoolId: id }, fn);
}

// Outside a call (module load, a trigger before it picks its school) this is the founding
// school, which is exactly what the code did before schools shared one project.
function currentSchoolId() {
  return schoolContext.getStore()?.schoolId || FOUNDING_SCHOOL_ID;
}

function dataRoot() {
  return `artifacts/${currentSchoolId()}/public/data`;
}

function isFoundingSchool(schoolId = currentSchoolId()) {
  return schoolId === FOUNDING_SCHOOL_ID;
}

module.exports = {
  FOUNDING_SCHOOL_ID,
  normalizeSchoolId,
  resolveProfileSchoolId,
  runInSchool,
  currentSchoolId,
  dataRoot,
  isFoundingSchool,
};
