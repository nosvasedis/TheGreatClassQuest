import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('createClass assigns the chosen teacher instead of always using the signed-in user', () => {
    const classes = read('db/actions/classes.js');
    assert.match(classes, /normalizeCreatedBy/);
    assert.match(classes, /createdBy:\s*owner/);
    assert.match(classes, /showClassCreationLimitIfNeeded\(teacherUid\)/);
    assert.match(classes, /deleteEmptyClass/);
    assert.doesNotMatch(classes, /createdBy: \{ uid: state\.get\('currentUserId'\), name: state\.get\('currentTeacherName'\) \}/);
});

test('assignClassTeacher callable exists for secretary reassignment', () => {
    const functions = read('functions/index.js');
    const runtime = read('utils/adminRuntime.js');
    const onboarding = read('tools/onboarding-console/lib.js');
    assert.match(functions, /exports\.assignClassTeacher/);
    assert.match(functions, /createdBy: owner/);
    assert.match(runtime, /assignClassTeacher/);
    assert.match(onboarding, /assignClassTeacher/);
});

test('student placement launcher has no redundant fact badges and uses Student placement', () => {
    const wizard = read('features/placementWizard.js');
    assert.match(wizard, /Student placement/);
    assert.doesNotMatch(wizard, /September placement/);
    assert.doesNotMatch(wizard, /placement-launcher__facts/);
    assert.doesNotMatch(wizard, /Suggested by last year’s league/);
    assert.doesNotMatch(wizard, /returning heroes are waiting/);
    assert.match(wizard, /data-placement-open-class-desk/);
    assert.match(wizard, /quietlyFinalizePlacement/);
});

test('class desk wizard never dumps raw teacher ids or a native select', () => {
    const wizard = read('features/classWizard.js');
    const year = read('features/schoolYearConsole.js');
    assert.match(year, /renderClassLauncher/);
    assert.match(year, /openClassWizard/);
    assert.match(wizard, /This year's classes/);
    assert.match(wizard, /Create and manage classes/);
    assert.doesNotMatch(wizard, /<select/);
    assert.doesNotMatch(wizard, /teacher\.uid \|\|/);
    assert.match(wizard, /questLeagues/);
    assert.match(wizard, /showLogoPicker\('secretary'\)/);
});

test('School Classes is an overview cockpit without Edit class', () => {
    const school = read('features/secretary/school.js');
    const cockpit = read('features/secretary/classCockpit.js');
    assert.doesNotMatch(school, /data-secretary-edit-class/);
    assert.doesNotMatch(school, /Edit class/);
    assert.match(school, /data-secretary-open-class/);
    assert.match(cockpit, /Award Stars/);
    assert.match(cockpit, /Team Quest/);
    assert.match(cockpit, /Hero's Challenge/);
    assert.match(cockpit, /Mystic Market/);
    assert.match(cockpit, /Guild Hall/);
    assert.match(cockpit, /Adventure Log/);
    assert.match(cockpit, /Quest Calendar/);
    assert.match(cockpit, /Attendance/);
    assert.match(cockpit, /renderGradesBoard/);
});

test('Grades board includes Scholar\'s Scroll and Quest Assignment', () => {
    const grades = read('features/secretary/grades.js');
    const board = read('features/secretary/gradesBoard.js');
    assert.match(grades, /renderGradesBoard/);
    assert.match(board, /Scholar's Scroll/);
    assert.match(board, /Quest Assignment/);
    assert.match(board, /allQuestAssignments/);
});

test('End of Year has no Repair data or Finish September setup for secretaries', () => {
    const year = read('features/schoolYearConsole.js');
    assert.doesNotMatch(year, /Repair data/);
    assert.doesNotMatch(year, /Finish September setup/);
    assert.doesNotMatch(year, /school-year-preview-output/);
    assert.doesNotMatch(year, /school-year-verify-records-btn/);
    assert.doesNotMatch(year, /school-year-backfill-btn/);
    assert.doesNotMatch(year, /school-year-finalize-btn/);
    assert.match(year, /Check readiness/);
    assert.match(year, /Finish school year/);
});
