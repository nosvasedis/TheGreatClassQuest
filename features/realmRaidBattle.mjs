/**
 * Realm Raid as a battle: the hero arts each star strikes with, and the battle words that fit the
 * class watching (young, middle or older leagues). Pure; no DOM. Covered by
 * tests/realm-raid-battle.test.mjs. The rules of the raid itself are in realmRaidCore.mjs.
 *
 * Every word is gentle: nobody is hurt. Classes "cast" skills of light at Eldhorn's shield, the
 * shield "cracks" and "loses light", and Eldhorn is a friendly guardian who bows when it breaks.
 */

/**
 * The app's eight hero classes (features/heroClasses.js), each with the star it earns from and one
 * art from its own skill tree (features/heroSkillTree.js). In the raid, every star a class earns
 * strikes Eldhorn's shield with the art of the hero class that star belongs to: a Respect star is a
 * Guardian's Bulwark, a Creativity star a Sage's Creative Spark, and so on. A class stands on the
 * battlefield dressed as the hero class most of its students chose.
 */
export const HERO_ARTS = Object.freeze({
    Guardian: { heroClass: 'Guardian', art: 'Bulwark', icon: '🛡️', reasons: ['respect'], virtue: 'Respect', color: '#22c55e', deep: '#166534', sprite: 'guardian' },
    Sage: { heroClass: 'Sage', art: 'Creative Spark', icon: '🔮', reasons: ['creativity'], virtue: 'Creativity', color: '#a855f7', deep: '#6b21a8', sprite: 'sage' },
    Paladin: { heroClass: 'Paladin', art: 'Battle Bond', icon: '⚔️', reasons: ['teamwork'], virtue: 'Teamwork', color: '#3b82f6', deep: '#1e3a8a', sprite: 'paladin' },
    Artificer: { heroClass: 'Artificer', art: 'Workshop', icon: '⚙️', reasons: ['focus'], virtue: 'Focus', color: '#f59e0b', deep: '#92400e', sprite: 'artificer' },
    Scholar: { heroClass: 'Scholar', art: 'Academic Edge', icon: '📜', reasons: ['scholar_s_bonus'], virtue: 'Trial results', color: '#06b6d4', deep: '#155e75', sprite: 'scholar' },
    Vanguard: { heroClass: 'Vanguard', art: 'Four Arts', icon: '⚜️', reasons: ['story_weaver', 'vanishing_hoard', 'torn_map', 'round_table'], virtue: 'Training Grounds', color: '#14b8a6', deep: '#115e59', sprite: 'vanguard' },
    Nomad: { heroClass: 'Nomad', art: 'Open Road', icon: '👟', reasons: ['welcome_back'], virtue: 'Coming back', color: '#8b5cf6', deep: '#4c1d95', sprite: 'nomad' },
    Patron: { heroClass: 'Patron', art: 'Open Hand', icon: '💝', reasons: ['peer_boon'], virtue: "Hero's Boons", color: '#f43f5e', deep: '#9f1239', sprite: 'patron' }
});

/** Stars that belong to no hero class (quizzes, quests, excellence...): the whole class's Star Strike. */
export const STAR_ART = Object.freeze({ heroClass: '', art: 'Star Strike', icon: '⭐', reasons: [], virtue: 'Every other star', color: '#fbbf24', deep: '#92400e', sprite: 'adventurer' });

const ART_BY_REASON = new Map(Object.values(HERO_ARTS).flatMap((art) => art.reasons.map((r) => [r, art])));

/** The hero art a star of this reason strikes with. */
export function artForReason(reason) {
    return ART_BY_REASON.get(String(reason || '')) || STAR_ART;
}

/** The hero art of a hero class (old names such as "Weaver" read as Vanguard). */
export function heroArt(heroClass) {
    const name = String(heroClass || '').trim();
    return HERO_ARTS[name === 'Weaver' ? 'Vanguard' : name] || STAR_ART;
}

/**
 * The hero class a class fights as: the one most of its students chose (`heroMix`, counts by hero
 * class); with no choices yet, the hero class of the stars it earned most this raid (`reasons`).
 */
export function classArt(row = {}) {
    const pick = (counts, toArt) => {
        const best = Object.entries(counts || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([key]) => toArt(key)).find((art) => art !== STAR_ART);
        return best || null;
    };
    return pick(row.heroMix, heroArt) || pick(row.reasons, artForReason) || STAR_ART;
}

/** The arts of a strike, biggest first: { art, stars } from the stars it gained by reason. */
export function strikeArts(gained = {}) {
    const byArt = new Map();
    Object.entries(gained).forEach(([reason, n]) => {
        if (!(n > 0)) return;
        const art = artForReason(reason);
        byArt.set(art, (byArt.get(art) || 0) + n);
    });
    return [...byArt.entries()].map(([art, stars]) => ({ art, stars })).sort((a, b) => b.stars - a.stars);
}

/** The leagues, youngest first, and the words each one reads (young, mid or senior). */
export const LEAGUES = Object.freeze(['Pre-Junior', 'Junior A', 'Junior B', 'A', 'B', 'C', 'D']);
const TIERS = { 'pre junior': 'young', 'junior a': 'young', 'junior b': 'young', a: 'mid', b: 'mid', c: 'senior', d: 'senior' };
const norm = (v) => String(v || '').trim().toLowerCase().replace(/[-_\s]+/g, ' ');

/** Where a league sits, youngest first (unknown leagues last). */
export function leagueRank(league) {
    const i = LEAGUES.findIndex((name) => norm(name) === norm(league));
    return i < 0 ? 99 : i;
}

/** The words for a class: young (Pre-Junior, Junior), mid (A, B) or senior (C, D). */
export function wordTier(league) {
    return TIERS[norm(league)] || 'mid';
}

const fmt = (n) => {
    const v = Math.round((Number(n) || 0) * 2) / 2;
    return v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
};

/** A big hit: a good share of the class's own shard in one day (or 10 stars when the share is unknown). */
export function isBigHit(stars, share = 0) {
    return share > 0 ? stars >= Math.max(6, share * 0.4) : stars >= 10;
}

/** One class striking the shield, in the watching class's words. */
export function strikeLine(row, stars, tier = 'mid') {
    const { art: skill, icon } = classArt(row);
    const name = row?.name || 'A class';
    const big = isBigHit(stars, row?.share);
    if (tier === 'young') return `${name}: ${icon} ${skill}! ${big ? 'WOW! ' : ''}−${fmt(stars)} ⭐`;
    if (tier === 'senior') return `${name} cast ${skill}${big ? ' — critical!' : ''} ${fmt(stars)} light to the shield.`;
    return `${name} use ${skill}!${big ? ' Super strike!' : ''} The shield loses ${fmt(stars)}.`;
}

/** Eldhorn's line: a few words, by the state of the fight and the class's tier. */
export function bossLine({ phase = 'active', mood = 'proud', broken = false, legendary = false, guardian = 'Eldhorn', tier = 'mid' } = {}) {
    const say = (young, mid, senior) => `${guardian}: “${tier === 'young' ? young : tier === 'senior' ? senior : mid}”`;
    if (phase === 'herald') return say('I am coming!', 'Bring your stars!', 'Prove your English.');
    if (legendary) return say('WOW! Legends!', 'You are legends!', 'Truly legendary.');
    if (broken && phase === 'active') return say('Keep shining!', 'Now go for Legendary!', 'Can you reach Legendary?');
    if (broken) return say('You won! Yay!', 'I bow to you!', 'Well fought, heroes.');
    if (phase !== 'active') return say('Good try!', 'See you next term!', 'We meet again.');
    if (mood === 'strain') return say('Oh no! Cracks!', 'Just a little more!', 'It won’t hold long…');
    if (mood === 'brace') return say('Ooh, so bright!', 'Your stars are strong!', 'Stronger than I thought.');
    return say('Can you crack it?', 'Show me your best!', 'My shield never falls.');
}

/** Short captions for the battle screen, in the class's words. */
const CAPTIONS = {
    round: { young: 'Round {n}!', mid: 'Round {n}', senior: 'Round {n}' },
    lastRound: { young: 'Last round!', mid: 'Final round!', senior: 'Final round' },
    rest: { young: 'Rest day', mid: 'Rest day', senior: 'No lessons' },
    cleared: { young: 'Yay!', mid: 'Round won!', senior: 'Round cleared' },
    valor: { young: 'Broken!', mid: 'Shard broken!', senior: 'Shard broken' },
    away: { young: 'Zzz', mid: 'Resting', senior: 'No lessons' },
    big: { young: 'WOW!', mid: 'Super!', senior: 'Critical!' }
};

export function caption(key, tier = 'mid', vars = {}) {
    const words = CAPTIONS[key]?.[tier] || CAPTIONS[key]?.mid || '';
    return words.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** The opening line of a turn ("Turn 3 begins!"). */
export function turnLine(n, total, tier = 'mid') {
    if (n === total) return tier === 'young' ? `Last turn! Go, go, go!` : `Final turn! Every star counts!`;
    if (n === 1) return tier === 'young' ? `Turn 1! The battle starts!` : `Turn 1 of ${total}: the battle begins!`;
    return tier === 'young' ? `Turn ${n}! Your move!` : `Turn ${n} of ${total}!`;
}

/**
 * The message window: the newest few lines of the fight, oldest first, each { kind, text }.
 * `turns` is realmRaidView#raidTurns; `byDayClass` the tally of stars per day per class;
 * `rows` the classes ({ classId, name, league }).
 */
export function battleMessages({ raid, status, turns = [], byDayClass = {}, rows = [], mood = 'proud', tier = 'mid', limit = 4 } = {}) {
    if (!raid) return [];
    const guardian = raid.season?.guardian || 'Eldhorn';
    const byId = new Map(rows.map((r) => [r.classId, r]));
    const lines = [];
    if (raid.phase === 'herald') {
        lines.push({ kind: 'system', text: tier === 'young' ? `${guardian} is coming! ${raid.daysToStart} ${raid.daysToStart === 1 ? 'day' : 'days'} to go!` : `${guardian} approaches! The battle begins in ${raid.daysToStart} ${raid.daysToStart === 1 ? 'day' : 'days'}.` });
        lines.push({ kind: 'boss', text: bossLine({ phase: 'herald', guardian, tier }) });
        return lines.slice(-limit);
    }
    const played = turns.filter((t) => t.when !== 'next');
    played.forEach((t) => {
        lines.push({ kind: 'turn', text: turnLine(t.n, turns.length, tier) });
        Object.entries(byDayClass[t.key] || {})
            .filter(([, n]) => n > 0)
            .sort((a, b) => a[1] - b[1])
            .forEach(([id, n]) => lines.push({ kind: 'hit', classId: id, text: strikeLine(byId.get(id) || { name: 'A class' }, n, tier) }));
        if (!t.lessons) lines.push({ kind: 'system', text: tier === 'young' ? 'Rest day. Zzz…' : 'No lessons today: the party rests.' });
    });
    if (status?.broken) lines.push({ kind: 'big', text: status.legendary ? (tier === 'young' || raid.phase === 'active' ? '👑 LEGENDARY!' : '👑 LEGENDARY VICTORY!') : (tier === 'young' ? '💥 The shield broke!' : '💥 The shield shatters!') });
    lines.push({ kind: 'boss', text: bossLine({ phase: raid.phase, mood, broken: status?.broken, legendary: status?.legendary, guardian, tier }) });
    return lines.slice(-limit);
}

/** Titles for the battle screen header, in the class's words. */
export function battleTitle({ raid, status, tier = 'mid' } = {}) {
    if (!raid) return '';
    if (raid.phase === 'herald') return tier === 'young' ? 'A boss is coming!' : 'A boss approaches!';
    if (raid.phase === 'active') {
        if (status?.legendary) return 'LEGENDARY!';
        if (status?.broken) return tier === 'young' ? 'Shield broken!' : 'Shield shattered!';
        return 'BOSS BATTLE';
    }
    if (status?.legendary) return 'LEGENDARY VICTORY!';
    return status?.broken ? 'VICTORY!' : 'The shield held';
}
