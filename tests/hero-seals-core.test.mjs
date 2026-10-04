import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SEALS,
    SHARED_SEALS,
    PERSONAL_SLOTS,
    buildSealBook,
    bookSealIds,
    evaluateSeals,
    newSealPresses,
    buildSealBookView,
    collectNewSeals,
    sealsPressedOn,
    sealDateKey,
    sealArtHtml,
    sealReason,
    waxOutlinePath,
} from '../features/heroSealsCore.mjs';

const award = (date, reason, stars = 1) => ({ date, reason, stars });

test('every seal is complete and every shared seal exists', () => {
    for (const s of Object.values(SEALS)) {
        assert.ok(s.id && s.name && s.icon && /^#[0-9a-f]{6}$/i.test(s.tint) && s.how && s.told, s.id);
    }
    SHARED_SEALS.forEach((id) => assert.ok(SEALS[id], id));
    assert.equal(SHARED_SEALS.length, 10);
});

test('sealDateKey reads the app\'s date shapes', () => {
    assert.equal(sealDateKey('04-10-2026'), '2026-10-04');
    assert.equal(sealDateKey('2026-10-04'), '2026-10-04');
    assert.equal(sealDateKey({ seconds: new Date(2026, 9, 4, 12).getTime() / 1000 }), '2026-10-04');
    assert.equal(sealDateKey(''), '');
});

test('the book branches per child and stays stable', () => {
    const a = buildSealBook({ studentId: 'a1', heroClass: 'Guardian', guildId: 'owl_wisdom', trials: [{ pct: 95 }, { pct: 91 }] });
    assert.equal(a.path, 'path_guardian');
    assert.equal(a.guild, 'guild_owl_wisdom');
    assert.equal(a.quill, 'quill_golden');
    assert.equal(a.hearth, 'hearth_full_moon');
    assert.notEqual(a.wild1, a.wild2);
    assert.deepEqual(buildSealBook({ studentId: 'a1', heroClass: 'Guardian', guildId: 'owl_wisdom', trials: [{ pct: 95 }] }), a);

    const b = buildSealBook({ studentId: 'b2', recentAbsences: 3, occasions: ['03-12'], hasOccasion: true, usesTrials: false });
    assert.equal(b.path, 'path_choose');
    assert.equal(b.guild, 'guild_sorted');
    assert.equal(b.quill, 'quill_star');
    assert.equal(b.hearth, 'hearth_return');
    assert.equal(b.wild1, 'wild_candle');

    // Different children draw different wild seals somewhere in a class.
    const draws = new Set(Array.from({ length: 12 }, (_, i) => buildSealBook({ studentId: `kid${i}` }).wild1));
    assert.ok(draws.size >= 3);
    assert.equal(bookSealIds(a).length, SHARED_SEALS.length + PERSONAL_SLOTS.length);
});

test('a stored book keeps drawn slots, identity slots follow the child, earned seals never move', () => {
    const stored = { path: 'path_choose', quill: 'quill_rising', hearth: 'hearth_return', guild: 'guild_sorted', wild1: 'wild_chain', wild2: 'wild_generous' };
    const next = buildSealBook({ studentId: 'x', heroClass: 'Sage', guildId: 'dragon_flame', trials: [{ pct: 99 }] }, stored);
    assert.equal(next.path, 'path_sage');
    assert.equal(next.guild, 'guild_dragon_flame');
    assert.equal(next.quill, 'quill_rising');
    assert.equal(next.hearth, 'hearth_return');
    assert.equal(next.wild1, 'wild_chain');
    const kept = buildSealBook({ studentId: 'x', heroClass: 'Sage', earned: { path_choose: { date: '2026-09-10' } } }, stored);
    assert.equal(kept.path, 'path_choose');
});

test('virtues, the Four Winds and the guild month', () => {
    const awards = [
        award('2026-09-08', 'respect'), award('2026-09-10', 'teamwork', 2), award('2026-10-01', 'creativity'),
        award('2026-10-02', 'focus'), award('2026-10-03', 'respect'), award('2026-10-03', 'teamwork', 3), award('2026-10-04', 'focus', 4),
    ];
    const ids = ['virtue_respect', 'virtue_creativity', 'virtue_teamwork', 'virtue_focus', 'four_winds', 'guild_owl_wisdom', 'wild_bright_day'];
    const out = evaluateSeals(ids, { today: '2026-10-04', awards, guildId: 'owl_wisdom' });
    assert.equal(out.virtue_respect.date, '2026-09-08');
    assert.equal(out.virtue_creativity.date, '2026-10-01');
    assert.equal(out.four_winds.date, '2026-10-03');
    assert.equal(out.guild_owl_wisdom.date, '2026-10-04');
    assert.equal(out.wild_bright_day.date, '2026-10-03');
    // Younger leagues need 8 stars.
    const young = evaluateSeals(['guild_owl_wisdom'], { today: '2026-10-04', awards, guildId: 'owl_wisdom', young: true });
    assert.equal(young.guild_owl_wisdom.date, '2026-10-04');
    const short = awards.slice(0, -1);
    assert.equal(evaluateSeals(['guild_owl_wisdom'], { today: '2026-10-04', awards: short, guildId: 'owl_wisdom' }).guild_owl_wisdom, undefined);
    assert.equal(evaluateSeals(['guild_owl_wisdom'], { today: '2026-10-04', awards: [...short, award('2026-10-04', 'focus', 2)], guildId: 'owl_wisdom', young: true }).guild_owl_wisdom.date, '2026-10-04');
    assert.equal(evaluateSeals(['guild_owl_wisdom'], { today: '2026-10-04', awards: [...short, award('2026-10-04', 'focus', 2)], guildId: 'owl_wisdom' }).guild_owl_wisdom, undefined);
});

test('Steadfast needs ten lessons in a row; an absence restarts the count', () => {
    const lessons = Array.from({ length: 14 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    assert.equal(evaluateSeals(['steadfast'], { today: '2026-09-30', lessons }).steadfast.date, '2026-09-10');
    const out = evaluateSeals(['steadfast'], { today: '2026-09-30', lessons, absences: ['2026-09-05'] });
    assert.equal(out.steadfast, undefined);
    // Today's lesson only counts with a star that proves the child was there.
    const ten = lessons.slice(0, 10);
    assert.equal(evaluateSeals(['steadfast'], { today: '2026-09-10', lessons: ten }).steadfast, undefined);
    assert.equal(evaluateSeals(['steadfast'], { today: '2026-09-10', lessons: ten, awards: [award('2026-09-10', 'focus')] }).steadfast.date, '2026-09-10');
});

test('personal best needs two earlier results of that kind', () => {
    const trials = [
        { date: '2026-09-01', type: 'test', pct: 70 }, { date: '2026-09-08', type: 'dictation', pct: 60 },
        { date: '2026-09-15', type: 'test', pct: 72 }, { date: '2026-09-22', type: 'test', pct: 71 },
        { date: '2026-09-29', type: 'test', pct: 82 },
    ];
    assert.equal(evaluateSeals(['personal_best'], { today: '2026-10-04', trials }).personal_best.date, '2026-09-29');
    assert.equal(evaluateSeals(['quill_rising'], { today: '2026-10-04', trials }).quill_rising.date, '2026-09-29');
    assert.equal(evaluateSeals(['quill_bright'], { today: '2026-10-04', trials }).quill_bright, undefined);
    const golden = [90, 95, 80, 91, 92, 99].map((pct, i) => ({ date: `2026-09-0${i + 1}`, type: 'test', pct }));
    assert.equal(evaluateSeals(['quill_golden'], { today: '2026-10-04', trials: golden }).quill_golden.date, '2026-09-06');
});

test('hearth seals: welcome home and a full month', () => {
    const lessons = ['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-15', '2026-10-01', '2026-10-03'];
    const back = evaluateSeals(['hearth_return'], { today: '2026-10-04', lessons, absences: ['2026-09-03'], awards: [award('2026-09-08', 'focus')] });
    assert.equal(back.hearth_return.date, '2026-09-08');
    const noStar = evaluateSeals(['hearth_return'], { today: '2026-10-04', lessons, absences: ['2026-09-03'], awards: [award('2026-09-10', 'focus')] });
    assert.equal(noStar.hearth_return, undefined);
    assert.equal(evaluateSeals(['hearth_full_moon'], { today: '2026-10-04', lessons }).hearth_full_moon.date, '2026-09-15');
    // The current month never counts, nor a month joined part-way.
    assert.equal(evaluateSeals(['hearth_full_moon'], { today: '2026-09-20', lessons }).hearth_full_moon, undefined);
    assert.equal(evaluateSeals(['hearth_full_moon'], { today: '2026-10-04', lessons, joinedMonth: '2026-09' }).hearth_full_moon, undefined);
});

test('attendance seals count only lessons the Quest kept', () => {
    // The year opened on 18 September; the class's first record is on 1 October.
    const sept = ['2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30'];
    const oct = ['2026-10-01', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30'];
    const lessons = [...sept, ...oct];
    const base = { today: '2026-11-02', lessons, trackedFrom: '2026-10-01', openingDay: '2026-09-18' };
    // September had no records at all: not a whole month, and no part of a streak.
    assert.equal(evaluateSeals(['hearth_full_moon'], { ...base, today: '2026-10-04' }).hearth_full_moon, undefined);
    assert.equal(evaluateSeals(['steadfast'], { ...base, today: '2026-10-09' }).steadfast, undefined);
    assert.equal(evaluateSeals(['steadfast'], base).steadfast.date, '2026-10-23');
    assert.equal(evaluateSeals(['hearth_full_moon'], base).hearth_full_moon.date, '2026-10-30');
    // Even with September records, a year opened after the first week leaves September partial.
    assert.equal(evaluateSeals(['hearth_full_moon'], { ...base, today: '2026-10-04', trackedFrom: '2026-09-18' }).hearth_full_moon, undefined);
    // An absence before the first record does not make a "welcome home".
    const back = evaluateSeals(['hearth_return'], { ...base, absences: ['2026-09-21'], awards: [award('2026-09-23', 'focus')] });
    assert.equal(back.hearth_return, undefined);
});

test('candle star lands on the first lesson on or after the special day', () => {
    const lessons = ['2026-03-10', '2026-03-12', '2026-03-17'];
    const facts = { today: '2026-04-01', lessons, occasions: ['03-11'] };
    assert.equal(evaluateSeals(['wild_candle'], { ...facts, awards: [award('2026-03-12', 'focus')] }).wild_candle.date, '2026-03-12');
    assert.equal(evaluateSeals(['wild_candle'], { ...facts, awards: [award('2026-03-17', 'focus')] }).wild_candle, undefined);
});

test('boons, champions, oaths, chains and status seals', () => {
    const lessons = ['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-15', '2026-09-17'];
    const out = evaluateSeals(
        ['open_hand', 'wild_generous', 'wild_kindred', 'quiz_champion', 'oathkeeper', 'wild_chain', 'path_sage', 'wild_story_hero', 'wild_familiar', 'wild_collector', 'wild_early_light', 'wild_training'],
        {
            today: '2026-10-04', lessons,
            awards: [...lessons.slice(1).map((d) => award(d, 'focus')), award('2026-09-20', 'torn_map', 0.5)],
            boonsGiven: ['2026-09-20', '2026-09-03', '2026-09-10'], boonsReceived: ['2026-09-17'],
            championDates: ['2026-09-25'], oathKeptDates: ['2026-09-30'], firstStarDates: ['2026-09-10'],
            heroClass: 'Sage', heroLevel: 1, heroOfDayWins: 2, familiarAlive: true, inventoryCount: 3,
        },
    );
    assert.equal(out.open_hand.date, '2026-09-03');
    assert.equal(out.wild_generous.date, '2026-09-20');
    assert.equal(out.wild_kindred.date, '2026-09-17');
    assert.equal(out.quiz_champion.date, '2026-09-25');
    assert.equal(out.oathkeeper.date, '2026-09-30');
    assert.equal(out.wild_chain.date, '2026-09-17');
    assert.equal(out.path_sage.date, '2026-10-04');
    assert.ok(out.wild_story_hero && out.wild_familiar && out.wild_collector && out.wild_early_light);
    assert.equal(out.wild_training.date, '2026-09-20');
    // A path seal belongs to its own path only.
    assert.equal(evaluateSeals(['path_guardian'], { today: '2026-10-04', heroClass: 'Sage', heroLevel: 3 }).path_guardian, undefined);
});

test('presses: only new ones, late when caught up from the past', () => {
    const proven = { virtue_focus: { date: '2026-09-01', note: 'First Focus star' }, steadfast: { date: '2026-10-04', note: 'x' } };
    const presses = newSealPresses(['virtue_focus', 'steadfast'], proven, {}, { today: '2026-10-04', found: 5, catchingUp: true });
    assert.equal(presses.virtue_focus.late, true);
    assert.equal(presses.steadfast.late, undefined);
    assert.deepEqual(Object.keys(newSealPresses(['virtue_focus'], proven, { virtue_focus: { date: 'x' } })), []);
    assert.equal(newSealPresses(['virtue_focus'], proven, {}, { today: '2026-10-04' }).virtue_focus.late, undefined);
});

test('book view, notices and the diary', () => {
    const student = { id: 's1', name: 'Maria Papadopoulou', heroClass: 'Guardian', guildId: 'owl_wisdom' };
    const heroSeals = {
        book: buildSealBook({ studentId: 's1', heroClass: 'Guardian', guildId: 'owl_wisdom' }),
        earned: {
            virtue_respect: { date: '2026-09-02', found: 10, note: 'First Respect star' },
            personal_best: { date: '2026-10-04', found: 30, note: 'Test personal best' },
            path_guardian: { date: '2026-10-04', found: 20, note: 'Hero Path level 1' },
            four_winds: { date: '2026-09-28', found: 10, late: true },
        },
    };
    const view = buildSealBookView({ student, heroSeals });
    assert.equal(view.total, 16);
    assert.equal(view.earnedCount, 4);
    assert.equal(view.latest.id, 'personal_best');
    assert.equal(view.personal.length, 6);
    assert.match(view.personal.find((s) => s.id === 'path_guardian').reason, /Maria walks the Guardian path/);

    const notices = collectNewSeals([{ student, heroSeals }, { student: { id: 's2', name: 'Nikos' }, heroSeals: { earned: {} } }], 15);
    assert.equal(notices.length, 1);
    assert.deepEqual(notices[0].seals.map((s) => s.id), ['personal_best', 'path_guardian']);

    const diary = sealsPressedOn([{ name: 'Maria', heroSeals }], '2026-10-04');
    assert.deepEqual(diary.map((d) => d.seal), ['Unbroken Shield']);
    assert.equal(sealsPressedOn([{ name: 'Maria', heroSeals }], '2026-09-28').length, 0);
});

test('reasons never mention a level or a mark', () => {
    ['quill_rising', 'quill_bright', 'quill_golden'].forEach((id) => {
        assert.doesNotMatch(sealReason('quill', id, { name: 'Ana' }), /\d|low|high|weak|strong/i);
    });
});

test('art: stable outline and escaped markup', () => {
    assert.equal(waxOutlinePath('steadfast'), waxOutlinePath('steadfast'));
    assert.notEqual(waxOutlinePath('steadfast'), waxOutlinePath('open_hand'));
    const html = sealArtHtml('quiz_champion', { size: 64 });
    assert.match(html, /is-pressed/);
    assert.match(html, /is-rare/);
    assert.match(html, /fa-trophy/);
    assert.match(sealArtHtml('steadfast', { earned: false }), /is-unpressed/);
    assert.equal(sealArtHtml('nope'), '');
});
