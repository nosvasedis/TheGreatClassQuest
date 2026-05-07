const ZONES = {
    'sky-left': { top: '7%', left: '4.5%', bottom: 'auto', right: 'auto' },
    'sky-right': { top: '8%', left: 'auto', bottom: 'auto', right: '4.5%' },
    'horizon-left': { top: '28%', left: '4%', bottom: 'auto', right: 'auto' },
    'horizon-right': { top: '28%', left: 'auto', bottom: 'auto', right: '4%' },
    'harbor-left': { top: 'auto', left: '5%', bottom: '9%', right: 'auto' },
    'harbor-right': { top: 'auto', left: 'auto', bottom: '9%', right: '5%' }
};

const TIER_CLASS_NAMES = {
    compact: 'wallpaper-card-tier-compact',
    standard: 'wallpaper-card-tier-standard',
    feature: 'wallpaper-card-tier-feature'
};

const DEFAULT_ZONE_SEQUENCE = ['sky-left', 'sky-right', 'harbor-left', 'harbor-right'];

function nextIndex(sequence, counter) {
    if (!sequence.length) return 0;
    const safeCounter = Number.isFinite(counter) ? counter : 0;
    return safeCounter % sequence.length;
}

export function getWallpaperScenePlacement(card = {}, sceneState = {}) {
    const sizeTier = card.sizeTier || 'standard';
    const preferredZones = Array.isArray(card.preferredZones) && card.preferredZones.length > 0
        ? card.preferredZones.filter((zone) => ZONES[zone])
        : DEFAULT_ZONE_SEQUENCE;
    const family = card.family || 'general';
    const familyCounter = sceneState.familyCounters?.[family] || 0;
    const zoneName = preferredZones[nextIndex(preferredZones, familyCounter)] || DEFAULT_ZONE_SEQUENCE[0];
    const zone = ZONES[zoneName] || ZONES['sky-left'];
    const tierClassName = TIER_CLASS_NAMES[sizeTier] || TIER_CLASS_NAMES.standard;
    const rotationMap = { compact: 0.45, standard: 0.8, feature: 1.1 };
    const rotationStep = familyCounter % 2 === 0 ? 1 : -1;
    const rotation = rotationStep * (rotationMap[sizeTier] || rotationMap.standard);

    return {
        zoneName,
        tierClassName,
        rotation,
        style: zone
    };
}