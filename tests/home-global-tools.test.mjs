import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeGlobalTools, getHomeClassActions, HOME_GLOBAL_TOOL_LIMIT } from '../features/homeGlobalTools.mjs';

const all = () => true;
const none = () => false;

// Bottom nav tabs and the header gear are one click away, so Home must not repeat them.
const ONE_CLICK_ELSEWHERE = ['open-settings', 'open-my-classes'];

test('full plan shows eight tools led by today’s plan, none duplicating one-click navigation', () => {
    const tools = getHomeGlobalTools({ canUseFeature: all, myLessonsToday: 3, myClassCount: 5 });
    assert.equal(tools.length, HOME_GLOBAL_TOOL_LIMIT);
    assert.deepEqual(tools.map(t => t.id), ['plan-today', 'new-class', 'team-maker', 'fair-picker', 'quiz', 'family', 'hero-archive', 'team-archive']);
    assert.ok(tools.every(t => !ONE_CLICK_ELSEWHERE.includes(t.action) && !t.tab));
    assert.equal(tools[0].hint, '3 lessons today');
    assert.equal(tools[1].hint, 'You run 5 classes');
    assert.ok(tools.every(t => !('flag' in t)));
});

test('hints read naturally for one and for none', () => {
    const [plan, create] = getHomeGlobalTools({ canUseFeature: all, myLessonsToday: 1, myClassCount: 1 });
    assert.equal(plan.hint, '1 lesson today');
    assert.equal(create.hint, 'You run 1 class');
    const [plan0, create0] = getHomeGlobalTools({ canUseFeature: all });
    assert.equal(plan0.hint, 'No lessons today');
    assert.equal(create0.hint, 'Start your first class');
});

test('gated tools drop out and settings shortcuts fill the space', () => {
    const tools = getHomeGlobalTools({ canUseFeature: none, myClassCount: 2 });
    assert.deepEqual(tools.map(t => t.id), ['new-class', 'team-maker', 'fair-picker', 'hero-archive', 'team-archive', 'student-fixes', 'last-lessons']);
    assert.equal(tools.find(t => t.id === 'student-fixes').subtab, 'manage');
    assert.equal(tools.find(t => t.id === 'last-lessons').subtab, 'planning');
});

test('class actions skip bottom-nav tabs and carry the class id', () => {
    const tools = getHomeClassActions({ classId: 'c1', heroCount: 12, absentToday: 2 });
    assert.deepEqual(tools.map(t => t.id), ['roll-call', 'team-maker', 'fair-picker', 'roster', 'report', 'edit', 'prodigies']);
    assert.ok(tools.every(t => t.classId === 'c1' && !t.tab));
    assert.equal(tools[0].hint, '2 away today');
    assert.equal(tools[1].hint, 'Split 10 into teams');
    assert.equal(tools[2].hint, 'Everyone gets a turn');
    assert.equal(tools[3].hint, '12 heroes');
    assert.equal(getHomeClassActions({ classId: 'c1', absentToday: 1 })[0].hint, '1 away today');
    assert.equal(getHomeClassActions({ classId: 'c1' })[0].hint, 'Mark who is away');
});

test('Teacher Boon leads during its window and says who received it', () => {
    const open = getHomeClassActions({ classId: 'c1', boonWindow: true });
    assert.equal(open[0].id, 'teacher-boon');
    assert.equal(open[0].hint, 'Open this week');
    assert.equal(open.length, HOME_GLOBAL_TOOL_LIMIT);
    const given = getHomeClassActions({ classId: 'c1', boonWindow: true, boonGivenTo: 'Maria' });
    assert.equal(given[0].hint, 'Given to Maria');
});

test('Team Maker and Fair Picker hints follow today\'s teams and the turn round', () => {
    const tools = getHomeClassActions({ classId: 'c1', heroCount: 12, teamsToday: 4, waitingTurns: 5, fairRoundStarted: true });
    assert.equal(tools.find(t => t.id === 'team-maker').hint, '4 teams today');
    assert.equal(tools.find(t => t.id === 'fair-picker').hint, '5 still waiting');
    const global = getHomeGlobalTools({ canUseFeature: all, myClassCount: 2, lessonClassName: 'Owls' });
    assert.equal(global.find(t => t.id === 'team-maker').hint, 'Teams for Owls');
    assert.ok(!getHomeGlobalTools({ canUseFeature: all, myClassCount: 0 }).some(t => t.id === 'team-maker'));
});
