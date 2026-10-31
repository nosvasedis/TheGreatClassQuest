const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'ui', 'tabs', 'classes.js'), 'utf8');

test('a chosen hero class in the roster is a button that opens the Deck of Paths', () => {
    const block = source.slice(source.indexOf('const heroClassTool = s.heroClass'), source.indexOf('const skillTool'));
    assert.match(block, /tag: heroProgressionEnabled \? 'button' : 'span'/);
    assert.match(block, /is-set\$\{heroProgressionEnabled \? ' hero-class-select-btn' : ''\}/);
});

test('roster class button goes through the same modal that enforces the yearly change limit', () => {
    // The roster's tools share one delegated listener (ROSTER_ACTIONS in ui/tabs/classes.js).
    assert.match(source, /'hero-class-select-btn': \(id\) => \{[\s\S]*?modals\.openHeroClassSelectModal\(id\)/);
});
