// Gathers the live facts behind Home's Chronicle pages (features/homeChroniclePages.mjs)
// for one class, from state the app already holds. Shared by desktop and phone Home.
// The only extra read is the year's Ember Oaths listener, started once and off the
// critical path (the same one the Campfire's "N ready" badges use).
import '../styles/home_chronicle_pages.css';
import { quietly } from '../utils/runtimeMetrics.js';
import * as state from '../state.js';
import { canUseFeature } from '../utils/subscription.js';
import { getLocalIsoDateString } from '../utils.js';
import { evaluateOathEvidence } from './emberOathEvidence.mjs';
import { SEALS, isAcademicSeal } from './heroSealsCore.mjs';
import { getActiveFestival, getFestivalWindow, SHOP_FESTIVAL_IDS } from '../utils/shopCalendar.js';
import {
    buildTrainingPage, buildStarfallPage, buildOathsPage, buildSealsPage, buildDragonPage,
    buildFestivalPage, pickLowerPages
} from './homeChroniclePages.mjs';

function classById(classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

let oathsRequested = false;
function ensureOaths() {
    if (oathsRequested || state.get('hasLoadedEmberOaths') || state.get('currentUserRole') !== 'teacher') return;
    oathsRequested = true;
    setTimeout(() => import('../db/actions/emberOaths.js').then((m) => m.ensureEmberOathsListener())
        .catch(quietly('features/homeChronicleContext.js')), 1200);
}

function sealPresses(students, scores) {
    const byId = new Map(scores.map((s) => [s.id, s]));
    const presses = [];
    students.forEach((student) => {
        const earned = byId.get(student.id)?.heroSeals?.earned || {};
        Object.entries(earned).forEach(([id, press]) => {
            const seal = SEALS[id];
            // Same rule as the class diary and the projector: nothing about marks or an absence.
            if (!seal || press?.late || isAcademicSeal(id) || id === 'hearth_return') return;
            const at = Number(press?.found) || toDate(press?.date)?.getTime() || 0;
            if (at) presses.push({ name: student.name, seal, at });
        });
    });
    return presses;
}

function festivalFacts(now) {
    const ymd = (o) => new Date(o.year, o.month - 1, o.day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = (o) => Math.round((ymd(o) - today) / 86400000);
    const active = getActiveFestival(now);
    if (active) return { active, feastDays: days(active.feast) };
    const next = SHOP_FESTIVAL_IDS
        .flatMap((id) => [now.getFullYear(), now.getFullYear() + 1].map((year) => getFestivalWindow(id, year)))
        .filter(Boolean)
        .map((w) => ({ ...w, days: days(w.start) }))
        .filter((w) => w.days > 0)
        .sort((a, b) => a.days - b.days)[0];
    return { next: next || null };
}

/**
 * The Training Grounds page and the three bottom pages for one class.
 * Every builder is guarded: one bad record never costs Home its Chronicle.
 */
export function getChronicleExtraPages(classId, now = new Date()) {
    const cls = classById(classId);
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId && s.enrollmentStatus !== 'inactive');
    const scores = state.get('allStudentScores') || [];
    const safe = (fn) => { try { return fn(); } catch (e) { console.warn('Chronicle page skipped:', e); return null; } };

    const training = safe(() => buildTrainingPage({
        story: state.get('currentStoryData')?.[classId] || null,
        games: cls?.trainingGrounds || {},
        now
    }));

    const starfall = canUseFeature('scholarScroll') ? safe(() => buildStarfallPage({
        waiting: cls?.pendingStarfalls || [],
        names: Object.fromEntries(students.map((s) => [s.id, s.name]))
    })) : null;

    let oaths = null;
    if (canUseFeature('heroCampfire')) {
        ensureOaths();
        oaths = safe(() => {
            const mine = (state.get('allEmberOaths') || []).filter((o) => o.classId === classId);
            const facts = { awards: state.get('allAwardLogs') || [], writtenScores: state.get('allWrittenScores') || [], today: getLocalIsoDateString() };
            const readyIds = mine.filter((o) => o.status === 'active' && evaluateOathEvidence(o, facts).ready).map((o) => o.id);
            return buildOathsPage({ oaths: mine, readyIds, now });
        });
    }

    const seals = safe(() => buildSealsPage({ presses: sealPresses(students, scores), now }));

    const dragon = safe(() => buildDragonPage({
        sessions: (state.get('allQuestBounties') || [])
            .filter((b) => b.classId === classId && b.source === 'quiet_dragon' && b.quietDragon)
            .map((b) => ({ at: b.claimedAt || b.createdAt || b.deadline, minutes: b.quietDragon.minutes, reward: b.reward || '' })),
        now
    }));

    const festival = safe(() => buildFestivalPage(festivalFacts(now)));

    return { training, lower: pickLowerPages({ starfall, oaths, seals, dragon, festival }) };
}
