// Hero Campfire scenery: inline SVG only (no image or audio downloads besides the shared moon).
import moonUrl from '../../assets/celestial/moon.jpg?url';

export const escapeCampfire = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const flameMark = '<svg viewBox="0 0 48 64" aria-hidden="true"><path fill="#fc733e" d="M25 1C38 20 47 29 43 43 39 60 13 65 5 47-2 30 16 23 16 12c6 5 8 9 7 14C30 17 30 9 25 1Z"/><path fill="#ffc662" d="M25 20c10 13 14 20 9 29-5 10-20 9-23-1-3-11 9-17 10-23l4 10c4-5 3-9 0-15Z"/><path fill="#fff4c4" d="M24 37c4 7 10 11 5 16-5 6-13 1-11-5 1-4 5-6 6-11Z"/></svg>';
export const telescopeMark = '<span class="cf-telescope-icon" aria-hidden="true">🔭</span>';

// Deterministic, hand-tuned pine silhouettes (no randomness → identical on every render).
function pines(color, base, count, minH, maxH, seed) {
    let paths = '';
    for (let i = 0; i < count; i++) {
        const jitter = ((i * 73 + seed * 31) % 97) / 97;
        const x = (i + jitter * 0.6) * 1440 / count, h = minH + ((i * 47 + seed * 13) % 100) / 100 * (maxH - minH), w = h * 0.42;
        const top = base - h, f = n => n.toFixed(1);
        // Three stacked, widening tiers and a short trunk.
        for (let k = 0; k < 3; k++) {
            const apex = top + k * h * 0.2, bottom = top + h * (0.42 + k * 0.24), half = w * (0.28 + k * 0.11);
            paths += 'M' + f(x) + ' ' + f(apex) + 'L' + f(x - half) + ' ' + f(bottom) + 'Q' + f(x) + ' ' + f(bottom - h * 0.05) + ' ' + f(x + half) + ' ' + f(bottom) + 'Z';
        }
        paths += 'M' + f(x - w * 0.05) + ' ' + f(top + h * 0.9) + 'h' + f(w * 0.1) + 'V' + f(base + 4) + 'h' + f(-w * 0.1) + 'Z';
    }
    return '<path fill="' + color + '" d="' + paths + '"/>';
}

export function campfireScenery() {
    const stars = Array.from({ length: 90 }, (_, i) => {
        const x = (i * 137.5 + 35) % 1440, y = (i * 61.8 + 12) % 470, r = i % 7 === 0 ? 1.6 : i % 3 === 0 ? 1.1 : 0.7;
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" opacity="' + (0.3 + (i % 5) * 0.12).toFixed(2) + '"' + (i % 9 === 0 ? ' class="cf-twinkle"' : '') + '/>';
    }).join('');
    return '<div class="cf-sky" aria-hidden="true"><div class="cf-aurora"></div>' +
        '<div class="cf-moon-wrap"><img class="cf-moon" src="' + moonUrl + '" alt=""></div>' +
        '<svg class="cf-landscape" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">' +
        '<defs><linearGradient id="cf-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d6a9c" stop-opacity="0"/><stop offset="1" stop-color="#6d6a9c" stop-opacity=".22"/></linearGradient></defs>' +
        '<g fill="#f6ecd2">' + stars + '</g>' +
        '<path fill="#2a2b4d" d="M0 540L150 430L260 480L420 360L560 470L700 400L860 330L1010 450L1150 390L1300 470L1440 420V900H0Z"/>' +
        '<path fill="url(#cf-mist)" d="M0 480H1440V640H0Z"/>' +
        '<g class="cf-layer cf-layer-1">' + pines('#1f2a42', 640, 44, 60, 120, 1) + '<path fill="#1f2a42" d="M0 630Q360 560 720 610T1440 590V900H0Z"/></g>' +
        '<g class="cf-layer cf-layer-2">' + pines('#15222f', 715, 30, 90, 170, 2) + '<path fill="#15222f" d="M0 705Q380 640 720 690T1440 680V900H0Z"/></g>' +
        '<g class="cf-layer cf-layer-3">' + pines('#0c1820', 800, 16, 150, 260, 3) + '<path fill="#0d1a21" d="M0 790Q720 700 1440 790V900H0Z"/></g>' +
        '</svg></div>' +
        '<div class="cf-warmth" aria-hidden="true"></div>' +
        '<div class="cf-hearth" aria-hidden="true">' +
        '<div class="cf-ground-light"></div>' +
        '<svg class="cf-stones" viewBox="0 0 480 140">' +
        '<ellipse cx="240" cy="78" rx="168" ry="34" fill="#0a1216" opacity=".85"/>' +
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => {
            const a = i / 11 * Math.PI * 2, x = 240 + Math.cos(a) * 138, y = 70 + Math.sin(a) * 28, front = Math.sin(a) > 0;
            return '<ellipse class="cf-stone-rock" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (front ? 25 : 19) + '" ry="' + (front ? 14 : 10) + '" fill="' + (front ? '#4a4652' : '#3a3743') + '" transform="rotate(' + (i * 23) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
        }).join('') +
        '</svg>' +
        '<canvas class="cf-fire"></canvas>' +
        '<svg class="cf-logs" viewBox="0 0 480 120"><g stroke-linecap="round">' +
        '<path d="M150 88L322 58" stroke="#2b1c18" stroke-width="30"/><path d="M160 58L330 90" stroke="#2b1c18" stroke-width="30"/>' +
        '<path d="M150 84L322 54" stroke="#6d4a3a" stroke-width="20"/><path d="M160 54L330 86" stroke="#6d4a3a" stroke-width="20"/>' +
        '<path d="M156 80L316 52M166 52L324 82" stroke="#c9844d" stroke-width="2.5" opacity=".7"/>' +
        '</g><g class="cf-coals"><circle cx="150" cy="86" r="7" fill="#e0783a"/><circle cx="330" cy="88" r="7" fill="#e0783a"/><circle cx="160" cy="55" r="5" fill="#f09a4c"/><circle cx="322" cy="56" r="5" fill="#f09a4c"/></g></svg>' +
        '</div><div class="cf-vignette" aria-hidden="true"></div>';
}

export { constellationMarkup, constellationKinds, oathStarCategory, constellationPeek } from '../campfireConstellation.mjs';
