// Global class picker in the app header: the "class compass" dropdown.
// A sky band painted from the shared live sky (--wx-sky-*), today's lessons first,
// league-coloured class gems, and a follow-the-schedule switch.
// Panel is moved to document.body while open + position:fixed so it always sits above
// main content (stacking contexts / transforms on #app-screen would otherwise hide it).
// Motion is transform/opacity only; html[data-wx-lite="1"] and reduced motion drop the extras.
import * as state from '../state.js';
import * as utils from '../utils.js';
import { playSound } from '../audio.js';
import { escapeHtml } from '../features/roles/shared.js';
import { getQuestLeagueDefinition } from '../constants.js';
import { runScheduleBasedClassSyncOnce } from '../features/home.js';

let headerListenersWired = false;
/** Where to put the panel back when closing ({ parent, nextSibling } or null) */
let panelDock = null;
let panelRepositionCleanup = null;
let panelCloseTimer = null;
let pickTimer = null;
let lastShownClassId;
let searchQuery = '';
let panelStyles = null;
let panelStylesSettled = false;

const PANEL_OPEN_EASE = 'cubic-bezier(0.34, 1.32, 0.64, 1)';
const PANEL_CLOSE_MS = 170;
const PICK_HOLD_MS = 240;
const SEARCH_FROM = 7;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const liteMotion = () => document.documentElement.dataset.wxLite === '1' || reducedMotion();

/** The panel's stylesheet loads on demand (kept out of the initial bundle). */
function loadPanelStyles() {
    panelStyles ||= import('../styles/class_switcher.css')
        .catch((e) => {
            panelStyles = null;
            console.warn('Class compass styles failed to load:', e);
        })
        .finally(() => { panelStylesSettled = true; });
    return panelStyles;
}

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
    const pw = Math.min(21.5 * 16, vw - margin * 2);

    let left = r.right - pw;
    left = Math.max(margin, Math.min(left, vw - pw - margin));
    panel.style.left = `${left}px`;
    panel.style.width = `${pw}px`;
    panel.style.setProperty('--cd-max-h', `${Math.max(240, vh - r.bottom - margin * 3)}px`);
    // Point the little notch at the button, wherever the panel had to slide to.
    panel.style.setProperty('--cd-notch-x', `${Math.max(24, Math.min(pw - 24, r.left + r.width / 2 - left))}px`);

    const ph = panel.getBoundingClientRect().height || 1;
    let top = r.bottom + margin + 2;
    top = Math.max(margin, Math.min(top, vh - ph - margin));
    panel.style.top = `${top}px`;
    panel.style.zIndex = '2147483000';
}

function attachPanelReposition() {
    detachPanelReposition();
    const onReposition = (e) => {
        // Scrolling the class list itself must not re-measure the panel.
        if (e?.type === 'scroll' && e.target instanceof Node && document.getElementById('header-class-selector-panel')?.contains(e.target)) return;
        applyPanelGeometry();
    };
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
        panel.classList.remove('is-open', 'is-picking');
        restorePanelToHeader();
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

// ---------------------------------------------------------------------------
// Today's schedule for the teacher's own classes
// ---------------------------------------------------------------------------

function minutesNow(now = new Date()) {
    return now.getHours() * 60 + now.getMinutes();
}

function shortTime(value) {
    const m = utils.parseClockToMinutes(value);
    if (m == null) return '';
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** { todayIds: Map(id → lesson), live, next } for the teacher's classes today. */
function readTodaysLessons(myClasses) {
    const empty = { today: new Map(), live: null, next: null };
    try {
        const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
        const todays = utils.getClassesOnDay(
            utils.getTodayDateString(),
            state.get('allSchoolClasses') || [],
            state.get('allScheduleOverrides') || [],
            classEndDates
        );
        const mine = todays.filter((c) => myClasses.some((mc) => mc.id === c.id));
        const now = new Date();
        const n = minutesNow(now);
        const live = utils.findCurrentLessonClass(mine, now);
        const next = mine.find((c) => {
            const s = utils.parseClockToMinutes(c.timeStart);
            return s != null && s > n;
        }) || null;
        return { today: new Map(mine.map((c) => [c.id, c])), live, next };
    } catch (_) {
        return empty;
    }
}

function followHint(lessons) {
    if (lessons.live) return `In session now: <b>${escapeHtml(lessons.live.name)}</b>`;
    if (lessons.next) return `Next up: <b>${escapeHtml(lessons.next.name)}</b> at ${escapeHtml(shortTime(lessons.next.timeStart))}`;
    if (lessons.today.size) return 'Today’s lessons are done. General view until tomorrow';
    return 'No lessons today. General view stays on';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function studentCounts() {
    const counts = new Map();
    for (const s of state.get('allStudents') || []) {
        if (s?.classId) counts.set(s.classId, (counts.get(s.classId) || 0) + 1);
    }
    return counts;
}

function leagueFor(c) {
    return getQuestLeagueDefinition(c?.questLevel);
}

/** "League A" for the letter leagues, the name itself for Pre-Junior / Junior A / Junior B. */
function leagueLabel(c, league = leagueFor(c)) {
    if (!league) return c?.questLevel || 'Quest';
    return league.name.length <= 2 ? `League ${league.name}` : league.name;
}

function optionHtml(c, { index, currentId, lessons, counts }) {
    const league = leagueFor(c);
    const theme = league ? `league-picker-option--${league.pickerTheme}` : 'gcq-cd-opt--plain';
    const icon = league?.pickerIcon || 'fa-flag';
    const count = counts.get(c.id) || 0;
    const heroes = count ? ` · ${count} ${count === 1 ? 'hero' : 'heroes'}` : '';
    const isCurrent = c.id === currentId;
    const isLive = lessons.live?.id === c.id;
    const lesson = lessons.today.get(c.id);

    let tail = '';
    if (isLive) {
        tail = '<span class="gcq-cd-chip gcq-cd-chip--live"><span class="gcq-cd-chip__dot"></span>Now</span>';
    } else if (lesson) {
        const start = shortTime(lesson.timeStart);
        const end = utils.parseClockToMinutes(lesson.timeEnd);
        const done = end != null && end < minutesNow();
        if (start) tail = `<span class="gcq-cd-chip${done ? ' gcq-cd-chip--done' : ''}">${done ? '<i class="fas fa-check"></i>' : '<i class="far fa-clock"></i>'}${escapeHtml(start)}</span>`;
    }
    const check = isCurrent ? '<span class="gcq-cd-opt__check" aria-hidden="true"><i class="fas fa-check"></i></span>' : '';
    const search = `${c.name || ''} ${c.questLevel || ''}`.toLowerCase();

    return `
        <button type="button" class="gcq-cd-opt ${theme}${isCurrent ? ' is-current' : ''}${isLive ? ' is-live' : ''}"
            data-cd-id="${escapeHtml(c.id)}" data-cd-search="${escapeHtml(search)}" role="option" aria-selected="${isCurrent}"
            style="--i:${Math.min(index, 10)}">
            <span class="gcq-cd-opt__gem" aria-hidden="true"><span class="gcq-cd-opt__logo">${escapeHtml(c.logo || '📚')}</span>${check}</span>
            <span class="gcq-cd-opt__body">
                <span class="gcq-cd-opt__name">${escapeHtml(c.name)}</span>
                <span class="gcq-cd-opt__meta"><i class="fas ${escapeHtml(icon)}" aria-hidden="true"></i>${escapeHtml(leagueLabel(c, league))}${heroes}</span>
            </span>
            ${tail}
            <span class="gcq-cd-opt__spark gcq-cd-opt__spark--a" aria-hidden="true"></span>
            <span class="gcq-cd-opt__spark gcq-cd-opt__spark--b" aria-hidden="true"></span>
            <span class="gcq-cd-opt__spark gcq-cd-opt__spark--c" aria-hidden="true"></span>
        </button>`;
}

function renderPanel() {
    const panel = document.getElementById('header-class-selector-panel');
    if (!panel) return;

    const classes = (state.get('allTeachersClasses') || []).slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const currentId = state.get('globalSelectedClassId') || null;
    const follow = !!state.get('classFollowSchedule');
    const lessons = readTodaysLessons(classes);
    const counts = studentCounts();
    const current = currentId ? classes.find((c) => c.id === currentId) : null;
    const currentLeague = leagueFor(current);

    const todays = classes.filter((c) => lessons.today.has(c.id))
        .sort((a, b) => String(lessons.today.get(a.id).timeStart || '99:99').localeCompare(String(lessons.today.get(b.id).timeStart || '99:99')));
    const others = classes.filter((c) => !lessons.today.has(c.id));

    let i = 2;
    const section = (label, icon, list) => !list.length ? '' : `
        <div class="gcq-cd-section" role="presentation"><i class="fas ${icon}" aria-hidden="true"></i>${label}</div>
        ${list.map((c) => optionHtml(c, { index: i++, currentId, lessons, counts })).join('')}`;

    const nowName = current ? current.name : 'General view';
    const nowLogo = current ? (current.logo || '📚') : '🏫';
    const nowMeta = current
        ? `${escapeHtml(leagueLabel(current, currentLeague))}${lessons.live?.id === current.id ? ' · in session now' : ''}`
        : 'Every class at once';
    const nowTheme = currentLeague ? `league-picker-option--${currentLeague.pickerTheme}` : 'gcq-cd-now--general';

    panel.innerHTML = `
        <div class="gcq-cd__notch" aria-hidden="true"></div>
        <div class="gcq-cd__sky">
            <span class="gcq-cd__glow" aria-hidden="true"></span>
            <span class="gcq-cd__cloud gcq-cd__cloud--a" aria-hidden="true"></span>
            <span class="gcq-cd__cloud gcq-cd__cloud--b" aria-hidden="true"></span>
            <span class="gcq-cd__stars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
            <span class="gcq-cd__sheen" aria-hidden="true"></span>
            <div class="gcq-cd__now ${nowTheme}">
                <span class="gcq-cd__now-medal" aria-hidden="true"><span>${escapeHtml(nowLogo)}</span></span>
                <span class="gcq-cd__now-copy">
                    <span class="gcq-cd__eyebrow">${follow ? '<i class="fas fa-clock"></i> Following the schedule' : '<i class="fas fa-map-pin"></i> Now leading'}</span>
                    <span class="gcq-cd__now-name">${escapeHtml(nowName)}</span>
                    <span class="gcq-cd__now-meta">${nowMeta}</span>
                </span>
            </div>
            <svg class="gcq-cd__hills" viewBox="0 0 344 22" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path class="gcq-cd__hill-back" d="M0 14 C 40 4, 86 6, 128 13 S 214 4, 262 9 S 326 15, 344 8 V22 H0 Z"/>
                <path class="gcq-cd__hill-front" d="M0 18 C 54 10, 104 12, 152 18 S 248 10, 300 15 S 336 19, 344 16 V22 H0 Z"/>
            </svg>
        </div>
        <div class="gcq-cd__body">
            <button type="button" class="gcq-cd-follow${follow ? ' is-on' : ''}" data-cd-action="follow" role="switch" aria-checked="${follow}" style="--i:0">
                <span class="gcq-cd-follow__icon" aria-hidden="true">⏰</span>
                <span class="gcq-cd-follow__copy">
                    <span class="gcq-cd-follow__title">Follow today’s schedule</span>
                    <span class="gcq-cd-follow__hint">${followHint(lessons)}</span>
                </span>
                <span class="gcq-cd-switch" aria-hidden="true"><span class="gcq-cd-switch__knob"></span></span>
            </button>
            ${classes.length >= SEARCH_FROM ? `
            <label class="gcq-cd-search" style="--i:1">
                <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                <input type="text" class="gcq-cd-search__input" placeholder="Find a class…" autocomplete="off" spellcheck="false" aria-label="Find a class" value="${escapeHtml(searchQuery)}">
            </label>` : ''}
            <div class="gcq-cd__list custom-scrollbar" role="listbox" aria-label="Classes">
                <button type="button" class="gcq-cd-opt gcq-cd-opt--general${currentId ? '' : ' is-current'}" data-cd-id="" data-cd-search="general view all" role="option" aria-selected="${!currentId}" style="--i:1">
                    <span class="gcq-cd-opt__gem" aria-hidden="true"><span class="gcq-cd-opt__logo">🏫</span>${currentId ? '' : '<span class="gcq-cd-opt__check"><i class="fas fa-check"></i></span>'}</span>
                    <span class="gcq-cd-opt__body">
                        <span class="gcq-cd-opt__name">General view</span>
                        <span class="gcq-cd-opt__meta"><i class="fas fa-globe" aria-hidden="true"></i>Every class at once</span>
                    </span>
                    <span class="gcq-cd-opt__spark gcq-cd-opt__spark--a" aria-hidden="true"></span>
                    <span class="gcq-cd-opt__spark gcq-cd-opt__spark--b" aria-hidden="true"></span>
                    <span class="gcq-cd-opt__spark gcq-cd-opt__spark--c" aria-hidden="true"></span>
                </button>
                ${section('Today’s lessons', 'fa-sun', todays)}
                ${section(todays.length ? 'Other classes' : 'Your classes', 'fa-flag', others)}
                ${classes.length ? '<p class="gcq-cd__empty" hidden>No class by that name</p>' : '<p class="gcq-cd__empty">No classes yet. Create one in Settings.</p>'}
            </div>
        </div>`;

    if (searchQuery) applySearch(panel, searchQuery);
}

function applySearch(panel, query) {
    const q = query.trim().toLowerCase();
    let shown = 0;
    panel.querySelectorAll('.gcq-cd__list .gcq-cd-opt').forEach((opt) => {
        const match = !q || (opt.dataset.cdSearch || '').includes(q);
        opt.hidden = !match;
        if (match) shown++;
    });
    panel.querySelectorAll('.gcq-cd-section').forEach((label) => {
        let el = label.nextElementSibling;
        let any = false;
        while (el && el.classList.contains('gcq-cd-opt')) {
            if (!el.hidden) any = true;
            el = el.nextElementSibling;
        }
        label.hidden = !any;
    });
    const empty = panel.querySelector('.gcq-cd__empty');
    if (empty && (state.get('allTeachersClasses') || []).length) empty.hidden = shown > 0;
}

/** Header pill: logo, name, follow badge; a small pop when the class changes. */
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

    document.getElementById('header-class-follow-badge')?.classList.toggle('hidden', !follow);
    btn.classList.toggle('is-following', !!follow);

    const shownId = classId || '';
    if (lastShownClassId !== undefined && lastShownClassId !== shownId && !liteMotion()) {
        logoEl.classList.remove('gcq-cd-logo-pop');
        void logoEl.offsetWidth;
        logoEl.classList.add('gcq-cd-logo-pop');
    }
    lastShownClassId = shownId;

    const panel = document.getElementById('header-class-selector-panel');
    if (panel && !panel.classList.contains('hidden') && !panel.classList.contains('is-picking')) {
        renderPanel();
        applyPanelGeometry();
    }
}

function closeHeaderPanel({ focusButton = false } = {}) {
    const panel = document.getElementById('header-class-selector-panel');
    const btn = document.getElementById('header-class-selector-btn');
    detachPanelReposition();
    if (pickTimer !== null) {
        clearTimeout(pickTimer);
        pickTimer = null;
    }
    if (focusButton) btn?.focus();

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

    btn?.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    panel.style.willChange = 'opacity, transform';
    panel.style.transition = `opacity ${PANEL_CLOSE_MS}ms ease-in, transform ${PANEL_CLOSE_MS}ms ease-in`;
    panel.style.opacity = '0';
    panel.style.transform = reducedMotion() ? 'none' : 'translateY(-6px) scale(0.97)';

    panelCloseTimer = window.setTimeout(() => {
        panelCloseTimer = null;
        finishClosePanel();
    }, PANEL_CLOSE_MS);
}

function openHeaderPanel() {
    const panel = document.getElementById('header-class-selector-panel');
    const btn = document.getElementById('header-class-selector-btn');
    if (!panel || !btn) return;

    if (!panelStylesSettled) {
        // First open before the idle preload finished: open as soon as the styles land
        // (or failed — the panel still works unstyled), unless the teacher clicked away.
        btn.setAttribute('aria-expanded', 'true');
        loadPanelStyles().finally(() => {
            panelStylesSettled = true;
            if (btn.getAttribute('aria-expanded') === 'true') openHeaderPanel();
        });
        return;
    }

    if (panelCloseTimer !== null) {
        clearTimeout(panelCloseTimer);
        panelCloseTimer = null;
    }

    searchQuery = '';
    renderPanel();
    dockPanelToBody();
    panel.classList.remove('is-open', 'is-picking');

    // Prevent “flash” at wrong coordinates: invisible + no motion until geometry is applied.
    const still = reducedMotion();
    panel.style.transition = 'none';
    panel.style.willChange = 'opacity, transform';
    panel.style.opacity = '0';
    panel.style.transform = still ? 'none' : 'translateY(-10px) scale(0.94)';

    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');

    applyPanelGeometry();
    attachPanelReposition();

    requestAnimationFrame(() => {
        applyPanelGeometry();
        requestAnimationFrame(() => {
            panel.style.transition = still
                ? 'opacity 0.16s ease-out'
                : `opacity 0.2s ease-out, transform 0.32s ${PANEL_OPEN_EASE}`;
            panel.style.opacity = '1';
            panel.style.transform = 'none';
            panel.classList.add('is-open');
            const current = panel.querySelector('.gcq-cd-opt.is-current');
            current?.scrollIntoView({ block: 'nearest' });
            const search = panel.querySelector('.gcq-cd-search__input');
            (search && !window.matchMedia?.('(pointer: coarse)').matches ? search : current)?.focus({ preventScroll: true });
            window.setTimeout(() => {
                if (!panel.classList.contains('hidden')) {
                    panel.style.willChange = '';
                }
            }, 340);
        });
    });
}

function pickClass(panel, opt) {
    if (panel.classList.contains('is-picking')) return;
    playSound('click');
    const id = opt.dataset.cdId || null;
    const settle = () => {
        pickTimer = null;
        state.setGlobalSelectedClass(id, true);
        syncHeaderClassSelector();
        closeHeaderPanel({ focusButton: true });
    };
    if (liteMotion()) {
        settle();
        return;
    }
    // A short beat so the pick visibly lands (gem pop + sparks) before the panel folds away.
    panel.classList.add('is-picking');
    panel.querySelectorAll('.gcq-cd-opt.is-picked').forEach((el) => el.classList.remove('is-picked'));
    opt.classList.add('is-picked');
    pickTimer = window.setTimeout(settle, PICK_HOLD_MS);
}

function toggleFollow() {
    playSound('click');
    const next = !state.get('classFollowSchedule');
    state.setClassFollowScheduleEnabled(next);
    if (next) runScheduleBasedClassSyncOnce();
    syncHeaderClassSelector();
    if (next) closeHeaderPanel({ focusButton: true });
    else document.querySelector('#header-class-selector-panel .gcq-cd-follow')?.focus({ preventScroll: true });
}

function moveFocus(panel, step) {
    const items = [...panel.querySelectorAll('.gcq-cd-follow, .gcq-cd__list .gcq-cd-opt:not([hidden])')];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    const next = at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
    items[next].focus();
    items[next].scrollIntoView({ block: 'nearest' });
}

/**
 * Lay the panel out once, off-screen, while the browser is idle, so the first real
 * open does not pay for first-time style, font and emoji work on a weak laptop.
 */
function warmPanelWhenIdle(triesLeft = 4) {
    const warm = () => {
        const panel = document.getElementById('header-class-selector-panel');
        if (!panel || !panel.classList.contains('hidden')) return;
        // Classes arrive from Firestore after sign-in; wait for them a few times.
        if (!(state.get('allTeachersClasses') || []).length) {
            if (triesLeft > 1) warmPanelWhenIdle(triesLeft - 1);
            return;
        }
        if (!panelStylesSettled) {
            loadPanelStyles().finally(warm);
            return;
        }
        renderPanel();
        panel.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;width:344px';
        panel.classList.remove('hidden');
        void panel.offsetHeight;
        panel.classList.add('hidden');
        panel.style.cssText = '';
    };
    const later = () => ('requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 6000 }) : setTimeout(warm, 1500));
    setTimeout(later, 2500);
}

export function wireHeaderClassSelector() {
    if (headerListenersWired) return;
    const btn = document.getElementById('header-class-selector-btn');
    const panel = document.getElementById('header-class-selector-panel');
    const wrap = document.getElementById('header-class-selector-wrap');
    if (!btn || !panel || !wrap) return;

    headerListenersWired = true;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.classList.contains('hidden') || btn.getAttribute('aria-expanded') !== 'true') openHeaderPanel();
        else closeHeaderPanel();
    });

    btn.addEventListener('pointerenter', () => { loadPanelStyles(); }, { once: true });

    btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && panel.classList.contains('hidden')) {
            e.preventDefault();
            openHeaderPanel();
        }
    });

    panel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('[data-cd-action="follow"]')) {
            toggleFollow();
            return;
        }
        const opt = e.target.closest('.gcq-cd-opt');
        if (opt) pickClass(panel, opt);
    });

    panel.addEventListener('input', (e) => {
        if (!e.target.classList?.contains('gcq-cd-search__input')) return;
        searchQuery = e.target.value;
        applySearch(panel, searchQuery);
    });

    panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeHeaderPanel({ focusButton: true });
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(panel, e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter' && e.target.classList?.contains('gcq-cd-search__input') && searchQuery.trim()) {
            const first = panel.querySelector('.gcq-cd__list .gcq-cd-opt:not([hidden])');
            if (first) pickClass(panel, first);
        }
    });

    document.addEventListener('click', (e) => {
        if (wrap.contains(e.target)) return;
        if (panel.contains(e.target)) return;
        closeHeaderPanel();
    });

    syncHeaderClassSelector();
    warmPanelWhenIdle();
}
