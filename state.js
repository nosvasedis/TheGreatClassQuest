// /state.js

import { competitionStart } from './constants.js';
import { 
    updateAllClassSelectors, 
    updateAllLeagueSelectors, 
    renderClassLeaderboardTab, 
    renderStudentLeaderboardTab,
    renderAwardStarsTab,
    renderAdventureLogTab // <-- FIX: Imported the missing render function
} from './ui/tabs.js';
// THIS IS THE FIX: Import the correct date function
import { getTodayDateString } from './utils.js';

// --- Internal State Store ---
let state = {};

// --- FIX 2: Add helper function and 'calendarCurrentDate' to state ---
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
        allAttendanceRecords: [],
        allScheduleOverrides: [],
        globalSelectedClassId: null,
        globalSelectedLeague: null,
        isProgrammaticSelection: false,
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
        // THIS IS THE FIX: Use the consistent date format function
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
        
        calendarCurrentDate: getCalendarDefaultDate(), // <-- FIX 3: ADD THIS PROPERTY

        // Unsubscribe functions
        unsubscribeClasses: () => {},
        unsubscribeStudents: () => {},
        unsubscribeStudentScores: () => {},
        unsubscribeTodaysStars: () => {},
        unsubscribeAwardLogs: () => {},
        unsubscribeQuestEvents: () => {},
        unsubscribeAdventureLogs: () => {},
        unsubscribeQuestAssignments: () => {},
        unsubscribeCompletedStories: () => {},
        unsubscribeWrittenScores: () => {},
        unsubscribeAttendance: () => {},
        unsubscribeScheduleOverrides: () => {}
    };
}

// --- Initialize State ---
state = getDefaultState();

// --- Core Functions ---

/**
 * Get a value from the state.
 * @param {string} key - The key of the state variable to retrieve.
 * @returns {*} The value from the state.
 */
export function get(key) {
    return state[key];
}

/**
 * Set a value in the state.
 * @param {string} key - The key of the state variable to set.
 * @param {*} value - The new value.
 */
export function set(key, value) {
    if (key in state) {
        state[key] = value;
    } else {
        console.warn(`Attempted to set unknown state key: ${key}`);
    }
}

/**
 * Reset the state to its default values (used on logout).
 */
export function resetState() {
    // Get default state
    const defaults = getDefaultState();
    
    // Call all unsubscribe functions before clearing them
    Object.keys(state).forEach(key => {
        if (key.startsWith('unsubscribe') && typeof state[key] === 'function') {
            state[key]();
        }
    });

    // Reset the state object
    state = defaults;
}

// --- Individual Setters ---
// These are still needed because db/listeners.js uses them directly.

export function setCurrentUserId(id) { state.currentUserId = id; }
export function setCurrentTeacherName(name) { state.currentTeacherName = name; }
export function setAllTeachersClasses(classes) { state.allTeachersClasses = classes; }
export function setAllSchoolClasses(classes) { state.allSchoolClasses = classes; }
export function setAllStudents(students) { state.allStudents = students; }
export function setAllStudentScores(scores) { state.allStudentScores = scores; }
export function setAllAwardLogs(logs) { state.allAwardLogs = logs; }
export function setAllAdventureLogs(logs) { state.allAdventureLogs = logs; }
export function setAllQuestEvents(events) { state.allQuestEvents = events; }
export function setAllQuestAssignments(assignments) { state.allQuestAssignments = assignments; }
export function setAllWrittenScores(scores) { state.allWrittenScores = scores; }
export function setAllAttendanceRecords(records) { state.allAttendanceRecords = records; }
export function setAllScheduleOverrides(overrides) { state.allScheduleOverrides = overrides; }
/**
 * Sets the globally selected class, updates the league, and syncs UI.
 * @param {string} classId - The ID of the class to select.
 * @param {boolean} isManual - Whether the change was user-initiated.
 */
export function setGlobalSelectedClass(classId, isManual = false) {
    if (classId === state.globalSelectedClassId && !isManual) return; // Prevent re-renders

    state.globalSelectedClassId = classId;
    if (classId) {
        const selectedClass = state.allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            state.globalSelectedLeague = selectedClass.questLevel;
        }
    }

    // Update UI elements
    updateAllClassSelectors(isManual);
    updateAllLeagueSelectors(isManual); // League might have changed

    // --- MAJOR BUG FIX ---
    // If a user manually changed the class, we need to force a re-render
    // of the currently active tab's content.
    if (isManual && !state.isProgrammaticSelection) {
        const activeTab = document.querySelector('.app-tab:not(.hidden)');
        if (activeTab) {
            if (activeTab.id === 'award-stars-tab') {
                renderAwardStarsTab();
            } else if (activeTab.id === 'adventure-log-tab') {
                renderAdventureLogTab();
            }
        }
    }
}


/**
 * Sets the globally selected league and syncs UI.
 * @param {string} league - The name of the league.
 *S @param {boolean} isManual - Whether the change was user-initiated.
 */
export function setGlobalSelectedLeague(league, isManual = false) {
    if (league === state.globalSelectedLeague) return;

    state.globalSelectedLeague = league;
    updateAllLeagueSelectors(isManual);

    // Manually trigger leaderboard re-renders
    if (isManual) {
    const activeTab = document.querySelector('.app-tab:not(.hidden)');
    if (activeTab && (activeTab.id === 'class-leaderboard-tab' || activeTab.id === 'student-leaderboard-tab')) {
         renderClassLeaderboardTab();
         renderStudentLeaderboardTab();
    }
}
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
