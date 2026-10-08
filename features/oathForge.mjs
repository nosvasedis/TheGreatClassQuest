/**
 * The Oath Forge — the personal half of the Ember Oath suggestions. Pure logic, no DOM, no Firestore,
 * no AI: covered by tests/oath-forge.test.mjs.
 *
 * oathSuggestCore.mjs reads the child's signals (stars, scores, quiz, unit words…) and keeps the classic
 * bank. The forge adds the promises that only this child could be offered:
 *  · Passion  — what they love (mined from the teacher's Chronicle notes in English or Greek, or tapped
 *               live in the choosing ceremony): football, dance, animals, Minecraft…
 *  · Hero     — their Hero Class voice (Guardian, Sage, Paladin, Artificer, Scholar, Vanguard, Nomad,
 *               Patron) and their guild
 *  · Ladder   — the next rung above a promise they already kept, never the same step twice
 *  · Spark    — needs the teacher wrote down (shy, chatty, forgets homework, handwriting…), phrased
 *               as a small brave step, never as a label
 *  · Gift     — a class role that shares a real strength (Word Keeper, Kindness Scout…)
 *  · Quest    — word crafts built on the unit's real words
 *  · Hearth   — English carried home
 *  · Season   — birthday month, fresh start, carnival, Easter, holidays, end of year
 *
 * Every promise is first person, observable and small. The "why" is for the teacher and never quotes a
 * private note. Nothing here ranks, grades or compares children.
 */

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const hash = text => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const clean = (s, max = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Accent-free, lower-case, final-sigma-free text, so Greek notes match without τόνοι. */
export const foldText = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ς/g, 'σ');
/** Regexes are written with ς; the folded note text has σ. */
const foldedCache = new Map();
const folded = re => { if (!foldedCache.has(re)) foldedCache.set(re, new RegExp(re.source.replace(/ς/g, 'σ'), re.flags)); return foldedCache.get(re); };
const pickBy = (list, key) => list[hash(key) % list.length];

/** Resolve a band line: { e, y, o, u } → early, junior (y), mid (o), upper (u ?? o). */
function line(s, spec) {
    if (!spec) return '';
    if (typeof spec === 'string') return spec;
    if (s.early) return spec.e ?? spec.y ?? '';
    if (s.junior) return spec.y ?? '';
    if (s.band === 'upper') return spec.u ?? spec.o ?? '';
    return spec.o ?? '';
}
/** Fill {n} {N} {topic} {w1}… placeholders. */
function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
}
const younger = s => s.early || s.junior;

// ─── Spirits: the kind of promise, shown as a ribbon on the card ───────────────
export const SPIRITS = Object.freeze({
    passion: { icon: '❤️‍🔥', label: 'Passion', hint: 'From what they love', tone: 'rose' },
    hero: { icon: '🛡️', label: 'Hero path', hint: 'Their hero class', tone: 'violet' },
    ladder: { icon: '🪜', label: 'Next rung', hint: 'One step above a kept promise', tone: 'emerald' },
    spark: { icon: '✨', label: 'Spark', hint: 'A gentle stretch', tone: 'amber' },
    gift: { icon: '🎁', label: 'Gift', hint: 'Shares a real strength', tone: 'sky' },
    bridge: { icon: '🌉', label: 'Bridge', hint: 'A soft way back in', tone: 'teal' },
    quest: { icon: '🧭', label: 'Quest', hint: 'Built on this unit', tone: 'indigo' },
    home: { icon: '🏡', label: 'Hearth', hint: 'Carries English home', tone: 'orange' },
    season: { icon: '🍂', label: 'Season', hint: 'Right for this time of year', tone: 'gold' }
});

// ─── Passions ──────────────────────────────────────────────────────────────────
// topic reads after "about"; person is a famous someone in that world; practice is what they already
// practise (null when it is not a practised activity). Words are child-friendly English.
const I = (id, icon, label, title, re, topic, person, practice, words, virtue, special = []) => ({ id, icon, label, title, re, topic, person, practice, words, virtue, special });
export const INTERESTS = Object.freeze([
    I('football', '⚽', 'Football', 'The Captain’s Promise', /football|soccer|ποδοσφαιρ|μπαλα\b|μπαλιτσα/, 'football', 'football player', 'football training', ['goal', 'team', 'kick', 'score', 'match', 'coach'],
        { reason: 'Teamwork', y: 'I cheer for my classmates like a good teammate. 📣', o: 'I cheer my classmates on like a good teammate, even when we lose.' },
        [{ category: 'speak', y: 'I tell the class the score of a match in English. ⚽', o: 'I commentate thirty seconds of a match in English, like on TV.' }]),
    I('basketball', '🏀', 'Basketball', 'The Point Guard’s Promise', /basketball|μπασκετ/, 'basketball', 'basketball player', 'basketball practice', ['basket', 'bounce', 'pass', 'jump', 'shoot', 'team'],
        { reason: 'Teamwork', y: 'I pass the turn to a friend, like a good pass. 🏀', o: 'I make good “passes” in group work: I hand the turn to someone quiet.' }),
    I('dance', '🩰', 'Dance', 'The Dancer’s Promise', /danc|ballet|ballerina|χορ[οευ]|χορευ|μπαλετ/, 'dancing', 'dancer', 'dance class', ['dance', 'spin', 'step', 'stage', 'music', 'costume'],
        { reason: 'Focus', y: 'I practise my English steps slowly, like a dancer. 🩰', o: 'I practise one hard thing slowly and carefully, the way dancers learn a step.' },
        [{ category: 'speak', y: 'I teach the class three dance moves in English. 💃', o: 'I teach the class a short dance move with English instructions.' }]),
    I('music', '🎵', 'Music', 'The Musician’s Promise', /music|piano|guitar|violin|drum|\bsing(s|ing|er)?\b|song|μουσικ|πιανο|κιθαρ|βιολι|τραγουδ|τυμπαν|ντραμ/, 'music', 'singer', 'music practice', ['song', 'sing', 'beat', 'loud', 'quiet', 'band'],
        { reason: 'Creativity', y: 'I make up a little English song with our new words. 🎵', o: 'I turn our new words into a short song, chant or rap.' },
        [{ category: 'read/listen', y: 'I listen to an English song and catch two words. 🎧', o: 'I listen to an English song and write down five words I catch.' }]),
    I('art', '🎨', 'Drawing & art', 'The Artist’s Promise', /draw|paint|sketch|\bart\b|artist|ζωγραφ|σκιτσ|σχεδι/, 'art and drawing', 'artist', 'drawing', ['draw', 'paint', 'colour', 'picture', 'brush', 'shape'],
        { reason: 'Creativity', y: 'I draw a picture of a new word and show it. 🎨', o: 'I illustrate one of our new words so the whole class remembers it.' },
        [{ category: 'write', y: 'I draw a comic with two English bubbles. 💬', o: 'I draw a four-picture comic with English speech bubbles.' }]),
    I('reading', '📚', 'Books & stories', 'The Storyteller’s Promise', /bookworm|loves? (reading|books)|likes? (reading|books)|reads a lot|βιβλιοφαγ|βιβλια|αγαπα το διαβασμα/, 'my favourite book', 'author', null, ['story', 'chapter', 'character', 'author', 'page', 'adventure'],
        { reason: 'Creativity', y: 'I tell a friend about my favourite story character. 📚', o: 'I recommend a book to the class and give two reasons.' },
        [{ category: 'read/listen', y: 'I read a short English book at home. 📖', o: 'I read a short English story at home and tell the class how it ends.' }]),
    I('animals', '🐾', 'Animals & pets', 'The Beast-Friend’s Promise', /animal|\bpets?\b|\bdogs?\b|puppy|\bcats?\b|kitten|horse|pony|horse riding|ζω[αο]|ζωακι|σκυλ|γατ[αοιε]|γατακι|αλογ|ιππασ/, 'animals', 'vet', null, ['pet', 'paw', 'tail', 'feed', 'gentle', 'wild'],
        { reason: 'Respect', y: 'I am gentle and kind, like with a little animal. 🐾', o: 'I treat everyone the way I treat animals I love: gently and patiently.' },
        [{ category: 'speak', y: 'I tell the class three things about my favourite animal. 🐶', o: 'I present my favourite animal: where it lives, what it eats and why I love it.' }]),
    I('gaming', '🎮', 'Video games', 'The Gamer’s Quest', /video ?games?|gaming|gamer|minecraft|roblox|fortnite|playstation|nintendo|xbox|ηλεκτρονικ|βιντεοπαιχνιδ|παιζει παιχνιδια/, 'my favourite game', 'game designer', null, ['level', 'player', 'win', 'build', 'mission', 'team'],
        { reason: 'Focus', y: 'I treat hard work like a game level: I try again. 🎮', o: 'I treat a hard task like a hard level: I try again with a new plan.' },
        [{ category: 'speak', y: 'I explain my favourite game to a friend in English. 🕹️', o: 'I explain the rules of my favourite game in English, step by step.' }]),
    I('building', '🧱', 'Lego & building', 'The Inventor’s Promise', /lego|build(s|ing)? (things|models)|construct|robot|τουβλακ|λεγκο|κατασκευ|ρομποτ/, 'what I build', 'inventor', 'building', ['build', 'block', 'robot', 'machine', 'tower', 'invent'],
        { reason: 'Creativity', y: 'I build something and tell the class its name in English. 🧱', o: 'I invent a machine on paper and explain what it does in English.' }),
    I('space', '🔭', 'Space & science', 'The Explorer’s Promise', /outer space|space (and|&)|planets?\b|astronaut|rocket|science|experiment|scientist|διαστημ|πλανητ|αστροναυτ|πειραμ|επιστημ/, 'space and science', 'astronaut', null, ['planet', 'rocket', 'star', 'moon', 'experiment', 'discover'],
        { reason: 'Creativity', y: 'I ask one “why” question about the world. 🔭', o: 'I bring the class one amazing science fact in English.' },
        [{ category: 'write', y: 'I write three English words about space. 🚀', o: 'I write a short English report about a planet or an experiment.' }]),
    I('dinosaurs', '🦖', 'Dinosaurs', 'The Fossil Hunter’s Promise', /dinosaur|δεινοσαυρ/, 'dinosaurs', 'fossil hunter', null, ['dinosaur', 'fossil', 'huge', 'bones', 'ancient', 'claws'],
        { reason: 'Creativity', y: 'I make a dinosaur roar and say its name in English. 🦖', o: 'I describe a dinosaur in English and let the class guess which one.' }),
    I('cooking', '🧁', 'Cooking & baking', 'The Chef’s Promise', /cook|bak(e|es|ing)\b|chef|recipe|μαγειρ|ζαχαροπλαστ|φτιαχνει γλυκα/, 'cooking', 'chef', 'cooking', ['cook', 'bake', 'recipe', 'mix', 'cake', 'delicious'],
        { reason: 'Teamwork', y: 'I help at home and say what I do in English. 🍳', o: 'I help cook at home and say each step in English.' },
        [{ category: 'write', y: 'I write my favourite food in English and draw it. 🍕', o: 'I write my favourite recipe in English, step by step.' }]),
    I('swimming', '🏊', 'Swimming', 'The Swimmer’s Promise', /swim|κολυμβ|κολυμπ/, 'swimming', 'swimmer', 'swimming practice', ['swim', 'pool', 'dive', 'splash', 'fast', 'wave'],
        { reason: 'Focus', y: 'I keep going like a swimmer to the end of the pool. 🏊', o: 'I keep going to the end of a task, like the last length of the pool.' }),
    I('martial', '🥋', 'Martial arts', 'The Black Belt’s Promise', /karate|judo|taekwondo|kung ?fu|martial arts|aikido|καρατε|τζουντο|ταεκβοντο|πολεμικ(ες|ων) τεχν/, 'my martial art', 'black belt', 'training', ['kick', 'belt', 'bow', 'strong', 'balance', 'respect'],
        { reason: 'Respect', y: 'I bow to my mistakes and try again, like in training. 🥋', o: 'I bring dojo respect to class: I listen fully before I speak.' }),
    I('gymnastics', '🤸', 'Gymnastics', 'The Gymnast’s Promise', /gymnast|ενοργαν|ρυθμικ/, 'gymnastics', 'gymnast', 'gymnastics', ['jump', 'roll', 'balance', 'stretch', 'flip', 'land'],
        { reason: 'Focus', y: 'I keep my balance: I finish one task before the next. 🤸', o: 'I keep my balance: one task finished before I start the next.' }),
    I('tennis', '🎾', 'Tennis', 'The Champion’s Promise', /tennis|τενις|padel|πανταλ/, 'tennis', 'tennis player', 'tennis practice', ['ball', 'racket', 'serve', 'net', 'point', 'match'],
        { reason: 'Respect', y: 'I say “Good game!” to my friend. 🎾', o: 'I return every question like a good rally: I listen, then answer.' }),
    I('cycling', '🚲', 'Bikes & skating', 'The Rider’s Promise', /bike|cycling|bmx|skate|scooter|ποδηλατ|πατιν|σκειτ|πατινι/, 'riding my bike', 'cyclist', 'riding', ['bike', 'ride', 'wheel', 'helmet', 'road', 'fast'],
        { reason: 'Focus', y: 'I wear my “helmet”: I check my work before I go. 🚲', o: 'I check my work before I hand it in, like checking my bike before a ride.' }),
    I('theatre', '🎭', 'Acting & theatre', 'The Actor’s Promise', /theat|acting|actor|actress|drama (club|class)|θεατρ|ηθοποι|παραστασ/, 'acting', 'actor', 'rehearsals', ['stage', 'act', 'role', 'voice', 'scene', 'audience'],
        { reason: 'Creativity', y: 'I act out a new word for the class. 🎭', o: 'I perform a short English scene with feeling, not just reading.' },
        [{ category: 'speak', y: 'I say my line loud and clear, like on stage. 🎤', o: 'I read aloud with an actor’s voice: loud, clear and with feeling.' }]),
    I('nature', '🌿', 'Nature & outdoors', 'The Ranger’s Promise', /nature|garden|plants|hiking|camping|outdoors|φυση|κηπ[οα]|φυτα|πεζοπορ|κατασκην/, 'nature', 'park ranger', null, ['tree', 'flower', 'forest', 'river', 'grow', 'leaf'],
        { reason: 'Respect', y: 'I look after our plants and our classroom. 🌱', o: 'I take care of our shared spaces, like a ranger cares for a forest.' }),
    I('coding', '💻', 'Computers & coding', 'The Coder’s Promise', /coding|code|computer|programm|scratch|υπολογιστ|προγραμματ|κομπιουτερ/, 'computers', 'programmer', 'coding', ['computer', 'code', 'screen', 'click', 'program', 'bug'],
        { reason: 'Focus', y: 'I find and fix one “bug” in my work. 🐞', o: 'I debug my writing: I find and fix one mistake before I hand it in.' }),
    I('chess', '♟️', 'Chess', 'The Strategist’s Promise', /chess|σκακ/, 'chess', 'chess champion', 'chess', ['king', 'queen', 'move', 'plan', 'check', 'board'],
        { reason: 'Focus', y: 'I think before I move: I read the question twice. ♟️', o: 'I plan before I move: I read every question twice before I answer.' }),
    I('cars', '🏎️', 'Cars & racing', 'The Racer’s Promise', /\bcars?\b|racing|formula|αυτοκινητ|αγωνες ταχυτ|φορμουλα/, 'cars', 'racing driver', null, ['car', 'fast', 'wheel', 'engine', 'race', 'drive'],
        { reason: 'Focus', y: 'I start my work fast, like at the green light. 🏁', o: 'I start my work at the “green light”: no waiting, no wandering.' }),
    I('films', '🎬', 'Films & cartoons', 'The Film Fan’s Promise', /movie|film|cartoon|anime|disney|pixar|ταινι|κινουμεν|καρτουν/, 'my favourite film', 'film director', null, ['film', 'hero', 'scene', 'funny', 'scary', 'ending'],
        { reason: 'Creativity', y: 'I tell a friend about my favourite cartoon in English. 🎬', o: 'I retell my favourite film scene in English without giving away the ending.' }),
    I('travel', '✈️', 'Travel & places', 'The Traveller’s Promise', /travel|trip|holiday abroad|ταξιδ/, 'travelling', 'explorer', null, ['travel', 'map', 'plane', 'country', 'beach', 'city'],
        { reason: 'Creativity', y: 'I show a place I love on the map and say its name in English. 🗺️', o: 'I describe a place I have visited, in English, so the class can picture it.' }),
    I('superheroes', '🦸', 'Superheroes', 'The Superhero’s Promise', /superhero|marvel|spider-?man|batman|avengers|υπερηρω/, 'superheroes', 'superhero', null, ['hero', 'power', 'save', 'brave', 'cape', 'mask'],
        { reason: 'Respect', y: 'I use my “superpower” to help a friend. 🦸', o: 'I use my real superpower in class: I name it and help someone with it.' })
]);
const INTEREST_BY_ID = Object.fromEntries(INTERESTS.map(x => [x.id, x]));
export const interestById = id => INTEREST_BY_ID[id] || null;

/** Interests from the teacher's own notes (English or Greek). Pure keyword matching, nothing leaves the laptop. */
export function detectInterests(notes = []) {
    const text = foldText((notes || []).map(n => (typeof n === 'string' ? n : n?.text || n?.noteText || '')).join(' \n '));
    if (!text.trim()) return [];
    return INTERESTS.filter(x => folded(x.re).test(text)).map(x => x.id);
}

/** "{label} words": football words, story words, animal words… */
const WORD_LABEL = { reading: 'story', animals: 'animal', gaming: 'game', space: 'space', dinosaurs: 'dinosaur', swimming: 'swimming', martial: 'karate',
    building: 'building', cycling: 'bike', theatre: 'theatre', coding: 'computer', cars: 'car', films: 'film', travel: 'travel', superheroes: 'superhero' };
/** The generic passion promises, filled with the interest. */
const PASSION_LINES = [
    { k: 'talk', category: 'speak', y: 'I say {n} English {ww} about {topic}.', o: 'I tell the class about {topic} in {N} English sentences.' },
    { k: 'why', category: 'speak', y: 'I tell my partner what I love about {topic}.', o: 'I explain to a partner why I love {topic}, with two reasons.' },
    { k: 'qa', category: 'speak', o: 'I answer three questions from classmates about {topic}, in English.' },
    { k: 'words', category: 'words', y: 'I learn {n} {label} {ww} in English: {w}.', o: 'I learn and use {N} {label} words in English: {w}.' },
    { k: 'dict', category: 'words', y: 'I draw and label {n} {label} {ww}: {w}.', o: 'I make a mini {label} dictionary with {N} English words and examples.' },
    { k: 'teach', category: 'words', o: 'I teach my group {n} {label} words in English.' },
    { k: 'write', category: 'write', y: 'I write {n} sentences about {topic}.', e: 'I draw {topic} and say one English word about it.', o: 'I write a short paragraph in English about {topic}.' },
    { k: 'ask', category: 'write', y: 'I write one question for a {person}.', o: 'I write {N} questions I would ask a famous {person}.' },
    { k: 'listen', category: 'read/listen', y: 'I watch a short English video about {topic} and say one word I heard.', o: 'I read or watch something short about {topic} in English and share one new fact.' },
    { k: 'practise', category: 'habit', needsPractice: true, y: 'I practise English a little every day, like {practice}.', o: 'I practise English like {practice}: a little, every single day.' },
    { k: 'daily', category: 'habit', y: 'I learn one new {label} word every day.', o: 'I learn one new {label} word every day and use it once.' }
];

/** Passion promises for one interest (from notes or tapped live). */
export function passionOaths(s, interestId, { fromNotes = false } = {}) {
    const x = interestById(interestId);
    if (!x) return [];
    const count = s.early ? 1 : s.junior ? 2 : 3;
    const label = WORD_LABEL[x.id] || x.id;
    const shuffled = [...x.words].sort((a, b) => hash(s.seed + a) - hash(s.seed + b));
    const vars = { ww: count === 1 ? 'word' : 'words', n: NUM[count], N: NUM[Math.min(5, count + 1)], topic: x.topic, label, person: x.person, practice: x.practice || '', w: shuffled.slice(0, younger(s) ? count : count + 1).join(', ') };
    const why = fromNotes ? 'From your Chronicle notes: ' + x.label.toLowerCase() + ' matters to them.' : 'They chose ' + x.label.toLowerCase() + ' as their passion.';
    const out = [];
    const add = (k, category, text, extra = {}) => {
        if (!text) return;
        out.push({ key: 'passion.' + x.id + '.' + k, spirit: 'passion', interest: x.id, category, text, why, title: x.title, score: (fromNotes ? 3.3 : 3.0) - out.length * 0.04, ...extra });
    };
    for (const l of PASSION_LINES) {
        if (l.needsPractice && !x.practice) continue;
        add(l.k, l.category, fill(line(s, l), vars));
    }
    (x.special || []).forEach((sp, i) => add('special' + i, sp.category, line(s, sp), { score: (fromNotes ? 3.7 : 3.15) }));
    if (x.virtue) add('heart', 'virtue', line(s, x.virtue), { target: { kind: 'virtue', reason: x.virtue.reason }, rule: 'virtue' });
    return out;
}

// ─── Needs the teacher noted ──────────────────────────────────────────────────
const N = (id, label, re, oaths) => ({ id, label, re, oaths });
export const NOTE_NEEDS = Object.freeze([
    N('shy', 'Finding their voice', /\bshy\b|timid|very quiet|hardly speaks|doesn'?t speak|hesitant|ντροπαλ|σιωπηλ|διστακτικ|δεν μιλα|κλειστο παιδι|κλειστη/, [
        { category: 'speak', y: 'I put my hand up once in every lesson. ✋', o: 'I raise my hand once in the first ten minutes of each lesson.' },
        { category: 'speak', y: 'I whisper my answer to my partner first, then say it out loud. 🗣️', o: 'I rehearse my answer with a partner, then share it with the class.' },
        { category: 'read/listen', y: 'I read one line aloud for the class. 📖', o: 'I volunteer to read one short part aloud.' }
    ]),
    N('chatty', 'Sharing the stage', /chatty|talkative|talks a lot|calls? out|interrupt|φλυαρ|μιλαει πολυ|μιλα συνεχεια|διακοπτ|πεταγεται/, [
        { category: 'virtue', reason: 'Respect', y: 'I count to three before I speak, so friends get a turn. 🤫', o: 'I wait three seconds before I answer, so others get a turn to think.' },
        { category: 'speak', y: 'I put my hand up instead of calling out. ✋', o: 'I raise my hand instead of calling out, all lesson long.' },
        { category: 'virtue', reason: 'Respect', o: 'I ask a quieter classmate what they think before I share my idea.' }
    ]),
    N('homework', 'Steady homework', /homework|forgets?|forgot|didn'?t bring|ξεχνα|ξεχασ|δεν φερνει|δεν εφερε|εργασι(ες|α) (λειπ|δεν)/, [
        { category: 'habit', y: 'I put my homework in my bag the night before. 🎒', o: 'I pack my homework the night before every lesson.' },
        { category: 'habit', y: 'I tick my homework off in a little list. ✅', o: 'I keep a homework checklist and tick each task off.' },
        { category: 'habit', o: 'I start my homework on the same day I get it.' }
    ]),
    N('late', 'Starting on time', /\blate\b|lateness|punctual|αργει|καθυστερ|αργοπορ/, [
        { category: 'habit', y: 'I am in my seat when the lesson starts. ⏰', o: 'I am in my seat with my book open when the lesson starts.' },
        { category: 'habit', o: 'I get ready five minutes before every lesson.' }
    ]),
    N('focus', 'Steady focus', /distract|focus|concentrat|daydream|attention|αφηρημ|συγκεντρωσ|προσοχη|χαζευ|δεν προσεχ/, [
        { category: 'virtue', reason: 'Focus', y: 'I keep my eyes on my work until the timer ends. 👀', o: 'I keep working until the timer ends, without stopping to chat.' },
        { category: 'habit', y: 'I clear my desk so only my English things are on it. 🧹', o: 'I clear my desk of everything but this lesson’s things.' },
        { category: 'read/listen', y: 'I listen to the whole instruction before I start. 👂', o: 'I repeat the instruction in my head before I start.' }
    ]),
    N('handwriting', 'Clear handwriting', /handwriting|messy writing|illegible|γραφικ|καλλιγραφ|ακατανοητ|ασχημα γραμματα/, [
        { category: 'write', y: 'I write my new words neatly, letter by letter. ✏️', o: 'I write one page so neatly that anyone could read it.' },
        { category: 'write', y: 'I write on the line with finger spaces. ✍️', o: 'I leave clear spaces and stay on the line in my writing.' }
    ]),
    N('pronunciation', 'Clear pronunciation', /pronunc|accent|προφορ/, [
        { category: 'speak', y: 'I say my new words slowly and clearly. 👄', o: 'I practise saying three tricky words aloud until they sound right.' },
        { category: 'read/listen', o: 'I listen to a word, repeat it, and check it with my teacher.' }
    ]),
    N('reading', 'Reading with confidence', /(reads?|reading) (slow|is (hard|difficult|weak))|struggles? (with )?reading|dyslex|δυσλεξ|αναγνωσ|διαβαζει αργα|δυσκολευ.* (να )?διαβα/, [
        { category: 'read/listen', y: 'I read one short page with my finger under the words. ☝️', o: 'I read one short page aloud at home, slowly, every day.' },
        { category: 'read/listen', y: 'I listen and follow the words in my book. 📖', o: 'I follow the text with my eyes while I listen to it.' }
    ]),
    N('spelling', 'Spelling', /spelling|misspell|ορθογραφ|λαθη στις λεξεις/, [
        { category: 'write', rule: 'practice', y: 'I write each new word three times and check it. ✏️', o: 'I keep a list of my spelling mistakes and practise them.' },
        { category: 'words', o: 'I spell five unit words aloud to someone at home.' }
    ]),
    N('worry', 'Calm courage', /anxious|nervous|stress|worr(y|ied|ies)|confidence|afraid|αγχ|φοβ|ανησυχ|αυτοπεποιθ|ανασφαλ/, [
        { category: 'habit', y: 'I take a big breath and try. 🌬️', o: 'I take a slow breath before a hard task, then begin.' },
        { category: 'speak', y: 'I say “I can try!” before something new. 💪', o: 'I try one answer even if I am not sure it is right.' }
    ]),
    N('frustration', 'Keeping going', /frustrat|angry|upset|gives up|temper|θυμων|νευρ|τα παραταει|εκνευρ|ξεσπα/, [
        { category: 'virtue', reason: 'Focus', y: 'When it is hard, I say “Not yet!” and try again. 🌱', o: 'When a task is hard, I say “not yet” and try one more way.' },
        { category: 'habit', o: 'I ask for help calmly when I feel stuck.' }
    ]),
    N('helper', 'A natural helper', /helps? (others|everyone|classmates)|helpful|leader|kind(ness)?\b|caring|βοηθα|ηγετικ|ευγενικ|καλοσυνατ|προθυμ/, [
        { category: 'virtue', reason: 'Teamwork', y: 'I help a friend who is stuck, without giving the answer. 🤝', o: 'I coach a classmate through a problem without giving the answer.' },
        { category: 'speak', o: 'I lead my group’s discussion and make sure everyone speaks.' }
    ]),
    N('newcomer', 'Settling in', /new (student|to the class|to our class)|just joined|joined (us|the class)|νεος μαθητ|νεα μαθητρ|καινουργι|ηρθε φετος|μετεγγραφ/, [
        { category: 'virtue', reason: 'Teamwork', y: 'I learn the names of three classmates. 👋', o: 'I learn something new about three classmates, in English.' },
        { category: 'speak', y: 'I say hello in English to someone new. 😊', o: 'I start a short English chat with someone I don’t know well.' }
    ]),
    N('grammar', 'Grammar patterns', /grammar|tenses|γραμματικ|χρονους/, [
        { category: 'write', y: 'I write one sentence with our new pattern. ✍️', o: 'I write three sentences that use this week’s grammar correctly.' }
    ]),
    N('vocabulary', 'Growing vocabulary', /vocabulary|λεξιλογ/, [
        { category: 'words', y: 'I learn two new words and draw them. 🔤', o: 'I keep a word notebook and add three new words each lesson.' }
    ]),
    N('advanced', 'Ready for more', /excellent|advanced|gifted|very strong|top of|αριστ|εξαιρετ|πολυ καλ(ος|η) μαθητ|ταλεντ/, [
        { category: 'write', o: 'I use one ambitious new word or structure in every piece of writing.', y: 'I try a longer sentence than I need. 🚀' },
        { category: 'speak', o: 'I give an answer with a reason and an example.', y: 'I say my answer with “because”. 💡' }
    ])
]);
/** Needs from notes, newest note first. Each need only once. */
export function detectNeeds(notes = []) {
    const out = [];
    for (const n of notes || []) {
        const text = foldText(typeof n === 'string' ? n : n?.text || n?.noteText || '');
        for (const need of NOTE_NEEDS) if (!out.includes(need.id) && folded(need.re).test(text)) out.push(need.id);
    }
    return out;
}
function needOaths(s) {
    const out = [];
    for (const id of s.needs || []) {
        const need = NOTE_NEEDS.find(x => x.id === id); if (!need) continue;
        need.oaths.forEach((o, i) => {
            const text = line(s, o); if (!text) return;
            out.push({ key: 'need.' + id + '.' + i, spirit: id === 'helper' || id === 'advanced' ? 'gift' : 'spark', category: o.category, text,
                why: 'Shaped by your Chronicle notes: ' + need.label.toLowerCase() + '.', title: NEED_TITLES[id] || 'The Brave Step',
                score: 3.4 - i * 0.12, ...(o.reason ? { target: { kind: 'virtue', reason: o.reason }, rule: 'virtue' } : {}), ...(o.rule ? { rule: o.rule, target: { kind: o.rule } } : {}) });
        });
    }
    return out;
}
const NEED_TITLES = { shy: 'The Brave Voice', chatty: 'The Listening Heart', homework: 'The Steady Satchel', late: 'The Early Lantern', focus: 'The Steady Eye',
    handwriting: 'The Careful Quill', pronunciation: 'The Clear Voice', reading: 'The Lantern Reader', spelling: 'The Letter-Keeper', worry: 'The Calm Flame',
    frustration: 'The Not-Yet Oath', helper: 'The Helping Hand', newcomer: 'The Open Door', grammar: 'The Pattern-Weaver', vocabulary: 'The Word Hoard', advanced: 'The Higher Peak' };

// ─── Hero Classes and guilds ──────────────────────────────────────────────────
const HERO_LINES = {
    Guardian: [
        { category: 'virtue', reason: 'Respect', y: 'I keep our class rules safe: I wait for my turn. 🛡️', o: 'I guard our class’s calm: I wait my turn and help others do the same.' },
        { category: 'speak', y: 'I use kind English words when a friend is sad. 💛', o: 'I stand up for a classmate with calm, kind English words.' },
        { category: 'habit', y: 'I look after our classroom things. 🧺', o: 'I look after our classroom and leave it better than I found it.' }
    ],
    Sage: [
        { category: 'read/listen', y: 'I ask one “why” question about our story. 🔮', o: 'I ask one deep “why” question in every lesson.' },
        { category: 'words', y: 'I find one beautiful new English word. ✨', o: 'I collect {N} beautiful English words and share my favourite.' },
        { category: 'virtue', reason: 'Creativity', y: 'I imagine a new ending for our story. 🌙', o: 'I invent a new ending or twist for something we read.' }
    ],
    Paladin: [
        { category: 'virtue', reason: 'Teamwork', y: 'I make sure no one in my team is alone. ⚔️', o: 'I make sure everyone in my group has a job and a voice.' },
        { category: 'speak', y: 'I say “Well done!” to my team in English. 🙌', o: 'I encourage my team in English when things get hard.' },
        { category: 'habit', y: 'I finish my part of the team work. 🤝', o: 'I finish my part of every group task on time.' }
    ],
    Artificer: [
        { category: 'words', y: 'I make a word picture with {n} new words. 🖼️', o: 'I build a word map for our unit with {N} words.' },
        { category: 'virtue', reason: 'Focus', y: 'I finish my work like a careful maker. ⚙️', o: 'I work like a craftsperson: step by step until it is finished.' },
        { category: 'write', y: 'I check and fix one thing in my work. 🔧', o: 'I fix one mistake in my work before I hand it in.' }
    ],
    Scholar: [
        { category: 'habit', rule: 'practice', y: 'I practise for our next test a little each day. 📜', o: 'I prepare for the next trial with ten minutes of practice a day.' },
        { category: 'write', y: 'I learn from one mistake in my last test. 🔍', o: 'I correct my last test and explain one mistake in my own words.' },
        { category: 'words', o: 'I review the words from my last trial three times before the next one.' }
    ],
    Vanguard: [
        { category: 'speak', y: 'I play an English word game with a friend. ⚜️', o: 'I challenge a friend to an English word game and play fair.' },
        { category: 'habit', y: 'I try the hard thing first. 💪', o: 'I pick the hardest task first and give it my best try.' },
        { category: 'virtue', reason: 'Focus', y: 'I train my English a little every day, like a champion. 🏅', o: 'I train like a champion: I practise one weak spot until it improves.' }
    ],
    Nomad: [
        { category: 'speak', y: 'I say hello in English when I arrive. 👟', o: 'I greet the class in English and ask someone how they are.' },
        { category: 'habit', y: 'I come to every lesson this week. 🗓️', o: 'I come to every lesson and catch up fast if I miss one.' },
        { category: 'read/listen', o: 'I find out what the class learned while I was away and tell my teacher.' }
    ],
    Patron: [
        { category: 'virtue', reason: 'Respect', y: 'I give one kind word in English every lesson. 💝', o: 'I give one real compliment in English every lesson.' },
        { category: 'speak', y: 'I say “thank you” in English for something kind. 🙏', o: 'I thank a classmate in English for something specific they did.' },
        { category: 'virtue', reason: 'Teamwork', y: 'I share my things and my ideas. 🤲', o: 'I share what I am good at with a classmate who needs it.' }
    ]
};
function heroOaths(s) {
    const lines = HERO_LINES[s.heroClass]; if (!lines) return [];
    const n = s.early ? 1 : s.junior ? 2 : 3;
    const out = [];
    lines.forEach((l, i) => {
        const text = fill(line(s, l), { n: NUM[n], N: NUM[Math.min(5, n + 2)] }); if (!text) return;
        out.push({ key: 'hero.' + s.heroClass.toLowerCase() + '.' + i, spirit: 'hero', category: l.category, text,
            why: 'Spoken in a ' + s.heroClass + '’s voice — their own Hero Class.', title: 'The ' + s.heroClass + '’s Oath', score: 2.85 - i * 0.1,
            ...(l.reason ? { target: { kind: 'virtue', reason: l.reason }, rule: 'virtue' } : {}), ...(l.rule ? { rule: l.rule, target: { kind: l.rule } } : {}) });
    });
    return out;
}
function guildOaths(s) {
    if (!s.guildName) return [];
    const short = s.guildName.split(' ')[0];
    return [
        { key: 'guild.idea', spirit: 'hero', category: 'speak', text: line(s, { y: 'I bring one English idea for my ' + short + ' friends. 🏰', o: 'I bring one English idea that helps the ' + s.guildName + ' guild.' }),
            why: 'For their guild, the ' + s.guildName + '.', title: 'The ' + short + ' Oath', score: 1.85 },
        { key: 'guild.help', spirit: 'gift', category: 'virtue', text: line(s, { y: 'I help a friend from my guild with English. 🤝', o: 'I help a guild-mate with an English task this week.' }),
            why: 'Guild-mates lift each other.', title: 'The ' + short + ' Oath', score: 1.75, target: { kind: 'virtue', reason: 'Teamwork' }, rule: 'virtue' }
    ].filter(x => x.text);
}

// ─── The ladder: one rung above a kept promise ────────────────────────────────
const LADDER = {
    speak: { y: ['I say one English word to the class.', 'I say a whole sentence in English.', 'I ask a friend a question in English.', 'I tell the class two sentences about me.', 'I talk with a partner in English for one minute.'],
        o: ['I share one idea in English with the class.', 'I ask and answer a question in English.', 'I speak in English for thirty seconds about something I like.', 'I give a one-minute talk in English.', 'I lead a short English discussion in my group.'] },
    words: { y: ['I learn one new word.', 'I use two new words.', 'I use three new words in sentences.', 'I teach four new words to a friend.', 'I use five new words this week.'],
        o: ['I use three new words in my own sentences.', 'I use five new words while speaking.', 'I use new words in both speaking and writing.', 'I explain five new words with examples.', 'I learn a word family around each new word.'] },
    write: { y: ['I copy one sentence neatly.', 'I write one sentence by myself.', 'I write two sentences by myself.', 'I write three sentences about my day.', 'I write a little story of four sentences.'],
        o: ['I write two sentences with a new word.', 'I write a short paragraph.', 'I write a paragraph with linking words.', 'I write a paragraph and improve it after feedback.', 'I write a short piece with a beginning, middle and end.'] },
    'read/listen': { y: ['I listen to a whole story.', 'I tell one thing from a story.', 'I read one page aloud.', 'I retell a story to my family.', 'I read a little English book by myself.'],
        o: ['I read a page aloud.', 'I retell a text in my own words.', 'I read something extra in English at home.', 'I summarise a text and give my opinion.', 'I read a short book in English and recommend it.'] },
    habit: { y: ['I bring my book.', 'I bring my book and homework.', 'I do my homework the same day.', 'I practise English for five minutes at home.', 'I practise English every day for a week.'],
        o: ['I come ready to every lesson.', 'I do my homework the day I get it.', 'I practise English ten minutes a day.', 'I plan my English practice for the week.', 'I keep a weekly English practice diary.'] },
    virtue: { y: ['I help a friend once.', 'I help a friend without being asked.', 'I help two friends this week.', 'I help someone new feel welcome.', 'I help my whole team finish.'],
        o: ['I help a classmate once.', 'I help without being asked.', 'I help our group share the work fairly.', 'I lead my group kindly.', 'I notice who needs help before they ask.'] }
};
const LADDER_TITLES = { speak: 'A Braver Voice', words: 'A Bigger Word Hoard', write: 'A Stronger Quill', 'read/listen': 'A Brighter Lantern', habit: 'A Steadier Flame', virtue: 'A Warmer Heart' };
function ladderOaths(s) {
    const out = [];
    for (const [category, kept] of Object.entries(s.keptByCategory || {})) {
        const rungs = LADDER[category]; if (!rungs || !kept.length) continue;
        const list = younger(s) ? rungs.y : rungs.o;
        const rung = Math.min(list.length - 1, kept.length);
        const last = kept.at(-1);
        // Never offer a rung they already climbed (same words as a kept promise).
        const text = list.slice(rung).find(t => !(s.previous || []).some(o => o.text === t));
        if (!text) continue;
        out.push({ key: 'ladder.' + category.replace('/', '_') + '.' + rung, spirit: 'ladder', category, text,
            why: 'Kept “' + clean(last.text, 48) + '”' + (/[.!?…]$/.test(clean(last.text, 48)) ? ' ' : '. ') + 'This is one rung higher.', title: LADDER_TITLES[category], score: 3.05 + Math.min(0.4, kept.length * 0.1) });
    }
    return out;
}

// ─── Class roles: a strength, shared ──────────────────────────────────────────
const ROLES = [
    { id: 'word_keeper', icon: '🗝️', title: 'The Word Keeper', category: 'words', y: 'I am our Word Keeper: I remind the class of our new words. 🗝️', o: 'I am our Word Keeper: I remind the class of the unit words and check we use them.',
        fit: s => (s.quizRate != null && s.quizRate >= 0.85) || (s.overall != null && s.overall >= 85) ? 'Strong with words lately — a role to share it.' : '', score: 2.75 },
    { id: 'question_captain', icon: '❓', title: 'The Question Captain', category: 'speak', y: 'I am our Question Captain: I ask one good question every lesson. ❓', o: 'I am our Question Captain: I ask one good question every lesson.',
        fit: s => (s.shining ? 'One of the brightest this month — now they ask, not only answer.' : ''), score: 2.7 },
    { id: 'kindness_scout', icon: '💛', title: 'The Kindness Scout', category: 'virtue', reason: 'Respect', y: 'I am our Kindness Scout: I notice kind friends and say thank you. 💛', o: 'I am our Kindness Scout: I notice kind acts and thank people in English.',
        fit: s => (s.counts?.Respect >= 3 ? s.counts.Respect + ' Respect stars this month — kindness is their strength.' : ''), score: 2.65 },
    { id: 'time_keeper', icon: '⏳', title: 'The Time Keeper', category: 'habit', y: 'I am our Time Keeper: I help my team finish on time. ⏳', o: 'I am our Time Keeper: I help my group plan and finish on time.',
        fit: s => (s.counts?.Focus >= 3 ? s.counts.Focus + ' Focus stars this month — steady hands for the group.' : ''), score: 2.6 },
    { id: 'welcome_guide', icon: '👋', title: 'The Welcome Guide', category: 'virtue', reason: 'Teamwork', y: 'I am a Welcome Guide: I help a friend who was away. 👋', o: 'I am a Welcome Guide: I help anyone who missed a lesson catch up.',
        fit: s => (s.counts?.Teamwork >= 3 ? s.counts.Teamwork + ' Teamwork stars this month — a natural guide.' : ''), score: 2.6 },
    { id: 'story_guardian', icon: '🪶', title: 'The Story Guardian', category: 'read/listen', y: 'I am our Story Guardian: I tell the class what happened last time. 🪶', o: 'I am our Story Guardian: I remind the class what happened in our story last lesson.',
        fit: s => (s.reasons?.story_weaver ? 'Part of Story Weavers — they know our tale.' : ''), score: 2.55 },
    { id: 'page_finder', icon: '📖', title: 'The Page Finder', category: 'habit', y: 'I am our Page Finder: I help friends find the right page. 📖', o: 'I help my partner find the right page and exercise every time.',
        fit: s => (younger(s) ? 'A small, proud job for a young helper.' : ''), score: 1.7 },
    { id: 'tidy_captain', icon: '🧹', title: 'The Tidy Captain', category: 'habit', e: 'I am our Tidy Captain: I help everyone tidy up. 🧹', y: 'I am our Tidy Captain: I help everyone tidy up. 🧹',
        fit: s => (younger(s) ? 'Little jobs make little leaders.' : ''), score: 1.6 }
];
function roleOaths(s) {
    return ROLES.map(r => {
        const text = line(s, r); const fit = r.fit(s);
        if (!text) return null;
        return { key: 'role.' + r.id, spirit: 'gift', category: r.category, text, title: r.title,
            why: fit || 'A small role in the class, owned with pride.', score: fit ? r.score : 1.35,
            ...(r.reason ? { target: { kind: 'virtue', reason: r.reason }, rule: 'virtue' } : {}) };
    }).filter(Boolean);
}

// ─── Word crafts on the unit's real words ─────────────────────────────────────
const CRAFTS = [
    { k: 'label', category: 'words', y: 'I draw and label {w1} and {w2}. 🖍️', o: 'I draw a word-picture for “{w1}” and “{w2}” and label it.' },
    { k: 'riddle', category: 'speak', o: 'I make a riddle for “{w1}” and test my partner.', y: 'I give a clue for “{w1}” and let a friend guess. 🕵️' },
    { k: 'mime', category: 'speak', y: 'I act out “{w2}” and let the class guess. 🎭', o: 'I mime “{w2}” and let the class guess it in English.' },
    { k: 'partner', category: 'words', o: 'I find an opposite or a partner word for “{w3}”.', y: 'I find a word that goes with “{w3}”. 🔗' },
    { k: 'everyday', category: 'words', y: 'I say “{w1}” in English every day this week. 🔁', o: 'I use “{w1}” naturally every day this week.' },
    { k: 'spot', category: 'read/listen', y: 'I find “{w2}” in a book or a song. 🔎', o: 'I spot “{w2}” in a book, a song or a video and tell the class where.' },
    { k: 'story', category: 'write', y: 'I write a sentence with {w1} and {w3}. ✍️', o: 'I write a tiny story that uses {w1}, {w2} and {w3}.' }
];
function craftOaths(s) {
    const words = s.words || []; if (!words.length) return [];
    const off = hash(s.seed) % words.length;
    const w = i => words[(off + i) % words.length];
    return CRAFTS.map((c, i) => {
        const text = fill(line(s, c), { w1: w(i), w2: w(i + 1), w3: w(i + 2) });
        if (!text || /\{w\d\}/.test(text)) return null;
        return { key: 'craft.' + c.k, spirit: 'quest', category: c.category, text, title: 'The Word-Craft Oath',
            why: 'Built on this unit’s real words: ' + [w(i), w(i + 1)].filter((v, j, a) => a.indexOf(v) === j).join(', ') + '.', score: 2.35 - i * 0.05 };
    }).filter(Boolean);
}

// ─── Hearth: English carried home ─────────────────────────────────────────────
const AUDIENCES = { y: ['someone at home', 'my family', 'my teddy or my pet', 'a friend outside school'], o: ['someone at home', 'my family', 'a friend outside school', 'a younger child I know'] };
function homeOaths(s) {
    const aud = pickBy(younger(s) ? AUDIENCES.y : AUDIENCES.o, s.seed + 'aud');
    const n = s.early ? 1 : s.junior ? 2 : 3;
    const lines = [
        { k: 'read', category: 'read/listen', y: 'I read our story to {aud}. 🏡', o: 'I read a page of English aloud to {aud}.' },
        { k: 'teach', category: 'words', y: 'I teach {aud} {n} English words. 🏡', o: 'I teach {aud} {n} English words from this unit.' },
        { k: 'greet', category: 'speak', y: 'I say “good morning” and “good night” in English at home. 🌙', o: 'I speak English at home for five minutes a day.' },
        { k: 'note', category: 'write', y: 'I write a little English note for {aud}. 💌', o: 'I write a short English message for {aud}.' }
    ];
    return lines.map((l, i) => {
        const text = fill(line(s, l), { aud, n: NUM[n] }); if (!text) return null;
        return { key: 'home.' + l.k, spirit: 'home', category: l.category, text, title: 'The Hearth-and-Home Oath',
            why: 'English that leaves the classroom sticks twice as well.', score: 1.75 - i * 0.05 };
    }).filter(Boolean);
}

// ─── Seasons ──────────────────────────────────────────────────────────────────
function seasonOaths(s) {
    const month = Number(String(s.day || '').slice(5, 7)) || 0;
    const out = [];
    const add = (k, category, spec, why, title, score = 2.3, extra = {}) => { const text = line(s, spec); if (text) out.push({ key: 'season.' + k, spirit: 'season', category, text, why, title, score, ...extra }); };
    if (s.birthdayMonth && s.birthdayMonth === month) add('birthday', 'speak', { y: 'For my birthday, I teach the class one thing I love, in English. 🎂', o: 'For my birthday month, I tell the class about something I love, in English.' },
        'Their birthday is this month — a promise to remember it by.', 'The Birthday Oath', 3.45);
    if (month === 9 || month === 10) add('fresh', 'habit', { y: 'I say “good morning” in English every lesson. ☀️', o: 'I write my English goal for this year and check it every week.' }, 'A new school year: the best time to begin a habit.', 'The Fresh-Start Oath');
    if (month === 11 || month === 12) add('winter', month === 12 ? 'write' : 'words', month === 12 ? { y: 'I make an English holiday card for someone. 🎄', o: 'I write an English holiday card for someone special.' } : { y: 'I learn three winter words in English. ❄️', o: 'I learn five winter words and use them in a sentence.' },
        month === 12 ? 'The holidays are coming — English as a gift.' : 'Winter is arriving: new words for a new season.', 'The Winter Oath');
    if (month === 1) add('return', 'speak', { y: 'I tell the class one thing I did in the holidays. 🎁', o: 'I tell the class about my holidays in five English sentences.' }, 'Back from the holidays: stories to share.', 'The New-Year Oath');
    if (month === 2 || month === 3) add('carnival', 'speak', { y: 'I say what my carnival costume is in English. 🎭', o: 'I describe my carnival costume in English and let the class guess.' }, 'Carnival season — a costume is a story.', 'The Carnival Oath');
    if (month === 4) add('easter', 'words', { y: 'I learn three Easter words in English. 🥚', o: 'I tell the class how my family spends Easter, in English.' }, 'Easter is near: English about our own traditions.', 'The Spring Oath');
    if (month === 5 || month === 6) add('summer', s.band === 'upper' ? 'habit' : 'speak', s.band === 'upper' ? { o: 'I make a revision plan for the end-of-year test and follow it.' } : { y: 'I teach my family an English game for the summer. ☀️', o: 'I make a summer English plan: one book, one song, one film.' },
        s.band === 'upper' ? 'End-of-year tests are near.' : 'Summer is coming — keep English alive.', 'The Summer Oath', 2.35, s.band === 'upper' ? { rule: 'practice', target: { kind: 'practice' } } : {});
    return out;
}

// ─── Brave steps for the quiet, bigger steps for the strong ───────────────────
function sparkOaths(s) {
    const out = [];
    if (s.quiet) [
        { k: 'first10', category: 'speak', y: 'I put up my hand in the first part of the lesson. ✋', o: 'I answer one question in the first ten minutes of the lesson.' },
        { k: 'readline', category: 'read/listen', y: 'I read one line aloud for the class. 📖', o: 'I volunteer to read one short part aloud.' },
        { k: 'partner', category: 'speak', y: 'I say my idea to my partner in English. 🗣️', o: 'I share my idea with a partner first, then with the class.' }
    ].forEach((l, i) => { const text = line(s, l); if (text) out.push({ key: 'spark.quiet.' + l.k, spirit: 'spark', category: l.category, text, title: 'The Brave Voice', why: 'Fewer stars than most this month — a small, safe step into the light.', score: 3.1 - i * 0.1 }); });
    if (s.excellence || (s.quizRate != null && s.quizRate >= 0.9)) [
        { k: 'ambitious', category: 'write', y: 'I write a longer sentence with “and” or “because”. 🚀', o: 'I use one ambitious word or structure in every piece of writing.' },
        { k: 'reason', category: 'speak', y: 'I answer with “because…”. 💡', o: 'I answer with a reason and an example, every time.' },
        { k: 'coach', category: 'virtue', reason: 'Teamwork', y: 'I help a friend practise our words. 🤝', o: 'I coach a classmate through a tricky exercise without giving the answer.' }
    ].forEach((l, i) => { const text = line(s, l); if (text) out.push({ key: 'spark.peak.' + l.k, spirit: l.k === 'coach' ? 'gift' : 'spark', category: l.category, text, title: l.k === 'coach' ? 'The Torch-Bearer' : 'The Higher Peak',
        why: s.excellence ? 'Recent scores around ' + Math.round(s.overall) + '% — time for a real stretch.' : 'Quiz of the Week almost perfect — a stretch, not a repeat.', score: 2.95 - i * 0.1, ...(l.reason ? { target: { kind: 'virtue', reason: l.reason }, rule: 'virtue' } : {}) }); });
    if (s.counts && s.totalVirtue >= 6 && s.counts[s.weakest] <= 1 && s.counts[s.strongest] >= 4) {
        const bridge = { Teamwork: { y: 'I use my {strong} to help my team. 🤝', o: 'I use my {strong} to make my group work better together.' }, Respect: { y: 'I use my {strong} to be kind to everyone. 💛', o: 'I use my {strong} to make sure everyone is heard.' },
            Focus: { y: 'I use my {strong} to finish my work. 🎯', o: 'I use my {strong} to stay on task until the end.' }, Creativity: { y: 'I use my {strong} to try a new idea. 🎨', o: 'I use my {strong} to bring one new idea to every task.' } }[s.weakest];
        const text = fill(line(s, bridge), { strong: s.strongest.toLowerCase() });
        if (text) out.push({ key: 'spark.bridge.' + s.weakest.toLowerCase(), spirit: 'spark', category: 'virtue', text, title: 'The Two-Flame Oath',
            why: 'Rich in ' + s.strongest + ' (' + s.counts[s.strongest] + '), quiet in ' + s.weakest + ' (' + s.counts[s.weakest] + '): one strength lights the other.', score: 3.25, target: { kind: 'virtue', reason: s.weakest }, rule: 'virtue' });
    }
    return out;
}

/**
 * Every personal promise the forge can offer this child (interests from notes included; interests tapped
 * live are added by the caller with passionOaths). Each carries: key, spirit, category, text, why, title, score.
 */
export function forgeOaths(s) {
    return [
        ...(s.interests || []).flatMap(id => passionOaths(s, id, { fromNotes: true })),
        ...needOaths(s), ...heroOaths(s), ...guildOaths(s), ...ladderOaths(s), ...roleOaths(s),
        ...craftOaths(s), ...homeOaths(s), ...seasonOaths(s), ...sparkOaths(s)
    ].filter(x => x && x.text);
}

// ─── Titles for the classic bank and for promises already stored ─────────────
const CATEGORY_TITLES = {
    speak: ['The Brave Voice', 'The Open Voice', 'The Speaking Flame'],
    words: ['The Word Collector', 'The Word Hoard', 'The Word-Smith’s Oath'],
    write: ['The Quill Oath', 'The Careful Quill', 'The Ink-and-Ember Oath'],
    'read/listen': ['The Lantern Reader', 'The Open Ear', 'The Story Lantern'],
    habit: ['The Steady Flame', 'The Daily Ember', 'The Little-and-Often Oath'],
    virtue: ['The Kind Heart', 'The Hero’s Heart', 'The Warm Hearth']
};
const VIRTUE_TITLES = { Teamwork: 'The Shield-Friend Oath', Respect: 'The Kind Heart', Focus: 'The Steady Eye', Creativity: 'The Bright Spark' };
const SPIRIT_TITLES = { bridge: 'The Way Back', gift: 'The Torch-Bearer', quest: 'The Unit Quest' };
/** Spirit of a classic bank family (the forge sets its own). */
export function spiritForKey(key = '') {
    const k = String(key);
    const dot = k.indexOf('.');
    if (dot > 0) { const head = k.slice(0, dot); if (head === 'need') return /^need\.(helper|advanced)/.test(k) ? 'gift' : 'spark'; if (head === 'role') return 'gift'; if (head === 'craft') return 'quest'; if (head === 'guild') return 'hero'; return SPIRITS[head] ? head : 'spark'; }
    if (/^(welcome_back|habit_makeup|test_prep|spelling|write_dictation_fix|words_missed_quiz|quiz_review|habit_breath|habit_ask_help)$/.test(k)) return 'bridge';
    if (/^(helper|quiz_helper|share_|speak_explain|words_family)/.test(k)) return 'gift';
    if (/^hero_/.test(k)) return 'hero';
    if (/^(words$|words_(story|vault|sentence|opposite|sort)|read_(book|bigquestion|words_in_text)|write_pattern|read$|speak_(retell|describe|role|sounds)|write_story_line|read_story_home)/.test(k)) return 'quest';
    return 'spark';
}
/** A poetic name for a promise, stable for the same child and words. */
export function oathTitle({ key = '', templateId = '', category = 'habit', text = '', target = null, seed = '' } = {}) {
    const k = key || String(templateId || '').replace(/^(early|junior|mid|upper|exam)_/, '');
    const [head, a] = k.split('.');
    if (head === 'passion' && interestById(a)) return interestById(a).title;
    if (head === 'hero' && a) return 'The ' + a.charAt(0).toUpperCase() + a.slice(1) + '’s Oath';
    if (head === 'role') return ROLES.find(r => r.id === a)?.title || 'The Torch-Bearer';
    if (head === 'need') return NEED_TITLES[a] || 'The Brave Step';
    if (head === 'ladder') return LADDER_TITLES[String(a).replace('_', '/')] || 'One Rung Higher';
    if (head === 'craft') return 'The Word-Craft Oath';
    if (head === 'home') return 'The Hearth-and-Home Oath';
    if (head === 'season') return { birthday: 'The Birthday Oath', fresh: 'The Fresh-Start Oath', winter: 'The Winter Oath', return: 'The New-Year Oath', carnival: 'The Carnival Oath', easter: 'The Spring Oath', summer: 'The Summer Oath' }[a] || 'The Season’s Oath';
    if (head === 'spark' && a === 'quiet') return 'The Brave Voice';
    if (head === 'spark' && a === 'bridge') return 'The Two-Flame Oath';
    if (head === 'spark') return 'The Higher Peak';
    if (head === 'guild') return 'The Guild Oath';
    if (category === 'virtue' && target?.reason && VIRTUE_TITLES[target.reason]) return VIRTUE_TITLES[target.reason];
    const spirit = spiritForKey(k);
    if (SPIRIT_TITLES[spirit] && hash(seed + k) % 3 === 0) return SPIRIT_TITLES[spirit];
    const list = CATEGORY_TITLES[category] || CATEGORY_TITLES.habit;
    return list[hash(seed + k + text) % list.length];
}
