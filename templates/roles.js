export const roleShellsHTML = `
    <div id="parent-screen" class="hidden min-h-screen parent-shell">
        <div class="parent-shell__backdrop"></div>
        <div class="parent-shell__inner">
            <header class="parent-shell__header">
                <div>
                    <p class="parent-shell__eyebrow">Parent Portal</p>
                    <h1 class="parent-shell__title">Your Child's Quest Book</h1>
                    <p class="parent-shell__subtitle" data-parent-student-name>Loading hero...</p>
                </div>
                <div class="parent-shell__actions">
                    <button type="button" id="parent-refresh-btn" class="parent-shell__icon-btn"><i class="fas fa-rotate"></i></button>
                    <button type="button" id="parent-logout-btn" class="parent-shell__icon-btn parent-shell__icon-btn--danger"><i class="fas fa-sign-out-alt"></i></button>
                </div>
            </header>
            <nav class="parent-shell__nav">
                <button type="button" class="parent-nav-btn parent-nav-btn-active" data-parent-tab="overview">Hero Overview</button>
                <button type="button" class="parent-nav-btn" data-parent-tab="homework">Homework</button>
                <button type="button" class="parent-nav-btn" data-parent-tab="progress">Progress</button>
                <button type="button" class="parent-nav-btn" data-parent-tab="messages">Messages</button>
            </nav>
            <main class="parent-shell__content">
                <section class="parent-panel" data-parent-section="overview"></section>
                <section class="parent-panel hidden" data-parent-section="homework"></section>
                <section class="parent-panel hidden" data-parent-section="progress"></section>
                <section class="parent-panel hidden" data-parent-section="messages"></section>
            </main>
        </div>
    </div>

    <div id="secretary-screen" class="hidden min-h-screen secretary-shell">
        <aside class="secretary-shell__rail">
            <div>
                <p class="secretary-shell__eyebrow">Elite Console</p>
                <h1 class="secretary-shell__title">School Command Center</h1>
                <p class="secretary-shell__subtitle" data-school-name>Your School</p>
            </div>
            <nav class="secretary-shell__nav">
                <button type="button" class="secretary-nav-btn secretary-nav-btn-active" data-secretary-tab="overview">School Overview</button>
                <button type="button" class="secretary-nav-btn" data-secretary-tab="classes">Classes</button>
                <button type="button" class="secretary-nav-btn" data-secretary-tab="students">Students</button>
                <button type="button" class="secretary-nav-btn" data-secretary-tab="academics">Academics</button>
                <button type="button" class="secretary-nav-btn" data-secretary-tab="communications">Communications</button>
                <button type="button" class="secretary-nav-btn" data-secretary-tab="settings">Settings</button>
            </nav>
            <div class="secretary-shell__footer">
                <button type="button" id="secretary-open-teacher-app-btn" class="secretary-shell__secondary-btn">Open Teacher View</button>
                <button type="button" id="secretary-logout-btn" class="secretary-shell__primary-btn">Logout</button>
            </div>
        </aside>
        <main class="secretary-shell__main">
            <header class="secretary-shell__toolbar">
                <div class="secretary-shell__filters">
                    <input type="text" id="secretary-class-filter" placeholder="Filter classes">
                    <input type="text" id="secretary-student-filter" placeholder="Filter students">
                </div>
            </header>
            <section class="secretary-panel" data-secretary-section="overview"></section>
            <section class="secretary-panel hidden" data-secretary-section="classes"></section>
            <section class="secretary-panel hidden" data-secretary-section="students"></section>
            <section class="secretary-panel hidden" data-secretary-section="academics"></section>
            <section class="secretary-panel hidden" data-secretary-section="communications"></section>
            <section class="secretary-panel hidden" data-secretary-section="settings"></section>
        </main>
    </div>
`;
