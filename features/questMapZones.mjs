// The four Team Quest map realms and the monthly-progress share where each begins.
// Pure data, shared by the map (worldMap.js), ceremonies and the Home quest road.

export const QUEST_MAP_ZONES = [
    {
        id: 'bronze',
        minPercent: 0,
        label: 'Bronze Meadows',
        icon: '🌿',
        desc: 'The first stretch of the adventure road.',
        glow: 'shadow-[0_0_10px_rgba(165,180,252,0.5)]',
        animationClass: 'animate-bounce-slow'
    },
    {
        id: 'silver',
        minPercent: 30,
        label: 'Silver Peaks',
        icon: '🏔️',
        desc: 'Steady climbers reach the high passes.',
        glow: 'shadow-[0_0_10px_rgba(125,211,252,0.5)] border-sky-200',
        animationClass: 'animate-bounce-slow'
    },
    {
        id: 'gold',
        minPercent: 60,
        label: 'Golden Citadel',
        icon: '🏰',
        desc: 'The citadel opens to classes on a streak.',
        glow: 'shadow-[0_0_12px_rgba(251,191,36,0.6)] border-amber-300',
        animationClass: 'animate-bounce-slow'
    },
    {
        id: 'crystal',
        minPercent: 85,
        label: 'Crystal Realm',
        icon: '💎',
        desc: 'Top-tier champions sparkle at the summit.',
        glow: 'shadow-[0_0_15px_rgba(216,180,254,0.8)] border-purple-300',
        animationClass: 'animate-pulse'
    }
];

export function getQuestMapZoneForProgressPercent(progressPercent = 0) {
    const safePercent = Number.isFinite(progressPercent) ? progressPercent : 0;
    return QUEST_MAP_ZONES.reduce((current, zone) => (
        safePercent >= zone.minPercent ? zone : current
    ), QUEST_MAP_ZONES[0]);
}
