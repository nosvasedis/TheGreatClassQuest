// Operator console markup: pure functions of the data they are given (no state, no DOM).
import { PLAN_PRICES, formatEuro } from '../config/tiers/pricing.mjs';
import { filterSchools, schoolYearlyIncome, stripeCustomerUrl, summarizeSchools } from './operatorConsoleCore.mjs';

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const TIER_LABELS = { pending: 'Pending', starter: 'Starter', pro: 'Pro', elite: 'Elite', expired: 'Expired' };
const TIER_STYLES = {
    pending: 'bg-amber-100 text-amber-800',
    starter: 'bg-slate-200 text-slate-800',
    pro: 'bg-indigo-100 text-indigo-800',
    elite: 'bg-fuchsia-100 text-fuchsia-800',
    expired: 'bg-rose-100 text-rose-700'
};
const TIER_OPTIONS = [['pending', 'Pending (locked)'], ['starter', 'Starter'], ['pro', 'Pro'], ['elite', 'Elite']];

const date = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function tierBadge(tier) {
    return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TIER_STYLES[tier] || TIER_STYLES.pending}">${esc(TIER_LABELS[tier] || tier)}</span>`;
}

function statusBadge(status) {
    if (status === 'active') return '<span class="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Active</span>';
    if (status === 'deleting') return '<span class="inline-flex rounded-full bg-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-800">Deleting…</span>';
    return '<span class="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">Suspended</span>';
}

function billingLabel(school) {
    if (school.founding) return 'Managed directly';
    if (!school.billing?.paysOnline) return 'Invoiced by you';
    const how = school.billing.interval === 'month' ? 'Card · monthly' : 'Card · yearly';
    const status = school.billing.stripeStatus && school.billing.stripeStatus !== 'active' ? ` · ${school.billing.stripeStatus.replace(/_/g, ' ')}` : '';
    return how + status;
}

function card(title, body, { tone = 'white', icon = '' } = {}) {
    const tones = { white: 'border-slate-200 bg-white', danger: 'border-rose-200 bg-rose-50/60' };
    return `
        <section class="rounded-2xl border ${tones[tone]} p-4 shadow-sm">
            <h3 class="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider ${tone === 'danger' ? 'text-rose-700' : 'text-slate-500'}">${icon ? `<i class="fas ${icon}" aria-hidden="true"></i>` : ''}${esc(title)}</h3>
            ${body}
        </section>`;
}

const btn = (label, attrs, kind = 'quiet') => {
    const kinds = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        quiet: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40'
    };
    return `<button type="button" ${attrs} class="rounded-lg px-3 py-1.5 text-sm font-bold transition ${kinds[kind]}">${label}</button>`;
};

export function copyRowHtml(label, value) {
    return `
        <div class="mt-2">
            <div class="text-xs font-bold uppercase tracking-wide text-slate-500">${esc(label)}</div>
            <div class="mt-1 flex gap-2">
                <input readonly class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm" value="${esc(value)}">
                <button type="button" data-copy="${esc(value)}" class="rounded-lg bg-slate-800 px-3 py-1 text-sm font-bold text-white">Copy</button>
            </div>
        </div>`;
}

/** A green "done" box with the links / codes to hand over. rows: [label, value][] */
export function resultHtml(result) {
    if (!result) return '';
    const rows = (result.rows || []).map(([label, value]) => copyRowHtml(label, value)).join('');
    const tone = result.tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900';
    return `
        <div class="mb-4 rounded-2xl border ${tone} p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="font-bold">${esc(result.title || 'Done')}</div>
                    ${result.text ? `<p class="mt-1 text-sm">${esc(result.text)}</p>` : ''}
                </div>
                <button type="button" data-action="dismiss-result" class="text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
            </div>
            ${rows}
        </div>`;
}

function summaryHtml(schools) {
    const summary = summarizeSchools(schools);
    const stat = (label, value, sub) => `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="text-xs font-black uppercase tracking-wider text-slate-500">${esc(label)}</div>
            <div class="mt-1 text-2xl font-black text-slate-900">${esc(value)}</div>
            <div class="mt-0.5 text-xs text-slate-500">${esc(sub)}</div>
        </div>`;
    return `
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            ${stat('Schools', summary.total, `${summary.active} active · ${summary.suspended} suspended`)}
            ${stat('Plans', `${summary.plans.starter + summary.plans.pro + summary.plans.elite} paid`, `Starter ${summary.plans.starter} · Pro ${summary.plans.pro} · Elite ${summary.plans.elite} · Pending ${summary.plans.pending}`)}
            ${stat('Yearly income', formatEuro(summary.income.total), `+ VAT · ${formatEuro(summary.income.online)} by card, ${formatEuro(summary.income.manual)} invoiced (estimate)`)}
            ${stat('Pay by card', summary.paysOnline, `${summary.total - summary.paysOnline} invoiced by you`)}
        </div>`;
}

function createFormHtml(open) {
    if (!open) return '';
    const options = TIER_OPTIONS.map(([value, label]) => `<option value="${value}"${value === 'pending' ? ' selected' : ''}>${label}</option>`).join('');
    return `
        <form data-role="create" class="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4" novalidate>
            <div class="mb-1 font-bold text-indigo-900">Add a school</div>
            <p class="mb-3 text-sm text-indigo-900/80">Choose <strong>Pending</strong> if the school will pay by card: it sees the plans and pays itself. Choose a plan if you invoice it.</p>
            <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-xs font-bold text-slate-600">School name
                    <input name="name" required maxlength="80" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="Φροντιστήριο Άλφα">
                </label>
                <label class="text-xs font-bold text-slate-600">School code <span class="font-normal">(in links and logins; cannot change)</span>
                    <input name="schoolId" required maxlength="63" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="alfa-patras">
                </label>
                <label class="text-xs font-bold text-slate-600">Plan
                    <select name="tier" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">${options}</select>
                </label>
                <label class="text-xs font-bold text-slate-600">Plan ends <span class="font-normal">(optional)</span>
                    <input name="endsAt" type="date" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                </label>
            </div>
            <div class="mt-3 flex gap-2">
                <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Create school</button>
                ${btn('Cancel', 'data-action="toggle-create"')}
            </div>
        </form>`;
}

function schoolRowHtml(school) {
    const income = schoolYearlyIncome(school);
    return `
        <tr class="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/60" data-open-school="${esc(school.schoolId)}" tabindex="0">
            <td class="px-3 py-2.5">
                <div class="font-bold text-slate-900">${esc(school.name)} ${school.founding ? '<span class="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Your school</span>' : ''}</div>
                <div class="text-xs text-slate-500">${esc(school.schoolId)}</div>
            </td>
            <td class="px-3 py-2.5">${tierBadge(school.tier)}${school.endsAt ? `<div class="mt-1 text-xs text-slate-500">until ${esc(date(school.endsAt))}</div>` : ''}</td>
            <td class="hidden px-3 py-2.5 text-sm text-slate-600 md:table-cell">${esc(billingLabel(school))}${income.amount ? `<div class="text-xs text-slate-400">${esc(formatEuro(income.amount))}/yr</div>` : ''}</td>
            <td class="hidden px-3 py-2.5 text-sm text-slate-600 sm:table-cell">${school.founding ? '' : (school.officeActive ? '<span class="text-emerald-700">Office ✓</span>' : '<span class="text-amber-700">Office not set up</span>')}<div class="text-xs text-slate-500">${school.teacherCount ?? '?'} teacher(s)</div></td>
            <td class="px-3 py-2.5 text-right">${statusBadge(school.status)}</td>
        </tr>`;
}

export function listPageHtml({ schools = [], founding = null, query = '', createOpen = false, result = null }) {
    const all = founding ? [founding, ...schools] : schools;
    const shown = filterSchools(all, query);
    return `
        ${resultHtml(result)}
        ${summaryHtml(schools)}
        <div class="mt-5 flex flex-wrap items-center gap-2">
            <input type="search" data-role="search" value="${esc(query)}" placeholder="Search a school by name or code…" class="min-w-[12rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            ${btn('<i class="fas fa-plus mr-1" aria-hidden="true"></i>Add a school', 'data-action="toggle-create"', 'primary')}
            ${btn('<i class="fas fa-rotate mr-1" aria-hidden="true"></i>Refresh', 'data-action="refresh"')}
        </div>
        <div class="mt-3">${createFormHtml(createOpen)}</div>
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left">
                <thead class="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                    <tr><th class="px-3 py-2">School</th><th class="px-3 py-2">Plan</th><th class="hidden px-3 py-2 md:table-cell">Billing</th><th class="hidden px-3 py-2 sm:table-cell">People</th><th class="px-3 py-2 text-right">Status</th></tr>
                </thead>
                <tbody>${shown.map(schoolRowHtml).join('') || '<tr><td colspan="5" class="px-3 py-6 text-center text-sm text-slate-500">No school matches.</td></tr>'}</tbody>
            </table>
        </div>`;
}

export function detailPageHtml(details, { result = null, deleteCode = '' } = {}) {
    const back = btn('<i class="fas fa-arrow-left mr-1" aria-hidden="true"></i>All schools', 'data-action="back"');
    if (!details) return `${back}<p class="mt-6 text-sm text-slate-500">Loading…</p>`;
    const header = `
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                ${back}
                <div>
                    <h2 class="text-xl font-black text-slate-900">${esc(details.name)}</h2>
                    <div class="text-xs text-slate-500">${esc(details.schoolId)}${details.createdAt ? ` · created ${esc(date(details.createdAt))}` : ''}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">${tierBadge(details.plan.tier)} ${statusBadge(details.status)}</div>
        </div>`;
    const counts = card('At a glance', `
        <div class="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            ${[['Classes', details.counts.classes], ['Students', details.counts.students], ['Teachers', details.counts.teachers], ['Family logins', details.counts.familyLogins]]
                .map(([label, value]) => `<div class="rounded-xl bg-slate-50 p-2"><div class="text-xl font-black text-slate-900">${value ?? '—'}</div><div class="text-xs text-slate-500">${label}</div></div>`).join('')}
        </div>`, { icon: 'fa-chart-simple' });

    if (details.founding) {
        return `${resultHtml(result)}${header}<div class="grid gap-3">${counts}
            ${card('Your school', '<p class="text-sm text-slate-600">This is the founding school. Its plan, office and teachers are managed from its own Secretary Office, never from here, so nothing on this page can change or delete it.</p>', { icon: 'fa-crown' })}</div>`;
    }

    const options = TIER_OPTIONS.map(([value, label]) => `<option value="${value}"${value === details.plan.tier ? ' selected' : ''}>${label}</option>`).join('');
    const stripeUrl = stripeCustomerUrl(details.billing);
    const paysOnline = Boolean(details.billing.stripeSubscriptionId);
    const planCard = card('Plan and billing', `
        <div class="flex flex-wrap items-end gap-2">
            <label class="text-xs font-bold text-slate-600">Plan
                <select data-field="tier" class="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">${options}</select>
            </label>
            <label class="text-xs font-bold text-slate-600">Plan ends
                <input data-field="endsAt" type="date" value="${esc(details.plan.endsAt ? details.plan.endsAt.slice(0, 10) : '')}" class="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            </label>
            ${btn('Save plan', 'data-action="save-plan"', 'primary')}
        </div>
        <p class="mt-2 text-xs text-slate-500">Empty end date = the plan never ends. ${paysOnline ? 'This school pays by card: Stripe changes its plan automatically, so change it here only if you know why.' : ''}</p>
        <div class="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            ${paysOnline
                ? `<strong>Pays by card</strong> · ${details.billing.interval === 'month' ? `monthly (${formatEuro(PLAN_PRICES[details.plan.tier]?.month || 0)} Sept–June)` : 'yearly (school year)'} · Stripe status: ${esc((details.billing.stripeStatus || 'unknown').replace(/_/g, ' '))}`
                : '<strong>Invoiced by you</strong> (no card payment on file).'}
            ${stripeUrl ? `<div class="mt-2"><a href="${esc(stripeUrl)}" target="_blank" rel="noopener" class="font-bold text-indigo-700 underline">Open this customer in Stripe</a></div>` : ''}
        </div>`, { icon: 'fa-credit-card' });

    const suspended = details.status !== 'active';
    const accessCard = card('Access', `
        <p class="mb-3 text-sm text-slate-600">${suspended ? 'Suspended: the office, teachers and families cannot use the app. Nothing is deleted.' : 'Active: everyone at this school can use the app.'}</p>
        ${suspended ? btn('Reactivate school', 'data-action="reactivate"', 'primary') : btn('Suspend school', 'data-action="suspend"')}`, { icon: 'fa-lock' });

    const officeCard = card('Office (Secretary)', `
        <p class="mb-3 text-sm text-slate-600">${details.office.active ? `Activated · username <strong>${esc(details.office.username || '—')}</strong>` : 'Not activated yet. Send the school its office setup link.'}</p>
        ${btn(details.office.active ? 'Office recovery link' : 'New office setup link', 'data-action="office-link"')}`, { icon: 'fa-scroll' });

    const teacherRows = details.teachers.map((teacher) => `
        <li class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2 first:border-t-0">
            <div class="min-w-0">
                <div class="font-bold text-slate-900">${esc(teacher.name)} ${teacher.status === 'active' ? '' : '<span class="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">Off</span>'}</div>
                <div class="truncate text-xs text-slate-500">${esc(teacher.email)}${teacher.lastSignIn ? ` · last sign-in ${esc(date(teacher.lastSignIn))}` : ''}</div>
            </div>
            <div class="flex gap-1.5">
                ${btn(teacher.status === 'active' ? 'Switch off' : 'Switch on', `data-action="teacher-status" data-uid="${esc(teacher.uid)}" data-status="${teacher.status === 'active' ? 'disabled' : 'active'}"`)}
                ${btn('Password link', `data-action="teacher-reset" data-uid="${esc(teacher.uid)}"`)}
            </div>
        </li>`).join('');
    const teachersCard = card(`Teachers (${details.teachers.length})`, `
        <ul class="mb-3">${teacherRows || '<li class="text-sm text-slate-500">No teachers yet. They join on the school link with the teacher code.</li>'}</ul>
        ${btn('New teacher code', 'data-action="join-code"')}`, { icon: 'fa-chalkboard-user' });

    const confirmed = deleteCode.trim().toLowerCase() === details.schoolId;
    const dangerCard = card('Danger zone', `
        <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-slate-700">Download everything this school has stored (one JSON file).</p>
            ${btn('<i class="fas fa-download mr-1" aria-hidden="true"></i>Download all data', 'data-action="export"')}
        </div>
        <div class="mt-4 border-t border-rose-200 pt-4">
            <p class="text-sm font-bold text-rose-800">Delete this school</p>
            <p class="mt-1 text-sm text-rose-900/80">Cancels its card payments, deletes every login (office, teachers, families), all classes, students, grades, diaries and pictures. <strong>This cannot be undone.</strong> Download the data first if you may need it.</p>
            <label class="mt-3 block text-xs font-bold text-rose-800">Type <code class="rounded bg-white px-1">${esc(details.schoolId)}</code> to confirm
                <input data-role="delete-code" value="${esc(deleteCode)}" autocomplete="off" class="mt-1 block w-full max-w-xs rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-sm">
            </label>
            <div class="mt-3">${btn('Delete school permanently', `data-action="delete" ${confirmed ? '' : 'disabled'}`, 'danger')}</div>
        </div>`, { tone: 'danger', icon: 'fa-triangle-exclamation' });

    return `${resultHtml(result)}${header}
        <div class="grid gap-3 lg:grid-cols-2">
            <div class="grid content-start gap-3">${planCard}${accessCard}${officeCard}</div>
            <div class="grid content-start gap-3">${counts}${teachersCard}</div>
        </div>
        <div class="mt-3">${dangerCard}</div>`;
}

export function shellHtml() {
    return `
        <div class="mx-auto my-4 w-full max-w-5xl overflow-hidden rounded-3xl bg-slate-50 text-left shadow-2xl ring-1 ring-black/5 sm:my-8" role="dialog" aria-modal="true" aria-labelledby="operator-console-title">
            <div class="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-4 text-white">
                <div>
                    <h2 id="operator-console-title" class="font-title text-2xl">Operator console</h2>
                    <p data-role="message" class="text-sm text-white/70">Loading…</p>
                </div>
                <button type="button" data-action="close" class="rounded-full px-3 py-1 text-2xl text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>
            </div>
            <div data-role="body" class="p-4 sm:p-5"></div>
        </div>`;
}
