// ui/core/marketGuideTabs.js — the three bookmarks of "How treasures work" (Charms, Hoard,
// Fair stall). DOM only, so the guidebook capture and the Market share it.

export function selectMarketGuideTab(root, id, { focus = false } = {}) {
    const tabs = [...root.querySelectorAll('[data-mg-tab]')];
    const target = tabs.find((tab) => tab.dataset.mgTab === id) || tabs[0];
    if (!target) return;
    tabs.forEach((tab) => {
        const on = tab === target;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        const panel = root.querySelector(`#${tab.getAttribute('aria-controls')}`);
        if (panel) panel.hidden = !on;
    });
    root.querySelector('.mg-panels')?.scrollTo?.({ top: 0 });
    if (focus) target.focus({ preventScroll: true });
}

export function bindMarketGuideTabs(root, initial = '') {
    if (!root) return;
    if (initial) selectMarketGuideTab(root, initial);
    root.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-mg-tab]');
        if (tab) selectMarketGuideTab(root, tab.dataset.mgTab);
    });
    root.addEventListener('keydown', (e) => {
        const tab = e.target.closest('[data-mg-tab]');
        if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        const tabs = [...root.querySelectorAll('[data-mg-tab]')];
        const at = tabs.indexOf(tab);
        const next = e.key === 'Home' ? 0
            : e.key === 'End' ? tabs.length - 1
                : (at + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        e.preventDefault();
        selectMarketGuideTab(root, tabs[next].dataset.mgTab, { focus: true });
    });
}
