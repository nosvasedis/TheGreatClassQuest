import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

// Side FABs (edge-hover floating buttons) were retired: every tab keeps its actions in the page.
test('no tab template ships side FABs any more', () => {
  for (const file of ['templates/app/tabs/log.js', 'templates/app/tabs/scroll.js', 'templates/app/tabs/leaderboard.js']) {
    assert.doesNotMatch(read(file), /fab-cluster|tab-fab/, `${file} should not contain FAB markup`);
  }
  assert.ok(!fs.existsSync(path.join(root, 'styles/floating_actions.css')));
  assert.doesNotMatch(read('ui/core/listeners.js'), /fab-cluster/);
});

test('Adventure Log keeps the Quest Board and Attendance as in-page class tools', () => {
  const log = read('templates/app/tabs/log.js');
  // Outside the .al-desk section so they stay usable when the diary itself is locked by plan.
  assert.ok(log.indexOf('class="al-tools"') > log.indexOf('</section>'));
  assert.match(log, /id="quest-assignment-btn"/);
  assert.match(log, /id="attendance-chronicle-btn"/);

  const listeners = read('ui/core/listeners.js');
  assert.match(listeners, /'quest-assignment-btn'\)\?\.addEventListener\('click', modals\.openQuestAssignmentModal\)/);
  assert.match(listeners, /'attendance-chronicle-btn'\)\?\.addEventListener\('click', modals\.openAttendanceChronicle\)/);
});

test("Hero's Challenge opens the Hall of Prodigies and Trophy Room from the page", () => {
  const board = read('templates/app/tabs/leaderboard.js');
  assert.match(board, /class="hc-halls"/);
  assert.match(board, /id="open-prodigy-btn"/);
  assert.match(board, /id="open-trophy-room-btn"/);
});

test("Scholar's Scroll offers Log New Trial and History on the scroll itself", () => {
  const scholarScroll = read('features/scholarScroll.js');
  assert.match(scholarScroll, /data-ss-action="log-trial"/);
  assert.match(scholarScroll, /data-ss-action="history"/);
});
