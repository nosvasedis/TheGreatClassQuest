const test = require('node:test');
const assert = require('node:assert/strict');

const day = (iso) => new Date(`${iso}T12:00:00`).getTime();
let n = 0;
const entry = (studentId, type, date, pct, title = '') => ({
    id: `e${n++}`, studentId, type, title, date, time: day(date), pct, display: `${pct}%`
});

function classFixture() {
    n = 0;
    const entries = [];
    // Three papers: Ada climbs, Ben steady, Cy low; Ada misses Unit 3.
    [['2026-10-01', 'Unit 1', [60, 70, 40]], ['2026-10-15', 'Unit 2', [72, 70, 45]], ['2026-10-29', 'Unit 3', [null, 72, 42]], ['2026-11-12', 'Unit 4', [92, 71, 44]]]
        .forEach(([date, title, pcts]) => ['ada', 'ben', 'cy'].forEach((id, i) => {
            if (pcts[i] !== null) entries.push(entry(id, 'test', date, pcts[i], title));
        }));
    return entries;
}

test('buildFolio sets each trial against its paper and ranks the scholar', async () => {
    const { buildFolio } = await import('../features/scholarFolioCore.mjs');
    const folio = buildFolio({ studentId: 'ada', firstName: 'Ada', classStudentIds: ['ada', 'ben', 'cy'], entries: classFixture(), usage: { tests: true, dictations: false, any: true }, joinedAt: day('2026-09-01') });

    assert.equal(folio.trials.length, 3);
    const unit4 = folio.trials.find((t) => t.title === 'Unit 4');
    assert.equal(unit4.rank, 1);
    assert.equal(unit4.of, 3);
    assert.ok(Math.abs(unit4.classAvg - (92 + 71 + 44) / 3) < 0.01);
    assert.equal(unit4.isTop, true);
    assert.equal(unit4.isBest, true, 'beats two earlier tests');
    assert.equal(folio.trials[1].isBest, false, 'one earlier result is too few for a personal best');
    assert.equal(folio.rank, 1);
    assert.equal(folio.rankOf, 3);
    assert.deepEqual(folio.missed.map((m) => m.title), ['Unit 3']);
});

test('buildFolio respects the period and the join date', async () => {
    const { buildFolio } = await import('../features/scholarFolioCore.mjs');
    const entries = classFixture();
    const late = buildFolio({ studentId: 'ada', classStudentIds: ['ada', 'ben', 'cy'], entries, since: new Date('2026-11-01T00:00:00') });
    assert.equal(late.trials.length, 1);
    assert.equal(late.missed.length, 0);

    const newcomer = buildFolio({ studentId: 'zed', classStudentIds: ['ada', 'ben', 'cy', 'zed'], entries });
    assert.equal(newcomer.trials.length, 0);
    assert.equal(newcomer.missed.length, 0, 'no join date and no results: not blamed for earlier papers');
    assert.equal(newcomer.avg.overall, null);
});

test('a shared first place among many is not "top of the class"', async () => {
    const { buildFolio } = await import('../features/scholarFolioCore.mjs');
    n = 0;
    const entries = ['a', 'b', 'c', 'd'].map((id) => entry(id, 'dictation', '2026-10-01', 100));
    entries.push(entry('e', 'dictation', '2026-10-01', 50));
    const folio = buildFolio({ studentId: 'a', classStudentIds: ['a', 'b', 'c', 'd', 'e'], entries });
    assert.equal(folio.trials[0].rank, 1);
    assert.equal(folio.trials[0].isTop, false);
});

test('overallAverage weights tests 60 / dictations 40 only when the class uses both', async () => {
    const { overallAverage } = await import('../features/scholarFolioCore.mjs');
    assert.equal(overallAverage([80], [50], { tests: true, dictations: true }), 68);
    assert.equal(overallAverage([80], [50], { tests: true, dictations: false }), 80);
    assert.equal(overallAverage([], [50], { tests: true, dictations: true }), 50);
});

test('insights name rising momentum, the gap to the class and missed papers', async () => {
    const { buildFolio } = await import('../features/scholarFolioCore.mjs');
    const entries = classFixture();
    entries.push(entry('ada', 'test', '2026-11-26', 95, 'Unit 5'), entry('ben', 'test', '2026-11-26', 70, 'Unit 5'), entry('cy', 'test', '2026-11-26', 40, 'Unit 5'));
    const folio = buildFolio({ studentId: 'ada', firstName: 'Ada', classStudentIds: ['ada', 'ben', 'cy'], entries, absenceDates: ['2026-11-20', '2026-11-27'], joinedAt: day('2026-09-01') });
    const text = folio.insights.map((i) => `${i.tone}:${i.text}`).join('\n');
    assert.match(text, /good:Ada's last three trials average/);
    assert.match(text, /good:Working \d+ points above the class average/);
    assert.match(text, /watch:No mark yet for Unit 3/);
    assert.match(text, /watch:Absent on 2 lesson days/);
    assert.equal(folio.insights[0].tone, 'good', 'encouraging notes come first');
});

test('journeyChartSvg places one point per trial inside the plot', async () => {
    const { buildFolio, journeyChartSvg } = await import('../features/scholarFolioCore.mjs');
    const folio = buildFolio({ studentId: 'ada', classStudentIds: ['ada', 'ben', 'cy'], entries: classFixture() });
    const { svg, points } = journeyChartSvg(folio.trials, { width: 600, height: 220 });
    assert.equal(points.length, 3);
    points.forEach((p) => {
        assert.ok(p.x >= 0 && p.x <= 600);
        assert.ok(p.y >= 0 && p.y <= 220);
    });
    assert.match(svg, /sf-chart__line/);
    assert.match(svg, /sf-chart__class/);
    assert.equal((svg.match(/class="sf-chart__mark"/g) || []).length, 3);
});

test('folioCsv lists the summary and every trial; oracleMarkdown escapes HTML', async () => {
    const { buildFolio, folioCsv, oracleMarkdown } = await import('../features/scholarFolioCore.mjs');
    const folio = buildFolio({ studentId: 'ada', firstName: 'Ada', classStudentIds: ['ada', 'ben', 'cy'], entries: classFixture(), joinedAt: day('2026-09-01') });
    const csv = folioCsv({ name: 'Ada Lovelace', className: 'Fox, Clan', periodLabel: 'Last 3 months', folio });
    assert.match(csv, /Scholar,Ada Lovelace/);
    assert.match(csv, /Class,"Fox, Clan"/);
    assert.match(csv, /Unit 4/);
    assert.match(csv, /No mark yet for/);

    const html = oracleMarkdown('## Plan\n- **Read** daily\n- <script>x</script>\n\nDone.');
    assert.match(html, /<h4>Plan<\/h4>/);
    assert.match(html, /<li><strong>Read<\/strong> daily<\/li>/);
    assert.doesNotMatch(html, /<script>/);
});
