const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../features/trialLogCore.mjs');

const DICTATION = {
    mode: 'qualitative',
    scale: [
        { label: 'Great!!!', normalizedPercent: 100 },
        { label: 'Great!', normalizedPercent: 50 },
        { label: 'Nice Try!', normalizedPercent: 25 }
    ]
};

test('date label names today and yesterday, and adds the year only when it differs', async () => {
    const m = await load();
    assert.match(m.trialDateLabel('2026-09-29', '2026-09-29'), /^Today · /);
    assert.match(m.trialDateLabel('2026-09-28', '2026-09-29'), /^Yesterday · /);
    assert.match(m.trialDateLabel('2025-12-01', '2026-09-29'), /2025$/);
    assert.equal(m.trialDateLabel('', '2026-09-29'), '--/--/----');
});

test('grade tones and score bands follow the old pill and numeric colours', async () => {
    const m = await load();
    assert.equal(m.gradeToneForPercent(100), 'emerald');
    assert.equal(m.gradeToneForPercent(75), 'teal');
    assert.equal(m.gradeToneForPercent(50), 'amber');
    assert.equal(m.gradeToneForPercent(25), 'rose');
    assert.equal(m.numericBandFor('18', 20), 'high');
    assert.equal(m.numericBandFor('3', 20), 'fail');
    assert.equal(m.numericBandFor('', 20), '');
});

test('a row keeps the save contract and marks the chosen stamp', async () => {
    const m = await load();
    const html = m.trialRowHtml({ student: { id: 's1', name: 'Alex' }, scheme: DICTATION, value: 'Great!' });
    assert.match(html, /class="tl-row bulk-log-item is-graded" data-student-id="s1"/);
    assert.match(html, /toggle-absent-btn" data-was-absent="false"/);
    assert.match(html, /class="bulk-grade-input" value="Great!"/);
    assert.match(html, /tl-ink--amber active"[\s\S]*?data-value="Great!" aria-pressed="true"/);
});

test('an absent row disables grading but remembers whether the register said absent', async () => {
    const m = await load();
    const html = m.trialRowHtml({ student: { id: 's2', name: 'Nikos' }, scheme: { mode: 'numeric', maxScore: 20 }, isAbsent: true, wasAbsent: false });
    assert.match(html, /bulk-log-item absent"/);
    assert.match(html, /is-absent" data-was-absent="false"/);
    assert.match(html, /max="20"[^>]*disabled/);
});

test('names are escaped', async () => {
    const m = await load();
    const html = m.trialRowHtml({ student: { id: 'x', name: '<img onerror=1>' }, scheme: DICTATION });
    assert.ok(!html.includes('<img onerror'));
});

test('tally counts marked, present and absent students', async () => {
    const m = await load();
    const tally = m.trialTally([{ absent: false, value: '5' }, { absent: true, value: '' }, { absent: false, value: '' }]);
    assert.deepEqual(tally, { graded: 1, absent: 1, present: 2, total: 3 });
    assert.equal(m.trialTallyText(tally), '1 of 2 marked · 1 absent');
});
