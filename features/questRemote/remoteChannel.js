// features/questRemote/remoteChannel.js — Quest Remote transport (Firestore).
// One short-lived session doc per projector: quest_remote/{sessionId} (owner-only, see firestore.rules)
// with a commands/ subcollection the Wand writes and the projector reads, runs and deletes.
// Paths are built at call time (multi-school tenant root), never cached in module constants.

import {
    db, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, addDoc, collection, query, where,
    orderBy, limit, onSnapshot, serverTimestamp
} from '../../firebase.js';
import { dataPath } from '../../utils/tenant.mjs';
import * as state from '../../state.js';
import { HEARTBEAT_MS, isHostLive } from './remoteCore.mjs';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sessionsPath() { return dataPath('quest_remote'); }
export function sessionRef(sessionId) { return doc(db, sessionsPath(), sessionId); }
function commandsCol(sessionId) { return collection(db, `${sessionsPath()}/${sessionId}/commands`); }

function uid() { return state.get('currentUserId'); }
function toMs(ts) {
    if (!ts) return NaN;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return Number(ts);
}

// ─── Projector side ─────────────────────────────────────────────────────────

/** Creates (or re-opens after a reload) the projector's session. */
export async function openHostSession(sessionId, { code, hostId, classId = '' }) {
    const ref = sessionRef(sessionId);
    const now = Date.now();
    await setDoc(ref, {
        teacherId: uid(),
        hostId,
        code,
        classId: classId || '',
        stage: { surface: 'tab', title: '', pad: [] },
        hostHeartbeatAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        expiresAt: new Date(now + SESSION_TTL_MS),
        closed: false
    }, { merge: true });
    return ref;
}

export function updateHostSession(sessionId, patch) {
    return updateDoc(sessionRef(sessionId), patch);
}

export function beatHost(sessionId) {
    return updateDoc(sessionRef(sessionId), { hostHeartbeatAt: serverTimestamp() });
}

export async function closeHostSession(sessionId) {
    try {
        await updateDoc(sessionRef(sessionId), { closed: true, hostHeartbeatAt: null });
    } catch { /* already gone */ }
}

/** Watches the session doc (the Wand's heartbeat / binding). */
export function watchSession(sessionId, onData, onError) {
    return onSnapshot(sessionRef(sessionId), (snap) => onData(snap.exists() ? snap.data() : null), onError);
}

/**
 * Watches incoming commands. Commands already waiting when the projector starts listening
 * (left over from before a reload) are deleted unrun; afterwards each new one is handed to
 * `onCommand(cmd)` in creation order and then deleted.
 */
export function watchCommands(sessionId, onCommand, onError) {
    let first = true;
    const q = query(commandsCol(sessionId), orderBy('createdAt', 'asc'), limit(50));
    return onSnapshot(q, (snap) => {
        const changes = snap.docChanges().filter((c) => c.type === 'added');
        if (first) {
            first = false;
            changes.forEach((c) => deleteDoc(c.doc.ref).catch(() => {}));
            return;
        }
        for (const change of changes) {
            const data = change.doc.data({ serverTimestamps: 'estimate' });
            deleteDoc(change.doc.ref).catch(() => {});
            onCommand({ ...data, id: change.doc.id, createdMs: toMs(data.createdAt) });
        }
    }, onError);
}

// ─── Wand side ──────────────────────────────────────────────────────────────

/** The teacher's live projectors (newest first) for the Wand's "choose a projector" list. */
export async function listLiveSessions() {
    const q = query(collection(db, sessionsPath()), where('teacherId', '==', uid()), limit(20));
    const snap = await getDocs(q);
    const now = Date.now();
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.closed && isHostLive(toMs(s.hostHeartbeatAt), now))
        .sort((a, b) => toMs(b.hostHeartbeatAt) - toMs(a.hostHeartbeatAt));
}

export async function readSession(sessionId) {
    const snap = await getDoc(sessionRef(sessionId));
    return snap.exists() ? snap.data() : null;
}

/** Joins as the Wand: writes the Wand's id + heartbeat on the session. */
export function bindWand(sessionId, wandId) {
    return updateDoc(sessionRef(sessionId), { wandId, wandHeartbeatAt: serverTimestamp() });
}

export function beatWand(sessionId) {
    return updateDoc(sessionRef(sessionId), { wandHeartbeatAt: serverTimestamp() });
}

export function sendCommand(sessionId, { type, payload = {}, clientSeq, wandId }) {
    return addDoc(commandsCol(sessionId), {
        teacherId: uid(),
        type,
        payload,
        clientSeq,
        wandId,
        sentAt: Date.now(),
        createdAt: serverTimestamp()
    });
}

export { HEARTBEAT_MS, toMs };
