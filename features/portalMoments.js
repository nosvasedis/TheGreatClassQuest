// features/portalMoments.js
// What the teacher sees when a class reaches the Crystal Portal, over whatever is on screen
// (the projector included):
//  - stepping through: the Portal banner, a little story of its own (the class emblem, ringed by
//    its heroes, glides into the Portal, a flash, and the new rank crest rises); tapping it opens
//    the full story (ui/modals/portalStory.js). Afterwards the app's notification keeps a
//    "Watch the story" button;
//  - stars full but a rune still sleeps, or the Guardian waits: the same banner at the sealed
//    gate (once per class, per state, per session), opening the gate's story.
// The watcher also catches a crossing saved on another device (Quest Remote on the phone, a
// second laptop), so every screen of the teacher celebrates it once.
// Rules: questRanksCore.mjs; story text: portalStoryCore.mjs; banner CSS: portal_moments.css.
import '../styles/portal_moments.css';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { rankCrestSvg } from './questRankCrest.mjs';
import { buildPortalStory, heroTint, normalizeCrossing, portalMomentKey } from './portalStoryCore.mjs';
import { displayLevelOf } from './questRanksCore.mjs';

const VORTEX = new URL('../assets/team-quest-map/living-atlas/portal-vortex.webp', import.meta.url).href;
const VEIL = new URL('../assets/team-quest-map/living-atlas/portal-vortex-veiled.webp', import.meta.url).href;

const BANNER_MS = { open: 13000, sealed: 10000, guardian: 10000 };
const REMOTE_DELAY_MS = 2500;

const told = new Set();
const queue = [];
let showing = false;

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function notify(options) {
    return import('../ui/effects.js').then(({ notify: show }) => show(options)).catch(() => null);
}

function playPortal(name, opts) {
    import('../audio.js').then(({ playPortalSfx }) => playPortalSfx(name, opts)).catch(() => {});
}

/** Shows the Portal of the class's own league (the modal follows the selected league). */
function openPortal(classData) {
    if (classData?.questLevel && !state.get('globalSelectedLeague')) state.set('globalSelectedLeague', classData.questLevel);
    import('../ui/modals/crystalPortal.js').then(({ openCrystalPortalModal }) => openCrystalPortalModal()).catch(() => {});
}

function openGuardian(classId) {
    import('./portalGuardian.js').then(({ openPortalGuardian }) => openPortalGuardian(classId)).catch(() => {});
}

function openStory(story, classData) {
    import('../ui/modals/portalStory.js')
        .then(({ openPortalStory }) => openPortalStory(story, {
            onPortal: () => openPortal(classData),
            onGuardian: () => openGuardian(classData.id)
        }))
        .catch((error) => console.warn('Portal story failed to open', error));
}

function rosterOf(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId);
}

function monthName(date = new Date()) {
    try { return date.toLocaleString('en-GB', { month: 'long' }); } catch (_) { return ''; }
}

/** The first rune still asleep, in words ("Focus needs 3★ more"). */
export function sleepingRuneLine(status) {
    const rune = status.runes.find((r) => !r.met && r.id !== 'guardian');
    if (!rune) return '';
    if (rune.id === 'virtues') {
        const short = rune.parts.filter((p) => !p.met).map((p) => `${p.label} ${Math.ceil(p.need - p.have)}★`);
        return `Four Virtues: still to light ${short.join(', ')}.`;
    }
    if (rune.id === 'lanterns') {
        const left = Math.max(1, rune.need - rune.have);
        return `Lanterns: ${left} more ${left === 1 ? 'hero needs' : 'heroes need'} ${rune.each}★ this month.`;
    }
    if (rune.id === 'ownLight') {
        return `Own Light: the heroes' own stars need ${Math.ceil(rune.need - rune.have)}★ more.`;
    }
    return '';
}

// ─── The banner ──────────────────────────────────────────────────────────────

/** The fellowship in little: a dot for every hero (up to 16) ringed around the emblem. */
function bandDots(story) {
    const heroes = story.heroes.shown;
    const count = Math.min(16, heroes.length);
    return Array.from({ length: count }, (_, k) => {
        const hero = heroes[Math.floor((k * heroes.length) / count)];
        return `<i style="--a:${((360 * k) / count).toFixed(1)}deg;--tint:${heroTint(hero.name)}"></i>`;
    }).join('');
}

/** The banner's markup (also used by the preview page). */
export function portalBannerHtml(story) {
    const open = story.variant === 'open';
    const lite = story.lite;
    const sparks = lite || !open ? '' : Array.from({ length: 10 }, (_, i) => `<i class="pe-banner__spark" style="--i:${i}"></i>`).join('');
    const marks = !open && story.runes.length
        ? `<span class="pe-banner__runes">${story.runes.map((r, i) => `<i class="fas ${esc(r.icon)}${r.met ? ' is-lit' : ''}" style="--i:${i}"></i>`).join('')}</span>`
        : '';
    const crest = open ? `<span class="pe-banner__crest">${rankCrestSvg(story.toLevel)}</span>` : '';
    const cta = open ? 'Watch them step through' : (story.variant === 'guardian' ? 'See the Guardian' : 'See the gate');
    return `
        <div class="pe-banner pe-banner--${story.variant} qr-tone--${story.toRank.id}${lite ? ' pe--lite' : ''}" role="button" tabindex="0"
             aria-label="${esc(story.headline)} ${esc(story.title)}. ${esc(cta)}">
            <span class="pe-banner__sky" aria-hidden="true"></span>
            <span class="pe-banner__stage" aria-hidden="true">
                <span class="pe-banner__road"></span>
                <span class="pe-banner__portal">
                    <span class="pe-banner__halo"></span>
                    <img class="pe-banner__vortex" src="${VORTEX}" alt="" draggable="false" decoding="async">
                    <img class="pe-banner__veil" src="${VEIL}" alt="" draggable="false" decoding="async">
                    <span class="pe-banner__flash"></span>
                    ${sparks}
                </span>
                ${marks}
                <span class="pe-banner__walker">
                    <span class="pe-banner__band">
                        <span class="pe-banner__ring">${bandDots(story)}</span>
                        <span class="pe-banner__medal"><b>${esc(story.logo)}</b></span>
                    </span>
                </span>
                ${crest}
            </span>
            <span class="pe-banner__copy">
                <small><span class="pe-banner__logo">${esc(story.logo)}</span>${esc(story.headline)}</small>
                <strong class="font-title">${esc(story.title)}</strong>
                <em>${esc(story.subtitle)}</em>
                <span class="pe-banner__cta"><i class="fas fa-play" aria-hidden="true"></i>${esc(cta)}</span>
            </span>
            <span class="pe-banner__stamp" aria-hidden="true">${open ? `<b>${story.toRank.displayLevel}</b><span>New level</span>` : '<b>100%</b><span>Goal filled</span>'}</span>
            <button type="button" class="pe-banner__close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <span class="pe-banner__timer" aria-hidden="true"></span>
        </div>`;
}

/**
 * Shows one banner. Resolves with 'opened' (the story was opened), 'closed' or 'timeout'.
 * Hovering holds it on screen.
 */
export function showPortalBanner(story, classData) {
    return new Promise((resolve) => {
        const ms = BANNER_MS[story.variant] || 10000;
        const host = document.createElement('div');
        host.className = 'pe-host';
        host.innerHTML = portalBannerHtml(story);
        const banner = host.firstElementChild;
        banner.style.setProperty('--pe-life', `${ms}ms`);
        let timer = null;
        let done = false;
        const finish = (how) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            banner.classList.add('is-leaving');
            setTimeout(() => host.remove(), 380);
            resolve(how);
        };
        const arm = (wait) => { clearTimeout(timer); timer = setTimeout(() => finish('timeout'), wait); };
        banner.addEventListener('click', (event) => {
            if (event.target.closest('.pe-banner__close')) { finish('closed'); return; }
            finish('opened');
            openStory(story, classData);
        });
        banner.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); finish('opened'); openStory(story, classData); }
            if (event.key === 'Escape') finish('closed');
        });
        banner.addEventListener('pointerenter', () => { clearTimeout(timer); banner.classList.add('is-held'); });
        banner.addEventListener('pointerleave', () => { banner.classList.remove('is-held'); arm(4000); });
        document.body.appendChild(host);
        playPortal('banner', { gate: story.variant !== 'open', arriveAt: story.variant === 'open' ? 2.45 : 2.3 });
        arm(ms);
    });
}

/** Waits for a realm banner on screen to finish, so two banners never overlap. */
function realmBannerGone(maxMs = 5000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            if (!document.querySelector('.rm-host') || Date.now() - start > maxMs) resolve();
            else setTimeout(check, 250);
        };
        check();
    });
}

async function playNext() {
    if (showing || !queue.length) return;
    showing = true;
    const { story, classData, after } = queue.shift();
    try {
        await realmBannerGone();
        const how = await showPortalBanner(story, classData);
        if (how !== 'opened') after?.();
    } catch (_) {
        after?.();
    } finally {
        showing = false;
        if (queue.length) setTimeout(playNext, 400);
    }
}

function enqueue(item) {
    queue.push(item);
    playNext();
}

// ─── At the gate ─────────────────────────────────────────────────────────────

/** Stars are full but the Portal waits (once per class, per state, per session). */
export function announcePortalWaiting(classData, status) {
    if (!classData?.id || !status) return;
    const extra = `${status.state}|${status.runesLit}|${status.guardian?.triedToday ? 't' : ''}`;
    const key = portalMomentKey(classData.id, utils.getMonthKey(), 'gate', extra);
    if (told.has(key)) return;
    told.add(key);
    if (status.state === 'guardian' && status.guardian?.triedToday) return;
    const guardian = status.state === 'guardian';
    const line = sleepingRuneLine(status);
    const story = buildPortalStory({
        kind: 'gate',
        classData,
        roster: rosterOf(classData.id),
        status,
        sleepingLine: line,
        monthName: monthName(),
        lite: detectLowPowerTier()
    });
    const who = `${classData.logo || ''} ${classData.name || 'The class'}`.trim();
    enqueue({
        story,
        classData,
        after: () => notify({
            type: guardian ? 'praise' : 'info',
            title: guardian ? 'The Portal Guardian' : 'The Portal is sealed',
            icon: guardian ? '🗝️' : '🔮',
            key: `portal-${classData.id}`,
            duration: 9000,
            message: guardian
                ? `${esc(who)} filled the goal and lit every rune! The Guardian waits at the gate with ${status.guardian.questions} riddles.`
                : `${esc(who)} filled the goal, but a Portal rune still sleeps. ${esc(line)}`,
            actions: [
                guardian
                    ? { label: 'Face the Guardian', icon: 'fa-dungeon', onClick: () => openGuardian(classData.id) }
                    : { label: 'See the runes', icon: 'fa-gem', onClick: () => openPortal(classData) },
                { label: 'The story', icon: 'fa-play', onClick: () => openStory(story, classData) }
            ]
        })
    });
}

// ─── Stepping through ────────────────────────────────────────────────────────

function announceCrossingStory(classData, normalized) {
    const key = portalMomentKey(classData.id, utils.getMonthKey(), 'crossing');
    if (told.has(key) || !normalized) return;
    told.add(key);
    const story = buildPortalStory({
        kind: 'crossing',
        classData,
        roster: rosterOf(classData.id),
        crossing: normalized,
        monthName: monthName(),
        lite: detectLowPowerTier()
    });
    const who = `${classData.logo || ''} ${classData.name || 'The class'}`.trim();
    const gold = normalized.gold > 0 && normalized.heroesPaid > 0 ? ` +${normalized.gold} Gold for every hero.` : '';
    const ahead = story.next ? ` Next month: ${esc(story.next.text)}` : ' Next month the goal grows a little.';
    enqueue({
        story,
        classData,
        after: () => notify({
            type: 'praise',
            title: 'The Portal opens',
            icon: '🌀',
            key: `portal-${classData.id}`,
            duration: 12000,
            message: `${esc(who)} are now ${esc(story.toRank.title)} (Level ${story.toRank.displayLevel}).${gold}${ahead}`,
            actions: [
                { label: 'Watch the story', icon: 'fa-play', onClick: () => openStory(story, classData) },
                { label: 'Open the Portal', icon: 'fa-door-open', onClick: () => openPortal(classData) }
            ]
        })
    });
}

/** The class stepped through on this device: the banner, then the notification with the spoils. */
export function announcePortalCrossing(classData, crossing, status = null) {
    if (!classData?.id || !crossing) return;
    announceCrossingStory(classData, normalizeCrossing({ crossing, status }));
}

/**
 * Replays this month's crossing of a class already inside the Portal (its Team Quest map card).
 * Reads classes.portalCrossings[month]; an older crossing without that record is told from
 * the class's level alone.
 */
export function openCrossingStory(classData) {
    if (!classData?.id) return;
    const fresh = (state.get('allSchoolClasses') || []).find((c) => c.id === classData.id) || classData;
    const roster = rosterOf(fresh.id);
    const entry = fresh.portalCrossings?.[utils.getMonthKey()]
        || { level: Math.max(1, displayLevelOf(fresh.difficultyLevel) - 1), gold: 0 };
    const crossing = normalizeCrossing({ entry, classData: fresh, heroes: roster.length });
    openStory(buildPortalStory({ kind: 'crossing', classData: fresh, roster, crossing, monthName: monthName(), lite: detectLowPowerTier() }), fresh);
}

// ─── Crossings saved on another device ───────────────────────────────────────

let started = false;
let baselineFor = '';
let watchTimer = null;
const seenCrossings = new Set();

function ownClasses() {
    const uid = state.get('currentUserId');
    if (!uid || state.get('currentUserRole') !== 'teacher') return [];
    return (state.get('allSchoolClasses') || []).filter((c) => c?.id && c.createdBy?.uid === uid);
}

function watchCrossings() {
    watchTimer = null;
    const uid = state.get('currentUserId') || '';
    const classes = ownClasses();
    if (!classes.length) return;
    const monthKey = utils.getMonthKey();
    // The first look (and a different teacher signing in) only remembers what is already there.
    const baseline = baselineFor !== uid;
    if (baseline) { baselineFor = uid; seenCrossings.clear(); }
    for (const classData of classes) {
        const entry = classData.portalCrossings?.[monthKey];
        if (!entry) continue;
        const key = portalMomentKey(classData.id, monthKey, 'crossing');
        if (seenCrossings.has(key)) continue;
        seenCrossings.add(key);
        if (baseline || told.has(key)) continue;
        // This device's own crossing announces itself first; give it a moment.
        setTimeout(() => {
            if (told.has(key)) return;
            const fresh = (state.get('allSchoolClasses') || []).find((c) => c.id === classData.id) || classData;
            const roster = rosterOf(classData.id);
            announceCrossingStory(fresh, normalizeCrossing({ entry: fresh.portalCrossings?.[monthKey] || entry, classData: fresh, heroes: roster.length }));
        }, REMOTE_DELAY_MS);
    }
}

/** Starts watching the teacher's classes for crossings (once per page). Safe before sign-in. */
export function startPortalMoments() {
    if (started) return;
    started = true;
    state.subscribe(['allSchoolClasses'], () => {
        clearTimeout(watchTimer);
        watchTimer = setTimeout(watchCrossings, 800);
    });
    watchTimer = setTimeout(watchCrossings, 800);
}
