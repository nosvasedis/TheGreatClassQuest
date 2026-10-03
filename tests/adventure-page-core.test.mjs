import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PAGE_AWAITING,
    isAwaitingAdventurePage,
    buildAwaitingPagePayload,
    getCrownControlState,
    syncHeroLine,
    buildPageKeywords,
    splitHighlights,
    rankVirtueReasons,
    suggestPageTitles,
    getStoryStarters,
    insertStoryStarter,
    hasEnoughStoryForPicture,
    buildDiaryChooserModel
} from '../features/adventurePageCore.mjs';
import { diaryChooserHtml } from '../ui/modals/diaryChooserView.mjs';

test('only pages marked awaiting are blank; older pages without pageStatus count as written', () => {
    assert.equal(isAwaitingAdventurePage({ pageStatus: PAGE_AWAITING }), true);
    assert.equal(isAwaitingAdventurePage({ pageStatus: 'written' }), false);
    assert.equal(isAwaitingAdventurePage({ title: 'Old page', text: 'Written before crown-first' }), false);
    assert.equal(isAwaitingAdventurePage(null), false);
});

test('the blank page names its hero and carries no fake highlights', () => {
    const page = buildAwaitingPagePayload({ heroName: 'Maria' });
    assert.match(page.text, /Hero of the Day: Maria\./);
    assert.deepEqual(page.highlights, []);
    assert.equal(buildAwaitingPagePayload({}).text.includes('The Class Team'), true);
});

test('the main button walks crown → write → open', () => {
    assert.equal(getCrownControlState({}).mode, 'no-class');
    assert.equal(getCrownControlState({}).disabled, true);

    const needsStars = getCrownControlState({ classId: 'c1', hasStarsToday: false });
    assert.equal(needsStars.mode, 'needs-stars');
    assert.equal(needsStars.disabled, true);

    const crown = getCrownControlState({ classId: 'c1', hasStarsToday: true });
    assert.equal(crown.mode, 'crown');
    assert.equal(crown.label, "Crown Today's Hero");
    assert.equal(crown.disabled, false);

    const write = getCrownControlState({ classId: 'c1', hasStarsToday: true, todayLog: { pageStatus: 'awaiting', hero: 'Nikos' } });
    assert.equal(write.mode, 'write');
    assert.match(write.hint, /Nikos wears today's crown/);
    assert.equal(write.disabled, false);
    assert.equal(getCrownControlState({ classId: 'c1', todayLog: { pageStatus: 'awaiting' }, canWrite: false }).disabled, true);

    // A written page wins even if the stars were later removed.
    const written = getCrownControlState({ classId: 'c1', hasStarsToday: false, todayLog: { hero: 'Eleni' } });
    assert.equal(written.mode, 'written');
    assert.equal(written.disabled, false);
});

test('the hero line is added once and replaced, never duplicated', () => {
    assert.equal(syncHeroLine('', 'Ana'), 'Hero of the Day: Ana.');
    assert.equal(syncHeroLine('We sailed.', 'Ana'), 'We sailed.\n\nHero of the Day: Ana.');
    const replaced = syncHeroLine('We sailed.\n\nHero of the Day: Bob.', 'Ana');
    assert.equal(replaced.match(/Hero of the Day/g).length, 1);
    assert.match(replaced, /Ana\.$/);
});

test('keywords and highlights stay bounded', () => {
    assert.deepEqual(buildPageKeywords('We met dragons, wizards and brave knights in castles today together'), ['dragons', 'wizards', 'brave', 'knights', 'castles', 'today']);
    assert.deepEqual(splitHighlights('a, b, , c, d, e'), ['a', 'b', 'c', 'd']);
});

test('virtues rank by stars awarded and ignore other reasons', () => {
    const awards = [
        { reason: 'focus', stars: 1 }, { reason: 'teamwork', stars: 2 }, { reason: 'teamwork', stars: 1 },
        { reason: 'marked_present', stars: 1 }, { reason: 'welcome_back', stars: 1 }
    ];
    assert.deepEqual(rankVirtueReasons(awards), ['Teamwork', 'Focus']);
});

test('title ideas lead with the strongest virtue and always offer three', () => {
    const ideas = suggestPageTitles(['Teamwork', 'Focus']);
    assert.equal(ideas.length, 3);
    assert.equal(ideas[0], 'Stronger Together');
    assert.equal(ideas[1], 'Eyes on the Quest');
    assert.equal(suggestPageTitles([]).length, 3);
});

test('story starters use the hero first name and only suggest words when there are words', () => {
    const starters = getStoryStarters({ heroName: 'Maria Papadopoulou', words: ['brave'] });
    assert.ok(starters.includes('Maria wore the crown today because'));
    assert.ok(starters.includes('We learned new words like'));
    assert.ok(!getStoryStarters({ heroName: '', words: [] }).includes('We learned new words like'));
    assert.equal(insertStoryStarter('', 'Today our quest began with'), 'Today our quest began with ');
    assert.equal(insertStoryStarter('We sang.  ', 'Next time, we will'), 'We sang.\nNext time, we will ');
});

test('a picture is painted only from a few written lines', () => {
    assert.equal(hasEnoughStoryForPicture({ title: 'Hi', text: '' }), false);
    assert.equal(hasEnoughStoryForPicture({ title: 'Our day', text: 'We built a paper castle together.' }), true);
});

test('chooser model hides star numbers for Growth Festival leagues', () => {
    const junior = buildDiaryChooserModel({ heroName: 'Leo', league: 'Junior A', totalStars: 12, reasons: ['Teamwork'], learned: { words: ['cat', 'dog'], items: [{}] }, canAuto: true });
    assert.deepEqual(junior.ink.map(i => i.label), ['12 stars earned', 'Teamwork', '2 new words', '1 learning moment']);
    const nursery = buildDiaryChooserModel({ heroName: 'Leo', league: 'Pre-Junior', totalStars: 12 });
    assert.equal(nursery.ink.some(i => /star/.test(i.label)), false);
    assert.equal(buildDiaryChooserModel({ isToday: false }).heading, 'Shall we write this page?');
});

test('chooser markup escapes names and locks Auto without Elite', () => {
    const html = diaryChooserHtml(buildDiaryChooserModel({ heroName: '<b>Zoe</b>', className: 'A & B', canAuto: false }));
    assert.match(html, /&lt;b&gt;Zoe&lt;\/b&gt;/);
    assert.match(html, /A &amp; B/);
    assert.match(html, /dc-choice--auto is-locked/);
    assert.match(html, /data-diary-choice="manual"/);
    assert.match(html, /data-diary-choice="later"/);
    const elite = diaryChooserHtml(buildDiaryChooserModel({ heroName: 'Zoe', canAuto: true }));
    assert.doesNotMatch(elite, /is-locked/);
});
