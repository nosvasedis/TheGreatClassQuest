// templates/app/nav.js

/**
 * The teacher's bottom cloud dock. Each cloud carries a short story of what its tab is for, shown
 * as a cloud-shaped tip above it (ui/questTips.js reads data-gtip; the "cloud" look lives in
 * styles/quest_tips.css). ui/tabs/navigation.js adds a plan note only when a tab is locked.
 */
export const NAV_TABS = [
    { tab: 'about-tab', color: 'cyan', icon: 'fa-home', label: 'Home', ink: '#0891b2',
        tip: "Today at a glance: the class's party, Hero of the Day, the sky outside and what this lesson holds." },
    { tab: 'class-leaderboard-tab', color: 'amber', icon: 'fa-route', label: 'Team Quest', ink: '#b45309',
        tip: "Your class races the other classes of its league across the realms, towards this month's star goal." },
    { tab: 'student-leaderboard-tab', color: 'purple', icon: 'fa-user-graduate', label: "Hero's Challenge", ink: '#7e22ce',
        tip: "Every hero's own standings, in the class or across the school, on the road to Prodigy of the Month." },
    { tab: 'shop-tab', color: 'lime', icon: 'fa-store', label: 'Mystic Market', ink: '#4d7c0f',
        tip: 'Heroes spend the Gold they earned on relics, charms and treasures that go into their Satchel.' },
    { tab: 'guilds-tab', color: 'guild', icon: 'fa-shield-alt', label: 'Guild Hall', ink: '#c2410c',
        tip: 'The four guilds compete each month for the Crowns. Banners, anthems, lore and who leads the year.' },
    { tab: 'award-stars-tab', color: 'rose', icon: 'fa-star', label: 'Award Stars', ink: '#be123c',
        tip: 'Give stars for Teamwork, Creativity, Respect and Focus, mark who is away, and welcome them back.' },
    { tab: 'adventure-log-tab', color: 'teal', icon: 'fa-book-open', label: 'Adventure Log', ink: '#0f766e',
        tip: "The class diary: one illustrated page for every lesson, kept as the story of the school year." },
    { tab: 'scholars-scroll-tab', color: 'pink', icon: 'fa-scroll', label: "Scholar's Scroll", ink: '#be185d',
        tip: "Log tests and dictations, follow each child's marks over time and celebrate the Honour Roll." },
    { tab: 'calendar-tab', color: 'blue', icon: 'fa-calendar-alt', label: 'Quest Calendar', ink: '#1d4ed8',
        tip: 'Lessons, holidays and Quest Events for the month. Tap a day to plan it, cancel a lesson or add one.' },
    { tab: 'reward-ideas-tab', color: 'indigo', icon: 'fa-bullseye', label: 'Training Grounds', ink: '#4338ca',
        tip: 'Four class games, one for each hero skill. Win two rounds to earn the class a skill star.' },
];

/** "Name: what it does", the text the cloud tip shows. */
export const navTipText = (t) => `${t.label}: ${t.tip}`;

const cloudButton = (t, i) => `
            <button class="nav-button nav-color-${t.color}${i === 0 ? ' active' : ''}" data-tab="${t.tab}"
                data-gtip="${navTipText(t).replace(/"/g, '&quot;')}" data-gtip-icon="${t.icon}" data-gtip-ink="${t.ink}">
                <span class="nav-cloud" aria-hidden="true"></span>
                <span class="nav-glints" aria-hidden="true"></span>
                <i class="fas ${t.icon} icon"></i>
                <span class="text">${t.label}</span>
            </button>`;

export const navHTML = `
        <nav id="bottom-nav-bar" class="cloud-dock" aria-label="Main navigation" data-gtip-look="cloud">${NAV_TABS.map(cloudButton).join('')}

            <button class="nav-tab hidden" data-tab="manage-students-tab"></button>
        </nav>
`;
