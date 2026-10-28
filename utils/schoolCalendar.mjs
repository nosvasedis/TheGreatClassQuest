// /utils/schoolCalendar.mjs
// The school calendar the app "knows" by itself. It follows the holidays Greek law sets for
// frontistiria and foreign-language centres (decision 219434/Α5, ΦΕΚ Β΄ 4212/2016, amended by
// 8778/Ν1/2024 which dropped Three Hierarchs): Christmas break 24 Dec–2 Jan, and 28 Oct, 17 Nov,
// Epiphany, Clean Monday, 25 Mar, 1 May, Holy Spirit Monday, 15 Aug and the town's patron saint.
// Easter follows practice rather than the decree: language schools close for two weeks, Holy
// Monday to Thomas Sunday. Some fun days get a mark on the Quest Calendar too.
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
    { key: 'languages-day', kind: 'observance', md: '09-26', name: 'European Day of Languages', nameEl: 'Ευρωπαϊκή Ημέρα Γλωσσών', icon: '🌍', theme: 'observance',
        blurb: 'A day to celebrate every language in Europe. Perfect for a "hello" in five languages!' },
    { key: 'ohi', kind: 'closure', md: '10-28', name: 'Ohi Day', nameEl: 'Επέτειος του «Όχι»', icon: '🏛️', theme: 'national',
        blurb: 'On 28 October 1940 Greece answered "No!" Parades, flags and a day off for every school.' },
    { key: 'halloween', kind: 'observance', md: '10-31', name: 'Halloween', nameEl: 'Halloween', icon: '🎃', theme: 'observance',
        blurb: 'Pumpkins, costumes and spooky words. A favourite day in every English class!' },
    { key: 'polytechnic', kind: 'closure', md: '11-17', name: 'Polytechnic Day', nameEl: 'Επέτειος του Πολυτεχνείου', icon: '🕊️', theme: 'remembrance',
        blurb: 'Greece remembers the students of the Athens Polytechnic (1973). A day of memory, and no lessons.' },
    // --- winter
    { key: 'christmas-break', kind: 'closure', break: true, startMd: '12-24', endMd: '01-02', name: 'Christmas holidays', nameEl: 'Διακοπές Χριστουγέννων', icon: '🎄', theme: 'winter', type: 'christmas',
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
    { key: 'three-hierarchs', kind: 'school', md: '01-30', name: 'Three Hierarchs Day', nameEl: 'Τριών Ιεραρχών', icon: '📚', theme: 'letters',
        blurb: 'The day of Greek letters and learning. A celebration day, and lessons go on as normal.' },
    // --- spring (Easter-based days use `easter`: days after Orthodox Easter Sunday)
    { key: 'tsiknopempti', kind: 'observance', easter: -59, name: 'Tsiknopempti', nameEl: 'Τσικνοπέμπτη', icon: '🍖', theme: 'observance',
        blurb: 'Carnival Thursday: the smell of grilled meat fills every Greek street.' },
    { key: 'clean-monday', kind: 'closure', easter: -48, name: 'Clean Monday', nameEl: 'Καθαρά Δευτέρα', icon: '🪁', theme: 'kites',
        blurb: 'Lent begins. Kites fill the sky all over Greece, with lagana and picnics on the hills!' },
    { key: 'independence', kind: 'closure', md: '03-25', name: 'Independence Day', nameEl: '25η Μαρτίου', icon: '🏛️', theme: 'national',
        blurb: 'Greece celebrates the start of the 1821 revolution. Parades, flags and a day off!' },
    { key: 'world-book-day', kind: 'observance', md: '04-23', name: 'World Book Day', nameEl: 'Παγκόσμια Ημέρα Βιβλίου', icon: '📖', theme: 'observance',
        blurb: 'Celebrate stories! Every hero brings a favourite book to class.' },
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
    { key: 'may-day', kind: 'closure', md: '05-01', name: 'May Day', nameEl: 'Πρωτομαγιά', icon: '🌸', theme: 'flowers',
        blurb: 'Labour Day and the feast of flowers. Weave a May wreath for the door!' },
    { key: 'holy-spirit', kind: 'closure', easter: 50, name: 'Holy Spirit Monday', nameEl: 'Αγίου Πνεύματος', icon: '🕊️', theme: 'dove',
        blurb: 'A long weekend in early summer. Many families head to the sea!' },
    { key: 'assumption', kind: 'closure', md: '08-15', name: 'Assumption Day', nameEl: 'Δεκαπενταύγουστος', icon: '⛪', theme: 'summer',
        blurb: 'The heart of the Greek summer. Villages celebrate with music and dancing.' },
];

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
    return [...BUILT_IN, ...LOCAL_FEASTS]
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
    const onMd = (md) => `${Number(md.slice(0, 2)) >= 9 ? y : y + 1}-${md}`;
    return [...BUILT_IN, ...LOCAL_FEASTS].map((def) => {
        let start;
        let end;
        if (def.md) {
            start = onMd(def.md);
            end = start;
        } else if (def.startMd) {
            start = onMd(def.startMd);
            end = onMd(def.endMd);
        } else if (Number.isFinite(def.easter)) {
            start = addDaysIso(easter, def.easter);
            end = start;
        } else {
            start = addDaysIso(easter, def.easterStart);
            end = addDaysIso(easter, def.easterEnd);
        }
        const { match, md, startMd, endMd, easterStart, easterEnd, ...rest } = def;
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
    return calendar.feastsByDay.get(toIsoDay(iso)) || [];
}

/** True when the School Office marked this date as a school day. */
export function isOpenSchoolDay(iso, calendar = current) {
    return calendar.openDays.has(toIsoDay(iso));
}

const THEME_ICON = { christmas: '🎄', easter: '🥚' };
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
    return { closure: 0, local: 1, school: 2, feast: 3, observance: 4 }[d.kind] ?? 5;
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
    const theme = day.theme
        || (type === 'christmas' ? 'winter' : type === 'easter' ? 'spring' : 'break');
    return {
        key: day.key || '',
        kind: day.kind || (day.official ? 'closure' : 'break'),
        name: day.name || (type === 'christmas' ? 'Winter Break' : type === 'easter' ? 'Easter Break' : 'School holiday'),
        nameEl: day.nameEl || '',
        icon: day.icon || THEME_ICON[type] || '🏖️',
        theme,
        blurb: day.blurb || '',
        closed: Boolean(closure),
        closureName: closure ? (closure.name || '') : '',
        official: day.official !== false && Boolean(day.key),
    };
}
