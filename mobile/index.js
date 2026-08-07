import './styles/mobile.css';
import { injectMobileShells } from './templates.js';
import { initTeacherMobile, syncTeacherClassPill, measureMobileChrome } from './teacher.js';
import { initRoleMobile } from './roles.js';
import { initMobileHome, renderMobileHome } from './home.js';
import { initMobileGuilds } from './guilds.js';

export const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

let mediaQuery = null;
let initialized = false;
let pressWired = false;
const brandSparkleTimeoutMap = new WeakMap();

function triggerBrandLightEffect(brandEl) {
    if (!brandEl) return;
    brandEl.classList.remove('m-brand-sparkle-active');
    void brandEl.offsetWidth; // force reflow
    brandEl.classList.add('m-brand-sparkle-active');

    if (brandSparkleTimeoutMap.has(brandEl)) {
        clearTimeout(brandSparkleTimeoutMap.get(brandEl));
    }
    const timer = window.setTimeout(() => {
        brandEl.classList.remove('m-brand-sparkle-active');
        brandSparkleTimeoutMap.delete(brandEl);
    }, 1300);
    brandSparkleTimeoutMap.set(brandEl, timer);
}

export function isMobileMode() {
    return typeof document !== 'undefined' && document.body?.classList.contains('gcq-mobile');
}

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function spawnRipple(target, clientX, clientY) {
    if (prefersReducedMotion()) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'm-ripple';
    ripple.style.left = `${clientX - rect.left}px`;
    ripple.style.top = `${clientY - rect.top}px`;
    const style = getComputedStyle(target);
    if (style.position === 'static') target.style.position = 'relative';
    target.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 600);
}

function wirePressFeedback() {
    if (pressWired || typeof document === 'undefined') return;
    pressWired = true;

    const selector = [
        '.m-pressable',
        '.m-header-btn',
        '.m-class-pill',
        '.m-dock-btn',
        '.m-more-item',
        '.m-class-option',
        '.m-home-action',
        '.m-sheet__close'
    ].join(',');

    document.addEventListener('pointerdown', (event) => {
        if (!isMobileMode()) return;
        const brand = event.target.closest('.m-header__brand');
        if (brand) {
            triggerBrandLightEffect(brand);
        }
        const target = event.target.closest(selector);
        if (!target || target.disabled) return;
        target.classList.add('m-press--down');
        spawnRipple(target, event.clientX, event.clientY);
    }, { passive: true });

    const clearPress = (event) => {
        const target = event.target.closest?.(selector);
        if (target) target.classList.remove('m-press--down');
        document.querySelectorAll('.m-press--down').forEach((el) => el.classList.remove('m-press--down'));
    };

    document.addEventListener('pointerup', clearPress, { passive: true });
    document.addEventListener('pointercancel', clearPress, { passive: true });
    document.addEventListener('pointerleave', clearPress, { passive: true });
}

/** Ensure Add/Edit Class dismiss works on mobile sheets (X was losing hit-tests). */
function wireModalCloseFallback() {
    document.addEventListener('click', async (event) => {
        if (!isMobileMode()) return;

        const closeBtn = event.target.closest?.(
            '#create-class-close-btn, #create-class-cancel-btn, #edit-class-cancel-btn'
        );
        if (closeBtn) {
            const modalId = closeBtn.id.includes('edit-class')
                ? 'edit-class-modal'
                : 'create-class-modal';
            event.preventDefault();
            event.stopImmediatePropagation();
            const { hideModal } = await import('../ui/modals/base.js');
            hideModal(modalId);
            return;
        }

        const modalRoot = event.target.closest?.('#create-class-modal, #edit-class-modal');
        if (modalRoot && event.target === modalRoot) {
            const { hideModal } = await import('../ui/modals/base.js');
            hideModal(modalRoot.id);
        }
    }, true);
}

const MOBILE_FAB_SELECTOR = '.al-fab-cluster, .hc-fab-cluster, .ss-fab-cluster, .tab-fab-cluster';
let fabRevealWired = false;

// Desktop reveals FAB clusters via mousemove edge-hover, which never fires on
// touch devices — without this, FABs would stay invisible forever on mobile.
function wireMobileFabAutoReveal() {
    if (fabRevealWired || typeof document === 'undefined') return;
    fabRevealWired = true;

    const isBlocked = () => Boolean(
        document.querySelector('[id$="-modal"]:not(.hidden)')
        || document.querySelector('.m-sheet.m-sheet--open')
    );

    const sync = () => {
        if (!isMobileMode()) return;
        const show = !isBlocked();
        document.querySelectorAll(MOBILE_FAB_SELECTOR).forEach((el) => {
            el.classList.toggle('revealed', show);
        });
    };

    const watchRoots = ['app-screen', 'parent-screen', 'secretary-screen', 'app-root']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
    const observer = new MutationObserver(sync);
    watchRoots.forEach((root) => observer.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true }));

    document.addEventListener('gcq-mobile-mode', sync);
    sync();
}

function applyMobileMode() {
    const active = mediaQuery ? mediaQuery.matches : false;
    document.body.classList.toggle('gcq-mobile', active);
    document.dispatchEvent(new CustomEvent('gcq-mobile-mode', { detail: { active } }));
    if (active) {
        requestAnimationFrame(() => measureMobileChrome());
    }
    // Calendar switches month-grid ↔ day-agenda when mode flips.
    const calendarTab = document.getElementById('calendar-tab');
    if (calendarTab && !calendarTab.classList.contains('hidden')) {
        import('../ui/tabs.js').then((m) => m.renderCalendarTab()).catch(() => {});
    }
}

export function initMobileLayer() {
    if (initialized) return;
    initialized = true;

    injectMobileShells();
    initTeacherMobile();
    initRoleMobile();
    initMobileHome();
    initMobileGuilds();
    wirePressFeedback();
    wireModalCloseFallback();
    wireMobileFabAutoReveal();

    if (typeof window === 'undefined' || !window.matchMedia) return;
    mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = () => applyMobileMode();
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onChange);
    } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(onChange);
    }
    applyMobileMode();

    document.addEventListener('home:rendered', () => {
        if (isMobileMode()) {
            syncTeacherClassPill();
            renderMobileHome();
        }
    });
}

if (typeof window !== 'undefined' && !window.__GCQ_MOBILE_LAYER__) {
    window.__GCQ_MOBILE_LAYER__ = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileLayer, { once: true });
    } else {
        initMobileLayer();
    }
}
