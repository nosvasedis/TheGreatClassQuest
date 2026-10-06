// Pure rules for the operator console and teacher join codes (no Firebase, unit-tested).
const crypto = require('node:crypto');
const { FOUNDING_SCHOOL_ID, normalizeSchoolId } = require('./tenant');

const PLAN_TIERS = ['pending', 'starter', 'pro', 'elite'];
const SCHOOL_STATUSES = ['active', 'suspended'];
// Ids that would be confusing as a school code or are kept for the platform itself.
const RESERVED_SCHOOL_IDS = new Set([FOUNDING_SCHOOL_ID, 'admin', 'operator', 'platform', 'api', 'app', 'www', 'schools', 'test', 'demo']);
// No 0/O or 1/I/L, so a code read aloud or copied from paper is not mistyped.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function cleanSchoolName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function parsePlanEnd(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Use a plan end date like 2027-06-30, or leave it empty.');
  const date = new Date(`${text}T23:59:59.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('That plan end date is not a real date.');
  return date.toISOString();
}

function validateTier(value) {
  const tier = String(value ?? '').trim().toLowerCase();
  if (!PLAN_TIERS.includes(tier)) throw new Error('Choose a plan: Pending, Starter, Pro or Elite.');
  return tier;
}

function validateNewSchool(input = {}) {
  const name = cleanSchoolName(input.name);
  if (name.length < 2) throw new Error('Type the school name.');
  const schoolId = normalizeSchoolId(input.schoolId);
  if (!schoolId || schoolId.length < 3) throw new Error('The school code needs 3 to 63 lowercase letters, numbers or dashes.');
  if (RESERVED_SCHOOL_IDS.has(schoolId)) throw new Error('That school code is reserved. Choose another.');
  return { name, schoolId, tier: validateTier(input.tier), endsAt: parsePlanEnd(input.endsAt) };
}

// The plan copied onto schools/{id}.subscription: the tier preset plus the optional end date.
function buildSchoolPlan(tier, endsAt, presets) {
  const preset = presets[validateTier(tier)];
  if (!preset) throw new Error(`Missing plan preset for ${tier}.`);
  return endsAt ? { ...preset, endsAt } : { ...preset };
}

function generateJoinCode(randomBytes = crypto.randomBytes) {
  const bytes = randomBytes(10);
  let code = '';
  for (let i = 0; i < 10; i += 1) code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function normalizeJoinCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashJoinCode(schoolId, code) {
  // Salted with the school, so the same code in two schools never shares a hash.
  return crypto.createHash('sha256').update(`${schoolId}:${normalizeJoinCode(code)}`, 'utf8').digest('hex');
}

function joinCodeMatches(schoolId, code, expectedHash) {
  const normalized = normalizeJoinCode(code);
  if (normalized.length !== 10 || typeof expectedHash !== 'string' || expectedHash.length !== 64) return false;
  const actual = Buffer.from(hashJoinCode(schoolId, normalized), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  PLAN_TIERS,
  SCHOOL_STATUSES,
  RESERVED_SCHOOL_IDS,
  cleanSchoolName,
  parsePlanEnd,
  validateTier,
  validateNewSchool,
  buildSchoolPlan,
  generateJoinCode,
  normalizeJoinCode,
  hashJoinCode,
  joinCodeMatches,
};
