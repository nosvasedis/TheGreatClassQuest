// features/classGreenhouseNotes.mjs
// The shared note reader: what the teacher actually WROTE in the Hero's Chronicle, read clause
// by clause in Greek, English or Greeklish, and turned into understanding for one child (the
// Oracle, through features/chronicleReadingCore.mjs) and for the whole class (the Greenhouse).
//
//   per note      themes (what it is about), tone (worry / getting better / strength / background),
//                 how strongly it was said (intensity 1-3), whether it is a pattern or a one-off,
//                 how sure the reading is, the sentence that said it, interests and classmates
//   per child     open worries, strengths, what is getting better, follow-ups that went quiet
//   per class     the same worry across several children, shared strengths, shared interests,
//                 who is written about together, how balanced the notes are, which languages
//
// Three readers, merged in this order (the later one wins):
//   1. the words: the pedagogical lexicon (features/noteLexicon.mjs) through the text engine
//      (features/noteTextCore.mjs), on this computer, always
//   2. the AI deep reading (note.aiReading), saved on the note by the weekly reading round
//      (ui/modals/noteAiReader.js); used only while the note text is unchanged
//   3. the teacher's own correction (note.readingFix), set from the Chronicle: always wins
//
// Pure: no DOM, no Firebase. Tested in tests/class-greenhouse-core.test.mjs and
// tests/note-text-core.test.mjs.

import { foldText, INTERESTS } from './oathForge.mjs';
import { LEXICON_THEMES, NOTE_DOMAINS, TONE_WORDS } from './noteLexicon.mjs';
import {
    compilePatterns, firstHit, hits, lookBack, clauseFlags, splitClauses, sentencesOf, readyClause,
    nameMatchers, namesChild, phoneticGreek, hashText, tidyText
} from './noteTextCore.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bumped whenever the reading changes, so cached AI pages and saved AI readings refresh once. */
export const READER_VERSION = 3;
/** The AI reading format saved on notes: { v, h, t: ["id|code|intensity|sentence"], at }. */
export const AI_READING_VERSION = 1;
/** A theme read with less confidence than this may be corrected by the AI reading. */
export const CONFIDENT = 0.6;

// ---------------------------------------------------------------- the compiled lexicon

export const NOTE_THEMES = LEXICON_THEMES.map((t) => ({
    ...t,
    re: compilePatterns({ en: t.en, el: t.gr }),
    good: t.good ? compilePatterns({ en: t.good.en, el: t.good.gr }) : null,
    except: t.except ? compilePatterns({ en: t.except.en, el: t.except.gr }) : null,
    techniques: t.techniques || []
}));
const THEME_BY_ID = new Map(NOTE_THEMES.map((t) => [t.id, t]));
export const noteTheme = (id) => THEME_BY_ID.get(id) || null;
export function themeLabel(id) {
    return noteTheme(id)?.label || id;
}
export { NOTE_DOMAINS, sentencesOf };

const PRAISE = compilePatterns({ en: TONE_WORDS.praise.en, el: TONE_WORDS.praise.gr });
const CONCERN = compilePatterns({ en: TONE_WORDS.concern.en, el: TONE_WORDS.concern.gr });
const SKILL_CONCERN = compilePatterns({ en: TONE_WORDS.skillConcern.en, el: TONE_WORDS.skillConcern.gr });
const BETTER = compilePatterns({ en: TONE_WORDS.better.en, el: TONE_WORDS.better.gr });

const TONE_CODES = { w: 'worry', b: 'better', s: 'strength', c: 'context' };
export const toneCode = (tone) => ({ worry: 'w', better: 'b', strength: 's', context: 'c' }[tone] || 'w');

function clip(s, max = 120) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// ---------------------------------------------------------------- one clause

/**
 * Decides the tone of one theme found in a clause.
 * hit: the theme's own wording; viaGood: only its "going right" wording matched;
 * neg: a negation stood just before it; ctx: the clause's tone words and flags.
 */
function judge(theme, { viaGood, neg }, ctx) {
    if (theme.kind === 'context') return neg ? null : 'context';
    if (theme.kind === 'strength') {
        if (neg) return null;
        // "Never gives up": a worry word inside the strength's own wording does not count.
        return ctx.concernOutside && !ctx.praise ? null : 'strength';
    }
    if (neg) {
        // "Doesn't pay attention", "δεν σέβεται": the good wording, denied, is the worry.
        if (viaGood) return 'worry';
        // "Δεν είναι πια ζωηρός", "not chatty any more": better. "Δεν είναι αγενής": nothing to worry about.
        if (theme.kind === 'worry') return ctx.now ? 'better' : null;
        return 'worry';
    }
    // "Interrupted during the reading": the worry is the behaviour, not the reading.
    if (theme.kind === 'learning' && ctx.behaviourHere && !ctx.skillConcern && !ctx.praise && !ctx.better) return null;
    if (ctx.better) return 'better';
    if (viaGood) {
        // "Δουλεύει πλέον μόνη της", "now brings her book": the good wording with a "now" is progress.
        if (theme.kind === 'learning') return ctx.concernOutside ? 'worry' : ctx.now ? 'better' : 'strength';
        return ctx.concernOutside ? 'worry' : 'better';
    }
    if (theme.kind === 'worry') return 'worry';
    // learning: a skill named with praise is a strength, otherwise it was written as a worry
    if (ctx.praise && !ctx.concern) return 'strength';
    if (ctx.concern) return 'worry';
    if (ctx.praise) return 'strength';
    // A bare mention ("we did reading") says nothing either way, unless it sits in an Academic note
    // and nothing good was said in the same clause. Even then it is only provisional: readNote turns
    // it into praise when the note as a whole is happy.
    return ctx.category === 'Academic' && !ctx.strengthHere ? 'bare' : null;
}

/** The clause views with one hit blanked out, to judge the words around it. */
function without(views, hit) {
    const blank = (s) => `${s.slice(0, hit.index)}${' '.repeat(hit.text.length)}${s.slice(hit.index + hit.text.length)}`;
    return hit.view === 'en' ? { en: blank(views.en), el: views.el } : { en: views.en, el: blank(views.el) };
}

/** Every theme a clause names, with tone, intensity, pattern and confidence. */
function readClause(clause, { masks, category }) {
    const { views, lang, emphasis } = readyClause(clause, masks);
    const flags = clauseFlags(views);
    const found = [];
    NOTE_THEMES.forEach((theme) => {
        const own = firstHit(theme.re, views);
        const good = own ? null : firstHit(theme.good, views);
        const hit = own || good;
        if (!hit) return;
        if (theme.except && hits(theme.except, views)) return;
        const around = lookBack(views, hit);
        found.push({ theme, hit, viaGood: !own, neg: around.negated, boost: around.boost });
    });
    const live = (f) => !(f.neg && f.theme.kind !== 'learning' && !f.viaGood);
    const ctx = {
        category,
        praise: hits(PRAISE, views),
        concern: hits(CONCERN, views),
        skillConcern: hits(SKILL_CONCERN, views),
        better: hits(BETTER, views),
        now: flags.now,
        behaviourHere: found.some((f) => f.theme.kind === 'worry' && live(f) && !f.viaGood),
        strengthHere: found.some((f) => f.theme.kind === 'strength' && live(f))
    };
    const themes = found.map((f) => {
        const tone = judge(f.theme, f, { ...ctx, concernOutside: ctx.concern && hits(CONCERN, without(views, f.hit)) });
        if (!tone) return null;
        const intensity = Math.max(1, Math.min(3, 1 + f.boost + (emphasis.shout ? 1 : 0) + (emphasis.bang ? 1 : 0)));
        let confidence = tone === 'bare' ? 0.45 : f.viaGood ? 0.8 : 0.9;
        if (flags.hedged) confidence -= 0.25;
        if (lang === 'greeklish') confidence -= 0.1;
        return { id: f.theme.id, tone, intensity, pattern: flags.pattern, confidence: Math.round(confidence * 100) / 100, lang };
    }).filter(Boolean);
    return { lang, themes };
}

// ---------------------------------------------------------------- one note

const AI_TONES = new Set(['worry', 'better', 'strength', 'context']);

/** The AI reading saved on a note, if it still belongs to this text. */
export function validAiReading(note, text) {
    const ai = note?.aiReading;
    if (!ai || ai.v !== AI_READING_VERSION || !Array.isArray(ai.t)) return null;
    return ai.h === hashText(text) ? ai : null;
}

/**
 * Reads one note. Returns
 *   { themes: [{ id, tone, quote, intensity, pattern, confidence, source }],
 *     interests: [id], mentions: [studentId], tone, lang, clear, aiRead, corrected }
 * `classmates` are the other children of the class, for "mentioned together"; `self` is the
 * child the note is about (their name is never read as a word).
 */
export function readNote(note, classmates = [], { self = null } = {}) {
    const out = { themes: [], interests: [], mentions: [], tone: 'neutral', lang: 'en', clear: false, aiRead: false, corrected: false };
    if (!note || note.source === 'ember_oath') return out;
    const text = tidyText(note.text || note.noteText || '').trim();
    if (!text) return out;

    const mates = classmates.map((c) => ({ id: c.id, m: nameMatchers(c.name) }));
    const masks = [...mates.map((x) => x.m), self ? nameMatchers(self.name) : null].filter(Boolean);
    const sentences = sentencesOf(text);
    const langs = new Set();
    const seen = new Map();

    sentences.forEach((sentence, sIndex) => {
        splitClauses(sentence).forEach((clause) => {
            const { lang, themes } = readClause(clause, { masks, category: note.category });
            langs.add(lang);
            themes.forEach((t) => {
                if (seen.has(t.id)) {
                    // The same theme twice in a note: keep the first reading, but the strongest wording.
                    const prev = seen.get(t.id);
                    prev.intensity = Math.max(prev.intensity, t.intensity);
                    if (!prev.pattern && t.pattern) prev.pattern = t.pattern;
                    return;
                }
                const entry = { id: t.id, tone: t.tone, quote: clip(sentence), sentence: sIndex, intensity: t.intensity,
                    pattern: t.pattern, confidence: t.confidence, source: 'words', exclaimed: /!\s*$/.test(sentence) };
                seen.set(t.id, entry);
                out.themes.push(entry);
            });
        });
    });

    // A bare skill in an Academic note: praise when the note is happy ("Answered in full sentences
    // during the role play! More confident with Maria."), a worry otherwise.
    const happy = out.themes.some((t) => t.tone === 'strength' || t.tone === 'better');
    out.themes.forEach((t) => {
        if (t.tone === 'bare') t.tone = happy || t.exclaimed ? 'strength' : 'worry';
        delete t.exclaimed;
    });
    // "Progress" only stands alone; when a worry theme is already marked better it says the same thing.
    // A strength that is the bright side of a worry marked better ("πιο προσεκτικός") says it twice too.
    const betterIds = new Set(out.themes.filter((t) => t.tone === 'better').map((t) => t.id));
    if (betterIds.size) out.themes = out.themes.filter((t) => t.id !== 'progress' && !(noteTheme(t.id)?.mirror && betterIds.has(noteTheme(t.id).mirror)));

    // The AI deep reading, while the note text is unchanged: adds what the words missed and settles
    // what they were unsure of.
    const ai = validAiReading(note, text);
    if (ai) {
        out.aiRead = true;
        ai.t.forEach((row) => {
            // Saved as "id|code|intensity|sentence" (Firestore keeps no nested arrays); arrays are read too.
            const parts = typeof row === 'string' ? row.split('|') : Array.isArray(row) ? row : [];
            const [id, code] = parts;
            const intensity = Number(parts[2]) || 1;
            const sIndex = Number(parts[3]) || 0;
            const tone = TONE_CODES[code];
            if (!noteTheme(id) || !AI_TONES.has(tone)) return;
            const existing = out.themes.find((t) => t.id === id);
            const i = Math.max(1, Math.min(3, Number(intensity) || 1));
            if (!existing) {
                out.themes.push({ id, tone, quote: clip(sentences[sIndex] || sentences[0] || text), sentence: sIndex, intensity: i, pattern: '', confidence: 0.75, source: 'ai' });
            } else if (existing.confidence < CONFIDENT) {
                Object.assign(existing, { tone, intensity: Math.max(existing.intensity, i), confidence: 0.75, source: 'ai' });
            }
        });
    }

    // The teacher's own correction always wins.
    const fix = note.readingFix;
    if (fix && (Array.isArray(fix.add) || Array.isArray(fix.remove))) {
        // "Not this" belongs to the words it was said about: after an edit only the additions stay.
        const sameText = !fix.h || fix.h === hashText(text);
        const removed = new Set(sameText ? (fix.remove || []).filter((id) => typeof id === 'string') : []);
        if (removed.size) { out.themes = out.themes.filter((t) => !removed.has(t.id)); out.corrected = true; }
        (fix.add || []).forEach((a) => {
            const id = a?.id;
            const tone = AI_TONES.has(a?.tone) ? a.tone : null;
            if (!noteTheme(id) || !tone || removed.has(id)) return;
            const existing = out.themes.find((t) => t.id === id);
            if (existing) Object.assign(existing, { tone, confidence: 1, source: 'teacher' });
            else out.themes.push({ id, tone, quote: clip(sentences[0] || text), sentence: 0, intensity: Math.max(1, Math.min(3, Number(a.intensity) || 1)), pattern: '', confidence: 1, source: 'teacher' });
            out.corrected = true;
        });
    }

    const foldedAll = foldText(text);
    const soundAll = phoneticGreek(foldedAll);
    out.interests = INTERESTS.filter((x) => new RegExp(x.re.source.replace(/ς/g, 'σ'), x.re.flags).test(foldedAll)).map((x) => x.id);
    mates.forEach(({ id, m }) => { if (namesChild(m, foldedAll, soundAll)) out.mentions.push(id); });

    let worries = out.themes.filter((t) => t.tone === 'worry').length;
    let goods = out.themes.filter((t) => t.tone === 'strength' || t.tone === 'better').length;
    if (!out.themes.length) {
        const views = { en: foldedAll, el: soundAll };
        if (hits(PRAISE, views) && !hits(CONCERN, views)) goods += 1;
        else if (hits(CONCERN, views)) worries += 1;
    }
    out.tone = worries && goods ? 'mixed' : worries ? 'worry' : goods ? 'good' : 'neutral';
    out.lang = langs.has('greeklish') ? 'greeklish' : langs.has('mixed') || (langs.has('el') && langs.has('en')) ? 'mixed' : langs.has('el') ? 'el' : [...langs][0] || (/[Ͱ-Ͽ]/.test(foldedAll) ? 'el' : 'en');
    out.clear = out.themes.some((t) => t.confidence >= CONFIDENT);
    return out;
}

// ---------------------------------------------------------------- the whole class

/** How much an open worry weighs: severity, how strongly it was said, and whether it is a pattern. */
export function worryWeight(theme, entry) {
    const sev = theme?.sev || 1;
    const intensity = entry?.intensity || 1;
    const pattern = entry?.pattern === 'trait' ? 1 : entry?.pattern === 'incident' ? -0.5 : 0;
    return sev + (intensity - 1) * 0.75 + pattern;
}

/**
 * Reads every note of the class.
 * notes: [{ id, studentId, text, category, day, source?, aiReading?, readingFix? }]   (day = day number)
 * students: [{ id, name }]
 */
export function readClassNotes(notes = [], students = [], today) {
    const byId = new Map(students.map((s) => [s.id, s]));
    const first = (id) => String(byId.get(id)?.name || '').trim().split(/\s+/)[0] || 'A hero';
    const children = new Map(students.map((s) => [s.id, {
        notes: 0, written: 0, lastDay: null, themes: new Map(), interests: new Set(), tones: { worry: 0, good: 0, mixed: 0, neutral: 0 }
    }]));
    const pairs = new Map(); // "a|b" → { a, b, friction, warm, days }
    const read = [];
    const languageMix = { el: 0, en: 0, greeklish: 0, mixed: 0 };
    let aiRead = 0;
    let corrected = 0;
    let unclear = 0;

    [...notes].filter((n) => byId.has(n.studentId)).sort((a, b) => (a.day ?? 0) - (b.day ?? 0)).forEach((n) => {
        const c = children.get(n.studentId);
        c.notes += 1;
        if (n.day != null && (c.lastDay == null || n.day > c.lastDay)) c.lastDay = n.day;
        if (n.source === 'ember_oath') return;
        c.written += 1;
        const r = readNote(n, students.filter((s) => s.id !== n.studentId), { self: byId.get(n.studentId) });
        read.push({ ...r, studentId: n.studentId, day: n.day, id: n.id });
        languageMix[r.lang] = (languageMix[r.lang] || 0) + 1;
        if (r.aiRead) aiRead += 1;
        if (r.corrected) corrected += 1;
        if (!r.clear) unclear += 1;
        c.tones[r.tone] += 1;
        r.interests.forEach((i) => c.interests.add(i));
        r.themes.forEach((t) => {
            const entry = c.themes.get(t.id) || { id: t.id, count: 0, first: n.day, last: n.day, tone: t.tone, quote: t.quote, history: [], intensity: 1, pattern: '' };
            entry.count += 1;
            entry.last = n.day;
            entry.tone = t.tone; // the newest note decides where it stands now
            entry.quote = t.quote;
            entry.intensity = t.intensity || 1;
            entry.pattern = t.pattern || (entry.count >= 3 && t.tone === 'worry' ? 'trait' : '');
            entry.source = t.source;
            entry.history.push({ day: n.day, tone: t.tone, intensity: t.intensity || 1 });
            c.themes.set(t.id, entry);
        });
        r.mentions.forEach((other) => {
            const [a, b] = [n.studentId, other].sort();
            const key = `${a}|${b}`;
            const p = pairs.get(key) || { a, b, friction: 0, warm: 0, days: [] };
            const rough = r.themes.some((t) => ['conflict', 'respect', 'chatty', 'bossy', 'clowning'].includes(t.id) && t.tone === 'worry');
            if (rough) p.friction += 1; else if (r.tone === 'good' || r.themes.some((t) => t.tone === 'strength')) p.warm += 1;
            p.days.push(n.day);
            pairs.set(key, p);
        });
    });

    // Per child
    const perChild = new Map();
    children.forEach((c, id) => {
        const themes = [...c.themes.values()].map((t) => ({ ...t, theme: noteTheme(t.id) })).filter((t) => t.theme).sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
        const worries = themes.filter((t) => t.tone === 'worry');
        const context = themes.filter((t) => t.tone === 'context');
        const strengths = themes.filter((t) => t.tone === 'strength');
        const better = themes.filter((t) => t.tone === 'better');
        // A worry written down and never followed up: the newest note on this child is that worry, and it is 3+ weeks old.
        const lastWorry = worries.find((t) => t.last === c.lastDay);
        const followUp = lastWorry && today != null && c.lastDay != null && today - c.lastDay >= 21
            ? { theme: lastWorry.id, day: lastWorry.last, quote: lastWorry.quote, daysAgo: today - c.lastDay }
            : null;
        perChild.set(id, {
            notes: c.notes, written: c.written, lastDay: c.lastDay,
            daysSince: c.lastDay == null || today == null ? null : today - c.lastDay,
            themes, worries, context, strengths, better, followUp,
            interests: [...c.interests],
            onlyWorries: c.written >= 2 && c.tones.good === 0 && c.tones.mixed === 0 && c.tones.worry >= 2
        });
    });

    // Class patterns
    const clusters = NOTE_THEMES.map((theme) => {
        const open = [];
        const strong = [];
        const improving = [];
        perChild.forEach((p, id) => {
            const t = p.themes.find((x) => x.id === theme.id);
            if (!t) return;
            const who = { id, first: first(id), count: t.count, last: t.last, quote: t.quote, intensity: t.intensity || 1, pattern: t.pattern || '', source: t.source || 'words' };
            if (t.tone === 'worry' || t.tone === 'context') open.push(who);
            if (t.tone === 'strength') strong.push(who);
            if (t.tone === 'better') improving.push({ id, first: first(id), last: t.last, quote: t.quote, intensity: 1, source: who.source });
        });
        open.sort((a, b) => b.count - a.count || b.intensity - a.intensity || (b.last ?? 0) - (a.last ?? 0));
        return { theme, open, strong, improving };
    }).filter((c) => c.open.length || c.strong.length || c.improving.length);

    const interestCounts = INTERESTS.map((i) => ({
        id: i.id, label: i.label, icon: i.icon, words: i.words,
        children: [...perChild.entries()].filter(([, p]) => p.interests.includes(i.id)).map(([id]) => ({ id, first: first(id) }))
    })).filter((i) => i.children.length).sort((a, b) => b.children.length - a.children.length);

    const social = [...pairs.values()].map((p) => ({ ...p, aFirst: first(p.a), bFirst: first(p.b), last: Math.max(...p.days.filter((d) => d != null), -Infinity) }));
    const friction = social.filter((p) => p.friction > 0 && p.friction >= p.warm).sort((x, y) => y.friction - x.friction);
    const warm = social.filter((p) => p.warm > 0 && p.friction === 0).sort((x, y) => y.warm - x.warm);

    // How the notes themselves read
    const recent = read.filter((r) => today == null || (r.day != null && today - r.day <= 42));
    const tone = { worry: 0, good: 0, mixed: 0, neutral: 0 };
    recent.forEach((r) => { tone[r.tone] += 1; });
    const unwritten = students.filter((s) => !perChild.get(s.id)?.written).map((s) => ({ id: s.id, first: first(s.id) }));
    const onlyWorries = [...perChild.entries()].filter(([, p]) => p.onlyWorries).map(([id]) => ({ id, first: first(id) }));

    return {
        perChild, clusters, interests: interestCounts, friction, warm, tone, recentCount: recent.length, total: read.length,
        unwritten, onlyWorries, languageMix, aiRead, corrected, unclear
    };
}

export { DAY_MS };
