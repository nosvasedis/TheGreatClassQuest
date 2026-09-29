// /ui/modals/calendarDay.js
// One entry point for "open this calendar day": decides between the Planner and the
// Quest Log, steps day by day inside them, and swaps between the two.
import * as utils from '../../utils.js';
import { hideModal } from './base.js';
import { openDayPlannerModal } from './planner.js';
import { showLogbookModal } from './log.js';

const PLANNER_ID = 'day-planner-modal';
const LOG_ID = 'logbook-modal';
const LIVE_LOG_WINDOW_DAYS = 30;

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isOpen(id) {
    const el = document.getElementById(id);
    return Boolean(el && !el.classList.contains('hidden'));
}

function dayOf(dateString) {
    return startOfDay(utils.parseDDMMYYYY(dateString));
}

/** Logs older than the live window are fetched on demand. */
function needsOnDemandLogs(dateString) {
    const cutoff = startOfDay(new Date());
    cutoff.setDate(cutoff.getDate() - LIVE_LOG_WINDOW_DAYS);
    return dayOf(dateString) < cutoff;
}

export function openCalendarDayLog(dateString) {
    if (dayOf(dateString) > startOfDay(new Date())) return openCalendarDayPlanner(dateString);
    if (isOpen(PLANNER_ID)) hideModal(PLANNER_ID);
    return showLogbookModal(dateString, needsOnDemandLogs(dateString));
}

export function openCalendarDayPlanner(dateString, dayCell = null, options = {}) {
    if (isOpen(LOG_ID)) hideModal(LOG_ID);
    return openDayPlannerModal(dateString, dayCell, options);
}

/**
 * Past days open the Quest Log (what happened); today and later open the Planner
 * (what will happen). Both modals can switch to the other one from their header.
 */
export function openCalendarDay(dateString, dayCell = null) {
    if (!dateString) return;
    if (dayOf(dateString) < startOfDay(new Date())) return openCalendarDayLog(dateString);
    return openCalendarDayPlanner(dateString, dayCell);
}

/** Step the open Planner / Quest Log by `step` days, staying in the same modal where it makes sense. */
export function stepCalendarDay(step) {
    const inLog = isOpen(LOG_ID);
    const modal = document.getElementById(inLog ? LOG_ID : PLANNER_ID);
    const current = modal?.dataset.date;
    if (!current) return;
    const next = dayOf(current);
    next.setDate(next.getDate() + step);
    const nextString = utils.getDDMMYYYY(next);
    if (inLog) return openCalendarDayLog(nextString);
    return openDayPlannerModal(nextString, document.querySelector(`.calendar-day-cell[data-date="${nextString}"]`));
}

export function isCalendarDayModalOpen() {
    return isOpen(PLANNER_ID) || isOpen(LOG_ID);
}
