// /ui/modals/classGreenhouseData.js
// The records behind the Class Greenhouse, shared by the Greenhouse itself and the Hero's
// Chronicle (which shows where one child stands in the class). Six weeks of award_log and
// attendance for one class (existing schoolYearKey + classId + createdAt indexes), every
// paper of the class, Ember Oaths, merged with the live listeners. Cached for three minutes
// per class, so opening the Chronicle right after the Greenhouse costs no extra reads.

import * as state from '../../state.js';
import { db, collection, query, where, getDocs } from '../../firebase.js';
import { dataPath } from '../../utils/tenant.mjs';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { normalizeTrialType } from '../../features/trialTypesCore.mjs';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { fetchAllTrialsForClass } from '../../db/queries.js';
import { canUseFeature } from '../../utils/subscription.js';
import { buildGreenhouse, classRoleOf, WINDOW_DAYS } from '../../features/classGreenhouseCore.mjs';

const RECORD_CACHE_MS = 3 * 60 * 1000;
const recordCache = new Map(); // classId → { at, awards, absences, trials, oaths }
const pending = new Map();     // classId → Promise, so two callers share one read

export function findClass(classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

function sinceDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - WINDOW_DAYS - 1);
    return d;
}

async function readClassCollection(name, classId) {
    const yearKey = state.getActiveSchoolYearKey?.();
    const clauses = [where('classId', '==', classId), where('createdAt', '>=', sinceDate())];
    if (yearKey) clauses.unshift(where('schoolYearKey', '==', yearKey));
    const snap = await getDocs(query(collection(db, dataPath(name)), ...clauses));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadRecords(classId) {
    const cached = recordCache.get(classId);
    if (cached && Date.now() - cached.at < RECORD_CACHE_MS) return cached;
    if (pending.has(classId)) return pending.get(classId);
    const job = readRecords(classId).finally(() => pending.delete(classId));
    pending.set(classId, job);
    return job;
}

async function readRecords(classId) {
    const [awards, absences, trials] = await Promise.all([
        readClassCollection('award_log', classId).catch((e) => { console.warn('Greenhouse awards:', e?.message); return null; }),
        readClassCollection('attendance', classId).catch((e) => { console.warn('Greenhouse attendance:', e?.message); return null; }),
        fetchAllTrialsForClass(classId).catch(() => null)
    ]);
    let oaths = [];
    if (canUseFeature('heroCampfire')) {
        try {
            const { loadEmberOaths } = await import('../../db/actions/emberOaths.js');
            oaths = await loadEmberOaths(classId);
        } catch { /* oaths are a nicety */ }
    }
    const entry = { at: Date.now(), awards, absences, trials, oaths };
    recordCache.set(classId, entry);
    return entry;
}

/** Fetched records merged with the live listeners (today's stars land without a re-read). */
export function gatherInputs(classId) {
    const classData = findClass(classId);
    const cached = recordCache.get(classId) || {};
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const ids = new Set(students.map((s) => s.id));
    const mergeById = (fetched, live) => {
        const map = new Map();
        (fetched || []).forEach((r) => map.set(r.id, r));
        (live || []).filter((r) => r.classId === classId || ids.has(r.studentId)).forEach((r) => map.set(r.id, r));
        return [...map.values()];
    };
    const awards = mergeById(cached.awards, state.get('allAwardLogs')).map((log) => ({
        studentId: log.studentId, date: log.date, stars: getAwardLogMonthlyStarCredit(log), reason: log.reason
    }));
    const absences = mergeById(cached.absences, state.get('allAttendanceRecords')).map((r) => ({ studentId: r.studentId, date: r.date }));
    const trials = mergeById(cached.trials, state.get('allWrittenScores')).map((t) => ({
        studentId: t.studentId,
        date: t.date,
        pct: getNormalizedPercentForScore(t, classData),
        type: normalizeTrialType(t.type),
        title: t.title || ''
    }));
    const notes = (state.get('allHeroChronicleNotes') || []).filter((n) => ids.has(n.studentId)).map((n) => ({
        id: n.id,
        studentId: n.studentId,
        category: n.category,
        text: n.noteText || '',
        source: n.source || '',
        authorRole: n.authorRole || '',
        aiReading: n.aiReading || null,
        readingFix: n.readingFix || null,
        createdAtMs: n.createdAt?.toMillis ? n.createdAt.toMillis() : (n.createdAt?.seconds ? n.createdAt.seconds * 1000 : Date.now())
    }));
    return { students, awards, absences, trials, notes, oaths: cached.oaths || [] };
}


/** The whole reading of one class, from what is cached and live right now (no reads). */
export function readGreenhouse(classId, now = new Date()) {
    return buildGreenhouse({ ...gatherInputs(classId), now });
}

/**
 * Where one child stands in their class, for the Hero's Chronicle. Reads the class records
 * first when they are not cached yet; waits at most `waitMs` for them, then uses what is here.
 */
export async function readChildInClass(studentId, { waitMs = 4000 } = {}) {
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    if (!student?.classId || !findClass(student.classId)) return null;
    const load = loadRecords(student.classId).catch(() => null);
    await Promise.race([load, new Promise((resolve) => setTimeout(resolve, waitMs))]);
    const green = readGreenhouse(student.classId);
    return classRoleOf(green, studentId);
}
