import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const classes = read('ui/tabs/classes.js');
const tips = read('ui/tabs/rosterTips.js');
const css = read('styles/student_roster.css');
const template = read('templates/app/tabs/students.js');
const styleCss = read('style.css');

test('roster styles load with the Students tab, not at first paint', () => {
    assert.match(classes, /^import '\.\.\/\.\.\/styles\/student_roster\.css';/m);
    assert.doesNotMatch(styleCss, /@import url\('\.\/styles\/student_roster\.css'\)/);
});

test('every roster tool carries a tooltip and keeps its visible word in its name', () => {
    const block = classes.slice(classes.indexOf('const tool = ({ cls, tone'), classes.indexOf('const fa = (name)'));
    assert.match(block, /data-tip-title="\$\{escapeHtml\(tipTitle\)\}"/);
    assert.match(block, /data-tip="\$\{escapeHtml\(tip\)\}"/);
    assert.match(block, /aria-label="\$\{escapeHtml\(name\)\}"/);
    assert.doesNotMatch(block, / title="/); // no native title box under the custom tip
    assert.match(classes, /bindRosterTips\(document\.getElementById\('manage-students-tab'\)\)/);
});

test('tooltips work by mouse, keyboard and touch, and a hold never opens the tool', () => {
    assert.match(tips, /addEventListener\('focusin'/);
    assert.match(tips, /aria-describedby/);
    assert.match(tips, /role', 'tooltip'/);
    assert.match(tips, /HOLD_DELAY/);
    assert.match(tips, /addEventListener\('click', \(event\) => \{[\s\S]*?stopPropagation\(\);[\s\S]*?\}, true\)/);
    assert.match(tips, /key === 'Escape'/);
});

test('the roster explains itself: key and "Waiting for you" line', () => {
    assert.match(template, /class="roster-key"/);
    assert.match(template, /id="roster-todo" class="roster-todo hidden"/);
    assert.match(css, /\.roster-todo\.hidden \{ display: none; \}/);
    assert.match(classes, /function renderRosterTodo\(items\)/);
    assert.match(classes, /is-todo/);
});

test('roster motion stays on transform and opacity, with a reduced-motion guard', () => {
    // the roster and the class banner (the gold Returning adventurers panel sits between them)
    const roster = css.slice(0, css.indexOf('Student setup: Returning adventurers')) + css.slice(css.indexOf('Class banner (templates'));
    for (const [, value] of roster.matchAll(/transition:\s*([^;]+);/g)) {
        for (const part of value.split(',')) assert.match(part.trim(), /^(transform|opacity|none)\b/, part.trim());
    }
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.roster-row \{ animation: none; \}/);
});
