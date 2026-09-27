// Elite Word-Ember pictures: prepared in the background, never invented live on the projector.
// Only concrete nouns from the verified list are illustrated; IndexedDB keeps them off Firestore.
import { isDepictableCampfireWord, cleanCampfireText } from '../heroCampfireCore.mjs';

const DB_NAME = 'gcq-campfire-art';
const STORE = 'words';
const MAX_PER_CLASS = 8;

function artKey(classId, word) {
    return String(classId || '') + ':' + cleanCampfireText(word, 40).toLowerCase();
}
function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('Pictures wait until next time.'));
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function withStore(mode, fn) {
    const db = await openDb();
    try {
        const tx = db.transaction(STORE, mode);
        const out = await fn(tx.objectStore(STORE));
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        return out;
    } finally { db.close(); }
}

export async function getCampfireWordImage(classId, word) {
    const key = artKey(classId, word);
    if (!classId || !cleanCampfireText(word, 40)) return '';
    try {
        return await withStore('readonly', store => new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || '');
            req.onerror = () => reject(req.error);
        }));
    } catch { return ''; }
}

export async function putCampfireWordImage(classId, word, dataUrl) {
    const key = artKey(classId, word);
    if (!dataUrl || !key.includes(':')) return;
    try {
        await withStore('readwrite', store => {
            store.put(dataUrl, key);
            return Promise.resolve();
        });
        const prefix = String(classId) + ':';
        await withStore('readwrite', store => new Promise((resolve, reject) => {
            const req = store.getAllKeys();
            req.onsuccess = () => {
                const mine = (req.result || []).filter(k => String(k).startsWith(prefix));
                mine.slice(0, Math.max(0, mine.length - MAX_PER_CLASS)).forEach(k => store.delete(k));
                resolve();
            };
            req.onerror = () => reject(req.error);
        }));
    } catch { /* pictures are optional; the ceremony never waits on them */ }
}

/**
 * One grounded picture of a single classroom thing. No letters, no extra objects, no invented word.
 */
export function campfireWordImagePrompt(word, example = '') {
    const thing = cleanCampfireText(word, 40);
    const line = cleanCampfireText(example, 90);
    return "A single warm children's picture-book illustration of one thing only: " + thing + "."
        + (line ? " The idea of the picture: " + line : "")
        + " Centered, campfire gold light, painterly, simple background. No text, no letters, no watermark, no collage, no extra characters.";
}

export async function prepareCampfireWordImages(classId, embellishments = []) {
    const { canUseFeature } = await import('../../utils/subscription.js');
    if (!canUseFeature('eliteAI') || !classId) return;
    const wanted = (embellishments || []).filter(e => e?.depict && isDepictableCampfireWord(e.word)).slice(0, 3);
    if (!wanted.length) return;
    const { callCloudflareAiImageApi } = await import('../../api.js');
    for (const item of wanted) {
        if (await getCampfireWordImage(classId, item.word)) continue;
        try {
            const dataUrl = await callCloudflareAiImageApi(
                campfireWordImagePrompt(item.word, item.example),
                'text, letters, words, watermark, collage, scary, violence, extra people, logo',
                { width: 512, height: 512 },
                { retries: 0, timeoutMs: 25000 }
            );
            if (dataUrl) {
                await putCampfireWordImage(classId, item.word, dataUrl);
                window.dispatchEvent(new CustomEvent('gcq:campfire-art', { detail: { classId, word: item.word } }));
            }
        } catch { /* skip this word; the ember still works */ }
    }
}
