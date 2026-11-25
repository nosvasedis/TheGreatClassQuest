// Dev-only Vite config for lesson-change-preview.html: the real Lesson Change slip with
// Firestore swapped for an in-memory batch that writes into the preview's schedule state.
//   npx vite --config lesson-change-preview.vite.mjs --port 3008
//   then open http://127.0.0.1:3008/lesson-change-preview.html
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import base from './vite.config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const real = { firebase: path.join(root, 'firebase.js'), admin: path.join(root, 'utils', 'adminRuntime.js') };
const STUB = { [real.firebase]: '\0lc-firebase', [real.admin]: '\0lc-admin' };

const firebaseStub = `
export * from ${JSON.stringify(real.firebase)};
let seq = 0;
export function serverTimestamp() { return new Date(); }
export function collection(_db, path) { return { path }; }
export function doc(first, pathOrCol, id) {
    if (first && first.path && pathOrCol === undefined) return { path: first.path + '/new' + (++seq), id: 'new' + seq, col: first.path };
    return { path: pathOrCol + '/' + id, id, col: pathOrCol };
}
export function writeBatch() {
    const ops = [];
    return {
        set(ref, data) { ops.push(['set', ref, data]); return this; },
        update(ref, data) { ops.push(['update', ref, data]); return this; },
        delete(ref) { ops.push(['delete', ref]); return this; },
        async commit() { await new Promise((r) => setTimeout(r, 250)); window.__lcApply(ops); }
    };
}
`;
const adminStub = `
export * from ${JSON.stringify(real.admin)};
export async function syncQuestAssignmentToParentHomework(p) { console.log('[preview] family homework sync', p); return { ok: true }; }
`;

export default {
    ...base,
    plugins: [
        ...(base.plugins || []),
        {
            name: 'gcq-lesson-change-preview-stubs',
            enforce: 'pre',
            async resolveId(source, importer, options) {
                if (!importer || importer.startsWith('\0lc-')) return null;
                const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
                return resolved && STUB[resolved.id.split('?')[0]] ? STUB[resolved.id.split('?')[0]] : null;
            },
            load(id) {
                if (id === '\0lc-firebase') return firebaseStub;
                if (id === '\0lc-admin') return adminStub;
                return null;
            }
        }
    ]
};
