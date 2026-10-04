// features/parent/helpers.js — shared data helpers for the Family Portal
import * as state from '../../state.js';
import { TRAINING_HERO, normalizeHeroClass } from '../heroClassNames.mjs';

import { isGreek, tr, countWord, DAY_WORDS } from './i18n.js';

export { escapeHtml } from '../roles/shared.js';
export { tr, isGreek } from './i18n.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = {
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    el: ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
};
const WEEKDAYS_SHORT = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    el: ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ']
};
// "on Monday": Greek puts the article in front of the day.
const WEEKDAYS_ON = {
    en: WEEKDAYS.en.map((day) => `on ${day}`),
    el: ['την Κυριακή', 'τη Δευτέρα', 'την Τρίτη', 'την Τετάρτη', 'την Πέμπτη', 'την Παρασκευή', 'το Σάββατο']
};
const MONTHS_SHORT = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']
};
const lang = () => (isGreek() ? 'el' : 'en');

export function getSnapshot() {
    return state.get('currentParentSnapshot') || {};
}

export function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || tr('Your child', 'Το παιδί σας');
}

export function initials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
        .map((part) => part[0].toUpperCase()).join('') || '?';
}

/** Any stored date (YYYY-MM-DD, DD-MM-YYYY, ISO, Firestore Timestamp, millis) as a local Date, or null. */
export function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (typeof value === 'number') return new Date(value);
    const text = String(value).trim();
    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toMillis(value) {
    return toDate(value)?.getTime() || 0;
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function daysFromToday(value) {
    const date = toDate(value);
    if (!date) return null;
    return Math.round((startOfDay(date) - startOfDay(new Date())) / DAY_MS);
}

export function shortDate(value, { weekday = true } = {}) {
    const date = toDate(value);
    if (!date) return '';
    const day = `${date.getDate()} ${MONTHS_SHORT[lang()][date.getMonth()]}`;
    return weekday ? `${WEEKDAYS_SHORT[lang()][date.getDay()]} ${day}` : day;
}

export function weekdayName(value) {
    const date = toDate(value);
    return date ? WEEKDAYS[lang()][date.getDay()] : '';
}

/** "on Monday" / "τη Δευτέρα". */
export function onWeekday(value) {
    const date = toDate(value);
    return date ? WEEKDAYS_ON[lang()][date.getDay()] : '';
}

export function monthShort(value) {
    const date = toDate(value);
    return date ? MONTHS_SHORT[lang()][date.getMonth()] : '';
}

/** "today", "yesterday", "3 days ago", or a short date for anything older than a week. */
export function relativeDay(value) {
    const diff = daysFromToday(value);
    if (diff === null) return '';
    if (diff === 0) return tr('today', 'σήμερα');
    if (diff === -1) return tr('yesterday', 'χθες');
    if (diff === 1) return tr('tomorrow', 'αύριο');
    if (diff < 0 && diff > -7) return tr(`${-diff} days ago`, `πριν από ${-diff} ημέρες`);
    if (diff > 1 && diff < 7) return tr(`in ${diff} days`, `σε ${diff} ημέρες`);
    return shortDate(value);
}

/** "today", "tomorrow" or "on Friday", for sentences about what is coming. */
export function whenPhrase(value) {
    const diff = daysFromToday(value);
    if (diff === 0) return tr('today', 'σήμερα');
    if (diff === 1) return tr('tomorrow', 'αύριο');
    return onWeekday(value);
}

export function countdownLabel(value) {
    const diff = daysFromToday(value);
    if (diff === null) return '';
    if (diff === 0) return tr('Today', 'Σήμερα');
    if (diff === 1) return tr('Tomorrow', 'Αύριο');
    if (diff > 1) return tr(`In ${diff} days`, `Σε ${countWord(diff, DAY_WORDS)}`);
    return tr('Done', 'Πέρασε');
}

export function timeOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'day';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
}

export function greeting(date = new Date()) {
    if (isGreek()) return timeOfDay(date) === 'morning' ? 'Καλημέρα' : 'Καλησπέρα';
    return {
        morning: 'Good morning',
        day: 'Good afternoon',
        evening: 'Good evening',
        night: 'Good evening'
    }[timeOfDay(date)];
}

function isHoliday(date, ranges = []) {
    return (ranges || []).some((range) => {
        const start = toDate(range?.start);
        const end = toDate(range?.end);
        if (!start || !end) return false;
        return startOfDay(date) >= startOfDay(start) && startOfDay(date) <= startOfDay(end);
    });
}

/** The class's next lesson from its weekly days and start time, skipping school holidays. */
export function getNextLesson(snapshot = getSnapshot(), now = new Date()) {
    const days = (snapshot.scheduleDays || []).map(String);
    if (!days.length) return null;
    const holidays = state.get('schoolHolidayRanges') || [];
    const [hours, minutes] = String(snapshot.timeEnd || snapshot.timeStart || '').split(':').map(Number);
    for (let offset = 0; offset < 60; offset += 1) {
        const date = new Date(now);
        date.setDate(now.getDate() + offset);
        if (!days.includes(String(date.getDay()))) continue;
        if (isHoliday(date, holidays)) continue;
        // Today's lesson counts until it ends.
        if (offset === 0 && Number.isFinite(hours)) {
            const end = new Date(now);
            end.setHours(hours, Number.isFinite(minutes) ? minutes : 0, 0, 0);
            if (now > end) continue;
        }
        return { date, inDays: offset, time: snapshot.timeStart || '', timeEnd: snapshot.timeEnd || '' };
    }
    return null;
}

/** Award reasons in words a family understands. */
const REASONS = {
    teamwork: { label: 'Teamwork', el: 'Ομαδικότητα', icon: 'fa-users', tone: 'violet' },
    creativity: { label: 'Creativity', el: 'Δημιουργικότητα', icon: 'fa-lightbulb', tone: 'rose' },
    respect: { label: 'Respect', el: 'Σεβασμός', icon: 'fa-handshake', tone: 'sage' },
    focus: { label: 'Focus', el: 'Συγκέντρωση', icon: 'fa-bullseye', tone: 'amber' },
    excellence: { label: 'Great work', el: 'Εξαιρετική δουλειά', icon: 'fa-star', tone: 'amber' },
    welcome_back: { label: 'Welcome back', el: 'Καλώς ήρθες πίσω', icon: 'fa-door-open', tone: 'sky' },
    story_weaver: { label: 'Story writing', el: 'Γράψιμο ιστορίας', icon: 'fa-book-open', tone: 'violet' },
    vanishing_hoard: { label: 'Focus game', el: 'Παιχνίδι συγκέντρωσης', icon: 'fa-eye', tone: 'amber' },
    torn_map: { label: 'Teamwork game', el: 'Παιχνίδι ομαδικότητας', icon: 'fa-compass', tone: 'violet' },
    round_table: { label: 'Respect game', el: 'Παιχνίδι σεβασμού', icon: 'fa-shield-heart', tone: 'sage' },
    scholar_s_bonus: { label: 'Test result bonus', el: 'Μπόνους διαγωνίσματος', icon: 'fa-graduation-cap', tone: 'amber' },
    teacher_boon: { label: "A gift from the teacher", el: 'Δώρο του εκπαιδευτικού', icon: 'fa-gift', tone: 'rose' },
    peer_boon: { label: 'A gift from a classmate', el: 'Δώρο από συμμαθητή', icon: 'fa-heart', tone: 'rose' },
    pathfinder_map: { label: 'Class adventure', el: 'Περιπέτεια της τάξης', icon: 'fa-map-marked-alt', tone: 'sky' },
    quiz_of_the_week: { label: 'Quiz of the Week', el: 'Κουίζ της εβδομάδας', icon: 'fa-scroll', tone: 'sky' },
    wheel_fortune: { label: "Fortune's Wheel", el: 'Τροχός της Τύχης', icon: 'fa-wand-magic-sparkles', tone: 'amber' },
    special_quest: { label: 'Special Quest', el: 'Ειδική αποστολή', icon: 'fa-wand-magic-sparkles', tone: 'violet' }
};

function localize(meta) {
    return meta && isGreek() && meta.el ? { ...meta, label: meta.el } : meta;
}

export function reasonMeta(reason) {
    return localize(REASONS[String(reason || '').trim()] || { label: 'Star moment', el: 'Στιγμή με αστέρι', icon: 'fa-star', tone: 'amber' });
}

/** Hero classes as a family would describe them. */
const HERO_CLASSES = {
    Guardian: { icon: '🛡️', gift: 'shines at respect', giftEl: 'λάμπει στον σεβασμό' },
    Sage: { icon: '🔮', gift: 'shines at creativity', giftEl: 'λάμπει στη δημιουργικότητα' },
    Paladin: { icon: '⚔️', gift: 'shines at teamwork', giftEl: 'λάμπει στην ομαδικότητα' },
    Artificer: { icon: '⚙️', gift: 'shines at focus', giftEl: 'λάμπει στη συγκέντρωση' },
    Scholar: { icon: '📜', gift: 'shines in tests', giftEl: 'λάμπει στα διαγωνίσματα' },
    [TRAINING_HERO]: { icon: '⚜️', gift: 'shines in the class training games', giftEl: 'λάμπει στα ομαδικά παιχνίδια της τάξης' },
    Nomad: { icon: '👟', gift: 'always comes back stronger', giftEl: 'επιστρέφει πάντα πιο δυνατό' },
    Patron: { icon: '💝', gift: 'shines at kindness to classmates', giftEl: 'λάμπει στην καλοσύνη προς τους συμμαθητές' }
};

export function heroClassMeta(heroClass) {
    const meta = HERO_CLASSES[normalizeHeroClass(heroClass)];
    if (!meta) return null;
    return isGreek() ? { ...meta, gift: meta.giftEl } : meta;
}

// Topics a family can write about. Keys match the server's sendFamilyMessage topics.
const TOPICS = [
    { key: 'question', threadType: 'family-question', label: ['A question', 'Μια ερώτηση'], icon: 'fa-circle-question', tone: 'sky', placeholder: ['What would you like to ask?', 'Τι θα θέλατε να ρωτήσετε;'] },
    { key: 'meeting', threadType: 'meeting-request', label: ['Ask to meet', 'Αίτημα συνάντησης'], icon: 'fa-handshake', tone: 'violet', placeholder: ['When would suit you to talk? Mention a few days and times.', 'Πότε θα σας βόλευε να μιλήσουμε; Γράψτε μερικές μέρες και ώρες.'] },
    { key: 'absence', threadType: 'absence-note', label: ['Absence note', 'Σημείωμα απουσίας'], icon: 'fa-bed', tone: 'rose', placeholder: ['Which lesson will be missed, and why?', 'Ποιο μάθημα θα χαθεί και γιατί;'] },
    { key: 'message', threadType: 'family-message', label: ['Just a note', 'Ένα σημείωμα'], icon: 'fa-feather-pointed', tone: 'sage', placeholder: ['Write your note to the school.', 'Γράψτε το σημείωμά σας προς το σχολείο.'] }
];

/** Topics a family can write about, in the chosen language. */
export function familyTopics() {
    return TOPICS.map((topic) => ({ ...topic, label: tr(...topic.label), placeholder: tr(...topic.placeholder) }));
}

const THREAD_TYPES = {
    'progress-share': { label: 'Progress update', el: 'Ενημέρωση προόδου', icon: 'fa-seedling', tone: 'sage' },
    homework: { label: 'Homework', el: 'Εργασίες', icon: 'fa-book', tone: 'amber' },
    celebration: { label: 'Celebration', el: 'Συγχαρητήρια', icon: 'fa-star', tone: 'amber' },
    'attendance-alert': { label: 'Attendance', el: 'Παρουσίες', icon: 'fa-calendar-xmark', tone: 'rose' },
    'admin-announcement': { label: 'School announcement', el: 'Ανακοίνωση σχολείου', icon: 'fa-bullhorn', tone: 'sky' },
    'school-message': { label: 'Message from school', el: 'Μήνυμα από το σχολείο', icon: 'fa-envelope-open-text', tone: 'sky' },
    'family-question': { label: 'Your question', el: 'Η ερώτησή σας', icon: 'fa-circle-question', tone: 'sky' },
    'meeting-request': { label: 'Meeting', el: 'Συνάντηση', icon: 'fa-handshake', tone: 'violet' },
    'absence-note': { label: 'Absence note', el: 'Σημείωμα απουσίας', icon: 'fa-bed', tone: 'rose' },
    'family-message': { label: 'Your note', el: 'Το σημείωμά σας', icon: 'fa-feather-pointed', tone: 'sage' }
};

export function threadMeta(threadType) {
    return localize(THREAD_TYPES[String(threadType || '').trim().toLowerCase()] || { label: 'Message', el: 'Μήνυμα', icon: 'fa-envelope', tone: 'sky' });
}

export function authorLabel(role) {
    const value = String(role || '').toLowerCase();
    if (value === 'parent') return tr('You', 'Εσείς');
    if (value === 'teacher') return tr('Teacher', 'Εκπαιδευτικός');
    if (value === 'secretary') return tr('School office', 'Γραμματεία');
    return tr('School', 'Σχολείο');
}

export function snapshotAssessmentUses(snapshot) {
    const uses = snapshot?.assessmentUses;
    if (!uses || typeof uses !== 'object') return { tests: true, dictations: true, any: true };
    const tests = uses.tests !== false;
    const dictations = uses.dictations !== false;
    return { tests, dictations, any: tests || dictations };
}

/**
 * Homework bodies end with "Upcoming test: … on …" and "Curriculum: …" lines written by the
 * server. They become a separate test card, so the note itself only keeps the teacher's words.
 */
export function splitHomework(item = {}) {
    const lines = String(item.body || '').split('\n');
    let testTitle = '';
    let curriculum = '';
    const kept = [];
    lines.forEach((line) => {
        const test = line.match(/^Upcoming test:\s*(.+?)\s+on\s+.+?\.?$/i);
        const topics = line.match(/^Curriculum:\s*(.+)$/i);
        if (test) testTitle = test[1].trim();
        else if (topics) curriculum = topics[1].trim();
        else kept.push(line);
    });
    const testDate = item.sourceTestDate || null;
    const title = String(item.title || 'Homework').replace(/^Quest Assignment:\s*/i, '').trim() || 'Homework';
    return {
        title: testDate && testTitle ? 'Homework' : title,
        body: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        test: testDate ? { title: testTitle || title, date: testDate, curriculum } : null,
        setOn: item.publishedAt || item.updatedAt || item.lessonDate
    };
}

// ---- What this device has already seen (per-device convenience only) ----

function seenKey() {
    const studentId = state.get('currentUserProfile')?.linkedStudentId || getSnapshot().studentId || 'family';
    return `gcq_family_seen_v1_${studentId}`;
}

function readSeen() {
    try {
        return JSON.parse(localStorage.getItem(seenKey()) || '{}') || {};
    } catch {
        return {};
    }
}

function writeSeen(next) {
    try {
        localStorage.setItem(seenKey(), JSON.stringify(next));
    } catch {
        /* storage may be blocked; unread marks simply reset */
    }
}

export function isThreadUnread(thread) {
    if (!thread) return false;
    if (String(thread.lastAuthorRole || '').toLowerCase() === 'parent') return false;
    const seenAt = readSeen().threads?.[thread.id] || 0;
    return toMillis(thread.lastMessageAt) > seenAt;
}

export function markThreadSeen(thread) {
    if (!thread?.id) return;
    const seen = readSeen();
    const at = Math.max(toMillis(thread.lastMessageAt), Date.now());
    writeSeen({ ...seen, threads: { ...(seen.threads || {}), [thread.id]: at } });
}

export function unreadThreadCount() {
    return (state.get('currentCommunicationThreads') || []).filter(isThreadUnread).length;
}

export function newestHomework() {
    return (state.get('currentParentHomework') || [])
        .slice()
        .sort((a, b) => toMillis(b.publishedAt || b.updatedAt) - toMillis(a.publishedAt || a.updatedAt))[0] || null;
}

export function isHomeworkNew(item) {
    if (!item) return false;
    const seen = readSeen().homework?.[item.id] || 0;
    return toMillis(item.publishedAt || item.updatedAt) > seen;
}

export function markHomeworkSeen() {
    const items = state.get('currentParentHomework') || [];
    if (!items.length) return;
    const seen = readSeen();
    const homework = { ...(seen.homework || {}) };
    items.forEach((item) => { homework[item.id] = Math.max(toMillis(item.publishedAt || item.updatedAt), Date.now()); });
    writeSeen({ ...seen, homework });
}

let visitBaseline = null;

/**
 * What changed since the previous visit on this device. The baseline is read once per session,
 * then the current numbers are saved for next time.
 */
export function sinceLastVisit(snapshot = getSnapshot()) {
    const seen = readSeen();
    if (!visitBaseline) {
        visitBaseline = seen.visit || null;
    }
    const totalStars = Number(snapshot.progress?.totalStars || 0);
    const latestNote = (snapshot.publishedNotes || [])[0];
    const noteStamp = latestNote ? `${latestNote.createdAt || ''}|${String(latestNote.body || '').length}` : '';
    if (snapshot.studentName) {
        writeSeen({ ...seen, visit: { totalStars, noteStamp, at: Date.now() } });
    }
    if (!visitBaseline) return null;
    return {
        stars: Math.max(0, Math.round((totalStars - Number(visitBaseline.totalStars || 0)) * 10) / 10),
        newNote: Boolean(noteStamp && noteStamp !== visitBaseline.noteStamp),
        at: visitBaseline.at
    };
}

export function resetVisitBaseline() {
    visitBaseline = null;
}
