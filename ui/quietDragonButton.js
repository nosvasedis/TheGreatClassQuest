// ui/quietDragonButton.js — the ways into the Quiet Dragon: the optional header button (switched on in
// Settings › Profile, remembered per computer) and the projector remote. The stage itself loads only
// when it is opened.
const PREF_KEY = 'gcq.quietDragon.headerButton';

export function quietDragonHeaderButtonOn() {
    try { return localStorage.getItem(PREF_KEY) === '1'; } catch { return false; }
}

function applyHeaderPref() {
    const on = quietDragonHeaderButtonOn();
    document.getElementById('quiet-dragon-btn')?.classList.toggle('hidden', !on);
    const toggle = document.getElementById('quiet-dragon-header-toggle');
    if (toggle) toggle.checked = on;
}

export async function openQuietDragonFrom(from = 'header') {
    const { openQuietDragon } = await import('./modals/quietDragon.js');
    openQuietDragon({ from });
}

export function initQuietDragonButton() {
    applyHeaderPref();
    document.getElementById('quiet-dragon-btn')?.addEventListener('click', () => openQuietDragonFrom('header'));
    document.addEventListener('change', (event) => {
        if (event.target?.id !== 'quiet-dragon-header-toggle') return;
        try { localStorage.setItem(PREF_KEY, event.target.checked ? '1' : '0'); } catch { /* this session only */ }
        applyHeaderPref();
    });
}
