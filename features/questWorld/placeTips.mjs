/**
 * What a place on the Team Quest map says when you hover it: the realm, who is
 * there now, how far the leading party still has to go, or that every party
 * has passed through. Pure (no DOM): features/worldMap.js shows the card.
 *
 * Places: the four realms (worldGeometry.mjs#REALM_PLACES) and the Portal.
 */

import { QUEST_MAP_ZONES } from '../questMapZones.mjs';
import { formatQuestStars, starsToReachPercent } from '../teamQuestRace.mjs';
import { REALM_PLACES } from './worldGeometry.mjs';

const RANGES = {
    bronze: [0, 30],
    silver: [30, 60],
    gold: [60, 85],
    crystal: [85, 100],
    portal: [100, Infinity]
};

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatPercent = (value) => `${Math.max(0, Math.round(Number(value) || 0))}%`;

/**
 * @param {string} placeId  bronze | silver | gold | crystal | portal
 * @param {{ progress: number, name?: string, logo?: string, isMine?: boolean }[]} parties
 */
export function describePlace(placeId, parties = []) {
    const [min, max] = RANGES[placeId] || RANGES.bronze;
    const zone = QUEST_MAP_ZONES.find((candidate) => candidate.id === placeId);
    const place = REALM_PLACES.find((candidate) => candidate.id === placeId);
    // When the map says who is inside the Portal, only they are there: a full party still
    // outside waits at the sealed gate, in the Crystal Realm.
    const knowsInside = parties.some((party) => typeof party.inside === 'boolean');
    const safe = parties.map((party) => {
        const progress = Math.min(100, Math.max(0, Number(party.progress) || 0));
        return { ...party, raw: Number(party.progress) || 0, progress: knowsInside ? (party.inside ? 100 : Math.min(99.99, progress)) : progress };
    });
    const here = safe
        .filter((party) => party.progress >= min && party.progress < max)
        .sort((a, b) => b.progress - a.progress);
    const leader = safe.reduce((best, party) => Math.max(best, party.progress), 0);
    let status = 'here';
    if (!here.length) status = leader < min ? 'ahead' : 'passed';
    if (placeId === 'portal') {
        const gate = knowsInside
            ? parties.filter((party) => !party.inside && (Number(party.progress) || 0) >= 100)
            : [];
        // The Portal card follows one party still on the road: this class, or else the
        // leading party. When another party is closer than this class, it is named too.
        const outside = safe.filter((party) => (knowsInside ? !party.inside : party.progress < 100))
            .sort((a, b) => b.progress - a.progress);
        const mine = outside.find((party) => party.isMine) || null;
        const front = outside[0] || null;
        const focusParty = mine || front;
        const anyRunes = outside.some((party) => party.portal?.runes?.length);
        return {
            id: 'portal',
            title: 'The Crystal Portal',
            kind: 'The end of the quest',
            desc: anyRunes
                ? 'It opens when a party gathers its whole month of stars and lights its runes.'
                : 'It opens when a party gathers its whole month of stars.',
            from: 'At 100% of the month’s goal',
            here,
            gate,
            status: here.length ? 'here' : 'ahead',
            gap: Math.max(0, 100 - leader),
            focus: focusParty ? portalRoad(focusParty, mine ? 'This class' : (here.length ? 'Closest to the Portal' : 'Leading party')) : null,
            chaser: mine && front && front !== mine && front.progress > mine.progress ? portalRoad(front, 'Closest to the Portal') : null,
            hint: 'Click to open the Portal'
        };
    }
    return {
        id: placeId,
        title: place?.label || zone?.label || 'Realm',
        kind: place?.kind || '',
        desc: zone?.desc || '',
        from: min === 0 ? 'Where every quest begins' : `From ${min}% of the month’s goal`,
        here,
        status,
        gap: Math.max(0, min - leader),
        hint: 'Click to explore the realm'
    };
}

/** How far one party is from the Portal: stars still to gather, then its runes. */
function portalRoad(party, label) {
    const goal = Number(party.goal) || 0;
    const stars = Math.max(0, Number(party.stars) || 0);
    const runes = Array.isArray(party.portal?.runes) ? party.portal.runes : [];
    const starsLeft = goal > 0 ? starsToReachPercent(stars, goal, 100) : null;
    const starsMet = goal > 0 ? starsLeft === 0 : party.raw >= 100;
    return {
        name: party.name,
        logo: party.logo,
        isMine: Boolean(party.isMine),
        label,
        goal,
        stars,
        starsLeft,
        starsMet,
        // Never 100% while the party is still outside: it is 100% only through the Portal.
        percent: Math.min(starsMet ? 100 : 99, Math.floor(party.progress)),
        gapPercent: Math.max(0, Math.ceil(100 - party.progress)),
        runes,
        runesLit: runes.filter((rune) => rune.met).length,
        state: party.portal?.state || (starsMet ? 'open' : 'road')
    };
}

function portalRoadHtml(road) {
    const who = `<span class="tq-tip__goal-who"><span aria-hidden="true">${escapeHtml(road.logo || '★')}</span>${escapeHtml(road.name || 'Class')}</span>`;
    const of = road.goal > 0 ? `${formatQuestStars(road.stars)} of ${formatQuestStars(road.goal)}★` : `${road.percent}% of the goal`;
    const count = road.starsMet
        ? `<span class="tq-tip__goal-count is-full"><i class="fas fa-star" aria-hidden="true"></i><span>Stars gathered<em>${of}</em></span></span>`
        : `<span class="tq-tip__goal-count"><b>${road.starsLeft !== null ? formatQuestStars(road.starsLeft) : formatPercent(road.gapPercent)}</b><span>${road.starsLeft !== null ? (road.starsLeft === 1 ? 'star to go' : 'stars to go') : 'to go'}<em>${of}</em></span></span>`;
    let runes = '';
    if (road.runes.length) {
        const sleeping = road.runes.filter((rune) => !rune.met);
        let line = `${road.runesLit} of ${road.runes.length} ${road.runes.length === 1 ? 'rune' : 'runes'} lit`;
        if (!road.starsMet && sleeping.length) line = `Then ${sleeping.length === 1 ? 'one rune' : `${sleeping.length} runes`} to light`;
        if (road.starsMet && road.state === 'guardian') line = 'The Guardian waits at the gate';
        else if (road.starsMet && sleeping.length) line = `${sleeping.length === 1 ? 'One rune still sleeps' : `${sleeping.length} runes still sleep`}`;
        else if (!sleeping.length) line = 'Every rune is lit';
        const marks = road.runes.map((rune) => `<span class="tq-tip__rune${rune.met ? ' is-lit' : ''}"><i class="fas ${escapeHtml(rune.icon || 'fa-gem')}" aria-hidden="true"></i>${escapeHtml(rune.short || 'Rune')}</span>`).join('');
        runes = `<span class="tq-tip__runes"><small><i class="fas fa-gem" aria-hidden="true"></i>${escapeHtml(line)}</small><span class="tq-tip__rune-row">${marks}</span></span>`;
    }
    return `<span class="tq-tip__goal${road.isMine ? ' is-mine' : ''}${road.starsMet ? ' is-full' : ''}">
            <span class="tq-tip__goal-top">${who}<small>${escapeHtml(road.starsMet ? `${road.label} · at the gate` : road.label)}</small></span>
            ${count}
            <span class="tq-tip__goal-bar" style="--p:${road.percent}%" aria-hidden="true"><i></i></span>
            ${runes}
        </span>`;
}

function chaserHtml(road) {
    const left = road.starsMet ? 'at the sealed gate' : road.starsLeft !== null ? `${formatQuestStars(road.starsLeft)}★ to go` : `${formatPercent(road.gapPercent)} to go`;
    return `<span class="tq-tip__chaser"><i class="fas fa-flag-checkered" aria-hidden="true"></i><span>${escapeHtml(road.label)}:</span><b><span aria-hidden="true">${escapeHtml(road.logo || '★')}</span>${escapeHtml(road.name || 'Class')}</b><em>${escapeHtml(left)}</em></span>`;
}

/** The tooltip card's inner markup. `badge` is the realm crest image URL. */
export function placeTipHtml(info, { badge = '' } = {}) {
    const chip = (party) => `<span class="tq-tip__chip${party.isMine ? ' is-mine' : ''}"><span aria-hidden="true">${escapeHtml(party.logo || '★')}</span>${escapeHtml(party.name || 'Class')}</span>`;
    // The Portal names every party inside it; a realm shows four and counts the rest.
    const limit = info.id === 'portal' ? Infinity : 4;
    const chips = info.here.slice(0, limit).map(chip).join('') + (info.here.length > limit ? `<span class="tq-tip__chip tq-tip__chip--more">+${info.here.length - limit}</span>` : '');
    // The parties the card follows already say they wait at the gate; the gate names the others.
    const followed = [info.focus, info.chaser].filter(Boolean);
    const atGate = (info.gate || []).filter((party) => !followed.some((road) => road.name === party.name && road.logo === party.logo));
    const gate = atGate.length
        ? `<span class="tq-tip__status tq-tip__status--gate"><small><i class="fas fa-lock" aria-hidden="true"></i>${atGate.length === 1 ? 'Waiting at the sealed gate' : `${atGate.length} parties at the sealed gate`}</small><span class="tq-tip__chips">${atGate.map(chip).join('')}</span></span>`
        : '';
    let status = '';
    if (info.status === 'here') {
        const label = info.id === 'portal'
            ? (info.here.length === 1 ? 'Inside the Portal' : `${info.here.length} parties inside the Portal`)
            : (info.here.length === 1 ? 'Here now' : `${info.here.length} parties here now`);
        status = `<span class="tq-tip__status${info.id === 'portal' ? ' tq-tip__status--inside' : ''}"><small>${label}</small><span class="tq-tip__chips">${chips}</span></span>${gate}`;
    } else if (info.id === 'portal' && gate) {
        status = gate;
    } else if (info.id === 'portal' && info.focus) {
        status = '';
    } else if (info.status === 'ahead' && info.id === 'portal') {
        status = `<span class="tq-tip__status tq-tip__status--asleep"><i class="fas fa-hourglass-half" aria-hidden="true"></i>${info.gap > 0
            ? `Sealed until a party finishes: the leading party is ${formatPercent(info.gap)} away`
            : 'Waiting for its first party'}</span>`;
    } else if (info.status === 'ahead') {
        status = `<span class="tq-tip__status tq-tip__status--asleep"><i class="fas fa-cloud" aria-hidden="true"></i>${info.gap > 0
            ? `Still hidden in the clouds: the leading party is ${formatPercent(info.gap)} away`
            : 'Waiting for its first party'}</span>`;
    } else {
        status = '<span class="tq-tip__status tq-tip__status--passed"><i class="fas fa-flag-checkered" aria-hidden="true"></i>Every party has passed through</span>';
    }
    return `<span class="tq-tip__head">
            ${badge ? `<img class="tq-tip__badge" src="${escapeHtml(badge)}" alt="" aria-hidden="true" draggable="false">` : ''}
            <span class="tq-tip__titles"><small>${escapeHtml(info.kind)}</small><strong>${escapeHtml(info.title)}</strong></span>
        </span>
        <span class="tq-tip__desc">${escapeHtml(info.desc)}</span>
        <span class="tq-tip__from"><i class="fas fa-compass" aria-hidden="true"></i>${escapeHtml(info.from)}</span>
        ${status}
        ${info.focus ? portalRoadHtml(info.focus) : ''}
        ${info.chaser ? chaserHtml(info.chaser) : ''}
        <span class="tq-tip__hint">${escapeHtml(info.hint)}<i class="fas fa-arrow-right" aria-hidden="true"></i></span>`;
}
