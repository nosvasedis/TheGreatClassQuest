/**
 * Ember Oath suggestions: a personalised, varied set of small promises for ONE child, built from what the
 * app knows about them. Pure logic, covered by tests/oath-suggest-core.test.mjs.
 *
 * Signals: this month's Award Stars by virtue (weakest → gentle stretch, strongest → share it), total
 * stars vs the class (quiet → confidence, shining → helper), Hero Class virtue, Scholar's Scroll trends
 * (dictations, tests: low, falling or high), Quiz of the Week accuracy, recent absences, the real words
 * of the current unit, the unit topic, and the child's earlier oaths (never repeat, try new kinds).
 * The child always chooses; every suggestion carries a one-line "why" for the teacher.
 */
import { getLeagueBand } from './languageScaffolds.mjs';

const VIRTUES = ['Teamwork', 'Creativity', 'Respect', 'Focus'];
const HERO_VIRTUE = { Guardian: 'Respect', Sage: 'Creativity', Paladin: 'Teamwork', Artificer: 'Focus' };
const clean = (s, max = 40) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const hash = text => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const avg = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
// Band phrasing: early → junior → mid → upper → exam, falling back to the nearest simpler/harder text.
function say(band, t) {
    const order = { early: ['early', 'junior', 'mid'], junior: ['junior', 'mid', 'early'], mid: ['mid', 'junior', 'upper'], upper: ['upper', 'mid', 'exam'], exam: ['exam', 'upper', 'mid'] }[band] || ['mid'];
    for (const key of order) if (t[key]) return t[key];
    return Object.values(t)[0];
}
const VIRTUE_STRETCH = {
    Teamwork: { early: 'I play nicely with my friends. 🤝', junior: 'I help my team two times. 🤝', mid: 'I help our group finish together.', upper: 'I help my group share the work fairly.', exam: 'I help my group build a stronger answer together.' },
    Respect: { early: 'I listen when my friend talks. 👂', junior: 'I listen when a friend speaks. 👂', mid: 'I listen and let everyone have a turn.', upper: 'I disagree kindly and give a reason.', exam: 'I respond to other views respectfully and precisely.' },
    Focus: { early: 'I look and listen at story time. 👀', junior: 'I finish my task before I chat. 🎯', mid: 'I stay on task until the timer ends.', upper: 'I keep going when a task gets hard.', exam: 'I give one weak area my full attention.' },
    Creativity: { early: 'I show my idea with my hands. 🎨', junior: 'I try a new idea in English. 🎨', mid: 'I add my own idea in English.', upper: 'I try a new way to say what I mean.', exam: 'I experiment with a new structure in my writing.' }
};
const VIRTUE_SHARE = {
    Teamwork: { junior: 'I help a new friend join our team. 🤝', mid: 'I invite someone quiet into our group.', upper: 'I make sure everyone in my group has a role.' },
    Respect: { junior: 'I say something kind to a classmate. 💛', mid: 'I thank a classmate for a good idea.', upper: 'I help our group listen to every voice.' },
    Focus: { junior: 'I help my partner find the right page. 📖', mid: 'I help our group stay on task.', upper: 'I help my group plan our time.' },
    Creativity: { junior: 'I help a friend with a fun idea. 🎨', mid: 'I share a creative idea with my group.', upper: 'I help my group see a problem in a new way.' }
};
const TEMPLATES = {
    words: (band, words) => words.length
        ? { early: 'I can say: ' + words.slice(0, 2).join(', ') + '. 🔤', junior: 'I use our new words: ' + words.slice(0, 3).join(', ') + '.', mid: 'I use these words in my own sentences: ' + words.slice(0, 4).join(', ') + '.', upper: 'I use ' + words.slice(0, 5).join(', ') + ' in my speaking and writing.' }
        : { early: 'I learn one new word. 🔤', junior: 'I use three new words.', mid: 'I use five new words in my own sentences.', upper: 'I use new vocabulary in a short response.', exam: 'I use precise vocabulary in a response.' },
    quizReview: { junior: 'I practise the quiz words I found tricky. ❓', mid: 'I review the quiz questions I missed.', upper: 'I work out why I missed a quiz answer.', exam: 'I analyse the quiz items I missed and fix the gap.' },
    quizHelper: { junior: 'I help a friend with a quiz word. ❓', mid: 'I explain a quiz answer to a classmate.', upper: 'I explain a tricky quiz answer to my group.' },
    spelling: { early: 'I trace my new words. ✏️', junior: 'I practise my spelling at home. ✏️', mid: 'I practise my spelling words a little every day.', upper: 'I keep a list of words I misspell and practise them.', exam: 'I track my spelling errors and fix one pattern.' },
    testPrep: { junior: 'I look at my book a little every day. 📚', mid: 'I review a little every day before our tests.', upper: 'I make a mini revision plan before the next test.', exam: 'I follow a revision plan for my next paper.' },
    stretchWrite: { junior: 'I write one extra sentence. ✍️', mid: 'I write one extra sentence with a new word.', upper: 'I add a linking word to make my writing flow.', exam: 'I use four linking words in my essay.' },
    welcomeBack: { early: 'I say hello and join in. 👋', junior: 'I catch up on one thing I missed. 👋', mid: 'I ask a friend what I missed and catch up.', upper: 'I catch up on what I missed and ask one question.' },
    speakUp: { early: 'I say one word in English. 🗣️', junior: 'I put my hand up once in English. 🗣️', mid: 'I share one idea in English.', upper: 'I explain my opinion and give a reason.', exam: 'I develop a spoken answer with reasons and examples.' },
    helper: { junior: 'I help someone who is stuck. 🌟', mid: 'I help a classmate who is stuck, without giving the answer.', upper: 'I help a classmate by asking a good question.', exam: 'I coach a classmate through a hard question.' },
    readTheme: theme => ({ junior: 'I tell my family about ' + theme + '. 🏠', mid: 'I tell someone at home what I learned about ' + theme + '.', upper: 'I find one extra fact about ' + theme + '.', exam: 'I read one extra text about ' + theme + '.' }),
    readStory: { early: 'I listen to a story. 📖', junior: 'I share one thing from a story. 📖', mid: 'I explain an idea I read or heard.', upper: 'I support my answer with the text.', exam: 'I explain how evidence supports an inference.' },
    ready: { early: 'I get ready with a friend. 🎒', junior: 'I bring what I need to every lesson. 🎒', mid: 'I come ready with my book and homework.', upper: 'I plan my homework time each week.', exam: 'I reflect on and adapt my study routine.' }
};

/**
 * @param {object} p
 * @returns {Array<{ id, key, band, category, text, projectorText, weeks, target, evidenceRule, why, score }>}
 */
export function buildOathSuggestions(p = {}) {
    const band = getLeagueBand(p.league);
    const seed = p.seed || p.name || '';
    const awards = p.awards || [];
    const counts = Object.fromEntries(VIRTUES.map(v => [v, awards.filter(a => String(a.reason).toLowerCase() === v.toLowerCase() && Number(a.stars) > 0).length]));
    const totalVirtue = Object.values(counts).reduce((a, b) => a + b, 0);
    const byCount = [...VIRTUES].sort((a, b) => counts[a] - counts[b] || hash(seed + a) - hash(seed + b));
    const weakest = byCount[0], strongest = byCount.at(-1);
    const percents = type => (p.writtenScores || []).filter(s => !type || s.type === type).map(s => Number(s.percent ?? s.normalizedPercent)).filter(Number.isFinite);
    const dictations = percents('dictation'), tests = percents('test'), allScores = percents(null);
    const dictationAvg = avg(dictations.slice(-5)), testAvg = avg(tests.slice(-5)), overall = avg(allScores.slice(-6));
    const falling = tests.length >= 3 && tests.at(-1) < avg(tests.slice(-4, -1)) - 10;
    const quizRate = p.quiz?.attemptedCount > 0 ? p.quiz.correctCount / p.quiz.attemptedCount : null;
    const stars = Number(p.studentStars), median = Number(p.classStarMedian);
    const quiet = Number.isFinite(stars) && Number.isFinite(median) && median > 0 && stars < median * 0.7;
    const shining = Number.isFinite(stars) && Number.isFinite(median) && median > 0 && stars > median * 1.3;
    const heroVirtue = HERO_VIRTUE[p.heroClass];
    const words = (p.words || []).map(w => clean(w, 30)).filter(Boolean);
    const theme = clean(p.theme, 60);
    const early = band === 'early', junior = band === 'junior';
    const count = n => early ? 1 : junior ? Math.min(2, n) : n;
    const out = [];
    const add = (key, category, text, why, score, target = { kind: 'manual', count: count(2) }, evidenceRule = 'manual') => {
        if (!text) return;
        out.push({ id: band + '_' + key, key, band, category, text, projectorText: text, weeks: early || junior ? 1 : 2, target, evidenceRule, why, score });
    };

    // Hero virtues (fill themselves from Award Stars)
    add('virtue_' + weakest.toLowerCase(), 'virtue', say(band, VIRTUE_STRETCH[weakest]),
        totalVirtue ? (counts[weakest] === 0 ? 'No ' + weakest + ' stars yet this month.' : 'Only ' + counts[weakest] + ' ' + weakest + ' star' + (counts[weakest] === 1 ? '' : 's') + ' this month.') + ' A gentle stretch.'
            : 'Fills itself every time you award a ' + weakest + ' star.',
        totalVirtue ? 3 + Math.min(2, (counts[strongest] - counts[weakest]) / 2) : 2.2, { kind: 'virtue', count: count(2), reason: weakest }, 'virtue');
    if (counts[strongest] >= 3 && !early) add('share_' + strongest.toLowerCase(), 'virtue', say(band, VIRTUE_SHARE[strongest]),
        counts[strongest] + ' ' + strongest + ' stars this month. Time to share that strength.', 2.6 + (shining ? 0.8 : 0), { kind: 'virtue', count: count(2), reason: strongest }, 'virtue');
    if (heroVirtue && heroVirtue !== weakest && !early) add('hero_' + heroVirtue.toLowerCase(), 'virtue', say(band, VIRTUE_STRETCH[heroVirtue]),
        'A ' + p.heroClass + '’s virtue is ' + heroVirtue + '. It fills from their ' + heroVirtue + ' stars.', 2.4, { kind: 'virtue', count: count(3), reason: heroVirtue }, 'virtue');

    // Language
    add('words', 'words', say(band, TEMPLATES.words(band, words)), words.length ? 'Real words the class is practising now.' : 'New words stick when we use them.', words.length ? 3.2 : 1.6);
    if (quizRate != null && quizRate < 0.7 && !early) add('quiz_review', 'words', say(band, TEMPLATES.quizReview), 'Quiz of the Week: ' + p.quiz.correctCount + ' of ' + p.quiz.attemptedCount + ' correct.', 3.4, { kind: 'quiz', count: 1 }, 'quiz');
    if (quizRate != null && quizRate >= 0.9 && !early) add('quiz_helper', 'speak', say(band, TEMPLATES.quizHelper), 'Quiz of the Week: ' + p.quiz.correctCount + ' of ' + p.quiz.attemptedCount + ' correct. Let them teach.', 2.5);
    if (dictationAvg != null && dictationAvg < 72) add('spelling', 'write', say(band, TEMPLATES.spelling), 'Recent dictations around ' + Math.round(dictationAvg) + '%. Growth is measured against their own scores.', 3.3, { kind: 'practice', count: count(2) }, 'practice');
    if (falling || (testAvg != null && testAvg < 65 && !early)) add('test_prep', 'habit', say(band, TEMPLATES.testPrep), falling ? 'Their last test dipped below their usual level.' : 'Recent tests around ' + Math.round(testAvg) + '%.', 3.2, { kind: 'practice', count: count(2) }, 'practice');
    if (overall != null && overall >= 85 && !early) add('stretch_write', 'write', say(band, TEMPLATES.stretchWrite), 'Strong recent scores (' + Math.round(overall) + '%). A stretch, not a repeat.', 2.7);

    // Confidence and belonging
    if ((p.absences || 0) >= 2) add('welcome_back', 'habit', say(band, TEMPLATES.welcomeBack), 'Away ' + p.absences + ' lessons recently. A soft way back in.', 3.5);
    add('write', 'write', say(band, TEMPLATES.stretchWrite), 'Writing makes thinking visible.', 1.55);
    add('speak_up', 'speak', say(band, TEMPLATES.speakUp), quiet ? 'Fewer stars than most this month. A small, safe step to be seen.' : 'Speaking up in English builds confidence.', quiet ? 3.3 : 1.8);
    if (shining && !early) add('helper', 'speak', say(band, TEMPLATES.helper), 'One of the class’s brightest this month. Now they lift others.', 2.9);
    add('read', 'read/listen', say(band, theme ? TEMPLATES.readTheme(theme) : TEMPLATES.readStory), theme ? 'Connects this unit to home.' : 'Reading and listening grow every other skill.', theme ? 2.2 : 1.4);
    add('ready', 'habit', say(band, TEMPLATES.ready), 'A calm routine makes every lesson easier.', 1.2);

    // Earlier oaths: never repeat one, prefer kinds they have not tried, avoid what was released.
    const previous = p.previousOaths || [];
    for (const s of out) {
        if (previous.some(o => o.templateId === s.id || (o.text && o.text === s.text))) s.score -= 4;
        if (previous.some(o => o.status === 'released' && o.category === s.category)) s.score -= 0.8;
        if (previous.length && !previous.some(o => o.category === s.category)) s.score += 0.5;
        s.score += (hash(seed + s.key) % 100) / 400; // stable per child, so a class gets variety
    }
    return out.sort((a, b) => b.score - a.score);
}

/** Pick `count` suggestions of different promise kinds. Offset pages the ranked list so Other ideas can reach every kind. */
export function pickDiverseOaths(all, count = 3, offset = 0) {
    const pool = all.slice(offset).concat(all.slice(0, offset));
    const chosen = [], used = new Set(), usedCats = new Set();
    for (const s of pool) {
        if (chosen.length >= count) break;
        if (!used.has(s.key) && !usedCats.has(s.category)) {
            chosen.push(s);
            used.add(s.key);
            usedCats.add(s.category);
        }
    }
    for (const s of pool) {
        if (chosen.length >= count) break;
        if (!used.has(s.key)) { chosen.push(s); used.add(s.key); }
    }
    return chosen;
}
