// features/parent/home.js — the Family Portal's Home: this week at a glance
import { normalizeHeroClass } from '../heroClassNames.mjs';
import * as state from '../../state.js';
import { getGuildById } from '../guilds.js';
import {
    escapeHtml,
    getSnapshot,
    firstName,
    initials,
    greeting,
    timeOfDay,
    getNextLesson,
    weekdayName,
    shortDate,
    monthShort,
    relativeDay,
    countdownLabel,
    daysFromToday,
    toDate,
    reasonMeta,
    heroClassMeta,
    splitHomework,
    snapshotAssessmentUses,
    newestHomework,
    isHomeworkNew,
    unreadThreadCount,
    sinceLastVisit,
    whenPhrase
} from './helpers.js';
import { tr, bi, isGreek, countWord, STAR_WORDS, gameName } from './i18n.js';
import { renderFortnight } from './calendar.js';
import { renderInstallCard } from './phone.js';
import { renderHomeTip } from './tips.js';
import { renderJarArt } from './starJar.js';

function formatStars(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function stars(n) {
    return countWord(n, STAR_WORDS, formatStars);
}

function lessonPhrase(lesson) {
    if (!lesson) return '';
    const when = whenPhrase(lesson.date);
    return tr(
        `The next lesson is ${when}${lesson.time ? ` at ${lesson.time}` : ''}.`,
        `Το επόμενο μάθημα είναι ${when}${lesson.time ? ` στις ${lesson.time}` : ''}.`
    );
}

function buildSummary(snapshot, name, lesson, test) {
    const progress = snapshot.progress || {};
    const week = Number(snapshot.weekStars || 0);
    const month = Number(progress.monthlyStars || 0);
    const sentences = [];
    // Greek sentences leave the child's name out: the verb carries it, and no article has to guess a gender.
    if (week > 0) {
        sentences.push(tr(
            `${name} earned ${stars(week)} this week${month > week ? `, and ${formatStars(month)} so far this month` : ''}.`,
            `Αυτή την εβδομάδα κέρδισε ${stars(week)}${month > week ? `, και ${formatStars(month)} συνολικά αυτόν τον μήνα` : ''}.`
        ));
    } else if (month > 0) {
        sentences.push(tr(`${name} has ${stars(month)} so far this month.`, `Αυτόν τον μήνα έχει ήδη ${stars(month)}.`));
    } else {
        sentences.push(tr(`A new month of stars is beginning for ${name}.`, 'Ένας καινούργιος μήνας με αστέρια μόλις ξεκινά.'));
    }
    if (test && daysFromToday(test.date) >= 0) {
        sentences.push(tr(`There is a test ${whenPhrase(test.date)}.`, `Έχει διαγώνισμα ${whenPhrase(test.date)}.`));
    }
    const latest = snapshot.latestGrade;
    if (latest?.label && snapshotAssessmentUses(snapshot).any) {
        const isDictation = latest.type === 'dictation' && (!latest.title || latest.title === 'dictation');
        const title = isDictation ? tr('dictation', 'ορθογραφία') : latest.title;
        // "?" is what the teacher writes when a paper could not be marked at all.
        const unmarkable = latest.label === '?';
        // "18 / 20" stays on one line.
        const label = String(latest.label).replace(/ \/ /g, '\u00a0/\u00a0');
        sentences.push(unmarkable ? tr(
            `The latest ${title ? `result (${title})` : 'result'} could not be marked.`,
            `Ο τελευταίος βαθμός${title ? ` (${title})` : ''} δεν μπόρεσε να βαθμολογηθεί.`
        ) : tr(
            `Latest ${title ? `result (${title})` : 'result'}: ${label}.`,
            `Τελευταίος βαθμός${title ? ` (${title})` : ''}: ${label}.`
        ));
    }
    const lessonLine = lessonPhrase(lesson);
    if (lessonLine) sentences.push(lessonLine);
    return sentences.join(' ');
}

function renderNews(snapshot, homework) {
    const since = sinceLastVisit(snapshot);
    const chips = [];
    if (since?.stars > 0) {
        chips.push({ tab: 'progress', icon: 'fa-star', tone: 'amber', text: `+${stars(since.stars)}` });
    }
    if (homework && isHomeworkNew(homework)) {
        chips.push({ tab: 'homework', icon: 'fa-book-open', tone: 'sage', text: tr('New homework', 'Νέα εργασία') });
    }
    const unread = unreadThreadCount();
    if (unread) {
        chips.push({ tab: 'messages', icon: 'fa-envelope', tone: 'rose', text: tr(`${unread} new message${unread === 1 ? '' : 's'}`, `${unread} ${unread === 1 ? 'νέο μήνυμα' : 'νέα μηνύματα'}`) });
    }
    if (since?.newNote) {
        chips.push({ tab: 'home-note', icon: 'fa-feather-pointed', tone: 'violet', text: tr('New note from the teacher', 'Νέο σημείωμα από την τάξη') });
    }
    if (!chips.length) {
        return `<p class="fp-news fp-news--calm"><i class="fas fa-circle-check" aria-hidden="true"></i> ${tr('You are all caught up.', 'Τα έχετε δει όλα.')}</p>`;
    }
    return `
        <div class="fp-news" aria-label="${tr('New since your last visit', 'Νέα από την τελευταία σας επίσκεψη')}">
            <span class="fp-news__lead">${tr('New since your last visit', 'Νέα από την τελευταία σας επίσκεψη')}</span>
            ${chips.map((chip) => `
                <button type="button" class="fp-chip fp-chip--${chip.tone}" ${chip.tab === 'home-note' ? 'data-parent-scroll="fp-latest-note"' : `data-parent-tab-link="${chip.tab}"`}>
                    <i class="fas ${chip.icon}" aria-hidden="true"></i>${escapeHtml(chip.text)}
                </button>`).join('')}
        </div>`;
}

function calendarLeaf(date, tone = 'rose') {
    return `
        <span class="fp-leaf fp-leaf--${tone}" aria-hidden="true">
            <span class="fp-leaf__month">${escapeHtml(monthShort(date))}</span>
            <span class="fp-leaf__day">${toDate(date)?.getDate() || '–'}</span>
        </span>`;
}

function renderNextLessonTile(lesson) {
    if (!lesson) {
        return `
            <div class="fp-tile">
                <span class="fp-leaf fp-leaf--sage" aria-hidden="true"><span class="fp-leaf__month">${tr('Class', 'Τάξη')}</span><span class="fp-leaf__day"><i class="fas fa-school"></i></span></span>
                <div class="fp-tile__copy">
                    <p class="fp-tile__kicker">${tr('Next lesson', 'Επόμενο μάθημα')}</p>
                    <p class="fp-tile__title">${bi('Timetable coming soon', 'Το πρόγραμμα έρχεται σύντομα')}</p>
                    <p class="fp-tile__meta">${tr('The school will add the lesson days.', 'Το σχολείο θα προσθέσει τις μέρες των μαθημάτων.')}</p>
                </div>
            </div>`;
    }
    return `
        <div class="fp-tile">
            ${calendarLeaf(lesson.date, 'sage')}
            <div class="fp-tile__copy">
                <p class="fp-tile__kicker">${tr('Next lesson', 'Επόμενο μάθημα')}</p>
                <p class="fp-tile__title">${escapeHtml(weekdayName(lesson.date))}${lesson.time ? ` · ${escapeHtml(lesson.time)}` : ''}</p>
                <p class="fp-tile__meta">${escapeHtml(countdownLabel(lesson.date))}${lesson.timeEnd ? ` · ${tr('until', 'έως')} ${escapeHtml(lesson.timeEnd)}` : ''}</p>
            </div>
        </div>`;
}

function renderSecondTile(homework, parts) {
    if (parts?.test && daysFromToday(parts.test.date) >= 0) {
        return `
            <button type="button" class="fp-tile fp-tile--link" data-parent-tab-link="homework">
                ${calendarLeaf(parts.test.date, 'violet')}
                <div class="fp-tile__copy">
                    <p class="fp-tile__kicker">${tr('Test day', 'Διαγώνισμα')}</p>
                    <p class="fp-tile__title">${escapeHtml(parts.test.title)}</p>
                    <p class="fp-tile__meta">${escapeHtml(countdownLabel(parts.test.date))} · ${escapeHtml(shortDate(parts.test.date))}</p>
                </div>
            </button>`;
    }
    if (homework) {
        return `
            <button type="button" class="fp-tile fp-tile--link" data-parent-tab-link="homework">
                <span class="fp-leaf fp-leaf--amber" aria-hidden="true"><span class="fp-leaf__month">${tr('Home', 'Σπίτι')}</span><span class="fp-leaf__day"><i class="fas fa-pencil"></i></span></span>
                <div class="fp-tile__copy">
                    <p class="fp-tile__kicker">${tr('Homework', 'Εργασία')}</p>
                    <p class="fp-tile__title">${escapeHtml(parts.title === 'Homework' ? tr('Homework', 'Εργασία για το σπίτι') : parts.title)}</p>
                    <p class="fp-tile__meta">${tr('Set', 'Δόθηκε')} ${escapeHtml(relativeDay(parts.setOn))}</p>
                </div>
            </button>`;
    }
    return `
        <div class="fp-tile">
            <span class="fp-leaf fp-leaf--amber" aria-hidden="true"><span class="fp-leaf__month">${tr('Home', 'Σπίτι')}</span><span class="fp-leaf__day"><i class="fas fa-pencil"></i></span></span>
            <div class="fp-tile__copy">
                <p class="fp-tile__kicker">${tr('Homework', 'Εργασία')}</p>
                <p class="fp-tile__title">${bi('Nothing set yet', 'Δεν έχει δοθεί ακόμη')}</p>
                <p class="fp-tile__meta">${tr('It appears here after a lesson.', 'Εμφανίζεται εδώ μετά το μάθημα.')}</p>
            </div>
        </div>`;
}

function renderStarJar(snapshot, name) {
    const progress = snapshot.progress || {};
    const month = Number(progress.monthlyStars || 0);
    const history = Array.isArray(snapshot.starsHistory) ? snapshot.starsHistory : [];
    const best = history.reduce((top, item) => (Number(item.stars) > Number(top?.stars || 0) ? item : top), null);
    const { svg, legend, split } = renderJarArt(snapshot, `${stars(month)} ${tr('this month', 'αυτόν τον μήνα')}`);
    const bestLine = best && Number(best.stars) > 0
        ? tr(`Best month so far: ${escapeHtml(monthShort(`${best.month}-01`))} with ${formatStars(best.stars)}.`,
            `Καλύτερος μήνας ως τώρα: ${escapeHtml(monthShort(`${best.month}-01`))} με ${formatStars(best.stars)}.`)
        : '';
    const howLine = month > 0
        ? (split.coloured
            ? tr('One star in the jar for every star this month, in the colour of the skill it was earned for.', 'Ένα αστέρι στο βάζο για κάθε αστέρι του μήνα, στο χρώμα της δεξιότητας που το κέρδισε.')
            : tr('One star in the jar for every star this month.', 'Ένα αστέρι στο βάζο για κάθε αστέρι του μήνα.'))
        : tr('The first star of the month will land here.', 'Το πρώτο αστέρι του μήνα θα πέσει εδώ.');
    return `
        <article class="fp-card fp-jar-card fp-rise${month > 0 ? '' : ' is-empty'}" style="--fp-delay:3">
            <div class="fp-jar-card__art">${svg}</div>
            <div class="fp-jar-card__copy">
                <p class="fp-kicker">${tr('The star jar', 'Το βάζο με τα αστέρια')}</p>
                <p class="fp-jar-card__big"><strong>${formatStars(month)}</strong> ${tr(month === 1 ? 'star' : 'stars', month === 1 ? 'αστέρι' : 'αστέρια')} ${tr('this month', 'αυτόν τον μήνα')}</p>
                <div class="fp-jar-card__facts">
                    <span><i class="fas fa-calendar-week" aria-hidden="true"></i>${formatStars(snapshot.weekStars || 0)} ${tr('this week', 'αυτή την εβδομάδα')}</span>
                    <span><i class="fas fa-star" aria-hidden="true"></i>${formatStars(progress.totalStars || 0)} ${tr('this year', 'φέτος')}</span>
                </div>
                <p class="fp-jar-card__note">${howLine}${bestLine ? ` ${bestLine}` : ''}</p>
            </div>
            ${legend}
            <button type="button" class="fp-link fp-jar-card__more" data-parent-tab-link="progress">${isGreek() ? 'Δείτε όλη την πρόοδο' : `See ${escapeHtml(name)}'s progress`} <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
        </article>`;
}

function noteLabel(note) {
    if (note?.source === 'ember_oath') return tr('A promise kept', 'Μια υπόσχεση που τηρήθηκε');
    if (!note?.label || note.label === 'Parent Summary') return tr('A note from the teacher', 'Ένα σημείωμα από την τάξη');
    return note.label;
}

function renderLetter(snapshot) {
    const notes = Array.isArray(snapshot.publishedNotes) ? snapshot.publishedNotes.filter((note) => note?.body || note?.text) : [];
    if (!notes.length) return '';
    const [latest, ...earlier] = notes;
    const hasThread = (state.get('currentCommunicationThreads') || []).some((thread) => thread.threadType === 'progress-share');
    return `
        <article class="fp-card fp-letter fp-rise" id="fp-latest-note" style="--fp-delay:4">
            <p class="fp-kicker"><i class="fas fa-feather-pointed" aria-hidden="true"></i> ${escapeHtml(noteLabel(latest))}</p>
            <blockquote class="fp-letter__body">${escapeHtml(latest.body || latest.text || '')}</blockquote>
            <div class="fp-letter__foot">
                <span class="fp-letter__sign">${escapeHtml(snapshot.teacherName ? `${snapshot.teacherName}` : tr('Your child’s teacher', 'Ο/η εκπαιδευτικός της τάξης'))}${latest.createdAt ? ` · ${escapeHtml(relativeDay(latest.createdAt))}` : ''}</span>
                <button type="button" class="fp-btn fp-btn--soft" data-parent-reply="${hasThread ? 'progress-share' : 'new'}"><i class="fas fa-reply" aria-hidden="true"></i> ${tr('Reply', 'Απάντηση')}</button>
            </div>
            ${earlier.length ? `
                <details class="fp-letter__earlier">
                    <summary>${tr('Earlier notes', 'Παλαιότερα σημειώματα')} (${earlier.length})</summary>
                    ${earlier.map((note) => `
                        <div class="fp-letter__old">
                            <p class="fp-letter__old-label">${escapeHtml(noteLabel(note))}${note.createdAt ? ` · ${escapeHtml(shortDate(note.createdAt))}` : ''}</p>
                            <p>${escapeHtml(note.body || note.text || '')}</p>
                        </div>`).join('')}
                </details>` : ''}
        </article>`;
}

function renderMoments(snapshot, name) {
    const moments = (snapshot.recentCelebrations || []).filter((item) => Number(item.stars ?? 1) > 0).slice(0, 4);
    return `
        <article class="fp-card fp-moments-card fp-rise" style="--fp-delay:5">
            <p class="fp-kicker">${tr('Star moments', 'Στιγμές με αστέρια')}</p>
            <h3 class="fp-card__title">${isGreek() ? 'Γιατί κέρδισε αστέρια' : `Why ${escapeHtml(name)} earned stars`}</h3>
            ${moments.length ? `
                <ul class="fp-moments">
                    ${moments.map((item) => {
                        const meta = reasonMeta(item.reason || item.title);
                        const note = item.note || (item.description && !/stars? awarded$/i.test(item.description) ? item.description : '');
                        return `
                            <li class="fp-moment">
                                <span class="fp-bubble fp-bubble--${meta.tone}"><i class="fas ${meta.icon}" aria-hidden="true"></i></span>
                                <span class="fp-moment__copy">
                                    <span class="fp-moment__title">${escapeHtml(meta.label)}</span>
                                    ${note ? `<span class="fp-moment__note">${escapeHtml(note)}</span>` : ''}
                                </span>
                                <span class="fp-moment__side">
                                    ${item.stars ? `<span class="fp-moment__stars">+${formatStars(item.stars)} <i class="fas fa-star" aria-hidden="true"></i></span>` : ''}
                                    <span class="fp-moment__when">${escapeHtml(relativeDay(item.date))}</span>
                                </span>
                            </li>`;
                    }).join('')}
                </ul>` : `<p class="fp-empty-line">${tr('Stars from class will show up here with the reason they were given.', 'Τα αστέρια της τάξης θα εμφανίζονται εδώ μαζί με τον λόγο που δόθηκαν.')}</p>`}
        </article>`;
}

/** Three big, plainly named doors for the things families come to do most. */
function renderQuickActions() {
    const actions = [
        { attrs: 'data-parent-tab-link="homework"', icon: 'fa-book-open', tone: 'amber', label: bi('See homework', 'Δείτε την εργασία') },
        { attrs: 'data-parent-compose="question"', icon: 'fa-pen-nib', tone: 'sky', label: bi('Write to the school', 'Γράψτε στο σχολείο') },
        { attrs: 'data-parent-compose="absence"', icon: 'fa-bed', tone: 'rose', label: bi('Report an absence', 'Δηλώστε απουσία') }
    ];
    return `
        <nav class="fp-quick fp-rise" style="--fp-delay:1" aria-label="${tr('What would you like to do?', 'Τι θα θέλατε να κάνετε;')}">
            ${actions.map((action) => `
                <button type="button" class="fp-quick__btn fp-quick__btn--${action.tone}" ${action.attrs}>
                    <span class="fp-quick__icon" aria-hidden="true"><i class="fas ${action.icon}"></i></span>
                    <span class="fp-quick__label">${action.label}</span>
                </button>`).join('')}
        </nav>`;
}

/** A plain-words guide to the four tabs, folded away until someone needs it. */
function renderHowTo() {
    const rows = [
        ['fa-house', tr('<strong>Home</strong> shows this week: stars, the next lesson and any news.', '<strong>Αρχική</strong>: η εβδομάδα με μια ματιά, αστέρια, επόμενο μάθημα και νέα.')],
        ['fa-book-open', tr('<strong>Homework</strong> shows what to do before the next lesson.', '<strong>Εργασίες</strong>: τι πρέπει να γίνει πριν από το επόμενο μάθημα.')],
        ['fa-seedling', tr('<strong>Progress</strong> shows stars by month, test results and attendance.', '<strong>Πρόοδος</strong>: αστέρια ανά μήνα, βαθμοί και παρουσίες.')],
        ['fa-star', tr('<strong>Tips</strong> has Lumi’s short ideas for helping with English at home.', '<strong>Συμβουλές</strong>: σύντομες ιδέες της Lumi για να βοηθάτε στα Αγγλικά από το σπίτι.')],
        ['fa-envelope', tr('<strong>Messages</strong> is where you write to the school and read replies.', '<strong>Μηνύματα</strong>: γράφετε στο σχολείο και διαβάζετε τις απαντήσεις.')],
        ['fa-rotate', tr('New things arrive by themselves. To check now, tap <i class="fas fa-rotate" aria-hidden="true"></i> at the top or pull the page down.', 'Τα νέα έρχονται μόνα τους. Για έλεγχο τώρα, πατήστε <i class="fas fa-rotate" aria-hidden="true"></i> επάνω ή τραβήξτε τη σελίδα προς τα κάτω.')]
    ];
    return `
        <details class="fp-howto fp-rise" style="--fp-delay:6">
            <summary><i class="fas fa-circle-question" aria-hidden="true"></i> ${tr('How to use this page', 'Πώς χρησιμοποιείται η σελίδα')}</summary>
            <ul>${rows.map(([icon, text]) => `<li><span class="fp-howto__icon" aria-hidden="true"><i class="fas ${icon}"></i></span><span>${text}</span></li>`).join('')}</ul>
        </details>`;
}

export function renderParentHome() {
    const snapshot = getSnapshot();
    const name = firstName(snapshot.studentName);
    const homework = newestHomework();
    const parts = homework ? splitHomework(homework) : null;
    const lesson = getNextLesson(snapshot);

    if (!snapshot.studentName) {
        return `
            <div class="fp-waiting fp-rise">
                <span class="fp-waiting__icon"><i class="fas fa-house-chimney-window" aria-hidden="true"></i></span>
                <h2>${tr('Opening the door…', 'Ανοίγουμε την πόρτα…')}</h2>
                <p>${tr("Your child's news is on its way from school. If this takes long, tap <strong>Check for news</strong> at the top.", 'Τα νέα του παιδιού σας έρχονται από το σχολείο. Αν αργήσει, πατήστε <strong>Έλεγχος για νέα</strong> επάνω.')}</p>
            </div>`;
    }

    return `
        <div class="fp-home">
            <article class="fp-hello fp-rise" style="--fp-delay:0">
                <span class="fp-hello__stamp" aria-hidden="true">${escapeHtml(snapshot.classLogo || getGuildById(snapshot.guildId)?.emoji || '⭐')}</span>
                <p class="fp-hello__greet">${escapeHtml(greeting())},</p>
                <h2 class="fp-hello__title">${isGreek() ? bi(`here is ${escapeHtml(name)}'s week`, 'να τι έγινε αυτή την εβδομάδα') : `here is ${escapeHtml(name)}'s week`}</h2>
                <p class="fp-hello__summary">${escapeHtml(buildSummary(snapshot, name, lesson, parts?.test))}</p>
                ${renderNews(snapshot, homework)}
            </article>
            ${renderQuickActions()}
            <div class="fp-duo fp-rise" style="--fp-delay:1">
                ${renderNextLessonTile(lesson)}
                ${renderSecondTile(homework, parts)}
            </div>
            ${renderHomeTip(snapshot)}
            ${renderFortnight()}
            ${renderStarJar(snapshot, name)}
            ${renderLetter(snapshot)}
            ${renderMoments(snapshot, name)}
            ${renderInstallCard()}
            ${renderHowTo()}
        </div>`;
}

// Chrome, Samsung Internet, Mi Browser and Huawei Browser colour their own top bar from
// theme-color: match it to the porch sky so the phone's bar and the header read as one.
const BAR_COLOURS = { morning: '#fdf4dc', day: '#ffe9c9', evening: '#f8c297', night: '#27325a' };
function tintBrowserBar(time) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (!meta.dataset.appColour) meta.dataset.appColour = meta.getAttribute('content') || '';
    meta.setAttribute('content', BAR_COLOURS[time] || BAR_COLOURS.day);
}

/** Header: portrait, first name, class and guild; the sky follows the time of day. */
export function updateParentHeader(snapshot = getSnapshot()) {
    const screen = document.getElementById('parent-screen');
    if (screen) screen.dataset.time = timeOfDay();
    tintBrowserBar(screen?.dataset.time);
    const name = snapshot.studentName || '';
    const titleEl = document.querySelector('[data-parent-title]');
    const subtitleEl = document.querySelector('[data-parent-student-name]');
    const schoolEl = document.querySelector('[data-parent-school]');
    const portraitEl = document.querySelector('[data-parent-portrait]');
    const schoolName = snapshot.schoolName || state.get('schoolName') || '';
    if (titleEl) titleEl.textContent = name ? firstName(name) : tr('Welcome', 'Καλώς ήρθατε');
    if (schoolEl) schoolEl.textContent = schoolName || '';
    if (subtitleEl) {
        const guild = getGuildById(snapshot.guildId);
        const hero = heroClassMeta(snapshot.heroClass);
        // The hero class is the first thing to go when a phone runs out of room.
        const bits = [
            snapshot.className ? escapeHtml(snapshot.className) : '',
            guild ? `${escapeHtml(guild.emoji)}<span class="fp-sub-guild"> ${escapeHtml(gameName(guild.name))}</span>` : '',
            hero ? `<span class="fp-sub-hero">${escapeHtml(hero.icon)} ${escapeHtml(gameName(normalizeHeroClass(snapshot.heroClass)))}</span>` : ''
        ].filter(Boolean);
        subtitleEl.innerHTML = name
            ? bits.map((bit, i) => (i && bit.startsWith('<span') ? `<span class="fp-sub-hero"> · </span>${bit}` : `${i ? ' · ' : ''}${bit}`)).join('')
            : tr('Waiting for news from school…', 'Περιμένουμε νέα από το σχολείο…');
    }
    if (portraitEl) {
        const avatar = snapshot.avatar;
        const key = avatar || `initials:${initials(name)}`;
        if (portraitEl.dataset.key !== key) {
            portraitEl.dataset.key = key;
            portraitEl.innerHTML = avatar
                ? `<img src="${escapeHtml(avatar)}" alt="" decoding="async">`
                : `<span>${escapeHtml(initials(name))}</span>`;
        }
    }
}
