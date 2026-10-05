// Star awards this teacher has made that the database has not confirmed yet.
// The award clouds read today's stars through withPendingAwards(), so a redraw caused
// by another teacher's change (a student, a class, a score) never flips a just-sealed
// cloud back open, and a failed save can put the cloud back exactly as it was.

const pending = new Map(); // studentId -> { stars, reason, token, savedAt? }
const queues = new Map(); // studentId -> tail promise of that student's writes
let nextToken = 0;

/** Remembers an award (or an undo: stars 0, reason null) until its save settles. Returns its token. */
export function markAwardPending(studentId, stars, reason = null) {
    nextToken += 1;
    pending.set(String(studentId), { stars: Number(stars) || 0, reason: reason || null, token: nextToken });
    return nextToken;
}

// How long a saved award may wait for the live listener to bring the same row back.
const SAVED_GRACE_MS = 15000;

/**
 * The save went through with this result ({ stars, reason }). The cloud keeps showing it
 * until the live listener brings the same row back (the save can finish a moment before
 * the snapshot arrives, and the cloud must not blink open in between).
 */
export function confirmAwardPending(studentId, token, saved, now = Date.now()) {
    const entry = pending.get(String(studentId));
    if (!entry || entry.token !== token) return false;
    pending.set(String(studentId), {
        stars: Number(saved?.stars) || 0,
        reason: saved?.reason || null,
        token,
        savedAt: now,
    });
    return true;
}

/** Forgets the pending award if it is still the latest one for this student. */
export function settleAwardPending(studentId, token) {
    const entry = pending.get(String(studentId));
    if (!entry || entry.token !== token) return false;
    pending.delete(String(studentId));
    return true;
}

export function getPendingAward(studentId) {
    return pending.get(String(studentId)) || null;
}

export function clearAllPendingAwards() {
    pending.clear();
}

/** Today's stars as the teacher sees them: saved rows, with unconfirmed awards on top. */
export function withPendingAwards(todaysStars = {}, now = Date.now()) {
    const base = todaysStars || {};
    if (!pending.size) return base;
    const out = { ...base };
    for (const [studentId, entry] of [...pending]) {
        if (entry.savedAt != null) {
            const row = base[studentId];
            const rowStars = Number(row?.stars) || 0;
            const arrived = rowStars === entry.stars && (rowStars === 0 || (row?.reason || null) === entry.reason);
            if (arrived || now - entry.savedAt > SAVED_GRACE_MS) {
                pending.delete(studentId);
                continue;
            }
        }
        if (entry.stars > 0 || entry.reason) out[studentId] = { ...(base[studentId] || {}), stars: entry.stars, reason: entry.reason };
        else delete out[studentId];
    }
    return out;
}

/**
 * Builds the studentId -> today's row map from this teacher's today_stars rows.
 * A student can carry two rows (an old Welcome Back unlock row and the day's award row),
 * so the row with stars wins over a zero-star marker, whatever order they arrive in.
 */
export function buildTodaysStarsMap(rows = []) {
    const map = {};
    for (const row of rows) {
        if (!row || !row.studentId) continue;
        const entry = { docId: row.id, stars: Number(row.stars) || 0, reason: row.reason || null };
        const current = map[row.studentId];
        if (!current || entry.stars > current.stars) map[row.studentId] = entry;
    }
    return map;
}

/** Students whose stars or reason differ between two maps. */
export function changedTodaysStarIds(before = {}, after = {}) {
    const ids = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return [...ids].filter((id) => {
        const a = before?.[id];
        const b = after?.[id];
        return (Number(a?.stars) || 0) !== (Number(b?.stars) || 0) || (a?.reason || null) !== (b?.reason || null);
    });
}

/**
 * Runs one student's star writes one after another. An undo tapped while the award is
 * still saving then waits for it instead of reading "nothing to undo" and leaving the
 * star behind. A failed write never blocks the next one.
 */
export function runAwardWriteInOrder(studentId, task) {
    const key = String(studentId);
    const previous = queues.get(key) || Promise.resolve();
    const run = previous.catch(() => {}).then(task);
    const tail = run.catch(() => {});
    queues.set(key, tail);
    tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return run;
}

const RETRYABLE_CODES = new Set(['aborted', 'unavailable', 'deadline-exceeded', 'resource-exhausted', 'failed-precondition', 'internal']);

/** True for Firestore errors that a fresh attempt can fix (contention, a dropped connection). */
export function isRetryableWriteError(error) {
    const code = String(error?.code || '').replace(/^firestore\//, '');
    return RETRYABLE_CODES.has(code);
}

/** Runs `attempt` again after a short pause when it fails for a retryable reason. */
export async function withWriteRetries(attempt, { delays = [400, 1200], sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    for (let i = 0; ; i += 1) {
        try {
            return await attempt(i);
        } catch (error) {
            if (i >= delays.length || !isRetryableWriteError(error)) throw error;
            await sleep(delays[i]);
        }
    }
}
