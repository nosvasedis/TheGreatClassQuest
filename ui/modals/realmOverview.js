// ui/modals/realmOverview.js
// The Realm Overview — opened by tapping a realm crest on the Team Quest map.
// Shows where every party of the league stands relative to that realm, using
// the same realm boundaries as the living map (features/questMapZones.mjs).

import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { QUEST_MAP_ZONES } from '../../features/questMapZones.mjs';
import { formatQuestStars, starsToReachPercent } from '../../features/teamQuestRace.mjs';
import { showAnimatedModal } from './base.js';

const MODAL_ID = 'milestone-details-modal';

// Map waypoints use `diamond` for the Crystal Realm crest.
const ZONE_ALIASES = { diamond: 'crystal' };

const REALM_LORE = {
    bronze: {
        numeral: 'I',
        lore: 'Where every journey begins — sunny meadows, cosy cottages and a winding road into the hills.',
        motto: 'Every great quest starts with a single star.'
    },
    silver: {
        numeral: 'II',
        lore: 'Frozen peaks and a stone gate high above the clouds. Only steady climbers cross the pass.',
        motto: 'Keep climbing — the view is worth it.'
    },
    gold: {
        numeral: 'III',
        lore: 'A shining citadel of towers and banners. Its gates open for classes on a streak.',
        motto: 'Teamwork turns stone into gold.'
    },
    crystal: {
        numeral: 'IV',
        lore: 'Floating islands of living crystal, and at their heart the Portal that ends the quest.',
        motto: 'The summit is in sight — finish together!'
    }
};

const LEVEL_STYLES = {
    1: { label: 'Sprout', icon: '🌱' },
    2: { label: 'Ripple', icon: '💧' },
    3: { label: 'Shield', icon: '🛡️' },
    4: { label: 'Arcane', icon: '🔮' },
    5: { label: 'Blaze', icon: '🔥' },
    6: { label: 'Dragon', icon: '🐉' }
};

const GROUPS = {
    beyond: { title: 'Journeyed beyond', icon: 'fa-flag-checkered' },
    here: { title: 'Exploring here now', icon: 'fa-location-dot' },
    road: { title: 'On the road here', icon: 'fa-person-hiking' }
};

let currentZoneId = 'bronze';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function plural(count, one, many = `${one}s`) {
    return `${count} ${count === 1 ? one : many}`;
}

function getRealmBounds(zoneId) {
    const index = QUEST_MAP_ZONES.findIndex((zone) => zone.id === zoneId);
    const zone = QUEST_MAP_ZONES[index];
    const next = QUEST_MAP_ZONES[index + 1];
    return {
        index,
        zone,
        start: zone.minPercent,
        end: next ? next.minPercent : 100,
        nextLabel: next ? next.label : 'the Portal'
    };
}

/** Every class of the selected league with the same goal/stars the map uses. */
export function collectLeagueParties(league) {
    const allStudentScores = state.get('allStudentScores') || [];
    const allStudents = state.get('allStudents') || [];
    const classes = (state.get('allSchoolClasses') || []).filter((c) => c.questLevel === league);

    return classes.map((c) => {
        const students = allStudents.filter((s) => s.classId === c.id);
        const goal = utils.calculateMonthlyClassGoal(
            c,
            students.length,
            state.get('schoolHolidayRanges'),
            state.get('allScheduleOverrides')
        );
        const { totalStars, classBonus } = utils.getClassMonthlyQuestStars(c, students, allStudentScores);
        const progress = goal > 0 ? (totalStars / goal) * 100 : 0;
        return {
            id: c.id,
            name: c.name || 'Class',
            logo: c.logo || '🏫',
            level: (Number(c.difficultyLevel) || 0) + 1,
            goal,
            stars: totalStars,
            questBonus: Number(classBonus) || 0,
            progress,
            completedAt: c.questCompletedAt || null
        };
    }).sort(utils.sortTeamQuestEntries);
}

function describeParty(party, bounds) {
    const pct = Math.min(100, Math.max(0, party.progress));
    if (pct >= bounds.end) {
        return {
            group: 'beyond',
            status: bounds.end >= 100 ? 'Portal reached' : 'Passed',
            statusIcon: 'fa-check'
        };
    }
    if (pct >= bounds.start) {
        const need = Math.max(1, starsToReachPercent(party.stars, party.goal, bounds.end));
        return {
            group: 'here',
            status: `${formatQuestStars(need)} ★ to ${bounds.nextLabel}`,
            statusIcon: 'fa-compass'
        };
    }
    const need = Math.max(1, starsToReachPercent(party.stars, party.goal, bounds.start));
    return {
        group: 'road',
        status: `${formatQuestStars(need)} ★ to arrive`,
        statusIcon: 'fa-route'
    };
}

function renderRoute(pct, bounds) {
    const span = `left:${bounds.start}%;width:${bounds.end - bounds.start}%`;
    const stops = QUEST_MAP_ZONES.slice(1).map((zone) => (
        `<span class="ro-route__stop${pct >= zone.minPercent ? ' is-reached' : ''}" style="left:${zone.minPercent}%"></span>`
    )).join('');
    return `
        <span class="ro-route" aria-hidden="true">
            <span class="ro-route__fill" style="width:${pct}%"></span>
            <span class="ro-route__realm" style="${span}"></span>
            ${stops}
            <span class="ro-route__marker" style="left:${pct}%"></span>
        </span>`;
}

function renderParty(party, info, bounds, rank, activeClassId) {
    const pct = Math.min(100, Math.max(0, party.progress));
    const level = LEVEL_STYLES[party.level] || LEVEL_STYLES[1];
    const isMine = activeClassId && party.id === activeClassId;
    const bonus = party.questBonus > 0
        ? `<span class="ro-party__bonus" title="Pathfinder bonus stars"><i class="fas fa-compass" aria-hidden="true"></i> +${formatQuestStars(party.questBonus)}</span>`
        : '';
    return `
        <li class="ro-party ro-party--${info.group}${isMine ? ' is-mine' : ''}">
            <span class="ro-party__rank${rank <= 3 ? ` ro-party__rank--${rank}` : ''}" title="League rank ${rank}">${rank}</span>
            <span class="ro-party__seal" aria-hidden="true">${escapeHtml(party.logo)}</span>
            <div class="ro-party__body">
                <div class="ro-party__head">
                    <span class="ro-party__name">${escapeHtml(party.name)}</span>
                    ${isMine ? '<span class="ro-party__mine">Your class</span>' : ''}
                    <span class="ro-party__level" title="Quest level ${party.level}">${level.icon} Lv ${party.level}</span>
                </div>
                ${renderRoute(pct, bounds)}
                <div class="ro-party__meta">
                    <span><i class="fas fa-star" aria-hidden="true"></i> ${formatQuestStars(party.stars)} / ${formatQuestStars(party.goal)} stars</span>
                    ${bonus}
                    <span class="ro-party__pct">${Math.round(pct)}%</span>
                </div>
            </div>
            <span class="ro-party__status">
                <i class="fas ${info.statusIcon}" aria-hidden="true"></i>
                <span>${info.status}</span>
            </span>
        </li>`;
}

function renderGroup(key, rows) {
    if (!rows.length) return '';
    const group = GROUPS[key];
    return `
        <section class="ro-group ro-group--${key}">
            <h3 class="ro-group__title">
                <i class="fas ${group.icon}" aria-hidden="true"></i>
                <span>${group.title}</span>
                <span class="ro-group__count">${rows.length}</span>
            </h3>
            <ol class="ro-group__list">${rows.join('')}</ol>
        </section>`;
}

function renderCensusRing(arrived, total) {
    const share = total > 0 ? arrived / total : 0;
    const circumference = 2 * Math.PI * 26;
    return `
        <div class="ro-census" role="img" aria-label="${arrived} of ${total} classes have reached this realm">
            <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle class="ro-census__track" cx="32" cy="32" r="26"></circle>
                <circle class="ro-census__fill" cx="32" cy="32" r="26"
                    stroke-dasharray="${circumference.toFixed(2)}"
                    stroke-dashoffset="${(circumference * (1 - share)).toFixed(2)}"></circle>
            </svg>
            <span class="ro-census__value"><strong>${arrived}</strong><small>/${total}</small></span>
            <span class="ro-census__label">arrived</span>
        </div>`;
}

function renderTrail(activeId, arrivedByZone) {
    return `
        <nav class="ro-trail" aria-label="Realms of the quest">
            ${QUEST_MAP_ZONES.map((zone, index) => {
                const active = zone.id === activeId;
                const lore = REALM_LORE[zone.id];
                return `
                    <button type="button" class="ro-trail__step ro-trail__step--${zone.id}${active ? ' is-active' : ''}"
                        data-realm-pick="${zone.id}" aria-pressed="${active}"
                        aria-label="${zone.label}: ${plural(arrivedByZone[zone.id], 'class', 'classes')} reached">
                        <span class="ro-trail__crest" aria-hidden="true"></span>
                        <span class="ro-trail__text">
                            <small>Realm ${lore.numeral}</small>
                            <span>${zone.label}</span>
                        </span>
                        <span class="ro-trail__count" aria-hidden="true">${arrivedByZone[zone.id]}</span>
                    </button>
                    ${index < QUEST_MAP_ZONES.length - 1 ? '<span class="ro-trail__link" aria-hidden="true"></span>' : ''}`;
            }).join('')}
        </nav>`;
}

function renderRealm(zoneId) {
    const contentEl = document.getElementById('milestone-modal-content');
    const league = state.get('globalSelectedLeague');
    if (!contentEl || !league) return;

    currentZoneId = zoneId;
    const bounds = getRealmBounds(zoneId);
    const lore = REALM_LORE[zoneId];
    const parties = collectLeagueParties(league);
    const activeClassId = state.get('globalSelectedClassId') || null;

    const arrivedByZone = Object.fromEntries(QUEST_MAP_ZONES.map((zone) => [
        zone.id,
        parties.filter((p) => Math.min(100, Math.max(0, p.progress)) >= zone.minPercent).length
    ]));

    const rows = { beyond: [], here: [], road: [] };
    parties.forEach((party, index) => {
        const info = describeParty(party, bounds);
        rows[info.group].push(renderParty(party, info, bounds, index + 1, activeClassId));
    });
    const arrived = rows.beyond.length + rows.here.length;
    const rangeText = `${bounds.start}–${bounds.end}% of the monthly goal`;

    const listHtml = parties.length
        ? `${renderGroup('here', rows.here)}${renderGroup('road', rows.road)}${renderGroup('beyond', rows.beyond)}`
        : `<div class="ro-empty">
                <span class="ro-empty__icon" aria-hidden="true">🧭</span>
                <p>No classes are travelling in the <strong>${escapeHtml(league)}</strong> league yet.</p>
           </div>`;

    contentEl.innerHTML = `
        <div class="ro ro--${zoneId}">
            <header class="ro-hero">
                <div class="ro-hero__art" aria-hidden="true"></div>
                <div class="ro-hero__veil" aria-hidden="true"></div>
                <div class="ro-hero__inner">
                    <span class="ro-hero__crest" aria-hidden="true"></span>
                    <div class="ro-hero__copy">
                        <p class="ro-hero__eyebrow">Realm ${lore.numeral} of IV · ${escapeHtml(league)} league</p>
                        <h2 class="ro-hero__title">${bounds.zone.label}</h2>
                        <p class="ro-hero__lore">${lore.lore}</p>
                        <p class="ro-hero__range"><i class="fas fa-map-signs" aria-hidden="true"></i> ${rangeText}</p>
                    </div>
                    ${renderCensusRing(arrived, parties.length)}
                </div>
            </header>

            ${renderTrail(zoneId, arrivedByZone)}

            <div class="ro-stats" role="list">
                <div class="ro-stat ro-stat--here" role="listitem">
                    <i class="fas fa-location-dot" aria-hidden="true"></i>
                    <strong>${rows.here.length}</strong><span>exploring now</span>
                </div>
                <div class="ro-stat ro-stat--road" role="listitem">
                    <i class="fas fa-person-hiking" aria-hidden="true"></i>
                    <strong>${rows.road.length}</strong><span>on the way</span>
                </div>
                <div class="ro-stat ro-stat--beyond" role="listitem">
                    <i class="fas fa-flag-checkered" aria-hidden="true"></i>
                    <strong>${rows.beyond.length}</strong><span>${bounds.end >= 100 ? 'at the Portal' : 'moved on'}</span>
                </div>
            </div>

            <div class="ro-parties">${listHtml}</div>

            ${zoneId === 'crystal' ? `
            <button type="button" class="ro-portal-link" data-portal-open>
                <span class="ro-portal-link__swirl" aria-hidden="true"></span>
                <span class="ro-portal-link__copy">
                    <small>The end of the road</small>
                    <strong>Look into the Crystal Portal</strong>
                </span>
                <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </button>` : ''}

            <p class="ro-foot">
                <i class="fas fa-scale-balanced" aria-hidden="true"></i>
                Progress is measured against each class's own monthly goal, so every party races fairly.
                <em>${lore.motto}</em>
            </p>
        </div>`;
}

function bindRealmNavigation(contentEl) {
    if (contentEl.dataset.realmNavBound === 'true') return;
    contentEl.dataset.realmNavBound = 'true';

    contentEl.addEventListener('click', (event) => {
        const modal = document.getElementById(MODAL_ID);
        if (modal?.dataset.modalMode !== 'zone-overview') return;
        if (event.target.closest('[data-portal-open]')) {
            import('./crystalPortal.js').then((m) => m.openCrystalPortalModal());
            return;
        }
        const pick = event.target.closest('[data-realm-pick]');
        if (!pick || pick.dataset.realmPick === currentZoneId) return;
        renderRealm(pick.dataset.realmPick);
        contentEl.querySelector(`[data-realm-pick="${pick.dataset.realmPick}"]`)?.focus({ preventScroll: true });
        contentEl.scrollTop = 0;
    });

    contentEl.addEventListener('keydown', (event) => {
        const modal = document.getElementById(MODAL_ID);
        if (modal?.dataset.modalMode !== 'zone-overview') return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        if (!event.target.closest('[data-realm-pick]')) return;
        const index = QUEST_MAP_ZONES.findIndex((zone) => zone.id === currentZoneId);
        const nextIndex = index + (event.key === 'ArrowRight' ? 1 : -1);
        const next = QUEST_MAP_ZONES[nextIndex];
        if (!next) return;
        event.preventDefault();
        renderRealm(next.id);
        contentEl.querySelector(`[data-realm-pick="${next.id}"]`)?.focus({ preventScroll: true });
    });
}

export function openZoneOverviewModal(zoneType) {
    const league = state.get('globalSelectedLeague');
    if (!league) return;

    const zoneId = ZONE_ALIASES[zoneType] || zoneType;
    if (!QUEST_MAP_ZONES.some((zone) => zone.id === zoneId)) return;

    const modal = document.getElementById(MODAL_ID);
    const titleEl = document.getElementById('milestone-modal-title');
    const contentEl = document.getElementById('milestone-modal-content');
    if (!modal || !contentEl) return;

    modal.dataset.modalMode = 'zone-overview';
    if (titleEl) {
        titleEl.innerHTML = '';
        titleEl.className = 'hidden';
    }
    contentEl.className = 'custom-scrollbar';

    const alreadyOpen = !modal.classList.contains('hidden');
    bindRealmNavigation(contentEl);
    renderRealm(zoneId);
    if (!alreadyOpen) showAnimatedModal(MODAL_ID);
}
