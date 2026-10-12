// features/namedayCalendar.mjs
// The Greek name-day calendar (εορτολόγιο): which day a child's name is celebrated, with the
// moving feasts tied to Orthodox Easter worked out for every year. Pure data and helpers, no DOM,
// no Firestore, no AI. Covered by tests/nameday-calendar.test.mjs.
//
// Names are matched by sound, so "Γιώργος", "Giorgos", "Yiorgos" and "George" all find 23 April,
// and "Βασω", "Vaso" and "Vasiliki" all find 1 January.
//
// A student keeps their name day as '0000-MM-DD'. For a moving feast the student also keeps
// `namedayRule` (for example 'george' or 'easter+7'), and applyMovableNamedays() turns it into this
// year's date when the roster loads, so every celebration in the app lands on the right day.

import { foldText } from './oathForge.mjs';
import { greeklishWord, phoneticGreek } from './noteTextCore.mjs';

// ---------------------------------------------------------------- Orthodox Easter

/** Orthodox Easter Sunday as [month (1-12), day] in the Gregorian calendar (Meeus, Julian computus). */
export function orthodoxEaster(year) {
    const y = Number(year);
    const a = y % 4;
    const b = y % 7;
    const c = y % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    // Julian to Gregorian: +13 days from 1900 to 2099.
    const date = new Date(Date.UTC(y, month - 1, day + 13));
    return [date.getUTCMonth() + 1, date.getUTCDate()];
}

const pad = (n) => String(n).padStart(2, '0');

/** 'MM-DD' of the day `offset` days after Orthodox Easter in `year`. */
export function easterOffsetKey(year, offset = 0) {
    const [m, d] = orthodoxEaster(year);
    const date = new Date(Date.UTC(Number(year), m - 1, d + Number(offset || 0)));
    return `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

const keyToNum = (mmdd) => Number(String(mmdd).replace('-', ''));

/**
 * The day a rule falls on in `year`, as 'MM-DD'.
 *   'MM-DD'      a fixed day
 *   'easter+N'   N days after Orthodox Easter (negative before it)
 *   'george'     23 April, or Easter Monday when 23 April falls on or before Easter
 *   'mark'       25 April, or Easter Tuesday when 25 April falls on or before Easter
 */
export function ruleDate(rule, year) {
    const r = String(rule || '');
    if (/^\d{2}-\d{2}$/.test(r)) return r;
    const easter = easterOffsetKey(year, 0);
    if (r === 'george') return keyToNum('04-23') <= keyToNum(easter) ? easterOffsetKey(year, 1) : '04-23';
    if (r === 'mark') return keyToNum('04-25') <= keyToNum(easter) ? easterOffsetKey(year, 2) : '04-25';
    const m = r.match(/^easter([+-]\d+)?$/);
    if (m) return easterOffsetKey(year, Number(m[1] || 0));
    return '';
}

/** True when a rule is not a fixed date. */
export const isMovableRule = (rule) => !!rule && !/^\d{2}-\d{2}$/.test(String(rule));

// ---------------------------------------------------------------- The calendar
// [rule, feast (English, for the projector), names]. The first name of each group is the formal
// form; the rest are everyday forms and diminutives. Female forms sit with their male forms.
// Names the Church calendar does not hold (ancient Greek names) celebrate on All Saints' Day.

export const NAMEDAY_ENTRIES = [
    ['01-01', 'Saint Basil', ['Βασίλειος', 'Βασίλης', 'Βασίλος', 'Βασιλική', 'Βάσω', 'Βασούλα', 'Βίκη', 'Βασιλεία']],
    ['01-02', 'Saint Seraphim', ['Σεραφείμ']],
    ['01-06', 'Epiphany', ['Φώτιος', 'Φώτης', 'Φωτεινή', 'Φωτούλα', 'Θεοφάνης', 'Φάνης', 'Θεοφανία', 'Ιορδάνης', 'Ιορδάνα']],
    ['01-07', 'Saint John the Baptist', ['Ιωάννης', 'Γιάννης', 'Γιαννάκης', 'Ιωάννα', 'Γιάννα', 'Γιαννούλα', 'Ιωαννέτα']],
    ['01-11', 'Saint Theodosius', ['Θεοδόσιος', 'Θεοδόσης']],
    ['01-12', 'Saint Tatiana', ['Τατιάνα']],
    ['01-17', 'Saint Anthony', ['Αντώνιος', 'Αντώνης', 'Αντωνία', 'Τόνια']],
    ['01-18', 'Saints Athanasius and Cyril', ['Αθανάσιος', 'Θανάσης', 'Θάνος', 'Νάσος', 'Αθανασία', 'Νάσια', 'Σούλα', 'Κύριλλος']],
    ['01-20', 'Saint Euthymius', ['Ευθύμιος', 'Ευθύμης', 'Θύμιος']],
    ['01-21', 'Saints Maximus and Eugene', ['Μάξιμος', 'Ευγένιος']],
    ['01-22', 'Saints Timothy and Anastasius', ['Αναστάσιος', 'Τάσος', 'Τιμόθεος']],
    ['01-24', 'Saint Xenia', ['Ξένια']],
    ['01-25', 'Saint Gregory the Theologian', ['Γρηγόριος', 'Γρηγόρης', 'Γρηγορία']],
    ['02-01', 'Saint Tryphon', ['Τρύφων', 'Τρύφωνας']],
    ['02-03', 'Saint Simeon', ['Συμεών', 'Σίμος']],
    ['02-05', 'Saint Agatha', ['Αγάθη']],
    ['02-08', 'Saint Theodore', ['Θεόδωρος', 'Θοδωρής', 'Θόδωρος', 'Ντόρος']],
    ['02-09', 'Saint Nicephorus', ['Νικηφόρος']],
    ['02-10', 'Saint Charalambos', ['Χαράλαμπος', 'Χάρης', 'Μπάμπης', 'Λάμπης', 'Χαραλαμπία', 'Χαρά']],
    ['02-11', 'Saints Blaise and Theodora', ['Βλάσιος', 'Βλάσης', 'Θεοδώρα', 'Δώρα']],
    ['02-23', 'Saint Polycarp', ['Πολύκαρπος']],
    ['02-26', 'Saint Photini', ['Φωτεινή']],
    ['03-01', 'Saint Eudokia', ['Ευδοκία']],
    ['03-17', 'Saint Alexius', ['Αλέξιος', 'Αλέξης']],
    ['03-19', 'Saints Chrysanthus and Daria', ['Χρύσανθος', 'Χρυσάνθη', 'Δαρεία']],
    ['03-25', 'The Annunciation', ['Ευάγγελος', 'Βαγγέλης', 'Ευαγγελία', 'Βαγγελιώ', 'Ευαγγελή', 'Λίτσα']],
    ['04-16', 'Saint Leonidas', ['Λεωνίδας']],
    ['05-05', 'Saint Irene', ['Ειρήνη', 'Ρένα']],
    ['05-14', 'Saint Isidore', ['Ισίδωρος']],
    ['05-15', 'Saint Achilleus', ['Αχίλλειος', 'Αχιλλέας']],
    ['05-21', 'Saints Constantine and Helen', ['Κωνσταντίνος', 'Κώστας', 'Κωστάκης', 'Ντίνος', 'Κωνσταντίνα', 'Ντίνα', 'Κωνσταντία', 'Ελένη', 'Λένα', 'Έλενα', 'Λενιώ']],
    ['06-04', 'Saints Martha and Mary', ['Μάρθα']],
    ['06-11', 'Saints Bartholomew and Barnabas', ['Βαρθολομαίος', 'Βαρνάβας']],
    ['06-29', 'Saints Peter and Paul', ['Πέτρος', 'Πέτρα', 'Παύλος', 'Παυλίνα']],
    ['07-01', 'Saints Cosmas and Damian', ['Κοσμάς', 'Δαμιανός']],
    ['07-07', 'Saint Kyriaki', ['Κυριακή', 'Κική', 'Κυριάκος']],
    ['07-11', 'Saint Euphemia', ['Ευφημία', 'Έφη', 'Φίφη']],
    ['07-17', 'Saint Marina', ['Μαρίνα', 'Μαργαρίτα']],
    ['07-20', 'The Prophet Elijah', ['Ηλίας', 'Λίας', 'Ηλιάνα']],
    ['07-22', 'Saint Mary Magdalene', ['Μαγδαληνή', 'Μάγδα']],
    ['07-24', 'Saint Christina', ['Χριστίνα']],
    ['07-25', 'Saints Anna and Olympias', ['Άννα', 'Αννούλα', 'Ολυμπία', 'Ολυμπιάς']],
    ['07-26', 'Saint Paraskevi', ['Παρασκευή', 'Βούλα', 'Παρασκευάς', 'Βιβή']],
    ['07-27', 'Saint Panteleimon', ['Παντελεήμων', 'Παντελής']],
    ['08-06', 'The Transfiguration', ['Σωτήριος', 'Σωτήρης', 'Σωτηρία']],
    ['08-15', 'The Dormition of Mary', ['Μαρία', 'Μαίρη', 'Μαρούλα', 'Μαριάννα', 'Μαριέττα', 'Μαρίκα', 'Παναγιώτης', 'Πάνος', 'Τάκης', 'Παναγής', 'Παναγιώτα', 'Γιώτα', 'Δέσποινα', 'Δέσπω']],
    ['08-17', 'Saint Myron', ['Μύρων', 'Μύρωνας']],
    ['08-26', 'Saints Adrian and Natalia', ['Αδριανός', 'Ναταλία', 'Αδριανή']],
    ['08-27', 'Saint Phanourios', ['Φανούριος', 'Φανούρης']],
    ['08-30', 'Saint Alexander', ['Αλέξανδρος', 'Αλέκος', 'Αλεξάνδρα', 'Αλεξία']],
    ['08-31', 'Saint Aristides', ['Αριστείδης']],
    ['09-04', 'Saint Hermione', ['Ερμιόνη']],
    ['09-05', 'The Prophet Zechariah', ['Ζαχαρίας', 'Ζαχαρούλα']],
    ['09-14', 'The Holy Cross', ['Σταύρος', 'Σταυρούλα', 'Σταυριανή', 'Σταυρίνα']],
    ['09-15', 'Saint Nicetas', ['Νικήτας']],
    ['09-17', 'Saints Sophia, Faith, Hope and Love', ['Σοφία', 'Σοφούλα', 'Ελπίδα', 'Ελπίς', 'Αγάπη', 'Πίστη']],
    ['09-20', 'Saint Eustathius', ['Ευστάθιος', 'Στάθης', 'Ευσταθία']],
    ['09-23', 'Saint Polyxeni', ['Πολυξένη', 'Ξένη']],
    ['10-03', 'Saint Dionysius', ['Διονύσιος', 'Διονύσης', 'Διονυσία']],
    ['10-08', 'Saint Pelagia', ['Πελαγία']],
    ['10-18', 'Saint Luke', ['Λουκάς']],
    ['10-19', 'Saint Cleopatra', ['Κλεοπάτρα']],
    ['10-20', 'Saint Gerasimus', ['Γεράσιμος', 'Αρτέμιος', 'Αρτέμης']],
    ['10-23', 'Saint James', ['Ιάκωβος', 'Ιακώβα']],
    ['10-26', 'Saint Demetrius', ['Δημήτριος', 'Δημήτρης', 'Δήμος', 'Μήτσος', 'Μίμης', 'Τάκης', 'Δήμητρα', 'Δημητρούλα', 'Μιμίκα']],
    ['11-08', 'The Archangels', ['Μιχαήλ', 'Μιχάλης', 'Μιχαέλα', 'Γαβριήλ', 'Γαβριέλα', 'Άγγελος', 'Αγγελική', 'Αγγελίνα', 'Αγγέλα', 'Ταξιάρχης', 'Στρατής']],
    ['11-09', 'Saint Nectarius', ['Νεκτάριος', 'Νεκταρία']],
    ['11-10', 'Saint Orestes', ['Ορέστης']],
    ['11-11', 'Saints Menas and Victor', ['Μηνάς', 'Βίκτωρ', 'Βίκτωρας']],
    ['11-13', 'Saint John Chrysostom', ['Χρυσόστομος']],
    ['11-14', 'Saint Philip', ['Φίλιππος', 'Φίλιππα']],
    ['11-16', 'Saint Matthew', ['Ματθαίος']],
    ['11-25', 'Saint Catherine', ['Αικατερίνη', 'Κατερίνα', 'Κατίνα', 'Κατερινιώ']],
    ['11-26', 'Saint Stylianos', ['Στυλιανός', 'Στέλιος', 'Στυλιανή', 'Στέλλα']],
    ['11-30', 'Saint Andrew', ['Ανδρέας', 'Αντρέας', 'Ανδριάνα']],
    ['12-04', 'Saint Barbara', ['Βαρβάρα']],
    ['12-05', 'Saint Savvas', ['Σάββας']],
    ['12-06', 'Saint Nicholas', ['Νικόλαος', 'Νίκος', 'Νικολής', 'Νικολέτα', 'Νικολίνα', 'Νικολέττα']],
    ['12-12', 'Saint Spyridon', ['Σπυρίδων', 'Σπύρος', 'Σπυριδούλα', 'Σπυριδωνία']],
    ['12-15', 'Saint Eleftherios', ['Ελευθέριος', 'Λευτέρης', 'Ελευθερία', 'Λευτερία']],
    ['12-17', 'The Prophet Daniel', ['Δανιήλ', 'Δανιέλα']],
    ['12-18', 'Saint Sebastian', ['Σεβαστιανός', 'Σεβαστή']],
    ['12-20', 'Saint Ignatius', ['Ιγνάτιος']],
    ['12-21', 'Saint Themistocles', ['Θεμιστοκλής']],
    ['12-22', 'Saint Anastasia', ['Αναστασία', 'Τασούλα', 'Τασία']],
    ['12-24', 'Saint Eugenia', ['Ευγενία', 'Τζένη']],
    ['12-25', 'Christmas', ['Χρήστος', 'Χριστόδουλος', 'Χριστίνος', 'Εμμανουήλ', 'Μανώλης', 'Μάνος', 'Εμμανουέλα', 'Μανουέλα']],
    ['12-26', 'Saint Joseph', ['Ιωσήφ', 'Ζωζεφίνα']],
    ['12-27', 'Saint Stephen', ['Στέφανος', 'Στεφανία', 'Στεφανή', 'Στέφη']],
    // Moving feasts
    ['easter-8', 'Lazarus Saturday', ['Λάζαρος']],
    ['easter-7', 'Palm Sunday', ['Βάιος', 'Βάγια', 'Βάια']],
    ['easter', 'Easter Sunday', ['Πασχάλης', 'Πασχαλία', 'Λάμπρος', 'Λαμπρινή']],
    ['easter+2', 'Saint Raphael', ['Ραφαήλ', 'Ραφαέλα']],
    ['easter+5', 'The Life-giving Spring', ['Ζωή', 'Ζωίτσα', 'Πηγή']],
    ['easter+7', 'Thomas Sunday', ['Θωμάς', 'Θωμαΐς']],
    ['easter+50', 'Holy Spirit Day', ['Τριαντάφυλλος', 'Τριανταφυλλιά', 'Πνευματικός']],
    ['easter+56', "All Saints' Day", ['Αριστοτέλης', 'Σωκράτης', 'Πλάτων', 'Περικλής', 'Οδυσσέας', 'Ηρακλής', 'Αχιλλεύς', 'Θησέας', 'Πηνελόπη', 'Αριάδνη', 'Αθηνά', 'Αφροδίτη', 'Άρτεμις', 'Δανάη', 'Ιφιγένεια', 'Ηλέκτρα', 'Νεφέλη', 'Δάφνη', 'Μελίνα', 'Μυρτώ', 'Φαίδρα', 'Άρης', 'Ίασωνας', 'Ιάσων', 'Ευριπίδης', 'Όμηρος']],
    ['george', 'Saint George', ['Γεώργιος', 'Γιώργος', 'Γιωργάκης', 'Γιώργης', 'Γεωργία', 'Γωγώ', 'Γεωργούλα']],
    ['mark', 'Saint Mark', ['Μάρκος']]
];

// English and Latin spellings the sound match cannot reach on its own.
const ENGLISH_NAMES = {
    'Βασίλειος': ['Basil', 'Bill'], 'Βασιλική': ['Vicky', 'Vasiliki'], 'Ιωάννης': ['John', 'Johnny', 'Yannis', 'Ioannis'],
    'Ιωάννα': ['Joanna', 'Jo', 'Joanne'], 'Αντώνιος': ['Anthony', 'Tony'], 'Αθανάσιος': ['Thanos'],
    'Γρηγόριος': ['Gregory', 'Greg'], 'Θεόδωρος': ['Theodore', 'Ted'], 'Θεοδώρα': ['Dora'], 'Αλέξιος': ['Alexis'],
    'Αλέξανδρος': ['Alexander', 'Alexandros', 'Alex', 'Alekos'], 'Αλεξάνδρα': ['Alexandra', 'Alexia'],
    'Ευάγγελος': ['Evangelos', 'Vangelis'], 'Ευαγγελία': ['Evangelia'], 'Ειρήνη': ['Irene', 'Eirini', 'Irini'],
    'Κωνσταντίνος': ['Constantine', 'Costa', 'Kostas', 'Dinos'], 'Κωνσταντίνα': ['Constantina', 'Dina'],
    'Ελένη': ['Helen', 'Helena', 'Eleni', 'Elena', 'Lena'], 'Πέτρος': ['Peter'], 'Παύλος': ['Paul'], 'Παυλίνα': ['Pauline'],
    'Μαρίνα': ['Marina'], 'Μαργαρίτα': ['Margaret', 'Margarita'], 'Ηλίας': ['Elias', 'Elijah', 'Ilias'], 'Ηλιάνα': ['Iliana', 'Eliana'],
    'Μαγδαληνή': ['Magdalene', 'Magda'], 'Χριστίνα': ['Christina'], 'Άννα': ['Anna', 'Anne', 'Ann'],
    'Παρασκευή': ['Paraskevi', 'Evi', 'Vivi', 'Voula'], 'Σωτήριος': ['Sotiris'], 'Μαρία': ['Mary', 'Maria', 'Marie', 'Mairi'],
    'Μαριάννα': ['Marianna', 'Marianne'], 'Παναγιώτης': ['Panagiotis', 'Panos', 'Takis'], 'Παναγιώτα': ['Panagiota', 'Giota', 'Yiota'],
    'Δέσποινα': ['Despina'], 'Ναταλία': ['Natalia', 'Natalie'], 'Σταύρος': ['Stavros'], 'Σοφία': ['Sophia', 'Sophie', 'Sofia'],
    'Ελπίδα': ['Elpida', 'Hope'], 'Αγάπη': ['Agapi'], 'Διονύσιος': ['Dennis', 'Dionysios', 'Dionysis'], 'Λουκάς': ['Luke', 'Lucas'],
    'Ιάκωβος': ['James', 'Jacob', 'Iakovos'], 'Δημήτριος': ['Demetrius', 'Dimitris', 'Jimmy', 'Mimis'], 'Δήμητρα': ['Demetra', 'Dimitra'],
    'Μιχαήλ': ['Michael', 'Mike', 'Michalis'], 'Μιχαέλα': ['Michaela', 'Michelle'], 'Γαβριήλ': ['Gabriel'], 'Γαβριέλα': ['Gabriella', 'Gabriela'],
    'Άγγελος': ['Angelos', 'Angel'], 'Αγγελική': ['Angeliki', 'Angela', 'Angelica'], 'Αγγελίνα': ['Angelina'], 'Φίλιππος': ['Philip', 'Phil'],
    'Ματθαίος': ['Matthew', 'Matthaios'], 'Αικατερίνη': ['Catherine', 'Katherine', 'Kate', 'Katerina', 'Ekaterini'],
    'Στυλιανός': ['Stelios'], 'Στυλιανή': ['Stella'], 'Ανδρέας': ['Andrew', 'Andreas', 'Andy'], 'Βαρβάρα': ['Barbara'],
    'Σάββας': ['Savvas', 'Sabbas'], 'Νικόλαος': ['Nicholas', 'Nick', 'Nikos', 'Nikolas'], 'Νικολέτα': ['Nicoletta', 'Nicole'],
    'Σπυρίδων': ['Spyros', 'Spiros'], 'Ελευθέριος': ['Lefteris'], 'Ελευθερία': ['Eleftheria'], 'Δανιήλ': ['Daniel', 'Dan'],
    'Δανιέλα': ['Daniela', 'Danielle'], 'Σεβαστιανός': ['Sebastian'], 'Αναστασία': ['Anastasia', 'Natasha'], 'Αναστάσιος': ['Tasos'],
    'Ευγενία': ['Eugenia', 'Jenny'], 'Χρήστος': ['Chris', 'Christos'], 'Εμμανουήλ': ['Emmanuel', 'Manolis', 'Manos'],
    'Εμμανουέλα': ['Emmanuela', 'Manuela'], 'Ιωσήφ': ['Joseph', 'Joe'], 'Στέφανος': ['Stephen', 'Steven', 'Stefanos'],
    'Στεφανία': ['Stephanie', 'Stefania'], 'Λάζαρος': ['Lazarus', 'Lazaros'], 'Ραφαήλ': ['Raphael', 'Rafael'],
    'Ραφαέλα': ['Raphaela', 'Rafaela'], 'Ζωή': ['Zoe', 'Zoi'], 'Θωμάς': ['Thomas', 'Tom'], 'Γεώργιος': ['George', 'Georgios', 'Giorgos', 'Yiorgos'],
    'Γεωργία': ['Georgia'], 'Μάρκος': ['Mark', 'Marcus', 'Markos'], 'Ξένια': ['Xenia'], 'Πολυξένη': ['Polyxeni'],
    'Μάξιμος': ['Maximus', 'Max'], 'Ευγένιος': ['Eugene'], 'Τιμόθεος': ['Timothy', 'Tim'], 'Αχιλλέας': ['Achilles'],
    'Οδυσσέας': ['Odysseas', 'Odysseus'], 'Ηρακλής': ['Hercules', 'Iraklis'], 'Πηνελόπη': ['Penelope'], 'Αριάδνη': ['Ariadne'],
    'Αθηνά': ['Athena', 'Athina'], 'Αφροδίτη': ['Aphrodite'], 'Άρτεμις': ['Artemis'], 'Δάφνη': ['Daphne'], 'Ηλέκτρα': ['Electra'],
    'Ιάσων': ['Jason'], 'Θησέας': ['Theseus'], 'Πλάτων': ['Plato', 'Platon'], 'Σωκράτης': ['Socrates'], 'Αριστοτέλης': ['Aristotle'],
    'Φωτεινή': ['Fotini', 'Photini'], 'Θεοφάνης': ['Theofanis', 'Fanis'], 'Χαράλαμπος': ['Charalambos', 'Haris', 'Babis'],
    'Χαρά': ['Chara', 'Hara'], 'Κυριακή': ['Kyriaki', 'Kiki'], 'Ευφημία': ['Effie', 'Efi'], 'Βαρθολομαίος': ['Bartholomew'],
    'Βαρνάβας': ['Barnabas'], 'Ζαχαρίας': ['Zachary', 'Zacharias'], 'Ισίδωρος': ['Isidore'], 'Λεωνίδας': ['Leonidas'],
    'Ορέστης': ['Orestes'], 'Βίκτωρ': ['Victor'], 'Κλεοπάτρα': ['Cleopatra'], 'Ολυμπία': ['Olympia'],
    'Ερμιόνη': ['Hermione'], 'Αδριανός': ['Adrian'], 'Μάρθα': ['Martha'], 'Ταξιάρχης': ['Taxiarchis'], 'Νεκτάριος': ['Nektarios']
};

// ---------------------------------------------------------------- Matching by sound

const LATIN_FIXES = [[/ph/g, 'f'], [/kh/g, 'ch'], [/^y(?=[aeiou])/, 'gi'], [/^h(?=r)/, 'ch'], [/ck/g, 'k']];

/** One spelling of a name, folded to how it sounds in Greek. */
function soundOf(greekOrFolded) {
    return phoneticGreek(greekOrFolded)
        .replace(/^γι(?=[αεοȣ])/, 'ι')
        .replace(/γγ|γκ|νγ|νκ/g, 'γ')
        .replace(/νδ/g, 'ντ')
        .replace(/μβ/g, 'μπ')
        .replace(/κσ/g, 'ξ')
        .replace(/[^α-ωȣ]/g, '');
}

/** The sound keys a typed first name can stand for (a Latin "x" can be ξ or χ). */
export function nameSoundKeys(name) {
    const first = foldText(String(name || '').trim().split(/[\s-]+/)[0] || '');
    if (!first) return [];
    if (!/[a-z]/.test(first)) return [soundOf(first)].filter(Boolean);
    let latin = first.replace(/[^a-z]/g, '');
    LATIN_FIXES.forEach(([re, to]) => { latin = latin.replace(re, to); });
    const ways = new Set([latin, latin.replace(/x/g, 'ks')]);
    return [...ways].map((w) => soundOf(greeklishWord(w))).filter(Boolean);
}

let INDEX = null;
function buildIndex() {
    const index = new Map();
    const add = (spelling, hit) => {
        nameSoundKeys(spelling).forEach((key) => { if (!index.has(key)) index.set(key, hit); });
    };
    for (const [rule, feast, names] of NAMEDAY_ENTRIES) {
        names.forEach((name) => {
            const hit = { rule, feast, name: names[0] };
            add(name, hit);
            (ENGLISH_NAMES[name] || []).forEach((alias) => add(alias, hit));
        });
    }
    return index;
}

/**
 * The name day for a child's name, or null when the calendar does not hold it.
 * @returns {{ rule: string, date: 'MM-DD', feast: string, movable: boolean, name: string } | null}
 */
export function findNameday(fullName, year = new Date().getFullYear()) {
    INDEX ||= buildIndex();
    for (const key of nameSoundKeys(fullName)) {
        const hit = INDEX.get(key);
        if (hit) return { ...hit, date: ruleDate(hit.rule, year), movable: isMovableRule(hit.rule) };
    }
    return null;
}

/** The feasts and names celebrated on a date (a Date or 'YYYY-MM-DD'), for the projector. */
export function namedaysOn(dateLike = new Date()) {
    const date = typeof dateLike === 'string' ? new Date(`${dateLike}T12:00:00`) : dateLike;
    const year = date.getFullYear();
    const key = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return NAMEDAY_ENTRIES
        .filter(([rule]) => ruleDate(rule, year) === key)
        .map(([rule, feast, names]) => ({ rule, feast, names: [...names], movable: isMovableRule(rule) }));
}

// ---------------------------------------------------------------- Seasons of the Greek year
// What the projector says about the season today. Moving ones follow Orthodox Easter.
// [from, to, name, icon, info]; the first match wins, so single days sit before the seasons around them.
const SEASONS = [
    ['easter-48', 'easter-48', 'Clean Monday', '🪁', 'Lent begins. Kites fly all over Greece today!'],
    ['easter-7', 'easter-7', 'Palm Sunday', '🌿', 'One week before Easter.'],
    ['easter-6', 'easter-1', 'Holy Week', '🕯️', 'The most important week of the Orthodox year. Easter is coming!'],
    ['easter', 'easter', 'Easter Sunday', '🥚', 'Χριστός Ανέστη! Red eggs, lamb and a big family table.'],
    ['easter+1', 'easter+6', 'Easter Week', '🐣', 'The happy week after Easter.'],
    ['easter+39', 'easter+39', 'Ascension Day', '☁️', 'Forty days after Easter.'],
    ['easter+49', 'easter+49', 'Pentecost', '🕊️', 'Fifty days after Easter.'],
    ['easter+50', 'easter+50', 'Holy Spirit Day', '🏖️', 'A holiday Monday in Greece: many families go to the sea.'],
    ['easter-47', 'easter-8', 'Great Lent', '🫓', 'Forty days of Lent, on the way to Easter.'],
    ['easter-70', 'easter-49', 'Carnival', '🎭', 'Απόκριες! Costumes, masks and parades.'],
    ['01-01', '01-01', "New Year's Day", '🎆', 'Καλή χρονιά! Who found the coin in the vasilopita?'],
    ['01-06', '01-06', 'Epiphany', '💧', 'Τα Φώτα: the blessing of the waters.'],
    ['01-30', '01-30', 'The Three Hierarchs', '📚', 'A day for teachers and schools in Greece.'],
    ['03-25', '03-25', 'Independence Day', '🇬🇷', 'In 1821 the Greek War of Independence began. Parades in every town!'],
    ['08-15', '08-15', 'The Dormition of Mary', '🌹', 'The great summer feast. Χρόνια πολλά to every Maria and Panagiotis!'],
    ['10-28', '10-28', 'Ohi Day', '🇬🇷', 'On 28 October 1940 Greece said “Όχι!” (No!). School parades today.'],
    ['11-17', '11-17', 'Polytechnic Day', '🕯️', 'Schools remember the students of 1973.'],
    ['11-15', '12-24', 'Advent', '⛪', 'The forty days before Christmas.'],
    ['12-25', '12-26', 'Christmas', '🎄', 'Καλά Χριστούγεννα! Merry Christmas!'],
    ['12-27', '12-31', 'Between the holidays', '✨', 'The New Year is almost here.']
];

/** The season or feast of the Greek year on a date, or null on an ordinary day. */
export function orthodoxSeasonOn(dateLike = new Date()) {
    const date = typeof dateLike === 'string' ? new Date(`${dateLike}T12:00:00`) : dateLike;
    const year = date.getFullYear();
    const today = keyToNum(`${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
    const hit = SEASONS.find(([from, to]) => {
        const a = keyToNum(ruleDate(from, year));
        const b = keyToNum(ruleDate(to, year));
        return today >= a && today <= b;
    });
    return hit ? { name: hit[2], icon: hit[3], info: hit[4] } : null;
}

// ---------------------------------------------------------------- Students

/** '0000-MM-DD' for a student's name day this year, honouring a moving feast. */
export function studentNamedayFor(student, year = new Date().getFullYear()) {
    if (!student) return null;
    if (isMovableRule(student.namedayRule)) {
        const key = ruleDate(student.namedayRule, year);
        if (key) return `0000-${key}`;
    }
    return student.nameday || null;
}

/** The roster with each moving name day turned into this year's date (unchanged objects otherwise). */
export function applyMovableNamedays(students, year = new Date().getFullYear()) {
    if (!Array.isArray(students)) return students;
    let changed = false;
    const next = students.map((s) => {
        if (!s || !isMovableRule(s.namedayRule)) return s;
        const nameday = studentNamedayFor(s, year);
        if (!nameday || nameday === s.nameday) return s;
        changed = true;
        return { ...s, nameday };
    });
    return changed ? next : students;
}

/**
 * What to store for a name day: the date as chosen, plus the moving rule when the chosen date is
 * this year's date of the name's moving feast. With no date chosen, the calendar's date is offered.
 * @returns {{ nameday: string|null, namedayRule: string|null }}
 */
export function namedayToStore(fullName, chosen, year = new Date().getFullYear()) {
    const picked = /^\d{4}-\d{2}-\d{2}$/.test(String(chosen || '')) ? String(chosen) : null;
    const found = findNameday(fullName, year);
    if (!picked) {
        return found ? { nameday: `0000-${found.date}`, namedayRule: found.movable ? found.rule : null } : { nameday: null, namedayRule: null };
    }
    const rule = found?.movable && picked.slice(5) === found.date ? found.rule : null;
    return { nameday: picked, namedayRule: rule };
}
