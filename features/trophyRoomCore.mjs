// features/trophyRoomCore.mjs — pure view model for the Trophy Room (a student's satchel).
// No DOM, no state: the modal passes in the inventory, score doc and an `isUsable(name)` check.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 2026" from an ISO date; '' when missing or unreadable. */
export function formatTrophyMonth(iso) {
    const match = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
    if (!match) return '';
    const month = Number(match[2]);
    if (month < 1 || month > 12) return '';
    return `${MONTHS[month - 1]} ${match[1]}`;
}

/** Where a kept item came from, in words a class understands. */
export function trophySourceLabel(item) {
    if (item?.source === 'ember_oath') return 'Oath kept';
    if (item?.source === 'quiz_treasure' || item?.source === 'quiz_prize') return 'Quiz prize';
    if (String(item?.id || '').startsWith('leg_')) return 'Legendary';
    return 'Mystic Market';
}

/**
 * Split an inventory into Relics (usable power-ups, stacked by name) and Treasures (kept for good).
 * Relic `indices` point into the original inventory so "Use" spends the right copy.
 */
export function buildTrophySatchel(inventory, { isUsable = () => false, present = null } = {}) {
    // `present` maps an owned item to how it shows today (a renamed relic shows its new name).
    const list = (Array.isArray(inventory) ? inventory : []).map((item) => {
        const shown = item && typeof present === 'function' ? present(item) : null;
        return shown ? { ...item, name: shown.name || item.name, icon: shown.icon || item.icon, description: shown.description || item.description } : item;
    });
    const relicsByName = new Map();
    const treasures = [];

    list.forEach((item, index) => {
        if (!item || !item.name) return;
        if (isUsable(item.name)) {
            const existing = relicsByName.get(item.name);
            if (existing) {
                existing.count += 1;
                existing.indices.push(index);
            } else {
                relicsByName.set(item.name, {
                    name: item.name,
                    icon: item.icon || '',
                    image: item.image || '',
                    description: item.description || '',
                    count: 1,
                    indices: [index],
                });
            }
            return;
        }
        treasures.push({
            index,
            name: item.name,
            icon: item.icon || '',
            image: item.image || '',
            description: item.description || '',
            kind: item.source === 'ember_oath' ? 'keepsake' : 'treasure',
            sourceLabel: trophySourceLabel(item),
            acquiredAt: item.acquiredAt || '',
            acquiredLabel: formatTrophyMonth(item.acquiredAt),
        });
    });

    // Newest treasures first; undated ones keep their order at the end.
    const dated = treasures.filter((t) => t.acquiredAt).sort((a, b) => (a.acquiredAt < b.acquiredAt ? 1 : a.acquiredAt > b.acquiredAt ? -1 : a.index - b.index));
    const undated = treasures.filter((t) => !t.acquiredAt);
    const relics = [...relicsByName.values()];

    return {
        relics,
        treasures: [...dated, ...undated],
        relicCount: relics.reduce((sum, r) => sum + r.count, 0),
        treasureCount: treasures.length,
        total: relics.reduce((sum, r) => sum + r.count, 0) + treasures.length,
    };
}

/**
 * A short look inside the satchel (the Hero Stage under an enlarged portrait): every relic,
 * the newest treasures up to `treasureLimit`, and how many more wait in the Treasure Vault.
 */
export function previewTrophySatchel(satchel, { treasureLimit = 8 } = {}) {
    const relics = Array.isArray(satchel?.relics) ? satchel.relics : [];
    const treasures = Array.isArray(satchel?.treasures) ? satchel.treasures : [];
    const limit = Math.max(0, Math.floor(Number(treasureLimit) || 0));
    return {
        relics,
        treasures: treasures.slice(0, limit),
        moreTreasures: Math.max(0, treasures.length - limit),
    };
}

/** Counts for the hero list: how many items, and how many can be used right now. */
export function summarizeSatchel(inventory, { isUsable = () => false } = {}) {
    const list = Array.isArray(inventory) ? inventory.filter((item) => item && item.name) : [];
    return { total: list.length, ready: list.filter((item) => isUsable(item.name)).length };
}

/** Effects already switched on for this student (spent relics still working). */
export function buildActiveEffects(scoreData, monthKey) {
    const s = scoreData || {};
    const effects = [];
    if (s.hasGildedEffect) effects.push({ icon: '✨', title: 'Gilded Star', body: 'Next star pays triple Gold.' });
    if (s.luckDate) effects.push({ icon: '🍀', title: 'Elixir of Luck', body: `Luck waits for the lesson on ${s.luckDate}.` });
    if (s.starfallCatalystActive) effects.push({ icon: '📜', title: 'Starfall Catalyst', body: 'Next high test score earns double stars.' });
    if (s.pendingHeroStatus) effects.push({ icon: '🎭', title: 'Mask of the Protagonist', body: 'Hero of the next Story Log.' });
    if (s.peerBoonFreeMonthKey && s.peerBoonFreeMonthKey === monthKey) effects.push({ icon: '💝', title: 'Compassion Token', body: "Hero's Boon costs 0 Gold this month." });
    const charges = Number(s.gloryBannerCharges) || 0;
    if (charges > 0) effects.push({ icon: '⚜️', title: 'Banner of Glory', body: `${charges} star${charges === 1 ? '' : 's'} left with +1 bonus Guild Glory.` });
    if (s.fortuneFavorArmed) effects.push({ icon: '🍀', title: "Fortune's Favor", body: "Your guild's next Fortune's Wheel here is gilded." });
    if (s.storyWeaverDoubleNext) effects.push({ icon: '✒️', title: "Archivist's Quill", body: 'Next Story Weaver bonus is a full star.' });
    if ((Number(s.aurumVoucherPercent) || 0) > 0 && s.aurumVoucherMonth === monthKey) {
        effects.push({ icon: '💰', title: 'Aurum Satchel', body: `${s.aurumVoucherPercent}% off the next Mystic Market buy this month.` });
    }
    return effects;
}
