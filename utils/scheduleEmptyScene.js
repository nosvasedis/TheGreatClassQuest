/**
 * Illustrated "no lessons today" banner for the Home tab's School Schedule.
 * Each rest state (camp, weekend, holiday, winter, spring, summer, sealed year, and the
 * school calendar's own holidays: national, remembrance, kites, flowers, dove, local)
 * paints its own little CSS scene; styles live in styles/schedule_rest.css.
 */

import { describeSchoolDay, toIsoDay } from './schoolCalendar.mjs';
// The school-calendar scenes and the special-day note load with this module, off the first-paint
// stylesheet (the base scenes are in schedule_rest.css). Skipped outside the browser (node tests).
if (typeof document !== 'undefined') import('../styles/schedule_holidays.css');

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
    weekend: () => `
        <span class="rs-sun"><span class="rs-sun__rays"></span></span>
        <span class="rs-cloud rs-cloud--1"></span>
        <span class="rs-cloud rs-cloud--2"></span>
        <span class="rs-sea"><span class="rs-sea__waves"></span></span>
        <span class="rs-boat"><span class="rs-boat__sail"></span></span>
        <span class="rs-sand"></span>
        <span class="rs-umbrella"><span class="rs-umbrella__pole"></span></span>
        <span class="rs-ball"></span>`,
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
    if (compact) classes.push('rest-scene--compact');

    return `
    <section class="${classes.join(' ')}" data-rest-kind="${escapeText(emptyState?.kind || 'heroes_camp')}"
        aria-label="${escapeText(emptyState?.title || 'No lessons today')}">
        <div class="rest-scene__art" aria-hidden="true">${SCENE_ART[scene]()}</div>
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

function relativeDayLabel(dateLike, specialIso) {
    const from = toIsoDay(dateLike);
    const gap = Math.round((Date.parse(`${specialIso}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
    if (gap === 1) return 'Tomorrow';
    if (gap === -1) return 'It was yesterday';
    return gap > 0 ? `In ${gap} days` : `${-gap} days ago`;
}

/**
 * A slim note above today's lesson cards when the day is special but lessons run:
 * a marked day (Halloween, Three Hierarchs…), a holiday the school opened for,
 * the last lessons before a break, or the first ones back. Empty string otherwise.
 */
export function buildScheduleDayNoteHtml(dateLike = new Date(), { compact = false, treasures = [] } = {}) {
    const info = describeSchoolDay(dateLike);
    if (info.closure) return '';
    let special = info.headline && info.headline.key ? info.headline : null;
    const edge = info.breakEdge;
    // A treasure from a special day close by (Halloween on Saturday, opened on Thursday) brings its day along.
    let treasureDay = null;
    if (!special && treasures.length) {
        treasureDay = describeSchoolDay(treasures[0].specialIso).headline || null;
        special = treasureDay && treasureDay.key ? treasureDay : null;
    }
    if (!special && !edge) return '';
    const bits = [];
    if (special) {
        const opened = special.kind === 'closure' || special.kind === 'local';
        bits.push(`
            <span class="schedule-day-note__icon" aria-hidden="true">${escapeText(special.icon)}</span>
            <span class="schedule-day-note__text">
                <strong>${escapeText(special.name)}</strong>${special.nameEl && special.nameEl !== special.name ? ` <span lang="el">· ${escapeText(special.nameEl)}</span>` : ''}
                <small>${escapeText(treasureDay
                    ? `${relativeDayLabel(dateLike, treasures[0].specialIso)}. Its treasure opens in today's lessons.`
                    : (opened ? 'A holiday, but your school is open today. Lessons as normal.' : special.blurb))}</small>
            </span>`);
    }
    if (edge) {
        const name = edge.range?.name || 'the break';
        bits.push(`<span class="schedule-day-note__edge schedule-day-note__edge--${edge.edge}">${edge.edge === 'last-before'
            ? `🎒 Last lessons before ${escapeText(name)}`
            : `🔔 Welcome back from ${escapeText(name)}!`}</span>`);
    }
    // The day's treasure chests planned for your classes (features/dayTreasure.js opens them).
    if (special && treasures.length) {
        const groups = new Map();
        treasures.forEach((t) => groups.set(t.id, [...(groups.get(t.id) || []), t]));
        bits.push([...groups.values()].map((items) => `
            <span class="schedule-day-note__treasures">
                <span class="schedule-day-note__treasure-name"><span aria-hidden="true">🧰</span> ${escapeText(items[0].name)}</span>
                ${items.map((t) => `
                <button type="button" class="schedule-day-note__treasure${t.opened ? ' is-opened' : ''}" data-day-treasure="${escapeText(t.id)}" data-day-treasure-class="${escapeText(t.classId || '')}" aria-label="${escapeText(t.opened ? `See ${t.name} again for ${t.classLabel}` : `Open ${t.name} for ${t.classLabel}`)}">
                    <span>${escapeText(t.classLabel || 'Your class')}</span>
                    <small>${t.opened ? '🪙 opened' : 'open'}</small>
                </button>`).join('')}
            </span>`).join(''));
    }
    const theme = special?.theme || (edge?.edge === 'back-from' ? 'back' : 'edge');
    const vars = special?.colors
        ? ` style="--sdn-a:${escapeText(special.colors[0])};--sdn-b:${escapeText(special.colors[1])};--sdn-ink:${escapeText(special.colors[2])};--sdn-line:${escapeText(special.colors[2])}55"`
        : '';
    const watermark = special?.colors ? `<span class="schedule-day-note__watermark" aria-hidden="true">${escapeText(special.icon)}</span>` : '';
    return `<div class="schedule-day-note schedule-day-note--${escapeText(theme)}${special?.colors ? ' schedule-day-note--celebration' : ''}${compact ? ' schedule-day-note--compact' : ''}"${vars} role="note">${watermark}${bits.join('')}</div>`;
}
