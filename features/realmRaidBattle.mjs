/**
 * Realm Raid as a battle: each league's job and skill, and the battle messages in words that fit
 * the class watching (young, middle or older leagues). Pure; no DOM. Covered by
 * tests/realm-raid-battle.test.mjs. The rules of the raid itself are in realmRaidCore.mjs.
 *
 * Every word is gentle: nobody is hurt. Classes "cast" skills of light at Eldhorn's shield, the
 * shield "cracks" and "loses light", and Eldhorn is a friendly guardian who bows when it breaks.
 */

/** One job per league, from the youngest to the oldest. `tier` picks the words the class reads. */
export const LEAGUE_JOBS = Object.freeze({
    'Pre-Junior': { job: 'Star Sprites', skill: 'Twinkle Toss', icon: '✨', color: '#f472b6', deep: '#9d174d', tier: 'young' },
    'Junior A': { job: 'Bubble Squires', skill: 'Bubble Burst', icon: '🫧', color: '#38bdf8', deep: '#075985', tier: 'young' },
    'Junior B': { job: 'Leaf Rangers', skill: 'Leaf Whirl', icon: '🍃', color: '#4ade80', deep: '#166534', tier: 'young' },
    A: { job: 'Comet Knights', skill: 'Comet Dash', icon: '☄️', color: '#fb923c', deep: '#9a3412', tier: 'mid' },
    B: { job: 'Storm Archers', skill: 'Thunder Arrow', icon: '⚡', color: '#facc15', deep: '#854d0e', tier: 'mid' },
    C: { job: 'Arcane Mages', skill: 'Arcane Nova', icon: '🔮', color: '#a78bfa', deep: '#5b21b6', tier: 'senior' },
    D: { job: 'Dragon Paladins', skill: 'Dragon Flare', icon: '🐉', color: '#f87171', deep: '#991b1b', tier: 'senior' }
});

const FALLBACK_JOB = Object.freeze({ job: 'Adventurers', skill: 'Star Strike', icon: '⭐', color: '#fbbf24', deep: '#92400e', tier: 'mid' });

/** The job of a league ("Junior A", "junior a", "JUNIOR-A" all match). */
export function leagueJob(league) {
    const norm = (v) => String(v || '').trim().toLowerCase().replace(/[-_\s]+/g, ' ');
    const key = norm(league);
    const hit = Object.entries(LEAGUE_JOBS).find(([name]) => norm(name) === key);
    return hit ? hit[1] : FALLBACK_JOB;
}

/** The words for a class: young (Pre-Junior, Junior), mid (A, B) or senior (C, D). */
export function wordTier(league) {
    return leagueJob(league).tier;
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
    const { skill, icon } = leagueJob(row?.league);
    const name = row?.name || 'A class';
    const big = isBigHit(stars, row?.share);
    if (tier === 'young') return `${name}: ${icon} ${skill}! ${big ? 'WOW! ' : ''}−${fmt(stars)} ⭐`;
    if (tier === 'senior') return `${name} cast ${skill}${big ? ' — critical!' : ''} ${fmt(stars)} light to the shield.`;
    return `${name} use ${skill}!${big ? ' Super strike!' : ''} The shield loses ${fmt(stars)}.`;
}

/** Eldhorn's line, by the state of the fight and the class's tier. */
export function bossLine({ phase = 'active', mood = 'proud', broken = false, legendary = false, guardian = 'Eldhorn', tier = 'mid' } = {}) {
    const say = (young, mid, senior) => `${guardian}: “${tier === 'young' ? young : tier === 'senior' ? senior : mid}”`;
    if (phase === 'herald') return say('Hello, heroes! Bring your stars!', 'Soon I guard the realm. Bring your brightest stars!', 'Soon the realm is mine to guard. Prove your English, heroes.');
    if (legendary) return say('WOW! You are LEGENDS!', 'Legendary! I have never seen a party like you!', 'Legendary. No party has ever shone this bright.');
    if (broken && phase === 'active') return say('My shield broke! Keep shining!', 'You broke my shield! Every star now counts for Legendary!', 'The shield is broken. Can you reach Legendary?');
    if (broken) return say('You won! Hooray!', 'You did it, heroes! I bow to you.', 'Well fought, heroes. I bow to the whole school.');
    if (phase !== 'active') return say('Good try! See you soon!', 'A brave fight! I will come back next term.', 'A worthy fight. We meet again next term.');
    if (mood === 'strain') return say('Oh no! My shield is cracking!', 'My shield is cracking! Just a little more!', 'My shield won’t hold much longer…');
    if (mood === 'brace') return say('Ooh, your stars are bright!', 'Hmm! Your stars shine bright!', 'Your light is stronger than I thought.');
    return say('My shield is BIG! Can you crack it?', 'My shield is strong! Show me your best English!', 'My shield has never fallen. Show me what you can do.');
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
