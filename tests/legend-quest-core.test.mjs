import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGEND_QUESTS, LEGEND_QUEST_STEPS, getLegendQuest, legendQuestState, addLegendStep, removeLatestLegendStep, isLegendHero } from '../features/legendQuestCore.mjs';
import { HERO_SKILL_TREE } from '../features/heroSkillTree.js';

test('every hero class has a Legend Quest, the old Weaver name included', () => {
    for (const cls of Object.keys(HERO_SKILL_TREE)) assert.ok(LEGEND_QUESTS[cls], cls);
    assert.equal(getLegendQuest('Weaver'), LEGEND_QUESTS.Vanguard);
});

test('the quest stays sealed until the path is complete', () => {
    assert.equal(legendQuestState({ heroClass: 'Patron', pathComplete: false, todayKey: '2026-10-04' }).status, 'locked');
    const open = legendQuestState({ heroClass: 'Patron', pathComplete: true, todayKey: '2026-10-04' });
    assert.equal(open.status, 'open');
    assert.equal(open.canMark, true);
});

test('one step per lesson day, fulfilled after three', () => {
    let lq = null;
    for (const [i, day] of ['2026-10-04', '2026-10-04', '2026-10-06', '2026-10-08'].entries()) {
        const r = addLegendStep({ heroClass: 'Guardian', legendQuest: lq, todayKey: day, nowIso: '2026-10-08T09:00:00Z' });
        if (i === 1) assert.equal(r.changed, false);
        lq = r.record;
    }
    assert.equal(lq.steps.length, LEGEND_QUEST_STEPS);
    assert.equal(lq.completedAt, '2026-10-08T09:00:00Z');
    assert.equal(isLegendHero('Guardian', lq), true);
    assert.equal(removeLatestLegendStep({ heroClass: 'Guardian', legendQuest: lq }).changed, false);
    assert.equal(legendQuestState({ heroClass: 'Guardian', pathComplete: true, legendQuest: lq }).status, 'legend');
});

test('a legend belongs to the class it was earned in', () => {
    const lq = { heroClass: 'Sage', steps: ['2026-10-01', '2026-10-02', '2026-10-03'], completedAt: '2026-10-03T10:00:00Z' };
    assert.equal(isLegendHero('Sage', lq), true);
    assert.equal(isLegendHero('Paladin', lq), false);
    assert.equal(isLegendHero('Vanguard', { ...lq, heroClass: 'Weaver' }), true);
});

test('undo takes back the newest step', () => {
    const lq = { heroClass: 'Nomad', steps: ['2026-10-01', '2026-10-02'], completedAt: null };
    assert.deepEqual(removeLatestLegendStep({ heroClass: 'Nomad', legendQuest: lq }).record.steps, ['2026-10-01']);
});
