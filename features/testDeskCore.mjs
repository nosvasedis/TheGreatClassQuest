/**
 * Test Desk (Scholar's Scroll): pure rules that tie a test announced on the Quest Board
 * to the marks logged for it, and list who still owes a makeup.
 *
 * One rule a teacher can say aloud: once a test has marks, it is marked; anyone left
 * out is a makeup. The paper may be logged under a slightly different name than it was
 * announced with ("Unit 7" → "Unit 7 (CPP1)"); marks logged on the test day under a
 * matching name still belong to it.
 *
 * No app state, no DOM: callers pass plain records.
 *   score   { studentId, title, dayKey: 'YYYY-MM-DD', time: ms }
 *   student { id, name, joinedAt: ms | null }
 */

export function normalizePaperTitle(title) {
    return String(title ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** The title without a trailing note in brackets: "unit 7 (cpp1)" → "unit 7". */
function paperCore(normalized) {
    return normalized.replace(/\s*[([{][^)\]}]*[)\]}]\s*$/, '').trim();
}

/** Two normalised titles name the same paper: equal, or one is the other plus a note. */
export function titlesResemble(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ca = paperCore(a);
    const cb = paperCore(b);
    if (ca && cb && ca === cb) return true;
    const startsWithWord = (long, short) => long.startsWith(short) && /^[\s\-–—:([,.]/.test(long.slice(short.length));
    return startsWithWord(a, b) || startsWithWord(b, a);
}

/**
 * Every (normalised) name the announced paper was logged under.
 * Marks logged on the test day count when their title resembles the announced one, or
 * whatever their title when this is the only test announced that day.
 */
export function paperTitlesForScheduledTest({ title, dayKey }, testScores = [], { otherTitlesThatDay = [] } = {}) {
    const announced = normalizePaperTitle(title);
    const others = otherTitlesThatDay.map(normalizePaperTitle).filter((t) => t && t !== announced);
    const titles = new Set(announced ? [announced] : []);
    testScores.forEach((score) => {
        if (score.dayKey !== dayKey) return;
        const t = normalizePaperTitle(score.title);
        if (!t || titles.has(t)) return;
        // Two tests announced that day: only a resembling title can be told apart safely.
        if ((announced && titlesResemble(t, announced)) || others.length === 0) titles.add(t);
    });
    return titles;
}

function endOfDay(dayKey) {
    const [y, m, d] = String(dayKey).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/** The key the dismiss (×) button has always stored in localStorage. */
export function makeupDismissKey(title, studentId, type = 'test') {
    return `${type}-${title}-${studentId}`;
}

/**
 * Tests the class sat that still have a student without a mark.
 * A paper counts once a good part of the class has a mark for it (fewer and the marks
 * are most likely makeups themselves), or when it is linked to an announced test.
 *
 * @param {object} input
 * @param {Array} input.students
 * @param {Array} input.testScores
 * @param {object} [input.dismissed]   makeupDismissKey → true
 * @param {Set<string>} [input.absences] `${studentId}|${dayKey}`
 * @param {number} [input.since]        ms; older papers are ignored
 * @param {Map<string,string>} [input.announced] normalised logged title → announced title
 */
export function buildMakeupGroups({ students = [], testScores = [], dismissed = {}, absences = new Set(), since = 0, announced = new Map() }) {
    const papers = new Map();
    testScores.forEach((score) => {
        const key = normalizePaperTitle(score.title) || 'untitled';
        let paper = papers.get(key);
        if (!paper) {
            paper = { key, title: String(score.title || '').trim() || 'Untitled', dayKey: score.dayKey, time: score.time, studentIds: new Set() };
            papers.set(key, paper);
        }
        if (Number.isFinite(score.time) && score.time < paper.time) {
            paper.time = score.time;
            paper.dayKey = score.dayKey;
        }
        paper.studentIds.add(score.studentId);
    });

    const threshold = Math.max(2, Math.floor(students.length * 0.3));
    const groups = [];
    papers.forEach((paper) => {
        const linked = announced.get(paper.key) || '';
        if (!linked && paper.studentIds.size < threshold) return;
        if (!(paper.time >= since)) return;
        const dayEnd = endOfDay(paper.dayKey);
        const eligible = students.filter((s) => !(Number.isFinite(s.joinedAt) && dayEnd !== null && s.joinedAt > dayEnd));
        const missing = eligible
            .filter((s) => !paper.studentIds.has(s.id))
            .filter((s) => !dismissed[makeupDismissKey(paper.title, s.id)])
            .map((s) => ({ student: s, absent: absences.has(`${s.id}|${paper.dayKey}`) }))
            .sort((a, b) => String(a.student.name).localeCompare(String(b.student.name)));
        if (!missing.length) return;
        const sat = eligible.filter((s) => paper.studentIds.has(s.id)).length;
        groups.push({
            key: paper.key,
            title: paper.title,
            announcedAs: linked && normalizePaperTitle(linked) !== paper.key ? linked : '',
            dayKey: paper.dayKey,
            time: paper.time,
            sat,
            expected: sat + missing.length,
            missing
        });
    });
    return groups.sort((a, b) => b.time - a.time);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The line on the Test Desk bar: what is waiting, in one breath.
 * @param {{ toMark?: boolean, upcoming?: boolean, makeups?: number }} counts
 */
export function testDeskSummary({ toMark = false, upcoming = false, makeups = 0 } = {}) {
    const parts = [];
    if (toMark) parts.push('1 test to mark');
    else if (upcoming) parts.push('1 test coming up');
    if (makeups > 0) parts.push(`${plural(makeups, 'makeup')} to log`);
    return parts.join(' · ') || 'All marked';
}

/** "6 of 7 marked" and how full the meter is (0–100). */
export function paperProgress(sat, expected) {
    const total = Math.max(expected, sat, 0);
    return {
        label: `${sat} of ${total} marked`,
        percent: total ? Math.round((sat / total) * 100) : 0
    };
}
