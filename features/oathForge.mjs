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

/**
 * Resolve a band line. Every line is written four times, one per league band, so a promise grows with
 * the child instead of being copied down or up:
 *   e → Pre-Junior (pre-A1, oral: say, point, sing, show, draw, trace, copy one word)
 *   y → Junior A / B (A1 start: short sentences, one or two things, a page)
 *   o → A / B (A1–A2: a few sentences, a short paragraph, one reason)
 *   u → C / D (A2–B1: paragraphs with linking words, opinions with reasons, a minute or two, planning alone)
 * An explicit '' means "not for this band" (the line is skipped). Upper falls back to o, early to y.
 */
const TIER_ORDER = { early: ['e', 'y'], junior: ['y'], mid: ['o'], upper: ['u', 'o'] };
function line(s, spec) {
    if (!spec) return '';
    if (typeof spec === 'string') return spec;
    for (const k of TIER_ORDER[s.band] || ['o']) if (spec[k] != null) return spec[k];
    return '';
}
/** Fill {n} {N} {topic} {w1}… placeholders. */
function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
}
const younger = s => s.early || s.junior;
/** How many things a promise asks for, by band: 1 · 2 · 3 · 4. */
const bandCount = s => (s.early ? 1 : s.junior ? 2 : s.band === 'upper' ? 4 : 3);

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
        { reason: 'Teamwork', e: 'I clap for my friends when they try. 👏', y: 'I cheer for my classmates like a good teammate. 📣', o: 'I cheer my classmates on like a good teammate, even when we lose.', u: 'I congratulate the other team in English, win or lose, like a real captain.' },
        [{ category: 'speak', e: 'I shout “Goal!” and count to five in English. ⚽', y: 'I tell the class the score of a match in English. ⚽', o: 'I commentate thirty seconds of a match in English, like on TV.', u: 'I commentate a whole minute of a match in English, with exciting phrases.' }]),
    I('basketball', '🏀', 'Basketball', 'The Point Guard’s Promise', /basketball|μπασκετ/, 'basketball', 'basketball player', 'basketball practice', ['basket', 'bounce', 'pass', 'jump', 'shoot', 'team'],
        { reason: 'Teamwork', e: 'I give the ball to a friend and say “Your turn!” 🏀', y: 'I pass the turn to a friend, like a good pass. 🏀', o: 'I make good “passes” in group work: I hand the turn to someone quiet.', u: 'I notice who has not spoken in my group and pass them the floor.' },
        [{ category: 'speak', e: 'I bounce a ball and count to ten in English. 🏀', y: 'I say three basketball moves in English and show them. 🏀', o: 'I explain three basketball rules to the class in English.', u: 'I describe a great basketball moment in English and say why it was special.' }]),
    I('dance', '🩰', 'Dance', 'The Dancer’s Promise', /danc|ballet|ballerina|χορ[οευ]|χορευ|μπαλετ/, 'dancing', 'dancer', 'dance class', ['dance', 'spin', 'step', 'stage', 'music', 'costume'],
        { reason: 'Focus', e: 'I watch and copy carefully, like a little dancer. 🩰', y: 'I practise my English steps slowly, like a dancer. 🩰', o: 'I practise one hard thing slowly and carefully, the way dancers learn a step.', u: 'I practise one hard thing again and again until it looks easy, like a dancer before a show.' },
        [{ category: 'speak', e: 'I dance and say “left, right, jump!” in English. 💃', y: 'I teach the class three dance moves in English. 💃', o: 'I teach the class a short dance move with English instructions.', u: 'I teach the class a short routine using first, then, after that and finally.' }]),
    I('music', '🎵', 'Music', 'The Musician’s Promise', /music|piano|guitar|violin|drum|\bsing(s|ing|er)?\b|song|μουσικ|πιανο|κιθαρ|βιολι|τραγουδ|τυμπαν|ντραμ/, 'music', 'singer', 'music practice', ['song', 'sing', 'beat', 'loud', 'quiet', 'band'],
        { reason: 'Creativity', e: 'I sing our new word in a little tune. 🎵', y: 'I make up a little English song with our new words. 🎵', o: 'I turn our new words into a short song, chant or rap.', u: 'I write a short verse or rap with five unit words and perform it.' },
        [{ category: 'read/listen', e: 'I sing an English song with the actions. 🎧', y: 'I listen to an English song and catch two words. 🎧', o: 'I listen to an English song and write down five words I catch.', u: 'I listen to an English song, write down one line and explain what it means.' }]),
    I('art', '🎨', 'Drawing & art', 'The Artist’s Promise', /draw|paint|sketch|\bart\b|artist|ζωγραφ|σκιτσ|σχεδι/, 'art and drawing', 'artist', 'drawing', ['draw', 'paint', 'colour', 'picture', 'brush', 'shape'],
        { reason: 'Creativity', e: 'I draw a new word and show it to the class. 🎨', y: 'I draw a picture of a new word and say it to the class. 🎨', o: 'I illustrate one of our new words so the whole class remembers it.', u: 'I design a poster that teaches the class three unit words.' },
        [{ category: 'write', e: 'I draw a picture and copy one English word under it. 🖍️', y: 'I draw a comic with two English bubbles. 💬', o: 'I draw a four-picture comic with English speech bubbles.', u: 'I draw a six-picture comic and write the story that goes with it.' }]),
    I('reading', '📚', 'Books & stories', 'The Storyteller’s Promise', /bookworm|loves? (reading|books)|likes? (reading|books)|reads a lot|βιβλιοφαγ|βιβλια|αγαπα το διαβασμα/, 'my favourite book', 'author', null, ['story', 'chapter', 'character', 'author', 'page', 'adventure'],
        { reason: 'Creativity', e: 'I show the class my favourite picture book. 📚', y: 'I tell a friend about my favourite story character. 📚', o: 'I recommend a book to the class and give two reasons.', u: 'I give the class a short book review: the plot, the best character and my rating.' },
        [{ category: 'read/listen', e: 'I listen to an English story and point to the pictures. 📖', y: 'I read a short English book at home. 📖', o: 'I read a short English story at home and tell the class how it ends.', u: 'I read a short English book at home and write three sentences about it.' }]),
    I('animals', '🐾', 'Animals & pets', 'The Beast-Friend’s Promise', /animal|\bpets?\b|\bdogs?\b|puppy|\bcats?\b|kitten|horse|pony|horse riding|ζω[αο]|ζωακι|σκυλ|γατ[αοιε]|γατακι|αλογ|ιππασ/, 'animals', 'vet', null, ['pet', 'paw', 'tail', 'feed', 'gentle', 'wild'],
        { reason: 'Respect', e: 'I am gentle with my friends, like with a little puppy. 🐾', y: 'I am gentle and kind, like with a little animal. 🐾', o: 'I treat everyone the way I treat animals I love: gently and patiently.', u: 'I stay patient with everyone, even when they are slow or make mistakes, the way I am with animals.' },
        [{ category: 'speak', e: 'I make an animal sound and say its name in English. 🐶', y: 'I tell the class three things about my favourite animal. 🐶', o: 'I present my favourite animal: where it lives, what it eats and why I love it.', u: 'I give a one-minute talk about an animal: its home, its food and one surprising fact.' }]),
    I('gaming', '🎮', 'Video games', 'The Gamer’s Quest', /video ?games?|gaming|gamer|minecraft|roblox|fortnite|playstation|nintendo|xbox|ηλεκτρονικ|βιντεοπαιχνιδ|παιζει παιχνιδια/, 'my favourite game', 'game designer', null, ['level', 'player', 'win', 'build', 'mission', 'team'],
        { reason: 'Focus', e: 'I try again when I fall, like in a game. 🎮', y: 'I treat hard work like a game level: I try again. 🎮', o: 'I treat a hard task like a hard level: I try again with a new plan.', u: 'I work out why a task went wrong and try again with a new strategy.' },
        [{ category: 'speak', e: 'I say the colours in my favourite game in English. 🕹️', y: 'I explain my favourite game to a friend in English. 🕹️', o: 'I explain the rules of my favourite game in English, step by step.', u: 'I review my favourite game in English: what it is, why it is good and one thing I would change.' }]),
    I('building', '🧱', 'Lego & building', 'The Inventor’s Promise', /lego|build(s|ing)? (things|models)|construct|robot|τουβλακ|λεγκο|κατασκευ|ρομποτ/, 'what I build', 'inventor', 'building', ['build', 'block', 'robot', 'machine', 'tower', 'invent'],
        { reason: 'Creativity', e: 'I build a tower and count the blocks in English. 🧱', y: 'I build something and tell the class its name in English. 🧱', o: 'I invent a machine on paper and explain what it does in English.', u: 'I design an invention on paper and present how it works, step by step.' },
        [{ category: 'speak', e: 'I name three things I build with in English. 🧱', y: 'I tell a friend how I build my tower, in English. 🏗️', o: 'I explain how to build my model so a friend can follow me.', u: 'I give clear step-by-step instructions, with first, next and finally, for something I built.' }]),
    I('space', '🔭', 'Space & science', 'The Explorer’s Promise', /outer space|space (and|&)|planets?\b|astronaut|rocket|science|experiment|scientist|διαστημ|πλανητ|αστροναυτ|πειραμ|επιστημ/, 'space and science', 'astronaut', null, ['planet', 'rocket', 'star', 'moon', 'experiment', 'discover'],
        { reason: 'Creativity', e: 'I point to the moon and a star and say them in English. 🌙', y: 'I ask one “why” question about the world. 🔭', o: 'I bring the class one amazing science fact in English.', u: 'I explain one science fact to the class and how we know it is true.' },
        [{ category: 'write', e: 'I draw a rocket and copy the word “moon”. 🚀', y: 'I write three English words about space. 🚀', o: 'I write a short English report about a planet or an experiment.', u: 'I write a short report about a planet, with facts, numbers and one question I still have.' }]),
    I('dinosaurs', '🦖', 'Dinosaurs', 'The Fossil Hunter’s Promise', /dinosaur|δεινοσαυρ/, 'dinosaurs', 'fossil hunter', null, ['dinosaur', 'fossil', 'huge', 'bones', 'ancient', 'claws'],
        { reason: 'Creativity', e: 'I roar like a dinosaur and say its colour in English. 🦖', y: 'I make a dinosaur roar and say its name in English. 🦖', o: 'I describe a dinosaur in English and let the class guess which one.', u: 'I compare two dinosaurs in English: which was bigger, faster and stronger.' },
        [{ category: 'words', e: 'I say “big” and “small” with my dinosaur toys. 🦕', y: 'I learn three dinosaur body words: teeth, tail and claws. 🦕', o: 'I make a dinosaur fact card with four English words and a picture.', u: 'I make a dinosaur fact file in English: size, food, home and when it lived.' }]),
    I('cooking', '🧁', 'Cooking & baking', 'The Chef’s Promise', /cook|bak(e|es|ing)\b|chef|recipe|μαγειρ|ζαχαροπλαστ|φτιαχνει γλυκα/, 'cooking', 'chef', 'cooking', ['cook', 'bake', 'recipe', 'mix', 'cake', 'delicious'],
        { reason: 'Teamwork', e: 'I help set the table and name the things in English. 🍽️', y: 'I help at home and say what I do in English. 🍳', o: 'I help cook at home and say each step in English.', u: 'I cook something at home and explain the steps to the class in English.' },
        [{ category: 'write', e: 'I draw my favourite food and copy its English name. 🍕', y: 'I write a shopping list of four foods in English. 🛒', o: 'I write my favourite recipe in English, step by step.', u: 'I write a recipe with amounts and instructions, and explain why it is my favourite.' }]),
    I('swimming', '🏊', 'Swimming', 'The Swimmer’s Promise', /swim|κολυμβ|κολυμπ/, 'swimming', 'swimmer', 'swimming practice', ['swim', 'pool', 'dive', 'splash', 'fast', 'wave'],
        { reason: 'Focus', e: 'I keep trying, like a little fish. 🐠', y: 'I keep going like a swimmer to the end of the pool. 🏊', o: 'I keep going to the end of a task, like the last length of the pool.', u: 'I set myself a goal for the week and keep going until I reach it, like a swimmer in training.' },
        [{ category: 'speak', e: 'I show “swim”, “jump” and “splash” and say them. 🏊', y: 'I tell a friend what I do at the pool, in English. 🏊', o: 'I describe my swimming lesson in English: before, during and after.', u: 'I explain to the class how to stay safe at the pool or the sea, in English.' }]),
    I('martial', '🥋', 'Martial arts', 'The Black Belt’s Promise', /karate|judo|taekwondo|kung ?fu|martial arts|aikido|καρατε|τζουντο|ταεκβοντο|πολεμικ(ες|ων) τεχν/, 'my martial art', 'black belt', 'training', ['kick', 'belt', 'bow', 'strong', 'balance', 'respect'],
        { reason: 'Respect', e: 'I bow and say “Thank you!” to my teacher. 🥋', y: 'I bow to my mistakes and try again, like in training. 🥋', o: 'I bring dojo respect to class: I listen fully before I speak.', u: 'I show dojo respect: I listen fully, wait my turn and thank the person who corrects me.' },
        [{ category: 'speak', e: 'I count to ten in English, like in training. 🥋', y: 'I show the class two moves and name them in English. 🥋', o: 'I explain one rule of my martial art and why it matters.', u: 'I give a short talk about my martial art: its rules, its values and what it taught me.' }]),
    I('gymnastics', '🤸', 'Gymnastics', 'The Gymnast’s Promise', /gymnast|ενοργαν|ρυθμικ/, 'gymnastics', 'gymnast', 'gymnastics', ['jump', 'roll', 'balance', 'stretch', 'flip', 'land'],
        { reason: 'Focus', e: 'I stand still like a statue when my teacher talks. 🤸', y: 'I keep my balance: I finish one task before the next. 🤸', o: 'I keep my balance: one task finished before I start the next.', u: 'I finish one task completely and check it before I start the next.' },
        [{ category: 'speak', e: 'I do a move and say “roll”, “jump” or “stretch”. 🤸', y: 'I teach a friend a stretch in English. 🤸', o: 'I lead the class in a one-minute stretch with English instructions.', u: 'I lead a warm-up in English and explain why each stretch helps.' }]),
    I('tennis', '🎾', 'Tennis', 'The Champion’s Promise', /tennis|τενις|padel|πανταλ/, 'tennis', 'tennis player', 'tennis practice', ['ball', 'racket', 'serve', 'net', 'point', 'match'],
        { reason: 'Respect', e: 'I say “Good job!” to my friend. 🎾', y: 'I say “Good game!” to my friend after we play. 🎾', o: 'I return every question like a good rally: I listen, then answer.', u: 'I listen to each answer in a discussion and reply to it, like a long rally.' },
        [{ category: 'speak', e: 'I play catch with a friend and count in English. 🎾', y: 'I ask my partner a question and answer one back, like a rally. 🎾', o: 'I keep an English conversation going for five turns each, like a rally.', u: 'I keep an English conversation going for two minutes with follow-up questions.' }]),
    I('cycling', '🚲', 'Bikes & skating', 'The Rider’s Promise', /bike|cycling|bmx|skate|scooter|ποδηλατ|πατιν|σκειτ|πατινι/, 'riding my bike', 'cyclist', 'riding', ['bike', 'ride', 'wheel', 'helmet', 'road', 'fast'],
        { reason: 'Focus', e: 'I check my things before I go, like on my bike. 🚲', y: 'I wear my “helmet”: I check my work before I go. 🚲', o: 'I check my work before I hand it in, like checking my bike before a ride.', u: 'I check my writing with a checklist before I hand it in, like a bike before a race.' },
        [{ category: 'speak', e: 'I play “stop” and “go” in English with my friends. 🚦', y: 'I tell the class where I ride my bike, in English. 🚲', o: 'I describe my favourite ride in English: where, who with and what I saw.', u: 'I give directions in English for a route I know: left, right, straight on.' }]),
    I('theatre', '🎭', 'Acting & theatre', 'The Actor’s Promise', /theat|acting|actor|actress|drama (club|class)|θεατρ|ηθοποι|παραστασ/, 'acting', 'actor', 'rehearsals', ['stage', 'act', 'role', 'voice', 'scene', 'audience'],
        { reason: 'Creativity', e: 'I act out a new word with my whole body. 🎭', y: 'I act out a new word and let the class guess. 🎭', o: 'I perform a short English scene with feeling, not just reading.', u: 'I perform a short English scene from memory, with feeling and gestures.' },
        [{ category: 'speak', e: 'I say my word loud and clear, like on stage. 🎤', y: 'I say my line loud and clear, like on stage. 🎤', o: 'I read aloud with an actor’s voice: loud, clear and with feeling.', u: 'I read aloud with an actor’s voice and change it for each character.' }]),
    I('nature', '🌿', 'Nature & outdoors', 'The Ranger’s Promise', /nature|garden|plants|hiking|camping|outdoors|φυση|κηπ[οα]|φυτα|πεζοπορ|κατασκην/, 'nature', 'park ranger', null, ['tree', 'flower', 'forest', 'river', 'grow', 'leaf'],
        { reason: 'Respect', e: 'I water our plant and say “Grow, grow!” 🌱', y: 'I look after our plants and our classroom. 🌱', o: 'I take care of our shared spaces, like a ranger cares for a forest.', u: 'I take care of our shared spaces and kindly remind others to do the same.' },
        [{ category: 'write', e: 'I draw a leaf and copy the word “leaf”. 🍃', y: 'I write the names of three things I saw outside. 🌳', o: 'I keep a nature diary in English for a week: one line a day.', u: 'I keep a nature diary for a week and share the most interesting entry.' }]),
    I('coding', '💻', 'Computers & coding', 'The Coder’s Promise', /coding|code|computer|programm|scratch|υπολογιστ|προγραμματ|κομπιουτερ/, 'computers', 'programmer', 'coding', ['computer', 'code', 'screen', 'click', 'program', 'bug'],
        { reason: 'Focus', e: 'I find one wrong thing in my picture and fix it. 🐞', y: 'I find and fix one “bug” in my work. 🐞', o: 'I debug my writing: I find and fix one mistake before I hand it in.', u: 'I debug my writing: I find and fix three mistakes before I hand it in.' },
        [{ category: 'speak', e: 'I give a friend robot orders: “walk”, “stop”, “turn”. 🤖', y: 'I give a friend robot orders in English to reach the door. 🤖', o: 'I explain one class task step by step, like code.', u: 'I explain how an app I use works, in clear English steps.' }]),
    I('chess', '♟️', 'Chess', 'The Strategist’s Promise', /chess|σκακ/, 'chess', 'chess champion', 'chess', ['king', 'queen', 'move', 'plan', 'check', 'board'],
        { reason: 'Focus', e: 'I look and think before I answer. ♟️', y: 'I think before I move: I read the question twice. ♟️', o: 'I plan before I move: I read every question twice before I answer.', u: 'I plan before I speak or write: I think of two ideas and choose the better one.' },
        [{ category: 'speak', e: 'I name two chess pieces in English: king and queen. ♟️', y: 'I teach a friend how two chess pieces move, in English. ♟️', o: 'I explain how every chess piece moves, in English.', u: 'I explain a chess strategy in English and why it works.' }]),
    I('cars', '🏎️', 'Cars & racing', 'The Racer’s Promise', /\bcars?\b|racing|formula|αυτοκινητ|αγωνες ταχυτ|φορμουλα/, 'cars', 'racing driver', null, ['car', 'fast', 'wheel', 'engine', 'race', 'drive'],
        { reason: 'Focus', e: 'I start my work when my teacher says “Go!” 🏁', y: 'I start my work fast, like at the green light. 🏁', o: 'I start my work at the “green light”: no waiting, no wandering.', u: 'I start every task straight away and keep a steady speed to the finish line.' },
        [{ category: 'speak', e: 'I say car colours in English: red car, blue car. 🚗', y: 'I tell the class about my favourite car with three words. 🏎️', o: 'I describe my dream car in English: its colour, its speed and what it can do.', u: 'I compare two cars in English and say which one I would choose, and why.' }]),
    I('films', '🎬', 'Films & cartoons', 'The Film Fan’s Promise', /movie|film|cartoon|anime|disney|pixar|ταινι|κινουμεν|καρτουν/, 'my favourite film', 'film director', null, ['film', 'hero', 'scene', 'funny', 'scary', 'ending'],
        { reason: 'Creativity', e: 'I tell a friend the name of my favourite cartoon. 🎬', y: 'I tell a friend about my favourite cartoon in English. 🎬', o: 'I retell my favourite film scene in English without giving away the ending.', u: 'I review a film in English: what it is about, what I liked and my star rating.' },
        [{ category: 'read/listen', e: 'I watch a short English cartoon and say one word I hear. 📺', y: 'I watch a short English cartoon and tell a friend what happened. 📺', o: 'I watch a scene in English and retell it in my own words.', u: 'I watch a scene with English subtitles and note three new expressions.' }]),
    I('travel', '✈️', 'Travel & places', 'The Traveller’s Promise', /travel|trip|holiday abroad|ταξιδ/, 'travelling', 'explorer', null, ['travel', 'map', 'plane', 'country', 'beach', 'city'],
        { reason: 'Creativity', e: 'I point to a place on the map and say its name. 🗺️', y: 'I tell the class about a place I love, with three words. 🗺️', o: 'I describe a place I have visited, in English, so the class can picture it.', u: 'I plan a dream trip in English: where we go, how we travel and what we see.' },
        [{ category: 'write', e: 'I draw a place I visited and copy its name. ✈️', y: 'I write a postcard of two sentences from a place I love. ✉️', o: 'I write a postcard in English from a place I have visited.', u: 'I write a travel blog post in English about a trip, with three highlights.' }]),
    I('superheroes', '🦸', 'Superheroes', 'The Superhero’s Promise', /superhero|marvel|spider-?man|batman|avengers|υπερηρω/, 'superheroes', 'superhero', null, ['hero', 'power', 'save', 'brave', 'cape', 'mask'],
        { reason: 'Respect', e: 'I use my “superpower” to help a friend. 🦸', y: 'I help a friend with my “superpower” and say what it is. 🦸', o: 'I use my real superpower in class: I name it and help someone with it.', u: 'I use my real strengths to help the class and explain how they help.' },
        [{ category: 'speak', e: 'I show my superhero pose and say “I am strong!” 💪', y: 'I tell the class what my superpower would be, in English. 🦸', o: 'I invent a superhero and describe their powers in English.', u: 'I invent a superhero and tell a short story about how they save the day.' }])
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
/** The generic passion promises, filled with the interest. {n} grows 1 · 2 · 3 · 4 with the band. */
const PASSION_LINES = [
    { k: 'talk', category: 'speak', e: 'I say one English word about {topic}.', y: 'I say {n} short English sentences about {topic}.', o: 'I tell the class about {topic} in {N} English sentences.', u: 'I give a one-minute talk in English about {topic}.' },
    { k: 'why', category: 'speak', e: 'I show my partner a picture of {topic} and say “I like it!”', y: 'I tell my partner what I love about {topic}.', o: 'I explain to a partner why I love {topic}, with two reasons.', u: 'I explain to a partner why I care so much about {topic}, with reasons and an example.' },
    { k: 'qa', category: 'speak', e: 'I answer “yes” or “no” to a question about {topic}.', y: 'I answer one question from a friend about {topic}.', o: 'I answer three questions from classmates about {topic}, in English.', u: 'I answer the class’s questions about {topic} and ask one question back.' },
    { k: 'opinion', category: 'speak', u: 'I share my opinion about {topic} in a discussion and reply politely to a different view.' },
    { k: 'words', category: 'words', e: 'I learn one {label} word: {w}.', y: 'I learn {n} {label} {ww} in English: {w}.', o: 'I learn and use {N} {label} words in English: {w}.', u: 'I learn {N} {label} words and use them in speaking and writing: {w}.' },
    { k: 'dict', category: 'words', e: 'I point to a picture about {topic} and say one English word.', y: 'I draw and label {n} {label} {ww}: {w}.', o: 'I make a mini {label} dictionary with {N} English words and examples.', u: 'I make my own {label} glossary of {N} words, each with a meaning in English and an example.' },
    { k: 'teach', category: 'words', e: 'I show a friend one {label} word.', y: 'I teach a friend one {label} word.', o: 'I teach my group {n} {label} words in English.', u: 'I teach my group {n} {label} words and test them with a quick quiz.' },
    { k: 'write', category: 'write', e: 'I draw a picture of {topic} and copy one English word under it.', y: 'I write {n} sentences about {topic}.', o: 'I write a short paragraph in English about {topic}.', u: 'I write two paragraphs about {topic}, with linking words like because and however.' },
    { k: 'poster', category: 'write', o: 'I make an English poster about {topic} with a title and four labels.', u: 'I make an English fact poster about {topic} and present it in one minute.' },
    { k: 'ask', category: 'write', e: '', y: 'I write one question to ask a famous {person}.', o: 'I write {N} questions I would ask a famous {person}.', u: 'I write an interview with a famous {person}: {N} questions and the answers I imagine.' },
    { k: 'listen', category: 'read/listen', e: 'I watch a short English cartoon about {topic} and point to what I know.', y: 'I watch a short English video about {topic} and say one word I heard.', o: 'I read or watch something short about {topic} in English and share one new fact.', u: 'I read a short English article about {topic} and tell the class two new facts.' },
    { k: 'practise', category: 'habit', needsPractice: true, e: 'I say my new English words every day, like {practice}.', y: 'I practise English a little every day, like {practice}.', o: 'I practise English like {practice}: a little, every single day.', u: 'I plan my English practice like {practice}: a goal, a little every day and a check on Sunday.' },
    { k: 'daily', category: 'habit', e: 'I say one {label} word in English every day.', y: 'I learn one new {label} word every day.', o: 'I learn one new {label} word every day and use it once.', u: 'I learn one {label} word a day, keep a list and use three of them in my writing.' }
];

/** Passion promises for one interest (from notes or tapped live). */
export function passionOaths(s, interestId, { fromNotes = false } = {}) {
    const x = interestById(interestId);
    if (!x) return [];
    const count = bandCount(s);
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
        { category: 'speak', e: 'I wave and say “Hello!” to my teacher every lesson. 👋', y: 'I put my hand up once in every lesson. ✋', o: 'I raise my hand once in the first ten minutes of each lesson.', u: 'I share one idea in every lesson, even a short one, without being asked twice.' },
        { category: 'speak', e: 'I whisper my word to my partner, then say it out loud. 🗣️', y: 'I whisper my answer to my partner first, then say it out loud. 🗣️', o: 'I rehearse my answer with a partner, then share it with the class.', u: 'I prepare one thing to say before the lesson, practise it, then say it to the class.' },
        { category: 'read/listen', e: 'I say the story’s magic words with the class. 📖', y: 'I read one line aloud for the class. 📖', o: 'I volunteer to read one short part aloud.', u: 'I volunteer to read a whole paragraph aloud.' }
    ]),
    N('chatty', 'Sharing the stage', /chatty|talkative|talks a lot|calls? out|interrupt|φλυαρ|μιλαει πολυ|μιλα συνεχεια|διακοπτ|πεταγεται/, [
        { category: 'virtue', reason: 'Respect', e: 'I zip my lips while my friend talks. 🤐', y: 'I count to three before I speak, so friends get a turn. 🤫', o: 'I wait three seconds before I answer, so others get a turn to think.', u: 'I let a classmate finish, then build on their idea before I add mine.' },
        { category: 'speak', e: 'I put my hand up and wait. ✋', y: 'I put my hand up instead of calling out. ✋', o: 'I raise my hand instead of calling out, all lesson long.', u: 'I save my comments for the right moment and make each one count.' },
        { category: 'virtue', reason: 'Respect', e: '', y: 'I ask a friend “What do you think?” before I talk. 💬', o: 'I ask a quieter classmate what they think before I share my idea.', u: 'I invite two quieter classmates to share before I give my view.' }
    ]),
    N('homework', 'Steady homework', /homework|forgets?|forgot|didn'?t bring|ξεχνα|ξεχασ|δεν φερνει|δεν εφερε|εργασι(ες|α) (λειπ|δεν)/, [
        { category: 'habit', e: 'I show my homework to my teacher every lesson. 🎒', y: 'I put my homework in my bag the night before. 🎒', o: 'I pack my homework the night before every lesson.', u: 'I write every homework task in a planner and pack it the night before.' },
        { category: 'habit', e: 'I put a sticker on my chart when my homework is done. ⭐', y: 'I tick my homework off in a little list. ✅', o: 'I keep a homework checklist and tick each task off.', u: 'I keep a weekly homework checklist and look over it every Sunday.' },
        { category: 'habit', e: '', y: 'I do my homework on the day I get it. 📅', o: 'I start my homework on the same day I get it.', u: 'I start homework on the day I get it and do the hardest part first.' }
    ]),
    N('late', 'Starting on time', /\blate\b|lateness|punctual|αργει|καθυστερ|αργοπορ/, [
        { category: 'habit', e: 'I come in, say “Good morning!” and sit down. ⏰', y: 'I am in my seat when the lesson starts. ⏰', o: 'I am in my seat with my book open when the lesson starts.', u: 'I am in my seat with my book open and homework out before the lesson begins.' },
        { category: 'habit', e: '', y: 'I get my things ready before the lesson begins. 🎒', o: 'I get ready five minutes before every lesson.', u: 'I plan my week so I arrive on time to every lesson.' }
    ]),
    N('focus', 'Steady focus', /distract|focus|concentrat|daydream|attention|αφηρημ|συγκεντρωσ|προσοχη|χαζευ|δεν προσεχ/, [
        { category: 'virtue', reason: 'Focus', e: 'I keep my eyes on the book at story time. 👀', y: 'I keep my eyes on my work until the timer ends. 👀', o: 'I keep working until the timer ends, without stopping to chat.', u: 'I set myself a small goal for each task and keep working until I reach it.' },
        { category: 'habit', e: 'I keep only my book and pencil on my desk. 🧹', y: 'I clear my desk so only my English things are on it. 🧹', o: 'I clear my desk of everything but this lesson’s things.', u: 'I organise my desk and notes before the lesson, so I can focus from the start.' },
        { category: 'read/listen', e: 'I listen, then do what my teacher says. 👂', y: 'I listen to the whole instruction before I start. 👂', o: 'I repeat the instruction in my head before I start.', u: 'I note down the steps of an instruction before I start.' }
    ]),
    N('handwriting', 'Clear handwriting', /handwriting|messy writing|illegible|γραφικ|καλλιγραφ|ακατανοητ|ασχημα γραμματα/, [
        { category: 'write', e: 'I trace my letters slowly and neatly. ✏️', y: 'I write my new words neatly, letter by letter. ✏️', o: 'I write one page so neatly that anyone could read it.', u: 'I write a whole piece neatly, then check that every word can be read.' },
        { category: 'write', e: 'I write my name neatly, with a big first letter. 🖍️', y: 'I write on the line with finger spaces. ✍️', o: 'I leave clear spaces and stay on the line in my writing.', u: 'I hand in a neat final copy, with a title and clear paragraphs.' }
    ]),
    N('pronunciation', 'Clear pronunciation', /pronunc|accent|προφορ/, [
        { category: 'speak', e: 'I say my new words after my teacher, slowly. 👄', y: 'I say my new words slowly and clearly. 👄', o: 'I practise saying three tricky words aloud until they sound right.', u: 'I practise five tricky words aloud and record myself to check them.' },
        { category: 'read/listen', e: 'I listen and repeat a word three times. 🔁', y: 'I listen to a word and repeat it until it sounds right. 👂', o: 'I listen to a word, repeat it, and check it with my teacher.', u: 'I listen to an English speaker say a sentence and copy its rhythm.' }
    ]),
    N('reading', 'Reading with confidence', /(reads?|reading) (slow|is (hard|difficult|weak))|struggles? (with )?reading|dyslex|δυσλεξ|αναγνωσ|διαβαζει αργα|δυσκολευ.* (να )?διαβα/, [
        { category: 'read/listen', e: 'I point to the pictures while I listen to a story. ☝️', y: 'I read one short page with my finger under the words. ☝️', o: 'I read one short page aloud at home, slowly, every day.', u: 'I read one short page every day and mark the words I do not know.' },
        { category: 'read/listen', e: 'I say the first sound of a word in my book. 🔤', y: 'I listen and follow the words in my book. 📖', o: 'I follow the text with my eyes while I listen to it.', u: 'I listen to a text while I follow it, then read it again on my own.' }
    ]),
    N('spelling', 'Spelling', /spelling|misspell|ορθογραφ|λαθη στις λεξεις/, [
        { category: 'write', rule: 'practice', e: 'I trace and copy one new word. ✏️', y: 'I write each new word three times and check it. ✏️', o: 'I keep a list of my spelling mistakes and practise them.', u: 'I keep a list of my spelling mistakes, find the pattern and practise it.' },
        { category: 'words', e: 'I sing the letters of my name in English. 🔤', y: 'I spell three words aloud to someone at home. 🔤', o: 'I spell five unit words aloud to someone at home.', u: 'I learn one spelling rule and find five words that follow it.' }
    ]),
    N('worry', 'Calm courage', /anxious|nervous|stress|worr(y|ied|ies)|confidence|afraid|αγχ|φοβ|ανησυχ|αυτοπεποιθ|ανασφαλ/, [
        { category: 'habit', e: 'I smell the flower, blow the candle, then I try. 🌸', y: 'I take a big breath and try. 🌬️', o: 'I take a slow breath before a hard task, then begin.', u: 'I use a calm-down trick before a test, then start with the question I know best.' },
        { category: 'speak', e: 'I say “I can try!” and give it a go. 💪', y: 'I try one answer, even if I am not sure. 💪', o: 'I give an answer in class even when I am not sure, and I am proud I tried.', u: 'I take one brave risk each lesson: a new word, a longer answer or a question.' }
    ]),
    N('frustration', 'Keeping going', /frustrat|angry|upset|gives up|temper|θυμων|νευρ|τα παραταει|εκνευρ|ξεσπα/, [
        { category: 'virtue', reason: 'Focus', e: 'When it is hard, I say “Not yet!” 🌱', y: 'When it is hard, I say “Not yet!” and try again. 🌱', o: 'When a task is hard, I say “not yet” and try one more way.', u: 'When I get stuck, I try two other ways before I ask for help.' },
        { category: 'habit', e: 'I say “Help, please” calmly. 🙋', y: 'I ask for help calmly when I feel stuck. 🙋', o: 'I ask for help calmly and say exactly where I am stuck.', u: 'I notice when I feel frustrated, take a short pause and come back to the task.' }
    ]),
    N('helper', 'A natural helper', /helps? (others|everyone|classmates)|helpful|leader|kind(ness)?\b|caring|βοηθα|ηγετικ|ευγενικ|καλοσυνατ|προθυμ/, [
        { category: 'virtue', reason: 'Teamwork', e: 'I help a friend find their pencil or their page. 🤝', y: 'I help a friend who is stuck, without giving the answer. 🤝', o: 'I coach a classmate through a problem without giving the answer.', u: 'I coach a classmate with questions, so they find the answer themselves.' },
        { category: 'speak', e: '', y: 'I help my group take turns. 🔄', o: 'I lead my group’s discussion and make sure everyone speaks.', u: 'I chair my group’s discussion and sum up what we agreed.' }
    ]),
    N('newcomer', 'Settling in', /new (student|to the class|to our class)|just joined|joined (us|the class)|νεος μαθητ|νεα μαθητρ|καινουργι|ηρθε φετος|μετεγγραφ/, [
        { category: 'virtue', reason: 'Teamwork', e: 'I learn the name of a new friend. 👋', y: 'I learn the names of three classmates. 👋', o: 'I learn something new about three classmates, in English.', u: 'I interview a classmate in English and introduce them to the class.' },
        { category: 'speak', e: 'I say “Hello!” and smile at someone new. 😊', y: 'I say hello in English to someone new. 😊', o: 'I start a short English chat with someone I don’t know well.', u: 'I start an English conversation with someone new and ask them three questions.' }
    ]),
    N('grammar', 'Grammar patterns', /grammar|tenses|γραμματικ|χρονους/, [
        { category: 'write', e: '', y: 'I write one sentence with our new pattern. ✍️', o: 'I write three sentences that use this week’s grammar correctly.', u: 'I write a paragraph with this week’s grammar, then underline every example.' },
        { category: 'speak', e: 'I say our new sentence with the class, like a song. 🎵', y: 'I say two sentences with our new pattern. 🗣️', o: 'I use this week’s grammar three times when I speak.', u: 'I use this week’s grammar when I speak and correct my own slips.' }
    ]),
    N('vocabulary', 'Growing vocabulary', /vocabulary|λεξιλογ/, [
        { category: 'words', e: 'I learn one new word and draw it. 🔤', y: 'I learn two new words and draw them. 🔤', o: 'I keep a word notebook and add three new words each lesson.', u: 'I keep a vocabulary notebook with the meaning, an example and an opposite for each word.' },
        { category: 'words', e: 'I point to five things in our classroom and say them. 👉', y: 'I label three things at home in English. 🏷️', o: 'I put English sticky notes on ten things at home.', u: 'I learn five new words a week from my reading and use them in my writing.' }
    ]),
    N('advanced', 'Ready for more', /excellent|advanced|gifted|very strong|top of|αριστ|εξαιρετ|πολυ καλ(ος|η) μαθητ|ταλεντ/, [
        { category: 'write', e: '', y: 'I try a longer sentence than I need. 🚀', o: 'I use one ambitious new word or structure in every piece of writing.', u: 'I use an advanced structure, like “if” or “which”, in every piece of writing.' },
        { category: 'speak', e: 'I say my answer in a whole sentence. 💡', y: 'I say my answer with “because”. 💡', o: 'I give an answer with a reason and an example.', u: 'I give my opinion with a reason and an example, then ask what others think.' }
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
        { category: 'virtue', reason: 'Respect', e: 'I wait for my turn, like a guard at the gate. 🛡️', y: 'I keep our class rules safe: I wait for my turn. 🛡️', o: 'I guard our class’s calm: I wait my turn and help others do the same.', u: 'I protect our class calm: I keep the rules and kindly help others keep them.' },
        { category: 'speak', e: 'I say “Are you OK?” to a sad friend. 💛', y: 'I use kind English words when a friend is sad. 💛', o: 'I stand up for a classmate with calm, kind English words.', u: 'I speak up calmly in English when someone is treated unfairly.' },
        { category: 'habit', e: 'I put our toys and books back in their place. 🧺', y: 'I look after our classroom things. 🧺', o: 'I look after our classroom and leave it better than I found it.', u: 'I take care of one shared corner of our classroom every week.' }
    ],
    Sage: [
        { category: 'read/listen', e: 'I ask “Why?” about our story. 🔮', y: 'I ask one “why” question about our story. 🔮', o: 'I ask one deep “why” question in every lesson.', u: 'I ask a deep question about a text and suggest my own answer.' },
        { category: 'words', e: 'I find a beautiful English word and say it to the class. ✨', y: 'I find one beautiful new English word. ✨', o: 'I collect {N} beautiful English words and share my favourite.', u: 'I collect {N} beautiful English words and use my favourite in my writing.' },
        { category: 'virtue', reason: 'Creativity', e: 'I draw a new ending for our story. 🌙', y: 'I imagine a new ending for our story. 🌙', o: 'I invent a new ending or twist for something we read.', u: 'I write a different ending for something we read and explain my choice.' }
    ],
    Paladin: [
        { category: 'virtue', reason: 'Teamwork', e: 'I invite a friend who is alone to play. ⚔️', y: 'I make sure no one in my team is alone. ⚔️', o: 'I make sure everyone in my group has a job and a voice.', u: 'I make sure everyone in my group has a role, and I check on them during the task.' },
        { category: 'speak', e: 'I say “Well done!” to a friend. 🙌', y: 'I say “Well done!” to my team in English. 🙌', o: 'I encourage my team in English when things get hard.', u: 'I encourage my team in English and suggest a way forward when we are stuck.' },
        { category: 'habit', e: 'I finish my part of the game. 🤝', y: 'I finish my part of the team work. 🤝', o: 'I finish my part of every group task on time.', u: 'I finish my part of a group project on time and help others finish theirs.' }
    ],
    Artificer: [
        { category: 'words', e: 'I make a word picture with one new word. 🖼️', y: 'I make a word picture with {n} new words. 🖼️', o: 'I build a word map for our unit with {N} words.', u: 'I build a word map with {N} words and link them with arrows and examples.' },
        { category: 'virtue', reason: 'Focus', e: 'I finish my picture slowly and carefully. ⚙️', y: 'I finish my work like a careful maker. ⚙️', o: 'I work like a craftsperson: step by step until it is finished.', u: 'I plan, make and check my work step by step, like a real engineer.' },
        { category: 'write', e: 'I fix one thing in my picture. 🔧', y: 'I check and fix one thing in my work. 🔧', o: 'I fix one mistake in my work before I hand it in.', u: 'I edit my work: I fix two mistakes and improve one sentence.' }
    ],
    Scholar: [
        { category: 'habit', rule: 'practice', e: 'I say my new words with my family every day. 📜', y: 'I practise for our next test a little each day. 📜', o: 'I prepare for the next trial with ten minutes of practice a day.', u: 'I make a revision timetable for the next trial and follow it.' },
        { category: 'write', e: 'I look at a mistake with my teacher and try again. 🔍', y: 'I learn from one mistake in my last test. 🔍', o: 'I correct my last test and explain one mistake in my own words.', u: 'I correct my last test and write the rule behind each mistake.' },
        { category: 'words', e: '', y: 'I practise the words from my last test two times. 📚', o: 'I review the words from my last trial three times before the next one.', u: 'I make flashcards of the words from my last trial and test myself three times.' }
    ],
    Vanguard: [
        { category: 'speak', e: 'I play a word game with a friend. ⚜️', y: 'I play an English word game with a friend. ⚜️', o: 'I challenge a friend to an English word game and play fair.', u: 'I challenge a classmate to an English word battle and help them if they lose.' },
        { category: 'habit', e: 'I try the hard thing first. 💪', y: 'I try the hardest task first. 💪', o: 'I pick the hardest task first and give it my best try.', u: 'I choose the hardest version of a task and push myself to finish it.' },
        { category: 'virtue', reason: 'Focus', e: 'I practise my words like a champion. 🏅', y: 'I train my English a little every day, like a champion. 🏅', o: 'I train like a champion: I practise one weak spot until it improves.', u: 'I find my weakest skill and train it a little every day for two weeks.' }
    ],
    Nomad: [
        { category: 'speak', e: 'I wave and say “Hello!” when I arrive. 👟', y: 'I say hello in English when I arrive. 👟', o: 'I greet the class in English and ask someone how they are.', u: 'I greet the class in English and start a short chat with someone.' },
        { category: 'habit', e: 'I come to my English lessons this week. 🗓️', y: 'I come to every lesson this week. 🗓️', o: 'I come to every lesson and catch up fast if I miss one.', u: 'I keep track of what I miss and catch up within a day.' },
        { category: 'read/listen', e: '', y: 'I ask a friend what we did while I was away. 🧭', o: 'I find out what the class learned while I was away and tell my teacher.', u: 'I find out what I missed, study it on my own and tell my teacher what I learned.' }
    ],
    Patron: [
        { category: 'virtue', reason: 'Respect', e: 'I give a friend a smile and a kind word. 💝', y: 'I give one kind word in English every lesson. 💝', o: 'I give one real compliment in English every lesson.', u: 'I give one specific, honest compliment in English every lesson.' },
        { category: 'speak', e: 'I say “Thank you!” in English. 🙏', y: 'I say “thank you” in English for something kind. 🙏', o: 'I thank a classmate in English for something specific they did.', u: 'I thank a classmate in English and explain how their help made a difference.' },
        { category: 'virtue', reason: 'Teamwork', e: 'I share my crayons and my toys. 🤲', y: 'I share my things and my ideas. 🤲', o: 'I share what I am good at with a classmate who needs it.', u: 'I share what I am good at by giving a classmate a mini lesson.' }
    ]
};
function heroOaths(s) {
    const lines = HERO_LINES[s.heroClass]; if (!lines) return [];
    const n = bandCount(s);
    const out = [];
    lines.forEach((l, i) => {
        const text = fill(line(s, l), { n: NUM[n], N: NUM[Math.min(6, n + 2)] }); if (!text) return;
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
        { key: 'guild.idea', spirit: 'hero', category: 'speak', text: line(s, { e: 'I bring one English word for my ' + short + ' friends. 🏰', y: 'I bring one English idea for my ' + short + ' friends. 🏰', o: 'I bring one English idea that helps the ' + s.guildName + ' guild.', u: 'I bring an idea that helps the ' + s.guildName + ' guild and explain it in English.' }),
            why: 'For their guild, the ' + s.guildName + '.', title: 'The ' + short + ' Oath', score: 1.85 },
        { key: 'guild.help', spirit: 'gift', category: 'virtue', text: line(s, { e: 'I help a friend from my guild. 🤝', y: 'I help a friend from my guild with English. 🤝', o: 'I help a guild-mate with an English task this week.', u: 'I help a guild-mate prepare for a test or a task this week.' }),
            why: 'Guild-mates lift each other.', title: 'The ' + short + ' Oath', score: 1.75, target: { kind: 'virtue', reason: 'Teamwork' }, rule: 'virtue' }
    ].filter(x => x.text);
}

// ─── The ladder: one rung above a kept promise ────────────────────────────────
const LADDER = {
    speak: { e: ['I say one English word to my teacher.', 'I say “Hello” and my name in English.', 'I answer a question with one word.', 'I say a little sentence: “I like…”.', 'I sing an English song with the class.'],
        y: ['I say one English word to the class.', 'I say a whole sentence in English.', 'I ask a friend a question in English.', 'I tell the class two sentences about me.', 'I talk with a partner in English for one minute.'],
        o: ['I share one idea in English with the class.', 'I ask and answer a question in English.', 'I speak in English for thirty seconds about something I like.', 'I give a one-minute talk in English.', 'I lead a short English discussion in my group.'],
        u: ['I give my opinion in English with a reason.', 'I speak for one minute about a topic I chose.', 'I ask follow-up questions in a discussion.', 'I give a two-minute talk from notes, not a script.', 'I lead a class discussion and sum up the ideas.'] },
    words: { e: ['I say one new word.', 'I point and say two new words.', 'I say three new words with pictures.', 'I teach one word to my family.', 'I say five new words this week.'],
        y: ['I learn one new word.', 'I use two new words.', 'I use three new words in sentences.', 'I teach four new words to a friend.', 'I use five new words this week.'],
        o: ['I use three new words in my own sentences.', 'I use five new words while speaking.', 'I use new words in both speaking and writing.', 'I explain five new words with examples.', 'I learn a word family around each new word.'],
        u: ['I use four new words in a paragraph.', 'I use new words in a discussion without notes.', 'I learn a word family for each new word.', 'I explain five new words in English, not Greek.', 'I learn which words go together, like “make a mistake”.'] },
    write: { e: ['I trace one word.', 'I copy one word neatly.', 'I copy my name and one word.', 'I draw and copy two words.', 'I copy a short sentence.'],
        y: ['I copy one sentence neatly.', 'I write one sentence by myself.', 'I write two sentences by myself.', 'I write three sentences about my day.', 'I write a little story of four sentences.'],
        o: ['I write two sentences with a new word.', 'I write a short paragraph.', 'I write a paragraph with linking words.', 'I write a paragraph and improve it after feedback.', 'I write a short piece with a beginning, middle and end.'],
        u: ['I write a paragraph with linking words.', 'I write two paragraphs on one topic.', 'I plan, write and check a short essay.', 'I write an email with a clear purpose and a proper ending.', 'I write a story with dialogue and a twist.'] },
    'read/listen': { e: ['I listen to a story with my eyes on the book.', 'I point to the pictures in a story.', 'I say one thing I saw in the story.', 'I join in with the story’s repeated words.', 'I “read” a picture book to my family.'],
        y: ['I listen to a whole story.', 'I tell one thing from a story.', 'I read one page aloud.', 'I retell a story to my family.', 'I read a little English book by myself.'],
        o: ['I read a page aloud.', 'I retell a text in my own words.', 'I read something extra in English at home.', 'I summarise a text and give my opinion.', 'I read a short book in English and recommend it.'],
        u: ['I read a text and find the main idea.', 'I summarise a text and say what I think of it.', 'I read an English book chapter by chapter.', 'I compare two texts on the same topic.', 'I read a short English book and write a review.'] },
    habit: { e: ['I bring my book and my pencil case.', 'I keep my things in my bag.', 'I show my homework to my teacher.', 'I say my English words at home.', 'I say my English words every day for a week.'],
        y: ['I bring my book.', 'I bring my book and homework.', 'I do my homework the same day.', 'I practise English for five minutes at home.', 'I practise English every day for a week.'],
        o: ['I come ready to every lesson.', 'I do my homework the day I get it.', 'I practise English ten minutes a day.', 'I plan my English practice for the week.', 'I keep a weekly English practice diary.'],
        u: ['I plan my homework time each week.', 'I practise English fifteen minutes a day.', 'I keep a weekly study planner.', 'I set a goal for the month and track it.', 'I review my notes every week without being told.'] },
    virtue: { e: ['I share with a friend once.', 'I help tidy up.', 'I help a friend who is sad.', 'I play nicely with someone new.', 'I help my whole table.'],
        y: ['I help a friend once.', 'I help a friend without being asked.', 'I help two friends this week.', 'I help someone new feel welcome.', 'I help my whole team finish.'],
        o: ['I help a classmate once.', 'I help without being asked.', 'I help our group share the work fairly.', 'I lead my group kindly.', 'I notice who needs help before they ask.'],
        u: ['I help our group share the work fairly.', 'I include someone who is left out.', 'I settle a small disagreement calmly.', 'I lead my group kindly to the end of a task.', 'I help a younger or newer student find their way.'] }
};
const LADDER_TITLES = { speak: 'A Braver Voice', words: 'A Bigger Word Hoard', write: 'A Stronger Quill', 'read/listen': 'A Brighter Lantern', habit: 'A Steadier Flame', virtue: 'A Warmer Heart' };
const LADDER_TIER = { early: 'e', junior: 'y', mid: 'o', upper: 'u' };
function ladderOaths(s) {
    const out = [];
    for (const [category, kept] of Object.entries(s.keptByCategory || {})) {
        const rungs = LADDER[category]; if (!rungs || !kept.length) continue;
        const list = rungs[LADDER_TIER[s.band]] || rungs.o;
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
    { id: 'word_keeper', icon: '🗝️', title: 'The Word Keeper', category: 'words', e: 'I am our Word Keeper: I say our new words with the class. 🗝️', y: 'I am our Word Keeper: I remind the class of our new words. 🗝️', o: 'I am our Word Keeper: I remind the class of the unit words and check we use them.', u: 'I am our Word Keeper: I run a two-minute word review at the start of each lesson.',
        fit: s => (s.quizRate != null && s.quizRate >= 0.85) || (s.overall != null && s.overall >= 85) ? 'Strong with words lately — a role to share it.' : '', score: 2.75 },
    { id: 'question_captain', icon: '❓', title: 'The Question Captain', category: 'speak', e: 'I am our Question Captain: I ask “What is it?” in English. ❓', y: 'I am our Question Captain: I ask one good question every lesson. ❓', o: 'I am our Question Captain: I ask a real question every lesson and listen to the answer.', u: 'I am our Question Captain: I ask a follow-up question that makes the class think.',
        fit: s => (s.shining ? 'One of the brightest this month — now they ask, not only answer.' : ''), score: 2.7 },
    { id: 'kindness_scout', icon: '💛', title: 'The Kindness Scout', category: 'virtue', reason: 'Respect', e: 'I am our Kindness Scout: I say “Thank you!” to kind friends. 💛', y: 'I am our Kindness Scout: I notice kind friends and say thank you. 💛', o: 'I am our Kindness Scout: I notice kind acts and thank people in English.', u: 'I am our Kindness Scout: I notice kind acts and tell the class about one each week.',
        fit: s => (s.counts?.Respect >= 3 ? s.counts.Respect + ' Respect stars this month — kindness is their strength.' : ''), score: 2.65 },
    { id: 'time_keeper', icon: '⏳', title: 'The Time Keeper', category: 'habit', e: 'I am our Time Keeper: I say “Tidy-up time!” when the song ends. ⏳', y: 'I am our Time Keeper: I help my team finish on time. ⏳', o: 'I am our Time Keeper: I help my group plan and finish on time.', u: 'I am our Time Keeper: I help my group split the task into steps and keep to the time.',
        fit: s => (s.counts?.Focus >= 3 ? s.counts.Focus + ' Focus stars this month — steady hands for the group.' : ''), score: 2.6 },
    { id: 'welcome_guide', icon: '👋', title: 'The Welcome Guide', category: 'virtue', reason: 'Teamwork', e: 'I am a Welcome Guide: I show a new friend where things are. 👋', y: 'I am a Welcome Guide: I help a friend who was away. 👋', o: 'I am a Welcome Guide: I help anyone who missed a lesson catch up.', u: 'I am a Welcome Guide: I help anyone who missed a lesson catch up with my notes.',
        fit: s => (s.counts?.Teamwork >= 3 ? s.counts.Teamwork + ' Teamwork stars this month — a natural guide.' : ''), score: 2.6 },
    { id: 'story_guardian', icon: '🪶', title: 'The Story Guardian', category: 'read/listen', e: 'I am our Story Guardian: I show the class our story’s pictures. 🪶', y: 'I am our Story Guardian: I tell the class what happened last time. 🪶', o: 'I am our Story Guardian: I remind the class what happened in our story last lesson.', u: 'I am our Story Guardian: I sum up last lesson’s story in three sentences.',
        fit: s => (s.reasons?.story_weaver ? 'Part of Story Weavers — they know our tale.' : ''), score: 2.55 },
    { id: 'scribe', icon: '📜', title: 'The Group Scribe', category: 'write', o: 'I am our Scribe: I write down my group’s best ideas in English.', u: 'I am our Scribe: I note my group’s ideas in English and report them to the class.',
        fit: s => (s.overall != null && s.overall >= 80 && !younger(s) ? 'Writes well — a role that serves the whole group.' : ''), score: 2.5 },
    { id: 'grammar_guard', icon: '🔍', title: 'The Grammar Guard', category: 'write', u: 'I am our Grammar Guard: I help my group check their writing for one kind of mistake.',
        fit: s => (s.band === 'upper' && s.dictationAvg != null && s.dictationAvg >= 85 ? 'Accurate writer — ready to help others check.' : ''), score: 2.45 },
    { id: 'song_leader', icon: '🎶', title: 'The Song Leader', category: 'speak', e: 'I am our Song Leader: I start our hello song. 🎶', y: 'I am our Song Leader: I lead our English song with the actions. 🎶',
        fit: s => (younger(s) ? 'Singing together is how little ones speak first.' : ''), score: 1.75 },
    { id: 'page_finder', icon: '📖', title: 'The Page Finder', category: 'habit', e: 'I am our Page Finder: I show friends the right page. 📖', y: 'I am our Page Finder: I help friends find the right page. 📖', o: 'I help my partner find the right page and exercise every time.', u: '',
        fit: s => (younger(s) ? 'A small, proud job for a young helper.' : ''), score: 1.7 },
    { id: 'tidy_captain', icon: '🧹', title: 'The Tidy Captain', category: 'habit', e: 'I am our Tidy Captain: I help everyone tidy up. 🧹', y: 'I am our Tidy Captain: I check our table is tidy at the end. 🧹',
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
    { k: 'label', category: 'words', e: 'I draw “{w1}” and say it to a friend. 🖍️', y: 'I draw and label {w1} and {w2}. 🖍️', o: 'I draw a word-picture for “{w1}” and “{w2}” and label it.', u: 'I make a picture-dictionary page for {w1}, {w2} and {w3}, with an example for each.' },
    { k: 'riddle', category: 'speak', e: 'I play “I spy” with “{w1}”. 🕵️', y: 'I give a clue for “{w1}” and let a friend guess. 🕵️', o: 'I make a riddle for “{w1}” and test my partner.', u: 'I write three riddles for unit words and test the class.' },
    { k: 'mime', category: 'speak', e: 'I act out “{w2}” for my friends. 🎭', y: 'I act out “{w2}” and let the class guess. 🎭', o: 'I mime “{w2}” and let the class guess it in English.', u: 'I act out “{w2}”, then explain it in English for anyone who did not guess.' },
    { k: 'partner', category: 'words', e: '', y: 'I find a word that goes with “{w3}”. 🔗', o: 'I find an opposite or a partner word for “{w3}”.', u: 'I find a synonym and an opposite for “{w3}” and use both in sentences.' },
    { k: 'everyday', category: 'words', e: 'I say “{w1}” at home every day. 🔁', y: 'I say “{w1}” in English every day this week. 🔁', o: 'I use “{w1}” naturally every day this week.', u: 'I use “{w1}” and “{w2}” in conversation every day this week.' },
    { k: 'spot', category: 'read/listen', e: 'I point to “{w2}” in a picture. 🔎', y: 'I find “{w2}” in a book or a song. 🔎', o: 'I spot “{w2}” in a book, a song or a video and tell the class where.', u: 'I find “{w2}” in a real English text and copy the sentence it is in.' },
    { k: 'story', category: 'write', e: 'I draw {w1} and {w3} in one picture. ✍️', y: 'I write a sentence with {w1} and {w3}. ✍️', o: 'I write a tiny story that uses {w1}, {w2} and {w3}.', u: 'I write a short story of five sentences or more using {w1}, {w2} and {w3}.' }
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
const AUDIENCES = { e: ['someone at home', 'my family', 'my teddy or my pet', 'my grandma or grandpa'], y: ['someone at home', 'my family', 'my teddy or my pet', 'a friend outside school'], o: ['someone at home', 'my family', 'a friend outside school', 'a younger child I know'] };
function homeOaths(s) {
    const aud = pickBy(AUDIENCES[s.early ? 'e' : s.junior ? 'y' : 'o'], s.seed + 'aud');
    const n = bandCount(s);
    const lines = [
        { k: 'read', category: 'read/listen', e: 'I show our storybook to {aud} and name the pictures. 🏡', y: 'I read our story to {aud}. 🏡', o: 'I read a page of English aloud to {aud}.', u: 'I read an English text to {aud} and explain what it means.' },
        { k: 'teach', category: 'words', e: 'I teach {aud} one English word. 🏡', y: 'I teach {aud} {n} English words. 🏡', o: 'I teach {aud} {n} English words from this unit.', u: 'I teach {aud} {n} English words from this unit and test them the next day.' },
        { k: 'greet', category: 'speak', e: 'I say “Good night!” in English at home. 🌙', y: 'I say “good morning” and “good night” in English at home. 🌙', o: 'I speak English at home for five minutes a day.', u: 'I speak only English at home for ten minutes a day.' },
        { k: 'note', category: 'write', e: 'I draw a picture for {aud} and copy one English word on it. 💌', y: 'I write a little English note for {aud}. 💌', o: 'I write a short English message for {aud}.', u: 'I write an English email or letter to {aud} about my week.' }
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
    if (s.birthdayMonth && s.birthdayMonth === month) add('birthday', 'speak', { e: 'For my birthday, I say my age and one thing I love in English. 🎂', y: 'For my birthday, I teach the class one thing I love, in English. 🎂', o: 'For my birthday month, I tell the class about something I love, in English.', u: 'For my birthday month, I give a one-minute talk about my year so far.' },
        'Their birthday is this month — a promise to remember it by.', 'The Birthday Oath', 3.45);
    if (month === 9 || month === 10) add('fresh', 'habit', { e: 'I learn our English hello song. ☀️', y: 'I say “good morning” in English every lesson. ☀️', o: 'I write my English goal for this year and check it every week.', u: 'I set three English goals for this year and check them every month.' }, 'A new school year: the best time to begin a habit.', 'The Fresh-Start Oath');
    if (month === 11 || month === 12) add('winter', month === 12 ? 'write' : 'words', month === 12
        ? { e: 'I make a holiday card and copy one English word on it. 🎄', y: 'I make an English holiday card for someone. 🎄', o: 'I write an English holiday card for someone special.', u: 'I write a holiday letter in English to someone special, with three wishes.' }
        : { e: 'I learn two winter words: snow and cold. ❄️', y: 'I learn three winter words in English. ❄️', o: 'I learn five winter words and use them in a sentence.', u: 'I learn eight winter words and write a short winter poem with them.' },
        month === 12 ? 'The holidays are coming — English as a gift.' : 'Winter is arriving: new words for a new season.', 'The Winter Oath');
    if (month === 1) add('return', 'speak', { e: 'I show the class a picture from my holidays. 🎁', y: 'I tell the class one thing I did in the holidays. 🎁', o: 'I tell the class about my holidays in five English sentences.', u: 'I tell the class about my holidays for one minute, in the past tense.' }, 'Back from the holidays: stories to share.', 'The New-Year Oath');
    if (month === 2 || month === 3) add('carnival', 'speak', { e: 'I say my costume in English: “I am a…”. 🎭', y: 'I say what my carnival costume is in English. 🎭', o: 'I describe my carnival costume in English and let the class guess.', u: 'I describe my carnival costume in detail and explain why I chose it.' }, 'Carnival season — a costume is a story.', 'The Carnival Oath');
    if (month === 4) add('easter', 'words', { e: 'I colour an Easter egg and say its colour in English. 🥚', y: 'I learn three Easter words in English. 🥚', o: 'I tell the class how my family spends Easter, in English.', u: 'I explain a Greek Easter tradition in English to someone who does not know it.' }, 'Easter is near: English about our own traditions.', 'The Spring Oath');
    if (month === 5 || month === 6) add('summer', s.band === 'upper' ? 'habit' : 'speak', s.band === 'upper' ? { u: 'I make a revision plan for the end-of-year test and follow it.' } : { e: 'I sing an English song with my family this summer. ☀️', y: 'I teach my family an English game for the summer. ☀️', o: 'I make a summer English plan: one book, one song, one film.' },
        s.band === 'upper' ? 'End-of-year tests are near.' : 'Summer is coming — keep English alive.', 'The Summer Oath', 2.35, s.band === 'upper' ? { rule: 'practice', target: { kind: 'practice' } } : {});
    return out;
}

// ─── Brave steps for the quiet, bigger steps for the strong ───────────────────
function sparkOaths(s) {
    const out = [];
    if (s.quiet) [
        { k: 'first10', category: 'speak', e: 'I say one English word to the class. ✋', y: 'I put up my hand in the first part of the lesson. ✋', o: 'I answer one question in the first ten minutes of the lesson.', u: 'I make one contribution in the first ten minutes of every lesson.' },
        { k: 'readline', category: 'read/listen', e: 'I join in loudly when we say the story together. 📖', y: 'I read one line aloud for the class. 📖', o: 'I volunteer to read one short part aloud.', u: 'I volunteer to read a paragraph and answer one question about it.' },
        { k: 'partner', category: 'speak', e: 'I tell my partner my word first. 🗣️', y: 'I say my idea to my partner in English. 🗣️', o: 'I share my idea with a partner first, then with the class.', u: 'I talk it over with a partner first, then report our idea to the class.' }
    ].forEach((l, i) => { const text = line(s, l); if (text) out.push({ key: 'spark.quiet.' + l.k, spirit: 'spark', category: l.category, text, title: 'The Brave Voice', why: 'Fewer stars than most this month — a small, safe step into the light.', score: 3.1 - i * 0.1 }); });
    if (s.excellence || (s.quizRate != null && s.quizRate >= 0.9)) [
        { k: 'ambitious', category: 'write', e: 'I say a longer sentence with “and”. 🚀', y: 'I write a longer sentence with “and” or “because”. 🚀', o: 'I use one ambitious word or structure in every piece of writing.', u: 'I use ambitious vocabulary and one long, linked sentence in every piece of writing.' },
        { k: 'reason', category: 'speak', e: 'I answer with a whole sentence. 💡', y: 'I answer with “because…”. 💡', o: 'I answer with a reason and an example, every time.', u: 'I back up my opinion with a reason, an example and the other side’s view.' },
        { k: 'coach', category: 'virtue', reason: 'Teamwork', e: 'I help a friend say our new words. 🤝', y: 'I help a friend practise our words. 🤝', o: 'I coach a classmate through a tricky exercise without giving the answer.', u: 'I coach a classmate through a hard exercise with hints, not answers.' }
    ].forEach((l, i) => { const text = line(s, l); if (text) out.push({ key: 'spark.peak.' + l.k, spirit: l.k === 'coach' ? 'gift' : 'spark', category: l.category, text, title: l.k === 'coach' ? 'The Torch-Bearer' : 'The Higher Peak',
        why: s.excellence ? 'Recent scores around ' + Math.round(s.overall) + '% — time for a real stretch.' : 'Quiz of the Week almost perfect — a stretch, not a repeat.', score: 2.95 - i * 0.1, ...(l.reason ? { target: { kind: 'virtue', reason: l.reason }, rule: 'virtue' } : {}) }); });
    if (s.counts && s.totalVirtue >= 6 && s.counts[s.weakest] <= 1 && s.counts[s.strongest] >= 4) {
        const bridge = {
            Teamwork: { e: 'I use my {strong} to play nicely with my team. 🤝', y: 'I use my {strong} to help my team. 🤝', o: 'I use my {strong} to make my group work better together.', u: 'I use my {strong} to help my group reach a shared goal.' },
            Respect: { e: 'I use my {strong} to be kind to my friends. 💛', y: 'I use my {strong} to be kind to everyone. 💛', o: 'I use my {strong} to make sure everyone is heard.', u: 'I use my {strong} to make sure every opinion in my group is heard.' },
            Focus: { e: 'I use my {strong} to finish my picture. 🎯', y: 'I use my {strong} to finish my work. 🎯', o: 'I use my {strong} to stay on task until the end.', u: 'I use my {strong} to stay with a hard task until it is done well.' },
            Creativity: { e: 'I use my {strong} to try a new colour or idea. 🎨', y: 'I use my {strong} to try a new idea. 🎨', o: 'I use my {strong} to bring one new idea to every task.', u: 'I use my {strong} to find an original answer to a problem.' } }[s.weakest];
        const text = fill(line(s, bridge), { strong: s.strongest.toLowerCase() });
        if (text) out.push({ key: 'spark.bridge.' + s.weakest.toLowerCase(), spirit: 'spark', category: 'virtue', text, title: 'The Two-Flame Oath',
            why: 'Rich in ' + s.strongest + ' (' + s.counts[s.strongest] + '), quiet in ' + s.weakest + ' (' + s.counts[s.weakest] + '): one strength lights the other.', score: 3.25, target: { kind: 'virtue', reason: s.weakest }, rule: 'virtue' });
    }
    return out;
}

// ─── Growing steps: promises written for one age band only ───────────────────
// What a child of this league can really do next: songs, pointing and copying for Pre-Junior; short
// sentences for Junior; descriptions, messages and reasons for A/B; talks, debates, emails and
// planning on their own for C/D. They never appear in another band.
const GROWTH = {
    early: [
        { category: 'speak', text: 'I sing our hello song in English with the actions. 🎶' },
        { category: 'speak', text: 'I count to ten in English on my fingers. 🔟' },
        { category: 'words', text: 'I point to three colours in our classroom and say them. 🌈' },
        { category: 'read/listen', text: 'I listen and do: “stand up”, “sit down”, “clap your hands”. 👂' },
        { category: 'habit', text: 'I say “Bye-bye, see you!” at the end of every lesson. 👋' },
        { category: 'words', text: 'I sing “Head, shoulders, knees and toes” and point. 🎵' },
        { category: 'write', text: 'I trace the first letter of my name in English. ✏️' },
        { category: 'virtue', reason: 'Respect', text: 'I say “please” when I ask for something. 🙏' },
        { category: 'speak', text: 'I say how I feel today: happy, sad or tired. 😊' },
        { category: 'read/listen', text: 'I find the animal in the picture when I hear its name. 🔍' },
        { category: 'words', text: 'I name three toys or things in my bag in English. 🎒' },
        { category: 'virtue', reason: 'Teamwork', text: 'I hold hands in the circle and sing with everyone. 🤝' }
    ],
    junior: [
        { category: 'speak', text: 'I answer “How are you?” with a whole sentence. 😊' },
        { category: 'speak', text: 'I ask a friend “What’s your favourite…?” and listen to the answer. ❓' },
        { category: 'words', text: 'I learn the days of the week and say what day it is. 📅' },
        { category: 'write', text: 'I write the date in English at the top of my page. 🗓️' },
        { category: 'read/listen', text: 'I read a short sentence from the board aloud. 📖' },
        { category: 'words', text: 'I play a spelling game with my partner: one letter each. 🔤' },
        { category: 'habit', text: 'I put my new word cards in my word box at home. 📦' },
        { category: 'write', text: 'I write one sentence about my weekend. ✍️' },
        { category: 'read/listen', text: 'I follow a two-step instruction in English. 👂' },
        { category: 'virtue', reason: 'Teamwork', text: 'I say “Can I help you?” to a friend in English. 🤝' },
        { category: 'speak', text: 'I say three things I can see in a picture. 🖼️' },
        { category: 'read/listen', text: 'I listen to an English song and clap when I hear a word I know. 👏' }
    ],
    mid: [
        { category: 'speak', text: 'I tell my partner about my weekend in four sentences, in the past.' },
        { category: 'speak', text: 'I ask my partner three questions and remember the answers.' },
        { category: 'write', text: 'I write a short message to a friend: hello, my news and goodbye.' },
        { category: 'write', text: 'I write a short description of my best friend or my pet.' },
        { category: 'read/listen', text: 'I read a short text and answer three questions about it.' },
        { category: 'words', text: 'I learn five words about a topic I choose and teach one.' },
        { category: 'habit', text: 'I look up new words in a dictionary instead of guessing.' },
        { category: 'read/listen', text: 'I listen to a short English story or podcast for children once a week.' },
        { category: 'speak', text: 'I use “I think… because…” when I give my answer.' },
        { category: 'virtue', reason: 'Respect', text: 'I say “I agree” or “I don’t agree” politely, in English.' },
        { category: 'write', text: 'I write five sentences about my day with first, then and after that.' },
        { category: 'words', text: 'I learn the opposites of five adjectives from our unit.' }
    ],
    upper: [
        { category: 'speak', text: 'I give a two-minute presentation with a beginning, a middle and an end.' },
        { category: 'speak', text: 'I take part in a class debate and answer someone else’s point.' },
        { category: 'write', text: 'I write an email to a pen friend: questions, my news and a proper ending.' },
        { category: 'write', text: 'I write an opinion paragraph: my view, two reasons and a conclusion.' },
        { category: 'write', text: 'I plan before I write: ideas first, then their order, then the text.' },
        { category: 'read/listen', text: 'I read an English article and summarise it in my own words.' },
        { category: 'read/listen', text: 'I watch an English video without Greek subtitles and note the main points.' },
        { category: 'words', text: 'I learn three phrasal verbs from our unit and use them in sentences.' },
        { category: 'habit', text: 'I keep an English learning diary: what I learned and what is still hard.' },
        { category: 'habit', text: 'I find and correct my own mistakes before I ask my teacher.' },
        { category: 'virtue', reason: 'Teamwork', text: 'I lead my group in a project and share out the roles fairly.' },
        { category: 'words', text: 'When a friend asks what a word means, I explain it in English, not Greek.' },
        { category: 'speak', text: 'I retell a news story or a film plot in English in under two minutes.' },
        { category: 'read/listen', text: 'I listen to an English podcast or interview and tell the class two things I learned.' }
    ]
};
const GROWTH_WHY = { early: 'Just right for Pre-Junior: said, sung and shown before it is written.', junior: 'Just right for Junior: short sentences, one step at a time.',
    mid: 'Just right for A and B: a little more English, with reasons.', upper: 'Just right for C and D: longer English, opinions and planning on their own.' };
function growthOaths(s) {
    return (GROWTH[s.band] || []).map((g, i) => ({ key: 'step.' + s.band + '.' + i, spirit: 'spark', category: g.category, text: g.text, why: GROWTH_WHY[s.band],
        score: 1.9 - ((hash(s.seed + 'step' + i) % 40) / 100), ...(g.reason ? { target: { kind: 'virtue', reason: g.reason }, rule: 'virtue' } : {}) }));
}

/**
 * Every personal promise the forge can offer this child (interests from notes included; interests tapped
 * live are added by the caller with passionOaths). Each carries: key, spirit, category, text, why, title, score.
 */
export function forgeOaths(s) {
    return [
        ...(s.interests || []).flatMap(id => passionOaths(s, id, { fromNotes: true })),
        ...needOaths(s), ...heroOaths(s), ...guildOaths(s), ...ladderOaths(s), ...roleOaths(s),
        ...craftOaths(s), ...homeOaths(s), ...seasonOaths(s), ...sparkOaths(s), ...growthOaths(s)
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
