// Picture drafts stay local until Save. Automatic artwork uses a transaction token.
import { db, doc, getDoc, runTransaction, serverTimestamp, storage, ref, deleteObject } from '../firebase.js';
import * as state from '../state.js';
import { compressImageBase64, uploadImageToStorage, getLeagueAiVisualStyle } from '../utils.js';
import { callCloudflareAiImageApi } from '../api.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import { buildAdventurePicturePrompt, ADVENTURE_PICTURE_SIZE } from '../functions/adventurePicturePrompt.mjs';
import { isFinalAiErrorSource } from '../utils/aiResilience.js';

export const newAdventureRequestId = () => crypto.randomUUID();

// The automatic picture is painted right after the Chronicler writes, while Campfire may be
// painting too, so a busy moment can fail it. It waits and tries again, as a teacher's Retry would.
export const AUTO_PICTURE_RETRY_DELAYS_MS = [5000];
// A 'generating' page whose tab closed mid-paint can be claimed again after this long.
const STALE_GENERATING_MS = 10 * 60 * 1000;

const permanentError = (message) => Object.assign(new Error(message), { permanent: true });

function assertOwner(log) {
    if (state.get('currentUserRole') !== 'teacher' || log?.createdBy?.uid !== state.get('currentUserId') || log.schoolYearKey !== state.getActiveSchoolYearKey()) throw permanentError('This diary page belongs to another teacher or school year.');
}

export async function readAdventurePicture(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP picture.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose a picture smaller than 8 MB.');
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('This picture could not be read.'));
        reader.readAsDataURL(file);
    });
    return compressImageBase64(dataUrl, 1024, 1024, 0.82);
}

export async function createAdventurePictureDraft(log, { title = log.title, text = log.text } = {}, requestOptions = {}) {
    assertOwner(log);
    const { canUseFeature } = await import('../utils/subscription.js');
    if (!canUseFeature('eliteAI')) throw permanentError('AI pictures require Elite.');
    const prompt = buildAdventurePicturePrompt({ title, text, style: pictureStyleFor(log) });
    const size = { width: ADVENTURE_PICTURE_SIZE, height: ADVENTURE_PICTURE_SIZE };
    const image = await callCloudflareAiImageApi(prompt, '', size, { retries: 0, timeoutMs: 65000, baseDelay: 600, ...requestOptions });
    assertOwner(log);
    return compressImageBase64(image, ADVENTURE_PICTURE_SIZE, ADVENTURE_PICTURE_SIZE, 0.86);
}

function pictureStyleFor(log) {
    const classroom = (state.get('allTeachersClasses') || []).find(c => c.id === log.classId);
    return getLeagueAiVisualStyle(classroom?.questLevel || '');
}

// The Auto picture is painted on the server so it finishes even if this tab closes. Returns
// false only when the server cannot take the job (not deployed yet, offline), so this
// browser paints it instead. A server that took the job owns its outcome on the page.
async function paintOnServer(log) {
    const { functions, httpsCallable } = await import('../firebase.js');
    const paint = httpsCallable(functions, 'paintAdventureLogPicture', { timeout: 310000 });
    try {
        const result = await paint({ logId: log.id, style: pictureStyleFor(log) });
        if (Number(result?.data?.version) >= 1) {
            if (result.data.status === 'failed') console.warn('Diary picture could not be painted on the server:', result.data.reason);
            return true;
        }
        return false;
    } catch (error) {
        const code = String(error?.code || '').replace(/^functions\//, '');
        // Only "the server never took it" falls back; a refusal or a slow answer does not,
        // because the server may still be painting and the page will update on its own.
        if (['internal', 'not-found', 'unimplemented', 'unavailable'].includes(code)) {
            console.warn('Diary picture server unavailable; painting in this browser instead.', error);
            return false;
        }
        console.warn('Diary picture server refused or is still painting:', error);
        return true;
    }
}

export async function prepareAdventurePictureSave(log, draft) {
    assertOwner(log);
    if (!draft || draft.kind === 'keep') return {};
    const artworkRequestId = newAdventureRequestId();
    const common = { imageBase64: null, artworkRequestId, artworkError: '', artworkErrorDetail: '', artworkUpdatedAt: serverTimestamp() };
    if (draft.kind === 'remove') return { ...common, imageUrl: null, artworkStoragePath: null, artworkStatus: 'removed', artworkSource: 'none' };
    const path = `adventure_logs/${log.createdBy.uid}/${log.id}/${artworkRequestId}.jpg`;
    const imageUrl = await uploadImageToStorage(draft.dataUrl, path, { cacheControl: 'public,max-age=31536000,immutable' });
    try { assertOwner(log); }
    catch (error) { await discardAdventurePictureObject(path, log); throw error; }
    return { ...common, imageUrl, artworkStoragePath: path, artworkStatus: 'ready', artworkSource: draft.source || 'upload' };
}

export async function discardAdventurePictureObject(path, log) {
    // Only our immutable objects; never delete an arbitrary URL or another page's media.
    if (!path?.startsWith(`adventure_logs/${log.createdBy.uid}/${log.id}/`)) return;
    try { await deleteObject(ref(storage, path)); } catch (error) { console.warn('Diary picture cleanup deferred:', error.code); }
}

// What actually failed (status, Worker reason, Storage code), kept on the page for diagnosis.
const describePictureFailure = (error) => [error?.status, error?.code, error?.aiReason, error?.message]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 300);

const isStaleGenerating = (log) => log.artworkStatus === 'generating'
    && Date.now() - (log.artworkUpdatedAt?.toMillis?.() || 0) > STALE_GENERATING_MS;

/** Automatic picture after Auto: the same draft + save steps as the editor's Retry and Save. */
export async function generateAdventureLogArtwork(logId, { retryDelaysMs = AUTO_PICTURE_RETRY_DELAYS_MS, useServer = true } = {}) {
    const logRef = doc(db, `${PUBLIC_DATA_PATH}/adventure_logs`, logId);
    if (useServer) {
        const snap = await getDoc(logRef);
        if (!snap.exists()) return;
        const current = { id: snap.id, ...snap.data() };
        assertOwner(current);
        if (await paintOnServer(current)) return;
    }
    const requestId = newAdventureRequestId();
    let log;
    const claimed = await runTransaction(db, async tx => {
        const snap = await tx.get(logRef);
        if (!snap.exists()) return false;
        log = { id: snap.id, ...snap.data() };
        assertOwner(log);
        // An uploaded/removed picture is always the teacher's decision, including after a text retry.
        if (log.imageUrl || log.imageBase64 || log.artworkStatus === 'removed') return false;
        if (log.artworkStatus === 'generating' && !isStaleGenerating(log)) return false;
        tx.update(logRef, { artworkRequestId: requestId, artworkStatus: 'generating', artworkError: '', artworkErrorDetail: '', artworkUpdatedAt: serverTimestamp() });
        return true;
    });
    if (!claimed) return;
    // A teacher's Save (upload, removal, Retry picture) gives the page a new request id.
    const stillOurs = async () => {
        const snap = await getDoc(logRef);
        return snap.exists() && snap.data().artworkRequestId === requestId;
    };
    let saved;
    try {
        let dataUrl;
        for (let attempt = 0; ; attempt++) {
            try {
                // Its failures never switch off the teacher's own AI, and a busy breaker never skips it.
                dataUrl = await createAdventurePictureDraft(log, undefined, { background: true, ignoreCircuit: true });
                break;
            } catch (error) {
                if (!(await stillOurs())) return;
                const delay = retryDelaysMs[attempt];
                if (error?.permanent || isFinalAiErrorSource(error?.errorSource) || delay == null
                    || !(error?.status === 429 || error?.status >= 500)) throw error;
                console.warn(`Diary picture attempt ${attempt + 1} failed; trying again shortly.`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
                if (!(await stillOurs())) return;
            }
        }
        saved = await prepareAdventurePictureSave(log, { kind: 'replace', dataUrl, source: 'ai' });
        const applied = await runTransaction(db, async tx => {
            const snap = await tx.get(logRef);
            if (!snap.exists() || snap.data().artworkRequestId !== requestId) return false;
            assertOwner(snap.data());
            tx.update(logRef, saved);
            return true;
        });
        if (!applied) await discardAdventurePictureObject(saved.artworkStoragePath, log);
    } catch (error) {
        if (saved) await discardAdventurePictureObject(saved.artworkStoragePath, log);
        await runTransaction(db, async tx => {
            const snap = await tx.get(logRef);
            if (snap.exists() && snap.data().artworkRequestId === requestId) {
                assertOwner(snap.data());
                tx.update(logRef, { artworkStatus: 'failed', artworkError: 'Picture could not be created. Retry or upload one in Edit.', artworkErrorDetail: describePictureFailure(error), artworkUpdatedAt: serverTimestamp() });
            }
        });
        throw error;
    }
}

export function diaryPictureControlsHtml({
    canGenerate = false,
    generateLabel = 'Retry AI picture',
    generateIcon = 'fa-rotate-right',
    hint = 'JPG, PNG or WebP, up to 8 MB. Cancel leaves the saved picture as it is.'
} = {}) {
    return `<section class="diary-picture-editor" aria-label="Diary picture">
        <div class="adventure-log-editor-label-row"><span class="adventure-log-editor-label"><i class="fas fa-image" aria-hidden="true"></i> Picture</span><span class="adventure-log-editor-optional">Saved with your page</span></div>
        <div class="diary-picture-preview" data-picture-preview></div>
        <div class="diary-picture-actions">
            ${canGenerate ? `<button type="button" data-picture-retry class="adventure-log-editor-btn secondary"><i class="fas ${generateIcon}" aria-hidden="true"></i> ${generateLabel}</button>` : ''}
            <button type="button" data-picture-upload class="adventure-log-editor-btn secondary"><i class="fas fa-upload" aria-hidden="true"></i> Upload your picture</button>
            <button type="button" data-picture-delete class="adventure-log-editor-btn secondary"><i class="fas fa-trash-alt" aria-hidden="true"></i> Delete picture</button>
            <input type="file" data-picture-file accept="image/jpeg,image/png,image/webp" hidden aria-label="Choose a diary picture">
        </div>
        <p class="adventure-log-editor-hint" data-picture-status role="status" aria-live="polite">${hint}</p>
    </section>`;
}

export function bindDiaryPictureControls(root, log, { getStory, onBusy, beforePaint, readyText = 'Picture ready. Save changes to keep it.' } = {}) {
    let draft = { kind: 'keep' }, busy = false, disposed = false;
    const preview = root.querySelector('[data-picture-preview]');
    const status = root.querySelector('[data-picture-status]');
    const fileInput = root.querySelector('[data-picture-file]');
    const buttons = [...root.querySelectorAll('.diary-picture-actions button')];
    const currentImage = () => draft.kind === 'remove' ? '' : draft.kind === 'replace' ? draft.dataUrl : log.imageUrl || log.imageBase64 || '';
    const render = () => {
        preview.replaceChildren();
        const image = currentImage();
        if (image) {
            const img = document.createElement('img'); img.src = image; img.alt = 'Picture for this diary page'; preview.append(img);
        } else { const empty = document.createElement('p'); empty.textContent = 'A picture can bring this page to life.'; preview.append(empty); }
        root.querySelector('[data-picture-delete]').disabled = busy || (!image && draft.kind !== 'keep');
    };
    const run = async (operation, busyText = 'Preparing your picture…') => {
        if (busy) return;
        busy = true; buttons.forEach(b => b.disabled = true); onBusy?.(true);
        status.textContent = busyText;
        try {
            const next = await operation();
            if (disposed) return;
            draft = next;
            status.textContent = readyText;
        } catch (error) {
            if (!disposed) status.textContent = (error.friendly || /^(Choose a |This picture could not be read)/.test(error.message || ''))
                ? error.message : 'The picture could not be prepared. Try again or upload a different picture.';
        }
        finally { busy = false; if (!disposed) { buttons.forEach(b => b.disabled = false); render(); onBusy?.(false); } }
    };
    root.querySelector('[data-picture-upload]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0]; fileInput.value = '';
        if (file) run(async () => ({ kind: 'replace', source: 'upload', dataUrl: await readAdventurePicture(file) }));
    });
    root.querySelector('[data-picture-retry]')?.addEventListener('click', () => run(async () => {
        beforePaint?.(); // may throw a friendly error (e.g. nothing written yet to paint from)
        return { kind: 'replace', source: 'ai', dataUrl: await createAdventurePictureDraft(log, getStory?.()) };
    }, beforePaint ? 'Painting a picture from your words…' : 'Preparing your picture…'));
    root.querySelector('[data-picture-delete]').addEventListener('click', () => { if (busy) return; draft = { kind: 'remove' }; status.textContent = 'Picture will be removed when you save.'; render(); });
    render();
    return { getDraft: () => draft, setDisabled(value) { buttons.forEach(b => b.disabled = value); if (!value) render(); }, dispose() { disposed = true; } };
}
