// Native cursor artwork, animation frames and state policy, shared by the controller and tests.
//
// Every frame is a real OS cursor image (never a DOM element chasing the mouse), so the cursor
// stays exactly as fast and crisp as the system one. Animation happens by swapping between
// pre-built frames: a quick "pop" when the state changes, a press, and the turning hourglass.

const INK = '#0f3b52';
const HALO = '#ffffff';
const IVORY = '#fffdf6';
const SKY = '#bae6fd';
const GOLD = '#fbbf24';
const GOLD_DEEP = '#d97706';
const GOLD_LIGHT = '#fef3c7';
const ROSE = '#e11d48';

// Pieces with a white halo and an ink outline, so they read on any background.
const outlined = (shapes, width = 1.6) =>
    `<g stroke="${HALO}" stroke-width="${width + 2.6}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>` +
    `<g stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>`;
const sparkle = (x, y, r, fill = GOLD) =>
    `<path d="M${x} ${y - r}Q${x + r * .18} ${y - r * .18} ${x + r} ${y}Q${x + r * .18} ${y + r * .18} ${x} ${y + r}Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z" fill="${fill}" stroke="${GOLD_DEEP}" stroke-width=".8" stroke-linejoin="round"/>`;

const ARROW = 'M5 3.5V24.2l5.3-5 3.6 8.2 3.7-1.6-3.5-8 7.2-.4Z';
const arrow = (star = true) => outlined(`<path d="${ARROW}" fill="url(#gcq-ivory)"/>`) +
    '<path d="M7 8.4v11.4l3.6-3.4 6.8-.4Z" fill="' + SKY + '" opacity=".75"/>' +
    (star ? sparkle(23.5, 6.5, 3.6) : '');

const HAND = 'M11 16.5V5.2a2 2 0 0 1 4 0V12a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1.6a2 2 0 0 1 4 0V20c0 3.9-2.6 6-6.4 6h-3.4c-2.5 0-4-1.3-5.6-3.6l-3.7-5.4a2.1 2.1 0 0 1 3.3-2.6Z';
const cuff = y => `<path d="M12.6 ${y}h9.6v3.2h-9.6Z" fill="${GOLD}"/>`;
const hand = () => outlined(`<path d="${HAND}" fill="url(#gcq-ivory)"/>${cuff(25.4)}`) +
    `<path d="M15 14v2.6M19 14.6v2.4M23 15.6v2" stroke="${INK}" stroke-width="1" stroke-linecap="round" opacity=".45"/>` +
    `<path d="M14.4 26.9h6" stroke="${GOLD_LIGHT}" stroke-width="1" stroke-linecap="round"/>` + sparkle(21.5, 6, 2.8);

const OPEN_HAND = 'M8 17.5V10a2 2 0 0 1 4 0v5V6.2a2 2 0 0 1 4 0V15V5.4a2 2 0 0 1 4 0V15V7.6a2 2 0 0 1 4 0v8.8-2a2 2 0 0 1 4 0V20c0 4-2.8 6.4-6.8 6.4h-3.6c-3.4 0-5.2-2.2-6.8-5Z';
const FIST = 'M7.6 16v-2.4a2 2 0 0 1 4 0v-1.8a2 2 0 0 1 4 0v.4a2 2 0 0 1 4 0v.6a2 2 0 0 1 4 0v1.6a2 2 0 0 1 4 0V20c0 4-2.8 6.4-6.8 6.4h-3.6c-3.6 0-6.3-2.3-7.2-5.6Z';
const openHand = () => outlined(`<path d="${OPEN_HAND}" fill="url(#gcq-ivory)"/>${cuff(25.8)}`);
const fist = () => outlined(`<path d="${FIST}" fill="url(#gcq-ivory)"/>${cuff(25.8)}`) +
    `<path d="M11.6 13.6v2.4M15.6 12.2v3M19.6 12.6v3M23.6 14.2v2.4" stroke="${INK}" stroke-width="1" stroke-linecap="round" opacity=".45"/>`;

const textBeam = () => outlined('<path d="M11 4.5c2.3 0 3.9.6 5 1.9 1.1-1.3 2.7-1.9 5-1.9M11 27.5c2.3 0 3.9-.6 5-1.9 1.1 1.3 2.7 1.9 5 1.9M16 6.4v19.2M13.2 16h5.6" fill="none"/>', 2) +
    `<path d="M16 8.6v14.8" stroke="${GOLD}" stroke-width="1" stroke-linecap="round"/>`;

const blocked = () => outlined(`<circle cx="16" cy="16" r="10.6" fill="url(#gcq-ivory)"/>`, 1.4) +
    `<circle cx="16" cy="16" r="8.4" fill="none" stroke="${ROSE}" stroke-width="3"/><path d="m10.2 10.2 11.6 11.6" stroke="${ROSE}" stroke-width="3" stroke-linecap="round"/>`;

const help = () => arrow(false) + outlined(`<circle cx="23.4" cy="9.4" r="6.6" fill="${GOLD}"/>`, 1.4) +
    `<path d="M21.3 7.8a2.2 2.2 0 1 1 3.2 2c-.7.4-1.1.8-1.1 1.6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><circle cx="23.4" cy="13.4" r="1" fill="${INK}"/>`;

const crosshair = () => outlined(`<circle cx="16" cy="16" r="7.4" fill="${IVORY}" fill-opacity=".55"/><path d="M16 3.5v7M16 21.5v7M3.5 16h7M21.5 16h7" fill="none"/>`, 1.6) +
    sparkle(16, 16, 2.6);

const move = () => outlined('<path d="M16 5v22M5 16h22" fill="none"/><path d="m12.4 7.6 3.6-4.4 3.6 4.4ZM12.4 24.4l3.6 4.4 3.6-4.4ZM7.6 12.4 3.2 16l4.4 3.6ZM24.4 12.4l4.4 3.6-4.4 3.6Z" fill="url(#gcq-ivory)"/>', 1.6) +
    sparkle(16, 16, 3.4);

const lens = sign => outlined(`<path d="m19.6 19.6 8 8" fill="none" stroke-width="5"/>`, 1.6) +
    `<path d="m19.8 19.8 7.6 7.6" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>` +
    outlined(`<circle cx="13" cy="13" r="8.6" fill="url(#gcq-glass)"/>`, 1.8) +
    `<path d="M8.6 10.6a5 5 0 0 1 3.4-3.2" fill="none" stroke="${HALO}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="${sign === '+' ? 'M9.4 13h7.2M13 9.4v7.2' : 'M9.4 13h7.2'}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;

// The hourglass: sand drains smoothly, then the glass turns over and the loop starts again.
// Frame durations (ms) keep the sand calm and the turn quick, like a real flip.
const DRAIN_STEPS = 14;
const TURN_ANGLES = [24, 70, 120, 162];
export const HOURGLASS_FRAMES = [
    ...Array.from({ length: DRAIN_STEPS }, (_, i) => ({
        sand: i / (DRAIN_STEPS - 1), angle: 0, duration: i === 0 ? 220 : i === DRAIN_STEPS - 1 ? 260 : 115,
    })),
    ...TURN_ANGLES.map(angle => ({ sand: 1, angle, duration: 55 })),
];

const GLASS = 'M10.6 7C10.6 11.4 12.6 13.4 15 16 12.6 18.6 10.6 20.6 10.6 25H21.4C21.4 20.6 19.4 18.6 17 16 19.4 13.4 21.4 11.4 21.4 7Z';
function hourglass({ sand, angle }, tick = 0) {
    // Top sand level falls from the shoulder to the neck; the bottom mound rises to meet it.
    const top = 9 + 6.4 * sand ** 1.15;
    const mound = 24 - 6.4 * sand ** .85;
    const flowing = sand > 0 && sand < 1;
    const sandTop = sand < 1
        ? `<path clip-path="url(#gcq-top)" d="M0 ${top}Q16 ${top + 1.6} 32 ${top}V16H0Z" fill="${GOLD}"/>` : '';
    const sandBottom = sand > 0
        ? `<path clip-path="url(#gcq-bottom)" d="M0 32V${mound + 2.4}Q16 ${mound - 1.8} 32 ${mound + 2.4}V32Z" fill="${GOLD}"/>` : '';
    const stream = flowing
        ? `<path d="M16 15.4V${mound}" stroke="${GOLD_DEEP}" stroke-width="1" stroke-linecap="round"/>` +
          `<circle cx="16" cy="${(16.8 + (tick % 3) * ((mound - 17.5) / 3)).toFixed(2)}" r=".75" fill="${GOLD_LIGHT}"/>`
        : '';
    return `<g transform="rotate(${angle} 16 16)">` +
        outlined(`<path d="${GLASS}" fill="url(#gcq-glass)"/>`, 1.5) +
        `<clipPath id="gcq-top"><path d="M11.8 8C11.8 11.4 13.6 13.3 16 15.6 18.4 13.3 20.2 11.4 20.2 8Z"/></clipPath>` +
        `<clipPath id="gcq-bottom"><path d="M11.8 24C11.8 20.6 13.6 18.7 16 16.4 18.4 18.7 20.2 20.6 20.2 24Z"/></clipPath>` +
        sandTop + sandBottom + stream +
        `<path d="M12.2 9c0 2 .7 3.4 1.8 4.6" fill="none" stroke="${HALO}" stroke-width="1.1" stroke-linecap="round"/>` +
        outlined(`<rect x="8.6" y="4" width="14.8" height="3.2" rx="1.4" fill="${GOLD}"/><rect x="8.6" y="24.8" width="14.8" height="3.2" rx="1.4" fill="${GOLD}"/>`, 1.4) +
        `<path d="M10.4 5.3h11.2M10.4 26.1h11.2" stroke="${GOLD_LIGHT}" stroke-width=".9" stroke-linecap="round"/>` +
        '</g>';
}
// "Working, but you can keep going": the arrow carries a small turning hourglass.
const progress = (frame, tick) => arrow(false) +
    outlined(`<circle cx="24.4" cy="24.4" r="6.4" fill="${IVORY}"/>`, 1.3) +
    `<g transform="translate(24.4 24.4) scale(.39) translate(-16 -16)">${hourglass(frame, tick)}</g>`;

const DEFS = '<defs>' +
    `<linearGradient id="gcq-ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient>` +
    `<linearGradient id="gcq-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0f9ff"/><stop offset="1" stop-color="#cdeffd"/></linearGradient>` +
    '</defs>';

// [drawing, hotspot x, hotspot y, CSS fallback keyword]
const artwork = {
    default: [arrow, 5, 4, 'default'],
    pointer: [hand, 13, 3, 'pointer'],
    text: [textBeam, 16, 16, 'text'],
    wait: [frame => hourglass(frame), 16, 16, 'wait'],
    progress: [progress, 5, 4, 'progress'],
    grab: [openHand, 16, 16, 'grab'],
    grabbing: [fist, 16, 16, 'grabbing'],
    blocked: [blocked, 16, 16, 'not-allowed'],
    help: [help, 5, 4, 'help'],
    crosshair: [crosshair, 16, 16, 'crosshair'],
    move: [move, 16, 16, 'move'],
    'zoom-in': [() => lens('+'), 13, 13, 'zoom-in'],
    'zoom-out': [() => lens('-'), 13, 13, 'zoom-out'],
};
export const ANIMATED_STATES = new Set(['wait', 'progress']);

// Scales are applied around the hotspot, so the point you aim with never moves.
export const POSE_SCALES = { enter: .84, settle: 1.04, press: .86 };
const POSES = Object.keys(POSE_SCALES);

// Minimal escaping keeps the many frame images compact while staying a valid data URI.
const encode = svg => svg.replace(/"/g, "'").replace(/[%#<>{},\n]/g, encodeURIComponent);

function drawing(mode, frame) {
    const [draw] = artwork[mode];
    if (ANIMATED_STATES.has(mode)) {
        const index = Number(frame ?? 0);
        return draw(HOURGLASS_FRAMES[index] ?? HOURGLASS_FRAMES[0], index);
    }
    return draw();
}

function build(mode, frame, nativeSize) {
    const [, hx, hy, fallback] = artwork[mode];
    const scale = POSE_SCALES[frame];
    const body = drawing(mode, frame);
    const content = scale
        ? `<g transform="translate(${hx} ${hy}) scale(${scale}) translate(${-hx} ${-hy})">${body}</g>` : body;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="gcq-quest-cursor" width="32" height="32" viewBox="0 0 32 32">${DEFS}${content}</svg>`;
    const url = `data:image/svg+xml,${encode(svg)}`;
    const nativeSvg = svg.replace('width="32" height="32"', `width="${nativeSize}" height="${nativeSize}"`);
    const nativeUrl = `data:image/svg+xml,${encode(nativeSvg)}`;
    const [x, y] = [hx, hy];
    const fallbackCss = `url("${url}") ${x} ${y}, ${fallback}`;
    const css = nativeSize === 32 ? fallbackCss : `image-set(url("${nativeUrl}") ${nativeSize / 32}x) ${x} ${y}, ${fallback}`;
    return { url, nativeUrl, x, y, css, fallbackCss };
}

/** The frames each state can show: the resting image plus its poses or animation steps. */
export function questCursorFrames(mode) {
    if (!Object.hasOwn(artwork, mode)) return [];
    return ANIMATED_STATES.has(mode) ? HOURGLASS_FRAMES.map((_, i) => String(i)) : POSES;
}

function nativeSizeFor(pixelRatio) {
    return Math.max(32, Math.min(128, Math.ceil(32 * (Number(pixelRatio) || 1))));
}

/** Resting artwork for every state. */
export function getQuestCursorAssets(pixelRatio = 1) {
    const size = nativeSizeFor(pixelRatio);
    return Object.fromEntries(Object.keys(artwork).map(mode => [mode, build(mode, undefined, size)]));
}

/** Every frame of every state: { mode: { rest, frames: { name: asset } } }. */
export function getQuestCursorFrameSet(pixelRatio = 1) {
    const size = nativeSizeFor(pixelRatio);
    return Object.fromEntries(Object.keys(artwork).map(mode => [mode, {
        rest: build(mode, undefined, size),
        frames: Object.fromEntries(questCursorFrames(mode).map(frame => [frame, build(mode, frame, size)])),
    }]));
}

export function resolveQuestCursor({ cursor = 'auto', busy = false, disabled = false,
    interactive = false, text = false, native = false } = {}) {
    // Keep application-supplied images, invisible cursors and OS resize/precision tools.
    if (native || (cursor.includes('url(') && !cursor.includes('gcq-quest-cursor'))) return 'native';
    const keyword = cursor.split(',').at(-1).trim();
    if (keyword === 'none') return 'native';
    if (!['auto', 'default', 'not-allowed', 'no-drop'].includes(keyword) && !Object.hasOwn(artwork, keyword)) return 'native';
    if (busy === 'wait' || keyword === 'wait') return 'wait';
    if (busy || keyword === 'progress') return 'progress';
    if (disabled || keyword === 'not-allowed' || keyword === 'no-drop') return 'blocked';
    if (keyword === 'auto' || keyword === 'default') {
        if (interactive) return 'pointer';
        if (text) return 'text';
        return 'default';
    }
    return Object.hasOwn(artwork, keyword) ? keyword : 'native';
}
