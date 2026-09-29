// Hero's Boon modal: the gift bridge (sponsor → heart → receiver on a cloud), the sponsor
// tiles and the "boons today" pips. Styles: styles/boons.css (.hb-*).
// The hidden native <select id="boon-sender-select"> stays the source of truth:
// picking a tile sets its value and dispatches 'change', so existing listeners keep working.

import { buildAwardCloudSvg } from '../features/awardCloudCard.mjs';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STATUS_ORDER = { free: 0, ready: 1, locked: 2 };
const SEARCH_THRESHOLD = 12;

/** "+½", "+1", "+1½" for the star gift. */
export function formatBoonStars(value) {
    const n = Math.round((Number(value) || 0) * 2) / 2;
    const whole = Math.floor(n);
    const half = n - whole >= 0.5 ? '½' : '';
    return `+${whole ? whole : ''}${half || (whole ? '' : '0')}`;
}

function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || String(name || '');
}

function faceHtml(person, cls) {
    if (person.avatar) return `<img src="${escapeHtml(person.avatar)}" alt="" class="${cls}" loading="lazy" decoding="async">`;
    return `<span class="${cls} ${cls}--initial">${escapeHtml(String(person.name || '?').charAt(0).toUpperCase())}</span>`;
}

function coinHtml() {
    return '<span class="hb-coin" aria-hidden="true"><i class="fas fa-star"></i></span>';
}

function tileStatusHtml(option) {
    if (option.status === 'locked') {
        return `<span class="hb-tile__why"><i class="fas fa-moon" aria-hidden="true"></i>${escapeHtml(option.reason)}</span>`;
    }
    if (option.status === 'free') {
        return `<span class="hb-tile__ribbon">Free boon</span>`;
    }
    return `<span class="hb-tile__purse">${coinHtml()}${escapeHtml(option.gold)}<span class="sr-only"> Gold</span></span>`;
}

function tileHtml(option, selectedId) {
    const locked = option.status === 'locked';
    const selected = option.id === selectedId;
    const patron = option.patronGoldBack > 0 && !locked
        ? `<span class="hb-tile__patron" title="Patron: gets ${option.patronGoldBack} Gold back"><i class="fas fa-hand-holding-heart" aria-hidden="true"></i></span>`
        : '';
    const label = locked
        ? `${option.name}: ${option.reason}`
        : `${option.name}, ${option.status === 'free' ? 'free boon' : `${option.gold} Gold`}`;
    return `<button type="button" role="radio" class="hb-tile hb-tile--${option.status}${selected ? ' is-selected' : ''}"
            data-id="${escapeHtml(option.id)}" aria-checked="${selected}" aria-label="${escapeHtml(label)}"
            ${locked ? 'aria-disabled="true" tabindex="-1"' : 'tabindex="-1"'}>
            <span class="hb-tile__face-wrap">${faceHtml(option, 'hb-tile__face')}${patron}
                <span class="hb-tile__check" aria-hidden="true"><i class="fas fa-check"></i></span></span>
            <span class="hb-tile__name">${escapeHtml(firstName(option.name))}</span>
            ${tileStatusHtml(option)}
        </button>`;
}

function giverSlotHtml(option) {
    if (!option) {
        return `<span class="hb-end__ring hb-end__ring--empty" aria-hidden="true"><i class="fas fa-question"></i></span>
            <span class="hb-end__name hb-end__name--muted">Sponsor</span>
            <span class="hb-end__note">pick below</span>`;
    }
    const note = option.status === 'free'
        ? '<span class="hb-end__note hb-end__note--free">free boon</span>'
        : `<span class="hb-end__note">${coinHtml()}−${option.cost}</span>`;
    return `<span class="hb-end__ring">${faceHtml(option, 'hb-end__face')}</span>
        <span class="hb-end__name">${escapeHtml(firstName(option.name))}</span>${note}`;
}

function receiverSlotHtml(receiver) {
    return `<span class="hb-cloud" aria-hidden="true">${buildAwardCloudSvg('b', 'hb-receiver')}</span>
        <span class="hb-end__ring hb-end__ring--receiver">${faceHtml(receiver, 'hb-end__face')}</span>
        <span class="hb-end__name">${escapeHtml(firstName(receiver.name))}</span>
        <span class="hb-end__note hb-end__note--stars"><i class="fas fa-star" aria-hidden="true"></i>${escapeHtml(receiver.monthlyStars ?? 0)} this month</span>`;
}

function dealHtml(option, baseStars, cost) {
    const stars = baseStars + (option?.extraStars || 0);
    const pay = option?.status === 'free'
        ? '<span class="hb-deal__pay hb-deal__pay--free">Free</span>'
        : `<span class="hb-deal__pay">${coinHtml()}${cost}</span>`;
    const back = option?.patronGoldBack > 0
        ? `<span class="hb-deal__back" title="Patron bonus">+${option.patronGoldBack} back</span>`
        : '';
    return `${pay}<i class="fas fa-arrow-right hb-deal__arrow" aria-hidden="true"></i>`
        + `<span class="hb-deal__get"><i class="fas fa-star" aria-hidden="true"></i>${formatBoonStars(stars)}</span>${back}`;
}

function todayHtml(used, cap) {
    const left = Math.max(0, cap - used);
    const pips = Array.from({ length: cap }, (_, i) =>
        `<span class="hb-today__pip${i < used ? ' is-used' : ''}"></span>`).join('');
    return `<span class="hb-today__pips" aria-hidden="true">${pips}</span>`
        + `<span class="hb-today__text"><b>${left}</b> of ${cap} boons left today</span>`;
}

/**
 * Fill the Hero's Boon modal.
 * @param {Array<{id:string,name:string,avatar?:string,gold:number,status:'free'|'ready'|'locked',reason?:string,patronGoldBack?:number,extraStars?:number}>} options
 * @param {{receiver?:{id:string,name:string,avatar?:string,monthlyStars?:number}, boonsToday?:number, dailyCap?:number, cost?:number, baseStars?:number}} context
 */
export function renderBoonSponsorPicker(options, context = {}) {
    const root = document.getElementById('boon-sponsor-picker');
    const select = document.getElementById('boon-sender-select');
    const shell = document.getElementById('bestow-boon-shell');
    if (!root || !select) return;

    const { receiver = null, boonsToday = 0, dailyCap = 4, cost = 15, baseStars = 0.5 } = context;
    const giverSlot = document.getElementById('boon-giver-slot');
    const receiverSlot = document.getElementById('boon-receiver-slot');
    const deal = document.getElementById('boon-deal');
    const today = document.getElementById('boon-today');
    const confirmLabel = document.getElementById('boon-confirm-label');
    const confirmBtn = document.getElementById('boon-confirm-btn');

    root._cleanup?.();

    const sorted = [...options].sort((a, b) =>
        (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.gold - a.gold) || a.name.localeCompare(b.name));
    const available = sorted.filter((o) => o.status !== 'locked');
    const resting = sorted.filter((o) => o.status === 'locked');
    const showSearch = sorted.length > SEARCH_THRESHOLD;
    const withCost = (o) => (o ? { ...o, cost } : null);

    if (receiver && receiverSlot) receiverSlot.innerHTML = receiverSlotHtml(receiver);
    if (today) today.innerHTML = todayHtml(boonsToday, dailyCap);

    root.innerHTML = `
        ${showSearch ? `<label class="hb-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="text" placeholder="Find a classmate…" aria-label="Find a classmate" autocomplete="off">
        </label>` : ''}
        <div class="hb-tiles-scroll">
            <div class="hb-tiles" role="radiogroup" aria-labelledby="boon-sender-label"></div>
            <p class="hb-rest-label hidden"><span>Resting this time</span></p>
            <div class="hb-tiles hb-tiles--resting" aria-label="Cannot sponsor right now"></div>
            <p class="hb-picker__empty hidden">No classmate by that name</p>
        </div>`;

    const tiles = root.querySelector('.hb-tiles:not(.hb-tiles--resting)');
    const restTiles = root.querySelector('.hb-tiles--resting');
    const restLabel = root.querySelector('.hb-rest-label');
    const empty = root.querySelector('.hb-picker__empty');
    const search = root.querySelector('.hb-search input');

    const syncChrome = () => {
        const chosen = withCost(available.find((o) => o.id === select.value));
        if (giverSlot) giverSlot.innerHTML = giverSlotHtml(chosen);
        if (deal) deal.innerHTML = dealHtml(chosen, baseStars, cost);
        shell?.classList.toggle('has-sponsor', !!chosen);
        if (confirmBtn) confirmBtn.disabled = !chosen;
        if (confirmLabel) {
            confirmLabel.textContent = !sorted.length
                ? 'No classmates yet'
                : (!available.length ? 'No sponsor can give today' : (chosen ? `Send ${firstName(chosen.name)}’s boon` : 'Choose a sponsor'));
        }
    };

    const render = () => {
        const q = (search?.value || '').trim().toLowerCase();
        const match = (o) => !q || o.name.toLowerCase().includes(q);
        const shownAvailable = available.filter(match);
        const shownResting = resting.filter(match);
        tiles.innerHTML = shownAvailable.map((o) => tileHtml(o, select.value)).join('');
        restTiles.innerHTML = shownResting.map((o) => tileHtml(o, select.value)).join('');
        restLabel.classList.toggle('hidden', !shownResting.length);
        tiles.classList.toggle('hidden', !shownAvailable.length);
        empty.classList.toggle('hidden', !!(shownAvailable.length || shownResting.length) || !sorted.length);
        if (!sorted.length) {
            empty.textContent = 'No other heroes in this class yet';
            empty.classList.remove('hidden');
        }
        // Roving focus: the chosen tile, else the first one, is the tab stop.
        const enabled = [...tiles.querySelectorAll('.hb-tile')];
        const stop = enabled.find((el) => el.dataset.id === select.value) || enabled[0];
        if (stop) stop.tabIndex = 0;
    };

    const choose = (id) => {
        const option = available.find((o) => o.id === id);
        if (!option) return;
        select.value = option.id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        tiles.querySelectorAll('.hb-tile').forEach((el) => {
            const on = el.dataset.id === option.id;
            el.classList.toggle('is-selected', on);
            el.setAttribute('aria-checked', String(on));
            el.tabIndex = on ? 0 : -1;
        });
        syncChrome();
    };

    // Property handler, not addEventListener: the root outlives each render.
    root.onclick = (e) => {
        const tile = e.target.closest('.hb-tile');
        if (!tile || tile.getAttribute('aria-disabled') === 'true') return;
        choose(tile.dataset.id);
    };

    tiles.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(e.key in keys)) return;
        const list = [...tiles.querySelectorAll('.hb-tile')];
        const i = list.indexOf(document.activeElement);
        if (i === -1) return;
        e.preventDefault();
        const next = list[(i + keys[e.key] + list.length) % list.length];
        next.focus();
        choose(next.dataset.id);
    });

    search?.addEventListener('input', render);
    root._cleanup = () => { root.innerHTML = ''; };

    render();
    syncChrome();
}
