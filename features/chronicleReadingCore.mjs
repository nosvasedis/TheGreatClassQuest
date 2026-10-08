// features/chronicleReadingCore.mjs
// The Oracle's reading of one child's Hero's Chronicle: what the teacher actually wrote,
// followed over time.
//
// Each note is read by the shared note reader (features/classGreenhouseNotes.mjs, the same
// one the Class Greenhouse uses, so a "spelling worry" means the same thing in both). On top
// of it this file follows ONE child across all their notes:
//
//   themes      every theme the notes return to, with the sentence that said it each time
//   trend       how each theme moved: a new worry, still there, slipping, easing, a strength
//   tried       the moves the teacher says they made, and what the notes after them say
//   gaps        what a full picture of an English learner needs and the notes do not cover
//   people      classmates written about with this child (warm or friction) and passions
//   cross       where the notes and the numbers (papers, stars, absences) agree or disagree
//
// The reading is shown in the Oracle tab without any AI call, and it is the backbone of the
// brief the AI counsels read, so their advice answers the notes rather than the fact that
// notes exist. Pure: no DOM, no Firebase. Tested in tests/chronicle-reading-core.test.mjs.

import { readNote as readSharedNote, noteTheme, sentencesOf } from './classGreenhouseNotes.mjs';
import { foldText, INTERESTS } from './oathForge.mjs';

export const DAY_MS = 24 * 60 * 60 * 1000;

const L = '(?<!\\p{L})';
const rx = (src) => new RegExp(src.replace(/\\</g, L), 'u');

// Two themes the Oracle needs for one English learner that the class reader does not keep.
export const ORACLE_EXTRA_THEMES = [
    { id: 'greek', kind: 'worry', sev: 1, label: 'Falls back on Greek', icon: 'fa-language', group: 'learning',
        re: rx('speaks? (in )?greek|in greek|answers? in greek|translat|μιλαει (στα )?ελληνικα|απανταει (στα )?ελληνικα|ελληνικα στο μαθημα|μεταφραζ') },
    { id: 'effort', kind: 'worry', sev: 1, label: 'Low effort', icon: 'fa-battery-quarter', group: 'habits',
        re: rx('lazy|doesn\'?t try|does not try|no effort|little effort|unmotivated|not interested|uninterested|can\'?t be bothered|minimum effort|τεμπελ|δεν προσπαθ|καμια προσπαθ|αδιαφορ|δεν ενδιαφερ|δεν εχει ορεξη') }
];
const EXTRA_BY_ID = new Map(ORACLE_EXTRA_THEMES.map((t) => [t.id, t]));

// Homework, chatty and materials wordings, curly apostrophes and happy bare-skill notes are
// all read by the shared reader (features/classGreenhouseNotes.mjs), one source of truth.
const EXTRA_BETTER = rx('improv|better|progress|no longer|now (tries|tries hard|speaks english|answers in english)|βελτιω|καλυτερ|πλεον|πια δεν|τωρα προσπαθ');

/** Theme metadata, from the shared reader or the Oracle's own two. */
export function themeMeta(id) {
    return noteTheme(id) || EXTRA_BY_ID.get(id) || { id, label: id, icon: 'fa-circle', kind: 'learning', group: 'learning' };
}

// Background written for the teacher only: never sent into a parent summary.
export const SENSITIVE_THEMES = new Set(['home', 'support', 'worry']);

// What a full picture of an English learner touches. Each has the themes that count as covering it.
const COVERAGE = [
    { id: 'speaking', label: 'Speaking', covers: ['speaking', 'pronunciation', 'shy', 'greek'], ask: 'Does {n} speak English in class: single words, short phrases or full sentences? With the whole class or only in pairs?' },
    { id: 'listening', label: 'Listening', covers: ['listening'], ask: 'Can {n} follow your English instructions without a Greek translation or a neighbour\'s help?' },
    { id: 'reading', label: 'Reading', covers: ['reading'], ask: 'How does {n} read aloud: smoothly, word by word, or guessing from the first letter?' },
    { id: 'writing', label: 'Writing', covers: ['writing', 'spelling', 'grammar'], ask: 'When {n} writes, are the sentences full and their own, copied, or mostly single words?' },
    { id: 'heart', label: 'Confidence', covers: ['shy', 'eager', 'worry', 'temper', 'progress'], ask: 'Is {n} willing to have a go in front of the class, or only when sure of the answer?' },
    { id: 'others', label: 'With classmates', covers: ['conflict', 'helper', 'leader', 'chatty', 'respect'], ask: 'Who does {n} work well with, and how does {n} manage in pair or group work?' }
];

// "I moved her seat", "we agreed", "μίλησα με τη μαμά": the moves a teacher writes down.
const TRIED_RX = rx([
    '\\<i (tried|try|gave|moved|sat|seated|paired|let|asked|agreed|spoke|talked|called|told|sent|set|made|offered|used|started|will try|\'ll try|am going to)',
    '\\<tried\\b', '\\<trying (a|an|to|out)\\b', '\\<moved (him|her|them|his|her|their)\\b', '\\<changed (his|her|their) seat', '\\<(seated|sat) (him|her|them)\\b', '\\<paired (him|her|them)\\b',
    '\\<gave (him|her|them)\\b', '\\<we agreed', '\\<agreed (that|to|on)\\b', '\\<(spoke|talked) (to|with) (his |her |their |the )?(mum|mom|dad|parents?|mother|father|family)',
    '\\<called (home|his|her|their|the)\\b', '\\<told (his |her |their )?parents', '\\<sent (a |an )?(note|message|email) home', '\\<reward chart', '\\<extra (practice|worksheet|reading|help|time)',
    '\\<buddy', '\\<will try', '\\<next (time|lesson) i\\b', '\\<plan(ning)? to\\b', '\\<going to try',
    'δοκιμασα', 'δοκιμαζω', 'θα δοκιμασ', 'αλλαξα (θεση|θεσ)', '\\<(τον|την|τους|τα) (εβαλα|καθισα|αλλαξα)', 'μιλησα (με|στη|στον|στους|στην)', 'ενημερωσα', 'συμφωνησαμε',
    '\\<(του|της|τους) (εδωσα|ζητησα|προτεινα|εβαλα)', 'τηλεφωνησα', '\\<θα (του|της|τους) ', 'καναμε συμφωνια'
].join('|').replace(/ς/g, 'σ'));

const clip = (text, max = 140) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Straight apostrophes, so "doesn’t" reads like "doesn't". */
const tidy = (text) => String(text || '').replace(/[‘’ʼ´`]/g, '\'').trim();

const toTime = (value) => {
    if (value == null) return null;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (Number.isFinite(value)) return value;
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isGood = (tone) => tone === 'strength' || tone === 'better';

/** Reads one note: shared themes and tone, the Oracle's two extra themes, and the moves it records. */
export function readOracleNote(note, index = 0, classmates = []) {
    const text = tidy(note?.noteText || note?.text);
    const source = note?.source === 'ember_oath' ? 'oath' : (note?.authorRole === 'office' ? 'office' : 'teacher');
    const shared = readSharedNote({ ...note, noteText: text, text }, classmates);
    const themes = [...shared.themes];
    const sentences = sentencesOf(text);
    if (source !== 'oath') {
        sentences.forEach((sentence) => {
            const folded = foldText(sentence);
            ORACLE_EXTRA_THEMES.forEach((theme) => {
                if (themes.some((t) => t.id === theme.id) || !theme.re.test(folded)) return;
                themes.push({ id: theme.id, tone: EXTRA_BETTER.test(folded) ? 'better' : 'worry', quote: clip(sentence) });
            });
        });
    }
    const tried = source === 'oath' ? [] : sentences.filter((s) => TRIED_RX.test(foldText(s))).map((s) => clip(s, 160));
    return {
        ref: `N${index + 1}`,
        id: note?.id || null,
        time: toTime(note?.createdAt),
        category: note?.category || 'General',
        source,
        text,
        themes,
        tone: source === 'oath' ? 'good' : toneFrom(themes, shared.tone),
        interests: shared.interests,
        mentions: shared.mentions,
        tried
    };
}

function toneFrom(themes, fallback) {
    const judged = themes.filter((t) => t.tone !== 'context');
    if (!judged.length) return fallback;
    const worries = judged.some((t) => t.tone === 'worry');
    const goods = judged.some((t) => isGood(t.tone));
    return worries && goods ? 'mixed' : worries ? 'worry' : 'good';
}

function trendOf(meta, mentions) {
    if (meta.kind === 'context') return 'context';
    const last = mentions[mentions.length - 1].tone;
    const earlier = mentions.slice(0, -1).map((m) => m.tone);
    if (!earlier.length) return last === 'worry' ? 'new-worry' : last === 'better' ? 'easing' : 'strength';
    if (last === 'worry') return earlier.some(isGood) ? 'slipping' : 'persistent';
    if (last === 'better' || earlier.includes('worry')) return 'easing';
    return 'strength';
}

export const TREND_LABEL = {
    'new-worry': 'New worry',
    persistent: 'Still there',
    slipping: 'Slipping back',
    easing: 'Getting better',
    strength: 'Strength',
    context: 'Background'
};

function recencyBoost(time, now) {
    if (time == null) return 0;
    const days = (now - time) / DAY_MS;
    return days <= 14 ? 3 : days <= 35 ? 1.5 : 0;
}

/**
 * The whole reading of one child's chronicle.
 *
 * notes       chronicle notes for this child ({ id, noteText, category, createdAt, source?, authorRole? })
 * classmates  the other children in the class ({ id, name }), to see who is written about together
 * numbers     optional facts from the rest of the app (see crossChecks)
 */
export function buildChronicleReading({ notes = [], firstName = 'This hero', classmates = [], numbers = null, now = Date.now() } = {}) {
    const name = String(firstName || 'This hero');
    const read = notes
        .filter((n) => tidy(n?.noteText || n?.text))
        .map((n) => ({ n, t: toTime(n.createdAt) ?? now }))
        .sort((a, b) => a.t - b.t)
        .map(({ n }, i) => readOracleNote(n, i, classmates));

    // Every note that touches a theme is one mention of it, with the sentence that said it.
    const byTheme = new Map();
    read.forEach((note) => note.themes.forEach((t) => {
        if (!byTheme.has(t.id)) byTheme.set(t.id, []);
        byTheme.get(t.id).push({ ref: note.ref, noteId: note.id, time: note.time, tone: t.tone, quote: t.quote, source: note.source });
    }));

    const themes = [...byTheme.entries()].map(([id, mentions]) => {
        const meta = themeMeta(id);
        const last = mentions[mentions.length - 1];
        return {
            id,
            label: meta.label,
            icon: meta.icon,
            kind: meta.kind,
            group: meta.group,
            sev: meta.sev || 1,
            sensitive: SENSITIVE_THEMES.has(id),
            count: mentions.length,
            worries: mentions.filter((m) => m.tone === 'worry').length,
            goods: mentions.filter((m) => isGood(m.tone)).length,
            firstTime: mentions[0].time,
            lastTime: last.time,
            lastTone: last.tone,
            trend: trendOf(meta, mentions),
            mentions
        };
    }).sort((a, b) => b.count - a.count || (b.lastTime || 0) - (a.lastTime || 0));

    // Threads to pick up: worries whose latest word is still a worry. Repeated, serious and recent first.
    const openThreads = themes
        .filter((t) => t.lastTone === 'worry')
        .map((t) => ({ ...t, weight: t.worries * 2 + t.sev * 2 + (t.trend === 'slipping' ? 3 : 0) + recencyBoost(t.lastTime, now) }))
        .sort((a, b) => b.weight - a.weight);
    const brightSpots = themes
        .filter((t) => isGood(t.lastTone))
        .map((t) => ({ ...t, weight: t.goods * 2 + (t.trend === 'easing' ? 3 : 0) + recencyBoost(t.lastTime, now) }))
        .sort((a, b) => b.weight - a.weight);
    const background = themes.filter((t) => t.kind === 'context');

    // What the teacher tried. A move is usually aimed at a worry already on the page, so it is
    // judged against the worries open at that point as well as the themes of its own note.
    const tried = [];
    read.forEach((note, i) => {
        if (!note.tried.length) return;
        const openThen = [...byTheme.entries()]
            .filter(([, mentions]) => {
                const upTo = mentions.filter((m) => read.findIndex((r) => r.ref === m.ref) <= i);
                return upTo.length && upTo[upTo.length - 1].tone === 'worry';
            })
            .map(([id]) => id);
        note.tried.forEach((sentence) => {
            const own = note.themes.filter((t) => t.tone === 'worry').map((t) => t.id);
            const topics = [...new Set([...own, ...openThen])];
            const verdicts = topics.map((topic) => {
                const later = read.slice(i + 1).filter((n) => n.themes.some((t) => t.id === topic));
                if (!later.length) return null;
                const lastNote = later[later.length - 1];
                return { topic, tone: lastNote.themes.find((t) => t.id === topic).tone, refs: later.map((n) => n.ref) };
            }).filter(Boolean);
            const better = verdicts.filter((v) => isGood(v.tone)).length;
            const worse = verdicts.filter((v) => v.tone === 'worry').length;
            tried.push({
                ref: note.ref,
                noteId: note.id,
                time: note.time,
                text: sentence,
                aimedAt: topics,
                outcome: !verdicts.length ? 'no-word-yet' : better > worse ? 'helping' : worse > better ? 'not-yet' : 'unclear',
                followedBy: [...new Set(verdicts.flatMap((v) => v.refs))]
            });
        });
    });

    // Gaps: parts of a full picture the notes have not looked at yet.
    const covered = new Set(themes.map((t) => t.id));
    const mentionedSomeone = read.some((n) => n.mentions.length);
    const gaps = COVERAGE
        .filter((c) => !c.covers.some((id) => covered.has(id)) && !(c.id === 'others' && mentionedSomeone))
        .map((c) => ({ id: c.id, label: c.label, ask: c.ask.replace(/\{n\}/g, name) }));

    // Classmates written about together, and what lights this child up.
    const byId = new Map(classmates.map((c) => [c.id, c]));
    const people = new Map();
    read.forEach((note) => note.mentions.forEach((id) => {
        const rough = note.themes.some((t) => ['conflict', 'respect', 'chatty'].includes(t.id) && t.tone === 'worry');
        const p = people.get(id) || { id, first: String(byId.get(id)?.name || '').trim().split(/\s+/)[0] || 'a classmate', warm: 0, friction: 0, refs: [] };
        if (rough) p.friction += 1; else if (note.tone === 'good' || note.themes.some((t) => isGood(t.tone))) p.warm += 1;
        p.refs.push(note.ref);
        people.set(id, p);
    }));
    const interestCounts = new Map();
    read.forEach((note) => note.interests.forEach((id) => interestCounts.set(id, (interestCounts.get(id) || 0) + 1)));
    const passions = [...interestCounts.entries()]
        .map(([id, count]) => {
            const i = INTERESTS.find((x) => x.id === id);
            return i ? { id, label: i.label, icon: i.icon, words: i.words || [], count } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count);

    const written = read.filter((n) => n.source !== 'oath');
    const lastNoteTime = read.length ? read[read.length - 1].time : null;
    const tone = { worry: 0, good: 0, mixed: 0, neutral: 0 };
    written.forEach((n) => { tone[n.tone] = (tone[n.tone] || 0) + 1; });
    const balance = written.length >= 3 && tone.good === 0 && tone.mixed === 0 && tone.worry > 0 ? 'only-worries'
        : written.length >= 3 && tone.worry === 0 && tone.mixed === 0 && tone.good > 0 ? 'only-praise' : 'balanced';

    const reading = {
        firstName: name,
        notes: read,
        noteCount: read.length,
        writtenCount: written.length,
        keptOaths: read.filter((n) => n.source === 'oath').map((n) => ({ ref: n.ref, text: n.text, time: n.time })),
        span: read.length ? { from: read[0].time, to: lastNoteTime } : null,
        daysSinceNote: lastNoteTime == null ? null : Math.max(0, Math.floor((now - lastNoteTime) / DAY_MS)),
        recentNotes: read.filter((n) => n.time != null && now - n.time <= 30 * DAY_MS).length,
        tone,
        balance,
        themes,
        openThreads,
        brightSpots,
        background,
        tried,
        gaps,
        people: [...people.values()].sort((a, b) => (b.warm + b.friction) - (a.warm + a.friction)),
        passions,
        cross: [],
        numbers: numbers || null
    };
    reading.cross = crossChecks(reading, numbers);
    reading.headline = headline(reading);
    return reading;
}

const themeById = (reading, id) => reading.themes.find((t) => t.id === id) || null;
const worried = (t) => t && t.lastTone === 'worry';
const praised = (t) => t && isGood(t.lastTone);

/**
 * Where the notes and the numbers meet. numbers (all optional):
 *   trials   { count, avg, classAvg, testAvg, classTestAvg, dictAvg, classDictAvg, momentum: { dir, delta } }
 *   stars    { total, recent30, byVirtue: { teamwork, creativity, respect, focus } }
 *   absences30, missedPapers
 */
export function crossChecks(reading, numbers) {
    const out = [];
    if (!numbers) return out;
    const n = reading.firstName;
    const push = (kind, text, themeId = null) => out.push({ kind, text, themeId });
    const { trials, stars, absences30 = 0, missedPapers = 0 } = numbers;
    const gapOf = (paper) => {
        const mine = paper === 'dictation' ? trials?.dictAvg : trials?.testAvg;
        const cls = paper === 'dictation' ? trials?.classDictAvg : trials?.classTestAvg;
        return Number.isFinite(mine) && Number.isFinite(cls) ? mine - cls : null;
    };
    const paperName = (paper) => (paper === 'dictation' ? 'dictations' : 'tests');

    // Learning worries set against the paper that tests that skill.
    reading.themes.filter((t) => worried(t) && themeMeta(t.id).paper).forEach((t) => {
        const paper = themeMeta(t.id).paper;
        const gap = gapOf(paper);
        if (gap == null) return;
        if (gap >= 8) push('disagree', `The notes worry about ${t.label.toLowerCase()}, yet ${n}'s ${paperName(paper)} run ${Math.round(gap)} points above the class. The trouble may show in free work rather than in prepared papers, or it may already be easing.`, t.id);
        else if (gap <= -8) push('agree', `The ${paperName(paper)} back up the ${t.label.toLowerCase()} worry: ${Math.round(-gap)} points under the class average.`, t.id);
    });
    ['dictation', 'test'].forEach((paper) => {
        const gap = gapOf(paper);
        const named = reading.themes.some((t) => themeMeta(t.id).paper === paper);
        if (gap != null && gap <= -12 && !named) {
            push('unseen', `${n}'s ${paperName(paper)} sit ${Math.round(-gap)} points under the class, but no note says which part of the language is hard${paper === 'dictation' ? ' (spelling? new words?)' : ' (grammar? reading? writing?)'}.`);
        }
    });

    const mom = trials?.momentum;
    const keen = themeById(reading, 'eager');
    const progress = themeById(reading, 'progress');
    if (mom?.dir === 'down' && (praised(keen) || praised(progress))) {
        push('disagree', `The notes sound upbeat, but the latest papers dropped ${Math.round(Math.abs(mom.delta))} points. The willingness is there; the next step may be how ${n} revises.`);
    }
    if (mom?.dir === 'up' && reading.openThreads.some((t) => themeMeta(t.id).paper)) {
        push('agree', `Marks are climbing (+${Math.round(mom.delta)} points) while a learning worry is still open in the notes. It may be time to write that it is easing.`);
    }

    const v = stars?.byVirtue || {};
    if (worried(themeById(reading, 'focus')) && (v.focus || 0) >= 3) push('disagree', `Focus is a worry in the notes, yet ${n} has ${v.focus} Focus stars. Note when focus does work: the time, the task or the seat.`, 'focus');
    if ((worried(themeById(reading, 'respect')) || worried(themeById(reading, 'chatty'))) && (v.respect || 0) >= 3) {
        push('agree', `${n} still earns Respect stars (${v.respect}) while conduct notes worry. The good moments are there to build on.`);
    }
    if (stars && stars.total >= 8) {
        const missing = ['teamwork', 'creativity', 'respect', 'focus'].filter((k) => !v[k]).map((k) => k[0].toUpperCase() + k.slice(1));
        if (missing.length && missing.length < 4) push('unseen', `${n} has ${stars.total} stars but none for ${missing.join(' or ')} yet.`);
    }
    if (stars && stars.recent30 === 0) push('unseen', `No stars for ${n} in the last 30 days.`);

    if (absences30 >= 3 && !themeById(reading, 'late')) push('unseen', `${absences30} absences in the last 30 days, and no note about them yet.`);
    if (missedPapers >= 2) push('unseen', `${missedPapers} papers the class sat still have no mark for ${n}.`);
    if (reading.daysSinceNote != null && reading.daysSinceNote >= 21 && ((stars?.recent30 || 0) > 0 || (trials?.count || 0) > 0)) {
        push('quiet', `The chronicle has been quiet for ${reading.daysSinceNote} days while ${n} kept working. A short note brings the reading up to date.`);
    }
    return out;
}

function listText(items) {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function headline(reading) {
    const n = reading.firstName;
    if (!reading.noteCount) return `No notes for ${n} yet. The Oracle reads what you write, so a few honest lines go a long way.`;
    const top = reading.themes.filter((t) => !t.sensitive).slice(0, 3).map((t) => t.label.toLowerCase());
    const open = reading.openThreads[0];
    const bright = reading.brightSpots[0];
    const parts = [`${reading.noteCount} note${reading.noteCount === 1 ? '' : 's'} read${top.length ? `, mostly about ${listText(top)}` : ''}.`];
    if (open) parts.push(`The thread to pick up: ${open.label.toLowerCase()} (${TREND_LABEL[open.trend].toLowerCase()}).`);
    if (bright) parts.push(bright.trend === 'easing' ? `Getting better: ${bright.label.toLowerCase()}.` : `Brightest spot: ${bright.label.toLowerCase()}.`);
    if (!reading.themes.length) parts.push('The notes do not name a skill or habit yet, so the counsels will have little to hold on to.');
    return parts.join(' ');
}

// ---------------------------------------------------------------- AI brief and cache key

const fmtDay = (time) => (time == null ? '?' : new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

const OUTCOME_TEXT = {
    helping: 'later notes sound better',
    'not-yet': 'later notes still worry',
    unclear: 'later notes are mixed',
    'no-word-yet': 'no later note yet'
};

/**
 * The brief the AI counsels read: numbered notes in the teacher's own words (the most recent
 * when there are many), the reading, and the numbers. For a parent summary, notes about home,
 * health, support needs or anxiety are left out entirely.
 */
export function oracleBrief(reading, { audience = 'teacher', league = '', ageGroup = '', heroClass = '', oaths = [], maxNotes = 36, maxNoteChars = 420 } = {}) {
    const forParent = audience === 'parent';
    const n = reading.firstName;
    const lines = [];
    lines.push(`HERO: ${n}${league ? ` · Quest League ${league}` : ''}${ageGroup ? ` (age ${ageGroup})` : ''}${heroClass ? ` · hero class ${heroClass}` : ''}`);
    if (reading.span) lines.push(`CHRONICLE: ${reading.noteCount} notes from ${fmtDay(reading.span.from)} to ${fmtDay(reading.span.to)}; last note ${reading.daysSinceNote === 0 ? 'today' : reading.daysSinceNote === 1 ? 'yesterday' : `${reading.daysSinceNote} days ago`}; tone: ${reading.tone.good} encouraging, ${reading.tone.worry} worried, ${reading.tone.mixed} mixed.`);
    else lines.push('CHRONICLE: no notes yet.');

    const sensitiveNote = (note) => note.themes.some((t) => SENSITIVE_THEMES.has(t.id));
    const kept = reading.notes.slice(-maxNotes);
    if (kept.length) {
        if (kept.length < reading.notes.length) lines.push(`(${reading.notes.length - kept.length} older notes not shown; their themes are counted below.)`);
        lines.push('', 'TEACHER\'S NOTES (oldest first, in the teacher\'s words):');
        kept.forEach((note) => {
            if (forParent && sensitiveNote(note)) return;
            const who = note.source === 'oath' ? ' · a kept Ember Oath' : note.source === 'office' ? ' · school office' : '';
            lines.push(`[${note.ref}] ${fmtDay(note.time)} · ${note.category}${who}: ${clip(note.text, maxNoteChars)}`);
        });
    }

    // For families, anything read from a private background note is left out with the note.
    const hidden = new Set(forParent ? reading.notes.filter(sensitiveNote).map((n) => n.ref) : []);
    const visible = (t) => !(forParent && (t.sensitive || t.mentions.every((m) => hidden.has(m.ref))));
    const shownThemes = reading.themes.filter(visible);
    if (shownThemes.length) {
        lines.push('', `THEMES THE NOTES RETURN TO (automatic keyword reading; trust the note text over it):`);
        shownThemes.slice(0, 12).forEach((t) => {
            const mentions = t.mentions.filter((m) => !hidden.has(m.ref));
            const latest = mentions[mentions.length - 1];
            lines.push(`- ${t.label}: ${TREND_LABEL[t.trend]}; ${mentions.length} note${mentions.length === 1 ? '' : 's'} (${mentions.map((m) => m.ref).join(', ')})${forParent ? '' : `; latest [${latest.ref}] "${latest.quote}"`}${t.sensitive ? ' (private background)' : ''}`);
        });
    }
    const open = reading.openThreads.filter(visible);
    if (open.length) lines.push(`OPEN THREADS, most pressing first: ${open.slice(0, 4).map((t) => t.label).join('; ')}`);
    const bright = reading.brightSpots.filter(visible);
    if (bright.length) lines.push(`BRIGHT SPOTS: ${bright.slice(0, 4).map((t) => t.label).join('; ')}`);
    if (!forParent && reading.tried.length) {
        lines.push('ALREADY TRIED BY THE TEACHER:');
        reading.tried.slice(-6).forEach((t) => lines.push(`- [${t.ref}] "${t.text}" → ${OUTCOME_TEXT[t.outcome]}`));
    }
    if (!forParent && reading.people.length) {
        lines.push(`CLASSMATES WRITTEN ABOUT WITH ${n.toUpperCase()}: ${reading.people.slice(0, 5).map((p) => `${p.first} (${p.friction > p.warm ? 'friction' : p.warm ? 'works well together' : 'named together'})`).join('; ')}`);
    }
    if (reading.passions.length) lines.push(`PASSIONS FOUND IN THE NOTES: ${reading.passions.map((p) => p.label).join(', ')}`);
    if (!forParent && reading.gaps.length) lines.push(`NOT IN THE NOTES YET: ${reading.gaps.map((g) => g.label).join(', ')}`);
    if (!forParent && reading.balance !== 'balanced') lines.push(`BALANCE: the notes so far are ${reading.balance === 'only-worries' ? 'only worries, with no strength written down' : 'only praise, with no worry written down'}.`);

    const num = reading.numbers;
    if (num) {
        lines.push('', 'NUMBERS FROM THE APP:');
        const t = num.trials;
        const pct = (v) => (Number.isFinite(v) ? `${Math.round(v)}%` : 'n/a');
        if (t && t.count) {
            lines.push(`- Papers: ${t.count} marked; overall ${pct(t.avg)} (class ${pct(t.classAvg)}); tests ${pct(t.testAvg)} (class ${pct(t.classTestAvg)}); dictations ${pct(t.dictAvg)} (class ${pct(t.classDictAvg)}); momentum ${t.momentum ? `${t.momentum.dir} (${t.momentum.delta >= 0 ? '+' : ''}${Math.round(t.momentum.delta)} points)` : 'not enough papers'}.`);
            if (t.recent?.length) lines.push(`- Latest papers: ${t.recent.join('; ')}`);
        } else lines.push('- Papers: none marked yet.');
        if (num.stars) {
            const v = num.stars.byVirtue || {};
            lines.push(`- Stars this year: ${num.stars.total} (last 30 days ${num.stars.recent30}); Teamwork ${v.teamwork || 0}, Creativity ${v.creativity || 0}, Respect ${v.respect || 0}, Focus ${v.focus || 0}.`);
            if (!forParent && num.stars.recentNotes?.length) lines.push(`- Words written with recent stars: ${num.stars.recentNotes.join('; ')}`);
        }
        if (!forParent) lines.push(`- Absences in the last 30 days: ${num.absences30 || 0}. Papers with no mark yet: ${num.missedPapers || 0}.`);
    }
    if (!forParent && reading.cross.length) {
        lines.push('', 'WHERE NOTES AND NUMBERS MEET:');
        reading.cross.forEach((c) => lines.push(`- (${c.kind}) ${c.text}`));
    }
    if (oaths.length) {
        lines.push('', 'EMBER OATHS (personal promises, not grades):');
        oaths.slice(-6).forEach((o) => lines.push(`- ${o.status}: "${clip(o.text, 160)}"${!forParent && o.reflection?.helped ? ` · what helped: ${clip(o.reflection.helped, 120)}` : ''}`));
    }
    return lines.join('\n');
}

/** Small stable hash: same records, same key, on any computer. */
export function hashText(text) {
    let h = 5381;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

/** Changes whenever a note is added or edited, or the numbers move. */
export function readingFingerprint(reading, extra = '') {
    const notes = reading.notes.map((n) => `${n.id || n.ref}:${hashText(n.text)}`).join('|');
    const num = reading.numbers;
    const numKey = num ? [num.trials?.count || 0, Math.round(num.trials?.avg || 0), num.stars?.total || 0, num.absences30 || 0].join('.') : '';
    return hashText(`${notes}#${numKey}#${extra}`);
}
