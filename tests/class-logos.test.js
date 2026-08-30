import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const ORIGINAL_CLASS_LOGOS = [
    '⭐', '🚀', '💡', '🏆', '📚', '🧭', '🧪', '🧠', '🧩', '🗺️',
    '🦁', '🐲', '🦄', '🤖', '👑', '💎', '🎨', '💻', '📈', '🌍',
    '🔭', '🦉', '🦊', '💥', '✨', '⚡', '🖋️', '📖', '🍎', '🥇',
    '🌲', '🌊', '🌋', '🍄', '💍', '🛡️', '⚔️', '🏹', '🔮', '💰',
    '⚙️', '🕰️', '🔬', '🔱', '⚓', '🔔', '🦖', '🦕', '🌈', '🌙',
    '☀️', '☁️', '🗝️', '🗻', '🌃', '🌆', '🏙️', '🏰', '🛸',
    '🪐', '🌌', '🧬', '🧙', '🧚', '🐢', '🦋', '🌵', '🍁', '🐚',
    '🌠', '👾', '📜', '⚗️', '🏺', '🧞', '🧜‍♀️', '🦅', '🐺', '⚛️',
    '🌱', '⏳', '🐼', '🐨', '🦡', '🦔', '🦚', '🪁', '🪀', '🧮', '🧲'
];

function stripVariantSelectors(value) {
    return [...String(value)].filter((char) => char.codePointAt(0) !== 0xFE0F).join('');
}

test('class logos are grouped, unique, and keep every original emblem', async () => {
    const {
        classLogoCategories,
        classLogos,
        filterClassLogoCatalog,
        isKnownClassLogo
    } = await import('../classLogos.js');

    assert.ok(Array.isArray(classLogoCategories));
    assert.ok(classLogoCategories.length >= 8);

    const seenIds = new Set();
    const seenEmojis = new Set();
    const seenNormalized = new Set();
    const flat = [];

    for (const category of classLogoCategories) {
        assert.equal(typeof category.id, 'string');
        assert.equal(typeof category.label, 'string');
        assert.equal(typeof category.icon, 'string');
        assert.ok(Array.isArray(category.items));
        assert.ok(category.items.length >= 8, `${category.id} should have a useful set of emblems`);
        assert.equal(seenIds.has(category.id), false, `duplicate category id: ${category.id}`);
        seenIds.add(category.id);

        for (const item of category.items) {
            assert.equal(typeof item.emoji, 'string');
            assert.ok(item.emoji.length > 0);
            assert.equal(typeof item.name, 'string');
            assert.ok(item.name.length > 1);
            assert.ok(Array.isArray(item.keywords));
            assert.equal(seenEmojis.has(item.emoji), false, `duplicate emblem: ${item.emoji}`);
            seenEmojis.add(item.emoji);
            const normalized = stripVariantSelectors(item.emoji);
            assert.equal(seenNormalized.has(normalized), false, `duplicate after normalizing ${item.emoji}`);
            seenNormalized.add(normalized);
            flat.push(item.emoji);
        }
    }

    assert.deepEqual(classLogos, flat);
    assert.ok(classLogos.length >= 240, `expected a much larger catalog, got ${classLogos.length}`);

    for (const logo of ORIGINAL_CLASS_LOGOS) {
        assert.equal(classLogos.includes(logo), true, `missing original emblem: ${logo}`);
        assert.equal(isKnownClassLogo(logo), true);
    }

    const dragons = filterClassLogoCatalog('dragon');
    const dragonEmojis = dragons.flatMap((category) => category.items.map((item) => item.emoji));
    assert.ok(dragonEmojis.includes('🐲'));
    assert.ok(dragonEmojis.includes('🐉'));

    const onlyCreatures = filterClassLogoCatalog('', 'creatures');
    assert.equal(onlyCreatures.length, 1);
    assert.equal(onlyCreatures[0].id, 'creatures');

    const empty = filterClassLogoCatalog('zzzz-no-such-emblem');
    assert.deepEqual(empty, []);
});

test('constants still expose the class logo catalog', async () => {
    const constants = await import('../constants.js');
    assert.ok(Array.isArray(constants.classLogos));
    assert.ok(constants.classLogos.length >= 240);
    assert.equal(typeof constants.filterClassLogoCatalog, 'function');
    assert.equal(typeof constants.isKnownClassLogo, 'function');
    assert.ok(Array.isArray(constants.classLogoCategories));
});

test('choose-a-class-logo modal is categorized, searchable, and previewed', () => {
    const template = read('templates/modals/base.js');
    assert.match(template, /id="logo-picker-modal"/);
    assert.match(template, /logo-picker-shell/);
    assert.match(template, /id="logo-picker-search"/);
    assert.match(template, /id="logo-picker-categories"/);
    assert.match(template, /id="logo-picker-preview"/);
    assert.match(template, /id="logo-picker-list"/);
    assert.match(template, /id="logo-picker-empty"/);
    assert.match(template, /Choose a Class Logo/);
    assert.doesNotMatch(template, /logo-picker-list" class="grid grid-cols-10 gap-4 text-3xl max-h-72/);

    const picker = read('ui/modals/base.js');
    const pickerFunction = picker.slice(picker.indexOf('export function showLogoPicker'));
    assert.match(pickerFunction, /classLogoCategories/);
    assert.match(pickerFunction, /filterClassLogoCatalog/);
    assert.match(pickerFunction, /logo-picker-search/);
    assert.match(pickerFunction, /data-logo-category/);
    assert.match(pickerFunction, /logoPickerTarget === 'setup'/);
    assert.match(pickerFunction, /addEventListener\('click'/);
    assert.doesNotMatch(pickerFunction, /querySelectorAll\('\.logo-select-btn'\)\.forEach/);

    const css = read('styles/modals.css');
    assert.match(css, /\.logo-picker-shell/);
    assert.match(css, /\.logo-picker-chip/);
    assert.match(css, /\.logo-select-btn\.is-selected/);
});

test('teacher setup opens the class logo picker instead of dumping a giant grid', () => {
    const template = read('templates/setup.js');
    assert.match(template, /id="setup-logo-picker-btn"/);
    assert.match(template, /id="setup-class-logo"/);
    assert.match(template, /id="setup-class-logo-preview"/);
    assert.doesNotMatch(template, /id="setup-class-logo-grid"/);

    const setup = read('features/schoolSetup.js');
    assert.match(setup, /showLogoPicker\('setup'\)/);
    assert.match(setup, /setup-class-logo/);
    assert.doesNotMatch(setup, /setup-class-logo-grid/);
});
