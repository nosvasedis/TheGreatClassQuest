// Students tab tooltips: one small card for every roster tool and banner button that carries
// data-tip-title / data-tip, instead of the browser's title box.
//   Mouse    → shows after a short pause (straight away while another tip is open).
//   Keyboard → shows on focus.
//   Touch    → press and hold; the tap that ends the hold does not open the tool.
// The card takes its colour from the button's --tool-ink. Styles: .roster-tip in styles/student_roster.css.
import { escapeHtml } from '../../utils/html.mjs';

const HOVER_DELAY = 260;
const HOLD_DELAY = 450;
const HOLD_LINGER = 2600;
const TIP_SELECTOR = '[data-tip-title], [data-tip]';
const boundRoots = new WeakSet();

let tipEl = null;
let tipFor = null;
let pendingFor = null;
let showTimer = 0;
let lingerTimer = 0;
let holdTimer = 0;
let holdStart = null;
let swallowClick = false;
let documentBound = false;

function ensureTip() {
    if (tipEl?.isConnected) return tipEl;
    tipEl = document.createElement('div');
    tipEl.id = 'roster-tip';
    tipEl.className = 'roster-tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
}

function placeTip(tip, target) {
    const r = target.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const below = r.top - h - gap < margin;
    const top = below ? r.bottom + gap : r.top - h - gap;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, margin), window.innerWidth - w - margin);
    tip.classList.toggle('is-below', below);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.setProperty('--tip-arrow-x', `${Math.round(r.left + r.width / 2 - left)}px`);
}

function showTip(target) {
    clearTimeout(showTimer);
    clearTimeout(lingerTimer);
    pendingFor = null;
    if (!target?.isConnected) return;
    const { tipTitle = '', tip = '' } = target.dataset;
    if (!tipTitle && !tip) return;
    const el = ensureTip();
    if (tipFor && tipFor !== target) tipFor.removeAttribute('aria-describedby');
    el.innerHTML = `${tipTitle ? `<strong class="roster-tip__title">${escapeHtml(tipTitle)}</strong>` : ''}`
        + `${tip ? `<span class="roster-tip__text">${escapeHtml(tip)}</span>` : ''}`;
    const ink = getComputedStyle(target).getPropertyValue('--tool-ink').trim();
    if (ink) el.style.setProperty('--tip-accent', ink);
    else el.style.removeProperty('--tip-accent');
    tipFor = target;
    target.setAttribute('aria-describedby', el.id);
    placeTip(el, target);
    el.classList.add('is-on');
}

function hideTip() {
    clearTimeout(showTimer);
    pendingFor = null;
    clearTimeout(lingerTimer);
    tipFor?.removeAttribute('aria-describedby');
    tipFor = null;
    tipEl?.classList.remove('is-on');
}

function tipTarget(event, root) {
    const target = event.target?.closest?.(TIP_SELECTOR);
    return target && root.contains(target) ? target : null;
}

function cancelHold() {
    clearTimeout(holdTimer);
    holdStart = null;
}

function bindDocument() {
    if (documentBound) return;
    documentBound = true;
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTip(); });
    window.addEventListener('scroll', hideTip, { capture: true, passive: true });
    window.addEventListener('resize', hideTip, { passive: true });
}

/** Wire the tooltips for everything with data-tip-title / data-tip inside root. Safe to call on every render. */
export function bindRosterTips(root) {
    if (!root || boundRoots.has(root)) return;
    boundRoots.add(root);
    bindDocument();

    root.addEventListener('pointerover', (event) => {
        if (event.pointerType === 'touch') return;
        const target = tipTarget(event, root);
        if (!target || target === tipFor || target === pendingFor) return;
        clearTimeout(showTimer);
        if (tipEl?.classList.contains('is-on')) showTip(target);
        else {
            pendingFor = target;
            showTimer = setTimeout(() => showTip(target), HOVER_DELAY);
        }
    });
    root.addEventListener('pointerout', (event) => {
        if (event.pointerType === 'touch') return;
        const target = tipTarget(event, root);
        if (!target || target.contains(event.relatedTarget)) return;
        clearTimeout(showTimer);
        pendingFor = null;
        if (target === tipFor) hideTip();
    });

    root.addEventListener('focusin', (event) => {
        const target = tipTarget(event, root);
        if (!target) return;
        let keyboard = true;
        try { keyboard = target.matches(':focus-visible'); } catch { /* older browsers: show it */ }
        if (keyboard) showTip(target);
    });
    root.addEventListener('focusout', (event) => {
        if (tipTarget(event, root) === tipFor) hideTip();
    });

    // Touch: press and hold to read the tip.
    root.addEventListener('pointerdown', (event) => {
        swallowClick = false;
        cancelHold();
        if (event.pointerType !== 'touch') { hideTip(); return; }
        const target = tipTarget(event, root);
        if (!target) { hideTip(); return; }
        holdStart = { x: event.clientX, y: event.clientY };
        holdTimer = setTimeout(() => {
            holdStart = null;
            swallowClick = true;
            showTip(target);
        }, HOLD_DELAY);
    });
    root.addEventListener('pointermove', (event) => {
        if (!holdStart) return;
        if (Math.abs(event.clientX - holdStart.x) + Math.abs(event.clientY - holdStart.y) > 12) cancelHold();
    });
    root.addEventListener('pointerup', () => {
        cancelHold();
        if (swallowClick && tipFor) lingerTimer = setTimeout(hideTip, HOLD_LINGER);
    });
    root.addEventListener('pointercancel', cancelHold);
    root.addEventListener('contextmenu', (event) => {
        if (swallowClick && tipTarget(event, root)) event.preventDefault();
    });
    // Capture phase: runs before the roster's own click listener, so a hold never opens the tool.
    root.addEventListener('click', (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.preventDefault();
        event.stopPropagation();
    }, true);
}
