import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('every shared FAB cluster has a matching reveal-controller selector', () => {
  const listeners = read('ui/core/listeners.js');
  const templates = {
    al: read('templates/app/tabs/log.js'),
    hc: read('templates/app/tabs/leaderboard.js'),
    ss: read('templates/app/tabs/scroll.js'),
  };

  for (const [prefix, template] of Object.entries(templates)) {
    assert.match(template, new RegExp(`${prefix}-fab-cluster tab-fab-cluster tab-fab-cluster--left`));
    assert.match(template, new RegExp(`${prefix}-fab-cluster tab-fab-cluster tab-fab-cluster--right`));
    assert.ok(
      listeners.includes(`.${prefix}-fab-cluster.tab-fab-cluster--left`),
      `${prefix} left FAB must be discoverable by the reveal controller`,
    );
    assert.ok(
      listeners.includes(`.${prefix}-fab-cluster.tab-fab-cluster--right`),
      `${prefix} right FAB must be discoverable by the reveal controller`,
    );
  }

  const css = read('styles/floating_actions.css');
  assert.match(css, /\.tab-fab-cluster\.revealed\s*\{[^}]*opacity:\s*1;/s);
  assert.match(css, /\.tab-fab-cluster\.revealed\s*\{[^}]*pointer-events:\s*auto;/s);
});
