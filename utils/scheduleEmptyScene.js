/**
 * Illustrated "no lessons today" banner for the Home tab's School Schedule.
 * Each rest state (camp, weekend, holiday, winter, spring, summer, sealed year)
 * paints its own little CSS scene; styles live in styles/schedule_rest.css.
 */

const SCENES = new Set(['camp', 'weekend', 'holiday', 'winter', 'spring', 'summer', 'sealed']);

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
            <p class="rest-scene__message">${escapeText(emptyState?.message || '')}</p>
            ${nextLessonHtml(emptyState)}
        </div>
    </section>`;
}
