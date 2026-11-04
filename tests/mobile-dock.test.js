const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('phone dock is a floating island with a sliding gem and a raised Award coin, not clouds', () => {
  const tpl = read('mobile/templates.js');
  assert.doesNotMatch(tpl, /m-dock-cloud/, 'phone dock and More tiles no longer use cloud shapes');
  assert.equal((tpl.match(/<span class="m-dock-ind" aria-hidden="true"><\/span>/g) || []).length, 2, 'teacher and office docks each have one gem');
  assert.match(tpl, /m-dock-btn--coin[^"]*" data-tab="award-stars-tab"/);
  const css = read('mobile/styles/chrome.css');
  assert.match(css, /\.m-dock-ind\s*\{/);
  assert.match(css, /\.m-dock-coin\s*\{/);
  assert.doesNotMatch(css, /--cloud-shape/);
  const dock = read('mobile/dock.js');
  assert.match(dock, /export function wireDock\(dock\)/);
  assert.match(read('mobile/teacher.js'), /wireDock\(document\.getElementById\('m-teacher-dock'\)\)/);
  assert.match(read('mobile/roles.js'), /wireDock\(document\.getElementById\('m-secretary-dock'\)\)/);
});
