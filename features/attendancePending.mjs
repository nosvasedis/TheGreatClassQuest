// Attendance marks this teacher has made that the database has not confirmed yet.
// The award clouds read attendance through withPendingAttendance(), so a tap on
// "absent" or "present" turns the cloud at once, a late snapshot can't flip it back,
// and a failed save puts the cloud back exactly as it was.

const pending = new Map(); // studentId -> { absent, date, classId, token, savedAt? }
let nextToken = 0;

/** Remembers an attendance mark until its save settles. Returns its token. */
export function markAttendancePending(studentId, { absent, date, classId = null }) {
    nextToken += 1;
    pending.set(String(studentId), { absent: Boolean(absent), date, classId, token: nextToken });
    return nextToken;
}

// How long a saved mark may wait for the live listener to bring the same record back.
const SAVED_GRACE_MS = 15000;

/** The save went through: keep showing the mark until the listener agrees. */
export function confirmAttendancePending(studentId, token, now = Date.now()) {
    const entry = pending.get(String(studentId));
    if (!entry || entry.token !== token) return false;
    pending.set(String(studentId), { ...entry, savedAt: now });
    return true;
}

/** Forgets the mark if it is still the latest one for this student (a failed save). */
export function settleAttendancePending(studentId, token) {
    const entry = pending.get(String(studentId));
    if (!entry || entry.token !== token) return false;
    pending.delete(String(studentId));
    return true;
}

export function clearAllPendingAttendance() {
    pending.clear();
}

/** Attendance records as the teacher sees them: saved records, with unconfirmed marks on top. */
export function withPendingAttendance(records = [], now = Date.now()) {
    const base = records || [];
    if (!pending.size) return base;
    let out = base;
    for (const [studentId, entry] of [...pending]) {
        const isMine = (r) => r && String(r.studentId) === studentId && r.date === entry.date;
        const saved = base.some(isMine);
        if (entry.savedAt != null && (saved === entry.absent || now - entry.savedAt > SAVED_GRACE_MS)) {
            pending.delete(studentId);
            continue;
        }
        if (entry.absent && !saved) {
            out = [...out, { id: `pending-${studentId}`, studentId, classId: entry.classId, date: entry.date, pending: true }];
        } else if (!entry.absent && saved) {
            out = out.filter((r) => !isMine(r));
        }
    }
    return out;
}
