import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInterests, detectNeeds, INTERESTS, passionOaths, oathTitle, spiritForKey, SPIRITS, foldText } from '../features/oathForge.mjs';
import { buildOathSuggestions, readOathSignals, emberSigns } from '../features/oathSuggestCore.mjs';
import { suggestOaths } from '../features/emberOathCore.mjs';

const RULE_CATEGORIES = ['speak', 'words', 'write', 'read/listen', 'habit', 'virtue'];
const LEAGUES = ['Pre-Junior', 'Junior A', 'B', 'D'];

test('passions and needs are read from Chronicle notes in English and Greek, accents or not', () => {
    assert.deepEqual(detectInterests([{ text: 'Λατρεύει το ποδόσφαιρο και τις γάτες.' }]).sort(), ['animals', 'football']);
    assert.deepEqual(detectInterests([{ text: 'Loves Minecraft and drawing comics' }]).sort(), ['art', 'gaming']);
    assert.deepEqual(detectInterests([{ text: 'ΠΑΙΖΕΙ ΣΚΑΚΙ' }]), ['chess']);
    assert.deepEqual(detectInterests([{ text: 'He was missing today.' }]), [], '“missing” is not singing');
    assert.deepEqual(detectNeeds([{ text: 'Πολύ ντροπαλή. Ξεχνάει τις εργασίες.' }]), ['shy', 'homework']);
    assert.deepEqual(detectNeeds([{ text: 'Κάνει λάθη στις λέξεις' }]), ['spelling']);
    assert.equal(foldText('Ποδόσφαιρος'), 'ποδοσφαιροσ');
});

test('every passion forges real, well-formed promises in every band', () => {
    for (const league of LEAGUES) {
        for (const x of INTERESTS) {
            const s = readOathSignals({ league, seed: 'kid' });
            const list = passionOaths(s, x.id);
            assert.ok(list.length >= 6, x.id + ' ' + league + ' has ' + list.length);
            for (const o of list) {
                assert.ok(RULE_CATEGORIES.includes(o.category), o.key);
                assert.doesNotMatch(o.text, /\{\w+\}|undefined|null/, o.text);
                assert.match(o.text, /^I /, o.text);
                assert.doesNotMatch(o.text, /\bone \w+ words\b/, 'singular after one: ' + o.text);
                assert.ok(o.text.length >= 12 && o.text.length <= 200, o.text);
            }
        }
    }
});

test('the spectrum is massive and personal: a rich child gets far more than the classic bank', () => {
    const rich = { league: 'B', seed: 'nikos', day: '2026-10-08', heroClass: 'Paladin', guildName: 'Grizzly Might', birthday: '2016-10-21',
        awards: ['teamwork', 'teamwork', 'teamwork', 'teamwork', 'creativity'].map(reason => ({ reason, stars: 1 })),
        words: ['bakery', 'market', 'baker', 'bread'], notes: [{ text: 'Λατρεύει το ποδόσφαιρο. Λίγο ντροπαλός.' }],
        previousOaths: [{ status: 'kept', category: 'speak', text: 'I share one idea in English.', templateId: 'mid_speak_up', startDate: '2026-09-20' }] };
    const all = buildOathSuggestions(rich);
    assert.ok(all.length >= 80, 'spectrum ' + all.length);
    const spirits = new Set(all.map(o => o.spirit));
    for (const spirit of ['passion', 'hero', 'ladder', 'spark', 'gift', 'quest', 'home', 'season']) assert.ok(spirits.has(spirit), spirit);
    assert.ok(all.some(o => o.key === 'season.birthday'));
    assert.ok(all.some(o => o.key.startsWith('need.shy')));
    const ladder = all.find(o => o.spirit === 'ladder');
    assert.match(ladder.why, /Kept “I share one idea in English\.” This is one rung higher\./);
    // Tapping a passion live adds a whole family of promises.
    const withAnimals = buildOathSuggestions({ ...rich, liveInterests: ['animals'] });
    assert.ok(withAnimals.filter(o => o.interest === 'animals').length >= 8);
    // Every item carries a name and a spirit the UI knows.
    for (const o of withAnimals) { assert.ok(o.title && o.title.length > 3, o.key); assert.ok(SPIRITS[o.spirit], o.key + ' ' + o.spirit); }
});

test('two children in one class rarely see the same three promises', () => {
    const kids = ['alex', 'maya', 'sam', 'robin', 'eleni', 'nikos', 'sofia', 'yannis'];
    const profiles = kids.map((seed, i) => ({ league: 'A', seed, day: '2026-10-08', heroClass: ['Guardian', 'Sage', 'Paladin', 'Artificer', 'Scholar', 'Vanguard', 'Nomad', 'Patron'][i],
        awards: [{ reason: ['teamwork', 'focus', 'respect', 'creativity'][i % 4], stars: 1 }], words: ['river', 'bridge', 'island'] }));
    const tables = new Set(profiles.map(p => suggestOaths(p).map(s => s.key).sort().join('|')));
    assert.ok(tables.size >= 6, 'distinct first tables: ' + tables.size);
    // A promise a classmate is already growing sinks.
    const p = profiles[0], top = buildOathSuggestions(p)[0];
    assert.ok(buildOathSuggestions({ ...p, classActiveKeys: [top.key] }).find(o => o.key === top.key).score < top.score);
});

test('lenses page through one kind, spirit or passion', () => {
    const p = { league: 'B', seed: 'maya', heroClass: 'Sage', words: ['river', 'bridge', 'island'], liveInterests: ['music'] };
    for (const lens of ['speak', 'spirit:hero', 'interest:music']) {
        const first = suggestOaths(p, { lens }), next = suggestOaths(p, { lens, offset: 3 });
        assert.equal(first.length, 3, lens);
        for (const o of first) assert.ok(lens === 'speak' ? o.category === 'speak' : lens === 'spirit:hero' ? o.spirit === 'hero' : o.interest === 'music', lens + ' ' + o.key);
        assert.notDeepEqual(first.map(o => o.key), next.map(o => o.key), lens);
    }
    // The best page mixes spirits, not only kinds.
    const best = suggestOaths({ ...p, notes: [{ text: 'loves football' }] });
    assert.ok(new Set(best.map(o => o.spirit)).size >= 2);
});

test('stored promises get a stable poetic name without any new stored field', () => {
    assert.equal(oathTitle({ templateId: 'mid_passion.football.talk', category: 'speak' }), 'The Captain’s Promise');
    assert.equal(oathTitle({ templateId: 'junior_hero.sage.1', category: 'words' }), 'The Sage’s Oath');
    assert.equal(oathTitle({ templateId: 'upper_season.birthday', category: 'speak' }), 'The Birthday Oath');
    assert.equal(oathTitle({ templateId: 'mid_virtue_respect', category: 'virtue', target: { reason: 'Respect' } }), 'The Kind Heart');
    const a = oathTitle({ templateId: 'mid_words', category: 'words', text: 'I use five new words.', seed: 's1' });
    assert.equal(a, oathTitle({ templateId: 'mid_words', category: 'words', text: 'I use five new words.', seed: 's1' }));
    assert.equal(spiritForKey('welcome_back'), 'bridge');
    assert.equal(spiritForKey('passion.music.talk'), 'passion');
    assert.equal(spiritForKey('need.helper.0'), 'gift');
});

test('the embers’ reading lists what the promises were built from, never a raw note', () => {
    const signs = emberSigns({ league: 'B', heroClass: 'Sage', notes: [{ text: 'Shy, loves football. Parents divorced.' }], awards: [{ reason: 'focus', stars: 1 }],
        writtenScores: [{ type: 'dictation', percent: null }, { type: 'dictation', percent: 80 }] });
    const labels = signs.map(x => x.label).join(' | ');
    assert.match(labels, /Sage/); assert.match(labels, /Football/); assert.match(labels, /Finding their voice/);
    assert.match(labels, /Dictation 80%/, 'an unscored record is not 0%');
    assert.doesNotMatch(labels, /divorced/i);
});
