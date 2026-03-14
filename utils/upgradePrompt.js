// utils/upgradePrompt.js
// Single place for "upgrade to Pro/Elite" prompts. Uses the app's confirmation modal.

import * as modals from '../ui/modals.js';
import { canUseFeature } from './subscription.js';
import { getUpgradeMessage } from '../config/tiers/features.js';

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

/**
 * Gate AI features: returns true if Elite AI is allowed, otherwise shows upgrade prompt and returns false.
 * Use at the start of any AI-invoking flow (Oracle, narrative, avatar, report, etc.).
 * @param {object} [opts] - Optional { feature?: string, message?: string } for the prompt
 * @returns {boolean}
 */
export function requireEliteAI(opts = {}) {
    if (canUseFeature('eliteAI')) return true;
    const feature = opts.feature || 'AI features';
    const message = opts.message || getUpgradeMessage('Elite');
    showUpgradePrompt({ feature, tier: 'Elite', message });
    return false;
}

/**
 * Gate Hero Classes + Skill Tree progression to Pro and above.
 * @param {object} [opts] - Optional { feature?: string, message?: string } for the prompt
 * @returns {boolean}
 */
export function requireProHeroProgression(opts = {}) {
    if (canUseFeature('heroProgression')) return true;
    const feature = opts.feature || 'Hero Classes & Skill Tree';
    const message = opts.message || getUpgradeMessage('Pro', 'heroProgression');
    showUpgradePrompt({ feature, tier: 'Pro', message });
    return false;
}
