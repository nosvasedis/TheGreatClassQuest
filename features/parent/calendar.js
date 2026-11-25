// features/parent/calendar.js — the next two weeks at a glance: lesson days, test days and school holidays
import { describeSchoolDay, upcomingSchoolDays, isoOf } from '../../utils/schoolCalendar.mjs';
import { escapeHtml, getSnapshot, familyHomework, toDate, splitHomework, shortDate, monthShort, tr, isGreek } from './helpers.js';

const DAYS_SHOWN = 14;
const WEEKDAY_LETTERS = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    el: ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ']
};

function holidayName(special, range) {
    if (isGreek() && special?.nameEl) return special.nameEl;
    return special?.name || range?.name || tr('School holiday', 'Σχολική αργία');
}

/** Upcoming test dates from the homework feed, keyed by YYYY-MM-DD. */
function testsByDay() {
    const map = new Map();
    familyHomework().forEach((item) => {
        const test = splitHomework(item).test;
        const date = test ? toDate(test.date) : null;
        if (date) map.set(isoOf(date), test.title);
    });
    return map;
}

/** Fourteen day cells from today: what happens on each one. */
export function buildFortnight(snapshot = getSnapshot(), now = new Date()) {
    const lessonDays = new Set((snapshot.scheduleDays || []).map(String));
    const tests = testsByDay();
    // A lesson that didn't happen, and its make-up (functions/index.js familyLessonChangesFrom).
    const changes = new Map((Array.isArray(snapshot.lessonChanges) ? snapshot.lessonChanges : []).map((c) => [c.date, c]));
    const cells = [];
    for (let offset = 0; offset < DAYS_SHOWN; offset += 1) {
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        date.setDate(now.getDate() + offset);
        const iso = isoOf(date);
        const info = describeSchoolDay(iso);
        const closed = Boolean(info.closure);
        const change = changes.get(iso) || null;
        const cancelled = change?.kind === 'cancelled';
        const makeup = change?.kind === 'makeup' || change?.kind === 'extra' ? change : null;
        const lesson = Boolean(makeup) || (!closed && !cancelled && lessonDays.has(String(date.getDay())));
        cells.push({
            iso,
            date,
            offset,
            lesson,
            cancelled: cancelled && !closed ? change : null,
            makeup,
            closed,
            holiday: closed ? holidayName(info.headline, info.closure) : '',
            holidayIcon: closed ? (info.headline?.icon || '🏖️') : '',
            test: tests.get(iso) || ''
        });
    }
    return cells;
}

function cellLabel(cell, snapshot) {
    const parts = [shortDate(cell.date)];
    if (cell.offset === 0) parts.unshift(tr('Today', 'Σήμερα'));
    const at = cell.makeup?.timeStart || snapshot.timeStart;
    if (cell.closed && !cell.makeup) parts.push(cell.holiday);
    else if (cell.makeup?.kind === 'makeup') parts.push(tr(`Make-up lesson${at ? ` at ${at}` : ''}`, `Αναπλήρωση μαθήματος${at ? ` στις ${at}` : ''}`));
    else if (cell.cancelled) parts.push(tr('No lesson', 'Δεν γίνεται μάθημα'));
    else if (cell.lesson) parts.push(tr(`Lesson${at ? ` at ${at}` : ''}`, `Μάθημα${at ? ` στις ${at}` : ''}`));
    if (cell.test) parts.push(tr(`Test: ${cell.test}`, `Διαγώνισμα: ${cell.test}`));
    if (!cell.closed && !cell.lesson && !cell.test && !cell.cancelled) parts.push(tr('No lesson', 'Χωρίς μάθημα'));
    return parts.join(' · ');
}

/** The notice above the strip: a holiday going on now, or one starting soon. */
function renderHolidayNotice() {
    const { holiday } = upcomingSchoolDays(new Date(), { holidayDays: 10, celebrationDays: 0 });
    if (!holiday) return '';
    const name = holidayName(holiday.special, holiday.range);
    const end = toDate(holiday.range.end);
    const start = toDate(holiday.range.start);
    let line;
    if (holiday.phase === 'today') {
        line = holiday.singleDay
            ? tr('No lessons today.', 'Δεν γίνονται μαθήματα σήμερα.')
            : tr(`No lessons until ${shortDate(end)}.`, `Δεν γίνονται μαθήματα έως ${shortDate(end)}.`);
    } else {
        line = holiday.singleDay
            ? tr(`No lessons on ${shortDate(start)}.`, `Δεν γίνονται μαθήματα ${shortDate(start)}.`)
            : tr(`No lessons from ${shortDate(start)} to ${shortDate(end)}.`, `Δεν γίνονται μαθήματα από ${shortDate(start)} έως ${shortDate(end)}.`);
    }
    const soon = holiday.phase === 'today' ? tr('Holiday', 'Αργία') : (holiday.inDays === 1 ? tr('Tomorrow', 'Αύριο') : tr(`In ${holiday.inDays} days`, `Σε ${holiday.inDays} ημέρες`));
    return `
        <p class="fp-holiday" role="note">
            <span class="fp-holiday__icon" aria-hidden="true">${escapeHtml(holiday.special?.icon || '🏖️')}</span>
            <span class="fp-holiday__copy">
                <span class="fp-holiday__name">${escapeHtml(name)} <em>${escapeHtml(soon)}</em></span>
                <span class="fp-holiday__line">${escapeHtml(line)}</span>
            </span>
        </p>`;
}

/** The notice above the strip: a lesson that won't happen (or didn't), and its make-up. */
function renderLessonChangeNotice(cells, snapshot) {
    const today = cells[0]?.iso || '';
    const all = Array.isArray(snapshot.lessonChanges) ? snapshot.lessonChanges : [];
    // The nearest change still worth telling: an upcoming make-up, or a coming lesson that won't run.
    const makeup = all.find((c) => c.kind === 'makeup' && c.date >= today);
    const cancelled = all.find((c) => c.kind === 'cancelled' && c.date >= today && !c.makeupDate);
    const pick = makeup || cancelled;
    if (!pick) return '';
    const day = (iso) => shortDate(toDate(iso));
    let title;
    let line;
    if (pick.kind === 'makeup') {
        const at = pick.timeStart || snapshot.timeStart;
        title = pick.date === today ? tr('Make-up lesson today', 'Αναπλήρωση σήμερα') : tr('Make-up lesson', 'Αναπλήρωση μαθήματος');
        line = pick.makeupFor
            ? tr(`The lesson of ${day(pick.makeupFor)} takes place on ${day(pick.date)}${at ? ` at ${at}` : ''}.`, `Το μάθημα της ${day(pick.makeupFor)} γίνεται ${day(pick.date)}${at ? ` στις ${at}` : ''}.`)
            : tr(`Extra lesson on ${day(pick.date)}${at ? ` at ${at}` : ''}.`, `Επιπλέον μάθημα ${day(pick.date)}${at ? ` στις ${at}` : ''}.`);
    } else {
        title = tr('No lesson', 'Δεν γίνεται μάθημα');
        line = tr(`There is no lesson on ${day(pick.date)}. We will let you know the make-up day.`, `Δεν γίνεται μάθημα ${day(pick.date)}. Θα σας ενημερώσουμε για την αναπλήρωση.`);
    }
    return `
        <p class="fp-holiday fp-holiday--lesson-change" role="note">
            <span class="fp-holiday__icon" aria-hidden="true">${pick.kind === 'makeup' ? '🔁' : '📅'}</span>
            <span class="fp-holiday__copy">
                <span class="fp-holiday__name">${escapeHtml(title)}</span>
                <span class="fp-holiday__line">${escapeHtml(line)}</span>
            </span>
        </p>`;
}

/** Home: a ribbon of fourteen days the family can swipe through. */
export function renderFortnight() {
    const snapshot = getSnapshot();
    if (!snapshot.studentName) return '';
    const cells = buildFortnight(snapshot);
    const lang = isGreek() ? 'el' : 'en';
    const lessons = cells.filter((cell) => cell.lesson).length;
    const firstMonth = monthShort(cells[0].date);
    const lastMonth = monthShort(cells[cells.length - 1].date);
    return `
        <article class="fp-card fp-fortnight fp-rise" style="--fp-delay:2" aria-labelledby="fp-fortnight-title">
            <div class="fp-card__row">
                <div>
                    <p class="fp-kicker">${tr('The next two weeks', 'Οι επόμενες δύο εβδομάδες')}</p>
                    <h3 class="fp-card__title" id="fp-fortnight-title">${lessons
                        ? tr(`${lessons} lesson${lessons === 1 ? '' : 's'} coming up`, `${lessons} ${lessons === 1 ? 'μάθημα' : 'μαθήματα'} μπροστά`)
                        : tr('No lessons in the next two weeks', 'Χωρίς μαθήματα τις επόμενες δύο εβδομάδες')}</h3>
                </div>
                <span class="fp-pill fp-pill--quiet">${escapeHtml(firstMonth === lastMonth ? firstMonth : `${firstMonth}–${lastMonth}`)}</span>
            </div>
            ${renderLessonChangeNotice(cells, snapshot)}
            ${renderHolidayNotice()}
            <ol class="fp-days" aria-label="${tr('Day by day', 'Μέρα με τη μέρα')}">
                ${cells.map((cell) => {
                    const classes = ['fp-day'];
                    if (cell.offset === 0) classes.push('is-today');
                    if (cell.lesson) classes.push('is-lesson');
                    if (cell.closed && !cell.makeup) classes.push('is-closed');
                    if (cell.cancelled) classes.push('is-cancelled');
                    if (cell.makeup) classes.push('is-makeup');
                    if (cell.test) classes.push('is-test');
                    if ([0, 6].includes(cell.date.getDay())) classes.push('is-weekend');
                    return `
                        <li class="${classes.join(' ')}" aria-label="${escapeHtml(cellLabel(cell, snapshot))}">
                            <span class="fp-day__name" aria-hidden="true">${WEEKDAY_LETTERS[lang][cell.date.getDay()]}</span>
                            <span class="fp-day__num" aria-hidden="true">${cell.date.getDate()}</span>
                            <span class="fp-day__mark" aria-hidden="true">${cell.makeup
                                ? '<i class="fas fa-rotate"></i>'
                                : cell.closed
                                ? `<span class="fp-day__emoji">${escapeHtml(cell.holidayIcon)}</span>`
                                : cell.cancelled ? '<i class="fas fa-ban"></i>'
                                : cell.test ? '<i class="fas fa-pen-clip"></i>'
                                    : cell.lesson ? '<i class="fas fa-bell"></i>' : ''}</span>
                        </li>`;
                }).join('')}
            </ol>
            <p class="fp-days__key" aria-hidden="true">
                <span><span class="fp-days__key-today"></span> ${tr('Today', 'Σήμερα')}</span>
                <span><i class="fas fa-bell"></i> ${tr('Lesson', 'Μάθημα')}${snapshot.timeStart ? ` ${escapeHtml(snapshot.timeStart)}` : ''}</span>
                <span><i class="fas fa-pen-clip"></i> ${tr('Test', 'Διαγώνισμα')}</span>
                <span><span class="fp-days__key-dot"></span> ${tr('Holiday', 'Αργία')}</span>
            </p>
        </article>`;
}
