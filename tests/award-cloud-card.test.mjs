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
    resolveAwardRollStatus
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
