// ui/core/itemUseRite.js — the moment a hero uses something from their Satchel.
// One card, three beats: ask ("Use the Time Warp Hourglass?"), channel (the rune circle spins up
// while the use is saved), reveal (the relic bursts into light and says what it did). It also
// explains, kindly, when something cannot be used right now. Used by features/powerUps.js
// (relics) and features/treasureCharms.js (treasure charms). Styles: styles/item_use.css (lazy).
import '../../styles/item_use.css';
import { legendaryArtSvg } from '../../features/legendaryArt.mjs';
import { LEGENDARY_ARTIFACTS, LEGENDARY_FAMILIES } from '../../features/legendaryCatalog.mjs';

const OVERLAY_ID = 'item-use-rite';
const AUTO_CLOSE_MS = 9000;

const FAMILY_TONES = {
    purse: { tone: '#f5b33d', deep: '#7a4a06', label: "Fortune's Purse" },
    guild: { tone: '#f0506e', deep: '#7a1230', label: 'The Guild Standard' },
    wayfinder: { tone: '#2dd4bf', deep: '#0b5a52', label: "The Wayfinder's Kit" },
    story: { tone: '#a78bfa', deep: '#43207e', label: "The Storyteller's Relics" },
    heart: { tone: '#f472b6', deep: '#7a1a4f', label: "The Hero's Heart" },
    retired: { tone: '#93c5fd', deep: '#1e3a6e', label: 'An old relic' },
};

const TIER_TONES = {
    common: { tone: '#34d399', deep: '#065f46', label: 'Common' },
    rare: { tone: '#60a5fa', deep: '#1e3a8a', label: 'Rare' },
    legendary: { tone: '#fbbf24', deep: '#78350f', label: 'Legendary' },
};

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const firstName = (name) => String(name || 'Hero').trim().split(/\s+/)[0] || 'Hero';

/** Colour and kicker for a relic (by its relic family) or a charm (by treasure rarity). */
export function riteLook({ kind = 'relic', itemId = '', tier = 'common' } = {}) {
    if (kind === 'charm') {
        const t = TIER_TONES[tier] || TIER_TONES.common;
        return { ...t, kicker: `Treasure charm · ${t.label}` };
    }
    if (kind === 'keepsake') return { tone: '#fcd34d', deep: '#5b3d0e', kicker: 'Keepsake' };
    const family = LEGENDARY_ARTIFACTS.find((a) => a.id === itemId)?.family || 'retired';
    const t = FAMILY_TONES[family] || FAMILY_TONES.retired;
    const familyName = LEGENDARY_FAMILIES.find((f) => f.id === family)?.name || t.label;
    return { ...t, kicker: `Legendary relic · ${familyName}` };
}

function itemArt(item, kind) {
    const svg = kind !== 'charm' && item.artId ? legendaryArtSvg(item.artId, { className: 'lg-art iur-art-svg' }) : '';
    if (svg) return svg;
    if (item.image) return `<img src="${esc(item.image)}" alt="" decoding="async">`;
    return `<span class="iur-emoji" aria-hidden="true">${esc(item.icon || '✨')}</span>`;
}

function whoHtml(student) {
    const face = student?.avatar
        ? `<img src="${esc(student.avatar)}" alt="" decoding="async">`
        : esc(String(student?.name || '?').trim().charAt(0).toUpperCase() || '?');
    return `<span class="iur-who"><span class="iur-who__face">${face}</span><span>for <b>${esc(student?.name || 'this hero')}</b></span></span>`;
}

function runesSvg() {
    const runes = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 86;
        const y = 100 + Math.sin(a) * 86;
        return `<path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)} l4 5 -4 5 -4 -5z" />`;
    }).join('');
    return `<svg class="iur-runes" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle class="iur-ring iur-ring--outer" cx="100" cy="100" r="94" />
        <circle class="iur-ring iur-ring--dash" cx="100" cy="100" r="86" />
        <g class="iur-rune-marks">${runes}</g>
        <circle class="iur-ring iur-ring--inner" cx="100" cy="100" r="70" />
    </svg>`;
}

function sparksHtml() {
    return `<span class="iur-sparks" aria-hidden="true">${Array.from({ length: 14 }, (_, i) =>
        `<i style="--a:${Math.round((i / 14) * 360)}deg;--d:${(0.15 + (i % 4) * 0.08).toFixed(2)}s;--r:${92 + (i % 3) * 22}px"></i>`).join('')}</span>`;
}

let active = null;

function closeRite() {
    if (!active) return;
    const { overlay, onKey, timer, previousFocus } = active;
    active = null;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.add('is-leaving');
    const remove = () => overlay.remove();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
    else setTimeout(remove, 260);
    try { previousFocus?.focus?.({ preventScroll: true }); } catch (_) { /* ignore */ }
}

/**
 * Open the rite.
 * @param {{ kind?: 'relic'|'charm'|'keepsake', student: {name:string,avatar?:string},
 *   item: {name:string, icon?:string, image?:string, artId?:string, tier?:string},
 *   question?: string, effect?: string, note?: string, confirmLabel?: string, cancelLabel?: string,
 *   blocked?: string, blockedTitle?: string, charmIcon?: string,
 *   onConfirm?: () => Promise<{ ok: boolean, message?: string, feedback?: {icon?:string,title?:string,body?:string} }>,
 *   onCancel?: () => void }} opts
 */
export function openItemUseRite(opts) {
    if (active) closeRite();
    const {
        kind = 'relic', student = {}, item = {}, question = '', effect = '', note = '',
        confirmLabel = 'Use it', cancelLabel = 'Keep it', blocked = '', blockedTitle = '',
        charmIcon = '', onConfirm = null, onCancel = null,
    } = opts || {};
    const look = riteLook({ kind, itemId: item.artId || item.id, tier: item.tier });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = `iur-overlay iur--${kind}${blocked ? ' is-blocked' : ''}`;
    overlay.style.setProperty('--iur-tone', look.tone);
    overlay.style.setProperty('--iur-deep', look.deep);
    overlay.innerHTML = `
        <div class="iur-card" role="dialog" aria-modal="true" aria-labelledby="iur-title" aria-describedby="iur-effect">
            <span class="iur-glow" aria-hidden="true"></span>
            <span class="iur-kicker">${esc(look.kicker)}</span>
            <div class="iur-stage">
                <span class="iur-rays" aria-hidden="true"></span>
                ${runesSvg()}
                <span class="iur-shock" aria-hidden="true"></span>
                <span class="iur-item">${itemArt(item, kind)}</span>
                ${charmIcon ? `<span class="iur-charm-orb" aria-hidden="true">${esc(charmIcon)}</span>` : ''}
                <span class="iur-result-medal" aria-hidden="true"></span>
                ${sparksHtml()}
            </div>
            <h2 id="iur-title" class="iur-title font-title">${esc(blocked ? (blockedTitle || 'Not just yet') : question)}</h2>
            ${whoHtml(student)}
            <p id="iur-effect" class="iur-effect">${esc(blocked || effect)}</p>
            ${note && !blocked ? `<p class="iur-note">${esc(note)}</p>` : ''}
            <p class="iur-error" role="alert" hidden></p>
            <div class="iur-actions">
                ${blocked
                    ? '<button type="button" class="iur-btn iur-btn--main" data-iur="close">Okay</button>'
                    : `<button type="button" class="iur-btn iur-btn--soft" data-iur="cancel">${esc(cancelLabel)}</button>
                       <button type="button" class="iur-btn iur-btn--main" data-iur="confirm"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>${esc(confirmLabel)}</span></button>`}
            </div>
            <span class="iur-wick" aria-hidden="true"></span>
        </div>`;
    document.body.appendChild(overlay);

    const card = overlay.querySelector('.iur-card');
    const title = overlay.querySelector('#iur-title');
    const effectEl = overlay.querySelector('#iur-effect');
    const noteEl = overlay.querySelector('.iur-note');
    const errorEl = overlay.querySelector('.iur-error');
    const actions = overlay.querySelector('.iur-actions');
    let phase = blocked ? 'blocked' : 'ask';

    const state = {
        overlay,
        previousFocus: document.activeElement,
        timer: 0,
        onKey: (e) => {
            if (e.key === 'Escape' && phase !== 'working') { e.preventDefault(); dismiss(); }
            if (e.key === 'Tab') {
                const focusables = [...card.querySelectorAll('button:not([disabled])')];
                if (!focusables.length) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        },
    };
    active = state;
    document.addEventListener('keydown', state.onKey, true);

    function dismiss() {
        if (phase === 'working') return;
        if (phase === 'ask') onCancel?.();
        closeRite();
    }

    function startWick() {
        if (reduced) return;
        card.classList.add('has-wick');
        card.style.setProperty('--iur-wick', `${AUTO_CLOSE_MS}ms`);
        state.timer = setTimeout(() => { if (active === state) closeRite(); }, AUTO_CLOSE_MS);
    }
    card.addEventListener('pointerenter', () => {
        if (phase !== 'done') return;
        clearTimeout(state.timer);
        card.classList.add('is-paused');
    });

    async function confirm() {
        if (phase !== 'ask' || !onConfirm) return;
        phase = 'working';
        overlay.classList.add('is-working');
        const btn = actions.querySelector('[data-iur="confirm"]');
        actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Calling the magic…</span>';
        const started = Date.now();
        let outcome;
        try {
            outcome = await onConfirm();
        } catch (error) {
            console.error(error);
            outcome = { ok: false, message: 'The magic fizzled out. Try again.' };
        }
        // let the circle spin up for a breath, so the reveal reads as earned
        const wait = reduced ? 0 : Math.max(0, 650 - (Date.now() - started));
        await new Promise((r) => setTimeout(r, wait));
        if (active !== state) return;
        overlay.classList.remove('is-working');

        if (!outcome?.ok) {
            phase = 'error';
            overlay.classList.add('is-error');
            title.textContent = 'Not this time';
            if (noteEl) noteEl.remove();
            errorEl.textContent = outcome?.message || 'The magic fizzled out. Try again.';
            errorEl.hidden = false;
            actions.innerHTML = '<button type="button" class="iur-btn iur-btn--main" data-iur="close">Close</button>';
            actions.querySelector('button')?.focus();
            return;
        }

        phase = 'done';
        const fb = outcome.feedback || {};
        overlay.querySelector('.iur-result-medal').textContent = fb.icon || charmIcon || item.icon || '✨';
        title.textContent = fb.title || 'The magic worked!';
        effectEl.textContent = fb.body || effect;
        if (noteEl) noteEl.remove();
        overlay.classList.add('is-done');
        actions.innerHTML = `<button type="button" class="iur-btn iur-btn--main" data-iur="close"><i class="fas fa-star" aria-hidden="true"></i><span>Wonderful!</span></button>`;
        actions.querySelector('button')?.focus({ preventScroll: true });
        startWick();
    }

    overlay.addEventListener('click', (e) => {
        const action = e.target.closest('[data-iur]')?.dataset.iur;
        if (action === 'confirm') confirm();
        else if (action === 'cancel' || action === 'close') dismiss();
        else if (e.target === overlay) dismiss();
    });

    requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        (actions.querySelector('[data-iur="confirm"]') || actions.querySelector('button'))?.focus({ preventScroll: true });
    });
    return { close: closeRite, firstName: firstName(student.name) };
}
