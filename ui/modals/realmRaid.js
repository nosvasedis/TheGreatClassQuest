// ui/modals/realmRaid.js — the Raid Hall (a JRPG boss battle) and the victory moment (Realm Raid).
// Opens over any screen, the projector included. Follows the live raid view from
// features/realmRaid.js: when new stars arrive, each class casts its league's skill at the shield.
// Markup is in realmRaidView.mjs; rules in features/realmRaidCore.mjs; words and jobs in
// features/realmRaidBattle.mjs; music and sounds in features/realmRaidAudio.js.
import '../../styles/realm_raid.css';
import * as state from '../../state.js';
import { playSound } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { getRaidView, subscribeRaid, revealRaidHero, currentRaid, buildRaidView, ensureRaidLogs, raidViewById, raidOptions } from '../../features/realmRaid.js';
import { owedRaidRewards, raidsOfYear, raidOn, raidOutcome } from '../../features/realmRaidCore.mjs';
import { hallHtml, howItWorksHtml, victoryHtml } from './realmRaidView.mjs';
import { leagueJob, isBigHit, caption } from '../../features/realmRaidBattle.mjs';
import { startRaidMusic, stopRaidMusic, setRaidMusicMode, raidMusicOn, setRaidMusicOn, playRaidSfx } from '../../features/realmRaidAudio.js';
import { faceHtml } from './classTools.js';
import { partyFormation } from '../../features/realmRaidParty.mjs';

const HALL_ID = 'realm-raid-hall';
const VICTORY_ID = 'realm-raid-victory';
const MAX_BOLTS = 8;

let hall = null; // { root, unsub, focusId, last, revealing, heroCard, onKey, onResize, intro }

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
    const intro = hall.intro;
    hall.intro = false;
    hall.root.innerHTML = hallHtml(view, {
        focusId,
        heroCard,
        canReveal: !heroCard && !hall.revealing && canRevealFor(view, focusId),
        lite: hall.lite,
        roster: hall.roster ? hall.roster(view, focusId) : rosterFor(view, focusId),
        year: hall.year ? hall.year(view) : yearFor(view),
        now: hall.now ? hall.now() : new Date(),
        intro,
        musicOn: raidMusicOn()
    });
    if (hall.last) {
        animateHp(hall.last, view);
        strike(hall.last, view, { lite: hall.lite });
    }
    // The "Round N" banner plays once per round, not on every new star.
    const banner = hall.root.querySelector('.rr-fieldbanner.is-round');
    if (banner) {
        const seen = `${view.raid.raidId}:${banner.textContent}`;
        if (hall.roundSeen === seen) banner.remove();
        hall.roundSeen = seen;
    }
    layoutParty();
    fitAlliance();
    if (intro) setTimeout(() => hall?.root.querySelector('.rr-intro')?.remove(), 2600);
    syncMusic(view);
    hall.last = view;
}

/** The boss HP bar drops from where it was (the white "ghost" follows a moment later). */
function animateHp(before, after) {
    const was = before.status.hp ? Math.max(0, before.status.hp - before.status.dealt) / before.status.hp : 1;
    const now = after.status.hp ? Math.max(0, after.status.hp - after.status.dealt) / after.status.hp : 1;
    if (Math.abs(was - now) < 0.0001) return;
    const bars = hall.root.querySelectorAll('.rr-hp__fill, .rr-hp__ghost');
    bars.forEach((bar) => {
        bar.style.transition = 'none';
        bar.style.setProperty('--p', was.toFixed(4));
    });
    void hall.root.offsetWidth;
    requestAnimationFrame(() => bars.forEach((bar) => {
        bar.style.transition = '';
        bar.style.setProperty('--p', now.toFixed(4));
    }));
}

/**
 * The party fits its real box: the view lays the classes out for a wide field; here the formation
 * is worked out again for the field's true shape (a phone's field is tall and narrow), and names
 * hide when the heroes stand too small to read them.
 */
function layoutParty() {
    const party = hall?.root.querySelector('.rr-party');
    if (!party) return;
    const box = party.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const units = [...party.querySelectorAll('.rr-unit')];
    const spots = partyFormation(units.length, { aspect: box.width / box.height });
    units.forEach((unit, i) => {
        const spot = spots[i];
        unit.style.left = `${spot.x}%`;
        unit.style.top = `${spot.y}%`;
        unit.style.setProperty('--h', spot.h);
        unit.style.zIndex = spot.z;
    });
    party.classList.toggle('is-tiny', (spots[0]?.h || 0) * box.height / 100 < 70);
}

/** When the alliance is longer than its window, it rolls slowly up and back (not on the lite tier). */
function fitAlliance() {
    const win = hall?.root.querySelector('.rr-allywin');
    if (!win || hall.lite) return;
    requestAnimationFrame(() => {
        const box = win.querySelector('.rr-ally__scroll');
        const track = win.querySelector('.rr-ally__track');
        if (!box || !track) return;
        const over = track.scrollHeight - box.clientHeight;
        if (over > 8 && getComputedStyle(box).overflowY !== 'visible') {
            win.style.setProperty('--rr-roll', `${-over}px`);
            win.style.setProperty('--rr-roll-t', `${Math.max(14, over / 14)}s`);
            win.classList.add('is-auto');
        }
    });
}

/** The music follows the fight: calm before and after, the battle theme, a bright one once broken. */
function syncMusic(view) {
    const { raid, status } = view;
    const mode = raid.phase === 'active' ? (status.broken ? 'triumph' : 'battle') : (raid.phase === 'herald' ? 'calm' : (status.broken ? 'triumph' : 'calm'));
    if (hall.musicSeason === raid.season.id) { setRaidMusicMode(mode); return; }
    hall.musicSeason = raid.season.id;
    startRaidMusic(raid.season.id, mode, { lite: hall.lite });
}

/**
 * Stars that arrived since the last render: each class that struck casts its league's skill. The
 * skill flies from its row in the alliance to its shard, the boss flinches, the number pops.
 */
function strike(before, after, { lite = false } = {}) {
    const prev = new Map(before.rows.map((r) => [r.classId, r.stars]));
    const gains = after.rows
        .map((r) => ({ id: r.classId, gain: r.stars - (prev.get(r.classId) || 0) }))
        .filter((g) => g.gain > 0)
        .slice(0, MAX_BOLTS);
    if (!gains.length) return;
    const root = hall.root;
    const host = root.querySelector('.rr-hall');
    const box = host.getBoundingClientRect();
    const arena = root.querySelector('.rr-arena');
    const layer = root.querySelector('.rr-dmg-layer');
    const flash = root.querySelector('.rr-flash');
    const byId = new Map(after.rows.map((r) => [r.classId, r]));
    const travel = lite ? 0 : 650;
    const tier = ['young', 'senior'].find((t) => host.classList.contains(`rr-tier--${t}`)) || 'mid';
    const cast = root.querySelector('.rr-cast');
    const gap = lite ? 500 : 900;
    gains.forEach(({ id, gain }, i) => {
        const row = byId.get(id);
        const job = leagueJob(row?.league);
        const from = root.querySelector(`.rr-unit[data-banner="${CSS.escape(id)}"]`) || root.querySelector(`.rr-ally__row[data-banner="${CSS.escape(id)}"]`);
        const to = root.querySelector(`[data-shard="${CSS.escape(id)}"]`) || root.querySelector('.rr-stage__shield');
        const big = isBigHit(gain, row?.share ? row.share / 2 : 0);
        const start = i * gap;
        setTimeout(() => {
            if (!from?.isConnected) return;
            from.classList.remove('is-acting');
            void from.offsetWidth;
            from.classList.add('is-acting');
            if (cast) {
                cast.innerHTML = '';
                const line = document.createElement('div');
                line.className = 'rr-cast__line';
                line.style.setProperty('--job', job.color);
                const icon = document.createElement('span');
                icon.textContent = job.icon;
                const name = document.createElement('small');
                name.textContent = row?.name || '';
                line.append(icon, document.createTextNode(` ${job.skill}! `), name);
                cast.appendChild(line);
            }
            if (!lite && to) {
                const a = from.getBoundingClientRect();
                const b = to.getBoundingClientRect();
                const orb = document.createElement('span');
                orb.className = 'rr-skill';
                orb.textContent = job.icon;
                orb.style.setProperty('--job', job.color);
                const x0 = a.left + a.width * 0.85;
                const y0 = a.top + a.height * 0.4;
                orb.style.left = `${x0 - box.left - 20}px`;
                orb.style.top = `${y0 - box.top - 20}px`;
                host.appendChild(orb);
                const dx = b.left + b.width / 2 - x0;
                const dy = b.top + b.height / 2 - y0;
                const anim = orb.animate([
                    { transform: 'translate(0, 0) scale(.4)', opacity: 0 },
                    { transform: 'translate(0, 0) scale(1.3)', opacity: 1, offset: 0.12 },
                    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(1.15) rotate(200deg)`, opacity: 1, offset: 0.55 },
                    { transform: `translate(${dx}px, ${dy}px) scale(.9) rotate(360deg)`, opacity: 1 }
                ], { duration: travel, delay: 180, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
                anim.onfinish = () => orb.remove();
            }
        }, start);
        setTimeout(() => {
            if (!layer?.isConnected) return;
            const pop = document.createElement('span');
            pop.className = `rr-dmg${big ? ' is-big' : ''}`;
            pop.style.setProperty('--job-deep', job.deep);
            const b = to?.getBoundingClientRect();
            const lb = layer.getBoundingClientRect();
            // Over the shard that was hit, a little apart each time so numbers never pile up.
            const px = b ? ((b.left + b.width / 2 - lb.left) / lb.width) * 100 : 75;
            const py = b ? ((b.top + b.height / 2 - lb.top) / lb.height) * 100 : 55;
            pop.style.setProperty('--x', `${(px + 6 * Math.cos(i * 2.4)).toFixed(1)}%`);
            pop.style.setProperty('--y', `${(py - 10 + 6 * Math.sin(i * 2.4)).toFixed(1)}%`);
            pop.textContent = `${Math.round(gain * 2) / 2}`;
            if (big) {
                const word = document.createElement('small');
                word.textContent = caption('big', tier);
                pop.appendChild(word);
            }
            layer.appendChild(pop);
            setTimeout(() => pop.remove(), 1700);
            if (!lite && b) {
                const burst = document.createElement('span');
                burst.className = 'rr-burst';
                burst.style.setProperty('--job', job.color);
                burst.style.left = `${b.left + b.width / 2 - box.left}px`;
                burst.style.top = `${b.top + b.height / 2 - box.top}px`;
                host.appendChild(burst);
                setTimeout(() => burst.remove(), 520);
                to.classList?.add('is-hit');
                setTimeout(() => to.classList?.remove('is-hit'), 600);
            }
            arena?.classList.remove('is-struck');
            void arena?.offsetWidth;
            arena?.classList.add('is-struck');
            if (flash && !lite) {
                flash.classList.remove('is-on');
                void flash.offsetWidth;
                flash.classList.add('is-on');
            }
            playRaidSfx('hit', { big });
        }, start + travel + 180);
    });
    if (!before.status.broken && after.status.broken) {
        setTimeout(() => playRaidSfx('shatter'), gains.length * gap + travel + 300);
    }
}

function onClick(event) {
    const target = event.target;
    if (target.closest('[data-rr-close]')) { closeRaidHall(); return; }
    if (target.closest('[data-rr-music]')) { toggleMusic(); return; }
    if (target.closest('[data-rr-help]')) { openHelp(); return; }
    if (target.closest('[data-rr-help-close]') || target.classList.contains('rr-help')) { hall.root.querySelector('.rr-help')?.remove(); return; }
    const other = target.closest('[data-rr-raid]');
    if (other) {
        if (other.dataset.rrRaid !== hall.view()?.raid?.raidId) openRaidHall({ raidId: other.dataset.rrRaid, focusId: hall.focusId, keepSound: true });
        return;
    }
    const banner = target.closest('[data-banner]');
    if (banner) { focusClass(banner.dataset.banner); return; }
    if (target.closest('[data-rr-reveal]')) revealHero();
}

/** Picks a class to feature (a row of the alliance): its window, its words, its heroes. */
function focusClass(classId) {
    if (!classId || classId === hall.focusId) return;
    hall.focusId = classId;
    hall.heroCard = null;
    playRaidSfx('cursor');
    render(hall.view());
    hall.root.querySelector(`.rr-ally__row[data-banner="${CSS.escape(classId)}"]`)?.focus({ preventScroll: true });
}

function toggleMusic() {
    const on = !raidMusicOn();
    setRaidMusicOn(on);
    const btn = hall.root.querySelector('[data-rr-music]');
    btn?.classList.toggle('is-off', !on);
    btn?.setAttribute('aria-pressed', String(on));
    if (on) {
        hall.musicSeason = '';
        syncMusic(hall.view());
    }
}

function openHelp() {
    const view = hall.view();
    playRaidSfx('open');
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
        playRaidSfx('chest', { step: 2 });
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
export async function openRaidHall({ view: given = null, focusId = '', raidId = '', keepSound = false, roster = null, year = null, now = null } = {}) {
    // A raid other than the live one (from the Calendar or the year's medallions): a still view.
    if (!given && raidId && raidId !== (getRaidView()?.raid?.raidId || currentRaid()?.raidId)) {
        given = await raidViewById(raidId);
        if (!given) return false;
    }
    let source = () => given || getRaidView();
    if (!source()) {
        const raid = currentRaid();
        if (!raid) {
            import('../effects.js').then(({ showToast }) => showToast('No Realm Raid this week. Eldhorn visits three school weeks a year: mid-December, the week before Clean Monday, and the first week of June.', 'info', 6000));
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
    hall = { root, focusId, last: null, revealing: false, heroCard: null, lite: isLite(), view: source, roster, year, now, intro: !keepSound && !reducedMotion(), musicSeason: '' };
    hall.onKey = (event) => {
        if (event.key === 'Escape') {
            if (root.querySelector('.rr-help')) root.querySelector('.rr-help').remove();
            else closeRaidHall();
            return;
        }
        const row = event.target.closest?.('.rr-ally__row');
        if (row && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            focusClass(row.dataset.banner);
        } else if (row && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const rows = [...root.querySelectorAll('.rr-ally__row')];
            const next = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next) { next.focus(); playRaidSfx('cursor'); }
        }
    };
    document.addEventListener('keydown', hall.onKey);
    hall.onResize = () => { cancelAnimationFrame(hall?.resizeFrame); if (hall) hall.resizeFrame = requestAnimationFrame(layoutParty); };
    window.addEventListener('resize', hall.onResize);
    root.addEventListener('click', onClick);
    hall.unsub = given ? () => {} : subscribeRaid((view) => { if (view) render(view); });
    render(source());
    if (keepSound) root.classList.add('is-open', 'is-swap');
    else requestAnimationFrame(() => root.classList.add('is-open'));
    if (keepSound) playRaidSfx('cursor');
    else setTimeout(() => playRaidSfx('appear'), hall.lite ? 200 : 650);
    return true;
}

export function closeRaidHall({ instant = false } = {}) {
    if (!hall) return;
    hall.unsub?.();
    document.removeEventListener('keydown', hall.onKey);
    window.removeEventListener('resize', hall.onResize);
    const { root } = hall;
    hall = null;
    if (!instant) stopRaidMusic();
    if (instant) { root.remove(); return; }
    root.classList.remove('is-open');
    setTimeout(() => root.remove(), 260);
}

/** Re-renders the open hall on a new view (the preview page uses it to show live hits). */
export function rerenderRaidHall(view) {
    if (!hall || !view) return;
    hall.view = () => view;
    render(view);
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
    stopRaidMusic({ fade: 0.3 });
    document.body.appendChild(host);
    requestAnimationFrame(() => host.classList.add('is-open'));
    const lite = isLite();
    setTimeout(() => playRaidSfx('shatter'), lite ? 700 : 1050);
    setTimeout(() => playRaidSfx('fanfare', { legendary }), lite ? 1400 : 2400);
    [0, 1, 2].forEach((i) => setTimeout(() => playRaidSfx('chest', { step: i }), (lite ? 5000 : 5750) + i * 300));
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
