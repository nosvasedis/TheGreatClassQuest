// features/parent/home.js — the Family Portal's Home: this week at a glance
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
    sinceLastVisit
} from './helpers.js';

function formatStars(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function plural(n, word) {
    return `${formatStars(n)} ${word}${Number(n) === 1 ? '' : 's'}`;
}

function lessonPhrase(lesson) {
    if (!lesson) return '';
    const when = lesson.inDays === 0 ? 'today' : lesson.inDays === 1 ? 'tomorrow' : `on ${weekdayName(lesson.date)}`;
    return `The next lesson is ${when}${lesson.time ? ` at ${lesson.time}` : ''}.`;
}

function buildSummary(snapshot, name, lesson, test) {
    const progress = snapshot.progress || {};
    const week = Number(snapshot.weekStars || 0);
    const month = Number(progress.monthlyStars || 0);
    const sentences = [];
    if (week > 0) {
        sentences.push(`${name} earned ${plural(week, 'star')} this week${month > week ? `, and ${formatStars(month)} so far this month` : ''}.`);
    } else if (month > 0) {
        sentences.push(`${name} has ${plural(month, 'star')} so far this month.`);
    } else {
        sentences.push(`A new month of stars is beginning for ${name}.`);
    }
    if (test && daysFromToday(test.date) >= 0) {
        const diff = daysFromToday(test.date);
        sentences.push(`There is a test ${diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `on ${weekdayName(test.date)}`}.`);
    }
    const latest = snapshot.latestGrade;
    if (latest?.label && snapshotAssessmentUses(snapshot).any) {
        const title = latest.type === 'dictation' && (!latest.title || latest.title === 'dictation') ? 'dictation' : latest.title;
        sentences.push(`Latest ${title ? `result (${title})` : 'result'}: ${latest.label}.`);
    }
    const lessonLine = lessonPhrase(lesson);
    if (lessonLine) sentences.push(lessonLine);
    return sentences.join(' ');
}

function renderNews(snapshot, homework) {
    const since = sinceLastVisit(snapshot);
    const chips = [];
    if (since?.stars > 0) {
        chips.push({ tab: 'progress', icon: 'fa-star', tone: 'amber', text: `+${formatStars(since.stars)} star${since.stars === 1 ? '' : 's'}` });
    }
    if (homework && isHomeworkNew(homework)) {
        chips.push({ tab: 'homework', icon: 'fa-book-open', tone: 'sage', text: 'New homework' });
    }
    const unread = unreadThreadCount();
    if (unread) {
        chips.push({ tab: 'messages', icon: 'fa-envelope', tone: 'rose', text: `${unread} new message${unread === 1 ? '' : 's'}` });
    }
    if (since?.newNote) {
        chips.push({ tab: 'home-note', icon: 'fa-feather-pointed', tone: 'violet', text: 'New note from the teacher' });
    }
    if (!chips.length) {
        return `<p class="fp-news fp-news--calm"><i class="fas fa-circle-check" aria-hidden="true"></i> You are all caught up.</p>`;
    }
    return `
        <div class="fp-news" aria-label="New since your last visit">
            <span class="fp-news__lead">New since your last visit</span>
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
                <span class="fp-leaf fp-leaf--sage" aria-hidden="true"><span class="fp-leaf__month">Class</span><span class="fp-leaf__day"><i class="fas fa-school"></i></span></span>
                <div class="fp-tile__copy">
                    <p class="fp-tile__kicker">Next lesson</p>
                    <p class="fp-tile__title">Timetable coming soon</p>
                    <p class="fp-tile__meta">The school will add the lesson days.</p>
                </div>
            </div>`;
    }
    return `
        <div class="fp-tile">
            ${calendarLeaf(lesson.date, 'sage')}
            <div class="fp-tile__copy">
                <p class="fp-tile__kicker">Next lesson</p>
                <p class="fp-tile__title">${escapeHtml(weekdayName(lesson.date))}${lesson.time ? ` · ${escapeHtml(lesson.time)}` : ''}</p>
                <p class="fp-tile__meta">${escapeHtml(countdownLabel(lesson.date))}${lesson.timeEnd ? ` · until ${escapeHtml(lesson.timeEnd)}` : ''}</p>
            </div>
        </div>`;
}

function renderSecondTile(homework, parts) {
    if (parts?.test && daysFromToday(parts.test.date) >= 0) {
        return `
            <button type="button" class="fp-tile fp-tile--link" data-parent-tab-link="homework">
                ${calendarLeaf(parts.test.date, 'violet')}
                <div class="fp-tile__copy">
                    <p class="fp-tile__kicker">Test day</p>
                    <p class="fp-tile__title">${escapeHtml(parts.test.title)}</p>
                    <p class="fp-tile__meta">${escapeHtml(countdownLabel(parts.test.date))} · ${escapeHtml(shortDate(parts.test.date))}</p>
                </div>
            </button>`;
    }
    if (homework) {
        return `
            <button type="button" class="fp-tile fp-tile--link" data-parent-tab-link="homework">
                <span class="fp-leaf fp-leaf--amber" aria-hidden="true"><span class="fp-leaf__month">Home</span><span class="fp-leaf__day"><i class="fas fa-pencil"></i></span></span>
                <div class="fp-tile__copy">
                    <p class="fp-tile__kicker">Homework</p>
                    <p class="fp-tile__title">${escapeHtml(parts.title)}</p>
                    <p class="fp-tile__meta">Set ${escapeHtml(relativeDay(parts.setOn))}</p>
                </div>
            </button>`;
    }
    return `
        <div class="fp-tile">
            <span class="fp-leaf fp-leaf--amber" aria-hidden="true"><span class="fp-leaf__month">Home</span><span class="fp-leaf__day"><i class="fas fa-pencil"></i></span></span>
            <div class="fp-tile__copy">
                <p class="fp-tile__kicker">Homework</p>
                <p class="fp-tile__title">Nothing set yet</p>
                <p class="fp-tile__meta">It appears here after a lesson.</p>
            </div>
        </div>`;
}

function renderStarJar(snapshot, name) {
    const progress = snapshot.progress || {};
    const month = Number(progress.monthlyStars || 0);
    const history = Array.isArray(snapshot.starsHistory) ? snapshot.starsHistory : [];
    const best = history.reduce((top, item) => (Number(item.stars) > Number(top?.stars || 0) ? item : top), null);
    const capacity = Math.max(20, Number(best?.stars || 0), month);
    const fill = Math.max(0.04, Math.min(1, month / capacity));
    // Jar interior spans y=30..128 in the drawing.
    const top = 128 - Math.round(98 * fill);
    const sparkles = Array.from({ length: Math.min(9, Math.ceil(month / 3)) }, (_, i) => {
        const x = 34 + ((i * 23) % 52);
        const y = Math.max(top + 10, 122 - Math.floor(i / 3) * 16 - (i % 2) * 5);
        return `<path class="fp-jar__star" d="M${x} ${y - 5}l1.5 3.2 3.5.4-2.6 2.4.7 3.4-3.1-1.8-3.1 1.8.7-3.4-2.6-2.4 3.5-.4z"/>`;
    }).join('');
    const bestLine = best && Number(best.stars) > 0
        ? `Best month so far: ${escapeHtml(monthShort(`${best.month}-01`))} with ${formatStars(best.stars)}.`
        : 'Every star this month lands in the jar.';
    return `
        <article class="fp-card fp-jar-card fp-rise" style="--fp-delay:2">
            <svg class="fp-jar" viewBox="0 0 120 140" role="img" aria-label="${formatStars(month)} stars this month">
                <defs><clipPath id="fp-jar-inside"><path d="M30 30h60v8c8 6 12 14 12 24v54c0 8-6 14-14 14H32c-8 0-14-6-14-14V62c0-10 4-18 12-24z"/></clipPath></defs>
                <g clip-path="url(#fp-jar-inside)">
                    <rect class="fp-jar__glow" x="0" y="${top}" width="120" height="${140 - top}"/>
                    <rect class="fp-jar__fill" x="0" y="${top}" width="120" height="${140 - top}"/>
                    <path class="fp-jar__surface" d="M0 ${top}q15 -4 30 0t30 0t30 0t30 0v4H0z"/>
                    ${sparkles}
                </g>
                <path class="fp-jar__glass" d="M30 30h60v8c8 6 12 14 12 24v54c0 8-6 14-14 14H32c-8 0-14-6-14-14V62c0-10 4-18 12-24z"/>
                <path class="fp-jar__shine" d="M28 66v44"/>
                <rect class="fp-jar__lid" x="26" y="18" width="68" height="14" rx="5"/>
                <path class="fp-jar__ribbon" d="M26 25h68"/>
            </svg>
            <div class="fp-jar-card__copy">
                <p class="fp-kicker">The star jar</p>
                <p class="fp-jar-card__big"><strong>${formatStars(month)}</strong> star${month === 1 ? '' : 's'} this month</p>
                <div class="fp-jar-card__facts">
                    <span><i class="fas fa-calendar-week" aria-hidden="true"></i>${formatStars(snapshot.weekStars || 0)} this week</span>
                    <span><i class="fas fa-star" aria-hidden="true"></i>${formatStars(progress.totalStars || 0)} this year</span>
                </div>
                <p class="fp-jar-card__note">${bestLine} Stars are earned in class for effort, teamwork and kindness.</p>
                <button type="button" class="fp-link" data-parent-tab-link="progress">See ${escapeHtml(name)}'s progress <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
            </div>
        </article>`;
}

function noteLabel(note) {
    if (note?.source === 'ember_oath') return 'A promise kept';
    if (!note?.label || note.label === 'Parent Summary') return 'A note from the teacher';
    return note.label;
}

function renderLetter(snapshot) {
    const notes = Array.isArray(snapshot.publishedNotes) ? snapshot.publishedNotes.filter((note) => note?.body || note?.text) : [];
    if (!notes.length) return '';
    const [latest, ...earlier] = notes;
    const hasThread = (state.get('currentCommunicationThreads') || []).some((thread) => thread.threadType === 'progress-share');
    return `
        <article class="fp-card fp-letter fp-rise" id="fp-latest-note" style="--fp-delay:3">
            <p class="fp-kicker"><i class="fas fa-feather-pointed" aria-hidden="true"></i> ${escapeHtml(noteLabel(latest))}</p>
            <blockquote class="fp-letter__body">${escapeHtml(latest.body || latest.text || '')}</blockquote>
            <div class="fp-letter__foot">
                <span class="fp-letter__sign">${escapeHtml(snapshot.teacherName ? `${snapshot.teacherName}` : 'Your child’s teacher')}${latest.createdAt ? ` · ${escapeHtml(relativeDay(latest.createdAt))}` : ''}</span>
                <button type="button" class="fp-btn fp-btn--soft" data-parent-reply="${hasThread ? 'progress-share' : 'new'}"><i class="fas fa-reply" aria-hidden="true"></i> Reply</button>
            </div>
            ${earlier.length ? `
                <details class="fp-letter__earlier">
                    <summary>Earlier notes (${earlier.length})</summary>
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
        <article class="fp-card fp-rise" style="--fp-delay:4">
            <p class="fp-kicker">Star moments</p>
            <h3 class="fp-card__title">Why ${escapeHtml(name)} earned stars</h3>
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
                </ul>` : `<p class="fp-empty-line">Stars from class will show up here with the reason they were given.</p>`}
        </article>`;
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
                <h2>Opening the door…</h2>
                <p>Your child's news is on its way from school. If this takes long, tap <strong>Check for news</strong> at the top.</p>
            </div>`;
    }

    return `
        <div class="fp-home">
            <article class="fp-hello fp-rise" style="--fp-delay:0">
                <span class="fp-hello__stamp" aria-hidden="true">${escapeHtml(snapshot.classLogo || getGuildById(snapshot.guildId)?.emoji || '⭐')}</span>
                <p class="fp-hello__greet">${escapeHtml(greeting())},</p>
                <h2 class="fp-hello__title">here is ${escapeHtml(name)}'s week</h2>
                <p class="fp-hello__summary">${escapeHtml(buildSummary(snapshot, name, lesson, parts?.test))}</p>
                ${renderNews(snapshot, homework)}
            </article>
            <div class="fp-duo fp-rise" style="--fp-delay:1">
                ${renderNextLessonTile(lesson)}
                ${renderSecondTile(homework, parts)}
            </div>
            ${renderStarJar(snapshot, name)}
            ${renderLetter(snapshot)}
            ${renderMoments(snapshot, name)}
        </div>`;
}

/** Header: portrait, first name, class and guild; the sky follows the time of day. */
export function updateParentHeader(snapshot = getSnapshot()) {
    const screen = document.getElementById('parent-screen');
    if (screen) screen.dataset.time = timeOfDay();
    const name = snapshot.studentName || '';
    const titleEl = document.querySelector('[data-parent-title]');
    const subtitleEl = document.querySelector('[data-parent-student-name]');
    const schoolEl = document.querySelector('[data-parent-school]');
    const portraitEl = document.querySelector('[data-parent-portrait]');
    const schoolName = snapshot.schoolName || state.get('schoolName') || '';
    if (titleEl) titleEl.textContent = name ? firstName(name) : 'Welcome';
    if (schoolEl) schoolEl.textContent = schoolName ? ` · ${schoolName}` : '';
    if (subtitleEl) {
        const guild = getGuildById(snapshot.guildId);
        const hero = heroClassMeta(snapshot.heroClass);
        // The hero class is the first thing to go when a phone runs out of room.
        const bits = [
            snapshot.className ? escapeHtml(snapshot.className) : '',
            guild ? `${escapeHtml(guild.emoji)} ${escapeHtml(guild.name)}` : '',
            hero ? `<span class="fp-sub-hero">${escapeHtml(hero.icon)} ${escapeHtml(snapshot.heroClass)}</span>` : ''
        ].filter(Boolean);
        subtitleEl.innerHTML = name
            ? bits.map((bit, i) => (i && bit.startsWith('<span') ? `<span class="fp-sub-hero"> · </span>${bit}` : `${i ? ' · ' : ''}${bit}`)).join('')
            : 'Waiting for news from school…';
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
