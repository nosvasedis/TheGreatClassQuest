/**
 * Illustrated "no lessons today" banner for the Home tab's School Schedule.
 * Each rest state (camp, weekend, holiday, winter, spring, summer, sealed year, and the
 * school calendar's own holidays: national, remembrance, kites, flowers, dove, local)
 * paints its own little CSS scene; styles live in styles/schedule_rest.css.
 */

import { describeSchoolDay } from './schoolCalendar.mjs';
// The school-calendar scenes and the special-day note load with this module, off the first-paint
// stylesheet (the base scenes are in schedule_rest.css). Skipped outside the browser (node tests).
if (typeof document !== 'undefined') {
    import('../styles/schedule_holidays.css');
    import('../styles/schedule_weekend.css');
}

const SCENES = new Set(['camp', 'weekend', 'holiday', 'winter', 'spring', 'summer', 'sealed', 'national', 'remembrance', 'kites', 'flowers', 'dove', 'local']);

const escapeText = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Spans placed from a list of [x%, y%, extra CSS vars] tuples. */
const placed = (className, points) => points.map(([x, y, vars = '']) =>
    `<span class="${className}" style="--x:${x}%;--y:${y}%;${vars}"></span>`
).join('');

const STARS = [
    [8, 12, '--d:0s'], [18, 30, '--d:1.2s'], [30, 9, '--d:.6s'], [44, 22, '--d:2s'],
    [56, 8, '--d:1.6s'], [66, 26, '--d:.3s'], [78, 14, '--d:2.4s'], [90, 32, '--d:1s'],
    [36, 36, '--d:2.8s'], [96, 6, '--d:.9s']
];

const EMBERS = [[46, 0, '--d:0s'], [52, 0, '--d:.8s'], [49, 0, '--d:1.5s'], [55, 0, '--d:2.2s']];

const SNOW = Array.from({ length: 22 }, (_, i) => [
    (i * 37 + 11) % 100,
    0,
    `--d:${((i * 0.73) % 5).toFixed(2)}s;--t:${6 + (i % 4) * 1.5}s;--s:${3 + (i % 3) * 2}px`
]);

const CONFETTI = Array.from({ length: 14 }, (_, i) => [
    (i * 29 + 7) % 100,
    0,
    `--d:${((i * 0.61) % 4).toFixed(2)}s;--t:${5 + (i % 3) * 1.4}s;--c:var(--rs-confetti-${(i % 4) + 1})`
]);

// Pennants hang along the bunting string: the lower half of an ellipse whose
// box runs -2%..102% wide and -18px..42px tall (see .rs-bunting::before).
const FLAGS = Array.from({ length: 11 }, (_, i) => {
    const x = 4 + i * 9.2;
    const u = (x - 50) / 52;
    const y = -18 + 60 * Math.sqrt(Math.max(0, 1 - u * u));
    return `<span class="rs-flag" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}px;--c:var(--rs-confetti-${(i % 4) + 1});--d:${(i * 0.23).toFixed(2)}s"></span>`;
}).join('');

// Blue and white pennants for the national holidays.
const GREEK_FLAGS = Array.from({ length: 11 }, (_, i) => {
    const x = 4 + i * 9.2;
    const u = (x - 50) / 52;
    const y = -18 + 60 * Math.sqrt(Math.max(0, 1 - u * u));
    return `<span class="rs-flag" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}px;--c:${i % 2 ? '#ffffff' : '#0d5eaf'};--d:${(i * 0.23).toFixed(2)}s"></span>`;
}).join('');

// The May Day wreath: flowers set round a circle.
const MAY_WREATH = Array.from({ length: 12 }, (_, i) => {
    const colours = ['#f472b6', '#facc15', '#fb7185', '#a78bfa'];
    return `<span class="rs-may-wreath__bloom" style="--a:${i * 30}deg;--c:${colours[i % 4]}"></span>`;
}).join('');

const pines = (...positions) => positions.map(([x, h]) =>
    `<span class="rs-pine" style="--x:${x}%;--h:${h}px"></span>`
).join('');

// ---------- Weekend Break: one painting per month (styles/schedule_weekend.css) ----------

/** Falling leaves / petals spread over the width; `colours` cycle. */
const drifting = (count, colours, seed = 0) => Array.from({ length: count }, (_, i) => [
    ((i + seed) * 41 + 9) % 100,
    0,
    `--d:${(((i + seed) * 0.97) % 8).toFixed(2)}s;--t:${8 + ((i + seed) % 4) * 1.6}s;--c:${colours[i % colours.length]};--r:${(i % 2 ? 1 : -1) * (200 + (i % 3) * 120)}deg`
]);

const trees = (...list) => list.map(([dx, h, crown, extra = '']) =>
    `<span class="rs-tree${extra}" style="--dx:${dx}px;--h:${h}px;--crown:${crown}"><span class="rs-tree__crown"></span></span>`
).join('');

// Fairy lights hang along a sagging string near the top of the card (December).
const BULBS = Array.from({ length: 15 }, (_, i) => {
    const x = 3 + i * 6.8;
    const u = (x - 50) / 52;
    const y = 4 + 26 * Math.sqrt(Math.max(0, 1 - u * u));
    const colours = ['#f87171', '#facc15', '#4ade80', '#60a5fa', '#f472b6'];
    return `<span class="rs-bulb" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}px;--c:${colours[i % 5]};--d:${((i * 0.37) % 2.4).toFixed(2)}s"></span>`;
}).join('');

const TREE_LIGHTS = [[50, 30, '#facc15', '0s'], [38, 50, '#f87171', '.5s'], [62, 46, '#60a5fa', '1s'], [30, 74, '#4ade80', '1.4s'], [52, 66, '#f472b6', '.8s'], [70, 76, '#facc15', '1.8s'], [44, 86, '#60a5fa', '.3s']]
    .map(([x, y, c, d]) => `<span class="rs-xtree__light" style="--x:${x}%;--y:${y}%;--c:${c};--d:${d}"></span>`).join('');

const GRAPES = (dx, bottom, colour) => `<span class="rs-grapes" style="--dx:${dx}px;--b:${bottom}px;--c:${colour}"></span>`;

const WEEKEND_ART = {
    jan: () => `
        <span class="rs-sun rs-sun--pale"></span>
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-hill rs-hill--far"></span>
        ${pines([8, 70], [16, 92], [86, 82], [94, 60])}
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-snowman"><span class="rs-snowman__head"></span><span class="rs-snowman__hat"></span><span class="rs-snowman__scarf"></span><span class="rs-snowman__arm"></span></span>
        ${placed('rs-snow', SNOW.slice(0, 16))}`,
    feb: () => `
        <span class="rs-sun rs-sun--pale"></span>
        <span class="rs-mountain rs-mountain--1"></span>
        <span class="rs-mountain rs-mountain--2"></span>
        <span class="rs-hill rs-hill--near"></span>
        ${pines([10, 66], [18, 84], [90, 72])}
        <span class="rs-pond"><span class="rs-pond__glint"></span></span>
        <span class="rs-skates"></span>
        ${placed('rs-snow', SNOW.slice(0, 10))}`,
    mar: () => `
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-kite rs-kite--1 rs-kite--wk"></span>
        <span class="rs-kite-string"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        ${trees([90, 108, '#fbcfe8', ' rs-tree--blossom'], [-120, 84, '#fce7f3', ' rs-tree--blossom'])}
        ${placed('rs-flower', [[12, 0, '--c:#fde047'], [62, 0, '--c:#f9a8d4'], [78, 0, '--c:#fde047']])}
        ${placed('rs-leaf rs-leaf--petal', drifting(12, ['#fbcfe8', '#fff1f2', '#f9a8d4']))}`,
    apr: () => `
        <span class="rs-rainbow"></span>
        <span class="rs-raincloud">${placed('rs-drop', [[14, 0, '--d:0s'], [34, 0, '--d:.45s'], [54, 0, '--d:.9s'], [74, 0, '--d:.25s'], [90, 0, '--d:.7s']])}</span>
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-puddle"><span class="rs-puddle__ring"></span></span>
        ${placed('rs-flower', [[10, 0, '--c:#f472b6'], [22, 0, '--c:#a78bfa'], [60, 0, '--c:#fb7185'], [84, 0, '--c:#facc15'], [93, 0, '--c:#a78bfa']])}
        <span class="rs-butterfly rs-butterfly--1"></span>`,
    may: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        ${trees([150, 96, '#4ade80'])}
        <span class="rs-blanket"></span>
        <span class="rs-basket"><span class="rs-basket__handle"></span></span>
        ${placed('rs-flower', [[6, 0, '--c:#f472b6'], [14, 0, '--c:#facc15'], [24, 0, '--c:#fb7185'], [34, 0, '--c:#a78bfa'], [52, 0, '--c:#f472b6'], [86, 0, '--c:#facc15'], [94, 0, '--c:#fb7185']])}
        <span class="rs-bee rs-bee--1"></span>
        <span class="rs-bee rs-bee--2"></span>
        <span class="rs-butterfly rs-butterfly--2"></span>`,
    jun: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-gull rs-gull--1"></span>
        <span class="rs-gull rs-gull--2"></span>
        <span class="rs-sea"><span class="rs-sea__waves"></span></span>
        <span class="rs-boat"><span class="rs-boat__sail"></span></span>
        <span class="rs-island">
            <span class="rs-house rs-house--1"><span class="rs-house__door"></span></span>
            <span class="rs-house rs-house--2"><span class="rs-house__dome"></span><span class="rs-house__door"></span></span>
            <span class="rs-house rs-house--3"><span class="rs-house__door"></span></span>
        </span>`,
    jul: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-sea"><span class="rs-sea__waves"></span></span>
        <span class="rs-boat"><span class="rs-boat__sail"></span></span>
        <span class="rs-sand"></span>
        <span class="rs-umbrella"><span class="rs-umbrella__pole"></span></span>
        <span class="rs-ball"></span>`,
    aug: () => `
        ${placed('rs-star', STARS)}
        <span class="rs-meteor rs-meteor--1"></span>
        <span class="rs-meteor rs-meteor--2"></span>
        <span class="rs-meteor rs-meteor--3"></span>
        <span class="rs-moon"></span>
        <span class="rs-sea"><span class="rs-sea__waves"></span><span class="rs-sea__moonpath"></span></span>
        <span class="rs-sand"></span>
        <span class="rs-lantern"><span class="rs-lantern__glow"></span></span>`,
    sep: () => `
        <span class="rs-sun rs-sun--low"><span class="rs-sun__rays"></span></span>
        <span class="rs-hill rs-hill--far rs-hill--vines"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-vine rs-vine--1"></span>
        <span class="rs-vine rs-vine--2"></span>
        ${GRAPES(-70, 46, '#7e22ce')}${GRAPES(-22, 40, '#16a34a')}${GRAPES(96, 44, '#7e22ce')}${GRAPES(140, 38, '#6d28d9')}
        <span class="rs-basket rs-basket--grapes"><span class="rs-basket__handle"></span></span>
        ${placed('rs-leaf', drifting(5, ['#eab308', '#a3e635']))}`,
    oct: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-hill rs-hill--far"></span>
        ${trees([-150, 88, '#ea580c'], [130, 110, '#dc2626'], [186, 80, '#f59e0b'])}
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-pumpkin rs-pumpkin--1"></span>
        <span class="rs-pumpkin rs-pumpkin--2"></span>
        <span class="rs-pumpkin rs-pumpkin--3"></span>
        ${placed('rs-leaf', drifting(14, ['#ea580c', '#dc2626', '#f59e0b', '#b45309']))}`,
    nov: () => `
        <span class="rs-cloud rs-cloud--1 rs-cloud--grey"></span>
        <span class="rs-cloud rs-cloud--2 rs-cloud--grey"></span>
        <span class="rs-hill rs-hill--far"></span>
        ${trees([150, 116, '#b45309', ' rs-tree--bare'], [-160, 84, '#92400e', ' rs-tree--bare'])}
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-puddle"></span>
        <span class="rs-cart">
            <span class="rs-cart__glow"></span>
            <span class="rs-cart__pan"></span>
            <span class="rs-cart__wheel"></span>
            <span class="rs-smoke"></span><span class="rs-smoke"></span>
        </span>
        ${placed('rs-leaf', drifting(16, ['#b45309', '#92400e', '#d97706', '#78350f'], 3))}`,
    dec: () => `
        ${placed('rs-star', STARS.slice(0, 7))}
        <span class="rs-lights">${BULBS}</span>
        <span class="rs-hill rs-hill--far"></span>
        ${pines([8, 64], [92, 70])}
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-cabin">
            <span class="rs-cabin__roof"></span>
            <span class="rs-cabin__window"></span>
            <span class="rs-cabin__chimney"><span class="rs-smoke"></span><span class="rs-smoke"></span></span>
        </span>
        <span class="rs-xtree"><span class="rs-xtree__star"></span>${TREE_LIGHTS}<span class="rs-xtree__gift"></span></span>
        ${placed('rs-snow', SNOW)}`,
};

export const WEEKEND_LOOK_KEYS = Object.keys(WEEKEND_ART);

const SCENE_ART = {
    camp: () => `
        ${placed('rs-star', STARS)}
        <span class="rs-moon"></span>
        <span class="rs-hill rs-hill--far"></span>
        ${pines([6, 70], [14, 92], [84, 84], [93, 64])}
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-tent"><span class="rs-tent__door"></span></span>
        <span class="rs-fire">
            <span class="rs-fire__glow"></span>
            <span class="rs-flame rs-flame--back"></span>
            <span class="rs-flame rs-flame--mid"></span>
            <span class="rs-flame rs-flame--core"></span>
            <span class="rs-fire__logs"></span>
            ${placed('rs-ember', EMBERS)}
        </span>`,
    weekend: (emptyState) => (WEEKEND_ART[emptyState?.look] || WEEKEND_ART.jul)(),
    summer: () => `
        <span class="rs-sun rs-sun--setting"><span class="rs-sun__rays"></span></span>
        <span class="rs-gull rs-gull--1"></span>
        <span class="rs-gull rs-gull--2"></span>
        <span class="rs-sea"><span class="rs-sea__waves"></span><span class="rs-sea__glint"></span></span>
        <span class="rs-sand"></span>
        <span class="rs-palm"><span class="rs-palm__trunk"></span><span class="rs-palm__crown"></span></span>`,
    holiday: () => `
        <span class="rs-bunting">${FLAGS}</span>
        ${placed('rs-confetti', CONFETTI)}
        <span class="rs-balloon rs-balloon--1"></span>
        <span class="rs-balloon rs-balloon--2"></span>
        <span class="rs-balloon rs-balloon--3"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>`,
    winter: () => `
        ${placed('rs-star', STARS.slice(0, 6))}
        <span class="rs-moon"></span>
        <span class="rs-hill rs-hill--far"></span>
        ${pines([8, 66], [17, 88], [88, 76])}
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-cabin">
            <span class="rs-cabin__roof"></span>
            <span class="rs-cabin__window"></span>
            <span class="rs-cabin__chimney"><span class="rs-smoke"></span><span class="rs-smoke"></span></span>
        </span>
        ${placed('rs-snow', SNOW)}`,
    spring: () => `
        <span class="rs-rainbow"></span>
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        ${placed('rs-flower', [[14, 0, '--c:#f472b6'], [26, 0, '--c:#facc15'], [70, 0, '--c:#a78bfa'], [82, 0, '--c:#fb7185'], [92, 0, '--c:#facc15']])}
        <span class="rs-butterfly rs-butterfly--1"></span>
        <span class="rs-butterfly rs-butterfly--2"></span>`,
    // School-calendar holidays (utils/schoolCalendar.mjs themes)
    national: () => `
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-bunting rs-bunting--greek">${GREEK_FLAGS}</span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-greek-flag"><span class="rs-greek-flag__pole"></span><span class="rs-greek-flag__cloth"><span class="rs-greek-flag__canton"></span></span></span>
        <span class="rs-dove rs-dove--1"></span>
        <span class="rs-dove rs-dove--2"></span>`,
    remembrance: () => `
        ${placed('rs-star', STARS.slice(0, 7))}
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-wreath"></span>
        <span class="rs-candle rs-candle--vigil"><span class="rs-candle__flame"></span><span class="rs-candle__halo"></span></span>
        <span class="rs-dove rs-dove--1"></span>`,
    kites: () => `
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-kite rs-kite--1"></span>
        <span class="rs-kite rs-kite--2"></span>
        <span class="rs-kite rs-kite--3"></span>`,
    flowers: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-may-wreath">${MAY_WREATH}</span>
        ${placed('rs-flower', [[8, 0, '--c:#f472b6'], [18, 0, '--c:#facc15'], [28, 0, '--c:#fb7185'], [80, 0, '--c:#a78bfa'], [90, 0, '--c:#f472b6']])}
        <span class="rs-butterfly rs-butterfly--1"></span>`,
    dove: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-dove rs-dove--1"></span>
        <span class="rs-dove rs-dove--2"></span>
        <span class="rs-sea"><span class="rs-sea__waves"></span></span>
        <span class="rs-boat"><span class="rs-boat__sail"></span></span>
        <span class="rs-sand"></span>`,
    local: () => `
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-hill rs-hill--far"></span>
        <span class="rs-hill rs-hill--near"></span>
        <span class="rs-chapel"><span class="rs-chapel__dome"></span><span class="rs-chapel__bell"></span><span class="rs-chapel__door"></span></span>
        <span class="rs-bunting">${FLAGS}</span>`,
    sealed: () => `
        <span class="rs-desk"></span>
        <span class="rs-candle"><span class="rs-candle__flame"></span><span class="rs-candle__halo"></span></span>
        <span class="rs-scroll">
            <span class="rs-scroll__roll rs-scroll__roll--top"></span>
            <span class="rs-scroll__lines"></span>
            <span class="rs-scroll__roll rs-scroll__roll--bottom"></span>
            <span class="rs-scroll__ribbon"></span>
            <span class="rs-seal">✦</span>
        </span>
        <span class="rs-quill"></span>`
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** "Tomorrow", "Monday" (within a week) or "Mon 14 Sep". */
export function formatNextLessonLabel(nextLesson) {
    const date = parseIsoDate(nextLesson?.date);
    if (!date) return '';
    const inDays = Number(nextLesson.inDays) || Math.round((date - new Date().setHours(0, 0, 0, 0)) / DAY_MS);
    if (inDays === 1) return 'Tomorrow';
    if (inDays > 1 && inDays < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' });
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function nextLessonHtml(emptyState) {
    const label = formatNextLessonLabel(emptyState?.nextLesson);
    if (!label) return '';
    const lead = emptyState.scene === 'summer' ? 'Quests resume' : 'Next quest';
    return `
        <span class="rest-scene__next">
            <i class="fas fa-compass" aria-hidden="true"></i>
            <span>${lead}</span>
            <strong>${escapeText(label)}</strong>
        </span>`;
}

/**
 * Markup for the empty School Schedule. `compact` is the phone layout
 * (art on top, words below); desktop places the words on a plaque beside the art.
 */
export function buildScheduleEmptySceneHtml(emptyState, { compact = false } = {}) {
    const scene = SCENES.has(emptyState?.scene) ? emptyState.scene : 'camp';
    const classes = ['rest-scene', `rest-scene--${scene}`];
    if (scene === 'weekend') classes.push(`rest-scene--wk-${WEEKEND_ART[emptyState?.look] ? emptyState.look : 'jul'}`);
    if (compact) classes.push('rest-scene--compact');

    return `
    <section class="${classes.join(' ')}" data-rest-kind="${escapeText(emptyState?.kind || 'heroes_camp')}"
        aria-label="${escapeText(emptyState?.title || 'No lessons today')}">
        <div class="rest-scene__art" aria-hidden="true">${SCENE_ART[scene](emptyState)}</div>
        <div class="rest-scene__copy">
            <span class="rest-scene__eyebrow">
                <span class="rest-scene__emoji">${escapeText(emptyState?.icon || '⛺')}</span>
                ${escapeText(emptyState?.eyebrow || 'No lessons today')}
            </span>
            <h4 class="rest-scene__title font-title">${escapeText(emptyState?.title || "Heroes' Camp")}</h4>
            ${emptyState?.subtitle ? `<p class="rest-scene__subtitle" lang="el">${escapeText(emptyState.subtitle)}</p>` : ''}
            <p class="rest-scene__message">${escapeText(emptyState?.message || '')}</p>
            ${nextLessonHtml(emptyState)}
        </div>
    </section>`;
}

/**
 * A slim note above today's lesson cards when the day is special but lessons run:
 * a marked day (Halloween, Three Hierarchs…), a holiday the school opened for,
 * the last lessons before a break, or the first ones back. Empty string otherwise.
 */
export function buildScheduleDayNoteHtml(dateLike = new Date(), { compact = false } = {}) {
    const info = describeSchoolDay(dateLike);
    if (info.closure) return '';
    const special = info.headline && info.headline.key ? info.headline : null;
    const edge = info.breakEdge;
    if (!special && !edge) return '';
    const bits = [];
    if (special) {
        const opened = special.kind === 'closure' || special.kind === 'local';
        bits.push(`
            <span class="schedule-day-note__icon" aria-hidden="true">${escapeText(special.icon)}</span>
            <span class="schedule-day-note__text">
                <strong>${escapeText(special.name)}</strong>${special.nameEl && special.nameEl !== special.name ? ` <span lang="el">· ${escapeText(special.nameEl)}</span>` : ''}
                <small>${escapeText(opened ? 'A holiday, but your school is open today. Lessons as normal.' : special.blurb)}</small>
            </span>`);
    }
    if (edge) {
        const name = edge.range?.name || 'the break';
        bits.push(`<span class="schedule-day-note__edge schedule-day-note__edge--${edge.edge}">${edge.edge === 'last-before'
            ? `🎒 Last lessons before ${escapeText(name)}`
            : `🔔 Welcome back from ${escapeText(name)}!`}</span>`);
    }
    const theme = special?.theme || (edge?.edge === 'back-from' ? 'back' : 'edge');
    const vars = special?.colors
        ? ` style="--sdn-a:${escapeText(special.colors[0])};--sdn-b:${escapeText(special.colors[1])};--sdn-ink:${escapeText(special.colors[2])};--sdn-line:${escapeText(special.colors[2])}55"`
        : '';
    const watermark = special?.colors ? `<span class="schedule-day-note__watermark" aria-hidden="true">${escapeText(special.icon)}</span>` : '';
    return `<div class="schedule-day-note schedule-day-note--${escapeText(theme)}${special?.colors ? ' schedule-day-note--celebration' : ''}${compact ? ' schedule-day-note--compact' : ''}"${vars} role="note">${watermark}${bits.join('')}</div>`;
}
