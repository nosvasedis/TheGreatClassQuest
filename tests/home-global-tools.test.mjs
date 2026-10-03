import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeGlobalTools, HOME_GLOBAL_TOOL_LIMIT } from '../features/homeGlobalTools.mjs';

const all = () => true;
const none = () => false;

// Bottom nav tabs and the header gear are one click away, so Home must not repeat them.
const ONE_CLICK_ELSEWHERE = ['open-settings', 'open-my-classes'];

test('full plan shows six tools led by today’s plan, none duplicating one-click navigation', () => {
    const tools = getHomeGlobalTools({ canUseFeature: all, myLessonsToday: 3, myClassCount: 5 });
    assert.equal(tools.length, HOME_GLOBAL_TOOL_LIMIT);
    assert.deepEqual(tools.map(t => t.id), ['plan-today', 'new-class', 'quiz', 'family', 'hero-archive', 'team-archive']);
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
    assert.deepEqual(tools.map(t => t.id), ['new-class', 'hero-archive', 'team-archive', 'student-fixes', 'last-lessons']);
    assert.equal(tools.find(t => t.id === 'student-fixes').subtab, 'manage');
    assert.equal(tools.find(t => t.id === 'last-lessons').subtab, 'planning');
});
