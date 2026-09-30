// ui/modals/adventurersGuide.js
// The Adventurer's Guide (the (i) button in the header, and Game Guide on the phone):
// a field guide with a chapter index, search, and "Take me there" jumps into the app.

import { getTier, canUseFeature } from '../../utils/subscription.js';
import { showAnimatedModal, hideModal } from './base.js';
import {
    buildGuideChapterHtml,
    buildGuideIndexHtml,
    buildGuidePlanStampHtml,
    buildGuideSearchHtml,
    findGuideChapter
} from './adventurersGuideView.js';

const MODAL_ID = 'app-info-modal';
const PLACE_KEY = 'gcq-guide-place';

const view = {
    audience: 'teacher',
    chapter: { teacher: 'start', class: 'welcome' },
    query: '',
    planTier: 'starter',
    wired: false
};

function readPlace() {
    try {
        const saved = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null');
        if (saved && typeof saved === 'object') {
            if (saved.audience === 'teacher' || saved.audience === 'class') view.audience = saved.audience;
            if (saved.chapter && typeof saved.chapter === 'object') view.chapter = { ...view.chapter, ...saved.chapter };
        }
    } catch (_) { /* private mode: start at the beginning */ }
}

function savePlace() {
    try {
        localStorage.setItem(PLACE_KEY, JSON.stringify({ audience: view.audience, chapter: view.chapter }));
    } catch (_) { /* ignore */ }
}

/**
 * The school's plan. Feature flags are the ground truth: older subscription docs may carry
 * the flags without the 'tier' string.
 */
function resolvePlanTier() {
    if (canUseFeature('eliteAI')) return 'elite';
    const hasPro = ['guilds', 'scholarScroll', 'calendar', 'storyWeavers', 'heroProgression', 'adventureLog']
        .some((flag) => canUseFeature(flag));
    if (hasPro) return 'pro';
    const tier = getTier();
    return tier === 'elite' || tier === 'pro' ? tier : 'starter';
}

function teacherName() {
    const input = document.getElementById('teacher-name-input');
    return (input?.value || '').trim();
}

function els() {
    return {
        modal: document.getElementById(MODAL_ID),
        index: document.getElementById('ag-index'),
        page: document.getElementById('ag-page'),
        search: document.getElementById('ag-search-input'),
        searchClear: document.getElementById('ag-search-clear'),
        stamp: document.getElementById('ag-plan-stamp'),
        sub: document.getElementById('ag-cover-sub')
    };
}

function render({ scrollTop = true, focusEntry = null } = {}) {
    const { modal, index, page, stamp, sub, searchClear } = els();
    if (!modal || !index || !page) return;

    modal.dataset.audience = view.audience;
    modal.querySelectorAll('[data-ag-audience]').forEach((btn) => {
        const on = btn.dataset.agAudience === view.audience;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (stamp) stamp.innerHTML = buildGuidePlanStampHtml(view.planTier);
    if (sub) {
        sub.textContent = view.audience === 'teacher'
            ? 'A field guide to The Great Class Quest'
            : 'How our class quest works';
    }

    const searching = view.query.trim().length > 0;
    if (searchClear) searchClear.hidden = !searching;
    const chapterId = findGuideChapter(view.audience, view.chapter[view.audience]).id;
    index.innerHTML = buildGuideIndexHtml({ audience: view.audience, activeChapterId: chapterId, searching });
    page.innerHTML = searching
        ? buildGuideSearchHtml({ audience: view.audience, query: view.query.trim(), planTier: view.planTier })
        : buildGuideChapterHtml({ audience: view.audience, chapterId, planTier: view.planTier, teacherName: teacherName() });

    if (focusEntry) {
        const target = page.querySelector(`[data-ag-entry="${CSS.escape(focusEntry)}"]`);
        if (target) {
            target.classList.add('is-spotlit');
            requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
            return;
        }
    }
    if (scrollTop) page.scrollTop = 0;

    // Keep the active thumb tab in view on the phone strip.
    const activeTab = index.querySelector('.ag-tab.is-active');
    if (activeTab && index.scrollWidth > index.clientWidth) {
        const left = activeTab.offsetLeft - (index.clientWidth - activeTab.offsetWidth) / 2;
        index.scrollTo({ left: Math.max(0, left), behavior: 'instant' });
    }
}

function openChapter(chapterId, options = {}) {
    view.chapter[view.audience] = chapterId;
    view.query = '';
    const { search } = els();
    if (search) search.value = '';
    savePlace();
    render(options);
}

function setAudience(audience) {
    if (audience !== 'teacher' && audience !== 'class') return;
    view.audience = audience;
    savePlace();
    render();
}

async function goTo(target) {
    const [kind, value] = String(target || '').split(':');
    if (!value) return;
    hideModal(MODAL_ID);
    const tabs = await import('../tabs.js');
    if (kind === 'tab') await tabs.showTab(value);
    else if (kind === 'options') await tabs.showOptionsSubtab(value);
}

function wire() {
    const { modal, search } = els();
    if (!modal || view.wired) return;
    view.wired = true;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal(MODAL_ID);
            return;
        }
        const closeBtn = event.target.closest('#app-info-close-btn');
        if (closeBtn) {
            hideModal(MODAL_ID);
            return;
        }
        const audienceBtn = event.target.closest('[data-ag-audience]');
        if (audienceBtn) {
            setAudience(audienceBtn.dataset.agAudience);
            return;
        }
        const chapterBtn = event.target.closest('[data-ag-chapter]');
        if (chapterBtn) {
            openChapter(chapterBtn.dataset.agChapter);
            return;
        }
        const goBtn = event.target.closest('[data-ag-go]');
        if (goBtn) {
            goTo(goBtn.dataset.agGo);
            return;
        }
        if (event.target.closest('#ag-search-clear')) {
            view.query = '';
            if (search) {
                search.value = '';
                search.focus();
            }
            render();
        }
    });

    let searchTimer = null;
    search?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            view.query = search.value;
            render();
        }, 120);
    });

    document.addEventListener('keydown', (event) => {
        if (modal.classList.contains('hidden')) return;
        if (event.key === 'Escape') {
            if (document.activeElement === search && search.value) {
                search.value = '';
                view.query = '';
                render();
            } else {
                hideModal(MODAL_ID);
            }
            event.stopPropagation();
            return;
        }
        const typing = event.target instanceof HTMLElement
            && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
        if (event.key === '/' && !typing) {
            event.preventDefault();
            search?.focus();
        }
    });
}

/**
 * Open the guide. Optional: { audience: 'teacher' | 'class', chapter, entry } to open on a topic.
 */
export function openAdventurersGuide(options = {}) {
    const { modal } = els();
    if (!modal) return;
    readPlace();
    wire();
    view.planTier = resolvePlanTier();
    view.query = '';
    const { search } = els();
    if (search) search.value = '';

    const opts = options && typeof options === 'object' && !(options instanceof Event) ? options : {};
    if (opts.audience === 'teacher' || opts.audience === 'class') view.audience = opts.audience;
    if (opts.chapter) view.chapter[view.audience] = opts.chapter;

    render({ focusEntry: opts.entry || null });
    showAnimatedModal(MODAL_ID);
}
