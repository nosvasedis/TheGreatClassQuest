import test from 'node:test';
import assert from 'node:assert/strict';
import { LEXICON_THEMES, NOTE_DOMAINS, GREEK_GLOSSARY } from '../features/noteLexicon.mjs';
import { NOTE_THEMES, readNote } from '../features/classGreenhouseNotes.mjs';
import { getTechnique } from '../features/classGreenhousePlaybook.mjs';

const KINDS = new Set(['worry', 'learning', 'strength', 'context']);
const DOMAIN_IDS = new Set(NOTE_DOMAINS.map((d) => d.id));

test('every theme is complete: id, kind, domain, labels in both languages, techniques that exist', () => {
    const ids = LEXICON_THEMES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, 'theme ids are unique');
    LEXICON_THEMES.forEach((t) => {
        assert.ok(KINDS.has(t.kind), `${t.id} kind`);
        assert.ok(DOMAIN_IDS.has(t.domain), `${t.id} domain`);
        assert.ok(t.label && t.labelEl && t.icon, `${t.id} labels and icon`);
        assert.ok((t.en || []).length && (t.gr || []).length, `${t.id} has English and Greek wording`);
        (t.techniques || []).forEach((id) => assert.ok(getTechnique(id), `${t.id} → ${id}`));
        if (t.kind === 'worry') assert.equal(typeof t.action, 'function', `${t.id} has a next-lesson move`);
        if (t.mirror) assert.ok(ids.includes(t.mirror), `${t.id} mirrors a real theme`);
        assert.ok((t.examples || []).length, `${t.id} has examples`);
    });
});

test('every pattern compiles, in English and in Greek', () => {
    NOTE_THEMES.forEach((t) => assert.ok(t.re && (t.re.en || t.re.el), `${t.id} compiled`));
});

test('the lexicon reads its own examples: every theme, in Greek and English', () => {
    const misses = [];
    LEXICON_THEMES.forEach((t) => (t.examples || []).forEach(([text, tone, category = 'General']) => {
        const got = readNote({ text, category }).themes.find((x) => x.id === t.id);
        if (!got || got.tone !== tone) misses.push(`${t.id}: "${text}" → ${got ? got.tone : 'not found'} (wanted ${tone})`);
    }));
    assert.deepEqual(misses, []);
});

test('the glossary gives the AI the Greek classroom words it could misread', () => {
    assert.ok(GREEK_GLOSSARY.some(([el, en]) => /ζωηρός/.test(el) && /lively/.test(en)));
    GREEK_GLOSSARY.forEach(([el, en]) => assert.ok(el && en));
});
