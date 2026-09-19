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
    assert.match(wizard, /Select all/);
    assert.match(wizard, /Unselect all/);
});

test('class desk wizard never dumps raw teacher ids or a native select', () => {
    const wizard = read('features/classWizard.js');
    const year = read('features/schoolYearConsole.js');
    assert.match(year, /renderClassLauncher/);
    assert.match(year, /openClassWizard/);
    assert.match(year, /renderYearSetupLaunchers/);
    assert.match(year, /school-year-setup-pair/);
    assert.match(wizard, /This year's classes/);
    assert.match(wizard, /Create and manage classes/);
    assert.doesNotMatch(wizard, /<select/);
    assert.doesNotMatch(wizard, /teacher\.uid \|\|/);
    assert.match(wizard, /questLeagues/);
    assert.match(wizard, /showLogoPicker\('secretary'\)/);
    assert.match(wizard, /class-desk-step/);
    assert.match(wizard, /fa-chalkboard-user/);
    assert.match(wizard, /data-class-desk-goto/);
    assert.doesNotMatch(wizard, /placement-wizard__step/);
});

test('School Classes is an overview cockpit without Edit class', () => {
    const school = read('features/secretary/school.js');
    const cockpit = read('features/secretary/classCockpit.js');
    assert.doesNotMatch(school, /data-secretary-edit-class/);
    assert.doesNotMatch(school, /Edit class/);
    assert.match(school, /data-secretary-open-class/);
    assert.match(school, /school-hero-card/);
    assert.doesNotMatch(school, /class="role-list-row"/);
    assert.doesNotMatch(cockpit, /getLatestScoresByStudent/);
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

test('createStudent stamps the class teacher, not the signed-in secretary', () => {
    const students = read('db/actions/students.js');
    assert.match(students, /export async function createStudent/);
    assert.match(students, /createdBy:\s*owner/);
    assert.match(students, /withActiveStudentYear/);
    assert.match(students, /withActiveScoreYear/);
    assert.match(students, /SCORE_DEFAULTS/);
    assert.match(students, /await createStudent\(\{/);
    assert.match(students, /uid: state\.get\('currentUserId'\)/);
});

test('School Year student desk is the leftmost launcher and has no native select', () => {
    const year = read('features/schoolYearConsole.js');
    const wizard = read('features/studentWizard.js');
    const css = read('styles/roles.css');
    const start = year.indexOf('function renderYearSetupLaunchers');
    const end = year.indexOf('function friendlyYearStatus');
    const launchers = year.slice(start, end);
    const studentIndex = launchers.indexOf('renderStudentLauncher');
    const classIndex = launchers.indexOf('renderClassLauncher');
    const placementIndex = launchers.indexOf('renderPlacementLauncher');
    assert.ok(studentIndex >= 0 && classIndex > studentIndex && placementIndex > classIndex);
    assert.match(year, /openStudentWizard/);
    assert.match(year, /refreshStudentWizardIfOpen/);
    assert.match(wizard, /New student/);
    assert.match(wizard, /Add a new student/);
    assert.match(wizard, /Open student desk/);
    assert.match(wizard, /createdBy: owner/);
    assert.match(wizard, /data-student-desk-open-class-desk/);
    assert.match(wizard, /class-desk-step/);
    assert.doesNotMatch(wizard, /<select/);
    assert.doesNotMatch(wizard, /currentUserId/);
    assert.match(css, /\.school-year-setup-pair \{[\s\S]*?grid-template-columns: 1fr 1fr 1fr/);
    assert.match(css, /\.student-desk-launcher/);
});
