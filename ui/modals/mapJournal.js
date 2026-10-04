// /ui/modals/mapJournal.js — the Map Journal page in Team History (League Archive).
// One page per class of yours: every month of the school year so far, with a stamp for each
// realm the class reached for the first time that month (see features/realmMoments.js).
import '../../styles/realm_moments.css';
import * as state from '../../state.js';
import { getSchoolYearStartMonthDate } from '../../utils/schoolYear.js';
import { buildJournalYear, journalTotals, monthKeysSince, realmMonthKey } from '../../features/realmMomentsCore.mjs';

const BADGES = {
    silver: new URL('../../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    gold: new URL('../../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    crystal: new URL('../../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href
};

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function monthShort(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short' });
}

function dayLabel(dateKey) {
    const [y, m, d] = String(dateKey || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(y, m - 1, d).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}

function pageHtml(classData, monthKeys) {
    const rows = buildJournalYear(classData, monthKeys);
    const totals = journalTotals(rows);
    const current = realmMonthKey();
    const rowHtml = [...rows].reverse().map((row) => `
        <li class="mj-row${row.monthKey === current ? ' is-current' : ''}">
            <span class="mj-row__month">${esc(monthShort(row.monthKey))}</span>
            <span class="mj-row__stamps">${row.stamps.map((s) => `
                <span class="mj-stamp mj-stamp--${s.id}${s.stamp ? ' is-stamped' : ''}" title="${s.stamp ? `${esc(s.label)}: reached ${esc(dayLabel(s.stamp.date))}` : `${esc(s.label)}: not reached`}">
                    <img src="${BADGES[s.id]}" alt="" aria-hidden="true" loading="lazy" decoding="async">
                    ${s.stamp ? esc(dayLabel(s.stamp.date)) : '—'}
                </span>`).join('')}
            </span>
        </li>`).join('');
    return `
        <article class="mj-page">
            <header class="mj-page__head">
                <span class="mj-page__logo" aria-hidden="true">${esc(classData.logo || '📚')}</span>
                <span>
                    <strong class="mj-page__name font-title">${esc(classData.name || 'Class')}</strong>
                    <span class="mj-page__league">${esc(classData.questLevel || '')} League</span>
                </span>
                <span class="mj-page__totals" aria-label="Realms reached this year">
                    ${['silver', 'gold', 'crystal'].map((id) => `<span class="mj-total" title="${totals[id]} ${id === 'silver' ? 'Silver Peaks' : id === 'gold' ? 'Golden Citadel' : 'Crystal Realm'} this year"><img src="${BADGES[id]}" alt="" aria-hidden="true">${totals[id]}</span>`).join('')}
                </span>
            </header>
            <ol class="mj-rows">${rowHtml}</ol>
        </article>`;
}

/** Inner HTML for the archive content area. `league` is a league name or 'all'. */
export function renderMapJournalHtml({ league = 'all', query = '' } = {}) {
    const start = getSchoolYearStartMonthDate(state.getActiveSchoolYearStartDate(), state.getActiveSchoolYearKey());
    const monthKeys = monthKeysSince(start ? new Date(start) : null);
    const q = String(query || '').trim().toLowerCase();
    const classes = (state.get('allTeachersClasses') || [])
        .filter((c) => league === 'all' || c.questLevel === league)
        .filter((c) => !q || String(c.name || '').toLowerCase().includes(q))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const intro = `<p class="mj-intro"><i class="fas fa-book-open" aria-hidden="true"></i><span>Each month a party reaches a new realm, the Map Journal stamps the day it arrived.</span></p>`;
    if (!classes.length) return `${intro}<p class="mj-empty">No classes of yours ${league === 'all' ? '' : `in the ${esc(league)} League `}to show yet.</p>`;
    return `${intro}<div class="mj-pages">${classes.map((c) => pageHtml(c, monthKeys)).join('')}</div>`;
}
