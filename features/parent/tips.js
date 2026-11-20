// features/parent/tips.js — "Lumi's corner": calm, practical ideas for helping a child
// learn English at home, from Lumi, the class's guiding star. Lumi picks one tip for this
// week from what is actually going on (a test soon, new homework, a missed lesson), and
// the rest are grouped by theme. Families can tick the ideas they tried (this device only).
import { escapeHtml, getSnapshot, firstName, newestHomework, splitHomework, daysFromToday, toDate } from './helpers.js';
import { tr, bi, isGreek } from './i18n.js';

const TRIED_KEY = 'gcq_family_tips_tried_v1';

// Lumi, drawn small with flat fills so several copies can sit on one page.
export const LUMI_SVG = `<svg class="fp-lumi" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <path d="M45.4 8.7Q50 0 54.6 8.7L60.7 20.3Q65.3 29 75 30.6L87.9 32.9Q97.6 34.5 90.7 41.6L81.6 51Q74.7 58 76.1 67.8L78 80.7Q79.4 90.5 70.6 86.1L58.8 80.3Q50 76 41.2 80.3L29.4 86.1Q20.6 90.5 22 80.7L23.9 67.8Q25.3 58 18.4 51L9.3 41.6Q2.4 34.5 12.1 32.9L25 30.6Q34.7 29 39.3 20.3Z" fill="#ffd84d" stroke="#f2a516" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="38" cy="31" rx="11" ry="6.5" fill="#fffbe6" opacity="0.75" transform="rotate(-32 38 31)"/>
    <ellipse cx="36" cy="63" rx="5.5" ry="3.4" fill="#ff8fa3" opacity="0.65"/>
    <ellipse cx="64" cy="63" rx="5.5" ry="3.4" fill="#ff8fa3" opacity="0.65"/>
    <g class="fp-lumi__eyes"><ellipse cx="42" cy="54" rx="4.6" ry="6" fill="#2b2250"/><ellipse cx="58" cy="54" rx="4.6" ry="6" fill="#2b2250"/><circle cx="43.6" cy="51.6" r="1.8" fill="#fff"/><circle cx="59.6" cy="51.6" r="1.8" fill="#fff"/></g>
    <path d="M45 62.5Q50 67 55 62.5" stroke="#8a3a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>`;

const THEMES = [
    { key: 'routine', icon: 'fa-clock', tone: 'amber', en: 'Homework routine', el: 'Ρουτίνα για τις εργασίες' },
    { key: 'words', icon: 'fa-spell-check', tone: 'sky', en: 'Words and spelling', el: 'Λέξεις και ορθογραφία' },
    { key: 'reading', icon: 'fa-book-open-reader', tone: 'sage', en: 'Reading together', el: 'Διάβασμα μαζί' },
    { key: 'everyday', icon: 'fa-music', tone: 'violet', en: 'English every day', el: 'Αγγλικά κάθε μέρα' },
    { key: 'tests', icon: 'fa-clipboard-check', tone: 'rose', en: 'Before a test', el: 'Πριν από ένα διαγώνισμα' },
    { key: 'heart', icon: 'fa-heart', tone: 'terracotta', en: 'Confidence and motivation', el: 'Αυτοπεποίθηση και κίνητρο' }
];

// Each tip: why it works, and one small thing to try this week.
const TIPS = [
    {
        id: 'same-time', theme: 'routine',
        en: ['Same time, same place', 'A short, fixed homework time (say 20 minutes after a snack) works better than one long evening battle. The brain likes to know what comes next.', 'Choose a time with your child and write it on the fridge.'],
        el: ['Ίδια ώρα, ίδιο σημείο', 'Ένας σύντομος, σταθερός χρόνος για τις εργασίες (π.χ. 20 λεπτά μετά το κολατσιό) αποδίδει περισσότερο από μια μεγάλη «μάχη» το βράδυ. Το μυαλό ηρεμεί όταν ξέρει τι ακολουθεί.', 'Διαλέξτε μαζί με το παιδί μια ώρα και γράψτε την στο ψυγείο.']
    },
    {
        id: 'try-first', theme: 'routine',
        en: ['Let them try first', 'You do not need to know English to help. Sit nearby, let your child try alone, and step in only when asked. Struggling a little is how learning sticks.', 'Ask "Show me how you did this one" instead of correcting.'],
        el: ['Πρώτα δοκιμάζει μόνο του', 'Δεν χρειάζεται να ξέρετε Αγγλικά για να βοηθήσετε. Καθίστε κοντά, αφήστε το παιδί να προσπαθήσει μόνο του και βοηθήστε μόνο όταν σας το ζητήσει. Η μικρή δυσκολία είναι αυτό που κάνει τη γνώση να μένει.', 'Ρωτήστε «Δείξε μου πώς το έλυσες» αντί να διορθώσετε.']
    },
    {
        id: 'small-chunks', theme: 'routine',
        en: ['Little and often', 'Ten minutes on four days beats forty minutes on one. Short sessions keep attention fresh and help memory.', 'Split this week’s homework into small pieces across the days.'],
        el: ['Λίγο και συχνά', 'Δέκα λεπτά για τέσσερις μέρες αποδίδουν περισσότερο από σαράντα λεπτά σε μία. Τα σύντομα διαστήματα κρατούν την προσοχή ζωντανή και βοηθούν τη μνήμη.', 'Μοιράστε τις εργασίες της εβδομάδας σε μικρά κομμάτια.']
    },
    {
        id: 'look-cover', theme: 'words',
        en: ['Look, say, cover, write, check', 'The classic spelling method: look at the word, say it, cover it, write it from memory, then check. It turns guessing into remembering.', 'Try it with five words before the next spelling test.'],
        el: ['Κοίτα, πες, κρύψε, γράψε, έλεγξε', 'Η κλασική μέθοδος για την ορθογραφία: κοιτάζει τη λέξη, τη λέει δυνατά, την κρύβει, τη γράφει από μνήμης και ελέγχει. Έτσι η μαντεψιά γίνεται ανάμνηση.', 'Δοκιμάστε το με πέντε λέξεις πριν από την επόμενη ορθογραφία.']
    },
    {
        id: 'word-hunt', theme: 'words',
        en: ['Words around the house', 'Sticky notes with English words on real objects (door, window, fridge) turn the home into a picture dictionary.', 'Label five things at home with this week’s words.'],
        el: ['Λέξεις σε όλο το σπίτι', 'Χαρτάκια με αγγλικές λέξεις πάνω σε πραγματικά αντικείμενα (door, window, fridge) κάνουν το σπίτι εικονογραφημένο λεξικό.', 'Κολλήστε πέντε χαρτάκια με λέξεις της εβδομάδας.']
    },
    {
        id: 'teach-me', theme: 'words',
        en: ['Let your child be the teacher', 'Explaining a word to someone else is one of the strongest ways to learn it. It also makes your child feel proud.', 'Ask "Teach me three new words from today".'],
        el: ['Το παιδί γίνεται δάσκαλος', 'Όταν το παιδί εξηγεί μια λέξη σε κάποιον άλλον, τη μαθαίνει πολύ πιο βαθιά. Και νιώθει περήφανο.', 'Ζητήστε: «Μάθε μου τρεις καινούργιες λέξεις από σήμερα».']
    },
    {
        id: 'read-aloud', theme: 'reading',
        en: ['Ten minutes aloud', 'Reading aloud for ten minutes a day builds fluency and confidence. Listen kindly; a smile helps more than a correction.', 'Ask your child to read you a page from the class book.'],
        el: ['Δέκα λεπτά δυνατά', 'Δέκα λεπτά δυνατό διάβασμα την ημέρα χτίζουν ευχέρεια και αυτοπεποίθηση. Ακούστε με καλοσύνη: ένα χαμόγελο βοηθά περισσότερο από μια διόρθωση.', 'Ζητήστε από το παιδί να σας διαβάσει μια σελίδα από το βιβλίο της τάξης.']
    },
    {
        id: 'not-every-word', theme: 'reading',
        en: ['Not every word matters', 'Children do not need to understand every word to enjoy a story. Guessing from pictures and context is a real reading skill.', 'Ask "What do you think happens next?"'],
        el: ['Δεν χρειάζεται κάθε λέξη', 'Το παιδί δεν χρειάζεται να καταλαβαίνει κάθε λέξη για να χαρεί μια ιστορία. Το να μαντεύει από τις εικόνες και τα συμφραζόμενα είναι πραγματική δεξιότητα ανάγνωσης.', 'Ρωτήστε: «Τι λες να γίνει μετά;»']
    },
    {
        id: 'cartoons', theme: 'everyday',
        en: ['Cartoons in English', 'A favourite cartoon or film in English, with English subtitles, is free listening practice that feels like a treat.', 'Switch one show this week to English sound.'],
        el: ['Κινούμενα σχέδια στα Αγγλικά', 'Ένα αγαπημένο κινούμενο σχέδιο ή ταινία στα Αγγλικά, με αγγλικούς υπότιτλους, είναι δωρεάν εξάσκηση στην ακρόαση που μοιάζει με ανταμοιβή.', 'Βάλτε αυτή την εβδομάδα μία εκπομπή με αγγλικό ήχο.']
    },
    {
        id: 'songs', theme: 'everyday',
        en: ['Sing it', 'Songs carry words and pronunciation straight into memory. Repeating a chorus is practice nobody minds.', 'Find the lyrics of a song your child likes and sing the chorus together.'],
        el: ['Με τραγούδι', 'Τα τραγούδια φέρνουν λέξεις και προφορά κατευθείαν στη μνήμη. Το ρεφρέν που επαναλαμβάνεται είναι εξάσκηση που δεν κουράζει.', 'Βρείτε τους στίχους ενός τραγουδιού που αγαπά το παιδί και τραγουδήστε μαζί το ρεφρέν.']
    },
    {
        id: 'mistakes-ok', theme: 'everyday',
        en: ['Mistakes are welcome', 'At home, the goal is to speak, not to be perfect. If you laugh at your own English mistakes, your child will dare to try too.', 'Learn one English phrase from your child and use it at dinner.'],
        el: ['Τα λάθη είναι ευπρόσδεκτα', 'Στο σπίτι ο στόχος είναι να μιλάμε, όχι να είμαστε τέλειοι. Αν γελάτε με τα δικά σας λάθη στα Αγγλικά, θα τολμήσει κι εκείνο.', 'Μάθετε από το παιδί μια αγγλική φράση και πείτε την στο τραπέζι.']
    },
    {
        id: 'spread-revision', theme: 'tests',
        en: ['Revise over a few days', 'Three short reviews before a test beat one long one the night before. Spacing practice out is what moves words into long-term memory.', 'Plan three 10-minute reviews in the days before the test.'],
        el: ['Επανάληψη σε λίγες μέρες', 'Τρεις σύντομες επαναλήψεις πριν από ένα διαγώνισμα αποδίδουν περισσότερο από μία μεγάλη το προηγούμενο βράδυ. Έτσι οι λέξεις περνούν στη μακροπρόθεσμη μνήμη.', 'Οργανώστε τρεις επαναλήψεις των 10 λεπτών τις μέρες πριν από το διαγώνισμα.']
    },
    {
        id: 'quiz-game', theme: 'tests',
        en: ['Make it a quiz show', 'Let your child quiz you, then swap. Testing yourself is one of the best ways to study, and a game takes the fear away.', 'Write five questions each on paper and swap.'],
        el: ['Ένα παιχνίδι ερωτήσεων', 'Αφήστε το παιδί να σας εξετάσει και μετά αλλάξτε ρόλους. Η αυτοεξέταση είναι από τους καλύτερους τρόπους μελέτης και το παιχνίδι διώχνει το άγχος.', 'Γράψτε από πέντε ερωτήσεις σε χαρτί και ανταλλάξτε.']
    },
    {
        id: 'sleep', theme: 'tests',
        en: ['Sleep is study too', 'A good night’s sleep fixes what was learned during the day. The night before a test, an early night helps more than late revision.', 'Keep the evening before the test calm and short.'],
        el: ['Και ο ύπνος είναι μελέτη', 'Ο καλός ύπνος «σώζει» ό,τι μάθαμε μέσα στη μέρα. Το βράδυ πριν από ένα διαγώνισμα, ο νωρίς ύπνος βοηθά περισσότερο από την επανάληψη μέχρι αργά.', 'Κρατήστε ήρεμο και σύντομο το βράδυ πριν από το διαγώνισμα.']
    },
    {
        id: 'praise-effort', theme: 'heart',
        en: ['Praise the effort', '"You worked hard on that" grows a child who keeps trying. "You are so clever" can make a child afraid to fail. Stars in class reward effort for the same reason.', 'Notice one thing your child tried hard at this week and say it out loud.'],
        el: ['Επαινέστε την προσπάθεια', 'Το «Δούλεψες πολύ γι’ αυτό» μεγαλώνει ένα παιδί που συνεχίζει να προσπαθεί. Το «Τι έξυπνο παιδί!» μπορεί να το κάνει να φοβάται το λάθος. Γι’ αυτό και τα αστέρια της τάξης επιβραβεύουν την προσπάθεια.', 'Βρείτε κάτι που προσπάθησε πολύ αυτή την εβδομάδα και πείτε το δυνατά.']
    },
    {
        id: 'ask-learned', theme: 'heart',
        en: ['Ask what, not how many', '"What did you learn today?" opens a conversation. "What grade did you get?" often closes one. Curiosity at home keeps curiosity alive in class.', 'Use one of Lumi’s questions below after the next lesson.'],
        el: ['Ρωτήστε «τι», όχι «πόσο»', 'Το «Τι έμαθες σήμερα;» ανοίγει κουβέντα. Το «Τι βαθμό πήρες;» συχνά την κλείνει. Η περιέργεια στο σπίτι κρατά ζωντανή την περιέργεια στην τάξη.', 'Χρησιμοποιήστε μία από τις ερωτήσεις της Lumi παρακάτω μετά το επόμενο μάθημα.']
    },
    {
        id: 'no-compare', theme: 'heart',
        en: ['Compare with yesterday only', 'Every child learns at their own pace. Comparing with siblings or classmates hurts; comparing with last month shows real growth.', 'Look at the Progress tab together and find one thing that grew.'],
        el: ['Σύγκριση μόνο με το χθες', 'Κάθε παιδί μαθαίνει με τον δικό του ρυθμό. Η σύγκριση με αδέρφια ή συμμαθητές πληγώνει· η σύγκριση με τον προηγούμενο μήνα δείχνει την πραγματική πρόοδο.', 'Δείτε μαζί την Πρόοδο και βρείτε κάτι που μεγάλωσε.']
    },
    {
        id: 'missed-lesson', theme: 'routine',
        en: ['After a missed lesson', 'Missing a lesson happens. A quick look at the Homework tab and a short message to the school is all it takes to catch up calmly.', 'Open Homework and do the newest task together.'],
        el: ['Μετά από ένα χαμένο μάθημα', 'Το να χάσει κανείς ένα μάθημα συμβαίνει. Μια ματιά στις Εργασίες και ένα σύντομο μήνυμα στο σχολείο αρκούν για να καλύψει ήρεμα το κενό.', 'Ανοίξτε τις Εργασίες και κάντε μαζί την πιο πρόσφατη.']
    }
];

// Questions for the car ride or the dinner table: open, warm, no grades.
const QUESTIONS = [
    ['What new English word made you smile today?', 'Ποια καινούργια αγγλική λέξη σε έκανε να χαμογελάσεις σήμερα;'],
    ['Can you teach me how to say something in English?', 'Μου μαθαίνεις πώς λέγεται κάτι στα Αγγλικά;'],
    ['What was the most fun moment of the lesson?', 'Ποια ήταν η πιο διασκεδαστική στιγμή του μαθήματος;'],
    ['Which star are you proudest of this month?', 'Για ποιο αστέρι του μήνα νιώθεις πιο περήφανα;'],
    ['What was hard today, and what helped you?', 'Τι ήταν δύσκολο σήμερα και τι σε βοήθησε;'],
    ['How did your guild do this week?', 'Πώς τα πήγε η ομάδα σου αυτή την εβδομάδα;'],
    ['If you could ask one question in class, what would it be?', 'Αν μπορούσες να κάνεις μία ερώτηση στο μάθημα, ποια θα ήταν;'],
    ['What English song or game would you like to try at home?', 'Ποιο αγγλικό τραγούδι ή παιχνίδι θα ήθελες να δοκιμάσουμε στο σπίτι;']
];

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

function words(tip) {
    const [title, why, tryIt] = isGreek() ? tip.el : tip.en;
    return { title, why, tryIt, enTitle: tip.en[0], elTitle: tip.el[0] };
}

function weekNumber(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.floor((date - start) / (7 * 86400000));
}

/** Lumi's pick for this week, and why she chose it, from what is happening for this child. */
export function tipOfTheWeek(snapshot = getSnapshot()) {
    const name = firstName(snapshot.studentName);
    const homework = newestHomework();
    const parts = homework ? splitHomework(homework) : null;
    const testIn = parts?.test ? daysFromToday(parts.test.date) : null;
    const pick = (id, reasonEn, reasonEl) => ({ tip: TIPS.find((t) => t.id === id), reason: tr(reasonEn, reasonEl) });

    if (testIn !== null && testIn >= 0 && testIn <= 7) {
        return testIn <= 1
            ? pick('sleep', 'Because the test is very soon.', 'Γιατί το διαγώνισμα είναι πολύ κοντά.')
            : pick('spread-revision', `Because there is a test in ${testIn} days.`, `Γιατί υπάρχει διαγώνισμα σε ${testIn} ημέρες.`);
    }
    const lastAbsence = (snapshot.attendanceSummary?.absenceDates || [])
        .map((d) => daysFromToday(d)).filter((d) => d !== null && d <= 0).sort((a, b) => b - a)[0];
    if (lastAbsence !== undefined && lastAbsence >= -10) {
        return pick('missed-lesson', 'Because a lesson was missed recently.', 'Γιατί χάθηκε πρόσφατα ένα μάθημα.');
    }
    if (homework && daysFromToday(toDate(parts?.setOn)) >= -3) {
        return pick('try-first', 'Because there is new homework.', 'Γιατί υπάρχει νέα εργασία.');
    }
    if (Number(snapshot.weekStars || 0) > 0) {
        return pick('praise-effort', `Because ${name || 'your child'} earned stars this week.`, 'Γιατί κέρδισε αστέρια αυτή την εβδομάδα.');
    }
    const tip = TIPS[weekNumber() % TIPS.length];
    return { tip, reason: tr('A new idea every week.', 'Μια καινούργια ιδέα κάθε εβδομάδα.') };
}

function tipCard(tip, tried, { open = false } = {}) {
    const w = words(tip);
    const theme = THEMES.find((t) => t.key === tip.theme) || THEMES[0];
    const done = tried.has(tip.id);
    return `
        <details class="fp-tip-card fp-tip-card--${theme.tone}${done ? ' is-tried' : ''}" data-tip-theme="${theme.key}" ${open ? 'open' : ''}>
            <summary>
                <span class="fp-tip-card__icon" aria-hidden="true"><i class="fas ${theme.icon}"></i></span>
                <span class="fp-tip-card__title">${bi(escapeHtml(tip.en[0]), escapeHtml(tip.el[0]))}</span>
                <span class="fp-tip-card__tick${done ? '' : ' hidden'}" aria-label="${escapeHtml(tr('Tried', 'Δοκιμάστηκε'))}"><i class="fas fa-check" aria-hidden="true"></i></span>
                <i class="fas fa-chevron-down fp-tip-card__chev" aria-hidden="true"></i>
            </summary>
            <div class="fp-tip-card__body">
                <p>${escapeHtml(w.why)}</p>
                <p class="fp-tip-card__try"><i class="fas fa-seedling" aria-hidden="true"></i> <span><strong>${escapeHtml(tr('Try this week:', 'Δοκιμάστε αυτή την εβδομάδα:'))}</strong> ${escapeHtml(w.tryIt)}</span></p>
                <button type="button" class="fp-tip-card__done" data-parent-tip-tried="${tip.id}" aria-pressed="${done}">
                    <i class="fas ${done ? 'fa-circle-check' : 'fa-circle'}" aria-hidden="true"></i>
                    ${done ? tr('We tried it!', 'Δοκιμάστηκε!') : tr('We tried it', 'Το δοκιμάσαμε')}
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
                <p class="fp-lumi-tip__title">${bi(escapeHtml(w.enTitle), escapeHtml(w.elTitle))}</p>
                <p class="fp-lumi-tip__try">${escapeHtml(w.tryIt)}</p>
                <p class="fp-lumi-tip__why">${escapeHtml(reason)}</p>
                <button type="button" class="fp-link" data-parent-tab-link="tips">${escapeHtml(tr('More ideas from Lumi', 'Περισσότερες ιδέες από τη Lumi'))} <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
            </div>
        </aside>`;
}

export function renderParentTips() {
    const snapshot = getSnapshot();
    const tried = readTried();
    const { tip: weekly, reason } = tipOfTheWeek(snapshot);
    const question = QUESTIONS[(new Date().getDate()) % QUESTIONS.length];
    const triedCount = TIPS.filter((t) => tried.has(t.id)).length;
    const name = firstName(snapshot.studentName);
    return `
        <header class="fp-pagehead fp-rise">
            <span class="fp-pagehead__icon fp-pagehead__icon--lumi" aria-hidden="true">${LUMI_SVG}</span>
            <div>
                <h2 class="fp-pagehead__title">${bi('Lumi’s corner', 'Η γωνιά της Lumi')}</h2>
                <p class="fp-pagehead__sub">${escapeHtml(tr('Small ideas for helping with English at home.', 'Μικρές ιδέες για να βοηθάτε στα Αγγλικά από το σπίτι.'))}</p>
            </div>
        </header>
        <div class="fp-tips">
            <article class="fp-lumi-hello fp-rise" style="--fp-delay:0">
                <span class="fp-lumi-hello__lumi">${LUMI_SVG}</span>
                <div class="fp-lumi-hello__bubble">
                    <p>${isGreek()
                        ? 'Γεια σας! Είμαι η <strong>Lumi</strong>, το αστέρι που συνοδεύει την τάξη. Εδώ θα βρίσκετε σύντομες, πρακτικές ιδέες. Δεν χρειάζεται να ξέρετε Αγγλικά: το ενδιαφέρον σας είναι η μεγαλύτερη βοήθεια.'
                        : `Hello! I’m <strong>Lumi</strong>, the star who guides ${escapeHtml(name || 'your child')}’s class. Here you’ll find short, practical ideas. You don’t need to speak English: your interest is the biggest help of all.`}</p>
                </div>
            </article>

            ${weekly ? `
            <section class="fp-tip-week fp-rise" style="--fp-delay:1" aria-labelledby="fp-tip-week-title">
                <p class="fp-kicker"><i class="fas fa-star" aria-hidden="true"></i> ${escapeHtml(tr('This week, Lumi suggests', 'Αυτή την εβδομάδα η Lumi προτείνει'))}</p>
                <p class="fp-tip-week__why" id="fp-tip-week-title">${escapeHtml(reason)}</p>
                ${tipCard(weekly, tried, { open: true })}
            </section>` : ''}

            <section class="fp-card fp-ask-card fp-rise" style="--fp-delay:2">
                <p class="fp-kicker"><i class="fas fa-comments" aria-hidden="true"></i> ${escapeHtml(tr('A question for after class', 'Μια ερώτηση για μετά το μάθημα'))}</p>
                <p class="fp-ask-card__q" data-parent-question>${bi(escapeHtml(question[0]), escapeHtml(question[1]))}</p>
                <button type="button" class="fp-btn fp-btn--soft fp-btn--sm" data-parent-next-question><i class="fas fa-shuffle" aria-hidden="true"></i> ${escapeHtml(tr('Another question', 'Άλλη ερώτηση'))}</button>
            </section>

            <div class="fp-tip-progress fp-rise" style="--fp-delay:3" role="status">
                <span class="fp-tip-progress__bar" style="--fp-tried:${Math.round((triedCount / TIPS.length) * 100)}%"><span></span></span>
                <span>${escapeHtml(tr(`You have tried ${triedCount} of ${TIPS.length} ideas`, `Δοκιμάσατε ${triedCount} από ${TIPS.length} ιδέες`))}</span>
            </div>

            ${THEMES.map((theme, index) => {
                const list = TIPS.filter((t) => t.theme === theme.key && t.id !== weekly?.id);
                if (!list.length) return '';
                return `
                <section class="fp-tip-theme fp-rise" style="--fp-delay:${Math.min(4 + index, 9)}">
                    <h3 class="fp-tip-theme__title fp-tip-theme__title--${theme.tone}"><i class="fas ${theme.icon}" aria-hidden="true"></i> ${bi(theme.en, theme.el)}</h3>
                    ${list.map((t) => tipCard(t, tried)).join('')}
                </section>`;
            }).join('')}

            <p class="fp-tips__foot fp-rise" style="--fp-delay:9">${isGreek()
                ? 'Έχετε απορία για την πρόοδο του παιδιού σας; <button type="button" class="fp-inline-link" data-parent-compose="question">Γράψτε στο σχολείο</button>.'
                : 'Questions about your child’s progress? <button type="button" class="fp-inline-link" data-parent-compose="question">Write to the school</button>.'}</p>
        </div>`;
}

/** Next conversation starter, without redrawing the page. */
export function showNextQuestion(button) {
    const box = button.closest('.fp-ask-card')?.querySelector('[data-parent-question]');
    if (!box) return;
    const current = Number(box.dataset.index ?? new Date().getDate() % QUESTIONS.length);
    const next = (current + 1) % QUESTIONS.length;
    box.dataset.index = String(next);
    box.classList.remove('is-new');
    void box.offsetWidth;
    box.innerHTML = bi(escapeHtml(QUESTIONS[next][0]), escapeHtml(QUESTIONS[next][1]));
    box.classList.add('is-new');
}
