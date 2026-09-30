// ui/authScreen.js — the Quest Gate's presentation: role copy, friendly error cards,
// password peek, Caps Lock warning, username hint, QR deep link and remembered role.
// app.js owns the sign-in flow itself; this file only shapes what people see.

import { friendlyAuthError } from '../utils/friendlyErrors.js';
import { normalizeUsername, ROLE_PARENT, ROLE_SECRETARY, ROLE_TEACHER } from '../utils/roles.js';

const LAST_ROLE_KEY = 'gcq.lastAuthRole';
const LAST_USERNAME_KEY = 'gcq_lastAuthUsername';
const VALID_ROLES = new Set([ROLE_TEACHER, ROLE_PARENT, ROLE_SECRETARY]);

// Words a link or QR code may use for each door.
const DEEP_LINK_ROLES = {
    parent: ROLE_PARENT,
    parents: ROLE_PARENT,
    family: ROLE_PARENT,
    families: ROLE_PARENT,
    teacher: ROLE_TEACHER,
    teachers: ROLE_TEACHER,
    secretary: ROLE_SECRETARY,
    office: ROLE_SECRETARY,
    admin: ROLE_SECRETARY
};

export const AUTH_ROLE_COPY = {
    [ROLE_TEACHER]: {
        keystone: 'fa-hat-wizard',
        kicker: 'Welcome back, teacher',
        lede: 'Your classes, stars and adventures are waiting beyond the gate.',
        list: [
            ['fa-star', 'Award stars and watch the class sky light up'],
            ['fa-book-open', 'Keep the Adventure Log and trials in one place'],
            ['fa-people-group', 'Guide guilds, quests and ceremonies']
        ],
        login: { title: 'Teacher sign in', subtitle: 'Use the email you signed up with.' },
        signup: { title: 'Create your teacher account', subtitle: 'It takes a minute. The school office will see you once you join.' },
        footnote: 'Families: scan the school’s QR code to land straight on the Parent sign-in.'
    },
    [ROLE_PARENT]: {
        keystone: 'fa-house-chimney-user',
        kicker: 'Welcome, families',
        lede: 'Follow your child’s quest from home: homework, stars, progress and notes from school.',
        list: [
            ['fa-scroll', 'See homework and upcoming tests'],
            ['fa-star', 'Celebrate the stars your child earns'],
            ['fa-envelope-open-text', 'Send a note to the school office']
        ],
        login: { title: 'Family sign in', subtitle: 'Use the username and password the school gave you.' },
        footnote: 'Lost your details? Your child’s teacher or the school office can set a new password in seconds.'
    },
    [ROLE_SECRETARY]: {
        keystone: 'fa-scroll',
        kicker: 'School office',
        lede: 'Enrol students, open classes, manage family logins and keep the school year on track.',
        list: [
            ['fa-folder-open', 'Students, classes and former students'],
            ['fa-key', 'Family logins for every student'],
            ['fa-calendar-check', 'School year, holidays and grading']
        ],
        login: { title: 'Secretary sign in', subtitle: 'Use the username chosen when the school was activated.' },
        footnote: ''
    }
};

const ACTIVATION_COPY = {
    keystone: 'fa-key',
    kicker: 'School activation',
    lede: 'This one-time link creates the school’s administrator account.',
    list: []
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readStorage(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (_) { return ''; }
}

function writeStorage(key, value) {
    try {
        if (value) window.localStorage.setItem(key, value);
        else window.localStorage.removeItem(key);
    } catch (_) { /* storage unavailable */ }
}

/**
 * The role a QR code or link asked for: ?login=parent, ?role=parent or #parent.
 * The request is removed from the address bar so a refresh or bookmark stays clean.
 */
export function consumeAuthDeepLinkRole() {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('login') || url.searchParams.get('role') || '';
    const hash = url.hash.replace(/^#/, '').trim().toLowerCase();
    const fromHash = DEEP_LINK_ROLES[hash] ? hash : '';
    const role = DEEP_LINK_ROLES[String(fromQuery || fromHash).trim().toLowerCase()] || '';
    if (!role) return '';
    url.searchParams.delete('login');
    url.searchParams.delete('role');
    if (fromHash) url.hash = '';
    try {
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) { /* address bar stays as it was */ }
    return role;
}

export function readRememberedAuthRole() {
    const role = readStorage(LAST_ROLE_KEY);
    return VALID_ROLES.has(role) ? role : '';
}

export function rememberAuthRole(role) {
    if (VALID_ROLES.has(role)) writeStorage(LAST_ROLE_KEY, role);
}

/** Usernames are remembered only on devices the person marked as their own. */
export function rememberAuthUsername(role, username, { trustedDevice = false } = {}) {
    if (!trustedDevice || role === ROLE_TEACHER) return;
    writeStorage(LAST_USERNAME_KEY, username ? `${role}:${username}` : '');
}

export function readRememberedUsername(role) {
    const saved = readStorage(LAST_USERNAME_KEY);
    const [savedRole, savedUser] = saved.split(':');
    return savedRole === role ? (savedUser || '') : '';
}

/** Paints the welcome column, keystone, footnote and arrival note for a role. */
export function paintAuthRoleCopy(role, { mode = 'login', activation = false, arrivedByLink = false } = {}) {
    const screen = document.getElementById('auth-screen');
    const copy = activation ? ACTIVATION_COPY : (AUTH_ROLE_COPY[role] || AUTH_ROLE_COPY[ROLE_TEACHER]);
    if (screen) screen.dataset.authRole = activation ? 'activation' : role;

    const kicker = document.querySelector('[data-auth-welcome-kicker]');
    const lede = document.querySelector('[data-auth-welcome-lede]');
    const list = document.querySelector('[data-auth-welcome-list]');
    const footnote = document.querySelector('[data-auth-footnote]');
    const keystone = document.querySelector('[data-auth-keystone-icon]');
    if (kicker) kicker.textContent = copy.kicker;
    if (lede) lede.textContent = copy.lede;
    if (list) {
        const next = (copy.list || []).map(([icon, text]) => `<li><i class="fas ${icon}" aria-hidden="true"></i><span>${escapeHtml(text)}</span></li>`).join('');
        if (list.dataset.role !== (activation ? 'activation' : role)) {
            list.innerHTML = next;
            list.dataset.role = activation ? 'activation' : role;
        }
    }
    if (footnote) footnote.textContent = activation ? '' : (copy.footnote || '');
    if (keystone && !keystone.classList.contains(copy.keystone)) {
        keystone.className = `fas ${copy.keystone}`;
        const stone = keystone.parentElement;
        stone?.classList.remove('is-turning');
        void stone?.offsetWidth;
        stone?.classList.add('is-turning');
        setTimeout(() => stone?.classList.remove('is-turning'), 420);
    }

    document.querySelectorAll('#auth-role-switcher .auth-role-btn').forEach((btn) => {
        btn.setAttribute('aria-selected', btn.dataset.authRole === role ? 'true' : 'false');
    });
    const usernameInput = document.getElementById('login-username');
    if (usernameInput) usernameInput.placeholder = role === ROLE_SECRETARY ? 'e.g. office' : 'e.g. maria.p';
    document.getElementById('auth-arrival')?.classList.toggle('hidden', !(arrivedByLink && role === ROLE_PARENT && !activation));

    const forgot = document.getElementById('auth-forgot-btn');
    if (forgot) forgot.classList.toggle('hidden', activation || mode !== 'login');
    if (activation) return null;
    return (mode === 'signup' && copy.signup) || copy.login;
}

// ── Friendly errors ─────────────────────────────────────────────────────────

const FIELD_IDS = {
    login: { id: ['login-email-wrap', 'login-username-wrap'], password: ['login-password'], email: ['login-email-wrap'] },
    signup: { id: ['signup-email'], email: ['signup-email'], password: ['signup-password'], name: ['signup-name'] },
    activation: { id: ['activation-username'], password: ['activation-password'], name: ['activation-display-name'] }
};

function fieldFor(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return null;
    return el.classList.contains('auth-field') ? el : el.closest('.auth-field');
}

export function clearAuthError() {
    const box = document.getElementById('auth-error');
    if (box) {
        box.innerHTML = '';
        box.className = 'auth-error';
    }
    document.querySelectorAll('#auth-screen .auth-field.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
}

/**
 * Shows a friendly card under the form. Accepts a Firebase error, a plain message,
 * or { title, text, field }. field points the red outline at the right input.
 */
export function showAuthError(problem, { role = ROLE_TEACHER, form = 'login', tone = 'error' } = {}) {
    clearAuthError();
    const box = document.getElementById('auth-error');
    if (!box) return;
    let details;
    if (problem && typeof problem === 'object' && 'title' in problem) details = problem;
    else if (typeof problem === 'string') details = { title: problem, text: '', field: '' };
    else details = friendlyAuthError(problem, { role });

    // Sit the card right above the button that was pressed, so it's seen without scrolling.
    const activeForm = [...document.querySelectorAll('#login-form-container form')].find((form) => !form.classList.contains('hidden'));
    const submit = activeForm?.querySelector('[type="submit"]');
    if (submit && box.nextElementSibling !== submit) submit.before(box);

    const icon = tone === 'notice' ? 'fa-circle-info' : 'fa-face-frown-open';
    box.className = `auth-error${tone === 'notice' ? ' auth-error--notice' : ''}`;
    box.innerHTML = `
        <span class="auth-error__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
        <span><strong class="auth-error__title">${escapeHtml(details.title)}</strong>${details.text ? escapeHtml(details.text) : ''}</span>`;

    const targets = FIELD_IDS[form]?.[details.field] || [];
    let focusTarget = null;
    targets.forEach((id) => {
        const field = fieldFor(id);
        if (!field || field.classList.contains('hidden')) return;
        field.classList.add('is-invalid');
        focusTarget ||= field.querySelector('input');
    });
    if (focusTarget && details.field !== 'password') focusTarget.focus({ preventScroll: true });
    box.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}

// ── Field helpers ───────────────────────────────────────────────────────────

function setPeek(button, visible) {
    const input = document.getElementById(button.dataset.authPeek);
    if (!input) return;
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', visible ? 'true' : 'false');
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.innerHTML = `<i class="fas ${visible ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>`;
}

/** Hides every revealed password again (after a sign-in attempt or sign-out). */
export function resetPasswordPeeks() {
    document.querySelectorAll('#auth-screen [data-auth-peek]').forEach((button) => setPeek(button, false));
}

function passwordLevel(value) {
    const text = String(value || '');
    if (!text) return 0;
    if (text.length < 6) return 1;
    const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(text)).length;
    return text.length >= 10 && variety >= 2 ? 3 : 2;
}

/** Shows the username a parent or secretary will actually sign in with, when typing changed it. */
export function updateUsernameHint() {
    const input = document.getElementById('login-username');
    const hint = document.getElementById('login-username-hint');
    if (!input || !hint) return;
    const typed = input.value.trim();
    const normalized = normalizeUsername(typed);
    if (!typed || typed === normalized) {
        hint.classList.add('hidden');
        hint.innerHTML = '';
        return;
    }
    hint.classList.remove('hidden');
    hint.innerHTML = normalized
        ? `Usernames have no spaces or capitals, so we’ll use <code>${escapeHtml(normalized)}</code>.`
        : 'Usernames use English letters, numbers, dots or dashes.';
}

export function wireAuthFieldHelpers() {
    const screen = document.getElementById('auth-screen');
    if (!screen || screen.dataset.helpersWired) return;
    screen.dataset.helpersWired = '1';

    screen.addEventListener('click', (event) => {
        const peek = event.target.closest('[data-auth-peek]');
        if (!peek) return;
        setPeek(peek, peek.getAttribute('aria-pressed') !== 'true');
        document.getElementById(peek.dataset.authPeek)?.focus({ preventScroll: true });
    });

    const capsCheck = (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !event.getModifierState) return;
        const hint = screen.querySelector(`[data-auth-caps-for="${input.id}"]`);
        if (hint) hint.classList.toggle('hidden', !event.getModifierState('CapsLock'));
    };
    screen.addEventListener('keydown', capsCheck);
    screen.addEventListener('keyup', capsCheck);
    screen.addEventListener('focusout', (event) => {
        const hint = screen.querySelector(`[data-auth-caps-for="${event.target?.id}"]`);
        hint?.classList.add('hidden');
    });

    screen.addEventListener('input', (event) => {
        const target = event.target;
        target.closest?.('.auth-field')?.classList.remove('is-invalid');
        if (target.id === 'login-username') updateUsernameHint();
        if (target.id === 'signup-password') {
            const meter = screen.querySelector('[data-auth-strength]');
            if (meter) meter.dataset.level = String(passwordLevel(target.value));
        }
    });
}

/** The "Forgot password?" panel. Teachers get a reset email; families and the office get who to ask. */
export function renderForgotPanel(role, { email = '', onSendReset } = {}) {
    const panel = document.getElementById('auth-forgot-panel');
    if (!panel) return;
    if (!panel.classList.contains('hidden') && panel.dataset.role === role) {
        panel.classList.add('hidden');
        return;
    }
    panel.dataset.role = role;
    panel.classList.remove('hidden');
    if (role === ROLE_PARENT) {
        panel.innerHTML = `<strong>No problem.</strong> Family passwords are set by the school. Ask your child’s teacher or the school office, and they can give you a new one in seconds.
            <div class="auth-forgot__actions"><button type="button" class="auth-forgot__btn auth-forgot__btn--quiet" data-auth-forgot-close>Got it</button></div>`;
    } else if (role === ROLE_SECRETARY) {
        panel.innerHTML = `<strong>Forgot the office password?</strong> If you’re still signed in on another device, change it under Admin → School Details. Otherwise ask the school’s technical contact for a recovery link.
            <div class="auth-forgot__actions"><button type="button" class="auth-forgot__btn auth-forgot__btn--quiet" data-auth-forgot-close>Got it</button></div>`;
    } else {
        panel.innerHTML = `<strong>We’ll email you a reset link.</strong> ${email ? `It goes to <code>${escapeHtml(email)}</code>.` : 'Type your email above first.'}
            <div class="auth-forgot__actions">
                <button type="button" class="auth-forgot__btn" data-auth-send-reset ${email ? '' : 'disabled'}>Send reset link</button>
                <button type="button" class="auth-forgot__btn auth-forgot__btn--quiet" data-auth-forgot-close>Cancel</button>
            </div>`;
        panel.querySelector('[data-auth-send-reset]')?.addEventListener('click', (event) => onSendReset?.(event.currentTarget));
    }
    panel.querySelector('[data-auth-forgot-close]')?.addEventListener('click', () => panel.classList.add('hidden'));
}

export function hideForgotPanel() {
    document.getElementById('auth-forgot-panel')?.classList.add('hidden');
}
