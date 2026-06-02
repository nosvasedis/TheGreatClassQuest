// Global class picker in the app header (Fredoka / glass style).
// Panel is moved to document.body while open + position:fixed so it always sits above
// main content (stacking contexts / transforms on #app-screen would otherwise hide it).
import * as state from '../state.js';
import { playSound } from '../audio.js';
import { runScheduleBasedClassSyncOnce } from '../features/home.js';

let headerListenersWired = false;
/** Where to put the panel back when closing ({ parent, nextSibling } or null) */
let panelDock = null;
let panelRepositionCleanup = null;
let panelCloseTimer = null;

const PANEL_OPEN_EASE = 'cubic-bezier(0.34, 1.2, 0.64, 1)';
const PANEL_CLOSE_MS = 160;

function detachPanelReposition() {
    panelRepositionCleanup?.();
    panelRepositionCleanup = null;
}

/** Layout only — no open/close animation properties. */
function applyPanelGeometry() {
    const btn = document.getElementById('header-class-selector-btn');
    const panel = document.getElementById('header-class-selector-panel');
    if (!btn || !panel || panel.classList.contains('hidden')) return;

    const r = btn.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (r.width < 2 || r.height < 2) {
        requestAnimationFrame(() => applyPanelGeometry());
        return;
    }

    panel.style.position = 'fixed';
    panel.style.right = 'auto';
    const maxW = Math.min(18 * 16, vw - margin * 2);
    let pw = Math.min(panel.offsetWidth || maxW, maxW);
    if (pw < 160) pw = Math.min(maxW, 288);

    let left = r.right - pw;
    left = Math.max(margin, Math.min(left, vw - pw - margin));
    panel.style.left = `${left}px`;
    panel.style.width = `${pw}px`;

    const ph = panel.getBoundingClientRect().height || 1;
    let top = r.bottom + margin;
    if (top + ph > vh - margin && r.top > ph + margin) {
        top = r.top - ph - margin;
    }
    top = Math.max(margin, Math.min(top, vh - ph - margin));
    panel.style.top = `${top}px`;
    panel.style.zIndex = '2147483000';
}

function attachPanelReposition() {
    detachPanelReposition();
    const onReposition = () => applyPanelGeometry();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    panelRepositionCleanup = () => {
        window.removeEventListener('resize', onReposition);
        window.removeEventListener('scroll', onReposition, true);
    };
}

function dockPanelToBody() {
    const panel = document.getElementById('header-class-selector-panel');
    const wrap = document.getElementById('header-class-selector-wrap');
    if (!panel || !wrap || panel.parentElement === document.body) return;
    panelDock = { parent: panel.parentElement, nextSibling: panel.nextSibling };
    document.body.appendChild(panel);
}

function restorePanelToHeader() {
    const panel = document.getElementById('header-class-selector-panel');
    if (!panel || !panelDock) return;
    const { parent, nextSibling } = panelDock;
    panelDock = null;
    if (nextSibling && nextSibling.parentNode === parent) {
        parent.insertBefore(panel, nextSibling);
    } else {
        parent.appendChild(panel);
    }
    panel.style.position = '';
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.width = '';
    panel.style.zIndex = '';
    panel.style.opacity = '';
    panel.style.transform = '';
    panel.style.transition = '';
    panel.style.willChange = '';
}

function finishClosePanel() {
    const panel = document.getElementById('header-class-selector-panel');
    const btn = document.getElementById('header-class-selector-btn');
    if (panelCloseTimer !== null) {
        clearTimeout(panelCloseTimer);
        panelCloseTimer = null;
    }
    if (panel) {
        panel.classList.add('hidden');
        restorePanelToHeader();
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function renderHeaderClassListItems() {
    const mount = document.getElementById('header-class-list-mount');
    if (!mount) return;
    const classes = (state.get('allTeachersClasses') || []).slice()
        .sort((a, b) => a.name.localeCompare(b.name));
    mount.innerHTML = classes.map(c => `
        <div class="header-class-item flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-indigo-100" data-id="${c.id}" role="option">
            <span class="text-2xl w-10 text-center bg-white border border-gray-100 rounded-lg py-1 shadow-sm">${c.logo}</span>
            <div class="min-w-0 flex-1">
                <div class="font-title font-bold text-gray-800 text-sm truncate">${c.name}</div>
                <div class="text-[11px] text-indigo-500 -mt-0.5">${c.questLevel || ''}</div>
            </div>
        </div>
    `).join('');
}

export function syncHeaderClassSelector() {
    const logoEl = document.getElementById('header-class-selector-logo');
    const textEl = document.getElementById('header-class-selector-text');
    const btn = document.getElementById('header-class-selector-btn');
    if (!logoEl || !textEl || !btn) return;

    const classId = state.get('globalSelectedClassId');
    const classes = state.get('allTeachersClasses') || [];
    const follow = state.get('classFollowSchedule');

    if (!classId) {
        logoEl.textContent = '🏫';
        textEl.textContent = 'General';
        btn.title = follow ? 'General view — following schedule' : 'General view — change in header';
    } else {
        const c = classes.find(x => x.id === classId);
        if (c) {
            logoEl.textContent = c.logo || '📚';
            textEl.textContent = c.name;
            btn.title = `${c.name} (${c.questLevel || 'Quest'})${follow ? ' — following schedule' : ' — pinned class'}`;
        } else {
            logoEl.textContent = '❓';
            textEl.textContent = 'Class';
            btn.title = 'Choose class';
        }
    }

    renderHeaderClassListItems();
    const panel = document.getElementById('header-class-selector-panel');
    if (panel && !panel.classList.contains('hidden')) {
        applyPanelGeometry();
    }
}

function closeHeaderPanel() {
    const panel = document.getElementById('header-class-selector-panel');
    const btn = document.getElementById('header-class-selector-btn');
    detachPanelReposition();

    if (!panel) {
        if (btn) btn.setAttribute('aria-expanded', 'false');
        return;
    }

    if (panelCloseTimer !== null) {
        clearTimeout(panelCloseTimer);
        panelCloseTimer = null;
    }

    if (panel.classList.contains('hidden')) {
        finishClosePanel();
        return;
    }

    panel.style.willChange = 'opacity, transform';
    panel.style.transition = `opacity ${PANEL_CLOSE_MS}ms ease-in, transform ${PANEL_CLOSE_MS}ms ease-in`;
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-6px) scale(0.97)';

    panelCloseTimer = window.setTimeout(() => {
        panelCloseTimer = null;
        finishClosePanel();
    }, PANEL_CLOSE_MS);
}

function openHeaderPanel() {
    const panel = document.getElementById('header-class-selector-panel');
    const btn = document.getElementById('header-class-selector-btn');
    if (!panel || !btn) return;

    if (panelCloseTimer !== null) {
        clearTimeout(panelCloseTimer);
        panelCloseTimer = null;
    }

    renderHeaderClassListItems();
    dockPanelToBody();

    // Prevent “flash” at wrong coordinates: invisible + no motion until geometry is applied.
    panel.style.transition = 'none';
    panel.style.willChange = 'opacity, transform';
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-10px) scale(0.94)';

    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');

    applyPanelGeometry();
    attachPanelReposition();

    requestAnimationFrame(() => {
        applyPanelGeometry();
        requestAnimationFrame(() => {
            panel.style.transition = `opacity 0.22s ease-out, transform 0.26s ${PANEL_OPEN_EASE}`;
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0) scale(1)';
            window.setTimeout(() => {
                if (!panel.classList.contains('hidden')) {
                    panel.style.willChange = '';
                }
            }, 280);
        });
    });
}

export function wireHeaderClassSelector() {
    if (headerListenersWired) return;
    const btn = document.getElementById('header-class-selector-btn');
    const panel = document.getElementById('header-class-selector-panel');
    const followBtn = document.getElementById('header-class-follow-schedule-btn');
    const wrap = document.getElementById('header-class-selector-wrap');
    if (!btn || !panel || !wrap) return;

    headerListenersWired = true;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.classList.contains('hidden')) openHeaderPanel();
        else closeHeaderPanel();
    });

    followBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('click');
        state.setClassFollowScheduleEnabled(true);
        runScheduleBasedClassSyncOnce();
        syncHeaderClassSelector();
        closeHeaderPanel();
    });

    panel.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.header-class-item');
        if (!item) return;
        playSound('click');
        const id = item.dataset.id;
        state.setGlobalSelectedClass(id || null, true);
        syncHeaderClassSelector();
        closeHeaderPanel();
    });

    document.addEventListener('click', (e) => {
        if (wrap.contains(e.target)) return;
        if (panel.contains(e.target)) return;
        closeHeaderPanel();
    });

    syncHeaderClassSelector();
}
