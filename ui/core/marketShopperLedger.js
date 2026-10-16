// /ui/core/marketShopperLedger.js
// The till on the Market counter: one brass-rimmed plaque holding the shopper (face, name)
// and their purse, plus the Shoppers' Ledger that unfolds from it to pick who is buying.
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

function isOpen() {
    return !!el('shop-shopper-listbox')?.classList.contains('is-open');
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

function renderLedger() {
    const panel = el('shop-shopper-listbox');
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
                <span class="mm-ledger__title" id="shop-ledger-title">Who's at the counter?</span>
            </div>
            <span class="mm-ledger__count">${count} ${count === 1 ? 'adventurer' : 'adventurers'}</span>
        </div>
        ${searchable ? `
        <label class="mm-ledger__search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <span class="sr-only">Find a shopper</span>
            <input type="search" id="shop-ledger-search" autocomplete="off" spellcheck="false" placeholder="Find a name…">
        </label>` : ''}
        ${count
            ? `<div class="mm-ledger__page" role="listbox" id="shop-ledger-list" aria-labelledby="shop-ledger-title">${entries}</div>
               <p class="mm-ledger__none" hidden>No adventurer by that name.</p>`
            : '<p class="mm-ledger__none">No adventurers in this class yet.</p>'}
        ${sel.value ? `
        <div class="mm-ledger__foot">
            <button type="button" class="mm-ledger__clear" data-ledger-clear>
                <i class="fas fa-door-open" aria-hidden="true"></i> Nobody, close the till
            </button>
        </div>` : ''}`;
}

function entries() {
    return [...(el('shop-shopper-listbox')?.querySelectorAll('.mm-ledger__entry:not([hidden])') || [])];
}

function focusEntry(entry) {
    if (!entry) return;
    entries().forEach(e => e.setAttribute('tabindex', e === entry ? '0' : '-1'));
    entry.focus({ preventScroll: false });
}

function filterLedger(query) {
    const q = fold(query).trim();
    let shown = 0;
    el('shop-shopper-listbox')?.querySelectorAll('.mm-ledger__entry').forEach(entry => {
        const hit = !q || entry.dataset.name.split(/\s+/).some(part => part.startsWith(q)) || entry.dataset.name.includes(q);
        entry.hidden = !hit;
        if (hit) shown++;
    });
    const none = el('shop-shopper-listbox')?.querySelector('.mm-ledger__none');
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

function setOpen(open, { focus = true } = {}) {
    const trigger = el('shop-shopper-trigger');
    const panel = el('shop-shopper-listbox');
    const till = el('shop-till');
    if (!trigger || !panel) return;
    if (open) {
        renderLedger();
        placeLedger(panel);
    }
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    panel.inert = !open;
    till?.classList.toggle('is-ledger-open', open);
    if (!open || !focus) return;
    const touch = window.matchMedia?.('(hover: none)').matches;
    const search = el('shop-ledger-search');
    if (search && !touch) search.focus({ preventScroll: true });
    else {
        const current = panel.querySelector('.mm-ledger__entry.is-selected') || entries()[0];
        if (current) {
            entries().forEach(e => e.setAttribute('tabindex', e === current ? '0' : '-1'));
            if (!touch) current.focus({ preventScroll: true });
        }
    }
    // keep the open ledger on screen (the counter can sit near the bottom on short windows)
    requestAnimationFrame(() => {
        const r = panel.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

export function closeShopperLedger() {
    if (isOpen()) setOpen(false);
}

function pick(value, onPick) {
    const sel = el('shop-student-select');
    if (!sel) return;
    const changed = sel.value !== value;
    sel.value = value;
    syncShopperTill();
    setOpen(false);
    el('shop-shopper-trigger')?.focus({ preventScroll: true });
    if (changed) {
        const till = el('shop-till');
        if (till && value && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            till.classList.remove('is-greeting');
            void till.offsetWidth;
            till.classList.add('is-greeting');
            setTimeout(() => till.classList.remove('is-greeting'), 900);
        }
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
    setOpen(false, { focus: false });
}

export function bindShopperLedger({ onPick } = {}) {
    if (bound) return;
    bound = true;

    document.body.addEventListener('click', (e) => {
        const root = el('shop-shopper-root');
        const trigger = el('shop-shopper-trigger');
        const panel = el('shop-shopper-listbox');
        if (!root || !trigger || !panel) return;

        // the whole till opens the ledger: the shopper half, the seam, or the purse
        if (trigger.contains(e.target) || e.target.closest('.mm-till__purse, .mm-till__seam')) {
            e.preventDefault();
            setOpen(!isOpen());
            return;
        }
        if (panel.contains(e.target)) {
            const entry = e.target.closest('.mm-ledger__entry');
            if (entry) pick(entry.dataset.value ?? '', onPick);
            else if (e.target.closest('[data-ledger-clear]')) pick('', onPick);
            return;
        }
        if (isOpen() && !root.contains(e.target)) setOpen(false);
    });

    window.addEventListener('resize', () => {
        if (isOpen()) placeLedger(el('shop-shopper-listbox'));
    }, { passive: true });

    document.body.addEventListener('input', (e) => {
        if (e.target?.id === 'shop-ledger-search') filterLedger(e.target.value);
    });

    document.body.addEventListener('keydown', (e) => {
        if (!isOpen()) return;
        const panel = el('shop-shopper-listbox');
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            el('shop-shopper-trigger')?.focus();
            return;
        }
        if (!panel?.contains(document.activeElement)) return;
        const list = entries();
        if (!list.length) return;
        const inSearch = document.activeElement?.id === 'shop-ledger-search';
        const at = list.indexOf(document.activeElement);
        const cols = Math.max(1, Math.round((panel.querySelector('.mm-ledger__page')?.clientWidth || 1)
            / (list[0].getBoundingClientRect().width || 1)));
        let next = null;
        if (inSearch) {
            if (e.key === 'ArrowDown') next = list[0];
            if (e.key === 'Enter' && list.length) { e.preventDefault(); pick(list[0].dataset.value ?? '', onPick); return; }
        } else if (at >= 0) {
            if (e.key === 'ArrowRight') next = list[Math.min(list.length - 1, at + 1)];
            if (e.key === 'ArrowLeft') next = list[Math.max(0, at - 1)];
            if (e.key === 'ArrowDown') next = list[Math.min(list.length - 1, at + cols)];
            if (e.key === 'ArrowUp') {
                if (at - cols < 0 && el('shop-ledger-search')) { e.preventDefault(); el('shop-ledger-search').focus(); return; }
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
