// features/secretary/officeModal.js — one open/close motion for every modal in the Secretary Office.
// A file slides up out of the cabinet as the room dims, and tucks back in on close.
// Keep the timings in sync with the office-modal keyframes in styles/secretary_office.css.

const OPENING = 'office-modal-opening';
const CLOSING = 'office-modal-closing';
const OPEN_MS = 420;
const CLOSE_MS = 240;

export function isSecretaryOfficeActive() {
    const screen = document.getElementById('secretary-screen');
    return Boolean(screen && !screen.classList.contains('hidden'));
}

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function findPanel(modal) {
    return modal.querySelector('[data-office-panel]')
        || modal.querySelector('.pop-in')
        || modal.firstElementChild;
}

function clearTimers(modal) {
    clearTimeout(modal.__officeOpenTimer);
    clearTimeout(modal.__officeCloseTimer);
}

export function isOfficeModalOpen(modal) {
    return Boolean(modal && !modal.classList.contains('hidden') && !modal.classList.contains(CLOSING));
}

export function openOfficeModal(modal, { flex = false } = {}) {
    if (!modal) return;
    clearTimers(modal);
    const panel = findPanel(modal);
    panel?.classList.add('office-modal__panel');
    panel?.classList.remove('modal-origin-start', 'is-modal-exiting', 'pop-out');
    modal.style.backgroundColor = '';
    modal.style.transition = '';
    modal.style.opacity = '';
    modal.classList.add('office-modal');
    modal.classList.remove(CLOSING, 'hidden');
    if (flex) {
        modal.classList.add('flex');
        modal.dataset.officeFlex = '1';
    }
    if (prefersReducedMotion()) return;
    void modal.offsetWidth;
    modal.classList.add(OPENING);
    modal.__officeOpenTimer = setTimeout(() => modal.classList.remove(OPENING), OPEN_MS);
}

export function closeOfficeModal(modal, { onClosed } = {}) {
    if (!modal || modal.classList.contains('hidden')) {
        onClosed?.();
        return;
    }
    clearTimers(modal);
    const finish = () => {
        modal.classList.add('hidden');
        modal.classList.remove(OPENING, CLOSING);
        if (modal.dataset.officeFlex) {
            modal.classList.remove('flex');
            delete modal.dataset.officeFlex;
        }
        onClosed?.();
    };
    if (prefersReducedMotion()) {
        finish();
        return;
    }
    modal.classList.remove(OPENING);
    modal.classList.add('office-modal', CLOSING);
    modal.__officeCloseTimer = setTimeout(finish, CLOSE_MS);
}

// Desks and dialogs lock page scroll while open; release it once none is left.
export function releaseOfficeScrollLock() {
    const stillOpen = document.querySelector(
        '.placement-wizard:not(.hidden):not(.office-modal-closing), .office-dialog:not(.hidden):not(.office-modal-closing)'
    );
    if (!stillOpen) document.body.classList.remove('placement-wizard-open');
}
