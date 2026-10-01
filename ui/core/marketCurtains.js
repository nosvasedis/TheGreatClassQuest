// /ui/core/marketCurtains.js
// Velvet stage curtains for the Mystic Market. When the header class changes while the
// market is open on screen, the drapes swing shut under the awning, a little plaque names
// who the market is opening for, the shelves are swapped behind them, and they part again.

const CLOSE_MS = 560;
const HOLD_MS = 380;
const OPEN_MS = 760;

let stage = null;
let phase = 'open'; // open | closing | closed | opening
let closedPromise = null;
let openTimer = null;
let ticket = 0;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function ensureStage() {
    if (stage?.isConnected) return stage;
    const shopWindow = document.getElementById('shop-window');
    if (!shopWindow) return null;
    stage = document.createElement('div');
    stage.className = 'mm-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
        <span class="mm-stage__drape mm-stage__drape--l"></span>
        <span class="mm-stage__drape mm-stage__drape--r"></span>
        <span class="mm-stage__valance"></span>
        <div class="mm-stage__plaque">
            <span class="mm-stage__plaque-kicker"></span>
            <span class="mm-stage__plaque-title"></span>
        </div>`;
    shopWindow.appendChild(stage);
    const tab = document.getElementById('shop-tab');
    if (tab) {
        new MutationObserver(() => {
            if (tab.classList.contains('hidden') && phase !== 'open') resetMarketCurtains();
        }).observe(tab, { attributes: true, attributeFilter: ['class'] });
    }
    return stage;
}

/** True when the market tab is the one on screen and not mid tab-transition. */
export function shopStageIsLive() {
    const tab = document.getElementById('shop-tab');
    return !!tab
        && !tab.classList.contains('hidden')
        && !tab.classList.contains('tab-animate-in')
        && !tab.classList.contains('tab-animate-out');
}

function bringShopIntoView() {
    const shopWindow = document.getElementById('shop-window');
    const scroller = shopWindow?.closest('main');
    if (!shopWindow || !scroller) return;
    const offset = shopWindow.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset >= -40) return;
    scroller.scrollTo({
        top: Math.max(0, scroller.scrollTop + offset - 48),
        behavior: reducedMotion() ? 'auto' : 'smooth'
    });
}

function setPlaque({ kicker, title }) {
    if (!stage) return;
    stage.querySelector('.mm-stage__plaque-kicker').textContent = kicker || '';
    stage.querySelector('.mm-stage__plaque-title').textContent = title || '';
}

/**
 * Draw the curtains. Resolves once they are fully shut (at once if they already are).
 * Calling again while closed just re-labels the plaque.
 */
export function closeMarketCurtains(plaque) {
    if (!ensureStage()) return Promise.resolve();
    ticket += 1;
    clearTimeout(openTimer);
    setPlaque(plaque);
    if (phase === 'closed' || phase === 'closing') return closedPromise;
    phase = 'closing';
    bringShopIntoView();
    stage.classList.remove('is-opening');
    void stage.offsetWidth;
    stage.classList.add('is-active', 'is-closing');
    const myTicket = ticket;
    closedPromise = wait(reducedMotion() ? 180 : CLOSE_MS).then(() => {
        if (phase !== 'closing' || myTicket !== ticket) return;
        phase = 'closed';
        stage.classList.remove('is-closing');
        stage.classList.add('is-closed');
    });
    return closedPromise;
}

/** Part the curtains again after a short beat. Only the latest close gets to open them. */
export function openMarketCurtains() {
    if (!stage || phase === 'open' || phase === 'opening') return;
    const myTicket = ticket;
    Promise.resolve(closedPromise).then(() => {
        if (myTicket !== ticket) return;
        openTimer = setTimeout(() => {
            if (myTicket !== ticket) return;
            phase = 'opening';
            stage.classList.remove('is-closed');
            stage.classList.add('is-opening');
            openTimer = setTimeout(() => {
                if (myTicket !== ticket) return;
                phase = 'open';
                stage.classList.remove('is-active', 'is-opening');
            }, reducedMotion() ? 200 : OPEN_MS);
        }, reducedMotion() ? 120 : HOLD_MS);
    });
}

/** Leaving the tab mid-show: drop the curtains out of the way without animating. */
export function resetMarketCurtains() {
    ticket += 1;
    clearTimeout(openTimer);
    phase = 'open';
    stage?.classList.remove('is-active', 'is-closing', 'is-closed', 'is-opening');
}
