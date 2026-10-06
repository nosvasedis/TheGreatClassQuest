// Pure helpers for the operator console (unit-tested; the server validates every action again).
import { normalizeSchoolId } from '../utils/tenant.mjs';
import { PLAN_PRICES } from '../config/tiers/pricing.mjs';

const GREEK_TO_LATIN = {
    α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z', η: 'i', ή: 'i', θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i',
    κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y', ΰ: 'y',
    φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o'
};

// "Φροντιστήριο Άλφα Πάτρας" -> "frontistirio-alfa-patras". A suggestion the operator can edit.
export function suggestSchoolCode(name) {
    const latin = Array.from(String(name ?? '').toLowerCase()).map((ch) => GREEK_TO_LATIN[ch] ?? ch).join('');
    const slug = latin.normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
    return normalizeSchoolId(slug) || '';
}

const PAID = ['starter', 'pro', 'elite'];

/**
 * What a school is expected to bring in per school year, before VAT.
 * Online payers: their Stripe choice (monthly = 10 payments, yearly = one). Schools you invoice
 * by hand: counted at the yearly price, as an estimate. Suspended, pending, expired: nothing.
 */
export function schoolYearlyIncome(school) {
    const tier = school?.tier;
    if (!PAID.includes(tier) || school?.status !== 'active' || school?.founding) return { amount: 0, kind: 'none' };
    const price = PLAN_PRICES[tier];
    if (school.billing?.paysOnline) {
        return school.billing.interval === 'month'
            ? { amount: price.month * 10, kind: 'online' }
            : { amount: price.year, kind: 'online' };
    }
    return { amount: price.year, kind: 'manual' };
}

/** The overview cards at the top of the console. */
export function summarizeSchools(schools = []) {
    const summary = {
        total: 0, active: 0, suspended: 0,
        plans: { pending: 0, starter: 0, pro: 0, elite: 0, expired: 0 },
        paysOnline: 0,
        income: { online: 0, manual: 0, total: 0 }
    };
    for (const school of schools) {
        if (school?.founding) continue;
        summary.total += 1;
        if (school.status === 'active') summary.active += 1;
        else summary.suspended += 1;
        if (summary.plans[school.tier] !== undefined) summary.plans[school.tier] += 1;
        if (school.billing?.paysOnline) summary.paysOnline += 1;
        const income = schoolYearlyIncome(school);
        if (income.kind === 'online') summary.income.online += income.amount;
        if (income.kind === 'manual') summary.income.manual += income.amount;
    }
    summary.income.total = summary.income.online + summary.income.manual;
    return summary;
}

/** Search by name or code, ignoring case and Greek accents. */
export function filterSchools(schools = [], query = '') {
    const fold = (value) => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    const needle = fold(query).trim();
    if (!needle) return schools;
    return schools.filter((school) => fold(school.name).includes(needle) || fold(school.schoolId).includes(needle));
}

/** Link to the school's customer page in the Stripe dashboard (test or live). */
export function stripeCustomerUrl(billing) {
    const id = String(billing?.stripeCustomerId || '');
    if (!/^cus_[A-Za-z0-9]+$/.test(id)) return '';
    return `https://dashboard.stripe.com/${billing.livemode ? '' : 'test/'}customers/${id}`;
}
