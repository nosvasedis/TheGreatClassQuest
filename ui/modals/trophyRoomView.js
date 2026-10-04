// ui/modals/trophyRoomView.js — HTML for the Trophy Room (no state, no DOM access).
// Kept pure so the guidebook capture can render the real markup from sample data.
import { sealArtHtml } from '../../features/heroSealsCore.mjs';

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

/** Before a hero is picked: a calm welcome with the class totals. */
export function renderTrophyIdleHtml({ heroCount = 0, itemCount = 0, readyCount = 0 } = {}) {
    return `
        <div class="tr-idle">
            <div class="tr-idle-art" aria-hidden="true">🎒</div>
            <h3 class="font-title">Choose a hero</h3>
            <p>Pick a name to open their satchel. Relics can be used from here; treasures stay kept for good.</p>
            <div class="tr-idle-stats">
                <span><b>${heroCount}</b> hero${heroCount === 1 ? '' : 'es'}</span>
                <span><b>${itemCount}</b> item${itemCount === 1 ? '' : 's'} kept</span>
                <span class="is-ready"><b>${readyCount}</b> relic${readyCount === 1 ? '' : 's'} ready</span>
            </div>
        </div>`;
}

function relicCardHtml(relic, studentId) {
    return `
        <article class="tr-relic">
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

function treasureTileHtml(treasure) {
    const meta = [treasure.sourceLabel, treasure.acquiredLabel].filter(Boolean).join(' · ');
    return `
        <button type="button" class="tr-treasure tr-zoom${treasure.kind === 'keepsake' ? ' is-keepsake' : ''}" data-item-index="${treasure.index}"
            aria-label="Look closer at ${escTrophy(treasure.name)}">
            <span class="tr-treasure-art">${itemArtHtml(treasure)}</span>
            <span class="tr-treasure-name">${escTrophy(treasure.name)}</span>
            ${meta ? `<span class="tr-treasure-meta">${escTrophy(meta)}</span>` : ''}
        </button>`;
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

/**
 * The open satchel.
 * @param {{ student: {id:string,name:string,avatar?:string}, classLabel?: string, gold: number,
 *   satchel: ReturnType<import('../../features/trophyRoomCore.mjs').buildTrophySatchel>,
 *   effects: Array<{icon:string,title:string,body:string}> }} view
 */
export function renderTrophySatchelHtml({ student, classLabel = '', gold = 0, satchel, effects = [], seals = null }) {
    const { relics, treasures, relicCount, treasureCount, total } = satchel;

    const effectsHtml = effects.length ? `
        <section class="tr-effects" aria-label="Working now">
            <p class="tr-effects-label"><i class="fas fa-hat-wizard" aria-hidden="true"></i>Working now</p>
            <div class="tr-effect-list">
                ${effects.map((e) => `
                    <div class="tr-effect">
                        <span class="tr-effect-icon" aria-hidden="true">${escTrophy(e.icon)}</span>
                        <span class="tr-effect-text"><b>${escTrophy(e.title)}</b><span>${escTrophy(e.body)}</span></span>
                    </div>`).join('')}
            </div>
        </section>` : '';

    const emptyAll = `
        <div class="tr-empty">
            <div class="tr-empty-art" aria-hidden="true">🪶</div>
            <h4 class="font-title">The satchel is empty</h4>
            <p>Relics and treasures bought in the Mystic Market, quiz prizes and kept Ember Oaths will appear here.</p>
        </div>`;

    const relicsHtml = `
        <section class="tr-section tr-section--relics">
            <header class="tr-section-head">
                <span class="tr-section-icon" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                <div>
                    <h4 class="font-title">Relics <span class="tr-section-count">${relicCount}</span></h4>
                    <p>Ready to use. Each use spends one.</p>
                </div>
            </header>
            ${relics.length
                ? `<div class="tr-relic-grid">${relics.map((r) => relicCardHtml(r, student.id)).join('')}</div>`
                : '<p class="tr-section-empty">No relics right now. Legendary Artifacts from the Mystic Market wait here until used.</p>'}
        </section>`;

    const treasuresHtml = `
        <section class="tr-section tr-section--treasures">
            <header class="tr-section-head">
                <span class="tr-section-icon" aria-hidden="true"><i class="fas fa-gem"></i></span>
                <div>
                    <h4 class="font-title">Treasures <span class="tr-section-count">${treasureCount}</span></h4>
                    <p>Collected and kept for good. Tap one to look closer.</p>
                </div>
            </header>
            ${treasures.length
                ? `<div class="tr-treasure-grid">${treasures.map(treasureTileHtml).join('')}</div>`
                : '<p class="tr-section-empty">No treasures yet. Seasonal pieces, quiz prizes and Star-Embers collect here.</p>'}
        </section>`;

    return `
        <div class="tr-satchel" data-student-id="${escTrophy(student.id)}">
            <header class="tr-hero">
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
            ${effectsHtml}
            ${renderTrophySealsHtml(seals, student)}
            ${total === 0 ? emptyAll : relicsHtml + treasuresHtml}
        </div>`;
}
