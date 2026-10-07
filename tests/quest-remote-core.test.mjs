import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    REMOTE_COMMAND_TYPES, validateCommand, createCommandLedger, isStaleCommand, isHostLive,
    makeSessionCode, makeSessionId, parseWandLink, buildWandLink, runeForCodeChar,
    classifyFlick, slingshotPower, SLINGSHOT_MIN_POWER, createShakeDetector,
    cleanPadLabel, buildPadActions, buildStageSummary, stageFingerprint,
    createShowdown, scoreShowdown, showdownStandings, showdownWinners, showdownBarLevels, showdownPanel,
    isGrowthLeague, formatTimerClock, timerFraction, CAST_TAB_IDS
} from '../features/questRemote/remoteCore.mjs';
import { showdownHtml, showdownFinaleHtml, growthFlower, bindingHtml, timerHtml } from '../features/questRemote/remoteStageView.mjs';
import { stageHtml, showHtml, starsHtml, awardSheetHtml } from '../features/questRemote/remoteWandView.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('command types match the Firestore rules allowlist', () => {
    const rules = read('firestore.rules');
    const block = rules.match(/function validRemoteCommand[\s\S]*?d\.type in \[([\s\S]*?)\]/);
    assert.ok(block, 'validRemoteCommand lists the types');
    const ruleTypes = [...block[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(ruleTypes, [...REMOTE_COMMAND_TYPES].sort());
});

test('validateCommand accepts good commands and refuses bad ones', () => {
    const ok = (type, payload) => validateCommand({ type, payload, clientSeq: 1 }).ok;
    assert.equal(ok('award', { studentId: 's1', reason: 'teamwork', stars: 2 }), true);
    assert.equal(ok('award', { studentId: 's1', reason: 'kindness', stars: 2 }), false);
    assert.equal(ok('award', { studentId: 's1', reason: 'focus', stars: 4 }), false);
    assert.equal(ok('key', { key: 'Escape' }), true);
    assert.equal(ok('key', { key: 'Delete' }), false, 'only the app shortcuts can be pressed');
    assert.equal(ok('cast', { tab: 'guilds-tab' }), true);
    assert.equal(ok('cast', { tab: 'options-tab' }), false, 'settings are never cast');
    assert.equal(ok('wheel', { action: 'spin', power: 0.5 }), true);
    assert.equal(ok('wheel', { action: 'spin', power: 3 }), false);
    assert.equal(ok('timer', { action: 'start', seconds: 30 }), true);
    assert.equal(ok('timer', { action: 'start', seconds: 1 }), false);
    assert.equal(ok('quiz', { action: 'answer', index: 3 }), true);
    assert.equal(ok('quiz', { action: 'answer', index: 4 }), false);
    assert.equal(ok('picker', { action: 'think10' }), true);
    assert.equal(ok('showdown', { action: 'point', team: 1 }), true);
    assert.equal(ok('showdown', { action: 'point', team: 9 }), false);
    assert.equal(ok('blackout', { on: true }), true);
    assert.equal(ok('nuke', {}), false);
    assert.equal(validateCommand({ type: 'bind', payload: {}, clientSeq: -1 }).ok, false);
    assert.equal(validateCommand({ type: 'bind', payload: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i])), clientSeq: 1 }).ok, false);
});

test('ledger runs each command once; stale taps never fire', () => {
    const ledger = createCommandLedger(3);
    assert.equal(ledger.accept('w', 1), true);
    assert.equal(ledger.accept('w', 1), false);
    assert.equal(ledger.accept('other', 1), true);
    ['a', 'b', 'c', 'd'].forEach((w) => ledger.accept(w, 9));
    assert.equal(ledger.size(), 3);
    assert.equal(isStaleCommand(100_000, 99_000), false);
    assert.equal(isStaleCommand(200_000, 100_000), true, 'reached the server long after the tap');
    assert.equal(isStaleCommand(NaN, 1), false);
    assert.equal(isHostLive(1000, 30_000), true);
    assert.equal(isHostLive(1000, 100_000), false);
    assert.equal(isHostLive(NaN, 1), false);
});

test('codes, ids and links', () => {
    let i = 0;
    const seq = () => ((i += 1) * 0.137) % 1;
    const code = makeSessionCode(seq);
    assert.match(code, /^[ACEFHJKMNPRTWXY3479]{4}$/);
    assert.notEqual(runeForCodeChar(code[0]), '✦');
    const id = makeSessionId(seq, 1_700_000_000_000);
    assert.match(id, /^[a-z0-9]{6,40}$/);
    const link = buildWandLink('https://x.dev/', '/', id, 'school-b');
    assert.equal(link, `https://x.dev/#school=school-b&wand=${id}`);
    assert.equal(parseWandLink(new URL(link).hash), id);
    assert.equal(parseWandLink('', `?wand=${id}`), id);
    assert.equal(parseWandLink('#wand=../../evil'), '');
    assert.equal(buildWandLink('https://x.dev', '/', id), `https://x.dev/#wand=${id}`);
});

test('Star Flick: a real flick up, its speed decides the stars', () => {
    assert.equal(classifyFlick({ dy: -30, dtMs: 50 }), 0, 'too short');
    assert.equal(classifyFlick({ dy: 40, dtMs: 50 }), 0, 'downwards');
    assert.equal(classifyFlick({ dy: -120, dx: 200, dtMs: 80 }), 0, 'sideways');
    assert.equal(classifyFlick({ dy: -120, dtMs: 200 }), 1);
    assert.equal(classifyFlick({ dy: -160, dtMs: 100 }), 2);
    assert.equal(classifyFlick({ dy: -240, dtMs: 80 }), 3);
    assert.equal(classifyFlick({ dy: -240, dtMs: 80 }, { fixedStars: 1 }), 1, 'a fixed size wins');
});

test('Wheel Slingshot and Shake to Summon', () => {
    assert.equal(slingshotPower(0), 0);
    assert.equal(slingshotPower(260), 1);
    assert.ok(slingshotPower(130) > 0.5, 'eased: a half pull is more than half power');
    assert.ok(slingshotPower(20) < SLINGSHOT_MIN_POWER, 'a nudge does not spin');
    const shake = createShakeDetector({ threshold: 10, needed: 3, windowMs: 900, cooldownMs: 1000 });
    assert.equal(shake.feed(20, 0), false);
    assert.equal(shake.feed(20, 40), false, 'one jolt, many samples');
    assert.equal(shake.feed(20, 200), false);
    assert.equal(shake.feed(5, 300), false, 'below threshold');
    assert.equal(shake.feed(20, 400), true);
    assert.equal(shake.feed(20, 600), false, 'cooling down');
});

test('Stage Pad: explicit buttons first, no empty or duplicate labels, capped', () => {
    assert.equal(cleanPadLabel('  Start   the\n show  '), 'Start the show');
    assert.equal(cleanPadLabel('x'.repeat(50)).length, 34);
    const pad = buildPadActions([
        { id: 'a', label: 'Close' },
        { id: 'b', label: 'Spin!', explicit: true, order: 2 },
        { id: 'c', label: '' },
        { id: 'd', label: 'close' },
        { id: 'e', label: 'Begin', explicit: true, order: 1, icon: 'fa-play' },
        { id: 'f', label: 'Bad icon', icon: 'x" onerror="1' }
    ]);
    assert.deepEqual(pad.map((p) => p.id), ['e', 'b', 'a', 'f']);
    assert.equal(pad[0].icon, 'fa-play');
    assert.equal(pad[3].icon, '');
    const many = buildPadActions(Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, label: `Button ${i}` })));
    assert.equal(many.length, 30);
});

test('stage summary carries labels only, never private fields', () => {
    const stage = buildStageSummary({
        surface: 'overlay', tab: 'award-stars-tab', title: 'Award',
        padActions: [{ id: 'p1', label: 'Go' }],
        panel: { kind: 'quiz', question: 'Q?', grades: { s1: 80 }, options: [{ text: 'A', nested: { x: 1 } }] },
        lastResult: { seq: 3, ok: true, message: 'Done', extra: 'no' }
    });
    assert.equal(stage.tab, 'award-stars-tab');
    assert.equal(stage.panel.grades, undefined, 'objects never pass through a panel');
    assert.equal(stage.panel.options[0].nested, undefined);
    assert.equal(stage.panel.correctIndex, undefined);
    assert.deepEqual(Object.keys(stage.lastResult).sort(), ['message', 'ok', 'seq']);
    assert.equal(buildStageSummary({ tab: 'options-tab' }).tab, '');
    assert.equal(buildStageSummary({ panel: { kind: 'evil' } }).panel, null);
    assert.equal(stageFingerprint({ a: 1, b: [2] }), stageFingerprint({ b: [2], a: 1 }));
});

test('the quiz answer only appears on the Wand, never in the stage markup', () => {
    const stage = buildStageSummary({ surface: 'overlay', panel: { kind: 'quiz', screen: 'turn', question: 'Which?', options: [{ text: 'cat' }, { text: 'dog' }], student: 'Ana' } });
    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /secret = \{ quizCorrect:/, 'the answer travels in the separate secret field');
    assert.doesNotMatch(read('features/questRemote/remoteStageView.mjs'), /quizCorrect/, 'the projector never draws it');
    const withSecret = stageHtml(stage, { secret: { quizCorrect: 1 } });
    assert.match(withSecret, /qw-ans--1 is-correct/);
    assert.doesNotMatch(stageHtml(stage, {}), /is-correct/);
});

test('Showdown: points, streaks, ties and the Growth Festival', () => {
    let sd = createShowdown([{ name: 'Foxes', color: '#f97316', emoji: '🦊', members: ['a'] }, { name: 'Bees' }, { name: 'Owls' }]);
    assert.equal(sd.teams[0].color, '#f97316');
    assert.equal(sd.teams[1].color.startsWith('#'), true);
    assert.deepEqual(showdownWinners(sd), [], 'nobody wins before a point');
    sd = scoreShowdown(sd, 0);
    sd = scoreShowdown(sd, 0);
    assert.equal(sd.teams[0].streak, 2);
    sd = scoreShowdown(sd, 1);
    assert.equal(sd.teams[0].streak, 0, 'another team scoring breaks the streak');
    sd = scoreShowdown(sd, 1);
    assert.deepEqual(showdownWinners(sd), [0, 1], 'a tie shares first place');
    assert.deepEqual(showdownStandings(sd).map((t) => t.place), [1, 1, 3]);
    sd = scoreShowdown(sd, 2, -1);
    assert.equal(sd.teams[2].score, 0, 'never below zero');
    assert.deepEqual(showdownBarLevels(sd), [1, 1, 0.06]);

    assert.equal(isGrowthLeague('Nursery'), true);
    assert.equal(isGrowthLeague('Pre-Junior'), true);
    assert.equal(isGrowthLeague('Junior A'), false);
    let garden = createShowdown([{ name: 'Suns' }, { name: 'Moons' }], { growth: true });
    garden = scoreShowdown(garden, 0);
    garden = scoreShowdown(garden, 0);
    garden = scoreShowdown(garden, 0);
    const panel = showdownPanel(garden);
    assert.equal(panel.teams[0].score, undefined, 'the Wand shows no scores either');
    const screen = showdownHtml(garden);
    assert.doesNotMatch(screen, /data-qr-score|data-qr-round|qr-lane__streak/, 'no numbers on the projector');
    assert.match(screen, new RegExp(growthFlower(3)));
    assert.doesNotMatch(showdownFinaleHtml(garden), /qr-podium/, 'no podium: the whole garden blooms');
    assert.doesNotMatch(showHtml({ panel }), /qw-team__score|qw-team__minus/);
});

test('views escape what they show', () => {
    const evil = '<img src=x onerror=alert(1)>';
    assert.doesNotMatch(starsHtml([{ id: 'a', first: evil, stars: 0 }], { className: evil }), /<img src=x/);
    assert.doesNotMatch(awardSheetHtml({ id: evil, first: evil, stars: 0 }), /<img src=x/);
    assert.doesNotMatch(stageHtml({ title: evil, pad: [{ id: 'p1', label: evil, icon: '' }] }), /<img src=x/);
    assert.doesNotMatch(showdownHtml(createShowdown([{ name: evil }, { name: 'B' }])), /<img src=x/);
    assert.doesNotMatch(bindingHtml({ code: '<script>' }), /<script>/);
});

test('timers', () => {
    assert.equal(formatTimerClock(65_000), '1:05');
    assert.equal(formatTimerClock(9_100), '0:10');
    assert.equal(formatTimerClock(-5), '0:00');
    assert.equal(timerFraction(5, 10), 0.5);
    assert.equal(timerFraction(1, 0), 0);
    assert.match(timerHtml({ label: 'Think', seconds: 30 }), /0:30/);
});

test('cast never offers Settings or the student roster', () => {
    assert.equal(CAST_TAB_IDS.includes('options-tab'), false);
    assert.equal(CAST_TAB_IDS.includes('manage-students-tab'), false);
});

test('the launch buttons match the places they live in', () => {
    const header = read('templates/app/header.js');
    const dragon = header.match(/<button id="quiet-dragon-btn"[^>]*class="([^"]+)"/);
    const remote = header.match(/<button id="quest-remote-btn"[^>]*class="([^"]+)"/);
    assert.ok(dragon && remote, 'both header buttons exist');
    assert.equal(remote[1], dragon[1], 'same class string as its neighbour');
    const wall = read('templates/app/screens/wallpaper.js');
    assert.match(wall, /data-wall-action="wand"/);
    const more = read('mobile/templates.js');
    assert.match(more, /id="m-quest-remote-item" class="nav-button m-more-item m-pressable nav-color-amber hidden"/);
});

test('the projector executes through the app\'s own controls', () => {
    const host = read('features/questRemote/remoteHost.js');
    // star awards click the hero's own cloud (reason, then star), like the mouse
    assert.match(host, /\.reason-btn\[data-reason=/);
    assert.match(host, /\.star-award-btn\[data-stars=/);
    assert.match(host, /starBtn\.click\(\)/);
    // the economy is never written by Quest Remote itself
    assert.doesNotMatch(host, /runTransaction|setStudentStarsForToday|student_scores/);
    assert.doesNotMatch(read('features/questRemote/remoteWand.js'), /runTransaction|setDoc|student_scores/);
    assert.doesNotMatch(read('features/questRemote/showdown.js'), /runTransaction|student_scores|handleBatchAwardBonus/);
    // the projector's command listener names the owner (rules are not filters)
    assert.ok(read('features/questRemote/remoteChannel.js').includes("query(commandsCol(sessionId), where('teacherId', '==', uid())"));
    // tenant-safe paths
    assert.doesNotMatch(read('features/questRemote/remoteChannel.js'), /artifacts\/great-class-quest/);
});

test('flag wiring: Pro and Elite only', () => {
    for (const [tier, on] of [['starter', false], ['pro', true], ['elite', true], ['pending', false], ['expired', false]]) {
        assert.equal(JSON.parse(read(`config/tiers/${tier}.json`)).questRemote, on, tier);
    }
    assert.match(read('utils/subscription.js'), /featureFlag === 'questRemote'/);
    assert.match(read('firestore.rules'), /plan\.get\('questRemote', true\) == true/);
});

test('cast list mirrors the dock and its plan gates', async () => {
    const nav = read('templates/app/nav.js');
    const dockTabs = [...nav.matchAll(/class="nav-button [^"]*" data-tab="([a-z-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(CAST_TAB_IDS, dockTabs, 'same screens, same order as the cloud dock');
    const { TAB_FEATURE_FLAGS } = await import('../config/tiers/features.js');
    const { CAST_TABS } = await import('../features/questRemote/remoteCore.mjs');
    for (const t of CAST_TABS) assert.equal(t.flag, TAB_FEATURE_FLAGS[t.tab], `${t.tab} gate`);
});

test('every Quest Remote module parses as an ES module', async () => {
    // `node --check file.js` skips ESM in a package without "type"; feed the source as a module instead.
    const { spawnSync } = await import('node:child_process');
    const { readdirSync } = await import('node:fs');
    const files = [
        ...readdirSync(new URL('../features/questRemote/', import.meta.url)).map((f) => `features/questRemote/${f}`),
        'ui/questRemoteButton.js'
    ].filter((f) => /\.m?js$/.test(f));
    for (const file of files) {
        const res = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: read(file), encoding: 'utf8' });
        assert.equal(res.status, 0, `${file} does not parse:\n${res.stderr}`);
    }
});
