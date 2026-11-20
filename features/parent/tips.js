// features/parent/tips.js — "Lumi's corner": practical ideas for helping a child with English
// at home, from Lumi, the class's guiding star.
//
// Every idea in the library (tipsLibrary.mjs) is written for an age band, so the corner only
// offers what suits this child's class level. Lumi then puts first what fits right now:
//   - the moment: a test soon, a missed lesson, new homework, stars this week, the season;
//   - recent results (gently: only "a little practice would help" signals, never a grade);
//   - the teacher's public notes, read loosely for skills and habits (spelling, reading,
//     focus, confidence...). The note is never quoted and no other child is ever named.
// Families tick the ideas they tried (this device only) and Lumi offers fresh ones first.
import { escapeHtml, getSnapshot, firstName, newestHomework, splitHomework, daysFromToday, toDate, snapshotAssessmentUses } from './helpers.js';
import { tr, bi, isGreek } from './i18n.js';
import { TIPS, CATEGORIES, QUESTIONS, LEVEL_TIER, TIER_INFO } from './tipsLibrary.mjs';

const TRIED_KEY = 'gcq_family_tips_tried_v1';
const TIERS = ['E', 'J', 'M', 'S'];

// Lumi, drawn small with flat fills so she can sit on more than one page.
export const LUMI_SVG = `<svg class="fp-lumi" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <path d="M45.4 8.7Q50 0 54.6 8.7L60.7 20.3Q65.3 29 75 30.6L87.9 32.9Q97.6 34.5 90.7 41.6L81.6 51Q74.7 58 76.1 67.8L78 80.7Q79.4 90.5 70.6 86.1L58.8 80.3Q50 76 41.2 80.3L29.4 86.1Q20.6 90.5 22 80.7L23.9 67.8Q25.3 58 18.4 51L9.3 41.6Q2.4 34.5 12.1 32.9L25 30.6Q34.7 29 39.3 20.3Z" fill="#ffd84d" stroke="#f2a516" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="38" cy="31" rx="11" ry="6.5" fill="#fffbe6" opacity="0.75" transform="rotate(-32 38 31)"/>
    <ellipse cx="36" cy="63" rx="5.5" ry="3.4" fill="#ff8fa3" opacity="0.65"/>
    <ellipse cx="64" cy="63" rx="5.5" ry="3.4" fill="#ff8fa3" opacity="0.65"/>
    <g class="fp-lumi__eyes"><ellipse cx="42" cy="54" rx="4.6" ry="6" fill="#2b2250"/><ellipse cx="58" cy="54" rx="4.6" ry="6" fill="#2b2250"/><circle cx="43.6" cy="51.6" r="1.8" fill="#fff"/><circle cx="59.6" cy="51.6" r="1.8" fill="#fff"/></g>
    <path d="M45 62.5Q50 67 55 62.5" stroke="#8a3a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>`;

// Each class level's ages (constants.js QUEST_LEAGUE_DEFINITIONS).
const LEVEL_AGES = {
    'Pre-Junior': '5-7', 'Junior A': '7-8', 'Junior B': '8-9', A: '9-10', B: '10-11', C: '11-12', D: '12-13'
};

// What a note theme is about, in words a parent is happy to read. Worries are never named:
// a tip that fits one simply says it follows the class notes.
const NOTE_TOPICS = {
    spelling: ['spelling', 'την ορθογραφία'],
    reading: ['reading', 'το διάβασμα'],
    writing: ['writing', 'το γράψιμο'],
    speaking: ['speaking', 'την ομιλία'],
    pronunciation: ['pronunciation', 'την προφορά'],
    grammar: ['grammar', 'τη γραμματική'],
    vocabulary: ['new words', 'το λεξιλόγιο'],
    listening: ['listening', 'την κατανόηση όταν ακούει'],
    homework: ['homework', 'τις εργασίες'],
    materials: ['books and notebooks', 'τα βιβλία και τα τετράδια'],
    focus: ['focus', 'τη συγκέντρωση'],
    organisation: ['organisation', 'την οργάνωση'],
    careless: ['checking work', 'τον έλεγχο της δουλειάς'],
    effort: ['effort', 'την προσπάθεια'],
    tired: ['energy', 'την ενέργεια στο μάθημα'],
    shy: ['confidence', 'την αυτοπεποίθηση'],
    worry: ['confidence', 'την αυτοπεποίθηση'],
    selftalk: ['confidence', 'την αυτοπεποίθηση']
};
const STRENGTH_THEMES = new Set(['helper', 'polite', 'leader', 'creative', 'eager', 'ahead', 'diligent', 'curious', 'resilient', 'attentive', 'progress']);
const CONTEXT_THEMES = new Set(['newcomer', 'support', 'home']);
const LAST_MINUTE = new Set(['sleep']);

// Where the family has wandered in the corner (kept while the portal is open).
const view = { cat: 'all', tier: null };

/* ---------------------------------------------------------------- the child */

function childTier(snapshot) {
    return LEVEL_TIER[snapshot?.questLevel] || 'J';
}

function levelChip(snapshot) {
    const level = snapshot?.questLevel || '';
    const ages = LEVEL_AGES[level] || TIER_INFO[childTier(snapshot)].ages;
    const ageWords = tr(`ages ${ages}`, `${ages} ετών`);
    return level ? `${level} · ${ageWords}` : ageWords;
}

function readTried() {
    try {
        const list = JSON.parse(localStorage.getItem(TRIED_KEY) || '[]');
        return new Set(Array.isArray(list) ? list : []);
    } catch {
        return new Set();
    }
}

export function toggleTipTried(id) {
    const tried = readTried();
    if (tried.has(id)) tried.delete(id);
    else tried.add(id);
    try { localStorage.setItem(TRIED_KEY, JSON.stringify([...tried])); } catch { /* this visit only */ }
    return tried.has(id);
}

/** Ideas that suit this tier and this class (no test tips where the class has no tests). */
function tipsFor(tier, snapshot) {
    const uses = snapshotAssessmentUses(snapshot);
    return TIPS.filter((tip) => {
        if (!tip.tiers.includes(tier)) return false;
        if (!uses.any && (tip.cat === 'tests' || tip.when.includes('test'))) return false;
        if (!uses.dictations && tip.signals.includes('lowDictation') && !tip.signals.includes('lowTest')) return false;
        if (!uses.tests && tip.signals.includes('lowTest') && !tip.signals.includes('lowDictation')) return false;
        return true;
    });
}

/* ---------------------------------------------------------------- the teacher's notes */

// The note reader is large, so it loads only when the corner (or Home's tip) is first drawn.
let noteRead = { key: '', themes: null, loading: false };

function notesKey(notes) {
    return notes.map((n) => `${n.createdAt || ''}:${String(n.body || n.text || '').length}`).join('|');
}

function noteThemes(snapshot) {
    const notes = (Array.isArray(snapshot?.publishedNotes) ? snapshot.publishedNotes : []).slice(0, 4);
    if (!notes.length) return [];
    const key = notesKey(notes);
    if (noteRead.key === key && noteRead.themes) return noteRead.themes;
    if (!noteRead.loading || noteRead.key !== key) {
        noteRead = { key, themes: null, loading: true };
        import('../classGreenhouseNotes.mjs').then(({ readNote }) => {
            const weights = new Map();
            notes.forEach((note, index) => {
                const recency = [3, 2, 1.2, 1][index] || 1;
                const reading = readNote({ text: String(note.body || note.text || ''), category: note.label || '' });
                reading.themes.forEach((theme) => {
                    if (CONTEXT_THEMES.has(theme.id)) return;
                    const toneWeight = theme.tone === 'worry' ? 1.6 : theme.tone === 'better' ? 1.2 : 1;
                    const w = recency * toneWeight;
                    const prev = weights.get(theme.id);
                    if (!prev || prev.w < w) weights.set(theme.id, { id: theme.id, tone: theme.tone, w });
                });
            });
            if (noteRead.key !== key) return;
            noteRead = { key, themes: [...weights.values()].sort((a, b) => b.w - a.w), loading: false };
            window.dispatchEvent(new CustomEvent('gcq:family-tips-ready'));
        }).catch(() => {
            if (noteRead.key === key) noteRead = { key, themes: [], loading: false };
        });
    }
    return [];
}

/* ---------------------------------------------------------------- what is going on now */

function average(list) {
    return list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
}

function seasonMoments(date = new Date()) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const out = [];
    if (m === 9 || m === 10) out.push('start');
    if (m === 12) out.push('xmas');
    if ((m === 12 && d >= 18) || (m === 1 && d <= 7)) out.push('holiday');
    if (m === 3 || m === 4) out.push('spring');
    if (m === 4 && d >= 10 && d <= 30) out.push('holiday');
    if (m === 5 || m === 6) out.push('exams');
    if (m === 7 || m === 8) out.push('summer', 'holiday');
    if (d <= 5) out.push('newMonth');
    return out;
}

const SEASON_WORDS = {
    start: ['A fresh school year', 'Η αρχή της χρονιάς'],
    xmas: ['Christmas is coming', 'Έρχονται τα Χριστούγεννα'],
    holiday: ['Holidays', 'Γιορτές και διακοπές'],
    spring: ['Spring term', 'Άνοιξη'],
    exams: ['End of the year', 'Τέλος της χρονιάς'],
    summer: ['Summer', 'Καλοκαίρι'],
    newMonth: ['A new month', 'Νέος μήνας']
};

/** Everything Lumi knows about this week, once per render. */
function situation(snapshot) {
    const homework = newestHomework();
    const parts = homework ? splitHomework(homework) : null;
    const testIn = parts?.test ? daysFromToday(parts.test.date) : null;
    const lastAbsence = (snapshot.attendanceSummary?.absenceDates || [])
        .map((d) => daysFromToday(d)).filter((d) => d !== null && d <= 0).sort((a, b) => b - a)[0];
    const grades = Array.isArray(snapshot.gradeHistory) ? snapshot.gradeHistory : [];
    const recent = (type) => average(grades.filter((g) => g.type === type && Number.isFinite(g.percent)).slice(0, 3).map((g) => g.percent));
    const testAvg = recent('test');
    const dictAvg = recent('dictation');
    const moments = new Set(seasonMoments());
    if (testIn !== null && testIn >= 0 && testIn <= 7) moments.add('test');
    if (lastAbsence !== undefined && lastAbsence >= -10) moments.add('absence');
    if (homework && daysFromToday(toDate(parts?.setOn)) >= -3) moments.add('homework');
    if (Number(snapshot.weekStars || 0) > 0) moments.add('stars');
    const lastResult = grades.map((g) => daysFromToday(g.date)).filter((d) => d !== null && d <= 0).sort((a, b) => b - a)[0];
    if (lastResult !== undefined && lastResult >= -5) moments.add('result');
    const signals = new Set();
    if (testAvg !== null && testAvg < 65) signals.add('lowTest');
    if (dictAvg !== null && dictAvg < 65) signals.add('lowDictation');
    if (lastAbsence !== undefined && lastAbsence >= -10) signals.add('attendance');
    return { testIn, moments, signals, notes: noteThemes(snapshot) };
}

function dayNumber(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

// A small, steady shuffle: the same all day, different tomorrow.
function jitter(id, salt) {
    let h = salt;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
}

/** Each idea scored for this child this week, with the reason Lumi gives for it. */
function rankTips(snapshot, tier, tried) {
    const now = situation(snapshot);
    const salt = dayNumber();
    return tipsFor(tier, snapshot).map((tip) => {
        let score = jitter(tip.id, salt) * 0.9;
        let reason = null;
        const because = (weight, en, el, kind) => {
            score += weight;
            if (!reason || reason.weight < weight) reason = { weight, en, el, kind };
        };
        // The moment.
        // The night-before ideas wait for the last day or two.
        const lastMinute = LAST_MINUTE.has(tip.id);
        if (now.moments.has('test') && tip.when.includes('test') && (!lastMinute || now.testIn <= 1)) {
            const n = now.testIn;
            if (n <= 1) because(4.2, 'The test is very soon.', 'Το διαγώνισμα είναι πολύ κοντά.', 'moment');
            else because(3.6, `There is a test in ${n} days.`, `Υπάρχει διαγώνισμα σε ${n} ημέρες.`, 'moment');
        }
        if (now.moments.has('result') && tip.when.includes('result')) because(2.2, 'A result just came back.', 'Μόλις ήρθε ένα αποτέλεσμα.', 'moment');
        if (now.moments.has('absence') && tip.when.includes('absence')) because(3.4, 'A lesson was missed recently.', 'Χάθηκε πρόσφατα ένα μάθημα.', 'moment');
        if (now.moments.has('homework') && tip.when.includes('homework')) because(1.2, 'There is new homework.', 'Υπάρχει νέα εργασία.', 'moment');
        if (now.moments.has('stars') && tip.when.includes('stars')) because(1.4, 'Stars were earned this week.', 'Κέρδισε αστέρια αυτή την εβδομάδα.', 'moment');
        tip.when.forEach((w) => {
            if (SEASON_WORDS[w] && now.moments.has(w)) because(w === 'newMonth' ? 0.8 : 1.6, SEASON_WORDS[w][0], SEASON_WORDS[w][1], 'season');
        });
        // Results.
        if ((now.signals.has('lowTest') && tip.signals.includes('lowTest')) || (now.signals.has('lowDictation') && tip.signals.includes('lowDictation'))) {
            because(2.4, 'A little extra practice would help right now.', 'Λίγη παραπάνω εξάσκηση θα βοηθήσει τώρα.', 'results');
        }
        // The teacher's notes.
        now.notes.forEach((theme) => {
            if (!tip.signals.includes(theme.id)) return;
            const topic = NOTE_TOPICS[theme.id];
            const strength = STRENGTH_THEMES.has(theme.id) || theme.tone === 'strength';
            const weight = 1.4 + theme.w * 0.6;
            if (strength) because(weight, 'Builds on what the teacher praised.', 'Πατά σε όσα επαίνεσε ο δάσκαλος της τάξης.', 'note');
            else if (topic) because(weight, `Follows the class notes about ${topic[0]}.`, `Με αφορμή το σημείωμα της τάξης για ${topic[1]}.`, 'note');
            else because(weight, 'Follows the latest class notes.', 'Με αφορμή τα τελευταία σημειώματα της τάξης.', 'note');
        });
        if (tried.has(tip.id)) score -= 2.2;
        return { tip, score, reason };
    }).sort((a, b) => b.score - a.score);
}

function weekNumber(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.floor((date - start) / (7 * 86400000));
}

/** Lumi's pick for this week, and why: the best fit, or a new idea each week when all is calm. */
export function tipOfTheWeek(snapshot = getSnapshot(), ranked = null) {
    const tier = childTier(snapshot);
    const list = ranked || rankTips(snapshot, tier, readTried());
    const top = list.find((r) => r.reason && r.reason.weight >= 1.2);
    if (top) return { tip: top.tip, reason: tr(top.reason.en, top.reason.el), kind: top.reason.kind };
    const pool = tipsFor(tier, snapshot);
    if (!pool.length) return { tip: null, reason: '' };
    const tip = pool[(weekNumber() * 7) % pool.length];
    return { tip, reason: tr('A new idea every week.', 'Μια καινούργια ιδέα κάθε εβδομάδα.'), kind: 'week' };
}

/**
 * Three more ideas for right now, as varied as the week allows: no two from the same shelf,
 * and a reason already given is not repeated (the card then just shows its idea).
 */
function pickVaried(ranked, weekly, tried) {
    const picks = [];
    const usedCats = new Set([weekly.tip?.cat]);
    const usedReasons = new Set([weekly.reason]);
    for (const r of ranked) {
        if (picks.length >= 3) break;
        if (r.tip.id === weekly.tip?.id || tried.has(r.tip.id) || usedCats.has(r.tip.cat)) continue;
        const reason = r.reason ? tr(r.reason.en, r.reason.el) : '';
        picks.push({ tip: r.tip, reason: usedReasons.has(reason) ? '' : reason });
        usedCats.add(r.tip.cat);
        if (reason) usedReasons.add(reason);
    }
    return picks;
}

/* ---------------------------------------------------------------- drawing */

function category(key) {
    return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

function words(tip) {
    const [title, why, tryIt] = isGreek() ? tip.el : tip.en;
    return { title, why, tryIt };
}

function tipCard(tip, tried, { open = false, reason = '' } = {}) {
    const w = words(tip);
    const cat = category(tip.cat);
    const done = tried.has(tip.id);
    return `
        <details class="fp-tip-card fp-tip-card--${cat.tone}${done ? ' is-tried' : ''}" data-tip-id="${tip.id}" ${open ? 'open' : ''}>
            <summary>
                <span class="fp-tip-card__icon" aria-hidden="true"><i class="fas ${cat.icon}"></i></span>
                <span class="fp-tip-card__head">
                    <span class="fp-tip-card__title">${bi(escapeHtml(tip.en[0]), escapeHtml(tip.el[0]))}</span>
                    ${reason ? `<span class="fp-tip-card__reason">${escapeHtml(reason)}</span>` : ''}
                </span>
                <span class="fp-tip-card__tick${done ? '' : ' hidden'}" aria-label="${escapeHtml(tr('Tried', 'Δοκιμάστηκε'))}"><i class="fas fa-check" aria-hidden="true"></i></span>
                <i class="fas fa-chevron-down fp-tip-card__chev" aria-hidden="true"></i>
            </summary>
            <div class="fp-tip-card__body">
                <p>${escapeHtml(w.why)}</p>
                <p class="fp-tip-card__try"><i class="fas fa-seedling" aria-hidden="true"></i> <span><strong>${escapeHtml(tr('Try this week:', 'Δοκιμάστε αυτή την εβδομάδα:'))}</strong> ${escapeHtml(w.tryIt)}</span></p>
                <button type="button" class="fp-tip-card__done" data-parent-tip-tried="${tip.id}" aria-pressed="${done}">
                    <i class="fas ${done ? 'fa-circle-check' : 'fa-circle'}" aria-hidden="true"></i>
                    ${done ? tr('We tried it!', 'Το δοκιμάσαμε!') : tr('We tried it', 'Το δοκιμάσαμε')}
                </button>
            </div>
        </details>`;
}

/** Home: Lumi's tip of the week, small, with a door into the full corner. */
export function renderHomeTip(snapshot = getSnapshot()) {
    const { tip, reason } = tipOfTheWeek(snapshot);
    if (!tip) return '';
    const w = words(tip);
    return `
        <aside class="fp-lumi-tip fp-rise" style="--fp-delay:2">
            <span class="fp-lumi-tip__lumi">${LUMI_SVG}</span>
            <div class="fp-lumi-tip__copy">
                <p class="fp-lumi-tip__kicker">${escapeHtml(tr('Lumi’s tip of the week', 'Η συμβουλή της Lumi'))}</p>
                <p class="fp-lumi-tip__title">${bi(escapeHtml(tip.en[0]), escapeHtml(tip.el[0]))}</p>
                <p class="fp-lumi-tip__try">${escapeHtml(w.tryIt)}</p>
                <p class="fp-lumi-tip__why">${escapeHtml(reason)}</p>
                <button type="button" class="fp-link" data-parent-tab-link="tips">${escapeHtml(tr('More ideas from Lumi', 'Περισσότερες ιδέες από τη Lumi'))} <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
            </div>
        </aside>`;
}

function questionsFor(tier) {
    return QUESTIONS.filter(([tiers]) => tiers === '*' || tiers.includes(tier));
}

function hello(snapshot, tier) {
    const name = firstName(snapshot.studentName);
    const young = tier === 'E';
    if (isGreek()) {
        return young
            ? 'Στις μικρές ηλικίες τα Αγγλικά μπαίνουν στο σπίτι με παιχνίδι, τραγούδι και αγκαλιά. Δεν χρειάζεται να ξέρετε Αγγλικά: το χαμόγελό σας είναι η καλύτερη βοήθεια.'
            : 'Μικρές, πρακτικές ιδέες για κάθε εβδομάδα, στα μέτρα της ηλικίας του παιδιού. Δεν χρειάζεται να ξέρετε Αγγλικά: το ενδιαφέρον σας είναι η μεγαλύτερη βοήθεια.';
    }
    return young
        ? `At this age, English comes home through play, songs and cuddles. You don’t need to speak English: your smile is the best help for ${escapeHtml(name || 'your child')}.`
        : `Small, practical ideas for each week, chosen for ${escapeHtml(name || 'your child')}’s age. You don’t need to speak English: your interest is the biggest help of all.`;
}

export function renderParentTips() {
    const snapshot = getSnapshot();
    const tried = readTried();
    const ownTier = childTier(snapshot);
    const tier = view.tier && TIERS.includes(view.tier) ? view.tier : ownTier;
    const browsingOther = tier !== ownTier;
    const ranked = rankTips(snapshot, ownTier, tried);
    const weekly = tipOfTheWeek(snapshot, ranked);
    const forNow = pickVaried(ranked, weekly, tried);
    const questions = questionsFor(ownTier);
    const qIndex = dayNumber() % Math.max(1, questions.length);
    const question = questions[qIndex] || QUESTIONS[0];

    const library = tipsFor(tier, snapshot);
    const cats = CATEGORIES.filter((c) => library.some((t) => t.cat === c.key));
    const cat = cats.some((c) => c.key === view.cat) ? view.cat : 'all';
    const shelf = library.filter((t) => t.cat === cat);
    const ownLibrary = tipsFor(ownTier, snapshot);
    const triedCount = ownLibrary.filter((t) => tried.has(t.id)).length;

    return `
        <div class="fp-tips">
            <header class="fp-lumi-hero fp-rise" style="--fp-delay:0">
                <span class="fp-lumi-hero__lumi">${LUMI_SVG}</span>
                <div class="fp-lumi-hero__bubble">
                    <h2 class="fp-lumi-hero__title">${bi('Lumi’s corner', 'Η γωνιά της Lumi')}</h2>
                    <p class="fp-lumi-hero__text">${hello(snapshot, ownTier)}</p>
                    <span class="fp-lumi-hero__chip"><i class="fas fa-cake-candles" aria-hidden="true"></i> ${escapeHtml(levelChip(snapshot))}</span>
                </div>
            </header>

            ${weekly.tip ? `
            <section class="fp-tip-week fp-rise" style="--fp-delay:1" aria-labelledby="fp-tip-week-title">
                <p class="fp-kicker" id="fp-tip-week-title"><i class="fas fa-star" aria-hidden="true"></i> ${escapeHtml(tr('Lumi’s pick this week', 'Η πρόταση της εβδομάδας'))}</p>
                ${tipCard(weekly.tip, tried, { open: true, reason: weekly.reason })}
            </section>` : ''}

            ${forNow.length ? `
            <section class="fp-tip-now fp-rise" style="--fp-delay:2">
                <h3 class="fp-section-title"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> <span>${bi('Good ideas right now', 'Ταιριάζουν τώρα')}</span></h3>
                ${forNow.map((r) => tipCard(r.tip, tried, { reason: r.reason })).join('')}
            </section>` : ''}

            <section class="fp-card fp-ask-card fp-rise" style="--fp-delay:3">
                <p class="fp-kicker"><i class="fas fa-comments" aria-hidden="true"></i> ${escapeHtml(tr('A question for after class', 'Μια ερώτηση για μετά το μάθημα'))}</p>
                <p class="fp-ask-card__q" data-parent-question data-index="${qIndex}">${bi(escapeHtml(question[1]), escapeHtml(question[2]))}</p>
                <button type="button" class="fp-btn fp-btn--soft fp-btn--sm" data-parent-next-question><i class="fas fa-shuffle" aria-hidden="true"></i> ${escapeHtml(tr('Another question', 'Άλλη ερώτηση'))}</button>
            </section>

            <section class="fp-tip-shelf fp-rise" style="--fp-delay:4" aria-labelledby="fp-tip-shelf-title">
                <div class="fp-tip-shelf__head">
                    <h3 class="fp-section-title" id="fp-tip-shelf-title"><i class="fas fa-book-bookmark" aria-hidden="true"></i> <span>${bi('All of Lumi’s ideas', 'Όλες οι ιδέες της Lumi')}</span></h3>
                    <div class="fp-tip-progress" role="status">
                        <span class="fp-tip-progress__bar" style="--fp-tried:${Math.round((triedCount / Math.max(1, ownLibrary.length)) * 100)}%"><span></span></span>
                        <span>${escapeHtml(tr(`${triedCount} of ${ownLibrary.length} tried`, `Δοκιμάσατε ${triedCount} από ${ownLibrary.length}`))}</span>
                    </div>
                </div>
                ${cat === 'all' ? `
                <div class="fp-tip-shelves">
                    ${cats.map((c) => {
                        const list = library.filter((t) => t.cat === c.key);
                        const done = list.filter((t) => tried.has(t.id)).length;
                        return `<button type="button" class="fp-tip-shelfbtn fp-tip-shelfbtn--${c.tone}" data-parent-tip-cat="${c.key}">
                            <span class="fp-tip-shelfbtn__icon" aria-hidden="true"><i class="fas ${c.icon}"></i></span>
                            <span class="fp-tip-shelfbtn__name">${escapeHtml(tr(c.en, c.el))}</span>
                            <span class="fp-tip-shelfbtn__count">${escapeHtml(tr(`${list.length} ideas`, `${list.length} ιδέες`))}${done ? ` · <i class="fas fa-check" aria-hidden="true"></i> ${done}` : ''}</span>
                        </button>`;
                    }).join('')}
                </div>` : `
                <div class="fp-tip-chips" role="group" aria-label="${escapeHtml(tr('Choose a theme', 'Διαλέξτε θέμα'))}">
                    <button type="button" class="fp-tip-chip" data-parent-tip-cat="all"><i class="fas fa-grip" aria-hidden="true"></i> ${escapeHtml(tr('All themes', 'Όλα τα θέματα'))}</button>
                    ${cats.map((c) => `<button type="button" class="fp-tip-chip${cat === c.key ? ' is-on' : ''}" data-parent-tip-cat="${c.key}" aria-pressed="${cat === c.key}"><i class="fas ${c.icon}" aria-hidden="true"></i> ${escapeHtml(tr(c.en, c.el))}</button>`).join('')}
                </div>
                <div class="fp-tip-shelf__list">
                    ${shelf.length ? shelf.map((t) => tipCard(t, tried)).join('') : `<p class="fp-tip-shelf__empty">${escapeHtml(tr('Lumi already put these ideas at the top of the page.', 'Η Lumi έχει ήδη βάλει αυτές τις ιδέες στην κορυφή της σελίδας.'))}</p>`}
                </div>`}
                <div class="fp-tip-ages">
                    <span>${escapeHtml(tr('Ideas for other ages:', 'Ιδέες για άλλες ηλικίες:'))}</span>
                    ${TIERS.map((t) => `<button type="button" class="fp-tip-chip fp-tip-chip--age${t === tier ? ' is-on' : ''}" data-parent-tip-tier="${t}" aria-pressed="${t === tier}">${escapeHtml(tr(`${TIER_INFO[t].ages}`, `${TIER_INFO[t].ages}`))}${t === ownTier ? ' <i class="fas fa-heart" aria-hidden="true"></i>' : ''}</button>`).join('')}
                </div>
                ${browsingOther ? `<p class="fp-tip-ages__note">${escapeHtml(tr(`You are looking at ideas for ages ${TIER_INFO[tier].ages}.`, `Βλέπετε ιδέες για ηλικίες ${TIER_INFO[tier].ages}.`))} <button type="button" class="fp-inline-link" data-parent-tip-tier="${ownTier}">${escapeHtml(tr('Back to my child’s age', 'Πίσω στην ηλικία του παιδιού μου'))}</button></p>` : ''}
            </section>

            <p class="fp-tips__foot fp-rise" style="--fp-delay:5">${isGreek()
                ? 'Έχετε απορία για την πρόοδο του παιδιού σας; <button type="button" class="fp-inline-link" data-parent-compose="question">Γράψτε στο σχολείο</button>.'
                : 'Questions about your child’s progress? <button type="button" class="fp-inline-link" data-parent-compose="question">Write to the school</button>.'}</p>
        </div>`;
}

/** Shelf filters: a theme, or another age band. Returns true when the page should redraw. */
export function handleTipsControl(target) {
    const catBtn = target.closest('[data-parent-tip-cat]');
    if (catBtn) {
        view.cat = catBtn.dataset.parentTipCat;
        return 'cat';
    }
    const tierBtn = target.closest('[data-parent-tip-tier]');
    if (tierBtn) {
        view.tier = tierBtn.dataset.parentTipTier;
        view.cat = 'all';
        return 'tier';
    }
    return '';
}

/** Next conversation starter for this age, without redrawing the page. */
export function showNextQuestion(button) {
    const box = button.closest('.fp-ask-card')?.querySelector('[data-parent-question]');
    if (!box) return;
    const questions = questionsFor(childTier(getSnapshot()));
    if (!questions.length) return;
    const next = (Number(box.dataset.index || 0) + 1) % questions.length;
    box.dataset.index = String(next);
    box.classList.remove('is-new');
    void box.offsetWidth;
    box.innerHTML = bi(escapeHtml(questions[next][1]), escapeHtml(questions[next][2]));
    box.classList.add('is-new');
}
