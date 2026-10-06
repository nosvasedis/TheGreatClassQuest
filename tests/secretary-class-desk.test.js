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
    assert.match(functions, /exports\.assignClassTeacher/);
    assert.match(functions, /createdBy: owner/);
    assert.match(runtime, /assignClassTeacher/);
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

test('class desk Continue enables as soon as the class name is typed', () => {
    const wizard = read('features/classWizard.js');
    const start = wizard.indexOf('function handleWizardInput');
    const end = wizard.indexOf('function handleWizardKeydown');
    assert.ok(start >= 0 && end > start);
    const handler = wizard.slice(start, end);
    assert.match(handler, /class-desk-name/);
    assert.match(handler, /class-desk-footer/);
    assert.match(handler, /renderFooter\(\)/);
    assert.doesNotMatch(handler, /paintWizard\(\)/);
});

test('class desk wizard never dumps raw teacher ids or a native select', () => {
    const wizard = read('features/classWizard.js');
    const year = read('features/schoolYearConsole.js');
    const registry = read('features/secretary/registry.js');
    assert.match(year, /openClassWizard/);
    assert.match(year, /renderYearSetupLaunchers/);
    assert.match(registry, /data-secretary-new-class/);
    assert.match(registry, /Open a new class/);
    assert.match(registry, /data-secretary-open-class-desk/);
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

test('Students & Classes is one path: open a class, then enrol into it', () => {
    const registry = read('features/secretary/registry.js');
    const year = read('features/schoolYearConsole.js');
    const wizard = read('features/studentWizard.js');
    const classWizard = read('features/classWizard.js');
    const console = read('features/secretaryConsole.js');
    const css = read('styles/secretary_office.css');
    const classIndex = registry.indexOf('data-secretary-new-class');
    const studentIndex = registry.indexOf('school-year-student-desk-open-btn');
    const placementIndex = registry.indexOf('school-year-placement-open-btn');
    assert.ok(classIndex >= 0 && studentIndex > classIndex && placementIndex > studentIndex);
    // The old class list desk duplicated the Classes lane.
    assert.doesNotMatch(registry, /school-year-class-desk-open-btn/);
    assert.doesNotMatch(registry, /Create and manage classes/);
    assert.match(registry, /Enrol a new student/);
    assert.match(registry, /Former students/);
    // Every class card and class drawer enrols straight into that class.
    assert.match(registry, /data-secretary-enrol-in/);
    assert.match(console, /data-secretary-enrol-in/);
    assert.match(console, /openStudentWizard\(\{\s*classId/);
    assert.match(year, /openStudentWizard/);
    assert.match(year, /refreshStudentWizardIfOpen/);
    assert.match(wizard, /New student/);
    assert.match(wizard, /createdBy: owner/);
    assert.match(wizard, /class-desk-step/);
    assert.doesNotMatch(wizard, /STEPS\.REVIEW/);
    // A missing class is opened on the way, then the student desk comes back with it.
    assert.match(wizard, /data-student-desk-new-class/);
    assert.match(wizard, /onCreated: \(classId\) => openStudentWizard/);
    assert.match(classWizard, /onClassCreated/);
    assert.match(classWizard, /data-class-desk-enrol/);
    assert.match(classWizard, /STEPS\.CREATED/);
    assert.doesNotMatch(wizard, /<select/);
    assert.doesNotMatch(wizard, /currentUserId/);
    assert.match(css, /\.office-desks__link/);
});

test('Office searches swap only their results, never the whole tab', () => {
    const console = read('features/secretaryConsole.js');
    const start = console.indexOf("addEventListener('input'");
    const handler = console.slice(start, console.indexOf('export { GRADES_PAGE_SIZE }'));
    for (const id of ['secretary-registry-search', 'secretary-class-filter', 'secretary-student-filter', 'secretary-grades-search']) {
        const block = handler.slice(handler.indexOf(id), handler.indexOf('return;', handler.indexOf(id)));
        assert.match(block, /refreshSecretarySearch\(/, `${id} should refresh live regions`);
        assert.doesNotMatch(block, /renderSecretaryTab\(/, `${id} should not rebuild the tab`);
    }
    assert.match(read('features/secretary/registry.js'), /data-secretary-live="registry-results"/);
    assert.match(read('features/secretary/school.js'), /data-secretary-live="school-students"/);
    assert.match(read('features/secretary/gradesBoard.js'), /data-secretary-live="grades-results"/);
});

test('the class desk opens at once and never waits on the teacher list', () => {
    const wizard = read('features/classWizard.js').replace(/\r\n/g, '\n');
    const open = wizard.slice(wizard.indexOf('export async function openClassWizard'), wizard.indexOf('export function closeClassWizard'));
    const modalOpens = open.indexOf('openOfficeModal(modal)');
    const awaitsTeachers = open.indexOf('await loadingTeachers');
    assert.ok(modalOpens > 0 && awaitsTeachers > modalOpens, 'the modal must open before the teacher list is awaited');
    assert.doesNotMatch(open.slice(0, modalOpens), /await /);
    assert.match(wizard, /TEACHER_LIST_TIMEOUT_MS/);
    assert.match(wizard, /listSchoolTeachers\(\)/);
});

test('Secretary Office desks report a failed open instead of doing nothing', () => {
    const office = read('features/secretaryConsole.js');
    assert.match(office, /function openOfficeDesk\(load, open\)/);
    assert.match(office, /\.catch\(\(error\) => \{[\s\S]*?showToast\('That window could not open/);
    // Any remaining direct desk import must carry its own catch on the same line.
    for (const line of office.split(/\r?\n/).filter((text) => /import\('\.\/(classWizard|studentWizard|placementWizard)\.js'\)\.then/.test(text))) {
        assert.match(line, /\.catch\(/, line.trim());
    }
});

test('the teacher list for the class desk is school-scoped on the server', () => {
    const functions = read('functions/index.js');
    assert.match(functions, /exports\.listSchoolTeachers = callable/);
    assert.match(functions, /requireCanonicalSecretaryCaller\(await requireAuthedCaller\(request\)\)/);
    assert.match(functions, /resolveProfileSchoolId\(profileDoc\.data\(\)\) === schoolId/);
});
