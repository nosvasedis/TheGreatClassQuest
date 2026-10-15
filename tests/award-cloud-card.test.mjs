import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AWARD_CLOUD_KEYS,
    formatAwardStars,
    buildAwardCloudCardHtml,
    buildAwardCloudSvg,
    buildAwardHonoursHtml,
    resolveAwardAttendanceMode,
    buildAwardBoonButtonHtml,
    buildAwardSkySummaryHtml,
    resolveAwardRollStatus,
    buildAwardTodayTipHtml,
    buildAwardMonthTipHtml,
    buildAwardTotalTipHtml
} from '../features/awardCloudCard.mjs';

const baseView = {
    id: 'stu-1', name: 'Maria K', firstName: 'Maria', gold: 55,
    today: 0, month: 21, total: 94, cloud: 'b', attendanceMode: 'absent-offer',
    boon: { eligible: true }, honours: {}
};

test('award cloud keeps every hook the listeners and live updates rely on', () => {
    const html = buildAwardCloudCardHtml(baseView);
    for (const hook of [
        'class="student-cloud-card', 'data-studentid="stu-1"', 'data-reason="teamwork"', 'data-reason="focus"',
        'data-stars="1"', 'data-stars="2"', 'data-stars="3"', 'star-selector-container',
        'id="post-award-undo-stu-1"', 'absence-controls', 'data-action="mark-absent"',
        'id="today-stars-stu-1"', 'id="monthly-stars-stu-1"', 'id="total-stars-stu-1"',
        'id="student-gold-display-stu-1"', 'enlargeable-avatar', 'data-receiver-id="stu-1"'
    ]) assert.ok(html.includes(hook), `missing ${hook}`);
});

test('a sealed cloud shows today\'s award in place of the star buttons', () => {
    const html = buildAwardCloudCardHtml({ ...baseView, locked: true, today: 2, todayReason: 'teamwork', attendanceMode: 'none' });
    assert.ok(html.includes('is-locked'));
    assert.ok(!html.includes('data-stars="1"'));
    assert.match(html, /aw-seal[\s\S]*\+2[\s\S]*for Teamwork/);
    assert.ok(!html.includes('post-award-undo-btn aw-undo hidden'));
});

test('cloud svg ids are unique per hero and every shape builds', () => {
    for (const key of AWARD_CLOUD_KEYS) {
        const a = buildAwardCloudSvg(key, 'a');
        const b = buildAwardCloudSvg(key, 'b');
        const idsA = [...a.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
        const idsB = [...b.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
        assert.ok(idsA.length > 0);
        assert.ok(idsA.every((id) => !idsB.includes(id)));
    }
});

test('names are escaped', () => {
    const html = buildAwardCloudCardHtml({ ...baseView, name: '<b>x</b>', firstName: '"x"' });
    assert.ok(!html.includes('<b>x</b>'));
});

test('prodigy badges use the Hall of Prodigies titles', () => {
    assert.match(buildAwardHonoursHtml({ prodigy: true, prodigyMonth: 'August' }), /Prodigy of the Month/);
    assert.match(buildAwardHonoursHtml({ prodigy: true, coProdigy: true }), /Co-Prodigy/);
    assert.match(buildAwardHonoursHtml({ heroOfDay: true }), /Hero of the Day/i);
});

test('fractional stars show at most one decimal', () => {
    assert.equal(formatAwardStars(2), '2');
    assert.equal(formatAwardStars(1.5), '1.5');
    assert.equal(formatAwardStars(0.1 + 0.2), '0.3');
    assert.equal(formatAwardStars(undefined), '0');
});

test('attendance mode follows absence and lesson day', () => {
    assert.equal(resolveAwardAttendanceMode({ isVisuallyAbsent: true, isMarkedAbsentToday: true, classHasLessonToday: true }), 'away-today');
    assert.equal(resolveAwardAttendanceMode({ isVisuallyAbsent: true, isMarkedAbsentToday: false, classHasLessonToday: true }), 'returning');
    assert.equal(resolveAwardAttendanceMode({ isVisuallyAbsent: true, isMarkedAbsentToday: false, classHasLessonToday: false }), 'away-no-lesson');
    assert.equal(resolveAwardAttendanceMode({ isVisuallyAbsent: false, classHasLessonToday: true, isCardLocked: false }), 'absent-offer');
    assert.equal(resolveAwardAttendanceMode({ isVisuallyAbsent: false, classHasLessonToday: true, isCardLocked: true }), 'none');
});

test('boon button marks resting state for the listener', () => {
    assert.match(buildAwardBoonButtonHtml('s', { eligible: true }), /aw-boon--ready/);
    assert.match(buildAwardBoonButtonHtml('s', { eligible: false, dailyLimitReached: true }), /aw-boon--resting[\s\S]*Daily boon limit/);
});

test('star roll counts only the heroes in the room', () => {
    const html = buildAwardSkySummaryHtml({
        starsToday: 2,
        heroes: [
            { id: 'a', name: 'Alex', status: 'shining', stars: 2 },
            { id: 'b', name: 'Bea', status: 'waiting' },
            { id: 'c', name: 'Chris', status: 'returning' },
            { id: 'd', name: 'Dora', status: 'away' }
        ]
    });
    assert.match(html, /<b>1<\/b> of 3 shining/);
    assert.match(html, /2 waiting/);
    assert.match(html, /1 away/);
    assert.match(html, /is-away[^>]*data-tip-name="Dora" data-tip-note="Away today"/);
    assert.match(html, /data-roll-student="b"/);
    assert.match(html, /data-roll-student="c"/);
    assert.doesNotMatch(html, /data-roll-student="d"/);
});

test('star roll: everyone in the room shining, or everyone away', () => {
    const all = buildAwardSkySummaryHtml({ heroes: [{ id: 'a', name: 'A', status: 'shining', stars: 1 }, { id: 'b', name: 'B', status: 'away' }] });
    assert.match(all, /Everyone shines!/);
    assert.match(all, /aw-roll is-complete/);
    const away = buildAwardSkySummaryHtml({ heroes: [{ id: 'b', name: 'B', status: 'away' }] });
    assert.match(away, /Everyone is away today/);
});

test('star roll status: absence beats stars, returning heroes still wait', () => {
    assert.equal(resolveAwardRollStatus({ starsToday: 2, isMarkedAbsentToday: true }), 'away');
    assert.equal(resolveAwardRollStatus({ starsToday: 1 }), 'shining');
    assert.equal(resolveAwardRollStatus({ starsToday: 0, attendanceMode: 'returning' }), 'returning');
    assert.equal(resolveAwardRollStatus({ starsToday: 0, attendanceMode: 'absent-offer' }), 'waiting');
});

test('Today, Month and Total chips open their own star cards, no browser titles', () => {
    const html = buildAwardCloudCardHtml({ ...baseView, today: 2, locked: true, todayReason: 'focus' });
    for (const kind of ['today', 'month', 'total']) assert.match(html, new RegExp(`aw-tally__item--${kind}" data-tip-build="star-${kind}" data-ledger-student="stu-1"`));
    assert.doesNotMatch(html, /title="Stars (today|this month|all year)"/);
});

test('Today card: today\'s stars and last lesson\'s amount', () => {
    const html = buildAwardTodayTipHtml({
        name: 'Alex', status: 'shining', today: { stars: 2, reasons: [{ reason: 'teamwork', stars: 2 }] },
        lastLesson: { date: 'Tue 13 Oct', stars: 3.5, reasons: [{ reason: 'focus', stars: 3 }, { reason: 'peer_boon', stars: 0.5 }] }
    });
    assert.match(html, /<b>2<\/b>[\s\S]*Teamwork<b>\+2<\/b>/);
    assert.match(html, /Last lesson · Tue 13 Oct[\s\S]*<b>3\.5<\/b>[\s\S]*Focus<b>\+3<\/b>/);
    assert.match(buildAwardTodayTipHtml({ name: 'B', status: 'waiting', lastLesson: { date: 'Mon', away: true } }), /No star yet today[\s\S]*Away that day/);
    assert.match(buildAwardTodayTipHtml({ name: 'B', status: 'away' }), /Away today/);
});

test('Month card: virtues, other stars, game bonuses apart; Total card: rank and gold', () => {
    const month = buildAwardMonthTipHtml({
        name: 'Alex', month: 11, rank: { place: 2, of: 12 }, virtues: { teamwork: 5, focus: 2 },
        other: [{ reason: 'peer_boon', stars: 0.5 }], games: [{ reason: 'showdown', stars: 3 }]
    });
    assert.match(month, /#2 of 12 in class/);
    assert.match(month, /Game bonuses[\s\S]*Showdown Arena <b>\+3<\/b>/);
    assert.match(month, /Strongest virtue: <b>Teamwork<\/b>/);
    const total = buildAwardTotalTipHtml({ name: 'Alex', total: 86, month: 11, rank: { place: 1, of: 12 }, gold: 42, heroTitle: 'Sentinel' });
    assert.match(total, /<b>86<\/b>[\s\S]*#1 of 12/);
    assert.match(total, /42<\/b> Gold/);
    assert.match(total, /Sentinel/);
});
