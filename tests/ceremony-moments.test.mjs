import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthMoments, buildMonthHonours, inMonth, momentDate, isCelebratedSeal } from '../features/ceremonyMomentsCore.mjs';
import { buildCeremonySnapshot } from '../features/ceremonyDomain.js';

const month = '2026-10';
const cls = {
    id: 'c1',
    mapJournal: { '2026-10': { silver: { date: '2026-10-09' }, gold: { date: '2026-10-19' } }, '2026-09': { crystal: { date: '2026-09-28' } } },
    trainingGrounds: {
        hoard: { rounds: 4, log: [{ date: '2026-10-05', ok: true }, { date: '2026-10-05', ok: true }, { date: '2026-10-12', ok: true }, { date: '2026-09-30', ok: true }] },
        map: { rounds: 1, log: [{ date: '2026-10-07', ok: false }] }
    }
};

test('dates from every shape the app stores', () => {
    assert.equal(momentDate('05-10-2026').getMonth(), 9);
    assert.equal(momentDate({ seconds: Date.UTC(2026, 9, 12) / 1000 }).getMonth(), 9);
    assert.equal(momentDate({ toDate: () => new Date(2026, 9, 1) }).getDate(), 1);
    assert.equal(inMonth('2026-10-31', month), true);
    assert.equal(inMonth('2026-11-01', month), false);
    assert.equal(inMonth(null, month), false);
});

test('the chronicle tells only what happened that month, in story order', () => {
    const tiles = buildMonthMoments({
        monthKey: month,
        classData: cls,
        studentIds: ['s1', 's2'],
        logs: [
            { studentId: 's1', reason: 'vanishing_hoard', stars: 0.5 },
            { studentId: 's1', reason: 'scholar_s_bonus', stars: 1 },
            { studentId: 's2', reason: 'scholar_s_bonus', stars: 0.5 },
            { studentId: 'other', reason: 'scholar_s_bonus', stars: 3 }
        ],
        oaths: [
            { classId: 'c1', status: 'kept', keptAt: '2026-10-12T10:00:00Z' },
            { classId: 'c1', status: 'kept', keptAt: '2026-09-12T10:00:00Z' },
            { classId: 'c2', status: 'kept', keptAt: '2026-10-12T10:00:00Z' },
            { classId: 'c1', status: 'active' }
        ],
        bounties: [
            { classId: 'c1', source: 'quiet_dragon', status: 'completed', quietDragon: { minutes: 12 }, claimedAt: { seconds: new Date(2026, 9, 14).getTime() / 1000 } },
            { classId: 'c1', status: 'completed', title: 'Read three stories', claimedAt: '2026-10-20T10:00:00Z' },
            { classId: 'c1', status: 'active', title: 'Not yet' }
        ],
        quizzes: [{ classId: 'c1', completedAt: '2026-10-28T10:00:00Z' }, { classId: 'c1', completedAt: '2026-11-02T10:00:00Z' }],
        scores: [
            { id: 's1', heroSeals: { earned: { four_winds: { date: '2026-10-14' }, hearth_return: { date: '2026-10-16' } } } },
            { id: 's2', heroSeals: { earned: { quill_bright: { date: '2026-10-22' }, open_hand: { date: '2026-10-09', late: true } } } }
        ]
    });
    assert.deepEqual(tiles.map((t) => t.id), ['realms', 'training', 'oaths', 'dragon', 'bounties', 'starfall', 'quiz', 'seals']);
    const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));
    assert.equal(byId.realms.value, 2);
    assert.match(byId.realms.title, /Golden Citadel/);
    assert.equal(byId.training.value, 2, 'one won round per game per day, October only');
    assert.equal(byId.oaths.value, 1);
    assert.equal(byId.dragon.value, 12);
    assert.equal(byId.bounties.value, 1);
    assert.equal(byId.starfall.value, 1.5, 'only this class');
    assert.equal(byId.quiz.value, 1);
    assert.equal(byId.seals.value, 1, 'no absence, academic or late seals');
});

test('a quiet month has no chronicle', () => {
    assert.deepEqual(buildMonthMoments({ monthKey: month, classData: { id: 'c1' }, studentIds: ['s1'] }), []);
    assert.deepEqual(buildMonthMoments({ monthKey: month }), []);
});

test('honours name quiz champions, seal bearers and new legends', () => {
    const students = [{ id: 's1', name: 'Maria' }, { id: 's2', name: 'Nikos' }, { id: 's3', name: 'Eleni' }];
    const { sections } = buildMonthHonours({
        monthKey: month,
        classId: 'c1',
        students,
        scores: [
            { id: 's1', heroSeals: { earned: { four_winds: { date: '2026-10-14' }, oathkeeper: { date: '2026-10-21' } } } },
            { id: 's2', heroSeals: { earned: { hearth_return: { date: '2026-10-16' } } }, legendQuest: { completedAt: '2026-10-21T10:00:00Z' } },
            { id: 's3', legendQuest: { completedAt: '2026-09-21T10:00:00Z' } }
        ],
        quizzes: [
            { classId: 'c1', completedAt: '2026-10-14T10:00:00Z', results: { rewards: { studentRewards: [{ studentId: 's3', top: true }], prize: { studentId: 's3' } } } },
            { classId: 'c1', completedAt: '2026-10-28T10:00:00Z', results: { rewards: { studentRewards: [{ studentId: 's3', top: true }, { studentId: 's2', top: true }] } } },
            { classId: 'c2', completedAt: '2026-10-28T10:00:00Z', results: { rewards: { studentRewards: [{ studentId: 's1', top: true }] } } }
        ]
    });
    assert.deepEqual(sections.map((s) => s.id), ['quiz', 'seals', 'legends']);
    assert.deepEqual(sections[0].heroes.map((h) => [h.id, h.note]), [['s3', 'Top of 2 quizzes'], ['s2', 'Top of the quiz']]);
    assert.deepEqual(sections[1].heroes.map((h) => h.id), ['s1']);
    assert.deepEqual(sections[1].heroes[0].sealIds, ['four_winds', 'oathkeeper']);
    assert.deepEqual(sections[2].heroes.map((h) => h.id), ['s2']);
});

test('seals that speak about absences or marks are never celebrated', () => {
    assert.equal(isCelebratedSeal('hearth_return', {}), false);
    assert.equal(isCelebratedSeal('quill_bright', {}), false);
    assert.equal(isCelebratedSeal('four_winds', { late: true }), false);
    assert.equal(isCelebratedSeal('four_winds', {}), true);
});

test('a garden snapshot keeps the bloom stories it was given, in order', () => {
    const spotlights = [
        { studentId: 'b', studentName: 'B', key: 'rainbow_of_strengths', title: 'Rainbow of Strengths' },
        { studentId: 'a', studentName: 'A', key: 'teamwork', title: 'Teamwork Bloom' }
    ];
    const snap = buildCeremonySnapshot({
        classId: 'c1', questLeague: 'Pre-Junior', monthKey: month,
        classResults: [{ id: 'c1', score: 5 }], studentResults: [{ id: 'a', score: 3 }, { id: 'b', score: 2 }],
        students: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], spotlights
    });
    assert.deepEqual(snap.spotlights.map((s) => s.key), ['rainbow_of_strengths', 'teamwork']);
    assert.deepEqual(snap.publicSequence.parade.map((s) => s.studentId), ['b', 'a']);
});
