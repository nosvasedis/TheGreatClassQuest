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
    assert.equal(many.length, 40);
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

test('the Wand layout pins each part to its row (hiding the strip must not stretch the mode bar)', () => {
    const css = read('styles/quest_remote_wand.css');
    assert.match(css, /grid-template-rows: auto auto 1fr auto/);
    for (const [part, row] of [['qw-top', 1], ['qw-now', 2], ['qw-main', 3], ['qw-modes', 4]]) {
        assert.match(css, new RegExp(`\.qw > \.${part} \{ grid-row: ${row};`), part);
    }
});

test('Screen buttons: reading order, real looks (validated), and where they sit', async () => {
    const pad = buildPadActions([
        { id: 'below', label: 'Save', x: 0.5, y: 1.4, inView: false, bg: '#22c55e' },
        { id: 'right', label: 'Next', x: 0.8, y: 0.31, inView: true, bg: '#F59E0B', bg2: '#b45309', fg: '#422006', round: 'pill' },
        { id: 'left', label: 'Back', x: 0.2, y: 0.3, inView: true, bg: 'red', fg: 'url(x)', round: 'blob' },
        { id: 'top', label: 'Close', x: 0.9, y: 0.05, inView: true, iconOnly: true }
    ]);
    assert.deepEqual(pad.map((p) => p.id), ['top', 'left', 'right', 'below'], 'in sight first, then row by row, left to right');
    const next = pad.find((p) => p.id === 'right');
    assert.equal(next.bg, '#f59e0b');
    assert.equal(next.round, 'pill');
    const back = pad.find((p) => p.id === 'left');
    assert.equal(back.bg, undefined, 'only real #rrggbb colours travel');
    assert.equal(back.fg, undefined);
    assert.equal(back.round, undefined);
    assert.equal(pad.find((p) => p.id === 'below').y, 1.4);

    const { padButtonStyle, hexLuminance } = await import('../features/questRemote/remoteWandView.mjs');
    assert.match(padButtonStyle(next), /--pb-fill:linear-gradient\(180deg, #f59e0b, #b45309\)/);
    assert.match(padButtonStyle(next), /--pb-ink:#422006/, 'the screen\'s own ink when it reads');
    assert.match(padButtonStyle({ bg: '#ffffff', fg: '#fefefe' }), /--pb-ink:#1e1b4b/, 'white on white becomes navy');
    assert.match(padButtonStyle({ bg: '#111827' }), /--pb-ink:#ffffff/);
    assert.equal(padButtonStyle({ bg: '' }), '', 'no colour: the Wand look');
    assert.ok(hexLuminance('#ffffff') > 0.99 && hexLuminance('#000000') === 0);

    const html = stageHtml({ pad, scroll: { canUp: false, canDown: true, at: 0 } });
    assert.match(html, /data-dir="up" aria-label="Scroll up" disabled/, 'at the top the up arrow rests');
    assert.doesNotMatch(html, /data-dir="down" aria-label="Scroll down" disabled/);
    assert.match(html, /qw-padbtn__off/, 'a button out of sight shows which way it is');
    assert.match(html, /qw-padbtn__where/);
});

test('the projector scrolls the box that really scrolls (tabs share the <main> around them)', () => {
    const host = read('features/questRemote/remoteHost.js');
    const body = host.slice(host.indexOf('function scrollContainerOf('), host.indexOf('function scrollInfo('));
    assert.match(body, /for \(let n = el; n && n !== document\.body/, 'walks up past the tab to its scroller');
    assert.doesNotMatch(body, /!surfaceEl\.contains\(n\)/, 'never stops at the tab edge again');
    assert.match(read('templates/app/tabs/index.js'), /<main class="[^"]*overflow-y-auto/);
});

test('Screen mirrors every kind of control: tabs, switches, dropdowns, text boxes', () => {
    assert.equal(validateCommand({ type: 'pad', clientSeq: 1, payload: { id: 'p1', value: 'castle, lantern' } }).ok, true);
    assert.equal(validateCommand({ type: 'pad', clientSeq: 1, payload: { id: 'p1', value: 'x'.repeat(501) } }).ok, false);
    assert.equal(validateCommand({ type: 'pad', clientSeq: 1, payload: { id: 'p1', value: 5 } }).ok, false);
    const pad = buildPadActions([
        { id: 't1', label: 'Story Weavers', kind: 'tab', on: true, group: 'Training Grounds games', x: 0.2, y: 0.1, inView: true },
        { id: 't2', label: 'The Vanishing Hoard', kind: 'tab', on: false, group: 'Training Grounds games', x: 0.4, y: 0.1, inView: true },
        { id: 'c1', label: 'Use lesson words', kind: 'toggle', on: true, x: 0.2, y: 0.4, inView: true },
        { id: 'w1', label: 'Lesson words', kind: 'text', value: 'castle, lantern', placeholder: 'castle, lantern, brave…', multiline: true, inputType: 'evil', x: 0.2, y: 0.5, inView: true },
        { id: 's1', label: 'Rounds', kind: 'select', value: '3', options: [{ label: 'Three', value: '3' }, { label: '<b>Five</b>', value: '5' }], x: 0.2, y: 0.6, inView: true },
        { id: 'z1', label: 'Weird', kind: 'rocket', x: 0.2, y: 0.7, inView: true }
    ]);
    const by = Object.fromEntries(pad.map((p) => [p.id, p]));
    assert.equal(by.t1.kind, 'tab');
    assert.equal(by.t1.on, true);
    assert.equal(by.c1.kind, 'toggle');
    assert.equal(by.w1.inputType, 'text', 'unknown input types become plain text');
    assert.equal(by.s1.options.length, 2);
    assert.equal(by.z1.kind, undefined, 'unknown kinds are plain buttons');

    const html = stageHtml({ pad });
    assert.match(html, /class="qw-tabrow" role="tablist">[\s\S]*Story Weavers[\s\S]*The Vanishing Hoard/, 'the games sit in one tab row');
    assert.match(html, /aria-selected="true" class="qw-tabchip is-on"/);
    assert.match(html, /role="switch" aria-checked="true"/);
    assert.match(html, /<form class="qw-field qw-field--text" data-qw-text="w1">[\s\S]*<textarea[^>]*>castle, lantern<\/textarea>/);
    assert.match(html, /<select data-qw-select="s1"><option value="3" selected>Three<\/option>/);
    assert.doesNotMatch(html, /<b>Five<\/b>/, 'option labels are escaped');
});

test('the projector types into real fields the way a keyboard would', () => {
    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /function setFieldValue\(el, value\)/);
    assert.match(host, /new Event\('input', \{ bubbles: true \}\)/);
    assert.match(host, /new Event\('change', \{ bubbles: true \}\)/);
    assert.match(host, /input:not\(\[type="hidden"\]\):not\(\[type="password"\]\)/, 'passwords never travel to the phone');
});

test('charms: sound, look here and spotlight are checked before the projector runs them', async () => {
    const { CHARM_SOUNDS } = await import('../features/questRemote/remoteCore.mjs');
    const ok = (payload) => validateCommand({ type: 'charm', clientSeq: 1, payload }).ok;
    assert.equal(ok({ action: 'sound', sound: 'tada' }), true);
    assert.equal(ok({ action: 'sound', sound: 'siren' }), false, 'only the listed charms play');
    assert.equal(ok({ action: 'point', x: 0.5, y: 0.25 }), true);
    assert.equal(ok({ action: 'point', x: 1.5, y: 0.25 }), false, 'points stay on the screen');
    assert.equal(ok({ action: 'point', x: 0.5 }), false);
    assert.equal(ok({ action: 'spotlight', studentId: 's1' }), true);
    assert.equal(ok({ action: 'spotlight' }), false);
    assert.equal(ok({ action: 'unspot' }), true);
    assert.equal(ok({ action: 'explode' }), false);
    // Every charm names a sound the projector already has (audio.js playQuizShowSfx).
    const audio = read('audio.js');
    for (const c of CHARM_SOUNDS) assert.match(audio, new RegExp(`name === '${c.sfx}'`), `${c.id} → ${c.sfx}`);
});

test('a Golden Question doubles the next point, then is spent', () => {
    let sd = createShowdown([{ name: 'A' }, { name: 'B' }]);
    assert.equal(sd.golden, false);
    assert.equal(validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'golden' } }).ok, true);
    sd = { ...sd, golden: true };
    sd = scoreShowdown(sd, 1);
    assert.equal(sd.teams[1].score, 2);
    assert.equal(sd.golden, false, 'one golden question at a time');
    sd = scoreShowdown(sd, 1);
    assert.equal(sd.teams[1].score, 3);
    sd = scoreShowdown({ ...sd, golden: true }, 0, -1);
    assert.equal(sd.teams[0].score, 0, 'a minus never doubles');
    assert.equal(sd.golden, true, 'and does not spend the golden question');
    assert.equal(showdownPanel(sd).golden, true);
    assert.match(showHtml({ panel: showdownPanel(sd) }), /class="qw-golden is-on"/);
    assert.match(showdownHtml(sd), /data-qr-golden>/);
    assert.match(showdownHtml({ ...sd, golden: false }), /data-qr-golden hidden/);
});

test('timers: dialled minutes stay in range and carry a readable label', async () => {
    const { clampTimerMinutes, timerLabelFor } = await import('../features/questRemote/remoteCore.mjs');
    assert.equal(clampTimerMinutes(0), 1);
    assert.equal(clampTimerMinutes(45), 30);
    assert.equal(clampTimerMinutes('7'), 7);
    assert.equal(clampTimerMinutes('x'), 3);
    assert.equal(timerLabelFor(30), 'Think');
    assert.equal(timerLabelFor(600), '10 min');
    assert.equal(timerLabelFor(330), 'Timer');
    const { magicHtml, lessonHtml } = await import('../features/questRemote/remoteWandView.mjs');
    const html = lessonHtml({}, { customMinutes: 10 });
    assert.match(html, /data-action="start" data-seconds="600"/);
    assert.match(html, /data-qw-map/);
    assert.match(html, /data-qw-cmd="blackout"/);
    assert.match(magicHtml({}), /data-qw-cmd="charm" data-action="sound" data-sound="tada"/);
    assert.doesNotMatch(magicHtml({}), /data-qw-cmd="timer"/, 'timers live in Lesson mode');
    assert.match(lessonHtml({}, { customMinutes: 30 }), /data-qw="tmin-up" aria-label="One minute more" disabled/);
    const running = lessonHtml({ timer: { id: 3, label: 'Think', total: 30, remainingMs: 15000, paused: false } });
    assert.match(running, /data-qw-timer-card/);
    assert.match(running, /--p:0\.500/);
});

test('Look here shows the buttons in sight as dots on the map', async () => {
    const { lookHereHtml } = await import('../features/questRemote/remoteWandView.mjs');
    const html = lookHereHtml({ title: '<b>Market</b>', pad: [{ id: 'a', x: 0.25, y: 0.5, inView: true }, { id: 'b', x: 0.5, y: 1.4, inView: false }] });
    assert.equal((html.match(/<i style="left:/g) || []).length, 1, 'only buttons in sight');
    assert.match(html, /left:25%;top:50%/);
    assert.doesNotMatch(html, /<b>Market<\/b>/, 'titles are escaped');
});

test('Stars: "Still to shine" keeps only present heroes without a star today', () => {
    const heroes = [
        { id: 'a', first: 'Alex', stars: 2 }, { id: 'b', first: 'Maya', stars: 0 },
        { id: 'c', first: 'Nikos', stars: 0, away: true }, { id: 'd', first: 'Robin', stars: 0 }
    ];
    const html = starsHtml(heroes, { waiting: true });
    assert.match(html, /data-qw-hero="b"/);
    assert.match(html, /data-qw-hero="d"/);
    assert.doesNotMatch(html, /data-qw-hero="a"/);
    assert.doesNotMatch(html, /data-qw-hero="c"/);
    assert.match(html, /Still to shine|still to shine/);
    assert.match(html, /style="--pct:33"/, 'one of three present heroes shines');
    assert.match(starsHtml([{ id: 'a', first: 'A', stars: 1 }], { waiting: true }), /Every hero in the room shines today/);
    assert.match(awardSheetHtml({ id: 'b', first: 'Maya', stars: 0 }), /data-action="spotlight" data-student="b"/);
    assert.doesNotMatch(awardSheetHtml({ id: 'c', first: 'Nikos', stars: 0, away: true }), /data-action="spotlight"/, 'no spotlight for a hero who is away');
});

test('Recent spells keep the newest dozen, cleaned', async () => {
    const { pushSpellLog } = await import('../features/questRemote/remoteCore.mjs');
    const { spellsSheetHtml } = await import('../features/questRemote/remoteWandView.mjs');
    let log = [];
    for (let i = 0; i < 15; i += 1) log = pushSpellLog(log, { at: i, ok: i % 2 === 0, text: `spell ${i}` });
    assert.equal(log.length, 12);
    assert.equal(log[0].text, 'spell 14');
    assert.equal(pushSpellLog(log, { text: '   ' }), log, 'empty results are not logged');
    const html = spellsSheetHtml([{ at: 0, ok: false, text: '<i>nope</i>' }], 90_000);
    assert.match(html, /qw-spell is-warn/);
    assert.match(html, /2 min ago/);
    assert.doesNotMatch(html, /<i>nope<\/i>/);
});

test('projector charms: burst, beacon and spotlight markup', async () => {
    const { charmBurstHtml, beaconHtml, spotlightHtml } = await import('../features/questRemote/remoteStageView.mjs');
    assert.match(charmBurstHtml({ word: 'TA-DAA!' }), /qr-charm__word[\s\S]*TA-DAA!/);
    assert.match(beaconHtml(), /Look here!/);
    assert.match(spotlightHtml({ name: 'Maya' }), /qr-spot__name">Maya</);
    assert.doesNotMatch(spotlightHtml({ name: '<x>' }), /<x>/);
});

test('the Wand has five modes and Show counts the 10s clock itself', async () => {
    const { WAND_MODES, wandShellHtml } = await import('../features/questRemote/remoteWandView.mjs');
    assert.deepEqual(WAND_MODES.map((m) => m.key), ['stars', 'stage', 'magic', 'lesson', 'show']);
    assert.match(wandShellHtml(), /style="--n:5"/);
    let sd = createShowdown([{ name: 'A' }, { name: 'B' }], { rules: { clock: 10 } });
    sd = scoreShowdown(sd, 0);
    const html = showHtml({ panel: showdownPanel(sd) }, { clock: 7 });
    assert.match(html, /is-counting[^>]*data-action="stopclock"[\s\S]*data-qw-clock>7s</);
    // no clock chosen: no stopwatch at all
    const off = showHtml({ panel: showdownPanel(createShowdown([{ name: 'A' }, { name: 'B' }])) }, {});
    assert.doesNotMatch(off, /data-action="timer"/);
    assert.match(html, /class="qw-team is-leading"/);
    assert.match(html, /--lvl:1\.000/);
    // The projector sends the clock's start only, never a number that changes every second.
    const sdSrc = read('features/questRemote/showdown.js');
    assert.doesNotMatch(sdSrc, /panel\.counting/);
    assert.match(sdSrc, /panel\.clock = count\.id/);
});

test('the projector writes the stage less: no per-second timer writes, nothing while unbound', () => {
    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /remainingMs: stage\.timer\.paused \? stage\.timer\.remainingMs : 0/);
    assert.match(host, /if \(!host\.bound \|\| document\.hidden\) return;/);
    assert.match(host, /records\.every\(\(r\) => isOwnLayer\(r\.target\)\)/);
});

test('the Wand matches list items by identity when it morphs a live update', () => {
    const morph = read('features/questRemote/wandMorph.mjs');
    assert.match(morph, /function keyOf\(n\)/);
    assert.match(morph, /data-qw-pad/);
    const view = read('features/questRemote/remoteWandView.mjs');
    assert.match(view, /data-qw-key="h-\$\{esc\(h\.id\)\}"/);
});

test('one host per tab, and stale binds never win on the phone', () => {
    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /starting \?\?= openHosting\(opts\)/);
    assert.match(host, /data\.hostId && data\.hostId !== host\.hostId/);
    const wand = read('features/questRemote/remoteWand.js');
    assert.match(wand, /const stale = \(\) => wand !== w \|\| w\.connectSeq !== token;/);
});

test('the Wand offers General view and Follow the schedule, and a crown that knows its class', async () => {
    const { classSheetHtml, crownHtml } = await import('../features/questRemote/remoteWandView.mjs');
    const sheet = classSheetHtml([{ id: 'k1', name: 'Junior B' }], '', { follow: true });
    assert.match(sheet, /data-qw-classid="\*follow"/);
    assert.match(sheet, /data-qw-classid="\*general"/);
    assert.match(sheet, /no lesson right now/);
    assert.doesNotMatch(crownHtml({ mode: 'no-class' }), /data-qw-hold/);
    assert.doesNotMatch(crownHtml({ mode: 'needs-stars' }), /data-qw-hold/);
    assert.match(crownHtml({ mode: 'crown' }), /data-qw-hold="crown"/);
    assert.match(crownHtml({ mode: 'write', hint: 'Maya wears today\'s crown.' }), /Write/);
    const core = await import('../features/questRemote/remoteCore.mjs');
    assert.equal(core.validateCommand({ type: 'class', payload: { classId: core.CLASS_GENERAL }, clientSeq: 1, wandId: 'w' }).ok, true);
});

test('Training Grounds games reach the Wand by name, in their virtue colour', () => {
    const tpl = read('templates/app/tabs/ideas.js');
    assert.match(tpl, /data-remote-label="\$\{t\.name\}" data-remote-bg="\$\{t\.c1\}"/);
    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /el\.dataset\.remoteLabel \|\|/);
});

test('the phone can hand the projector back, and the computer hears it at once', async () => {
    const { spellsSheetHtml } = await import('../features/questRemote/remoteWandView.mjs');
    const bound = spellsSheetHtml([], Date.now(), { bound: true });
    assert.match(bound, /data-qw="disconnect"/);
    assert.doesNotMatch(spellsSheetHtml([], Date.now()), /data-qw="disconnect"/);

    const channel = read('features/questRemote/remoteChannel.js');
    assert.match(channel, /export function releaseWand\(sessionId\) \{[\s\S]*wandId: null/);

    const wand = read('features/questRemote/remoteWand.js');
    // the Wand only gives back a projector that is still bound to this phone
    assert.match(wand, /if \(!w\?\.sessionId \|\| w\.boundWandId !== w\.wandId\) return;/);
    // putting the Wand down, switching projector and Disconnect all release it
    assert.match(wand, /if \(release\) releaseProjector\(w\);/);
    assert.match(wand, /if \(w\.sessionId && w\.sessionId !== sessionId\) releaseProjector\(w\);/);
    assert.match(wand, /act === 'disconnect'/);

    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /if \(host\.wandId && !data\.wandId && !fromCache\) \{ onWandReleased\(\); return; \}/);
    assert.match(host, /function onWandReleased\(\)[\s\S]*host\.bound = false;[\s\S]*syncLaunchButtons\(\);/);
});

test('Showdown rules: answer styles, goals, bonuses, golden, undo', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    assert.deepEqual(c.normalizeShowdownRules({ goalN: 99, clock: 7, style: 'x', hotseat: 'yes' }),
        { ...c.SHOWDOWN_RULES_DEFAULT, goalN: c.SHOWDOWN_GOAL_MAX });

    // Buzz in: a point ends the question; the third question in a row earns the streak bonus
    let sd = c.createShowdown([{ name: 'A' }, { name: 'B' }], { rules: { streak: true } });
    sd = c.scoreShowdown(sd, 0); sd = c.scoreShowdown(sd, 0);
    assert.equal(sd.round, 3);
    sd = c.scoreShowdown(sd, 0);
    assert.deepEqual(sd.lastGain.bonus, ['streak']);
    assert.equal(sd.teams[0].score, 4, '1 + 1 + (1 + streak bonus)');
    sd = c.nextShowdownQuestion(sd);
    assert.equal(sd.teams[0].streak, 0, 'nobody got it: the streak breaks');

    // Every team: several teams score the same question, golden doubles them all, Next spends it
    let all = c.createShowdown([{ name: 'A' }, { name: 'B' }, { name: 'C' }], { rules: { style: 'all', streak: false } });
    all = { ...all, golden: true };
    all = c.scoreShowdown(all, 0); all = c.scoreShowdown(all, 1);
    assert.equal(all.round, 1, 'the question stays open until Next');
    assert.deepEqual(all.teams.map((t) => t.score), [2, 2, 0]);
    assert.deepEqual(all.roundScorers, [0, 1]);
    all = c.nextShowdownQuestion(all);
    assert.equal(all.golden, false);
    assert.equal(all.round, 2);

    // Underdog boost: three behind the leader earns +1
    let u = c.createShowdown([{ name: 'A' }, { name: 'B' }], { rules: { underdog: true, streak: false } });
    u = c.scoreShowdown(u, 0, 3);
    u = c.scoreShowdown(u, 1);
    assert.deepEqual(u.lastGain.bonus, ['underdog']);
    assert.equal(u.teams[1].score, 2);

    // Goals: first to N points, or N questions; undo takes back the point, even after the finish
    let g = c.createShowdown([{ name: 'A' }, { name: 'B' }], { rules: { goal: 'points', goalN: 3 } });
    g = c.scoreShowdown(g, 0, 3);
    assert.equal(g.reached, true);
    assert.deepEqual(c.showdownBarLevels(g), [1, 0.06], 'bars race to the finish line');
    g = c.finishShowdown(g);
    g = c.undoShowdown(g);
    assert.equal(g.finished, false);
    g = c.undoShowdown(g);
    assert.deepEqual([g.teams[0].score, g.reached, g.history.length], [0, false, 0]);
    let q = c.createShowdown([{ name: 'A' }, { name: 'B' }], { rules: { goal: 'questions', goalN: 3 } });
    for (let i = 0; i < 3; i++) q = c.nextShowdownQuestion(q);
    assert.equal(q.reached, true);
    assert.equal(c.showdownGoalText({ ...q, round: 2 }), 'Question 2 of 3');

    // Growth Festival: no bonuses, and a points goal becomes questions (nobody races ahead)
    const garden = c.createShowdown([{ name: 'A' }, { name: 'B' }], { growth: true, rules: { goal: 'points', streak: true, underdog: true } });
    assert.deepEqual([garden.rules.goal, garden.rules.streak, garden.rules.underdog], ['questions', false, false]);
});

test('Showdown hot seat: everyone takes a turn, star players are credited and rewarded', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    let sd = c.createShowdown([{ name: 'A', members: ['a1', 'a2'] }, { name: 'B', members: ['b1'] }], { rules: { hotseat: true }, rng: () => 0 });
    const first = c.showdownAnswerer(sd, 0);
    sd = c.scoreShowdown(sd, 0);
    assert.equal(sd.credits[first], 1);
    assert.notEqual(c.showdownAnswerer(sd, 0), first, 'the microphone moves on with the question');
    sd = c.passShowdownSeats(sd);
    assert.equal(c.showdownAnswerer(sd, 0), first, 'two heroes: back to the first');
    sd = c.scoreShowdown(sd, 0);
    assert.deepEqual(c.showdownStarPlayers(sd), [{ id: first, pts: 2 }]);
    assert.deepEqual(c.showdownRewardIds(sd, 'stars'), [first]);
    assert.deepEqual(c.showdownRewardIds(sd, 'winners').sort(), ['a1', 'a2']);
    assert.deepEqual(c.showdownRewardIds(sd, 'all').sort(), ['a1', 'a2', 'b1']);
    const panel = c.showdownPanel(sd, (id) => id.toUpperCase());
    assert.equal(panel.teams[0].hot, c.showdownAnswerer(sd, 0).toUpperCase());
    assert.equal(panel.stars[0].name, first.toUpperCase());
    const re = c.rematchShowdown(sd);
    assert.deepEqual([re.teams[0].score, re.teams[0].members, re.rules.hotseat], [0, ['a1', 'a2'], true]);
});

test('Team Forge: splits for one show, guilds never re-sorted, packed for Firestore', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    const { makeTeams, teamBanner } = await import('../features/teamMakerCore.mjs');
    const heroes = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, guildId: i === 11 ? '' : ['g1', 'g2', 'g3'][i % 3], stars: i, away: i === 10 }));
    const guilds = c.forgeShowdownTeams({ heroes, split: 'guilds' });
    for (const t of guilds) {
        const own = t.ids.filter((id) => heroes.find((h) => h.id === id).guildId);
        assert.ok(own.every((id) => heroes.find((h) => h.id === id).guildId === t.guild), 'a guild team holds only its own guild');
    }
    assert.equal(guilds.flatMap((t) => t.ids).includes('s10'), false, 'away heroes sit out');
    assert.equal(guilds.flatMap((t) => t.ids).includes('s11'), true, 'a hero with no guild still plays');
    const fair = c.forgeShowdownTeams({ heroes, split: 'fair', count: 3, makeTeams });
    assert.equal(fair.length, 3);
    assert.equal(fair.flatMap((t) => t.ids).length, 11);
    const dragon = c.forgeShowdownTeams({ heroes, split: 'dragon' });
    assert.deepEqual([dragon[0].ids.length, dragon[1].dragon], [11, true]);
    assert.deepEqual(c.forgeShowdownTeams({ heroes, split: 'today', today: null }), [], 'no Team Maker teams today: nothing to use');
    const looks = c.showdownTeamLooks('dragon', dragon, { classLook: { name: 'Junior B', emoji: '🦁' } });
    assert.deepEqual(looks.map((l) => l.name), ['Junior B', 'The Dragon']);
    assert.equal(c.showdownTeamLooks('fair', fair, { bannerOf: teamBanner })[0].name, teamBanner(0).short);

    const teams = c.packShowdownTeams(dragon);
    const open = { action: 'open', split: 'dragon', teams, style: 'all', goal: 'questions', goalN: 10, clock: 20, streak: true, underdog: false, hotseat: true };
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: open }).ok, true);
    assert.ok(teams.every((t) => !t.ids.some(Array.isArray)), 'no arrays inside arrays');
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { ...open, teams: [['s1'], ['s2']] } }).ok, false);
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { ...open, goalN: 99 } }).ok, false);
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'point', team: 0, points: 4 } }).ok, false);
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'reward', scope: 'stars', stars: 2 } }).ok, true);
    for (const action of ['undo', 'blind', 'pass', 'rematch']) assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action } }).ok, true);
});

test('Showdown screens: the Forge, the console, the finale and the arena', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    const { forgeHtml, arenaHtml, finaleHtml, FORGE_SPLITS } = await import('../features/questRemote/showdownWandView.mjs');
    const forge = forgeHtml({ split: 'fair', count: 2, canToday: false, canGuilds: true, rules: c.SHOWDOWN_RULES_DEFAULT,
        teams: [{ name: 'Foxes', color: '#f97316', emoji: '🦊', stars: 4, members: [{ id: 'a', first: 'Maya' }] }, { name: 'Bees', color: '#eab308', emoji: '🐝', stars: 3, members: [{ id: 'b', first: 'Leo' }] }] });
    assert.equal((forge.match(/data-qw-split=/g) || []).length, FORGE_SPLITS.length);
    assert.match(forge, /data-qw-split="today"[^>]*disabled/);
    assert.match(forge, /data-qw-move="a"/);
    assert.match(forge, /data-qw="forge-start"(?![^>]*disabled)/);

    let sd = c.createShowdown([{ name: 'A', members: ['a'] }, { name: 'B', members: ['b'] }], { rules: { hotseat: true, goal: 'points', goalN: 5 } });
    const fresh = arenaHtml(c.showdownPanel(sd, () => 'Maya'), { points: 2 });
    assert.match(fresh, /data-action="undo"[^>]*disabled/);
    assert.match(fresh, /data-points="2"/);
    assert.match(fresh, /data-action="pass"/);
    assert.match(fresh, /qw-team__hot/);
    sd = c.finishShowdown(c.scoreShowdown(sd, 0));
    const fin = finaleHtml(c.showdownPanel(sd, () => 'Maya'), { scope: 'stars', stars: 3 });
    assert.match(fin, /data-action="reward" data-scope="stars" data-stars="3"/);
    assert.match(fin, /qw-starplayers/);

    const arena = showdownHtml(c.createShowdown([{ name: 'A', members: ['a'] }, { name: 'B', members: [] }], { rules: { hotseat: true, goal: 'points' } }), { nameOf: (id) => (id ? 'Maya' : '') });
    assert.match(arena, /qr-lane__finish/);
    assert.match(arena, /data-qr-seat><i[^>]*><\/i><b>Maya<\/b>/);
    assert.match(arena, /data-qr-seat hidden/, 'an empty chip keeps its row, invisibly');

    const wand = read('features/questRemote/remoteWand.js');
    assert.match(wand, /action: 'open', split: f\.split, teams: packShowdownTeams\(f\.teams\), rules: \{ \.\.\.f\.rules, mode: model\.mode \}/);
    // trying splits costs nothing: the Forge only writes when the show starts
    assert.doesNotMatch(wand.slice(wand.indexOf('function forgeModel'), wand.indexOf('function forgeTap')), /send\(/);
});

test('Class against the Dragon always plays buzz-in: one side takes each question', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    let sd = c.createShowdown([{ name: 'Class', members: ['a'] }, { name: 'The Dragon', dragon: true }], { rules: { style: 'all' } });
    assert.equal(sd.rules.style, 'buzz');
    sd = c.scoreShowdown(sd, 1);
    assert.deepEqual([sd.round, sd.teams[1].score, c.showdownAnswerer(sd, 1)], [2, 1, ''], 'the Dragon never sits in the hot seat');
});

test('Showdown clock: optional, self-starting by choice, rules travel as one map', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    assert.equal(c.SHOWDOWN_RULES_DEFAULT.clock, 0, 'no clock unless the teacher picks one');
    assert.deepEqual(c.SHOWDOWN_CLOCK_CHOICES, [0, 5, 10, 20, 30]);
    assert.equal(c.normalizeShowdownRules({ clock: 0 }).clock, 0);
    assert.equal(c.normalizeShowdownRules({ clock: 20 }).autoClock, true);
    assert.equal(c.normalizeShowdownRules({ clock: 7 }).clock, 0);
    assert.equal(c.normalizeShowdownRules({ deck: 'mix' }).deck, 'mix');
    assert.equal(c.normalizeShowdownRules({ deck: 'ai' }).deck, 'voice');
    const ok = (payload) => c.validateCommand({ type: 'showdown', clientSeq: 1, payload }).ok;
    const teams = [{ ids: ['a'] }, { ids: ['b'] }];
    assert.ok(ok({ action: 'open', split: 'fair', teams, rules: { style: 'all', goal: 'questions', goalN: 8, clock: 0, autoClock: true, streak: true, underdog: false, hotseat: true, deck: 'quiz' } }));
    assert.ok(ok({ action: 'open', split: 'fair', teams, clock: 10, streak: true }), 'an older Wand sends the rules flat');
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'open', rules: { deck: 'ai' } } }).reason, 'bad-deck');
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'open', rules: { clock: 15 } } }).reason, 'bad-clock');
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'open', rules: { autoClock: 'yes' } } }).reason, 'bad-rule');
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'open', rules: [1] } }).reason, 'bad-rule');
    assert.ok(ok({ action: 'reveal' }) && ok({ action: 'stopclock', seconds: 10 }));
    assert.equal(c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'timer', seconds: 0 } }).reason, 'bad-seconds');
    // the panel says whether the clock starts by itself
    const sd = c.createShowdown([{ name: 'A' }, { name: 'B' }], { rules: { clock: 10, autoClock: false } });
    assert.equal(c.showdownPanel(sd).autoClock, false);
    assert.equal(c.showdownPanel(c.createShowdown([{ name: 'A' }, { name: 'B' }])).autoClock, false, 'no clock, nothing starts');
    // the projector's clock starts itself with each question and rings at zero; points stop it in Buzz-in only
    const src = read('features/questRemote/showdown.js');
    assert.match(src, /function armClock\(/);
    assert.match(src, /if \(!up \|\| sd\.rules\.style !== 'all'\) stopCount\(\);/);
    assert.match(src, /function timesUp\(/);
});

test('Showdown deck: played quizzes only, missed questions first, book words made into questions', async () => {
    const d = await import('../features/questRemote/showdownDeck.mjs');
    let n = 0;
    const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const quizzes = [
        { weekKey: '2026-W41', status: 'ready', questions: [{ id: 'q1', question: 'Secret?', options: ['a', 'b'], correctIndex: 0 }] },
        {
            weekKey: '2026-W40', status: 'completed',
            results: { questionStats: [{ questionId: 'q2', asked: true, firstTryCorrect: false }, { questionId: 'q1', asked: true, firstTryCorrect: true }] },
            questions: [
                { id: 'q1', question: 'Cat is a…', options: ['animal', 'colour', 'number'], correctIndex: 0, kind: 'choice' },
                { id: 'q2', question: 'Pick the past of go', options: ['goed', 'went', 'gone'], correctIndex: 1, kind: 'fix', explanation: 'go → went' },
                { id: 'q3', question: 'Listen!', options: ['a', 'b'], correctIndex: 0, kind: 'listen' },
                { id: 'q4', question: 'Cat is a…', options: ['animal', 'tree'], correctIndex: 0 }
            ]
        }
    ];
    const cards = d.quizDeckCards(quizzes, { rng });
    assert.equal(cards.length, 2, 'the unplayed quiz stays secret, listening questions stay in the quiz, duplicates once');
    assert.equal(cards[0].q, 'Pick the past of go', 'a missed question comes first');
    assert.ok(cards[0].missed && /missed/.test(cards[0].src));
    assert.equal(cards[0].opts[cards[0].correct], 'went', 'the right answer is followed through the shuffle');
    assert.equal(cards[0].why, 'go → went');

    const words = [
        { w: 'recipe', pos: 'n', gr: 'συνταγή', example: 'This is the recipe for making chocolate cake.' },
        { w: 'agree', pos: 'v', gr: 'συμφωνώ', example: "I don't agree with your idea." },
        { w: 'food', pos: 'n', gr: 'τροφή', example: 'Learning about healthy foods is good for you.' },
        { w: 'disagree', pos: 'v', gr: 'διαφωνώ', example: 'I disagree with your opinion.' },
        { w: 'kitchen', pos: 'n', gr: 'κουζίνα', example: '' }
    ];
    const wc = d.wordDeckCards(words, { src: 'Unit 3', rng });
    assert.ok(wc.length >= 4);
    for (const card of wc) {
        assert.ok(card.opts.length >= 3 && card.opts.length <= 4);
        assert.ok(card.correct >= 0 && card.correct < card.opts.length);
        assert.equal(new Set(card.opts.map((o) => o.toLowerCase())).size, card.opts.length, 'no option twice');
    }
    const gap = wc.find((c) => c.tag === 'gap' && /recipe|agree|disagree/.test(c.why));
    assert.ok(gap && /_____/.test(gap.q) && !gap.q.includes(gap.opts[gap.correct] + ' for'));
    assert.ok(!wc.some((c) => c.tag === 'gap' && c.opts[c.correct] === 'food'), '"foods" is not "food": no gap made from it');
    assert.equal(d.wordDeckCards(words.slice(0, 2)).length, 0, 'too few words for fair options');
    assert.ok(d.wordDeckCards(words, { young: true, rng }).every((c) => c.opts.length === 3), 'younger leagues get three options');

    const mix = d.buildShowdownDeck('mix', { quiz: [1, 2, 3], words: ['a', 'b'] });
    assert.deepEqual(mix, [1, 'a', 2, 'b', 3]);
    assert.deepEqual(d.buildShowdownDeck('voice', { quiz: [1] }), []);
    const units = d.deckUnits({ currentBookId: 'cpp2', unit: 3, history: [
        { bookId: 'cpp2', unit: 2, date: '2026-10-01' }, { bookId: 'cpp2', unit: 3, date: '2026-10-07' }, { bookId: 'x', unit: 9, date: '2026-10-08', unconfirmed: true }
    ] });
    assert.deepEqual(units.map((u) => u.unit), [3, 2], 'newest practised unit first, unsure entries skipped, no repeats');
});

test('Showdown projector: crews of faces with names, the deck card, the clock ring', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    const v = await import('../features/questRemote/remoteStageView.mjs');
    const members = Array.from({ length: 14 }, (_, i) => `s${i}`);
    const sd = c.createShowdown([{ name: 'Foxes', members }, { name: 'Dolphins', members: ['d1'] }, { name: 'Dragon', dragon: true }], { rules: { hotseat: true } });
    const faceOf = (id) => ({ name: `Kid${id}`, avatar: id === 'd1' ? 'https://x/a.png' : '' });
    const html = v.showdownHtml(sd, { nameOf: (id) => faceOf(id).name, faceOf, card: { q: 'Q?', opts: ['a', 'b', 'c'], correct: 1, src: 'Unit 3', n: 1, total: 5, revealed: false } });
    assert.match(html, /title="Kids\d+"/);
    assert.match(html, /<img src="https:\/\/x\/a\.png"/);
    assert.match(html, /qr-face--more[^>]*title="Kid[^"]+"[^>]*><span>\+4</, 'a long team ends in +N naming the rest');
    assert.match(html, /class="qr-face is-seat"/, 'the hot seat hero is ringed');
    assert.match(html, /qr-face--dragon/);
    assert.match(html, /aria-label="Foxes: Kid/);
    assert.match(html, /data-qr-card>/);
    assert.match(html, /qr-card__opt--2/);
    assert.doesNotMatch(html, /is-right/, 'the answer stays hidden until revealed');
    assert.match(v.deckCardHtml({ q: 'Q', opts: ['a', 'b'], correct: 1, revealed: true, why: 'because' }), /qr-card__opt--1 is-right[\s\S]*because/);
    assert.match(v.showdownHtml(sd, {}), /data-qr-card hidden/);
    assert.match(v.clockHtml(3, 10), /is-low[^>]*--k:0\.300/);
    const fin = v.showdownFinaleHtml(c.finishShowdown(c.scoreShowdown(sd, 1)), { faceOf });
    assert.match(fin, /qr-podium__crew/);
    // the Wand: the deck's question with the right answer ticked, for the teacher only
    const { arenaHtml } = await import('../features/questRemote/showdownWandView.mjs');
    const panel = { ...c.showdownPanel(sd), q: 'Q?', opts: [{ t: 'a' }, { t: 'b' }], card: 1, cards: 5, cardSrc: 'Unit 3', revealed: false };
    const wand = arenaHtml(panel, { secret: { sdCorrect: 1 } });
    assert.match(wand, /qw-qcard__opt is-right"><b>B</);
    assert.match(wand, /data-action="reveal"/);
    const host = read('features/questRemote/remoteHost.js');
    assert.match(host, /secret = showdownMod\.getShowdownSecret\?\.\(\) \|\| null/);
});

test('Showdown: heroes marked absent never play (teams, hot seat, star players, rewards)', async () => {
    const c = await import('../features/questRemote/remoteCore.mjs');
    let sd = c.createShowdown([{ name: 'A', members: ['a', 'b', 'c'] }, { name: 'B', members: ['d'] }], { rules: { hotseat: true }, rng: () => 0.99 });
    const order = sd.teams[0].order;
    // the hero at the microphone stays put when someone else leaves
    sd = c.scoreShowdown(sd, 0);
    const seated = c.showdownAnswerer(sd, 0);
    const other = order.find((id) => id !== seated && id !== c.showdownAnswerer(c.passShowdownSeats(sd), 0)) || order.find((id) => id !== seated);
    let out = c.removeShowdownMembers(sd, [other]);
    assert.equal(c.showdownAnswerer(out, 0), seated);
    assert.ok(!out.teams[0].members.includes(other) && !out.teams[0].order.includes(other));
    // the seated hero leaves: the next in line takes the microphone, their credits go
    const credited = sd.history.length ? Object.keys(sd.credits)[0] : '';
    out = c.removeShowdownMembers(sd, [seated]);
    assert.notEqual(c.showdownAnswerer(out, 0), seated);
    assert.ok(out.teams[0].order.includes(c.showdownAnswerer(out, 0)));
    if (credited === seated) assert.ok(!(seated in out.credits));
    assert.ok(!c.showdownRewardIds(c.finishShowdown(out), 'all').includes(seated));
    assert.equal(out.teams[0].score, sd.teams[0].score, 'the team keeps its points');
    assert.equal(c.removeShowdownMembers(sd, ['nobody']), sd, 'nothing to change: same object');
    // the Forge never deals an absent hero, in any split
    const heroes = [{ id: 'a', guildId: 'g1' }, { id: 'b', guildId: 'g2', away: true }, { id: 'c', guildId: 'g2' }, { id: 'd', guildId: 'g1' }];
    const makeTeams = ({ heroes: hs }) => ({ teams: [hs.slice(0, 2).map((h) => h.id), hs.slice(2).map((h) => h.id)] });
    for (const split of ['fair', 'mixed', 'random', 'guilds', 'dragon', 'today']) {
        const teams = c.forgeShowdownTeams({ heroes, split, makeTeams, today: { teams: [['a', 'b'], ['c', 'd']] } });
        assert.ok(teams.length, split);
        assert.ok(!teams.some((t) => t.ids.includes('b')), `${split} leaves the absent hero out`);
    }
    const src = read('features/questRemote/showdown.js');
    assert.match(src, /const inClass = new Set\(classRosterNow\(classId\)/, 'the projector checks today\'s register too');
    assert.match(src, /state\.subscribe\(\['allAttendanceRecords'\]/, 'marked absent mid-show: out at once');
    assert.match(src, /showdownRewardIds\(sd, scope\)\.filter\(\(id\) => !away\.has\(id\)\)/);
    assert.match(read('state.js'), /state\.allAttendanceRecords = records;\s*_notify\("allAttendanceRecords"\);/);
    const wand = read('features/questRemote/remoteWand.js');
    assert.match(wand, /activateDataFeature\?\.\('attendance'\)/);
    assert.match(wand, /state\.subscribe\(\['allAttendanceRecords', 'allStudents'\]/);
});

test('Showdown book words: every wordlist book makes questions, from the units the teacher picks', async () => {
    const d = await import('../features/questRemote/showdownDeck.mjs');
    const c = await import('../features/questRemote/remoteCore.mjs');
    const atlasMod = await import('../features/bookAtlas.mjs');
    const atlas = atlasMod.BOOK_ATLAS;
    const wordBooks = [...atlasMod.WORDLIST_BOOK_IDS];
    assert.deepEqual(d.WORD_KINDS.map((k) => k.key), [...c.SHOWDOWN_WORD_KINDS], 'the Wand and the projector agree on the kinds');
    let n = 7;
    const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    // the cause of "it finds nothing": half the wordlists have no Greek meanings and no example sentences
    for (const id of wordBooks) {
        const pool = [...await atlasMod.getUnitWords(id, 1), ...await atlasMod.getUnitWords(id, 2)];
        const cards = d.wordDeckCards(pool, { kinds: d.wordKindsForBook(id), rng });
        assert.ok(cards.length >= Math.min(5, pool.length - 1), `${id} makes questions (${cards.length} from ${pool.length} words)`);
        for (const card of cards) {
            assert.ok(card.opts[card.correct], `${id}: the right answer is an option`);
            assert.equal(new Set(card.opts.map((o) => o.toLowerCase())).size, card.opts.length, `${id}: no option twice (${card.q})`);
        }
    }
    const spell = d.wordDeckCards([{ w: 'kite' }, { w: 'ball' }, { w: 'doll' }, { w: 'teddy' }], { kinds: ['spell'], rng });
    assert.ok(spell.length && spell.every((card) => card.tag === 'spell' && card.opts.filter((o) => ['kite', 'ball', 'doll', 'teddy'].includes(o)).length === 1));
    assert.ok(!d.misspellings('hurt', 6, rng).includes('hut'), 'no dropped letter in short words (a real word)');
    const letter = d.wordDeckCards([{ w: 'kite' }, { w: 'ball' }, { w: 'doll' }], { kinds: ['letter'], rng });
    assert.ok(letter.every((card) => /Which letter is missing\? \S( \S)+/.test(card.q) && card.opts[card.correct].length === 1));
    const define = d.wordDeckCards([
        { w: 'natural', def: 'from nature and not made by people ● This furniture is made of natural materials.' },
        { w: 'cause', def: 'to make sth happen ● The storm caused a lot of problems.' },
        { w: 'affect', def: 'to make a change to sb/sth ● The bad weather has affected our plans.' }
    ], { kinds: ['define'], rng });
    assert.ok(define.length === 3 && define[0].q.startsWith('Which word means'));

    // the Forge's first choice: the class's book and the unit it reached plus the two before, without homework too
    const plan = { currentBookId: 'yeti-2', unit: 6, history: [] };
    assert.deepEqual(d.defaultWordChoice({ atlas, wordBooks, bookPlan: plan }), { book: 'yeti-2', units: [4, 5, 6], kinds: ['spell', 'letter'] });
    assert.equal(d.defaultWordChoice({ atlas, wordBooks, bookPlan: {}, league: 'B' }).book, 'primary-path-2', 'no plan yet: the league\'s book');
    assert.deepEqual(d.defaultWordChoice({ atlas, wordBooks, bookPlan: {}, league: 'B' }).units, [1]);
    assert.equal(d.defaultWordChoice({ atlas, wordBooks, bookPlan: { currentBookId: 'burlington-grammar-2', history: [{ bookId: 'primary-path-3', unit: 4, date: '2026-10-01' }] } }).book, 'primary-path-3', 'a grammar book has no wordlist: the coursebook from the history');
    assert.equal(d.reachedUnit({ history: [{ bookId: 'b', unit: 2 }, { bookId: 'b', unit: 5, unconfirmed: true }, { bookId: 'x', unit: 9, books: [{ bookId: 'b', unit: 3 }] }] }, 'b'), 3);
    assert.deepEqual(d.cleanWordChoice({ book: 'primary-path-1', units: [2, 99, 2, 1], kinds: ['define', 'gap'] }, { atlas, wordBooks }), { book: 'primary-path-1', units: [1, 2], kinds: ['gap'] });
    assert.equal(d.cleanWordChoice({ book: 'nope', units: [1] }, { atlas, wordBooks }), null);

    // the open command carries the choice; the projector honours it
    const ok = (words) => c.validateCommand({ type: 'showdown', clientSeq: 1, payload: { action: 'open', rules: { deck: 'words' }, words } });
    assert.ok(ok({ book: 'yeti-2', units: [1, 2, 3], kinds: ['spell'] }).ok);
    assert.equal(ok({ book: 'yeti-2', units: [] }).reason, 'bad-words');
    assert.equal(ok({ book: 'yeti-2', units: [1], kinds: ['riddle'] }).reason, 'bad-words');
    assert.equal(ok({ book: 'yeti-2', units: [0] }).reason, 'bad-words');
    assert.match(read('features/questRemote/showdown.js'), /loadDeck\(classId, cls, rules\.deck, p\.words\)/);
    assert.match(read('features/questRemote/remoteWand.js'), /if \(words\) payload\.words = \{ book: words\.book, units: \[\.\.\.words\.units\], kinds: \[\.\.\.words\.kinds\] \};/);
    // the phone does not load the atlas until Book words is chosen
    assert.doesNotMatch(read('features/questRemote/remoteWand.js'), /^import[^\n]*bookAtlas|^import[^\n]*bookProgress/m);
    const { wordsPanelHtml } = await import('../features/questRemote/showdownWandView.mjs');
    const panel = wordsPanelHtml({ books: [{ id: 'yeti-2', label: 'Yeti 2', on: true }], reached: 2, units: [{ n: 1, title: 'Lesson 1', on: false }, { n: 2, title: 'Lesson 2', on: true }], kinds: [{ key: 'spell', label: 'Spelling', hint: '', on: true }], summary: ['Lesson 2'] });
    assert.match(panel, /data-qw-wunit="2" aria-pressed="true"/);
    assert.match(panel, /qw-wunit is-on is-reached/);
    assert.match(panel, /data-qw="forge-words-sofar"/);
});

test('Showdown: several teams score in one tap (one Undo), and the new games play by their rules', async () => {
    const core = await import('../features/questRemote/remoteCore.mjs');
    const view = await import('../features/questRemote/remoteStageView.mjs');
    const wandView = await import('../features/questRemote/showdownWandView.mjs');
    const teams = (n) => Array.from({ length: n }, (_, i) => ({ name: `T${i}`, members: [`s${i}a`, `s${i}b`] }));
    const cmd = (payload) => core.validateCommand({ type: 'showdown', payload, clientSeq: 1, wandId: 'w', sentAt: Date.now() });

    // several teams at once: one step, each team scores, buzz-in moves on once
    let sd = core.createShowdown(teams(3), { rules: { style: 'buzz' } });
    sd = core.scoreShowdownTeams(sd, [0, 2], 2);
    assert.deepEqual(sd.teams.map((t) => t.score), [2, 0, 2]);
    assert.equal(sd.lastGains.length, 2);
    assert.equal(sd.round, 2);
    assert.equal(sd.history.length, 1);
    sd = core.undoShowdown(sd);
    assert.deepEqual(sd.teams.map((t) => t.score), [0, 0, 0]);
    assert.equal(sd.round, 1);
    assert.equal(cmd({ action: 'point', teams: [0, 2], points: 1 }).ok, true);
    assert.equal(cmd({ action: 'point', teams: [0, 0] }).ok, false, 'no team twice');
    assert.equal(cmd({ action: 'point', teams: [9] }).ok, false);
    assert.equal(cmd({ action: 'miss', teams: [1] }).ok, true);

    // the game a set of teams can play
    assert.equal(core.showdownModeFor('tug', { teams: 3 }), 'race');
    assert.equal(core.showdownModeFor('tug', { teams: 2 }), 'tug');
    assert.equal(core.showdownModeFor('survivor', { teams: 2, dragon: true }), 'race');
    assert.equal(core.showdownModeFor('treasure', { teams: 4, growth: true }), 'race');
    assert.equal(cmd({ action: 'open', rules: { mode: 'chess' } }).ok, false);
    assert.equal(cmd({ action: 'open', rules: { mode: 'survivor', lives: 9 } }).ok, false);
    assert.equal(core.normalizeShowdownRules({ mode: 'tug', tugN: 99, lives: 0 }).tugN, core.SHOWDOWN_TUG_MAX);
    assert.equal(core.normalizeShowdownRules({ lives: 0 }).lives, core.SHOWDOWN_LIVES_MIN);

    // Tug of War: the knot follows the lead, a lead of tugN wins
    let tug = core.createShowdown(teams(2), { rules: { mode: 'tug', tugN: 3, goal: 'points', goalN: 5 } });
    assert.equal(tug.rules.goal, 'open', 'the rope is its own finish');
    assert.deepEqual(core.showdownBarLevels(tug), [0.5, 0.5]);
    tug = core.scoreShowdown(tug, 0, 2);
    assert.ok(core.showdownBarLevels(tug)[0] > 0.8 && !tug.reached);
    tug = core.scoreShowdown(tug, 0, 1);
    assert.equal(tug.reached, true);
    assert.match(core.showdownGoalText(tug), /Pull 3 ahead/);
    const tugMarkup = view.showdownHtml(tug, {});
    assert.match(tugMarkup, /class="qr-tug"[^>]*--pull:1\.000/);
    assert.match(tugMarkup, /data-team="0"[\s\S]*data-team="1"/);
    assert.match(tugMarkup, /Tug of War/);

    // Survivor: misses cost hearts, the last team standing wins, nobody can score once out
    let sv = core.createShowdown(teams(3), { rules: { mode: 'survivor', lives: 2 } });
    assert.deepEqual(sv.teams.map((t) => t.lives), [2, 2, 2]);
    assert.deepEqual(core.showdownWinners(sv), [], 'nothing has happened yet');
    sv = core.missShowdown(sv, 1);
    sv = core.missShowdown(sv, 1);
    assert.equal(sv.teams[1].out, true);
    assert.equal(sv.lastGain.out, true);
    assert.equal(core.scoreShowdown(sv, 1, 1).teams[1].score, 0, 'an out team cannot score');
    assert.match(core.showdownGoalText(sv), /2 still in/);
    // both remaining teams miss on their last heart at once: they keep it (a Survivor show always has a winner)
    sv = core.missShowdownTeams(sv, [0, 2]);
    sv = core.missShowdownTeams(sv, [0, 2]);
    assert.equal(sv.lastGain.saved, true);
    assert.deepEqual(sv.teams.map((t) => [t.lives, t.out]), [[1, false], [0, true], [1, false]]);
    sv = core.missShowdown(sv, 2);
    assert.equal(sv.reached, true);
    assert.deepEqual(core.showdownWinners(sv), [0]);
    sv = core.undoShowdown(sv);
    assert.deepEqual(sv.teams.map((t) => t.out), [false, true, false], 'Undo gives the heart back');
    assert.match(view.showdownHtml(sv, {}), /qr-lane__hearts[\s\S]*is-out[\s\S]*qr-lane__stamp/);
    assert.equal(core.missShowdown(core.createShowdown(teams(2)), 0).teams[0].lives, 0, 'no misses outside Survivor');

    // Treasure: every point opens a chest; a seeded roll is repeatable
    const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
    let tr = core.createShowdown(teams(2), { rules: { mode: 'treasure', streak: false } });
    tr = core.scoreShowdown(tr, 0, 1, { rng: seq([0]) }); // the first slot: +1 coin
    assert.deepEqual(tr.lastGain.chest, { kind: 'coins', amount: 1 });
    assert.equal(tr.teams[0].score, 2);
    // a steal: only for a team behind, from the leader
    const steal = core.rollTreasure(tr, 1, () => 0.999);
    assert.deepEqual(steal, { kind: 'steal', amount: 1, from: 0 });
    tr = core.scoreShowdown(tr, 1, 1, { rng: () => 0.999 });
    assert.deepEqual([tr.teams[0].score, tr.teams[1].score], [1, 2]);
    assert.notEqual(core.rollTreasure(core.createShowdown(teams(2), { rules: { mode: 'treasure' } }), 0, () => 0.999).kind, 'steal', 'nobody to steal from');
    // a double chest doubles the team's next point
    let dbl = core.createShowdown(teams(2), { rules: { mode: 'treasure', streak: false } });
    // weights 34 / 22 / 6 / 16 (coins 1, 2, 3, double) with nobody ahead: a roll just past the coins
    dbl = core.scoreShowdown(dbl, 0, 1, { rng: () => (34 + 22 + 6 + 1) / 78 });
    assert.equal(dbl.lastGain.chest.kind, 'double');
    assert.equal(dbl.teams[0].dbl, true);
    dbl = core.scoreShowdown(dbl, 0, 1, { rng: seq([0]) });
    assert.ok(dbl.lastGain.bonus.includes('double'));
    assert.equal(dbl.lastGain.total, 3, '1 doubled to 2, plus a coin');
    assert.equal(dbl.teams[0].dbl, false);
    assert.match(view.chestHtml({ kind: 'steal', amount: 1 }, { from: 'Foxes' }), /Steal! \+1 from Foxes/);
    assert.match(view.chestHtml({ kind: 'coins', amount: 2 }), /\+2 coins/);

    // the Wand: Several teams turns taps into picks and one button; Survivor's Miss; the Forge's game step
    const panel = core.showdownPanel(core.createShowdown(teams(3), { rules: { mode: 'survivor', lives: 3 } }));
    assert.equal(panel.livesMax, 3);
    const one = wandView.arenaHtml(panel, {});
    assert.match(one, /data-action="miss" data-team="0"/);
    assert.match(one, /data-qw="sd-multi"/);
    const many = wandView.arenaHtml(panel, { multi: true, picks: [0, 2] });
    assert.match(many, /data-qw-sdpick="0"/);
    assert.match(many, /data-action="point" data-teams="0,2" data-points="1"/);
    assert.match(many, /data-action="miss" data-teams="0,2"/);
    assert.match(many, /\+1 to 2 teams/);
    const forge = wandView.forgeHtml({ split: 'guilds', teams: [{ name: 'A', members: [] }, { name: 'B', members: [] }, { name: 'C', members: [] }], rules: core.normalizeShowdownRules({ mode: 'survivor' }), mode: 'survivor', canTug: false });
    assert.match(forge, /data-value="tug"[^>]*disabled/);
    assert.match(forge, /forge-lives-up/);
    assert.doesNotMatch(forge, /data-qw-rule="goal"/, 'Survivor has no goal row');
    const wandSrc = readFileSync(new URL('../features/questRemote/remoteWand.js', import.meta.url), 'utf8');
    assert.match(wandSrc, /if \(d\.teams\) p\.teams = /);
});
