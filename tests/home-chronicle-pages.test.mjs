import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildTrainingPage, buildStarfallPage, buildOathsPage, buildSealsPage, buildDragonPage,
    buildFestivalPage, pickLowerPages, LOWER_PAGE_COUNT
} from '../features/homeChroniclePages.mjs';

const now = new Date(2026, 10, 6, 12);

test('Training Grounds page shows all four games and the next bonus star', () => {
    const page = buildTrainingPage({
        story: { storyAdditionsCount: 3, currentWord: 'brave', currentSentence: 'The fox <ran>' },
        games: { hoard: { rounds: 2, log: [{ date: '2026-11-04', ok: true }] }, map: { rounds: 1, log: [] } },
        now
    });
    assert.equal(page.kind, 'training');
    for (const name of ['Story', 'Hoard', 'Map', 'Council']) assert.match(page.summary, new RegExp(`>${name}<`));
    assert.match(page.summary, /Story or Map/);
    assert.match(page.summary, /bonus star/);
    assert.match(page.detail, /The Vanishing Hoard/);
    assert.match(page.detail, /&lt;ran&gt;/);
    assert.doesNotMatch(page.summary + page.detail, /today's stars/i);
    assert.equal(page.open.tab, 'reward-ideas-tab');
});

test('Training Grounds page with nothing played is marked empty', () => {
    const page = buildTrainingPage({ now });
    assert.equal(page.empty, true);
    assert.match(page.summary, /Four games are ready/);
});

test('Starfall page appears only when stars wait, and names every hero', () => {
    assert.equal(buildStarfallPage({ waiting: [] }), null);
    const waiting = Array.from({ length: 9 }, (_, i) => ({ studentId: `s${i}`, bonusAmount: 0.5 }));
    const names = Object.fromEntries(waiting.map((w, i) => [w.studentId, `Hero${i} Surname`]));
    const page = buildStarfallPage({ waiting, names });
    assert.match(page.summary, /4\.5/);
    for (let i = 0; i < 9; i++) assert.match(page.detail, new RegExp(`Hero${i}<`));
    assert.doesNotMatch(page.detail, /\+\d/);
});

test('Oaths page counts burning, ready and kept this month only', () => {
    const oaths = [
        { id: 'a', status: 'active' }, { id: 'b', status: 'active' },
        { id: 'c', status: 'kept', keptAt: new Date(2026, 10, 2) },
        { id: 'd', status: 'kept', keptAt: new Date(2026, 9, 2) }
    ];
    const page = buildOathsPage({ oaths, readyIds: ['a'], now });
    assert.match(page.summary, /<b>2<\/b><small>burning/);
    assert.match(page.summary, /<b>1<\/b><small>ready/);
    assert.match(page.summary, /<b>1<\/b><small>kept/);
    assert.equal(page.real, true);
    assert.equal(buildOathsPage({ oaths: null }), null);
});

test('Seals page lists every hero of the week, nobody behind +N', () => {
    const seal = { name: 'Seal of Focus', icon: 'fa-bullseye', tint: '#c8711f' };
    const presses = Array.from({ length: 7 }, (_, i) => ({ name: `Kid${i} X`, seal, at: now.getTime() - i * 3600000 }));
    presses.push({ name: 'Old One', seal, at: now.getTime() - 9 * 86400000 });
    const page = buildSealsPage({ presses, now });
    assert.match(page.summary, /7 seals/);
    for (let i = 0; i < 7; i++) assert.match(page.detail, new RegExp(`Kid${i}<`));
    assert.doesNotMatch(page.detail, /Old/);
});

test('Dragon page sums the week', () => {
    const page = buildDragonPage({ sessions: [{ at: new Date(2026, 10, 5), minutes: 4, reward: 'Gold' }, { at: new Date(2026, 10, 3), minutes: 3 }], now });
    assert.match(page.summary, /<b>7<\/b> calm minutes/);
    assert.equal(buildDragonPage({ sessions: [], now }).real, false);
});

test('Bottom row always has three pages, real news first, in a stable order', () => {
    const festival = buildFestivalPage({ next: { id: 'christmas', name: 'Christmas', tagline: 'Twinkly', days: 20 } });
    const seals = buildSealsPage({ presses: [], now });
    const dragon = buildDragonPage({ sessions: [{ at: now, minutes: 2 }], now });
    const oaths = buildOathsPage({ oaths: [], now });
    const starfall = buildStarfallPage({ waiting: [{ studentId: 'a' }], names: { a: 'Ann' } });
    let row = pickLowerPages({ starfall, oaths, seals, dragon, festival });
    assert.equal(row.length, LOWER_PAGE_COUNT);
    assert.deepEqual(row.map((p) => p.kind), ['starfall', 'dragon', 'festival']);
    row = pickLowerPages({ oaths: null, seals, dragon: buildDragonPage({ now }), festival: buildFestivalPage({ next: { id: 'easter', name: 'Easter', tagline: 'Eggs', days: 120 } }) });
    assert.deepEqual(row.map((p) => p.kind), ['seals', 'dragon', 'festival']);
});
