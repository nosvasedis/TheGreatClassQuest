// Hero's Challenge motion: heroes glide to their new places (a hero who
// steps onto the podium or down from it hops there, portrait first), and
// every badge arrives and leaves with an effect that suits it.
//
// Loaded with the Hero's Challenge tab (not at startup). Without it the board
// still updates, just without the motion.

import {
    countUp,
    morphStandingsList,
    playStandingsChanges,
    reducedMotion
} from './heroStandings.js';

const EASE_GLIDE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_FLY = 'cubic-bezier(0.45, 0, 0.2, 1)';
const GLIDE_MIN_MS = 620;
const GLIDE_MAX_MS = 1100;
const HOP_MS = 980;
const BLOOM_MS = 460;

// --- The motion layer ---------------------------------------------------------

function layerOf(list) {
    let layer = list.querySelector(':scope > [data-hcs-fx-layer]');
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'hcs-fx-layer';
        layer.setAttribute('data-hcs-fx-layer', '');
        layer.setAttribute('aria-hidden', 'true');
        list.appendChild(layer);
    }
    return layer;
}

function lite(list) {
    return list.classList.contains('hcs-list--lite');
}

/** Places a node in the layer over a page rectangle. */
function pin(layer, node, rect) {
    const base = layer.getBoundingClientRect();
    node.style.position = 'absolute';
    node.style.left = `${rect.left - base.left}px`;
    node.style.top = `${rect.top - base.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    node.style.margin = '0';
    layer.appendChild(node);
    return node;
}

function centre(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function visible(rect) {
    return rect && rect.width > 0 && rect.height > 0;
}

// --- Sparkles ------------------------------------------------------------------

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * A puff of particles from a page point. shape: star | dot | ember | spark |
 * smoke | ring. rise lifts them, fall drops them, spread is how far they fly.
 */
function sparkle(list, x, y, {
    count = 10, colors = ['#fde047'], shape = 'star', spread = 36, rise = 0, fall = 0,
    duration = 900, delay = 0, size = 9
} = {}) {
    if (lite(list)) count = Math.min(count, 3);
    if (count <= 0) return;
    const layer = layerOf(list);
    const base = layer.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
        const p = document.createElement('i');
        p.className = `hcs-fx-p hcs-fx-p--${shape}`;
        const s = shape === 'ring' ? size : size * rand(0.55, 1.1);
        p.style.left = `${x - base.left}px`;
        p.style.top = `${y - base.top}px`;
        p.style.width = `${s}px`;
        p.style.height = `${s}px`;
        p.style.setProperty('--c', colors[i % colors.length]);
        layer.appendChild(p);
        const angle = shape === 'ember' || shape === 'smoke'
            ? rand(-Math.PI * 0.85, -Math.PI * 0.15)
            : (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
        const dist = shape === 'ring' ? 0 : spread * rand(0.55, 1.05);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - rise + fall;
        const spin = shape === 'star' ? rand(-160, 160) : 0;
        const frames = shape === 'ring'
            ? [
                { opacity: 0.95, scale: '0.2' },
                { opacity: 0, scale: String(spread / Math.max(1, size) * 2) }
            ]
            : [
                { opacity: 0, translate: '0 0', scale: '0.2', rotate: '0deg' },
                { opacity: 1, offset: 0.18, scale: '1' },
                { opacity: shape === 'smoke' ? 0.55 : 1, offset: 0.6 },
                { opacity: 0, translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, scale: shape === 'smoke' ? '1.8' : '0.4', rotate: `${spin.toFixed(0)}deg` }
            ];
        const anim = p.animate(frames, {
            duration: duration * rand(0.8, 1.15),
            delay: delay + (shape === 'ring' ? 0 : rand(0, 90)),
            easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
            fill: 'both'
        });
        anim.onfinish = () => p.remove();
        anim.oncancel = () => p.remove();
    }
}

// --- Badges ----------------------------------------------------------------------
//
// Each badge kind has an arrival (played on the badge itself) and a farewell
// (played on a ghost of the old badge where it stood), with particles that
// fit: gold stars for the Prodigy, embers for a hot week, sparks for a
// perfect streak, a stamp for the Guild Champion, a swinging medal for the
// Top Hero.

const GOLD = ['#fde047', '#f59e0b', '#fff7c2'];

const ARRIVE = {
    crownPop: [
        { opacity: 0, scale: '0.2', rotate: '-14deg', filter: 'brightness(2.2)' },
        { opacity: 1, scale: '1.2', rotate: '5deg', filter: 'brightness(1.7)', offset: 0.55 },
        { opacity: 1, scale: '1', rotate: '0deg', filter: 'brightness(1)' }
    ],
    drop: [
        { opacity: 0, translate: '0 -28px', scale: '1.5', rotate: '-20deg' },
        { opacity: 1, translate: '0 3px', scale: '0.94', rotate: '5deg', offset: 0.6 },
        { opacity: 1, translate: '0 0', scale: '1', rotate: '0deg' }
    ],
    ember: [
        { opacity: 0, translate: '0 10px', scale: '0.6', filter: 'saturate(2) brightness(1.4)' },
        { opacity: 1, translate: '0 -3px', scale: '1.08', offset: 0.6 },
        { opacity: 1, translate: '0 0', scale: '1', filter: 'none' }
    ],
    zap: [
        { opacity: 0, scale: '0.5', filter: 'brightness(3)' },
        { opacity: 1, scale: '1.22', filter: 'brightness(2.2)', offset: 0.22 },
        { opacity: 0.55, scale: '0.95', filter: 'brightness(1)', offset: 0.4 },
        { opacity: 1, scale: '1.05', filter: 'brightness(1.6)', offset: 0.55 },
        { opacity: 1, scale: '1', filter: 'none' }
    ],
    bloom: [
        { opacity: 0, scale: '0.4', filter: 'blur(4px)' },
        { opacity: 1, scale: '1.1', filter: 'blur(0px)', offset: 0.6 },
        { opacity: 1, scale: '1', filter: 'none' }
    ],
    wobble: [
        { opacity: 0, scale: '0.3', rotate: '0deg' },
        { opacity: 1, scale: '1.12', rotate: '-11deg', offset: 0.4 },
        { rotate: '8deg', offset: 0.6 },
        { rotate: '-4deg', scale: '1', offset: 0.8 },
        { opacity: 1, rotate: '0deg', scale: '1' }
    ],
    stamp: [
        { opacity: 0, scale: '1.9', rotate: '-9deg' },
        { opacity: 1, scale: '0.9', rotate: '0deg', offset: 0.55 },
        { scale: '1.05', offset: 0.75 },
        { opacity: 1, scale: '1' }
    ],
    swing: [
        { opacity: 0, translate: '0 -10px', rotate: '-30deg', transformOrigin: '50% 0' },
        { opacity: 1, translate: '0 0', rotate: '15deg', offset: 0.45, transformOrigin: '50% 0' },
        { rotate: '-7deg', offset: 0.7, transformOrigin: '50% 0' },
        { opacity: 1, rotate: '0deg', transformOrigin: '50% 0' }
    ],
    up: [
        { opacity: 0, translate: '0 9px', scale: '0.6' },
        { opacity: 1, translate: '0 -2px', scale: '1.1', offset: 0.6 },
        { opacity: 1, translate: '0 0', scale: '1' }
    ],
    down: [
        { opacity: 0, translate: '0 -9px', scale: '0.7' },
        { opacity: 1, translate: '0 0', scale: '1' }
    ],
    unfurl: [
        { opacity: 0, scale: '0.15 1', filter: 'brightness(1.8)' },
        { opacity: 1, scale: '1.04 1', offset: 0.7 },
        { opacity: 1, scale: '1 1', filter: 'none' }
    ],
    shine: [
        { opacity: 0, scale: '0.6', filter: 'brightness(2.4)' },
        { opacity: 1, scale: '1.06', filter: 'brightness(1.8)', offset: 0.5 },
        { opacity: 1, scale: '1', filter: 'none' }
    ]
};

const LEAVE = {
    goldDust: [
        { opacity: 1, scale: '1', filter: 'brightness(1)' },
        { opacity: 1, scale: '1.12', filter: 'brightness(1.9)', offset: 0.25 },
        { opacity: 0, scale: '0.45', filter: 'brightness(1) blur(2px)' }
    ],
    smoke: [
        { opacity: 1, translate: '0 0', filter: 'none' },
        { opacity: 0, translate: '0 -12px', scale: '0.7', filter: 'blur(3px) grayscale(1)' }
    ],
    fizzle: [
        { opacity: 1 },
        { opacity: 0.25, offset: 0.2 },
        { opacity: 0.9, offset: 0.35 },
        { opacity: 0, scale: '0.6', filter: 'grayscale(1)' }
    ],
    fade: [
        { opacity: 1, scale: '1', filter: 'none' },
        { opacity: 0, scale: '0.55', filter: 'blur(2px)' }
    ],
    tilt: [
        { opacity: 1 },
        { opacity: 0, translate: '0 12px', rotate: '16deg', scale: '0.8' }
    ],
    rise: [
        { opacity: 1, translate: '0 0' },
        { opacity: 0, translate: '0 -18px', scale: '0.8', rotate: '-10deg' }
    ],
    shrink: [
        { opacity: 1, scale: '1' },
        { opacity: 0, scale: '0.4' }
    ],
    furl: [
        { opacity: 1, scale: '1 1' },
        { opacity: 0, scale: '0.1 1' }
    ]
};

function toneColors(el, fallback) {
    try {
        const cs = getComputedStyle(el);
        const t = cs.getPropertyValue('--t').trim() || cs.getPropertyValue('--badge').trim();
        return t ? [t, '#ffffff', t] : fallback;
    } catch {
        return fallback;
    }
}

/**
 * kind → { arrive, ms, leave, leaveMs, fx(el, rect, arriving) }. fx throws the
 * particles at the badge's page rectangle.
 */
const BADGES = {
    prodigy: {
        arrive: 'crownPop', ms: 760, leave: 'goldDust', leaveMs: 700,
        fx: (list, r, arriving) => arriving
            ? (sparkle(list, centre(r).x, centre(r).y, { count: 12, colors: GOLD, spread: 42 }),
                sparkle(list, centre(r).x, centre(r).y, { count: 1, shape: 'ring', colors: ['#fcd34d'], size: 14, spread: 40, duration: 700 }))
            : sparkle(list, centre(r).x, centre(r).y, { count: 9, colors: GOLD, shape: 'dot', spread: 22, fall: 22, duration: 1000, size: 6 })
    },
    crown: {
        arrive: 'drop', ms: 820, leave: 'rise', leaveMs: 600,
        fx: (list, r, arriving) => arriving
            ? sparkle(list, centre(r).x, centre(r).y, { count: 12, colors: GOLD, spread: 46, delay: 420 })
            : sparkle(list, centre(r).x, centre(r).y, { count: 6, colors: GOLD, shape: 'dot', spread: 18, rise: 18, size: 5 })
    },
    'shared-crown': {
        arrive: 'unfurl', ms: 680, leave: 'furl', leaveMs: 480,
        fx: (list, r, arriving) => arriving && sparkle(list, centre(r).x, centre(r).y, { count: 14, colors: GOLD, spread: Math.min(120, r.width / 2) })
    },
    legend: {
        arrive: 'shine', ms: 700, leave: 'goldDust', leaveMs: 620,
        fx: (list, r, arriving) => sparkle(list, centre(r).x, centre(r).y, arriving
            ? { count: 10, colors: GOLD, spread: 34 }
            : { count: 6, colors: GOLD, shape: 'dot', fall: 18, spread: 16, size: 5 })
    },
    fire: {
        arrive: 'ember', ms: 640, leave: 'smoke', leaveMs: 620,
        fx: (list, r, arriving) => arriving
            ? sparkle(list, centre(r).x, r.top + r.height * 0.6, { count: 9, colors: ['#fb923c', '#f97316', '#fde047'], shape: 'ember', spread: 26, rise: 18, duration: 1000, size: 6 })
            : sparkle(list, centre(r).x, centre(r).y, { count: 5, colors: ['#9ca3af', '#d1d5db'], shape: 'smoke', spread: 16, rise: 14, duration: 900, size: 10 })
    },
    bolt: {
        arrive: 'zap', ms: 600, leave: 'fizzle', leaveMs: 560,
        fx: (list, r, arriving) => sparkle(list, centre(r).x, centre(r).y, arriving
            ? { count: 8, colors: ['#818cf8', '#c7d2fe', '#ffffff'], shape: 'spark', spread: 30, duration: 520 }
            : { count: 4, colors: ['#a5b4fc', '#e0e7ff'], shape: 'spark', spread: 16, duration: 400 })
    },
    skill: {
        arrive: 'bloom', ms: 620, leave: 'fade', leaveMs: 460,
        fx: (list, r, arriving, el) => sparkle(list, centre(r).x, centre(r).y, arriving
            ? { count: 8, colors: toneColors(el, ['#a78bfa', '#ffffff']), shape: 'dot', spread: 30, size: 6 }
            : { count: 4, colors: toneColors(el, ['#a78bfa']), shape: 'dot', spread: 14, size: 5 })
    },
    egg: {
        arrive: 'wobble', ms: 820, leave: 'shrink', leaveMs: 420,
        fx: (list, r, arriving) => sparkle(list, centre(r).x, centre(r).y, arriving
            ? { count: 8, colors: ['#34d399', '#a7f3d0', '#fef3c7'], spread: 28, size: 7 }
            : { count: 5, colors: ['#fef3c7', '#a7f3d0'], shape: 'dot', spread: 18, size: 5 })
    },
    champion: {
        arrive: 'stamp', ms: 620, leave: 'tilt', leaveMs: 520,
        fx: (list, r, arriving, el) => arriving
            ? (sparkle(list, centre(r).x, centre(r).y, { count: 1, shape: 'ring', colors: toneColors(el, ['#a78bfa']), size: 16, spread: 46, duration: 640, delay: 300 }),
                sparkle(list, centre(r).x, centre(r).y, { count: 8, colors: toneColors(el, ['#a78bfa', '#ffffff']), shape: 'dot', spread: 34, delay: 300, size: 6 }))
            : sparkle(list, centre(r).x, centre(r).y, { count: 4, colors: toneColors(el, ['#a78bfa']), shape: 'dot', spread: 14, fall: 12, size: 5 })
    },
    'top-hero': {
        arrive: 'swing', ms: 860, leave: 'tilt', leaveMs: 500,
        fx: (list, r, arriving) => sparkle(list, centre(r).x, centre(r).y, arriving
            ? { count: 9, colors: GOLD, spread: 30, delay: 200, size: 8 }
            : { count: 4, colors: GOLD, shape: 'dot', spread: 14, size: 5 })
    },
    'legend-title': null,
    'move-up': {
        arrive: 'up', ms: 480, leave: 'shrink', leaveMs: 320,
        fx: (list, r, arriving) => arriving && sparkle(list, centre(r).x, r.top, { count: 5, colors: ['#4ade80', '#bbf7d0'], shape: 'dot', spread: 14, rise: 12, size: 5 })
    },
    'move-down': { arrive: 'down', ms: 420, leave: 'shrink', leaveMs: 300 },
    gain: {
        arrive: 'crownPop', ms: 560, leave: 'shrink', leaveMs: 320,
        fx: (list, r, arriving) => arriving && sparkle(list, centre(r).x, centre(r).y, { count: 7, colors: GOLD, spread: 22, rise: 16, size: 7 })
    }
};
BADGES['legend-title'] = BADGES.legend;
const DEFAULT_BADGE = BADGES.skill;

function badgeSpec(kind) {
    return BADGES[kind] || DEFAULT_BADGE;
}

/** A badge arrives where it stands now. */
function badgeArrive(list, el, delay = 0) {
    const spec = badgeSpec(el.dataset.hcsBadge);
    el.getAnimations?.().forEach((a) => { if (a.id === 'hcs-badge') a.cancel(); });
    el.classList.remove('hcs-fx-wait');
    if (reducedMotion()) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay, fill: 'backwards' });
        return;
    }
    const anim = el.animate(ARRIVE[spec.arrive], { duration: spec.ms, delay, easing: EASE_GLIDE, fill: 'backwards' });
    anim.id = 'hcs-badge';
    if (spec.fx) {
        setTimeout(() => {
            if (!el.isConnected) return;
            const r = el.getBoundingClientRect();
            if (visible(r)) spec.fx(list, r, true, el);
        }, delay + 60);
    }
}

/** A badge that is gone: a ghost of it says goodbye where it stood. */
function badgeLeave(list, oldEl, rect) {
    if (!visible(rect) || reducedMotion()) return;
    const spec = badgeSpec(oldEl.dataset.hcsBadge);
    const ghost = oldEl.cloneNode(true);
    ghost.removeAttribute('title');
    ghost.classList.add('hcs-fx-ghost');
    pin(layerOf(list), ghost, rect);
    const anim = ghost.animate(LEAVE[spec.leave], { duration: spec.leaveMs, easing: 'ease-in', fill: 'forwards' });
    anim.onfinish = () => ghost.remove();
    anim.oncancel = () => ghost.remove();
    spec.fx?.(list, rect, false, oldEl);
}

/**
 * On a board drawn fresh (a new visit or another board), badges earned since
 * the last look wait hidden, then arrive with their effect.
 */
export function revealNewBadges(list, sections, delay = 0) {
    if (!list || reducedMotion()) return;
    const waiting = [];
    sections.forEach((section) => {
        section.entries.forEach((e) => {
            if (!e.newBadges?.length) return;
            const sel = `[data-hcs-mover][data-hcs-id="${CSS.escape(e.id)}"]`;
            list.querySelectorAll(sel).forEach((mover) => {
                if (mover.closest('.hcs-section--sealed')) return;
                e.newBadges.forEach((kind) => {
                    mover.querySelectorAll(`[data-hcs-badge="${CSS.escape(kind)}"]`).forEach((b) => {
                        b.classList.add('hcs-fx-wait');
                        waiting.push(b);
                    });
                });
            });
        });
    });
    waiting.forEach((b, i) => {
        setTimeout(() => { if (b.isConnected) badgeArrive(list, b); }, delay + Math.min(i, 8) * 140);
    });
}

// --- Measuring the board -------------------------------------------------------

function moverKind(el) {
    return el.classList.contains('hcs-figure') ? 'figure' : 'row';
}

function portraitOf(el) {
    return el.querySelector(':scope > .hcs-figure__portrait, :scope > .hcs-row__portrait');
}

function ownerOf(badge) {
    const mover = badge.closest('[data-hcs-mover]');
    if (mover) return `id:${mover.dataset.hcsId}`;
    const section = badge.closest('[data-hcs-section]');
    return section ? `s:${section.dataset.hcsSection}` : 'list';
}


function measure(list) {
    const movers = new Map();
    const badges = new Map();
    const pedestals = new Map();
    list.querySelectorAll('[data-hcs-section]').forEach((sectionEl) => {
        if (sectionEl.classList.contains('hcs-section--sealed')) return;
        const sid = sectionEl.dataset.hcsSection;
        sectionEl.querySelectorAll('[data-hcs-mover]').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (!visible(rect)) return;
            const portrait = portraitOf(el);
            movers.set(`${sid}|${el.dataset.hcsId}`, {
                el,
                rect,
                kind: moverKind(el),
                slot: Number(el.dataset.hcsSlot),
                portraitRect: portrait ? portrait.getBoundingClientRect() : rect,
                count: el.querySelector('[data-hcs-count]')?.dataset.to
            });
        });
        sectionEl.querySelectorAll('[data-hcs-badge]').forEach((el) => {
            if (el.closest('.hcs-fx-layer')) return;
            const rect = el.getBoundingClientRect();
            if (!visible(rect)) return;
            badges.set(`${sid}|${ownerOf(el)}|${el.dataset.hcsBadge}`, { el, rect });
        });
        sectionEl.querySelectorAll('[data-hcs-key] > .hcs-pedestal').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (visible(rect)) pedestals.set(`${sid}|${el.parentElement.dataset.hcsKey}`, { el, rect });
        });
    });
    return { movers, badges, pedestals };
}

function stopMotion(el) {
    el.getAnimations?.().forEach((a) => {
        if (a.id === 'hcs-flip' || a.id === 'hcs-bloom') a.cancel();
    });
}

// --- Gliding and hopping ----------------------------------------------------------

function glideTime(dist) {
    return Math.round(Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, GLIDE_MIN_MS + dist * 0.55)));
}

/** A same-shaped hero glides from where it stood (FLIP). */
function glide(el, dx, dy, { climb, delay = 0, onLand } = {}) {
    const dist = Math.hypot(dx, dy);
    const duration = glideTime(dist);
    el.classList.add(climb ? 'hcs-fx-climb' : 'hcs-fx-fall');
    const lift = climb ? 1.035 : 0.985;
    const anim = el.animate([
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` },
        { transform: `translate(${(dx * 0.45).toFixed(1)}px, ${(dy * 0.45).toFixed(1)}px) scale(${lift})`, offset: 0.5 },
        { transform: 'none' }
    ], { duration, delay, easing: EASE_GLIDE, fill: 'backwards' });
    anim.id = 'hcs-flip';
    const done = () => {
        el.classList.remove('hcs-fx-climb', 'hcs-fx-fall');
        onLand?.();
    };
    anim.onfinish = done;
    anim.oncancel = () => el.classList.remove('hcs-fx-climb', 'hcs-fx-fall');
    return duration + delay;
}

/**
 * A hero changes shape (podium figure ↔ row): the card waits hidden while the
 * hero's portrait flies from the old place in an arc, then the card blooms
 * around it. hold keeps the portrait at the old place for a moment first.
 */
function hop(list, el, fromRect, { climb, hold = 0, delay = 0, onLand } = {}) {
    const portrait = portraitOf(el);
    if (!portrait) return 0;
    const to = portrait.getBoundingClientRect();
    if (!visible(to) || !visible(fromRect)) return 0;
    const layer = layerOf(list);
    const ghost = document.createElement('div');
    const metal = el.closest('.hcs-spot')?.className.match(/hcs-spot--(gold|silver|bronze)/)?.[0] || '';
    ghost.className = `hcs-fx-hop ${climb ? 'hcs-fx-hop--climb' : 'hcs-fx-hop--fall'} ${metal}`;
    const face = portrait.cloneNode(true);
    face.querySelectorAll('[title]').forEach((n) => n.removeAttribute('title'));
    face.querySelectorAll('[tabindex], button, a').forEach((n) => n.setAttribute('tabindex', '-1'));
    face.removeAttribute('title');
    ghost.appendChild(face);
    pin(layer, ghost, to);

    const a = centre(fromRect);
    const b = centre(to);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const s = Math.max(0.35, Math.min(2.6, fromRect.width / to.width));
    const arc = climb ? -Math.max(36, Math.abs(dy) * 0.22) : -Math.max(18, Math.abs(dy) * 0.1);
    const total = hold + HOP_MS;
    const holdAt = hold / total;
    const from = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(3)})`;
    const frames = [
        { transform: from, opacity: 0, offset: 0 },
        { transform: from, opacity: 1, offset: Math.min(0.12, holdAt * 0.3 + 0.04) },
        { transform: from, opacity: 1, offset: Math.max(Math.min(0.12, holdAt * 0.3 + 0.04) + 0.01, holdAt), easing: EASE_FLY },
        {
            transform: `translate(${(dx * 0.42).toFixed(1)}px, ${(dy * 0.42 + arc).toFixed(1)}px) scale(${(((s + 1) / 2) * (climb ? 1.12 : 1.02)).toFixed(3)})`,
            opacity: 1,
            offset: holdAt + (1 - holdAt) * 0.55,
            easing: EASE_GLIDE
        },
        { transform: 'none', opacity: 1, offset: 1 }
    ];
    el.classList.add('hcs-fx-hidden');
    const flight = ghost.animate(frames, { duration: total, delay, fill: 'both' });
    flight.id = 'hcs-flip';

    // A little trail of light behind the flying portrait.
    if (!lite(list)) {
        const trailAt = delay + hold + HOP_MS * 0.2;
        [0, 0.25, 0.5].forEach((t, i) => setTimeout(() => {
            if (!ghost.isConnected) return;
            const r = ghost.getBoundingClientRect();
            sparkle(list, centre(r).x, centre(r).y, {
                count: 3,
                colors: climb ? GOLD : ['#e0e7ff', '#c4b5fd', '#ffffff'],
                shape: 'dot',
                spread: 12,
                fall: climb ? 8 : -6,
                duration: 650,
                size: 5
            });
        }, trailAt + i * HOP_MS * 0.2 + t));
    }

    const land = () => {
        el.classList.remove('hcs-fx-hidden');
        const bloom = el.animate([
            { opacity: 0, transform: 'scale(0.94)' },
            { opacity: 1, transform: 'none' }
        ], { duration: BLOOM_MS, easing: EASE_GLIDE });
        bloom.id = 'hcs-bloom';
        const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: 120, fill: 'forwards' });
        fade.onfinish = () => ghost.remove();
        const r = portrait.getBoundingClientRect();
        if (climb && el.classList.contains('hcs-figure')) {
            sparkle(list, centre(r).x, centre(r).y, { count: 14, colors: GOLD, spread: r.width * 0.9 });
            sparkle(list, centre(r).x, centre(r).y, { count: 1, shape: 'ring', colors: ['#fde68a'], size: 18, spread: r.width * 0.8, duration: 700 });
        } else if (climb) {
            sparkle(list, centre(r).x, centre(r).y, { count: 8, colors: GOLD, spread: r.width * 0.8, size: 7 });
        } else {
            sparkle(list, centre(r).x, r.bottom, { count: 6, colors: ['#e0e7ff', '#ddd6fe'], shape: 'dot', spread: 22, rise: 6, size: 5 });
        }
        onLand?.();
    };
    flight.onfinish = land;
    flight.oncancel = () => {
        el.classList.remove('hcs-fx-hidden');
        ghost.remove();
    };
    return total + delay + BLOOM_MS;
}

/** The old card fades where it stood (it left the board, or changed shape). */
function fadeGhost(list, oldEl, rect, { quick = false } = {}) {
    if (!visible(rect)) return;
    const ghost = oldEl.cloneNode(true);
    ghost.classList.add('hcs-fx-ghost');
    ghost.querySelectorAll('[data-hcs-mover]').forEach((m) => { m.style.visibility = 'hidden'; });
    pin(layerOf(list), ghost, rect);
    const anim = ghost.animate([
        { opacity: 1, transform: 'none', filter: 'none' },
        { opacity: 0, transform: quick ? 'scale(0.97)' : 'translateY(10px) scale(0.94)', filter: 'blur(1px)' }
    ], { duration: quick ? 260 : 520, easing: 'ease-in', fill: 'forwards' });
    anim.onfinish = () => ghost.remove();
    anim.oncancel = () => ghost.remove();
}

function holdShow(list, ms) {
    list.__hcsShowUntil = Math.max(list.__hcsShowUntil || 0, performance.now() + ms);
}

// --- Live updates ----------------------------------------------------------------

/**
 * Same board, fresh data: the markup is laid over the board in place, then
 * every hero who moved glides (or hops) from where they stood, stars count
 * up, and badges that came or went play their effect. While a show is still
 * playing, the update waits for it and lands right after.
 */
export function updateStandings(list, html) {
    if (!list) return;
    if (reducedMotion()) {
        morphStandingsList(list, html);
        return;
    }
    const wait = (list.__hcsShowUntil || 0) - performance.now();
    if (wait > 0) {
        list.__hcsPending = html;
        if (!list.__hcsPendingTimer) {
            list.__hcsPendingTimer = setTimeout(() => {
                list.__hcsPendingTimer = 0;
                const next = list.__hcsPending;
                list.__hcsPending = null;
                if (next && list.isConnected) updateStandings(list, next);
            }, wait + 40);
        }
        return;
    }
    list.__hcsPending = null;

    const before = measure(list);
    before.movers.forEach(({ el }) => stopMotion(el));
    morphStandingsList(list, html);
    const after = measure(list);
    let longest = 0;

    // A node that was moved or newly added would replay the board's entrance
    // (it starts over when it joins the page): set it to the same point the
    // rest of the board is at, so it is simply there.
    if (list.classList.contains('hcs-list--enter')) {
        const at = list.__hcsEnterAt ? performance.now() - list.__hcsEnterAt : 99999;
        const skip = `${Math.round(Math.max(0, at))}ms`;
        after.movers.forEach(({ el }) => el.style.setProperty('--hcs-skip', skip));
        after.pedestals.forEach(({ el }) => el.parentElement.style.setProperty('--hcs-skip', skip));
        after.badges.forEach(({ el }, key) => { if (!before.badges.has(key)) el.style.setProperty('--hcs-skip', skip); });
    }

    const glided = new Map();
    after.movers.forEach((now, key) => {
        const was = before.movers.get(key);
        const { el } = now;
        if (!was) {
            // New on this board: rises in.
            const anim = el.animate([
                { opacity: 0, transform: 'translateY(18px) scale(0.96)' },
                { opacity: 1, transform: 'none' }
            ], { duration: 560, delay: 160, easing: EASE_GLIDE, fill: 'backwards' });
            anim.id = 'hcs-bloom';
            glided.set(key, { type: 'new', end: 720 });
            longest = Math.max(longest, 720);
            return;
        }
        const climb = now.slot < was.slot;
        const countUpNow = () => {
            const c = el.querySelector('[data-hcs-count]');
            if (c && was.count !== undefined && was.count !== c.dataset.to) {
                c.closest('.hcs-figure__stars, .hcs-row__stars')?.classList.add('hcs-ticking');
                countUp(c, Number(was.count), Number(c.dataset.to), 800);
                setTimeout(() => c.closest('.hcs-ticking')?.classList.remove('hcs-ticking'), 1000);
            }
        };
        if (was.kind !== now.kind) {
            if (was.el !== el) fadeGhost(list, was.el, was.rect, { quick: true });
            const end = hop(list, el, was.portraitRect, { climb, onLand: countUpNow });
            glided.set(key, { type: 'hop', end });
            longest = Math.max(longest, end);
            return;
        }
        countUpNow();
        const a = centre(was.rect);
        const b = centre(now.rect);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            glided.set(key, { type: 'still', dx: 0, dy: 0, end: 0 });
            return;
        }
        const moved = now.slot !== was.slot;
        const end = glide(el, dx, dy, {
            climb: moved && climb,
            onLand: moved && climb ? () => {
                el.classList.add('hcs-landed');
                setTimeout(() => el.classList.remove('hcs-landed'), 1400);
            } : null
        });
        glided.set(key, { type: 'glide', dx, dy, end });
        longest = Math.max(longest, end);
    });

    // Heroes who left the board fade where they stood.
    before.movers.forEach((was, key) => {
        if (!after.movers.has(key)) fadeGhost(list, was.el, was.rect);
    });

    // Pedestals slide to their new places, rise when new, sink when gone.
    after.pedestals.forEach((now, key) => {
        const was = before.pedestals.get(key);
        if (!was) {
            now.el.animate([
                { opacity: 0, transform: 'translateY(26px) scaleY(0.7)' },
                { opacity: 1, transform: 'none' }
            ], { duration: 620, easing: EASE_GLIDE, fill: 'backwards' }).id = 'hcs-flip';
            return;
        }
        const dx = centre(was.rect).x - centre(now.rect).x;
        const dy = centre(was.rect).y - centre(now.rect).y;
        const sx = was.rect.width / Math.max(1, now.rect.width);
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01) return;
        now.el.animate([
            { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scaleX(${sx.toFixed(3)})` },
            { transform: 'none' }
        ], { duration: glideTime(Math.hypot(dx, dy)), easing: EASE_GLIDE }).id = 'hcs-flip';
    });
    before.pedestals.forEach((was, key) => {
        if (after.pedestals.has(key)) return;
        const ghost = was.el.cloneNode(true);
        ghost.classList.add('hcs-fx-ghost');
        pin(layerOf(list), ghost, was.rect);
        const anim = ghost.animate([
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateY(30px) scaleY(0.6)' }
        ], { duration: 560, easing: 'ease-in', fill: 'forwards' });
        anim.onfinish = () => ghost.remove();
    });

    // Badges.
    after.badges.forEach((now, key) => {
        const [sid, owner] = key.split('|');
        const ownerMotion = owner.startsWith('id:') ? glided.get(`${sid}|${owner.slice(3)}`) : null;
        const was = before.badges.get(key);
        if (!was) {
            if (ownerMotion?.type === 'new') return;
            const delay = ownerMotion?.type === 'hop' ? ownerMotion.end - BLOOM_MS + 120
                : ownerMotion?.type === 'glide' ? Math.round(ownerMotion.end * 0.6) : 0;
            badgeArrive(list, now.el, Math.max(0, delay));
            longest = Math.max(longest, delay + 900);
            return;
        }
        if (ownerMotion && ownerMotion.type !== 'glide' && ownerMotion.type !== 'still') return;
        // Slide along with neighbours that came or went (relative to the hero).
        const odx = ownerMotion?.dx || 0;
        const ody = ownerMotion?.dy || 0;
        const dx = centre(was.rect).x - centre(now.rect).x - odx;
        const dy = centre(was.rect).y - centre(now.rect).y - ody;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        now.el.animate([
            { translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px` },
            { translate: '0 0' }
        ], { duration: 520, easing: EASE_GLIDE, composite: 'add' }).id = 'hcs-flip';
    });
    before.badges.forEach((was, key) => {
        if (after.badges.has(key)) return;
        const [sid, owner] = key.split('|');
        const ownerMotion = owner.startsWith('id:') ? glided.get(`${sid}|${owner.slice(3)}`) : 'section';
        // A hero who hopped or left takes their old badges along.
        if (!ownerMotion || (ownerMotion !== 'section' && ownerMotion.type !== 'glide' && ownerMotion.type !== 'still')) return;
        badgeLeave(list, was.el, was.rect);
    });

    if (longest > 0) holdShow(list, longest);
}

// --- The rank-change show on a fresh draw ------------------------------------------

/**
 * The show for a board drawn fresh (a new visit, another board): heroes start
 * where they stood at the last look, stars count up, then everyone glides to
 * the new place. Heroes who changed shape hop portrait first; badges earned
 * since the last look arrive as everyone lands.
 */
export function playStandingsShow(list, sections) {
    list.__hcsPending = null;
    if (reducedMotion()) {
        playStandingsChanges(list, sections);
        return;
    }
    // Shape changers are taken out of the plain show before it measures.
    const hops = [];
    list.querySelectorAll('[data-hcs-section]').forEach((sectionEl) => {
        if (sectionEl.classList.contains('hcs-section--sealed')) return;
        const movers = [...sectionEl.querySelectorAll('[data-hcs-mover]')];
        const bySlot = [];
        movers.forEach((m) => { bySlot[Number(m.dataset.hcsSlot)] = m; });
        movers.forEach((m) => {
            const slot = Number(m.dataset.hcsSlot);
            const from = Number(m.dataset.hcsFrom);
            const there = from >= 0 ? bySlot[from] : null;
            if (from === slot || !there || moverKind(there) === moverKind(m)) return;
            const p = portraitOf(there);
            hops.push({ m, fromRect: (p || there).getBoundingClientRect(), climb: from > slot });
        });
    });
    hops.forEach(({ m }) => {
        // The plain show leaves it alone: it hops instead.
        m.dataset.hcsFromHop = m.dataset.hcsFrom;
        m.dataset.hcsFrom = m.dataset.hcsSlot;
    });
    const counters = hops.map(({ m }) => m.querySelector('[data-hcs-count]')).filter(Boolean);
    const counts = counters.map((c) => [c.dataset.from, c.dataset.to]);
    counters.forEach((c) => { c.dataset.from = c.dataset.to; });

    playStandingsChanges(list, sections);

    hops.forEach(({ m, fromRect, climb }, i) => {
        const c = m.querySelector('[data-hcs-count]');
        const pair = counts[counters.indexOf(c)];
        if (c && pair) c.textContent = c.dataset.from;
        hop(list, m, fromRect, {
            climb,
            hold: 1350,
            delay: Math.min(i, 4) * 60,
            onLand: () => {
                if (c && pair && pair[0] !== pair[1]) countUp(c, Number(pair[0]), Number(pair[1]), 700);
            }
        });
    });
    revealNewBadges(list, sections, 2450);
    holdShow(list, 3300);
}

/** Plain entrance, then badges earned since the last look arrive. */
export function afterStandingsEntrance(list, sections) {
    list.__hcsPending = null;
    revealNewBadges(list, sections, 1500);
}

/** A full redraw replaced the board: anything waiting is stale now. */
export function resetStandingsMotion(list) {
    if (!list) return;
    list.__hcsPending = null;
    list.__hcsShowUntil = 0;
}
