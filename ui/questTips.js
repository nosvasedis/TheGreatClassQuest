// App-wide tooltips: every `title` (and SVG <title>) becomes a custom card drawn to fit where it
// sits (a ledger tag in the Scholar's Scroll, a pennant in the Guild Hall, an ember in the Campfire…)
// instead of the browser's grey box. This file is the tiny always-on part: it lifts the title off
// the element before the browser can show it, keeps an accessible name, and wakes the card module
// (ui/questTipsCard.js + styles/quest_tips.css) on the first hover.
//   Mouse    → after a short pause (straight away while another tip is open).
//   Keyboard → on focus (keyboard focus only).
//   Touch    → press and hold.
// Opt out with data-gtip-off; pick a look with data-gtip-look="<look>" on the element or an ancestor.

const HOVER_DELAY = 320;
const HOLD_DELAY = 480;
const INTERACTIVE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL)$/;

let card = null;
let cardLoad = null;
let current = null;
let timer = 0;
let shownAt = 0;
let keyboard = false;

function loadCard() {
    cardLoad ??= import('./questTipsCard.js').then((m) => { card = m; return m; }).catch(() => { cardLoad = null; return null; });
    return cardLoad;
}

function svgTitleOf(el) {
    for (const child of el.children || []) if (child.tagName === 'title') return child;
    return null;
}

/** Text a screen reader would read inside el (skips aria-hidden icons and emoji). */
function spokenText(el) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.data.trim() && !n.parentElement?.closest('[aria-hidden="true"]')) return true;
    }
    return false;
}

/** Moves a title into data-gtip, giving unnamed elements the text as their accessible name. */
function harvest(el) {
    let text = '';
    if (el.hasAttribute?.('title')) {
        text = el.getAttribute('title') || '';
        el.removeAttribute('title');
    } else {
        const t = svgTitleOf(el);
        if (t) { text = t.textContent || ''; t.remove(); }
    }
    text = text.trim();
    if (!text) return;
    el.dataset.gtip = text;
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
    const named = spokenText(el) || el.getAttribute('alt') || el.querySelector?.('img[alt]:not([alt=""])');
    if (!named || el.tagName === 'svg' || el.getAttribute('role') === 'img') el.setAttribute('aria-label', text);
    else if (INTERACTIVE.test(el.tagName) && !el.hasAttribute('aria-description')) el.setAttribute('aria-description', text);
}

function tipTarget(node) {
    for (let el = node; el && el.nodeType === 1; el = el.parentNode) {
        if (el.hasAttribute('data-gtip-off')) return null;
        if (el.hasAttribute('title') || (el instanceof SVGElement && svgTitleOf(el))) harvest(el);
        if (el.dataset?.gtip) return el;
        // Another tip system owns this element (Students tab, Award Stars roll).
        if (el.hasAttribute('data-tip') || el.hasAttribute('data-tip-title') || el.hasAttribute('data-tip-name') || el.hasAttribute('data-tip-build')) return null;
    }
    return null;
}

let pending = null;
function show(el) {
    if (!el.isConnected || !el.dataset.gtip) return;
    pending = el;
    loadCard().then((m) => {
        if (!m || !el.isConnected || pending !== el) return;
        pending = null;
        current = el;
        shownAt = Date.now();
        m.showQuestTip(el);
    });
}

function hide() {
    clearTimeout(timer);
    pending = null;
    if (!current) return;
    current = null;
    card?.hideQuestTip();
}

function schedule(el, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => show(el), card?.isQuestTipOpen() ? 40 : delay);
}

function onOver(e) {
    if (e.pointerType === 'touch') return;
    const el = tipTarget(e.target);
    if (!el) { if (current && !current.contains(e.target)) hide(); return; }
    if (el === current) { clearTimeout(timer); return; }
    if (current) hide();
    if (!card) loadCard();
    schedule(el, HOVER_DELAY);
}

function onOut(e) {
    if (e.pointerType === 'touch') return;
    const to = e.relatedTarget;
    const from = current || e.target.closest?.('[data-gtip]');
    if (from && to && from.contains(to)) return;
    if (!current) clearTimeout(timer);
    else if (!to || !current.contains(to)) hide();
}

let holdAt = null;
function onDown(e) {
    keyboard = false;
    if (e.pointerType !== 'touch') { hide(); return; }
    // A tap elsewhere closes an open tip; a hold on a titled element opens one.
    if (current && Date.now() - shownAt > 150) hide();
    const el = tipTarget(e.target);
    if (!el) return;
    holdAt = { x: e.clientX, y: e.clientY };
    if (!card) loadCard();
    clearTimeout(timer);
    timer = setTimeout(() => {
        show(el);
        timer = setTimeout(hide, HOLD_DELAY + 2800);
    }, HOLD_DELAY);
}

function onMove(e) {
    if (!holdAt || e.pointerType !== 'touch') return;
    if (Math.abs(e.clientX - holdAt.x) > 10 || Math.abs(e.clientY - holdAt.y) > 10) { holdAt = null; clearTimeout(timer); }
}

let swallowUntil = 0;
function onUp(e) {
    if (e.pointerType !== 'touch') return;
    // The lift that ends a hold only reads the tip; it must not press the button too.
    if (holdAt && (current || pending)) swallowUntil = Date.now() + 700;
    holdAt = null;
    if (!current) clearTimeout(timer);
}

function onClick(e) {
    if (Date.now() > swallowUntil) return;
    swallowUntil = 0;
    e.preventDefault();
    e.stopImmediatePropagation();
}

function onFocus(e) {
    if (!keyboard) return;
    const el = tipTarget(e.target);
    if (el && el === e.target) show(el);
}

export function setupQuestTips() {
    if (typeof document === 'undefined' || window.__gcqQuestTips) return;
    window.__gcqQuestTips = true;
    const opts = { capture: true, passive: true };
    document.addEventListener('pointerover', onOver, opts);
    document.addEventListener('pointerout', onOut, opts);
    document.addEventListener('pointerdown', onDown, opts);
    document.addEventListener('pointermove', onMove, opts);
    document.addEventListener('pointerup', onUp, opts);
    document.addEventListener('pointercancel', onUp, opts);
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', () => { if (keyboard) hide(); }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && current) hide();
        else if (e.key === 'Tab') keyboard = true;
    }, true);
    window.addEventListener('scroll', (e) => {
        if (current && (e.target === document || e.target.contains?.(current))) hide();
    }, opts);
    window.addEventListener('blur', hide);
    // A long press on a titled element opens the tip, not the phone's menu.
    document.addEventListener('contextmenu', (e) => { if (current && Date.now() - shownAt < 1500) e.preventDefault(); }, true);
    // Code that sets el.title later (button states) gets the same treatment, and an open tip follows it.
    new MutationObserver((list) => {
        for (const m of list) {
            const el = m.target;
            if (!el.hasAttribute?.('title') || el.closest('[data-gtip-off]')) continue;
            harvest(el);
            if (el === current) card?.showQuestTip(el);
        }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['title'] });
}

/** For code that needs the old title text of an element (labels for the Quest Remote). */
export function questTipText(el) {
    return el?.getAttribute?.('title') || el?.dataset?.gtip || '';
}
