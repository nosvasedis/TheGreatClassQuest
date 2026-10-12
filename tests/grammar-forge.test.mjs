import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FORGE_PATTERNS, EARLY_CHUNKS, forgeBand, patternsForGrammar, forgeChoices, forgeFixes, forgeRiddles,
    forgeShowdownItems, forgeAnchors, forgeExample, classGrammarLines, forgeCount
} from '../features/grammarForge/index.mjs';
import { BOOK_ATLAS } from '../features/bookAtlas.data.mjs';
import { withGrammarCards } from '../features/questRemote/showdownDeck.mjs';
import { buildQuizGenerationUserPrompt } from '../features/quizCurriculumCore.mjs';
import { buildCampfireScript } from '../features/heroCampfireCore.mjs';

const ids = (line) => patternsForGrammar(line).map((p) => p.id);

test('leagues map to the four bands', () => {
    assert.equal(forgeBand('Pre-Junior'), 'e');
    assert.equal(forgeBand('Junior B'), 'j');
    assert.equal(forgeBand('A'), 'm');
    assert.equal(forgeBand('D'), 'u');
});

test('patterns are well formed: right answer first and unique, bands valid', () => {
    const seen = new Set();
    for (const p of FORGE_PATTERNS) {
        assert.ok(!seen.has(p.id), `duplicate ${p.id}`);
        seen.add(p.id);
        assert.match(p.bands, /^[jmu]+$/, p.id);
        assert.ok(p.rule && p.examples.length >= 2, p.id);
        assert.ok(p.choose.length >= 4 && p.fix.length >= 2 && p.say.length >= 1, p.id);
        for (const [bands, q, opts, why] of p.choose) {
            assert.match(bands, /^[jmu]+$/, `${p.id}: ${q}`);
            assert.ok(q.includes('___'), `${p.id}: no gap in "${q}"`);
            assert.ok(opts.length >= 3 && new Set(opts).size === opts.length, `${p.id}: options ${opts}`);
            assert.ok(why, `${p.id}: ${q}`);
            for (const b of bands) assert.ok(p.bands.includes(b), `${p.id}: row band ${b} outside the pattern`);
        }
        for (const [bands, wrong, right] of p.fix) {
            assert.match(bands, /^[jmu]+$/);
            assert.notEqual(wrong, right, `${p.id}: ${wrong}`);
        }
        // every band the pattern claims has its own choice items
        for (const b of p.bands) assert.ok(p.choose.some((r) => r[0].includes(b)), `${p.id} has no ${b} choices`);
    }
    assert.ok(EARLY_CHUNKS.length >= 12);
});

test('Book Atlas grammar lines find their patterns', () => {
    assert.deepEqual(ids('past simple of be'), ['past_be']);
    assert.deepEqual(ids('Passive (Past Simple)'), ['passive']);
    assert.deepEqual(ids('Present Continuous (future meaning)'), ['future']);
    assert.deepEqual(ids('be/get used to'), ['used_to']);
    assert.ok(ids('Relative pronouns: who / that / which / whose').includes('relatives'));
    assert.ok(!ids('Relative pronouns: who / that / which / whose').includes('possessives'));
    assert.deepEqual(ids('Have you got ...? Yes, I have. / No, I haven\'t.'), ['have_got']);
    let total = 0;
    let found = 0;
    for (const book of BOOK_ATLAS) {
        for (const unit of book.units) {
            if (!unit.grammar) continue;
            total += 1;
            if (patternsForGrammar(unit.grammar).length) found += 1;
        }
    }
    assert.ok(found / total > 0.97, `${found}/${total}`);
});

test('Junior items never reach for older grammar; Pre-Junior only speaks', () => {
    const pastSimple = patternsForGrammar('past simple');
    const junior = forgeChoices(pastSimple, 'j');
    assert.ok(junior.length >= 4);
    assert.ok(junior.every((c) => FORGE_PATTERNS.find((p) => p.id === c.pattern).choose.some((r) => r[1] === c.q && r[0].includes('j'))));
    assert.deepEqual(forgeChoices(patternsForGrammar('passive'), 'j'), []);
    const early = forgeRiddles(['present simple'], 'e');
    assert.equal(early.length, EARLY_CHUNKS.length);
    assert.deepEqual(forgeShowdownItems(['present simple'], 'e'), []);
});

test('wheel riddles show the options and keep the right answer', () => {
    const riddles = forgeRiddles(['comparatives and superlatives'], 'm', { rng: () => 0.3 });
    const choice = riddles.find((r) => r.q.startsWith('An elephant'));
    assert.match(choice.q, /\(.+ \/ .+ \/ .+\)$/);
    assert.equal(choice.a, 'bigger');
    assert.ok(riddles.some((r) => r.q.startsWith('Say it right:')));
});

test('showdown grammar cards take turns between patterns and fit between word cards', () => {
    const items = forgeShowdownItems(['present simple; present continuous'], 'm', { max: 6, rng: () => 0.5 });
    assert.equal(items.length, 6);
    assert.ok(new Set(items.slice(0, 2).map((i) => i.pattern)).size === 2);
    items.forEach((i) => { assert.equal(i.correct, 0); assert.equal(i.tag, 'grammar'); assert.match(i.src, /^Grammar · /); });
    const words = Array.from({ length: 9 }, (_, i) => ({ q: `w${i}`, opts: ['a', 'b'], correct: 0, tag: 'words' }));
    const deck = withGrammarCards(words, items, { rng: () => 0.5 });
    assert.equal(deck[3].tag, 'grammar');
    assert.equal(deck.filter((c) => c.tag === 'grammar').length, 3);
    const card = deck[3];
    assert.ok(card.opts[card.correct]);
});

test('quiz anchors reach the prompt; vocabulary quizzes leave them out', () => {
    const anchors = forgeAnchors(['present simple'], 'j');
    assert.ok(anchors.rules.length && anchors.examples.length && anchors.slips.length);
    assert.ok(anchors.wrong.includes('He play football.'));
    const curriculum = { type: 'grammar', categories: ['grammar'], keywords: 'present simple' };
    const prompt = buildQuizGenerationUserPrompt({ curriculum, anchors, band: 'junior' });
    assert.match(prompt, /Model sentences at the right level/);
    assert.match(prompt, /Greek-speaking learners/);
    const vocab = buildQuizGenerationUserPrompt({ curriculum: { ...curriculum, type: 'vocabulary' }, anchors });
    assert.doesNotMatch(vocab, /Model sentences/);
    assert.deepEqual(forgeAnchors(['present simple'], 'e').rules, []);
});

test('campfire gets a steady model sentence for a grammar lesson', () => {
    const a = forgeExample('Present Perfect Simple', 'm', '2026-10-12');
    assert.ok(FORGE_PATTERNS.find((p) => p.id === 'present_perfect').examples.includes(a));
    assert.equal(forgeExample('Present Perfect Simple', 'm', '2026-10-12'), a);
    assert.equal(forgeExample('present simple', 'e'), '');
    const script = buildCampfireScript({ league: 'B', date: '2026-10-12', lessonTarget: { grammar: 'Present Perfect Simple' }, preferGrammar: true, grammarExample: a, presentIds: [] });
    assert.equal(script.pattern.example, a);
});

test('a class\'s grammar comes from its book plan', () => {
    const plan = {
        currentBookId: 'burlington-grammar-2', unit: 5,
        history: [
            { date: '2026-10-08', bookId: 'primary-path-2', unit: 4 },
            { date: '2026-10-01', bookId: 'burlington-grammar-2', unit: 4 },
            { date: '2026-09-28', bookId: 'burlington-grammar-2', unit: 9, unconfirmed: true },
        ],
    };
    const { recent, covered } = classGrammarLines(plan, BOOK_ATLAS);
    assert.equal(recent[0], 'past simple of be');
    assert.ok(recent.includes('Past Continuous / Past Simple'));
    assert.ok(covered.includes('Present Simple') && covered.includes('quantifiers; how much/how many'));
    assert.ok(!covered.some((g) => /Relative pronouns/.test(g)), 'an unconfirmed lesson does not count');
    assert.deepEqual(classGrammarLines({}, BOOK_ATLAS), { recent: [], covered: [] });
});

test('the Forge is big enough to be worth it', () => {
    assert.ok(forgeCount() > 450, String(forgeCount()));
});
