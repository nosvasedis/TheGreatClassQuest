// utils/upgradePrompt.js
// Single place for "upgrade to Pro/Elite" prompts. Uses the app's confirmation modal.

import * as modals from '../ui/modals.js';

/**
 * Show a modal prompting the user to upgrade for a gated feature.
 * @param {object} opts - { feature: string, tier: 'Pro' | 'Elite', message?: string }
 */
export function showUpgradePrompt(opts) {
    const { feature, tier = 'Pro', message = '' } = opts;
    const title = `🔒 ${feature}`;
    const body = message
        ? `${message}<br><br><strong>Available on the ${tier} plan.</strong> Contact me to upgrade.`
        : `This feature is available on the <strong>${tier}</strong> plan. Contact me to upgrade.`;
    modals.showModal(title, body, null, 'OK', 'Close');
}
