// /features/ceremony.js's start-up half: the glowing "ceremony ready" hints on the nav buttons.
// Small and eager on purpose; the ceremony itself (features/ceremony.js) loads when it is opened.
import * as state from '../state.js';
import { resolvePendingCeremonyMonth } from './ceremonyDomain.js';
import { getCeremonyStarVerdict, ensureCeremonyStarVerdict } from './ceremonyStarCheck.js';

export function getCeremonyMonthBounds(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    return { monthStart, monthEnd };
}

export function normalizeCreatedAt(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function existedByMonthEnd(record, monthKey) {
    const createdAt = normalizeCreatedAt(record?.createdAt);
    if (!createdAt) return true;
    return createdAt <= getCeremonyMonthBounds(monthKey).monthEnd;
}


export function updateCeremonyStatus() {
    const teamQuestBtn = document.querySelector('.nav-button[data-tab="class-leaderboard-tab"]');
    const heroChallengeBtn = document.querySelector('.nav-button[data-tab="student-leaderboard-tab"]');
    const homeBtn = document.querySelector('.nav-button[data-tab="about-tab"]');
    
    if (!teamQuestBtn || !heroChallengeBtn || !homeBtn) return;
    
    teamQuestBtn.classList.remove('ceremony-ready-pulse');
    heroChallengeBtn.classList.remove('ceremony-ready-pulse');
    homeBtn.classList.remove('ceremony-star-ring');

    const currentClassId = state.get('globalSelectedClassId');
    if (!currentClassId) return;

    const classData = state.get('allSchoolClasses').find(c => c.id === currentClassId);
    if (!classData) return;

    const pending = resolvePendingCeremonyMonth(new Date());
    if (!pending) return;

    const history = classData.ceremonyHistory || {};
    const isComplete = history[pending.monthKey] && history[pending.monthKey].complete;
    
    if (isComplete || !existedByMonthEnd(classData, pending.monthKey)) return;
    // No stars that month (undone test stars included) means no ceremony to call for.
    const verdict = getCeremonyStarVerdict(currentClassId, pending.monthKey);
    if (verdict === true) {
        homeBtn.classList.add('ceremony-star-ring');
    } else if (verdict === undefined) {
        ensureCeremonyStarVerdict(currentClassId, pending.monthKey).then((hasStars) => {
            if (hasStars && state.get('globalSelectedClassId') === currentClassId) updateCeremonyStatus();
        });
    }
}

