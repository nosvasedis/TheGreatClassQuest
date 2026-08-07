import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Teacher Settings contains only teacher-owned controls and no school-wide editors', () => {
  const teacherSettings = read('templates/app/tabs/options.js');
  assert.doesNotMatch(teacherSettings, /id="options-school-name-input"/);
  assert.doesNotMatch(teacherSettings, /id="options-school-location-search"/);
  assert.doesNotMatch(teacherSettings, /id="holiday-name"/);
  assert.doesNotMatch(teacherSettings, /data-options-tab="danger"/);
  assert.doesNotMatch(teacherSettings, /id="options-manage-subscription-btn"/);
  assert.match(teacherSettings, /Student Tools/);
  assert.match(teacherSettings, /My Classes/);
  assert.match(teacherSettings, /data-options-tab="classes"/);
  assert.match(teacherSettings, /My Planning/);
  assert.match(teacherSettings, /Class Grading/);
  assert.match(teacherSettings, /Family Access/);
  assert.match(teacherSettings, /<details id="teacher-advanced-data-actions"/);
  assert.match(read('ui/core/listeners.js'), /DELETE MY LOGS/);
});

test('Secretary Admin owns school identity, holidays, credentials, billing, and grading defaults', () => {
  const secretaryAdmin = read('features/secretary/admin.js');
  assert.match(secretaryAdmin, /id="secretary-school-name-form"/);
  assert.match(secretaryAdmin, /id="options-school-location-search"/);
  assert.match(secretaryAdmin, /id="holiday-name"/);
  assert.match(secretaryAdmin, /id="secretary-credentials-form"/);
  assert.match(secretaryAdmin, /id="secretary-manage-subscription-btn"/);
  assert.match(secretaryAdmin, /id="secretary-assessment-defaults-editor"/);
  assert.match(secretaryAdmin, /canUseFeature\('secretaryAccess'\)/);
});

test('teacher signup and authority never depend on the retired schoolAdmin flag', () => {
  const profile = read('db/userProfiles.js');
  const roles = read('utils/roles.js');
  const state = read('state.js');
  assert.doesNotMatch(profile, /schoolAdmin/);
  assert.doesNotMatch(roles, /schoolAdmin/);
  assert.doesNotMatch(state, /schoolAdmin/);
});
