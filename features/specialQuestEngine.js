/**
 * Pure domain model for Special Quests.  The UI and Firestore adapters use
 * this module so that a quest can be resumed safely on any device.
 */

export const SPECIAL_QUEST_TYPES = Object.freeze({
    VOCABULARY_VAULT: 'vocabulary_vault',
    GRAMMAR_GUARDIANS: 'grammar_guardians',
    UNBROKEN_CHAIN: 'unbroken_chain',
    SCRIBES_SKETCH: 'scribes_sketch',
    FIVE_SENTENCE_SAGA: 'five_sentence_saga',
});

export const MODIFIER_TYPES = Object.freeze({
    DOUBLE_STAR_DAY: 'double_star_day',
    REASON_BONUS_DAY: 'reason_bonus_day',
});

export const QUEST_DEFINITIONS = Object.freeze({
    [SPECIAL_QUEST_TYPES.VOCABULARY_VAULT]: { title: 'Vocabulary Vault', goalKind: 'counter', defaultTarget: 10, minTarget: 5, maxTarget: 30, unit: 'valid uses' },
    [SPECIAL_QUEST_TYPES.GRAMMAR_GUARDIANS]: { title: 'Grammar Guardians', goalKind: 'counter', defaultTarget: 8, minTarget: 3, maxTarget: 20, unit: 'rescued sentences' },
    [SPECIAL_QUEST_TYPES.UNBROKEN_CHAIN]: { title: 'The Unbroken Chain', goalKind: 'streak', defaultTarget: 10, minTarget: 5, maxTarget: 30, unit: 'successful turns' },
    [SPECIAL_QUEST_TYPES.SCRIBES_SKETCH]: { title: "The Scribe's Sketch", goalKind: 'checklist', defaultTarget: 4, minTarget: 4, maxTarget: 4, unit: 'steps' },
    [SPECIAL_QUEST_TYPES.FIVE_SENTENCE_SAGA]: { title: 'Five-Sentence Saga', goalKind: 'five_steps', defaultTarget: 5, minTarget: 5, maxTarget: 5, unit: 'sentences' },
});

const LEGACY_TO_TYPE = Object.freeze({
    'Vocabulary Vault': SPECIAL_QUEST_TYPES.VOCABULARY_VAULT,
    'Grammar Guardians': SPECIAL_QUEST_TYPES.GRAMMAR_GUARDIANS,
    'The Unbroken Chain': SPECIAL_QUEST_TYPES.UNBROKEN_CHAIN,
    "The Scribe's Sketch": SPECIAL_QUEST_TYPES.SCRIBES_SKETCH,
    'Five-Sentence Saga': SPECIAL_QUEST_TYPES.FIVE_SENTENCE_SAGA,
    '2x Star Day': MODIFIER_TYPES.DOUBLE_STAR_DAY,
    'Reason Bonus Day': MODIFIER_TYPES.REASON_BONUS_DAY,
});

export const QUEST_TYPE_LABELS = Object.freeze(Object.fromEntries(
    Object.entries(QUEST_DEFINITIONS).map(([type, definition]) => [type, definition.title]),
));

export function normalizeQuestType(type) {
    if (!type) return null;
    return LEGACY_TO_TYPE[type] || (Object.values(SPECIAL_QUEST_TYPES).includes(type) || Object.values(MODIFIER_TYPES).includes(type) ? type : null);
}

export function isSpecialQuestType(type) {
    return Object.values(SPECIAL_QUEST_TYPES).includes(normalizeQuestType(type));
}

export function isModifierType(type) {
    return Object.values(MODIFIER_TYPES).includes(normalizeQuestType(type));
}

export function normalizeLegacyQuestEvent(event = {}) {
    const type = normalizeQuestType(event.type);
    if (!type) return { ...event, needsMigration: true };
    const definition = QUEST_DEFINITIONS[type];
    if (!definition) return { ...event, type, family: 'modifier', needsMigration: !event.schemaVersion };
    const legacyDetails = event.details || {};
    const target = Number(event.goalSpec?.target ?? legacyDetails.goalTarget ?? definition.defaultTarget);
    const stars = Number(event.rewardSpec?.starsPerRecipient ?? legacyDetails.completionBonus ?? 1);
    return {
        ...event,
        schemaVersion: Number(event.schemaVersion) || 1,
        family: 'special',
        type,
        goalSpec: { kind: definition.goalKind, target, unit: definition.unit },
        rewardSpec: { starsPerRecipient: stars, goldPerStar: 1 },
        status: event.status || 'scheduled',
        needsClassAssignment: !event.classId,
    };
}

export function validateQuestEvent(input = {}, { existing = [] } = {}) {
    const type = normalizeQuestType(input.type);
    const errors = [];
    if (!type) errors.push('Unknown quest event type.');
    const isSpecial = isSpecialQuestType(type);
    if (isSpecial && !input.classId) errors.push('A class is required for Special Quests.');
    if (!input.dateKey && !input.date) errors.push('A lesson date is required.');
    const definition = QUEST_DEFINITIONS[type];
    if (definition) {
        const target = Number(input.goalSpec?.target ?? input.details?.goalTarget ?? definition.defaultTarget);
        if (!Number.isInteger(target) || target < definition.minTarget || target > definition.maxTarget) {
            errors.push(`${definition.title} target must be between ${definition.minTarget} and ${definition.maxTarget}.`);
        }
    }
    if (isSpecial) {
        const reward = Number(input.rewardSpec?.starsPerRecipient ?? input.details?.completionBonus ?? 1);
        if (![0.5, 1, 1.5, 2].includes(reward)) errors.push('Special Quest reward must be 0.5, 1, 1.5 or 2 stars.');
        const duplicate = (existing || []).some((event) => normalizeQuestType(event.type) === type && event.classId === input.classId && (event.dateKey || event.date) === (input.dateKey || input.date) && event.status !== 'cancelled');
        if (duplicate) errors.push('The same Special Quest is already scheduled for this class and date.');
    } else if (isModifierType(type) && input.classId) {
        const modifierDuplicate = (existing || []).some((event) => isModifierType(event.type) && event.classId === input.classId && (event.dateKey || event.date) === (input.dateKey || input.date) && event.status !== 'cancelled');
        if (modifierDuplicate) errors.push('Only one standard modifier may be scheduled for a class and date.');
    }
    return { valid: errors.length === 0, errors, type };
}

export function createQuestEventDocument({ type, classId, dateKey, schoolYearKey, createdBy, eventGroupId = null, target, starsPerRecipient = 1, instructions = '', prompt = '', showTextOnProjector = false }) {
    const normalizedType = normalizeQuestType(type);
    const definition = QUEST_DEFINITIONS[normalizedType];
    if (!definition && !isModifierType(normalizedType)) throw new Error('Unsupported quest event type.');
    const isSpecial = Boolean(definition);
    const safeTarget = definition ? Math.min(definition.maxTarget, Math.max(definition.minTarget, Number(target || definition.defaultTarget))) : null;
    return {
        schemaVersion: 2,
        eventGroupId: eventGroupId || `${dateKey}__${classId}`,
        family: isSpecial ? 'special' : 'modifier',
        type: normalizedType,
        classId: classId || null,
        dateKey,
        date: dateKey,
        timezone: 'Europe/Athens',
        status: 'scheduled',
        ...(isSpecial ? {
            goalSpec: { kind: definition.goalKind, target: safeTarget, unit: definition.unit },
            rewardSpec: { starsPerRecipient: Number(starsPerRecipient), goldPerStar: 1 },
            stackingPolicy: { dateModifiers: false, heroPath: false, artifacts: false, heroOfDayBoon: false, bounty: false, teamQuest: true, guildGlory: true, familiar: true },
            presentation: { instructions: String(instructions || '').slice(0, 500), prompt: String(prompt || '').slice(0, 160), showTextOnProjector: Boolean(showTextOnProjector) },
        } : { details: {} }),
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        schoolYearKey,
    };
}

export function getDefaultProgress(event) {
    const normalized = normalizeLegacyQuestEvent(event);
    const definition = QUEST_DEFINITIONS[normalized.type];
    if (!definition) return { current: 0, best: 0, target: 0, completedSteps: [], sentences: [] };
    return {
        current: 0,
        best: 0,
        target: normalized.goalSpec?.target ?? definition.defaultTarget,
        completedSteps: [],
        sentences: definition.goalKind === 'five_steps' ? Array(5).fill('') : [],
    };
}

export function reduceQuestProgress(event, progress, action) {
    const normalized = normalizeLegacyQuestEvent(event);
    const definition = QUEST_DEFINITIONS[normalized.type];
    if (!definition) return { ...progress };
    const next = { ...getDefaultProgress(normalized), ...progress, completedSteps: [...(progress?.completedSteps || [])], sentences: [...(progress?.sentences || [])] };
    if (definition.goalKind === 'counter') {
        if (action === 'increment' || action === 'rescued' || action === 'use') next.current = Math.min(next.target, next.current + 1);
        if (action === 'undo') next.current = Math.max(0, next.current - 1);
    } else if (definition.goalKind === 'streak') {
        if (action === 'success') next.current = Math.min(next.target, next.current + 1);
        if (action === 'break') next.current = 0;
        if (action === 'undo') next.current = Math.max(0, next.current - 1);
        next.best = Math.max(Number(next.best) || 0, next.current);
    } else if (definition.goalKind === 'checklist') {
        const step = Number.isInteger(action?.step) ? action.step : Number(action);
        if (Number.isInteger(step) && step >= 0 && step < 4) {
            if (action.direction === 'back') next.completedSteps = next.completedSteps.filter((value) => value !== step);
            else if (!next.completedSteps.includes(step)) next.completedSteps.push(step);
            next.completedSteps.sort((a, b) => a - b);
            next.current = next.completedSteps.length;
        }
    } else if (definition.goalKind === 'five_steps') {
        const index = Math.max(0, Math.min(4, Number(action?.index ?? next.current)));
        if (action?.text !== undefined) next.sentences[index] = String(action.text).slice(0, 240);
        if (action?.type === 'next' || action === 'next') next.current = Math.min(5, Math.max(next.current, index + 1));
        if (action?.type === 'back') next.current = Math.max(0, next.current - 1);
    }
    next.completed = next.current >= next.target;
    return next;
}

export function canCompleteRun(run) {
    return Boolean(run && run.status === 'active' && run.progress?.completed);
}

export function resolveDailyModifier(events = []) {
    const modifiers = events.filter((event) => isModifierType(event.type) && event.status !== 'cancelled');
    const double = modifiers.find((event) => normalizeQuestType(event.type) === MODIFIER_TYPES.DOUBLE_STAR_DAY);
    if (double) return { type: MODIFIER_TYPES.DOUBLE_STAR_DAY, event: double, warning: modifiers.length > 1 ? '2x Star Day takes precedence over Reason Bonus Day.' : null };
    const reason = modifiers.find((event) => normalizeQuestType(event.type) === MODIFIER_TYPES.REASON_BONUS_DAY);
    return reason ? { type: MODIFIER_TYPES.REASON_BONUS_DAY, event: reason, warning: null } : null;
}

export function applyDailyModifier(stars, reason, modifier) {
    if (!modifier || Number(stars) <= 0) return Number(stars) || 0;
    if (modifier.type === MODIFIER_TYPES.DOUBLE_STAR_DAY) return Number(stars) * 2;
    if (modifier.type === MODIFIER_TYPES.REASON_BONUS_DAY && modifier.event?.details?.reason === reason) return Number(stars) + 1;
    return Number(stars) || 0;
}

export const LEGACY_QUEST_EVENT_TYPES = LEGACY_TO_TYPE;
