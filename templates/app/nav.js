// templates/app/nav.js

export const navHTML = `
        <nav id="bottom-nav-bar" class="cloud-dock" aria-label="Main navigation">
            <button class="nav-button nav-color-cyan active" data-tab="about-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-home icon"></i>
                <span class="text">Home</span>
            </button>
            <button class="nav-button nav-color-amber" data-tab="class-leaderboard-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-route icon"></i>
                <span class="text">Team Quest</span>
            </button>
            <button class="nav-button nav-color-purple" data-tab="student-leaderboard-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-user-graduate icon"></i>
                <span class="text">Hero's Challenge</span>
            </button>
            <button class="nav-button nav-color-lime" data-tab="shop-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-store icon"></i>
                <span class="text">Mystic Market</span>
            </button>
            <button class="nav-button nav-color-guild" data-tab="guilds-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-shield-alt icon"></i>
                <span class="text">Guild Hall</span>
            </button>
            <button class="nav-button nav-color-rose" data-tab="award-stars-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-star icon"></i>
                <span class="text">Award Stars</span>
            </button>
            <button class="nav-button nav-color-teal" data-tab="adventure-log-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-book-open icon"></i>
                <span class="text">Adventure Log</span>
            </button>
            <button class="nav-button nav-color-pink" data-tab="scholars-scroll-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-scroll icon"></i>
                <span class="text">Scholar's Scroll</span>
            </button>
            <button class="nav-button nav-color-blue" data-tab="calendar-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-calendar-alt icon"></i>
                <span class="text">Quest Calendar</span>
            </button>
            <button class="nav-button nav-color-indigo" data-tab="reward-ideas-tab">
                <span class="nav-cloud" aria-hidden="true"></span>
                <i class="fas fa-bullseye icon"></i>
                <span class="text">Training Grounds</span>
            </button>

            <button class="nav-tab hidden" data-tab="manage-students-tab"></button>
        </nav>
`;
