import { DEFAULT_SKY_SCENE, headerTrimHTML, titleFlourishHTML, pillStarHTML, headerDateHTML, headerTimeHTML } from './app/header.js';
import { buildCloudsHtml } from '../features/skyWeatherArt.js';

// Same sky, trim, title face, pill, date and clock as the teacher header (templates/app/header.js).
const roleHeader = (role, titleAttr, subtitleAttr, logoutId) => `
    <div class="role-header-atmosphere role-header-atmosphere--${role} gcq-sky-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md">
        <header class="gcq-sky-header relative z-[1] flex w-full items-center justify-between gap-3 bg-transparent p-4 shadow-none overflow-visible">
            <div class="header-night-stars absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true"></div>
            <div class="header-sky-clouds wx-clouds absolute inset-0 z-[1] overflow-hidden pointer-events-none" aria-hidden="true">${buildCloudsHtml(DEFAULT_SKY_SCENE, 'header')}</div>
${headerTrimHTML}
            <div class="role-header-brand z-10 min-w-0 flex flex-1 flex-col justify-between overflow-visible">
                <div class="gcq-title-wrap">
                    <h1 class="font-title text-2xl text-white sm:text-4xl whitespace-nowrap" ${titleAttr} data-text="Loading...">Loading...</h1>
${titleFlourishHTML}
                </div>
                <div class="gcq-header-pill gcq-quote gcq-office-pill self-start inline-flex items-center gap-3 rounded-full px-4 py-1.5 mt-2 min-w-0 max-w-full">
                    ${pillStarHTML('l')}
                    <p class="font-title text-sm text-white tracking-wide truncate"><span class="gcq-office-pill__eyebrow">School Office</span><span class="gcq-office-pill__dot" aria-hidden="true">·</span><span ${subtitleAttr}></span></p>
                    ${pillStarHTML('r')}
                </div>
            </div>
            <div class="z-10 ml-auto flex shrink-0 flex-col justify-between items-end font-title date-time-hover-group relative">
${headerDateHTML()}
                <div class="relative z-[4] mt-2 flex items-center gap-2 sm:gap-4">
                    <div data-gcq-update-mount class="gcq-update-mount hidden shrink-0" aria-live="polite"></div>
                    <div class="gcq-header-controls gcq-header-pill flex items-center gap-1 rounded-full p-1 overflow-visible">
                        <button type="button" id="${logoutId}"
                            class="gcq-hbtn gcq-hbtn--danger bg-red-500/80 hover:bg-red-500 text-white h-7 w-7 rounded-full bubbly-button flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Log Out" aria-label="Log Out">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
${headerTimeHTML()}
                </div>
            </div>
        </header>
    </div>`;

const bottomNav = (role, items) => `
    <nav id="${role}-bottom-nav" class="role-bottom-nav role-bottom-nav--${role} relative z-50 grid gap-1 p-2 shadow-inner"
        style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%); grid-template-columns: repeat(${items.length}, minmax(0, 1fr));">
        ${items.map(({ key, icon, label, color, active }) => `
            <button type="button" class="nav-button nav-color-${color}${active ? ' active' : ''}"
                data-${role}-tab="${key}" aria-label="${label}" aria-current="${active ? 'page' : 'false'}">
                <i class="fas ${icon} icon"></i>
                <span class="text">${label}</span>
            </button>
        `).join('')}
    </nav>`;

// The Family Portal has its own home-like shell (header and tab bar) on every screen size.
const familyHeader = `
    <header class="fp-header" aria-label="Πύλη γονέων">
        <div class="fp-header__town" aria-hidden="true">
            <span class="fp-town fp-town--back"></span>
            <span class="fp-town fp-town--front"></span>
            <span class="fp-town fp-town--windows"></span>
        </div>
        <div class="fp-header__row">
            <div class="fp-portrait" data-parent-portrait aria-hidden="true"><span>?</span></div>
            <div class="fp-header__copy">
                <p class="fp-header__eyebrow"><i class="fas fa-house-chimney-window" aria-hidden="true"></i> <span data-parent-i18n="portal">Πύλη γονέων</span><span class="fp-header__school" data-parent-school></span></p>
                <h1 class="fp-header__title" data-parent-title>Φόρτωση…</h1>
                <p class="fp-header__sub" data-parent-student-name></p>
            </div>
            <div class="fp-header__actions">
                <button type="button" id="parent-lang-btn" class="fp-lang" aria-label="Γλώσσα / Language" title="Γλώσσα / Language" aria-haspopup="dialog">
                    <i class="fas fa-globe" aria-hidden="true"></i><span class="fp-lang__code" data-lang-code>ΕΛ</span>
                </button>
                <button type="button" id="parent-refresh-btn" class="fp-icon-btn" title="Έλεγχος για νέα" aria-label="Έλεγχος για νέα">
                    <i class="fas fa-rotate" aria-hidden="true"></i>
                </button>
                <button type="button" id="parent-logout-btn" class="fp-icon-btn fp-icon-btn--quiet" title="Αποσύνδεση" aria-label="Αποσύνδεση">
                    <i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </header>`;

// Lumi's star for the Tips tab: one flat path so it takes the tab's colour.
// Lumi as a tab icon: one solid colour like the other icons, the face cut out of the star.
const NAV_LUMI = '<svg class="fp-nav__lumi" viewBox="0 3 100 90" aria-hidden="true" focusable="false"><defs><mask id="fp-nav-lumi-face"><rect x="0" y="0" width="100" height="100" fill="#fff"/><circle cx="42" cy="53" r="5" fill="#000"/><circle cx="58" cy="53" r="5" fill="#000"/><path d="M43 63q7 5.5 14 0" stroke="#000" stroke-width="4.5" fill="none" stroke-linecap="round"/></mask></defs><path mask="url(#fp-nav-lumi-face)" d="M45.4 8.7Q50 0 54.6 8.7L60.7 20.3Q65.3 29 75 30.6L87.9 32.9Q97.6 34.5 90.7 41.6L81.6 51Q74.7 58 76.1 67.8L78 80.7Q79.4 90.5 70.6 86.1L58.8 80.3Q50 76 41.2 80.3L29.4 86.1Q20.6 90.5 22 80.7L23.9 67.8Q25.3 58 18.4 51L9.3 41.6Q2.4 34.5 12.1 32.9L25 30.6Q34.7 29 39.3 20.3Z" fill="currentColor"/></svg>';

const familyNav = `
    <nav id="parent-bottom-nav" class="fp-nav" aria-label="Πύλη γονέων">
        ${[
            { key: 'home', icon: 'fa-house', label: 'Αρχική' },
            { key: 'homework', icon: 'fa-book-open', label: 'Εργασίες' },
            { key: 'progress', icon: 'fa-seedling', label: 'Πρόοδος' },
            { key: 'tips', icon: 'lumi', label: 'Συμβουλές' },
            { key: 'messages', icon: 'fa-envelope', label: 'Μηνύματα' }
        ].map(({ key, icon, label }, index) => `
            <button type="button" class="fp-nav__btn fp-nav__btn--${key}${index === 0 ? ' active' : ''}" data-parent-tab="${key}" aria-current="${index === 0 ? 'page' : 'false'}">
                <span class="fp-nav__icon">${icon === 'lumi' ? NAV_LUMI : `<i class="fas ${icon}" aria-hidden="true"></i>`}<span class="fp-nav__badge hidden" data-parent-badge="${key}"></span></span>
                <span class="fp-nav__label" data-parent-i18n="${key}">${label}</span>
            </button>
        `).join('')}
    </nav>`;

export const roleShellsHTML = `
    <div id="parent-screen" class="hidden role-shell fp-shell flex flex-col h-full overflow-hidden" data-time="day">
        ${familyHeader}
        <main class="fp-main flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <section class="fp-tab" data-parent-section="home"></section>
            <section class="fp-tab hidden" data-parent-section="homework"></section>
            <section class="fp-tab hidden" data-parent-section="progress"></section>
            <section class="fp-tab hidden" data-parent-section="tips"></section>
            <section class="fp-tab hidden" data-parent-section="messages"></section>
        </main>
        ${familyNav}
    </div>

    <div id="secretary-screen" class="hidden role-shell role-shell--secretary flex flex-col h-full overflow-hidden">
        ${roleHeader('secretary', 'data-secretary-title', 'data-school-name', 'secretary-logout-btn')}
        <main class="role-main secretary-role-main flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 min-h-0">
            <section class="role-tab max-w-7xl mx-auto" data-secretary-section="home"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="school"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="grades"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="messages"></section>
            <section class="role-tab role-tab--admin w-full mx-auto hidden" data-secretary-section="admin"></section>
        </main>
        ${bottomNav('secretary', [
            { key: 'home', icon: 'fa-home', label: 'Home', color: 'cyan', active: true },
            { key: 'school', icon: 'fa-school', label: 'School', color: 'green' },
            { key: 'grades', icon: 'fa-chart-bar', label: 'Grades', color: 'amber' },
            { key: 'messages', icon: 'fa-comments', label: 'Messages', color: 'purple' },
            { key: 'admin', icon: 'fa-cog', label: 'Admin', color: 'indigo' }
        ])}
    </div>
`;
