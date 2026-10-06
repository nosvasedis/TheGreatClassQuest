// templates/subscribe.js
// The plan screen: shown when a school has no paid plan yet, its plan has ended, or it is
// suspended. Prices come from config/tiers/pricing.mjs; app.js#showSubscribeScreen fills the
// headline for the school's situation and wires the Yearly / Monthly switch and the buttons.
import { PLAN_PRICES, planPriceCopy } from '../config/tiers/pricing.mjs';

const PLANS = [
    {
        tier: 'starter',
        name: 'Starter',
        tagline: 'The heart of the Quest for a small school.',
        accent: { ring: 'ring-slate-200', chip: 'bg-slate-100 text-slate-700', check: 'text-slate-500', button: 'bg-slate-800 hover:bg-slate-900 text-white' },
        features: [
            'Award Stars for the four virtues',
            'Team Quest map & Hero’s Challenge',
            'Ceremony of the Month',
            'Mystic Market & Quest Bounties',
            'Projector Mode for the classroom',
            'Up to 3 teachers · 6 classes'
        ]
    },
    {
        tier: 'pro',
        name: 'Pro',
        tagline: 'Everything most φροντιστήρια need.',
        popular: true,
        accent: { ring: 'ring-indigo-400', chip: 'bg-indigo-100 text-indigo-700', check: 'text-indigo-500', button: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white' },
        features: [
            'Everything in Starter',
            'Guilds & the Sorting Ceremony',
            'Hero Classes & Skill Tree',
            'Adventure Log, Calendar & Attendance',
            'Scholar’s Scroll for tests & dictations',
            'Family Portal for parents',
            'Up to 6 teachers · 10 classes'
        ]
    },
    {
        tier: 'elite',
        name: 'Elite',
        tagline: 'The whole school, with AI that saves hours.',
        accent: { ring: 'ring-fuchsia-300', chip: 'bg-fuchsia-100 text-fuchsia-700', check: 'text-fuchsia-500', button: 'bg-gradient-to-r from-fuchsia-600 to-rose-500 hover:from-fuchsia-700 hover:to-rose-600 text-white' },
        features: [
            'Everything in Pro',
            'AI Adventure Log, reports & certificates',
            'Quiz of the Week & Story Weavers',
            'Familiars & AI hero avatars',
            'School Office for your secretary',
            'Unlimited teachers & classes',
            'Priority support'
        ]
    }
];

function priceBlock(tier) {
    if (!PLAN_PRICES[tier]) return '';
    return ['year', 'month'].map((interval) => {
        const copy = planPriceCopy(tier, interval);
        return `
                <div data-price-interval="${interval}" class="${interval === 'year' ? '' : 'hidden'}">
                    <div class="flex items-baseline gap-1.5">
                        <span class="font-title text-5xl text-slate-900">${copy.amount}</span>
                        <span class="text-base font-semibold text-slate-500">${copy.unit}</span>
                    </div>
                    <p class="mt-1 text-sm font-semibold text-slate-500">${copy.vat} · ${copy.note}</p>
                </div>`;
    }).join('');
}

function planCard(plan) {
    const { accent } = plan;
    return `
        <article class="relative flex flex-col rounded-3xl bg-white p-6 shadow-xl ring-1 ${plan.popular ? `ring-2 ${accent.ring} md:-translate-y-2 shadow-indigo-200/60` : accent.ring}">
            ${plan.popular ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1 text-xs font-black uppercase tracking-widest text-white shadow-md">Most popular</div>' : ''}
            <div class="mb-4">
                <span class="inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${accent.chip}">${plan.name}</span>
                <p class="mt-3 text-sm text-slate-600">${plan.tagline}</p>
            </div>
            <div class="mb-5">${priceBlock(plan.tier)}</div>
            <button type="button" id="subscribe-${plan.tier}-btn" data-plan-label="Choose ${plan.name}" class="mb-6 w-full rounded-2xl px-4 py-3 font-title text-lg shadow-md transition ${accent.button}">
                Choose ${plan.name}
            </button>
            <ul class="space-y-2.5 text-sm text-slate-700">
                ${plan.features.map((feature) => `<li class="flex gap-2.5"><i class="fas fa-check mt-0.5 ${accent.check}" aria-hidden="true"></i><span>${feature}</span></li>`).join('')}
            </ul>
        </article>`;
}

const PROMISES = [
    ['fa-sun', 'Summer is free', 'Monthly plans are charged September to June only. Access stays on all summer.'],
    ['fa-calendar-check', 'Built for the school year', 'Yearly renews every 1 September. Join mid-year and pay only for the months left.'],
    ['fa-arrow-right-arrow-left', 'Change any time', 'Switch plan or cancel from School Office. Cancelling ends at the close of what you paid for.'],
    ['fa-lock', 'Secure payment', 'Cards are handled by Stripe. We never see your card details.']
];

const FAQ = [
    ['When am I charged?', 'Yearly: today for the rest of this school year, then every 1 September. Monthly: on the 1st of each month from September to June. If you start in July or August, the first charge is on 1 September.'],
    ['Do prices include VAT?', 'Prices are before VAT. Greek VAT (24%) is added at checkout, where you can also enter your ΑΦΜ for the invoice.'],
    ['Is our work safe if a plan ends?', 'Yes. If a plan ends or a payment fails, the app locks, but nothing your school created is deleted. Renew and everything is exactly where you left it.'],
    ['Do you have a founding-school offer?', 'The first schools that join get a code for an extra discount on their first year. Enter it on the payment page.']
];

export const subscribeHTML = `
    <div id="subscribe-screen" class="fixed inset-0 z-40 hidden overflow-y-auto bg-[#f6f4ff]">
        <div class="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-indigo-200/70 via-violet-100/60 to-transparent"></div>
        <div class="pointer-events-none absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-amber-200/50 blur-3xl"></div>
        <div class="pointer-events-none absolute top-40 left-[-5rem] h-64 w-64 rounded-full bg-sky-200/50 blur-3xl"></div>

        <div class="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
            <header class="flex items-center justify-between gap-3 py-5">
                <div class="flex min-w-0 items-center gap-3">
                    <span class="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-white text-xl shadow-sm" aria-hidden="true">🗺️</span>
                    <div class="min-w-0">
                        <p class="font-title text-lg leading-tight text-indigo-950">The Great Class Quest</p>
                        <p id="subscribe-school-name" class="truncate text-sm text-slate-500"></p>
                    </div>
                </div>
                <button type="button" id="subscribe-signout-btn" class="rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white">
                    <i class="fas fa-arrow-right-from-bracket mr-1.5" aria-hidden="true"></i>Sign out
                </button>
            </header>

            <section class="mx-auto mt-6 max-w-3xl text-center">
                <p id="subscribe-eyebrow" class="text-sm font-black uppercase tracking-[0.25em] text-indigo-500">Choose your plan</p>
                <h1 id="subscribe-headline" class="mt-3 font-title text-4xl leading-tight text-indigo-950 sm:text-5xl">Bring the Quest to your whole school</h1>
                <p id="subscribe-lead" class="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Pick the plan that fits. You can change it any time.</p>
            </section>

            <div id="subscribe-plans">
                <div class="mt-8 flex justify-center">
                    <div id="subscribe-interval-switch" class="inline-flex rounded-full bg-white p-1.5 shadow-sm ring-1 ring-slate-200" role="group" aria-label="How would you like to pay?">
                        <button type="button" data-billing-interval="year" aria-pressed="true" class="rounded-full px-5 py-2 text-sm font-bold">
                            Yearly <span class="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">save ~20%</span>
                        </button>
                        <button type="button" data-billing-interval="month" aria-pressed="false" class="rounded-full px-5 py-2 text-sm font-bold">
                            Monthly <span class="ml-1 text-xs font-semibold opacity-70">Sept–June</span>
                        </button>
                    </div>
                </div>

                <div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
                    ${PLANS.map(planCard).join('')}
                </div>

                <p id="subscribe-status" class="mt-6 hidden rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-700 ring-1 ring-rose-200" aria-live="polite"></p>
                <p id="subscribe-refresh-hint" class="mt-4 hidden text-center text-sm text-slate-500">
                    <i class="fas fa-rotate mr-1" aria-hidden="true"></i>Paid already? It unlocks within a minute; reload this page if it has not.
                </p>

                <div class="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    ${PROMISES.map(([icon, title, text]) => `
                        <div class="rounded-2xl bg-white/80 p-5 ring-1 ring-slate-200">
                            <i class="fas ${icon} text-xl text-indigo-500" aria-hidden="true"></i>
                            <h3 class="mt-3 font-bold text-slate-900">${title}</h3>
                            <p class="mt-1 text-sm text-slate-600">${text}</p>
                        </div>`).join('')}
                </div>

                <section class="mx-auto mt-12 max-w-3xl">
                    <h2 class="text-center font-title text-2xl text-indigo-950">Questions</h2>
                    <div class="mt-4 divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
                        ${FAQ.map(([question, answer]) => `
                            <details class="group px-5 py-4">
                                <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-slate-900">
                                    ${question}<i class="fas fa-chevron-down text-xs text-slate-400 transition group-open:rotate-180" aria-hidden="true"></i>
                                </summary>
                                <p class="mt-2 text-sm text-slate-600">${answer}</p>
                            </details>`).join('')}
                    </div>
                    <p class="mt-6 text-center text-xs text-slate-500">All prices are per school and before VAT (24%).</p>
                </section>
            </div>

            <div id="subscribe-paused" class="mx-auto mt-10 hidden max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
                <span class="text-5xl" aria-hidden="true">🌙</span>
                <p id="subscribe-paused-text" class="mt-4 text-slate-600"></p>
            </div>
        </div>
    </div>
`;
