// ui/tabs/teamQuestPhone.js
// Team Quest on phones and small tablets: the league's realm ladder (who stands
// where, from Bronze Meadows up to the Crystal Sky), a jump to the active class,
// and one race card per party. Past 100% a party's trail turns into the night
// sky and climbs the Starward Way (Moonstep 110%, Comet's Rest 125%, the Star
// Crown 150%, Aurora Bridge 175%, the Celestial Palace 200%).
// Loaded on demand with its styles (styles/team_quest_phone.css), off the startup bundle.
// Pure HTML builders: no state, no DOM.

import '../../styles/team_quest_phone.css';
import { describeQuestRaceGaps, describeQuestRaceLine, formatQuestStars } from '../../features/teamQuestRace.mjs';
import {
    BEYOND_MARKS,
    BEYOND_MAX,
    QUEST_STATIONS,
    countQuestStations,
    describeQuestStanding,
    furthestStationIndex
} from '../../features/teamQuestStanding.mjs';
import { beyondShare } from '../../features/questWorld/starwardWay.mjs';

const asset = (name) => new URL(`../../assets/team-quest-map/living-atlas/${name}`, import.meta.url).href;
const BADGES = {
    bronze: asset('badge-bronze.webp'),
    silver: asset('badge-silver.webp'),
    gold: asset('badge-gold.webp'),
    crystal: asset('badge-crystal.webp'),
    portal: asset('portal-vortex.webp')
};

const TIERS = ['gold', 'silver', 'bronze'];
const ORDINALS = ['1st', '2nd', '3rd'];

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const ordinal = (n) => ORDINALS[n - 1] || `${n}th`;
const starWord = (n) => (n === 1 ? 'star' : 'stars');

function stationBadgeHtml(id) {
    if (BADGES[id]) return `<img src="${BADGES[id]}" alt="" aria-hidden="true" draggable="false" decoding="async">`;
    if (id === 'palace') return '<i class="fas fa-sun" aria-hidden="true"></i>';
    return '<i class="fas fa-star" aria-hidden="true"></i>';
}

/** The realm ladder: six stations, each with the parties standing there. */
function ladderHtml(entries, standings) {
    const counts = countQuestStations(standings);
    const furthest = furthestStationIndex(standings);
    const crestsAt = (stationId) => entries
        .filter((_, index) => standings[index].station === stationId)
        .map((entry) => esc(entry.logo || '📚'));

    return `
        <ol class="tqp-ladder" aria-label="Where the parties stand">
            ${QUEST_STATIONS.map((station, index) => {
                const count = counts[station.id];
                const crests = crestsAt(station.id);
                const states = [
                    index <= furthest ? 'is-lit' : '',
                    count ? 'has-parties' : '',
                    station.id === 'sky' && !count ? 'is-veiled' : ''
                ].filter(Boolean).join(' ');
                const label = `${station.label}: ${count} ${count === 1 ? 'party' : 'parties'}`;
                return `
                <li class="tqp-ladder__stop tqp-ladder__stop--${station.id} ${states}" aria-label="${esc(label)}">
                    <span class="tqp-ladder__badge" aria-hidden="true">${stationBadgeHtml(station.id)}${count ? `<b>${count}</b>` : ''}</span>
                    <span class="tqp-ladder__name" aria-hidden="true">${esc(station.short)}</span>
                    <span class="tqp-ladder__crests" aria-hidden="true">${crests.map((crest) => `<i>${crest}</i>`).join('')}</span>
                </li>`;
            }).join('')}
        </ol>`;
}

/** One line under the ladder that says what the league's month looks like. */
function summitNote(standings) {
    const inSky = standings.filter((s) => s.place === 'sky' || s.place === 'palace').length;
    const through = standings.filter((s) => s.place === 'inside').length + inSky;
    const waiting = standings.filter((s) => s.place === 'sealed' || s.place === 'gate').length;
    if (inSky) {
        return `<i class="fas fa-star" aria-hidden="true"></i>${inSky} ${inSky === 1 ? 'party is' : 'parties are'} climbing the Crystal Sky, past ${inSky === 1 ? 'its' : 'their'} goal`;
    }
    if (through) {
        return `<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>${through} ${through === 1 ? 'party has' : 'parties have'} stepped through the Portal. Every star now climbs the Starward Way`;
    }
    if (waiting) {
        return `<i class="fas fa-lock" aria-hidden="true"></i>${waiting} ${waiting === 1 ? 'party waits' : 'parties wait'} at the Portal`;
    }
    return '<i class="fas fa-moon" aria-hidden="true"></i>Fill the goal and open the Portal: the Crystal Sky waits beyond 100%';
}

function nextLine(standing) {
    const next = standing.next;
    if (standing.place === 'palace') return { icon: 'fa-sun', text: 'Home in the Celestial Palace', tone: 'palace' };
    if (!next) return { icon: 'fa-flag-checkered', text: '', tone: '' };
    if (next.locked) return { icon: 'fa-lock', text: `Stars full · ${next.label}`, tone: 'locked' };
    if (next.step) return { icon: 'fa-wand-magic-sparkles', text: 'The Portal is open', tone: 'open' };
    return {
        icon: standing.phase === 'sky' ? 'fa-star' : 'fa-location-dot',
        text: `<b>${next.starsNeeded}★</b> to ${esc(next.label)}`,
        tone: standing.phase === 'sky' ? 'sky' : ''
    };
}

/** The land trail: the four realms, their stops and the Portal at the end. */
function landTrackHtml(standing, logo) {
    const sealed = standing.place === 'sealed';
    return `
                <span class="tqp-track__realms" aria-hidden="true"><i class="r-bronze"></i><i class="r-silver"></i><i class="r-gold"></i><i class="r-crystal"></i></span>
                <span class="tqp-track__fill" aria-hidden="true"></span>
                ${[30, 60, 85].map((at) => `<span class="tqp-track__stop${standing.pct >= at ? ' is-reached' : ''}" style="left:${at}%" aria-hidden="true"></span>`).join('')}
                <span class="tqp-track__gate${standing.pct >= 100 ? ' is-reached' : ''}" aria-hidden="true">${sealed ? '<i class="fas fa-lock"></i>' : `<img src="${BADGES.portal}" alt="" draggable="false" decoding="async">`}</span>
                <span class="tqp-track__marker" aria-hidden="true">${logo}</span>`;
}

/** The sky trail: from the Portal up the Starward Way's named stones to the Palace. */
function skyTrackHtml(standing, logo) {
    const stones = BEYOND_MARKS.map((mark) => {
        const left = beyondShare(mark.at) * 100;
        const reached = standing.reach >= mark.at;
        return `<span class="tqp-track__stone tqp-track__stone--${mark.id}${reached ? ' is-reached' : ''}" style="left:${left}%" title="${esc(mark.label)} · ${mark.at}%"><i class="fas ${mark.icon}" aria-hidden="true"></i></span>`;
    }).join('');
    return `
                <span class="tqp-track__sky" aria-hidden="true"></span>
                <span class="tqp-track__fill" aria-hidden="true"></span>
                <span class="tqp-track__origin" aria-hidden="true"><img src="${BADGES.portal}" alt="" draggable="false" decoding="async"></span>
                ${stones}
                <span class="tqp-track__marker" aria-hidden="true">${logo}</span>`;
}

function percentHtml(standing) {
    const shown = Math.floor(standing.reach);
    const sub = standing.place === 'palace'
        ? 'Palace reached'
        : standing.phase === 'sky'
            ? `+${standing.over}% in the sky`
            : standing.over > 0
                ? `+${standing.over}% extra`
                : 'of the goal';
    return `<span class="tqp-card__pct"><b>${shown}<small>%</small></b><em>${esc(sub)}</em></span>`;
}

function realmChipHtml(standing) {
    const id = standing.realm.id;
    const badge = BADGES[id]
        ? `<img src="${BADGES[id]}" alt="" aria-hidden="true" draggable="false" decoding="async">`
        : `<i class="fas ${id === 'palace' ? 'fa-sun' : standing.mark?.icon || 'fa-star'}" aria-hidden="true"></i>`;
    const prefix = standing.place === 'sky' ? 'Crystal Sky · ' : '';
    return `<span class="tqp-card__realm">${badge}<span>${esc(prefix + standing.realm.label)}</span></span>`;
}

function cardHtml(entry, index, { standing, gap, activeClassId, currentUserId }) {
    const rank = Number(entry.rank) || index + 1;
    const tier = TIERS[rank - 1] || 'slate';
    const logo = esc(entry.logo || '📚');
    const name = esc(entry.name || 'Class');
    const isMine = Boolean(activeClassId) && entry.id === activeClassId;
    const stars = Number(entry.currentMonthlyStars) || 0;
    const goal = Number(entry.goals?.diamond) || 0;
    const weekly = Number(entry.weeklyStars) || 0;
    const next = nextLine(standing);
    const raceLine = describeQuestRaceLine(gap);
    const portal = entry.portal || null;
    const canFaceGuardian = Boolean(portal?.guardian?.canTry) && Boolean(currentUserId) && entry.createdBy?.uid === currentUserId;
    const isSky = standing.phase === 'sky';
    const max = isSky ? BEYOND_MAX : 100;
    const label = `${entry.name || 'Class'}: ${ordinal(rank)} in the league, ${Math.floor(standing.reach)}% of the monthly goal, ${standing.realm.label}`;
    const classes = [
        'tqp-card',
        `tqp-card--${standing.realm.id}`,
        `tqp-card--${standing.place}`,
        `tqp-card--tier-${tier}`,
        isMine ? 'is-mine' : ''
    ].filter(Boolean).join(' ');

    return `
        <li class="${classes}" id="tqp-card-${esc(entry.id || index)}" data-chronicle-open="${esc(entry.id || '')}" style="--tqp-i:${Math.min(index, 9)};--tqp-track:${standing.track.toFixed(2)}%">
            <div class="tqp-card__head">
                <span class="tqp-rank tqp-rank--${tier}" aria-hidden="true">${rank === 1 ? '<i class="fas fa-crown"></i>' : ''}<b>${rank}</b></span>
                <span class="tqp-card__logo" aria-hidden="true">${logo}</span>
                <span class="tqp-card__who">
                    <strong>${name}</strong>
                    ${realmChipHtml(standing)}
                </span>
                ${percentHtml(standing)}
            </div>
            <div class="tqp-track tqp-track--${standing.phase}" role="progressbar" aria-label="${esc(label)}" aria-valuemin="${isSky ? 100 : 0}" aria-valuemax="${max}" aria-valuenow="${Math.min(max, Math.floor(standing.reach))}">
                ${isSky ? skyTrackHtml(standing, logo) : landTrackHtml(standing, logo)}
            </div>
            <div class="tqp-card__facts">
                <span class="tqp-chip tqp-chip--stars"><i class="fas fa-star" aria-hidden="true"></i><b>${formatQuestStars(stars)}</b><small>/ ${formatQuestStars(goal)}</small></span>
                ${next.text ? `<span class="tqp-chip tqp-chip--next${next.tone ? ` is-${next.tone}` : ''}"><i class="fas ${next.icon}" aria-hidden="true"></i><span>${next.text}</span></span>` : ''}
                ${weekly > 0 ? `<span class="tqp-chip tqp-chip--week"><i class="fas fa-fire" aria-hidden="true"></i>+${formatQuestStars(weekly)} this week</span>` : ''}
                ${Number(entry.classQuestBonus) > 0 ? `<span class="tqp-chip tqp-chip--bonus"><i class="fas fa-compass" aria-hidden="true"></i>+${formatQuestStars(entry.classQuestBonus)} Pathfinder</span>` : ''}
            </div>
            <div class="tqp-card__foot">
                ${raceLine ? `<span class="tqp-card__race"><i class="fas fa-flag-checkered" aria-hidden="true"></i>${esc(raceLine)}</span>` : '<span></span>'}
                <span class="tqp-card__btns">
                ${portal?.completed ? `<button type="button" class="tqp-card__story" data-portal-story="${esc(entry.id || '')}" aria-label="Watch ${name} step through the Portal"><i class="fas fa-play" aria-hidden="true"></i><span>Story</span></button>` : ''}
                <button type="button" class="tqp-card__open" data-chronicle-open="${esc(entry.id || '')}" aria-label="Open ${name} in the Quest Chronicles"><span>Chronicle</span><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                </span>
            </div>
            ${canFaceGuardian ? `
            <div class="tqp-card__acts">
                <button type="button" class="tqp-act tqp-act--guardian" data-face-guardian="${esc(entry.id || '')}"><i class="fas fa-dungeon" aria-hidden="true"></i>Face the Portal Guardian</button>
            </div>` : ''}
        </li>`;
}

function mineHtml(entries, standings, activeClassId) {
    const index = entries.findIndex((entry) => entry.id === activeClassId);
    if (index < 0) return '';
    const entry = entries[index];
    const standing = standings[index];
    const rank = Number(entry.rank) || index + 1;
    const next = nextLine(standing);
    return `
        <button type="button" class="tqp-mine" data-tqp-jump="${esc(entry.id)}">
            <span class="tqp-mine__logo" aria-hidden="true">${esc(entry.logo || '📚')}</span>
            <span class="tqp-mine__copy">
                <small>Your class · ${ordinal(rank)} of ${entries.length}</small>
                <strong>${esc(entry.name || 'Class')} · ${Math.floor(standing.reach)}%</strong>
                ${next.text ? `<em>${next.text}</em>` : ''}
            </span>
            <i class="fas fa-arrow-down tqp-mine__go" aria-hidden="true"></i>
        </button>`;
}

/**
 * The phone race view for one league.
 * @param {Array} entries ranked Team Quest entries (rank 1 first)
 * @param {{ activeClassId?: string|null, currentUserId?: string|null, monthName?: string, leagueName?: string, animate?: boolean }} options
 */
export function renderTeamQuestPhoneHtml(entries = [], { activeClassId = null, currentUserId = null, monthName = '', leagueName = '', animate = true } = {}) {
    const standings = entries.map((entry) => describeQuestStanding(entry));
    const gaps = describeQuestRaceGaps(entries);
    const kicker = [monthName && `${monthName} race`, leagueName && `${leagueName} League`].filter(Boolean).join(' · ');
    const total = entries.reduce((sum, entry) => sum + (Number(entry.currentMonthlyStars) || 0), 0);

    return `
        <section class="tqp${animate ? ' is-entering' : ''}" aria-labelledby="tqp-title">
            <header class="tqp-summit">
                <span class="tqp-summit__stars" aria-hidden="true"></span>
                <div class="tqp-summit__top">
                    <span class="tqp-summit__title">
                        ${kicker ? `<small>${esc(kicker)}</small>` : ''}
                        <h3 id="tqp-title">${entries.length} ${entries.length === 1 ? 'party' : 'parties'} on the road</h3>
                        <em><i class="fas fa-star" aria-hidden="true"></i>${formatQuestStars(total)} ${starWord(total)} gathered</em>
                    </span>
                    <button type="button" id="toggle-map-list-btn" class="tqp-summit__book" aria-controls="league-standings-container" aria-expanded="false">
                        <i class="fas fa-book-open" aria-hidden="true"></i><span>Chronicles</span>
                    </button>
                </div>
                ${ladderHtml(entries, standings)}
                <p class="tqp-summit__note">${summitNote(standings)}</p>
                ${mineHtml(entries, standings, activeClassId)}
            </header>
            <ol class="tqp-list">
                ${entries.map((entry, index) => cardHtml(entry, index, {
                    standing: standings[index],
                    gap: gaps.get(entry.id),
                    activeClassId,
                    currentUserId
                })).join('')}
            </ol>
        </section>`;
}
