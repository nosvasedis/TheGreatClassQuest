import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('the passport switches to an office desk inside the Secretary Office', () => {
    const modal = read('ui/modals/student.js');
    const template = read('templates/modals/student.js');
    assert.match(modal, /isSecretaryOfficeActive\(\)/);
    assert.match(modal, /dataset\.passportMode = officeMode \? 'office' : 'teacher'/);
    for (const id of ['edit-student-office-notes-btn', 'edit-student-office-move-btn', 'edit-student-office-grades-btn', 'edit-student-office-leave-btn']) {
        assert.match(template, new RegExp(`id="${id}"`));
        assert.match(modal, new RegExp(`getElementById\\('${id}'\\)`));
    }
    // Classroom-only tools are marked so the office never sees them.
    assert.match(template, /id="edit-student-quick-guild-btn" data-teacher-only/);
    assert.match(template, /id="edit-student-open-avatar-btn" data-teacher-only/);
    assert.match(template, /class="sp-visa__actions" data-teacher-only/);
    assert.match(read('styles/student_profile.css'), /\[data-passport-mode="office"\] \[data-teacher-only\]/);
});

test('office Move opens the office class dialog and seats waiting students properly', () => {
    const modal = read('ui/modals/student.js');
    const desk = read('features/secretary/studentDesk.js');
    assert.match(modal, /openStudentMove\(studentId\)/);
    assert.match(desk, /enrollmentStatus === 'pendingPlacement'[\s\S]*allocateReturningStudents\(\{ classId: target\.id, studentIds: \[student\.id\] \}\)/);
    assert.match(desk, /transferStudentToClass\(\{ studentId: student\.id, classId: target\.id \}\)/);
    assert.match(desk, /showUndoBar\(/);
});

test('office Notes keep their own file and never open the classroom chronicle', () => {
    const consoleSrc = read('features/secretaryConsole.js');
    const school = read('features/secretary/school.js');
    const notes = read('db/actions/officeNotes.js');
    assert.doesNotMatch(consoleSrc, /openHeroChronicleModal/);
    assert.match(consoleSrc, /data-secretary-notes/);
    assert.match(school, /data-secretary-notes=/);
    assert.match(notes, /authorRole: 'office'/);
    assert.match(read('state.js'), /_notify\("allHeroChronicleNotes"\)/);
});

test('guilds are for life: a sorted student is never sorted again', () => {
    const modal = read('ui/modals/student.js');
    assert.match(modal, /quickGuildBtn\.classList\.toggle\('hidden', officeMode \|\| guildHouse\.assigned\)/);
    assert.match(read('ui/modals/sortingQuiz.js'), /Guilds are for life/);
    assert.match(read('ui/modals/sortingCeremony.js'), /if \(student\?\.guildId && getGuildById\(student\.guildId\)\) return;/);
    assert.match(read('db/actions/guilds.js'), /if \(existing\?\.guildId && GUILD_IDS\.includes\(existing\.guildId\)\) return;/);
});
