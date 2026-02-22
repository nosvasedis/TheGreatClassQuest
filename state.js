import { competitionStart } from './constants.js';
import { getTodayDateString, getClassesOnDay } from './utils.js';

// --- Internal State Store ---
let state = {};

function getCalendarDefaultDate() {
    let date = new Date();
    if (date < competitionStart) {
        date = new Date(competitionStart);
    }
    return date;
}

// --- Default State Function ---
function getDefaultState() {
    return {
        currentUserId: null,
        currentTeacherName: null,
        allTeachersClasses: [],
        allSchoolClasses: [],
        allStudents: [],
        allStudentScores: [],
        allAwardLogs: [],
        allAdventureLogs: [],
        allQuestEvents: [],
        allQuestAssignments: [],
        allWrittenScores: [],
        allAttendanceRecords: [], // Keeps recent/real-time records
        allScheduleOverrides: [],
        allHeroChronicleNotes: [],
        schoolHolidayRanges: [], // Stores global holiday periods
        hasLoadedCalendarHistory: false, // NEW: Track if we have history

        // UI Selection States
        globalSelectedClassId: localStorage.getItem('quest_last_class_id') || null,
        reigningHero: null, // Stores the student object of the last crowned hero
        globalSelectedLeague: localStorage.getItem('quest_last_league') || null,
        isProgrammaticSelection: false,

        // Feature Specific States
        ceremonyState: {
            isActive: false,
            type: null,
            league: null,
            monthKey: null,
            data: [],
            step: -1,
            isFinalShowdown: false
        },
        todaysAwardLogs: {},
        todaysStars: {},
        todaysStarsDate: getTodayDateString(),
        currentManagingClassId: null,
        studentLeaderboardView: 'class',
        studentStarMetric: 'monthly',
        allMonthlyHistory: {},
        currentlySelectedDayCell: null,
        currentLogFilter: { classId: null, month: '' },
        currentStoryData: {},
        unsubscribeStoryData: {},
        storyWeaverLockedWord: null,
        allCompletedStories: [],
        currentStorybookAudio: null,
        currentNarrativeAudio: null,
        avatarMakerData: {
            studentId: null,
            creature: null,
            color: null,
            accessory: null,
            generatedImage: null
        },

        // Calendar & Attendance Views
        calendarCurrentDate: getCalendarDefaultDate(),
        attendanceViewDate: new Date(), // NEW: Tracks the month being viewed in the chronicle
        // Wallpaper Mode State
        wallpaperQuoteCache: null,
        wallpaperQuoteLastFetch: 0,

        // Unsubscribe functions
        unsubscribeClasses: () => { },
        unsubscribeStudents: () => { },
        unsubscribeStudentScores: () => { },
        unsubscribeTodaysStars: () => { },
        unsubscribeAwardLogs: () => { },
        unsubscribeQuestEvents: () => { },
        unsubscribeAdventureLogs: () => { },
        unsubscribeQuestAssignments: () => { },
        unsubscribeCompletedStories: () => { },
        unsubscribeWrittenScores: () => { },
        unsubscribeAttendance: () => { },
        unsubscribeScheduleOverrides: () => { },
        unsubscribeHeroChronicleNotes: () => { },
        allQuestBounties: [], // Store bounties
        currentShopItems: [], // Store this month's shop items
        unsubscribeQuestBounties: () => { }, // Listener unsubscribe
        unsubscribeSchoolSettings: () => { } // Listener for settings
    };
}

// --- Initialize State ---
state = getDefaultState();

// --- Core Functions ---

export function get(key) {
    return state[key];
}

export function set(key, value) {
    if (key in state) {
        state[key] = value;
    } else {
        console.warn(`Attempted to set unknown state key: ${key}`);
    }
}

export function resetState() {
    const defaults = getDefaultState();
    Object.keys(state).forEach(key => {
        if (key.startsWith('unsubscribe') && typeof state[key] === 'function') {
            state[key]();
        }
    });
    state = defaults;
}

// --- Individual Setters ---

export function setCurrentUserId(id) { state.currentUserId = id; }
export function setCurrentTeacherName(name) { state.currentTeacherName = name; }
export function setAllTeachersClasses(classes) { state.allTeachersClasses = classes; }
export function setAllSchoolClasses(classes) { state.allSchoolClasses = classes; }
export function setAllStudents(students) { state.allStudents = students; updateReigningHero(); }
export function setAllStudentScores(scores) { state.allStudentScores = scores; }
export function setAllAwardLogs(logs) { state.allAwardLogs = logs; }
export function setAllAdventureLogs(logs) { state.allAdventureLogs = logs; updateReigningHero(); }
export function setAllQuestEvents(events) { state.allQuestEvents = events; }
export function setAllQuestAssignments(assignments) { state.allQuestAssignments = assignments; }
export function setAllWrittenScores(scores) { state.allWrittenScores = scores; }
export function setAllAttendanceRecords(records) { state.allAttendanceRecords = records; }
export function setAllScheduleOverrides(overrides) { state.allScheduleOverrides = overrides; }
export function setAllHeroChronicleNotes(notes) { state.allHeroChronicleNotes = notes; }
export function setSchoolHolidayRanges(ranges) { state.schoolHolidayRanges = ranges; }
export function setUnsubscribeSchoolSettings(func) { state.unsubscribeSchoolSettings = func; }
export function setHasLoadedCalendarHistory(val) { state.hasLoadedCalendarHistory = val; }

export function setGlobalSelectedClass(classId, isManual = false) {
    if (classId === state.globalSelectedClassId && !isManual && state.globalSelectedClassId !== null) {
        // Force UI update anyway
    } else if (classId === state.globalSelectedClassId && !isManual) {
        return;
    }

    state.globalSelectedClassId = classId;
    if (classId) {
        localStorage.setItem('quest_last_class_id', classId);
    } else {
        localStorage.removeItem('quest_last_class_id');
    }

    updateReigningHero();
    if (classId) {
        const selectedClass = state.allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            state.globalSelectedLeague = selectedClass.questLevel;
            localStorage.setItem('quest_last_league', selectedClass.questLevel);
        }
    }

    // DYNAMIC IMPORTS: Solves the circular dependency crash
    import('./ui/tabs.js').then(tabs => {
        tabs.updateAllClassSelectors(isManual);
        tabs.updateAllLeagueSelectors(isManual);

        const activeTabId = localStorage.getItem('quest_last_active_tab') || 'about-tab';
        if (activeTabId) {
            if (activeTabId === 'award-stars-tab') {
                tabs.renderAwardStarsTab();
            } else if (activeTabId === 'adventure-log-tab') {
                tabs.renderAdventureLogTab();
            } else if (activeTabId === 'class-leaderboard-tab') {
                tabs.renderClassLeaderboardTab();
            } else if (activeTabId === 'student-leaderboard-tab') {
                tabs.renderStudentLeaderboardTab();
            } else if (activeTabId === 'scholars-scroll-tab') {
                import('./features/scholarScroll.js').then(m => m.renderScholarsScrollTab());
            } else if (activeTabId === 'reward-ideas-tab') {
                tabs.renderIdeasTabSelects();
            }
        }
    });

    // Update bounties separately
    import('./ui/core.js').then(m => m.renderActiveBounties());
}

export function setGlobalSelectedLeague(league, isManual = false) {
    if (league === state.globalSelectedLeague && !isManual) return;

    state.globalSelectedLeague = league;
    if (league) {
        localStorage.setItem('quest_last_league', league);
    } else {
        localStorage.removeItem('quest_last_league');
    }

    // When the league is manually changed, sync the class selection to the best
    // matching class in that league so all tabs stay consistent.
    if (isManual && league) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const todayString = getTodayDateString();
        const classesToday = getClassesOnDay(todayString, state.allSchoolClasses, state.allScheduleOverrides);
        const myLeagueClasses = classesToday.filter(c =>
            c.questLevel === league &&
            state.allTeachersClasses.some(tc => tc.id === c.id)
        );
        // Prefer the class that's currently in session; fall back to the first one in the league
        const activeClass = myLeagueClasses.find(c =>
            c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd
        );
        const bestClass = activeClass || myLeagueClasses[0] || null;

        if (bestClass) {
            state.globalSelectedClassId = bestClass.id;
            localStorage.setItem('quest_last_class_id', bestClass.id);
        } else {
            state.globalSelectedClassId = null;
            localStorage.removeItem('quest_last_class_id');
        }
        updateReigningHero();
    }

    // DYNAMIC IMPORT
    import('./ui/tabs.js').then(tabs => {
        tabs.updateAllLeagueSelectors(isManual);
        tabs.updateAllClassSelectors(isManual);

        const activeTabId = localStorage.getItem('quest_last_active_tab') || 'about-tab';
        if (activeTabId && state.globalSelectedLeague) {
            if (activeTabId === 'class-leaderboard-tab') tabs.renderClassLeaderboardTab();
            else if (activeTabId === 'student-leaderboard-tab') tabs.renderStudentLeaderboardTab();
            else if (activeTabId === 'award-stars-tab') tabs.renderAwardStarsTab();
            else if (activeTabId === 'adventure-log-tab') tabs.renderAdventureLogTab();
            else if (activeTabId === 'scholars-scroll-tab') {
                import('./features/scholarScroll.js').then(m => m.renderScholarsScrollTab());
            }
        }
    });
}

export function setIsProgrammaticSelection(value) { state.isProgrammaticSelection = value; }
export function setCeremonyState(newState) { state.ceremonyState = newState; }
export function setTodaysAwardLogs(logs) { state.todaysAwardLogs = logs; }
export function setTodaysStars(stars) { state.todaysStars = stars; }
export function setTodaysStarsDate(date) { state.todaysStarsDate = date; }
export function setCurrentManagingClassId(id) { state.currentManagingClassId = id; }
export function setStudentLeaderboardView(view) { state.studentLeaderboardView = view; }
export function setStudentStarMetric(metric) { state.studentStarMetric = metric; }
export function setAllMonthlyHistory(history) { state.allMonthlyHistory = history; }
export function setCurrentlySelectedDayCell(cell) { state.currentlySelectedDayCell = cell; }
export function setCurrentLogFilter(filter) { state.currentLogFilter = filter; }
export function setCurrentStoryData(data) { state.currentStoryData = data; }
export function setUnsubscribeStoryData(data) { state.unsubscribeStoryData = data; }
export function setStoryWeaverLockedWord(word) { state.storyWeaverLockedWord = word; }
export function setAllCompletedStories(stories) { state.allCompletedStories = stories; }
export function setCurrentStorybookAudio(audio) { state.currentStorybookAudio = audio; }
export function setCurrentNarrativeAudio(audio) { state.currentNarrativeAudio = audio; }
export function setAvatarMakerData(data) { state.avatarMakerData = data; }
export function setAttendanceViewDate(date) { state.attendanceViewDate = date; }

// Unsubscribe setters
export function setUnsubscribeClasses(func) { state.unsubscribeClasses = func; }
export function setUnsubscribeStudents(func) { state.unsubscribeStudents = func; }
export function setUnsubscribeStudentScores(func) { state.unsubscribeStudentScores = func; }
export function setUnsubscribeTodaysStars(func) { state.unsubscribeTodaysStars = func; }
export function setUnsubscribeAwardLogs(func) { state.unsubscribeAwardLogs = func; }
export function setUnsubscribeQuestEvents(func) { state.unsubscribeQuestEvents = func; }
export function setUnsubscribeAdventureLogs(func) { state.unsubscribeAdventureLogs = func; }
export function setUnsubscribeQuestAssignments(func) { state.unsubscribeQuestAssignments = func; }
export function setUnsubscribeCompletedStories(func) { state.unsubscribeCompletedStories = func; }
export function setUnsubscribeWrittenScores(func) { state.unsubscribeWrittenScores = func; }
export function setUnsubscribeAttendance(func) { state.unsubscribeAttendance = func; }
export function setUnsubscribeScheduleOverrides(func) { state.unsubscribeScheduleOverrides = func; }
export function setUnsubscribeHeroChronicleNotes(func) { state.unsubscribeHeroChronicleNotes = func; }
export function setAllQuestBounties(bounties) { state.allQuestBounties = bounties; }
export function setUnsubscribeQuestBounties(func) { state.unsubscribeQuestBounties = func; }
export function setCurrentShopItems(items) { state.currentShopItems = items; }

// Helper to fetch history (internal use)
export async function fetchMonthlyHistory(monthKey) {
    const allMonthlyHistory = get('allMonthlyHistory');
    if (allMonthlyHistory[monthKey]) return allMonthlyHistory[monthKey];

    const contentEl = document.getElementById('history-modal-content');
    if (contentEl && contentEl.innerHTML.includes('Select a month')) {
        contentEl.innerHTML = `<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading historical data...</p>`;
    }

    const { collectionGroup, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { db } = await import('./firebase.js');

    const historyQuery = query(collectionGroup(db, 'monthly_history'), where("month", "==", monthKey));
    try {
        const snapshot = await getDocs(historyQuery);
        const scores = {};
        snapshot.forEach(doc => {
            const studentId = doc.ref.parent.parent.id;
            scores[studentId] = doc.data().stars || 0;
        });
        allMonthlyHistory[monthKey] = scores;
        set('allMonthlyHistory', allMonthlyHistory);
        return scores;
    } catch (error) {
        console.error("Error fetching monthly history:", error);
        allMonthlyHistory[monthKey] = {};
        set('allMonthlyHistory', allMonthlyHistory);
        return {};
    }
}

export function setReigningHero(hero) { state.reigningHero = hero; }

function updateReigningHero() {
    const classId = state.globalSelectedClassId;
    if (!classId || !state.allAdventureLogs.length) {
        state.reigningHero = null;
        return;
    }

    // Φιλτράρισμα και ταξινόμηση για να βρούμε το πιο πρόσφατο Log
    const logs = [...state.allAdventureLogs]
        .filter(l => l.classId === classId)
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    if (logs.length > 0) {
        const lastHeroName = logs[0].hero;
        state.reigningHero = state.allStudents.find(s => s.name === lastHeroName && s.classId === classId) || null;
    } else {
        state.reigningHero = null;
    }
}
