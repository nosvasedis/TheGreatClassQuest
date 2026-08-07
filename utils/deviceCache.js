import { ROLE_PARENT, ROLE_SECRETARY, ROLE_TEACHER } from './roles.js';

const CACHE_CHOICE_KEY = 'gcq_device_cache_choice_v1';

export function getDeviceCacheChoice() {
    if (typeof window === 'undefined') return 'shared';
    try {
        return window.localStorage.getItem(CACHE_CHOICE_KEY) === 'trusted'
            ? 'trusted'
            : 'shared';
    } catch (_) {
        return 'shared';
    }
}

export function hasChosenDeviceCache() {
    if (typeof window === 'undefined') return true;
    try {
        return Boolean(window.localStorage.getItem(CACHE_CHOICE_KEY));
    } catch (_) {
        return true;
    }
}

export function saveDeviceCacheChoice(choice) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CACHE_CHOICE_KEY, choice === 'trusted' ? 'trusted' : 'shared');
}

export function clearLocalAppData() {
    if (typeof window === 'undefined') return;
    const preservedCacheChoice = window.localStorage.getItem(CACHE_CHOICE_KEY);
    Object.keys(window.localStorage)
        .filter((key) => key.startsWith('gcq_') || key.startsWith('quest_') || key.startsWith('dismissed_makeups_'))
        .forEach((key) => window.localStorage.removeItem(key));
    if (preservedCacheChoice === 'shared') {
        window.localStorage.setItem(CACHE_CHOICE_KEY, 'shared');
    }
    window.sessionStorage.clear();
}

// Wording adapts to who is actually signed in, since this prompt fires for
// teachers, secretaries/admins, and parents alike.
const ROLE_COPY = {
    [ROLE_TEACHER]: {
        title: 'Keep this teacher device fast?',
        body: 'Choose the recommended option when this device is used only by you as a teacher. GCQ can then keep its protected browser cache for faster starts and fewer Firebase reads.',
        warning: 'students, parents, guests, or unrelated accounts can use this same browser profile.',
        yesLabel: 'Yes — teacher device',
        noLabel: 'No — shared browser',
    },
    [ROLE_SECRETARY]: {
        title: 'Keep this secretary device fast?',
        body: 'Choose the recommended option when this device is used only by school office staff. GCQ can then keep its protected browser cache for faster starts and fewer Firebase reads.',
        warning: 'students, parents, guests, or unrelated accounts can use this same browser profile.',
        yesLabel: 'Yes — secretary device',
        noLabel: 'No — shared browser',
    },
    [ROLE_PARENT]: {
        title: 'Keep this family device fast?',
        body: 'Choose the recommended option when this device is used only by your family. GCQ can then keep its protected browser cache for faster starts and fewer Firebase reads.',
        warning: 'other families, guests, or unrelated accounts can use this same browser profile.',
        yesLabel: 'Yes — family device',
        noLabel: 'No — shared device',
    },
};

// Timings for the dialog's own entrance/exit — kept in one place so every
// stage (open, content swap, close) agrees on how long its animation takes.
const PANEL_FADE_MS = 260;
const CARD_POP_OUT_MS = 200;
const CARD_SWAP_FADE_MS = 180;
const CONFIRMATION_HOLD_MS = 1800;

export function offerDeviceCacheChoice(role) {
    if (hasChosenDeviceCache() || document.getElementById('gcq-device-cache-choice')) return;

    const copy = ROLE_COPY[role] || ROLE_COPY[ROLE_TEACHER];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const panel = document.createElement('section');
    panel.id = 'gcq-device-cache-choice';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'gcq-device-cache-title');
    panel.className = 'fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/55 p-4 opacity-0 transition-opacity ease-out';
    panel.style.transitionDuration = `${PANEL_FADE_MS}ms`;
    panel.innerHTML = `
        <div class="w-full max-w-lg rounded-[2rem] border border-sky-100 bg-white p-7 shadow-2xl pop-in pop-in-start">
            <div class="mb-4 text-4xl" aria-hidden="true">⚡</div>
            <h2 id="gcq-device-cache-title" class="font-title text-2xl text-sky-800">${copy.title}</h2>
            <p class="mt-3 leading-relaxed text-slate-600">${copy.body}</p>
            <p class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Choose shared browser only</strong> if ${copy.warning}</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" data-cache-choice="trusted" class="rounded-2xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200">${copy.yesLabel}</button>
                <button type="button" data-cache-choice="shared" class="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200">${copy.noLabel}</button>
            </div>
            <p class="mt-4 text-xs text-slate-500">This changes local caching only—not login, permissions, school-year data, or app features.</p>
        </div>`;

    const card = panel.querySelector(':scope > div');
    let closing = false;

    // Smoothly fades + pops the whole dialog out, then removes it — used for
    // every way this dialog can close, so it never just vanishes.
    const closePanel = () => {
        if (closing) return;
        closing = true;
        panel.classList.add('opacity-0');
        if (reduceMotion) {
            panel.remove();
            return;
        }
        card?.classList.remove('pop-in');
        card?.classList.add('pop-out');
        setTimeout(() => panel.remove(), Math.max(PANEL_FADE_MS, CARD_POP_OUT_MS));
    };

    // Choosing "trusted" can only take effect the next time Firestore's cache
    // is initialized (a one-time-per-app-instance setting), so instead of
    // forcing a disruptive reload of the session the user is already in, we
    // cross-fade the card into a brief confirmation and then close it gently.
    const showTrustedConfirmation = () => {
        if (!card) { closePanel(); return; }
        const confirmationHtml = `
            <div class="text-center">
                <div class="mb-3 text-4xl" aria-hidden="true">✨</div>
                <h2 class="font-title text-xl text-sky-800">All set!</h2>
                <p class="mt-2 leading-relaxed text-slate-600">GCQ will start faster the next time you open it on this device.</p>
            </div>`;

        if (reduceMotion) {
            card.innerHTML = confirmationHtml;
        } else {
            card.style.transition = `opacity ${CARD_SWAP_FADE_MS}ms ease`;
            card.style.opacity = '0';
            setTimeout(() => {
                card.innerHTML = confirmationHtml;
                requestAnimationFrame(() => { card.style.opacity = '1'; });
            }, CARD_SWAP_FADE_MS);
        }

        setTimeout(closePanel, CONFIRMATION_HOLD_MS);
    };

    panel.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cache-choice]');
        if (!button) return;
        const choice = button.dataset.cacheChoice;
        saveDeviceCacheChoice(choice);
        if (choice === 'trusted') {
            showTrustedConfirmation();
        } else {
            closePanel();
        }
    });
    document.body.appendChild(panel);
    if (reduceMotion) {
        panel.classList.remove('opacity-0');
        card?.classList.remove('pop-in-start');
    } else {
        void panel.offsetWidth; // flush initial (opacity-0 / scale-0) state before animating in
        requestAnimationFrame(() => {
            panel.classList.remove('opacity-0');
            card?.classList.remove('pop-in-start');
        });
    }
    panel.querySelector('[data-cache-choice="trusted"]')?.focus();
}
