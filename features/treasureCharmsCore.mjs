// features/treasureCharmsCore.mjs — what Mystic Market treasures do and count for, and the
// fair-share rules that keep one class from emptying a league's stall. Pure: no DOM, no state.
//
// - Every seasonal or festival treasure carries one Charm: a small classroom privilege the
//   child can call on once. The treasure stays in the collection; only the charm is spent.
// - Treasures fill the child's Collector's Hoard (points by rarity). Each new Hoard rank pays
//   a little Gold once. Nothing here touches stars, Glory, goals or rankings.
// - Stalls share copies fairly: one copy of a treasure per child, a rarity limit per child,
//   and a share of each rarity per class (by class size) until the stall's last days.

const text = (value) => String(value ?? '').trim();

// ─── Charms ──────────────────────────────────────────────────────────────────

export const TREASURE_CHARMS = {
    common: [
        { id: 'seat', icon: '🪑', title: 'Seat of Choice', young: 'Choose where you sit today.', older: 'Choose where you sit for this lesson.' },
        { id: 'helper', icon: '🧺', title: "Teacher's Helper", young: 'Hand out the books and papers today.', older: "Be the teacher's helper for this lesson: papers, board and books." },
        { id: 'warmup', icon: '🎲', title: 'Game Chooser', young: 'Pick the warm-up game.', older: "Pick today's warm-up game." },
        { id: 'pen', icon: '🖍️', title: 'Golden Pen', young: "Write with the teacher's special pens today.", older: "Use the teacher's coloured markers for this lesson." },
        { id: 'first', icon: '🥇', title: 'First Turn', young: 'Go first in the next game.', older: 'Take the first turn in the next class game.' },
        { id: 'picker', icon: '🎯', title: 'Name Picker', young: 'Choose who answers the next question.', older: 'Choose who answers the next three questions.' }
    ],
    rare: [
        { id: 'partner', icon: '🤝', title: 'Partner Pick', young: 'Choose your partner for the next pair game.', older: 'Choose your partner for the next pair activity.' },
        { id: 'hint', icon: '🦉', title: "Wise Owl's Hint", young: 'Ask the teacher for one hint in an exercise.', older: 'Ask for one hint on any exercise or quiz question.' },
        { id: 'shield', icon: '📝', title: 'Homework Shield', young: 'Skip one homework exercise you choose.', older: 'Skip one homework exercise of your choice.' },
        { id: 'captain', icon: '🛡️', title: 'Team Captain', young: 'Be captain in the next team game.', older: 'Be captain and name your team in the next team game.' },
        { id: 'spotlight', icon: '🎤', title: 'Spotlight Share', young: 'Show the class something you love.', older: 'Two minutes to share something you love, in English.' }
    ],
    legendary: [
        { id: 'teacher', icon: '🎓', title: 'Teacher for Five', young: 'Lead the class in a game for five minutes.', older: 'Lead the class for five minutes: a word game, a quiz or a story.' },
        { id: 'decree', icon: '📯', title: 'Royal Decree', young: 'Choose the game for the end of the lesson.', older: 'Choose the class activity for the last ten minutes of a lesson.' },
        { id: 'desk', icon: '👑', title: "Teacher's Desk", young: "Sit at the teacher's desk for one lesson.", older: "Sit at the teacher's desk for one lesson." },
        { id: 'pass', icon: '📜', title: 'Homework Pass', young: 'No homework for one lesson.', older: 'No homework for one lesson (tests and dictations still count).' }
    ]
};

export const TREASURE_TIERS = ['common', 'rare', 'legendary'];
const TIER_LABELS = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

export function treasureTierLabel(tier) {
    return TIER_LABELS[tier] || TIER_LABELS.common;
}

function hashString(value) {
    let hash = 2166136261;
    const source = String(value || '');
    for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** Tier of a price, the same bands as the stall (80+ legendary, 35+ rare). */
export function tierForPrice(price) {
    const gold = Number(price);
    if (gold >= 80) return 'legendary';
    if (gold >= 35) return 'rare';
    return 'common';
}

export function normalizeTier(tier) {
    return TREASURE_TIERS.includes(tier) ? tier : 'common';
}

/** The charm a treasure carries. Same treasure, same charm, for every child who owns one. */
export function charmFor(item = {}) {
    const tier = normalizeTier(item.tier || (item.price !== undefined ? tierForPrice(item.price) : 'common'));
    const list = TREASURE_CHARMS[tier];
    const wanted = text(item.charm);
    const named = wanted ? Object.values(TREASURE_CHARMS).flat().find((charm) => charm.id === wanted) : null;
    const charm = named || list[hashString(text(item.id) || text(item.name)) % list.length];
    return { ...charm, tier };
}

/**
 * Gives every treasure on a stall its own charm where it can: treasures of one rarity on one
 * stall do not repeat a charm until that rarity's list runs out. Charms already set are kept.
 * Returns Map(itemId -> charmId) for the items that still need one.
 */
export function assignStallCharms(items = []) {
    const groups = new Map();
    (items || []).forEach((item) => {
        if (!item?.id) return;
        const tier = normalizeTier(item.tier || tierForPrice(item.price));
        const key = `${stallKeyOf(item)}#${tier}`;
        if (!groups.has(key)) groups.set(key, { tier, rows: [] });
        groups.get(key).rows.push(item);
    });
    const out = new Map();
    groups.forEach(({ tier, rows }, key) => {
        const list = TREASURE_CHARMS[tier];
        const used = new Set(rows.map((row) => text(row.charm)).filter(Boolean));
        const start = hashString(key) % list.length;
        [...rows].sort((a, b) => text(a.id).localeCompare(text(b.id))).forEach((row) => {
            if (text(row.charm)) return;
            let pick = null;
            for (let i = 0; i < list.length && !pick; i += 1) {
                const candidate = list[(start + i) % list.length];
                if (!used.has(candidate.id)) pick = candidate;
            }
            pick = pick || list[hashString(row.id) % list.length];
            used.add(pick.id);
            out.set(row.id, pick.id);
        });
    });
    return out;
}

export function charmText(charm, { young = false } = {}) {
    if (!charm) return '';
    return young ? charm.young : charm.older;
}

/** True for Mystic Market treasures (seasonal, festival, or a stall prize). Relics and keepsakes are not. */
export function isStallTreasure(item) {
    if (!item || !text(item.name)) return false;
    const id = text(item.id);
    if (id.startsWith('leg_')) return false;
    if (item.source === 'ember_oath' || item.source === 'ember_path') return false;
    if (item.kind === 'familiar') return false;
    return Boolean(id);
}

function isoDay(iso) {
    return /^\d{4}-\d{2}-\d{2}/.test(text(iso)) ? text(iso).slice(0, 10) : '';
}

/** Can this treasure's charm be called on today? Returns { ok, reason }. */
export function charmUseCheck(inventory = [], index, { today = '', classCharmsToday = 0, classDailyLimit = 3 } = {}) {
    const list = Array.isArray(inventory) ? inventory : [];
    const item = list[index];
    if (!isStallTreasure(item)) return { ok: false, reason: 'This keepsake has no charm.' };
    if (item.charmUsedAt) return { ok: false, reason: 'This charm was already used. The treasure stays in the collection.' };
    if (today && list.some((entry) => entry && isoDay(entry.charmUsedAt) === today)) {
        return { ok: false, reason: 'One charm a day. This one can wait for the next lesson.' };
    }
    if (classCharmsToday >= classDailyLimit) {
        return { ok: false, reason: `The class has used ${classDailyLimit} charms today. More can wait for the next lesson.` };
    }
    return { ok: true, reason: '' };
}

/** Charms a class already used today, from its children's inventories. */
export function countCharmsUsedOn(inventories = [], today = '') {
    if (!today) return 0;
    return (inventories || []).reduce((sum, inventory) => sum + (Array.isArray(inventory)
        ? inventory.filter((entry) => entry && isoDay(entry.charmUsedAt) === today).length
        : 0), 0);
}

// ─── Collector's Hoard ───────────────────────────────────────────────────────

export const HOARD_POINTS = { common: 1, rare: 3, legendary: 6 };
export const HOARD_FESTIVAL_BONUS = 1;

export const HOARD_RANKS = [
    { rank: 1, points: 3, title: 'Trinket Finder', icon: '🔎', gold: 3 },
    { rank: 2, points: 8, title: 'Treasure Seeker', icon: '🧭', gold: 5 },
    { rank: 3, points: 15, title: 'Curator', icon: '🏺', gold: 8 },
    { rank: 4, points: 25, title: 'Hoard Keeper', icon: '🗝️', gold: 12 },
    { rank: 5, points: 40, title: 'Legendary Collector', icon: '💎', gold: 15 },
    { rank: 6, points: 60, title: 'Keeper of Wonders', icon: '🌟', gold: 20 }
];

export function hoardPointsFor(item) {
    if (!isStallTreasure(item)) return 0;
    const tier = normalizeTier(item.tier || (item.price !== undefined ? tierForPrice(item.price) : 'common'));
    return HOARD_POINTS[tier] + (item.shelf === 'festival' ? HOARD_FESTIVAL_BONUS : 0);
}

/** The child's Hoard: points, rank reached, the next rank and how far away it is. */
export function buildHoard(inventory = []) {
    const list = (Array.isArray(inventory) ? inventory : []).filter(isStallTreasure);
    const points = list.reduce((sum, item) => sum + hoardPointsFor(item), 0);
    const reached = HOARD_RANKS.filter((rank) => points >= rank.points);
    const current = reached[reached.length - 1] || null;
    const next = HOARD_RANKS.find((rank) => points < rank.points) || null;
    const floor = current ? current.points : 0;
    return {
        points,
        treasures: list.length,
        charmsReady: list.filter((item) => !item.charmUsedAt).length,
        rank: current ? current.rank : 0,
        title: current ? current.title : '',
        icon: current ? current.icon : '',
        next,
        toNext: next ? next.points - points : 0,
        progress: next ? Math.max(0, Math.min(1, (points - floor) / (next.points - floor))) : 1
    };
}

/** Gold owed for Hoard ranks reached since the last payout. Paid once per rank, ever. */
export function hoardRankPayout(inventory = [], paidRank = 0) {
    const hoard = buildHoard(inventory);
    const already = Math.max(0, Math.floor(Number(paidRank) || 0));
    const fresh = HOARD_RANKS.filter((rank) => rank.rank > already && rank.rank <= hoard.rank);
    return {
        rank: Math.max(already, hoard.rank),
        gold: fresh.reduce((sum, rank) => sum + rank.gold, 0),
        ranks: fresh,
        hoard
    };
}

// ─── Smart stock and fair shares ─────────────────────────────────────────────

/** How many children in the league each rarity is stocked for, per shelf. */
export const SMART_STOCK_RULES = {
    seasonal: {
        common: { share: 0.6, kinds: 5, min: 2, max: 6 },
        rare: { share: 0.3, kinds: 5, min: 1, max: 3 },
        legendary: { share: 0.12, kinds: 5, min: 1, max: 2 }
    },
    festival: {
        common: { share: 0.35, kinds: 2, min: 2, max: 6 },
        rare: { share: 0.18, kinds: 2, min: 1, max: 3 },
        legendary: { share: 0.06, kinds: 1, min: 1, max: 2 }
    }
};

/** Most treasures of one rarity a child may take from one stall (one shelf, one month or festival). */
export const CHILD_TIER_LIMITS = {
    seasonal: { common: 5, rare: 2, legendary: 1 },
    festival: { common: 2, rare: 1, legendary: 1 }
};

/**
 * Copies of one treasure for a league with `children` heroes. Most children never buy a
 * legendary, so rare and legendary copies stay scarce; commons are stocked for about half.
 * Returns null when the league size is unknown (the stall keeps the copies it has).
 */
export function smartStockMax({ tier, shelf = 'seasonal', children = 0 } = {}) {
    const count = Math.floor(Number(children) || 0);
    if (count <= 0) return null;
    const rules = SMART_STOCK_RULES[shelf === 'festival' ? 'festival' : 'seasonal'][normalizeTier(tier)];
    const copies = Math.round((count * rules.share) / rules.kinds);
    return Math.min(rules.max, Math.max(rules.min, copies));
}

/** The children who share a stall: the teacher's classes in that league. */
export function leagueRoster(classes = [], students = [], league = '') {
    const inLeague = (classes || []).filter((cls) => cls && text(cls.questLevel) === text(league));
    const ids = new Set(inLeague.map((cls) => cls.id));
    const sizes = {};
    (students || []).forEach((student) => {
        if (student && ids.has(student.classId)) sizes[student.classId] = (sizes[student.classId] || 0) + 1;
    });
    const children = Object.values(sizes).reduce((sum, n) => sum + n, 0);
    return { classIds: [...ids], sizes, children, classCount: inLeague.length };
}

/** New copy count after a resize, keeping every copy already sold sold. */
export function resizedStock({ stock, stockMax, target }) {
    const max = Math.max(0, Math.floor(Number(stockMax) || 0));
    const left = Math.max(0, Math.floor(Number(stock) || 0));
    const sold = Math.max(0, max - left);
    return { stock: Math.max(0, target - sold), stockMax: target, sold };
}

/** The stall an item or an owned treasure belongs to: one shelf of one league for one month or festival. */
export function stallKeyOf(item = {}) {
    const shelf = item.shelf === 'festival' ? 'festival' : 'seasonal';
    const league = text(item.league);
    const period = shelf === 'festival' ? text(item.festivalId) : text(item.monthKey);
    if (!league || !period) return '';
    return `${shelf}|${league}|${period}`;
}

/**
 * The last days of a stall, when any copies still left open to every class.
 * Seasonal: the last 7 days of the month. Festival: the last 3 days of the celebration.
 */
export function stallIsOpenToAll({ shelf = 'seasonal', today = '', festivalEnd = '' } = {}) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(today));
    if (!match) return false;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (shelf === 'festival') {
        const end = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(festivalEnd));
        if (!end) return false;
        const endMs = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
        const todayMs = Date.UTC(year, month - 1, day);
        return (endMs - todayMs) / 86400000 <= 2;
    }
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day > daysInMonth - 7;
}

/**
 * Copies of one rarity a class may take from a stall: its part of the copies by class size,
 * rounded up so every class can always buy at least one.
 */
export function classTierShare({ tierCopies = 0, classSize = 0, children = 0, classCount = 1 } = {}) {
    const total = Math.max(0, Math.floor(Number(tierCopies) || 0));
    if (classCount <= 1 || children <= 0) return total;
    return Math.min(total, Math.max(1, Math.ceil((total * Math.max(0, classSize)) / children)));
}

/** What an owned treasure looked like on its stall, borrowing tier and stall from the live item when an old entry lacks them. */
export function ownedStallFacts(entry = {}, stallItemsById = new Map()) {
    const live = stallItemsById.get(text(entry.id)) || null;
    const tier = entry.tier || live?.tier || (live ? tierForPrice(live.price) : '');
    const source = entry.league ? entry : (live || entry);
    return { tier: tier ? normalizeTier(tier) : '', stallKey: stallKeyOf(source) };
}

/**
 * Whether `classId`'s child may buy `item` now. Inventories are { studentId, classId, inventory }.
 * Returns { ok, reason, label, classLeft, childLeft }.
 */
export function stallBuyCheck({
    item,
    studentId,
    classId,
    roster,
    inventories = [],
    stallItems = [],
    today = '',
    festivalEnd = ''
} = {}) {
    const shelf = item?.shelf === 'festival' ? 'festival' : 'seasonal';
    const tier = normalizeTier(item?.tier || tierForPrice(item?.price));
    const key = stallKeyOf(item);
    const byId = new Map((stallItems || []).filter((row) => row?.id).map((row) => [row.id, row]));
    const facts = (entry) => ownedStallFacts(entry, byId);
    const mine = inventories.find((row) => row.studentId === studentId)?.inventory || [];

    if (mine.some((entry) => entry && text(entry.id) === text(item?.id))) {
        return { ok: false, reason: 'Already in the satchel. One of each treasure per hero.', label: 'Owned' };
    }
    const childLimit = CHILD_TIER_LIMITS[shelf][tier];
    const childTaken = key ? mine.filter((entry) => {
        const f = facts(entry);
        return f.stallKey === key && f.tier === tier;
    }).length : 0;
    if (childTaken >= childLimit) {
        const word = treasureTierLabel(tier).toLowerCase();
        return {
            ok: false,
            reason: `${childLimit} ${word} treasure${childLimit === 1 ? '' : 's'} per hero from this stall. Leave some for the others!`,
            label: `${treasureTierLabel(tier)} limit`
        };
    }

    const result = { ok: true, reason: '', label: '', childLeft: childLimit - childTaken, classLeft: null };
    if (!roster || roster.classCount <= 1 || !key) return result;
    if (stallIsOpenToAll({ shelf, today, festivalEnd })) return result;

    const tierCopies = (stallItems || [])
        .filter((row) => stallKeyOf(row) === key && normalizeTier(row.tier || tierForPrice(row.price)) === tier && !row.incoming)
        .reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.stockMax) || 0)), 0);
    if (tierCopies <= 0) return result;
    const share = classTierShare({
        tierCopies,
        classSize: roster.sizes?.[classId] || 0,
        children: roster.children,
        classCount: roster.classCount
    });
    const classTaken = inventories
        .filter((row) => row.classId === classId)
        .reduce((sum, row) => sum + (row.inventory || []).filter((entry) => {
            const f = facts(entry);
            return f.stallKey === key && f.tier === tier;
        }).length, 0);
    result.classLeft = Math.max(0, share - classTaken);
    if (classTaken >= share) {
        const word = treasureTierLabel(tier).toLowerCase();
        return {
            ok: false,
            reason: `This class has taken its share of ${word} treasures for now. The other classes get their turn; anything left opens to all in the stall's last days.`,
            label: 'Class share taken',
            classLeft: 0,
            childLeft: result.childLeft
        };
    }
    return result;
}

/** The satchel entry for a treasure taken from a stall (bought or won). */
export function stallInventoryEntry(item = {}, { classId = '', source = '', acquiredAt = new Date().toISOString() } = {}) {
    const tier = normalizeTier(item.tier || tierForPrice(item.price));
    const shelf = item.shelf === 'festival' ? 'festival' : 'seasonal';
    const entry = {
        id: item.id,
        name: item.name,
        image: item.image || null,
        icon: item.icon || null,
        description: item.description || '',
        acquiredAt,
        tier,
        shelf,
        league: text(item.league),
        monthKey: text(item.monthKey),
        charm: charmFor({ ...item, tier }).id
    };
    if (shelf === 'festival' && item.festivalId) entry.festivalId = text(item.festivalId);
    if (item.collection) entry.collection = text(item.collection);
    if (Number.isFinite(Number(item.price))) entry.price = Math.round(Number(item.price));
    if (classId) entry.classId = classId;
    if (source) entry.source = source;
    return entry;
}
