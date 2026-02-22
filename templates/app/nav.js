// templates/app/nav.js

export const navHTML = `
        <nav id="bottom-nav-bar" class="grid grid-cols-10 gap-1 p-2 shadow-inner"
            style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%);">
            <button class="nav-button nav-color-cyan active" data-tab="about-tab">
                <i class="fas fa-home icon"></i>
                <span class="text">Home</span>
            </button>
            <button class="nav-button nav-color-amber" data-tab="class-leaderboard-tab">
                <i class="fas fa-route icon"></i>
                <span class="text">Team Quest</span>
            </button>
            <button class="nav-button nav-color-purple" data-tab="student-leaderboard-tab">
                <i class="fas fa-user-graduate icon"></i>
                <span class="text">Hero's Challenge</span>
            </button>
            <button class="nav-button nav-color-green" data-tab="my-classes-tab">
                <i class="fas fa-chalkboard-teacher icon"></i>
                <span class="text">My Classes</span>
            </button>
            <button class="nav-button nav-color-rose" data-tab="award-stars-tab">
                <i class="fas fa-star icon"></i>
                <span class="text">Award</span>
            </button>
            <button class="nav-button nav-color-teal" data-tab="adventure-log-tab">
                <i class="fas fa-book-open icon"></i>
                <span class="text">Log</span>
            </button>
            <button class="nav-button nav-color-scroll" data-tab="scholars-scroll-tab">
                <i class="fas fa-scroll icon"></i>
                <span class="text">Scroll</span>
            </button>
            <button class="nav-button nav-color-blue" data-tab="calendar-tab">
                <i class="fas fa-calendar-alt icon"></i>
                <span class="text">Calendar</span>
            </button>
            <button class="nav-button nav-color-indigo" data-tab="reward-ideas-tab">
                <i class="fas fa-magic icon"></i>
                <span class="text">Ideas</span>
            </button>
            <button class="nav-button nav-color-gray" data-tab="options-tab">
                <i class="fas fa-cog icon"></i>
                <span class="text">Options</span>
            </button>

            <button class="nav-tab hidden" data-tab="manage-students-tab"></button>
        </nav>
`;
