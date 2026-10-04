import { DEFAULT_SKY_SCENE } from './app/header.js';
import { buildCloudsHtml } from '../features/skyWeatherArt.js';

const secretaryHeaderActions = `
    <button type="button" id="secretary-open-teacher-app-btn"
        class="role-header-icon-btn bubbly-button" title="Open Teacher App" aria-label="Open Teacher App">
        <i class="fas fa-chalkboard-teacher text-xs"></i>
    </button>`;

const roleHeader = (role, titleAttr, subtitleAttr, logoutId) => `
    <div class="role-header-atmosphere role-header-atmosphere--${role} relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md"
         style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%);">
        <header class="relative z-[1] flex w-full items-center justify-between gap-3 bg-transparent p-4 shadow-none overflow-visible">
            <div class="header-sky-clouds wx-clouds absolute inset-0 z-[1] overflow-hidden pointer-events-none" aria-hidden="true">${buildCloudsHtml(DEFAULT_SKY_SCENE, 'header', { count: 4 })}</div>
            <div class="role-header-brand z-10 min-w-0 flex flex-1 items-center gap-3 overflow-visible">
                <div class="min-w-0 overflow-visible">
                    <p class="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">School Office</p>
                    <h1 class="font-title text-2xl text-white sm:text-4xl whitespace-nowrap" ${titleAttr} data-text="Loading...">Loading...</h1>
                    <p class="text-white/90 text-sm font-semibold mt-1 truncate" ${subtitleAttr}></p>
                </div>
            </div>
            <div class="z-10 flex shrink-0 items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full p-1 shadow-md">
                ${secretaryHeaderActions}
                <button type="button" id="${logoutId}"
                    class="role-header-icon-btn role-header-icon-btn--danger bubbly-button" title="Log Out" aria-label="Log Out">
                    <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
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
    <header class="fp-header" aria-label="Family Portal">
        <div class="fp-header__town" aria-hidden="true">
            <span class="fp-town fp-town--back"></span>
            <span class="fp-town fp-town--front"></span>
            <span class="fp-town fp-town--windows"></span>
        </div>
        <div class="fp-header__row">
            <div class="fp-portrait" data-parent-portrait aria-hidden="true"><span>?</span></div>
            <div class="fp-header__copy">
                <p class="fp-header__eyebrow"><i class="fas fa-house-chimney-window" aria-hidden="true"></i> <span data-parent-i18n="portal">Family Portal</span><span class="fp-header__school" data-parent-school></span></p>
                <h1 class="fp-header__title" data-parent-title>Loading…</h1>
                <p class="fp-header__sub" data-parent-student-name></p>
            </div>
            <div class="fp-header__actions">
                <button type="button" id="parent-lang-btn" class="fp-lang" aria-label="Ελληνικά / English" title="Ελληνικά / English">
                    <span class="fp-lang__opt" data-lang-opt="el" lang="el">ΕΛ</span><span class="fp-lang__opt" data-lang-opt="en" lang="en">EN</span>
                </button>
                <button type="button" id="parent-refresh-btn" class="fp-icon-btn" title="Check for news" aria-label="Check for news">
                    <i class="fas fa-rotate" aria-hidden="true"></i>
                </button>
                <button type="button" id="parent-logout-btn" class="fp-icon-btn fp-icon-btn--quiet" title="Log out" aria-label="Log out">
                    <i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </header>`;

const familyNav = `
    <nav id="parent-bottom-nav" class="fp-nav" aria-label="Family Portal">
        ${[
            { key: 'home', icon: 'fa-house', label: 'Home' },
            { key: 'homework', icon: 'fa-book-open', label: 'Homework' },
            { key: 'progress', icon: 'fa-seedling', label: 'Progress' },
            { key: 'messages', icon: 'fa-envelope', label: 'Messages' }
        ].map(({ key, icon, label }, index) => `
            <button type="button" class="fp-nav__btn${index === 0 ? ' active' : ''}" data-parent-tab="${key}" aria-current="${index === 0 ? 'page' : 'false'}">
                <span class="fp-nav__icon"><i class="fas ${icon}" aria-hidden="true"></i><span class="fp-nav__badge hidden" data-parent-badge="${key}"></span></span>
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
