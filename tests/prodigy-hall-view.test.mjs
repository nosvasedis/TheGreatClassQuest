import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    buildProdigyEmptyHtml,
    buildProdigyNavHtml,
    buildProdigyShrinesHtml,
    buildProdigyYearHtml,
    getProdigyHonour,
} from '../ui/modals/prodigyHallView.js';

const winner = (id, name, extra = {}) => ({
    id, name, avatar: '', monthlyStars: 12,
    stats: { count3: 2, uniqueReasons: 4, academicAvg: 0 },
    ...extra,
});

test('honour follows the written-work thresholds', () => {
    assert.equal(getProdigyHonour(95).title, 'Ancient Sage');
    assert.equal(getProdigyHonour(90).title, 'Ancient Sage');
    assert.equal(getProdigyHonour(71).title, 'Learned Hero');
    assert.equal(getProdigyHonour(0).title, 'Heroic Spirit');
});

test('one winner gets the solo stage with crowns and treasures', () => {
    const html = buildProdigyShrinesHtml({
        winners: [winner('a', 'Maria')],
        monthName: 'July 2026',
        crownsById: new Map([['a', 3]]),
        inventoryById: { a: [{ name: 'Orb', icon: '🔮' }] },
    });
    assert.match(html, /ph-stage--solo/);
    assert.match(html, /Prodigy of the Month/);
    assert.match(html, />3×</);
    assert.equal((html.match(/ph-tally__crown/g) || []).length, 3);
    assert.match(html, /🔮/);
    assert.doesNotMatch(html, /ph-ribbon/);
});

test('a tie gives every Co-Prodigy a niche and escapes names', () => {
    const html = buildProdigyShrinesHtml({
        winners: [winner('a', '<b>Ann</b>'), winner('b', 'Ben')],
        monthName: 'May 2026',
        direction: 'prev',
    });
    assert.match(html, /ph-stage--duo/);
    assert.match(html, /ph-stage--from-prev/);
    assert.equal((html.match(/class="ph-shrine ph-shrine--co"/g) || []).length, 2);
    assert.match(html, /2 Co-Prodigies share the crown/);
    assert.match(html, /&lt;b&gt;Ann&lt;\/b&gt;/);
    assert.doesNotMatch(html, /<b>Ann/);
    assert.match(html, /No treasures from the Market yet/);
    assert.match(buildProdigyShrinesHtml({ winners: [winner('a', 'A'), winner('b', 'B'), winner('c', 'C')], monthName: 'x' }), /ph-stage--many/);
});

test('nav keeps the wired button ids and disables the ends', () => {
    const html = buildProdigyNavHtml({ monthName: 'July 2026', canGoBack: true, canGoForward: false });
    assert.match(html, /id="prodigy-prev-btn"[^>]*aria-label="Earlier month" >/);
    assert.match(html, /id="prodigy-next-btn"[^>]*disabled/);
});

test('year coins: crowned months are buttons, the live month is not', () => {
    const html = buildProdigyYearHtml([
        { key: '2025-09', short: 'Sep', label: 'September 2025', state: 'crowned', isCurrent: false, winners: [{ name: 'Maria', avatar: '' }] },
        { key: '2025-10', short: 'Oct', label: 'October 2025', state: 'crowned', isCurrent: true, winners: [{ name: 'A' }, { name: 'B' }] },
        { key: '2025-11', short: 'Nov', label: 'November 2025', state: 'empty', isCurrent: false, winners: [] },
        { key: '2025-12', short: 'Dec', label: 'December 2025', state: 'live', isCurrent: false, winners: [] },
    ]);
    assert.equal((html.match(/data-prodigy-month=/g) || []).length, 3);
    assert.match(html, /data-prodigy-month="2025-10" aria-current="true"/);
    assert.match(html, /ph-coin__co[^>]*>2</);
    assert.match(html, /December 2025: still being earned/);
    assert.match(html, /<span class="ph-coin ph-coin--live"/);
    assert.equal(buildProdigyYearHtml([]), '');
});

test('empty pedestals name the month', () => {
    assert.match(buildProdigyEmptyHtml({ variant: 'quiet', monthName: 'March 2026' }), /March 2026/);
    assert.match(buildProdigyEmptyHtml({ variant: 'new-year' }), /first school month closes/);
});

test('modal template keeps the ids rankings.js and listeners.js rely on', () => {
    const template = readFileSync(new URL('../templates/modals/hero.js', import.meta.url), 'utf8');
    for (const id of ['prodigy-modal', 'prodigy-close-btn', 'prodigy-nav-container', 'prodigy-content', 'prodigy-year-strip']) {
        assert.match(template, new RegExp(`id="${id}"`));
    }
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    assert.match(css, /styles\/prodigy_hall\.css/);
});
