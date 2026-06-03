const roleHeaderActions = (role) => {
    if (role === 'secretary') {
        return `
            <button type="button" id="secretary-open-teacher-app-btn"
                class="role-header-icon-btn bubbly-button" title="Open Teacher App" aria-label="Open Teacher App">
                <i class="fas fa-chalkboard-teacher text-xs"></i>
            </button>`;
    }
    return `
        <button type="button" id="parent-refresh-btn"
            class="role-header-icon-btn bubbly-button" title="Refresh" aria-label="Refresh">
            <i class="fas fa-rotate text-xs"></i>
        </button>`;
};

const roleHeader = (role, titleAttr, subtitleAttr, logoutId) => `
    <div class="role-header-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md"
         style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%);">
        <header class="relative z-[1] flex w-full items-center justify-between gap-3 bg-transparent p-4 shadow-none overflow-visible">
            <div class="header-sky-clouds absolute inset-0 z-[1] overflow-hidden pointer-events-none">
                <i class="fas fa-cloud cloud" style="left: 10%; animation-delay: -5s;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 30%; animation-delay: -15s; font-size: 6rem;"></i>
                <i class="fas fa-cloud cloud" style="left: 60%; animation-delay: -2s; font-size: 10rem;"></i>
            </div>
            <div class="z-10 min-w-0 flex-1">
                <p class="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">${role === 'secretary' ? 'Secretary Office' : 'Family Portal'}</p>
                <h1 class="font-title text-2xl text-white sm:text-3xl truncate" ${titleAttr}>Loading...</h1>
                <p class="text-white/90 text-sm font-semibold mt-1 truncate" ${subtitleAttr}></p>
            </div>
            <div class="z-10 flex shrink-0 items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full p-1 shadow-md">
                ${roleHeaderActions(role)}
                <button type="button" id="${logoutId}"
                    class="role-header-icon-btn role-header-icon-btn--danger bubbly-button" title="Log Out" aria-label="Log Out">
                    <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
            </div>
        </header>
    </div>`;

const bottomNav = (role, items) => `
    <nav id="${role}-bottom-nav" class="role-bottom-nav relative z-50 grid gap-1 p-2 shadow-inner"
        style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%); grid-template-columns: repeat(${items.length}, minmax(0, 1fr));">
        ${items.map(({ key, icon, label, color, active }) => `
            <button type="button" class="nav-button nav-color-${color}${active ? ' active' : ''}"
                data-${role}-tab="${key}">
                <i class="fas ${icon} icon"></i>
                <span class="text">${label}</span>
            </button>
        `).join('')}
    </nav>`;

export const roleShellsHTML = `
    <div id="parent-screen" class="hidden role-shell flex flex-col h-full overflow-hidden">
        ${roleHeader('parent', 'data-parent-title', 'data-parent-student-name', 'parent-logout-btn')}
        <main class="role-main flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 min-h-0">
            <section class="role-tab max-w-4xl mx-auto" data-parent-section="home"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-parent-section="homework"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-parent-section="progress"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-parent-section="messages"></section>
        </main>
        ${bottomNav('parent', [
            { key: 'home', icon: 'fa-home', label: 'Home', color: 'cyan', active: true },
            { key: 'homework', icon: 'fa-book', label: 'Homework', color: 'amber' },
            { key: 'progress', icon: 'fa-chart-line', label: 'Progress', color: 'green' },
            { key: 'messages', icon: 'fa-envelope', label: 'Messages', color: 'purple' }
        ])}
    </div>

    <div id="secretary-screen" class="hidden role-shell flex flex-col h-full overflow-hidden">
        ${roleHeader('secretary', 'data-secretary-title', 'data-school-name', 'secretary-logout-btn')}
        <main class="role-main flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 min-h-0">
            <section class="role-tab max-w-4xl mx-auto" data-secretary-section="home"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="school"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="grades"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="messages"></section>
            <section class="role-tab max-w-4xl mx-auto hidden" data-secretary-section="admin"></section>
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
