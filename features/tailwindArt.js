// features/tailwindArt.js — the Tailwind's drawn look, shared by the Guild Hall and Fortune's Wheel.

/** Three curling gusts, drawn in currentColor. CSS (.tw-glyph) makes the gusts flow. */
export function tailwindGlyphSvg(cls = '') {
    return `<svg class="tw-glyph ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`
        + '<path class="tw-glyph__g1" d="M2.5 8.5h10.5a3 3 0 1 0-3-3"/>'
        + '<path class="tw-glyph__g2" d="M2.5 12.5h15a3.2 3.2 0 1 1-3.2 3.2"/>'
        + '<path class="tw-glyph__g3" d="M4.5 16.5h5.5"/>'
        + '</svg>';
}

/** How many of the three pips a Tailwind level lights (Breeze 1, Strong wind 2, Gale 3). */
export function tailwindPips(key = '') {
    return ({ breeze: 1, wind: 2, gale: 3 })[key] || 0;
}

/** Three small pips, lit up to the level. */
export function tailwindPipsHtml(key = '', cls = 'tw-pips') {
    const lit = tailwindPips(key);
    return `<span class="${cls}" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < lit ? 'is-on' : ''}"></i>`).join('')}</span>`;
}
