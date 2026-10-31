// templates/app/tabs/students.js

export const studentsTabHTML = `
    <div id="manage-students-tab" class="app-tab hidden">
        <div class="max-w-5xl mx-auto px-2 sm:px-4">

            <!-- Class banner: back to classes, the class name, its tools and the add-student form -->
            <div class="roster-banner">
                <div class="roster-banner__row">
                    <button id="back-to-classes-btn" type="button" class="roster-banner__back bubbly-button">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <span class="hidden sm:inline">Classes</span>
                    </button>
                    <div class="roster-banner__name">
                        <p class="roster-banner__kicker">Managing class</p>
                        <h2 class="roster-banner__title" id="manage-class-name"></h2>
                    </div>
                    <button id="class-greenhouse-roster-btn" type="button" title="Class Greenhouse: understand and help the whole class"
                        class="roster-banner__btn roster-banner__btn--greenhouse bubbly-button">
                        <i class="fas fa-seedling" aria-hidden="true"></i>
                        <span class="hidden sm:inline">Greenhouse</span>
                    </button>
                    <button id="add-student-toggle-btn" type="button" class="roster-banner__btn roster-banner__btn--add bubbly-button">
                        <i class="fas fa-user-plus" aria-hidden="true"></i>
                        <span class="hidden sm:inline">New Student</span>
                    </button>
                    <div id="student-count-badge" class="roster-banner__count hidden">
                        <i class="fas fa-users" aria-hidden="true"></i><span id="student-count-number">0</span><span class="roster-count-word"> students</span>
                    </div>
                </div>

                <!-- Inline expandable add-student form (hidden by default) -->
                <div id="add-student-panel" class="roster-banner__add hidden">
                    <form id="add-student-form" class="roster-banner__form">
                        <input type="hidden" id="manage-class-id">
                        <input type="text" id="student-name" placeholder="Student's full name..."
                            class="roster-banner__input" autocomplete="off" required>
                        <button type="submit" class="roster-banner__submit bubbly-button">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                            <span>Add to Roster</span>
                        </button>
                    </form>
                </div>
            </div>

            <div id="returning-students-panel" class="hidden mb-5"></div>

            <!-- Student Roster — full width -->
            <section class="roster-panel">
                <header class="roster-panel__head">
                    <div class="roster-panel__title">
                        <span class="roster-panel__crest" aria-hidden="true"><i class="fas fa-scroll"></i></span>
                        <div>
                            <h3 class="font-title roster-panel__heading">Student Roster</h3>
                            <p class="roster-panel__hint">Tap a tool under any hero to open it.</p>
                        </div>
                    </div>
                    <div class="roster-panel__columns" aria-hidden="true">
                        <span class="roster-column roster-column--hero"><i class="fas fa-shield-halved"></i> Hero path</span>
                        <span class="roster-column roster-column--records"><i class="fas fa-book-open"></i> Records</span>
                        <span class="roster-column roster-column--admin"><i class="fas fa-sliders-h"></i> Manage</span>
                    </div>
                </header>
                <div id="student-list" class="roster-register"></div>
            </section>

        </div>
    </div>
`;
