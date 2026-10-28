// /utils/schoolCalendar.mjs
// The school calendar the app "knows" by itself. It follows the holidays Greek law sets for
// frontistiria and foreign-language centres (decision 219434/Α5, ΦΕΚ Β΄ 4212/2016, amended by
// 8778/Ν1/2024 which dropped Three Hierarchs): 28 Oct, 17 Nov, Epiphany, Clean Monday, 25 Mar,
// 1 May, Holy Spirit Monday, 15 Aug and the town's patron saint. Christmas and Easter follow
// practice rather than the decree: Christmas runs 24 Dec–8 Jan (plus the weekend after, so
// lessons restart on a school day), and Easter is two weeks, Holy Monday to Thomas Sunday. Some fun days get a mark on the Quest Calendar too.
//
// The School Office keeps its own breaks in school_settings/holidays `ranges` (entries with
// start + end). This module merges those with the built-in calendar into one list of
// non-overlapping closure ranges, which is what every class-day calculation reads
// (state.schoolHolidayRanges). The School Office's choices live in the same `ranges` array as
// entries without start/end, so older app versions simply skip them:
//   { id, kind: 'calendar-rule', key, mode }   mode: 'closed' | 'marked' | 'off'
//   { id, kind: 'school-day', date: 'YYYY-MM-DD' } lessons run that day whatever the calendar says
// key 'greek' with mode 'off' switches the whole built-in calendar off.
//
// Leaf module (imports nothing) so utils.js can read it without a cycle through state.js.

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for a Date (local) or a UTC-day number. */
export function isoOf(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const utcDay = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS : null;
};
const isoFromUtcDay = (n) => {
    const d = new Date(n * DAY_MS);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const addDaysIso = (iso, days) => isoFromUtcDay(utcDay(iso) + days);
export const daysBetweenIso = (a, b) => utcDay(b) - utcDay(a);
export const weekdayOfIso = (iso) => new Date(utcDay(iso) * DAY_MS).getUTCDay();

/** Turn 'YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY' or a Date into 'YYYY-MM-DD' (or ''). */
export function toIsoDay(value) {
    if (!value) return '';
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : isoOf(value);
    const text = String(value).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : isoOf(parsed);
}

/** Orthodox Easter Sunday as 'YYYY-MM-DD' (Meeus Julian computus, +13 days for 1900-2099). */
export function orthodoxEasterIso(year) {
    const y = Number(year);
    const a = y % 4;
    const b = y % 7;
    const c = y % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    return isoFromUtcDay(Date.UTC(y, month - 1, day + 13) / DAY_MS);
}

/** Western (Gregorian) Easter Sunday as 'YYYY-MM-DD' (anonymous Gregorian algorithm). */
export function westernEasterIso(year) {
    const y = Number(year);
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${y}-${pad(month)}-${pad(day)}`;
}

/** The nth `weekday` (0 = Sunday) of `month` (1-12) in `year`, as 'YYYY-MM-DD'. */
export function nthWeekdayIso(year, month, weekday, n) {
    const first = `${year}-${pad(month)}-01`;
    const shift = (weekday - weekdayOfIso(first) + 7) % 7;
    return addDaysIso(first, shift + (n - 1) * 7);
}

// ------------------------------------------------------------------ the built-in days
//
// kind:
//   'closure'   no lessons by default
//   'school'    a school celebration with lessons as normal (default: marked)
//   'feast'     a named day inside a break (Christmas Day, Good Friday…), always shown
//   'observance' a fun or meaningful day, marked only, never closes
//   'local'     a city's own feast; off until the School Office switches it on
// theme picks the colours and the little scene on the calendar and the Home schedule.

const BUILT_IN = [
    // --- autumn
    { key: 'ohi', kind: 'closure', md: '10-28', name: 'Ohi Day', nameEl: 'Επέτειος του «Όχι»', icon: '🏛️', theme: 'national',
        blurb: 'On 28 October 1940 Greece answered "No!" Parades, flags and a day off for every school.' },
    { key: 'polytechnic', kind: 'closure', md: '11-17', name: 'Polytechnic Day', nameEl: 'Επέτειος του Πολυτεχνείου', icon: '🕊️', theme: 'remembrance',
        blurb: 'Greece remembers the students of the Athens Polytechnic (1973). A day of memory, and no lessons.' },
    // --- winter
    { key: 'christmas-break', kind: 'closure', break: true, startMd: '12-24', endMd: '01-08', throughWeekend: true, name: 'Christmas holidays', nameEl: 'Διακοπές Χριστουγέννων', icon: '🎄', theme: 'winter', type: 'christmas',
        blurb: 'Snowflakes, carols and melomakarona. The heroes are on winter leave!' },
    { key: 'christmas-eve', kind: 'feast', parent: 'christmas-break', md: '12-24', name: 'Christmas Eve', nameEl: 'Παραμονή Χριστουγέννων', icon: '🔔', theme: 'winter',
        blurb: 'Children sing the kalanta from door to door. The winter holidays begin!' },
    { key: 'christmas', kind: 'feast', parent: 'christmas-break', md: '12-25', name: 'Christmas Day', nameEl: 'Χριστούγεννα', icon: '🎄', theme: 'winter',
        blurb: 'Merry Christmas to every hero and their family!' },
    { key: 'synaxis', kind: 'feast', parent: 'christmas-break', md: '12-26', name: 'Boxing Day', nameEl: 'Σύναξη της Θεοτόκου', icon: '🎁', theme: 'winter',
        blurb: 'The second day of Christmas. More family, more sweets!' },
    { key: 'new-years-eve', kind: 'feast', parent: 'christmas-break', md: '12-31', name: "New Year's Eve", nameEl: 'Παραμονή Πρωτοχρονιάς', icon: '🎆', theme: 'winter',
        blurb: 'The last night of the year. Who will find the coin in the vasilopita?' },
    { key: 'new-year', kind: 'feast', parent: 'christmas-break', md: '01-01', name: "New Year's Day", nameEl: 'Πρωτοχρονιά', icon: '🎉', theme: 'winter',
        blurb: 'Happy New Year! A fresh page in every hero\'s story.' },
    { key: 'epiphany', kind: 'closure', md: '01-06', name: 'Epiphany', nameEl: 'Θεοφάνεια', icon: '💧', theme: 'winter',
        blurb: 'The Blessing of the Waters. Brave swimmers dive for the cross!' },
    { key: 'three-hierarchs', kind: 'school', md: '01-30', name: 'Three Hierarchs Day', nameEl: 'Τριών Ιεραρχών', icon: '📚', theme: 'letters', colors: ['#eff6ff', '#e0e7ff', '#3730a3'], art: 'sparks',
        blurb: 'The day of Greek letters and learning. A celebration day, and lessons go on as normal.' },
    // --- spring (Easter-based days use `easter`: days after Orthodox Easter Sunday)
    { key: 'clean-monday', kind: 'closure', easter: -48, name: 'Clean Monday', nameEl: 'Καθαρά Δευτέρα', icon: '🪁', theme: 'kites',
        blurb: 'Lent begins. Kites fill the sky all over Greece, with lagana and picnics on the hills!' },
    { key: 'independence', kind: 'closure', md: '03-25', name: 'Independence Day', nameEl: '25η Μαρτίου', icon: '🏛️', theme: 'national',
        blurb: 'Greece celebrates the start of the 1821 revolution. Parades, flags and a day off!' },
    { key: 'easter-break', kind: 'closure', break: true, easterStart: -6, easterEnd: 7, name: 'Easter holidays', nameEl: 'Διακοπές Πάσχα', icon: '🥚', theme: 'spring', type: 'easter',
        blurb: 'Red eggs, tsoureki and lambs on the spit. Enjoy the Easter quest pause!' },
    { key: 'good-friday', kind: 'feast', parent: 'easter-break', easter: -2, name: 'Good Friday', nameEl: 'Μεγάλη Παρασκευή', icon: '🕯️', theme: 'spring',
        blurb: 'A quiet, thoughtful day in Holy Week.' },
    { key: 'holy-saturday', kind: 'feast', parent: 'easter-break', easter: -1, name: 'Holy Saturday', nameEl: 'Μεγάλο Σάββατο', icon: '🕯️', theme: 'spring',
        blurb: 'At midnight the candles are lit: Christos Anesti!' },
    { key: 'easter', kind: 'feast', parent: 'easter-break', easter: 0, name: 'Easter Sunday', nameEl: 'Πάσχα', icon: '🥚', theme: 'spring',
        blurb: 'Christos Anesti! Crack the red eggs. Whose egg is the strongest?' },
    { key: 'holy-monday', kind: 'feast', parent: 'easter-break', easter: -6, name: 'Holy Monday', nameEl: 'Μεγάλη Δευτέρα', icon: '🌿', theme: 'spring',
        blurb: 'Holy Week begins, and so do two whole weeks of Easter holidays!' },
    { key: 'holy-thursday', kind: 'feast', parent: 'easter-break', easter: -3, name: 'Holy Thursday', nameEl: 'Μεγάλη Πέμπτη', icon: '🥚', theme: 'spring',
        blurb: 'The day to dye the eggs red!' },
    { key: 'easter-monday', kind: 'feast', parent: 'easter-break', easter: 1, name: 'Easter Monday', nameEl: 'Δευτέρα του Πάσχα', icon: '🐣', theme: 'spring',
        blurb: 'One more day of Easter feasting.' },
    { key: 'holy-tuesday', kind: 'feast', parent: 'easter-break', easter: -5, name: 'Holy Tuesday', nameEl: 'Μεγάλη Τρίτη', icon: '🌿', theme: 'spring',
        blurb: 'Holy Week goes on. Homes are cleaned and readied for Easter.' },
    { key: 'holy-wednesday', kind: 'feast', parent: 'easter-break', easter: -4, name: 'Holy Wednesday', nameEl: 'Μεγάλη Τετάρτη', icon: '🌿', theme: 'spring',
        blurb: 'Kitchens smell of tsoureki and koulourakia. Easter is coming!' },
    { key: 'bright-tuesday', kind: 'feast', parent: 'easter-break', easter: 2, name: 'Easter Tuesday', nameEl: 'Τρίτη της Διακαινησίμου', icon: '🌷', theme: 'spring',
        blurb: 'Bright Week: the happiest week of the Greek spring.' },
    { key: 'bright-wednesday', kind: 'feast', parent: 'easter-break', easter: 3, name: 'Easter Wednesday', nameEl: 'Τετάρτη της Διακαινησίμου', icon: '🌷', theme: 'spring',
        blurb: 'Still Bright Week! Leftover red eggs make a great snack.' },
    { key: 'bright-thursday', kind: 'feast', parent: 'easter-break', easter: 4, name: 'Easter Thursday', nameEl: 'Πέμπτη της Διακαινησίμου', icon: '🌷', theme: 'spring',
        blurb: 'Spring days for play, picnics and stories outside.' },
    { key: 'life-giving-spring', kind: 'feast', parent: 'easter-break', easter: 5, name: 'Life-giving Spring', nameEl: 'Ζωοδόχου Πηγής', icon: '⛲', theme: 'spring',
        blurb: 'The Friday after Easter, a feast of springs and fresh water.' },
    { key: 'bright-saturday', kind: 'feast', parent: 'easter-break', easter: 6, name: 'Easter Saturday', nameEl: 'Σάββατο της Διακαινησίμου', icon: '🌷', theme: 'spring',
        blurb: 'The last Saturday of the Easter holidays. Rest up, heroes!' },
    { key: 'thomas-sunday', kind: 'feast', parent: 'easter-break', easter: 7, name: 'Thomas Sunday', nameEl: 'Κυριακή του Θωμά', icon: '🎒', theme: 'spring',
        blurb: 'The last day of the Easter holidays. Lessons start again tomorrow!' },
    { key: 'may-day', kind: 'closure', md: '05-01', name: 'May Day', nameEl: 'Πρωτομαγιά', icon: '🌸', theme: 'flowers',
        blurb: 'Labour Day and the feast of flowers. Weave a May wreath for the door!' },
    { key: 'holy-spirit', kind: 'closure', easter: 50, name: 'Holy Spirit Monday', nameEl: 'Αγίου Πνεύματος', icon: '🕊️', theme: 'dove',
        blurb: 'A long weekend in early summer. Many families head to the sea!' },
    { key: 'assumption', kind: 'closure', md: '08-15', name: 'Assumption Day', nameEl: 'Δεκαπενταύγουστος', icon: '⛪', theme: 'summer',
        blurb: 'The heart of the Greek summer. Villages celebrate with music and dancing.' },
];

// Celebrations with lessons as normal: the big days of the English-speaking world (it is an
// English school) and the Greek ones the children talk about. They never close the school.
// `colors` is [light, lighter, ink] for the tile, `art` the little decoration behind it.
// Dates: md (fixed), easter (Orthodox), westEaster (Western Easter, Gregorian), nth (Nth weekday).
const CELEBRATIONS = [
    { key: 'languages-day', md: '09-26', name: 'European Day of Languages', nameEl: 'Ευρωπαϊκή Ημέρα Γλωσσών', icon: '🌍', colors: ['#ecfeff', '#dbeafe', '#1e40af'], art: 'sparks',
        blurb: 'A day to celebrate every language in Europe. Who can say "hello" in five languages?' },
    { key: 'animal-day', md: '10-04', name: 'World Animal Day', nameEl: 'Παγκόσμια Ημέρα των Ζώων', icon: '🐾', colors: ['#f0fdf4', '#fef3c7', '#166534'], art: 'leaves',
        blurb: 'A day for every creature, big and small. Which animal would be your class familiar?' },
    { key: 'teachers-day', md: '10-05', name: "World Teachers' Day", nameEl: 'Παγκόσμια Ημέρα των Εκπαιδευτικών', icon: '🍎', colors: ['#fef2f2', '#fef9c3', '#b91c1c'], art: 'sparks',
        blurb: 'A thank-you day for teachers everywhere. Heroes, a kind word goes a long way!' },
    { key: 'halloween', md: '10-31', name: 'Halloween', nameEl: 'Halloween', icon: '🎃', colors: ['#fff7ed', '#ede9fe', '#7c2d12'], art: 'bats',
        blurb: 'Pumpkins, costumes and spooky words. Trick or treat!' },
    { key: 'bonfire-night', md: '11-05', name: 'Bonfire Night', nameEl: 'Νύχτα των Φωτιών (Αγγλία)', icon: '🎆', colors: ['#fff7ed', '#fee2e2', '#9a3412'], art: 'sparks',
        blurb: 'Remember, remember the fifth of November! Fireworks light up the sky all over Britain.' },
    { key: 'kindness-day', md: '11-13', name: 'World Kindness Day', nameEl: 'Παγκόσμια Ημέρα Καλοσύνης', icon: '🤝', colors: ['#fdf2f8', '#e0f2fe', '#9d174d'], art: 'hearts',
        blurb: 'One kind act from every hero today. Respect and teamwork, quest style!' },
    { key: 'thanksgiving', nth: { month: 11, weekday: 4, n: 4 }, name: 'Thanksgiving', nameEl: 'Ημέρα των Ευχαριστιών (ΗΠΑ)', icon: '🦃', colors: ['#fffbeb', '#fed7aa', '#9a3412'], art: 'leaves',
        blurb: 'Americans share a big turkey dinner and say what they are thankful for. What are you thankful for?' },
    { key: 'greek-language-day', md: '02-09', name: 'World Greek Language Day', nameEl: 'Παγκόσμια Ημέρα Ελληνικής Γλώσσας', icon: '✒️', colors: ['#eff6ff', '#e0f2fe', '#1e3a8a'], art: 'sparks',
        blurb: 'English borrowed thousands of Greek words: alphabet, music, phone, dinosaur… How many can the class find?' },
    { key: 'valentines', md: '02-14', name: "Valentine's Day", nameEl: 'Ημέρα του Αγίου Βαλεντίνου', icon: '💌', colors: ['#fff1f2', '#fce7f3', '#be123c'], art: 'hearts',
        blurb: 'A day for kind words and friendship cards. Who will you thank today?' },
    { key: 'mother-language-day', md: '02-21', name: 'Mother Language Day', nameEl: 'Παγκόσμια Ημέρα Μητρικής Γλώσσας', icon: '🗣️', colors: ['#ecfeff', '#ede9fe', '#155e75'], art: 'sparks',
        blurb: 'Every language is a treasure. How do you say "friend" in the languages of your class?' },
    { key: 'tsiknopempti', easter: -59, name: 'Tsiknopempti', nameEl: 'Τσικνοπέμπτη', icon: '🍖', colors: ['#fff7ed', '#fde68a', '#9a3412'], art: 'sparks',
        blurb: 'Carnival Thursday: the smell of grilled meat fills every Greek street.' },
    { key: 'carnival', easter: -52, name: 'Carnival Friday', nameEl: 'Αποκριές', icon: '🎭', colors: ['#fdf4ff', '#fef9c3', '#86198f'], art: 'confetti',
        blurb: 'Masks and costumes! The last carnival weekend before Clean Monday.' },
    { key: 'pancake-day', westEaster: -47, name: 'Pancake Day', nameEl: 'Pancake Day (Αγγλία)', icon: '🥞', colors: ['#fffbeb', '#fef3c7', '#92400e'], art: 'sparks',
        blurb: 'Shrove Tuesday in Britain: pancake races and flipping contests in the street!' },
    { key: 'st-patricks', md: '03-17', name: "St Patrick's Day", nameEl: 'Αγίου Πατρικίου (Ιρλανδία)', icon: '☘️', colors: ['#f0fdf4', '#dcfce7', '#166534'], art: 'clovers',
        blurb: 'Ireland goes green! Parades, shamrocks and a little bit of luck.' },
    { key: 'happiness-day', md: '03-20', name: 'International Day of Happiness', nameEl: 'Παγκόσμια Ημέρα Ευτυχίας', icon: '😊', colors: ['#fefce8', '#fce7f3', '#a16207'], art: 'confetti',
        blurb: 'What makes you happy? Share it in one English sentence!' },
    { key: 'poetry-day', md: '03-21', name: 'World Poetry Day', nameEl: 'Παγκόσμια Ημέρα Ποίησης', icon: '🪶', colors: ['#faf5ff', '#e0e7ff', '#5b21b6'], art: 'sparks',
        blurb: 'Rhymes and rhythms! Can the class write a four-line poem together?' },
    { key: 'april-fools', md: '04-01', name: "April Fools' Day", nameEl: 'Πρωταπριλιά', icon: '🃏', colors: ['#fefce8', '#e0f2fe', '#854d0e'], art: 'confetti',
        blurb: 'Jokes and harmless tricks, in Greece and in Britain alike. Don\'t believe everything today!' },
    { key: 'childrens-book-day', md: '04-02', name: "International Children's Book Day", nameEl: 'Παγκόσμια Ημέρα Παιδικού Βιβλίου', icon: '📚', colors: ['#eff6ff', '#fef9c3', '#1d4ed8'], art: 'sparks',
        blurb: "Hans Christian Andersen's birthday. Which story would you jump into?" },
    { key: 'western-easter', westEaster: 0, onlyIfDiffers: true, name: 'Easter in Britain and the USA', nameEl: 'Καθολικό Πάσχα', icon: '🐣', colors: ['#fefce8', '#fce7f3', '#9d174d'], art: 'confetti',
        blurb: 'Western Easter: egg hunts, chocolate bunnies and hot cross buns.' },
    { key: 'earth-day', md: '04-22', name: 'Earth Day', nameEl: 'Ημέρα της Γης', icon: '🌱', colors: ['#f0fdf4', '#e0f2fe', '#166534'], art: 'leaves',
        blurb: 'Our planet\'s day. One small green promise from every hero!' },
    { key: 'world-book-day', md: '04-23', name: 'World Book Day', nameEl: 'Παγκόσμια Ημέρα Βιβλίου', icon: '📖', colors: ['#fdf4ff', '#ede9fe', '#6b21a8'], art: 'sparks',
        blurb: 'Celebrate stories! Every hero brings a favourite book to class.' },
    { key: 'mothers-day', nth: { month: 5, weekday: 0, n: 2 }, name: "Mother's Day", nameEl: 'Γιορτή της Μητέρας', icon: '💐', colors: ['#fdf2f8', '#fae8ff', '#9d174d'], art: 'hearts',
        blurb: 'A card, a poem or a hug for every mum. Make one in English!' },
    { key: 'environment-day', md: '06-05', name: 'World Environment Day', nameEl: 'Παγκόσμια Ημέρα Περιβάλλοντος', icon: '🌳', colors: ['#f0fdf4', '#cffafe', '#166534'], art: 'leaves',
        blurb: 'Plant, recycle, switch off. Small quests that save the world.' },
].map((c) => ({ ...c, kind: 'observance', theme: 'celebration' }));

/** Local city feasts. `match` is checked against the School's weather location name. */
const LOCAL_FEASTS = [
    { key: 'local-athens', md: '10-03', city: 'Athens', match: ['athens', 'athina', 'αθήνα', 'αθηνα'], name: 'Saint Dionysius Day', nameEl: 'Αγίου Διονυσίου Αρεοπαγίτου' },
    { key: 'local-thessaloniki', md: '10-26', city: 'Thessaloniki', match: ['thessaloniki', 'salonica', 'θεσσαλονίκη', 'θεσσαλονικη'], name: 'Saint Demetrius Day', nameEl: 'Αγίου Δημητρίου' },
    { key: 'local-heraklion', md: '11-11', city: 'Heraklion', match: ['heraklion', 'iraklio', 'ηράκλειο', 'ηρακλειο'], name: 'Saint Minas Day', nameEl: 'Αγίου Μηνά' },
    { key: 'local-patras', md: '11-30', city: 'Patras', match: ['patra', 'πάτρα', 'πατρα'], name: 'Saint Andrew Day', nameEl: 'Αγίου Ανδρέα' },
    { key: 'local-corfu', md: '12-12', city: 'Corfu', match: ['corfu', 'kerkyra', 'κέρκυρα', 'κερκυρα'], name: 'Saint Spyridon Day', nameEl: 'Αγίου Σπυρίδωνος' },
    { key: 'local-piraeus', md: '12-12', city: 'Piraeus', match: ['piraeus', 'pireas', 'πειραιάς', 'πειραιας'], name: 'Saint Spyridon Day', nameEl: 'Αγίου Σπυρίδωνος' },
    { key: 'local-kalamata', md: '02-02', city: 'Kalamata', match: ['kalamata', 'καλαμάτα', 'καλαματα'], name: 'Ypapanti', nameEl: 'Υπαπαντή' },
    { key: 'local-larissa', md: '05-15', city: 'Larissa', match: ['larissa', 'larisa', 'λάρισα', 'λαρισα'], name: 'Saint Achillios Day', nameEl: 'Αγίου Αχιλλίου' },
].map((f) => ({
    ...f,
    kind: 'local',
    icon: '🔔',
    theme: 'local',
    blurb: `The feast of ${f.city}'s patron saint. Bells ring and the city celebrates.`,
}));

export const DEFAULT_MODE = { closure: 'closed', school: 'marked', feast: 'marked', observance: 'marked', local: 'off' };

/** Every built-in day the School Office can switch (one row per key, no dates). */
export function listCalendarDefinitions() {
    return [...BUILT_IN, ...CELEBRATIONS, ...LOCAL_FEASTS]
        .filter((d) => d.kind !== 'feast')
        .map(({ key, kind, name, nameEl, icon, theme, blurb, city }) => ({ key, kind, name, nameEl, icon, theme, blurb, city: city || '', defaultMode: DEFAULT_MODE[kind] }));
}

/** The local feast whose city matches the school's location name, if any. */
export function suggestLocalFeast(locationName) {
    const text = String(locationName || '').toLowerCase();
    if (!text) return null;
    const hit = LOCAL_FEASTS.find((f) => f.match.some((m) => text.includes(m)));
    return hit ? listCalendarDefinitions().find((d) => d.key === hit.key) : null;
}

/**
 * The built-in days of one school year (September `startYear` to August `startYear + 1`),
 * dated. Each entry: { key, kind, name, nameEl, icon, theme, blurb, start, end, parent?, type? }.
 */
export function builtInDaysForSchoolYear(startYear) {
    const y = Number(startYear);
    const easter = orthodoxEasterIso(y + 1);
    // Months September-December belong to startYear, January-August to the next.
    const westEaster = westernEasterIso(y + 1);
    const onMd = (md) => `${Number(md.slice(0, 2)) >= 9 ? y : y + 1}-${md}`;
    return [...BUILT_IN, ...CELEBRATIONS, ...LOCAL_FEASTS].filter((def) => !(def.onlyIfDiffers && westEaster === easter)).map((def) => {
        let start;
        let end;
        if (def.nth) {
            start = nthWeekdayIso(def.nth.month >= 9 ? y : y + 1, def.nth.month, def.nth.weekday, def.nth.n);
            end = start;
        } else if (Number.isFinite(def.westEaster)) {
            start = addDaysIso(westEaster, def.westEaster);
            end = start;
        } else if (def.md) {
            start = onMd(def.md);
            end = start;
        } else if (def.startMd) {
            start = onMd(def.startMd);
            end = onMd(def.endMd);
            // Lessons start again on a school day, so a weekend right after the break belongs to it.
            if (def.throughWeekend) while ([6, 0].includes(weekdayOfIso(addDaysIso(end, 1)))) end = addDaysIso(end, 1);
        } else if (Number.isFinite(def.easter)) {
            start = addDaysIso(easter, def.easter);
            end = start;
        } else {
            start = addDaysIso(easter, def.easterStart);
            end = addDaysIso(easter, def.easterEnd);
        }
        const { match, md, startMd, endMd, easterStart, easterEnd, nth, westEaster: _w, onlyIfDiffers, throughWeekend, ...rest } = def;
        return { ...rest, easter: undefined, start, end, schoolYear: y };
    });
}

/** Split the stored `ranges` array into the School Office's breaks and its calendar choices. */
export function parseCalendarSettings(rawRanges = []) {
    const manual = [];
    const rules = new Map();
    const openDays = new Set();
    (Array.isArray(rawRanges) ? rawRanges : []).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        if (entry.kind === 'calendar-rule') {
            if (entry.key && ['closed', 'marked', 'off'].includes(entry.mode)) rules.set(String(entry.key), entry.mode);
            return;
        }
        if (entry.kind === 'school-day') {
            const iso = toIsoDay(entry.date);
            if (iso) openDays.add(iso);
            return;
        }
        const start = toIsoDay(entry.start || entry.startDate);
        const end = toIsoDay(entry.end || entry.endDate);
        if (!start || !end || end < start) return;
        manual.push({ ...entry, start, end });
    });
    manual.sort((a, b) => a.start.localeCompare(b.start));
    return { manual, rules, openDays, greekOn: rules.get('greek') !== 'off' };
}

/** 'closed' | 'marked' | 'off' for one built-in day. The town's own feast closes by law. */
export function modeFor(def, rules, localKey = '') {
    if (def.kind === 'feast') return rules.get(def.parent) === 'off' ? 'off' : 'marked';
    if (rules.has(def.key)) return rules.get(def.key);
    if (def.kind === 'local' && def.key === localKey) return 'closed';
    return DEFAULT_MODE[def.kind] || 'marked';
}

const MAX_RANGE_DAYS = 400;

/**
 * Merge the School Office's breaks with the built-in calendar.
 * Returns { ranges, feastsByDay, manual, rules, openDays, greekOn }:
 *   ranges       non-overlapping closures, sorted, each { id, name, type, start, end, theme,
 *                icon, nameEl, blurb, official, key, source }. A School Office break wins over a
 *                built-in break it overlaps (its dates are the school's real dates).
 *   feastsByDay  Map 'YYYY-MM-DD' → built-in days shown on that date (closed or marked).
 */
export function buildSchoolCalendar(rawRanges = [], { now = new Date(), yearsBack = 2, yearsAhead = 1, locationName = '' } = {}) {
    const settings = parseCalendarSettings(rawRanges);
    const localKey = suggestLocalFeast(locationName)?.key || '';
    const { manual, rules, openDays, greekOn } = settings;

    const todayIso = toIsoDay(now) || isoOf(new Date());
    const thisSchoolYear = Number(todayIso.slice(5, 7)) >= 9 ? Number(todayIso.slice(0, 4)) : Number(todayIso.slice(0, 4)) - 1;
    const official = [];
    if (greekOn) {
        for (let y = thisSchoolYear - yearsBack; y <= thisSchoolYear + yearsAhead; y += 1) {
            builtInDaysForSchoolYear(y).forEach((d) => {
                const mode = modeFor(d, rules, localKey);
                if (mode !== 'off') official.push({ ...d, mode });
            });
        }
    }

    const overlapsManual = (d) => manual.some((m) => m.start <= d.end && m.end >= d.start);

    // One owner per closed day: the School Office's breaks first, then built-in closures.
    const owners = new Map();
    const claim = (source, start, end) => {
        const from = utcDay(start);
        const to = Math.min(utcDay(end), from + MAX_RANGE_DAYS);
        for (let n = from; n <= to; n += 1) {
            const iso = isoFromUtcDay(n);
            if (!owners.has(iso) && !openDays.has(iso)) owners.set(iso, source);
        }
    };
    manual.forEach((m) => claim({ ...m, official: false, source: 'school' }, m.start, m.end));
    official
        .filter((d) => d.mode === 'closed' && d.kind !== 'feast' && !(d.break && overlapsManual(d)))
        .forEach((d) => claim({
            id: `gr:${d.key}:${d.schoolYear}`,
            name: d.name,
            type: d.type || d.theme,
            theme: d.theme,
            icon: d.icon,
            nameEl: d.nameEl,
            blurb: d.blurb,
            key: d.key,
            official: true,
            source: 'calendar',
        }, d.start, d.end));

    const ranges = [];
    [...owners.keys()].sort().forEach((iso) => {
        const source = owners.get(iso);
        const last = ranges[ranges.length - 1];
        if (last && last._source === source && daysBetweenIso(last.end, iso) === 1) {
            last.end = iso;
            return;
        }
        const piece = ranges.filter((r) => r._source === source).length;
        ranges.push({ ...source, id: piece ? `${source.id}~${piece}` : source.id, sourceId: source.id, start: iso, end: iso, _source: source });
    });
    ranges.forEach((r) => { delete r._source; });

    const feastsByDay = new Map();
    official
        .filter((d) => !d.break)
        .forEach((d) => {
            const list = feastsByDay.get(d.start) || [];
            list.push(d);
            feastsByDay.set(d.start, list);
        });

    return { ...settings, localKey, ranges, feastsByDay, official };
}

// ------------------------------------------------------------------ the live registry
// state.js pushes the stored settings in; utils.js and the screens read the merged result.

let current = buildSchoolCalendar([]);
let currentRaw = [];

// The first and last lesson days of the school year (from the school year and the class end
// dates), marked like celebrations. state.js keeps them in step.
let milestones = { first: '', last: '' };

export function setSchoolCalendarMilestones({ first = '', last = '' } = {}) {
    milestones = { first: toIsoDay(first), last: toIsoDay(last) };
}

function milestoneOn(iso) {
    if (iso && iso === milestones.first) {
        return { key: 'first-day', kind: 'milestone', name: 'First day of the school year', nameEl: 'Πρώτη μέρα της χρονιάς', icon: '🎒', theme: 'celebration',
            colors: ['#ecfeff', '#fef9c3', '#0e7490'], art: 'confetti', blurb: 'A brand-new quest begins. Welcome, heroes!' };
    }
    if (iso && iso === milestones.last) {
        return { key: 'last-day', kind: 'milestone', name: 'Last lesson of the year', nameEl: 'Τελευταίο μάθημα της χρονιάς', icon: '🎓', theme: 'celebration',
            colors: ['#fefce8', '#e0e7ff', '#3730a3'], art: 'confetti', blurb: 'The final page of this year\'s adventure. Well done, heroes!' };
    }
    return null;
}

export function setSchoolCalendarSource(rawRanges = [], options = {}) {
    currentRaw = Array.isArray(rawRanges) ? rawRanges : [];
    current = buildSchoolCalendar(currentRaw, options);
    return current;
}

export function getSchoolCalendar() {
    return current;
}

/** The raw stored `ranges` (School Office breaks plus calendar choices), for writers. */
export function getSchoolCalendarRaw() {
    return currentRaw;
}

/** The closures every class-day calculation should honour. */
export function getEffectiveHolidayRanges() {
    return current.ranges;
}

export function findClosureRange(iso, ranges = current.ranges) {
    const day = toIsoDay(iso);
    if (!day) return null;
    return (ranges || []).find((r) => r?.start && r?.end && day >= toIsoDay(r.start) && day <= toIsoDay(r.end)) || null;
}

/** Built-in days shown on this date (closures, feasts inside breaks, commemorations, fun days). */
export function getFeastsOn(iso, calendar = current) {
    const day = toIsoDay(iso);
    const list = calendar.feastsByDay.get(day) || [];
    const milestone = milestoneOn(day);
    return milestone ? [...list, milestone] : list;
}

/** True when the School Office marked this date as a school day. */
export function isOpenSchoolDay(iso, calendar = current) {
    return calendar.openDays.has(toIsoDay(iso));
}

/** The looks a School Office break can take: the same themes as the built-in days. */
export const BREAK_LOOKS = [
    { type: 'christmas', label: 'Winter', icon: '🎄', theme: 'winter', name: 'Winter break', blurb: 'Snowflakes and cocoa: the heroes are resting by the fire.' },
    { type: 'easter', label: 'Spring', icon: '🥚', theme: 'spring', name: 'Spring break', blurb: 'Spring is out and so are the heroes. Rest well, see you soon!' },
    { type: 'autumn', label: 'Autumn', icon: '🍂', theme: 'break', name: 'Autumn break', blurb: 'Golden leaves and a well-earned rest for the whole party.' },
    { type: 'carnival', label: 'Carnival', icon: '🎭', theme: 'kites', name: 'Carnival break', blurb: 'Masks on, books closed! The heroes are at the carnival.' },
    { type: 'summer', label: 'Summer', icon: '☀️', theme: 'summer', name: 'Summer break', blurb: "Sun, sea and stories. The quest waits for the heroes' return." },
    { type: 'generic', label: 'Other', icon: '🏖️', theme: 'break', name: 'School break', blurb: 'The school is resting today. The quest picks up after the break.' },
];
const BREAK_LOOK_BY_TYPE = new Map(BREAK_LOOKS.map((look) => [look.type, look]));
export const breakLookFor = (type) => BREAK_LOOK_BY_TYPE.get(String(type || '').toLowerCase()) || BREAK_LOOK_BY_TYPE.get('generic');
const BREAK_MIN_DAYS = 3;

/**
 * Everything the calendar knows about one date.
 * {
 *   iso, closure, feasts, headline, openDay,
 *   breakEdge: null | { edge: 'last-before' | 'back-from', range } (school days next to a break of 3+ days)
 * }
 * `headline` is the day to celebrate: the most specific built-in day, else the closure itself.
 */
export function describeSchoolDay(dateLike, calendar = current) {
    const iso = toIsoDay(dateLike);
    const closure = findClosureRange(iso, calendar.ranges);
    const feasts = getFeastsOn(iso, calendar).slice().sort((a, b) => rankKind(a) - rankKind(b));
    const headline = feasts[0]
        ? decorate(feasts[0], closure)
        : (closure ? decorate(closure, closure) : null);
    // Two days on one date (May Day on Holy Saturday): both are named, the first leads.
    const second = feasts[1];
    if (headline && second && second.key !== headline.key) {
        headline.also = { key: second.key, name: second.name, nameEl: second.nameEl || '', icon: second.icon || '', blurb: second.blurb || '' };
    }
    let breakEdge = null;
    if (!closure && iso) {
        const nextWeekday = stepWeekday(iso, 1);
        const prevWeekday = stepWeekday(iso, -1);
        const ahead = findClosureRange(nextWeekday, calendar.ranges);
        const behind = findClosureRange(prevWeekday, calendar.ranges);
        if (ahead && spanDays(ahead) >= BREAK_MIN_DAYS && toIsoDay(ahead.start) > iso) breakEdge = { edge: 'last-before', range: ahead };
        else if (behind && spanDays(behind) >= BREAK_MIN_DAYS && toIsoDay(behind.end) < iso) breakEdge = { edge: 'back-from', range: behind };
    }
    return { iso, closure, feasts, headline, openDay: calendar.openDays.has(iso), breakEdge };
}

function rankKind(d) {
    return { closure: 0, local: 1, milestone: 2, school: 3, feast: 4, observance: 5 }[d.kind] ?? 6;
}

function spanDays(range) {
    return daysBetweenIso(toIsoDay(range.start), toIsoDay(range.end)) + 1;
}

function stepWeekday(iso, dir) {
    let next = addDaysIso(iso, dir);
    while ([0, 6].includes(weekdayOfIso(next))) next = addDaysIso(next, dir);
    return next;
}

/** Fill a day (built-in or a School Office break) with what the screens need. */
function decorate(day, closure) {
    const type = String(day.type || '').toLowerCase();
    const look = BREAK_LOOK_BY_TYPE.get(type);
    const theme = day.theme || look?.theme || 'break';
    return {
        key: day.key || '',
        kind: day.kind || (day.official ? 'closure' : 'break'),
        name: day.name || look?.name || 'School holiday',
        nameEl: day.nameEl || '',
        icon: day.icon || look?.icon || '🏖️',
        theme,
        blurb: day.blurb || look?.blurb || '',
        colors: Array.isArray(day.colors) ? day.colors : null,
        art: day.art || '',
        closed: Boolean(closure),
        closureName: closure ? (closure.name || '') : '',
        official: day.official !== false && Boolean(day.key),
    };
}

/**
 * What the Home greeting's chips should say about the calendar on `dateLike`:
 *   holiday:     the closure going on today, or the next one within `holidayDays`
 *                { range, special, phase: 'today' | 'upcoming', inDays, singleDay }
 *   celebration: today's celebration with lessons, or the next within `celebrationDays`
 *                { special, inDays }
 */
export function upcomingSchoolDays(dateLike = new Date(), { holidayDays = 21, celebrationDays = 7 } = {}, calendar = current) {
    const today = toIsoDay(dateLike);
    let holiday = null;
    const ongoing = findClosureRange(today, calendar.ranges);
    if (ongoing) {
        holiday = { range: ongoing, special: describeSchoolDay(today, calendar).headline, phase: 'today', inDays: 0, singleDay: ongoing.start === ongoing.end };
    } else {
        const next = calendar.ranges
            .filter((r) => r.start > today && daysBetweenIso(today, r.start) <= holidayDays)
            .sort((a, b) => a.start.localeCompare(b.start))[0];
        if (next) {
            holiday = { range: next, special: describeSchoolDay(next.start, calendar).headline, phase: 'upcoming', inDays: daysBetweenIso(today, next.start), singleDay: next.start === next.end };
        }
    }
    let celebration = null;
    for (let i = 0; i <= celebrationDays && !celebration; i += 1) {
        const iso = addDaysIso(today, i);
        if (findClosureRange(iso, calendar.ranges)) continue;
        const special = describeSchoolDay(iso, calendar).headline;
        if (special && special.colors) celebration = { special, inDays: i, iso };
    }
    return { holiday, celebration };
}
