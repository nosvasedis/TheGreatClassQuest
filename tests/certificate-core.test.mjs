import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCertificateModel, buildCertificatePrompt, certificateBand, cleanCitation,
    leadingVirtue, renderCertificateInner, scopeStars, toMonthKey,
} from '../features/certificateCore.mjs';
import { HERO_CLASSES } from '../features/heroClasses.js';
import { HERO_SKILL_TREE } from '../features/heroSkillTree.js';
import { GUILDS } from '../features/guilds.js';

const now = new Date(2026, 8, 28); // 28 Sep 2026
const student = { id: 's1', name: 'Mira Solano', heroClass: 'Guardian', guildId: 'dragon_flame' };
const studentClass = { name: 'Dragon Riders', logo: '🐉', questLevel: 'Junior B' };
const log = (reason, stars, date) => ({ studentId: 's1', reason, stars, date });

function model(overrides = {}) {
    return buildCertificateModel({
        scope: 'monthly', now, student, studentClass, ageCategory: 'junior',
        scoreData: { monthlyStars: 9, totalStars: 118, heroLevel: 2, heroSkills: ['guardian_1a'], lastMonthlyResetDate: '2026-09-01' },
        awardLogs: [
            log('respect', 3, '03-09-2026'), log('respect', 3, '20-09-2026'), log('teamwork', 1, '15-09-2026'),
            ...Array.from({ length: 10 }, (_, i) => log('creativity', 3, `${String(i + 1).padStart(2, '0')}-08-2026`)),
        ],
        writtenScores: [
            { studentId: 's1', date: '10-09-2026', scoreNumeric: 18, maxScore: 20 },
            { studentId: 's1', date: '10-08-2026', scoreNumeric: 20, maxScore: 20, note: 'last month' },
        ],
        guild: GUILDS.dragon_flame, heroDef: HERO_CLASSES.Guardian, heroTree: HERO_SKILL_TREE.Guardian,
        teacherName: 'Ms. Vasquez', schoolName: 'Oakwood',
        ...overrides,
    });
}

test('toMonthKey reads every stored date shape', () => {
    assert.equal(toMonthKey('03-09-2026'), '2026-09');
    assert.equal(toMonthKey('3/9/2026'), '2026-09');
    assert.equal(toMonthKey('2026-09-03'), '2026-09');
    assert.equal(toMonthKey({ seconds: Date.UTC(2026, 8, 15) / 1000 }), '2026-09');
    assert.equal(toMonthKey('nonsense'), '');
});

test('monthly certificate only counts this month (not last month\'s virtue or trial)', () => {
    const m = model();
    assert.equal(m.virtue.key, 'respect');
    assert.equal(m.topTrial.label, '18/20');
    assert.deepEqual(m.trialNotes, []);
    assert.equal(m.stars, 9);
    assert.equal(m.periodLabel, 'September 2026');
});

test('legend\'s journey counts the whole year', () => {
    const m = model({ scope: 'alltime', prodigyWins: 2, schoolYearLabel: '2026–27' });
    assert.equal(m.virtue.key, 'creativity');
    assert.equal(m.topTrial.label, '20/20');
    assert.equal(m.stars, 118);
    assert.equal(m.periodLabel, 'School Year 2026–27');
    assert.ok(m.honours.some((h) => h.key === 'prodigy' && h.value === 'Crowned ×2'));
});

test('stale monthly score doc falls back to this month\'s logs', () => {
    const stars = scopeStars({ scope: 'monthly', now, scoreData: { monthlyStars: 40, lastMonthlyResetDate: '2026-08-01' },
        scopedLogs: [log('respect', 2, '02-09-2026'), log('focus', 1, '05-09-2026')] });
    assert.equal(stars, 3);
});

test('virtue is weighted by stars and ignores bookkeeping reasons', () => {
    const v = leadingVirtue({ scopedLogs: [log('focus', 1, ''), log('focus', 1, ''), log('respect', 3, ''), log('marked_present', 9, ''), log('respect', -5, '')] });
    assert.equal(v.key, 'respect');
});

test('early leagues get their own band instead of the teen certificate', () => {
    assert.equal(certificateBand('early'), 'early');
    assert.equal(certificateBand(undefined), 'senior');
    const m = model({ ageCategory: 'early' });
    assert.equal(m.title, 'Little Hero of the Month');
    assert.match(buildCertificatePrompt(m).system, /ages 5-7/);
});

test('hero path, skills, familiar, oath and treasures reach the page', () => {
    const m = model({
        scoreData: { monthlyStars: 9, totalStars: 118, heroLevel: 7, heroSkills: ['guardian_1a'], lastMonthlyResetDate: '2026-09-01',
            familiar: { typeId: 'emberfang', name: 'Cinder', state: 'alive', level: 2 },
            inventory: [{ name: 'Star-Ember', acquiredAt: '2026-09-12' }, { name: 'Old', acquiredAt: '2026-05-01' }] },
        familiarTypes: { emberfang: { name: 'Emberfang', levelNames: ['Hatchling', 'Flame Drake', 'Inferno Dragon'] } },
        oaths: [{ studentId: 's1', status: 'kept', text: 'Help a friend', keptAt: { seconds: Date.UTC(2026, 8, 12) / 1000 } },
            { studentId: 's1', status: 'kept', text: 'Last spring promise', keptAt: { seconds: Date.UTC(2026, 3, 1) / 1000 } }],
    });
    assert.equal(m.hero.level, 5, 'level is clamped to the class tree');
    assert.equal(m.hero.title, 'Eternal Guardian');
    assert.deepEqual(m.hero.skills.map((s) => s.name), ['Iron Resolve']);
    assert.equal(m.familiar.stage, 'Flame Drake');
    assert.deepEqual(m.oath, { count: 1, text: 'Help a friend' });
    assert.equal(m.treasures, 1);
    assert.ok(m.honours.length <= 6);
    const prompt = buildCertificatePrompt(m).user;
    assert.match(prompt, /Help a friend/);
    assert.doesNotMatch(prompt, /Last spring promise/, 'only this year’s kept promise is told');
});

test('markup escapes names and keeps the stable element ids', () => {
    const m = model({ student: { ...student, name: '<b>Mira</b>' } });
    const html = renderCertificateInner(m, { citation: 'Well done & brave' });
    assert.doesNotMatch(html, /<b>Mira/);
    assert.match(html, /Well done &amp; brave/);
    for (const id of ['cert-title', 'cert-student-name', 'cert-text', 'cert-avatar', 'cert-guild-emblem', 'cert-teacher-name', 'cert-date', 'cert-app-logo', 'cert-badges']) {
        assert.match(html, new RegExp(`id="${id}"`), id);
    }
});

test('cleanCitation strips markdown, quotes and runaway length', () => {
    assert.equal(cleanCitation('"**You** were _brave_!"'), 'You were brave!');
    const long = cleanCitation('A sentence here. '.repeat(40), 100);
    assert.ok(long.length <= 100 && long.endsWith('.'));
});
