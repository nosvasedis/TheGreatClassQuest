// features/classGreenhouseNotes.mjs
// The Greenhouse's note reader: what the teacher actually WROTE in the Hero's Chronicle,
// read sentence by sentence (English and Greek), turned into class-wide understanding.
//
//   per note      themes (what it is about), tone (worry / getting better / strength),
//                 the sentence that said it, interests, and classmates it mentions
//   per child     open worries, strengths, what is getting better, follow-ups that went quiet
//   per class     the same worry across several children (a small group, a class routine),
//                 shared strengths (buddies and roles), shared interests (lesson hooks),
//                 who is written about together (friction to keep apart, good partners)
//                 and how balanced the notes themselves are.
//
// Pure keyword reading on this laptop: no AI, nothing leaves the device. The Hero's Chronicle
// stays the place to write and to ask the Oracle about one child; this reads across all of them.

import { foldText, INTERESTS } from './oathForge.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const L = '(?<!\\p{L})'; // word start that works for Greek letters too (\b does not)
const rx = (src) => new RegExp(src.replace(/\\</g, L), 'u');

/**
 * Note themes. Patterns run on accent-folded lower-case text (ς → σ); "\<" marks a word start.
 *   kind   'worry' (a concern by default), 'learning' (a skill: worry or strength by tone),
 *          'strength' (good by default), 'context' (sensitive background, never a judgement)
 *   sev    how strongly an open worry should pull the teacher's attention (1-2)
 */
export const NOTE_THEMES = [
    // Behaviour and habits
    { id: 'chatty', kind: 'worry', sev: 1, label: 'Talks over others', icon: 'fa-comment-dots', group: 'behaviour',
        good: rx('less (chatty|talkative)|waits? (for )?(his|her|their) turn|puts? (his|her|their) hand up|λιγοτερο φλυαρ|περιμενει τη σειρα'),
        re: rx('chatty|talkative|talks? (a lot|all the time|during|too much)|calls? out|shouts? out|interrupt|φλυαρ|μιλαει (πολυ|συνεχεια|ολη)|μιλα (πολυ|συνεχεια)|διακοπτ|πεταγεται|φωναζει'),
        techniques: ['talking-token', 'quiet-signal'], action: (n) => `Agree a hand signal with ${n} before the lesson, and star the first time they wait.` },
    { id: 'focus', kind: 'worry', sev: 1, label: 'Hard to focus', icon: 'fa-eye', group: 'behaviour',
        good: rx('more (focused|attentive|concentrated)|focus(es|ed)? better|concentrat\\p{L}* better|pays? attention|πιο (συγκεντρωμ|προσεκτικ)|προσεχει (πια|πλεον|περισσοτερο)'),
        re: rx('distract|loses? focus|lack of (focus|concentration)|can\'?t (focus|concentrate)|not (focused|concentrating|paying attention)|daydream|fidget|restless|αφηρημεν|αφαιρει|δεν (προσεχει|συγκεντρων)|συγκεντρωση|χαζευ|ανησυχο παιδι|δεν καθεται'),
        techniques: ['seat-near', 'countdown-start', 'brain-break'], action: (n) => `Seat ${n} near you and give the task in two short steps.` },
    { id: 'homework', kind: 'worry', sev: 1, label: 'Homework not done', icon: 'fa-book', group: 'habits',
        good: rx('(always|now) (does|brings|hands in) (his |her |their |the )?homework|homework (is )?(always )?(done|complete)|κανει (παντα |πλεον )?τις (εργασι|ασκησ)'),
        re: rx('(no|didn\'?t do|forgot|forgets|missing|without|incomplete|unfinished|never does) (his |her |the |their )?homework|homework (missing|not done|incomplete|again)|δεν (εκανε|κανει|εφερε|φερνει) (την |τις )?(εργασι|ασκησ)|ξεχ[αν].{0,20}(εργασι|ασκησ)|(εργασι|ασκησ)\\p{L}* (λειπ|δεν)'),
        techniques: ['homework-checkpoint'], action: (n) => `Check ${n}'s homework quietly in the first minute, and praise any part that is done.` },
    { id: 'materials', kind: 'worry', sev: 1, label: 'Forgets books and things', icon: 'fa-bag-shopping', group: 'habits',
        good: rx('(always|now) brings (his |her |their )?(book|things|materials)|φερνει (πλεον |παντα )?(τα πραγματα|το βιβλι)'),
        re: rx('(forg[eo]t|forgets|didn\'?t bring|doesn\'?t bring|without) (his |her |their |the )?(book|notebook|copybook|pencil|pen|case|materials|folder)|ξεχ[αν].{0,25}(βιβλι|τετραδ|μολυβ|κασετιν|υλικ)|δεν (εφερε|φερνει) (το |τα )?(βιβλι|τετραδ|μολυβ|κασετιν)'),
        techniques: ['ready-kit'], action: (n) => `Keep a spare book and pencil ready for ${n}, without a fuss.` },
    { id: 'late', kind: 'worry', sev: 1, label: 'Arrives late', icon: 'fa-clock', group: 'habits',
        good: rx('(on time|punctual)|στην ωρα (του|της)'),
        re: rx('\\<late\\b|lateness|arrives? late|came late|αργει|αργησε|καθυστερ|αργοπορ'),
        techniques: ['bell-work'], action: (n) => `Have a starter task on the desk so ${n} can begin the moment they arrive.` },
    { id: 'conflict', kind: 'worry', sev: 2, label: 'Friction with classmates', icon: 'fa-people-arrows', group: 'behaviour',
        good: rx('(gets on|getting on|plays nicely|made up|friends again) with|τα βρηκαν|ειναι φιλοι (πια|ξανα)|παιζουν (μαζι|ωραια)'),
        re: rx('fight|fought|argu|quarrel|teas|bull(y|ies|ied)|push(es|ed)? |hit(s|ting)? |mean to|picks? on|calls? (him|her|them) names|μαλων|μαλωσ|καβγ|τσακων|πειραζ|κοροιδ|χτυπ|σπρωχν|βρισ|εκφοβι'),
        techniques: ['restorative-chat', 'seat-plan'], action: (n) => `Seat ${n} away from the classmates in your notes, and greet them warmly at the door.` },
    { id: 'respect', kind: 'worry', sev: 2, label: 'Rude or answers back', icon: 'fa-hand', group: 'behaviour',
        good: rx('(more )?(polite|respectful)|πιο ευγενικ'),
        re: rx('rude|cheeky|disrespect|answers? back|talks? back|refus(es|ed) to|defian|αγενη|αυθαδ|απαντα πισω|ασεβ|αρνηθηκε|αρνειται'),
        techniques: ['restorative-chat', 'kind-words-wall'], action: (n) => `Give ${n} a real job in the lesson; one calm private word if it happens again.` },
    { id: 'temper', kind: 'worry', sev: 2, label: 'Frustration and temper', icon: 'fa-fire', group: 'wellbeing',
        good: rx('(calmer|more patient|keeps (his|her|their) cool)|πιο ηρεμ|ηρεμησε'),
        re: rx('frustrat|angry|anger|temper|tantrum|upset when|gives? up|loses? (his|her|their) temper|θυμων|θυμο|νευρ|εκνευρ|ξεσπα|τα παραταει|τα παρατησε'),
        techniques: ['calm-corner', 'success-first'], action: (n) => `Start ${n} on a task they can finish, and offer a calm minute before it boils over.` },

    // Wellbeing
    { id: 'shy', kind: 'worry', sev: 1, label: 'Shy to speak', icon: 'fa-user-secret', group: 'wellbeing',
        good: rx('more confident|speaks (more|up)|less shy|participates more|raises? (his|her|their) hand|πιο (θαρρετ|σιγουρ)|συμμετεχει (περισσοτερο|πια|πλεον)|μιλαει (πια|πλεον|περισσοτερο)'),
        re: rx('\\<shy|timid|very quiet|too quiet|hardly (speaks|talks)|doesn\'?t (speak|talk|participate)|rarely (speaks|participates)|reserved|hesitant|ντροπαλ|σιωπηλ|διστακτικ|δεν μιλα|δεν συμμετεχει|κλειστο παιδι|κλειστη|συνεσταλμ'),
        techniques: ['choral-drill', 'think-pair-share'], action: (n) => `Let ${n} rehearse with a partner first, then ask them a question you know they can answer.` },
    { id: 'worry', kind: 'worry', sev: 2, label: 'Anxious or low', icon: 'fa-cloud-rain', group: 'wellbeing',
        good: rx('(calmer|more relaxed|happier|more settled)|πιο (ηρεμ|χαρουμεν|χαλαρ)'),
        re: rx('anxious|anxiety|nervous|stressed|worri(ed|es)|afraid|scared|cries|cried|crying|sad\\b|low confidence|lacks? confidence|insecure|αγχ|φοβαται|φοβηθηκε|ανησυχ|κλαι|εκλαψε|στεναχωρ|λυπημεν|αυτοπεποιθ|ανασφαλ'),
        techniques: ['calm-corner', 'success-first'], action: (n) => `A quiet word with ${n} at the start, and a low-stakes first task.` },
    { id: 'tired', kind: 'worry', sev: 1, label: 'Tired in lessons', icon: 'fa-bed', group: 'wellbeing',
        good: rx('more (awake|alert|energetic)|πιο ξεκουραστ'),
        re: rx('tired|sleepy|exhausted|yawn|falls? asleep|κουρασμεν|νυσταζ|νυσταγμεν|κοιμαται'),
        techniques: ['brain-break', 'tpr-warmup'], action: (n) => `Give ${n} an active job early (handing out, board writer).` },
    { id: 'newcomer', kind: 'context', sev: 1, label: 'New to the class', icon: 'fa-door-open', group: 'wellbeing',
        re: rx('new (student|pupil|to the class|to our class|this year)|just joined|joined (us|the class)|νεος μαθητ|νεα μαθητρ|καινουργι(ος|α) (μαθητ|στην ταξη)|ηρθε φετος|μετεγγραφ'),
        techniques: ['buddy', 'welcome-back'], action: (n) => `Pair ${n} with a kind helper for today's pair work.` },
    { id: 'support', kind: 'context', sev: 1, label: 'Learning support need', icon: 'fa-universal-access', group: 'wellbeing',
        re: rx('dyslex|adhd|add\\b|learning (difficult|disabilit|need)|special (needs|education)|diagnos|assessment centre|δυσλεξ|δεπυ|μαθησιακ|ειδικ(ες|η) (εκπαιδευτικ|μαθησιακ|αναγκ)|διαγνωσ|κεδασυ|κεπεα|γνωματευσ'),
        techniques: ['access-adjust', 'chunk-task'], action: (n) => `Give ${n} the adjusted version: bigger print, fewer items, a little more time.` },
    { id: 'home', kind: 'context', sev: 2, label: 'Home or health situation', icon: 'fa-house-chimney-crack', group: 'wellbeing',
        re: rx('divorc|separat|hospital|\\<ill\\b|illness|sick|surgery|operation|passed away|died|bereave|family (problem|issue|situation)|moved house|new baby|διαζυγ|χωρισ(αν|ει|μ)|νοσοκομει|αρρωστ|εγχειρησ|χειρουργ|πεθαν|απεβιωσ|πενθ|οικογενειακ(ο|α|ες) (θεμα|προβλημ)|μετακομισ'),
        techniques: ['check-in', 'two-by-ten'], action: (n) => `A gentle, private check-in with ${n}. No pressure today.` },

    // Learning (worry or strength depending on how it was written)
    { id: 'spelling', kind: 'learning', sev: 1, label: 'Spelling', icon: 'fa-spell-check', group: 'learning', paper: 'dictation',
        re: rx('spell|misspel|ορθογραφ|λαθη στις λεξεις'), techniques: ['look-cover-write', 'phonics-chunks'],
        action: (n) => `Three tricky words for ${n} with look, say, cover, write, check.` },
    { id: 'reading', kind: 'learning', sev: 1, label: 'Reading', icon: 'fa-book-open-reader', group: 'learning', paper: 'test',
        re: rx('reading|reads? (slow|well|aloud|fluent)|decod|αναγνωσ|διαβαζει|διαβασμα|δυσκολευεται να διαβασ'), techniques: ['paired-reading', 'pre-teach'],
        action: (n) => `Pair ${n} with a steady reader for the text, and pre-teach two words.` },
    { id: 'writing', kind: 'learning', sev: 1, label: 'Writing', icon: 'fa-pen-nib', group: 'learning', paper: 'test',
        re: rx('writing|writes|sentences?\\b|paragraph|composition|essay|handwriting|γραφει|γραψιμο|γραπτ|εκθεσ|προτασ|γραφικο χαρακτηρα'), techniques: ['model-text', 'sentence-frames'],
        action: (n) => `Give ${n} a model sentence to copy the shape of, then change two words.` },
    { id: 'speaking', kind: 'learning', sev: 1, label: 'Speaking', icon: 'fa-comments', group: 'learning',
        re: rx('speaking|speaks|fluen|oral|conversation|προφορικ|ομιλια|μιλαει αγγλικα|μιλα αγγλικα|ευχερει'), techniques: ['sentence-frames', 'choral-drill'],
        action: (n) => `Give ${n} a sentence frame and a partner rehearsal before speaking.` },
    { id: 'pronunciation', kind: 'learning', sev: 1, label: 'Pronunciation', icon: 'fa-volume-high', group: 'learning',
        re: rx('pronunc|accent|προφορα|προφερει'), techniques: ['minimal-pairs', 'choral-drill'],
        action: (n) => `Two minimal pairs with ${n} (ship/sheep) during the warm-up.` },
    { id: 'grammar', kind: 'learning', sev: 1, label: 'Grammar', icon: 'fa-diagram-project', group: 'learning', paper: 'test',
        re: rx('grammar|tenses?\\b|verb forms?|γραμματικ|χρονους|χρονων|ρηματ'), techniques: ['guided-discovery', 'recast'],
        action: (n) => `Give ${n} three examples of the pattern and let them spot the rule.` },
    { id: 'vocabulary', kind: 'learning', sev: 1, label: 'Vocabulary', icon: 'fa-font', group: 'learning', paper: 'dictation',
        re: rx('vocabular|new words|word(s)? (learn|memor)|λεξιλογ|λεξεις|λεξουλ'), techniques: ['word-wall', 'retrieval-starter'],
        action: (n) => `Ask ${n} two words from the word wall at the start.` },
    { id: 'listening', kind: 'learning', sev: 1, label: 'Listening', icon: 'fa-headphones', group: 'learning',
        re: rx('listening|understand(s|ing)? (instructions|what)|doesn\'?t understand|ακουστικ|καταλαβαινει|δεν καταλαβ|κατανοησ'), techniques: ['listen-for-three', 'tpr-warmup'],
        action: (n) => `Check ${n} understood the instruction: ask them to show you the first step.` },

    // Strengths
    { id: 'helper', kind: 'strength', label: 'Kind helper', icon: 'fa-hands-holding-child', group: 'strength',
        re: rx('helps? (others|everyone|classmates|friends|the class|a classmate)|helpful|kind\\b|kindness|caring|generous|βοηθα|βοηθησε|ευγενικ|καλοσυνατ|προθυμ|νοιαζεται'),
        techniques: ['buddy', 'expert-role'] },
    { id: 'leader', kind: 'strength', label: 'Natural leader', icon: 'fa-flag', group: 'strength',
        re: rx('leader|leads? (the|his|her|their)|organis|ηγετικ|οργανων|συντονιζ'), techniques: ['expert-role', 'numbered-heads'] },
    { id: 'creative', kind: 'strength', label: 'Creative', icon: 'fa-palette', group: 'strength',
        re: rx('creativ|imaginat|original ideas|artistic|δημιουργικ|φαντασια|ευρηματικ'), techniques: ['creative-twist', 'draw-describe'] },
    { id: 'eager', kind: 'strength', label: 'Eager to take part', icon: 'fa-hand-sparkles', group: 'strength',
        re: rx('eager|enthusias|participat(es|ed) (a lot|well|actively)|always (ready|volunteers|raises)|volunteer|motivated|keen|ενθουσια|συμμετεχει (ενεργα|πολυ)|πρωτος να|ορεξη|ενεργ'), techniques: ['expert-role'] },
    { id: 'ahead', kind: 'strength', label: 'Ahead, needs stretch', icon: 'fa-rocket', group: 'strength',
        re: rx('finishes? (early|first|quickly)|bored|too easy|gifted|advanced|very strong|top of the class|ahead of|τελειωνει (πρωτ|γρηγορ|νωρις)|βαριεται|πολυ ευκολ|προχωρημεν|ταλεντ|αριστ'), techniques: ['must-should-could', 'extension-question'] },
    { id: 'progress', kind: 'strength', label: 'Making progress', icon: 'fa-arrow-trend-up', group: 'strength',
        re: rx('improv|progress|much better|getting better|βελτιω|προοδ|πολυ καλυτερ|καλυτερευ'), techniques: ['postcard-home'] }
];
const THEME_BY_ID = new Map(NOTE_THEMES.map((t) => [t.id, t]));
export const noteTheme = (id) => THEME_BY_ID.get(id) || null;

const PRAISE = rx('great|excellent|well done|proud|brilliant|wonderful|fantastic|amazing|lovely|impressive|very good|good at|strong|confident|μπραβο|εξαιρετ|τελει|πολυ καλ|υπεροχ|θαυμασ|περηφαν|δυνατ(ος|η) στ|σιγουρ');
const CONCERN = rx('\\<not\\b|n\'t|never|struggl|difficult|hard for|problem|issue|weak|poor|again|keeps|refus|worse|careless|mistakes|slow|behind|below|needs (help|support|practice|work)|αργ(ος|η|α|ει)|πισω|χρειαζεται (βοηθ|εξασκ|δουλει)|\\<δεν(?!\\p{L})|δυσκολ|προβλημα|αδυναμ|αδυνατ|ξανα|συνεχεια|αρνειται|ποτε|χειροτερ|λαθη|απροσεξ');
// Words that put a concern on the skill itself, not on behaviour that happened during it.
const SKILL_CONCERN = rx('struggl|difficult|trouble|weak|poor|mistakes|errors|can\'?t (read|write|spell)|mix(es)? up|confus|δυσκολ|λαθη|λαθος|αδυναμ|μπερδευ');
const BETTER = rx('improv|better|progress|more (focused|confident|careful|settled)|less (chatty|shy|nervous)|no longer|now (does|brings|speaks|participates)|βελτιω|καλυτερ|προοδ|πιο (συγκεντρωμ|σιγουρ|ηρεμ|προσεκτικ)|πλεον|πια δεν');

/** Split a note into sentences, keeping the original words for quoting. */
export function sentencesOf(text) {
    return String(text || '')
        .replace(/\r/g, '')
        .split(/(?<=[.!?;·\n])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
}

function clip(s, max = 120) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function toneOf(theme, folded, category, { behaviourHere = false, strengthHere = false } = {}) {
    const praise = PRAISE.test(folded);
    const concern = CONCERN.test(folded);
    const better = BETTER.test(folded);
    // "Interrupted during the reading": the worry is the behaviour, not the reading.
    if (theme.kind === 'learning' && behaviourHere && !SKILL_CONCERN.test(folded) && !praise && !better) return null;
    if (theme.kind === 'strength') return concern && !praise ? null : 'strength';
    if (theme.kind === 'context') return 'context';
    if (better) return 'better';
    // Matched only by its "getting it right" wording ("now brings her book", "more focused")
    if (theme.good && theme.good.test(folded) && !theme.re.test(folded)) return concern ? 'worry' : 'better';
    if (theme.kind === 'worry') return 'worry';
    // learning: a skill named with praise is a strength, otherwise it was written as a worry
    if (praise && !concern) return 'strength';
    if (concern) return 'worry';
    if (praise) return 'strength';
    // A bare mention ("we did reading") says nothing either way, unless it sits in an Academic note
    // and nothing good was said in the same sentence ("helps others with the new words").
    return category === 'Academic' && !strengthHere ? 'worry' : null;
}

function nameMatcher(student) {
    const first = foldText(String(student.name || '').trim().split(/\s+/)[0] || '');
    if (first.length < 3) return null;
    // Greek and English names bend at the end (Νικος / Νικο / Νικου): match the stem.
    const stem = first.length > 4 ? first.slice(0, -1) : first;
    return new RegExp(`(?<!\\p{L})${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}{0,2}(?!\\p{L})`, 'u');
}

/**
 * Reads one note. Returns { themes:[{id, tone, quote}], interests:[id], mentions:[studentId], tone }.
 * `classmates` are the other children of the class, for "mentioned together".
 */
export function readNote(note, classmates = []) {
    const out = { themes: [], interests: [], mentions: [], tone: 'neutral' };
    if (!note || note.source === 'ember_oath') return out;
    const text = String(note.text || note.noteText || '');
    if (!text.trim()) return out;
    const seen = new Set();
    let worries = 0, goods = 0;
    sentencesOf(text).forEach((sentence) => {
        const folded = foldText(sentence);
        const here = {
            behaviourHere: NOTE_THEMES.some((t) => t.kind === 'worry' && t.re.test(folded)),
            strengthHere: NOTE_THEMES.some((t) => t.kind === 'strength' && t.re.test(folded))
        };
        NOTE_THEMES.forEach((theme) => {
            if (seen.has(theme.id) || !(theme.re.test(folded) || theme.good?.test(folded))) return;
            const tone = toneOf(theme, folded, note.category, here);
            if (!tone) return;
            seen.add(theme.id);
            out.themes.push({ id: theme.id, tone, quote: clip(sentence) });
            if (tone === 'worry') worries += 1;
            if (tone === 'strength' || tone === 'better') goods += 1;
        });
    });
    // "Progress" only stands alone; when a worry theme is already marked better it says the same thing.
    if (out.themes.some((t) => t.tone === 'better')) out.themes = out.themes.filter((t) => t.id !== 'progress');
    const foldedAll = foldText(text);
    out.interests = INTERESTS.filter((x) => new RegExp(x.re.source.replace(/ς/g, 'σ'), x.re.flags).test(foldedAll)).map((x) => x.id);
    classmates.forEach((c) => {
        const m = nameMatcher(c);
        if (m && m.test(foldedAll)) out.mentions.push(c.id);
    });
    if (!out.themes.length) {
        if (PRAISE.test(foldedAll) && !CONCERN.test(foldedAll)) goods += 1;
        else if (CONCERN.test(foldedAll)) worries += 1;
    }
    out.tone = worries && goods ? 'mixed' : worries ? 'worry' : goods ? 'good' : 'neutral';
    return out;
}

/**
 * Reads every note of the class.
 * notes: [{ id, studentId, text, category, day, source? }]   (day = day number)
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

    [...notes].filter((n) => byId.has(n.studentId)).sort((a, b) => (a.day ?? 0) - (b.day ?? 0)).forEach((n) => {
        const c = children.get(n.studentId);
        c.notes += 1;
        if (n.day != null && (c.lastDay == null || n.day > c.lastDay)) c.lastDay = n.day;
        if (n.source === 'ember_oath') return;
        c.written += 1;
        const r = readNote(n, students.filter((s) => s.id !== n.studentId));
        read.push({ ...r, studentId: n.studentId, day: n.day, id: n.id });
        c.tones[r.tone] += 1;
        r.interests.forEach((i) => c.interests.add(i));
        r.themes.forEach((t) => {
            const entry = c.themes.get(t.id) || { id: t.id, count: 0, first: n.day, last: n.day, tone: t.tone, quote: t.quote, history: [] };
            entry.count += 1;
            entry.last = n.day;
            entry.tone = t.tone; // the newest note decides where it stands now
            entry.quote = t.quote;
            entry.history.push({ day: n.day, tone: t.tone });
            c.themes.set(t.id, entry);
        });
        r.mentions.forEach((other) => {
            const [a, b] = [n.studentId, other].sort();
            const key = `${a}|${b}`;
            const p = pairs.get(key) || { a, b, friction: 0, warm: 0, days: [] };
            const rough = r.themes.some((t) => (t.id === 'conflict' || t.id === 'respect' || t.id === 'chatty') && t.tone === 'worry');
            if (rough) p.friction += 1; else if (r.tone === 'good' || r.themes.some((t) => t.tone === 'strength')) p.warm += 1;
            p.days.push(n.day);
            pairs.set(key, p);
        });
    });

    // Per child
    const perChild = new Map();
    children.forEach((c, id) => {
        const themes = [...c.themes.values()].map((t) => ({ ...t, theme: noteTheme(t.id) })).sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
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
            if (t.tone === 'worry' || t.tone === 'context') open.push({ id, first: first(id), count: t.count, last: t.last, quote: t.quote });
            if (t.tone === 'strength') strong.push({ id, first: first(id), count: t.count, last: t.last, quote: t.quote });
            if (t.tone === 'better') improving.push({ id, first: first(id), last: t.last });
        });
        open.sort((a, b) => b.count - a.count || (b.last ?? 0) - (a.last ?? 0));
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

    return { perChild, clusters, interests: interestCounts, friction, warm, tone, recentCount: recent.length, total: read.length, unwritten, onlyWorries };
}

export function themeLabel(id) {
    return noteTheme(id)?.label || id;
}

export { DAY_MS };
