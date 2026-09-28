// features/skillTreeCore.mjs — pure view model for the Ascension Path (Skill Tree) modal.
// No DOM, no state: `ui/modals/skillTree.js` gathers the data, `ui/modals/skillTreeView.mjs` draws it.

function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex) {
    const raw = String(hex || '').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n) || full.length !== 6) return '99, 102, 241';
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Tier states:  awakened (skill chosen) · choosing (unlocked, pick now) ·
 *               waiting (unlocked, but an earlier seal still needs a choice) · sealed (not enough stars).
 * Branch states: chosen · forsaken (the other branch of an awakened tier) · choosable · waiting · sealed.
 */
export function buildSkillTreeModel({
    heroClass = null,
    tree = null,
    classIcon = '⭐',
    studentName = '',
    heroSkills = [],
    starsInReason = 0,
    reasonLabel = '',
    titles = []
} = {}) {
    const stars = Math.max(0, Number(starsInReason) || 0);
    const skills = Array.isArray(heroSkills) ? heroSkills : [];

    if (!tree || !Array.isArray(tree.levels) || !tree.levels.length) {
        return {
            hasPath: false,
            heroClass: heroClass || null,
            studentName,
            icon: '🧭',
            aura: '#6366f1',
            auraRgb: hexToRgb('#6366f1'),
            tiers: []
        };
    }

    const thresholds = tree.levels.map((lvl) => Number(lvl.threshold) || 0);
    const maxLevel = thresholds.length;
    let level = 0;
    for (let i = 0; i < maxLevel; i++) {
        if (stars >= thresholds[i]) level = i + 1;
        else break;
    }
    const isMax = level >= maxLevel;
    const titleAt = (lvl) => titles[lvl - 1] || heroClass || 'Hero';

    const tiers = tree.levels.map((lvl, idx) => {
        const threshold = thresholds[idx];
        const prev = idx > 0 ? thresholds[idx - 1] : 0;
        const unlocked = stars >= threshold;
        const chosenId = skills[idx] || null;
        const previousDone = idx === 0 || !!skills[idx - 1];

        let state = 'sealed';
        if (unlocked && chosenId) state = 'awakened';
        else if (unlocked && previousDone) state = 'choosing';
        else if (unlocked) state = 'waiting';

        const branches = (lvl.branches || []).map((branch, bIdx) => {
            let bState = 'sealed';
            if (state === 'awakened') bState = branch.id === chosenId ? 'chosen' : 'forsaken';
            else if (state === 'choosing') bState = 'choosable';
            else if (state === 'waiting') bState = 'waiting';
            return {
                id: branch.id,
                name: branch.name,
                icon: branch.icon,
                desc: branch.desc,
                side: bIdx % 2 === 0 ? 'left' : 'right',
                state: bState
            };
        });

        return {
            index: idx,
            level: idx + 1,
            title: titleAt(idx + 1),
            threshold,
            state,
            // How full the climb from the previous seal up to this one is (0..1).
            fill: threshold > prev ? clamp01((stars - prev) / (threshold - prev)) : (unlocked ? 1 : 0),
            // Where this seal sits on the overall meter (0..100).
            meterPos: thresholds[maxLevel - 1] > 0 ? Math.round((threshold / thresholds[maxLevel - 1]) * 1000) / 10 : 0,
            branches
        };
    });

    const choosingTier = tiers.find((t) => t.state === 'choosing');
    const firstSealed = tiers.find((t) => t.state === 'sealed');
    const focusTier = choosingTier ? choosingTier.index : firstSealed ? firstSealed.index : maxLevel - 1;
    const nextThreshold = isMax ? null : thresholds[level];
    const lastThreshold = thresholds[maxLevel - 1] || 1;

    return {
        hasPath: true,
        heroClass,
        studentName,
        icon: classIcon || '⭐',
        aura: tree.auraColor || '#6366f1',
        auraRgb: hexToRgb(tree.auraColor),
        reasonLabel,
        stars,
        level,
        maxLevel,
        isMax,
        title: level > 0 ? titleAt(level) : 'Initiate',
        nextTitle: isMax ? null : titleAt(level + 1),
        nextThreshold,
        toNext: isMax ? 0 : Math.max(0, nextThreshold - stars),
        overallPct: Math.round(clamp01(stars / lastThreshold) * 1000) / 10,
        awakenedCount: tiers.filter((t) => t.state === 'awakened').length,
        hasChoice: !!choosingTier,
        focusTier,
        tiers
    };
}

/** Rounds star counts for display: 12 → "12", 12.5 → "12.5". */
export function formatPathStars(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return String(Math.round(n * 10) / 10);
}
