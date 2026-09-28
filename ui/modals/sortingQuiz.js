// /ui/modals/sortingQuiz.js — thin entry for the Guild Sorting Ceremony.
// The ceremony itself (ui/modals/sortingCeremony.js) loads on first open so it
// stays out of the eager modal barrel.

import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';

let _ceremony = null;

// The ceremony's portal opens from wherever the teacher just tapped (the hat).
let _lastTap = null;
if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', (e) => {
        _lastTap = { x: e.clientX, y: e.clientY, at: Date.now() };
    }, { capture: true, passive: true });
}
function recentTap() {
    return _lastTap && Date.now() - _lastTap.at < 2000 ? { x: _lastTap.x, y: _lastTap.y } : null;
}
function loadCeremony() {
    if (!_ceremony) _ceremony = import('./sortingCeremony.js');
    return _ceremony;
}

/**
 * Open the Sorting Ceremony for a student.
 * @param {string} studentId
 */
export function openSortingQuizModal(studentId) {
    if (!canUseFeature('guilds')) {
        showUpgradePrompt({
            feature: 'Guild Sorting Quiz',
            tier: 'Pro',
            message: getUpgradeMessage('Pro', 'guilds')
        });
        return;
    }
    const origin = recentTap();
    loadCeremony()
        .then((m) => m.openSortingCeremony(studentId, { origin }))
        .catch((err) => console.error('Sorting Ceremony failed to load', err));
}

/** Close the ceremony if it has been opened. */
export function closeSortingQuizModal() {
    if (_ceremony) _ceremony.then((m) => m.closeSortingCeremony()).catch(() => {});
}

/** Kept for ui/core/listeners.js: the ceremony wires its own buttons on first open. */
export function wireSortingQuizResultDone() {}
