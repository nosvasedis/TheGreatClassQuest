// ui/modals/trophyRoomView.js — HTML for the Satchel modal (code name trophy room; no state, no DOM access).
// The satchel opens to four leather pockets (tabs): Relics, Charms, Treasures, Seals. Styles: styles/satchel.css.
// Kept pure so the guidebook capture can render the real markup from sample data.
import { sealArtHtml } from '../../features/heroSealsCore.mjs';
import { legendaryArtSvg } from '../../features/legendaryArt.mjs';

export function escTrophy(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function portraitHtml(student, className) {
    if (student?.avatar) {
        return `<span class="${className}"><img src="${escTrophy(student.avatar)}" alt="" loading="lazy"></span>`;
    }
    const initial = String(student?.name || '?').trim().charAt(0).toUpperCase() || '?';
    return `<span class="${className} is-initial" aria-hidden="true">${escTrophy(initial)}</span>`;
}

function itemArtHtml(item) {
    const art = item.artId ? legendaryArtSvg(item.artId, { className: 'lg-art lg-art--trophy' }) : '';
    if (art) return art;
    if (item.image) return `<img src="${escTrophy(item.image)}" alt="" loading="lazy">`;
    return `<span class="tr-emoji" aria-hidden="true">${escTrophy(item.icon || '📦')}</span>`;
}

/** Hero list: one row per student with item count and a glow when a relic is ready. */
export function renderTrophyRosterHtml(students, selectedId) {
    if (!students.length) {
        return '<p class="tr-roster-empty">No students in this class yet.</p>';
    }
    return students.map((s) => {
        const selected = s.id === selectedId;
        const readyNote = s.ready > 0 ? `, ${s.ready} ready to use` : '';
        const countLabel = `${s.total} item${s.total === 1 ? '' : 's'}${readyNote}`;
        return `
            <button type="button" class="tr-roster-item${selected ? ' is-selected' : ''}${s.total === 0 ? ' is-empty' : ''}"
                data-student-id="${escTrophy(s.id)}" aria-pressed="${selected}" aria-label="${escTrophy(s.name)}: ${countLabel}">
                ${portraitHtml(s, 'tr-roster-portrait')}
                <span class="tr-roster-name">${escTrophy(s.name)}</span>
                ${s.ready > 0 ? '<span class="tr-roster-ready" title="A relic is ready to use"><i class="fas fa-bolt" aria-hidden="true"></i></span>' : ''}
                <span class="tr-roster-count">${s.total > 0 ? s.total : '–'}</span>
            </button>`;
    }).join('');
}

/** Before a hero is picked: the satchel waits, buckled, with the class totals. */
export function renderTrophyIdleHtml({ heroCount = 0, itemCount = 0, readyCount = 0 } = {}) {
    return `
        <div class="tr-idle">
            <div class="tr-idle-art" aria-hidden="true">${satchelArtSvg('sat-idle-bag')}</div>
            <h3 class="font-title">Choose a hero</h3>
            <p>Tap a name tag to open their Satchel. Relics and charms can be used from here; treasures stay kept for good.</p>
            <div class="tr-idle-stats">
                <span><b>${heroCount}</b> hero${heroCount === 1 ? '' : 'es'}</span>
                <span><b>${itemCount}</b> item${itemCount === 1 ? '' : 's'} kept</span>
                <span class="is-ready"><b>${readyCount}</b> ready to use</span>
            </div>
        </div>`;
}

/** A drawn leather satchel (idle state and empty pocket). */
export function satchelArtSvg(className = '') {
    return `<svg class="${className}" viewBox="0 0 120 110" focusable="false" aria-hidden="true">
        <path class="sat-art-strap" d="M30 44 C30 6 90 6 90 44" />
        <rect class="sat-art-body" x="12" y="38" width="96" height="64" rx="16" />
        <path class="sat-art-seam" d="M20 92 H100" />
        <g class="sat-art-flap">
            <path class="sat-art-flap-leather" d="M12 54 Q12 38 28 38 H92 Q108 38 108 54 V70 Q60 90 12 70 Z" />
            <path class="sat-art-stitch" d="M20 53 Q20 45 29 45 H91 Q100 45 100 53 V66 Q60 82 20 66 Z" />
            <rect class="sat-art-buckle" x="50" y="64" width="20" height="18" rx="4" />
            <path class="sat-art-tongue" d="M60 64 V77" />
        </g>
        <g class="sat-art-sparkles"><path d="M98 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" /><path d="M18 22 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z" /></g>
    </svg>`;
}

function relicCardHtml(relic, studentId, i = 0) {
    return `
        <article class="tr-relic" style="--i:${i}">
            <button type="button" class="tr-relic-art tr-zoom" data-item-index="${relic.indices[0]}" aria-label="Look closer at ${escTrophy(relic.name)}">
                ${itemArtHtml(relic)}
                ${relic.count > 1 ? `<span class="tr-stack" aria-label="${relic.count} owned">×${relic.count}</span>` : ''}
            </button>
            <div class="tr-relic-text">
                <h5 class="font-title">${escTrophy(relic.name)}</h5>
                <p>${escTrophy(relic.description || 'A relic with a single use.')}</p>
            </div>
            <button type="button" class="tr-use-btn" data-student-id="${escTrophy(studentId)}" data-item-index="${relic.indices[0]}">
                <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>Use</span>
            </button>
        </article>`;
}

function treasureTileHtml(treasure, i = 0) {
    const meta = [treasure.tierLabel, treasure.sourceLabel, treasure.acquiredLabel].filter(Boolean).join(' · ');
    const charm = treasure.charm
        ? `<span class="tr-treasure-charm${treasure.charmUsed ? ' is-spent' : ''}" title="${escTrophy(treasure.charmUsed ? `Charm used: ${treasure.charm.title}` : `Charm: ${treasure.charm.title}`)}">
                <span aria-hidden="true">${escTrophy(treasure.charm.icon)}</span>${treasure.charmUsed ? 'Charm used' : escTrophy(treasure.charm.title)}
            </span>`
        : '';
    return `
        <button type="button" class="tr-treasure tr-zoom${treasure.kind === 'keepsake' ? ' is-keepsake' : ''}${treasure.tier ? ` is-${treasure.tier}` : ''}" style="--i:${Math.min(i, 18)}" data-item-index="${treasure.index}"
            aria-label="Look closer at ${escTrophy(treasure.name)}">
            <span class="tr-treasure-art">${itemArtHtml(treasure)}</span>
            <span class="tr-treasure-name">${escTrophy(treasure.name)}</span>
            ${meta ? `<span class="tr-treasure-meta">${escTrophy(meta)}</span>` : ''}
            ${charm}
        </button>`;
}

function charmCardHtml(treasure, studentId, i = 0) {
    return `
        <article class="tr-relic tr-charm is-${escTrophy(treasure.tier)}" style="--i:${i}">
            <button type="button" class="tr-relic-art tr-zoom" data-item-index="${treasure.index}" aria-label="Look closer at ${escTrophy(treasure.name)}">
                ${itemArtHtml(treasure)}
                <span class="tr-stack tr-charm-icon" aria-hidden="true">${escTrophy(treasure.charm.icon)}</span>
            </button>
            <div class="tr-relic-text">
                <h5 class="font-title">${escTrophy(treasure.charm.title)}</h5>
                <p>${escTrophy(treasure.charm.text)}</p>
                <p class="tr-charm-from">From ${escTrophy(treasure.name)} · ${escTrophy(treasure.tierLabel)}</p>
            </div>
            <button type="button" class="tr-use-btn tr-charm-btn" data-student-id="${escTrophy(studentId)}" data-item-index="${treasure.index}">
                <i class="fas fa-hand-sparkles" aria-hidden="true"></i><span>Use charm</span>
            </button>
        </article>`;
}

const CHARM_SET_TIERS = [['common', 'Common', 1], ['rare', 'Rare', 2], ['legendary', 'Legendary', 3]];

/**
 * Charm sets: one jar per rarity. Each pip is a treasure collected toward the next charm;
 * a full set wakes a charm the hero can call on from any treasure of that rarity.
 */
export function renderCharmSetsHtml(charmSets) {
    if (!charmSets?.tiers) return '';
    return `
        <div class="tr-csets" role="list" aria-label="Charm sets">
            ${CHARM_SET_TIERS.map(([tier, label, gems]) => {
                const set = charmSets.tiers[tier];
                if (!set) return '';
                const pips = Array.from({ length: set.need }, (_, i) => `<i class="tr-cset-pip${i < set.inSet ? ' is-filled' : ''}"></i>`).join('');
                const line = set.ready > 0
                    ? `<b>${set.ready}</b> charm${set.ready === 1 ? '' : 's'} awake`
                    : `${set.inSet} of ${set.need} · ${set.toNext} more to wake one`;
                return `
                    <div class="tr-cset is-${tier}${set.ready > 0 ? ' is-ready' : ''}" role="listitem"
                        aria-label="${escTrophy(`${label}: ${set.ready > 0 ? `${set.ready} charm awake` : `${set.inSet} of ${set.need} treasures collected`}`)}">
                        <span class="tr-cset-head">
                            <span class="tr-cset-gems" aria-hidden="true">${Array.from({ length: 3 }, (_, i) => `<i${i < gems ? ' class="is-lit"' : ''}></i>`).join('')}</span>
                            <b>${label}</b>
                            <span class="tr-cset-need">Set of ${set.need}</span>
                        </span>
                        <span class="tr-cset-pips" aria-hidden="true">${pips}${set.ready > 0 ? '<span class="tr-cset-spark">✨</span>' : ''}</span>
                        <span class="tr-cset-line">${line}</span>
                    </div>`;
            }).join('')}
        </div>`;
}

/** The Collector's Hoard: points from every treasure, the rank reached and the next one. */
export function renderTrophyHoardHtml(hoard) {
    if (!hoard) return '';
    const pct = Math.round((hoard.progress || 0) * 100);
    const rankLine = hoard.rank > 0 ? `${escTrophy(hoard.icon)} ${escTrophy(hoard.title)}` : 'No rank yet';
    const nextLine = hoard.next
        ? `${hoard.toNext} point${hoard.toNext === 1 ? '' : 's'} to ${escTrophy(hoard.next.icon)} ${escTrophy(hoard.next.title)} (+${hoard.next.gold} Gold)`
        : 'The highest rank of the Hoard!';
    return `
        <section class="tr-hoard" aria-label="Collector's Hoard">
            <div class="tr-hoard-head">
                <span class="tr-hoard-label"><i class="fas fa-gem" aria-hidden="true"></i>Collector's Hoard</span>
                <span class="tr-hoard-rank">${rankLine}</span>
                <span class="tr-hoard-points">${hoard.points} pt${hoard.points === 1 ? '' : 's'}</span>
            </div>
            <div class="tr-hoard-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
            <p class="tr-hoard-next">${nextLine}. Common 1, rare 3, legendary 6, festival +1.</p>
        </section>`;
}

/**
 * Hero Seals in the satchel: the pressed seals, newest first, and a way into the Seal Book.
 * `seals` is buildSealBookView() from features/heroSealsCore.mjs.
 */
export function renderTrophySealsHtml(seals, student) {
    if (!seals) return '';
    const first = String(student?.name || '').trim().split(/\s+/)[0] || 'This hero';
    const pressed = seals.pressed || [];
    const shown = pressed.slice(0, 8);
    const more = pressed.length - shown.length;
    return `
        <section class="tr-section tr-section--seals" aria-label="Hero Seals">
            <header class="tr-section-head">
                <span class="tr-section-icon" aria-hidden="true"><i class="fas fa-stamp"></i></span>
                <div>
                    <h4 class="font-title">Hero Seals <span class="tr-section-count">${pressed.length} of ${seals.total}</span></h4>
                    <p>Quiet milestones from ${escTrophy(first)}’s own story. No Gold, no stars, just theirs.</p>
                </div>
                <button type="button" class="tr-seal-book-btn" data-student-id="${escTrophy(student?.id)}">
                    <i class="fas fa-book-open" aria-hidden="true"></i><span>Seal Book</span>
                </button>
            </header>
            ${shown.length ? `
            <div class="tr-seal-row">
                ${shown.map((s, i) => `
                    <div class="tr-seal" style="--i:${i}" title="${escTrophy(s.name)}${s.dateLabel ? `, ${escTrophy(s.dateLabel)}` : ''}">
                        ${sealArtHtml(s, { size: 58 })}
                        <span class="tr-seal-name">${escTrophy(s.name)}</span>
                        ${s.dateLabel ? `<span class="tr-seal-date">${escTrophy(s.dateLabel)}</span>` : ''}
                    </div>`).join('')}
                ${more > 0 ? `<button type="button" class="tr-seal tr-seal--more tr-seal-book-btn" data-student-id="${escTrophy(student?.id)}"><span class="tr-seal-more">+${more}</span><span class="tr-seal-name">more in the book</span></button>` : ''}
            </div>`
            : `<p class="tr-section-empty">No seals pressed yet. A first star for any virtue presses the first one, and ${seals.total - pressed.length} more wait in the Seal Book.</p>`}
        </section>`;
}

/** The four pockets, in order. */
export const SATCHEL_TABS = [
    { id: 'relics', label: 'Relics', icon: 'fa-bolt' },
    { id: 'charms', label: 'Charms', icon: 'fa-hand-sparkles' },
    { id: 'treasures', label: 'Treasures', icon: 'fa-gem' },
    { id: 'seals', label: 'Seals', icon: 'fa-stamp' },
];

/** Which pocket opens first: whatever can be used right now, else what the hero holds. */
export function satchelDefaultTab(satchel, seals = null) {
    const charmsAwake = (satchel?.charms || []).length > 0 || (satchel?.charmSets?.ready || 0) > 0;
    if ((satchel?.relicCount || 0) > 0) return 'relics';
    if (charmsAwake) return 'charms';
    if ((satchel?.treasureCount || 0) > 0) return 'treasures';
    if ((seals?.pressed || []).length > 0) return 'seals';
    return 'treasures';
}

function pocketIntro(text) {
    return `<p class="sat-pocket-intro">${text}</p>`;
}

/**
 * The open satchel: the hero's luggage label, then four pocket tabs, one pocket showing.
 * @param {{ student: {id:string,name:string,avatar?:string}, classLabel?: string, gold: number,
 *   satchel: ReturnType<import('../../features/trophyRoomCore.mjs').buildTrophySatchel>,
 *   effects: Array<{icon:string,title:string,body:string}>, tab?: string }} view
 */
export function renderTrophySatchelHtml({ student, classLabel = '', gold = 0, satchel, effects = [], seals = null, hoard = null, tab = '' }) {
    const { relics, treasures, relicCount, treasureCount, total } = satchel;
    const charms = satchel.charms || [];
    const charmSets = satchel.charmSets || null;
    const charmsReady = charmSets?.ready || 0;
    const sealsPressed = (seals?.pressed || []).length;
    const active = SATCHEL_TABS.some((t) => t.id === tab) ? tab : satchelDefaultTab(satchel, seals);
    const sid = escTrophy(student.id);

    const effectsHtml = effects.length ? `
        <section class="tr-effects" aria-label="Working now">
            <p class="tr-effects-label"><i class="fas fa-hat-wizard" aria-hidden="true"></i>Working now</p>
            <div class="tr-effect-list">
                ${effects.map((e, i) => `
                    <div class="tr-effect" style="--i:${i}">
                        <span class="tr-effect-icon" aria-hidden="true">${(e.artId && legendaryArtSvg(e.artId)) || escTrophy(e.icon)}</span>
                        <span class="tr-effect-text"><b>${escTrophy(e.title)}</b><span>${escTrophy(e.body)}</span></span>
                    </div>`).join('')}
            </div>
        </section>` : '';

    const emptyPocket = (title, body) => `
        <div class="tr-empty">
            <div class="tr-empty-art" aria-hidden="true">${satchelArtSvg('sat-empty-bag')}</div>
            <h4 class="font-title">${title}</h4>
            <p>${body}</p>
        </div>`;

    const relicsBody = `
        ${effectsHtml}
        ${pocketIntro('Legendary Artifacts, ready to use. Each use spends one.')}
        ${relics.length
            ? `<div class="tr-relic-grid">${relics.map((r, i) => relicCardHtml(r, student.id, i)).join('')}</div>`
            : (total === 0
                ? emptyPocket('The satchel is empty', 'Relics and treasures bought in the Mystic Market, quiz prizes and kept Ember Oaths will appear here.')
                : '<p class="tr-section-empty">No relics right now. Legendary Artifacts from the Mystic Market wait here until used.</p>')}`;

    const charmsBody = `
        ${pocketIntro('Collect treasures of one rarity to wake a charm. Then pick whose charm to use; the treasure stays. One charm a day.')}
        ${charmSets ? renderCharmSetsHtml(charmSets) : ''}
        ${charms.length
            ? `<p class="tr-charm-pick">Pick one treasure's charm for each awake charm:</p>
               <div class="tr-relic-grid">${charms.map((t, i) => charmCardHtml(t, student.id, i)).join('')}</div>`
            : '<p class="tr-section-empty">No charm is awake yet. Fill a set above to wake one.</p>'}`;

    const treasuresBody = `
        ${renderTrophyHoardHtml(hoard)}
        ${pocketIntro('Collected and kept for good. Tap one to look closer.')}
        ${treasures.length
            ? `<div class="tr-treasure-grid">${treasures.map((t, i) => treasureTileHtml(t, i)).join('')}</div>`
            : (total === 0
                ? emptyPocket('The satchel is empty', 'Relics and treasures bought in the Mystic Market, quiz prizes and kept Ember Oaths will appear here.')
                : '<p class="tr-section-empty">No treasures yet. Seasonal pieces, quiz prizes and Star-Embers collect here.</p>')}`;

    const sealsBody = seals
        ? renderTrophySealsHtml(seals, student)
        : '<p class="tr-section-empty">Hero Seals are still being read for this class.</p>';

    const pockets = {
        relics: { count: relicCount, glow: relicCount > 0, body: relicsBody },
        charms: { count: charmsReady, glow: charmsReady > 0, body: charmsBody },
        treasures: { count: treasureCount, glow: false, body: treasuresBody },
        seals: { count: sealsPressed, glow: false, body: sealsBody },
    };

    const tabsHtml = SATCHEL_TABS.map((t) => {
        const on = t.id === active;
        const p = pockets[t.id];
        const countText = t.id === 'charms' ? `${p.count} awake` : `${p.count}`;
        return `
            <button type="button" role="tab" class="sat-tab sat-tab--${t.id}${on ? ' is-active' : ''}${p.glow ? ' is-glowing' : ''}"
                id="sat-tab-${t.id}-${sid}" data-tr-tab="${t.id}" aria-selected="${on}" aria-controls="sat-pocket-${t.id}-${sid}" tabindex="${on ? '0' : '-1'}">
                <span class="sat-tab__icon" aria-hidden="true"><i class="fas ${t.icon}"></i></span>
                <span class="sat-tab__label">${t.label}</span>
                <span class="sat-tab__count" aria-label="${escTrophy(countText)}">${p.count}</span>
            </button>`;
    }).join('');

    const pocketsHtml = SATCHEL_TABS.map((t) => `
            <section class="sat-pocket sat-pocket--${t.id}${t.id === active ? ' is-active' : ''}" role="tabpanel" id="sat-pocket-${t.id}-${sid}"
                aria-labelledby="sat-tab-${t.id}-${sid}" data-tr-pocket="${t.id}"${t.id === active ? '' : ' hidden'}>
                ${pockets[t.id].body}
            </section>`).join('');

    return `
        <div class="tr-satchel" data-student-id="${sid}" data-tab="${active}">
            <header class="tr-hero">
                <span class="tr-hero-tagstring" aria-hidden="true"></span>
                ${portraitHtml(student, 'tr-hero-portrait')}
                <div class="tr-hero-id">
                    <h3 class="font-title">${escTrophy(student.name)}</h3>
                    ${classLabel ? `<p>${escTrophy(classLabel)}</p>` : ''}
                </div>
                <div class="tr-hero-pills">
                    <span class="tr-pill tr-pill--gold"><i class="fas fa-coins" aria-hidden="true"></i>${escTrophy(gold)} Gold</span>
                    <span class="tr-pill"><i class="fas fa-bag-shopping" aria-hidden="true"></i>${total} item${total === 1 ? '' : 's'}</span>
                </div>
            </header>
            <div class="sat-tabs" role="tablist" aria-label="Satchel pockets">${tabsHtml}</div>
            <div class="sat-pockets">${pocketsHtml}</div>
        </div>`;
}
