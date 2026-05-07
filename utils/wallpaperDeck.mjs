function repeatCard(list, cardType, count) {
    for (let index = 0; index < count; index += 1) {
        list.push(cardType);
    }
}

function baseCardType(cardType) {
    return String(cardType || '').split(':')[0];
}

function findRecentHistoryMatch(history = [], matcher = () => false, cooldownMs = 0) {
    if (!cooldownMs) return false;
    const now = Date.now();
    return history.some((entry) => matcher(entry) && (now - entry.time) < cooldownMs);
}

export function createWallpaperRepeatGuard(options = {}) {
    const getHistory = options.getHistory || (() => []);
    const getCardCooldown = options.getCardCooldown || (() => 0);
    const getDefinition = options.getDefinition || (() => null);
    const getFamilyCooldown = options.getFamilyCooldown || (() => 0);

    function hasBeenShownRecently(cardType) {
        const history = getHistory();
        const cardCooldown = getCardCooldown(cardType);
        const cardSeenRecently = findRecentHistoryMatch(
            history,
            (entry) => entry.id === cardType,
            cardCooldown
        );
        if (cardSeenRecently) return true;

        const definition = getDefinition(cardType);
        const family = definition?.family;
        if (!family) return false;

        const familyCooldown = getFamilyCooldown(family, cardType);
        return findRecentHistoryMatch(
            history,
            (entry) => entry.family === family && baseCardType(entry.id) !== baseCardType(cardType),
            familyCooldown
        );
    }

    return {
        hasBeenShownRecently
    };
}

export function applyWallpaperFamilyWeights(cards = [], context = {}, resolveDefinition = () => null) {
    const familyBoosts = {};

    if (context.mode === 'class') {
        familyBoosts.awards = (familyBoosts.awards || 0) + 1;
        familyBoosts.familiars = (familyBoosts.familiars || 0) + 1;
        familyBoosts.progress = (familyBoosts.progress || 0) + 1;
        familyBoosts.attendance = (familyBoosts.attendance || 0) + 1;
        familyBoosts.timekeeping = (familyBoosts.timekeeping || 0) + 1;
        familyBoosts.spotlight = (familyBoosts.spotlight || 0) + 1;
        familyBoosts.achievements = (familyBoosts.achievements || 0) + 1;
    } else {
        familyBoosts.leaderboards = (familyBoosts.leaderboards || 0) + 1;
        familyBoosts.guilds = (familyBoosts.guilds || 0) + 1;
        familyBoosts.treasury = (familyBoosts.treasury || 0) + 1;
        familyBoosts.atmosphere = (familyBoosts.atmosphere || 0) + 1;
        familyBoosts.knowledge = (familyBoosts.knowledge || 0) + 1;
    }

    if (context.isOffDay) {
        familyBoosts.calendar = (familyBoosts.calendar || 0) + 1;
        familyBoosts.leaderboards = (familyBoosts.leaderboards || 0) + 1;
    }

    if (context.holidayPhase === 'active') {
        familyBoosts.calendar = (familyBoosts.calendar || 0) + 2;
        familyBoosts.atmosphere = (familyBoosts.atmosphere || 0) + 1;
    } else if (context.holidayPhase === 'upcoming') {
        familyBoosts.calendar = (familyBoosts.calendar || 0) + 1;
    }

    if (context.lessonPhase === 'opening') {
        familyBoosts.calendar = (familyBoosts.calendar || 0) + 1;
        familyBoosts.context = (familyBoosts.context || 0) + 1;
    }

    if (context.lessonPhase === 'winddown') {
        familyBoosts.awards = (familyBoosts.awards || 0) + 1;
        familyBoosts.leaderboards = (familyBoosts.leaderboards || 0) + 1;
        familyBoosts.atmosphere = (familyBoosts.atmosphere || 0) + 1;
        familyBoosts.wellness = (familyBoosts.wellness || 0) + 1;
    }

    const weightedCards = [];
    for (const cardType of cards) {
        weightedCards.push(cardType);
        const definition = resolveDefinition(cardType);
        const family = definition?.family;
        const extraCopies = family ? (familyBoosts[family] || 0) : 0;
        repeatCard(weightedCards, cardType, extraCopies);
    }

    return weightedCards;
}