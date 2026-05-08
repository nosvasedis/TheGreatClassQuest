const ZONES = {
    'sky-left': { top: '13%', left: '20%', bottom: 'auto', right: 'auto' },
    'sky-right': { top: '13%', left: 'auto', bottom: 'auto', right: '20%' },
    'horizon-left': { top: '34%', left: '16%', bottom: 'auto', right: 'auto' },
    'horizon-right': { top: '34%', left: 'auto', bottom: 'auto', right: '16%' },
    'harbor-left': { top: 'auto', left: '18%', bottom: '12%', right: 'auto' },
    'harbor-right': { top: 'auto', left: 'auto', bottom: '12%', right: '18%' }
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