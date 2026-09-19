import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const maria = { uid: 'teacher-maria', name: 'Maria' };
const eleni = { uid: 'teacher-eleni', name: 'Eleni' };
const nikos = { uid: 'teacher-nikos', name: 'Nikos' };

function pending(partial) {
    return { enrollmentStatus: 'pendingPlacement', ...partial };
}

test('groupPendingStudents buckets by previous class, league, and A–Z with unknowns last', async () => {
    const {
        groupPendingStudents,
        PLACEMENT_GROUP_MODES
    } = await import('../utils/returningStudents.js');

    const students = [
        pending({
            id: '1',
            name: 'Zoe',
            previousClassId: 'stars',
            previousClassName: 'Stars',
            previousQuestLevel: 'Junior A',
            previousTeacher: maria
        }),
        pending({
            id: '2',
            name: 'Alex',
            previousClassId: 'stars',
            previousClassName: 'Stars',
            previousQuestLevel: 'Junior A',
            previousTeacher: maria
        }),
        pending({
            id: '3',
            name: 'Ben',
            previousClassId: 'rockets',
            previousClassName: 'Rockets',
            previousQuestLevel: 'A',
            previousTeacher: nikos
        }),
        pending({ id: '4', name: 'No History' }),
        pending({ id: '5', name: '9 Odd' }),
        { id: 'placed', name: 'Already seated', enrollmentStatus: 'active', classId: 'new-b' }
    ];

    const byClass = groupPendingStudents(students, PLACEMENT_GROUP_MODES.CLASS);
    assert.deepEqual(byClass.map((group) => group.title), ['Rockets', 'Stars', 'Previous class unknown']);
    assert.equal(byClass.find((group) => group.key === 'classid:stars').students.length, 2);
    assert.equal(byClass.at(-1).unknown, true);
    assert.match(byClass.find((group) => group.title === 'Stars').subtitle, /natural next: Junior B/);

    const byLeague = groupPendingStudents(students, PLACEMENT_GROUP_MODES.LEAGUE);
    assert.deepEqual(byLeague.map((group) => group.title), ['Junior A', 'A', 'League not recorded']);
    assert.equal(byLeague[0].naturalNextLeague, 'Junior B');

    const byAlpha = groupPendingStudents(students, PLACEMENT_GROUP_MODES.ALPHA);
    assert.deepEqual(byAlpha.map((group) => group.title), ['A', 'B', 'N', 'Z', '#']);
    assert.equal(byAlpha.find((group) => group.title === 'A').students.map((s) => s.name).join(','), 'Alex');
    assert.equal(byAlpha.at(-1).title, '#');

    const searched = groupPendingStudents(students, PLACEMENT_GROUP_MODES.CLASS, 'maria');
    assert.equal(searched.length, 1);
    assert.equal(searched[0].title, 'Stars');
});

test('suggestDestinationClasses prefers next league, then same teacher, then smaller roster, then name', async () => {
    const { suggestDestinationClasses, suggestClassesForStudent } = await import('../utils/returningStudents.js');

    const juniorBMaria = {
        id: 'jb-maria',
        name: 'Dawn',
        questLevel: 'Junior B',
        createdBy: maria,
        status: 'active'
    };
    const juniorBEleni = {
        id: 'jb-eleni',
        name: 'Horizon',
        questLevel: 'Junior B',
        createdBy: eleni,
        status: 'active'
    };
    const juniorBNikosSmall = {
        id: 'jb-nikos',
        name: 'Comet',
        questLevel: 'Junior B',
        createdBy: nikos,
        status: 'active'
    };
    const juniorAStay = {
        id: 'ja-stay',
        name: 'Stay',
        questLevel: 'Junior A',
        createdBy: maria,
        status: 'active'
    };
    const archived = {
        id: 'archived',
        name: 'Old',
        questLevel: 'Junior B',
        createdBy: maria,
        status: 'archived'
    };

    const cohort = {
        previousLeague: 'Junior A',
        previousTeacher: maria,
        previousClassName: 'Stars',
        students: [
            pending({
                id: '1',
                name: 'Alex',
                previousQuestLevel: 'Junior A',
                previousTeacher: maria
            })
        ]
    };

    const nextLeague = suggestDestinationClasses(cohort, [
        juniorBEleni,
        juniorBMaria,
        juniorAStay,
        archived
    ], { perspective: 'secretary', rosterCounts: { 'jb-maria': 8, 'jb-eleni': 3, 'ja-stay': 1 } });

    assert.equal(nextLeague[0].classData.id, 'jb-maria');
    assert.equal(nextLeague[0].isBest, true);
    assert.equal(nextLeague[0].score, 115);
    assert.match(nextLeague[0].reason, /Natural step up from Junior A/);
    assert.match(nextLeague[0].reason, /same teacher as last year \(Maria\)/);
    assert.equal(nextLeague.some((entry) => entry.classData.id === 'archived'), false);

    const twoNextLeague = suggestDestinationClasses({
        previousLeague: 'Junior A',
        previousTeacher: { uid: 'someone-else', name: 'Other' },
        students: cohort.students
    }, [juniorBEleni, juniorBNikosSmall], {
        perspective: 'secretary',
        rosterCounts: { 'jb-eleni': 12, 'jb-nikos': 4 }
    });
    assert.equal(twoNextLeague[0].classData.id, 'jb-nikos');
    assert.equal(twoNextLeague[0].score, 100);

    const byName = suggestDestinationClasses({
        previousLeague: 'Junior A',
        students: cohort.students
    }, [juniorBEleni, juniorBNikosSmall], {
        perspective: 'secretary',
        rosterCounts: { 'jb-eleni': 4, 'jb-nikos': 4 }
    });
    assert.equal(byName[0].classData.id, 'jb-nikos');
    assert.equal(byName[0].classData.name, 'Comet');

    const sameLeagueFallback = suggestDestinationClasses({
        previousLeague: 'Junior A',
        students: [
            pending({
                id: 'repeat',
                name: 'Sam',
                previousQuestLevel: 'Junior A',
                previousTeacher: nikos
            })
        ]
    }, [juniorAStay], { perspective: 'secretary' });
    assert.equal(sameLeagueFallback[0].classData.id, 'ja-stay');
    assert.equal(sameLeagueFallback[0].score, 60);
    assert.match(sameLeagueFallback[0].reason, /Same league as last year/);

    const perStudent = suggestClassesForStudent(cohort.students[0], [juniorBEleni, juniorBMaria], {
        perspective: 'secretary',
        rosterCounts: { 'jb-maria': 2, 'jb-eleni': 2 }
    });
    assert.equal(perStudent[0].classData.id, 'jb-maria');
    assert.equal(perStudent[0].isBest, true);
});

test('secretary September placement wizard never dumps guild IDs or a class select', () => {
    const year = read('features/schoolYearConsole.js');
    const wizard = read('features/placementWizard.js');
    const css = read('styles/roles.css');

    assert.doesNotMatch(year, /school-year-allocation-class/);
    assert.doesNotMatch(year, /school-year-student-check/);
    assert.doesNotMatch(year, /student\.guildId \|\| 'No guild yet'/);
    assert.doesNotMatch(year, /Name • League • Teacher|questLevel \|\| 'League'/);
    assert.match(year, /renderPlacementLauncher/);
    assert.match(year, /openPlacementWizard/);

    assert.match(wizard, /getGuildHouseDisplay/);
    assert.match(wizard, /getGuildBadgeHtml/);
    assert.match(wizard, /renderLeagueChip/);
    assert.doesNotMatch(wizard, /<select/);
    assert.doesNotMatch(wizard, /Guild: \$\{/);
    assert.doesNotMatch(wizard, /student\.guildId \|\|/);
    assert.match(wizard, /Gather the heroes/);
    assert.match(wizard, /Seat/);

    assert.match(css, /\.placement-wizard/);
    assert.match(css, /\.placement-league-chip/);
    assert.match(css, /\.placement-wizard--sheet/);
});
