// /ui/modals/log.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import {
    AWARD_LOG_REASON_GRADIENTS,
    AWARD_LOG_REASON_ICONS,
    getAwardLogMonthlyStarCredit,
    getClassQuestBonusStarsFromAwardLog,
    PATHFINDER_AWARD_REASON,
    PATHFINDER_CLASS_QUEST_BONUS_STARS,
    shouldShowInStarAwardLog
} from '../../features/awardLogReasonMeta.js';
import { showAnimatedModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';
import { filterDocsForActiveYear } from '../../utils/schoolYear.js';


function getQuestBonusFromLog(log) {
    return getClassQuestBonusStarsFromAwardLog(log);
}

function getLogRewardMarkup(log) {
    if (log.reason === PATHFINDER_AWARD_REASON) {
        return `<span class="font-title text-lg text-indigo-600">+${PATHFINDER_CLASS_QUEST_BONUS_STARS} Class Quest</span>`;
    }
    const credit = getAwardLogMonthlyStarCredit(log);
    const rounded = Number.isFinite(credit) ? (Math.round(credit * 4) / 4) : 0;
    const label = rounded === 1 ? '⭐' : `${rounded} ⭐`;
    return `<span class="font-title text-lg text-amber-600">${label}</span>`;
}

let logbookRenderToken = 0;

function escapeLogText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatStars(value) {
    return String(Math.round((Number(value) || 0) * 4) / 4);
}

function reasonLabel(reason) {
    const text = String(reason || 'award').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function startOfLocalDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function paintLogbookHeader(dateString) {
    const day = utils.parseDDMMYYYY(dateString);
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    set('logbook-modal-leaf-month', day.toLocaleDateString('en-GB', { month: 'short' }));
    set('logbook-modal-leaf-day', String(day.getDate()));
    set('logbook-modal-leaf-weekday', day.toLocaleDateString('en-GB', { weekday: 'short' }));
    set('logbook-modal-title', day.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }));

    const diff = Math.round((startOfLocalDay(day) - startOfLocalDay(new Date())) / 86400000);
    const when = document.getElementById('logbook-modal-when');
    if (when) {
        const ago = -diff;
        when.textContent = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : ago < 14 ? `${ago} days ago` : ago < 70 ? `${Math.round(ago / 7)} weeks ago` : day.toLocaleDateString('en-GB', { year: 'numeric' });
        when.dataset.tone = diff === 0 ? 'today' : 'past';
    }
    const planBtnLabel = document.querySelector('#logbook-open-planner-btn span');
    if (planBtnLabel) planBtnLabel.textContent = diff === 0 ? 'Plan today' : 'Planner';
}

function logbookEmptyStateHtml(dateString) {
    const isToday = utils.datesMatch(dateString, utils.getTodayDateString());
    return `
        <div class="qc-log-empty">
            <div class="qc-log-empty__moon" aria-hidden="true"><i class="fas fa-moon"></i><span></span><span></span><span></span></div>
            <h3 class="font-title">${isToday ? 'The quill is still dry' : 'A quiet day'}</h3>
            <p>${isToday ? 'No stars have been awarded in the school yet today.' : 'No stars were awarded in the school on this day.'}</p>
            ${isToday ? '<button type="button" class="qc-log-empty__cta" data-log-action="plan"><i class="fas fa-feather-pointed" aria-hidden="true"></i> Plan today instead</button>' : ''}
        </div>`;
}

export async function showLogbookModal(dateString, isOndemand = false) {
    const modal = document.getElementById('logbook-modal');
    const contentEl = document.getElementById('logbook-modal-content');
    if (!modal || !contentEl) return;
    const wasOpen = !modal.classList.contains('hidden');
    const token = ++logbookRenderToken;

    modal.dataset.date = dateString;
    modal.dataset.ondemand = isOndemand ? '1' : '';
    paintLogbookHeader(dateString);

    let logs;

    if (isOndemand) {
        contentEl.innerHTML = `
            <div class="qc-log-loading">
                <span class="qc-log-loading__quill" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>
                <p>Summoning historical logs…</p>
            </div>`;
        if (!wasOpen) showAnimatedModal('logbook-modal');
        try {
            logs = await fetchLogsForDate(dateString);
        } catch (error) {
            console.error('Logbook fetch failed:', error);
            if (token === logbookRenderToken) {
                contentEl.innerHTML = '<div class="qc-log-empty"><h3 class="font-title">The archive is sealed</h3><p>Could not load this day. Please try again.</p></div>';
            }
            return;
        }
        if (token !== logbookRenderToken) return;
    } else {
        logs = filterDocsForActiveYear(state.get('allAwardLogs'), state.get('schoolYearState'))
            .filter(log => log.date && utils.datesMatch(log.date, dateString));
    }
    logs = logs.filter(shouldShowInStarAwardLog);

    const reasonColors = AWARD_LOG_REASON_GRADIENTS;
    const reasonIcons = AWARD_LOG_REASON_ICONS;

    if (logs.length === 0) {
        contentEl.innerHTML = logbookEmptyStateHtml(dateString);
    } else {
        const allSchoolClasses = state.get('allSchoolClasses') || [];
        const allStudents = state.get('allStudents') || [];
        const studentById = new Map(allStudents.map(st => [st.id, st]));
        const classById = new Map(allSchoolClasses.map(c => [c.id, c]));
        const teacherNameMap = allSchoolClasses.reduce((acc, c) => {
            if (c.createdBy?.uid && c.createdBy?.name) {
                acc[c.createdBy.uid] = c.createdBy.name;
            }
            return acc;
        }, {});
        teacherNameMap[state.get('currentUserId')] = state.get('currentTeacherName');

        const totalStars = logs.reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);
        const totalClassQuestBonus = logs.reduce((sum, log) => sum + getQuestBonusFromLog(log), 0);
        const reasonCounts = logs.reduce((acc, log) => {
            const credit = getAwardLogMonthlyStarCredit(log);
            if (log.reason && credit > 0) acc[log.reason] = (acc[log.reason] || 0) + credit;
            return acc;
        }, {});
        const reasonEntries = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
        const topReason = reasonEntries.length ? reasonEntries[0][0] : null;
        const classStarCounts = logs.reduce((acc, log) => {
            const credit = getAwardLogMonthlyStarCredit(log);
            if (credit > 0) acc[log.classId] = (acc[log.classId] || 0) + credit;
            return acc;
        }, {});
        const classQuestBonusCounts = logs.reduce((acc, log) => {
            acc[log.classId] = (acc[log.classId] || 0) + getQuestBonusFromLog(log);
            return acc;
        }, {});
        const heroesCount = new Set(logs.map(l => l.studentId)).size;

        const topClassEntry = Object.entries(classStarCounts).sort((a, b) => b[1] - a[1])[0];
        const topClass = topClassEntry ? classById.get(topClassEntry[0]) : null;

        const tile = (tone, icon, label, value, sub = '') => `
            <div class="qc-log-tile qc-log-tile--${tone}">
                <span class="qc-log-tile__icon" aria-hidden="true">${icon}</span>
                <span class="qc-log-tile__label">${label}</span>
                <span class="qc-log-tile__value font-title">${value}</span>
                ${sub ? `<span class="qc-log-tile__sub">${sub}</span>` : ''}
            </div>`;

        const summaryHtml = `
            <section class="qc-log-summary" aria-label="Day summary">
                ${tile('stars', '<i class="fas fa-star"></i>', 'Stars', formatStars(totalStars), totalClassQuestBonus > 0 ? `+${totalClassQuestBonus} Class Quest` : '')}
                ${tile('heroes', '<i class="fas fa-user-group"></i>', 'Heroes', heroesCount, `${logs.length} award${logs.length === 1 ? '' : 's'}`)}
                ${tile('virtue', `<i class="fas ${reasonIcons[topReason] || 'fa-trophy'}"></i>`, 'Top virtue', topReason ? escapeLogText(reasonLabel(topReason)) : '—')}
                ${tile('class', topClass ? escapeLogText(topClass.logo || '🏫') : '<i class="fas fa-users"></i>', 'Top class', topClass ? escapeLogText(topClass.name) : '—')}
            </section>`;

        const reasonTotal = reasonEntries.reduce((sum, [, v]) => sum + v, 0);
        const mixHtml = reasonEntries.length > 1 ? `
            <section class="qc-log-mix" aria-label="Virtue mix">
                <div class="qc-log-mix__bar">
                    ${reasonEntries.map(([reason, value]) => `<span class="bg-gradient-to-r ${reasonColors[reason] || 'from-gray-400 to-gray-600'}" style="flex-grow:${value}" title="${escapeLogText(reasonLabel(reason))}: ${formatStars(value)} ⭐"></span>`).join('')}
                </div>
                <ul class="qc-log-mix__legend">
                    ${reasonEntries.map(([reason, value]) => `
                        <li><span class="qc-log-mix__dot bg-gradient-to-br ${reasonColors[reason] || 'from-gray-400 to-gray-600'}"></span>${escapeLogText(reasonLabel(reason))}<strong>${Math.round((value / reasonTotal) * 100)}%</strong></li>`).join('')}
                </ul>
            </section>` : '';

        const groupedByClass = logs.reduce((acc, log) => { (acc[log.classId] = acc[log.classId] || []).push(log); return acc; }, {});
        const myClassIdSet = new Set((state.get('allTeachersClasses') || []).map(c => c.id));
        const classIdsOrdered = Object.keys(groupedByClass).filter(id => classById.has(id));
        classIdsOrdered.sort((a, b) => {
            const aMine = myClassIdSet.has(a);
            const bMine = myClassIdSet.has(b);
            if (aMine !== bMine) return aMine ? -1 : 1;
            return (classById.get(a)?.name || '').localeCompare(classById.get(b)?.name || '');
        });
        const hasMine = classIdsOrdered.some(id => myClassIdSet.has(id));
        const hasOthers = classIdsOrdered.some(id => !myClassIdSet.has(id));

        const toolbarHtml = `
            <div class="qc-log-tools">
                <label class="qc-log-search">
                    <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                    <input type="search" class="qc-log-search__input" placeholder="Find a hero…" aria-label="Find a student in this log" autocomplete="off">
                </label>
                ${hasMine && hasOthers ? `
                <div class="qc-log-filter" role="group" aria-label="Which classes">
                    <button type="button" class="qc-log-filter__btn is-active" data-log-filter="all" aria-pressed="true">All classes</button>
                    <button type="button" class="qc-log-filter__btn" data-log-filter="mine" aria-pressed="false">My classes</button>
                </div>` : ''}
                ${classIdsOrdered.length > 1 ? `
                <button type="button" class="qc-log-toggle-all" data-log-action="toggle-all" data-expanded="false">
                    <i class="fas fa-up-right-and-down-left-from-center" aria-hidden="true"></i><span>Expand all</span>
                </button>` : ''}
            </div>
            <p class="qc-log-noresults hidden">No hero by that name in this log.</p>`;

        const currentUserId = state.get('currentUserId');
        const adventureLogs = state.get('allAdventureLogs') || [];
        let detailsHtml = '<div class="qc-log-classes">';
        for (const classId of classIdsOrdered) {
            const classInfo = classById.get(classId);
            const classQuestBonus = classQuestBonusCounts[classId] || 0;
            const isMyClass = myClassIdSet.has(classId);
            const palette = (classInfo.color && classInfo.color.bg)
                ? classInfo.color
                : constants.classColorPalettes[utils.simpleHashCode(classId) % constants.classColorPalettes.length];
            const entries = groupedByClass[classId].slice().sort((a, b) =>
                (studentById.get(a.studentId)?.name || 'Z').localeCompare(studentById.get(b.studentId)?.name || 'Z'));
            const dayAdventureLog = adventureLogs.find(l => l.classId === classId && utils.datesMatch(l.date, dateString));
            const openByDefault = isMyClass || classIdsOrdered.length === 1;

            detailsHtml += `
                <details class="log-class-section qc-log-class ${palette.border}${isMyClass ? ' qc-log-class--mine' : ''}" data-mine="${isMyClass ? '1' : '0'}" ${openByDefault ? 'open' : ''}>
                    <summary class="log-class-section__summary qc-log-class__summary">
                        <span class="qc-log-class__logo ${palette.bg} ${palette.border}" aria-hidden="true">${escapeLogText(classInfo.logo || '🏫')}</span>
                        <span class="qc-log-class__name">
                            <span class="font-title">${escapeLogText(classInfo.name)}</span>
                            <span class="qc-log-class__meta">
                                ${isMyClass ? '<span class="qc-log-class__mine">Your class</span>' : `<span>${escapeLogText(classInfo.createdBy?.name || 'Another teacher')}</span>`}
                                <span>${entries.length} award${entries.length === 1 ? '' : 's'}</span>
                            </span>
                        </span>
                        <span class="qc-log-class__totals">
                            ${(classStarCounts[classId] || 0) > 0 ? `<span class="qc-log-class__stars"><i class="fas fa-star" aria-hidden="true"></i>${formatStars(classStarCounts[classId])}</span>` : ''}
                            ${classQuestBonus > 0 ? `<span class="qc-log-class__bonus">+${classQuestBonus} Quest</span>` : ''}
                        </span>
                        <span class="log-class-section__chevron qc-log-class__chevron" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>
                    </summary>
                    <ol class="log-class-section__body qc-log-class__body">`;

            entries.forEach((log, idx) => {
                const student = studentById.get(log.studentId);
                const studentName = student?.name || '?';
                const isDayHero = dayAdventureLog && dayAdventureLog.hero === student?.name;
                const teacherName = log.createdBy?.name || teacherNameMap[log.teacherId] || 'a teacher';
                const gradientClass = reasonColors[log.reason] || 'from-gray-400 to-gray-600';
                const reasonIcon = reasonIcons[log.reason] || 'fa-star';
                const isMine = log.teacherId === currentUserId;
                const canDelete = isMine && !['story_weaver', 'vanishing_hoard', 'torn_map', 'round_table', 'scholar_s_bonus'].includes(log.reason);
                const noteHtml = log.note ? `<p class="qc-log-entry__note"><i class="fas fa-quote-left" aria-hidden="true"></i>${escapeLogText(log.note)}</p>` : '';

                detailsHtml += `
                    <li class="log-entry qc-log-entry${isDayHero ? ' qc-log-entry--hero' : ''}" id="log-entry-${escapeLogText(log.id)}" data-student-name="${escapeLogText(studentName.toLowerCase())}" style="--i:${Math.min(idx, 12)}">
                        <span class="qc-log-entry__gem bg-gradient-to-br ${gradientClass}" aria-hidden="true"><i class="fas ${reasonIcon}"></i></span>
                        <div class="qc-log-entry__main">
                            <div class="qc-log-entry__line">
                                <span class="qc-log-entry__name">${isDayHero ? '<i class="fas fa-crown" title="Hero of the day" aria-label="Hero of the day"></i>' : ''}${escapeLogText(studentName)}</span>
                                <span class="qc-log-entry__reason">${escapeLogText(reasonLabel(log.reason))}</span>
                            </div>
                            <p class="qc-log-entry__by">Awarded by <strong>${escapeLogText(teacherName)}</strong></p>
                            ${noteHtml}
                        </div>
                        <div class="qc-log-entry__reward">${getLogRewardMarkup(log)}</div>
                        ${isMine ? `
                        <div class="qc-log-entry__actions">
                            <button type="button" class="note-log-btn qc-log-entry__btn qc-log-entry__btn--note" data-log-id="${escapeLogText(log.id)}" title="${log.note ? 'Edit note' : 'Add note'}" aria-label="${log.note ? 'Edit note' : 'Add note'} for ${escapeLogText(studentName)}">
                                <i class="fas fa-${log.note ? 'pen' : 'sticky-note'}" aria-hidden="true"></i>
                            </button>
                            ${canDelete ? `
                            <button type="button" class="delete-log-btn qc-log-entry__btn qc-log-entry__btn--delete" data-log-id="${escapeLogText(log.id)}" data-student-id="${escapeLogText(log.studentId)}" data-stars="${escapeLogText(log.stars)}" title="Delete entry" aria-label="Delete award for ${escapeLogText(studentName)}">
                                <i class="fas fa-trash-alt" aria-hidden="true"></i>
                            </button>` : ''}
                        </div>` : ''}
                    </li>`;
            });
            detailsHtml += `</ol></details>`;
        }
        detailsHtml += '</div>';
        contentEl.innerHTML = summaryHtml + mixHtml + toolbarHtml + detailsHtml;
        syncLogbookToggleAll(contentEl);
    }

    if (!isOndemand && !wasOpen) {
        showAnimatedModal('logbook-modal');
    }
}

function syncLogbookToggleAll(contentEl) {
    const btn = contentEl.querySelector('[data-log-action="toggle-all"]');
    if (!btn) return;
    const sections = [...contentEl.querySelectorAll('.qc-log-class:not(.hidden)')];
    const allOpen = sections.length > 0 && sections.every(d => d.open);
    btn.dataset.expanded = allOpen ? 'true' : 'false';
    const label = btn.querySelector('span');
    if (label) label.textContent = allOpen ? 'Collapse all' : 'Expand all';
    const icon = btn.querySelector('i');
    if (icon) icon.className = `fas ${allOpen ? 'fa-down-left-and-up-right-to-center' : 'fa-up-right-and-down-left-from-center'}`;
}

export function syncLogbookToggleAllState() {
    const contentEl = document.getElementById('logbook-modal-content');
    if (contentEl) syncLogbookToggleAll(contentEl);
}

/** Search, class filter and expand/collapse for the open Quest Log. */
export function applyLogbookFilters() {
    const contentEl = document.getElementById('logbook-modal-content');
    if (!contentEl) return;
    const query = (contentEl.querySelector('.qc-log-search__input')?.value || '').trim().toLowerCase();
    const mineOnly = contentEl.querySelector('.qc-log-filter__btn.is-active')?.dataset.logFilter === 'mine';
    let visibleEntries = 0;
    contentEl.querySelectorAll('.qc-log-class').forEach(section => {
        const classVisible = !mineOnly || section.dataset.mine === '1';
        let matches = 0;
        section.querySelectorAll('.qc-log-entry').forEach(entry => {
            const hit = !query || (entry.dataset.studentName || '').includes(query);
            entry.classList.toggle('hidden', !hit);
            if (hit) matches += 1;
        });
        const show = classVisible && matches > 0;
        section.classList.toggle('hidden', !show);
        if (show && query) section.open = true;
        if (show) visibleEntries += matches;
    });
    contentEl.querySelector('.qc-log-noresults')?.classList.toggle('hidden', visibleEntries > 0);
    syncLogbookToggleAll(contentEl);
}

export function handleLogbookToolbarClick(target) {
    const contentEl = document.getElementById('logbook-modal-content');
    if (!contentEl) return false;
    const filterBtn = target.closest('[data-log-filter]');
    if (filterBtn) {
        contentEl.querySelectorAll('[data-log-filter]').forEach(btn => {
            const on = btn === filterBtn;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyLogbookFilters();
        return true;
    }
    const toggle = target.closest('[data-log-action="toggle-all"]');
    if (toggle) {
        const open = toggle.dataset.expanded !== 'true';
        contentEl.querySelectorAll('.qc-log-class:not(.hidden)').forEach(d => { d.open = open; });
        syncLogbookToggleAll(contentEl);
        return true;
    }
    return false;
}

/** Reflect a saved award note in the open Quest Log without re-rendering it. */
export function updateLogbookEntryNote(logId, note) {
    const entry = document.getElementById(`log-entry-${logId}`);
    const main = entry?.querySelector('.qc-log-entry__main');
    if (!main) return;
    main.querySelector('.qc-log-entry__note')?.remove();
    const text = String(note || '').trim();
    if (text) main.insertAdjacentHTML('beforeend', `<p class="qc-log-entry__note"><i class="fas fa-quote-left" aria-hidden="true"></i>${escapeLogText(text)}</p>`);
    const btn = entry.querySelector('.note-log-btn');
    if (btn) {
        btn.title = text ? 'Edit note' : 'Add note';
        const icon = btn.querySelector('i');
        if (icon) icon.className = `fas fa-${text ? 'pen' : 'sticky-note'}`;
    }
}

/** After an entry is removed: drop empty class groups, or show the quiet-day state. */
export function tidyLogbookAfterRemoval() {
    const modal = document.getElementById('logbook-modal');
    const contentEl = document.getElementById('logbook-modal-content');
    if (!modal || !contentEl) return;
    contentEl.querySelectorAll('.qc-log-class').forEach(section => {
        if (!section.querySelector('.qc-log-entry')) section.remove();
    });
    if (!contentEl.querySelector('.qc-log-entry')) {
        contentEl.innerHTML = logbookEmptyStateHtml(modal.dataset.date || utils.getTodayDateString());
    } else {
        applyLogbookFilters();
    }
}

export function openHistoryModal(type, options = {}) {
    // Hero history lives in Hero Logs; Team Quest history is the League Archive.
    if (type === 'hero') {
        import('./rankings.js').then(m => m.openStudentRankingsModal());
        return;
    }
    import('./leagueArchive.js').then(m => m.openLeagueArchive({ league: options.league || null }));
}
