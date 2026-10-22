// ui/modals/portalStory.js
// The Portal story: a short animated scene opened from the Portal banner (or its notification).
//  - open (the class stepped through): the road lights up, the Portal runes glow one by one,
//    the Portal opens, the class token leads its heroes up the road and each one steps into the
//    light; a flash, the old crest gives way to the new rank's crest, Gold rains, and a closing
//    panel tells the spoils and what the next Portal asks;
//  - sealed / guardian (stars full, the Portal still closed): the heroes gather at the gate, the
//    lit runes glow and the sleeping ones flicker (or the Guardian rises), and the panel says
//    what still opens it.
// Weaker laptops (detectLowPowerTier) get fewer heroes and no twinkle, rays, coins or road
// drawing; reduced motion shows the last frame. Story text: features/portalStoryCore.mjs.
// Sound: audio.js playPortalSfx. Styles: styles/portal_story.css (lazy, with this module).
import '../../styles/portal_story.css';
import { rankCrestSvg } from '../../features/questRankCrest.mjs';

const VORTEX = new URL('../../assets/team-quest-map/living-atlas/portal-vortex.webp', import.meta.url).href;
const VEIL = new URL('../../assets/team-quest-map/living-atlas/portal-vortex-veiled.webp', import.meta.url).href;
const TOKEN = new URL('../../assets/team-quest-map/living-atlas/token-gold.webp', import.meta.url).href;

// The road, in the stage's own 1000 × 562 box: from the meadow (bottom left) to the Portal.
const ROAD = { sx: 60, sy: 484, cx: 520, cy: 524, ex: 690, ey: 252 };
const WALK_MS = 2400;
const ENTER_MS = 450;

const HERO_TINTS = ['#f472b6', '#38bdf8', '#4ade80', '#facc15', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];

let active = null;

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sfx(name, opts) {
    import('../../audio.js').then(({ playPortalSfx }) => playPortalSfx?.(name, opts)).catch(() => {});
}

function tierOf(story) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'still';
    return story.lite ? 'lite' : 'full';
}

/** A point on the road at t (0..1), in stage percentages. */
function roadAt(t) {
    const u = 1 - t;
    const x = u * u * ROAD.sx + 2 * t * u * ROAD.cx + t * t * ROAD.ex;
    const y = u * u * ROAD.sy + 2 * t * u * ROAD.cy + t * t * ROAD.ey;
    return { x: x / 10, y: (y / 562) * 100 };
}

/** Stars painted as box-shadows on one dot (seeded, so every opening looks the same). */
function starField(count, seed) {
    let s = seed;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    for (let i = 0; i < count; i += 1) {
        const x = (rand() * 100).toFixed(2);
        const y = (rand() * 62).toFixed(2);
        const size = rand() > 0.85 ? 1.5 : 0.5;
        out.push(`${x}cqw ${y}cqh 0 ${size}px rgba(255,255,255,${(0.5 + rand() * 0.5).toFixed(2)})`);
    }
    return out.join(',');
}

function tintFor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return HERO_TINTS[h % HERO_TINTS.length];
}

function heroFace(hero) {
    if (hero.avatar) return `<img src="${esc(hero.avatar)}" alt="" draggable="false" decoding="async" loading="eager">`;
    return `<span class="ps-hero__initial" style="--tint:${tintFor(hero.name)}">${esc(hero.name.charAt(0).toUpperCase() || '★')}</span>`;
}

/** Where each hero stops at the gate: a loose crowd on the road before the sealed Portal. */
function gatherSpot(i, total) {
    const perRow = Math.min(6, Math.max(3, Math.ceil(total / 3)));
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const t = 0.76 - col * (0.34 / perRow) - (row % 2) * (0.17 / perRow);
    const p = roadAt(Math.max(0.3, t));
    const start = roadAt(0);
    return { dx: p.x - start.x + row * 2.2, dy: p.y - start.y + row * 7.5 };
}

function walkersHtml(story, tier) {
    const heroes = [{ lead: true, name: story.who, logo: story.logo }, ...story.heroes.shown];
    if (story.heroes.more) heroes.push({ more: story.heroes.more, name: `+${story.heroes.more}` });
    const gate = story.variant !== 'open';
    return heroes.map((hero, i) => {
        const spot = gate ? gatherSpot(i, heroes.length) : null;
        const face = hero.lead
            ? `<span class="ps-hero__token"><img src="${TOKEN}" alt="" draggable="false"><b>${esc(hero.logo)}</b></span>`
            : (hero.more ? `<span class="ps-hero__more">${esc(hero.name)}</span>` : heroFace(hero));
        const label = hero.more ? '' : `<span class="ps-hero__name">${esc(hero.name)}</span>`;
        const style = `--i:${i}${spot ? `;--gx:${spot.dx.toFixed(2)}%;--gy:${spot.dy.toFixed(2)}%` : ''}`;
        return `<span class="ps-walker" style="${style}"><span class="ps-hero${hero.lead ? ' ps-hero--lead' : ''}${hero.more ? ' ps-hero--more' : ''}"><span class="ps-hero__body">${face}${tier === 'full' || hero.lead ? label : ''}</span></span></span>`;
    }).join('');
}

function runesHtml(story) {
    const list = story.runes;
    if (!list.length) return '';
    const spread = Math.min(150, 40 * (list.length - 1));
    return list.map((rune, i) => {
        const angle = list.length === 1 ? 0 : -spread / 2 + (spread / (list.length - 1)) * i;
        return `<span class="ps-rune-slot" style="--a:${angle}deg;--i:${i}"><span class="ps-rune${rune.met ? ' is-lit' : ''}" title="${esc(rune.name)}"><i class="fas ${esc(rune.icon)}" aria-hidden="true"></i></span></span>`;
    }).join('');
}

function coinsHtml(story, tier) {
    if (story.variant !== 'open' || !(story.gold > 0) || tier !== 'full') return '';
    return Array.from({ length: 16 }, (_, i) => `<span class="ps-coin" style="--x:${(6 + ((i * 37) % 88))}%;--i:${i}"><i class="fas fa-coins" aria-hidden="true"></i></span>`).join('');
}

function endHtml(story) {
    if (story.variant === 'open') {
        const spoils = story.gold > 0
            ? `<li class="ps-card ps-card--gold"><i class="fas fa-coins" aria-hidden="true"></i><span><small>Portal spoils</small><b>+${story.gold} Gold for every hero</b>${story.heroesPaid ? `<em>${story.heroesPaid} heroes paid</em>` : ''}</span></li>`
            : '';
        const rank = `<li class="ps-card ps-card--rank"><span class="ps-card__crests">${rankCrestSvg(story.fromLevel)}<i class="fas fa-arrow-right" aria-hidden="true"></i>${rankCrestSvg(story.toLevel)}</span><span><small>New rank</small><b>${esc(story.toRank.title)}</b><em>Quest Level ${story.toRank.displayLevel}</em></span></li>`;
        const next = story.next
            ? `<li class="ps-card ps-card--next"><i class="fas ${esc(story.next.icon)}" aria-hidden="true"></i><span><small>New at the next Portal</small><b>${esc(story.next.name)}</b><em>${esc(story.next.text)}</em></span></li>`
            : `<li class="ps-card ps-card--next"><i class="fas fa-road" aria-hidden="true"></i><span><small>Next month</small><b>A longer road</b><em>The goal grows a little; the Portal pays ${story.nextSpoils} Gold.</em></span></li>`;
        return `
            <ul class="ps-cards">${rank}${spoils}${next}</ul>
            <div class="ps-actions">
                <button type="button" class="ps-btn ps-btn--ghost" data-ps="replay"><i class="fas fa-rotate-right" aria-hidden="true"></i>Watch again</button>
                <button type="button" class="ps-btn ps-btn--ghost" data-ps="portal"><i class="fas fa-door-open" aria-hidden="true"></i>Open the Portal</button>
                <button type="button" class="ps-btn ps-btn--main" data-ps="close"><i class="fas fa-check" aria-hidden="true"></i>Onward!</button>
            </div>`;
    }
    const guardian = story.variant === 'guardian';
    const sleeping = story.sleeping.map((r) => `<span class="ps-chip"><i class="fas ${esc(r.icon)}" aria-hidden="true"></i>${esc(r.short)}</span>`).join('');
    const lit = story.runes.filter((r) => r.met && r.id !== 'guardian').map((r) => `<span class="ps-chip is-lit"><i class="fas ${esc(r.icon)}" aria-hidden="true"></i>${esc(r.short)}</span>`).join('');
    const still = guardian
        ? `<li class="ps-card ps-card--next"><i class="fas fa-dungeon" aria-hidden="true"></i><span><small>The Guardian's test</small><b>${story.guardianTest.toPass} of ${story.guardianTest.questions} riddles right</b><em>One try each lesson day.</em></span></li>`
        : `<li class="ps-card ps-card--next"><i class="fas fa-moon" aria-hidden="true"></i><span><small>Still asleep</small><b>${sleeping || 'A rune'}</b><em>${esc(story.subtitle)}</em></span></li>`;
    return `
        <ul class="ps-cards">
            ${still}
            ${lit ? `<li class="ps-card"><i class="fas fa-gem" aria-hidden="true"></i><span><small>Already glowing</small><b>${lit}</b></span></li>` : ''}
            <li class="ps-card ps-card--rank"><span class="ps-card__crests">${rankCrestSvg(story.toLevel)}</span><span><small>Beyond the Portal</small><b>${esc(story.toRank.title)}</b><em>+${story.spoils} Gold for every hero</em></span></li>
        </ul>
        <div class="ps-actions">
            <button type="button" class="ps-btn ps-btn--ghost" data-ps="replay"><i class="fas fa-rotate-right" aria-hidden="true"></i>Watch again</button>
            ${guardian
                ? '<button type="button" class="ps-btn ps-btn--main" data-ps="guardian"><i class="fas fa-dungeon" aria-hidden="true"></i>Face the Guardian</button>'
                : '<button type="button" class="ps-btn ps-btn--main" data-ps="portal"><i class="fas fa-gem" aria-hidden="true"></i>See the runes</button>'}
            <button type="button" class="ps-btn ps-btn--ghost" data-ps="close"><i class="fas fa-check" aria-hidden="true"></i>Close</button>
        </div>`;
}

export function portalStoryHtml(story, tier = 'full') {
    const open = story.variant === 'open';
    const count = 1 + story.heroes.shown.length + (story.heroes.more ? 1 : 0);
    const gap = open ? Math.round(Math.min(480, 4400 / Math.max(1, count))) : 230;
    const starsA = tier === 'still' ? '' : starField(70, 7);
    const starsB = tier === 'still' ? '' : starField(50, 31);
    return `
        <div class="ps-backdrop" data-ps="close"></div>
        <section class="ps-frame ps--${story.variant} qr-tone--${story.toRank.id}" data-tier="${tier}" role="dialog" aria-modal="true" aria-label="${esc(story.headline)}" style="--gap:${gap}ms;--walk:${WALK_MS}ms">
            <div class="ps-stage">
                <span class="ps-sky" aria-hidden="true"></span>
                <span class="ps-stars ps-stars--a" aria-hidden="true" style="box-shadow:${starsA}"></span>
                <span class="ps-stars ps-stars--b" aria-hidden="true" style="box-shadow:${starsB}"></span>
                <span class="ps-moon" aria-hidden="true"></span>
                <svg class="ps-land" viewBox="0 0 1000 562" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <defs>
                        <linearGradient id="ps-peak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5bd0"/><stop offset="1" stop-color="#2a1d6b"/></linearGradient>
                        <linearGradient id="ps-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2a7a"/><stop offset="1" stop-color="#140f3d"/></linearGradient>
                        <linearGradient id="ps-road-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#e9d5ff"/></linearGradient>
                    </defs>
                    <path d="M0 330 L70 250 L120 290 L190 190 L260 280 L330 230 L400 300 L470 210 L540 290 L610 240 L700 330 L780 220 L860 300 L930 200 L1000 270 V562 H0 Z" fill="url(#ps-peak)" opacity=".75"/>
                    <path d="M190 190 L215 225 L200 222 Z M470 210 L492 240 L478 238 Z M780 220 L803 252 L790 250 Z M930 200 L952 230 L940 229 Z" fill="#c4b5fd" opacity=".7"/>
                    <path d="M0 420 C140 370 260 400 380 380 C520 356 640 330 760 360 C860 384 940 370 1000 352 V562 H0 Z" fill="url(#ps-hill)"/>
                    <path class="ps-road__bed" d="M${ROAD.sx} ${ROAD.sy} Q${ROAD.cx} ${ROAD.cy} ${ROAD.ex} ${ROAD.ey}" fill="none" stroke="#0b0827" stroke-width="30" stroke-linecap="round" opacity=".55"/>
                    <path class="ps-road__glow" pathLength="100" d="M${ROAD.sx} ${ROAD.sy} Q${ROAD.cx} ${ROAD.cy} ${ROAD.ex} ${ROAD.ey}" fill="none" stroke="url(#ps-road-fill)" stroke-width="9" stroke-linecap="round" stroke-dasharray="3 2.2"/>
                </svg>
                <span class="ps-portal" aria-hidden="true">
                    <span class="ps-rays"></span>
                    <span class="ps-halo"></span>
                    <img class="ps-vortex" src="${VORTEX}" alt="" draggable="false" decoding="async">
                    <img class="ps-veil" src="${VEIL}" alt="" draggable="false" decoding="async">
                    ${story.variant === 'guardian' ? '<span class="ps-guardian"><i class="fas fa-dungeon"></i></span>' : ''}
                    ${story.variant === 'sealed' ? '<span class="ps-seal"><i class="fas fa-lock"></i></span>' : ''}
                    <span class="ps-runes">${runesHtml(story)}</span>
                </span>
                <span class="ps-walkers" aria-hidden="true">${walkersHtml(story, tier)}</span>
                <span class="ps-flash" aria-hidden="true"></span>
                ${open ? `
                <span class="ps-ascent" aria-hidden="true">
                    <span class="ps-ascent__rays"></span>
                    <span class="ps-ascent__old">${rankCrestSvg(story.fromLevel)}</span>
                    <span class="ps-ascent__new">${rankCrestSvg(story.toLevel)}</span>
                </span>
                <span class="ps-title"><small>Quest Level ${story.toRank.displayLevel}</small><strong class="font-title">${esc(story.toRank.title)}</strong><em>${esc(story.toRank.motto)}</em></span>` : `
                <span class="ps-title ps-title--gate"><small>${esc(story.fromRank.title)} · Quest Level ${story.fromRank.displayLevel}</small><strong class="font-title">${esc(story.title)}</strong></span>`}
                <span class="ps-coins" aria-hidden="true">${coinsHtml(story, tier)}</span>
                <p class="ps-caption" aria-live="polite"><span data-ps-caption>${esc(story.chapters[0])}</span></p>
                <button type="button" class="ps-skip" data-ps="skip">Skip <i class="fas fa-forward" aria-hidden="true"></i></button>
            </div>
            <div class="ps-end">${endHtml(story)}</div>
            <button type="button" class="ps-close" data-ps="close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
        </section>`;
}

/** The story's beats: [ms, chapter class, caption index or null, sound, sound options]. */
function beatsFor(story, tier) {
    const count = 1 + story.heroes.shown.length + (story.heroes.more ? 1 : 0);
    if (story.variant === 'open') {
        const gap = Math.round(Math.min(480, 4400 / Math.max(1, count)));
        const runes = story.runes.length;
        const tRunes = 2400;
        const tOpen = tRunes + runes * 380 + 500;
        const tWalk = tOpen + 1500;
        const tFlash = tWalk + (count - 1) * gap + WALK_MS + ENTER_MS + 200;
        const beats = [
            [0, 'is-ch0', 0],
            [tRunes, 'is-ch1', 1],
            ...story.runes.map((_, i) => [tRunes + 200 + i * 380, null, null, 'rune', { step: i }]),
            [tOpen, 'is-ch2', 2, 'open'],
            [tWalk, 'is-ch3', 3],
            ...Array.from({ length: count }, (_, i) => [tWalk + i * gap + WALK_MS, null, null, 'step', { step: i }]),
            [tFlash, 'is-ch4', null, 'flash'],
            [tFlash + 500, 'is-ch5', 4, 'crest'],
            [tFlash + 3300, 'is-ch6', 5, story.gold > 0 ? 'gold' : null],
            [tFlash + 4600, 'is-end', null]
        ];
        return beats;
    }
    const gather = 2300;
    const tRunes = gather + (count - 1) * 230 + WALK_MS * 0.9;
    const guardian = story.variant === 'guardian';
    return [
        [0, 'is-ch0', 0],
        [gather, 'is-ch1', 1],
        [tRunes, 'is-ch2', 2, guardian ? 'guardian' : null],
        ...(guardian ? [] : story.runes.map((r, i) => [tRunes + 150 + i * 380, null, null, 'rune', { step: i, lit: r.met }])),
        [tRunes + 400 + story.runes.length * 380, null, null, guardian ? null : 'sealed'],
        [tRunes + 2600, 'is-ch3', 3],
        [tRunes + 5200, 'is-ch4', 4],
        [tRunes + 5600, 'is-end', null]
    ];
}

function close() {
    if (!active) return;
    const { host, timers, onKey, lastFocus } = active;
    timers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey, true);
    active = null;
    host.classList.add('is-leaving');
    setTimeout(() => host.remove(), 260);
    try { lastFocus?.focus?.({ preventScroll: true }); } catch (_) { /* gone */ }
}

function run(host, story) {
    const tier = tierOf(story);
    host.innerHTML = portalStoryHtml(story, tier);
    const frame = host.querySelector('.ps-frame');
    const caption = host.querySelector('[data-ps-caption]');
    const timers = [];
    const setCaption = (index) => {
        const text = story.chapters[index];
        if (!text || !caption) return;
        caption.classList.remove('is-in');
        void caption.offsetWidth;
        caption.textContent = text;
        caption.classList.add('is-in');
    };
    const beats = beatsFor(story, tier);
    const finish = (skipped) => {
        timers.forEach(clearTimeout);
        timers.length = 0;
        beats.forEach(([, cls]) => cls && frame.classList.add(cls));
        frame.classList.add('is-skipped');
        if (caption) caption.textContent = story.chapters[story.chapters.length - 1];
        if (skipped) sfx(story.variant === 'open' ? 'crest' : (story.variant === 'guardian' ? 'guardian' : 'sealed'));
        timers.push(setTimeout(() => frame.classList.add('is-rest'), 1200));
        host.querySelector('.ps-end [data-ps="close"], .ps-end .ps-btn--main')?.focus({ preventScroll: true });
    };
    if (tier === 'still') {
        finish(false);
    } else {
        beats.forEach(([at, cls, captionIndex, sound, opts]) => {
            timers.push(setTimeout(() => {
                if (cls) frame.classList.add(cls);
                if (captionIndex !== null && captionIndex !== undefined) setCaption(captionIndex);
                if (sound) sfx(sound, opts);
                if (cls === 'is-end') {
                    timers.push(setTimeout(() => frame.classList.add('is-rest'), 2500));
                    host.querySelector('.ps-end .ps-btn--main')?.focus({ preventScroll: true });
                }
            }, at));
        });
        requestAnimationFrame(() => frame.classList.add('is-live'));
    }
    return { timers, finish };
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
    document.addEventListener('keydown', onKey, true);
    active = { host, timers: runState.timers, onKey, lastFocus };
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
