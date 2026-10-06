// /features/heroSeals.js — Hero Seals runtime: the watcher, the teacher's notice and the summary.
//
// Watches the teacher's own classes that are in play (the selected class, classes with
// activity today, and any class whose Folio or Trophy Room is opened). For each child it
// keeps the Seal Book (features/heroSealsCore.mjs) and presses every seal the records
// prove, on student_scores `heroSeals` (app-side only: no Cloud Function, no rules change).
//
// The first time a class is read, the school year so far is read once (award log, absences,
// trials, Quiz of the Week history), so seals already earned this year are found with their
// real dates (`late`). After that the live listeners are enough, plus absences, trials and
// quiz history read once per session per class.
//
// When seals are pressed, the app's ordinary notification says so; its button opens a
// summary of who pressed what. Seen-ness is kept per teacher per device.
import '../styles/hero_seals.css';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, updateDoc, deleteField, collection, query, where, getDocs } from '../firebase.js';
import { getSchoolYearOpeningDay } from '../utils/schoolYearOpening.mjs';
import { fetchAllTrialsForClass } from '../db/queries.js';
import { getClassAssessmentUsage, getNormalizedPercentForScore } from './assessmentConfig.js';
import { normalizeTrialType } from './trialTypesCore.mjs';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { notify } from '../ui/effects.js';
import { escSeal, heroSealsNoticeCopy, heroSealsSummaryHtml } from './heroSealsView.mjs';
import {
    ATTENDANCE_SEALS,
    HERO_SEALS_VERSION,
    VIRTUES,
    buildSealBook,
    bookSealIds,
    collectNewSeals,
    evaluateSeals,
    newSealPresses,
    sealArtHtml,
    sealDateKey,
} from './heroSealsCore.mjs';
import { PUBLIC_DATA_PATH as ROOT } from '../utils/tenant.mjs';

const SETTLE_MS = 6000;
const DEBOUNCE_MS = 4000;
/** A star younger than this may still be undone; it waits for the next look. */
const AWARD_SETTLE_MS = 45000;
const SEEN_KEY = (uid) => `gcq.heroSeals.seen.${uid}`;
const LESSON_REASONS = new Set([...VIRTUES, 'excellence', 'welcome_back']);
const LITE = (() => { try { return detectLowPowerTier(); } catch { return false; } })();

let started = false;
let armedAt = 0;
let timer = null;
let recheckTimer = null;
const requested = new Set();
const inflight = new Map();
/** Per class, read once per session: { absences, trials, quizzes, yearAwards? }. */
const classCache = new Map();
/** Presses written this session, so a slow snapshot never writes one twice. */
const written = new Set();

// ─── State helpers ───────────────────────────────────────────────────────────

function uid() {
    return state.get('currentUserId') || '';
}

function isTeacher() {
    return Boolean(uid()) && state.get('currentUserRole') === 'teacher';
}

function ownClasses() {
    if (!isTeacher()) return [];
    const me = uid();
    return (state.get('allSchoolClasses') || []).filter((c) => c?.id && c.createdBy?.uid === me);
}

function findClass(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || null;
}

function classStudents(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && s.enrollmentStatus !== 'inactive');
}

function scoreOf(studentId) {
    return (state.get('allStudentScores') || []).find((s) => s.id === studentId) || null;
}

function ms(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    const n = new Date(value).getTime();
    return Number.isFinite(n) ? n : 0;
}

function todayKey() {
    return utils.getLocalIsoDateString(new Date());
}

// ─── Reading the records ─────────────────────────────────────────────────────

async function readCollection(name, classId) {
    const year = state.getActiveSchoolYearKey?.();
    const q = query(
        collection(db, `${ROOT}/${name}`),
        where('classId', '==', classId),
        ...(year ? [where('schoolYearKey', '==', year)] : []),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function readQuizzes(classId) {
    const q = query(collection(db, `${ROOT}/quiz_of_the_week`), where('classId', '==', classId), where('status', '==', 'completed'));
    const year = state.getActiveSchoolYearKey?.();
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((qz) => !year || !qz.schoolYearKey || qz.schoolYearKey === year);
}

async function classRecords(classId, { needYear = false, refreshQuiz = false } = {}) {
    let cache = classCache.get(classId);
    if (!cache) {
        const [absences, trials, quizzes] = await Promise.all([
            readCollection('attendance', classId).catch((e) => { console.warn('Hero Seals: absences unavailable', e?.code || e); return null; }),
            fetchAllTrialsForClass(classId).catch(() => null),
            readQuizzes(classId).catch(() => []),
        ]);
        cache = { absences: absences || [], trials: trials || [], quizzes, yearAwards: null, partial: !absences };
        classCache.set(classId, cache);
    } else {
        if (refreshQuiz) cache.quizzes = await readQuizzes(classId).catch(() => cache.quizzes);
        // An absence marked or taken back this session: read the class's absences again.
        if (cache.absencesStale) {
            const fresh = await readCollection('attendance', classId).catch(() => null);
            if (fresh) { cache.absences = fresh; cache.absencesStale = false; }
        }
    }
    if (needYear && !cache.yearAwards) {
        cache.yearAwards = await readCollection('award_log', classId);
    }
    return cache;
}

/** Both, the live copy winning (the attendance and trial listeners only run on some tabs). */
function union(cached, live) {
    const byId = new Map();
    (cached || []).forEach((r) => { if (r?.id) byId.set(r.id, r); });
    (live || []).forEach((r) => { if (r?.id) byId.set(r.id, r); });
    return [...byId.values()];
}

/** Cached history outside the live window, the live listener inside it (so undo and deletes hold). */
function withLive(cached, live, inLiveWindow) {
    const byId = new Map();
    (cached || []).forEach((r) => { if (r?.id && !inLiveWindow(r)) byId.set(r.id, r); });
    (live || []).forEach((r) => { if (r?.id) byId.set(r.id, r); });
    return [...byId.values()];
}

/** The class's lesson days this school year up to today, as 'YYYY-MM-DD'. */
function lessonDays(classId) {
    const classes = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];
    const endDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const year = state.getActiveSchoolYearKey?.() || '';
    const startYear = /^\d{4}/.test(year) ? Number(year.slice(0, 4)) : (new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1);
    const day = new Date(startYear, 8, 1);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const out = [];
    for (let guard = 0; day <= end && guard < 400; guard += 1) {
        if (utils.doesClassMeetOnDate(classId, day, classes, overrides, holidays, endDates)) out.push(utils.getLocalIsoDateString(day));
        day.setDate(day.getDate() + 1);
    }
    return out;
}

function occasionsOf(student) {
    return ['birthday', 'nameday']
        .map((k) => sealDateKey(student?.[k]))
        .filter(Boolean)
        .map((d) => d.slice(5));
}

// ─── Evaluating one class ────────────────────────────────────────────────────

async function evaluateClass(classId, { refreshQuiz = false } = {}) {
    const classData = findClass(classId);
    if (!classData || classData.createdBy?.uid !== uid()) return;
    const students = classStudents(classId).filter((s) => scoreOf(s.id));
    if (!students.length) return;

    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartKey = utils.getLocalIsoDateString(monthStart);
    // Children who joined this month are fully covered by the live month.
    const needYear = students.some((s) => {
        // Every Seal Book keeps the day the class's records begin; without it, read the year once.
        if (!scoreOf(s.id)?.heroSeals?.since) return true;
        if (scoreOf(s.id)?.heroSeals?.backfilledAt) return false;
        const joined = sealDateKey(s.createdAt);
        return !joined || joined < monthStartKey;
    });
    const records = await classRecords(classId, { needYear, refreshQuiz });
    if (records.partial) {
        // Without absences a streak could be pressed by mistake: try again on the next look.
        classCache.delete(classId);
        return;
    }

    const today = todayKey();
    const live = (state.get('allAwardLogs') || []).filter((l) => l.classId === classId);
    let unsettled = false;
    const settledLive = live.filter((l) => {
        const t = ms(l.createdAt);
        if (!t || now - t < AWARD_SETTLE_MS) { unsettled = true; return false; }
        return true;
    });
    const inLiveMonth = (r) => sealDateKey(r.date || r.createdAt) >= monthStartKey;
    const awards = records.yearAwards ? withLive(records.yearAwards, settledLive, inLiveMonth) : settledLive;
    const thirtyAgo = utils.getLocalIsoDateString(new Date(now - 30 * 86400000));
    const absences = union(records.absences, (state.get('allAttendanceRecords') || []).filter((r) => r.classId === classId))
        .filter((r) => r.status !== 'present');
    const trialDocs = union(records.trials, (state.get('allWrittenScores') || []).filter((r) => r.classId === classId));

    const lessons = lessonDays(classId);
    // The class's first record in the Quest: before it nobody took attendance.
    const recordDays = [...(records.yearAwards || []), ...settledLive].map((a) => sealDateKey(a.date || a.createdAt))
        .concat(absences.map((r) => sealDateKey(r.date)))
        .filter(Boolean);
    const storedSince = students.map((s) => scoreOf(s.id)?.heroSeals?.since).filter(Boolean);
    const trackedFrom = (records.yearAwards ? recordDays : (storedSince.length ? storedSince : recordDays)).sort()[0] || today;
    const opening = getSchoolYearOpeningDay();
    const openingDay = opening ? utils.getLocalIsoDateString(opening) : '';
    const usage = getClassAssessmentUsage(classData);
    const young = utils.isYoungLearnerLeague(classData.questLevel);

    // The first lesson star of each day in the class.
    const firstStarBy = new Map();
    awards.forEach((a) => {
        if (!LESSON_REASONS.has(a.reason) || !((Number(a.stars) || 0) > 0)) return;
        const d = sealDateKey(a.date || a.createdAt);
        const t = ms(a.createdAt);
        const prev = firstStarBy.get(d);
        if (!prev || (t && t < prev.t)) firstStarBy.set(d, { t: t || Number.MAX_SAFE_INTEGER, studentId: a.studentId });
    });
    const champions = new Map();
    (records.quizzes || []).forEach((qz) => {
        const id = qz?.results?.rewards?.prize?.studentId;
        const d = sealDateKey(qz.completedAt || qz.rewardsPaidAt || qz.updatedAt);
        if (id && d) champions.set(id, [...(champions.get(id) || []), d]);
    });
    const oaths = state.get('allEmberOaths') || [];

    const writes = [];
    for (const student of students) {
        const score = scoreOf(student.id);
        const stored = score.heroSeals || {};
        const earned = stored.earned || {};
        const joined = sealDateKey(student.createdAt);
        const myLessons = joined ? lessons.filter((d) => d >= joined) : lessons;
        const myAbsences = absences.filter((r) => r.studentId === student.id).map((r) => sealDateKey(r.date)).filter(Boolean);
        const myAwards = awards.filter((a) => a.studentId === student.id).map((a) => ({ date: sealDateKey(a.date || a.createdAt), reason: a.reason, stars: Number(a.stars) || 0 }));
        const myTrials = trialDocs
            .filter((t) => t.studentId === student.id && (t.type === 'test' || t.type === 'dictation'))
            .map((t) => ({ date: sealDateKey(t.date), type: normalizeTrialType(t.type), pct: getNormalizedPercentForScore(t, classData) }))
            .filter((t) => t.date && Number.isFinite(t.pct));
        const inventory = Array.isArray(score.inventory) ? score.inventory : [];
        const occasions = occasionsOf(student);
        const recentAbsences = myAbsences.filter((d) => d >= thirtyAgo).length;
        const joinMonth = joined.slice(0, 7);
        const joinedMonth = joined && lessons.some((d) => d.slice(0, 7) === joinMonth && d < joined) ? joinMonth : '';

        const book = buildSealBook({
            studentId: student.id,
            heroClass: student.heroClass,
            guildId: student.guildId,
            usesTrials: usage.any,
            trials: myTrials,
            recentAbsences,
            hasOccasion: occasions.length > 0,
            hasFamiliarEgg: Boolean(score.familiar),
            earned,
        }, stored.book);
        const ids = bookSealIds(book);
        const facts = {
            today,
            awards: myAwards,
            boonsGiven: awards.filter((a) => a.reason === 'peer_boon' && a.giverId === student.id).map((a) => sealDateKey(a.date || a.createdAt)),
            boonsReceived: awards.filter((a) => a.reason === 'peer_boon' && a.studentId === student.id).map((a) => sealDateKey(a.date || a.createdAt)),
            lessons: myLessons,
            absences: myAbsences,
            trials: myTrials,
            firstStarDates: [...firstStarBy.entries()].filter(([, v]) => v.studentId === student.id).map(([d]) => d),
            oathKeptDates: [
                ...inventory.filter((i) => i?.source === 'ember_oath').map((i) => sealDateKey(i.acquiredAt)),
                ...oaths.filter((o) => o.studentId === student.id && o.keptAt).map((o) => sealDateKey(o.keptAt)),
            ].filter(Boolean),
            championDates: [
                ...(champions.get(student.id) || []),
                ...inventory.filter((i) => i?.source === 'quiz_prize' || i?.source === 'quiz_treasure').map((i) => sealDateKey(i.acquiredAt)),
            ].filter(Boolean),
            heroClass: student.heroClass || '',
            heroLevel: Number(score.heroLevel) || 0,
            guildId: student.guildId || '',
            heroOfDayWins: Number(score.heroOfDayWins) || 0,
            familiarAlive: score.familiar?.state === 'alive',
            inventoryCount: inventory.filter((i) => i && i.name).length,
            occasions,
            joinedMonth,
            trackedFrom,
            openingDay,
            young,
        };
        const catchingUp = !stored.backfilledAt;
        const proven = evaluateSeals(ids, facts);
        const presses = newSealPresses(ids, proven, earned, { today, found: now, catchingUp });
        Object.keys(presses).forEach((id) => { if (written.has(`${student.id}|${id}`)) delete presses[id]; });

        const patch = {};
        const bookChanged = JSON.stringify(stored.book || {}) !== JSON.stringify(book);
        if (bookChanged || stored.v !== HERO_SEALS_VERSION) {
            patch['heroSeals.book'] = book;
            patch['heroSeals.v'] = HERO_SEALS_VERSION;
        }
        if (catchingUp && records.yearAwards) patch['heroSeals.backfilledAt'] = now;
        else if (catchingUp && joined && joined >= monthStartKey) patch['heroSeals.backfilledAt'] = now;
        if (stored.since !== trackedFrom && (records.yearAwards || !stored.since)) patch['heroSeals.since'] = trackedFrom;
        // Version 1 pressed attendance seals for lessons before the class used the Quest: take those back.
        if ((Number(stored.v) || 0) < 2 && records.yearAwards) {
            const still = evaluateSeals(ATTENDANCE_SEALS, facts);
            ATTENDANCE_SEALS.forEach((id) => { if (earned[id] && !still[id]) patch[`heroSeals.earned.${id}`] = deleteField(); });
        }
        Object.entries(presses).forEach(([id, press]) => { patch[`heroSeals.earned.${id}`] = press; });
        if (!Object.keys(patch).length) continue;
        Object.keys(presses).forEach((id) => written.add(`${student.id}|${id}`));
        writes.push(updateDoc(doc(db, `${ROOT}/student_scores`, student.id), patch).catch((error) => {
            Object.keys(presses).forEach((id) => written.delete(`${student.id}|${id}`));
            console.warn('Hero Seals: could not press for a hero', error?.code || error?.message);
        }));
    }
    await Promise.all(writes);
    if (unsettled) {
        clearTimeout(recheckTimer);
        recheckTimer = setTimeout(() => { requested.add(classId); schedule(0); }, AWARD_SETTLE_MS + 2000);
    }
}

function activeClassIds() {
    const own = ownClasses();
    const ids = new Set();
    const selected = state.get('globalSelectedClassId');
    if (selected && own.some((c) => c.id === selected)) ids.add(selected);
    const today = todayKey();
    const touched = (rows, dateOf) => (rows || []).forEach((r) => { if (r?.classId && sealDateKey(dateOf(r)) === today) ids.add(r.classId); });
    touched(state.get('allAwardLogs'), (r) => r.date || r.createdAt);
    touched(state.get('allAttendanceRecords'), (r) => r.date);
    touched(state.get('allWrittenScores'), (r) => r.date);
    requested.forEach((id) => ids.add(id));
    requested.clear();
    return [...ids].filter((id) => own.some((c) => c.id === id));
}

function runClass(classId, options = {}) {
    if (inflight.has(classId)) return inflight.get(classId);
    const p = evaluateClass(classId, options)
        .catch((error) => console.warn('Hero Seals: class check failed', error?.code || error?.message || error))
        .finally(() => { inflight.delete(classId); refreshNotice(); });
    inflight.set(classId, p);
    return p;
}

async function evaluate() {
    timer = null;
    if (!isTeacher()) return;
    if (!armedAt) armedAt = Date.now();
    if (Date.now() - armedAt < SETTLE_MS) { schedule(SETTLE_MS); return; }
    for (const classId of activeClassIds()) {
        // One class at a time keeps weak laptops calm.
        await runClass(classId);
    }
    refreshNotice();
}

function schedule(delay = DEBOUNCE_MS) {
    clearTimeout(timer);
    timer = setTimeout(evaluate, delay);
}

/** Starts watching (once per page). Safe to call before sign-in. */
export function startHeroSeals() {
    if (started) return;
    started = true;
    state.subscribe(['allAwardLogs', 'allAttendanceRecords', 'allWrittenScores', 'globalSelectedClassId', 'allSchoolClasses'], () => schedule());
    state.subscribe(['allStudentScores', 'currentUserId'], () => refreshNotice());
    state.subscribe('allAttendanceRecords', () => classCache.forEach((cache) => { cache.absencesStale = true; }));
    schedule();
}

/** Makes sure a class's Seal Books are read and up to date (the Folio and Trophy Room call this). */
export function ensureHeroSealsForClass(classId) {
    if (!classId || !isTeacher()) return Promise.resolve();
    return runClass(classId);
}

/** A Quiz Champion was just named: read the class's quiz history again and look. */
export function noteQuizChampion(classId) {
    if (!classId) return;
    setTimeout(() => runClass(classId, { refreshQuiz: true }), 1500);
}

// ─── The notice ──────────────────────────────────────────────────────────────

function readSeen() {
    try { return Number(localStorage.getItem(SEEN_KEY(uid()))) || 0; } catch { return 0; }
}

function writeSeen(value) {
    try { localStorage.setItem(SEEN_KEY(uid()), String(value)); } catch { /* private mode: the notice simply returns next time */ }
}

function classLabel(classId) {
    const c = findClass(classId);
    return [c?.logo, c?.name].filter(Boolean).join(' ');
}

function pendingGroups() {
    if (!isTeacher()) return [];
    const own = new Set(ownClasses().map((c) => c.id));
    const scores = new Map((state.get('allStudentScores') || []).map((s) => [s.id, s]));
    const rows = (state.get('allStudents') || [])
        .filter((s) => own.has(s.classId) && scores.get(s.id)?.heroSeals?.earned)
        .map((s) => ({ student: s, heroSeals: scores.get(s.id).heroSeals, classLabel: classLabel(s.classId) }));
    return collectNewSeals(rows, readSeen());
}

const TOLD_KEY = (uid) => `gcq.heroSeals.told.${uid}`;

let told = 0;

function readTold() {
    try { return Number(localStorage.getItem(TOLD_KEY(uid()))) || told; } catch { return told; }
}

function writeTold(value) {
    told = value;
    try { localStorage.setItem(TOLD_KEY(uid()), String(value)); } catch { /* private mode: kept for this session */ }
}

let herald = null;

/**
 * New seals ride the app's ordinary notification: one herald that names who pressed
 * what and opens the summary. It covers every seal not yet looked at, and appears again
 * only when a newer seal is pressed.
 */
function refreshNotice() {
    if (!started) return;
    const groups = pendingGroups();
    if (!groups.length) { hideNotice(); return; }
    const newest = groups.reduce((m, g) => Math.max(m, g.newest), 0);
    if (newest <= readTold()) return;
    writeTold(newest);
    const { title, sub } = heroSealsNoticeCopy(groups);
    herald = notify({
        key: 'hero-seals',
        type: 'praise',
        title: 'Hero Seals',
        icon: sealArtHtml(groups[0].seals[0], { size: 34, className: 'hs-herald-seal' }),
        message: `${escSeal(title)}<span class="hs-herald-sub">${escSeal(sub)}</span>`,
        duration: 10000,
        action: { label: 'See who', icon: 'fa-scroll', onClick: () => openHeroSealsSummary() },
    });
}

function hideNotice() {
    herald?.dismiss();
    herald = null;
}

function markAllSeen() {
    const groups = pendingGroups();
    const newest = groups.reduce((m, g) => Math.max(m, g.newest), readSeen());
    writeSeen(Math.max(newest, readSeen()));
    if (newest > readTold()) writeTold(newest);
}

// ─── The summary ─────────────────────────────────────────────────────────────

let summaryEl = null;

function closeSummary() {
    if (!summaryEl) return;
    const el = summaryEl;
    summaryEl = null;
    el.classList.remove('is-in');
    document.removeEventListener('keydown', onSummaryKey, true);
    setTimeout(() => el.remove(), 260);
}

function onSummaryKey(e) {
    if (e.key === 'Escape' && summaryEl) { e.stopPropagation(); closeSummary(); }
}

export { heroSealsSummaryHtml };

/** Opens the summary of every unseen seal and marks them seen. */
export function openHeroSealsSummary() {
    const groups = pendingGroups();
    if (!groups.length) { hideNotice(); return; }
    markAllSeen();
    closeSummary();
    summaryEl = document.createElement('div');
    summaryEl.className = `hs-sum${LITE || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? ' hs--still' : ''}`;
    summaryEl.innerHTML = `<div class="hs-sum__bg" data-hs-close></div>${heroSealsSummaryHtml(groups, { lite: LITE })}`;
    summaryEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-hs-close]')) { closeSummary(); return; }
        const who = e.target.closest('[data-hs-folio]');
        if (who) {
            const id = who.dataset.hsFolio;
            closeSummary();
            import('../ui/modals/studentAnalytics.js').then((m) => m.openStudentAnalyticsModal(id, null, { tab: 'seals' })).catch(() => {});
        }
    });
    document.body.appendChild(summaryEl);
    document.addEventListener('keydown', onSummaryKey, true);
    requestAnimationFrame(() => {
        summaryEl?.classList.add('is-in');
        summaryEl?.querySelector('.hs-sum__done')?.focus({ preventScroll: true });
    });
    import('../audio.js').then(({ playSound }) => playSound('magic_chime')).catch(() => {});
}
