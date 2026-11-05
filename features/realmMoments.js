// /features/realmMoments.js — Team Quest realm moments (watcher + banner).
// Watches the teacher's own classes. When one reaches the Silver Peaks, the Golden Citadel or
// the Crystal Realm for the first time this month, it stamps the class's Map Journal and plays
// a short banner over whatever is on screen (the projector included). Realms found already
// reached when the app opens are stamped quietly (`late`), so the diary never claims them.
// Rules live in realmMomentsCore.mjs; the banner (realmBanner.js) loads only when it plays.
import { quietly } from '../utils/runtimeMetrics.js';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, updateDoc } from '../firebase.js';
import { buildRealmStamp, realmMonthKey, unstampedRealms } from './realmMomentsCore.mjs';
import { dataPath } from '../utils/tenant.mjs';

const SETTLE_MS = 6000;
const DEBOUNCE_MS = 1200;

let started = false;
let armedAt = 0;
let armed = false;
let armedFor = '';
let timer = null;
// Realms each class had already reached when watching began (or when last seen), per month.
const seen = new Map();
// Stamps written this session, so a slow snapshot never writes the same one twice.
const written = new Set();
const queue = [];
let showing = false;

function ownClasses() {
    const uid = state.get('currentUserId');
    if (!uid || state.get('currentUserRole') !== 'teacher') return [];
    return (state.get('allSchoolClasses') || []).filter((c) => c?.id && c.createdBy?.uid === uid);
}

function classProgress(classData, studentsByClass, scores) {
    const students = studentsByClass.get(classData.id) || [];
    if (!students.length) return { pct: 0, stars: 0 };
    const goal = utils.calculateMonthlyClassGoal(classData, students.length, state.get('schoolHolidayRanges'), state.get('allScheduleOverrides'));
    const { totalStars } = utils.getClassMonthlyQuestStars(classData, students, scores);
    const pct = goal > 0 ? Math.min(100, (totalStars / goal) * 100) : 0;
    return { pct, stars: totalStars };
}

function evaluate() {
    timer = null;
    const classes = ownClasses();
    const scores = state.get('allStudentScores') || [];
    if (!classes.length || !scores.length) return;
    // A different teacher signing in starts a fresh baseline.
    const uid = state.get('currentUserId');
    if (uid !== armedFor) { armedFor = uid; armed = false; armedAt = 0; seen.clear(); }
    if (!armed) {
        if (!armedAt) armedAt = Date.now();
        if (Date.now() - armedAt < SETTLE_MS) { schedule(SETTLE_MS); return; }
    }
    const now = new Date();
    const monthKey = realmMonthKey(now);
    const studentsByClass = new Map();
    (state.get('allStudents') || []).forEach((s) => {
        if (!studentsByClass.has(s.classId)) studentsByClass.set(s.classId, []);
        studentsByClass.get(s.classId).push(s);
    });

    for (const classData of classes) {
        const { pct, stars } = classProgress(classData, studentsByClass, scores);
        const seenKey = `${classData.id}|${monthKey}`;
        const before = seen.get(seenKey);
        const missing = unstampedRealms(classData, pct, monthKey).filter((id) => !written.has(`${seenKey}|${id}`));
        const reachedNow = new Set([...(before || []), ...missing]);
        if (!armed) {
            seen.set(seenKey, new Set(missing));
            continue;
        }
        seen.set(seenKey, reachedNow);
        if (!missing.length) continue;
        // While watching, a class or month seen for the first time started this month at 0%.
        const live = missing.filter((id) => !(before || new Set()).has(id));
        const patch = {};
        missing.forEach((id) => {
            written.add(`${seenKey}|${id}`);
            patch[`mapJournal.${monthKey}.${id}`] = buildRealmStamp(id, { date: now, stars, late: !live.includes(id) });
        });
        // The banner plays only once the stamp is saved (a closed school year cannot be stamped).
        updateDoc(doc(db, dataPath('classes'), classData.id), patch).then(() => {
            if (!live.length) return;
            queue.push({ classData, realmId: live[live.length - 1], pct });
            playNext();
        }, (error) => {
            // A refused write (closed school year) is not retried; anything else tries again later.
            if (error?.code !== 'permission-denied') missing.forEach((id) => written.delete(`${seenKey}|${id}`));
            console.warn('Map Journal stamp failed:', error?.code || error?.message);
        });
    }
    if (!armed) {
        armed = true;
        evaluate();
    }
}

function schedule(ms = DEBOUNCE_MS) {
    clearTimeout(timer);
    timer = setTimeout(evaluate, ms);
}

/** Starts watching (once per page). Safe to call before sign-in. */
export function startRealmMoments() {
    if (started) return;
    started = true;
    state.subscribe(['allStudentScores', 'allSchoolClasses'], () => schedule());
    schedule();
}

// ─── The banner ──────────────────────────────────────────────────────────────
// The banner and its CSS live in realmBanner.js, fetched only when a class arrives somewhere.

/** Shows one banner now. Resolves when it has gone. */
export function showRealmBanner(classData, realmId, opts = {}) {
    return import('./realmBanner.js')
        .then(({ showRealmBanner: show }) => show(classData, realmId, opts))
        .catch(quietly('features/realmMoments.js'));
}

async function playNext() {
    if (showing || !queue.length) return;
    showing = true;
    const { classData, realmId, pct } = queue.shift();
    try { await showRealmBanner(classData, realmId, { pct }); } finally {
        showing = false;
        if (queue.length) setTimeout(playNext, 250);
    }
}
