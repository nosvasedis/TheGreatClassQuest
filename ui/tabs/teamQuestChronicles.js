// ui/tabs/teamQuestChronicles.js
// Quest Chronicles — the field journal under the Team Quest map.
// Pure HTML builders (no state, no DOM access) so the tab, previews and the
// guidebook capture can all draw the same pages.

import { getQuestMapZoneForProgressPercent } from '../../features/questMapZones.mjs';
import {
    clampQuestProgress,
    describeQuestRaceGaps,
    describeQuestRaceLine,
    formatQuestStars,
    getQuestNextStop
} from '../../features/teamQuestRace.mjs';

const asset = (name) => new URL(`../../assets/team-quest-map/living-atlas/${name}`, import.meta.url).href;

export const CHRONICLE_ASSETS = {
    bronze: asset('badge-bronze.webp'),
    silver: asset('badge-silver.webp'),
    gold: asset('badge-gold.webp'),
    crystal: asset('badge-crystal.webp'),
    tokenGold: asset('token-gold.webp'),
    tokenSilver: asset('token-silver.webp'),
    tokenBronze: asset('token-bronze.webp'),
    tokenSlate: asset('token-slate.webp')
};

const REALMS = [
    { id: 'bronze', label: 'Bronze Meadows', from: 0, to: 30 },
    { id: 'silver', label: 'Silver Peaks', from: 30, to: 60 },
    { id: 'gold', label: 'Golden Citadel', from: 60, to: 85 },
    { id: 'crystal', label: 'Crystal Realm', from: 85, to: 100 }
];

const SKILLS = {
    teamwork: { icon: 'fa-users', name: 'Teamwork' },
    creativity: { icon: 'fa-lightbulb', name: 'Creativity' },
    respect: { icon: 'fa-hand-holding-heart', name: 'Respect' },
    focus: { icon: 'fa-brain', name: 'Focus' },
    scholar_s_bonus: { icon: 'fa-scroll', name: 'Scholarship' },
    welcome_back: { icon: 'fa-door-open', name: 'Welcome back' },
    teacher_boon: { icon: 'fa-wand-magic-sparkles', name: 'Teacher boon' },
    story_weaver: { icon: 'fa-feather-pointed', name: 'Storytelling' }
};

const TIERS = ['gold', 'silver', 'bronze'];
const TOKEN_BY_TIER = {
    gold: CHRONICLE_ASSETS.tokenGold,
    silver: CHRONICLE_ASSETS.tokenSilver,
    bronze: CHRONICLE_ASSETS.tokenBronze,
    slate: CHRONICLE_ASSETS.tokenSlate
};

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function skillInfo(topSkill) {
    if (!topSkill || topSkill === 'None') return { icon: 'fa-seedling', name: 'Still emerging' };
    return SKILLS[topSkill] || {
        icon: 'fa-star',
        name: String(topSkill).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    };
}

function spiritFor(adventures) {
    if (adventures > 3) return 'Legendary';
    if (adventures > 1) return 'Adventurous';
    if (adventures === 1) return 'Setting out';
    return 'Gathering';
}

function renderRoute(entry, pct) {
    const realms = REALMS.map((realm) => {
        const state = pct >= realm.to ? 'is-done' : pct >= realm.from ? 'is-here' : '';
        return `
            <span class="tqc-route__realm tqc-route__realm--${realm.id} ${state}" style="flex:${realm.to - realm.from}">
                <img src="${CHRONICLE_ASSETS[realm.id]}" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async">
                <span>${realm.label}</span>
            </span>`;
    }).join('');
    const checkpoints = [30, 60, 85, 100].map((at) => `
        <span class="tqc-route__checkpoint${pct >= at ? ' is-reached' : ''}${at === 100 ? ' tqc-route__checkpoint--portal' : ''}" style="left:${at}%"></span>
    `).join('');

    return `
        <div class="tqc-route" style="--p:${pct}%">
            <div class="tqc-route__realms">${realms}</div>
            <div class="tqc-route__track" role="progressbar" aria-label="${esc(entry.name)} monthly quest progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(0)}">
                <span class="tqc-route__fill" aria-hidden="true"></span>
                ${checkpoints}
                <span class="tqc-route__marker" aria-hidden="true">${esc(entry.logo || '📚')}</span>
            </div>
        </div>`;
}

function renderHeroes(heroes) {
    const shown = (heroes || []).filter((hero) => (Number(hero.stars) || 0) > 0).slice(0, 3);
    if (!shown.length) {
        return '<p class="tqc-vanguard__empty"><i class="fas fa-feather" aria-hidden="true"></i>The first hero to earn a star this month leads the way.</p>';
    }
    const medals = ['tqc-hero--1', 'tqc-hero--2', 'tqc-hero--3'];
    return `<ol class="tqc-vanguard__list">${shown.map((hero, index) => `
        <li class="tqc-hero ${medals[index]}">
            <span class="tqc-hero__avatar">
                ${hero.avatar
                    ? `<img src="${esc(hero.avatar)}" alt="" loading="lazy" decoding="async">`
                    : `<span>${esc(String(hero.name || '?').charAt(0))}</span>`}
                <b>${index + 1}</b>
            </span>
            <span class="tqc-hero__copy">
                <strong>${esc(hero.name || 'Hero')}</strong>
                <small><i class="fas fa-star" aria-hidden="true"></i>${formatQuestStars(hero.stars)} stars</small>
            </span>
        </li>`).join('')}</ol>`;
}

function renderCard(entry, index, { gap, activeClassId, open, showFind }) {
    const rank = Number(entry.rank) || index + 1;
    const tier = TIERS[rank - 1] || 'slate';
    const pct = clampQuestProgress(entry.progress);
    const rawPct = Math.max(0, Number(entry.progress) || 0);
    const stars = Number(entry.currentMonthlyStars) || 0;
    const goal = Number(entry.goals?.diamond) || 0;
    const zone = getQuestMapZoneForProgressPercent(pct);
    const next = getQuestNextStop(pct, stars, goal);
    const skill = skillInfo(entry.topSkill);
    const weekly = Number(entry.weeklyStars) || 0;
    const adventures = Number(entry.adventureCount) || 0;
    const level = (Number(entry.difficulty) || 0) + 1;
    const isMine = Boolean(activeClassId) && entry.id === activeClassId;
    const drawerId = `tqc-drawer-${esc(String(entry.id || index))}`;
    const raceLine = describeQuestRaceLine(gap);
    const goalDiff = Number(entry.goalDifference) || 0;
    const goalNote = goalDiff !== 0
        ? `<span class="tqc-pill tqc-pill--${goalDiff < 0 ? 'holiday' : 'bonus'}" title="The monthly goal adapts to holidays and extra lessons">
                <i class="fas ${goalDiff < 0 ? 'fa-umbrella-beach' : 'fa-calendar-plus'}" aria-hidden="true"></i>
                Goal ${goalDiff < 0 ? '−' : '+'}${Math.abs(goalDiff)}★ ${goalDiff < 0 ? 'for holidays' : 'for extra lessons'}
            </span>`
        : '';

    return `
        <article class="tqc-card tqc-card--${zone.id} tqc-card--tier-${tier}${isMine ? ' is-mine' : ''}${open ? ' is-open' : ''}"
                 data-chronicle-id="${esc(entry.id || '')}"
                 style="--tqc-delay:${Math.min(index * 60, 600)}ms; --p:${pct}%">
            <button type="button" class="tqc-card__summary" data-chronicle-toggle aria-expanded="${open ? 'true' : 'false'}" aria-controls="${drawerId}">
                <span class="tqc-seal tqc-seal--${tier}" aria-label="League rank ${rank}">
                    <img src="${TOKEN_BY_TIER[tier]}" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async">
                    <strong>${rank}</strong>
                </span>
                <span class="tqc-card__logo" aria-hidden="true">${esc(entry.logo || '📚')}</span>
                <span class="tqc-card__who">
                    <strong class="tqc-card__name">${esc(entry.name || 'Class')}</strong>
                    <span class="tqc-card__meta">
                        <span class="tqc-zone"><img src="${CHRONICLE_ASSETS[zone.id]}" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async">${zone.label}</span>
                        ${isMine ? '<span class="tqc-you"><i class="fas fa-flag" aria-hidden="true"></i>Active class</span>' : ''}
                    </span>
                </span>
                <span class="tqc-card__mini" aria-hidden="true"><span></span></span>
                <span class="tqc-card__score">
                    <strong>${Math.floor(rawPct)}<small>%</small></strong>
                    <em><i class="fas fa-star" aria-hidden="true"></i>${formatQuestStars(stars)} / ${formatQuestStars(goal)}</em>
                </span>
                <span class="tqc-card__chev" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>
            </button>
            <div class="tqc-card__drawer" id="${drawerId}">
                <div class="tqc-card__drawer-inner">
                    ${renderRoute(entry, pct)}
                    <div class="tqc-card__pills">
                        <span class="tqc-pill tqc-pill--next${next.complete ? ' is-complete' : ''}">
                            <i class="fas ${next.complete ? 'fa-trophy' : 'fa-location-dot'}" aria-hidden="true"></i>
                            ${next.complete ? 'Quest complete — the portal is open!' : `<b>${next.starsNeeded}★</b> to ${esc(next.label)}`}
                        </span>
                        ${raceLine ? `<span class="tqc-pill tqc-pill--race"><i class="fas fa-flag-checkered" aria-hidden="true"></i>${esc(raceLine)}</span>` : ''}
                        ${entry.classQuestBonus > 0 ? `<span class="tqc-pill tqc-pill--bonus"><i class="fas fa-compass" aria-hidden="true"></i>+${formatQuestStars(entry.classQuestBonus)} Pathfinder</span>` : ''}
                        ${goalNote}
                    </div>
                    <div class="tqc-card__body">
                        <div class="tqc-stats">
                            <div class="tqc-stat tqc-stat--fire">
                                <span class="tqc-stat__icon"><i class="fas fa-fire" aria-hidden="true"></i></span>
                                <small>Weekly momentum</small>
                                <strong>+${formatQuestStars(weekly)}</strong>
                                <em>${weekly > 0 ? 'stars this week' : 'waiting for a spark'}</em>
                            </div>
                            <div class="tqc-stat tqc-stat--magic">
                                <span class="tqc-stat__icon"><i class="fas ${skill.icon}" aria-hidden="true"></i></span>
                                <small>Signature strength</small>
                                <strong>${esc(skill.name)}</strong>
                                <em>most celebrated</em>
                            </div>
                            <div class="tqc-stat tqc-stat--gold">
                                <span class="tqc-stat__icon"><i class="fas fa-coins" aria-hidden="true"></i></span>
                                <small>Guild treasury</small>
                                <strong>${formatQuestStars(entry.totalGold)}</strong>
                                <em>gold saved</em>
                            </div>
                            <div class="tqc-stat tqc-stat--heart">
                                <span class="tqc-stat__icon"><i class="fas fa-heart" aria-hidden="true"></i></span>
                                <small>Quest spirit</small>
                                <strong>${spiritFor(adventures)}</strong>
                                <em>${adventures} ${adventures === 1 ? 'adventure' : 'adventures'} this month</em>
                            </div>
                        </div>
                        <div class="tqc-vanguard">
                            <h5><i class="fas fa-crown" aria-hidden="true"></i>Leading the way</h5>
                            ${renderHeroes(entry.topHeroes)}
                        </div>
                    </div>
                    <div class="tqc-card__foot">
                        <span class="tqc-foot-chip" title="Each quest level raises the monthly goal a little">
                            <i class="fas fa-shield-halved" aria-hidden="true"></i>Quest level ${level}
                        </span>
                        <span class="tqc-foot-chip"><i class="fas fa-users" aria-hidden="true"></i>${Number(entry.studentCount) || 0} heroes</span>
                        ${showFind ? `<button type="button" class="tqc-find" data-chronicle-find="${esc(entry.id || '')}"><i class="fas fa-map-location-dot" aria-hidden="true"></i><span>Find on the map</span></button>` : ''}
                    </div>
                </div>
            </div>
        </article>`;
}

/**
 * Inner HTML of the Quest Chronicles section.
 * @param {Array} entries ranked league entries (rank 1 first)
 * @param {{ monthName?: string, leagueName?: string, activeClassId?: string|null, openIds?: Set<string>, showFind?: boolean }} options
 */
export function renderQuestChroniclesHtml(entries = [], {
    monthName = '',
    leagueName = '',
    activeClassId = null,
    openIds = new Set(),
    showFind = true
} = {}) {
    const gaps = describeQuestRaceGaps(entries);
    const totalStars = entries.reduce((sum, entry) => sum + (Number(entry.currentMonthlyStars) || 0), 0);
    const leader = entries[0];
    const hottest = entries.reduce((best, entry) => (
        (Number(entry.weeklyStars) || 0) > (Number(best?.weeklyStars) || 0) ? entry : best
    ), null);
    const leaderGap = leader ? gaps.get(leader.id) : null;
    const leaderLine = leader
        ? (leaderGap?.behind
            ? (leaderGap.behind.starsToCatch <= 2 ? 'neck and neck!' : `ahead by ${leaderGap.behind.starsToCatch}★`)
            : 'on the road alone')
        : '';
    const allOpen = entries.length > 0 && entries.every((entry) => openIds.has(entry.id));
    const kicker = [monthName, leagueName ? `${leagueName} League` : ''].filter(Boolean).join(' · ');

    return `
        <header class="tqc-head">
            <div class="tqc-head__banner">
                <span class="tqc-head__emblem" aria-hidden="true"><i class="fas fa-book-open"></i></span>
                <div class="tqc-head__title">
                    ${kicker ? `<small>${esc(kicker)}</small>` : ''}
                    <h3 class="font-title">Quest Chronicles</h3>
                    <p>Field notes from every party on the road</p>
                </div>
                <button type="button" class="tqc-head__close" data-chronicles-close>
                    <i class="fas fa-map" aria-hidden="true"></i><span>Back to the map</span>
                </button>
            </div>
            <ul class="tqc-head__facts">
                <li><i class="fas fa-people-group" aria-hidden="true"></i><span><strong>${entries.length}</strong> ${entries.length === 1 ? 'party' : 'parties'} on the road</span></li>
                <li><i class="fas fa-star" aria-hidden="true"></i><span><strong>${formatQuestStars(totalStars)}</strong> stars gathered</span></li>
                ${leader ? `<li><i class="fas fa-crown" aria-hidden="true"></i><span><strong>${esc(leader.name)}</strong> leads, ${esc(leaderLine)}</span></li>` : ''}
                ${hottest && Number(hottest.weeklyStars) > 0 ? `<li><i class="fas fa-fire" aria-hidden="true"></i><span>Hottest trail: <strong>${esc(hottest.name)}</strong> +${formatQuestStars(hottest.weeklyStars)} this week</span></li>` : ''}
            </ul>
            <div class="tqc-head__tools">
                <span>Tap a party to open its page</span>
                <button type="button" class="tqc-expand-all" data-chronicles-expand-all aria-pressed="${allOpen ? 'true' : 'false'}">
                    <i class="fas ${allOpen ? 'fa-compress' : 'fa-expand'}" aria-hidden="true"></i>${allOpen ? 'Close all pages' : 'Open all pages'}
                </button>
            </div>
        </header>
        <div class="tqc-list">
            ${entries.map((entry, index) => renderCard(entry, index, {
                gap: gaps.get(entry.id),
                activeClassId,
                open: openIds.has(entry.id),
                showFind
            })).join('')}
        </div>`;
}
