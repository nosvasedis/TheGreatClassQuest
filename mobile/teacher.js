import * as state from '../state.js';
import { playSound } from '../audio.js';
import { auth, signOut } from '../firebaseAuth.js';
import { walkOutThroughGate } from '../ui/authGate.js';
import { getDeviceCacheChoice, clearLocalAppData } from '../utils/deviceCache.js';
import { escapeHtml } from '../features/roles/shared.js';
import { renderMobileHome } from './home.js';
import { getTodayDateString, getClassesOnDay } from '../utils.js';

const TEACHER_APP_SCREEN = 'app-screen';
const SECRETARY_SCREEN = 'secretary-screen';

let clockInterval = null;
let updateMirrorObserver = null;
let desktopPillObserver = null;
let subtabObserver = null;
let wired = false;
let updateMirrorWired = false;

function setSheetOpen(sheet, open) {
    if (!sheet) return;

    if (open) {
        sheet.classList.remove('m-sheet--closing');
        sheet.classList.add('m-sheet--open');
        sheet.setAttribute('aria-hidden', 'false');
        document.body.classList.add('m-sheet-locked');
        return;
    }

    if (sheet.classList.contains('m-sheet--closing')) {
        document.body.classList.toggle('m-sheet-locked', anySheetOpen());
        return;
    }

    if (!sheet.classList.contains('m-sheet--open')) {
        document.body.classList.toggle('m-sheet-locked', anySheetOpen());
        return;
    }

    sheet.classList.remove('m-sheet--open');
    sheet.classList.add('m-sheet--closing');
    sheet.setAttribute('aria-hidden', 'true');
    const panel = sheet.querySelector('.m-sheet__panel');
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        sheet.classList.remove('m-sheet--closing');
        document.body.classList.toggle('m-sheet-locked', anySheetOpen());
        panel?.removeEventListener('transitionend', onEnd);
    };
    const onEnd = (event) => {
        if (event.target !== panel) return;
        if (event.propertyName && event.propertyName !== 'transform') return;
        finish();
    };
    // Force reflow so closing transition runs from open position
    if (panel) {
        panel.style.transform = 'translateY(0)';
        // eslint-disable-next-line no-unused-expressions
        panel.offsetHeight;
        panel.style.transform = '';
    }
    panel?.addEventListener('transitionend', onEnd);
    window.setTimeout(finish, 480);
}

function anySheetOpen() {
    return Boolean(
        document.querySelector([
            '#m-more-sheet.m-sheet--open', '#m-class-picker-sheet.m-sheet--open', '#m-options-subtab-sheet.m-sheet--open',
            '#m-more-sheet.m-sheet--closing', '#m-class-picker-sheet.m-sheet--closing', '#m-options-subtab-sheet.m-sheet--closing'
        ].join(', '))
    );
}

function logout() {
    playSound('click');
    void walkOutThroughGate(() => signOut(auth)).then(() => {
        if (getDeviceCacheChoice() === 'shared') clearLocalAppData();
    });
}

function syncClassPill() {
    const logoEl = document.getElementById('m-class-selector-logo');
    const textEl = document.getElementById('m-class-selector-text');
    const pill = document.getElementById('m-class-selector-btn');
    if (!logoEl || !textEl || !pill) return;

    const classId = state.get('globalSelectedClassId');
    const follow = state.get('classFollowSchedule');
    const classes = state.get('allTeachersClasses') || [];
    const classData = classId ? classes.find((c) => c.id === classId) : null;

    if (classData) {
        logoEl.textContent = classData.logo || '📚';
        textEl.textContent = classData.name;
    } else {
        logoEl.textContent = '🏫';
        textEl.textContent = 'General';
    }
    const eyebrowEl = document.getElementById('m-class-selector-eyebrow');
    if (eyebrowEl) eyebrowEl.textContent = follow ? 'On schedule' : (classData ? 'Class' : 'Viewing');
    pill.classList.toggle('m-class-pill--follow', Boolean(follow));
    pill.title = follow
        ? 'Following today\'s schedule — tap to change'
        : 'Choose class — tap to change';
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutesOf(hhmm) {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
}

/** Days, time and whether each class meets today / is in session right now. */
function describeClassSchedule(c, todayIds, nowMinutes) {
    const days = (c.scheduleDays || [])
        .map((d) => WEEKDAY_SHORT[Number(d) % 7])
        .filter(Boolean)
        .join(' · ');
    const time = c.timeStart ? `${c.timeStart}${c.timeEnd ? `–${c.timeEnd}` : ''}` : '';
    const today = todayIds.has(c.id);
    const start = minutesOf(c.timeStart);
    const end = minutesOf(c.timeEnd);
    const live = today && start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
    return { line: [days, time].filter(Boolean).join('  ·  ') || (c.questLevel || 'Quest'), today, live };
}

function renderClassPickerList() {
    const mount = document.getElementById('m-class-list');
    if (!mount) return;
    const activeId = state.get('globalSelectedClassId') || '';
    const follow = Boolean(state.get('classFollowSchedule'));
    const classes = (state.get('allTeachersClasses') || [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));

    let todayIds = new Set();
    try {
        const todays = getClassesOnDay(
            getTodayDateString(),
            state.get('allSchoolClasses') || classes,
            state.get('allScheduleOverrides') || [],
            state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}
        );
        todayIds = new Set(todays.map((c) => c.id));
    } catch (_) { /* schedule unknown: rows just show their days */ }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    mount.innerHTML = classes.length
        ? classes.map((c) => {
            const info = describeClassSchedule(c, todayIds, nowMinutes);
            const current = c.id === activeId;
            const badge = info.live
                ? '<span class="m-class-option__badge m-class-option__badge--live">In session</span>'
                : (info.today ? '<span class="m-class-option__badge">Today</span>' : '');
            return `
            <button type="button" class="m-class-option m-pressable ${current ? 'm-class-option--current' : ''}" data-m-class-id="${escapeHtml(c.id)}" ${current ? 'aria-current="true"' : ''}>
                <span class="m-class-option__logo" aria-hidden="true">${escapeHtml(c.logo || '📚')}</span>
                <span class="m-class-option__body"><strong>${escapeHtml(c.name)}${badge}</strong><small>${escapeHtml(info.line)}</small></span>
                <i class="fas ${current ? 'fa-check' : 'fa-chevron-right'} m-class-option__chev" aria-hidden="true"></i>
            </button>`;
        }).join('')
        : '<p class="m-class-picker__empty">No classes yet. Create one from Settings.</p>';

    const general = document.getElementById('m-class-general-option');
    general?.classList.toggle('m-class-option--current', !activeId && !follow);
    const followBtn = document.getElementById('m-class-follow-schedule');
    followBtn?.classList.toggle('m-class-option--on', follow);
    followBtn?.setAttribute('aria-pressed', follow ? 'true' : 'false');
    const eyebrow = document.getElementById('m-class-picker-eyebrow');
    if (eyebrow) {
        const current = classes.find((c) => c.id === activeId);
        eyebrow.textContent = follow
            ? 'Following today\'s schedule'
            : `Currently viewing ${current ? current.name : 'General'}`;
    }
}

function openMoreSheet() {
    const item = document.getElementById('m-secretary-console-item');
    if (item) {
        const desktopBtn = document.getElementById('secretary-console-btn');
        item.classList.toggle('hidden', !desktopBtn || desktopBtn.classList.contains('hidden'));
    }
    const sheet = document.getElementById('m-more-sheet');
    setSheetOpen(sheet, true);
    const moreBtn = document.getElementById('m-more-btn');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'true');
}

// When the open tab lives inside More, the More cloud wears that tab's colour, icon
// and name, so the dock always shows where you are.
const DOCK_TAB_IDS = new Set(['about-tab', 'class-leaderboard-tab', 'student-leaderboard-tab', 'award-stars-tab']);
const MORE_SHORT_LABELS = {
    'shop-tab': 'Market',
    'guilds-tab': 'Guilds',
    'adventure-log-tab': 'Log',
    'scholars-scroll-tab': 'Scroll',
    'calendar-tab': 'Calendar',
    'reward-ideas-tab': 'Training',
    'manage-students-tab': 'Roster',
    'options-tab': 'Settings'
};
let moreActiveObserver = null;

function syncMoreButton() {
    const moreBtn = document.getElementById('m-more-btn');
    const icon = document.getElementById('m-more-btn-icon');
    const text = document.getElementById('m-more-btn-text');
    if (!moreBtn || !icon || !text) return;
    const activeItem = document.querySelector('#m-more-sheet .m-more-item.active[data-tab]');
    const tabId = activeItem?.dataset.tab;
    const colorClass = (el) => [...(el?.classList || [])].find((c) => c.startsWith('nav-color-'));
    [...moreBtn.classList].filter((c) => c.startsWith('nav-color-')).forEach((c) => moreBtn.classList.remove(c));
    if (tabId && !DOCK_TAB_IDS.has(tabId)) {
        moreBtn.classList.add(colorClass(activeItem) || 'nav-color-indigo', 'active', 'm-dock-btn--carrying');
        const itemIcon = activeItem.querySelector('.icon');
        icon.className = `${[...(itemIcon?.classList || [])].filter((c) => c.startsWith('fa')).join(' ') || 'fas fa-ellipsis'} icon`;
        text.textContent = MORE_SHORT_LABELS[tabId] || 'More';
        moreBtn.setAttribute('aria-label', `More (now: ${activeItem.getAttribute('aria-label') || text.textContent})`);
    } else {
        moreBtn.classList.remove('active', 'm-dock-btn--carrying');
        moreBtn.classList.add('nav-color-indigo');
        icon.className = 'fas fa-ellipsis icon';
        text.textContent = 'More';
        moreBtn.setAttribute('aria-label', 'More');
    }
}

function observeMoreActive() {
    const list = document.querySelector('#m-more-sheet .m-sheet__list');
    if (!list) return;
    if (moreActiveObserver) moreActiveObserver.disconnect();
    moreActiveObserver = new MutationObserver(syncMoreButton);
    moreActiveObserver.observe(list, { attributes: true, attributeFilter: ['class'], subtree: true });
    syncMoreButton();
}

// Drag a sheet down by its grabber or heading to close it (touch and pen).
function wireSheetSwipe(sheet, close) {
    const panel = sheet?.querySelector('.m-sheet__panel');
    if (!panel) return;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let dragging = false;
    let pointerId = null;

    panel.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        if (!event.target.closest('.m-sheet__grabber, .m-sheet__heading')) return;
        if (event.target.closest('button')) return;
        dragging = true;
        pointerId = event.pointerId;
        startY = event.clientY;
        startT = performance.now();
        dy = 0;
        try { panel.setPointerCapture?.(pointerId); } catch (_) { /* synthetic or ended pointer */ }
        panel.classList.add('m-sheet__panel--dragging');
    });
    panel.addEventListener('pointermove', (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        dy = Math.max(0, event.clientY - startY);
        panel.style.transform = `translateY(${dy}px)`;
    });
    const end = (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        dragging = false;
        try { panel.releasePointerCapture?.(pointerId); } catch (_) { /* already released */ }
        panel.classList.remove('m-sheet__panel--dragging');
        const speed = dy / Math.max(1, performance.now() - startT);
        panel.style.transform = '';
        if (dy > 90 || (dy > 24 && speed > 0.55)) {
            playSound('click');
            close();
        }
    };
    panel.addEventListener('pointerup', end);
    panel.addEventListener('pointercancel', end);
}

function closeMoreSheet() {
    const sheet = document.getElementById('m-more-sheet');
    setSheetOpen(sheet, false);
    const moreBtn = document.getElementById('m-more-btn');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
}

function openClassPicker() {
    renderClassPickerList();
    syncClassPill();
    const sheet = document.getElementById('m-class-picker-sheet');
    setSheetOpen(sheet, true);
    document.getElementById('m-class-selector-btn')?.setAttribute('aria-expanded', 'true');
}

function closeClassPicker() {
    const sheet = document.getElementById('m-class-picker-sheet');
    setSheetOpen(sheet, false);
    document.getElementById('m-class-selector-btn')?.setAttribute('aria-expanded', 'false');
}

// Desktop Teacher Settings uses a dropdown for its sections. Mobile hides
// that whole bar and drives the same hidden buttons from a sheet instead.
function renderOptionsSubtabList() {
    const list = document.getElementById('m-options-subtab-list');
    if (!list) return;
    const buttons = Array.from(document.querySelectorAll('#options-tab .options-subtab-btn'));
    list.innerHTML = buttons
        .filter((btn) => !btn.classList.contains('hidden'))
        .map((btn) => {
            const icon = btn.querySelector('i')?.className || 'fas fa-circle';
            const label = escapeHtml(btn.textContent.trim());
            const key = btn.dataset.optionsTab;
            const active = btn.classList.contains('options-subtab-active');
            const hint = btn.dataset.hint ? `<small class="m-options-subtab-option__hint">${escapeHtml(btn.dataset.hint)}</small>` : '';
            return `
                <button type="button" class="m-options-subtab-option m-pressable ${active ? 'm-options-subtab-option--active' : ''}" data-m-subtab-key="${key}" ${active ? 'aria-current="true"' : ''}>
                    <span class="m-options-subtab-option__icon" aria-hidden="true"><i class="${icon}"></i></span>
                    <span class="m-options-subtab-option__label">${label}${hint}</span>
                    ${active ? '<i class="fas fa-check m-options-subtab-option__check" aria-hidden="true"></i>' : ''}
                </button>`;
        }).join('');
}

function syncOptionsSubtabTrigger() {
    const activeBtn = document.querySelector('#options-tab .options-subtab-btn.options-subtab-active');
    const iconEl = document.getElementById('m-options-subtab-trigger-icon');
    const labelEl = document.getElementById('m-options-subtab-trigger-label');
    if (!activeBtn || !iconEl || !labelEl) return;
    const icon = activeBtn.querySelector('i')?.className || 'fas fa-circle';
    iconEl.innerHTML = `<i class="${icon}"></i>`;
    labelEl.textContent = activeBtn.textContent.trim();
}

function openOptionsSubtabSheet() {
    renderOptionsSubtabList();
    const sheet = document.getElementById('m-options-subtab-sheet');
    setSheetOpen(sheet, true);
    document.getElementById('m-options-subtab-trigger')?.setAttribute('aria-expanded', 'true');
}

function closeOptionsSubtabSheet() {
    const sheet = document.getElementById('m-options-subtab-sheet');
    setSheetOpen(sheet, false);
    document.getElementById('m-options-subtab-trigger')?.setAttribute('aria-expanded', 'false');
}

function observeOptionsSubtabs() {
    const bar = document.querySelector('#options-tab .options-subtab-bar');
    if (!bar) return;
    if (subtabObserver) subtabObserver.disconnect();
    subtabObserver = new MutationObserver(() => syncOptionsSubtabTrigger());
    subtabObserver.observe(bar, { attributes: true, attributeFilter: ['class'], subtree: true });
    syncOptionsSubtabTrigger();
}

async function openSecretaryConsole() {
    document.getElementById(TEACHER_APP_SCREEN)?.classList.add('hidden');
    document.getElementById(SECRETARY_SCREEN)?.classList.remove('hidden');
    document.getElementById('secretary-console-btn')?.classList.remove('hidden');
    closeMoreSheet();
    const nav = await import('../ui/roles/navigation.js');
    nav.activateSecretaryTab('home');
    const consoleModule = await import('../features/secretaryConsole.js');
    consoleModule.renderSecretaryConsole();
}

function startClock() {
    if (clockInterval) return;
    const update = () => {
        const timeEl = document.getElementById('m-current-time');
        const dateEl = document.getElementById('m-current-date');
        if (!timeEl || !dateEl) return;
        const now = new Date();
        const timeText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const dateText = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        timeEl.dataset.text = timeText;
        dateEl.dataset.text = dateText;
        timeEl.textContent = timeText;
        dateEl.textContent = dateText;
    };
    update();
    clockInterval = setInterval(update, 1000);
}

function measureBrowserChromeBottom() {
    const vv = window.visualViewport;
    if (!vv) {
        document.body.style.setProperty('--m-browser-chrome-bottom', '0px');
        return;
    }
    // Gap between the layout viewport bottom and the visual viewport bottom
    // (Chrome/Samsung browser toolbars overlapping the page).
    const chromeBottom = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    document.body.style.setProperty('--m-browser-chrome-bottom', `${chromeBottom}px`);
}

function measureHeaderHeight() {
    const header =
        document.getElementById('m-teacher-header') ||
        document.getElementById('m-secretary-header');
    if (!header || !document.body.classList.contains('gcq-mobile')) return;
    measureBrowserChromeBottom();
    const height = Math.ceil(header.getBoundingClientRect().height);
    if (height > 0) {
        document.body.style.setProperty('--m-header-height', `${height}px`);
    }
    const dock =
        document.getElementById('m-teacher-dock') ||
        document.getElementById('m-secretary-dock');
    if (dock) {
        const dockH = Math.ceil(dock.getBoundingClientRect().height);
        if (dockH > 0) {
            document.body.style.setProperty('--m-dock-height', `${dockH}px`);
        }
    }
}

function mirrorUpdateReady() {
    const source = document.getElementById('gcq-update-ready-mount');
    const target = document.getElementById('m-gcq-update-ready-mount');
    if (!source || !target) {
        window.setTimeout(mirrorUpdateReady, 400);
        return;
    }

    const copy = () => {
        target.replaceChildren();
        source.childNodes.forEach((node) => {
            const clone = node.cloneNode(true);
            if (clone.removeAttribute) clone.removeAttribute('id');
            target.appendChild(clone);
        });
        target.classList.toggle('hidden', source.classList.contains('hidden'));
        const hasUpdate = source.childNodes.length > 0;
        target.classList.toggle('has-update', hasUpdate);
        // The update orb takes the Game Guide's seat (the guide is still in More),
        // so the class pill and clock keep their room.
        target.closest('.m-header__actions')?.classList.toggle('m-header__actions--update', hasUpdate);
    };

    copy();
    if (updateMirrorObserver) updateMirrorObserver.disconnect();
    updateMirrorObserver = new MutationObserver(copy);
    updateMirrorObserver.observe(source, { childList: true, subtree: true, attributes: true });

    if (!updateMirrorWired) {
        updateMirrorWired = true;
        target.addEventListener('click', (event) => {
            if (!event.target.closest('button')) return;
            event.preventDefault();
            source.querySelector('button')?.click();
        });
    }
}

function observeDesktopClassPill() {
    const desktopText = document.getElementById('header-class-selector-text');
    if (!desktopText) return;
    if (desktopPillObserver) desktopPillObserver.disconnect();
    desktopPillObserver = new MutationObserver(() => {
        syncClassPill();
    });
    desktopPillObserver.observe(desktopText, { childList: true, characterData: true, subtree: true });
}

function handleClassPickerSelection(id, isFollow = false) {
    playSound('click');
    if (isFollow) {
        state.setClassFollowScheduleEnabled(true);
        syncClassPill();
        import('../features/home.js').then((home) => {
            Promise.resolve(home.runScheduleBasedClassSyncOnce()).finally(() => {
                syncClassPill();
                renderMobileHome();
            });
        });
    } else {
        state.setGlobalSelectedClass(id || null, true);
        syncClassPill();
        renderMobileHome();
    }
    closeClassPicker();
}

function wire() {
    if (wired) return;
    wired = true;

    document.getElementById('m-teacher-brand')?.addEventListener('click', () => {
        playSound('click');
    });

    document.getElementById('m-app-info-btn')?.addEventListener('click', () => {
        playSound('click');
        import('../ui/modals.js').then((modals) => modals.openAppInfoModal());
    });

    document.getElementById('m-header-settings-btn')?.addEventListener('click', () => {
        playSound('click');
        import('../ui/tabs.js').then((tabs) => tabs.showTab('options-tab'));
    });

    document.getElementById('m-logout-btn')?.addEventListener('click', () => {
        closeMoreSheet();
        logout();
    });

    document.getElementById('m-more-guide-btn')?.addEventListener('click', () => {
        playSound('click');
        closeMoreSheet();
        import('../ui/modals.js').then((modals) => modals.openAppInfoModal());
    });

    wireSheetSwipe(document.getElementById('m-more-sheet'), closeMoreSheet);
    wireSheetSwipe(document.getElementById('m-class-picker-sheet'), closeClassPicker);
    wireSheetSwipe(document.getElementById('m-options-subtab-sheet'), closeOptionsSubtabSheet);

    const dock = document.getElementById('m-teacher-dock');
    dock?.addEventListener('click', (event) => {
        const btn = event.target.closest('.nav-button[data-tab]');
        if (btn) {
            playSound('click');
            const tabId = btn.dataset.tab;
            import('../ui/tabs.js').then((tabs) => tabs.showTab(tabId)).then(() => {
                if (tabId === 'about-tab') renderMobileHome();
                measureHeaderHeight();
            });
            return;
        }
        if (event.target.closest('#m-more-btn')) {
            playSound('click');
            openMoreSheet();
        }
    });

    const moreSheet = document.getElementById('m-more-sheet');
    moreSheet?.addEventListener('click', (event) => {
        if (event.target.closest('#m-more-close-btn') || event.target.closest('[data-m-sheet-close="more"]')) {
            playSound('click');
            closeMoreSheet();
            return;
        }
        const item = event.target.closest('.nav-button[data-tab]');
        if (item) {
            playSound('click');
            import('../ui/tabs.js').then((tabs) => tabs.showTab(item.dataset.tab));
            closeMoreSheet();
            return;
        }
        if (event.target.closest('#m-secretary-console-item')) {
            void openSecretaryConsole();
        }
    });

    document.getElementById('m-class-selector-btn')?.addEventListener('click', () => {
        playSound('click');
        openClassPicker();
    });

    const pickerSheet = document.getElementById('m-class-picker-sheet');
    pickerSheet?.addEventListener('click', (event) => {
        if (event.target.closest('#m-class-picker-close-btn') || event.target.closest('[data-m-sheet-close="picker"]')) {
            playSound('click');
            closeClassPicker();
            return;
        }
        if (event.target.closest('#m-class-follow-schedule')) {
            handleClassPickerSelection(null, true);
            return;
        }
        const option = event.target.closest('.m-class-option[data-m-class-id]');
        if (option) {
            handleClassPickerSelection(option.dataset.mClassId || null);
        }
    });

    document.getElementById('m-options-subtab-trigger')?.addEventListener('click', () => {
        playSound('click');
        openOptionsSubtabSheet();
    });

    const subtabSheet = document.getElementById('m-options-subtab-sheet');
    subtabSheet?.addEventListener('click', (event) => {
        if (event.target.closest('#m-options-subtab-close-btn') || event.target.closest('[data-m-sheet-close="subtab"]')) {
            playSound('click');
            closeOptionsSubtabSheet();
            return;
        }
        const option = event.target.closest('.m-options-subtab-option[data-m-subtab-key]');
        if (option) {
            playSound('click');
            document.querySelector(`#options-tab .options-subtab-btn[data-options-tab="${option.dataset.mSubtabKey}"]`)?.click();
            syncOptionsSubtabTrigger();
            closeOptionsSubtabSheet();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeMoreSheet();
        closeClassPicker();
        closeOptionsSubtabSheet();
    });

    document.addEventListener('gcq-mobile-mode', (event) => {
        if (event.detail?.active) {
            syncClassPill();
            renderMobileHome();
            requestAnimationFrame(measureHeaderHeight);
            import('../features/skyTheater.js')
                .then(({ stopSkyTheater, startSkyTheater }) => {
                    stopSkyTheater();
                    startSkyTheater();
                })
                .catch(() => {});
        } else {
            closeMoreSheet();
            closeClassPicker();
        }
    });

    window.addEventListener('resize', () => {
        if (document.body.classList.contains('gcq-mobile')) measureHeaderHeight();
    });
    if (window.visualViewport) {
        const onViewportChange = () => {
            if (document.body.classList.contains('gcq-mobile')) measureHeaderHeight();
        };
        window.visualViewport.addEventListener('resize', onViewportChange);
        window.visualViewport.addEventListener('scroll', onViewportChange);
    }

    syncClassPill();
    startClock();
    import('../features/skyTheater.js')
        .then(({ startSkyTheater }) => startSkyTheater())
        .catch((e) => console.warn('Sky Theater failed to start (mobile)', e));
    mirrorUpdateReady();
    observeDesktopClassPill();
    observeOptionsSubtabs();
    observeMoreActive();
    requestAnimationFrame(measureHeaderHeight);
}

export function syncTeacherClassPill() {
    syncClassPill();
}

export function measureMobileChrome() {
    measureHeaderHeight();
}

export function initTeacherMobile() {
    wire();
}
