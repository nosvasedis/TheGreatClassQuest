const APP_LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

const HEADER_CLOUDS = `
    <div class="m-header__glow" aria-hidden="true"></div>
    <div class="m-header__clouds" aria-hidden="true">
        <i class="fas fa-cloud cloud" style="left: 8%; animation-delay: -5s; font-size: 5rem;"></i>
        <i class="fas fa-cloud cloud cloud-fast" style="left: 55%; animation-delay: -15s; font-size: 3.5rem;"></i>
        <i class="fas fa-cloud cloud" style="left: 78%; animation-delay: -2s; font-size: 6rem;"></i>
    </div>
    <div class="sky-theater-sky m-sky-theater-sky" aria-hidden="true"></div>`;

const HEADER_ACTION_BTN = (id, icon, label, extraClass = '') => `
    <button type="button" id="${id}" class="m-header-btn m-header-btn--mini m-pressable bubbly-button ${extraClass}" title="${label}" aria-label="${label}">
        <i class="fas ${icon}"></i>
    </button>`;

const teacherHeaderHTML = `
    <header id="m-teacher-header" class="m-header m-header--teacher" aria-label="App header">
        ${HEADER_CLOUDS}
        <div class="m-header__row m-header__row--primary">
            <div class="m-header__brand m-header__brand--pressable" id="m-teacher-brand">
                <img class="m-header__logo" src="${APP_LOGO_URL}" alt="" width="44" height="44" decoding="async" />
                <h1 class="m-header__title font-title" data-text="The Great Class Quest">The Great Class Quest</h1>
                <div class="m-header__brand-sparkle" aria-hidden="true">
                    <span class="m-header__sparkle-star m-hss-1">✨</span>
                    <span class="m-header__sparkle-star m-hss-2">⭐</span>
                    <span class="m-header__sparkle-star m-hss-3">✨</span>
                </div>
            </div>
        </div>
        <div class="m-header__row m-header__row--class">
            <button type="button" id="m-class-selector-btn" class="m-class-pill m-class-pill--compact m-pressable bubbly-button" aria-haspopup="dialog" aria-label="Choose class">
                <span id="m-class-selector-logo" class="m-class-pill__logo" aria-hidden="true">🏫</span>
                <span id="m-class-selector-text" class="m-class-pill__text">General</span>
                <i class="fas fa-chevron-down m-class-pill__chev" aria-hidden="true"></i>
            </button>

            <div class="m-header__clock m-header__clock--center" aria-live="polite">
                <div class="sky-theater-cameo m-sky-theater-cameo" aria-hidden="true"></div>
                <span id="m-current-time" class="m-header__time" data-text="--:--">--:--</span>
                <span id="m-current-date" class="m-header__date" data-text="Loading…">Loading…</span>
            </div>

            <div class="m-header__actions">
                <div id="m-gcq-update-ready-mount" class="m-header__update-mount"></div>
                ${HEADER_ACTION_BTN('m-app-info-btn', 'fa-info', 'Game Guide')}
                ${HEADER_ACTION_BTN('m-header-settings-btn', 'fa-cog', 'Settings')}
                ${HEADER_ACTION_BTN('m-logout-btn', 'fa-sign-out-alt', 'Log out', 'm-header-btn--danger')}
            </div>
        </div>
    </header>`;

const teacherDockHTML = `
    <nav id="m-teacher-dock" class="m-dock m-dock--teacher" aria-label="Main navigation">
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-cyan active" data-tab="about-tab" aria-label="Home" aria-current="page">
            <i class="fas fa-home icon"></i><span class="text">Home</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-amber" data-tab="class-leaderboard-tab" aria-label="Team Quest">
            <i class="fas fa-route icon"></i><span class="text">Team</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-purple" data-tab="student-leaderboard-tab" aria-label="Heroes">
            <i class="fas fa-user-graduate icon"></i><span class="text">Heroes</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-rose" data-tab="award-stars-tab" aria-label="Award Stars">
            <i class="fas fa-star icon"></i><span class="text">Award</span>
        </button>
        <button type="button" id="m-more-btn" class="nav-button m-dock-btn m-pressable nav-color-indigo" aria-label="More" aria-haspopup="dialog" aria-expanded="false">
            <i class="fas fa-ellipsis icon"></i><span class="text">More</span>
        </button>
    </nav>`;

const moreItem = (tab, color, icon, label) => `
    <button type="button" class="nav-button m-more-item m-pressable ${color}" data-tab="${tab}" aria-label="${label}">
        <i class="fas ${icon} icon"></i><span class="text">${label}</span>
        <i class="fas fa-chevron-right m-more-item__chev" aria-hidden="true"></i>
    </button>`;

const moreSheetHTML = `
    <div id="m-more-sheet" class="m-sheet m-sheet--more" role="dialog" aria-modal="true" aria-label="More destinations" aria-hidden="true">
        <button type="button" class="m-sheet__backdrop" data-m-sheet-close="more" tabindex="-1" aria-label="Close"></button>
        <div class="m-sheet__panel">
            <div class="m-sheet__grabber" aria-hidden="true"></div>
            <div class="m-sheet__heading m-sheet__heading--compact">
                <h2 class="m-sheet__title font-title">Jump to&hellip;</h2>
                <button type="button" id="m-more-close-btn" class="m-sheet__close m-pressable bubbly-button" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="m-sheet__list">
                ${moreItem('shop-tab', 'nav-color-lime', 'fa-store', 'Mystic Market')}
                ${moreItem('guilds-tab', 'nav-color-guild', 'fa-shield-alt', 'Guild Hall')}
                ${moreItem('adventure-log-tab', 'nav-color-teal', 'fa-book-open', 'Adventure Log')}
                ${moreItem('scholars-scroll-tab', 'nav-color-scroll', 'fa-scroll', "Scholar's Scroll")}
                ${moreItem('calendar-tab', 'nav-color-blue', 'fa-calendar-alt', 'Quest Calendar')}
                ${moreItem('reward-ideas-tab', 'nav-color-indigo', 'fa-feather-alt', 'Story Weavers')}
                ${moreItem('manage-students-tab', 'nav-color-fuchsia', 'fa-user-graduate', 'Student Roster')}
                <button type="button" id="m-secretary-console-item" class="nav-button m-more-item m-pressable nav-color-cyan hidden" aria-label="School Office">
                    <i class="fas fa-building-shield icon"></i><span class="text">School Office</span>
                    <i class="fas fa-chevron-right m-more-item__chev" aria-hidden="true"></i>
                </button>
                ${moreItem('options-tab', 'nav-color-gray', 'fa-cog', 'Settings')}
            </div>
        </div>
    </div>`;

const classPickerSheetHTML = `
    <div id="m-class-picker-sheet" class="m-sheet m-sheet--picker" role="dialog" aria-modal="true" aria-label="Choose a class" aria-hidden="true">
        <button type="button" class="m-sheet__backdrop" data-m-sheet-close="picker" tabindex="-1" aria-label="Close"></button>
        <div class="m-sheet__panel">
            <div class="m-sheet__grabber" aria-hidden="true"></div>
            <div class="m-sheet__heading">
                <p class="m-sheet__eyebrow">Currently viewing</p>
                <h2 class="m-sheet__title font-title">Choose a class</h2>
                <button type="button" id="m-class-picker-close-btn" class="m-sheet__close m-pressable bubbly-button" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="m-sheet__list m-class-picker">
                <button type="button" id="m-class-follow-schedule" class="m-class-option m-class-option--special m-pressable">
                    <span class="m-class-option__logo" aria-hidden="true">⏰</span>
                    <span class="m-class-option__body"><strong>Follow today's schedule</strong><small>Auto-switch to the class in session</small></span>
                    <i class="fas fa-chevron-right m-class-option__chev" aria-hidden="true"></i>
                </button>
                <button type="button" class="m-class-option m-class-option--special m-pressable" data-m-class-id="">
                    <span class="m-class-option__logo" aria-hidden="true">🏫</span>
                    <span class="m-class-option__body"><strong>General view</strong><small>See everything at once</small></span>
                    <i class="fas fa-chevron-right m-class-option__chev" aria-hidden="true"></i>
                </button>
                <div id="m-class-list" class="m-class-picker__list"></div>
            </div>
        </div>
    </div>`;

const optionsSubtabDropdownHTML = `
    <div class="m-subtab-dropdown" id="m-options-subtab-dropdown">
        <button type="button" id="m-options-subtab-trigger" class="m-subtab-dropdown__trigger m-pressable bubbly-button" aria-haspopup="dialog" aria-expanded="false" aria-label="Choose settings section">
            <span class="m-subtab-dropdown__icon" id="m-options-subtab-trigger-icon" aria-hidden="true"><i class="fas fa-tools"></i></span>
            <span class="m-subtab-dropdown__label" id="m-options-subtab-trigger-label">Student Tools</span>
            <i class="fas fa-chevron-down m-subtab-dropdown__chev" aria-hidden="true"></i>
        </button>
    </div>`;

const optionsSubtabSheetHTML = `
    <div id="m-options-subtab-sheet" class="m-sheet m-sheet--subtab" role="dialog" aria-modal="true" aria-label="Choose settings section" aria-hidden="true">
        <button type="button" class="m-sheet__backdrop" data-m-sheet-close="subtab" tabindex="-1" aria-label="Close"></button>
        <div class="m-sheet__panel">
            <div class="m-sheet__grabber" aria-hidden="true"></div>
            <div class="m-sheet__heading m-sheet__heading--compact">
                <h2 class="m-sheet__title font-title">Jump to section</h2>
                <button type="button" id="m-options-subtab-close-btn" class="m-sheet__close m-pressable bubbly-button" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="m-sheet__list" id="m-options-subtab-list"></div>
        </div>
    </div>`;

const roleHeaderHTML = (role, markIcon, eyebrow, titleId, subtitleId, actions) => `
    <header id="m-${role}-header" class="m-header m-header--role m-header--${role}" aria-label="${eyebrow} header">
        ${HEADER_CLOUDS}
        <div class="m-header__row m-header__row--primary">
            <div class="m-header__brand m-header__brand--pressable" id="m-${role}-brand">
                <img class="m-header__logo" src="${APP_LOGO_URL}" alt="" width="40" height="40" decoding="async" />
                <div class="m-header__copy">
                    <p class="m-header__eyebrow">${eyebrow}</p>
                    <h1 id="${titleId}" class="m-header__title font-title" data-text="Loading…">Loading…</h1>
                    <p id="${subtitleId}" class="m-header__subtitle"></p>
                </div>
                <div class="m-header__brand-sparkle" aria-hidden="true">
                    <span class="m-header__sparkle-star m-hss-1">✨</span>
                    <span class="m-header__sparkle-star m-hss-2">⭐</span>
                    <span class="m-header__sparkle-star m-hss-3">✨</span>
                </div>
            </div>
            <div class="m-header__actions">
                ${actions}
            </div>
        </div>
    </header>`;

const parentHeaderHTML = roleHeaderHTML(
    'parent',
    'fa-heart',
    'Family Portal',
    'm-parent-title',
    'm-parent-student-name',
    HEADER_ACTION_BTN('m-parent-refresh-btn', 'fa-rotate', 'Refresh') +
    HEADER_ACTION_BTN('m-parent-logout-btn', 'fa-sign-out-alt', 'Log out', 'm-header-btn--danger')
);

const parentDockHTML = `
    <nav id="m-parent-dock" class="m-dock m-dock--parent" aria-label="Family portal navigation">
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-cyan active" data-parent-tab="home" aria-label="Home" aria-current="page">
            <i class="fas fa-home icon"></i><span class="text">Home</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-amber" data-parent-tab="homework" aria-label="Homework">
            <i class="fas fa-book icon"></i><span class="text">Homework</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-green" data-parent-tab="progress" aria-label="Progress">
            <i class="fas fa-chart-line icon"></i><span class="text">Progress</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-purple" data-parent-tab="messages" aria-label="Messages">
            <i class="fas fa-envelope icon"></i><span class="text">Messages</span>
        </button>
    </nav>`;

const secretaryHeaderHTML = roleHeaderHTML(
    'secretary',
    'fa-wand-magic-sparkles',
    'School Office',
    'm-secretary-title',
    'm-school-name',
    HEADER_ACTION_BTN('m-secretary-open-teacher-app-btn', 'fa-chalkboard-teacher', 'Open Teacher App') +
    HEADER_ACTION_BTN('m-secretary-logout-btn', 'fa-sign-out-alt', 'Log out', 'm-header-btn--danger')
);

const secretaryDockHTML = `
    <nav id="m-secretary-dock" class="m-dock m-dock--secretary" aria-label="School office navigation">
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-cyan active" data-secretary-tab="home" aria-label="Home" aria-current="page">
            <i class="fas fa-home icon"></i><span class="text">Home</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-green" data-secretary-tab="school" aria-label="School">
            <i class="fas fa-school icon"></i><span class="text">School</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-amber" data-secretary-tab="grades" aria-label="Grades">
            <i class="fas fa-chart-bar icon"></i><span class="text">Grades</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-purple" data-secretary-tab="messages" aria-label="Messages">
            <i class="fas fa-comments icon"></i><span class="text">Messages</span>
        </button>
        <button type="button" class="nav-button m-dock-btn m-pressable nav-color-indigo" data-secretary-tab="admin" aria-label="Admin">
            <i class="fas fa-cog icon"></i><span class="text">Admin</span>
        </button>
    </nav>`;

export const mobileHomeShellHTML = `
    <div id="home-dashboard-mobile" class="m-home-root"></div>`;

export function injectMobileShells() {
    const appScreen = document.getElementById('app-screen');
    if (appScreen && !document.getElementById('m-teacher-header')) {
        const desktopHeader = document.getElementById('award-header-atmosphere');
        if (desktopHeader) {
            desktopHeader.insertAdjacentHTML('afterend', teacherHeaderHTML);
        } else {
            appScreen.insertAdjacentHTML('afterbegin', teacherHeaderHTML);
        }
        const bottomNav = document.getElementById('bottom-nav-bar');
        if (bottomNav) {
            bottomNav.insertAdjacentHTML('afterend', teacherDockHTML);
        } else {
            appScreen.insertAdjacentHTML('beforeend', teacherDockHTML);
        }
        const aboutTab = document.getElementById('about-tab');
        if (aboutTab) {
            aboutTab.insertAdjacentHTML('beforeend', mobileHomeShellHTML);
        }
        const subtabBar = document.querySelector('.options-subtab-bar');
        if (subtabBar && !document.getElementById('m-options-subtab-dropdown')) {
            subtabBar.insertAdjacentHTML('beforebegin', optionsSubtabDropdownHTML);
        }
    }

    const parentScreen = document.getElementById('parent-screen');
    if (parentScreen && !document.getElementById('m-parent-header')) {
        const parentMain = parentScreen.querySelector('.role-main');
        if (parentMain) {
            parentMain.insertAdjacentHTML('beforebegin', parentHeaderHTML);
        } else {
            parentScreen.insertAdjacentHTML('afterbegin', parentHeaderHTML);
        }
        const parentNav = document.getElementById('parent-bottom-nav');
        if (parentNav) {
            parentNav.insertAdjacentHTML('afterend', parentDockHTML);
        } else {
            parentScreen.insertAdjacentHTML('beforeend', parentDockHTML);
        }
    }

    const secretaryScreen = document.getElementById('secretary-screen');
    if (secretaryScreen && !document.getElementById('m-secretary-header')) {
        const secretaryMain = secretaryScreen.querySelector('.role-main');
        if (secretaryMain) {
            secretaryMain.insertAdjacentHTML('beforebegin', secretaryHeaderHTML);
        } else {
            secretaryScreen.insertAdjacentHTML('afterbegin', secretaryHeaderHTML);
        }
        const secretaryNav = document.getElementById('secretary-bottom-nav');
        if (secretaryNav) {
            secretaryNav.insertAdjacentHTML('afterend', secretaryDockHTML);
        } else {
            secretaryScreen.insertAdjacentHTML('beforeend', secretaryDockHTML);
        }
    }

    const appRoot = document.getElementById('app-root');
    if (appRoot && !document.getElementById('m-more-sheet')) {
        appRoot.insertAdjacentHTML('beforeend', moreSheetHTML + classPickerSheetHTML + optionsSubtabSheetHTML);
    }
}
