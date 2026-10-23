/**
 * What a place on the Team Quest map says when you hover it: the realm, who is
 * there now, how far the leading party still has to go, or that every party
 * has passed through. Pure (no DOM): features/worldMap.js shows the card.
 *
 * Places: the four realms (worldGeometry.mjs#REALM_PLACES) and the Portal.
 */

import { QUEST_MAP_ZONES } from '../questMapZones.mjs';
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
        return { ...party, progress: knowsInside ? (party.inside ? 100 : Math.min(99.99, progress)) : progress };
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
        return {
            id: 'portal',
            title: 'The Crystal Portal',
            kind: 'The end of the quest',
            desc: 'It opens when a party gathers its whole month of stars and lights its runes.',
            from: 'At 100% of the month’s goal',
            here,
            gate,
            status: here.length ? 'here' : 'ahead',
            gap: Math.max(0, 100 - leader),
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

/** The tooltip card's inner markup. `badge` is the realm crest image URL. */
export function placeTipHtml(info, { badge = '' } = {}) {
    const chip = (party) => `<span class="tq-tip__chip${party.isMine ? ' is-mine' : ''}"><span aria-hidden="true">${escapeHtml(party.logo || '★')}</span>${escapeHtml(party.name || 'Class')}</span>`;
    // The Portal names every party inside it; a realm shows four and counts the rest.
    const limit = info.id === 'portal' ? Infinity : 4;
    const chips = info.here.slice(0, limit).map(chip).join('') + (info.here.length > limit ? `<span class="tq-tip__chip tq-tip__chip--more">+${info.here.length - limit}</span>` : '');
    const gate = info.gate?.length
        ? `<span class="tq-tip__status tq-tip__status--gate"><small><i class="fas fa-lock" aria-hidden="true"></i>${info.gate.length === 1 ? 'Waiting at the sealed gate' : `${info.gate.length} parties at the sealed gate`}</small><span class="tq-tip__chips">${info.gate.map(chip).join('')}</span></span>`
        : '';
    let status = '';
    if (info.status === 'here') {
        const label = info.id === 'portal'
            ? (info.here.length === 1 ? 'Inside the Portal' : `${info.here.length} parties inside the Portal`)
            : (info.here.length === 1 ? 'Here now' : `${info.here.length} parties here now`);
        status = `<span class="tq-tip__status${info.id === 'portal' ? ' tq-tip__status--inside' : ''}"><small>${label}</small><span class="tq-tip__chips">${chips}</span></span>${gate}`;
    } else if (info.id === 'portal' && gate) {
        status = gate;
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
        <span class="tq-tip__hint">${escapeHtml(info.hint)}<i class="fas fa-arrow-right" aria-hidden="true"></i></span>`;
}
