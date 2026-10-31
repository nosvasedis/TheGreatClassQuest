// ui/modals/portalStory.js
// The Portal story: a full-screen scene opened from the Portal banner (or its notification),
// made for the projector. The class is one fellowship: its emblem in the middle, every hero in
// a ring around it (two or three rings for a big class), all of them seen at once.
//  - open (the class stepped through): the heroes gather around the emblem, the Portal runes
//    light one by one, the Portal wakes behind them and the whole fellowship spins into it
//    together; a flash, and they come back out ringed around the new rank's crest. Gold rains,
//    and the closing cards tell the spoils and what the next Portal asks;
//  - sealed / guardian (stars full, the Portal still closed): the fellowship gathers before the
//    veiled Portal, the lit runes glow and the sleeping ones flicker (or the Guardian's key
//    appears), and the cards say what still opens it.
// Weaker laptops (detectLowPowerTier) get no twinkle, rays, warp lines, glow or coins; reduced
// motion shows the last frame. Story text: features/portalStoryCore.mjs.
// Sound: audio.js playPortalSfx. Styles: styles/portal_story.css (lazy, with this module).
import { quietly } from '../../utils/runtimeMetrics.js';
import { escapeHtml as esc } from '../../utils/html.mjs';
import '../../styles/portal_story.css';
import { rankCrestSvg } from '../../features/questRankCrest.mjs';
import { heroTint } from '../../features/portalStoryCore.mjs';

const VORTEX = new URL('../../assets/team-quest-map/living-atlas/portal-vortex.webp', import.meta.url).href;
const VEIL = new URL('../../assets/team-quest-map/living-atlas/portal-vortex-veiled.webp', import.meta.url).href;

const PLUNGE_MS = 2600;

let active = null;

function sfx(name, opts) {
    import('../../audio.js').then(({ playPortalSfx }) => playPortalSfx?.(name, opts)).catch(quietly('ui/modals/portalStory.js'));
}

function tierOf(story) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'still';
    return story.lite ? 'lite' : 'full';
}

/** Stars painted as box-shadows on one dot (seeded, so every opening looks the same). */
function starField(count, seed) {
    let s = seed;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    for (let i = 0; i < count; i += 1) {
        const x = (rand() * 100).toFixed(2);
        const y = (rand() * 78).toFixed(2);
        const size = rand() > 0.85 ? 1.5 : 0.5;
        out.push(`${x}cqw ${y}cqh 0 ${size}px rgba(255,255,255,${(0.5 + rand() * 0.5).toFixed(2)})`);
    }
    return out.join(',');
}

/**
 * Where every hero stands around the emblem, in orbit units (the orbit is about 100 units
 * across): one ring for a class of up to 18, two up to 44, then three. Heroes go clockwise
 * from the top in name order, outer ring first; an inner ring sits half a step round so
 * nobody hides behind anybody. `size` is one hero's width in the same units.
 */
export function fellowshipLayout(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const rings = n <= 18
        ? [{ r: 34, share: 1 }]
        : n <= 44
            ? [{ r: 39, share: 0.58 }, { r: 26.5, share: 0.42 }]
            : [{ r: 41, share: 0.42 }, { r: 31, share: 0.33 }, { r: 21.5, share: 0.25 }];
    let left = n;
    const counts = rings.map((ring, i) => {
        const take = i === rings.length - 1 ? left : Math.round(n * ring.share);
        left -= take;
        return take;
    });
    const cap = rings.length === 1 ? 11 : rings.length === 2 ? 9 : 6.5;
    const size = Math.min(cap, ...rings.map((ring, i) => (counts[i] ? ((2 * Math.PI * ring.r) / counts[i]) * 0.68 : cap)));
    const spots = [];
    rings.forEach((ring, i) => {
        const k = counts[i];
        for (let j = 0; j < k; j += 1) {
            const a = ((-90 + (360 * j) / k + (i % 2 ? 180 / k : 0)) * Math.PI) / 180;
            spots.push({ x: +(ring.r * Math.cos(a)).toFixed(2), y: +(ring.r * Math.sin(a)).toFixed(2) });
        }
    });
    return { size: +size.toFixed(2), rings: rings.length, radii: rings.map((ring) => ring.r), spots };
}

/** Time between two heroes popping into the ring: a big class gathers quicker. */
function popGap(count) {
    return Math.round(Math.min(110, Math.max(40, 1500 / Math.max(1, count))));
}

function heroFace(hero) {
    if (hero.avatar) return `<img src="${esc(hero.avatar)}" alt="" draggable="false" decoding="async" loading="eager">`;
    return `<span class="ps-hero__initial" style="--tint:${heroTint(hero.name)}">${esc(hero.name.charAt(0).toUpperCase() || '★')}</span>`;
}

function heroesHtml(story, layout) {
    const lines = story.heroes.shown.length
        ? layout.radii.map((r) => `<span class="ps-orbit" style="--r:${r}"></span>`).join('')
        : '';
    return lines + story.heroes.shown.map((hero, i) => {
        const spot = layout.spots[i];
        // With more than one ring the upper heroes wear their names above their faces: the
        // gap between the rings and the middle (the runes) stay clear.
        const up = layout.rings > 1 && spot.y < -6 ? ' ps-hero--up' : '';
        return `<span class="ps-hero${up}" style="--i:${i};--x:${spot.x};--y:${spot.y}"><span class="ps-hero__pop"><span class="ps-hero__face">${heroFace(hero)}</span><span class="ps-hero__name">${esc(hero.name)}</span></span></span>`;
    }).join('');
}

/** The Portal runes, on an arc over the emblem. */
function runesHtml(story, layout) {
    const list = story.runes;
    if (!list.length) return '';
    const radius = layout.rings === 1 ? 18.5 : layout.rings === 2 ? 17.5 : 14;
    const step = list.length > 4 ? 24 : 28;
    return list.map((rune, i) => {
        const angle = -90 + (i - (list.length - 1) / 2) * step;
        const a = (angle * Math.PI) / 180;
        return `<span class="ps-rune${rune.met ? ' is-lit' : ''}" style="--i:${i};--x:${(radius * Math.cos(a)).toFixed(2)};--y:${(radius * Math.sin(a)).toFixed(2)}" title="${esc(rune.name)}"><i class="fas ${esc(rune.icon)}" aria-hidden="true"></i></span>`;
    }).join('');
}

function warpHtml(story, tier) {
    if (story.variant !== 'open' || tier !== 'full') return '';
    return `<span class="ps-warp" aria-hidden="true">${Array.from({ length: 20 }, (_, i) => `<i style="--a:${i * 18 + ((i * 7) % 9)}deg;--i:${i % 5}"></i>`).join('')}</span>`;
}

function coinsHtml(story, tier) {
    if (story.variant !== 'open' || !(story.gold > 0) || tier !== 'full') return '';
    return Array.from({ length: 18 }, (_, i) => `<span class="ps-coin" style="--x:${(4 + ((i * 37) % 92))}%;--i:${i}"><i class="fas fa-coins" aria-hidden="true"></i></span>`).join('');
}

function card(cls, icon, small, big, em) {
    return `<li class="ps-card${cls ? ` ${cls}` : ''}">${icon}<span><small>${small}</small><b>${big}</b>${em ? `<em>${em}</em>` : ''}</span></li>`;
}

/** The closing cards: what the fellowship won (left) and what comes next (right). */
function endHtml(story) {
    if (story.variant === 'open') {
        const rank = card('ps-card--rank', `<span class="ps-card__crests">${rankCrestSvg(story.fromLevel)}<i class="fas fa-arrow-right" aria-hidden="true"></i>${rankCrestSvg(story.toLevel)}</span>`,
            'New rank', esc(story.toRank.title), `Quest Level ${story.toRank.displayLevel}`);
        const spoils = story.gold > 0
            ? card('ps-card--gold', '<i class="fas fa-coins" aria-hidden="true"></i>', 'Portal spoils', `+${story.gold} Gold for every hero`, story.heroesPaid ? `${story.heroesPaid} heroes paid` : '')
            : card('', '<i class="fas fa-users" aria-hidden="true"></i>', 'Stepped through together', `${story.heroes.total} ${story.heroes.total === 1 ? 'hero' : 'heroes'}`, esc(story.who));
        const next = story.next
            ? card('ps-card--next', `<i class="fas ${esc(story.next.icon)}" aria-hidden="true"></i>`, 'New at the next Portal', esc(story.next.name), esc(story.next.text))
            : card('ps-card--next', '<i class="fas fa-road" aria-hidden="true"></i>', 'Next month', 'A longer road', `The goal grows a little; the Portal pays ${story.nextSpoils} Gold.`);
        return `
            <div class="ps-side ps-side--won"><ul class="ps-cards">${rank}${spoils}</ul></div>
            <div class="ps-side ps-side--next">
                <ul class="ps-cards">${next}</ul>
                <div class="ps-actions">
                    <button type="button" class="ps-btn ps-btn--ghost" data-ps="replay"><i class="fas fa-rotate-right" aria-hidden="true"></i>Watch again</button>
                    <button type="button" class="ps-btn ps-btn--ghost" data-ps="portal"><i class="fas fa-door-open" aria-hidden="true"></i>Open the Portal</button>
                    <button type="button" class="ps-btn ps-btn--main" data-ps="close"><i class="fas fa-check" aria-hidden="true"></i>Onward!</button>
                </div>
            </div>`;
    }
    const guardian = story.variant === 'guardian';
    const sleeping = story.sleeping.map((r) => `<span class="ps-chip"><i class="fas ${esc(r.icon)}" aria-hidden="true"></i>${esc(r.short)}</span>`).join('');
    const lit = story.runes.filter((r) => r.met && r.id !== 'guardian').map((r) => `<span class="ps-chip is-lit"><i class="fas ${esc(r.icon)}" aria-hidden="true"></i>${esc(r.short)}</span>`).join('');
    const still = guardian
        ? card('ps-card--next', '<i class="fas fa-dungeon" aria-hidden="true"></i>', "The Guardian's test", `${story.guardianTest.toPass} of ${story.guardianTest.questions} riddles right`, 'One try each lesson day.')
        : card('ps-card--next', '<i class="fas fa-moon" aria-hidden="true"></i>', 'Still asleep', sleeping || 'A rune', esc(story.subtitle));
    const glowing = lit ? card('', '<i class="fas fa-gem" aria-hidden="true"></i>', 'Already glowing', lit, '') : '';
    const beyond = card('ps-card--rank', `<span class="ps-card__crests">${rankCrestSvg(story.toLevel)}</span>`, 'Beyond the Portal', esc(story.toRank.title), `+${story.spoils} Gold for every hero`);
    return `
        <div class="ps-side ps-side--won"><ul class="ps-cards">${still}${glowing}</ul></div>
        <div class="ps-side ps-side--next">
            <ul class="ps-cards">${beyond}</ul>
            <div class="ps-actions">
                <button type="button" class="ps-btn ps-btn--ghost" data-ps="replay"><i class="fas fa-rotate-right" aria-hidden="true"></i>Watch again</button>
                ${guardian
                    ? '<button type="button" class="ps-btn ps-btn--main" data-ps="guardian"><i class="fas fa-dungeon" aria-hidden="true"></i>Face the Guardian</button>'
                    : '<button type="button" class="ps-btn ps-btn--main" data-ps="portal"><i class="fas fa-gem" aria-hidden="true"></i>See the runes</button>'}
                <button type="button" class="ps-btn ps-btn--ghost" data-ps="close"><i class="fas fa-check" aria-hidden="true"></i>Close</button>
            </div>
        </div>`;
}

function topHtml(story) {
    const from = `<span class="ps-top__set ps-top__set--from"><small>${rankCrestSvg(story.fromLevel)}${esc(story.fromRank.title)} · Quest Level ${story.fromRank.displayLevel}</small><strong class="font-title">The Crystal Portal</strong></span>`;
    if (story.variant === 'open') {
        return `${from}<span class="ps-top__set ps-top__set--to"><small>New rank · Quest Level ${story.toRank.displayLevel}</small><strong class="font-title">${esc(story.toRank.title)}</strong><em>${esc(story.toRank.motto)}</em></span>`;
    }
    return `${from}<span class="ps-top__set ps-top__set--to"><small>${rankCrestSvg(story.fromLevel)}${esc(story.fromRank.title)} · Quest Level ${story.fromRank.displayLevel}</small><strong class="font-title">${esc(story.title)}</strong></span>`;
}

export function portalStoryHtml(story, tier = 'full') {
    const open = story.variant === 'open';
    const count = story.heroes.shown.length;
    const layout = fellowshipLayout(count);
    const starsA = tier === 'still' ? '' : starField(80, 7);
    const starsB = tier === 'still' ? '' : starField(60, 31);
    const badge = story.variant === 'guardian'
        ? '<span class="ps-badge ps-badge--guardian" aria-hidden="true"><i class="fas fa-dungeon"></i></span>'
        : story.variant === 'sealed' ? '<span class="ps-badge" aria-hidden="true"><i class="fas fa-lock"></i></span>' : '';
    return `
        <section class="ps-frame ps--${story.variant} qr-tone--${story.toRank.id}" data-tier="${tier}" data-rings="${layout.rings}" role="dialog" aria-modal="true" aria-label="${esc(story.headline)}"
                 style="--hs:${layout.size};--pop:${popGap(count)}ms;--plunge:${PLUNGE_MS}ms">
            <span class="ps-sky" aria-hidden="true"></span>
            <span class="ps-stars ps-stars--a" aria-hidden="true" style="box-shadow:${starsA}"></span>
            <span class="ps-stars ps-stars--b" aria-hidden="true" style="box-shadow:${starsB}"></span>
            <span class="ps-moon" aria-hidden="true"></span>
            <svg class="ps-land" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id="ps-peak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c3fb0"/><stop offset="1" stop-color="#1c1450"/></linearGradient>
                    <linearGradient id="ps-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#231b62"/><stop offset="1" stop-color="#0c0828"/></linearGradient>
                </defs>
                <path d="M0 110 L60 52 L110 88 L170 20 L240 96 L300 60 L360 112 L640 112 L700 58 L760 98 L830 26 L890 84 L950 44 L1000 80 V200 H0 Z" fill="url(#ps-peak)" opacity=".7"/>
                <path d="M170 20 L190 48 L178 46 Z M830 26 L850 54 L838 52 Z M950 44 L966 66 L956 64 Z" fill="#c4b5fd" opacity=".6"/>
                <path d="M0 150 C160 120 300 140 420 132 C560 124 660 118 780 130 C880 140 950 132 1000 124 V200 H0 Z" fill="url(#ps-hill)"/>
            </svg>
            <div class="ps-center" aria-hidden="true">
                <span class="ps-portal">
                    <span class="ps-halo"></span>
                    <span class="ps-rays"></span>
                    <img class="ps-vortex" src="${VORTEX}" alt="" draggable="false" decoding="async">
                    <img class="ps-veil" src="${VEIL}" alt="" draggable="false" decoding="async">
                    <span class="ps-seal-ring"></span>
                </span>
                ${warpHtml(story, tier)}
                <span class="ps-fellowship">
                    <span class="ps-ring">${heroesHtml(story, layout)}</span>
                    <span class="ps-medal">
                        <span class="ps-medal__rim"></span>
                        <span class="ps-medal__face"><b>${esc(story.logo)}</b></span>
                        ${badge}
                    </span>
                    <span class="ps-runes">${runesHtml(story, layout)}</span>
                    ${open ? `<span class="ps-crest"><span class="ps-crest__rays"></span>${rankCrestSvg(story.toLevel)}</span>` : ''}
                    <span class="ps-ribbon"><span class="ps-ribbon__logo">${esc(story.logo)}</span>${esc(story.who)}</span>
                </span>
                <span class="ps-flash"></span>
            </div>
            <div class="ps-top">${topHtml(story)}</div>
            <span class="ps-coins" aria-hidden="true">${coinsHtml(story, tier)}</span>
            <p class="ps-caption" aria-live="polite"><span data-ps-caption>${esc(story.chapters[0])}</span></p>
            <div class="ps-end">${endHtml(story)}</div>
            <button type="button" class="ps-skip" data-ps="skip">Skip <i class="fas fa-forward" aria-hidden="true"></i></button>
            <button type="button" class="ps-close" data-ps="close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
        </section>`;
}

/** The story's beats: [ms, chapter class, caption index or null, sound, sound options]. */
function beatsFor(story) {
    const count = story.heroes.shown.length;
    const gap = popGap(count);
    const gathered = 700 + count * gap + 500;
    // A soft bell as heroes join the ring: at most 14, spread over the gathering.
    const bells = Math.min(14, count);
    const chimes = Array.from({ length: bells }, (_, k) => [700 + Math.round((k * count) / bells) * gap, null, null, 'step', { step: k }]);
    if (story.variant === 'open') {
        const tRunes = Math.max(2600, gathered);
        const tOpen = tRunes + story.runes.length * 380 + 500;
        const tPlunge = tOpen + 1500;
        const tFlash = tPlunge + PLUNGE_MS - 150;
        return [
            [0, 'is-ch0', 0],
            ...chimes,
            [tRunes, 'is-ch1', 1],
            ...story.runes.map((_, i) => [tRunes + 200 + i * 380, null, null, 'rune', { step: i }]),
            [tOpen, 'is-ch2', 2, 'open'],
            [tPlunge, 'is-ch3', 3],
            ...Array.from({ length: 6 }, (_, i) => [tPlunge + 700 + i * 260, null, null, 'step', { step: i * 2 }]),
            [tFlash, 'is-ch4', null, 'flash'],
            [tFlash + 450, 'is-ch5', 4, 'crest'],
            [tFlash + 3400, 'is-ch6', 5, story.gold > 0 ? 'gold' : null],
            [tFlash + 4800, 'is-end', null]
        ];
    }
    const tRunes = Math.max(2400, gathered);
    const guardian = story.variant === 'guardian';
    return [
        [0, 'is-ch0', 0],
        ...chimes,
        [tRunes - 900, 'is-ch1', 1],
        [tRunes, 'is-ch2', 2, guardian ? 'guardian' : null],
        ...(guardian ? [] : story.runes.map((r, i) => [tRunes + 150 + i * 380, null, null, 'rune', { step: i, lit: r.met }])),
        [tRunes + 400 + story.runes.length * 380, null, null, guardian ? null : 'sealed'],
        [tRunes + 2600, 'is-ch3', 3],
        [tRunes + 5200, 'is-ch4', 4],
        [tRunes + 5800, 'is-end', null]
    ];
}

/**
 * Sizes the orbit to the screen: --u is one orbit unit in px (the orbit is ~100 units across),
 * between a title band on top and a caption band below. A wide screen (a 16:9 projector) gets
 * the closing cards in the side columns; a narrow one (4:3, phones) slides them up from the
 * bottom and lifts the fellowship above them.
 */
function measure(frame) {
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    if (!W || !H) return;
    const top = Math.max(80, H * 0.165);
    const bottom = Math.max(48, H * 0.09);
    const u = Math.max(2.4, Math.min((H - top - bottom) / 98, W / 102));
    const cy = top + (H - top - bottom) / 2;
    const side = (W - 100 * u) / 2;
    frame.style.setProperty('--u', `${u.toFixed(2)}px`);
    frame.style.setProperty('--cy', `${cy.toFixed(1)}px`);
    frame.style.setProperty('--top', `${top.toFixed(0)}px`);
    frame.style.setProperty('--side', `${Math.max(0, side).toFixed(0)}px`);
    frame.dataset.layout = side >= 290 ? 'wide' : 'narrow';
    let shift = 0;
    let scale = 1;
    if (frame.dataset.layout === 'narrow' && frame.classList.contains('is-end')) {
        const sheet = frame.querySelector('.ps-end');
        const sheetH = sheet ? sheet.offsetHeight : 0;
        const room = Math.max(80, H - sheetH - top - 8);
        scale = Math.min(1, room / (100 * u));
        shift = top + room / 2 - cy;
    }
    frame.style.setProperty('--end-shift', `${shift.toFixed(1)}px`);
    frame.style.setProperty('--end-scale', scale.toFixed(3));
}

function close() {
    if (!active) return;
    const { host, timers, onKey, onResize, lastFocus } = active;
    timers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    active = null;
    host.classList.add('is-leaving');
    setTimeout(() => host.remove(), 300);
    try { lastFocus?.focus?.({ preventScroll: true }); } catch (_) { /* gone */ }
}

function run(host, story) {
    const tier = tierOf(story);
    host.innerHTML = portalStoryHtml(story, tier);
    const frame = host.querySelector('.ps-frame');
    const caption = host.querySelector('[data-ps-caption]');
    measure(frame);
    const timers = [];
    const setCaption = (index) => {
        const text = story.chapters[index];
        if (!text || !caption) return;
        caption.classList.remove('is-in');
        void caption.offsetWidth;
        caption.textContent = text;
        caption.classList.add('is-in');
    };
    const atEnd = () => {
        measure(frame);
        timers.push(setTimeout(() => frame.classList.add('is-rest'), 2500));
        host.querySelector('.ps-end .ps-btn--main')?.focus({ preventScroll: true });
    };
    const beats = beatsFor(story);
    const finish = (skipped) => {
        timers.forEach(clearTimeout);
        timers.length = 0;
        beats.forEach(([, cls]) => cls && frame.classList.add(cls));
        frame.classList.add('is-skipped');
        if (caption) caption.textContent = story.chapters[story.chapters.length - 1];
        if (skipped) sfx(story.variant === 'open' ? 'crest' : (story.variant === 'guardian' ? 'guardian' : 'sealed'));
        atEnd();
    };
    if (tier === 'still') {
        finish(false);
    } else {
        beats.forEach(([at, cls, captionIndex, sound, opts]) => {
            timers.push(setTimeout(() => {
                if (cls) frame.classList.add(cls);
                if (captionIndex !== null && captionIndex !== undefined) setCaption(captionIndex);
                if (sound) sfx(sound, opts);
                if (cls === 'is-end') atEnd();
            }, at));
        });
        requestAnimationFrame(() => frame.classList.add('is-live'));
    }
    return { timers, finish, frame };
}

/**
 * Opens the story. `story` comes from portalStoryCore.buildPortalStory.
 * @param {object} story
 * @param {object} [handlers] - { onPortal, onGuardian }
 */
export function openPortalStory(story, handlers = {}) {
    if (!story) return;
    if (active) close();
    const host = document.createElement('div');
    host.className = 'ps-host';
    document.body.appendChild(host);
    const lastFocus = document.activeElement;
    let runState = run(host, story);
    const onKey = (event) => {
        if (event.key === 'Escape') { event.stopPropagation(); close(); }
    };
    let resizeFrame = 0;
    const onResize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => measure(runState.frame));
    };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    active = { host, timers: runState.timers, onKey, onResize, lastFocus };
    host.addEventListener('click', (event) => {
        const action = event.target.closest('[data-ps]')?.dataset.ps;
        if (!action) return;
        if (action === 'close') close();
        else if (action === 'skip') runState.finish(true);
        else if (action === 'replay') {
            runState.timers.forEach(clearTimeout);
            runState = run(host, story);
            if (active) active.timers = runState.timers;
        } else if (action === 'portal') { close(); handlers.onPortal?.(); }
        else if (action === 'guardian') { close(); handlers.onGuardian?.(); }
    });
    host.querySelector('.ps-skip')?.focus({ preventScroll: true });
}

export function closePortalStory() {
    close();
}
