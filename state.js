import { competitionStart } from './constants.js';
import { 
    updateAllClassSelectors, 
    updateAllLeagueSelectors, 
    renderClassLeaderboardTab, 
    renderStudentLeaderboardTab,
    renderAwardStarsTab,
    renderAdventureLogTab 
} from './ui/tabs.js';
import { getTodayDateString } from './utils.js';

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
        hasLoadedCalendarHistory: false, // NEW: Track if we have history
        
        // UI Selection States
        globalSelectedClassId: null,
        globalSelectedLeague: null,
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
        unsubscribeScheduleOverrides: () => {},
        unsubscribeHeroChronicleNotes: () => {}
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
export function setAllStudents(students) { state.allStudents = students; }
export function setAllStudentScores(scores) { state.allStudentScores = scores; }
export function setAllAwardLogs(logs) { state.allAwardLogs = logs; }
export function setAllAdventureLogs(logs) { state.allAdventureLogs = logs; }
export function setAllQuestEvents(events) { state.allQuestEvents = events; }
export function setAllQuestAssignments(assignments) { state.allQuestAssignments = assignments; }
export function setAllWrittenScores(scores) { state.allWrittenScores = scores; }
export function setAllAttendanceRecords(records) { state.allAttendanceRecords = records; }
export function setAllScheduleOverrides(overrides) { state.allScheduleOverrides = overrides; }
export function setAllHeroChronicleNotes(notes) { state.allHeroChronicleNotes = notes; }
export function setHasLoadedCalendarHistory(val) { state.hasLoadedCalendarHistory = val; }

export function setGlobalSelectedClass(classId, isManual = false) {
    // Even if classId matches, if it's programmatic (initial load), we might need to trigger the UI update
    // to ensure the "Select a class" placeholder is replaced.
    if (classId === state.globalSelectedClassId && !isManual && state.globalSelectedClassId !== null) {
        // Force UI update anyway if it's not null
    } else if (classId === state.globalSelectedClassId && !isManual) {
        return;
    }

    state.globalSelectedClassId = classId;
    if (classId) {
        const selectedClass = state.allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            state.globalSelectedLeague = selectedClass.questLevel;
        }
    }

    updateAllClassSelectors(isManual);
    updateAllLeagueSelectors(isManual);

    // FIX: Always check active tab and render if we have a selection, 
    // regardless of whether it was manual or programmatic.
    const activeTab = document.querySelector('.app-tab:not(.hidden)');
    if (activeTab && state.globalSelectedClassId) {
        if (activeTab.id === 'award-stars-tab') {
            renderAwardStarsTab();
        } else if (activeTab.id === 'adventure-log-tab') {
            renderAdventureLogTab();
        }
    }
}

export function setGlobalSelectedLeague(league, isManual = false) {
    if (league === state.globalSelectedLeague) return;

    state.globalSelectedLeague = league;
    updateAllLeagueSelectors(isManual);

    // Similar fix for leagues
    const activeTab = document.querySelector('.app-tab:not(.hidden)');
    if (activeTab && state.globalSelectedLeague) {
        if (activeTab.id === 'class-leaderboard-tab') renderClassLeaderboardTab();
        if (activeTab.id === 'student-leaderboard-tab') renderStudentLeaderboardTab();
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

// Helper to fetch history (internal use)
export async function fetchMonthlyHistory(monthKey) {
    const allMonthlyHistory = get('allMonthlyHistory');
    if (allMonthlyHistory[monthKey]) return allMonthlyHistory[monthKey];
    
    const contentEl = document.getElementById('history-modal-content');
    if(contentEl && contentEl.innerHTML.includes('Select a month')) {
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
