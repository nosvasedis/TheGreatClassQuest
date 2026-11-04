// features/parent/phone.js — the Family Portal on a phone: keep it on the home screen, pull down
// for news, and give the keyboard room while a family is writing.
import { tr } from './i18n.js';

const INSTALL_KEY = 'gcq_family_install_v1';
let deferredPrompt = null;

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        document.querySelectorAll('[data-parent-install-go]').forEach((btn) => btn.classList.remove('hidden'));
    });
}

function isStandalone() {
    try {
        return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch {
        return false;
    }
}

function isPhone() {
    try {
        return window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 820;
    } catch {
        return false;
    }
}

function isIos() {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function dismissed() {
    try {
        return localStorage.getItem(INSTALL_KEY) === 'dismissed';
    } catch {
        return false;
    }
}

/** Home: a small card that helps a family keep the portal one tap away. */
export function renderInstallCard({ force = false } = {}) {
    if (!force && (isStandalone() || !isPhone() || dismissed())) return '';
    const steps = isIos()
        ? tr('Tap <i class="fas fa-arrow-up-from-bracket" aria-label="Share"></i> Share, then <strong>Add to Home Screen</strong>.',
            'Πατήστε <i class="fas fa-arrow-up-from-bracket" aria-label="Κοινοποίηση"></i> Κοινοποίηση και μετά <strong>Προσθήκη στην οθόνη Αφετηρίας</strong>.')
        : tr('Open the browser menu <i class="fas fa-ellipsis-vertical" aria-label="menu"></i> and choose <strong>Add to Home screen</strong>.',
            'Ανοίξτε το μενού <i class="fas fa-ellipsis-vertical" aria-label="μενού"></i> και επιλέξτε <strong>Προσθήκη στην αρχική οθόνη</strong>.');
    return `
        <aside class="fp-install fp-rise" style="--fp-delay:6" data-parent-install>
            <span class="fp-install__icon" aria-hidden="true"><i class="fas fa-mobile-screen-button"></i></span>
            <div class="fp-install__copy">
                <p class="fp-install__title">${tr('Keep the portal on your phone', 'Κρατήστε την πύλη στο κινητό σας')}</p>
                <p class="fp-install__steps">${steps}</p>
                <div class="fp-install__actions">
                    <button type="button" class="fp-btn fp-btn--primary fp-btn--sm${deferredPrompt ? '' : ' hidden'}" data-parent-install-go><i class="fas fa-download" aria-hidden="true"></i> ${tr('Add it now', 'Προσθήκη τώρα')}</button>
                    <button type="button" class="fp-link" data-parent-install-dismiss>${tr('Not now', 'Όχι τώρα')}</button>
                </div>
            </div>
        </aside>`;
}

export async function handleInstallClick(target) {
    if (target.closest('[data-parent-install-go]') && deferredPrompt) {
        const prompt = deferredPrompt;
        deferredPrompt = null;
        try {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice?.outcome === 'accepted') hideInstallCard(true);
        } catch {
            /* the browser closed the prompt */
        }
        return true;
    }
    if (target.closest('[data-parent-install-dismiss]')) {
        hideInstallCard(true);
        return true;
    }
    return false;
}

function hideInstallCard(remember) {
    if (remember) {
        try { localStorage.setItem(INSTALL_KEY, 'dismissed'); } catch { /* only for this visit */ }
    }
    document.querySelectorAll('[data-parent-install]').forEach((card) => card.remove());
}

/**
 * Pull down at the top of a tab to check for news, the way phone apps do.
 * `onRefresh` returns a promise; the little sun spins until it settles.
 */
export function wirePullToRefresh(main, onRefresh) {
    if (!main || main.dataset.fpPull) return;
    main.dataset.fpPull = '1';
    const puller = document.createElement('div');
    puller.className = 'fp-pull';
    puller.setAttribute('aria-hidden', 'true');
    puller.innerHTML = '<span class="fp-pull__sun"><i class="fas fa-rotate"></i></span>';
    main.prepend(puller);

    const THRESHOLD = 70;
    let startY = null;
    let pulled = 0;
    let busy = false;

    const setPull = (px) => {
        pulled = px;
        main.style.setProperty('--fp-pull', `${px}px`);
        puller.classList.toggle('is-ready', px >= THRESHOLD);
        if (px > 0) main.classList.add('is-pulled');
        else setTimeout(() => { if (!pulled) main.classList.remove('is-pulled'); }, 260);
    };

    main.addEventListener('touchstart', (event) => {
        if (busy || main.scrollTop > 0 || event.touches.length !== 1) { startY = null; return; }
        if (event.target.closest('textarea, input, .fp-days')) { startY = null; return; }
        startY = event.touches[0].clientY;
    }, { passive: true });

    main.addEventListener('touchmove', (event) => {
        if (startY === null) return;
        const dy = event.touches[0].clientY - startY;
        if (dy <= 0 || main.scrollTop > 0) { if (pulled) setPull(0); return; }
        main.classList.add('is-pulling');
        setPull(Math.min(110, dy * 0.5));
    }, { passive: true });

    const release = async () => {
        if (startY === null) return;
        startY = null;
        main.classList.remove('is-pulling');
        if (pulled < THRESHOLD) { setPull(0); return; }
        busy = true;
        main.classList.add('is-refreshing');
        setPull(56);
        try {
            await onRefresh?.();
        } finally {
            busy = false;
            main.classList.remove('is-refreshing');
            setPull(0);
        }
    };
    main.addEventListener('touchend', release, { passive: true });
    main.addEventListener('touchcancel', release, { passive: true });
}

/** While the keyboard is up, the tab bar steps aside so the reply box stays in view. */
export function wireKeyboardRoom(screen) {
    if (!screen || screen.dataset.fpKeys) return;
    screen.dataset.fpKeys = '1';
    const typingField = (el) => el?.matches?.('textarea, input[type="text"], input:not([type])');
    screen.addEventListener('focusin', (event) => {
        if (typingField(event.target) && isPhone()) screen.classList.add('fp-typing');
    });
    screen.addEventListener('focusout', () => {
        setTimeout(() => {
            if (!typingField(document.activeElement)) screen.classList.remove('fp-typing');
        }, 60);
    });
}
