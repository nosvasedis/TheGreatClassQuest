// ui/tabs/raidCalendar.js — the Realm Raid on the Quest Calendar and in the Planner.
// The raid week marks its days, the month strip carries a chip, the phone day view and the Planner
// show a banner; every one opens the Raid Hall on that raid (features/realmRaid.js#openRealmRaid).
import { quietly } from '../../utils/runtimeMetrics.js';
import * as state from '../../state.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { raidDayOf, raidsInMonth, raidOn, raidOutcome, RAID_LENGTH_DAYS, RAID_HERALD_DAYS, daysBetween } from '../../features/realmRaidCore.mjs';
import '../../styles/realm_raid_calendar.css';

export function raidCalendarOptions() {
    return { holidays: state.get('schoolHolidayRanges') || [], closeDate: state.get('schoolYearState')?.closeDate || null };
}

/** What a raid looks like from today, for chips and banners: { word, tone }. */
function raidCalendarState(raid, now = new Date()) {
    const seen = raidOn(raid, now);
    if (seen.phase === 'herald') {
        const days = seen.daysToStart;
        return { word: days <= 7 ? (days === 1 ? 'Tomorrow!' : `In ${days} days`) : 'Coming', tone: 'soon', seen };
    }
    if (seen.phase === 'active') return { word: seen.daysLeft === 0 ? 'Last day!' : 'On now', tone: 'live', seen };
    const receipts = (state.get('allSchoolClasses') || []).map((c) => c.realmRaids?.[raid.raidId]);
    const outcome = raidOutcome({ receipts });
    return { word: outcome === 'legendary' ? 'Legendary!' : outcome === 'won' ? 'Won' : 'Shield held', tone: outcome, seen };
}

/** The ribbon on a raid day tile. */
export function raidRibbonHtml(raidDay) {
    if (!raidDay) return '';
    const { raid, dayNumber, first, last } = raidDay;
    const label = first ? `${raid.season.name.replace(/^The /, '')} · turn 1` : last ? `Final turn!` : `Raid · turn ${dayNumber}`;
    return `<button type="button" class="qc-day__raid" data-raid-open="${escapeHtml(raid.raidId)}" title="${escapeHtml(`${raid.season.name}: turn ${dayNumber} of ${RAID_LENGTH_DAYS}. Every star any class earns hits the boss. Click to open the battle.`)}" aria-label="${escapeHtml(`${raid.season.name}, turn ${dayNumber} of ${RAID_LENGTH_DAYS}. Open the Raid Hall`)}">
        <span class="qc-day__raid-icon" aria-hidden="true">${escapeHtml(raid.season.emoji)}</span><span class="qc-day__raid-name">${escapeHtml(label)}</span><span class="qc-day__raid-sw" aria-hidden="true">⚔️</span>
    </button>`;
}

export function raidDayClasses(raidDay) {
    if (!raidDay) return [];
    return ['qc-day--raid', `qc-day--raid-${raidDay.raid.season.id}`, raidDay.first ? 'qc-day--raid-first' : '', raidDay.last ? 'qc-day--raid-last' : ''].filter(Boolean);
}

/** Chips for the raids that touch this month, for the month strip. */
export function raidChipsHtml(year, month) {
    return raidsInMonth(year, month, raidCalendarOptions()).map((raid) => {
        const look = raidCalendarState(raid);
        const range = `${raid.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${raid.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
        const blurb = look.tone === 'soon'
            ? `A 5-turn boss battle, Monday to Friday. The whole school is one party: every star any class earns hits ${raid.season.guardian}.`
            : look.tone === 'live'
                ? `The battle is on! Turn ${look.seen.dayNumber} of ${RAID_LENGTH_DAYS}. Every star any class earns hits the boss.`
                : look.tone === 'held'
                    ? `The shield held this time. ${raid.season.guardian} bowed and comes back next term.`
                    : `The whole school broke the shield together.`;
        return `<li class="qc-raid-chip qc-raid-chip--${escapeHtml(raid.season.id)} is-${escapeHtml(look.tone)}">
            <button type="button" class="qc-raid-chip__btn" data-raid-open="${escapeHtml(raid.raidId)}" aria-label="${escapeHtml(`${raid.season.name}, ${range}: ${look.word}. Open the Raid Hall`)}">
                <span class="qc-raid-chip__date"><b>${escapeHtml(String(raid.start.getDate()))}–${escapeHtml(String(raid.end.getDate()))}</b><small>${escapeHtml(raid.end.toLocaleDateString('en-GB', { month: 'short' }))}</small></span>
                <span class="qc-raid-chip__icon" aria-hidden="true">${escapeHtml(raid.season.emoji)}</span>
                <span class="qc-raid-chip__name">Realm Raid · ${escapeHtml(raid.season.name.replace(/^The /, ''))}</span>
                <span class="qc-raid-chip__tag">${look.tone === 'live' ? '<span class="qc-raid-chip__pulse" aria-hidden="true"></span>' : ''}${escapeHtml(look.word)}</span>
            </button>
            <span class="qc-special-tip qc-raid-tip" role="tooltip">
                <span class="qc-special-tip__icon" aria-hidden="true">🛡️</span>
                <span class="qc-special-tip__body">
                    <strong>${escapeHtml(raid.season.title)}</strong>
                    <span class="qc-special-tip__when"><i class="fas fa-calendar-day" aria-hidden="true"></i> ${escapeHtml(range)} · ${RAID_LENGTH_DAYS} days</span>
                    <span class="qc-special-tip__blurb">${escapeHtml(blurb)}</span>
                    <span class="qc-special-tip__hint">Click to open the Raid Hall</span>
                </span>
            </span>
        </li>`;
    }).join('');
}

/** The raid banner on the phone day view and in the Planner: the raid day, or the herald week. */
export function raidDayBannerHtml(date, { compact = false } = {}) {
    const options = raidCalendarOptions();
    const raidDay = raidDayOf(date, options);
    let raid = raidDay?.raid || null;
    let line = '';
    if (raidDay) {
        line = raidDay.first ? `Turn 1 of ${RAID_LENGTH_DAYS}: the boss battle begins! Every star hits.`
            : raidDay.last ? `Final turn! Every star still hits the boss.`
                : `Turn ${raidDay.dayNumber} of ${RAID_LENGTH_DAYS}. Every star any class earns hits the boss.`;
    } else {
        // The herald week: the days just before a raid.
        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const soon = [...raidsInMonth(date.getFullYear(), date.getMonth(), options), ...raidsInMonth(date.getFullYear(), date.getMonth() + 1, options)]
            .find((r) => { const gap = daysBetween(day, r.start); return gap > 0 && gap <= RAID_HERALD_DAYS; });
        if (!soon) return '';
        raid = soon;
        const gap = daysBetween(day, soon.start);
        line = `${soon.season.guardian} arrives ${gap === 1 ? 'tomorrow' : `in ${gap} days`}. Raid week: ${soon.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${soon.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`;
    }
    return `<button type="button" class="qc-raid-banner qc-raid-banner--${escapeHtml(raid.season.id)}${raidDay ? '' : ' is-herald'}${compact ? ' is-compact' : ''}" data-raid-open="${escapeHtml(raid.raidId)}">
        <span class="qc-raid-banner__icon" aria-hidden="true">${escapeHtml(raid.season.emoji)}</span>
        <span class="qc-raid-banner__body">
            <span class="qc-raid-banner__kicker">Realm Raid · ${escapeHtml(raid.season.name.replace(/^The /, ''))}</span>
            <span class="qc-raid-banner__line">${escapeHtml(line)}</span>
        </span>
        <span class="qc-raid-banner__go">⚔️ Battle <i class="fas fa-chevron-right" aria-hidden="true"></i></span>
    </button>`;
}

let raidClicksWired = false;
/** One capture listener: a raid ribbon, chip or banner opens the Raid Hall, never the day under it. */
export function wireRaidClicks() {
    if (raidClicksWired || typeof document === 'undefined') return;
    raidClicksWired = true;
    document.addEventListener('click', (event) => {
        const btn = event.target.closest?.('[data-raid-open]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        import('../../features/realmRaid.js')
            .then(({ openRealmRaid }) => openRealmRaid({ raidId: btn.dataset.raidOpen }))
            .catch(quietly('ui/tabs/selectors.js'));
    }, true);
}

