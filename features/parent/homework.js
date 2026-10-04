// features/parent/homework.js — homework pinned to the family fridge
import * as state from '../../state.js';
import {
    escapeHtml,
    getSnapshot,
    firstName,
    splitHomework,
    shortDate,
    relativeDay,
    countdownLabel,
    daysFromToday,
    monthShort,
    toDate,
    toMillis,
    isHomeworkNew,
    getNextLesson,
    onWeekday,
    tr,
    isGreek
} from './helpers.js';

function sortedHomework() {
    return (state.get('currentParentHomework') || [])
        .slice()
        .sort((a, b) => toMillis(b.publishedAt || b.updatedAt) - toMillis(a.publishedAt || a.updatedAt));
}

function renderTestCard(item, test) {
    const diff = daysFromToday(test.date);
    const upcoming = diff !== null && diff >= 0;
    const date = toDate(test.date);
    return `
        <div class="fp-test${upcoming ? '' : ' fp-test--past'}">
            <span class="fp-leaf fp-leaf--violet" aria-hidden="true">
                <span class="fp-leaf__month">${escapeHtml(monthShort(test.date))}</span>
                <span class="fp-leaf__day">${date ? date.getDate() : '–'}</span>
            </span>
            <div class="fp-test__copy">
                <p class="fp-kicker">${upcoming ? tr('Test coming up', 'Έρχεται διαγώνισμα') : tr('Test', 'Διαγώνισμα')}</p>
                <p class="fp-test__title">${escapeHtml(test.title)}</p>
                <p class="fp-test__when">${escapeHtml(shortDate(test.date))}${upcoming ? ` · <strong>${escapeHtml(countdownLabel(test.date))}</strong>` : ''}</p>
                ${test.curriculum ? `<p class="fp-test__topics"><i class="fas fa-list-check" aria-hidden="true"></i> ${escapeHtml(test.curriculum)}</p>` : ''}
            </div>
            ${upcoming ? `<button type="button" class="fp-btn fp-btn--soft fp-test__cal" data-parent-ics="${escapeHtml(item.id)}"><i class="fas fa-calendar-plus" aria-hidden="true"></i> ${tr('Add to calendar', 'Στο ημερολόγιο')}</button>` : ''}
        </div>`;
}

function renderNote(item, { main = false } = {}) {
    const parts = splitHomework(item);
    // The current note is titled by the lesson it is for, the way a family would say it.
    if (main && parts.title === 'Homework') {
        const lesson = getNextLesson(getSnapshot());
        if (lesson) {
            parts.title = lesson.inDays === 0 ? tr('For today', 'Για σήμερα')
                : lesson.inDays === 1 ? tr('For tomorrow', 'Για αύριο')
                    : tr(`For ${onWeekday(lesson.date).replace(/^on /, '')}`, `Για ${onWeekday(lesson.date)}`);
        }
    }
    if (parts.title === 'Homework') parts.title = tr('Homework', 'Εργασία για το σπίτι');
    const isNew = isHomeworkNew(item);
    return `
        <article class="fp-note${main ? ' fp-note--main' : ''} fp-rise" style="--fp-delay:${main ? 1 : 2}">
            <span class="fp-note__magnet" aria-hidden="true"></span>
            <header class="fp-note__head">
                <h3 class="fp-note__title">${escapeHtml(parts.title)}</h3>
                ${isNew ? `<span class="fp-new-tag">${tr('New', 'Νέο')}</span>` : ''}
            </header>
            <p class="fp-note__date"><i class="fas fa-thumbtack" aria-hidden="true"></i> ${tr('Set', 'Δόθηκε')} ${escapeHtml(relativeDay(parts.setOn))}${parts.setOn ? ` · ${escapeHtml(shortDate(parts.setOn))}` : ''}</p>
            ${parts.body ? `<div class="fp-note__body">${escapeHtml(parts.body)}</div>` : ''}
            ${parts.test ? renderTestCard(item, parts.test) : ''}
        </article>`;
}

export function renderParentHomework() {
    const items = sortedHomework();
    const name = firstName(getSnapshot().studentName);
    const [current, ...earlier] = items;
    return `
        <header class="fp-pagehead fp-rise">
            <span class="fp-pagehead__icon fp-pagehead__icon--amber" aria-hidden="true"><i class="fas fa-book-open"></i></span>
            <div>
                <h2 class="fp-pagehead__title">${tr('Homework', 'Εργασίες')}</h2>
                <p class="fp-pagehead__sub">${isGreek() ? 'Τι χρειάζεται να γίνει πριν από το επόμενο μάθημα.' : `What ${escapeHtml(name)} needs to do before the next lesson.`}</p>
            </div>
        </header>
        <div class="fp-fridge">
            ${current ? renderNote(current, { main: true }) : `
                <div class="fp-note fp-note--empty fp-rise">
                    <span class="fp-note__magnet" aria-hidden="true"></span>
                    <h3 class="fp-note__title">${tr('Nothing pinned yet', 'Τίποτα καρφιτσωμένο ακόμη')}</h3>
                    <p class="fp-note__body">${tr('When the teacher sets homework after a lesson, it appears here.', 'Όταν δοθεί εργασία μετά το μάθημα, θα εμφανιστεί εδώ.')}</p>
                </div>`}
            ${earlier.length ? `
                <p class="fp-section-label">${tr('Earlier', 'Παλαιότερες')}</p>
                ${earlier.map((item) => renderNote(item)).join('')}` : ''}
        </div>
        <p class="fp-tip"><i class="fas fa-lightbulb" aria-hidden="true"></i> ${isGreek()
            ? 'Λίγα ήρεμα λεπτά κάθε μέρα αξίζουν περισσότερο από ένα μεγάλο απόγευμα διαβάσματος. Ζητήστε από το παιδί σας να σας εξηγήσει την εργασία στα αγγλικά.'
            : `A few calm minutes a day beats one long evening. Ask ${escapeHtml(name)} to explain the task to you in English.`}</p>`;
}

function icsDate(date) {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function icsText(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
}

/** Downloads an all-day calendar event for the homework's test. */
export function downloadTestCalendarEvent(homeworkId) {
    const item = (state.get('currentParentHomework') || []).find((entry) => entry.id === homeworkId);
    const test = item ? splitHomework(item).test : null;
    const date = test ? toDate(test.date) : null;
    if (!date) return false;
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    const snapshot = getSnapshot();
    const summary = `${firstName(snapshot.studentName)}: ${test.title}`;
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//The Great Class Quest//Family Portal//EN',
        'BEGIN:VEVENT',
        `UID:${icsText(`${homeworkId}-${icsDate(date)}`)}@greatclassquest`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
        `DTSTART;VALUE=DATE:${icsDate(date)}`,
        `DTEND;VALUE=DATE:${icsDate(next)}`,
        `SUMMARY:${icsText(summary)}`,
        `DESCRIPTION:${icsText([snapshot.className, test.curriculum].filter(Boolean).join('\n'))}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15H',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsText(summary)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${test.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'test'}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
}
