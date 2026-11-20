// features/parent/i18n.js — the Family Portal speaks Greek first. Families can switch to
// English or to "both" (Greek with a small English line under headings and buttons).
// The choice itself lives in utils/familyLang.js so the sign-in gate and prompts share it.
import { getFamilyLang, setFamilyLang, familySpeaksGreek, familyLabel } from '../../utils/familyLang.js';

export function getLang() {
    return getFamilyLang();
}

/** Greek words on screen ('el' and 'bi'). */
export function isGreek() {
    return familySpeaksGreek();
}

/** "Both languages" mode: Greek with English underneath. */
export function isBilingual() {
    return getFamilyLang() === 'bi';
}

export function setLang(lang) {
    return setFamilyLang(lang);
}

/** The same words in the chosen language: tr('Homework', 'Εργασίες'). Safe in attributes. */
export function tr(en, el) {
    return isGreek() ? el : en;
}

/** Headings and buttons (HTML only): in "both" mode the English sits small underneath. */
export function bi(en, el) {
    return familyLabel(en, el);
}

/** "1 star" / "3 stars" in either language. Forms: [en one, en many, el one, el many]. */
export function countWord(n, [enOne, enMany, elOne, elMany], format = String) {
    const one = Number(n) === 1;
    return `${format(n)} ${isGreek() ? (one ? elOne : elMany) : (one ? enOne : enMany)}`;
}

export const STAR_WORDS = ['star', 'stars', 'αστέρι', 'αστέρια'];
export const DAY_WORDS = ['day', 'days', 'ημέρα', 'ημέρες'];
export const LESSON_WORDS = ['lesson', 'lessons', 'μάθημα', 'μαθήματα'];

// The class game's names, the way a Greek family would say them. The English name stays
// beside it in small type, since that is what the child says at home.
const GAME_NAMES = {
    'Dragon Flame': 'Φλόγα του Δράκου',
    'Grizzly Might': 'Δύναμη της Αρκούδας',
    'Owl Wisdom': 'Σοφία της Κουκουβάγιας',
    'Phoenix Rising': 'Φτερά του Φοίνικα',
    'Fear nothing. Burn bright.': 'Χωρίς φόβο. Λάμψε δυνατά.',
    'Stand together. Stand strong.': 'Μαζί, δυνατοί.',
    'Knowledge is power.': 'Η γνώση είναι δύναμη.',
    'Fall down seven, rise up eight.': 'Πέσε επτά φορές, σήκω οκτώ.',
    Guardian: 'Φύλακας',
    Sage: 'Σοφός',
    Paladin: 'Ιππότης',
    Artificer: 'Τεχνίτης',
    Scholar: 'Λόγιος',
    Nomad: 'Ταξιδευτής',
    Patron: 'Προστάτης',
    Vanguard: 'Πρωτοπόρος',
    // Hero path titles, one per hero level.
    Sentinel: 'Σκοπός', Warden: 'Φρουρός', Protector: 'Υπερασπιστής', Champion: 'Πρωταθλητής', 'Eternal Guardian': 'Αιώνιος Φύλακας',
    Apprentice: 'Μαθητευόμενος', Mystic: 'Μύστης', Archmage: 'Αρχιμάγος', 'Elder Sage': 'Γέροντας Σοφός',
    Squire: 'Ακόλουθος', Knight: 'Ευγενής Ιππότης', Crusader: 'Ιππότης του Φωτός', Marshal: 'Στρατάρχης', 'High Paladin': 'Ύπατος Ιππότης',
    Tinkerer: 'Μαστοράκος', Engineer: 'Μηχανικός', Inventor: 'Εφευρέτης', Mastermind: 'Ιθύνων Νους', 'Grand Artificer': 'Μέγας Τεχνίτης',
    Scribe: 'Γραφέας', 'Research Mentor': 'Μέντορας της Έρευνας', 'Grand Scholar': 'Μέγας Λόγιος',
    Recruit: 'Νεοσύλλεκτος', Scout: 'Ανιχνευτής', Ranger: 'Ιχνηλάτης', Captain: 'Λοχαγός', 'High Vanguard': 'Ύπατος Πρωτοπόρος',
    Wanderer: 'Περιπλανώμενος', Pathfinder: 'Οδηγός των Μονοπατιών', 'Legendary Nomad': 'Θρυλικός Ταξιδευτής',
    Giver: 'Δωρητής', Benefactor: 'Ευεργέτης', 'Grand Patron': 'Μέγας Προστάτης',
    // Familiars and their five forms.
    Emberfang: 'Φλογόδοντος', Hatchling: 'Δρακάκι', 'Flame Drake': 'Δράκος της Φλόγας', 'Inferno Dragon': 'Δράκος της Πυράς', 'Magma Wyrm': 'Δράκος του Μάγματος', 'Sunfire Elder': 'Γέροντας της Ηλιοφωτιάς',
    Frostpaw: 'Παγοπατούσα', 'Ice Cub': 'Αρκουδάκι του Πάγου', 'Snow Fox': 'Αλεπού του Χιονιού', 'Frost Guardian': 'Φύλακας της Παγωνιάς', 'Aurora Kitsune': 'Αλεπού του Σέλαος', 'Starfrost Sovereign': 'Άρχοντας της Αστροπαγωνιάς',
    Thornback: 'Αγκαθόραχος', 'Moss Toad': 'Βάτραχος των Βρύων', 'Bark Bear': 'Αρκούδα του Φλοιού', 'Ancient Treant': 'Αρχαίο Δεντρόπνευμα', 'Grove Warden': 'Φύλακας του Άλσους', 'World-Tree Elder': 'Γέροντας του Κοσμόδεντρου',
    Veilshade: 'Πεπλόσκιος', 'Shadow Wisp': 'Σκιερή Φλογίτσα', 'Phantom Cat': 'Γάτα-Φάντασμα', 'Void Stalker': 'Κυνηγός του Κενού', 'Eclipse Lynx': 'Λύγκας της Έκλειψης', 'Moonveil Sphinx': 'Σφίγγα του Φεγγαριού',
    Sparkling: 'Σπιθούλα', 'Sun Sprite': 'Ξωτικό του Ήλιου', 'Dawn Fairy': 'Νεράιδα της Αυγής', 'Solar Phoenix': 'Ηλιακός Φοίνικας', 'Radiant Phoenix': 'Λαμπερός Φοίνικας', 'Eternal Sunbird': 'Αιώνιο Πουλί του Ήλιου',
    Tidefin: 'Κυματόπτερος', 'Bubble Pup': 'Φουσκοκουτάβι', 'River Otter': 'Βίδρα του Ποταμού', 'Tide Otter': 'Βίδρα της Παλίρροιας', 'Coral Selkie': 'Σέλκι των Κοραλλιών', Tidecaller: 'Άρχοντας των Κυμάτων',
    Stormwing: 'Θυελλόφτερος', 'Puffball Owlet': 'Χνουδωτό Κουκουβαγάκι', 'Storm Owl': 'Κουκουβάγια της Θύελλας', 'Thunder Owl': 'Κουκουβάγια της Βροντής', 'Tempest Owl': 'Κουκουβάγια της Τρικυμίας', Thunderbird: 'Πουλί της Βροντής',
    Gemshell: 'Πετρόκελυφος', 'Pebble Tortle': 'Χελωνάκι-Βότσαλο', 'Crystal Tortoise': 'Κρυστάλλινη Χελώνα', 'Geode Guardian': 'Φύλακας των Κρυστάλλων', 'Mountain Tortoise': 'Χελώνα-Βουνό', 'Prism Colossus': 'Κολοσσός του Πρίσματος',
    Starfoal: 'Αστροπουλάρι', 'Star Foal': 'Αστροπουλάρι', 'Comet Pony': 'Πόνι του Κομήτη', 'Nebula Steed': 'Άτι του Νεφελώματος', 'Astral Unicorn': 'Αστρικός Μονόκερος', 'Galaxy Alicorn': 'Φτερωτός Μονόκερος του Γαλαξία',
    Cloverhop: 'Τριφυλλοπηδούλης', 'Clover Kit': 'Τριφυλλάκι', 'Meadow Hare': 'Λαγός του Λιβαδιού', 'Lucky Jackalope': 'Τυχερός Κερατόλαγος', 'Fortune Jackalope': 'Κερατόλαγος της Τύχης', 'Golden Luckbringer': 'Χρυσός Τυχοφέρνης'
};

/** A guild, hero class or motto in Greek, or the English name when there is none. */
export function gameName(en) {
    const text = String(en || '');
    return isGreek() ? (GAME_NAMES[text] || text) : text;
}

/** Greek name with the class name the child uses in small English type beside it (HTML). */
export function gameNameHtml(en, escape) {
    const text = String(en || '');
    const el = GAME_NAMES[text];
    if (!isGreek() || !el) return escape(text);
    return `${escape(el)} <span class="fp-en-name" lang="en">${escape(text)}</span>`;
}
