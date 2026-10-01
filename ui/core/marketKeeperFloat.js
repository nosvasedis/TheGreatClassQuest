// /ui/core/marketKeeperFloat.js
// The Market Keeper follows shoppers down the shelves. Once the counter (and the keeper
// behind it) scrolls out of view, a small keeper rises from the bottom-left corner on a
// wooden ledge, still speaking every line. Scrolling back up, switching aisles until the
// list is short, or leaving the tab sends him back down.

const SHOW_PAST_PX = 8;   // keeper art bottom this far above the scroller top → he follows
const HIDE_BELOW_PX = 56; // ...and this far back into view → he returns to the counter
const TUCK_AFTER_MS = 9000;

let floatEl = null;
let tabEl = null;
let scroller = null;
let isHere = false;
let tuckTimer = null;
let rafId = 0;
let lastLine = '';
let lastMood = '';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Every tab shares the one <main> scroller (the page itself as a fallback).
function scrollParent(el) {
    return el?.closest('main') || document.scrollingElement || document.documentElement;
}

function tabIsSettled() {
    return tabEl
        && !tabEl.classList.contains('hidden')
        && !tabEl.classList.contains('tab-animate-in')
        && !tabEl.classList.contains('tab-animate-out');
}

function shopIsOpen() {
    const curtain = document.getElementById('shop-curtain');
    return !curtain || curtain.classList.contains('hidden');
}

/** Where the corner is: the scroller's bottom-left, lifted clear of whichever dock is showing. */
function placeFloat() {
    const box = scroller === document.scrollingElement || scroller === document.documentElement
        ? { left: 0, right: window.innerWidth, bottom: window.innerHeight }
        : scroller.getBoundingClientRect();
    let floor = window.innerHeight - box.bottom;
    const mobileDock = document.body.classList.contains('gcq-mobile')
        ? document.getElementById('m-teacher-dock') || document.getElementById('m-secretary-dock')
        : null;
    const deskDock = document.getElementById('bottom-nav-bar');
    const dock = mobileDock || (deskDock && !deskDock.classList.contains('cloud-dock--asleep') ? deskDock : null);
    if (dock && getComputedStyle(dock).display !== 'none') {
        const top = Math.min(...[...dock.querySelectorAll('.nav-button, .m-dock-btn')]
            .map(btn => btn.getBoundingClientRect().top)
            .filter(t => t > 0), dock.getBoundingClientRect().top || window.innerHeight);
        floor = Math.max(floor, window.innerHeight - top);
    }
    const scrollbar = scroller.offsetWidth - scroller.clientWidth || 0;
    floatEl.style.setProperty('--mmf-left', `${Math.round(box.left + 14)}px`);
    floatEl.style.setProperty('--mmf-bottom', `${Math.round(floor + 12)}px`);
    floatEl.style.setProperty('--mmf-room', `${Math.round(box.right - box.left - scrollbar - 28)}px`);
}

function syncPurse() {
    if (!floatEl) return;
    const select = document.getElementById('shop-student-select');
    const chip = floatEl.querySelector('.mm-keeper-float__purse');
    const hasShopper = !!select?.value;
    floatEl.classList.toggle('has-shopper', hasShopper);
    if (!chip) return;
    const name = (select?.selectedOptions?.[0]?.textContent || '').trim().split(/\s+/)[0] || '';
    const goldText = (document.getElementById('shop-student-gold')?.textContent || '').replace(/[^\d.,-]/g, '');
    const nameEl = floatEl.querySelector('.mm-keeper-float__shopper');
    const goldEl = floatEl.querySelector('.mm-keeper-float__gold');
    if (nameEl) nameEl.textContent = hasShopper ? name : '';
    if (goldEl && goldEl.textContent !== goldText) {
        const changed = goldEl.textContent !== '' && isHere;
        goldEl.textContent = goldText;
        if (changed && !reducedMotion()) {
            chip.classList.remove('is-bumped');
            void chip.offsetWidth;
            chip.classList.add('is-bumped');
        }
    }
}

function setTucked(tucked) {
    clearTimeout(tuckTimer);
    floatEl.classList.toggle('is-tucked', tucked);
    floatEl.querySelector('.mm-keeper-float__keeper')
        ?.setAttribute('aria-label', tucked ? 'Hear the Market Keeper again' : 'Hush the Market Keeper');
    if (!tucked) tuckTimer = setTimeout(() => {
        if (floatEl.matches(':hover, :focus-within')) setTucked(false);
        else setTucked(true);
    }, TUCK_AFTER_MS);
}

function arrive() {
    if (isHere) return;
    isHere = true;
    placeFloat();
    syncPurse();
    floatEl.inert = false;
    floatEl.classList.remove('is-instant');
    floatEl.classList.add('is-here', 'is-arriving');
    setTimeout(() => floatEl.classList.remove('is-arriving'), 1100);
    setTucked(false);
}

function leave({ instant = false } = {}) {
    if (!isHere && !instant) return;
    if (!instant && !reducedMotion()) {
        // hand back to the counter: the keeper there gives a welcoming nod
        const keeper = document.getElementById('shop-keeper');
        keeper?.classList.remove('is-speaking');
        void keeper?.offsetWidth;
        keeper?.classList.add('is-speaking');
    }
    isHere = false;
    clearTimeout(tuckTimer);
    floatEl.inert = true;
    if (floatEl.contains(document.activeElement)) document.activeElement.blur();
    floatEl.classList.toggle('is-instant', instant);
    floatEl.classList.remove('is-here', 'is-arriving', 'is-tab-leaving', 'is-speaking');
}

function update() {
    rafId = 0;
    if (!floatEl) return;
    if (!tabIsSettled()) {
        if (tabEl.classList.contains('hidden') && (isHere || floatEl.classList.contains('is-tab-leaving'))) {
            leave({ instant: true });
        }
        return;
    }
    if (!shopIsOpen()) {
        leave();
        return;
    }
    const keeper = document.getElementById('shop-keeper');
    if (!keeper) return;
    const top = scroller === document.scrollingElement || scroller === document.documentElement
        ? 0
        : scroller.getBoundingClientRect().top;
    const keeperBottom = keeper.getBoundingClientRect().bottom - top;
    if (!isHere && keeperBottom < SHOW_PAST_PX) arrive();
    else if (isHere && keeperBottom > HIDE_BELOW_PX) leave();
    else if (isHere) placeFloat();
}

function schedule() {
    if (!rafId) rafId = requestAnimationFrame(update);
}

/** Mirror a line the counter keeper just said. `revert` lines (back to the standing remark) stay quiet. */
export function keeperFloatSay(text, { mood = '', revert = false } = {}) {
    if (!floatEl || !text) return;
    const lineEl = floatEl.querySelector('.mm-keeper-float__line');
    const isNew = text !== lastLine || mood !== lastMood;
    lastLine = text;
    lastMood = mood;
    if (lineEl) lineEl.textContent = text;
    floatEl.dataset.mood = mood;
    syncPurse();
    if (!isHere || revert || !isNew) return;
    setTucked(false);
    if (reducedMotion()) return;
    floatEl.classList.remove('is-speaking');
    void floatEl.offsetWidth;
    floatEl.classList.add('is-speaking');
}

export function initMarketKeeperFloat() {
    if (floatEl) return;
    tabEl = document.getElementById('shop-tab');
    floatEl = document.getElementById('shop-keeper-float');
    if (!tabEl || !floatEl) return;
    floatEl.inert = true;
    scroller = scrollParent(tabEl);
    lastLine = document.getElementById('shop-keeper-line')?.textContent || '';
    keeperFloatSay(lastLine);

    // Scroll events from <main> don't bubble, so listen in the capture phase.
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    // Tab changes: fade away with the tab, then reset out of sight so a return to the
    // market (which re-opens at the top) never flashes the old keeper.
    new MutationObserver(() => {
        if (tabEl.classList.contains('tab-animate-out') && isHere) floatEl.classList.add('is-tab-leaving');
        schedule();
    }).observe(tabEl, { attributes: true, attributeFilter: ['class'] });

    // The desktop cloud dock sleeps and wakes; the keeper's ledge steps up and down with it.
    const deskDock = document.getElementById('bottom-nav-bar');
    if (deskDock) {
        new MutationObserver(() => { if (isHere) placeFloat(); })
            .observe(deskDock, { attributes: true, attributeFilter: ['class'] });
    }

    // Aisle filters and restocks change the list height without scrolling.
    const items = document.getElementById('shop-items-container');
    if (items && 'ResizeObserver' in window) new ResizeObserver(schedule).observe(items);
    const curtain = document.getElementById('shop-curtain');
    if (curtain) new MutationObserver(schedule).observe(curtain, { attributes: true, attributeFilter: ['class'] });

    const gold = document.getElementById('shop-student-gold');
    if (gold) new MutationObserver(syncPurse).observe(gold, { childList: true, characterData: true, subtree: true });
    document.getElementById('shop-student-select')?.addEventListener('change', syncPurse);

    floatEl.querySelector('.mm-keeper-float__keeper')?.addEventListener('click', () => {
        setTucked(!floatEl.classList.contains('is-tucked'));
    });

    floatEl.querySelector('.mm-keeper-float__back')?.addEventListener('click', () => {
        const deck = document.getElementById('shop-command-deck');
        if (!deck) return;
        const top = scroller === document.scrollingElement || scroller === document.documentElement
            ? 0
            : scroller.getBoundingClientRect().top;
        scroller.scrollTo({
            top: Math.max(0, scroller.scrollTop + deck.getBoundingClientRect().top - top - 12),
            behavior: reducedMotion() ? 'auto' : 'smooth'
        });
    });

    floatEl.addEventListener('animationend', (e) => {
        if (e.target === floatEl.querySelector('.mm-keeper-float__purse')) e.target.classList.remove('is-bumped');
    });

    schedule();
}
