// Operator console: create schools, change their plan, suspend them, and issue the links and
// codes their office and teachers need. Opened with #operator while signed in; lazily loaded.
// Every action is checked again by the server (functions/platform.js), so this file only shows.
import {
    claimOperator,
    getOperatorStatus,
    opCreateSchool,
    opIssueSecretaryLink,
    opListSchools,
    opResetTeacherJoinCode,
    opUpdateSchool
} from '../utils/adminRuntime.js';
import { suggestSchoolCode } from './operatorConsoleCore.mjs';

const OVERLAY_ID = 'operator-console';
const TIERS = [['pending', 'Pending (locked)'], ['starter', 'Starter'], ['pro', 'Pro'], ['elite', 'Elite']];

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function siteBase() {
    return `${window.location.origin}${window.location.pathname}`;
}

function officeLink(schoolId, token) {
    return `${siteBase()}?school=${encodeURIComponent(schoolId)}#secretary-setup=${encodeURIComponent(token)}`;
}

function schoolLink(schoolId) {
    return `${siteBase()}?school=${encodeURIComponent(schoolId)}`;
}

function tierOptions(selected) {
    return TIERS.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
}

function copyRow(label, value) {
    return `
        <div class="mt-2">
            <div class="text-xs font-bold uppercase tracking-wide text-slate-500">${esc(label)}</div>
            <div class="mt-1 flex gap-2">
                <input readonly class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-sm" value="${esc(value)}">
                <button type="button" data-copy="${esc(value)}" class="rounded-lg bg-slate-800 px-3 py-1 text-sm font-bold text-white">Copy</button>
            </div>
        </div>`;
}

function resultHtml(result) {
    if (!result) return '';
    const parts = [];
    if (result.setupToken) parts.push(copyRow(`Office setup link (one use, until ${result.expiresAt?.slice(0, 10) || 'soon'})`, officeLink(result.schoolId, result.setupToken)));
    if (result.joinCode) {
        parts.push(copyRow('School link for teachers, parents and the office', schoolLink(result.schoolId)));
        parts.push(copyRow('Teacher code (teachers type it when they create their account)', result.joinCode));
    }
    return `
        <div class="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
            <div class="font-bold text-emerald-800">${esc(result.title || 'Done')}</div>
            <p class="text-sm text-emerald-900">Send these to the school now. The link and the code are shown only this once; you can always issue new ones.</p>
            ${parts.join('')}
        </div>`;
}

function schoolRowHtml(school) {
    const suspended = school.status === 'suspended';
    return `
        <li class="rounded-xl border border-slate-200 p-3" data-school-id="${esc(school.schoolId)}">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <span class="font-bold text-slate-800">${esc(school.name)}</span>
                    <span class="ml-1 text-sm text-slate-500">${esc(school.schoolId)}</span>
                </div>
                <div class="text-xs text-slate-600">
                    <span class="rounded-full px-2 py-0.5 ${suspended ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">${suspended ? 'Suspended' : 'Active'}</span>
                    <span class="ml-1">${school.officeActive ? 'Office activated' : 'Office not activated yet'}</span>
                    <span class="ml-1">· ${school.teacherCount ?? '?'} teacher(s)</span>
                </div>
            </div>
            <div class="mt-2 flex flex-wrap items-end gap-2">
                <label class="text-xs font-bold text-slate-600">Plan
                    <select data-field="tier" class="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm">${tierOptions(school.tier)}</select>
                </label>
                <label class="text-xs font-bold text-slate-600">Plan ends (optional)
                    <input data-field="endsAt" type="date" value="${esc(school.endsAt ? school.endsAt.slice(0, 10) : '')}" class="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm">
                </label>
                <button type="button" data-action="save-plan" class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-bold text-white">Save plan</button>
                <button type="button" data-action="${suspended ? 'reactivate' : 'suspend'}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">${suspended ? 'Reactivate' : 'Suspend'}</button>
                <button type="button" data-action="office-link" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">New office link</button>
                <button type="button" data-action="join-code" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">New teacher code</button>
            </div>
        </li>`;
}

function shellHtml() {
    return `
        <div class="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 text-left shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="operator-console-title">
            <div class="flex items-center justify-between gap-3">
                <h2 id="operator-console-title" class="font-title text-2xl text-slate-800">Operator console</h2>
                <button type="button" data-action="close" class="rounded-full px-3 py-1 text-xl text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>
            <p data-role="message" class="mt-2 text-sm text-slate-600">Loading…</p>
            <div data-role="body"></div>
        </div>`;
}

function createFormHtml() {
    return `
        <form data-role="create" class="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3" novalidate>
            <div class="font-bold text-indigo-900">Add a school</div>
            <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <label class="text-xs font-bold text-slate-600">School name
                    <input name="name" required maxlength="80" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" placeholder="Φροντιστήριο Άλφα">
                </label>
                <label class="text-xs font-bold text-slate-600">School code (in links and logins; cannot change later)
                    <input name="schoolId" required maxlength="63" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" placeholder="alfa-patras">
                </label>
                <label class="text-xs font-bold text-slate-600">Plan
                    <select name="tier" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 text-sm">${tierOptions('pro')}</select>
                </label>
                <label class="text-xs font-bold text-slate-600">Plan ends (optional)
                    <input name="endsAt" type="date" class="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 text-sm">
                </label>
            </div>
            <button type="submit" class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Create school</button>
        </form>`;
}

function closeConsole() {
    document.getElementById(OVERLAY_ID)?.remove();
    if (window.location.hash === '#operator') {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
}

export async function openOperatorConsole() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4';
    overlay.innerHTML = shellHtml();
    document.body.appendChild(overlay);

    const message = overlay.querySelector('[data-role="message"]');
    const body = overlay.querySelector('[data-role="body"]');
    let lastResult = null;
    let schoolCodeEdited = false;

    const say = (text, tone = 'info') => {
        message.textContent = text;
        message.className = `mt-2 text-sm ${tone === 'error' ? 'font-bold text-rose-700' : 'text-slate-600'}`;
    };

    async function renderOperator() {
        const { schools = [] } = await opListSchools();
        body.innerHTML = `
            ${resultHtml(lastResult)}
            ${createFormHtml()}
            <h3 class="mt-5 font-bold text-slate-800">Schools (${schools.length})</h3>
            <p class="text-xs text-slate-500">Your own school is managed as before and is not listed here.</p>
            <ul class="mt-2 space-y-2">${schools.map(schoolRowHtml).join('') || '<li class="text-sm text-slate-500">No schools yet.</li>'}</ul>`;
        say('Signed in as the platform operator.');
    }

    async function render() {
        const status = await getOperatorStatus();
        if (status?.isOperator) return renderOperator();
        if (status?.canClaim) {
            say('No operator has been set up yet. As your school’s Secretary you can claim the operator console once.');
            body.innerHTML = '<button type="button" data-action="claim" class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Claim the operator console</button>';
            return;
        }
        say(`This account is not the platform operator. Account id: ${status?.uid || 'unknown'}`, 'error');
        body.innerHTML = '';
    }

    async function run(button, work) {
        if (button) button.disabled = true;
        try {
            await work();
        } catch (error) {
            say(error?.message || 'That did not work. Try again.', 'error');
        } finally {
            if (button?.isConnected) button.disabled = false;
        }
    }

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) return closeConsole();
        const copy = event.target.closest('[data-copy]');
        if (copy) {
            navigator.clipboard?.writeText(copy.dataset.copy).then(() => { copy.textContent = 'Copied'; }).catch(() => {});
            return;
        }
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'close') return closeConsole();
        if (action === 'claim') return run(button, async () => { await claimOperator(); await render(); });
        const row = button.closest('[data-school-id]');
        const schoolId = row?.dataset.schoolId;
        if (!schoolId) return;
        if (action === 'save-plan') {
            return run(button, async () => {
                const tier = row.querySelector('[data-field="tier"]').value;
                const endsAt = row.querySelector('[data-field="endsAt"]').value || null;
                await opUpdateSchool({ schoolId, tier, endsAt });
                lastResult = null;
                await renderOperator();
                say(`Saved the plan for ${schoolId}.`);
            });
        }
        if (action === 'suspend' || action === 'reactivate') {
            if (action === 'suspend' && !window.confirm(`Suspend ${schoolId}? Its teachers, office and families lose access until you reactivate it. No data is deleted.`)) return;
            return run(button, async () => {
                await opUpdateSchool({ schoolId, status: action === 'suspend' ? 'suspended' : 'active' });
                lastResult = null;
                await renderOperator();
            });
        }
        if (action === 'office-link') {
            return run(button, async () => {
                const result = await opIssueSecretaryLink({ schoolId });
                lastResult = { ...result, title: result.purpose === 'recovery' ? `New office recovery link for ${schoolId}` : `Office setup link for ${schoolId}` };
                await renderOperator();
            });
        }
        if (action === 'join-code') {
            if (!window.confirm(`Make a new teacher code for ${schoolId}? The old code stops working. Teachers who already joined are not affected.`)) return;
            return run(button, async () => {
                const result = await opResetTeacherJoinCode({ schoolId });
                lastResult = { ...result, title: `New teacher code for ${schoolId}` };
                await renderOperator();
            });
        }
    });

    overlay.addEventListener('input', (event) => {
        const form = event.target.closest('[data-role="create"]');
        if (!form) return;
        if (event.target.name === 'schoolId') schoolCodeEdited = true;
        if (event.target.name === 'name' && !schoolCodeEdited) form.elements.schoolId.value = suggestSchoolCode(event.target.value);
    });

    overlay.addEventListener('submit', (event) => {
        const form = event.target.closest('[data-role="create"]');
        if (!form) return;
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        run(button, async () => {
            const result = await opCreateSchool({
                name: form.elements.name.value,
                schoolId: form.elements.schoolId.value.trim().toLowerCase(),
                tier: form.elements.tier.value,
                endsAt: form.elements.endsAt.value || null
            });
            lastResult = { ...result, title: `Created ${result.name} (${result.schoolId})` };
            schoolCodeEdited = false;
            await renderOperator();
        });
    });

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeConsole();
    });

    try {
        await render();
    } catch (error) {
        say(error?.message || 'The operator console could not load.', 'error');
    }
}
