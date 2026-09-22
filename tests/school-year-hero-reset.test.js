import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

function closeSchoolYearSource() {
    const functions = read('functions/index.js');
    return functions.split('exports.closeSchoolYear')[1].split('exports.archiveCarriedYearGold')[0];
}

function allocateReturningStudentsSource() {
    const functions = read('functions/index.js');
    return functions.split('exports.allocateReturningStudents')[1].split('exports.assignClassTeacher')[0];
}

test('year close deletes leftover hero reason stars instead of merging an empty map', () => {
    const closeFn = closeSchoolYearSource();
    assert.match(closeFn, /starsByReason:\s*FieldValue\.delete\(\)/);
    assert.doesNotMatch(closeFn, /starsByReason:\s*\{\}/);
    assert.match(closeFn, /heroLevel:\s*0/);
    assert.match(closeFn, /heroSkills:\s*\[\]/);
    assert.match(closeFn, /pendingSkillChoice:\s*false/);
    assert.match(closeFn, /lastGuildBonusMonth:\s*FieldValue\.delete\(\)/);
    assert.match(closeFn, /lastPatronPathCreditWeekKey:\s*FieldValue\.delete\(\)/);
    assert.match(closeFn, /heroOfDayWinsAtClose: score\.heroOfDayWins \|\| 0/);
    assert.match(closeFn, /heroOfDayWins:\s*0/);
    assert.match(closeFn, /heroOfDayWinsYearKey:\s*nextYearKey/);
});

test('September placement resets leftover hero progression from the closed year', () => {
    const placeFn = allocateReturningStudentsSource();
    assert.match(placeFn, /heroLevel:\s*0/);
    assert.match(placeFn, /heroSkills:\s*\[\]/);
    assert.match(placeFn, /pendingSkillChoice:\s*false/);
    assert.match(placeFn, /starsByReason:\s*FieldValue\.delete\(\)/);
    assert.match(placeFn, /lastGuildBonusMonth:\s*FieldValue\.delete\(\)/);
    assert.match(placeFn, /lastPatronPathCreditWeekKey:\s*FieldValue\.delete\(\)/);
    assert.match(placeFn, /heroOfDayWins:\s*0/);
    assert.match(placeFn, /heroOfDayWinsYearKey:\s*yearKey/);
});
