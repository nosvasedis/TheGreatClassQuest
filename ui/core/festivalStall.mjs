// ui/core/festivalStall.mjs — the Festival Stall's own dressing: a celebration marquee with
// bunting, drifting sky decorations and a countdown, plus themed wares. Pure markup (no
// Firebase / state), shared by ui/core/shop.js and festival-stall-preview.html.
// Everything that moves is a transform or opacity. .mm-fest--lite (low-power machines) and
// reduced motion keep the decorations still; .is-offscreen pauses them while scrolled away.
// Styles: styles/festival_stall.css (imported by ui/core/shop.js, so it loads with the Market)
import { escapeShopHtml, renderShelf, renderShopItemCard } from './marketView.mjs';
import { shopZonedParts } from '../../utils/shopCalendar.js';

// One look per celebration in utils/shopCalendar.js. `sky` lists the decorations that drift
// across the marquee: an emoji, or a CSS shape (confetti, snow, spark, petal).
export const FESTIVAL_STALL_LOOKS = {
    halloween: {
        icon: 'fa-ghost',
        emblem: '🎃',
        eyebrow: 'Spooky Season',
        greeting: 'Happy Halloween!',
        colors: { accent: '#fb923c', accent2: '#a855f7', deep: '#1d0b33', glow: 'rgba(251, 146, 60, 0.55)', ink: '#fff4e6' },
        bunting: ['#f97316', '#1f1033', '#a855f7', '#84cc16'],
        motion: 'flutter',
        sky: ['🦇', '🍂', 'spark', '🦇', '👻', 'spark', '🍂', '🦇', 'spark', '🍬']
    },
    christmas: {
        icon: 'fa-tree',
        emblem: '🎄',
        eyebrow: 'Festive Season',
        greeting: 'Merry Christmas!',
        colors: { accent: '#f87171', accent2: '#4ade80', deep: '#0b2a1f', glow: 'rgba(250, 204, 21, 0.5)', ink: '#fffbeb' },
        bunting: ['#ef4444', '#facc15', '#22c55e', '#60a5fa'],
        string: 'lights',
        motion: 'fall',
        sky: ['snow', 'snow', '⭐', 'snow', 'snow', '❄️', 'snow', 'snow', 'snow', '❄️', 'snow', 'snow']
    },
    newyear: {
        icon: 'fa-clover',
        emblem: '🍀',
        eyebrow: 'Lucky New Year',
        greeting: 'Happy New Year!',
        colors: { accent: '#fbbf24', accent2: '#f43f5e', deep: '#14123a', glow: 'rgba(251, 191, 36, 0.55)', ink: '#fffbeb' },
        bunting: ['#fbbf24', '#fb7185', '#fde68a', '#f59e0b'],
        string: 'lights',
        motion: 'rise',
        sky: ['spark', '🪙', 'spark', 'spark', '✨', 'spark', '🪙', 'spark', 'spark', '✨']
    },
    carnival: {
        icon: 'fa-masks-theater',
        emblem: '🎭',
        eyebrow: 'Apokries',
        greeting: 'Happy Carnival!',
        colors: { accent: '#f472b6', accent2: '#2dd4bf', deep: '#2a0b3a', glow: 'rgba(244, 114, 182, 0.55)', ink: '#fdf4ff' },
        bunting: ['#ec4899', '#facc15', '#14b8a6', '#8b5cf6', '#f97316'],
        motion: 'fall',
        sky: ['confetti', 'confetti', 'confetti', '🎉', 'confetti', 'confetti', 'confetti', 'confetti', '🪁', 'confetti', 'confetti', 'confetti']
    },
    easter: {
        icon: 'fa-egg',
        emblem: '🥚',
        eyebrow: 'Easter in Spring',
        greeting: 'Happy Easter!',
        colors: { accent: '#f87171', accent2: '#a3e635', deep: '#2b1414', glow: 'rgba(253, 224, 71, 0.45)', ink: '#fff7ed' },
        bunting: ['#dc2626', '#fef3c7', '#65a30d', '#fde047'],
        motion: 'drift',
        sky: ['petal', '🦋', 'petal', '🌸', 'petal', 'petal', '🐣', 'petal', '🌸', 'petal']
    },
    mayday: {
        icon: 'fa-seedling',
        emblem: '🌼',
        eyebrow: 'Protomagia',
        greeting: 'Happy May Day!',
        colors: { accent: '#facc15', accent2: '#f87171', deep: '#0f2a1a', glow: 'rgba(250, 204, 21, 0.45)', ink: '#fefce8' },
        bunting: ['#ef4444', '#fefce8', '#facc15', '#22c55e', '#c084fc'],
        motion: 'drift',
        sky: ['petal', '🦋', 'petal', '🌼', 'petal', '🌺', 'petal', '🦋', 'petal', '🌼']
    },
    endofyear: {
        icon: 'fa-medal',
        emblem: '🏅',
        eyebrow: 'Year of Quests',
        greeting: 'What a year!',
        colors: { accent: '#fbbf24', accent2: '#38bdf8', deep: '#0c1d3a', glow: 'rgba(251, 191, 36, 0.5)', ink: '#f0f9ff' },
        bunting: ['#fbbf24', '#38bdf8', '#ef4444', '#f8fafc'],
        motion: 'fall',
        sky: ['confetti', '⭐', 'confetti', 'confetti', '🎉', 'confetti', 'confetti', '⭐', 'confetti', 'confetti']
    }
};

const FALLBACK_LOOK = {
    icon: 'fa-wand-sparkles',
    emblem: '✨',
    eyebrow: 'Celebration',
    greeting: 'Let\'s celebrate!',
    colors: { accent: '#fb7185', accent2: '#c4b5fd', deep: '#1c1640', glow: 'rgba(251, 113, 133, 0.5)', ink: '#fff1f2' },
    bunting: ['#fb7185', '#fbbf24', '#c4b5fd'],
    motion: 'drift',
    sky: ['spark', 'spark', 'spark', 'spark', 'spark', 'spark']
};

const SHAPES = new Set(['confetti', 'snow', 'spark', 'petal']);

export function festivalStallLook(festival) {
    const id = typeof festival === 'string' ? festival : festival?.id;
    return FESTIVAL_STALL_LOOKS[id] || FALLBACK_LOOK;
}

function ymdNumber({ year, month, day }) {
    return Date.UTC(year, month - 1, day) / 86400000;
}

/** Whole days until the stall closes (0 on its last day), counted in the shop's time zone. */
export function festivalDaysLeft(festival, now = new Date()) {
    if (!festival?.end) return null;
    const today = shopZonedParts(now);
    return Math.max(0, Math.round(ymdNumber(festival.end) - ymdNumber(today)));
}

/** "Last day!", "1 day left", "12 days left", or the greeting on the feast day itself. */
export function festivalCountdown(festival, now = new Date()) {
    const days = festivalDaysLeft(festival, now);
    if (days === null) return { value: '', label: '', last: false, feast: false };
    const today = shopZonedParts(now);
    const feast = festival.feast
        && festival.feast.year === today.year
        && festival.feast.month === today.month
        && festival.feast.day === today.day;
    if (days === 0) return { value: '!', label: 'Last day', last: true, feast };
    return { value: String(days), label: days === 1 ? 'day left' : 'days left', last: days <= 2, feast };
}

// Stable pseudo-random spread, so the sky looks scattered but never jumps between renders.
function spread(index, salt) {
    const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function skyHtml(look) {
    return look.sky.map((piece, index) => {
        const left = Math.round(4 + spread(index, 1) * 92);
        const delay = (-spread(index, 2) * 14).toFixed(1);
        const duration = (9 + spread(index, 3) * 7).toFixed(1);
        const size = (0.8 + spread(index, 4) * 0.7).toFixed(2);
        const hue = look.bunting[index % look.bunting.length];
        const style = `--x:${left}%;--d:${delay}s;--t:${duration}s;--s:${size};--c:${hue};`;
        if (SHAPES.has(piece)) {
            return `<span class="mm-fest__bit mm-fest__bit--${piece}" style="${style}"></span>`;
        }
        return `<span class="mm-fest__bit mm-fest__bit--emoji" style="${style}">${piece}</span>`;
    }).join('');
}

// Flags (or fairy-light bulbs) sit on the string's curve, the quadratic drawn in
// festival_stall.css: y = 3 + 84t(1 - t).
function buntingHtml(look) {
    const lights = look.string === 'lights';
    const count = lights ? 22 : 15;
    const kind = lights ? 'mm-fest__bulb' : 'mm-fest__flag';
    return Array.from({ length: count }, (_, index) => {
        const t = (index + 0.5) / count;
        const y = (2 + 84 * t * (1 - t)).toFixed(1);
        const color = look.bunting[index % look.bunting.length];
        return `<span class="${kind}" style="--c:${color};--i:${index};--t:${t.toFixed(3)};--y:${y};"></span>`;
    }).join('');
}

export function festivalStyle(festival) {
    const { colors } = festivalStallLook(festival);
    return `--fest-accent:${colors.accent};--fest-accent-2:${colors.accent2};--fest-deep:${colors.deep};--fest-glow:${colors.glow};--fest-ink:${colors.ink};`;
}

/** The marquee over the stall: bunting, drifting decorations, emblem, title, tagline and countdown. */
export function renderFestivalMarquee(festival, { now = new Date(), count = 0, preparing = false } = {}) {
    const look = festivalStallLook(festival);
    const name = festival?.name || 'Festival';
    const tagline = festival?.tagline || 'Limited treasures for the celebration';
    const clock = festivalCountdown(festival, now);
    const clockHtml = clock.value
        ? `<div class="mm-fest__clock${clock.last ? ' is-last' : ''}" aria-label="${clock.value === '!' ? 'Last day' : `${clock.value} ${clock.label}`}">
                <span class="mm-fest__clock-num">${clock.value === '!' ? '<i class="fas fa-hourglass-end" aria-hidden="true"></i>' : clock.value}</span>
                <span class="mm-fest__clock-label">${clock.label}</span>
            </div>`
        : '';
    const note = preparing
        ? `The merchant is unpacking the ${escapeShopHtml(name)} treasures. They appear here as their pictures arrive.`
        : `${count ? `${count} limited treasure${count === 1 ? '' : 's'}. ` : ''}Cheaper kinds have more copies; the rarest is truly one of a kind. Everything here vanishes when the celebration ends.`;
    return `
        <div class="mm-fest__marquee">
            <div class="mm-fest__sky" aria-hidden="true">${skyHtml(look)}</div>
            <div class="mm-fest__bunting" aria-hidden="true">${buntingHtml(look)}</div>
            <div class="mm-fest__hero">
                <div class="mm-fest__emblem" aria-hidden="true"><span>${look.emblem}</span></div>
                <div class="mm-fest__words">
                    <p class="mm-fest__eyebrow"><i class="fas ${look.icon}" aria-hidden="true"></i> Festival Stall<span class="mm-fest__eyebrow-more"> · ${escapeShopHtml(look.eyebrow)}</span></p>
                    <h3 class="mm-fest__title font-title">${clock.feast ? escapeShopHtml(look.greeting) : escapeShopHtml(name)}</h3>
                    <p class="mm-fest__tagline">${escapeShopHtml(tagline)}</p>
                </div>
                ${clockHtml}
            </div>
            <p class="mm-fest__note${preparing ? ' is-preparing' : ''}" role="status">${preparing ? '<i class="fas fa-wand-sparkles" aria-hidden="true"></i> ' : ''}${note}</p>
        </div>`;
}

/**
 * The whole Festival Stall aisle. Keeps the .mm-aisle contract (data-aisle, data-label,
 * data-icon, .mm-aisle__none) so aisle chips, sorting and "Can afford" work unchanged.
 * The priciest piece is the stall's star and gets a gilded frame.
 */
export function renderFestivalStall(festival, items = [], { now = new Date(), preparing = false } = {}) {
    const look = festivalStallLook(festival);
    const id = festival?.id || 'festival';
    const list = Array.isArray(items) ? items : [];
    const topPrice = list.reduce((max, item) => Math.max(max, Number(item.price) || 0), 0);
    const cards = list.map((item) => {
        const card = renderShopItemCard(item, 'festival');
        return topPrice && Number(item.price) === topPrice
            ? card.replace('mm-ware--festival"', 'mm-ware--festival mm-ware--fest-star"')
            : card;
    }).join('');
    return `
        <section class="mm-aisle mm-aisle--festival mm-fest mm-fest--${escapeShopHtml(id)} mm-fest--${look.motion}${preparing ? ' is-preparing' : ''}" data-aisle="festival"
            data-label="Festival Stall" data-icon="${look.icon}" id="shop-aisle-festival"
            style="${festivalStyle(festival)}">
            ${renderFestivalMarquee(festival, { now, count: list.length, preparing })}
            ${list.length ? renderShelf(cards) : ''}
            <p class="mm-aisle__none">Nothing on this shelf is in reach yet. Keep earning stars!</p>
        </section>`;
}
