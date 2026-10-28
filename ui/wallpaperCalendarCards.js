// /ui/wallpaperCalendarCards.js — Projector Mode (The Director): the school calendar cards.
// They read the merged school calendar (utils/schoolCalendar.mjs: the built-in Greek school
// calendar plus the School Office's own breaks), so the projector names the same holidays and
// celebration days as Home and the Quest Calendar: the next holiday, the countdown before a
// break, a welcome back after one, today's (or this week's) special day with its Day Treasure,
// and the class's real next lesson. Every builder returns null when it has nothing to show.
import * as state from '../state.js';
import * as utils from '../utils.js';
import { escapeCardText as esc } from './wallpaperDeck.mjs';
import { addDaysIso, daysBetweenIso, describeSchoolDay, findClosureRange, toIsoDay, upcomingSchoolDays } from '../utils/schoolCalendar.mjs';

export const CALENDAR_CARD_TYPES = Object.freeze(['holiday', 'pre_holiday_hype', 'post_holiday_welcome', 'special_day', 'next_lesson']);

const todayIso = (now = new Date()) => toIsoDay(now);

function isoToDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function dayLabel(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
    return isoToDate(iso).toLocaleDateString('en-GB', opts);
}

function rangeLabel(range) {
    if (range.start === range.end) return dayLabel(range.start, { weekday: 'long', day: 'numeric', month: 'long' });
    return `${dayLabel(range.start, { day: 'numeric', month: 'short' })} – ${dayLabel(range.end, { day: 'numeric', month: 'short' })}`;
}

/** The closure going on today, else the next one (within `maxDays`). */
export function nextClosure(now = new Date(), maxDays = 120) {
    const today = todayIso(now);
    const ranges = state.get('schoolHolidayRanges') || [];
    const ongoing = findClosureRange(today, ranges);
    if (ongoing) return { range: ongoing, inDays: 0, ongoing: true };
    const next = ranges
        .filter((r) => r?.start && toIsoDay(r.start) > today)
        .sort((a, b) => toIsoDay(a.start).localeCompare(toIsoDay(b.start)))[0];
    if (!next) return null;
    const inDays = daysBetweenIso(today, toIsoDay(next.start));
    return inDays <= maxDays ? { range: next, inDays, ongoing: false } : null;
}

/** What a closure is called and looks like (a single holiday or a whole break). */
function closureLook(range) {
    const special = describeSchoolDay(range.start).headline || {};
    const days = daysBetweenIso(toIsoDay(range.start), toIsoDay(range.end)) + 1;
    return {
        name: range.name || special.name || 'School holiday',
        icon: range.icon || special.icon || '🏖️',
        blurb: range.blurb || special.blurb || '',
        days,
        single: days === 1
    };
}

/** True on the first school day back after a break of three days or more. */
export function isBackFromBreak(now = new Date()) {
    return describeSchoolDay(todayIso(now)).breakEdge?.edge === 'back-from';
}

/** The celebration (lessons as usual) today or within the week, from the school calendar. */
export function celebrationSoon(now = new Date(), days = 7) {
    return upcomingSchoolDays(now, { holidayDays: 0, celebrationDays: days }).celebration;
}

// ─── Cards ──────────────────────────────────────────────────────────────────

function holidayCard(now = new Date()) {
    const next = nextClosure(now);
    if (!next) return null;
    const look = closureLook(next.range);
    return {
        sigil: look.icon,
        title: next.ongoing ? 'No lessons today' : (look.single ? 'Next holiday' : 'Next school break'),
        html: `<div class="qc-festival"><span class="qc-festival__emoji">${esc(look.icon)}</span></div>
            <p class="sc-big">${esc(look.name)}</p>
            <p class="sc-sub">${esc(rangeLabel(next.range))}${look.single ? '' : ` · ${look.days} days`}</p>
            ${next.ongoing ? '' : `<div class="sc-chips sc-chips--big"><span class="sc-chip">${next.inDays === 1 ? 'Tomorrow!' : `in ${next.inDays} days`}</span></div>`}
            ${look.blurb ? `<p class="sc-text">${esc(look.blurb)}</p>` : ''}`
    };
}

function preHolidayHype(now = new Date()) {
    const next = nextClosure(now, 7);
    if (!next || next.ongoing || next.inDays < 1) return null;
    const look = closureLook(next.range);
    // School days left before the break (weekends do not count).
    let lessonsLeft = 0;
    for (let iso = addDaysIso(todayIso(now), 1); iso < toIsoDay(next.range.start); iso = addDaysIso(iso, 1)) {
        const wd = isoToDate(iso).getDay();
        if (wd !== 0 && wd !== 6) lessonsLeft += 1;
    }
    return {
        sigil: '🎊',
        title: 'Holiday countdown',
        html: `<div class="qc-festival"><span class="qc-festival__emoji">${esc(look.icon)}</span></div>
            <p class="sc-big sc-big--xl"><b>${next.inDays}</b></p>
            <p class="sc-big sc-big--sm">${next.inDays === 1 ? 'day' : 'days'} until ${esc(look.name)}!</p>
            <p class="sc-sub">${lessonsLeft === 0 ? 'Today is the last school day before it!' : `${lessonsLeft} more school ${lessonsLeft === 1 ? 'day' : 'days'} after today`}</p>`
    };
}

function postHolidayWelcome(now = new Date()) {
    const edge = describeSchoolDay(todayIso(now)).breakEdge;
    const look = edge?.edge === 'back-from' ? closureLook(edge.range) : null;
    return {
        sigil: '🎒',
        title: 'Welcome back!',
        html: `<div class="qc-festival"><span class="qc-festival__emoji">🎒</span></div>
            <p class="sc-big sc-big--sm">Great to see you again!</p>
            <p class="sc-sub">${look ? `${esc(look.icon)} We're back from the ${esc(look.name.replace(/^the\s+/i, ''))}.` : 'The quest missed its heroes.'}</p>
            <p class="sc-text">Ready for new adventures? Every star today counts for this month's quest!</p>`
    };
}

/** Today's (or this week's) celebration, and the class's Day Treasure chest when it has one. */
async function specialDay(classId, now = new Date()) {
    const today = todayIso(now);
    let treasure = null;
    if (classId) {
        const { treasuresOn, isTreasureOpened } = await import('../features/dayTreasure.js');
        const event = treasuresOn(utils.getTodayDateString(), [classId])[0];
        if (event) {
            const cls = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
            const receipt = cls?.dayTreasures?.[event.id] || null;
            treasure = { name: event.details?.title || receipt?.name || 'Day Treasure', opened: isTreasureOpened(event), total: Number(receipt?.total) || 0 };
        }
    }
    // A chest today belongs to today's day; otherwise the celebration of today or this week.
    const soon = treasure ? { special: describeSchoolDay(today).headline, inDays: 0, iso: today } : celebrationSoon(now);
    const special = soon?.special || null;
    const inDays = soon ? soon.inDays : 0;
    if (!special && !treasure) return null;
    const isToday = inDays === 0;
    const colors = Array.isArray(special?.colors) ? special.colors : null;
    const style = colors ? ` style="--sd-a:${esc(colors[0])};--sd-b:${esc(colors[1])};--sd-ink:${esc(colors[2])}"` : '';
    const chest = treasure && isToday
        ? `<div class="qc-prize"><span class="qc-prize__icon">${treasure.opened ? '💰' : '🧰'}</span><span>
                <small>${treasure.opened ? 'Day Treasure opened' : 'Day Treasure waiting'}</small>
                <b>${esc(treasure.name)}${treasure.opened && treasure.total ? ` · ${treasure.total} Gold found` : ''}</b>
            </span></div>`
        : '';
    return {
        sigil: special?.icon || '🎁',
        title: isToday ? 'Today is a special day' : 'A special day is coming',
        html: `<div class="qc-special"${style}>
                <span class="qc-festival__emoji">${esc(special?.icon || '🎁')}</span>
                <p class="sc-big">${esc(special?.name || 'A treasure day!')}</p>
                ${isToday ? '' : `<p class="sc-sub">${esc(dayLabel(soon.iso, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${inDays === 1 ? 'tomorrow' : `in ${inDays} days`}</p>`}
            </div>
            ${special?.blurb ? `<p class="sc-text">${esc(special.blurb)}</p>` : ''}
            ${chest}`
    };
}

/** The class's next real lesson: holidays, cancelled and one-time lessons included. */
function nextLesson(classId, now = new Date()) {
    const classes = state.get('allSchoolClasses') || [];
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return null;
    const holidays = state.get('schoolHolidayRanges') || [];
    const next = utils.getNextLessonDate(
        classId, classes, state.get('allScheduleOverrides') || [], holidays,
        state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}, new Date(now) // it moves the date it is given
    );
    if (!next) return null;
    const date = utils.parseDDMMYYYY(next);
    const iso = toIsoDay(date);
    const inDays = daysBetweenIso(todayIso(now), iso);
    // A break between today and the next lesson is worth naming.
    let gap = null;
    for (let day = addDaysIso(todayIso(now), 1); day < iso && !gap; day = addDaysIso(day, 1)) {
        const closure = findClosureRange(day, holidays);
        if (closure) gap = closureLook(closure);
    }
    const special = describeSchoolDay(iso).headline;
    const time = cls.timeStart || '';
    return {
        sigil: '📅',
        title: 'Our next adventure',
        html: `<p class="sc-big">${esc(date.toLocaleDateString('en-GB', { weekday: 'long' }))}</p>
            <p class="sc-sub">${esc(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }))}${time ? ` · ${esc(time)}` : ''} · ${inDays === 1 ? 'tomorrow' : `in ${inDays} days`}</p>
            ${gap ? `<p class="sc-text">${esc(gap.icon)} After ${esc(gap.name)}. Rest well, heroes!</p>` : ''}
            ${special && !special.closed ? `<div class="sc-chips"><span class="sc-chip">${esc(special.icon)} ${esc(special.name)}</span></div>` : ''}`
    };
}

/** Builds one calendar card (may be async), or null. */
export async function hydrateCalendarCard(baseType, classId) {
    switch (baseType) {
        case 'holiday': return holidayCard();
        case 'pre_holiday_hype': return preHolidayHype();
        case 'post_holiday_welcome': return postHolidayWelcome();
        case 'special_day': return specialDay(classId);
        case 'next_lesson': return classId ? nextLesson(classId) : null;
        default: return null;
    }
}
