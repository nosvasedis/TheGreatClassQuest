const test = require('node:test');
const assert = require('node:assert/strict');

test('first Hero Class pick is allowed and does not lock', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const result = resolveHeroClassChange({ heroClass: '', isHeroClassLocked: false }, 'Guardian');
    assert.equal(result.allowed, true);
    assert.equal(result.isNowLocked, false);
});

test('saving the same Hero Class stays allowed and keeps lock state', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const unlocked = resolveHeroClassChange({ heroClass: 'Sage', isHeroClassLocked: false }, 'Sage');
    assert.equal(unlocked.allowed, true);
    assert.equal(unlocked.isNowLocked, false);

    const locked = resolveHeroClassChange({ heroClass: 'Sage', isHeroClassLocked: true }, 'Sage');
    assert.equal(locked.allowed, true);
    assert.equal(locked.isNowLocked, true);
});

test('the first class change does not lock and the second change does', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const first = resolveHeroClassChange({ heroClass: 'Guardian', isHeroClassLocked: false, heroClassChangeCount: 0 }, 'Paladin', '2026-2027');
    assert.equal(first.allowed, true);
    assert.equal(first.isNowLocked, false);
    assert.equal(first.heroClassChangeCount, 1);
    assert.equal(first.heroClassLockYearKey, '2026-2027');

    const second = resolveHeroClassChange({
        heroClass: 'Paladin',
        isHeroClassLocked: false,
        heroClassChangeCount: 1,
        heroClassLockYearKey: '2026-2027'
    }, 'Sage', '2026-2027');
    assert.equal(second.allowed, true);
    assert.equal(second.isNowLocked, true);
    assert.equal(second.heroClassChangeCount, 2);
});

test('a locked Hero Class cannot change to another class', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const result = resolveHeroClassChange({ heroClass: 'Weaver', isHeroClassLocked: true }, 'Nomad');
    assert.equal(result.allowed, false);
    assert.equal(result.isNowLocked, true);
});

test('saving No Class does not lock and is allowed while unlocked', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const result = resolveHeroClassChange({ heroClass: 'Artificer', isHeroClassLocked: false }, '');
    assert.equal(result.allowed, true);
    assert.equal(result.isNowLocked, false);
});

test('a new school year keeps the Hero Class and restores two changes', async () => {
    const { resolveHeroClassChange, heroClassLockApplies, heroClassChangesRemaining } = await import('../features/heroClasses.js');
    const carried = {
        heroClass: 'Guardian',
        isHeroClassLocked: true,
        heroClassChangeCount: 2,
        heroClassLockYearKey: '2025-2026'
    };
    assert.equal(heroClassLockApplies(carried, '2026-2027'), false);
    assert.equal(heroClassChangesRemaining(carried, '2026-2027'), 2);
    assert.equal(carried.heroClass, 'Guardian');

    const firstChange = resolveHeroClassChange(carried, 'Paladin', '2026-2027');
    assert.equal(firstChange.allowed, true);
    assert.equal(firstChange.isNowLocked, false);
    assert.equal(firstChange.heroClassChangeCount, 1);

    const secondChange = resolveHeroClassChange({
        heroClass: 'Paladin',
        isHeroClassLocked: false,
        heroClassChangeCount: 1,
        heroClassLockYearKey: '2026-2027'
    }, 'Sage', '2026-2027');
    assert.equal(secondChange.allowed, true);
    assert.equal(secondChange.isNowLocked, true);
    assert.equal(secondChange.heroClassChangeCount, 2);

    const thirdChange = resolveHeroClassChange({
        heroClass: 'Sage',
        isHeroClassLocked: true,
        heroClassChangeCount: 2,
        heroClassLockYearKey: '2026-2027'
    }, 'Nomad', '2026-2027');
    assert.equal(thirdChange.allowed, false);
});

test('a lock with no school year does not carry into the active year', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const legacy = { heroClass: 'Weaver', isHeroClassLocked: true };
    const result = resolveHeroClassChange(legacy, 'Nomad', '2026-2027');
    assert.equal(result.allowed, true);
    assert.equal(result.isNowLocked, false);
    assert.equal(result.heroClassChangeCount, 1);
    assert.equal(result.heroClassLockYearKey, '2026-2027');
});

test('Hero Class themes use Skill Tree aura colors', async () => {
    const { HERO_CLASSES } = await import('../features/heroClasses.js');
    const { HERO_SKILL_TREE } = await import('../features/heroSkillTree.js');

    for (const name of Object.keys(HERO_CLASSES)) {
        assert.equal(HERO_CLASSES[name].theme.accent, HERO_SKILL_TREE[name].auraColor);
        assert.match(HERO_CLASSES[name].theme.rgb, /^\d+, \d+, \d+$/);
    }
});
