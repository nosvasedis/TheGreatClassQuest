import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

function functionSource(name, nextName) {
    return read('functions/index.js').split(`exports.${name}`)[1].split(`exports.${nextName}`)[0];
}

test('the move modal offers another class or the waiting list, each on its own callable', () => {
    const modal = read('ui/modals/moveStudent.js');
    assert.match(modal, /data-ms-route="\$\{ROUTE_CLASS\}"/);
    assert.match(modal, /data-ms-route="\$\{ROUTE_WAITING\}"/);
    assert.match(modal, /releaseStudentToPlacement\(\{ studentId: student\.id \}\)/);
    assert.match(modal, /transferStudentToClass\(\{ studentId: student\.id, classId: target\.id \}\)/);
    // A student already waiting is seated (only in the teacher's own classes) through placement.
    assert.match(modal, /if \(seatOnly\) classes = classes\.filter\(isMine\)/);
    assert.match(modal, /allocateReturningStudents\(\{ classId: target\.id, studentIds: \[student\.id\] \}\)/);
    assert.match(read('utils/adminRuntime.js'), /callAdmin\('releaseStudentToPlacement', payload\)/);
    assert.match(read('templates/modals/student.js'), /id="move-student-modal"[\s\S]*class="ms-card pop-in"/);
    assert.match(read('style.css'), /styles\/move_student\.css/);
});

test('releasing a student puts them in Student placement and keeps where they came from', () => {
    const release = functionSource('releaseStudentToPlacement', 'purgeStudent');
    assert.match(release, /student\.createdBy\?\.uid !== caller\.uid/);
    assert.match(release, /enrollmentStatus: 'pendingPlacement'/);
    assert.match(release, /classId: null/);
    assert.match(release, /previousClassId: student\.classId/);
    assert.match(release, /previousQuestLevel: classData\.questLevel/);
    assert.match(release, /releasedYearKey: yearKey/);
    assert.match(release, /upsertParentSnapshot\(studentId/);
});

test('placement keeps this year\'s progress for a student released earlier the same year', () => {
    const place = functionSource('allocateReturningStudents', 'assignClassTeacher');
    assert.match(place, /releasedThisYear = Boolean\(studentData\.releasedYearKey\) && studentData\.releasedYearKey === yearKey/);
    assert.match(place, /payload: releasedThisYear \? \{/);
    assert.match(place, /releasedYearKey: FieldValue\.delete\(\)/);
    const close = functionSource('closeSchoolYear', 'archiveCarriedYearGold');
    assert.match(close, /releasedYearKey: FieldValue\.delete\(\)/);
    assert.match(close, /previousClassId: student\.classId \|\| student\.previousClassId \|\| null/);
});

test('a student released mid-year is suggested back into the same league, not the next one', async () => {
    const { scoreStudentForClass } = await import('../utils/returningStudents.js');
    const teacher = { uid: 't1', name: 'Maria' };
    const released = {
        enrollmentStatus: 'pendingPlacement',
        previousQuestLevel: 'Junior A',
        previousClassName: 'Foxes',
        previousTeacher: teacher,
        releasedYearKey: '2026-2027'
    };
    const sameLeague = scoreStudentForClass(released, { questLevel: 'Junior A', createdBy: { uid: 't2' } });
    const nextLeague = scoreStudentForClass(released, { questLevel: 'Junior B', createdBy: { uid: 't2' } });
    assert.equal(sameLeague.score, 100);
    assert.match(sameLeague.reason, /Same league as Foxes/);
    assert.ok(nextLeague.score < sameLeague.score);
    const backWithTeacher = scoreStudentForClass(released, { questLevel: 'Junior A', createdBy: teacher });
    assert.match(backWithTeacher.reason, /earlier this year/);

    const september = { ...released, releasedYearKey: undefined };
    assert.equal(scoreStudentForClass(september, { questLevel: 'Junior B', createdBy: { uid: 't2' } }).score, 100);
});
