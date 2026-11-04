// Team Quest + Hero's Challenge controls and the Quest League picker keep their
// styles in styles/league_controls.css, off the startup bundle. showTab and the
// picker await this before showing them; an idle prefetch usually has it ready.
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';

let pending = null;

function markLite() {
    let lite = false;
    try { lite = detectLowPowerTier(); } catch { lite = false; }
    if (!lite) return;
    ['class-leaderboard-tab', 'student-leaderboard-tab', 'league-picker-modal'].forEach((id) => {
        document.getElementById(id)?.classList.add('lgc-lite');
    });
}

export function loadLeagueControlStyles() {
    pending ||= import('../styles/league_controls.css')
        .then(markLite)
        .catch((error) => {
            pending = null;
            console.warn('League control styles failed to load:', error);
        });
    return pending;
}

/** Warm the styles up once the app is idle, so the first visit shows at once. */
export function prefetchLeagueControlStyles() {
    const go = () => { loadLeagueControlStyles(); };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(go, { timeout: 4000 });
    else window.setTimeout(go, 2500);
}
