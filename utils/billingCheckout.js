function buildBillingErrorMessage(error) {
    const message = String(error?.message || '').trim();
    if (!message) {
        return 'Could not open checkout right now.';
    }
    if (error?.name === 'AbortError') {
        return 'The billing server took too long to respond. If Render is waking up, wait a few seconds and try again.';
    }
    return message;
}

async function parseBillingResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (error) {
        if (!response.ok) {
            throw new Error(`Billing server returned ${response.status} ${response.statusText}.`);
        }
        throw new Error('Billing server returned an unexpected response.');
    }
}

export async function requestCheckoutSession({
    billingBaseUrl,
    schoolId,
    tier,
    successUrl,
    cancelUrl,
    timeoutMs = 35000
}) {
    const baseUrl = String(billingBaseUrl || '').trim().replace(/\/$/, '');
    if (!baseUrl) {
        throw new Error('Billing is not configured for this school yet.');
    }
    if (!schoolId) {
        throw new Error('This school is missing its billing ID.');
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${baseUrl}/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schoolId,
                tier,
                successUrl,
                cancelUrl
            }),
            signal: controller.signal
        });

        const data = await parseBillingResponse(response);
        if (!response.ok) {
            throw new Error(data?.error || `Billing server returned ${response.status} ${response.statusText}.`);
        }
        if (!data?.url) {
            throw new Error(data?.error || 'Billing server did not return a Stripe checkout link.');
        }
        return data;
    } catch (error) {
        throw new Error(buildBillingErrorMessage(error));
    } finally {
        window.clearTimeout(timeoutId);
    }
}
