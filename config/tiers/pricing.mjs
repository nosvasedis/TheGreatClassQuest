// Plan prices: the one place the app reads them from (sign-up screen, pricing modal, upgrade
// prompt). Stripe holds the real charge amounts, so keep its prices in step with these
// (functions/.env.example lists the price ids).
//
// - Monthly is charged September to June only (10 payments, on the 1st). July and August are
//   free and the school keeps access all summer.
// - Yearly covers the school year to 31 August and renews every 1 September; about 20% less
//   than 10 monthly payments. A school joining mid-year pays only for the rest of that year.
// - Prices are before VAT; Greek VAT (24%) is added at checkout.

export const PLAN_PRICES = Object.freeze({
    starter: Object.freeze({ month: 19, year: 150 }),
    pro: Object.freeze({ month: 35, year: 280 }),
    elite: Object.freeze({ month: 49, year: 390 })
});

export const BILLED_MONTHS_PER_YEAR = 10;
export const VAT_RATE = 0.24;
export const BILLING_INTERVALS = Object.freeze(['year', 'month']);
export const DEFAULT_BILLING_INTERVAL = 'year';

export function normalizeBillingInterval(value) {
    return BILLING_INTERVALS.includes(value) ? value : DEFAULT_BILLING_INTERVAL;
}

export function formatEuro(amount) {
    const rounded = Math.round(Number(amount) * 100) / 100;
    return `€${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** What paying yearly saves compared with the 10 monthly payments of a school year. */
export function yearlySaving(tier) {
    const price = PLAN_PRICES[tier];
    if (!price) return 0;
    return price.month * BILLED_MONTHS_PER_YEAR - price.year;
}

/** The yearly price spread over the 10 school months, for "about €X a month" copy. */
export function yearlyPerSchoolMonth(tier) {
    const price = PLAN_PRICES[tier];
    return price ? Math.round((price.year / BILLED_MONTHS_PER_YEAR) * 100) / 100 : 0;
}

/** Display copy for one plan and billing choice. */
export function planPriceCopy(tier, interval) {
    const price = PLAN_PRICES[tier];
    if (!price) return null;
    if (normalizeBillingInterval(interval) === 'month') {
        return {
            amount: formatEuro(price.month),
            unit: '/month',
            note: 'Sept–June only · summer free',
            vat: '+ VAT'
        };
    }
    return {
        amount: formatEuro(price.year),
        unit: '/school year',
        note: `Save ${formatEuro(yearlySaving(tier))} · about ${formatEuro(yearlyPerSchoolMonth(tier))} a month`,
        vat: '+ VAT'
    };
}
