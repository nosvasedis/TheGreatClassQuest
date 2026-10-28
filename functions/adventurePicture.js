'use strict';

const crypto = require('node:crypto');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v1/https');
const { shopAiImage, imageErrorIsRetryable } = require('./shop/ai');

// The Auto diary picture is painted here rather than in the browser, so it finishes even
// when the teacher closes the tab or the laptop sleeps, and a busy school network or the
// Storage rules can never stop it. Same prompt and picture size as the editor's Retry.
let promptModule = null;
function loadPrompt() {
  if (!promptModule) promptModule = import('./adventurePicturePrompt.mjs');
  return promptModule;
}

// Bumped when the callable's answer changes shape; the browser paints itself when an
// older (or missing) deployment answers.
const PICTURE_VERSION = 1;
// Retry one explicit transient refusal; never repeat a spent-quota or timed-out inference.
const RETRY_DELAYS_MS = [5000];
// The Worker gives up on its whole model chain after 55 s; this catches a stuck socket.
const WORKER_TIMEOUT_MS = 65000;
// A 'generating' page whose painter died mid-paint can be claimed again after this long.
const STALE_GENERATING_MS = 10 * 60 * 1000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PICTURE_CACHE_CONTROL = 'public,max-age=31536000,immutable';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sniffImageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { contentType: 'image/png', extension: 'png' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return { contentType: 'image/webp', extension: 'webp' };
  return null;
}

// Short and free of diary text: what failed, for the page's artworkErrorDetail.
function describeFailure(error) {
  const status = Number(error?.status) || 0;
  let detail = String(error?.detail || '');
  try { detail = JSON.parse(detail).detail || JSON.parse(detail).error || detail; } catch (_) { /* plain text */ }
  const reason = error?.name === 'TimeoutError' ? 'timed out' : String(error?.message || error || 'Error');
  return `${status ? `${status} ` : ''}${reason}${detail ? ` — ${detail}` : ''}`.replace(/\s+/g, ' ').slice(0, 300);
}

function createAdventurePictureHandlers({ requireAuthedCaller, requireFeatureEnabled, getActiveSchoolYearKey, publicDataPath, getBucket }) {
  async function paintAdventureLogPicture(request) {
    await requireFeatureEnabled('eliteAI');
    const caller = await requireAuthedCaller(request);
    if (caller.profile?.role !== 'teacher') throw new HttpsError('permission-denied', 'Only the teacher who wrote this page can paint its picture.');
    const logId = String(request.data?.logId || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(logId)) throw new HttpsError('invalid-argument', 'Choose a diary page first.');
    const style = String(request.data?.style || '').slice(0, 300);
    const activeYear = await getActiveSchoolYearKey();
    const db = getFirestore();
    const logRef = db.doc(`${publicDataPath()}/adventure_logs/${logId}`);
    const requestId = crypto.randomUUID();
    const ownsPage = (log) => log?.createdBy?.uid === caller.uid && log.schoolYearKey === activeYear;

    let log = null;
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);
      if (!snap.exists) return false;
      log = snap.data() || {};
      if (!ownsPage(log)) throw new HttpsError('permission-denied', 'This diary page belongs to another teacher or school year.');
      // An uploaded/removed picture is always the teacher's decision.
      if (log.imageUrl || log.imageBase64 || log.artworkStatus === 'removed') return false;
      if (!String(log.text || '').trim()) return false;
      const updatedAt = log.artworkUpdatedAt?.toMillis?.() || 0;
      if (log.artworkStatus === 'generating' && Date.now() - updatedAt <= STALE_GENERATING_MS) return false;
      tx.update(logRef, { artworkRequestId: requestId, artworkStatus: 'generating', artworkError: '', artworkErrorDetail: '', artworkUpdatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) return { status: 'skipped', version: PICTURE_VERSION };

    // A teacher's Save (upload, removal, Retry picture) gives the page a new request id.
    const stillOurs = async () => (await logRef.get()).data()?.artworkRequestId === requestId;
    const { buildAdventurePicturePrompt, ADVENTURE_PICTURE_SIZE } = await loadPrompt();
    const prompt = buildAdventurePicturePrompt({ title: log.title, text: log.text, style });

    let bytes = null;
    let lastFailure = '';
    for (let attempt = 0; ; attempt += 1) {
      try {
        bytes = await shopAiImage(prompt, 'text, letters, watermark, blurry, low quality', {
          width: ADVENTURE_PICTURE_SIZE, height: ADVENTURE_PICTURE_SIZE, timeoutMs: WORKER_TIMEOUT_MS
        });
        if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > MAX_IMAGE_BYTES || !sniffImageType(bytes)) {
          throw new Error(`The painter answered with ${bytes?.length || 0} bytes that are not a picture.`);
        }
        break;
      } catch (error) {
        bytes = null;
        lastFailure = describeFailure(error);
        console.warn(JSON.stringify({ event: 'gcq_diary_picture_attempt_failed', logId, attempt: attempt + 1, reason: lastFailure }));
        if (!(await stillOurs())) return { status: 'superseded', version: PICTURE_VERSION };
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay == null || !imageErrorIsRetryable(error)) break;
        await wait(delay);
        if (!(await stillOurs())) return { status: 'superseded', version: PICTURE_VERSION };
      }
    }

    const markFailed = async (artworkError, reason) => {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(logRef);
        if (snap.exists && snap.data()?.artworkRequestId === requestId) {
          tx.update(logRef, { artworkStatus: 'failed', artworkError, artworkErrorDetail: reason, artworkUpdatedAt: FieldValue.serverTimestamp() });
        }
      });
      return { status: 'failed', reason, version: PICTURE_VERSION };
    };
    if (!bytes) return markFailed('Picture could not be created. Retry or upload one in Edit.', lastFailure);

    const { contentType, extension } = sniffImageType(bytes);
    const path = `adventure_logs/${caller.uid}/${logId}/${requestId}.${extension}`;
    const file = getBucket().file(path);
    const token = crypto.randomUUID();
    try {
      await file.save(bytes, {
        resumable: false,
        metadata: { contentType, cacheControl: PICTURE_CACHE_CONTROL, metadata: { firebaseStorageDownloadTokens: token } }
      });
    } catch (error) {
      const reason = `storage: ${describeFailure(error)}`;
      console.error(JSON.stringify({ event: 'gcq_diary_picture_store_failed', logId, reason }));
      return markFailed('Picture could not be saved. Retry or upload one in Edit.', reason);
    }
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${getBucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    const applied = await db.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);
      if (!snap.exists || snap.data()?.artworkRequestId !== requestId) return false;
      tx.update(logRef, {
        imageUrl, imageBase64: null, artworkStoragePath: path, artworkStatus: 'ready', artworkSource: 'ai',
        artworkError: '', artworkErrorDetail: '', artworkUpdatedAt: FieldValue.serverTimestamp()
      });
      return true;
    });
    if (!applied) {
      await file.delete().catch(() => {});
      return { status: 'superseded', version: PICTURE_VERSION };
    }
    return { status: 'ready', version: PICTURE_VERSION };
  }

  return { paintAdventureLogPicture };
}

module.exports = { createAdventurePictureHandlers, PICTURE_VERSION };
