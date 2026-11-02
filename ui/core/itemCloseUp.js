// ui/core/itemCloseUp.js — the close-up of one thing in a hero's Satchel.
// Opened from a tile on the Hero Stage or in the Satchel modal. The item floats on a slowly
// turning rune lens (same tones as the use rite in itemUseRite.js), with where it came from,
// when it was found, its charm, and — for relics and awake charms — a button that hands over
// to the use rite. Arrows (and ← →) flip through the rest of the Satchel.
// Styles: styles/item_closeup.css (lazy, loaded with this module).
import '../../styles/item_closeup.css';
import * as state from '../../state.js';
import { legendaryArtSvg } from '../../features/legendaryArt.mjs';
import { LEGENDARY_ARTIFACTS } from '../../features/legendaryCatalog.mjs';
import { currentArtifactFor, isItemUsable, handleUseItem } from '../../features/powerUps.js';
import { buildTrophySatchel } from '../../features/trophyRoomCore.mjs';
import { isYoungClass } from '../../features/treasureCharms.js';
import { riteLook } from './itemUseRite.js';

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstName = (name) => String(name || 'Hero').trim().split(/\s+/)[0] || 'Hero';

const SOURCE_ICONS = {
    'Oath kept': 'fa-fire',
    'Star Path': 'fa-route',
    'Quiz prize': 'fa-trophy',
    Legendary: 'fa-crown',
    'Mystic Market': 'fa-store',
};

/** "Kept The Artist's Promise: I draw a comic." → { oath, promise } (Star-Ember keepsakes). */
export function splitKeptPromise(text) {
    const match = /^Kept\s+(.+?):\s+(.+)$/s.exec(String(text || '').trim());
    return match ? { oath: match[1].trim(), promise: match[2].trim() } : null;
}

/**
 * Everything the close-up shows for one inventory slot. Pure apart from the inputs.
 * Returns null when the slot is empty.
 */
export function describeSatchelItem(inventory, index, { satchel, student = null } = {}) {
    const raw = Array.isArray(inventory) ? inventory[index] : null;
    if (!raw || !raw.name) return null;
    const current = currentArtifactFor(raw);
    const relic = satchel?.relics.find((r) => r.indices.includes(index)) || null;
    const treasure = satchel?.treasures.find((t) => t.index === index) || null;
    const base = {
        index,
        name: current?.name || raw.name,
        description: current?.description || raw.description || raw.desc || '',
        icon: current?.icon || raw.icon || '',
        image: raw.image || '',
        artId: current ? current.id : '',
        acquiredLabel: '',
        tags: [],
        owner: student ? firstName(student.name) : '',
    };
    if (relic) {
        const def = LEGENDARY_ARTIFACTS.find((a) => a.id === relic.artId);
        const look = riteLook({ kind: 'relic', itemId: relic.artId });
        // The kicker names the family and the status counts the uses, so tags only add the form.
        const tags = def?.form ? [{ icon: 'fa-shapes', text: `${def.form} form` }] : [];
        return {
            ...base, kind: 'relic', look, kicker: look.kicker, ownerWord: 'relic', tags,
            status: { tone: 'ready', icon: 'fa-bolt', text: relic.count > 1 ? `Ready to use · ${relic.count} uses left` : 'Ready to use · one use' },
            action: { label: 'Use it', icon: 'fa-wand-magic-sparkles' },
        };
    }
    const t = treasure || {};
    const sourceTag = t.sourceLabel ? { icon: SOURCE_ICONS[t.sourceLabel] || 'fa-gem', text: t.sourceLabel } : null;
    const dateTag = t.acquiredLabel ? { icon: 'fa-calendar-day', text: `${t.kind === 'keepsake' ? 'Kept' : 'Found'} ${t.acquiredLabel}` } : null;
    const tags = [sourceTag, dateTag].filter(Boolean);
    if (t.kind === 'keepsake') {
        const look = riteLook({ kind: 'keepsake' });
        return {
            ...base, kind: 'keepsake', look, kicker: `Keepsake · ${t.sourceLabel || 'kept for good'}`, ownerWord: 'keepsake', tags,
            kept: splitKeptPromise(base.description),
            status: { tone: 'kept', icon: 'fa-heart', text: 'Kept for good. A memory of the quest, not a power.' },
            action: null,
        };
    }
    if (t.charm) {
        const look = riteLook({ kind: 'charm', tier: t.tier });
        const set = satchel?.charmSets?.tiers?.[t.tier];
        const awake = !t.charmUsed && set?.ready > 0;
        return {
            ...base, kind: 'treasure', tier: t.tier, look, kicker: `Treasure · ${t.tierLabel}`, ownerWord: 'treasure', tags,
            charm: { icon: t.charm.icon, title: t.charm.title, text: t.charm.text },
            status: t.charmUsed
                ? { tone: 'spent', icon: 'fa-moon', text: 'Charm already used. The treasure stays, kept for good.' }
                : awake
                    ? { tone: 'ready', icon: 'fa-hand-sparkles', text: 'Charm awake and ready' }
                    : { tone: 'asleep', icon: 'fa-hourglass-half', text: asleepLine(set, t.tierLabel) },
            action: awake ? { label: 'Use charm', icon: 'fa-hand-sparkles' } : null,
        };
    }
    const look = { tone: '#fbbf24', deep: '#5b3d0e' };
    return {
        ...base, kind: 'treasure', look, kicker: `Treasure · ${t.sourceLabel || 'kept for good'}`, ownerWord: 'treasure', tags,
        status: null, action: null,
    };
}

/** "Charm asleep. 1 more rare treasure wakes it." */
function asleepLine(set, tierLabel) {
    const more = Math.max(1, Number(set?.toNext) || 1);
    const word = String(tierLabel || '').toLowerCase();
    return `Charm asleep. ${more} more ${word} treasure${more === 1 ? ' wakes' : 's wake'} it.`;
}

function artHtml(info) {
    const svg = info.artId ? legendaryArtSvg(info.artId, { className: 'lg-art icu-art-svg' }) : '';
    if (svg) return svg;
    if (info.image) return `<img src="${esc(info.image)}" alt="" decoding="async" draggable="false">`;
    return `<span class="icu-emoji" aria-hidden="true">${esc(info.icon || '📦')}</span>`;
}

function lensSvg() {
    const ticks = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 80 : 84;
        return `<line x1="${(100 + Math.cos(a) * r1).toFixed(1)}" y1="${(100 + Math.sin(a) * r1).toFixed(1)}" x2="${(100 + Math.cos(a) * 89).toFixed(1)}" y2="${(100 + Math.sin(a) * 89).toFixed(1)}" />`;
    }).join('');
    const runes = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = 100 + Math.cos(a) * 96;
        const y = 100 + Math.sin(a) * 96;
        return `<path d="M${x.toFixed(1)} ${(y - 4).toFixed(1)} l3.5 4 -3.5 4 -3.5 -4z" />`;
    }).join('');
    return `<svg class="icu-lens" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle class="icu-lens-outer" cx="100" cy="100" r="96" />
        <g class="icu-lens-runes">${runes}</g>
        <g class="icu-lens-ticks">${ticks}</g>
        <circle class="icu-lens-inner" cx="100" cy="100" r="74" />
    </svg>`;
}

function sparklesHtml() {
    return `<span class="icu-sparkles" aria-hidden="true">${Array.from({ length: 10 }, (_, i) =>
        `<i style="--a:${i * 36}deg;--d:${(i * 0.37).toFixed(2)}s;--r:${98 + (i % 3) * 14}px"></i>`).join('')}</span>`;
}

function ownerHtml(student, info) {
    if (!student) return '';
    const face = student.avatar
        ? `<img src="${esc(student.avatar)}" alt="" decoding="async">`
        : esc(String(student.name || '?').trim().charAt(0).toUpperCase() || '?');
    return `<span class="icu-owner"><span class="icu-owner-face">${face}</span><span><b>${esc(info.owner)}</b>'s ${esc(info.ownerWord)}</span></span>`;
}

function storyHtml(info) {
    if (info.kept) {
        return `
            <figure class="icu-scroll">
                <figcaption><i class="fas fa-fire" aria-hidden="true"></i> Kept ${esc(info.kept.oath)}</figcaption>
                <blockquote>${esc(info.kept.promise)}</blockquote>
            </figure>`;
    }
    if (info.kind === 'keepsake' && info.description) {
        return `<figure class="icu-scroll"><blockquote>${esc(info.description)}</blockquote></figure>`;
    }
    return info.description ? `<p class="icu-desc">${esc(info.description)}</p>` : '';
}

function bodyHtml(info, student, position) {
    const tags = info.tags.length
        ? `<ul class="icu-tags">${info.tags.map((t) => `<li><i class="fas ${t.icon}" aria-hidden="true"></i>${esc(t.text)}</li>`).join('')}</ul>`
        : '';
    const charm = info.charm ? `
        <div class="icu-charm">
            <span class="icu-charm-orb" aria-hidden="true">${esc(info.charm.icon)}</span>
            <span class="icu-charm-text"><small>Its charm</small><b>${esc(info.charm.title)}</b><span>${esc(info.charm.text)}</span></span>
        </div>` : '';
    const status = info.status
        ? `<p class="icu-status is-${info.status.tone}"><i class="fas ${info.status.icon}" aria-hidden="true"></i><span>${esc(info.status.text)}</span></p>`
        : '';
    const pager = position.count > 1
        ? `<p class="icu-pager" aria-live="polite">${position.at + 1} of ${position.count} in the Satchel</p>`
        : '';
    return `
        <span class="icu-kicker"><i aria-hidden="true"></i>${esc(info.kicker)}<i aria-hidden="true"></i></span>
        <div class="icu-stage" data-icu-stage>
            <span class="icu-pool" aria-hidden="true"></span>
            <span class="icu-rays" aria-hidden="true"></span>
            ${lensSvg()}
            <span class="icu-shock" aria-hidden="true"></span>
            <span class="icu-orb"><span class="icu-art">${artHtml(info)}</span><span class="icu-shine" aria-hidden="true"></span></span>
            <span class="icu-plinth" aria-hidden="true"></span>
            ${sparklesHtml()}
        </div>
        ${pager}
        <h2 id="icu-title" class="icu-name font-title">${esc(info.name)}</h2>
        ${ownerHtml(student, info)}
        ${storyHtml(info)}
        ${charm}
        ${tags}
        ${status}
        <p class="icu-error" role="alert" hidden></p>
        <div class="icu-actions">
            <button type="button" class="icu-btn icu-btn--soft" data-icu="close">${info.action ? 'Keep it' : 'Back'}</button>
            ${info.action ? `<button type="button" class="icu-btn icu-btn--main" data-icu="use"><i class="fas ${info.action.icon}" aria-hidden="true"></i><span>${esc(info.action.label)}</span></button>` : ''}
        </div>`;
}

let active = null;

function closeCloseUp({ instant = false } = {}) {
    if (!active) return;
    const { overlay, onKey, previousFocus, unsubscribe } = active;
    active = null;
    unsubscribe?.();
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.remove('is-open');
    overlay.classList.add('is-leaving');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduced) overlay.remove();
    else setTimeout(() => overlay.remove(), 280);
    if (!instant) {
        try { previousFocus?.focus?.({ preventScroll: true }); } catch (_) { /* ignore */ }
    }
}

/** Satchel order for flipping: relic stacks, then treasures newest first (same as the Hero Stage). */
function flipOrder(satchel) {
    return [...satchel.relics.map((r) => r.indices[0]), ...satchel.treasures.map((t) => t.index)];
}

/**
 * Open the close-up.
 * @param {{ item: object, studentId?: string, index?: number, from?: Element, onUsed?: () => void }} opts
 */
export function openItemCloseUp({ item, studentId = '', index = -1, from = null, onUsed = null } = {}) {
    if (active) closeCloseUp({ instant: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const student = studentId ? (state.get('allStudents') || []).find((s) => s.id === studentId) || null : null;
    const readScore = () => (studentId ? (state.get('allStudentScores') || []).find((s) => s.id === studentId) : null);

    // Without a student (or an index) the card still shows the item, just without flipping or using.
    const fallbackInventory = [item];
    const snapshot = () => {
        const inventory = readScore()?.inventory || fallbackInventory;
        const satchel = buildTrophySatchel(inventory, {
            isUsable: isItemUsable, present: currentArtifactFor, young: student ? isYoungClass(student.classId) : false,
        });
        return { inventory, satchel, order: flipOrder(satchel) };
    };

    let { inventory, satchel, order } = snapshot();
    let at = index >= 0 && inventory[index] === item ? index : inventory.indexOf(item);
    if (at < 0) {
        inventory = fallbackInventory;
        ({ satchel, order } = { satchel: buildTrophySatchel(inventory, { isUsable: isItemUsable, present: currentArtifactFor }), order: [0] });
        at = 0;
    }
    // A stacked relic flips as one entry: point at its first copy.
    const relicOf = (i) => satchel.relics.find((r) => r.indices.includes(i));
    if (relicOf(at)) at = relicOf(at).indices[0];

    const overlay = document.createElement('div');
    overlay.className = 'icu-overlay';
    overlay.innerHTML = `
        <div class="icu-card" role="dialog" aria-modal="true" aria-labelledby="icu-title">
            <span class="icu-glow" aria-hidden="true"></span>
            <button type="button" class="icu-x" data-icu="close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <button type="button" class="icu-nav icu-nav--prev" data-icu="prev" aria-label="Previous item"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
            <button type="button" class="icu-nav icu-nav--next" data-icu="next" aria-label="Next item"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
            <div class="icu-body" data-icu-body></div>
        </div>`;
    const card = overlay.querySelector('.icu-card');
    const body = overlay.querySelector('[data-icu-body]');
    let busy = false;

    function paint(direction = '') {
        const info = describeSatchelItem(inventory, at, { satchel, student });
        if (!info) { closeCloseUp(); return; }
        const pos = order.indexOf(at);
        overlay.style.setProperty('--icu-tone', info.look.tone);
        overlay.style.setProperty('--icu-deep', info.look.deep);
        overlay.dataset.kind = info.kind;
        body.innerHTML = bodyHtml(info, student, { at: Math.max(0, pos), count: order.length });
        overlay.classList.toggle('has-pager', order.length > 1);
        if (direction && !reduced) {
            body.classList.remove('is-from-next', 'is-from-prev');
            void body.offsetWidth;
            body.classList.add(direction === 'next' ? 'is-from-next' : 'is-from-prev');
        }
    }

    function flip(step) {
        if (busy || order.length < 2) return;
        const pos = order.indexOf(at);
        at = order[(pos + step + order.length) % order.length];
        paint(step > 0 ? 'next' : 'prev');
    }

    async function use() {
        if (busy || !studentId) return;
        busy = true;
        const usedIndex = at;
        // The rite takes over from here (it asks, channels and reveals).
        closeCloseUp({ instant: true });
        try {
            await handleUseItem(studentId, usedIndex);
        } finally {
            onUsed?.();
        }
    }

    const state_ = {
        overlay,
        previousFocus: document.activeElement,
        onKey: (e) => {
            if (document.querySelector('.iur-overlay')) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCloseUp(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); flip(1); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); flip(-1); return; }
            if (e.key === 'Tab') {
                const focusables = [...card.querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent !== null);
                if (!focusables.length) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        },
    };
    active = state_;
    document.addEventListener('keydown', state_.onKey, true);

    overlay.addEventListener('click', (e) => {
        // Keep the tap from reaching the app's avatar handler (it would close the Hero Stage).
        e.stopPropagation();
        const action = e.target.closest('[data-icu]')?.dataset.icu;
        if (action === 'close') closeCloseUp();
        else if (action === 'prev') flip(-1);
        else if (action === 'next') flip(1);
        else if (action === 'use') use();
        else if (e.target === overlay) closeCloseUp();
    });

    // Swipe left/right on phones flips through the Satchel.
    let touchX = null;
    card.addEventListener('touchstart', (e) => { touchX = e.touches[0]?.clientX ?? null; }, { passive: true });
    card.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
        touchX = null;
        if (Math.abs(dx) > 50) flip(dx < 0 ? 1 : -1);
    }, { passive: true });

    // The item tilts toward the pointer, like turning it in your hand.
    if (!reduced) {
        card.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const stage = body.querySelector('[data-icu-stage]');
            if (!stage) return;
            const r = stage.getBoundingClientRect();
            const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
            const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
            stage.style.setProperty('--tx', x.toFixed(3));
            stage.style.setProperty('--ty', y.toFixed(3));
        });
        card.addEventListener('pointerleave', () => {
            const stage = body.querySelector('[data-icu-stage]');
            stage?.style.setProperty('--tx', '0');
            stage?.style.setProperty('--ty', '0');
        });
    }

    // Keep the card honest if the Satchel changes underneath it (a use elsewhere, a purchase).
    const unsubscribe = studentId && typeof state.subscribe === 'function'
        ? state.subscribe(['allStudentScores'], () => {
            if (active !== state_) return;
            const fresh = snapshot();
            const item = inventory[at];
            const nextAt = fresh.inventory.indexOf(item);
            ({ inventory, satchel, order } = fresh);
            if (nextAt >= 0) at = relicOf(nextAt)?.indices[0] ?? nextAt;
            else if (!order.length) { closeCloseUp(); return; }
            else at = order[Math.min(order.length - 1, Math.max(0, order.indexOf(at)))] ?? order[0];
            paint();
        })
        : null;
    state_.unsubscribe = unsubscribe;

    // Grow out of the tile that was tapped.
    if (from?.getBoundingClientRect) {
        const r = from.getBoundingClientRect();
        overlay.style.setProperty('--icu-from-x', `${Math.round(r.left + r.width / 2 - window.innerWidth / 2)}px`);
        overlay.style.setProperty('--icu-from-y', `${Math.round(r.top + r.height / 2 - window.innerHeight / 2)}px`);
    }

    paint();
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        (overlay.querySelector('[data-icu="use"]') || overlay.querySelector('.icu-actions [data-icu="close"]'))?.focus({ preventScroll: true, focusVisible: false });
    });
    return { close: closeCloseUp };
}
