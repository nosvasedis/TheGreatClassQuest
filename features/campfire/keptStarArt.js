// The star a kept promise becomes, drawn per kind of promise (same kinds, colours and point counts as
// the class sky's STAR_MARK). Faceted body, a bright core with the kind's little emblem, and one
// ornament that tells its story: the Herald's sound waves, the Word-Weaver's ring of letters, the
// Quill's feather, the Listening Shell's ripples, the Lantern's wreath of leaves, the Crown's crown.
// Pure SVG; anything that moves is a CSS transform or opacity (see keptStar.css).
import './keptStar.css';
import { oathStarCategory } from '../campfireConstellation.mjs';

const KINDS = {
    speak: { name: 'The Herald', light: '#f0fbff', mid: '#7dd3fc', deep: '#0369a1', glow: '#38bdf8', points: 4, outer: 74, inner: 15 },
    words: { name: 'The Word-Weaver', light: '#f5f1ff', mid: '#c4b5fd', deep: '#5b21b6', glow: '#a78bfa', points: 6, outer: 64, inner: 31 },
    write: { name: 'The Quill', light: '#fff1f3', mid: '#fda4af', deep: '#be123c', glow: '#fb7185', points: 5, outer: 66, inner: 28 },
    'read/listen': { name: 'The Listening Shell', light: '#effffb', mid: '#5eead4', deep: '#0f766e', glow: '#2dd4bf', points: 8, outer: 68, inner: 27, short: 46 },
    habit: { name: 'The Lantern', light: '#f0fdf4', mid: '#86efac', deep: '#15803d', glow: '#4ade80', points: 7, outer: 63, inner: 31 },
    virtue: { name: 'The Crown', light: '#fffbeb', mid: '#fcd34d', deep: '#b45309', glow: '#fbbf24', points: 4, outer: 68, inner: 27, rotate: 45 }
};

let uid = 0;
const f = n => n.toFixed(1);
const at = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

/** Tips and valleys of the star, starting at the top (or rotated). */
function starPoints(k) {
    const pts = [], n = k.points * 2, turn = ((k.rotate || 0) * Math.PI) / 180 - Math.PI / 2;
    for (let i = 0; i < n; i++) {
        const tip = i % 2 === 0;
        const r = tip ? (k.short && (i / 2) % 2 === 1 ? k.short : k.outer) : k.inner;
        pts.push(at(r, (i / n) * Math.PI * 2 + turn));
    }
    return pts;
}

/** Each point split down its spine: one lit half, one shaded half, so the star reads as cut glass. */
function facets(k, id) {
    const pts = starPoints(k), n = pts.length;
    let out = '';
    for (let i = 0; i < n; i += 2) {
        const tip = pts[i], before = pts[(i - 1 + n) % n], after = pts[(i + 1) % n];
        out += '<path d="M0,0L' + f(before[0]) + ',' + f(before[1]) + 'L' + f(tip[0]) + ',' + f(tip[1]) + 'Z" fill="url(#' + id + '-lit)"/>';
        out += '<path d="M0,0L' + f(tip[0]) + ',' + f(tip[1]) + 'L' + f(after[0]) + ',' + f(after[1]) + 'Z" fill="url(#' + id + '-shade)"/>';
    }
    const outline = 'M' + pts.map(p => f(p[0]) + ',' + f(p[1])).join('L') + 'Z';
    return '<path d="' + outline + '" fill="url(#' + id + '-body)"/>' + out +
        '<path d="' + outline + '" fill="none" stroke="' + k.light + '" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/>';
}

const sparkle = (x, y, s, cls = '') => '<path class="ks-sparkle ' + cls + '" style="--x:' + x + 'px;--y:' + y + 'px" transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0,-10C1,-3 3,-1 10,0C3,1 1,3 0,10C-1,3 -3,1 -10,0C-3,-1 -1,-3 0,-10Z" fill="#fff"/>';

/** The ornament behind (or around) the star, one per kind. */
function ornament(kind, k, id) {
    switch (kind) {
        case 'speak': {
            // The Herald: sound carries out from the star on both sides.
            const arcs = side => [34, 52, 70].map((r, i) => {
                const a = 0.52, sx = side * Math.cos(a) * (r + 30), sy = Math.sin(a) * (r + 30);
                return '<path class="ks-wave" style="--i:' + i + '" d="M' + f(sx) + ',' + f(-sy) + 'A' + (r + 30) + ',' + (r + 30) + ' 0 0 ' + (side > 0 ? 1 : 0) + ' ' + f(sx) + ',' + f(sy) + '" fill="none" stroke="' + k.mid + '" stroke-width="' + (5 - i * 1.2) + '" stroke-linecap="round"/>';
            }).join('');
            return '<g class="ks-waves">' + arcs(1) + arcs(-1) + '</g>';
        }
        case 'words': {
            // The Word-Weaver: a slow ring of letters with a woven thread.
            const letters = ['A', 'b', 'c', '✦', 'w', 'o', 'r', 'd', '✦'];
            return '<g class="ks-orbit"><circle r="84" fill="none" stroke="' + k.mid + '" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="2 7" stroke-linecap="round"/>' +
                letters.map((ch, i) => {
                    const [x, y] = at(84, (i / letters.length) * Math.PI * 2 - Math.PI / 2);
                    return '<text x="' + f(x) + '" y="' + f(y) + '" dy=".35em" text-anchor="middle" font-family="Fredoka One, Fredoka, sans-serif" font-size="' + (ch === '✦' ? 11 : 15) + '" fill="' + k.light + '" transform="rotate(' + f((i / letters.length) * 360) + ' ' + f(x) + ' ' + f(y) + ')">' + ch + '</text>';
                }).join('') + '</g>';
        }
        case 'write':
            // The Quill: a feather laid behind the star, an ink flourish beneath.
            return '<g class="ks-quill" transform="rotate(-38)">' +
                '<path d="M0,-96C20,-70 22,-24 10,22C6,40 3,58 0,82C-3,58 -6,40 -10,22C-22,-24 -20,-70 0,-96Z" fill="url(#' + id + '-feather)"/>' +
                '<path d="M0,-90L0,92" stroke="' + k.light + '" stroke-opacity=".8" stroke-width="1.6"/>' +
                [-70, -54, -38, -22, -6, 10].map(y => '<path d="M0,' + y + 'L' + (13 - Math.abs(y + 30) * 0.06) + ',' + (y + 12) + 'M0,' + y + 'L' + (-13 + Math.abs(y + 30) * 0.06) + ',' + (y + 12) + '" stroke="' + k.light + '" stroke-opacity=".35" stroke-width="1"/>').join('') +
                '<path d="M-2.5,82L0,98L2.5,82Z" fill="' + k.deep + '"/></g>' +
                '<path class="ks-ink" d="M-58,84C-34,70 -12,96 10,82C26,72 40,74 56,86" fill="none" stroke="' + k.mid + '" stroke-width="3" stroke-linecap="round" pathLength="1"/>';
        case 'read/listen':
            // The Listening Shell: ripples that come and go, like a story being heard.
            return '<g class="ks-ripples">' + [0, 1, 2].map(i => '<circle class="ks-ripple" style="--i:' + i + '" r="72" fill="none" stroke="' + k.mid + '" stroke-width="2.2"/>').join('') + '</g>';
        case 'habit': {
            // The Lantern: a wreath of leaves that grows a little every day.
            const leaves = Array.from({ length: 14 }, (_, i) => {
                const a = (i / 14) * 360;
                return '<path transform="rotate(' + a + ') translate(0 -84) rotate(' + (i % 2 ? 30 : -30) + ')" d="M0,-9C6,-5 6,5 0,9C-6,5 -6,-5 0,-9Z" fill="' + (i % 2 ? k.mid : k.glow) + '" fill-opacity=".85"/>';
            }).join('');
            return '<g class="ks-orbit ks-orbit--slow"><circle r="84" fill="none" stroke="' + k.deep + '" stroke-opacity=".6" stroke-width="1.6"/>' + leaves + '</g>';
        }
        default:
            // The Crown: a small golden crown rests above the star.
            return '<g class="ks-crown"><g transform="translate(0 -58) scale(.9)">' +
                '<path d="M-26,10L-30,-14L-14,-2L0,-20L14,-2L30,-14L26,10Z" fill="url(#' + id + '-lit)" stroke="' + k.deep + '" stroke-width="1.5" stroke-linejoin="round"/>' +
                '<rect x="-27" y="9" width="54" height="7" rx="3" fill="' + k.deep + '"/>' +
                '<circle cx="0" cy="-22" r="3.6" fill="#fff"/><circle cx="-30" cy="-15" r="3" fill="' + k.light + '"/><circle cx="30" cy="-15" r="3" fill="' + k.light + '"/>' +
                '<circle cx="0" cy="3" r="3.4" fill="#f43f5e"/></g></g>';
    }
}

/** The little emblem in the star's bright heart. */
function emblem(kind, k) {
    const ink = k.deep;
    switch (kind) {
        case 'speak':
            return '<path d="M-10,-7H10A4,4 0 0 1 14,-3V4A4,4 0 0 1 10,8H-1L-7,13V8H-10A4,4 0 0 1 -14,4V-3A4,4 0 0 1 -10,-7Z" fill="none" stroke="' + ink + '" stroke-width="2.4" stroke-linejoin="round"/><circle cx="-5" cy="1" r="1.6" fill="' + ink + '"/><circle cx="0" cy="1" r="1.6" fill="' + ink + '"/><circle cx="5" cy="1" r="1.6" fill="' + ink + '"/>';
        case 'words':
            return '<text y=".36em" text-anchor="middle" font-family="Fredoka One, Fredoka, sans-serif" font-size="17" fill="' + ink + '">Aa</text>';
        case 'write':
            // A pen nib, point down.
            return '<path d="M-8,-12H8V-6L10,0L0,13L-10,0L-8,-6Z" fill="' + ink + '"/><path d="M0,1V12" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="-1" r="2.4" fill="#fff"/><rect x="-8" y="-12" width="16" height="4" rx="1" fill="#fff" fill-opacity=".35"/>';
        case 'read/listen':
            return '<path d="M0,0C2,-1 2,3 -1,3C-5,3 -5,-3 0,-4C6,-5 7,3 3,6C-2,10 -10,6 -10,-1C-10,-9 -1,-13 5,-10C11,-7 13,1 12,5" fill="none" stroke="' + ink + '" stroke-width="2.3" stroke-linecap="round"/>';
        case 'habit':
            return '<path d="M0,11V-2" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/><path d="M0,0C-1,-8 -8,-11 -12,-9C-11,-3 -6,1 0,0Z" fill="' + ink + '"/><path d="M0,-3C1,-11 8,-13 12,-11C11,-5 6,-2 0,-3Z" fill="' + ink + '"/>';
        default:
            return '<path d="M0,10C-14,1 -12,-10 -5,-10C-2,-10 0,-7 0,-5C0,-7 2,-10 5,-10C12,-10 14,1 0,10Z" fill="#e11d48"/><path d="M-6,-6C-4,-8 -2,-7 -2,-5" stroke="#fff" stroke-opacity=".8" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    }
}

/** The kind of promise this oath was (speak, words, write, read/listen, habit, virtue). */
export const keptStarKind = oath => oathStarCategory(oath);
export const keptStarName = kind => (KINDS[kind] || KINDS.virtue).name;

/**
 * The kept-promise star for one kind, as an SVG. `className` goes on the wrapper so each
 * screen can place it; the star is drawn in a -100..100 box and its heart is the box centre.
 */
export function keptStarMarkup(kindOrOath, { className = '' } = {}) {
    const kind = typeof kindOrOath === 'string' ? (KINDS[kindOrOath] ? kindOrOath : 'virtue') : keptStarKind(kindOrOath);
    const k = KINDS[kind], id = 'ks' + (++uid);
    const back = kind === 'write' || kind === 'speak' || kind === 'read/listen';
    const defs = '<defs>' +
        '<radialGradient id="' + id + '-halo"><stop offset="0" stop-color="' + k.light + '" stop-opacity=".95"/><stop offset=".22" stop-color="' + k.glow + '" stop-opacity=".55"/><stop offset=".55" stop-color="' + k.glow + '" stop-opacity=".14"/><stop offset="1" stop-color="' + k.glow + '" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="' + id + '-body" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="' + k.light + '"/><stop offset=".8" stop-color="' + k.mid + '"/><stop offset="1" stop-color="' + k.deep + '"/></radialGradient>' +
        '<linearGradient id="' + id + '-lit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="' + k.light + '"/><stop offset="1" stop-color="' + k.mid + '"/></linearGradient>' +
        '<linearGradient id="' + id + '-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + k.mid + '"/><stop offset="1" stop-color="' + k.deep + '"/></linearGradient>' +
        '<linearGradient id="' + id + '-feather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="' + k.light + '"/><stop offset="1" stop-color="' + k.mid + '"/></linearGradient>' +
        '<radialGradient id="' + id + '-core"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="' + k.light + '" stop-opacity="0"/></radialGradient>' +
        '</defs>';
    const glints = '<g class="ks-glints">' + [0, 90].map(a => '<path transform="rotate(' + a + ')" d="M0,-98L3,-3L0,98L-3,-3Z" fill="#fff" fill-opacity=".55"/>').join('') +
        [45, 135].map(a => '<path transform="rotate(' + a + ')" d="M0,-70L2,-2L0,70L-2,-2Z" fill="' + k.light + '" fill-opacity=".35"/>').join('') + '</g>';
    const sparkles = sparkle(-70, -54, 0.9, 'ks-s1') + sparkle(72, -40, 0.7, 'ks-s2') + sparkle(60, 64, 0.8, 'ks-s3') + sparkle(-62, 58, 0.55, 'ks-s4');
    return '<div class="ks-star ks-star--' + kind.replace('/', '-') + (className ? ' ' + className : '') + '" data-kind="' + kind + '" aria-hidden="true">' +
        '<svg viewBox="-100 -100 200 200" focusable="false">' + defs +
        '<circle class="ks-halo" r="99" fill="url(#' + id + '-halo)"/>' + glints +
        (back ? ornament(kind, k, id) : '') +
        '<g class="ks-body">' + facets(k, id) + '<circle r="22" fill="url(#' + id + '-core)"/>' + '<g class="ks-emblem">' + emblem(kind, k) + '</g></g>' +
        (back ? '' : ornament(kind, k, id)) + sparkles + '</svg></div>';
}
