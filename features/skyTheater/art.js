/**
 * Sky Theater — hand-drawn storybook cast.
 *
 * Every sprite is inline SVG drawn facing RIGHT (the engine mirrors it for right-to-left flights)
 * in one shared style: a soft indigo ink line, gradient fills, a white glint and rosy cheeks.
 * Moving parts carry `skyt-part--*` classes that `styles/sky_theater.css` animates
 * (wing flaps, propeller blur, flame flicker, blinking eyes, swaying tails…).
 *
 * Each builder receives `{ uid, night, flip, text }`:
 *  - uid   unique id prefix so gradient ids never collide between actors
 *  - night true when the header wears its night costume
 *  - flip  true when the actor flies right-to-left (text must counter-mirror)
 *  - text  optional caption (banner plane)
 */

const INK = '#2b2f63';
const INK_NIGHT = '#1b1d45';
const BLUSH = '#ff8fab';

function ink(night) {
    return night ? INK_NIGHT : INK;
}

/** Shared cute face: two eyes (blink), cheeks, smile. `s` scales the whole face. */
function face(cx, cy, { s = 1, night = false, sleepy = false, gap = 7 } = {}) {
    const k = ink(night);
    const ex = gap * s;
    const eyes = sleepy
        ? `<path d="M${cx - ex - 2.4 * s} ${cy} q${2.4 * s} ${2.2 * s} ${4.8 * s} 0 M${cx + ex - 2.4 * s} ${cy} q${2.4 * s} ${2.2 * s} ${4.8 * s} 0" fill="none" stroke="${k}" stroke-width="${1.6 * s}" stroke-linecap="round"/>`
        : `<g class="skyt-part skyt-part--blink">
                <ellipse cx="${cx - ex}" cy="${cy}" rx="${1.9 * s}" ry="${2.5 * s}" fill="${k}"/>
                <ellipse cx="${cx + ex}" cy="${cy}" rx="${1.9 * s}" ry="${2.5 * s}" fill="${k}"/>
                <circle cx="${cx - ex + 0.7 * s}" cy="${cy - 0.9 * s}" r="${0.7 * s}" fill="#fff"/>
                <circle cx="${cx + ex + 0.7 * s}" cy="${cy - 0.9 * s}" r="${0.7 * s}" fill="#fff"/>
           </g>`;
    return `
        ${eyes}
        <ellipse cx="${cx - ex - 2.6 * s}" cy="${cy + 3.6 * s}" rx="${2.4 * s}" ry="${1.4 * s}" fill="${BLUSH}" opacity="0.6"/>
        <ellipse cx="${cx + ex + 2.6 * s}" cy="${cy + 3.6 * s}" rx="${2.4 * s}" ry="${1.4 * s}" fill="${BLUSH}" opacity="0.6"/>
        <path d="M${cx - 2.6 * s} ${cy + 3.2 * s} q${2.6 * s} ${2.6 * s} ${5.2 * s} 0" fill="none" stroke="${k}" stroke-width="${1.5 * s}" stroke-linecap="round"/>`;
}

function svg(viewBox, body, cls = '') {
    return `<svg class="skyt-sprite ${cls}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">${body}</svg>`;
}

function mirrorText(flip, cx) {
    return flip ? ` transform="translate(${cx * 2} 0) scale(-1 1)"` : '';
}

/* ───────────────────────── Sunday — Calm Wonder ───────────────────────── */

function rainbowCloud({ uid, night }) {
    const k = ink(night);
    const top = night ? '#e0e7ff' : '#ffffff';
    const bot = night ? '#a5b4fc' : '#dbeafe';
    return svg('0 0 80 56', `
        <defs>
            <linearGradient id="${uid}c" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/>
            </linearGradient>
        </defs>
        <path d="M14 44 C 4 44, 3 31, 13 29 C 12 17, 27 12, 33 20 C 37 8, 58 8, 60 22 C 71 20, 78 30, 72 38 C 76 45, 68 49, 62 46 C 55 51, 44 51, 40 46 C 33 51, 20 50, 14 44 Z"
              fill="url(#${uid}c)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M18 27 C 20 21, 26 19, 30 22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
        <path d="M40 16 C 44 12, 51 12, 54 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
        ${face(46, 33, { s: 1, night, sleepy: night })}
    `);
}

function dove({ uid, night }) {
    const k = ink(night);
    const body = night ? '#e2e8ff' : '#ffffff';
    const shade = night ? '#b4bfe8' : '#dfe8f7';
    return svg('0 0 72 56', `
        <defs>
            <linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${shade}"/>
            </linearGradient>
        </defs>
        <g class="skyt-part skyt-part--flap-back" style="transform-origin: 38px 30px">
            <path d="M36 30 C 30 14, 38 4, 50 6 C 46 14, 46 22, 40 30 Z" fill="${shade}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <path d="M8 30 L 2 22 L 4 34 L 0 40 L 12 38 Z" fill="${body}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M10 34 C 14 24, 34 22, 46 26 C 52 18, 64 18, 66 28 C 67 36, 58 42, 46 42 C 32 46, 16 44, 10 34 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M66 27 L 72 29.5 L 66 31.5 Z" fill="#fbbf24" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        <g>
            <path d="M70 31 C 72 36, 70 42, 64 46" fill="none" stroke="#4d7c0f" stroke-width="1.6" stroke-linecap="round"/>
            <ellipse cx="70" cy="37" rx="2.6" ry="1.4" transform="rotate(60 70 37)" fill="#84cc16" stroke="#3f6212" stroke-width="0.8"/>
            <ellipse cx="66.5" cy="42.5" rx="2.6" ry="1.4" transform="rotate(20 66.5 42.5)" fill="#84cc16" stroke="#3f6212" stroke-width="0.8"/>
        </g>
        <circle cx="59.5" cy="26" r="2" fill="${k}"/><circle cx="60.2" cy="25.3" r="0.7" fill="#fff"/>
        <ellipse cx="57" cy="31" rx="2.2" ry="1.2" fill="${BLUSH}" opacity="0.55"/>
        <g class="skyt-part skyt-part--flap" style="transform-origin: 34px 32px">
            <path d="M26 32 C 20 16, 30 2, 48 2 C 44 12, 44 22, 38 32 C 34 35, 30 35, 26 32 Z" fill="${body}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M32 28 C 32 20, 36 12, 42 8 M36 30 C 37 24, 40 18, 44 14" fill="none" stroke="${shade}" stroke-width="1.6" stroke-linecap="round"/>
        </g>
    `);
}

function sunCameo({ uid, night }) {
    const k = ink(night);
    if (night) {
        return svg('0 0 64 64', `
            <defs>
                <radialGradient id="${uid}m" cx="0.4" cy="0.35" r="0.75">
                    <stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#fcd34d"/>
                </radialGradient>
                <radialGradient id="${uid}halo" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0.4" stop-color="#fef3c7" stop-opacity="0.7"/><stop offset="1" stop-color="#fef3c7" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle class="skyt-part skyt-part--pulse" cx="32" cy="34" r="30" fill="url(#${uid}halo)"/>
            <path d="M40 8 C 22 10, 12 28, 18 44 C 24 58, 44 62, 56 50 C 40 52, 28 40, 30 26 C 31 18, 35 12, 40 8 Z"
                  fill="url(#${uid}m)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M22 30 q3 2.4 6 0" fill="none" stroke="${k}" stroke-width="1.8" stroke-linecap="round"/>
            <ellipse cx="24" cy="36" rx="2.6" ry="1.5" fill="${BLUSH}" opacity="0.6"/>
            <path d="M24 42 q3 2 6 0" fill="none" stroke="${k}" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M38 8 C 44 2, 54 4, 58 12 L 44 14 Z" fill="#6366f1" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="59" cy="13" r="3" fill="#fff" stroke="${k}" stroke-width="1.6"/>
            <g class="skyt-part skyt-part--zzz" fill="#fff" font-family="Fredoka, ui-rounded, sans-serif" font-weight="700">
                <text x="46" y="30" font-size="9">z</text><text x="52" y="22" font-size="7">z</text>
            </g>
        `);
    }
    return svg('0 0 64 64', `
        <defs>
            <radialGradient id="${uid}s" cx="0.4" cy="0.35" r="0.7">
                <stop offset="0" stop-color="#fff7c2"/><stop offset="0.6" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
        </defs>
        <g class="skyt-part skyt-part--rays" style="transform-origin: 32px 32px">
            ${Array.from({ length: 12 }, (_, i) => {
                const long = i % 2 === 0;
                return `<path d="M32 ${long ? 1 : 5} L 35 ${long ? 12 : 13} L 29 ${long ? 12 : 13} Z" fill="${long ? '#fbbf24' : '#fde68a'}" stroke="${k}" stroke-width="1.4" stroke-linejoin="round" transform="rotate(${i * 30} 32 32)"/>`;
            }).join('')}
        </g>
        <circle cx="32" cy="32" r="17" fill="url(#${uid}s)" stroke="${k}" stroke-width="2.2"/>
        <path d="M22 26 C 24 21, 29 19, 33 19.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
        ${face(32, 32, { s: 1, night, gap: 6 })}
    `);
}

/* ───────────────────────── Monday — Fresh Launch ───────────────────────── */

function rocket({ uid, night }) {
    const k = ink(night);
    return svg('0 0 48 80', `
        <defs>
            <linearGradient id="${uid}r" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#eef2ff"/><stop offset="1" stop-color="#c7d2fe"/>
            </linearGradient>
            <radialGradient id="${uid}f" cx="0.5" cy="0.2" r="0.8">
                <stop offset="0" stop-color="#fffbe6"/><stop offset="0.45" stop-color="#fcd34d"/><stop offset="1" stop-color="#f97316"/>
            </radialGradient>
        </defs>
        <g class="skyt-part skyt-part--flicker" style="transform-origin: 24px 58px">
            <path d="M16 56 C 14 66, 20 74, 24 79 C 28 74, 34 66, 32 56 Z" fill="url(#${uid}f)" stroke="#ea580c" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M20 57 C 20 63, 22 67, 24 70 C 26 67, 28 63, 28 57 Z" fill="#fffbe6"/>
        </g>
        <path d="M12 44 L 3 56 L 4 62 L 14 56 Z" fill="#f43f5e" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M36 44 L 45 56 L 44 62 L 34 56 Z" fill="#e11d48" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M24 2 C 36 12, 38 32, 35 56 L 13 56 C 10 32, 12 12, 24 2 Z" fill="url(#${uid}r)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M24 2 C 30 7, 33 12, 34.5 17 L 13.5 17 C 15 12, 18 7, 24 2 Z" fill="#f43f5e" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="24" cy="31" r="7" fill="#7dd3fc" stroke="${k}" stroke-width="2.2"/>
        <circle cx="24" cy="31" r="4.2" fill="#bae6fd"/>
        <path d="M20.5 29 q2 -3 5 -2.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M24 56 L 24 46" stroke="${k}" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 22 C 16 30, 16 40, 17 50" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    `);
}

function paperPlane({ uid, night }) {
    const k = ink(night);
    const a = night ? '#e0e7ff' : '#ffffff';
    const b = night ? '#a5b4fc' : '#bfdbfe';
    const c = night ? '#818cf8' : '#93c5fd';
    return svg('0 0 72 44', `
        <path d="M2 22 L 70 4 L 30 30 Z" fill="${a}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M30 30 L 70 4 L 36 40 Z" fill="${b}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M30 30 L 36 40 L 26 34 Z" fill="${c}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M12 21 L 56 9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>
        <circle cx="54" cy="16" r="2.4" fill="${night ? '#fde68a' : '#fbbf24'}" stroke="${k}" stroke-width="1.2"/>
    `);
}

function starCameo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 64 64', `
        <defs>
            <radialGradient id="${uid}s" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#fffbe6"/><stop offset="0.55" stop-color="#fde047"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <radialGradient id="${uid}halo" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0.35" stop-color="#fef9c3" stop-opacity="0.85"/><stop offset="1" stop-color="#fef9c3" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <circle class="skyt-part skyt-part--pulse" cx="32" cy="33" r="30" fill="url(#${uid}halo)"/>
        <path d="M32 4 C 34 16, 36 20, 40 22 L 58 24 C 60 24.4, 60.6 26.4, 59 27.6 L 45 38 L 50 56 C 50.4 58, 48.6 59, 47 58 L 32 48 L 17 58 C 15.4 59, 13.6 58, 14 56 L 19 38 L 5 27.6 C 3.4 26.4, 4 24.4, 6 24 L 24 22 C 28 20, 30 16, 32 4 Z"
              fill="url(#${uid}s)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M26 20 C 28 16, 30 12, 31 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
        <g class="skyt-part skyt-part--wink">
            <ellipse cx="26" cy="33" rx="2" ry="2.6" fill="${k}"/><circle cx="26.7" cy="32" r="0.7" fill="#fff"/>
        </g>
        <path d="M35.4 33 q2.6 -2.6 5.2 0" fill="none" stroke="${k}" stroke-width="1.8" stroke-linecap="round"/>
        <ellipse cx="22.5" cy="37.5" rx="2.4" ry="1.4" fill="${BLUSH}" opacity="0.65"/>
        <ellipse cx="42" cy="37.5" rx="2.4" ry="1.4" fill="${BLUSH}" opacity="0.65"/>
        <path d="M29 38 q3 3.2 6 0" fill="none" stroke="${k}" stroke-width="1.6" stroke-linecap="round"/>
    `);
}

/* ───────────────────────── Tuesday — Sky Traffic ───────────────────────── */

function bannerPlane({ uid, night, flip, text = 'QUEST ON!' }) {
    const k = ink(night);
    const len = Math.max(64, text.length * 7.4 + 18);
    const W = 54 + len + 10;
    const bx = 4;
    const planeX = len + 16;
    const midX = bx + len / 2;
    return svg(`0 0 ${W} 46`, `
        <defs>
            <linearGradient id="${uid}p" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fca5a5"/><stop offset="1" stop-color="#ef4444"/>
            </linearGradient>
            <linearGradient id="${uid}n" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${night ? '#eef2ff' : '#fffdf5'}"/><stop offset="1" stop-color="${night ? '#c7d2fe' : '#fef3c7'}"/>
            </linearGradient>
        </defs>
        <path d="M${bx + len} 24 L ${planeX + 6} 26" stroke="${k}" stroke-width="1.2" stroke-dasharray="2 2"/>
        <g class="skyt-part skyt-part--wave" style="transform-origin: ${bx + len}px 24px">
            <path d="M${bx} 14 C ${bx + len * 0.3} 10, ${bx + len * 0.6} 18, ${bx + len} 14 L ${bx + len} 34 C ${bx + len * 0.6} 38, ${bx + len * 0.3} 30, ${bx} 34 L ${bx + 6} 24 Z"
                  fill="url(#${uid}n)" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
            <text x="${midX + 3}" y="28.4" text-anchor="middle" font-family="Fredoka, ui-rounded, sans-serif" font-weight="700" font-size="10.5"
                  fill="${night ? '#4338ca' : '#be123c'}" letter-spacing="0.4"${mirrorText(flip, midX + 3)}>${text}</text>
        </g>
        <g transform="translate(${planeX} 0)">
            <path d="M4 18 L 0 8 L 8 10 L 14 20 Z" fill="#fb7185" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M6 20 C 6 14, 30 13, 40 16 C 44 17, 46 20, 46 24 C 46 28, 42 30, 38 30 L 10 28 C 6 27, 6 24, 6 20 Z" fill="url(#${uid}p)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M18 12 L 36 12 L 34 16 L 20 16 Z" fill="#fde68a" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M16 28 L 38 28 L 36 33 L 18 33 Z" fill="#fde68a" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M24 16 L 22 28 M32 16 L 30 28" stroke="${k}" stroke-width="1.2"/>
            <circle cx="30" cy="20" r="3.4" fill="#7dd3fc" stroke="${k}" stroke-width="1.4"/>
            <circle cx="29.4" cy="17.4" r="3" fill="#a16207" stroke="${k}" stroke-width="1.2"/>
            <path d="M26.4 17 L 32.4 17" stroke="#fde68a" stroke-width="1.6"/>
            <path d="M10 20 C 16 18, 28 17, 36 18" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
            <circle cx="46" cy="23" r="2.2" fill="#fbbf24" stroke="${k}" stroke-width="1.4"/>
            <g class="skyt-part skyt-part--prop" style="transform-origin: 48px 23px">
                <ellipse cx="48" cy="23" rx="1.6" ry="10" fill="#e2e8f0" stroke="${k}" stroke-width="1.2" opacity="0.9"/>
            </g>
            <circle cx="16" cy="35" r="2.6" fill="#334155" stroke="${k}" stroke-width="1.2"/>
            <circle cx="34" cy="35" r="2.6" fill="#334155" stroke="${k}" stroke-width="1.2"/>
        </g>
    `);
}

function hotAirBalloon({ uid, night }) {
    const k = ink(night);
    const stripes = night
        ? ['#6366f1', '#fcd34d', '#a855f7', '#fcd34d', '#6366f1']
        : ['#f43f5e', '#fde68a', '#38bdf8', '#fde68a', '#f43f5e'];
    const gores = [
        'M28 4 C 14 5, 6 16, 6 27 C 6 36, 14 44, 20 50 L 24 50 C 18 42, 14 34, 15 26 C 16 15, 21 7, 28 4 Z',
        'M28 4 C 21 7, 16 15, 15 26 C 14 34, 18 42, 24 50 L 28 50 C 25 42, 23 34, 23 26 C 23 15, 25 8, 28 4 Z',
        'M28 4 C 25 8, 23 15, 23 26 C 23 34, 25 42, 28 50 C 31 42, 33 34, 33 26 C 33 15, 31 8, 28 4 Z',
        'M28 4 C 31 8, 33 15, 33 26 C 33 34, 31 42, 28 50 L 32 50 C 38 42, 42 34, 41 26 C 40 15, 35 7, 28 4 Z',
        'M28 4 C 35 7, 40 15, 41 26 C 42 34, 38 42, 32 50 L 36 50 C 42 44, 50 36, 50 27 C 50 16, 42 5, 28 4 Z'
    ];
    return svg('0 0 56 76', `
        <defs>
            <radialGradient id="${uid}g" cx="0.35" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#fff" stop-opacity="${night ? 0.55 : 0.45}"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="${uid}l" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#fde68a" stop-opacity="0.75"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/>
            </radialGradient>
        </defs>
        ${night ? `<circle class="skyt-part skyt-part--pulse" cx="28" cy="28" r="28" fill="url(#${uid}l)"/>` : ''}
        ${gores.map((d, i) => `<path d="${d}" fill="${stripes[i]}"/>`).join('')}
        <path d="M28 4 C 42 5, 50 16, 50 27 C 50 36, 42 44, 36 50 L 20 50 C 14 44, 6 36, 6 27 C 6 16, 14 5, 28 4 Z" fill="url(#${uid}g)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M13 20 C 15 13, 20 9, 25 8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
        <path d="M20 50 L 22 60 M36 50 L 34 60 M28 50 L 28 60" stroke="${k}" stroke-width="1.3"/>
        <g class="skyt-part skyt-part--sway" style="transform-origin: 28px 50px">
            <path d="M20 60 L 36 60 L 34 71 C 34 72.5, 33 73, 32 73 L 24 73 C 23 73, 22 72.5, 22 71 Z" fill="#d97706" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M21 64 L 35 64 M22.5 68.5 L 33.5 68.5" stroke="#92400e" stroke-width="1.2"/>
            <path d="M33 60 L 33 53 L 39 55 L 33 57" fill="#34d399" stroke="${k}" stroke-width="1.2" stroke-linejoin="round"/>
            ${night ? '<circle cx="24.5" cy="58.5" r="2.4" fill="#fde68a" stroke="#b45309" stroke-width="1"/>' : ''}
        </g>
    `);
}

function cloudCameo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 72 56', `
        <defs>
            <linearGradient id="${uid}c" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${night ? '#e0e7ff' : '#ffffff'}"/><stop offset="1" stop-color="${night ? '#a5b4fc' : '#dbeafe'}"/>
            </linearGradient>
            <radialGradient id="${uid}m" cx="0.4" cy="0.35" r="0.7">
                <stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#fcd34d"/>
            </radialGradient>
        </defs>
        ${night ? `<path d="M52 4 C 42 6, 38 18, 44 26 C 50 32, 60 30, 64 24 C 56 26, 48 20, 49 12 C 49.4 8.6, 50.4 6, 52 4 Z" fill="url(#${uid}m)" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>` : ''}
        <path d="M12 48 C 3 48, 2 36, 11 34 C 10 22, 25 18, 30 26 C 34 14, 54 14, 56 28 C 66 26, 72 36, 66 43 C 68 49, 60 52, 55 50 C 48 54, 38 54, 34 50 C 28 54, 17 53, 12 48 Z"
              fill="url(#${uid}c)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M15 32 C 17 26, 22 24, 26 26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
        ${face(38, 38, { s: 1.05, night, sleepy: night })}
    `);
}

/* ───────────────────────── Wednesday — Midweek Magic ───────────────────────── */

function owl({ uid, night }) {
    const k = ink(night);
    const feather = night ? '#7c6fd6' : '#b7794b';
    const featherDark = night ? '#5b4fc0' : '#8a5530';
    const belly = night ? '#e0dbff' : '#fde8c8';
    const eye = night ? '#fde047' : '#fef9c3';
    return svg('0 0 64 60', `
        <defs>
            <radialGradient id="${uid}o" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stop-color="${night ? '#9d93ea' : '#d39a6a'}"/><stop offset="1" stop-color="${feather}"/>
            </radialGradient>
        </defs>
        <g class="skyt-part skyt-part--flap-back" style="transform-origin: 30px 34px">
            <path d="M28 34 C 20 20, 26 8, 40 6 C 38 16, 38 26, 34 34 Z" fill="${featherDark}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <g class="skyt-part skyt-part--flap" style="transform-origin: 22px 36px">
            <path d="M20 38 C 6 32, 2 18, 8 8 C 14 16, 20 22, 26 32 C 26 36, 24 39, 20 38 Z" fill="${feather}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M10 14 C 12 20, 16 26, 22 32" fill="none" stroke="${featherDark}" stroke-width="1.4" stroke-linecap="round"/>
        </g>
        <path d="M14 46 C 10 36, 12 22, 24 16 L 26 8 L 32 14 L 40 14 L 46 8 L 48 16 C 58 22, 58 38, 52 48 C 46 56, 22 56, 14 46 Z"
              fill="url(#${uid}o)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M22 44 C 20 36, 26 30, 36 30 C 46 30, 52 36, 48 46 C 44 52, 26 52, 22 44 Z" fill="${belly}"/>
        <path d="M28 40 q2 2 4 0 M36 40 q2 2 4 0 M32 45 q2 2 4 0" fill="none" stroke="${featherDark}" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="29" cy="24" r="7" fill="${eye}" stroke="${k}" stroke-width="2"/>
        <circle cx="44" cy="24" r="7" fill="${eye}" stroke="${k}" stroke-width="2"/>
        <g class="skyt-part skyt-part--blink">
            <circle cx="30" cy="24.5" r="3.6" fill="${k}"/><circle cx="45" cy="24.5" r="3.6" fill="${k}"/>
            <circle cx="31.2" cy="23.2" r="1.2" fill="#fff"/><circle cx="46.2" cy="23.2" r="1.2" fill="#fff"/>
        </g>
        <path d="M34.5 28 L 39.5 28 L 37 33 Z" fill="#f59e0b" stroke="${k}" stroke-width="1.4" stroke-linejoin="round"/>
        <ellipse cx="23.5" cy="31.5" rx="2.4" ry="1.4" fill="${BLUSH}" opacity="0.6"/>
        <ellipse cx="50" cy="31.5" rx="2.4" ry="1.4" fill="${BLUSH}" opacity="0.6"/>
        <path d="M28 53 l-2 4 M31 53.6 l0 4 M42 53.6 l0 4 M45 53 l2 4" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"/>
    `);
}

function wandCameo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 64 64', `
        <defs>
            <linearGradient id="${uid}w" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#6d28d9"/><stop offset="1" stop-color="#312e81"/>
            </linearGradient>
            <radialGradient id="${uid}s" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#facc15"/>
            </radialGradient>
        </defs>
        <g class="skyt-part skyt-part--wand" style="transform-origin: 14px 54px">
            <path d="M10 56 L 38 26 L 43 31 L 15 61 C 13.4 62.6, 11 62.6, 9.4 61 C 8 59.6, 8.4 57.6, 10 56 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M14 57.4 L 18 53.2 M17.6 61.2 L 21.6 57" stroke="#fde68a" stroke-width="2.2"/>
            <path d="M44 6 L 47.6 16 L 58 16.4 L 49.8 22.8 L 52.8 33 L 44 27 L 35.2 33 L 38.2 22.8 L 30 16.4 L 40.4 16 Z"
                  fill="url(#${uid}s)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M41 14 L 43.4 9.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
        </g>
        <g class="skyt-part skyt-part--twinkle" fill="${night ? '#c4b5fd' : '#fff'}">
            <path d="M58 40 l1.4 3.6 l3.6 1.4 l-3.6 1.4 l-1.4 3.6 l-1.4 -3.6 l-3.6 -1.4 l3.6 -1.4 z"/>
            <path d="M24 6 l1 2.6 l2.6 1 l-2.6 1 l-1 2.6 l-1 -2.6 l-2.6 -1 l2.6 -1 z"/>
        </g>
    `);
}

function pegasus({ uid, night }) {
    const k = ink(night);
    const coat = night ? '#e0e7ff' : '#ffffff';
    const coatShade = night ? '#a5b4fc' : '#e0e7ff';
    const mane = night
        ? ['#a78bfa', '#818cf8', '#f0abfc']
        : ['#f472b6', '#a78bfa', '#38bdf8'];
    return svg('0 0 80 60', `
        <defs>
            <linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${coat}"/><stop offset="1" stop-color="${coatShade}"/>
            </linearGradient>
            <linearGradient id="${uid}h" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#fffbe6"/>
            </linearGradient>
        </defs>
        <g class="skyt-part skyt-part--flap-back" style="transform-origin: 36px 30px">
            <path d="M34 30 C 30 14, 40 4, 54 4 C 50 12, 48 22, 42 30 Z" fill="${coatShade}" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <path d="M14 34 C 4 32, 2 42, 6 48 C 8 42, 12 40, 16 40" fill="${mane[0]}" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M14 38 C 6 40, 6 50, 12 54 C 12 48, 14 44, 18 42" fill="${mane[1]}" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M22 44 L 18 54 L 22 55 L 26 46 M44 44 L 46 54 L 50 53.6 L 48 44" fill="${coat}" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M14 36 C 14 28, 26 26, 40 28 C 48 29, 52 32, 52 38 C 52 44, 46 46, 38 46 L 22 46 C 16 46, 14 42, 14 36 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M46 32 C 48 24, 50 18, 56 14 C 64 10, 74 14, 76 22 C 77 27, 74 30, 70 30 L 62 30 C 58 32, 56 36, 52 38 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M62 13 L 70 1 L 67 14 Z" fill="url(#${uid}h)" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M58 12 C 52 12, 48 16, 46 22 C 44 28, 44 30, 46 32 C 48 26, 50 22, 54 20 C 52 24, 52 28, 54 30 C 56 24, 58 20, 62 17 Z" fill="${mane[2]}" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M56 13 C 54 16, 52 19, 50 24" fill="none" stroke="${mane[0]}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="67" cy="20.5" r="1.9" fill="${k}"/><circle cx="67.6" cy="19.8" r="0.6" fill="#fff"/>
        <ellipse cx="69" cy="25" rx="2.2" ry="1.3" fill="${BLUSH}" opacity="0.6"/>
        <circle cx="74.4" cy="24" r="0.8" fill="${k}"/>
        <g class="skyt-part skyt-part--flap" style="transform-origin: 32px 32px">
            <path d="M28 32 C 22 16, 32 2, 50 0 C 46 10, 46 20, 38 32 C 34 35, 30 35, 28 32 Z" fill="${coat}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M34 28 C 34 20, 38 12, 44 6 M38 30 C 40 24, 42 18, 46 14" fill="none" stroke="${coatShade}" stroke-width="1.6" stroke-linecap="round"/>
        </g>
    `);
}

/* ───────────────────────── Thursday — Hero Practice ───────────────────────── */

function kite({ uid, night }) {
    const k = ink(night);
    const c = night
        ? ['#818cf8', '#c084fc', '#6366f1', '#a78bfa']
        : ['#f43f5e', '#fbbf24', '#38bdf8', '#34d399'];
    const bows = night ? ['#fde68a', '#c4b5fd', '#fde68a'] : ['#f43f5e', '#fbbf24', '#38bdf8'];
    return svg('0 0 76 64', `
        <g class="skyt-part skyt-part--tail" style="transform-origin: 44px 38px">
            <path d="M44 38 C 34 44, 30 36, 22 42 C 14 48, 10 42, 2 48" fill="none" stroke="${k}" stroke-width="1.3"/>
            ${[[33, 40], [21, 43], [9, 45]].map(([x, y], i) => `
                <path d="M${x - 4} ${y - 3} L ${x} ${y} L ${x - 4} ${y + 3} Z M${x + 4} ${y - 3} L ${x} ${y} L ${x + 4} ${y + 3} Z" fill="${bows[i]}" stroke="${k}" stroke-width="1.1" stroke-linejoin="round"/>`).join('')}
        </g>
        <g transform="rotate(-18 56 26)">
            <path d="M56 2 L 70 22 L 56 26 Z" fill="${c[0]}"/>
            <path d="M70 22 L 56 50 L 56 26 Z" fill="${c[1]}"/>
            <path d="M56 50 L 42 22 L 56 26 Z" fill="${c[2]}"/>
            <path d="M42 22 L 56 2 L 56 26 Z" fill="${c[3]}"/>
            <path d="M56 2 L 70 22 L 56 50 L 42 22 Z" fill="none" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M56 2 L 56 50 M42 22 L 70 22" stroke="${k}" stroke-width="1.2" opacity="0.7"/>
            <path d="M46 20 L 55 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
            ${face(56, 29, { s: 0.75, night })}
        </g>
    `);
}

function comet({ uid, night }) {
    const k = ink(night);
    return svg('0 0 96 40', `
        <defs>
            <linearGradient id="${uid}t" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="${night ? '#a5b4fc' : '#bae6fd'}" stop-opacity="0"/>
                <stop offset="0.7" stop-color="${night ? '#c7d2fe' : '#e0f2fe'}" stop-opacity="0.7"/>
                <stop offset="1" stop-color="#fffbe6" stop-opacity="0.95"/>
            </linearGradient>
            <linearGradient id="${uid}t2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#fde68a" stop-opacity="0"/><stop offset="1" stop-color="#fde68a" stop-opacity="0.9"/>
            </linearGradient>
            <radialGradient id="${uid}h" cx="0.4" cy="0.35" r="0.7">
                <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#fef08a"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <radialGradient id="${uid}g" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#fef9c3" stop-opacity="0.9"/><stop offset="1" stop-color="#fef9c3" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <path d="M2 20 C 30 6, 56 6, 76 10 L 76 30 C 56 34, 30 34, 2 20 Z" fill="url(#${uid}t)"/>
        <path d="M20 20 C 40 13, 58 13, 76 15 L 76 25 C 58 27, 40 27, 20 20 Z" fill="url(#${uid}t2)"/>
        <circle class="skyt-part skyt-part--pulse" cx="78" cy="20" r="19" fill="url(#${uid}g)"/>
        <circle cx="78" cy="20" r="11" fill="url(#${uid}h)" stroke="${k}" stroke-width="2"/>
        <path d="M72 16 C 73 13, 76 11.4, 79 11.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        ${face(79, 20, { s: 0.62, night, gap: 6.4 })}
    `);
}

function medalCameo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 60 72', `
        <defs>
            <radialGradient id="${uid}g" cx="0.38" cy="0.32" r="0.75">
                <stop offset="0" stop-color="#fffbe6"/><stop offset="0.5" stop-color="#fcd34d"/><stop offset="1" stop-color="#d97706"/>
            </radialGradient>
            <clipPath id="${uid}clip"><circle cx="30" cy="46" r="18"/></clipPath>
        </defs>
        <path d="M14 2 L 26 30 L 34 30 L 22 2 Z" fill="#3b82f6" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M46 2 L 34 30 L 26 30 L 38 2 Z" fill="#ef4444" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M19 2 L 29 26" stroke="#fff" stroke-width="1.6" opacity="0.7"/>
        <circle cx="30" cy="46" r="18" fill="url(#${uid}g)" stroke="${k}" stroke-width="2.2"/>
        <circle cx="30" cy="46" r="13" fill="none" stroke="#b45309" stroke-width="1.4" stroke-dasharray="2 2.4"/>
        <path d="M30 36 L 32.8 42.4 L 39.6 43 L 34.4 47.4 L 36 54 L 30 50.4 L 24 54 L 25.6 47.4 L 20.4 43 L 27.2 42.4 Z" fill="#fff7d6" stroke="#b45309" stroke-width="1.4" stroke-linejoin="round"/>
        <g clip-path="url(#${uid}clip)">
            <g class="skyt-part skyt-part--shine"><rect x="6" y="24" width="8" height="46" fill="#fff" opacity="0.65" transform="rotate(24 10 47)"/></g>
        </g>
    `);
}

/* ───────────────────────── Friday — Celebration ───────────────────────── */

function parrot({ uid, night }) {
    const k = ink(night);
    const body = night ? '#8b5cf6' : '#ef4444';
    const bodyLight = night ? '#c4b5fd' : '#fb7185';
    return svg('0 0 76 56', `
        <defs>
            <linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${bodyLight}"/><stop offset="1" stop-color="${body}"/>
            </linearGradient>
        </defs>
        <g class="skyt-part skyt-part--flap-back" style="transform-origin: 38px 28px">
            <path d="M36 28 C 32 14, 40 4, 52 4 C 48 12, 46 20, 42 28 Z" fill="#1d4ed8" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <path d="M22 32 L 2 36 L 6 40 L 0 46 L 10 44 L 8 50 L 24 40 Z" fill="#fbbf24" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M22 34 L 4 44 L 12 46 Z" fill="#3b82f6" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M18 36 C 20 26, 36 22, 48 22 C 52 14, 64 12, 68 20 C 72 28, 66 38, 54 40 C 42 44, 26 44, 18 36 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M60 14 C 58 18, 58 26, 62 28 C 58 30, 56 34, 54 38" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>
        <path d="M66 18 C 72 17, 76 22, 74 28 C 72 26, 70 26, 68 27 Z" fill="#fde68a" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="62" cy="20" r="2.4" fill="#fff" stroke="${k}" stroke-width="1.2"/><circle cx="62.4" cy="20" r="1.3" fill="${k}"/>
        <ellipse cx="60" cy="25.6" rx="2.2" ry="1.2" fill="${BLUSH}" opacity="0.7"/>
        <path d="M58 10 C 58 6, 62 4, 64 6 C 62 7, 61 9, 61 12" fill="${bodyLight}" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        <g class="skyt-part skyt-part--flap" style="transform-origin: 34px 32px">
            <path d="M28 32 C 22 18, 30 4, 46 2 C 44 12, 42 22, 38 32 C 34 35, 30 35, 28 32 Z" fill="#22c55e" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M32 26 C 34 18, 38 12, 42 8" fill="none" stroke="#fde047" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M36 30 C 38 24, 40 20, 44 16" fill="none" stroke="#3b82f6" stroke-width="2.4" stroke-linecap="round"/>
        </g>
    `);
}

function blimp({ uid, night, flip }) {
    const k = ink(night);
    return svg('0 0 104 56', `
        <defs>
            <linearGradient id="${uid}e" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${night ? '#a5b4fc' : '#fde68a'}"/><stop offset="1" stop-color="${night ? '#6366f1' : '#f59e0b'}"/>
            </linearGradient>
            <clipPath id="${uid}clip"><ellipse cx="54" cy="24" rx="40" ry="18"/></clipPath>
        </defs>
        <path d="M18 16 L 4 6 L 6 22 Z M18 32 L 4 42 L 6 26 Z" fill="${night ? '#f472b6' : '#ef4444'}" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <ellipse cx="54" cy="24" rx="40" ry="18" fill="url(#${uid}e)"/>
        <g clip-path="url(#${uid}clip)">
            ${[24, 40, 56, 72, 88].map((x, i) => `<rect x="${x}" y="0" width="8" height="48" fill="${i % 2 ? (night ? '#f0abfc' : '#f43f5e') : '#fff'}" opacity="${i % 2 ? 0.9 : 0.55}"/>`).join('')}
            <ellipse cx="46" cy="14" rx="28" ry="5" fill="#fff" opacity="0.45"/>
        </g>
        <ellipse cx="54" cy="24" rx="40" ry="18" fill="none" stroke="${k}" stroke-width="2.2"/>
        <path d="M44 42 L 46 46 L 66 46 L 68 42" fill="none" stroke="${k}" stroke-width="1.2"/>
        <rect x="42" y="45" width="28" height="9" rx="3" fill="${night ? '#312e81' : '#fb7185'}" stroke="${k}" stroke-width="1.8"/>
        ${[48, 56, 64].map((x) => `<circle cx="${x}" cy="49.5" r="2" fill="${night ? '#fde047' : '#e0f2fe'}" stroke="${k}" stroke-width="1"/>`).join('')}
        <text x="56" y="28.5" text-anchor="middle" font-family="Fredoka, ui-rounded, sans-serif" font-weight="700" font-size="11" fill="${night ? '#1e1b4b' : '#9f1239'}"${mirrorText(flip, 56)}>HOORAY!</text>
        <g class="skyt-part skyt-part--prop" style="transform-origin: 2px 24px">
            <ellipse cx="3" cy="24" rx="1.4" ry="7" fill="#e2e8f0" stroke="${k}" stroke-width="1"/>
        </g>
        ${night ? '<circle class="skyt-part skyt-part--beacon" cx="94" cy="24" r="2.2" fill="#f87171"/>' : ''}
    `);
}

function popperCameo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 64 64', `
        <defs>
            <linearGradient id="${uid}p" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#9333ea"/>
            </linearGradient>
        </defs>
        <g class="skyt-part skyt-part--confetti">
            <rect x="36" y="6" width="5" height="3" rx="1" fill="#fbbf24" transform="rotate(30 38 7)"/>
            <rect x="48" y="14" width="5" height="3" rx="1" fill="#38bdf8" transform="rotate(-20 50 15)"/>
            <rect x="54" y="30" width="5" height="3" rx="1" fill="#34d399" transform="rotate(50 56 31)"/>
            <circle cx="44" cy="4" r="2" fill="#f43f5e"/><circle cx="58" cy="22" r="2" fill="#fde047"/>
            <path d="M26 8 q4 -4 6 2 q2 6 6 2" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>
            <path d="M50 38 q6 -2 4 4 q-2 6 4 6" fill="none" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
        </g>
        <path d="M6 60 L 18 24 L 42 48 Z" fill="url(#${uid}p)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M12 42 L 26 48 M15 33 L 34 42" stroke="#fde68a" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="30" cy="36" rx="17" ry="6" transform="rotate(45 30 36)" fill="#fbcfe8" stroke="${k}" stroke-width="2"/>
        <path d="M12 52 L 16 40" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
    `);
}

/* ───────────────────────── Saturday — Free Quest ───────────────────────── */

function ufo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 84 78', `
        <defs>
            <linearGradient id="${uid}d" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#e0f2fe" stop-opacity="0.95"/><stop offset="1" stop-color="#7dd3fc" stop-opacity="0.75"/>
            </linearGradient>
            <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#94a3b8"/>
            </linearGradient>
            <linearGradient id="${uid}beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fef08a" stop-opacity="0.85"/><stop offset="1" stop-color="#fef08a" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <path class="skyt-part skyt-part--beam" d="M32 46 L 52 46 L 72 78 L 12 78 Z" fill="url(#${uid}beam)"/>
        <path d="M22 32 C 22 8, 62 8, 62 32 Z" fill="url(#${uid}d)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <g>
            <path d="M37 18 L 34 6 M47 18 L 50 6" stroke="${k}" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="34" cy="5.4" r="1.8" fill="#f472b6" stroke="${k}" stroke-width="1"/>
            <circle cx="50" cy="5.4" r="1.8" fill="#f472b6" stroke="${k}" stroke-width="1"/>
            <path d="M31 32 C 29 14, 55 14, 53 32 Z" fill="#86efac" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
            <g class="skyt-part skyt-part--blink">
                <ellipse cx="38.5" cy="23" rx="2.2" ry="2.8" fill="${k}"/><ellipse cx="45.5" cy="23" rx="2.2" ry="2.8" fill="${k}"/>
                <circle cx="39.2" cy="22" r="0.8" fill="#fff"/><circle cx="46.2" cy="22" r="0.8" fill="#fff"/>
            </g>
            <path d="M39.6 27 q2.4 2 4.8 0" fill="none" stroke="${k}" stroke-width="1.3" stroke-linecap="round"/>
        </g>
        <path d="M27 20 C 28 16, 31 13, 35 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
        <ellipse cx="42" cy="38" rx="38" ry="10" fill="url(#${uid}s)" stroke="${k}" stroke-width="2.2"/>
        <ellipse cx="42" cy="34.6" rx="30" ry="4" fill="#fff" opacity="0.55"/>
        <path d="M22 46 C 30 50, 54 50, 62 46 L 60 42 L 24 42 Z" fill="#64748b" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        ${[14, 28, 42, 56, 70].map((x, i) => `<circle class="skyt-part skyt-part--lights" style="animation-delay:${-i * 0.18}s" cx="${x}" cy="${i === 0 || i === 4 ? 38 : 40}" r="2.4" fill="${['#f472b6', '#fde047', '#34d399', '#38bdf8', '#f472b6'][i]}" stroke="${k}" stroke-width="1"/>`).join('')}
    `);
}

function dragon({ uid, night }) {
    const k = ink(night);
    const scale = night ? '#8b5cf6' : '#22c55e';
    const scaleLight = night ? '#c4b5fd' : '#86efac';
    const belly = night ? '#fde68a' : '#fef3c7';
    const wing = night ? '#f0abfc' : '#fda4af';
    return svg('0 0 84 60', `
        <defs>
            <linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${scaleLight}"/><stop offset="1" stop-color="${scale}"/>
            </linearGradient>
        </defs>
        <g class="skyt-part skyt-part--flap-back" style="transform-origin: 38px 30px">
            <path d="M38 30 C 38 18, 44 8, 54 4 C 54 10, 58 12, 62 12 C 58 16, 58 20, 58 22 C 54 21, 50 24, 48 28 Z" fill="${wing}" opacity="0.85" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        </g>
        <g class="skyt-part skyt-part--tail" style="transform-origin: 20px 38px">
            <path d="M20 36 C 12 38, 8 44, 2 42 C 6 48, 14 48, 22 42 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 42 L -2 36 L 6 38 Z" fill="${wing}" stroke="${k}" stroke-width="1.6" stroke-linejoin="round" transform="translate(3 0)"/>
        </g>
        <path d="M26 46 L 24 54 L 29 54 L 31 47 M44 47 L 45 55 L 50 54.4 L 48 46" fill="${scale}" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M18 38 C 18 28, 34 26, 46 28 C 52 30, 54 36, 52 42 C 50 48, 40 48, 30 48 C 22 48, 18 44, 18 38 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M28 44 C 30 38, 40 36, 48 40 C 46 45, 34 47, 28 44 Z" fill="${belly}"/>
        <path d="M24 29 l3 -5 l3 4.4 l3 -5 l3 5 l3 -4.6 l2.4 5.4" fill="${wing}" stroke="${k}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M46 32 C 46 20, 54 12, 64 12 C 74 12, 80 18, 80 26 C 80 32, 76 36, 68 36 C 60 36, 52 38, 48 40 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M58 13 L 56 4 L 62 11 M66 12 L 68 3 L 70 12" fill="${belly}" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="76.4" cy="26" r="1" fill="${k}"/>
        <g class="skyt-part skyt-part--blink">
            <ellipse cx="66" cy="22" rx="2.4" ry="3" fill="${k}"/><circle cx="66.8" cy="20.8" r="0.9" fill="#fff"/>
        </g>
        <ellipse cx="69" cy="29" rx="2.6" ry="1.5" fill="${BLUSH}" opacity="0.7"/>
        <path d="M70 32 q3 2 6 0" fill="none" stroke="${k}" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M54 18 C 56 15, 60 14, 63 14" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
        <g class="skyt-part skyt-part--flap" style="transform-origin: 34px 32px">
            <path d="M30 32 C 26 20, 28 8, 36 0 C 38 6, 42 8, 48 8 C 46 12, 48 16, 52 18 C 48 20, 46 24, 46 28 C 42 30, 36 33, 30 32 Z" fill="${wing}" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M31 30 C 31 20, 33 10, 36 2 M34 31 C 38 22, 42 14, 47 9 M38 31 C 42 26, 46 22, 51 18" fill="none" stroke="${k}" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
        </g>
    `);
}

function treasureCameo({ uid, night }) {
    const k = ink(night);
    return svg('0 0 64 60', `
        <defs>
            <linearGradient id="${uid}w" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#c2703d"/><stop offset="1" stop-color="#8a4b24"/>
            </linearGradient>
            <radialGradient id="${uid}glow" cx="0.5" cy="0.9" r="0.7">
                <stop offset="0" stop-color="#fef08a" stop-opacity="0.95"/><stop offset="1" stop-color="#fef08a" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <ellipse class="skyt-part skyt-part--glow" cx="32" cy="26" rx="26" ry="22" fill="url(#${uid}glow)"/>
        <g class="skyt-part skyt-part--gems">
            <path d="M22 26 L 26 20 L 30 26 L 26 31 Z" fill="${night ? '#f0abfc' : '#f43f5e'}" stroke="${k}" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M32 24 L 36 17 L 40 24 L 36 30 Z" fill="#38bdf8" stroke="${k}" stroke-width="1.4" stroke-linejoin="round"/>
            <circle cx="44" cy="27" r="3.6" fill="#fcd34d" stroke="${k}" stroke-width="1.4"/>
            <circle cx="18" cy="28" r="3" fill="#fcd34d" stroke="${k}" stroke-width="1.2"/>
        </g>
        <path d="M8 30 L 56 30 L 54 54 C 54 56, 52 57, 50 57 L 14 57 C 12 57, 10 56, 10 54 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M8 36 L 56 36" stroke="#fbbf24" stroke-width="3"/>
        <path d="M20 30 L 20 57 M44 30 L 44 57" stroke="#fbbf24" stroke-width="3"/>
        <rect x="28" y="33" width="8" height="10" rx="2" fill="#fde68a" stroke="${k}" stroke-width="1.6"/>
        <circle cx="32" cy="37.4" r="1.4" fill="${k}"/>
        <g class="skyt-part skyt-part--lid" style="transform-origin: 8px 30px">
            <path d="M8 30 C 8 18, 56 18, 56 30 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M20 22 L 20 30 M44 22 L 44 30" stroke="#fbbf24" stroke-width="3"/>
            <path d="M14 26 C 18 22, 26 21, 30 21" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
        </g>
    `);
}

/* ───────────────────────── Seasonal guests ───────────────────────── */

function mapleLeaf({ uid, night }) {
    const k = ink(night);
    return svg('0 0 56 60', `
        <defs>
            <linearGradient id="${uid}l" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#fdba74"/><stop offset="0.55" stop-color="#f97316"/><stop offset="1" stop-color="#dc2626"/>
            </linearGradient>
        </defs>
        <path d="M28 2 L 32 14 L 40 10 L 38 22 L 50 18 L 46 28 L 54 32 L 40 38 L 42 46 L 30 42 L 30 56 L 26 56 L 26 42 L 14 46 L 16 38 L 2 32 L 10 28 L 6 18 L 18 22 L 16 10 L 24 14 Z"
              fill="url(#${uid}l)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M28 54 L 28 14 M28 34 L 14 26 M28 34 L 42 26 M28 42 L 18 40 M28 42 L 38 40" fill="none" stroke="#9a3412" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
        ${face(28, 28, { s: 0.7, night, gap: 6 })}
    `);
}

function bat({ uid, night }) {
    const k = ink(night);
    return svg('0 0 76 44', `
        <defs>
            <radialGradient id="${uid}b" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#4c1d95"/>
            </radialGradient>
        </defs>
        <g class="skyt-part skyt-part--flap-wide" style="transform-origin: 38px 22px">
            <path d="M30 22 C 22 8, 10 6, 2 12 C 8 14, 8 20, 6 24 C 12 20, 16 24, 16 28 C 20 24, 26 26, 30 28 Z" fill="#6d28d9" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M46 22 C 54 8, 66 6, 74 12 C 68 14, 68 20, 70 24 C 64 20, 60 24, 60 28 C 56 24, 50 26, 46 28 Z" fill="#6d28d9" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <path d="M30 12 L 31 4 L 35 10 L 41 10 L 45 4 L 46 12 C 50 16, 50 26, 46 30 C 42 34, 34 34, 30 30 C 26 26, 26 16, 30 12 Z" fill="url(#${uid}b)" stroke="${k}" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="34" cy="19" r="2.6" fill="#fde047"/><circle cx="42" cy="19" r="2.6" fill="#fde047"/>
        <g class="skyt-part skyt-part--blink"><circle cx="34.4" cy="19.2" r="1.3" fill="${k}"/><circle cx="42.4" cy="19.2" r="1.3" fill="${k}"/></g>
        <path d="M35 25 q3 2.4 6 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M36 26 l0.8 2 l0.8 -1.6" fill="#fff"/>
        <ellipse cx="31.6" cy="23.6" rx="1.8" ry="1" fill="${BLUSH}" opacity="0.7"/>
        <ellipse cx="44.4" cy="23.6" rx="1.8" ry="1" fill="${BLUSH}" opacity="0.7"/>
    `);
}

function snowflake({ uid, night }) {
    const k = ink(night);
    const arm = `
        <path d="M32 32 L 32 4" stroke="url(#${uid}s)" stroke-width="4" stroke-linecap="round"/>
        <path d="M32 12 L 26 7 M32 12 L 38 7 M32 20 L 25 15 M32 20 L 39 15" stroke="url(#${uid}s)" stroke-width="2.6" stroke-linecap="round"/>`;
    return svg('0 0 64 64', `
        <defs>
            <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${night ? '#a5b4fc' : '#7dd3fc'}"/>
            </linearGradient>
        </defs>
        <g class="skyt-part skyt-part--rays" style="transform-origin: 32px 32px">
            <g stroke="${k}" stroke-width="6.4" stroke-linecap="round" opacity="0.9">
                ${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M32 32 L 32 4 M32 12 L 26 7 M32 12 L 38 7 M32 20 L 25 15 M32 20 L 39 15" transform="rotate(${a} 32 32)"/>`).join('')}
            </g>
            ${[0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a} 32 32)">${arm}</g>`).join('')}
        </g>
        <circle cx="32" cy="32" r="11" fill="#fff" stroke="${k}" stroke-width="2"/>
        ${face(32, 31, { s: 0.62, night, gap: 5.6 })}
    `);
}

function butterfly({ uid, night }) {
    const k = ink(night);
    const a = night ? '#c084fc' : '#f472b6';
    const b = night ? '#818cf8' : '#fbbf24';
    return svg('0 0 64 56', `
        <defs>
            <radialGradient id="${uid}w" cx="0.3" cy="0.3" r="0.9">
                <stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/>
            </radialGradient>
        </defs>
        <g class="skyt-part skyt-part--flutter" style="transform-origin: 32px 28px">
            <path d="M30 26 C 22 6, 4 2, 4 14 C 4 22, 16 28, 30 28 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M30 30 C 18 30, 8 38, 12 46 C 16 52, 26 44, 30 32 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M34 26 C 42 6, 60 2, 60 14 C 60 22, 48 28, 34 28 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M34 30 C 46 30, 56 38, 52 46 C 48 52, 38 44, 34 32 Z" fill="url(#${uid}w)" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="14" cy="14" r="3" fill="#fff" opacity="0.8"/><circle cx="50" cy="14" r="3" fill="#fff" opacity="0.8"/>
            <circle cx="18" cy="40" r="2" fill="#fff" opacity="0.8"/><circle cx="46" cy="40" r="2" fill="#fff" opacity="0.8"/>
        </g>
        <path d="M30 16 C 26 8, 24 6, 22 6 M34 16 C 38 8, 40 6, 42 6" fill="none" stroke="${k}" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="22" cy="6" r="1.6" fill="${k}"/><circle cx="42" cy="6" r="1.6" fill="${k}"/>
        <ellipse cx="32" cy="30" rx="3.4" ry="14" fill="#6b4f3a" stroke="${k}" stroke-width="1.8"/>
        <circle cx="32" cy="17" r="4.4" fill="#6b4f3a" stroke="${k}" stroke-width="1.8"/>
        <circle cx="30.4" cy="16.6" r="0.9" fill="#fff"/><circle cx="33.6" cy="16.6" r="0.9" fill="#fff"/>
    `);
}

function bee({ uid, night }) {
    const k = ink(night);
    return svg('0 0 60 48', `
        <defs>
            <radialGradient id="${uid}b" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#fef08a"/><stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <clipPath id="${uid}clip"><ellipse cx="30" cy="30" rx="20" ry="14"/></clipPath>
        </defs>
        <g class="skyt-part skyt-part--flutter" style="transform-origin: 28px 20px">
            <ellipse cx="22" cy="10" rx="8" ry="11" transform="rotate(-24 22 10)" fill="#e0f2fe" opacity="0.9" stroke="${k}" stroke-width="1.8"/>
            <ellipse cx="34" cy="10" rx="7" ry="10" transform="rotate(18 34 10)" fill="#f0f9ff" opacity="0.9" stroke="${k}" stroke-width="1.8"/>
        </g>
        <path d="M10 30 L 3 30" stroke="${k}" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="30" cy="30" rx="20" ry="14" fill="url(#${uid}b)"/>
        <g clip-path="url(#${uid}clip)" fill="${k}">
            <rect x="15" y="10" width="5" height="40"/><rect x="25" y="10" width="5" height="40"/>
        </g>
        <ellipse cx="30" cy="30" rx="20" ry="14" fill="none" stroke="${k}" stroke-width="2.2"/>
        ${face(41, 28, { s: 0.6, night, gap: 5 })}
        <path d="M44 17 C 46 12, 50 10, 52 12 M40 17 C 40 12, 42 8, 44 8" fill="none" stroke="${k}" stroke-width="1.4" stroke-linecap="round"/>
    `);
}

export const ART = {
    rainbowCloud,
    dove,
    sunCameo,
    rocket,
    paperPlane,
    starCameo,
    bannerPlane,
    hotAirBalloon,
    cloudCameo,
    owl,
    wandCameo,
    pegasus,
    kite,
    comet,
    medalCameo,
    parrot,
    blimp,
    popperCameo,
    ufo,
    dragon,
    treasureCameo,
    mapleLeaf,
    bat,
    snowflake,
    butterfly,
    bee
};

let uidCounter = 0;

/**
 * @param {string} artId
 * @param {{ night?: boolean, flip?: boolean, text?: string }} [opts]
 */
export function renderArt(artId, opts = {}) {
    const builder = ART[artId];
    if (!builder) return '';
    uidCounter += 1;
    return builder({ uid: `skyt${uidCounter}-`, night: Boolean(opts.night), flip: Boolean(opts.flip), text: opts.text });
}
