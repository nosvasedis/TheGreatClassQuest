// Custom sponsor picker for the Hero's Boon modal.
// The hidden native <select id="boon-sender-select"> stays the source of truth:
// picking an option sets its value and dispatches 'change', so existing listeners keep working.

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STATUS_ORDER = { free: 0, ready: 1, locked: 2 };

function avatarHtml(option, size = 'md') {
    const cls = `boon-picker__avatar boon-picker__avatar--${size}`;
    if (option.avatar) return `<img src="${escapeHtml(option.avatar)}" alt="" class="${cls}" loading="lazy">`;
    return `<span class="${cls} boon-picker__avatar--initial">${escapeHtml(option.name.charAt(0).toUpperCase())}</span>`;
}

function badgeHtml(option) {
    if (option.status === 'free') return '<span class="boon-picker__badge boon-picker__badge--free">✨ Free Boon</span>';
    if (option.status === 'locked') return `<span class="boon-picker__badge boon-picker__badge--locked">🔒 ${escapeHtml(option.reason)}</span>`;
    return `<span class="boon-picker__badge boon-picker__badge--gold">🪙 ${option.gold}</span>`;
}

/**
 * @param {Array<{id:string,name:string,avatar?:string,gold:number,status:'free'|'ready'|'locked',reason?:string}>} options
 */
export function renderBoonSponsorPicker(options) {
    const root = document.getElementById('boon-sponsor-picker');
    const select = document.getElementById('boon-sender-select');
    if (!root || !select) return;

    root._cleanup?.();

    const sorted = [...options].sort((a, b) =>
        (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.gold - a.gold) || a.name.localeCompare(b.name));
    const availableCount = sorted.filter(o => o.status !== 'locked').length;
    const showSearch = sorted.length > 6;

    root.innerHTML = `
        <button type="button" class="boon-picker__trigger" aria-haspopup="listbox" aria-expanded="false"
            aria-labelledby="boon-sender-label" ${sorted.length === 0 ? 'disabled' : ''}>
            <span class="boon-picker__value"></span>
            <i class="fas fa-chevron-down boon-picker__chevron" aria-hidden="true"></i>
        </button>
        <div class="boon-picker__panel hidden">
            ${showSearch ? `<div class="boon-picker__search">
                <i class="fas fa-search" aria-hidden="true"></i>
                <input type="text" placeholder="Find a sponsor…" aria-label="Find a sponsor" autocomplete="off">
            </div>` : ''}
            <ul class="boon-picker__list" role="listbox" aria-labelledby="boon-sender-label"></ul>
            <p class="boon-picker__footer">${availableCount} of ${sorted.length} can sponsor</p>
        </div>`;

    const trigger = root.querySelector('.boon-picker__trigger');
    const valueEl = root.querySelector('.boon-picker__value');
    const panel = root.querySelector('.boon-picker__panel');
    const list = root.querySelector('.boon-picker__list');
    const search = root.querySelector('.boon-picker__search input');
    let activeIndex = -1;
    let visible = sorted;

    const renderValue = () => {
        const chosen = sorted.find(o => o.id === select.value);
        if (!sorted.length) {
            valueEl.innerHTML = '<span class="boon-picker__placeholder">No other students in class</span>';
        } else if (!chosen) {
            valueEl.innerHTML = `<span class="boon-picker__placeholder-icon">🧙</span>
                <span class="boon-picker__placeholder">Choose a generous hero…</span>`;
        } else {
            valueEl.innerHTML = `${avatarHtml(chosen, 'sm')}
                <span class="boon-picker__name">${escapeHtml(chosen.name)}</span>${badgeHtml(chosen)}`;
        }
        root.classList.toggle('is-chosen', !!chosen);
    };

    const renderList = () => {
        const q = (search?.value || '').trim().toLowerCase();
        visible = q ? sorted.filter(o => o.name.toLowerCase().includes(q)) : sorted;
        if (!visible.length) {
            list.innerHTML = '<li class="boon-picker__empty">No hero by that name</li>';
            activeIndex = -1;
            return;
        }
        list.innerHTML = visible.map((o, i) => `
            <li role="option" id="boon-opt-${i}" data-id="${escapeHtml(o.id)}"
                class="boon-picker__option boon-picker__option--${o.status}${o.id === select.value ? ' is-selected' : ''}"
                aria-selected="${o.id === select.value}" aria-disabled="${o.status === 'locked'}">
                ${avatarHtml(o)}
                <span class="boon-picker__option-name">${escapeHtml(o.name)}</span>
                ${badgeHtml(o)}
                <i class="fas fa-check boon-picker__check" aria-hidden="true"></i>
            </li>`).join('');
        setActive(Math.max(0, visible.findIndex(o => o.id === select.value && o.status !== 'locked')), false);
    };

    const setActive = (index, scroll = true) => {
        const items = list.querySelectorAll('.boon-picker__option');
        items.forEach(el => el.classList.remove('is-active'));
        activeIndex = index;
        const el = items[index];
        if (!el) return;
        el.classList.add('is-active');
        list.setAttribute('aria-activedescendant', el.id);
        if (scroll) el.scrollIntoView({ block: 'nearest' });
    };

    const moveActive = (delta) => {
        if (!visible.length) return;
        let i = activeIndex;
        for (let n = 0; n < visible.length; n += 1) {
            i = (i + delta + visible.length) % visible.length;
            if (visible[i].status !== 'locked') return setActive(i);
        }
    };

    const open = () => {
        if (trigger.disabled) return;
        panel.classList.remove('hidden');
        root.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        if (search) search.value = '';
        renderList();
        (search || list).focus({ preventScroll: true });
    };

    const close = (refocus = true) => {
        panel.classList.add('hidden');
        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        if (refocus) trigger.focus({ preventScroll: true });
    };

    const choose = (option) => {
        if (!option || option.status === 'locked') return;
        select.value = option.id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        renderValue();
        close();
    };

    list.tabIndex = -1;
    trigger.addEventListener('click', () => (root.classList.contains('is-open') ? close() : open()));
    trigger.addEventListener('keydown', (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
    });
    list.addEventListener('click', (e) => {
        const li = e.target.closest('.boon-picker__option');
        if (li) choose(sorted.find(o => o.id === li.dataset.id));
    });
    list.addEventListener('mousemove', (e) => {
        const li = e.target.closest('.boon-picker__option:not(.boon-picker__option--locked)');
        if (li) setActive([...list.children].indexOf(li), false);
    });
    search?.addEventListener('input', renderList);
    panel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(visible[activeIndex]); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'Tab') close(false);
    });
    const onDocPointer = (e) => { if (!root.contains(e.target) && root.classList.contains('is-open')) close(false); };
    document.addEventListener('pointerdown', onDocPointer);
    root._cleanup = () => document.removeEventListener('pointerdown', onDocPointer);

    renderValue();
}
