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

test('changing to a different Hero Class after having one locks the path', async () => {
    const { resolveHeroClassChange } = await import('../features/heroClasses.js');
    const result = resolveHeroClassChange({ heroClass: 'Guardian', isHeroClassLocked: false }, 'Paladin');
    assert.equal(result.allowed, true);
    assert.equal(result.isNowLocked, true);
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

test('Hero Class themes use Skill Tree aura colors', async () => {
    const { HERO_CLASSES } = await import('../features/heroClasses.js');
    const { HERO_SKILL_TREE } = await import('../features/heroSkillTree.js');

    for (const name of Object.keys(HERO_CLASSES)) {
        assert.equal(HERO_CLASSES[name].theme.accent, HERO_SKILL_TREE[name].auraColor);
        assert.match(HERO_CLASSES[name].theme.rgb, /^\d+, \d+, \d+$/);
    }
});
