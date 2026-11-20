// ui/authFamilyWords.js — the Quest Gate speaks Greek to families.
//
// While the Parent door is chosen (and the family has not picked English), every word
// on the gate is shown in Greek: labels, buttons, hints, school line, error cards. The
// rest of the sign-in code keeps writing English; a small observer swaps each known
// sentence for its Greek one and puts the English back when another door is chosen.
// Teachers and the school office never see a change.
import { familySpeaksGreek } from '../utils/familyLang.js';

const EXACT = {
    // Doors and welcome column
    'Teacher': 'Εκπαιδευτικός',
    'Parent': 'Γονέας',
    'Secretary': 'Γραμματεία',
    'Who is signing in?': 'Ποιος συνδέεται;',
    'Welcome, families': 'Καλώς ήρθατε, γονείς',
    'Follow your child’s quest from home: homework, stars, progress and notes from school.': 'Δείτε από το σπίτι πώς τα πάει το παιδί σας: εργασίες, αστέρια, πρόοδο και νέα από το σχολείο.',
    'See homework and upcoming tests': 'Εργασίες και επόμενα διαγωνίσματα',
    'Celebrate the stars your child earns': 'Τα αστέρια που κερδίζει το παιδί σας',
    'Send a note to the school office': 'Μηνύματα με το σχολείο',
    'Lost your details? Your child’s teacher or the school office can set a new password in seconds.': 'Χάσατε τα στοιχεία σας; Το σχολείο μπορεί να σας δώσει νέο κωδικό σε λίγα δευτερόλεπτα.',
    'Hello, family!': 'Γεια σας!',
    'Welcome to your child’s quest. Sign in below to follow it from home.': 'Καλώς ήρθατε στην περιπέτεια του παιδιού σας. Συνδεθείτε παρακάτω για να τη βλέπετε από το σπίτι.',
    'Welcome to': 'Καλώς ήρθατε στο',
    'Your username is already filled in. Just type your password.': 'Το όνομα χρήστη σας είναι ήδη συμπληρωμένο. Γράψτε μόνο τον κωδικό σας.',
    'Your slip has your details. Signing you in…': 'Το χαρτάκι σας έχει τα στοιχεία σας. Σας συνδέουμε…',
    'Not a parent? Teacher or office sign-in': 'Δεν είστε γονέας; Είσοδος εκπαιδευτικών ή γραμματείας',
    'Greek letters? Switch the keyboard to English (Latin) letters.': 'Βλέπουμε ελληνικά γράμματα. Αλλάξτε το πληκτρολόγιο σε αγγλικά (λατινικά) γράμματα.',

    // Form
    'Family sign in': 'Είσοδος γονέων',
    'Use the username and password the school gave you.': 'Γράψτε το όνομα χρήστη και τον κωδικό που σας έδωσε το σχολείο.',
    'Username': 'Όνομα χρήστη',
    'Password': 'Κωδικός',
    'Forgot password?': 'Ξεχάσατε τον κωδικό;',
    'Sign in': 'Είσοδος',
    'Opening the gate…': 'Ανοίγει η πύλη…',
    'e.g. maria.p': 'π.χ. maria.p',
    'Show password': 'Εμφάνιση κωδικού',
    'Hide password': 'Απόκρυψη κωδικού',
    'Caps Lock is on': 'Είναι πατημένα τα κεφαλαία (Caps Lock)',
    'Usernames use English letters, numbers, dots or dashes.': 'Το όνομα χρήστη γράφεται με λατινικά γράμματα, αριθμούς, τελείες ή παύλες.',
    'Usernames have no spaces or capitals, so we’ll use': 'Το όνομα χρήστη δεν έχει κενά ή κεφαλαία, οπότε θα χρησιμοποιήσουμε το',
    'Got it': 'Εντάξει',
    'No problem.': 'Κανένα πρόβλημα.',
    'Family passwords are set by the school. Ask your child’s teacher or the school office, and they can give you a new one in seconds.': 'Τους κωδικούς των γονέων τους δίνει το σχολείο. Ζητήστε νέο από τη γραμματεία ή από τον/την καθηγητή/τρια του παιδιού σας: γίνεται σε λίγα δευτερόλεπτα.',

    // School line
    'Not your school? Change it': 'Δεν είναι το σχολείο σας; Αλλαγή',
    'Enter a different school code': 'Βάλτε άλλον κωδικό σχολείου',
    'School code': 'Κωδικός σχολείου',
    'e.g. alpha-patras': 'π.χ. alpha-patras',
    'Use this school': 'Αυτό το σχολείο',
    'Cancel': 'Ακύρωση',
    'Try again': 'Δοκιμάστε ξανά',
    'Retrying…': 'Νέα προσπάθεια…',

    // School availability panel
    'School activation': 'Ενεργοποίηση σχολείου',
    'Checking school activation…': 'Ελέγχουμε το σχολείο…',
    'One moment while we confirm this school is ready.': 'Μια στιγμή, ελέγχουμε ότι το σχολείο είναι έτοιμο.',
    'Awaiting school activation': 'Το σχολείο δεν έχει ενεργοποιηθεί ακόμη',
    'Login and signup open after the school Secretary/admin activates this school.': 'Η είσοδος θα ανοίξει μόλις η γραμματεία ενεργοποιήσει το σχολείο.',
    'We don’t know that school code': 'Δεν βρήκαμε αυτόν τον κωδικό σχολείου',
    'Check the code your school gave you, or choose another school below.': 'Ελέγξτε τον κωδικό που σας έδωσε το σχολείο ή διαλέξτε άλλο σχολείο παρακάτω.',
    "Couldn't confirm school activation": 'Δεν μπορέσαμε να ελέγξουμε το σχολείο',
    'We could not reach the activation check. Try again in a moment.': 'Δεν υπάρχει απάντηση αυτή τη στιγμή. Δοκιμάστε ξανά σε λίγο.',

    // Error cards
    'That username and password don’t match': 'Το όνομα χρήστη και ο κωδικός δεν ταιριάζουν',
    'Copy them exactly as the school gave them. If it still fails, ask your child’s teacher or the school office for a new password.': 'Γράψτε τα ακριβώς όπως σας τα έδωσε το σχολείο. Αν πάλι δεν γίνεται, ζητήστε νέο κωδικό από τη γραμματεία.',
    'We couldn’t find that username': 'Δεν βρήκαμε αυτό το όνομα χρήστη',
    'That username doesn’t look right': 'Το όνομα χρήστη δεν φαίνεται σωστό',
    'Usernames use letters, numbers, dots or dashes, with no spaces.': 'Γράφεται με λατινικά γράμματα, αριθμούς, τελείες ή παύλες, χωρίς κενά.',
    'Please enter your username': 'Γράψτε το όνομα χρήστη σας',
    'Please enter your password': 'Γράψτε τον κωδικό σας',
    'This login is switched off': 'Αυτή η σύνδεση είναι κλειστή',
    'The school has paused this family login. Contact your child’s teacher or the school office to turn it back on.': 'Το σχολείο έχει σταματήσει προσωρινά αυτή τη σύνδεση. Επικοινωνήστε με τη γραμματεία για να ανοίξει ξανά.',
    'This family login is no longer active': 'Αυτή η σύνδεση γονέα δεν είναι πια ενεργή',
    'Contact the school office if you need help.': 'Επικοινωνήστε με τη γραμματεία αν χρειάζεστε βοήθεια.',
    'Too many tries in a row': 'Πολλές προσπάθειες στη σειρά',
    'For safety, sign-in is paused for a few minutes. Wait a moment, then try again.': 'Για ασφάλεια, η είσοδος σταματά για λίγα λεπτά. Περιμένετε λίγο και δοκιμάστε ξανά.',
    'No internet connection': 'Δεν υπάρχει σύνδεση στο ίντερνετ',
    'Check the Wi-Fi or mobile data, then try again.': 'Ελέγξτε το Wi-Fi ή τα δεδομένα κινητής και δοκιμάστε ξανά.',
    'Something went wrong on our side': 'Κάτι πήγε στραβά από τη δική μας πλευρά',
    'Please try again in a moment.': 'Δοκιμάστε ξανά σε λίγο.',
    'This browser is blocking sign-in': 'Αυτός ο browser εμποδίζει την είσοδο',
    'Turn off private browsing, or open the app in Chrome or Safari.': 'Κλείστε την ιδιωτική περιήγηση ή ανοίξτε την εφαρμογή σε Chrome ή Safari.',
    'Sign-in isn’t open yet': 'Η είσοδος δεν έχει ανοίξει ακόμη',
    'It opens once the school office activates this school.': 'Θα ανοίξει μόλις η γραμματεία ενεργοποιήσει το σχολείο.',
    'We couldn’t sign you in': 'Δεν μπορέσαμε να σας συνδέσουμε',
    'Please check your details and try again.': 'Ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά.',
    'That school code doesn’t look right': 'Ο κωδικός σχολείου δεν φαίνεται σωστός',
    'It uses lowercase letters, numbers and dashes, like alpha-patras.': 'Έχει μικρά λατινικά γράμματα, αριθμούς και παύλες, π.χ. alpha-patras.'
};

const PATTERNS = [
    [/^Not from (.+)\? Enter your school code$/, (m) => `Δεν είστε από το ${m[1]}; Βάλτε τον κωδικό του σχολείου σας`],
    [/^You are signing in to (.+)$/, (m) => `Συνδέεστε στο ${m[1]}`]
];

const ATTRS = ['placeholder', 'aria-label', 'title'];
const original = new WeakMap(); // node -> { text?, attrs: { name: english } }
let observer = null;
let applying = false;

function translate(text) {
    const key = String(text || '').trim();
    if (!key) return null;
    if (EXACT[key]) return EXACT[key];
    for (const [re, build] of PATTERNS) {
        const m = key.match(re);
        if (m) return build(m);
    }
    return null;
}

function shouldSpeakGreek() {
    const screen = document.getElementById('auth-screen');
    return screen?.dataset.authRole === 'parent' && familySpeaksGreek();
}

function rememberText(node, english) {
    const entry = original.get(node) || { attrs: {} };
    entry.text = english;
    original.set(node, entry);
}

function rememberAttr(el, name, english) {
    const entry = original.get(el) || { attrs: {} };
    entry.attrs[name] = english;
    original.set(el, entry);
}

const touched = new Set();

function greekify(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const value = node.nodeValue;
        const greek = translate(value);
        if (!greek) continue;
        rememberText(node, value);
        touched.add(node);
        const lead = value.match(/^\s*/)[0];
        const tail = value.match(/\s*$/)[0];
        node.nodeValue = `${lead}${greek}${tail}`;
    }
    const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('*')] : [];
    elements.forEach((el) => {
        ATTRS.forEach((name) => {
            const value = el.getAttribute?.(name);
            const greek = value && translate(value);
            if (!greek) return;
            rememberAttr(el, name, value);
            touched.add(el);
            el.setAttribute(name, greek);
        });
    });
}

function restoreEnglish() {
    touched.forEach((node) => {
        const entry = original.get(node);
        if (!entry) return;
        if (entry.text !== undefined && node.nodeType === 3 && node.isConnected) {
            const greek = translate(entry.text);
            if (greek && node.nodeValue.trim() === greek) node.nodeValue = entry.text;
        }
        Object.entries(entry.attrs || {}).forEach(([name, english]) => {
            const greek = translate(english);
            if (node.getAttribute?.(name) === greek) node.setAttribute(name, english);
        });
    });
    touched.clear();
}

/** Re-reads the whole gate: Greek for families, English for everyone else. */
export function syncAuthFamilyLanguage() {
    const screen = document.getElementById('auth-screen');
    if (!screen || applying) return;
    applying = true;
    try {
        const greek = shouldSpeakGreek();
        screen.lang = greek ? 'el' : 'en';
        if (greek) greekify(screen);
        else restoreEnglish();
    } finally {
        applying = false;
    }
}

/** Watches the gate so anything the sign-in code writes later is shown in Greek too. */
export function watchAuthFamilyLanguage() {
    const screen = document.getElementById('auth-screen');
    if (!screen || observer || typeof MutationObserver === 'undefined') return;
    let queued = false;
    observer = new MutationObserver(() => {
        if (applying || queued) return;
        queued = true;
        // One pass per frame, after the sign-in code finished its own changes.
        queueMicrotask(() => {
            queued = false;
            syncAuthFamilyLanguage();
        });
    });
    observer.observe(screen, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-auth-role', ...ATTRS]
    });
    syncAuthFamilyLanguage();
}

/** Greek or English for strings this module's callers build themselves. */
export function familyAuthWord(english) {
    return shouldSpeakGreek() ? (translate(english) || english) : english;
}
