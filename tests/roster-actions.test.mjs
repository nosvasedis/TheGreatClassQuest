import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const classes = fs.readFileSync(new URL('../ui/tabs/classes.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the roster is morphed, so its tools use one delegated listener', () => {
    assert.match(classes, /morphInto\(list, studentsInClass\.map/);
    assert.match(classes, /<article class="roster-row" data-morph-key="\$\{s\.id\}"/);
    assert.match(classes, /const boundRosterLists = new WeakSet\(\);/);
    // per-button listeners would pile up on rows that survive a morph
    assert.doesNotMatch(classes, /list\.querySelectorAll\('\.(delete|edit|move|certificate)-student-btn'\)\.forEach/);
});

test('every roster tool still has an action', () => {
    const tools = ['delete-student-btn', 'certificate-student-btn', 'edit-student-btn', 'avatar-maker-btn', 'move-student-btn',
        'hero-chronicle-btn', 'parent-access-student-btn', 'guild-quiz-btn', 'hero-class-select-btn', 'skill-tree-btn'];
    const block = classes.slice(classes.indexOf('const ROSTER_ACTIONS = {'), classes.indexOf('const ROSTER_ACTION_SELECTOR'));
    for (const cls of tools) assert.match(block, new RegExp(`'${cls}':`), cls);
    // plan gates are read at click time
    assert.match(block, /canUseFeature\('eliteAI'\)/);
    assert.match(block, /canUseFeature\('guilds'\)/);
    assert.match(block, /canUseFeature\('heroProgression'\)/);
});
