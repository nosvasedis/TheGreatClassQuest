// features/legendQuestCore.mjs — the Legend Quest: a one-time personal challenge at the top of a finished Hero Path.
// Pure: no DOM, no Firebase. Shown in the Ascension Path modal (ui/modals/legendQuest.js), honoured on the
// Hero's Challenge leaderboard (the title in gold) and on the certificate. It pays no Gold and no stars.
//
// Stored on student_scores as `legendQuest`:
//   { heroClass, steps: ['YYYY-MM-DD', ...], completedAt: ISO string | null }
// One step per lesson day, confirmed by the teacher; LEGEND_QUEST_STEPS steps fulfil it.

import { normalizeHeroClass } from './heroClassNames.mjs';

export const LEGEND_QUEST_STEPS = 3;

export const LEGEND_QUESTS = {
    Guardian: {
        legend: 'Legend of the Shield',
        quest: 'The Shield of Kindness',
        task: 'Stand up for a classmate: welcome someone who is alone, include someone left out, or say stop when someone is unkind.',
        stepLabel: 'Stood up for someone',
        icon: '🛡️'
    },
    Sage: {
        legend: 'Legend of the Bright Spark',
        quest: 'The Spark of Wonder',
        task: 'Bring something new to the class: an idea nobody had, a drawing, a rhyme or a story you made yourself.',
        stepLabel: 'Shared something new',
        icon: '🔮'
    },
    Paladin: {
        legend: 'Legend of the Banner',
        quest: 'The Banner Bearer',
        task: 'Lift your team: help your group or partner finish a task together, so that everybody takes part.',
        stepLabel: 'Lifted the team',
        icon: '⚔️'
    },
    Artificer: {
        legend: 'Legend of the Steady Hand',
        quest: 'The Master Craft',
        task: 'Finish a whole task carefully on your own, from start to end, without a reminder to keep going.',
        stepLabel: 'Finished it alone',
        icon: '⚙️'
    },
    Scholar: {
        legend: 'Legend of the Open Book',
        quest: 'The Teaching Scroll',
        task: 'Teach what you know: explain a word, a rule or an answer to a classmate in English, until they get it too.',
        stepLabel: 'Taught a classmate',
        icon: '📜'
    },
    Vanguard: {
        legend: 'Legend of the Training Yard',
        quest: "The Captain's Call",
        task: 'Lead the drill: explain or captain a Training Grounds game for the class, and cheer on every player.',
        stepLabel: 'Led the drill',
        icon: '⚜️'
    },
    Nomad: {
        legend: 'Legend of the Far Road',
        quest: 'Tales from the Road',
        task: 'Bring English home and back: use a new English word outside the lesson and tell the class where you used it.',
        stepLabel: 'Brought a word back',
        icon: '👟'
    },
    Patron: {
        legend: 'Legend of the Open Hand',
        quest: 'The Helping Hand',
        task: 'Help a classmate without being asked: lend a hand, share, or help them with something they find hard.',
        stepLabel: 'Helped a classmate',
        icon: '💝'
    }
};

export function getLegendQuest(heroClass) {
    return LEGEND_QUESTS[normalizeHeroClass(heroClass)] || null;
}

function cleanSteps(steps) {
    return [...new Set((Array.isArray(steps) ? steps : []).map((s) => String(s || '').slice(0, 10)).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)))].sort();
}

/** The stored record, but only when it belongs to the hero's current class. */
export function readLegendRecord(heroClass, legendQuest) {
    const cls = normalizeHeroClass(heroClass);
    if (!cls || !legendQuest || normalizeHeroClass(legendQuest.heroClass) !== cls) {
        return { heroClass: cls || null, steps: [], completedAt: null };
    }
    const steps = cleanSteps(legendQuest.steps).slice(0, LEGEND_QUEST_STEPS);
    const completedAt = legendQuest.completedAt && steps.length >= LEGEND_QUEST_STEPS ? String(legendQuest.completedAt) : null;
    return { heroClass: cls, steps, completedAt };
}

/** True when this hero has fulfilled the Legend Quest of their current class. */
export function isLegendHero(heroClass, legendQuest) {
    return Boolean(getLegendQuest(heroClass) && readLegendRecord(heroClass, legendQuest).completedAt);
}

/**
 * Where the quest stands. `pathComplete` means every seal is broken and every skill chosen.
 * status: 'hidden' (no class) · 'locked' (path not finished) · 'open' · 'legend'
 */
export function legendQuestState({ heroClass, pathComplete = false, legendQuest = null, todayKey = '' } = {}) {
    const quest = getLegendQuest(heroClass);
    if (!quest) return { status: 'hidden', quest: null, steps: [], stepsNeeded: LEGEND_QUEST_STEPS };
    const record = readLegendRecord(heroClass, legendQuest);
    const status = record.completedAt ? 'legend' : pathComplete ? 'open' : 'locked';
    const today = String(todayKey || '').slice(0, 10);
    return {
        status,
        quest,
        steps: record.steps,
        stepsNeeded: LEGEND_QUEST_STEPS,
        stepsLeft: Math.max(0, LEGEND_QUEST_STEPS - record.steps.length),
        markedToday: Boolean(today && record.steps.includes(today)),
        canMark: status === 'open' && Boolean(today) && !record.steps.includes(today),
        completedAt: record.completedAt
    };
}

/** The record after the teacher confirms today's step. Same day twice changes nothing. */
export function addLegendStep({ heroClass, legendQuest = null, todayKey, nowIso }) {
    const cls = normalizeHeroClass(heroClass);
    const record = readLegendRecord(cls, legendQuest);
    if (record.completedAt) return { record, changed: false, fulfilled: false };
    const day = String(todayKey || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || record.steps.includes(day)) return { record, changed: false, fulfilled: false };
    const steps = cleanSteps([...record.steps, day]).slice(0, LEGEND_QUEST_STEPS);
    const fulfilled = steps.length >= LEGEND_QUEST_STEPS;
    return {
        record: { heroClass: cls, steps, completedAt: fulfilled ? String(nowIso || new Date().toISOString()) : null },
        changed: true,
        fulfilled
    };
}

/** Takes back the newest step (a mis-tap). A fulfilled legend stays fulfilled. */
export function removeLatestLegendStep({ heroClass, legendQuest = null }) {
    const record = readLegendRecord(heroClass, legendQuest);
    if (record.completedAt || !record.steps.length) return { record, changed: false };
    return { record: { ...record, steps: record.steps.slice(0, -1) }, changed: true };
}

/** Short date for a step chip: "2026-10-04" → "4 Oct". */
export function formatLegendDay(dayKey) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ''));
    if (!m) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
}
