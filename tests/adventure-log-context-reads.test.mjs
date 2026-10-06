import test from 'node:test';
import { dataPath } from '../utils/tenant.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAdventureLogContext, adventureDateKey } from '../features/adventureLogContextCore.mjs';
import { collectLearnedToday } from '../features/learnedTodayCore.mjs';
import { QUEST_TYPE_LABELS, normalizeQuestType } from '../features/specialQuestEngine.js';

const ROOT = 'artifacts/great-class-quest/public/data/';
const row = fields => ({ classId: 'class-1', schoolYearKey: '2026-2027', ...fields });
function harness({ unavailable = '', owner = 'teacher', changeYear = false } = {}) {
    const calls = [], values = { currentUserId: 'teacher', allStudents: [], allStudentScores: [], allTeachersClasses: [] };
    let year = '2026-2027';
    const data = {
        [ROOT + 'classes/class-1']: { id: 'class-1', name: 'Lanterns', questLevel: 'C', createdBy: { uid: owner } },
        [ROOT + 'school_settings/holidays']: { ranges: [{ name: 'Autumn day', start: '2026-10-03', end: '2026-10-03' }] },
        [ROOT + 'students']: [row({ id: 'a', name: 'Anna' })],
        [ROOT + 'written_scores']: [row({ studentId: 'a', date: '02-10-2026', type: 'dictation', title: 'Weather words' })],
        [ROOT + 'story_data/class-1/story_history']: [{ createdAt: new Date(2026, 9, 2, 14), word: 'river', sentence: 'Our river sparkles.' }]
    };
    const modules = { './worldMap.js': { getClassQuestProgressData: () => ({ pct: 40 }) }, './guilds.js': { GUILDS: {} }, './heroSkillTree.js': { getActiveSkills: () => [], getHeroTitle: () => '' }, './bookAtlas.data.mjs': { BOOK_ATLAS: [] }, '../utils/shopCalendar.js': { getActiveFestival: () => null }, './liveWeather.js': { getCachedWeather: () => null }, './weatherTheme.js': { resolveWeatherTheme: () => ({}) } };
    const snapshot = (value, id = '') => ({ id, exists: () => Boolean(value), data: () => value });
    const deps = {
        dataPath, db: {}, doc: (_, path, id) => path + '/' + id, collection: (_, path) => path, query: (path, ...constraints) => ({ path, constraints }), where: (key, operator, value) => ({ key, operator, value }),
        getDoc: async path => { calls.push(path); return snapshot(data[path], path.split('/').at(-1)); },
        getDocs: async q => {
            calls.push(q.path);
            if (q.path.endsWith(unavailable) && unavailable) throw new Error('Offline');
            if (changeYear) year = '2027-2028';
            const rows = (data[q.path] || []).filter(r => q.constraints.every(c => c.operator === '==' ? r[c.key] === c.value : c.operator === 'in' ? c.value.includes(r[c.key]) : c.operator === '>=' ? r[c.key] >= c.value : r[c.key] < c.value));
            return { docs: rows.map((r, i) => snapshot(r, r.id || String(i))) };
        },
        state: { get: key => values[key], getActiveSchoolYearKey: () => year },
        getDDMMYYYY: d => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`, getNextLessonDate: () => null, getLeagueAiAudience: () => '10-12 year olds',
        buildAdventureLogContext, adventureDateKey, collectLearnedToday, QUEST_TYPE_LABELS, normalizeQuestType, getISOWeekKey: () => '2026-W40', modules,
        console: { warn() {} }
    };
    const source = fs.readFileSync(new URL('../features/adventureLogContext.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, '').replace(/import\('([^']+)'\)/g, (_, path) => `Promise.resolve(modules[${JSON.stringify(path)}])`);
    const gather = new Function(...Object.keys(deps), source + '\nreturn gatherAdventureLogContext;')(...Object.values(deps));
    return { gather, calls };
}

test('collects assessment and story sources even when no tab has populated live state', async () => {
    const h = harness();
    const result = await h.gather('class-1', { date: '02-10-2026' });
    assert.equal(result.context.sections.assessments.items[0].kind, 'Dictation');
    assert.equal(result.context.sections.stories.items[0].sentence, 'Our river sparkles.');
    assert.deepEqual(result.context.sections.upcoming.items.map(i => [i.kind, i.date]), [['School holiday', '2026-10-03']]);
    assert.equal(result.context.audience, '10-12 year olds');
    assert.match(result.learnedToday.summary, /Weather words/);
    for (const source of ['quiz_of_the_week', 'quest_event_runs', 'fortune_wheel_log', 'quest_bounties', 'ceremony_snapshots', 'ember_oaths', 'completed_stories', 'adventure_logs']) assert.ok(h.calls.includes(ROOT + source), source);
    assert.ok(h.calls.includes(ROOT + 'campfire_sessions/class-1_2026-10-02'));
});

test('an unavailable source is marked unknown and does not erase the other collected facts', async () => {
    const h = harness({ unavailable: 'written_scores' });
    const result = await h.gather('class-1', { date: '02-10-2026' });
    assert.equal(result.context.sourceHealth.trials, 'cached');
    assert.equal(result.context.sections.assessments.items.length, 0);
    assert.equal(result.context.sections.stories.items.length, 1);
});

test('rejects a class belonging to another teacher and a school-year switch during collection', async () => {
    await assert.rejects(harness({ owner: 'other' }).gather('class-1', { date: '02-10-2026' }), /your classes/);
    await assert.rejects(harness({ changeYear: true }).gather('class-1', { date: '02-10-2026' }), /school year changed/);
});
