import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile Teacher Settings dropdown is hidden on desktop', () => {
  const mobileCss = read('mobile/styles/mobile.css');
  const tabsCss = read('mobile/styles/tabs.css');
  const hideBlock = mobileCss.match(/#m-teacher-header,[\s\S]*?\{\s*display:\s*none;?\s*\}/);
  assert.ok(hideBlock, 'expected desktop hide block for mobile shells');
  assert.match(hideBlock[0], /#m-options-subtab-dropdown/);
  assert.match(mobileCss, /body\.gcq-mobile #m-options-subtab-dropdown/);
  assert.match(tabsCss, /\.m-subtab-dropdown\s*\{[\s\S]*?display:\s*none/);
  assert.match(tabsCss, /body\.gcq-mobile \.m-subtab-dropdown\s*\{[\s\S]*?display:\s*block/);
});

test('Teacher Settings uses a dropdown instead of a horizontal subtab scroller', () => {
  const html = read('templates/app/tabs/options.js');
  const css = read('styles/options.css');
  const nav = read('ui/tabs/navigation.js');
  assert.match(html, /id="options-subtab-trigger"/);
  assert.match(html, /id="options-subtab-menu"/);
  assert.match(html, /id="options-subtab-select"/);
  assert.match(css, /#options-tab \.options-subtab-buttons/);
  assert.match(css, /#options-tab \.options-subtab-bar[\s\S]*?overflow:\s*visible/);
  assert.match(nav, /function syncOptionsSubtabSelect/);
  assert.match(nav, /function wireOptionsSubtabSelect/);
});

test('Teacher Settings contains only teacher-owned controls and no school-wide editors', () => {
  const teacherSettings = read('templates/app/tabs/options.js');
  assert.doesNotMatch(teacherSettings, /id="options-school-name-input"/);
  assert.doesNotMatch(teacherSettings, /id="options-school-location-search"/);
  assert.doesNotMatch(teacherSettings, /id="holiday-name"/);
  assert.doesNotMatch(teacherSettings, /data-options-tab="danger"/);
  assert.doesNotMatch(teacherSettings, /id="options-manage-subscription-btn"/);
  assert.match(teacherSettings, /Student Tools/);
  assert.match(teacherSettings, /My Classes/);
  assert.match(teacherSettings, /options-subtab-active" data-options-tab="classes"/);
  assert.ok(
    teacherSettings.indexOf('data-options-tab="classes"') < teacherSettings.indexOf('data-options-tab="manage"'),
    'My Classes is the first Teacher Settings section'
  );
  assert.match(teacherSettings, /My Planning/);
  assert.match(teacherSettings, /Class Grading/);
  assert.match(teacherSettings, /Family Access/);
  assert.match(teacherSettings, /Parent logins/);
  assert.match(teacherSettings, /data-options-tab="market"/);
  assert.match(teacherSettings, /Market Manager/);
  assert.doesNotMatch(teacherSettings, /Secretary\/admin credentials are managed only from the Secretary console/);
  assert.doesNotMatch(teacherSettings, /Role Access Center/);
  assert.match(read('features/accessManagement.js'), /Parent access is not included in this school's plan/);
  assert.doesNotMatch(read('features/accessManagement.js'), />Pro\+</);
  assert.match(read('features/placementWizard.js'), /Parent access is turned off now/);
  assert.match(read('utils/adminRuntime.js'), /purgeStudent/);
  assert.match(read('functions/index.js'), /exports\.purgeLeftSchoolStudents/);
  assert.match(read('functions/index.js'), /exports\.purgeStudent/);
  assert.doesNotMatch(teacherSettings, /teacher-advanced-data-actions/);
  assert.doesNotMatch(teacherSettings, /Advanced data actions/);
  assert.doesNotMatch(teacherSettings, /star-manager-purge-btn/);
  assert.doesNotMatch(teacherSettings, /erase-today-btn/);
  assert.doesNotMatch(teacherSettings, /purge-logs-btn/);
  assert.doesNotMatch(read('ui/core/listeners.js'), /DELETE MY LOGS/);
  assert.doesNotMatch(teacherSettings, /id="app-tier-label"/);
  assert.doesNotMatch(teacherSettings, /id="app-version-label"/);
  assert.match(teacherSettings, /id="options-tier-summary"/);
  assert.match(teacherSettings, /data-grading-tab="classes"/);
  assert.match(teacherSettings, /id="class-grading-class-select"/);
  const summaryAt = teacherSettings.indexOf('id="options-tier-summary"');
  const marketAt = teacherSettings.indexOf('data-options-tab="market"');
  assert.ok(summaryAt > marketAt, 'plan summary belongs at the bottom of Teacher Settings');
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
