// ui/modals/noteAiReader.js
// The weekly deep-reading round (Elite): the Oracle reads the Chronicle notes the words-reader
// could not read with confidence, and the result is saved on each note for good.
//
// Started once per app session, on idle, a little after the teacher app is ready (app.js).
// The cheap checks come first and cost nothing: Elite AI, and a once-a-day stamp per device.
// Then one read of the round doc (daily_cache/note_round_<uid>: timestamps and counts only,
// never note text) decides whether a round is due (features/noteAiReadingCore.mjs#roundDue).
// A lease in that doc stops two laptops running the same round. Each call's readings are saved
// straight away (db/actions/log.js#saveChronicleNoteAiReadings), so a half-finished round is
// never wasted, and the note listener refreshes the Greenhouse and the Chronicle by itself.

import * as state from '../../state.js';
import { canUseFeature } from '../../utils/subscription.js';

const CHECK_KEY = (uid) => `gcq.noteRound.checked.${uid}`;
let running = false;
let lastStatus = null;

const today = () => new Date().toISOString().slice(0, 10);

function checkedToday(uid) {
    try { return localStorage.getItem(CHECK_KEY(uid)) === today(); } catch { return false; }
}
function markChecked(uid) {
    try { localStorage.setItem(CHECK_KEY(uid), today()); } catch { /* a per-device nicety */ }
}

/** Resolves true once the Chronicle notes have really arrived (not just the empty default). */
async function waitForNotes(timeoutMs = 15000) {
    const wasRunning = !!state.get('hasLoadedHeroChronicleNotes');
    if (wasRunning && (state.get('allHeroChronicleNotes') || []).length) return true;
    return new Promise((resolve) => {
        let done = false;
        const finish = (ok) => { if (done) return; done = true; off(); clearTimeout(timer); resolve(ok); };
        const off = state.subscribe(['allHeroChronicleNotes'], () => finish(true));
        // A listener that was already running and is still empty after a few seconds means no notes.
        const timer = setTimeout(() => finish(wasRunning), wasRunning ? 4000 : timeoutMs);
        import('../../db/listeners.js').then(({ ensureHeroChronicleNotesListener }) => ensureHeroChronicleNotesListener()).catch(() => finish(false));
    });
}

async function roundRef(uid) {
    const [{ db, doc }, { dataPath }] = await Promise.all([import('../../firebase.js'), import('../../utils/tenant.mjs')]);
    return doc(db, dataPath('daily_cache'), `note_round_${uid}`);
}

const msOf = (v) => (v?.toMillis ? v.toMillis() : Number(v) || 0);

/** What is waiting, and when the next round may run: { eligible, pending, next, nextLabel }. */
export async function readingRoundStatus() {
    const uid = state.get('currentUserId');
    if (!uid || !canUseFeature('eliteAI')) return { eligible: false };
    const [{ pendingNotes, roundDue, nextRoundLabel }, { getDoc }] = await Promise.all([
        import('../../features/noteAiReadingCore.mjs'), import('../../firebase.js')
    ]);
    const pending = pendingNotes(state.get('allHeroChronicleNotes') || [], state.get('allStudents') || [], { uid });
    let round = lastStatus?.round || null;
    if (!round) {
        try {
            const snap = await getDoc(await roundRef(uid));
            const d = snap.exists() ? snap.data() : {};
            round = { lastRunAt: msOf(d.lastRunAt), lastAttemptAt: msOf(d.lastAttemptAt), backlog: d.backlog || 0, leaseUntil: msOf(d.leaseUntil) };
        } catch { round = {}; }
    }
    const due = roundDue(round, pending.length);
    lastStatus = { round, pending: pending.length, next: due.next };
    return { eligible: true, pending: pending.length, next: due.next, nextLabel: nextRoundLabel(due.next) };
}

/**
 * Runs a reading round if one is due. Safe to call often: it returns quickly unless a round is
 * due, and never runs twice at once on this laptop or across laptops.
 */
export async function maybeRunReadingRound({ force = false } = {}) {
    const uid = state.get('currentUserId');
    if (running || !uid || !canUseFeature('eliteAI')) return null;
    if (!force && checkedToday(uid)) return null;
    running = true;
    try {
        if (!(await waitForNotes())) return null;
        markChecked(uid);
        const core = await import('../../features/noteAiReadingCore.mjs');
        const students = state.get('allStudents') || [];
        const pending = core.pendingNotes(state.get('allHeroChronicleNotes') || [], students, { uid });
        if (!pending.length) return { ran: false, pending: 0 };

        const { db, getDoc, setDoc, runTransaction } = await import('../../firebase.js');
        const ref = await roundRef(uid);
        const snap = await getDoc(ref).catch(() => null);
        const d = snap?.exists() ? snap.data() : {};
        const round = { lastRunAt: msOf(d.lastRunAt), lastAttemptAt: msOf(d.lastAttemptAt), backlog: d.backlog || 0, leaseUntil: msOf(d.leaseUntil) };
        const due = core.roundDue(round, pending.length);
        lastStatus = { round, pending: pending.length, next: due.next };
        if (!due.due) return { ran: false, pending: pending.length, next: due.next };

        // Claim the round, so another laptop of this teacher does not run it too.
        const claimed = await runTransaction(db, async (tx) => {
            const live = await tx.get(ref);
            const lease = msOf(live.exists() ? live.data().leaseUntil : 0);
            if (lease > Date.now()) return false;
            tx.set(ref, { type: 'note_round', teacherId: uid, leaseUntil: Date.now() + core.LEASE_MS }, { merge: true });
            return true;
        }).catch(() => false);
        if (!claimed) return { ran: false, pending: pending.length };

        const [{ callGeminiApi }, { saveChronicleNoteAiReadings }] = await Promise.all([
            import('../../api.js'), import('../../db/actions/log.js')
        ]);
        const firstNames = Object.fromEntries(students.map((s) => [s.id, String(s.name || '').trim().split(/\s+/)[0] || '']));
        const batches = core.packBatches(pending);
        let read = 0;
        let calls = 0;
        let failed = false;
        for (const batch of batches) {
            try {
                const { system, user } = core.buildAiReadingPrompt(batch, { firstNames });
                calls += 1;
                const reply = await callGeminiApi(system, user, { jsonMode: true, maxTokens: 1100, timeoutMs: 45000 });
                const readings = core.parseAiReading(reply, batch);
                if (!readings) { failed = true; break; }
                read += await saveChronicleNoteAiReadings(readings);
            } catch (err) {
                console.warn('Deep reading round stopped:', err?.message || err);
                failed = true;
                break;
            }
        }
        const now = Date.now();
        const left = Math.max(0, pending.length - read);
        await setDoc(ref, {
            type: 'note_round', teacherId: uid, leaseUntil: 0, lastAttemptAt: now, calls,
            ...(read ? { lastRunAt: now, backlog: left, lastRead: read } : {})
        }, { merge: true }).catch(() => {});
        lastStatus = null;
        return { ran: true, read, calls, failed, pending: left };
    } finally {
        running = false;
    }
}
