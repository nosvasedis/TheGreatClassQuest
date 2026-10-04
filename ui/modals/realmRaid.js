// ui/modals/realmRaid.js — the Raid Hall and the victory moment (Realm Raid).
// Opens over any screen, the projector included. Follows the live raid view from
// features/realmRaid.js: new stars fly from a class's banner into its shard while the hall is open.
// Markup is in realmRaidView.mjs; rules in features/realmRaidCore.mjs.
import '../../styles/realm_raid.css';
import * as state from '../../state.js';
import { playSound } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { getRaidView, subscribeRaid, revealRaidHero, currentRaid, buildRaidView, ensureRaidLogs } from '../../features/realmRaid.js';
import { owedRaidRewards } from '../../features/realmRaidCore.mjs';
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
    return view.rows.find((r) => r.own && r.share > 0)?.classId || '';
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

function render(view) {
    if (!hall || !view) return;
    const focusId = hall.focusId || pickFocus(view);
    hall.focusId = focusId;
    const heroCard = hall.heroCard || heroCardFor(view, focusId);
    const scroll = hall.root.querySelector('.rr-alliance__list')?.scrollLeft || 0;
    hall.root.innerHTML = hallHtml(view, {
        focusId,
        heroCard,
        canReveal: !heroCard && !hall.revealing && canRevealFor(view, focusId),
        lite: hall.lite
    });
    const list = hall.root.querySelector('.rr-alliance__list');
    if (list) list.scrollLeft = scroll;
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
export async function openRaidHall({ view: given = null, focusId = '' } = {}) {
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
    closeRaidHall();
    const root = document.createElement('div');
    root.id = HALL_ID;
    root.className = 'rr-host';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'rr-hall-title');
    document.body.appendChild(root);
    hall = { root, focusId, last: null, revealing: false, heroCard: null, lite: isLite(), view: source };
    hall.onKey = (event) => {
        if (event.key !== 'Escape') return;
        if (root.querySelector('.rr-help')) root.querySelector('.rr-help').remove();
        else closeRaidHall();
    };
    document.addEventListener('keydown', hall.onKey);
    root.addEventListener('click', onClick);
    hall.unsub = given ? () => {} : subscribeRaid((view) => { if (view) render(view); });
    render(source());
    requestAnimationFrame(() => root.classList.add('is-open'));
    playSound('magic_chime');
    return true;
}

export function closeRaidHall() {
    if (!hall) return;
    hall.unsub?.();
    document.removeEventListener('keydown', hall.onKey);
    const { root } = hall;
    hall = null;
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
