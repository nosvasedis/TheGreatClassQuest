// /ui/tabs/log.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as modals from '../modals.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getLogTabCopy } from '../../config/tiers/features.js';
import { renderAwardStarsStudentList } from './award.js';
import { syncHeaderClassSelector } from '../headerClassSelector.js';
import { getLeaderboardEffectiveLeague } from '../../state.js';
import { renderLearnedTodayHtml } from '../../features/learnedToday.js';
import { mountCampfireEntry } from '../../features/campfireEntry.js';

function classHasAwardedStarsToday(classId) {
    if (!classId) return false;
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    if (studentsInClass.length === 0) return false;
    const todaysStars = state.get('todaysStars') || {};
    return studentsInClass.some(s => (Number(todaysStars[s.id]?.stars) || 0) > 0);
}

function inferAdventureLogEntryMode(log) {
    const explicitMode = String(log?.entryMode || '').toLowerCase();
    if (explicitMode === 'manual' || explicitMode === 'ai') return explicitMode;
    return (log?.imageUrl || log?.imageBase64) ? 'ai' : 'manual';
}

function canEditAdventureLog(log) {
    const entryMode = inferAdventureLogEntryMode(log);
    return canUseFeature('eliteAI') || (entryMode === 'manual' && canUseFeature('adventureLog'));
}

function escapeDiaryHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAdventureLogGenerationBadge(log) {
    const status = String(log?.generationStatus || '').toLowerCase();
    if (!status || status === 'ready') return '';

    const statusMap = {
        generating: { label: 'Being written', icon: 'fa-feather-alt', tone: 'ink' },
        retrying: { label: 'Rewriting', icon: 'fa-rotate', tone: 'amber' },
        pending: { label: 'Waiting for the Chronicler', icon: 'fa-hourglass-half', tone: 'violet' },
        failed: { label: 'Needs a retry', icon: 'fa-triangle-exclamation', tone: 'rose' }
    };
    const meta = statusMap[status] || statusMap.pending;
    return `<span class="diary-stamp diary-stamp--${meta.tone}"><i class="fas ${meta.icon}" aria-hidden="true"></i>${meta.label}</span>`;
}

function shouldShowAdventureLogRetry(log) {
    const entryMode = inferAdventureLogEntryMode(log);
    if (entryMode !== 'ai') return false;
    const status = String(log?.generationStatus || '').toLowerCase();
    return status === 'pending' || status === 'failed';
}

function findHeroStudent(log) {
    const students = state.get('allStudents') || [];
    if (log?.heroStudentId) {
        const byId = students.find((s) => s.id === log.heroStudentId);
        if (byId) return byId;
    }
    const heroName = String(log?.hero || '').trim().toLowerCase();
    if (!heroName) return null;
    return students.find((s) => s.classId === log.classId && String(s.name || '').trim().toLowerCase() === heroName) || null;
}

function renderHeroSticker(log) {
    const heroLabel = escapeDiaryHtml(log.hero || 'The Class Team');
    const student = findHeroStudent(log);
    const portrait = student?.avatar
        ? `<img src="${escapeDiaryHtml(student.avatar)}" alt="" class="diary-hero__img" loading="lazy" decoding="async">`
        : `<span class="diary-hero__initial">${student ? escapeDiaryHtml(String(student.name || '?').trim().charAt(0).toUpperCase()) : '<i class="fas fa-users"></i>'}</span>`;
    return `
        <div class="diary-hero" title="Hero of the Day: ${heroLabel}">
            <span class="diary-hero__portrait">${portrait}<i class="fas fa-crown diary-hero__crown" aria-hidden="true"></i></span>
            <span class="diary-hero__text">
                <span class="diary-hero__label">Hero of the Day</span>
                <span class="diary-hero__name">${heroLabel}</span>
            </span>
        </div>`;
}

function renderDiaryArtwork(log, entryMode) {
    const imageSrc = log.imageUrl || log.imageBase64 || '';
    if (imageSrc) {
        return `
            <figure class="diary-image-container diary-polaroid">
                <span class="diary-tape diary-tape--tl" aria-hidden="true"></span>
                <span class="diary-tape diary-tape--br" aria-hidden="true"></span>
                <img src="${escapeDiaryHtml(imageSrc)}" alt="Picture for ${escapeDiaryHtml((log.keywords || []).join(', ') || log.title || 'this day')}" class="diary-image" loading="lazy" decoding="async">
                <figcaption class="diary-polaroid__caption">${escapeDiaryHtml(log.title || 'Our day')}</figcaption>
            </figure>`;
    }

    const status = String(log?.generationStatus || '').toLowerCase();
    const isWaitingOnAi = entryMode === 'ai' && status && status !== 'ready' && status !== 'failed';
    const icon = entryMode === 'manual'
        ? 'fa-pen-fancy'
        : isWaitingOnAi
            ? 'fa-feather-alt diary-doodle__icon--writing'
            : status === 'failed'
                ? 'fa-hourglass-end'
                : 'fa-paintbrush';
    const helperCopy = entryMode === 'manual'
        ? 'Written by hand by the teacher.'
        : status === 'retrying'
            ? 'The Chronicler is trying another route now.'
            : status === 'pending'
                ? 'Saved safely. The Chronicler will retry on its own.'
                : status === 'failed'
                    ? 'The picture did not finish. Use Retry below.'
                    : isWaitingOnAi
                        ? 'The Chronicler is writing and painting this page.'
                        : 'No picture for this day.';
    return `
        <figure class="diary-image-container diary-doodle ${isWaitingOnAi ? 'is-waiting' : ''}">
            <span class="diary-tape diary-tape--tl" aria-hidden="true"></span>
            <div class="diary-doodle__art" aria-hidden="true">
                <i class="fas ${icon}"></i>
            </div>
            <figcaption class="diary-doodle__caption">${helperCopy}</figcaption>
        </figure>`;
}

function renderDiaryMonthStats(logs) {
    const statsEl = document.getElementById('adventure-log-month-stats');
    if (!statsEl) return;
    const list = Array.isArray(logs) ? logs : [];
    const heroes = new Set(list.map((log) => String(log.hero || '').trim()).filter((name) => name && name !== 'The Class Team'));
    const words = new Set(list.flatMap((log) => log.learnedToday?.words || []).map((w) => String(w).trim().toLowerCase()).filter(Boolean));
    const notes = list.filter((log) => String(log.note || '').trim()).length;
    const stat = (value, label, icon) => `<span class="al-desk-stat"><i class="fas ${icon}" aria-hidden="true"></i><strong>${value}</strong> ${label}</span>`;
    statsEl.innerHTML = [
        stat(list.length, list.length === 1 ? 'page' : 'pages', 'fa-book-open'),
        stat(heroes.size, heroes.size === 1 ? 'hero crowned' : 'heroes crowned', 'fa-crown'),
        stat(words.size, words.size === 1 ? 'new word' : 'new words', 'fa-spell-check'),
        stat(notes, notes === 1 ? 'teacher note' : 'teacher notes', 'fa-sticky-note')
    ].join('');
}

function formatMonthKey(monthKey, style = 'long') {
    const [m, y] = String(monthKey || '').split('-').map(Number);
    if (!m || !y) return '';
    const d = new Date(y, m - 1, 1);
    return style === 'long'
        ? d.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
        : d.toLocaleString('en-GB', { month: 'short' });
}

function syncDiaryMonthTabs() {
    const monthFilter = document.getElementById('adventure-log-month-filter');
    const tabsEl = document.getElementById('adventure-log-month-tabs');
    const nameEl = document.getElementById('adventure-log-month-name');
    if (!monthFilter) return;
    const current = monthFilter.value;
    if (nameEl) nameEl.textContent = formatMonthKey(current, 'long') || ' ';
    if (!tabsEl) return;
    tabsEl.querySelectorAll('.al-month-tab').forEach((tab) => {
        const active = tab.dataset.month === current;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        if (active) tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
}

function renderDiaryMonthTabs(monthKeys, currentMonth) {
    const tabsEl = document.getElementById('adventure-log-month-tabs');
    const monthFilter = document.getElementById('adventure-log-month-filter');
    if (!tabsEl || !monthFilter) return;
    // Oldest on the left, like divider tabs along the edge of the diary.
    const ordered = [...monthKeys].reverse();
    tabsEl.innerHTML = ordered.map((monthKey, index) => {
        const [m, y] = monthKey.split('-').map(Number);
        const prevYear = index > 0 ? Number(ordered[index - 1].split('-')[1]) : null;
        const showYear = index === 0 || prevYear !== y || m === 1;
        const isNow = monthKey === currentMonth;
        return `<button type="button" role="tab" class="al-month-tab al-month-tab--c${index % 5}" data-month="${monthKey}" aria-selected="false" title="${formatMonthKey(monthKey, 'long')}">
                <span class="al-month-tab__name">${formatMonthKey(monthKey, 'short')}</span>
                ${showYear ? `<span class="al-month-tab__year">${y}</span>` : ''}
                ${isNow ? '<span class="al-month-tab__now">now</span>' : ''}
            </button>`;
    }).join('');
    if (!tabsEl.dataset.bound) {
        tabsEl.dataset.bound = '1';
        tabsEl.addEventListener('click', (event) => {
            const tab = event.target.closest('.al-month-tab');
            if (!tab || tab.dataset.month === monthFilter.value) return;
            monthFilter.value = tab.dataset.month;
            monthFilter.dispatchEvent(new Event('change', { bubbles: true }));
            syncDiaryMonthTabs();
        });
        tabsEl.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const tabs = [...tabsEl.querySelectorAll('.al-month-tab')];
            const index = tabs.findIndex((tab) => tab.classList.contains('is-active'));
            const next = tabs[index + (event.key === 'ArrowRight' ? 1 : -1)];
            if (!next) return;
            event.preventDefault();
            next.click();
            next.focus();
        });
    }
}

function getTodayHint(classVal) {
    if (!classVal) return 'Choose a class in the header to open its diary.';
    const todayLog = (state.get('allAdventureLogs') || []).find((log) => log.classId === classVal && log.date === utils.getTodayDateString());
    if (todayLog) return `Today's page is written. Hero of the Day: ${todayLog.hero || 'The Class Team'}.`;
    if (!classHasAwardedStarsToday(classVal)) return 'Award some stars first, then write today\'s page.';
    return 'Ready to write. Saving the page crowns today\'s Hero.';
}

export async function renderAdventureLogTab() {
    const monthFilter = document.getElementById('adventure-log-month-filter');

    if (!monthFilter) return;

    const classVal = state.get('globalSelectedClassId');
    mountCampfireEntry(document.querySelector('.al-primary-actions'), classVal);
    state.get('currentLogFilter').classId = classVal;
    const hasAdventureLog = canUseFeature('adventureLog');
    const logCopy = getLogTabCopy(hasAdventureLog);
    const taglineEl = document.getElementById('adventure-log-tagline');
    const upsellEl = document.getElementById('adventure-log-upsell');
    if (taglineEl) taglineEl.textContent = logCopy.tagline;
    if (upsellEl) {
        upsellEl.classList.toggle('hidden', hasAdventureLog);
        const upsellTitle = document.getElementById('adventure-log-upsell-title');
        const upsellBody = document.getElementById('adventure-log-upsell-body');
        if (upsellTitle) upsellTitle.textContent = logCopy.upsellTitle;
        if (upsellBody) upsellBody.textContent = logCopy.upsellBody;
    }
    const logBtn = document.getElementById('log-adventure-btn');
    const hallBtn = document.getElementById('hall-of-heroes-btn');
    const feedEl = document.getElementById('adventure-log-feed');
    const deskEl = document.querySelector('#adventure-log-tab .al-desk');
    const hintEl = document.getElementById('adventure-log-today-hint');
    const hasAdvancedAttendance = canUseFeature('advancedAttendance');
    
    if (logBtn) {
        logBtn.style.display = hasAdventureLog ? '' : 'none';
        logBtn.disabled = !classVal || !classHasAwardedStarsToday(classVal);
    }
    if (hallBtn) {
        hallBtn.style.display = hasAdventureLog ? '' : 'none';
        hallBtn.disabled = !classVal;
    }
    if (feedEl) feedEl.style.display = hasAdventureLog ? '' : 'none';
    if (deskEl) deskEl.classList.toggle('is-locked', !hasAdventureLog);
    if (monthFilter) monthFilter.style.display = hasAdventureLog ? '' : 'none';
    if (hintEl) hintEl.textContent = hasAdventureLog ? getTodayHint(classVal) : '';
    
    // ─── FAB BUTTON STATES ────────────────────────────────────────────────────
    const questAssignmentFab = document.getElementById('quest-assignment-fab');
    if (questAssignmentFab) {
        questAssignmentFab.disabled = !classVal;
    }
    
    const attendanceFab = document.getElementById('attendance-fab');
    if (attendanceFab) {
        attendanceFab.style.display = hasAdvancedAttendance ? '' : 'none';
        attendanceFab.disabled = !classVal;
    }

    const monthVal = monthFilter.value;

    // --- FIX: Generate month list from competition start instead of memory ---
    const availableMonths = [];
    const now = new Date();
    // Start from the first day of the competition start month
    const activeYearStart = state.getActiveSchoolYearStartDate() || now;
    let loopDate = new Date(activeYearStart.getFullYear(), activeYearStart.getMonth(), 1);

    while (loopDate <= now) {
        const month = (loopDate.getMonth() + 1).toString().padStart(2, '0');
        const year = loopDate.getFullYear();
        availableMonths.unshift(`${month}-${year}`); // Newest months first
        loopDate.setMonth(loopDate.getMonth() + 1);
    }

    const currentMonth = utils.getDDMMYYYY(new Date()).substring(3);

    monthFilter.innerHTML = availableMonths.map(monthKey => {
        return `<option value="${monthKey}">${formatMonthKey(monthKey, 'long')}</option>`;
    }).join('');

    monthFilter.value = monthVal || currentMonth;
    state.get('currentLogFilter').month = monthFilter.value;
    renderDiaryMonthTabs(availableMonths, currentMonth);
    syncDiaryMonthTabs();

    await renderAdventureLog();
}

function renderDiaryEntry(log, animationClass) {
    const dateObj = utils.parseFlexibleDate(log.date);
    const validDate = dateObj && !isNaN(dateObj.getTime());
    const displayDate = validDate ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }) : escapeDiaryHtml(log.date);
    const isToday = log.date === utils.getTodayDateString();
    const title = escapeDiaryHtml(log.title || 'Daily Chronicle');
    const entryMode = inferAdventureLogEntryMode(log);
    const keywordsHtml = (log.keywords || []).map(kw => `<span class="diary-keyword">#${escapeDiaryHtml(kw)}</span>`).join('');
    const highlightsHtml = (log.highlights || []).slice(0, 4).map((h, i) => `<li class="diary-highlight-chip diary-highlight-chip--${i % 4}">${escapeDiaryHtml(h)}</li>`).join('');
    const totalStars = Number(log.totalStars) || 0;

    const noteHtml = log.note ? `
        <aside class="diary-note" aria-label="Teacher's note">
            <span class="diary-note__pin" aria-hidden="true"></span>
            <p>${escapeDiaryHtml(log.note)}</p>
            <span class="diary-note-author">${escapeDiaryHtml(log.noteBy || 'the Teacher')}</span>
        </aside>
    ` : '';

    const actionBtn = (cls, icon, label, title) => `<button type="button" class="${cls} diary-action bubbly-button" data-log-id="${log.id}" title="${title}"><i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span></button>`;

    return `
        <article class="${animationClass}${isToday ? ' is-today' : ''}" data-log-id="${log.id}" data-entry-mode="${entryMode}">
            <span class="diary-page__binding" aria-hidden="true"></span>
            <header class="diary-header">
                <div class="diary-datestamp" aria-hidden="true">
                    <span class="diary-datestamp__wd">${validDate ? dateObj.toLocaleDateString('en-GB', { weekday: 'short' }) : ''}</span>
                    <span class="diary-datestamp__day">${validDate ? dateObj.getDate() : '?'}</span>
                    <span class="diary-datestamp__mon">${validDate ? dateObj.toLocaleDateString('en-GB', { month: 'short' }) : ''}</span>
                </div>
                <div class="diary-heading">
                    <p class="diary-date">${isToday ? 'Today · ' : ''}${displayDate}</p>
                    <h3 class="diary-title">${title}</h3>
                    <div class="diary-meta">
                        ${getAdventureLogGenerationBadge(log)}
                        <span class="diary-meta__item"><i class="fas ${entryMode === 'ai' ? 'fa-wand-magic-sparkles' : 'fa-pen-nib'}" aria-hidden="true"></i>${entryMode === 'ai' ? 'Written by the Chronicler' : 'Written by hand'}</span>
                        ${totalStars ? `<span class="diary-meta__item"><i class="fas fa-star" aria-hidden="true"></i>${totalStars} stars earned</span>` : ''}
                    </div>
                </div>
                ${renderHeroSticker(log)}
            </header>
            <div class="diary-body">
                ${renderDiaryArtwork(log, entryMode)}
                <div class="diary-text-content">
                    <p class="diary-text">${escapeDiaryHtml(log.text)}</p>
                    ${highlightsHtml ? `<ul class="diary-highlights" aria-label="Highlights">${highlightsHtml}</ul>` : ''}
                    ${renderLearnedTodayHtml(log.learnedToday)}
                    ${noteHtml}
                </div>
            </div>
            <footer class="diary-footer">
                <div class="diary-keywords">${keywordsHtml}</div>
                <div class="diary-actions">
                    ${shouldShowAdventureLogRetry(log) ? actionBtn('log-retry-btn', 'fa-rotate-right', 'Retry', 'Ask the Chronicler to try again') : ''}
                    ${canEditAdventureLog(log) ? actionBtn('log-edit-btn', 'fa-pen', 'Edit', 'Edit this page') : ''}
                    ${actionBtn('log-note-btn', 'fa-sticky-note', log.note ? 'Note' : 'Add note', log.note ? 'Edit your note' : 'Add a note')}
                    ${actionBtn('log-delete-btn', 'fa-trash-alt', 'Remove', 'Remove this page')}
                </div>
            </footer>
        </article>`;
}

function renderDiaryEmptyPage(icon, title, body) {
    return `
        <div class="diary-page empty">
            <span class="diary-page__binding" aria-hidden="true"></span>
            <div class="diary-empty">
                <span class="diary-empty__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
                <p class="diary-empty__title">${title}</p>
                ${body ? `<p class="diary-empty__body">${body}</p>` : ''}
            </div>
        </div>`;
}

export async function renderAdventureLog() {
    const feed = document.getElementById('adventure-log-feed');
    if (!feed) return;

    const currentLogFilter = state.get('currentLogFilter');
    syncDiaryMonthTabs();

    if (!currentLogFilter.classId) {
        renderDiaryMonthStats([]);
        feed.innerHTML = renderDiaryEmptyPage('fa-book', 'Choose a class', 'Pick a class from the header to open its diary.');
        return;
    }

    // --- FIX: ON-DEMAND FETCHING FOR HISTORICAL LOGS ---
    let logsForClass = [];
    const [month, year] = currentLogFilter.month.split('-').map(Number);
    const viewMonthStart = new Date(year, month - 1, 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (viewMonthStart >= thirtyDaysAgo) {
        // Use real-time state for recent logs
        logsForClass = state.get('allAdventureLogs').filter(log => {
            if (log.classId !== currentLogFilter.classId) return false;
            const dateObj = utils.parseFlexibleDate(log.date);
            if (!dateObj || isNaN(dateObj.getTime())) return false;
            const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const y = dateObj.getFullYear();
            return `${m}-${y}` === currentLogFilter.month;
        });
    } else {
        // Fetch from Firestore on-demand for older months
        feed.innerHTML = renderDiaryEmptyPage('fa-spinner fa-spin', `Turning back to ${formatMonthKey(currentLogFilter.month, 'long')}…`, '');
        try {
            const { fetchAdventureLogsForMonth } = await import('../../db/queries.js');
            logsForClass = await fetchAdventureLogsForMonth(currentLogFilter.classId, year, month);
        } catch (error) {
            console.error("Historical log fetch failed:", error);
        }
    }

    renderDiaryMonthStats(logsForClass);

    if (logsForClass.length === 0) {
        const selectedMonthDisplay = formatMonthKey(currentLogFilter.month, 'long');
        feed.innerHTML = renderDiaryEmptyPage('fa-feather-alt', `No pages yet for ${selectedMonthDisplay}`, 'Award some stars in a lesson, then press Log Today\'s Adventure to write the first page.');
        return;
    }

    // Sort descending by date
    logsForClass.sort((a, b) => utils.parseFlexibleDate(b.date) - utils.parseFlexibleDate(a.date));

    // Track if this is a re-render (to skip animations)
    const existingEntries = feed.querySelectorAll('.diary-page[data-log-id]');
    const isReRender = existingEntries.length > 0;
    const existingLogIds = isReRender ? Array.from(existingEntries).map(el => el.dataset.logId) : [];

    feed.innerHTML = logsForClass.map(log => {
        // Only animate if this is a new entry (not already in DOM)
        const isNewEntry = !isReRender || !existingLogIds.includes(log.id);
        return renderDiaryEntry(log, isNewEntry ? 'diary-page pop-in-start' : 'diary-page');
    }).join('');

    // Only animate NEW pages
    const pages = feed.querySelectorAll('.diary-page.pop-in-start');
    pages.forEach((page, index) => {
        setTimeout(() => {
            page.classList.remove('pop-in-start');
        }, 50 + (index * 80));
    });
}

// --- GLOBAL UI SYNC FUNCTIONS ---
export function updateAllClassSelectors(isManual) {
    state.set('isProgrammaticSelection', true);
    const classId = state.get('globalSelectedClassId');

    syncHeaderClassSelector();

    if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
        renderAwardStarsStudentList(classId);
    }

    if (document.querySelector('.app-tab:not(.hidden)')?.id === 'options-tab') {
        import('./navigation.js').then(m => m.renderQuizOptionsUi());
    }

    if (document.querySelector('.app-tab:not(.hidden)')?.id === 'scholars-scroll-tab') {
        import('../../features/scholarScroll.js').then(m => m.renderScholarsScrollTab());
    }

    state.set('isProgrammaticSelection', false);
}

export function updateAllLeagueSelectors() {
    state.set('isProgrammaticSelection', true);
    const effective = getLeaderboardEffectiveLeague();
    const peeking = Boolean(state.get('leaderboardLeagueOverride'));
    const leagueButtons = [
        { id: 'leaderboard-league-picker-btn', accent: 'amber' },
        { id: 'student-leaderboard-league-picker-btn', accent: 'purple' }
    ];
    leagueButtons.forEach(({ id, accent }) => {
        const btn = document.getElementById(id);
        if (btn) {
            const label = effective || 'Select a League';
            const iconCls = accent === 'purple' ? 'text-purple-400' : 'text-amber-500';
            const peekTag = peeking
                ? '<span class="ml-1 text-[10px] font-black uppercase tracking-wide text-rose-500">peek</span>'
                : '';
            btn.innerHTML = `<i class="fas fa-layer-group ${iconCls} text-sm"></i><span>${label}</span>${peekTag}`;
        }
    });
    ['leaderboard-league-match-btn', 'student-leaderboard-league-match-btn'].forEach(mid => {
        const m = document.getElementById(mid);
        if (m) m.classList.toggle('hidden', !peeking);
    });
    state.set('isProgrammaticSelection', false);
}
