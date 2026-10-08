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
    let sd = createShowdown([{ name: 'A' }, { name: 'B' }]);
    sd = scoreShowdown(sd, 0);
    const html = showHtml({ panel: showdownPanel(sd) }, { clock: 7 });
    assert.match(html, /is-counting[\s\S]*data-qw-clock>7s</);
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
    assert.match(host, /if \(!host\.wandId \|\| document\.hidden\) return;/);
    assert.match(host, /records\.every\(\(r\) => isOwnLayer\(r\.target\)\)/);
});
