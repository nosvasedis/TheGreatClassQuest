// ui/quietDragonButton.js — the ways into the Quiet Dragon: the header button (always there, next to
// the Guide), the Q key from anywhere in the app, and the projector remote. The stage itself loads
// only when it is opened.

let opening = false;

export async function openQuietDragonFrom(from = 'header', origin = null) {
    if (opening || document.getElementById('quiet-dragon-stage')) return;
    opening = true;
    try {
        const { openQuietDragon } = await import('./modals/quietDragon.js');
        openQuietDragon({ from, origin });
    } finally {
        opening = false;
    }
}

/** On screen (works for fixed elements too, unlike offsetParent). */
function isShown(el) {
    return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
}

/** True when Q should be left alone: typing, a key combo, or another big modal owns the keyboard. */
function keyIsBusy(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.defaultPrevented) return true;
    const el = event.target;
    if (el?.isContentEditable) return true;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    const active = document.activeElement;
    if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return true;
    // Only for teachers who are signed in to the app (not the login gate or family pages).
    const headerShown = isShown(document.getElementById('quiet-dragon-btn'));
    const projectorShown = isShown(document.getElementById('dynamic-wallpaper-screen'));
    if (!headerShown && !projectorShown) return true;
    // Another full-screen moment (a ceremony, a quiz, a dialog) keeps its own keys.
    const dialogs = document.querySelectorAll('[aria-modal="true"]');
    for (const d of dialogs) if (d.getClientRects().length && getComputedStyle(d).visibility !== 'hidden') return true;
    return false;
}

export function initQuietDragonButton() {
    const btn = document.getElementById('quiet-dragon-btn');
    if (btn) {
        btn.classList.remove('hidden');
        btn.title = 'The Quiet Dragon (Q)';
        btn.addEventListener('click', () => openQuietDragonFrom('header', btn));
    }
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'q' && event.key !== 'Q') return;
        if (keyIsBusy(event)) return;
        event.preventDefault();
        const fromWall = isShown(document.getElementById('dynamic-wallpaper-screen'));
        openQuietDragonFrom(fromWall ? 'wallpaper' : 'header', fromWall ? null : document.getElementById('quiet-dragon-btn'));
    });
}
