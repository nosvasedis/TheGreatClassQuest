// Dev-only preview of the Wonder Library projector cards, in the real Sky Card frame.
// /wonder-library-preview.html?league=Pre-Junior|Junior A|A|D&date=2026-10-28
import { buildSkyCardElement } from './ui/wallpaper.js';
import { hydrateWonderCard, WONDER_CARD_TYPES, WONDER_FOR_AI_CARD } from './ui/wallpaperWonderCards.js';

const params = new URLSearchParams(location.search);
const league = params.get('league') || 'A';
const only = params.get('only');
const date = params.get('date');
if (date) {
    const RealDate = Date;
    const fixed = new RealDate(`${date}T10:00:00`).getTime();
    globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
}

document.getElementById('wl-head').innerHTML = `League ${league} · ${['Pre-Junior', 'Junior A', 'A', 'D'].map((l) => `<a href="?league=${encodeURIComponent(l)}${date ? `&date=${date}` : ''}">${l}</a>`).join('')}`;
const grid = document.getElementById('wl-grid');
const types = only ? only.split(',') : [...WONDER_CARD_TYPES, ...Object.keys(WONDER_FOR_AI_CARD)];
for (const type of types) {
    const content = await hydrateWonderCard(type, league);
    if (!content) continue;
    const el = buildSkyCardElement({ id: type, ...content });
    el.style.opacity = '1';
    grid.appendChild(el);
}
