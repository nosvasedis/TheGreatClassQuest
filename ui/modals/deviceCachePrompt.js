/*
 * The "Keep this device fast?" prompt: the Lantern Keep.
 *
 * Asked once per browser, after the first sign-in settles. A twilight band with a
 * lantern up top, then two big choice cards: "Only me" (the lantern stays lit:
 * GCQ keeps its protected cache here) and "Other people too" (GCQ tidies up on
 * sign-out). Lazy-loaded by utils/deviceCache.js#offerDeviceCacheChoice so none of
 * this (or its CSS) rides in the startup bundle.
 */
import { ROLE_PARENT, ROLE_SECRETARY, ROLE_TEACHER } from '../../utils/roles.js';
import { saveDeviceCacheChoice } from '../../utils/deviceCache.js';
import '../../styles/device_cache_prompt.css';

// Wording adapts to who is actually signed in, since this prompt fires for
// teachers, secretaries/admins, and parents alike. Family wording stays in
// plain everyday words: many parents are not "tech" people.
const ROLE_COPY = {
    [ROLE_TEACHER]: {
        title: 'Keep this teacher device fast?',
        lede: 'One quick choice so GCQ knows how to treat this browser.',
        yesTitle: 'Only me',
        yesWho: 'This is my own teacher device.',
        yesLabel: 'Yes — teacher device',
        yesPoints: ['Opens faster every time', 'Fewer Firebase reads for your school'],
        noTitle: 'Other people too',
        noWho: 'Choose this if students, parents, guests, or unrelated accounts can use this same browser profile.',
        noLabel: 'No — shared browser',
        noPoints: ['GCQ tidies up when you sign out', 'Loads fresh each time, a little slower'],
    },
    [ROLE_SECRETARY]: {
        title: 'Keep this secretary device fast?',
        lede: 'One quick choice so GCQ knows how to treat this browser.',
        yesTitle: 'Office staff only',
        yesWho: 'Only school office staff use this device.',
        yesLabel: 'Yes — secretary device',
        yesPoints: ['Opens faster every time', 'Remembers your username', 'Fewer Firebase reads for your school'],
        noTitle: 'Other people too',
        noWho: 'Choose this if students, parents, guests, or unrelated accounts can use this same browser profile.',
        noLabel: 'No — shared browser',
        noPoints: ['GCQ tidies up when you sign out', 'Loads fresh each time, a little slower'],
    },
    [ROLE_PARENT]: {
        title: 'Keep this family device fast?',
        lede: 'Is this phone or computer just for your family?',
        ask: 'Who uses this phone or computer?',
        yesTitle: 'Only our family',
        yesWho: 'Only our family uses this phone or computer.',
        yesLabel: 'Yes — family device',
        yesPoints: ['Opens faster every time', 'Remembers your username'],
        noTitle: 'Other people too',
        noWho: 'Choose this if other families, guests, or unrelated accounts can use this same browser profile.',
        noLabel: 'No — shared device',
        noPoints: ['Nothing is kept after you sign out', 'Loads fresh each time, a little slower'],
    },
};

const DONE_COPY = {
    trusted: {
        title: 'All set! The lantern stays lit.',
        text: 'GCQ will start faster the next time you open it on this device.',
    },
    shared: {
        title: 'Got it. This browser stays tidy.',
        text: 'GCQ clears what it saved here every time you sign out.',
    },
};

// Timings for the dialog's own entrance/exit, kept in one place so every stage
// (open, content swap, close) agrees on how long its animation takes.
const CLOSE_MS = 280;
const SWAP_MS = 200;
const HOLD_MS = { trusted: 2100, shared: 1700 };

const LANTERN_SVG = `
<svg class="dcp-lantern" viewBox="0 0 120 150" aria-hidden="true" focusable="false">
    <defs>
        <radialGradient id="dcp-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#fff7d6" stop-opacity=".95"/>
            <stop offset=".35" stop-color="#fcd34d" stop-opacity=".7"/>
            <stop offset=".7" stop-color="#f59e0b" stop-opacity=".18"/>
            <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="dcp-brass" x1="0" x2="1">
            <stop offset="0" stop-color="#92400e"/>
            <stop offset=".5" stop-color="#fbbf24"/>
            <stop offset="1" stop-color="#78350f"/>
        </linearGradient>
    </defs>
    <circle class="dcp-lantern-halo" cx="60" cy="88" r="58" fill="url(#dcp-glow)"/>
    <path d="M60 2v14" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>
    <circle cx="60" cy="20" r="7" fill="none" stroke="url(#dcp-brass)" stroke-width="4"/>
    <path d="M36 44 L60 26 L84 44 Z" fill="url(#dcp-brass)"/>
    <rect x="32" y="43" width="56" height="8" rx="3" fill="url(#dcp-brass)"/>
    <rect class="dcp-lantern-glass" x="38" y="51" width="44" height="66" rx="8" fill="rgba(254,243,199,.35)" stroke="url(#dcp-brass)" stroke-width="4"/>
    <path d="M60 51v66M38 84h44" stroke="#b45309" stroke-opacity=".45" stroke-width="2"/>
    <g class="dcp-flame">
        <path d="M60 64c9 11 10 19 10 24a10 10 0 0 1-20 0c0-5 2-9 6-13 0 5 2 7 4 7 0-6-2-11 0-18z" fill="#f59e0b"/>
        <path d="M60 78c4 5 5 8 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11z" fill="#fff7d6"/>
    </g>
    <rect x="30" y="117" width="60" height="9" rx="3" fill="url(#dcp-brass)"/>
    <path d="M40 126h40l-6 9H46z" fill="#78350f"/>
    <g class="dcp-bolt"><path d="M96 30l-9 15h7l-4 13 12-18h-8l5-10z" fill="#fde68a" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/></g>
</svg>`;

const HOME_ICON = `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M6 22 24 7l18 15" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11 19v21h26V19" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <rect class="dcp-window" x="17" y="24" width="14" height="10" rx="2"/>
    <path d="M24 24v10M17 29h14" stroke="currentColor" stroke-width="1.6" stroke-opacity=".55"/>
</svg>`;

const DOOR_ICON = `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M12 41V9a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v32" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 8 27 12v32L14 41z" fill="currentColor" fill-opacity=".28" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="23.5" cy="27" r="1.8" fill="currentColor"/>
    <path d="M6 41h36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path class="dcp-sparkle" d="M39 14l1.4 3.1 3.1 1.4-3.1 1.4L39 23l-1.4-3.1-3.1-1.4 3.1-1.4z" fill="currentColor"/>
</svg>`;

const SHIELD_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.5 7.5 10 4.3-1.5 7.5-5.4 7.5-10v-6z" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="m8.5 12 2.4 2.4 4.6-4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const pointsHtml = (points) => points.map((point) => `<li>${escapeHtml(point)}</li>`).join('');

function promptHtml(copy) {
    return `
        <div class="dcp-card" data-stage="ask">
            <header class="dcp-sky">
                <span class="dcp-star" style="--x:12%;--y:22%;--d:0s"></span>
                <span class="dcp-star" style="--x:24%;--y:64%;--d:1.1s"></span>
                <span class="dcp-star" style="--x:78%;--y:18%;--d:.6s"></span>
                <span class="dcp-star" style="--x:90%;--y:58%;--d:1.7s"></span>
                <span class="dcp-star" style="--x:66%;--y:76%;--d:2.3s"></span>
                ${LANTERN_SVG}
                <p class="dcp-kicker">Asked once on this browser</p>
                <h2 id="gcq-device-cache-title" class="dcp-title">${escapeHtml(copy.title)}</h2>
                <p class="dcp-lede">${escapeHtml(copy.lede)}</p>
            </header>
            <div class="dcp-body">
                <p class="dcp-ask" id="gcq-device-cache-ask">${escapeHtml(copy.ask || 'Who uses this browser?')}</p>
                <div class="dcp-choices" role="group" aria-labelledby="gcq-device-cache-ask">
                    <button type="button" class="dcp-choice" data-cache-choice="trusted" data-tone="home" aria-label="${escapeHtml(copy.yesLabel)}. ${escapeHtml(copy.yesWho)}">
                        <span class="dcp-badge">Recommended</span>
                        <span class="dcp-choice-icon">${HOME_ICON}</span>
                        <span class="dcp-choice-title">${escapeHtml(copy.yesTitle)}</span>
                        <span class="dcp-choice-who">${escapeHtml(copy.yesWho)}</span>
                        <ul class="dcp-points">${pointsHtml(copy.yesPoints)}</ul>
                        <span class="dcp-choice-cta">${escapeHtml(copy.yesLabel)}</span>
                    </button>
                    <button type="button" class="dcp-choice" data-cache-choice="shared" data-tone="shared" aria-label="${escapeHtml(copy.noLabel)}. ${escapeHtml(copy.noWho)}">
                        <span class="dcp-choice-icon">${DOOR_ICON}</span>
                        <span class="dcp-choice-title">${escapeHtml(copy.noTitle)}</span>
                        <span class="dcp-choice-who">${escapeHtml(copy.noWho)}</span>
                        <ul class="dcp-points">${pointsHtml(copy.noPoints)}</ul>
                        <span class="dcp-choice-cta">${escapeHtml(copy.noLabel)}</span>
                    </button>
                </div>
                <p class="dcp-safe">${SHIELD_ICON}<span>This changes local caching only, not login, permissions, school-year data, or app features.</span></p>
            </div>
        </div>`;
}

function doneHtml(choice) {
    const done = DONE_COPY[choice] || DONE_COPY.shared;
    return `
        <header class="dcp-sky dcp-sky--done">
            ${choice === 'trusted' ? LANTERN_SVG : `<span class="dcp-done-door">${DOOR_ICON}</span>`}
            <h2 class="dcp-title" id="gcq-device-cache-title">${escapeHtml(done.title)}</h2>
            <p class="dcp-lede">${escapeHtml(done.text)}</p>
        </header>`;
}

export function openDeviceCachePrompt(role) {
    if (document.getElementById('gcq-device-cache-choice')) return;

    const copy = ROLE_COPY[role] || ROLE_COPY[ROLE_TEACHER];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const panel = document.createElement('section');
    panel.id = 'gcq-device-cache-choice';
    panel.className = 'dcp-backdrop';
    panel.dataset.role = role === ROLE_PARENT ? 'parent' : (role === ROLE_SECRETARY ? 'secretary' : 'teacher');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'gcq-device-cache-title');
    panel.innerHTML = promptHtml(copy);

    const card = panel.querySelector('.dcp-card');
    let closing = false;
    let chosen = false;

    // Fades the backdrop and settles the card down, then removes it: every way
    // this dialog closes goes through here, so it never just vanishes.
    const closePanel = () => {
        if (closing) return;
        closing = true;
        panel.classList.remove('is-open');
        panel.classList.add('is-closing');
        setTimeout(() => panel.remove(), reduceMotion ? 0 : CLOSE_MS);
    };

    // Choosing "trusted" only takes effect the next time Firestore's cache is
    // initialised (a one-time-per-app-instance setting), so instead of forcing
    // a disruptive reload we swap the card into a short confirmation and close.
    const showConfirmation = (choice) => {
        const swap = () => {
            card.dataset.stage = 'done';
            card.dataset.choice = choice;
            card.innerHTML = doneHtml(choice);
            card.classList.remove('is-swapping');
        };
        if (reduceMotion) swap();
        else {
            card.classList.add('is-swapping');
            setTimeout(swap, SWAP_MS);
        }
        setTimeout(closePanel, HOLD_MS[choice] || HOLD_MS.shared);
    };

    panel.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cache-choice]');
        if (!button || chosen) return;
        chosen = true;
        const choice = button.dataset.cacheChoice === 'trusted' ? 'trusted' : 'shared';
        try { saveDeviceCacheChoice(choice); } catch (_) { /* private mode: still close kindly */ }
        button.classList.add('is-picked');
        showConfirmation(choice);
    });

    // Keep keyboard focus inside the two choices while the question is open.
    panel.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || chosen) return;
        const buttons = [...panel.querySelectorAll('[data-cache-choice]')];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault();
        const next = event.shiftKey ? index - 1 : index + 1;
        buttons[(next + buttons.length) % buttons.length]?.focus();
    });

    document.body.appendChild(panel);
    if (reduceMotion) panel.classList.add('is-open');
    else {
        void panel.offsetWidth; // flush the closed state before animating in
        requestAnimationFrame(() => panel.classList.add('is-open'));
    }
    panel.querySelector('[data-cache-choice="trusted"]')?.focus({ preventScroll: true });
}
