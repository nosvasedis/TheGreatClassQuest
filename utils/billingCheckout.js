// Online payment (Stripe) through Cloud Functions (functions/billing/billing.js).
// The founding school's plan is managed directly, so it never sees online payment.
import { auth } from '../firebaseAuth.js';
import { DEFAULT_SCHOOL_ID, getSchoolId } from './tenant.mjs';

function callBilling(name, payload) {
    return import('./adminRuntime.js').then(({ callBillingFunction }) => callBillingFunction(name, payload));
}

/** True when this school can pay online (every school except the founding one). */
export function isOnlineBillingAvailable() {
    return getSchoolId() !== DEFAULT_SCHOOL_ID;
}

function billingErrorMessage(error) {
    const code = String(error?.code || '');
    // The billing functions are not deployed or switched on yet.
    if (code === 'functions/not-found' || code === 'functions/unimplemented') return 'Online payment is not switched on yet. Contact us to choose a plan.';
    return String(error?.message || '').trim() || 'Could not open checkout right now.';
}

/** interval: 'year' (the school year, renews 1 September) or 'month' (charged September–June). */
export async function requestCheckoutSession({ tier, interval = 'year', successUrl, cancelUrl } = {}) {
    if (!auth.currentUser) throw new Error('Sign in again before choosing a plan.');
    if (!isOnlineBillingAvailable()) throw new Error('This school’s plan is managed directly. Contact us to change it.');
    const requestId = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
        const data = await callBilling('billingCreateCheckout', { tier, interval: interval === 'month' ? 'month' : 'year', successUrl, cancelUrl, requestId });
        if (!data?.url) throw new Error('Stripe did not return a checkout link.');
        return data;
    } catch (error) {
        throw new Error(billingErrorMessage(error));
    }
}

export async function requestBillingPortal({ returnUrl } = {}) {
    if (!isOnlineBillingAvailable()) throw new Error('This school’s plan is managed directly. Contact us to change it.');
    try {
        const data = await callBilling('billingCreatePortal', { returnUrl });
        if (!data?.url) throw new Error('Stripe did not return a portal link.');
        return data;
    } catch (error) {
        throw new Error(billingErrorMessage(error));
    }
}
