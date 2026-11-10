import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    competitionRanks,
    esc,
    formatPct,
    groupTrialSessions,
    ringGaugeSvg,
    sparklineSvg,
    tierBarHtml,
    tierCounts,
    tierForPercent,
    trendFor
} from '../features/scholarScrollCore.mjs';

test('tiers split at 80 and 50', () => {
    assert.equal(tierForPercent(80), 'high');
    assert.equal(tierForPercent(79.9), 'mid');
    assert.equal(tierForPercent(50), 'mid');
    assert.equal(tierForPercent(12), 'low');
    assert.equal(tierForPercent(null), 'none');
    assert.deepEqual(tierCounts([90, 60, 10, 20, null]), { high: 1, mid: 1, low: 2 });
});

test('percent labels drop a trailing .0', () => {
    assert.equal(formatPct(82), '82%');
    assert.equal(formatPct(82.44), '82.4%');
    assert.equal(formatPct(null), '--');
});

test('trend compares the latest result with the earlier average', () => {
    assert.equal(trendFor([70]), null);
    assert.equal(trendFor([50, 60, 90]).dir, 'up');
    assert.equal(trendFor([90, 80, 60]).dir, 'down');
    assert.equal(trendFor([70, 72, 71]).dir, 'steady');
});

test('ties share a rank', () => {
    assert.deepEqual(competitionRanks([90, 80, 80, 70]), [1, 2, 2, 4]);
});

test('sittings group by type, date and title', () => {
    const sessions = groupTrialSessions([
        { type: 'test', date: '01-09-2026', title: 'Unit 1' },
        { type: 'test', date: '01-09-2026', title: 'unit 1 ' },
        { type: 'dictation', date: '01-09-2026', title: null },
        { type: 'test', date: '02-09-2026', title: 'Unit 1' }
    ], () => 0);
    assert.equal(sessions.length, 3);
    assert.equal(sessions[0].scores.length, 2);
});

test('make-up sittings join the first sitting of the same paper', () => {
    const t = (d) => Date.parse(d);
    const timeOf = (s) => t(s.iso);
    const sessions = groupTrialSessions([
        { type: 'test', date: '20-10-2026', iso: '2026-10-20', title: 'Unit 7 Test!', studentId: 'a' },
        { type: 'test', date: '20-10-2026', iso: '2026-10-20', title: 'Unit 7 Test!', studentId: 'b' },
        { type: 'test', date: '20-10-2026', iso: '2026-10-20', title: 'Unit 7 Test!', studentId: 'c' },
        { type: 'test', date: '03-11-2026', iso: '2026-11-03', title: 'unit 7  test!', studentId: 'd' },
        { type: 'test', date: '05-11-2026', iso: '2026-11-05', title: 'Unit 7 Test!', studentId: 'e' },
        // The same class sitting a paper with a reused title is a new test.
        { type: 'test', date: '10-11-2026', iso: '2026-11-10', title: 'Unit 7 Test!', studentId: 'a' },
        { type: 'test', date: '10-11-2026', iso: '2026-11-10', title: 'Unit 7 Test!', studentId: 'f' },
        // Untitled dictations on different days stay apart.
        { type: 'dictation', date: '01-10-2026', iso: '2026-10-01', title: '', studentId: 'a' },
        { type: 'dictation', date: '02-10-2026', iso: '2026-10-02', title: '', studentId: 'b' }
    ], timeOf);
    const tests = sessions.filter((s) => s.type === 'test');
    assert.equal(tests.length, 2);
    assert.equal(tests[0].date, '20-10-2026');
    assert.equal(tests[0].scores.length, 5);
    assert.equal(tests[0].makeups, 2);
    assert.equal(tests[1].scores.length, 2);
    assert.equal(sessions.filter((s) => s.type === 'dictation').length, 2);

    // Too long after the first sitting: a different paper.
    const late = groupTrialSessions([
        { type: 'test', date: 'x', iso: '2026-01-10', title: 'Mid-year', studentId: 'a' },
        { type: 'test', date: 'y', iso: '2026-06-10', title: 'Mid-year', studentId: 'b' }
    ], timeOf);
    assert.equal(late.length, 2);
});

test('markup helpers escape and draw', () => {
    assert.equal(esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    assert.equal(sparklineSvg([]), '');
    assert.match(sparklineSvg([40, 90]), /data-tier="high"/);
    assert.match(ringGaugeSvg(66), /data-tier="mid"/);
    assert.equal(tierBarHtml({ high: 0, mid: 0, low: 0 }), '');
    assert.match(tierBarHtml({ high: 2, mid: 1, low: 0 }), /flex-grow:2/);
});

test('Scholar\'s Scroll keeps its hooks for listeners and the title header', () => {
    const tab = readFileSync(new URL('../templates/app/tabs/scroll.js', import.meta.url), 'utf8');
    assert.match(tab, /tab-sign tab-sign--scroll ss-hero/);
    ['scroll-dashboard-queues', 'scroll-dashboard-inner', 'scroll-performance-chart']
        .forEach((id) => assert.match(tab, new RegExp(`id="${id}"`)));
    const modal = readFileSync(new URL('../templates/modals/attendance.js', import.meta.url), 'utf8');
    ['trial-history-modal', 'trial-history-close-btn', 'trial-history-view-toggle', 'trial-history-content', 'trial-history-search']
        .forEach((id) => assert.match(modal, new RegExp(`id="${id}"`)));
    const js = readFileSync(new URL('../features/scholarScroll.js', import.meta.url), 'utf8');
    assert.match(js, /chart-label-button/);
    assert.match(js, /actions\.handleDeleteTrial\(trialId/);
});
