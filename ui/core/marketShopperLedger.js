// /ui/core/marketShopperLedger.js
// The till on the Market counter: one brass-rimmed plaque holding the shopper (face, name)
// and their purse, plus the Shoppers' Ledger that unfolds from it to pick who is buying,
// and the shopper's Satchel hung beside it (opens the Satchel modal for that student).
// The same ledger also unfolds above the floating keeper (bottom-left, once the counter has
// scrolled away), so a teacher deep in the shelves can switch shopper without scrolling up.
// The hidden #shop-student-select stays the source of truth (listeners, purchases and the
// floating keeper all read it); this module only draws and drives it.

import * as state from '../../state.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import '../../styles/market_till.css';

export const SHOPPER_PLACEHOLDER = 'Choose your adventurer…';
const TILL_PLACEHOLDER_HTML = `<span class="mm-till__ph-long">${SHOPPER_PLACEHOLDER}</span><span class="mm-till__ph-short">Tap to choose</span>`;
const SEARCH_FROM = 9; // a search line appears once the ledger is this long

let ledgerStudents = [];
let bound = false;

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const el = (id) => document.getElementById(id);

function initials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
        .map(part => part[0].toUpperCase()).join('') || '?';
}

function faceHtml(student, cls = 'mm-face') {
    if (!student) return `<span class="${cls} ${cls}--empty" aria-hidden="true"><i class="fas fa-hat-wizard"></i></span>`;
    if (student.avatar) {
        return `<span class="${cls} ${cls}--photo" aria-hidden="true"><img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`;
    }
    const tone = (String(student.name || '').charCodeAt(0) || 0) % 6;
    return `<span class="${cls} ${cls}--tone-${tone}" aria-hidden="true">${esc(initials(student.name))}</span>`;
}

function goldOf(studentId) {
    const scoreData = (state.get('allStudentScores') || []).find(s => s.id === studentId);
    return getLiveYearGoldFromAppState(scoreData, state);
}

/* Two places the ledger unfolds from: the till on the counter, and the floating keeper. */
const HOSTS = {
    till: {
        panel: () => el('shop-shopper-listbox'),
        trigger: () => el('shop-shopper-trigger'),
        root: () => el('shop-shopper-root'),
        shell: () => el('shop-till')
    },
    keeper: {
        panel: () => el('shop-keeper-ledger'),
        trigger: () => el('shop-keeper-float')?.querySelector('.mm-keeper-float__keeper'),
        root: () => el('shop-keeper-float'),
        shell: () => el('shop-keeper-float')
    }
};

let openHost = '';

function isOpen(host) {
    return host ? openHost === host : !!openHost;
}

/** Which ledger an element sits in ('' when neither). */
function hostOf(node) {
    if (!node) return '';
    return Object.keys(HOSTS).find(key => HOSTS[key].panel()?.contains(node)) || '';
}

/** The till shows who is shopping: their face, name, and whether the purse is live. */
export function syncShopperTill() {
    const sel = el('shop-student-select');
    const display = el('shop-shopper-display');
    const face = el('shop-shopper-face');
    const till = el('shop-till');
    if (!sel) return;
    const student = sel.value ? ledgerStudents.find(s => s.id === sel.value) : null;
    if (display) {
        // phones show the first name only; the full name stays for wider tills
        const [first, ...rest] = String(student?.name || '').trim().split(/\s+/);
        display.innerHTML = student
            ? `${esc(first)}${rest.length ? `<span class="mm-till__surname"> ${esc(rest.join(' '))}</span>` : ''}`
            : TILL_PLACEHOLDER_HTML;
    }
    if (face) face.innerHTML = faceHtml(student, 'mm-face');
    till?.classList.toggle('has-shopper', !!student);
    const trigger = el('shop-shopper-trigger');
    trigger?.setAttribute('aria-label', student
        ? `Shopper: ${student.name}. Change shopper`
        : 'Choose a shopper');
    syncSatchelButton();
}

/* ── The Satchel beside the till ─────────────────────────────────────────── */

let satchelShown = { id: '', count: -1 };

function satchelCount(studentId) {
    const inventory = (state.get('allStudentScores') || []).find(s => s.id === studentId)?.inventory;
    // same count as the Satchel modal's roster (summarizeSatchel): named entries only
    return Array.isArray(inventory) ? inventory.filter(item => item && item.name).length : 0;
}

/** The Satchel button shows whose bag it is and how much is inside; a purchase drops into it. */
export function syncSatchelButton() {
    const btn = el('shop-satchel-btn');
    if (!btn) return;
    const sel = el('shop-student-select');
    const student = sel?.value ? ledgerStudents.find(s => s.id === sel.value) : null;
    const countEl = el('shop-satchel-count');
    const badge = el('shop-satchel-badge');
    btn.classList.toggle('has-shopper', !!student);
    if (!student) {
        satchelShown = { id: '', count: -1 };
        if (countEl) countEl.textContent = 'No shopper yet';
        if (badge) badge.hidden = true;
        btn.dataset.tooltip = 'Choose a shopper first';
        btn.setAttribute('aria-label', 'Choose a shopper to open their Satchel');
        btn.classList.remove('is-filling');
        return;
    }
    const count = satchelCount(student.id);
    const first = String(student.name || '').trim().split(/\s+/)[0] || 'Hero';
    const items = `${count} item${count === 1 ? '' : 's'}`;
    if (countEl) countEl.textContent = count ? items : 'Empty';
    if (badge) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
    }
    btn.dataset.tooltip = `Open ${first}'s Satchel`;
    btn.setAttribute('aria-label', `Open ${student.name}'s Satchel, ${items}`);
    // a fresh buy for the same shopper: the flap lifts and the ware drops in
    const filled = satchelShown.id === student.id && count > satchelShown.count && satchelShown.count >= 0;
    satchelShown = { id: student.id, count };
    if (filled && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        btn.classList.remove('is-filling');
        void btn.offsetWidth;
        btn.classList.add('is-filling');
        setTimeout(() => btn.classList.remove('is-filling'), 1400);
    }
}

function openShopperSatchel() {
    const studentId = el('shop-student-select')?.value || '';
    if (!studentId) {
        setOpen(true);
        return;
    }
    import('../modals/index.js')
        .then((m) => m.openTrophyRoomModal(studentId))
        .catch((err) => console.warn('[market] Satchel failed to open', err));
}

function optionHtml(student, { selected, hero, gold, index }) {
    const [first, ...rest] = String(student.name || '').trim().split(/\s+/);
    return `
        <button type="button" role="option" class="mm-ledger__entry${selected ? ' is-selected' : ''}${hero ? ' is-hero' : ''}"
            data-value="${esc(student.id)}" data-name="${esc(fold(student.name))}"
            aria-selected="${selected ? 'true' : 'false'}" tabindex="-1" style="--i:${Math.min(index, 14)}">
            <span class="mm-ledger__face-wrap">
                ${faceHtml(student, 'mm-face')}
                ${hero ? '<span class="mm-ledger__crown" title="Hero of the Day" aria-hidden="true">👑</span>' : ''}
            </span>
            <span class="mm-ledger__who">
                <span class="mm-ledger__first">${esc(first || '')}</span>
                ${rest.length ? `<span class="mm-ledger__last">${esc(rest.join(' '))}</span>` : ''}
            </span>
            <span class="mm-ledger__coins" aria-label="${gold} gold">
                <span aria-hidden="true">🪙</span>${gold}
            </span>
            ${selected ? '<span class="mm-ledger__tag" aria-hidden="true">At the till</span>' : ''}
        </button>`;
}

function renderLedger(host = 'till') {
    const panel = HOSTS[host].panel();
    const sel = el('shop-student-select');
    if (!panel || !sel) return;
    const heroId = state.get('reigningHero')?.id || '';
    const count = ledgerStudents.length;
    const searchable = count >= SEARCH_FROM;

    const entries = ledgerStudents.map((s, index) => optionHtml(s, {
        index,
        selected: s.id === sel.value,
        hero: s.id === heroId,
        gold: goldOf(s.id)
    })).join('');

    panel.innerHTML = `
        <span class="mm-ledger__tail" aria-hidden="true"></span>
        <div class="mm-ledger__head">
            <span class="mm-ledger__quill" aria-hidden="true"><i class="fas fa-feather-alt"></i></span>
            <div class="mm-ledger__titles">
                <span class="mm-ledger__kicker">The Shoppers' Ledger</span>
                <span class="mm-ledger__title" id="shop-ledger-title-${host}">${host === 'keeper' ? 'Who\'s shopping next?' : 'Who\'s at the counter?'}</span>
            </div>
            <span class="mm-ledger__count">${count} ${count === 1 ? 'adventurer' : 'adventurers'}</span>
        </div>
        ${searchable ? `
        <label class="mm-ledger__search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <span class="sr-only">Find a shopper</span>
            <input type="search" class="mm-ledger__find" autocomplete="off" spellcheck="false" placeholder="Find a name…">
        </label>` : ''}
        ${count
            ? `<div class="mm-ledger__page" role="listbox" aria-labelledby="shop-ledger-title-${host}">${entries}</div>
               <p class="mm-ledger__none" hidden>No adventurer by that name.</p>`
            : '<p class="mm-ledger__none">No adventurers in this class yet.</p>'}
        ${sel.value ? `
        <div class="mm-ledger__foot">
            <button type="button" class="mm-ledger__clear" data-ledger-clear>
                <i class="fas fa-door-open" aria-hidden="true"></i> Nobody, close the till
            </button>
        </div>` : ''}`;
}

function entries(host = openHost || 'till') {
    return [...(HOSTS[host]?.panel()?.querySelectorAll('.mm-ledger__entry:not([hidden])') || [])];
}

function searchOf(host) {
    return HOSTS[host]?.panel()?.querySelector('.mm-ledger__find') || null;
}

function focusEntry(entry) {
    if (!entry) return;
    entries(hostOf(entry)).forEach(e => e.setAttribute('tabindex', e === entry ? '0' : '-1'));
    entry.focus({ preventScroll: false });
}

function filterLedger(panel, query) {
    const q = fold(query).trim();
    let shown = 0;
    panel?.querySelectorAll('.mm-ledger__entry').forEach(entry => {
        const hit = !q || entry.dataset.name.split(/\s+/).some(part => part.startsWith(q)) || entry.dataset.name.includes(q);
        entry.hidden = !hit;
        if (hit) shown++;
    });
    const none = panel?.querySelector('.mm-ledger__none');
    if (none && ledgerStudents.length) none.hidden = shown > 0;
}

/** Size the ledger to the window and point its tail at the shopper's face. */
function placeLedger(panel) {
    const till = el('shop-till');
    const face = el('shop-shopper-face');
    if (!till) return;
    const box = till.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(576, window.innerWidth - gutter * 2);
    let left = box.width - width; // right edges line up with the till
    if (box.left + left < gutter) left += gutter - (box.left + left);
    panel.style.width = `${Math.round(width)}px`;
    panel.style.left = `${Math.round(left)}px`;
    const faceBox = face?.getBoundingClientRect();
    const tail = faceBox ? faceBox.left + faceBox.width / 2 - box.left - left : 32;
    panel.style.setProperty('--tail-x', `${Math.round(Math.max(22, Math.min(width - 22, tail)))}px`);
}

/**
 * Above the floating keeper: the ledger opens upward from his corner, as wide as the shelf
 * allows and no taller than the room between him and the top of the page, tail at his hat.
 */
function placeKeeperLedger(panel) {
    const float = el('shop-keeper-float');
    const art = float?.querySelector('.mm-keeper-float__keeper');
    if (!float) return;
    const box = float.getBoundingClientRect();
    const scrollerTop = float.closest('main')?.getBoundingClientRect().top ?? 0;
    const gutter = 12;
    const room = parseFloat(getComputedStyle(float).getPropertyValue('--mmf-room')) || (window.innerWidth - gutter * 2);
    const width = Math.max(220, Math.min(576, room, window.innerWidth - box.left - gutter));
    panel.style.width = `${Math.round(width)}px`;
    panel.style.left = '0px';
    const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--keeper-gap')) || 10;
    const tallest = box.top - Math.max(scrollerTop, 0) - gap - gutter;
    panel.style.setProperty('--ledger-max', `${Math.round(Math.max(180, tallest))}px`);
    const artBox = art?.getBoundingClientRect();
    const tail = artBox ? artBox.left + artBox.width * 0.42 - box.left : 48;
    panel.style.setProperty('--tail-x', `${Math.round(Math.max(22, Math.min(width - 22, tail)))}px`);
}

function setOpen(open, { focus = true, host = openHost || 'till' } = {}) {
    // only one ledger at a time: opening one folds the other away
    if (open && openHost && openHost !== host) setOpen(false, { focus: false, host: openHost });
    const parts = HOSTS[host];
    const trigger = parts?.trigger();
    const panel = parts?.panel();
    if (!trigger || !panel) return;
    if (open) {
        renderLedger(host);
        if (host === 'keeper') placeKeeperLedger(panel);
        else placeLedger(panel);
    }
    if (open) openHost = host;
    else if (openHost === host) openHost = '';
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    panel.inert = !open;
    parts.shell()?.classList.toggle('is-ledger-open', open);
    if (!open || !focus) return;
    const touch = window.matchMedia?.('(hover: none)').matches;
    const search = searchOf(host);
    if (search && !touch) search.focus({ preventScroll: true });
    else {
        const current = panel.querySelector('.mm-ledger__entry.is-selected') || entries(host)[0];
        if (current) {
            entries(host).forEach(e => e.setAttribute('tabindex', e === current ? '0' : '-1'));
            if (!touch) current.focus({ preventScroll: true });
        }
    }
    // keep the open ledger on screen (the counter can sit near the bottom on short windows);
    // the keeper's ledger opens upward inside the window, and scrolling would send him home
    if (host !== 'till') return;
    requestAnimationFrame(() => {
        const r = panel.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

export function closeShopperLedger() {
    if (isOpen()) setOpen(false, { host: openHost });
}

/** The floating keeper went back to the counter: his ledger folds away with him. */
export function closeKeeperLedger() {
    if (isOpen('keeper')) setOpen(false, { focus: false, host: 'keeper' });
}

function pick(value, onPick, host = openHost || 'till') {
    const sel = el('shop-student-select');
    if (!sel) return;
    const changed = sel.value !== value;
    sel.value = value;
    syncShopperTill();
    setOpen(false, { host });
    HOSTS[host].trigger()?.focus({ preventScroll: true });
    if (changed) {
        const till = el('shop-till');
        if (till && value && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            till.classList.remove('is-greeting');
            void till.offsetWidth;
            till.classList.add('is-greeting');
            setTimeout(() => till.classList.remove('is-greeting'), 900);
        }
        if (host === 'keeper') greetFromKeeper();
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        onPick?.(value);
    }
}

/** Keeps the hidden native select and the ledger in step with this class's students. */
export function populateShopStudentPicker(validStudents) {
    const sel = el('shop-student-select');
    if (!sel) return;
    const previousValue = sel.value;
    ledgerStudents = (validStudents || []).map(s => ({ id: s.id, name: s.name || '', avatar: s.avatar || '' }));

    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = SHOPPER_PLACEHOLDER;
    sel.appendChild(opt0);
    ledgerStudents.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.name;
        sel.appendChild(o);
    });

    const shouldRestore = previousValue && ledgerStudents.some(s => s.id === previousValue);
    sel.value = shouldRestore ? previousValue : '';
    syncShopperTill();
    if (openHost) setOpen(false, { focus: false, host: openHost });
}

/** A shopper picked from the keeper's ledger: his purse plank gives a little bump. */
function greetFromKeeper() {
    const purse = el('shop-keeper-float')?.querySelector('.mm-keeper-float__purse');
    if (!purse || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    purse.classList.remove('is-bumped');
    void purse.offsetWidth;
    purse.classList.add('is-bumped');
}

export function bindShopperLedger({ onPick } = {}) {
    if (bound) return;
    bound = true;

    document.body.addEventListener('click', (e) => {
        const trigger = el('shop-shopper-trigger');
        if (!trigger) return;

        // the Satchel beside the till (with nobody at the till it unfolds the ledger)
        if (e.target.closest('#shop-satchel-btn')) {
            e.preventDefault();
            if (isOpen()) setOpen(false, { focus: false, host: openHost });
            openShopperSatchel();
            return;
        }

        // the whole till opens the ledger: the shopper half, the seam, or the purse
        if (trigger.contains(e.target) || e.target.closest('.mm-till__purse, .mm-till__seam')) {
            e.preventDefault();
            setOpen(!isOpen('till'), { host: 'till' });
            return;
        }
        // the floating keeper down the shelves opens the same ledger above his corner
        const keeperBtn = HOSTS.keeper.trigger();
        if (keeperBtn?.contains(e.target)) {
            e.preventDefault();
            setOpen(!isOpen('keeper'), { host: 'keeper' });
            return;
        }
        const inside = hostOf(e.target);
        if (inside) {
            const entry = e.target.closest('.mm-ledger__entry');
            if (entry) pick(entry.dataset.value ?? '', onPick, inside);
            else if (e.target.closest('[data-ledger-clear]')) pick('', onPick, inside);
            return;
        }
        if (isOpen() && !HOSTS[openHost].root()?.contains(e.target)) setOpen(false, { host: openHost });
    });

    // purchases, relic uses and live score updates change what the Satchel holds
    state.subscribe(['allStudentScores'], () => syncSatchelButton());

    window.addEventListener('resize', () => {
        if (isOpen('till')) placeLedger(HOSTS.till.panel());
        if (isOpen('keeper')) placeKeeperLedger(HOSTS.keeper.panel());
    }, { passive: true });

    document.body.addEventListener('input', (e) => {
        if (e.target?.classList?.contains('mm-ledger__find')) filterLedger(e.target.closest('.mm-ledger'), e.target.value);
    });

    document.body.addEventListener('keydown', (e) => {
        if (!isOpen()) return;
        const host = openHost;
        const panel = HOSTS[host].panel();
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false, { host });
            HOSTS[host].trigger()?.focus();
            return;
        }
        if (!panel?.contains(document.activeElement)) return;
        const list = entries(host);
        if (!list.length) return;
        const search = searchOf(host);
        const inSearch = document.activeElement === search;
        const at = list.indexOf(document.activeElement);
        const cols = Math.max(1, Math.round((panel.querySelector('.mm-ledger__page')?.clientWidth || 1)
            / (list[0].getBoundingClientRect().width || 1)));
        let next = null;
        if (inSearch) {
            if (e.key === 'ArrowDown') next = list[0];
            if (e.key === 'Enter' && list.length) { e.preventDefault(); pick(list[0].dataset.value ?? '', onPick, host); return; }
        } else if (at >= 0) {
            if (e.key === 'ArrowRight') next = list[Math.min(list.length - 1, at + 1)];
            if (e.key === 'ArrowLeft') next = list[Math.max(0, at - 1)];
            if (e.key === 'ArrowDown') next = list[Math.min(list.length - 1, at + cols)];
            if (e.key === 'ArrowUp') {
                if (at - cols < 0 && search) { e.preventDefault(); search.focus(); return; }
                next = list[Math.max(0, at - cols)];
            }
            if (e.key === 'Home') next = list[0];
            if (e.key === 'End') next = list[list.length - 1];
        }
        if (next) {
            e.preventDefault();
            focusEntry(next);
        }
    });
}
