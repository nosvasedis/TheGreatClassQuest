// utils/upgradePrompt.js
// Single place for "upgrade to Pro/Elite" prompts. Uses the app's confirmation modal.
// For schools that pay online, shows an "Upgrade" button that opens Stripe Checkout.

import * as modals from '../ui/modals.js';
import { canUseFeature } from './subscription.js';
import { getUpgradeMessage } from '../config/tiers/features.js';
import { isOnlineBillingAvailable, requestCheckoutSession } from './billingCheckout.js';
import { planPriceCopy } from '../config/tiers/pricing.mjs';

async function openUpgradeCheckout(tier, interval) {
    try {
        const data = await requestCheckoutSession({
            tier,
            interval,
            successUrl: window.location.href,
            cancelUrl: window.location.href
        });
        window.location.assign(data.url);
    } catch (e) {
        console.error('Billing checkout error:', e);
        modals.showModal('Checkout unavailable', e.message || 'Could not open the upgrade page. Please try again or contact support.', null, 'OK', 'Close');
    }
}

// "or pay monthly" inside the prompt: one listener for every prompt this session.
let monthlyLinkWired = false;
function wireMonthlyLink() {
    if (monthlyLinkWired) return;
    monthlyLinkWired = true;
    document.addEventListener('click', (event) => {
        const link = event.target.closest?.('[data-upgrade-monthly]');
        if (!link) return;
        event.preventDefault();
        modals.hideModal('confirmation-modal');
        void openUpgradeCheckout(link.dataset.upgradeMonthly, 'month');
    });
}

/**
 * Show a modal prompting the user to upgrade for a gated feature.
 * For schools that pay online, "Upgrade" opens Stripe Checkout for the school year (the
 * monthly option is a link in the message); otherwise the modal just explains the required tier.
 * @param {object} opts - { feature: string, tier: 'Pro' | 'Elite', message?: string }
 */
export function showUpgradePrompt(opts) {
    const { feature, tier = 'Pro', message = '' } = opts;
    const title = `🔒 ${feature}`;
    const billingEnabled = isOnlineBillingAvailable();
    const tierKey = tier.toLowerCase();
    const yearly = planPriceCopy(tierKey, 'year');
    const monthly = planPriceCopy(tierKey, 'month');
    const intro = message
        ? `${message}<br><br><strong>Available on the ${tier} plan.</strong>`
        : `This feature is available on the <strong>${tier}</strong> plan.`;

    if (billingEnabled && yearly && monthly) {
        wireMonthlyLink();
        const body = `${intro}<br><br>${yearly.amount} per school year (${yearly.note.toLowerCase()}) ${yearly.vat}.`
            + `<br><button type="button" data-upgrade-monthly="${tierKey}" class="mt-2 underline font-bold text-indigo-600">or pay ${monthly.amount}/month, September–June</button>`;
        modals.showModal(title, body, () => openUpgradeCheckout(tierKey, 'year'), `Upgrade to ${tier} (yearly)`, 'Close');
    } else {
        modals.showModal(title, intro, null, 'OK', 'Close');
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
