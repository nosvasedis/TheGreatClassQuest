import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recipe = await import('../functions/avatarForgeRecipe.mjs');

test('older clients that send only creature, colour and relic still forge with defaults', () => {
    const r = recipe.normalizeForgeRecipe({ creature: 'Wizard', color: 'Purple', accessory: 'Magic Wand' });
    assert.deepEqual(r, {
        creature: 'Wizard', color: 'Purple', accessory: 'Magic Wand',
        mood: 'Happy', style: 'Sticker', backdrop: 'Glow', framing: 'Portrait', special: ''
    });
    assert.equal(recipe.isLegacyForgeRecipe(r), true);
});

test('every original forge option is still accepted', () => {
    const creatures = ['Fairy', 'Wizard', 'Witch', 'Elf', 'Dwarf', 'Goblin', 'Knight', 'Dragon', 'Unicorn', 'Robot', 'Alien', 'Mermaid', 'Gnome', 'Prince', 'Princess', 'Pirate', 'Superhero'];
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Turquoise', 'Black', 'White', 'Grey', 'Rainbow'];
    const accessories = ['None', 'Magic Wand', 'Big Glasses', 'Flower Crown', 'Pointy Hat', 'Shiny Sword', 'Glowing Book', 'Headphones', 'Small Backpack'];
    for (const creature of creatures) assert.ok(recipe.normalizeForgeRecipe({ creature, color: 'Red', accessory: 'None' }));
    for (const color of colors) assert.ok(recipe.normalizeForgeRecipe({ creature: 'Elf', color, accessory: 'None' }));
    for (const accessory of accessories) assert.ok(recipe.normalizeForgeRecipe({ creature: 'Elf', color: 'Red', accessory }));
});

test('unknown choices are rejected by name', () => {
    assert.throws(() => recipe.normalizeForgeRecipe({ creature: 'Zombie', color: 'Red', accessory: 'None' }), recipe.ForgeRecipeError);
    assert.throws(() => recipe.normalizeForgeRecipe({ creature: 'Elf', color: 'Red', accessory: 'None', style: 'Photoreal' }), /art style/);
});

test('new options mark the recipe as needing the updated forge', () => {
    const base = { creature: 'Elf', color: 'Red', accessory: 'None' };
    assert.equal(recipe.isLegacyForgeRecipe(recipe.normalizeForgeRecipe({ ...base, creature: 'Ninja' })), false);
    assert.equal(recipe.isLegacyForgeRecipe(recipe.normalizeForgeRecipe({ ...base, style: 'Pixel' })), false);
    assert.equal(recipe.isLegacyForgeRecipe(recipe.normalizeForgeRecipe({ ...base, special: 'freckles' })), false);
});

test('the special touch is trimmed to a short plain phrase', () => {
    assert.equal(recipe.cleanSpecialTouch('  <b>freckles</b> & a {star} badge  '), 'b freckles b a star badge');
    assert.equal(recipe.cleanSpecialTouch('x'.repeat(200)).length, recipe.FORGE_SPECIAL_MAX);
});

test('the image prompt leads with the style and subject and stays short', () => {
    const r = recipe.normalizeForgeRecipe({ creature: 'Dragon', color: 'Green', accessory: 'Lantern', style: 'Storybook', backdrop: 'Forest' });
    const prompt = recipe.composeForgeImagePrompt(r, '');
    assert.ok(prompt.startsWith('charming storybook watercolour illustration'));
    assert.match(prompt, /baby dragon/);
    assert.match(prompt, /glowing lantern/);
    assert.match(prompt, /enchanted forest background/);
    assert.ok(prompt.split(/\s+/).length <= 60, `prompt has ${prompt.split(/\s+/).length} words`);
});

test('the writer reply is cleaned, and an unusable reply falls back to the catalogue', () => {
    assert.equal(recipe.cleanWriterSubject('Prompt: "baby dragon, green scales, tiny wings, warm smile."\nextra'), 'baby dragon, green scales, tiny wings, warm smile');
    assert.equal(recipe.cleanWriterSubject('ok'), '');
    const r = recipe.normalizeForgeRecipe({ creature: 'Owl', color: 'Blue', accessory: 'None' });
    assert.match(recipe.composeForgeImagePrompt(r, 'ok'), /wise little owl/);
});

test('the modal keeps the element ids the forge code and listeners use', () => {
    const template = readFileSync(new URL('../templates/modals/trophyRoom.js', import.meta.url), 'utf8');
    for (const id of [
        'avatar-maker-modal', 'avatar-maker-close-btn', 'avatar-maker-student-name', 'forge-particles-container',
        'avatar-creature-pool', 'avatar-color-pool', 'avatar-accessory-pool', 'avatar-style-pool', 'avatar-mood-pool',
        'avatar-backdrop-pool', 'avatar-framing-pool', 'avatar-special-input', 'avatar-display-area',
        'avatar-maker-placeholder', 'avatar-maker-loader', 'avatar-maker-img', 'avatar-generate-btn',
        'avatar-surprise-btn', 'avatar-post-generation-btns', 'avatar-save-btn', 'avatar-retry-btn',
        'avatar-delete-btn', 'avatar-forge-gallery', 'step-creature-check', 'step-color-dot'
    ]) {
        assert.match(template, new RegExp(`id="${id}"`), id);
    }
    assert.match(template, /id="avatar-maker-modal"[\s\S]*class="af-card pop-in"/);
});
