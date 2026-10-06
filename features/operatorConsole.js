// Operator console: an overview of every school, and a page per school to manage its plan,
// access, office, teachers and data, or delete it. Opened with #operator while signed in;
// lazily loaded. Every action is checked again by the server (functions/platform*.js).
import {
    claimOperator,
    getOperatorStatus,
    opCreateSchool,
    opDeleteSchool,
    opExportSchool,
    opGetSchoolDetails,
    opIssueSecretaryLink,
    opListSchools,
    opResetTeacherJoinCode,
    opSetTeacherStatus,
    opTeacherPasswordLink,
    opUpdateSchool
} from '../utils/adminRuntime.js';
import { suggestSchoolCode } from './operatorConsoleCore.mjs';
import { detailPageHtml, listPageHtml, shellHtml } from './operatorConsoleView.mjs';

const OVERLAY_ID = 'operator-console';

function siteBase() {
    return `${window.location.origin}${window.location.pathname}`;
}
const officeLink = (schoolId, token) => `${siteBase()}?school=${encodeURIComponent(schoolId)}#secretary-setup=${encodeURIComponent(token)}`;
const schoolLink = (schoolId) => `${siteBase()}?school=${encodeURIComponent(schoolId)}`;

function closeConsole() {
    document.getElementById(OVERLAY_ID)?.remove();
    document.body.style.overflow = '';
    if (window.location.hash === '#operator') {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
}

export async function openOperatorConsole() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'fixed inset-0 z-[120] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6';
    overlay.innerHTML = shellHtml();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const message = overlay.querySelector('[data-role="message"]');
    const body = overlay.querySelector('[data-role="body"]');
    const view = {
        page: 'list', schools: [], founding: null, query: '', createOpen: false,
        result: null, details: null, schoolId: '', deleteCode: '', codeEdited: false
    };

    const say = (text, tone = 'info') => {
        message.textContent = text;
        message.className = `text-sm ${tone === 'error' ? 'font-bold text-rose-300' : 'text-white/70'}`;
    };

    function render() {
        body.innerHTML = view.page === 'detail'
            ? detailPageHtml(view.details, { result: view.result, deleteCode: view.deleteCode })
            : listPageHtml(view);
    }

    async function loadList() {
        const { schools = [], founding = null } = await opListSchools();
        view.schools = schools;
        view.founding = founding;
    }

    async function loadDetails() {
        view.details = await opGetSchoolDetails({ schoolId: view.schoolId });
    }

    async function showList({ reload = true } = {}) {
        view.page = 'list';
        view.details = null;
        view.deleteCode = '';
        if (reload) await loadList();
        render();
        say('Every school at a glance. Open one to manage it.');
    }

    async function showSchool(schoolId) {
        view.page = 'detail';
        view.schoolId = schoolId;
        view.details = null;
        view.deleteCode = '';
        render();
        await loadDetails();
        render();
        say(`Managing ${view.details.name}.`);
    }

    async function start() {
        const status = await getOperatorStatus();
        if (status?.isOperator) return showList();
        if (status?.canClaim) {
            say('No operator has been set up yet.');
            body.innerHTML = `
                <p class="text-sm text-slate-700">As your school's Secretary you can claim the operator console once. After that, only this account can open it.</p>
                <button type="button" data-action="claim" class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Claim the operator console</button>`;
            return undefined;
        }
        say('This account is not the platform operator.', 'error');
        body.innerHTML = `<p class="text-sm text-slate-600">Account id: <code>${status?.uid || 'unknown'}</code></p>`;
        return undefined;
    }

    async function run(button, work) {
        if (button) button.disabled = true;
        try {
            await work();
        } catch (error) {
            say(error?.message || 'That did not work. Try again.', 'error');
            if (button?.isConnected) button.disabled = false;
        }
    }

    const setResult = (result) => { view.result = result; };

    const actions = {
        close: () => closeConsole(),
        claim: (button) => run(button, async () => { await claimOperator(); await start(); }),
        'dismiss-result': () => { view.result = null; render(); },
        refresh: (button) => run(button, () => showList()),
        'toggle-create': () => { view.createOpen = !view.createOpen; view.codeEdited = false; render(); },
        back: () => run(null, () => showList()),
        'save-plan': (button) => run(button, async () => {
            const tier = body.querySelector('[data-field="tier"]').value;
            const endsAt = body.querySelector('[data-field="endsAt"]').value || null;
            await opUpdateSchool({ schoolId: view.schoolId, tier, endsAt });
            setResult({ title: 'Plan saved', text: endsAt ? `Runs until ${endsAt}.` : 'No end date: it runs until you change it.' });
            await showSchool(view.schoolId);
        }),
        suspend: (button) => {
            if (!window.confirm('Suspend this school? Its office, teachers and families lose access until you reactivate it. Nothing is deleted.')) return;
            run(button, async () => {
                await opUpdateSchool({ schoolId: view.schoolId, status: 'suspended' });
                setResult({ title: 'School suspended', text: 'Reactivate it any time; everything is kept.', tone: 'warn' });
                await showSchool(view.schoolId);
            });
        },
        reactivate: (button) => run(button, async () => {
            await opUpdateSchool({ schoolId: view.schoolId, status: 'active' });
            setResult({ title: 'School reactivated' });
            await showSchool(view.schoolId);
        }),
        'office-link': (button) => run(button, async () => {
            const result = await opIssueSecretaryLink({ schoolId: view.schoolId });
            setResult({
                title: result.purpose === 'recovery' ? 'Office recovery link' : 'Office setup link',
                text: `One use, valid until ${result.expiresAt?.slice(0, 10) || 'soon'}. Send it to the school office.`,
                rows: [['Office link', officeLink(view.schoolId, result.setupToken)]]
            });
            render();
        }),
        'join-code': (button) => {
            if (!window.confirm('Make a new teacher code? The old one stops working; teachers who already joined are not affected.')) return;
            run(button, async () => {
                const result = await opResetTeacherJoinCode({ schoolId: view.schoolId });
                setResult({ title: 'New teacher code', text: 'Teachers type it when they create their account on the school link.', rows: [['School link', schoolLink(view.schoolId)], ['Teacher code', result.joinCode]] });
                render();
            });
        },
        'teacher-status': (button) => run(button, async () => {
            await opSetTeacherStatus({ schoolId: view.schoolId, uid: button.dataset.uid, status: button.dataset.status });
            setResult({ title: button.dataset.status === 'active' ? 'Teacher switched on' : 'Teacher switched off', text: button.dataset.status === 'active' ? 'They can sign in again.' : 'They are signed out and cannot sign in. Their classes are kept.' });
            await showSchool(view.schoolId);
        }),
        'teacher-reset': (button) => run(button, async () => {
            const result = await opTeacherPasswordLink({ schoolId: view.schoolId, uid: button.dataset.uid });
            setResult({ title: 'Password reset link', text: `Send it to ${result.email}. It lets them choose a new password.`, rows: [['Reset link', result.link]] });
            render();
        }),
        export: (button) => run(button, async () => {
            say('Collecting all of this school’s data…');
            const result = await opExportSchool({ schoolId: view.schoolId });
            setResult({ title: 'Data export ready', text: `${result.documents} records and ${result.profiles} logins. The link downloads one JSON file; keep it somewhere safe.`, rows: [['Download link', result.url]] });
            render();
            window.open(result.url, '_blank', 'noopener');
            say(`Managing ${view.details.name}.`);
        }),
        delete: (button) => {
            const { schoolId, name } = view.details;
            if (!window.confirm(`Delete ${name} (${schoolId}) permanently? This cannot be undone.`)) return;
            run(button, async () => {
                say(`Deleting ${name}… this can take a minute.`);
                const result = await opDeleteSchool({ schoolId, confirm: view.deleteCode });
                setResult({ title: `${name} was deleted`, text: `${result.logins} logins, ${result.classes} classes, ${result.students} students and ${result.files} pictures removed.` });
                await showList();
            });
        }
    };

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) return closeConsole();
        const copy = event.target.closest('[data-copy]');
        if (copy) {
            navigator.clipboard?.writeText(copy.dataset.copy).then(() => { copy.textContent = 'Copied'; }).catch(() => {});
            return;
        }
        const row = event.target.closest('[data-open-school]');
        if (row) {
            run(null, () => showSchool(row.dataset.openSchool));
            return;
        }
        const button = event.target.closest('[data-action]');
        const action = button && actions[button.dataset.action];
        if (action) action(button);
    });

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeConsole();
        const row = event.target.closest?.('[data-open-school]');
        if (row && event.key === 'Enter') run(null, () => showSchool(row.dataset.openSchool));
    });

    overlay.addEventListener('input', (event) => {
        const target = event.target;
        if (target.matches('[data-role="search"]')) {
            view.query = target.value;
            const caret = target.selectionStart;
            render();
            const search = body.querySelector('[data-role="search"]');
            search?.focus();
            search?.setSelectionRange(caret, caret);
            return;
        }
        if (target.matches('[data-role="delete-code"]')) {
            view.deleteCode = target.value;
            const deleteButton = body.querySelector('[data-action="delete"]');
            if (deleteButton) deleteButton.disabled = target.value.trim().toLowerCase() !== view.details?.schoolId;
            return;
        }
        const form = target.closest('[data-role="create"]');
        if (!form) return;
        if (target.name === 'schoolId') view.codeEdited = true;
        if (target.name === 'name' && !view.codeEdited) form.elements.schoolId.value = suggestSchoolCode(target.value);
    });

    overlay.addEventListener('submit', (event) => {
        const form = event.target.closest('[data-role="create"]');
        if (!form) return;
        event.preventDefault();
        run(form.querySelector('button[type="submit"]'), async () => {
            const result = await opCreateSchool({
                name: form.elements.name.value,
                schoolId: form.elements.schoolId.value.trim().toLowerCase(),
                tier: form.elements.tier.value,
                endsAt: form.elements.endsAt.value || null
            });
            view.createOpen = false;
            view.codeEdited = false;
            setResult({
                title: `Created ${result.name} (${result.schoolId})`,
                text: 'Send these to the school now. They are shown only once; you can always make new ones from the school’s page.',
                rows: [
                    [`Office setup link (one use, until ${result.expiresAt?.slice(0, 10) || 'soon'})`, officeLink(result.schoolId, result.setupToken)],
                    ['School link for teachers, the office and families', schoolLink(result.schoolId)],
                    ['Teacher code', result.joinCode]
                ]
            });
            await showList();
        });
    });

    try {
        await start();
    } catch (error) {
        say(error?.message || 'The operator console could not load.', 'error');
    }
}
