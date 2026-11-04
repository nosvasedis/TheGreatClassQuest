// mobile/dock.js
//
// The phone dock's moving parts (styles: mobile/styles/chrome.css, "Sky island dock"):
// one coloured gem (.m-dock-ind) glides under whichever tab is open and takes that tab's colour,
// the chosen icon hops, and Android phones give a tiny tap of haptic feedback.
// The Award coin in the middle is its own marker, so the gem steps aside while Award is open.

const wiredDocks = new WeakSet();

function activeButton(dock) {
    return dock.querySelector('.m-dock-btn.active') || null;
}

function place(dock) {
    const ind = dock.querySelector('.m-dock-ind');
    const btn = activeButton(dock);
    if (!ind) return;
    const dockBox = dock.getBoundingClientRect();
    if (!btn || !dockBox.width) {
        dock.classList.add('m-dock--no-ind');
        return;
    }
    // Sit exactly behind the icon (fonts and safe areas move it, so measure rather than guess).
    const box = (btn.querySelector('.m-dock-icon') || btn).getBoundingClientRect();
    const isCoin = btn.classList.contains('m-dock-btn--coin');
    dock.classList.toggle('m-dock--coin-open', isCoin);
    dock.classList.toggle('m-dock--no-ind', isCoin);
    const color = getComputedStyle(btn).getPropertyValue('--nav-from').trim();
    const deep = getComputedStyle(btn).getPropertyValue('--nav-to').trim();
    dock.style.setProperty('--ind-x', `${Math.round(box.left - dockBox.left + box.width / 2)}px`);
    if (!isCoin) {
        dock.style.setProperty('--ind-top', `${Math.round(box.top - dockBox.top + 1)}px`);
        dock.style.setProperty('--ind-h', `${Math.round(box.height - 2)}px`);
        dock.style.setProperty('--ind-w', `${Math.round(box.width)}px`);
    }
    if (color) dock.style.setProperty('--ind-from', color);
    if (deep) dock.style.setProperty('--ind-to', deep);
    // The first placement must not slide in from the left edge.
    if (!dock.classList.contains('m-dock--placed')) {
        requestAnimationFrame(() => dock.classList.add('m-dock--placed'));
    }
}

function hop(btn) {
    btn.classList.remove('m-dock-btn--hop');
    void btn.offsetWidth;
    btn.classList.add('m-dock-btn--hop');
    clearTimeout(btn._hopTimer);
    btn._hopTimer = setTimeout(() => btn.classList.remove('m-dock-btn--hop'), 650);
}

/** Wire one dock (teacher or School Office): gliding gem, hop on choose, haptic tick. */
export function wireDock(dock) {
    if (!dock || wiredDocks.has(dock)) return;
    wiredDocks.add(dock);
    let frame = 0;
    const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => place(dock));
    };
    let lastActive = activeButton(dock);
    new MutationObserver(() => {
        const now = activeButton(dock);
        if (now && now !== lastActive) hop(now);
        lastActive = now;
        schedule();
    }).observe(dock, { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(dock);
    window.addEventListener('resize', schedule, { passive: true });
    dock.addEventListener('click', (e) => {
        if (!e.target.closest('.m-dock-btn')) return;
        try { navigator.vibrate?.(8); } catch { /* not allowed here */ }
    });
    schedule();
}
