// /features/realmMoments.js — Team Quest realm moments (watcher + banner).
// Watches the teacher's own classes. When one reaches the Silver Peaks, the Golden Citadel or
// the Crystal Realm for the first time this month, it stamps the class's Map Journal and plays
// a short banner over whatever is on screen (the projector included). Realms found already
// reached when the app opens are stamped quietly (`late`), so the diary never claims them.
// Rules live in realmMomentsCore.mjs; the banner's CSS loads with this chunk only.
import '../styles/realm_moments.css';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, updateDoc } from '../firebase.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { buildRealmStamp, getRealmStop, realmMonthKey, unstampedRealms } from './realmMomentsCore.mjs';

const CLASSES_PATH = 'artifacts/great-class-quest/public/data/classes';
const SETTLE_MS = 6000;
const DEBOUNCE_MS = 1200;
const BANNER_MS = 3200;

const BADGES = {
    silver: new URL('../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    gold: new URL('../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    crystal: new URL('../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href
};

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
        updateDoc(doc(db, CLASSES_PATH, classData.id), patch).then(() => {
            if (!live.length) return;
            queue.push({ classData, realmId: live[live.length - 1] });
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

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function realmBannerHtml(classData, realmId, { lite = false } = {}) {
    const stop = getRealmStop(realmId);
    if (!stop) return '';
    const sparks = lite ? '' : Array.from({ length: 8 }, (_, i) => `<i class="rm-banner__spark" style="--i:${i}"></i>`).join('');
    return `
        <div class="rm-banner rm-banner--${stop.id}${lite ? ' rm-banner--lite' : ''}" role="status" aria-live="polite">
            <span class="rm-banner__rays" aria-hidden="true"></span>
            <span class="rm-banner__ribbon" aria-hidden="true"></span>
            <span class="rm-banner__badge-wrap" aria-hidden="true">
                <img class="rm-banner__badge" src="${BADGES[stop.id]}" alt="" draggable="false" decoding="async">
                ${sparks}
            </span>
            <span class="rm-banner__copy">
                <small><span class="rm-banner__logo">${esc(classData?.logo || '📚')}</span>${esc(classData?.name || 'Our class')} has reached</small>
                <strong class="font-title">${esc(stop.label)}</strong>
                <em>${esc(stop.cheer)}</em>
            </span>
            <span class="rm-banner__stamp" aria-hidden="true"><b>${stop.icon}</b><span>Map Journal</span></span>
        </div>`;
}

/** Shows one banner now (also used by the preview page). Resolves when it has gone. */
export function showRealmBanner(classData, realmId) {
    return new Promise((resolve) => {
        const lite = detectLowPowerTier();
        const host = document.createElement('div');
        host.className = 'rm-host';
        host.innerHTML = realmBannerHtml(classData, realmId, { lite });
        document.body.appendChild(host);
        import('../audio.js').then(({ playSound }) => playSound(realmId === 'crystal' ? 'hero_fanfare' : 'star3')).catch(() => {});
        setTimeout(() => { host.remove(); resolve(); }, BANNER_MS);
    });
}

async function playNext() {
    if (showing || !queue.length) return;
    showing = true;
    const { classData, realmId } = queue.shift();
    try { await showRealmBanner(classData, realmId); } finally {
        showing = false;
        if (queue.length) setTimeout(playNext, 250);
    }
}
