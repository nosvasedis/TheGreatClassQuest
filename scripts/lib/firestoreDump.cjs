'use strict';

// Full copy of a Firestore database as typed JSON, a SHA-256 per document, and the 1:1 check
// between two copies (tools/DATA_MOVE_TO_EUROPE.md, section 5).
//
// Values are read from each document's stored form (the Firestore "Value" of every field), not
// from the JavaScript objects the SDK builds, so an integer stays different from a double, and
// timestamps keep their nanoseconds. Each value becomes [type, payload]; maps are sorted by key,
// so the same document always gives the same text and the same hash, whichever database or
// transport (REST or gRPC) it was read from.
//
// References are compared by document path only (`projects/<p>/databases/<db>/documents/` is
// dropped), so a copy in a rehearsal database with another name still compares equal.
//
// Pure helpers (canonicalValue, hashFields, compareManifests) are unit-tested in
// tests/data-move-dump.test.js; walkDatabase runs against the emulator in the same file.

const crypto = require('node:crypto');

const VALUE_KINDS = [
  'nullValue', 'booleanValue', 'integerValue', 'doubleValue', 'timestampValue', 'stringValue',
  'bytesValue', 'referenceValue', 'geoPointValue', 'arrayValue', 'mapValue',
];

function kindOf(value) {
  if (value && typeof value.valueType === 'string' && VALUE_KINDS.includes(value.valueType)) return value.valueType;
  const present = VALUE_KINDS.filter((k) => value && Object.prototype.hasOwnProperty.call(value, k) && value[k] !== undefined);
  if (present.length !== 1) throw new Error(`Unreadable Firestore value: ${JSON.stringify(value)}`);
  return present[0];
}

function longToString(v) {
  if (v === null || v === undefined) return '0';
  if (typeof v === 'bigint' || typeof v === 'number') return BigInt(v).toString();
  if (typeof v === 'string') return BigInt(v).toString();
  if (typeof v === 'object' && 'low' in v && 'high' in v) {
    // protobufjs Long
    const big = (BigInt(v.high >>> 0) << 32n) | BigInt(v.low >>> 0);
    return (v.unsigned ? big : BigInt.asIntN(64, big)).toString();
  }
  if (typeof v.toString === 'function') return BigInt(v.toString()).toString();
  throw new Error(`Unreadable integer: ${JSON.stringify(v)}`);
}

function timestampParts(v) {
  if (typeof v === 'string') {
    // RFC 3339 from REST: 2026-11-20T12:34:56.123456789Z
    const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(v);
    if (!m) throw new Error(`Unreadable timestamp: ${v}`);
    const seconds = Math.floor(Date.parse(`${m[1]}${m[3]}`) / 1000);
    const nanos = Number((m[2] || '').padEnd(9, '0') || 0);
    return [String(seconds), nanos];
  }
  return [longToString(v.seconds), Number(v.nanos || 0)];
}

function bytesToBase64(v) {
  if (typeof v === 'string') return Buffer.from(v, 'base64').toString('base64');
  return Buffer.from(v).toString('base64');
}

function referencePath(name) {
  const at = String(name).indexOf('/documents/');
  return at === -1 ? String(name) : String(name).slice(at + '/documents/'.length);
}

function doubleToJson(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (Object.is(x, -0)) return '-0';
  return x;
}

function canonicalValue(value) {
  const kind = kindOf(value);
  const v = value[kind];
  switch (kind) {
    case 'nullValue': return ['null'];
    case 'booleanValue': return ['bool', Boolean(v)];
    case 'integerValue': return ['int', longToString(v)];
    case 'doubleValue': return ['double', doubleToJson(v)];
    case 'timestampValue': return ['time', ...timestampParts(v)];
    case 'stringValue': return ['string', String(v)];
    case 'bytesValue': return ['bytes', bytesToBase64(v)];
    case 'referenceValue': return ['ref', referencePath(v)];
    case 'geoPointValue': return ['geo', Number(v.latitude || 0), Number(v.longitude || 0)];
    case 'arrayValue': return ['array', (v.values || []).map(canonicalValue)];
    case 'mapValue': return ['map', canonicalFields(v.fields || {})];
    default: throw new Error(`Unhandled kind ${kind}`);
  }
}

function canonicalFields(fields) {
  const out = {};
  for (const key of Object.keys(fields || {}).sort()) out[key] = canonicalValue(fields[key]);
  return out;
}

function hashFields(canonical) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

// The stored fields of a DocumentSnapshot (the admin SDK keeps them as `_fieldsProto`).
function storedFields(snapshot) {
  const proto = snapshot._fieldsProto;
  if (!proto || typeof proto !== 'object') throw new Error(`No stored fields on ${snapshot.ref.path}: the Firestore SDK changed, update scripts/lib/firestoreDump.cjs`);
  return proto;
}

// gRPC codes 4 (deadline), 8 (resource exhausted), 10 (aborted), 14 (unavailable), plus network errors.
const TRANSIENT_CODES = new Set([4, 8, 10, 14, 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'ABORTED', 'UNAVAILABLE', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE']);
function isTransient(error) {
  if (!error) return false;
  if (TRANSIENT_CODES.has(error.code)) return true;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Total timeout|HTTP 50[234]|HTTP 429/i.test(String(error.message || error));
}

async function withRetry(label, fn, attempts = 6) {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !isTransient(error)) {
        error.message = `${label}: ${error.message}`;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 400 * 2 ** i)));
    }
  }
}

function makePool(limit) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= limit || !waiting.length) return;
    active += 1;
    const { fn, resolve, reject } = waiting.shift();
    fn().then(resolve, reject).finally(() => { active -= 1; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { waiting.push({ fn, resolve, reject }); next(); });
}

/**
 * Reads every document in the database, including documents under parents that do not exist
 * themselves. Calls onDoc({ path, collectionId, fields, hash, updateTime }) for each.
 * Returns { docs, collections, collectionIds, missingParents }.
 */
async function walkDatabase(db, { onDoc, onProgress, concurrency = 32 } = {}) {
  const pool = makePool(concurrency);
  const stats = { docs: 0, collections: 0, missingParents: 0, collectionIds: new Set() };
  const pending = [];
  let firstError = null;
  // Every task is tracked as soon as it starts, so a failure is never an unhandled rejection.
  const track = (promise) => { pending.push(promise.catch((error) => { if (!firstError) firstError = error; })); };

  const visitCollection = (colRef) => pool(async () => {
    stats.collections += 1;
    stats.collectionIds.add(colRef.id);
    const snap = await withRetry(`read ${colRef.path}`, () => colRef.get());
    const present = new Set();
    for (const doc of snap.docs) {
      present.add(doc.id);
      const canonical = canonicalFields(storedFields(doc));
      stats.docs += 1;
      if (onDoc) onDoc({ path: doc.ref.path, collectionId: colRef.id, fields: canonical, hash: hashFields(canonical), updateTime: doc.updateTime ? doc.updateTime.toDate().toISOString() : null });
    }
    // listDocuments also returns parents that only exist because they hold subcollections.
    const refs = await withRetry(`list ${colRef.path}`, () => colRef.listDocuments());
    for (const ref of refs) {
      if (!present.has(ref.id)) stats.missingParents += 1;
      track(pool(async () => {
        const subs = await withRetry(`subcollections of ${ref.path}`, () => ref.listCollections());
        subs.forEach((sub) => track(visitCollection(sub)));
      }));
    }
    if (onProgress) onProgress({ ...stats, collectionIds: stats.collectionIds.size });
  });

  const roots = await withRetry('root collections', () => db.listCollections());
  roots.forEach((col) => track(visitCollection(col)));
  // New work is added while earlier work runs; wait until nothing is left.
  for (let i = 0; i < pending.length; i += 1) await pending[i];
  if (firstError) throw firstError;
  return { docs: stats.docs, collections: stats.collections, missingParents: stats.missingParents, collectionIds: [...stats.collectionIds].sort() };
}

// manifest: Map(path -> hash). Returns what differs between the source and the copy.
function compareManifests(source, copy) {
  const missing = [];
  const extra = [];
  const changed = [];
  for (const [path, hash] of source) {
    if (!copy.has(path)) missing.push(path);
    else if (copy.get(path) !== hash) changed.push(path);
  }
  for (const path of copy.keys()) if (!source.has(path)) extra.push(path);
  return { equal: !missing.length && !extra.length && !changed.length, missing, extra, changed, sourceCount: source.size, copyCount: copy.size };
}

module.exports = {
  canonicalValue,
  canonicalFields,
  hashFields,
  storedFields,
  referencePath,
  walkDatabase,
  compareManifests,
  withRetry,
  isTransient,
};
