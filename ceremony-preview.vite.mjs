// Dev-only Vite config for ceremony-preview.html: the real Ceremony of the Month with
// Firestore, the award log query and the AI herald swapped for in-memory stand-ins, so the
// whole ceremony (loading, locking, resume, every scene) runs without a network.
//   npx vite --config ceremony-preview.vite.mjs --port 3007
//   then open http://127.0.0.1:3007/ceremony-preview.html
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import base from './vite.config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const real = {
    firebase: path.join(root, 'firebase.js'),
    queries: path.join(root, 'db', 'queries.js'),
    api: path.join(root, 'api.js')
};
const STUB = { [real.firebase]: '\0pv-firebase', [real.queries]: '\0pv-queries', [real.api]: '\0pv-api' };

const firebaseStub = `
export * from ${JSON.stringify(real.firebase)};
const store = (window.__pvStore = window.__pvStore || new Map());
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (x instanceof Date ? x.toISOString() : x))));
const pathOf = (q) => q?.path || q?._query?.path?.canonicalString?.() || q?._query?.path?.segments?.join('/') || '';
function snap(ref, data) { return { id: ref.id, ref, exists: () => data !== undefined, data: () => clone(data) }; }
function setPath(obj, dotted, value) {
    const keys = dotted.split('.');
    let at = obj;
    keys.slice(0, -1).forEach((k) => { at[k] = at[k] && typeof at[k] === 'object' ? at[k] : {}; at = at[k]; });
    at[keys.at(-1)] = value;
}
function merge(a, b) {
    const out = { ...(a || {}) };
    Object.entries(b || {}).forEach(([k, v]) => { out[k] = v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? merge(out[k], v) : v; });
    return out;
}
const fail = () => window.__pvFail && Promise.reject(Object.assign(new Error('offline (preview)'), { code: 'unavailable' }));
export function serverTimestamp() { return new Date(); }
export async function getDoc(ref) { await (fail() || 0); return snap(ref, store.get(ref.path)); }
export async function setDoc(ref, data, opts) { await (fail() || 0); const prev = store.get(ref.path); store.set(ref.path, clone(opts?.merge ? merge(prev, data) : data)); }
export async function updateDoc(ref, data) {
    await (fail() || 0);
    const next = clone(store.get(ref.path) || {});
    Object.entries(data).forEach(([k, v]) => setPath(next, k, clone(v)));
    store.set(ref.path, next);
}
export async function addDoc(ref, data) { const id = 'pv' + Math.random().toString(36).slice(2, 8); store.set(ref.path + '/' + id, clone(data)); return { id }; }
export async function deleteDoc(ref) { store.delete(ref.path); }
export async function getDocs(q) {
    await (fail() || 0);
    const p = pathOf(q);
    const name = p.split('/').filter(Boolean).at(-1);
    const rows = (window.__pvCollections?.[name] || []);
    const docs = rows.map((row) => ({ id: row.id, data: () => clone(row), exists: () => true }));
    return { docs, empty: !docs.length, size: docs.length, forEach: (fn) => docs.forEach(fn) };
}
export function onSnapshot() { return () => {}; }
export function writeBatch() { return { set() { return this; }, update() { return this; }, delete() { return this; }, async commit() {} }; }
export async function runTransaction(_db, fn) { return fn({ get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc }); }
`;

const queriesStub = `
export * from ${JSON.stringify(real.queries)};
export async function fetchLogsForMonth(year, month, options = {}) {
    if (window.__pvFail) { if (options.throwOnError) throw Object.assign(new Error('offline (preview)'), { code: 'unavailable' }); return []; }
    const from = new Date(year, month - 1, 1).getTime();
    const to = new Date(year, month, 1).getTime();
    return (window.__pvLogs || []).filter((log) => { const t = new Date(log.createdAt).getTime(); return t >= from && t < to; });
}
`;

const apiStub = `
export * from ${JSON.stringify(real.api)};
export async function callGeminiApi() { await new Promise((r) => setTimeout(r, 300)); return window.__pvHerald ? window.__pvHerald() : ''; }
`;

export default {
    ...base,
    plugins: [
        ...(base.plugins || []),
        {
            name: 'gcq-ceremony-preview-stubs',
            enforce: 'pre',
            async resolveId(source, importer, options) {
                if (!importer || importer.startsWith('\0pv-')) return null;
                const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
                return resolved && STUB[resolved.id.split('?')[0]] ? STUB[resolved.id.split('?')[0]] : null;
            },
            load(id) {
                if (id === '\0pv-firebase') return firebaseStub;
                if (id === '\0pv-queries') return queriesStub;
                if (id === '\0pv-api') return apiStub;
                return null;
            }
        }
    ]
};
