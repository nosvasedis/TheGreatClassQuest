// ui/modals/realmRaid.js — the Raid Hall and the victory moment (Realm Raid).
// Opens over any screen, the projector included. Follows the live raid view from
// features/realmRaid.js: new stars fly from a class's banner into its shard while the hall is open.
// Markup is in realmRaidView.mjs; rules in features/realmRaidCore.mjs.
import '../../styles/realm_raid.css';
import * as state from '../../state.js';
import { playSound } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { getRaidView, subscribeRaid, revealRaidHero, currentRaid, buildRaidView, ensureRaidLogs, raidViewById, raidOptions } from '../../features/realmRaid.js';
import { owedRaidRewards, raidsOfYear, raidOn, raidOutcome } from '../../features/realmRaidCore.mjs';
import { hallHtml, howItWorksHtml, victoryHtml } from './realmRaidView.mjs';
import { faceHtml } from './classTools.js';

const HALL_ID = 'realm-raid-hall';
const VICTORY_ID = 'realm-raid-victory';
const MAX_BOLTS = 8;

let hall = null; // { root, unsub, focusId, last, revealing, heroCard, onKey }

function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function isLite() {
    return detectLowPowerTier() || reducedMotion();
}

/** The class the hall features: the header's class, else the teacher's first class in the raid. */
function pickFocus(view) {
    const selected = state.get('globalSelectedClassId');
    if (selected && view.rows.some((r) => r.classId === selected)) return selected;
    return view.rows.find((r) => r.own && r.share > 0)?.classId
        || view.rows.find((r) => r.share > 0)?.classId || '';
}

function heroCardFor(view, classId) {
    const row = view.rows.find((r) => r.classId === classId);
    const hero = row?.receipt?.hero;
    if (!hero) return null;
    if (hero.none) return { none: true };
    const student = (state.get('allStudents') || []).find((s) => s.id === hero.studentId);
    return {
        ...hero,
        name: student?.name || 'Our hero',
        faceHtml: faceHtml({ id: hero.studentId, name: student?.name, avatar: student?.avatar }, 'ct-face rr-hero__face')
    };
}

function canRevealFor(view, classId) {
    const row = view.rows.find((r) => r.classId === classId);
    if (!row?.own || state.get('currentUserRole') !== 'teacher') return false;
    return owedRaidRewards({ status: view.status, classRow: row, receipt: row.receipt, raid: view.raid, today: new Date() }).heroReady;
}

/** Short names that stay unique inside one class: "Maria", or "Maria P." when two share it. */
export function shortNames(students = []) {
    const first = (s) => String(s?.name || '').trim().split(/\s+/)[0] || 'Hero';
    const counts = {};
    students.forEach((s) => { counts[first(s)] = (counts[first(s)] || 0) + 1; });
    return students.map((s) => {
        const parts = String(s?.name || '').trim().split(/\s+/);
        const name = counts[first(s)] > 1 && parts[1] ? `${first(s)} ${parts[1][0]}.` : first(s);
        return { id: s.id, name, fullName: s.name || name };
    });
}

/** Every hero of a class, with the stars they sent at the shield this raid. */
function rosterFor(view, classId) {
    if (!classId) return [];
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const byHero = view.tally?.byHero || {};
    return shortNames(students).map((h) => ({ ...h, stars: Number(byHero[h.id]?.stars) || 0 }));
}

/** The year's three raids for the top bar: won, held, now, or still to come. */
function yearFor(view) {
    const classes = state.get('allSchoolClasses') || [];
    const now = new Date();
    return raidsOfYear(view.raid.start, raidOptions()).map((window) => {
        const raid = raidOn(window, now);
        let stateWord = 'soon';
        if (window.raidId === view.raid.raidId && raid.phase !== 'herald') {
            stateWord = raid.phase === 'active' ? 'live' : raidOutcome({ status: view.status });
        } else if (raid.phase === 'active') stateWord = 'live';
        else if (raid.phase !== 'herald') stateWord = raidOutcome({ receipts: classes.map((c) => c.realmRaids?.[window.raidId]) });
        return { raidId: window.raidId, season: window.season, start: window.start, state: stateWord };
    });
}

function render(view) {
    if (!hall || !view) return;
    const focusId = hall.focusId || pickFocus(view);
    hall.focusId = focusId;
    const heroCard = hall.heroCard || heroCardFor(view, focusId);
    hall.root.innerHTML = hallHtml(view, {
        focusId,
        heroCard,
        canReveal: !heroCard && !hall.revealing && canRevealFor(view, focusId),
        lite: hall.lite,
        roster: hall.roster ? hall.roster(view, focusId) : rosterFor(view, focusId),
        year: hall.year ? hall.year(view) : yearFor(view)
    });
    if (hall.last && !hall.lite) strike(hall.last, view);
    hall.last = view;
}

/** Stars that arrived since the last render fly from each class's banner into its shard. */
function strike(before, after) {
    const prev = new Map(before.rows.map((r) => [r.classId, r.stars]));
    const gains = after.rows
        .map((r) => ({ id: r.classId, gain: r.stars - (prev.get(r.classId) || 0) }))
        .filter((g) => g.gain > 0)
        .slice(0, MAX_BOLTS);
    if (!gains.length) return;
    const root = hall.root;
    const host = root.querySelector('.rr-hall');
    const box = host.getBoundingClientRect();
    gains.forEach(({ id }, i) => {
        const from = root.querySelector(`[data-banner="${CSS.escape(id)}"]`);
        const to = root.querySelector(`[data-shard="${CSS.escape(id)}"]`) || root.querySelector('.rr-arena__shield');
        if (!from || !to) return;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const bolt = document.createElement('span');
        bolt.className = 'rr-bolt';
        bolt.innerHTML = '<i class="fas fa-star" aria-hidden="true"></i>';
        bolt.style.left = `${a.left + a.width / 2 - box.left}px`;
        bolt.style.top = `${a.top + a.height / 2 - box.top}px`;
        host.appendChild(bolt);
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        const anim = bolt.animate([
            { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.15 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 1, offset: 0.9 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.8)`, opacity: 0 }
        ], { duration: 1100, delay: i * 140, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
        anim.onfinish = () => {
            bolt.remove();
            to.classList?.add('is-hit');
            setTimeout(() => to.classList?.remove('is-hit'), 600);
        };
    });
    playSound('star3');
}

function onClick(event) {
    const target = event.target;
    if (target.closest('[data-rr-close]')) { closeRaidHall(); return; }
    if (target.closest('[data-rr-help]')) { openHelp(); return; }
    if (target.closest('[data-rr-help-close]') || target.classList.contains('rr-help')) { hall.root.querySelector('.rr-help')?.remove(); return; }
    const other = target.closest('[data-rr-raid]');
    if (other) {
        if (other.dataset.rrRaid !== hall.view()?.raid?.raidId) openRaidHall({ raidId: other.dataset.rrRaid, focusId: hall.focusId, keepSound: true });
        return;
    }
    const banner = target.closest('[data-banner]');
    if (banner) {
        hall.focusId = banner.dataset.banner;
        hall.heroCard = null;
        render(hall.view());
        return;
    }
    if (target.closest('[data-rr-reveal]')) revealHero();
}

function openHelp() {
    const view = hall.view();
    hall.root.querySelector('.rr-help')?.remove();
    hall.root.querySelector('.rr-hall')?.insertAdjacentHTML('beforeend', howItWorksHtml(view));
}

async function revealHero() {
    const view = hall.view();
    const classId = hall.focusId;
    if (!view || hall.revealing) return;
    hall.revealing = true;
    render(view);
    try {
        await revealRaidHero(classId, view);
        // The receipt arrives through the class listener; show it now from the saved one.
        const fresh = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
        const hero = fresh?.realmRaids?.[view.raid.raidId]?.hero;
        if (hero) {
            const row = view.rows.find((r) => r.classId === classId);
            if (row) row.receipt = { ...(row.receipt || {}), hero };
        }
        hall.heroCard = heroCardFor(view, classId);
        playSound('hero_fanfare');
    } catch (error) {
        console.warn('Raid Hero reveal failed:', error);
        import('../effects.js').then(({ showToast }) => showToast('The Raid Hero could not be chosen. Try again in a moment.', 'error'));
    } finally {
        hall.revealing = false;
        render(hall.view());
        hall.root.querySelector('.rr-hero')?.classList.add('is-new');
    }
}

/**
 * Opens the Raid Hall on the live raid. `view` (and `focusId`) let the preview page open it on a
 * made-up raid. Returns false when no raid is near.
 */
export async function openRaidHall({ view: given = null, focusId = '', raidId = '', keepSound = false, roster = null, year = null } = {}) {
    // A raid other than the live one (from the Calendar or the year's medallions): a still view.
    if (!given && raidId && raidId !== (getRaidView()?.raid?.raidId || currentRaid()?.raidId)) {
        given = await raidViewById(raidId);
        if (!given) return false;
    }
    let source = () => given || getRaidView();
    if (!source()) {
        const raid = currentRaid();
        if (!raid) {
            import('../effects.js').then(({ showToast }) => showToast('No Realm Raid this week. The Guardian visits before Christmas, before Clean Monday and in the last school week.', 'info', 6000));
            return false;
        }
        await ensureRaidLogs(raid);
        const built = buildRaidView(raid);
        source = () => given || getRaidView() || built;
    }
    closeRaidHall({ instant: keepSound });
    const root = document.createElement('div');
    root.id = HALL_ID;
    root.className = 'rr-host';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'rr-hall-title');
    document.body.appendChild(root);
    hall = { root, focusId, last: null, revealing: false, heroCard: null, lite: isLite(), view: source, roster, year };
    hall.onKey = (event) => {
        if (event.key !== 'Escape') return;
        if (root.querySelector('.rr-help')) root.querySelector('.rr-help').remove();
        else closeRaidHall();
    };
    document.addEventListener('keydown', hall.onKey);
    root.addEventListener('click', onClick);
    hall.unsub = given ? () => {} : subscribeRaid((view) => { if (view) render(view); });
    render(source());
    if (keepSound) root.classList.add('is-open', 'is-swap');
    else requestAnimationFrame(() => root.classList.add('is-open'));
    playSound(keepSound ? 'star1' : 'magic_chime');
    return true;
}

export function closeRaidHall({ instant = false } = {}) {
    if (!hall) return;
    hall.unsub?.();
    document.removeEventListener('keydown', hall.onKey);
    const { root } = hall;
    hall = null;
    if (instant) { root.remove(); return; }
    root.classList.remove('is-open');
    setTimeout(() => root.remove(), 260);
}

export function isRaidHallOpen() {
    return Boolean(hall);
}

/** The shield breaks: a short full-screen moment, then the spoils. Plays once per device. */
export function playRaidVictory(view, { legendary = false, autoCloseMs = 22000 } = {}) {
    document.getElementById(VICTORY_ID)?.remove();
    const host = document.createElement('div');
    host.id = VICTORY_ID;
    host.className = 'rr-host rr-host--victory';
    host.innerHTML = victoryHtml(view, { legendary, lite: isLite() });
    document.body.appendChild(host);
    requestAnimationFrame(() => host.classList.add('is-open'));
    setTimeout(() => playSound('hero_fanfare'), legendary ? 200 : 1300);
    let closer = null;
    const close = () => {
        clearTimeout(closer);
        document.removeEventListener('keydown', onKey);
        host.classList.remove('is-open');
        setTimeout(() => host.remove(), 300);
    };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    host.addEventListener('click', (event) => {
        if (event.target.closest('[data-rr-victory-close]')) close();
        if (event.target.closest('[data-rr-open-hall]')) { close(); openRaidHall(); }
    });
    if (autoCloseMs) closer = setTimeout(close, autoCloseMs);
    return close;
}
