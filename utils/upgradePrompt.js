// utils/upgradePrompt.js
// Single place for "upgrade to Pro/Elite" prompts. Uses the app's confirmation modal.
// When BILLING_BASE_URL is set, shows an "Upgrade" button that redirects to Stripe Checkout.

import * as modals from '../ui/modals.js';
import { canUseFeature } from './subscription.js';
import { getUpgradeMessage } from '../config/tiers/features.js';
import { BILLING_BASE_URL, BILLING_SCHOOL_ID, firebaseConfig } from '../constants.js';
import { requestCheckoutSession } from './billingCheckout.js';

/**
 * Show a modal prompting the user to upgrade for a gated feature.
 * If BILLING_BASE_URL is set, "Upgrade" opens Stripe Checkout; otherwise the modal just explains the required tier.
 * @param {object} opts - { feature: string, tier: 'Pro' | 'Elite', message?: string }
 */
export function showUpgradePrompt(opts) {
    const { feature, tier = 'Pro', message = '' } = opts;
    const title = `🔒 ${feature}`;
    const billingEnabled = BILLING_BASE_URL && (BILLING_SCHOOL_ID || firebaseConfig?.projectId);
    const schoolId = BILLING_SCHOOL_ID || firebaseConfig?.projectId || '';
    const body = message
        ? `${message}<br><br><strong>Available on the ${tier} plan.</strong>`
        : `This feature is available on the <strong>${tier}</strong> plan.`;

    if (billingEnabled && schoolId) {
        const confirmText = `Upgrade to ${tier}`;
        modals.showModal(title, body, async () => {
            try {
                const data = await requestCheckoutSession({
                    billingBaseUrl: BILLING_BASE_URL,
                    schoolId,
                    tier: tier.toLowerCase(),
                    successUrl: window.location.href,
                    cancelUrl: window.location.href
                });
                window.location.assign(data.url);
            } catch (e) {
                console.error('Billing checkout error:', e);
                modals.showModal('Checkout unavailable', e.message || 'Could not open the upgrade page. Please try again or contact support.', null, 'OK', 'Close');
            }
        }, confirmText, 'Close');
    } else {
        modals.showModal(title, body, null, 'OK', 'Close');
    }
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
