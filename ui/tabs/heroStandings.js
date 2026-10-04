// /ui/tabs/heroStandings.js
// Hero's Challenge standings: the podium, the hero rows below it, and the
// rank-change show that plays when the board has moved since this device last
// looked (stars counting up, heroes gliding to their new places).
//
// Everything here is pure markup + DOM motion: no app state, so the guidebook
// capture stage renders the same markup the app does.

const SNAPSHOT_KEY = 'gcq.heroStandings.v1';
const SNAPSHOT_LIMIT = 16;
const PODIUM_SIZE = 3;

export function escapeStandingsHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Ranks come from the shared hero ranking rules (same as the Ceremony).
export { assignHeroRanks } from '../../features/heroRanking.js';

// --- Snapshots (what this device last showed, per board) ---------------------

function readAllSnapshots() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function readStandingsSnapshot(boardKey) {
    return readAllSnapshots()[boardKey] || null;
}

export function writeStandingsSnapshot(boardKey, snapshot) {
    try {
        const all = readAllSnapshots();
        all[boardKey] = { ...snapshot, at: Date.now() };
        const keys = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
        keys.slice(SNAPSHOT_LIMIT).forEach((k) => delete all[k]);
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
    } catch {
        /* storage full or blocked: the board still works, it just can't replay changes */
    }
}

/** { sections: { [sectionId]: { order: [id], scores: { id: n }, ranks: { id: n } } } } */
export function buildStandingsSnapshot(sections) {
    const out = { sections: {} };
    sections.forEach((section) => {
        const scores = {};
        const ranks = {};
        section.entries.forEach((e) => {
            scores[e.id] = e.score;
            ranks[e.id] = e.rank;
        });
        out.sections[section.id] = { order: section.entries.map((e) => e.id), scores, ranks };
    });
    return out;
}

/**
 * Annotates entries with how they moved against two earlier looks:
 * `baseline` (start of this visit) drives the ▲/▼ and +N chips, `previous`
 * (the last thing drawn) drives the motion.
 */
export function annotateStandingsChanges(sections, baseline, previous) {
    let anyMotion = false;
    sections.forEach((section) => {
        const base = baseline?.sections?.[section.id] || null;
        const prev = previous?.sections?.[section.id] || null;
        const ids = new Set(section.entries.map((e) => e.id));
        const prevOrder = prev ? prev.order.filter((id) => ids.has(id)) : null;
        section.previousLeaderId = prev?.order?.[0] || null;
        section.entries.forEach((e, slot) => {
            e.slot = slot;
            if (base && base.scores[e.id] !== undefined) {
                e.gain = e.score - base.scores[e.id];
                e.climb = (base.ranks[e.id] || e.rank) - e.rank;
            } else {
                e.gain = 0;
                e.climb = 0;
            }
            if (prevOrder) {
                const from = prevOrder.indexOf(e.id);
                e.fromSlot = from;
                e.fromScore = prev.scores[e.id] !== undefined ? prev.scores[e.id] : e.score;
                e.fromRank = prev.ranks[e.id] || e.rank;
                if (from !== slot || e.fromScore !== e.score) anyMotion = true;
            } else {
                e.fromSlot = slot;
                e.fromScore = e.score;
                e.fromRank = e.rank;
            }
        });
    });
    return anyMotion;
}

// --- Markup -----------------------------------------------------------------

function moveChipHtml(e) {
    if (e.climb > 0) {
        return `<span class="hcs-move hcs-move--up" title="Up ${e.climb} place${e.climb === 1 ? '' : 's'} since your last look"><i class="fas fa-caret-up" aria-hidden="true"></i>${e.climb}</span>`;
    }
    if (e.climb < 0) {
        return `<span class="hcs-move hcs-move--down" title="Down ${-e.climb} place${e.climb === -1 ? '' : 's'} since your last look"><i class="fas fa-caret-down" aria-hidden="true"></i>${-e.climb}</span>`;
    }
    return '';
}

function gainChipHtml(e) {
    if (!(e.gain > 0)) return '';
    return `<span class="hcs-gain" title="${e.gain} new star${e.gain === 1 ? '' : 's'} since your last look">+${e.gain}</span>`;
}

function countHtml(e) {
    return `<span class="hcs-count" data-hcs-count data-from="${e.fromScore ?? e.score}" data-to="${e.score}">${e.score}</span>`;
}

/**
 * The hero class emblem left of a name: a round badge in the class's aura
 * colour, with a card on hover or focus naming the rank, level and perk.
 * heroClass: { cls, icon, aura, title, level, maxLevel, perk, next }
 */
export function heroEmblemHtml(hc) {
    if (!hc?.icon) return '';
    const level = Number(hc.level) || 0;
    const levelLine = level > 0
        ? `${escapeStandingsHtml(hc.cls)} · Level ${level}${hc.maxLevel >= level ? ` of ${hc.maxLevel}` : ''}`
        : `${escapeStandingsHtml(hc.cls)} · Not ranked up yet`;
    const next = hc.legend
        ? `<span class="hcs-emblem__next hcs-emblem__legend"><i class="fas fa-crown" aria-hidden="true"></i> <b>${escapeStandingsHtml(hc.legend)}</b></span>`
        : hc.next ? `<span class="hcs-emblem__next">Next rank: <b>${escapeStandingsHtml(hc.next)}</b></span>` : '';
    const perk = hc.perk ? `<span class="hcs-emblem__perk"><i class="fas fa-coins" aria-hidden="true"></i>${escapeStandingsHtml(hc.perk)}</span>` : '';
    const label = `${hc.title || hc.cls}, ${hc.cls}${level > 0 ? ` level ${level}` : ''}`;
    return `<span class="hcs-emblem${hc.legend ? ' is-legend' : ''}" style="--aura:${escapeStandingsHtml(hc.aura || '#7c3aed')}" tabindex="0" role="img" aria-label="${escapeStandingsHtml(label)}">
            <span class="hcs-emblem__icon" aria-hidden="true">${hc.icon}</span>
            ${level > 0 ? `<span class="hcs-emblem__lvl" aria-hidden="true">${level}</span>` : ''}
            <span class="hcs-emblem__tip" aria-hidden="true">
                <span class="hcs-emblem__head"><span class="hcs-emblem__tip-icon">${hc.icon}</span><b>${escapeStandingsHtml(hc.title || hc.cls)}</b></span>
                <span class="hcs-emblem__lvlline">${levelLine}</span>
                ${perk}${next}
            </span>
        </span>`;
}

function nameHtml(e, { emblem: withEmblem = true } = {}) {
    if (!withEmblem) return `<span class="hcs-name__text">${escapeStandingsHtml(e.name)}</span>`;
    const emblem = e.heroClass
        ? heroEmblemHtml(e.heroClass)
        : (e.heroIcon ? `<span class="hcs-name__icon" aria-hidden="true">${e.heroIcon}</span>` : '');
    return `${emblem}<span class="hcs-name__text">${escapeStandingsHtml(e.name)}</span>`;
}

function classChipHtml(e) {
    if (!e.showClass) return '';
    return `<span class="hcs-chip hcs-chip--class" title="${escapeStandingsHtml(e.className)}"><span aria-hidden="true">${e.classLogo || ''}</span><span class="hcs-chip__text">${escapeStandingsHtml(e.className)}</span></span>`;
}

function goldChipHtml(e) {
    return `<span class="hcs-chip hcs-chip--gold" title="Gold"><i class="fas fa-coins" aria-hidden="true"></i>${escapeStandingsHtml(e.gold)}</span>`;
}

const PLACE_NAMES = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function ordinal(n) {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

// --- The podium ----------------------------------------------------------------
//
// Everyone who holds a medal place (1st, 2nd or 3rd under the shared ranking
// rules) stands on the podium, so a tie never pushes a hero off it:
//   - 1, 2, 3        three heroes, one per pedestal
//   - 1, 1, 1, 1     four heroes share the gold, nobody else fits (next is 5th)
//   - 1, 2, 2, 2     gold plus three silvers
//   - 1, 1, 3, 3     two golds and two bronzes
// Up to five heroes keep the classic side-by-side stage (each pedestal widens
// for its group); a bigger crowd, or a group of four or more, stands on
// stacked tiers instead, gold on top. Phones stack from four heroes up.

const CLASSIC_MAX = 5;
const GROUP_CLASSIC_MAX = 3;
const PHONE_CLASSIC_MAX = 3;

/** The podium heroes: a medal place and at least one star. */
export function pickPodiumEntries(entries = []) {
    const out = [];
    for (const e of entries) {
        if (!(e.score > 0) || !(e.rank <= PODIUM_SIZE)) break;
        out.push(e);
    }
    return out;
}

/** 'classic', 'wide' (classic, but stacked on phones) or 'tiers'. */
export function choosePodiumLayout(groups) {
    const total = groups.reduce((n, g) => n + g.heroes.length, 0);
    const biggest = groups.reduce((n, g) => Math.max(n, g.heroes.length), 0);
    if (total > CLASSIC_MAX || biggest > GROUP_CLASSIC_MAX) return 'tiers';
    return total > PHONE_CLASSIC_MAX ? 'wide' : 'classic';
}

function heroCount(n) {
    return `${n} hero${n === 1 ? '' : 'es'}`;
}

/**
 * The note under a lone podium hero: how far 1st is ahead, or that equal
 * stars were split by the tie-breakers. A shared place is said once, on its
 * pedestal, instead of under every hero.
 */
function podiumNoteHtml(e, group, entries) {
    if (group.heroes.length > 1 || e.rank !== 1) return '';
    const next = entries.find((other) => other.rank > 1);
    if (!next) return '';
    const leadBy = e.score - next.score;
    return leadBy > 0
        ? `<span class="hcs-figure__lead">Leads by ${leadBy}</span>`
        : '<span class="hcs-figure__lead" title="Level on stars: more 3-star and 2-star awards, more kinds of awards, then the better test average decide">Wins the tie-break</span>';
}

/** Letters in the name's longest word: the podium shrinks a name to fit it whole. */
function longestWord(name) {
    return String(name || '').split(/[\s-]+/).reduce((n, w) => Math.max(n, w.length), 0);
}

function podiumFigureHtml(e, group, entries, k, packed) {
    const crown = e.rank === 1
        ? '<span class="hcs-figure__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>'
        : '';
    const lead = podiumNoteHtml(e, group, entries);
    // A packed hero keeps the guild badge; titles and pills wait for the rows' room.
    const badges = packed ? (e.guildBadgeHtml || '') : `${e.guildBadgeHtml || ''}${e.titleBadgeHtml || ''}${e.roleBadgesHtml || ''}`;
    return `
        <div class="hcs-figure${packed ? ' hcs-figure--packed' : ''}" data-hcs-mover data-hcs-id="${escapeStandingsHtml(e.id)}" data-hcs-slot="${e.slot}" data-hcs-from="${e.fromSlot}" style="--k:${k};--lw:${Math.max(4, longestWord(e.name))}">
            ${crown}
            <div class="hcs-figure__portrait hero-challenge-avatar-wrap">
                <span class="hcs-figure__ring" aria-hidden="true"></span>
                ${e.avatarLargeHtml}
                ${e.familiarHtml || ''}
                ${e.heroClass ? heroEmblemHtml(e.heroClass) : ''}
            </div>
            <h3 class="hcs-figure__name font-title">${nameHtml(e, { emblem: !e.heroClass })}</h3>
            <div class="hcs-figure__badges">${badges}</div>
            <div class="hcs-figure__stars">
                <i class="fas fa-star hcs-figure__star" aria-hidden="true"></i>
                ${countHtml(e)}
                ${gainChipHtml(e)}
            </div>
            <div class="hcs-figure__chips">${moveChipHtml(e)}${lead}${classChipHtml(e)}</div>
            ${packed ? '' : `<div class="hcs-figure__pills">${e.pillsHtml || ''}</div>`}
        </div>`;
}

function pedestalTagHtml(group) {
    const n = group.heroes.length;
    if (n > 1) {
        return `<span class="hcs-pedestal__tag" title="Same stars and the same tie-breakers">Tied for ${ordinal(group.rank)}<b> · ${heroCount(n)}</b></span>`;
    }
    return `<span class="hcs-pedestal__tag hcs-pedestal__tag--solo">${ordinal(group.rank)} place</span>`;
}

/** The ribbon over a shared crown. */
function crownBannerHtml(gold, metric) {
    const n = gold.heroes.length;
    if (n < 2) return '';
    const sub = metric === 'monthly'
        ? '<span class="hcs-podium__banner-sub">Co-Prodigies if the month ended today</span>'
        : '<span class="hcs-podium__banner-sub">Level on every star</span>';
    return `
        <div class="hcs-podium__banner" role="note">
            <i class="fas fa-crown" aria-hidden="true"></i>
            <span class="hcs-podium__banner-main">${n === 2 ? 'Two heroes share' : `${n} heroes share`} the crown</span>
            ${sub}
        </div>`;
}

function podiumHtml(spots, metric) {
    const groups = [];
    spots.forEach((e) => {
        const last = groups[groups.length - 1];
        if (last && last.rank === e.rank) last.heroes.push(e);
        else groups.push({ rank: e.rank, heroes: [e] });
    });
    const layout = choosePodiumLayout(groups);
    const packedEverywhere = layout === 'tiers';
    // Classic stage order: silver, gold, bronze (tiers restack gold on top in
    // CSS). The metal follows the place, so a shared place shares one pedestal.
    const byRank = (r) => groups.find((g) => g.rank === r);
    const order = [byRank(2), byRank(1), byRank(3)].filter(Boolean);
    const spotsHtml = order.map((group) => {
        const metal = PLACE_NAMES[group.rank];
        const n = group.heroes.length;
        const packed = packedEverywhere || n > 1;
        const figures = group.heroes.map((e, k) => podiumFigureHtml(e, group, spots, k, packed)).join('');
        return `
            <div class="hcs-spot hcs-spot--${metal}${n > 1 ? ' hcs-spot--shared' : ''}" style="--n:${n}">
                <div class="hcs-spot__heroes">${figures}</div>
                <div class="hcs-pedestal" aria-hidden="true">
                    <span class="hcs-pedestal__cap"></span>
                    <span class="hcs-pedestal__num font-title">${group.rank}</span>
                    ${pedestalTagHtml(group)}
                </div>
            </div>`;
    }).join('');
    const motes = Array.from({ length: 10 }, (_, i) => `<i style="--m:${i}"></i>`).join('');
    return `
        <div class="hcs-podium hcs-podium--${layout}" data-spots="${spots.length}" style="--total:${spots.length}">
            <div class="hcs-podium__backdrop" aria-hidden="true">
                <div class="hcs-podium__rays"></div>
                <div class="hcs-podium__motes">${motes}</div>
                <div class="hcs-podium__valance"></div>
            </div>
            ${crownBannerHtml(groups[0], metric)}
            <div class="hcs-podium__stage">${spotsHtml}</div>
        </div>`;
}

// --- Hero rows ----------------------------------------------------------------

const SKILL_TONES = {
    teamwork: 'violet',
    creativity: 'pink',
    respect: 'green',
    focus: 'amber',
    scholar_s_bonus: 'amber',
    teacher_boon: 'pink',
    pathfinder_map: 'indigo'
};

function traitHtml(tone, icon, text, title) {
    return `<span class="hcs-trait hcs-trait--${tone}" title="${escapeStandingsHtml(title)}"><i class="fas ${icon}" aria-hidden="true"></i><span>${escapeStandingsHtml(text)}</span></span>`;
}

/**
 * The little trait chips a hero carries (rows and podium): reigning Prodigy,
 * stars this week, perfect-lesson streak, top skill this month, egg news.
 * skill: { key, icon, name } · egg: { kind: 'ready' | 'soon', remaining }
 */
export function renderHeroTraitsHtml({ prodigy = false, weekStars = 0, streak = 0, skill = null, egg = null } = {}) {
    const out = [];
    if (prodigy) out.push(traitHtml('crown', 'fa-crown', 'Prodigy', 'Reigning Prodigy of the Month'));
    if (weekStars > 0) out.push(traitHtml('fire', 'fa-fire', `+${weekStars} this week`, `${weekStars} star${weekStars === 1 ? '' : 's'} this week`));
    if (streak > 1) out.push(traitHtml('bolt', 'fa-bolt', `${streak} perfect`, `${streak} perfect 3-star lessons in a row`));
    if (skill?.name) out.push(traitHtml(SKILL_TONES[skill.key] || 'sky', skill.icon || 'fa-star', skill.name, 'Top skill this month'));
    if (egg?.kind === 'ready') out.push(traitHtml('egg', 'fa-egg', 'Ready to hatch', 'This egg is ready to hatch now'));
    else if (egg?.kind === 'soon') out.push(traitHtml('egg', 'fa-egg', `${egg.remaining} to hatch`, `${egg.remaining} more star${egg.remaining === 1 ? '' : 's'} until the egg hatches`));
    return out.join('');
}

/** Guild role badges: this month's Guild Champion and the guild's Top Hero. */
export function renderHeroRoleBadgesHtml({ champion = false, topHero = false, color = '' } = {}) {
    const style = color ? ` style="--badge:${escapeStandingsHtml(color)}"` : '';
    let html = '';
    if (champion) html += `<span class="hcs-badge hcs-badge--champion"${style} title="Guild Champion this month"><i class="fas fa-shield-alt" aria-hidden="true"></i>Champion</span>`;
    if (topHero) html += '<span class="hcs-badge hcs-badge--top" title="Top Hero for this guild"><i class="fas fa-medal" aria-hidden="true"></i>Top Hero</span>';
    return html;
}

/**
 * The bar under a hero's name: how far along the road to 1st they are (their
 * stars as a share of the leader's), with a flag where the podium starts.
 */
function roadHtml(e, { leaderScore, podiumFloor }) {
    const pct = leaderScore > 0 ? Math.round((e.score / leaderScore) * 100) : 0;
    const flag = podiumFloor > 0 && podiumFloor < leaderScore
        ? `<span class="hcs-road__flag" style="--at:${(podiumFloor / leaderScore).toFixed(3)}" title="The podium starts at ${podiumFloor} star${podiumFloor === 1 ? '' : 's'}"></span>`
        : '';
    const label = e.score > 0 ? `${pct}% of the way to 1st` : 'No stars yet';
    return `
        <div class="hcs-road" title="${e.score} of the leader's ${leaderScore} stars">
            <span class="hcs-road__track" aria-hidden="true">
                <span class="hcs-road__fill"></span>
                ${flag}
                <i class="fas fa-crown hcs-road__goal"></i>
            </span>
            <span class="hcs-road__label">${label}</span>
        </div>`;
}

function rowHtml(e, above, { firstBelowPodium = false, leaderScore = 0, podiumFloor = 0 } = {}) {
    let gapHtml = '';
    if (above) {
        const gap = above.score - e.score;
        if (gap > 0 && firstBelowPodium) {
            gapHtml = `<span class="hcs-row__gap hcs-row__gap--podium" title="Stars to draw level with ${escapeStandingsHtml(above.name)} on the podium"><i class="fas fa-flag" aria-hidden="true"></i>${gap} from the podium</span>`;
        } else if (gap > 0) {
            gapHtml = `<span class="hcs-row__gap" title="Stars to draw level with ${escapeStandingsHtml(above.name)}"><i class="fas fa-arrow-up" aria-hidden="true"></i>${gap} to catch ${escapeStandingsHtml(above.name)}</span>`;
        } else if (above.rank === e.rank) {
            gapHtml = `<span class="hcs-row__gap hcs-row__gap--tie" title="Same stars and the same tie-breakers"><i class="fas fa-equals" aria-hidden="true"></i>Tied for ${ordinal(e.rank)}</span>`;
        } else {
            gapHtml = `<span class="hcs-row__gap hcs-row__gap--tie" title="${escapeStandingsHtml(above.name)} has more 3-star or 2-star awards, more kinds of awards, or a better test average"><i class="fas fa-balance-scale" aria-hidden="true"></i>Behind on tie-break</span>`;
        }
    }
    const accent = e.accent ? `--hcs-accent:${escapeStandingsHtml(e.accent)};` : '';
    const crest = e.guildBadgeHtml ? `<span class="hcs-row__crest">${e.guildBadgeHtml}</span>` : '';
    return `
        <li class="hcs-row${firstBelowPodium ? ' hcs-row--next' : ''}" data-hcs-mover data-hcs-id="${escapeStandingsHtml(e.id)}" data-hcs-slot="${e.slot}" data-hcs-from="${e.fromSlot}" style="${accent}--hcs-power:${e.power.toFixed(3)};--hcs-power-from:${(e.powerFrom ?? e.power).toFixed(3)};--hcs-i:${e.slot}">
            <div class="hcs-row__rank" aria-label="Rank ${e.rank}">
                <span class="hcs-shield"><span class="hcs-shield__num font-title" data-hcs-rank data-from="${e.fromRank ?? e.rank}" data-to="${e.rank}">${e.rank}</span></span>
            </div>
            <div class="hcs-row__portrait hero-challenge-avatar-wrap">
                ${e.avatarHtml}
                ${e.familiarHtml || ''}
                ${crest}
            </div>
            <div class="hcs-row__body">
                <div class="hcs-row__head">
                    <h3 class="hcs-row__name font-title">${nameHtml(e)}</h3>
                    ${e.titleBadgeHtml || ''}${e.roleBadgesHtml || ''}${moveChipHtml(e)}
                </div>
                <div class="hcs-row__meta">${goldChipHtml(e)}${classChipHtml(e)}${e.pillsHtml || ''}</div>
                ${roadHtml(e, { leaderScore, podiumFloor })}
            </div>
            <div class="hcs-row__score">
                <div class="hcs-row__stars">
                    <i class="fas fa-star" aria-hidden="true"></i>
                    ${countHtml(e)}
                    ${gainChipHtml(e)}
                </div>
                ${gapHtml}
            </div>
        </li>`;
}

function openRaceHtml(monthName, metric) {
    const line = metric === 'monthly'
        ? `No stars yet in ${escapeStandingsHtml(monthName)}. The first hero to shine takes the crown!`
        : 'No stars yet. The first hero to shine takes the crown!';
    return `
        <div class="hcs-open-race">
            <span class="hcs-open-race__crown" aria-hidden="true"><i class="fas fa-crown"></i></span>
            <p>${line}</p>
        </div>`;
}

/**
 * The curtain drawn over a class's standings on its last lesson of the month,
 * so the Ceremony at the next lesson keeps its surprise. The small eye lets
 * the teacher peek on their own.
 */
function sealHtml(monthName) {
    const month = escapeStandingsHtml(monthName);
    const motes = Array.from({ length: 9 }, (_, i) => `<i style="--m:${i}"></i>`).join('');
    return `
        <div class="hcs-seal" data-hcs-seal>
            <div class="hcs-seal__stage" aria-hidden="true">
                <span class="hcs-seal__glow"></span>
                <span class="hcs-seal__motes">${motes}</span>
            </div>
            <span class="hcs-seal__curtain hcs-seal__curtain--l" aria-hidden="true"></span>
            <span class="hcs-seal__curtain hcs-seal__curtain--r" aria-hidden="true"></span>
            <span class="hcs-seal__valance" aria-hidden="true"></span>
            <div class="hcs-seal__card" role="status">
                <span class="hcs-seal__wax" aria-hidden="true">
                    <span class="hcs-seal__wax-drip"></span>
                    <i class="fas fa-crown"></i>
                </span>
                <span class="hcs-seal__kicker">Final lesson of ${month}</span>
                <h4 class="hcs-seal__title font-title">The standings are sealed</h4>
                <p class="hcs-seal__text">Who will wear the crown of ${month}? Every star is counted&hellip; all will be revealed at the <b>Ceremony</b> next lesson!</p>
                <span class="hcs-seal__hint" aria-hidden="true">
                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                </span>
            </div>
            <button type="button" class="hcs-seal__peek" data-hcs-unseal title="Teacher peek: reveal the standings" aria-label="Reveal the sealed standings">
                <i class="fas fa-eye" aria-hidden="true"></i>
            </button>
        </div>`;
}

function resealButtonHtml() {
    return `<button type="button" class="hcs-reseal" data-hcs-reseal title="Seal the standings again until the Ceremony" aria-label="Seal the standings again">
        <i class="fas fa-eye-slash" aria-hidden="true"></i><span>Seal again</span>
    </button>`;
}

/**
 * section: { id, title, logo, facts: [html], mine, entries, seal }
 * seal: null, or 'sealed' (curtain drawn) / 'open' (finale day, peeked at)
 * entry: { id, name, rank, score, gold, heroIcon, heroClass, accent, avatarHtml, avatarLargeHtml,
 *          familiarHtml, guildBadgeHtml, titleBadgeHtml, roleBadgesHtml, pillsHtml,
 *          className, classLogo, showClass, slot, fromSlot, fromScore, gain, climb }
 */
export function renderStandingsSectionHtml(section, { monthName = '', metric = 'monthly', delayIndex = 0 } = {}) {
    const entries = section.entries;
    const leaderScore = entries.reduce((m, e) => Math.max(m, e.score), 0);
    const prevLeaderScore = entries.reduce((m, e) => Math.max(m, e.fromScore ?? e.score), 0);
    entries.forEach((e) => {
        e.power = leaderScore > 0 ? e.score / leaderScore : 0;
        e.powerFrom = prevLeaderScore > 0 ? (e.fromScore ?? e.score) / prevLeaderScore : 0;
    });
    // Every hero holding 1st, 2nd or 3rd stands on the podium, however many
    // share a place; a hero with no stars never does.
    const spots = pickPodiumEntries(entries);
    const podiumCount = spots.length;
    const podium = podiumCount > 0 ? podiumHtml(spots, metric) : openRaceHtml(monthName, metric);
    const rows = entries.slice(podiumCount)
        .map((e, i) => rowHtml(e, entries[podiumCount + i - 1] || null, {
            firstBelowPodium: i === 0 && podiumCount > 0,
            leaderScore,
            podiumFloor: podiumCount > 0 ? spots[podiumCount - 1].score : 0
        }))
        .join('');
    const mine = section.mine ? '<span class="hcs-section__mine"><i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>Your class</span>' : '';
    const facts = (section.facts || []).map((f) => `<span class="hcs-section__fact">${f}</span>`).join('');
    const logo = section.logo
        ? `<span class="hcs-section__crest" aria-hidden="true"><span class="hcs-section__logo">${section.logo}</span></span>`
        : '<span class="hcs-section__crest hcs-section__crest--league" aria-hidden="true"><i class="fas fa-globe"></i></span>';
    const sealed = section.seal === 'sealed';
    const sealClass = sealed ? ' hcs-section--sealed' : (section.seal === 'open' ? ' hcs-section--peeked' : '');
    const board = `${podium}${rows ? `<ol class="hcs-ranks">${rows}</ol>` : ''}`;
    return `
        <section class="hcs-section${section.mine ? ' hcs-section--mine' : ''}${sealClass}" data-hcs-section="${escapeStandingsHtml(section.id)}" style="--hcs-d:${delayIndex}">
            <header class="hcs-section__head">
                ${logo}
                <div class="hcs-section__copy">
                    <h3 class="hcs-section__name font-title">${escapeStandingsHtml(section.title)}</h3>
                    <div class="hcs-section__facts">${mine}${facts}</div>
                </div>
                ${section.seal === 'open' ? resealButtonHtml() : ''}
            </header>
            ${sealed ? `${sealHtml(monthName)}<div class="hcs-section__board" data-hcs-sealed-board hidden>${board}</div>` : board}
        </section>`;
}

/** One line on what moved since the teacher last looked; empty when nothing did. */
export function renderStandingsHeraldHtml(sections, { byClass = true } = {}) {
    let gainers = 0;
    let starsGained = 0;
    let bestClimb = null;
    const newLeaders = [];
    sections.forEach((section) => {
        if (section.seal === 'sealed') return;
        section.entries.forEach((e) => {
            if (e.gain > 0) {
                gainers += 1;
                starsGained += e.gain;
            }
            if (e.climb > 0 && (!bestClimb || e.climb > bestClimb.entry.climb)) {
                bestClimb = { entry: e, section };
            }
        });
        const top = section.entries[0];
        if (top && top.score > 0 && top.climb > 0 && top.rank === 1) newLeaders.push({ entry: top, section });
    });
    if (!gainers && !bestClimb) return '';
    const bits = [];
    if (gainers) {
        bits.push(`<b>${gainers} hero${gainers === 1 ? '' : 'es'}</b> earned <b>${starsGained} star${starsGained === 1 ? '' : 's'}</b>`);
    }
    const where = (section) => (byClass ? ` in ${escapeStandingsHtml(section.title)}` : '');
    if (newLeaders.length) {
        const { entry, section } = newLeaders[0];
        bits.push(`<b>${escapeStandingsHtml(entry.name)}</b> took the crown${where(section)}`);
    } else if (bestClimb) {
        const { entry, section } = bestClimb;
        bits.push(`<b>${escapeStandingsHtml(entry.name)}</b> climbed ${entry.climb} place${entry.climb === 1 ? '' : 's'}${where(section)}`);
    }
    return `
        <div class="hcs-herald" role="status">
            <span class="hcs-herald__horn" aria-hidden="true"><i class="fas fa-bullhorn"></i></span>
            <p class="hcs-herald__text"><span class="hcs-herald__lead">Since your last look</span> ${bits.join(' · ')}</p>
        </div>`;
}

// --- Motion -----------------------------------------------------------------

function reducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

function countUp(el, from, to, duration) {
    if (from === to) {
        el.textContent = String(to);
        return;
    }
    const start = performance.now();
    const step = (now) => {
        if (!el.isConnected) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(from + (to - from) * eased));
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function burst(host) {
    const wrap = document.createElement('span');
    wrap.className = 'hcs-burst';
    wrap.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) {
        const s = document.createElement('i');
        s.style.setProperty('--a', `${i * 30}deg`);
        s.style.setProperty('--d', `${48 + (i % 3) * 14}px`);
        wrap.appendChild(s);
    }
    host.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1400);
}

/** Plain entrance: rows and podium figures rise in, staggered. */
export function playStandingsEntrance(list) {
    list.classList.remove('hcs-list--enter');
    void list.offsetWidth;
    list.classList.add('hcs-list--enter');
}

/**
 * The rank-change show. Every mover is first drawn where it stood before
 * (FLIP), stars count up, then everyone glides to their new place.
 */
export function playStandingsChanges(list, sections) {
    const token = Symbol('hs');
    list.__hcsToken = token;
    const alive = () => list.__hcsToken === token && list.isConnected;

    const counters = [...list.querySelectorAll('[data-hcs-count]')];
    if (reducedMotion()) {
        list.classList.add('hcs-list--settled');
        return;
    }

    list.classList.add('hcs-list--replay');
    const moving = [];
    list.querySelectorAll('[data-hcs-section]').forEach((sectionEl) => {
        if (sectionEl.classList.contains('hcs-section--sealed')) return;
        const movers = [...sectionEl.querySelectorAll('[data-hcs-mover]')];
        const bySlot = [];
        movers.forEach((m) => { bySlot[Number(m.dataset.hcsSlot)] = m; });
        const rects = bySlot.map((m) => m?.getBoundingClientRect());
        movers.forEach((m) => {
            const slot = Number(m.dataset.hcsSlot);
            const from = Number(m.dataset.hcsFrom);
            if (from === slot) return;
            const to = rects[slot];
            let fromRect = from >= 0 ? rects[from] : null;
            if (!to) return;
            if (!fromRect) {
                // New to this board: rise in from just below.
                m.classList.add('hcs-newcomer');
                return;
            }
            const dx = (fromRect.left + fromRect.width / 2) - (to.left + to.width / 2);
            const dy = (fromRect.top + fromRect.height / 2) - (to.top + to.height / 2);
            m.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
            m.classList.add(from > slot ? 'hcs-climbing' : 'hcs-falling');
            moving.push(m);
        });
    });
    counters.forEach((c) => { c.textContent = c.dataset.from; });
    const rankNums = [...list.querySelectorAll('[data-hcs-rank]')];
    rankNums.forEach((r) => { r.textContent = r.dataset.from; });
    void list.offsetWidth;

    // 1. Stars tick up where the heroes stood.
    setTimeout(() => {
        if (!alive()) return;
        list.classList.add('hcs-list--counting');
        counters.forEach((c) => {
            const from = Number(c.dataset.from);
            const to = Number(c.dataset.to);
            if (from !== to) {
                c.closest('.hcs-figure__stars, .hcs-row__stars')?.classList.add('hcs-ticking');
                countUp(c, from, to, 900);
            }
        });
    }, 450);

    // 2. Everyone glides to their new place.
    setTimeout(() => {
        if (!alive()) return;
        moving.forEach((m) => {
            m.classList.add('hcs-gliding');
            m.style.transform = '';
        });
    }, 1350);

    // 3. Landing: flashes for climbers, the crown for a new leader.
    setTimeout(() => {
        if (!alive()) return;
        moving.forEach((m) => m.classList.remove('hcs-gliding', 'hcs-falling'));
        rankNums.forEach((r) => { r.textContent = r.dataset.to; });
        list.querySelectorAll('.hcs-climbing').forEach((m) => {
            m.classList.remove('hcs-climbing');
            m.classList.add('hcs-landed');
        });
        sections.forEach((section) => {
            const top = section.entries[0];
            if (!top || !(top.score > 0) || !section.previousLeaderId || section.previousLeaderId === top.id) return;
            const sectionEl = [...list.querySelectorAll('[data-hcs-section]')].find((el) => el.dataset.hcsSection === section.id);
            if (!sectionEl || sectionEl.classList.contains('hcs-section--sealed')) return;
            const fig = sectionEl?.querySelector(`.hcs-spot--gold .hcs-figure[data-hcs-id="${CSS.escape(top.id)}"]`);
            if (fig) {
                fig.classList.add('hcs-crowned');
                burst(fig.querySelector('.hcs-figure__portrait') || fig);
            }
        });
        list.classList.add('hcs-list--settled');
        list.classList.remove('hcs-list--replay', 'hcs-list--counting');
    }, 2500);
}

// --- The month-finale seal --------------------------------------------------

const UNSEAL_REVEAL_MS = 650;
const UNSEAL_DONE_MS = 1500;
const RESEAL_DONE_MS = 1100;

/**
 * The teacher's peek: the wax seal breaks, the curtains part, and the
 * standings rise in behind them.
 */
export function playUnseal(sectionEl, { onDone } = {}) {
    const seal = sectionEl?.querySelector('[data-hcs-seal]');
    const board = sectionEl?.querySelector('[data-hcs-sealed-board]');
    if (!seal || !board || sectionEl.classList.contains('hcs-section--unsealing')) return;

    const finish = () => {
        seal.remove();
        board.hidden = false;
        sectionEl.classList.remove('hcs-section--sealed', 'hcs-section--unsealing');
        sectionEl.classList.add('hcs-section--peeked');
        const head = sectionEl.querySelector('.hcs-section__head');
        if (head && !head.querySelector('[data-hcs-reseal]')) {
            head.insertAdjacentHTML('beforeend', resealButtonHtml());
            head.querySelector('[data-hcs-reseal]')?.classList.add('hcs-reseal--arrive');
        }
        onDone?.();
    };

    if (reducedMotion()) {
        finish();
        return;
    }
    sectionEl.classList.add('hcs-section--unsealing');
    seal.querySelector('[data-hcs-unseal]')?.setAttribute('disabled', '');
    setTimeout(() => {
        if (!sectionEl.isConnected) return;
        // The seal lifts off the page and floats over the stage while its
        // curtains finish parting, so the standings rise in right behind them.
        seal.style.top = `${seal.offsetTop}px`;
        seal.style.height = `${seal.offsetHeight}px`;
        seal.classList.add('hcs-seal--floating');
        board.hidden = false;
        sectionEl.classList.add('hcs-section--reveal');
    }, UNSEAL_REVEAL_MS);
    setTimeout(() => {
        if (sectionEl.isConnected) finish();
    }, UNSEAL_DONE_MS);

}

/** The standings slip away, then the curtains draw shut and a fresh seal stamps down. */
export function playReseal(sectionEl, monthName, { onDone } = {}) {
    if (!sectionEl || sectionEl.querySelector('[data-hcs-seal]')) return;
    const head = sectionEl.querySelector('.hcs-section__head');
    head?.querySelector('[data-hcs-reseal]')?.remove();
    // After a peek the board is already wrapped; a board drawn open (peeked
    // before this render) gets its wrapper now.
    let board = sectionEl.querySelector(':scope > [data-hcs-sealed-board]');
    if (!board) {
        board = document.createElement('div');
        board.className = 'hcs-section__board';
        board.setAttribute('data-hcs-sealed-board', '');
        [...sectionEl.children].filter((el) => el !== head).forEach((el) => board.appendChild(el));
        sectionEl.appendChild(board);
    }
    board.insertAdjacentHTML('beforebegin', sealHtml(monthName));
    const seal = sectionEl.querySelector('[data-hcs-seal]');

    const close = () => {
        board.hidden = true;
        sectionEl.classList.remove('hcs-section--peeked', 'hcs-section--resealing');
        sectionEl.classList.add('hcs-section--sealed');
        if (seal) seal.hidden = false;
    };
    if (reducedMotion() || !seal) {
        close();
        onDone?.();
        return;
    }
    seal.hidden = true;
    seal.classList.add('hcs-seal--closing');
    sectionEl.classList.add('hcs-section--resealing');
    setTimeout(() => {
        if (!sectionEl.isConnected) return;
        close();
        setTimeout(() => {
            seal.classList.remove('hcs-seal--closing');
            onDone?.();
        }, RESEAL_DONE_MS);
    }, 320);
}
