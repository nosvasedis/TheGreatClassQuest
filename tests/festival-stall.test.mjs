import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SHOP_FESTIVAL_IDS, getFestivalWindow } from '../utils/shopCalendar.js';
import {
    FESTIVAL_STALL_LOOKS,
    festivalCountdown,
    festivalDaysLeft,
    renderFestivalStall
} from '../ui/core/festivalStall.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const athensNoon = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 10));

test('every celebration in the calendar has its own stall look', () => {
    for (const id of SHOP_FESTIVAL_IDS) {
        const look = FESTIVAL_STALL_LOOKS[id];
        assert.ok(look, id);
        assert.ok(look.emblem && look.icon && look.greeting && look.sky.length >= 6, id);
        assert.match(look.colors.accent, /^#/, id);
        assert.match(read('styles/festival_stall.css'), new RegExp(`data-festival='${id}'`), `${id} dresses the awning`);
    }
});

test('the countdown counts Athens days to the end of the window', () => {
    const halloween = getFestivalWindow('halloween', 2026);
    assert.equal(festivalDaysLeft(halloween, athensNoon(2026, 10, 12)), 19);
    assert.deepEqual(festivalCountdown(halloween, athensNoon(2026, 10, 30)), { value: '1', label: 'day left', last: true, feast: false });
    const lastDay = festivalCountdown(halloween, athensNoon(2026, 10, 31));
    assert.equal(lastDay.label, 'Last day');
    assert.equal(lastDay.feast, true);
    const newYear = getFestivalWindow('newyear', 2027);
    assert.equal(festivalCountdown(newYear, athensNoon(2027, 1, 10)).value, '15');
});

test('the stall keeps the aisle contract and gilds its priciest piece', () => {
    const festival = getFestivalWindow('halloween', 2026);
    const html = renderFestivalStall(festival, [
        { id: 'a', name: 'Pumpkin Lamp', price: 12, stock: 5, description: 'Glows.', image: 'https://x/a.png' },
        { id: 'b', name: 'Music Box', price: 96, stock: 1, description: 'Plays.', image: 'https://x/b.png' }
    ], { now: athensNoon(2026, 10, 12) });
    assert.match(html, /class="mm-aisle mm-aisle--festival mm-fest mm-fest--halloween mm-fest--flutter"/);
    assert.match(html, /data-aisle="festival"/);
    assert.match(html, /id="shop-aisle-festival"/);
    assert.match(html, /mm-aisle__none/);
    assert.equal((html.match(/mm-ware--fest-star/g) || []).length, 1);
    assert.match(html, /data-name="Music Box"[^]*?$/);
    assert.match(html, /19<\/span>\s*<span class="mm-fest__clock-label">days left/);
    assert.match(html, /--fest-accent:#fb923c/);
});

test('a stall still being made shows the marquee with an unpacking note and no shelf', () => {
    const html = renderFestivalStall(getFestivalWindow('christmas', 2026), [], { preparing: true, now: athensNoon(2026, 12, 5) });
    assert.match(html, /is-preparing/);
    assert.match(html, /unpacking the Christmas treasures/);
    assert.doesNotMatch(html, /mm-shelf-grid/);
});

test('names are escaped and the feast day swaps the title for a greeting', () => {
    const html = renderFestivalStall({ ...getFestivalWindow('easter', 2026), name: '<b>Easter</b>' }, [], { now: athensNoon(2026, 4, 12) });
    assert.doesNotMatch(html, /<b>Easter<\/b>/);
    assert.match(html, /Happy Easter!/);
});

test('decorations stay light: transform-only motion, lite mode, pause offscreen, reduced motion', () => {
    const css = read('styles/festival_stall.css');
    assert.match(css, /\.mm-fest--lite \.mm-fest__bit:nth-child\(n \+ 5\) \{ display: none; \}/);
    assert.match(css, /\.mm-fest\.is-offscreen \*/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[^]*\.mm-fest__bit \{ display: none; \}/);
    const keyframes = css.match(/@keyframes[^{]+\{[^]*?\n\}/g) || [];
    for (const block of keyframes) {
        assert.doesNotMatch(block, /\b(top|left|width|height|margin|box-shadow|filter):/, block.split('\n')[0]);
    }
    // Loaded with the Market's own chunk, not the app's first paint.
    const shop = read('ui/core/shop.js');
    assert.match(shop, /import '\.\.\/\.\.\/styles\/festival_stall\.css';/);
    assert.match(shop, /renderFestivalStall\(activeFestival, festivalItems/);
    assert.match(shop, /mm-fest--lite', detectLowPowerTier\(\)/);
    assert.match(shop, /IntersectionObserver/);
});
