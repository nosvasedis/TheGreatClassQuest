// /db/listeners.js

import { db, collection, query, where, onSnapshot, orderBy, doc, getDocs, writeBatch, documentId, collectionGroup } from '../firebase.js';
import * as state from '../state.js';
import { getStartOfMonthString, getTodayDateString, getDDMMYYYY } from '../utils.js'; // getDDMMYYYY might be needed if we switch to it
import { 
    renderClassLeaderboardTab, renderManageClassesTab, renderAwardStarsTab, renderIdeasTabSelects, 
    renderAdventureLogTab, renderStudentLeaderboardTab, renderManageStudentsTab, 
    renderAwardStarsStudentList, renderCalendarTab, renderStarManagerStudentSelect, 
    renderAdventureLog,
    updateAwardCardState
} from '../ui/tabs.js';

import { 
    renderScholarsScrollTab, 
    renderTrialHistoryContent 
} from '../features/scholarScroll.js';
import { updateStudentCardAttendanceState, findAndSetCurrentLeague } from '../ui/core.js';
import { checkAndResetMonthlyStars } from './actions.js';
import { renderStoryArchive } from '../features/storyWeaver.js';
import { updateCeremonyStatus } from '../features/ceremony.js';
import * as utils from '../utils.js';
import { competitionStart } from '../constants.js'; // <-- FIX: Import competition start date

export function setupDataListeners(userId, dateString) {
    // Call get() on state to retrieve functions
    state.get('unsubscribeClasses')();
    state.get('unsubscribeStudents')();
    state.get('unsubscribeStudentScores')();
    state.get('unsubscribeTodaysStars')();
    state.get('unsubscribeAwardLogs')();
    state.get('unsubscribeQuestEvents')();
    state.get('unsubscribeAdventureLogs')();
    state.get('unsubscribeQuestAssignments')();
    state.get('unsubscribeCompletedStories')();
    state.get('unsubscribeWrittenScores')();
    state.get('unsubscribeAttendance')();
    state.get('unsubscribeScheduleOverrides')();

    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    // --- Define Queries ---
    const classesQuery = query(collection(db, `${publicDataPath}/classes`));
    const studentsQuery = query(collection(db, `${publicDataPath}/students`));
    const scoresQuery = query(collection(db, `${publicDataPath}/student_scores`));
    const todaysStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where('teacherId', '==', userId), where('date', '==', dateString));
    const questEventsQuery = query(collection(db, `${publicDataPath}/quest_events`));
    const questAssignmentsQuery = query(collection(db, `${publicDataPath}/quest_assignments`), where('createdBy.uid', '==', userId));
    const completedStoriesQuery = query(collection(db, `${publicDataPath}/completed_stories`), orderBy('completedAt', 'desc'));
    const attendanceQuery = query(collection(db, `${publicDataPath}/attendance`));
    const overridesQuery = query(collection(db, `${publicDataPath}/schedule_overrides`));

    // --- Time-bounded Queries for Cost Savings ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // --- FIX: Change written scores to fetch from the start of the competition ---
    // This provides a better overview for the entire school year.
    const competitionStartDateString = competitionStart.toISOString().split('T')[0];

    // These listeners correctly use 'createdAt' which you have been saving all along
    const awardLogsQuery = query(collection(db, `${publicDataPath}/award_log`), where('createdAt', '>=', thirtyDaysAgo));
    const adventureLogsQuery = query(collection(db, `${publicDataPath}/adventure_logs`), where('createdAt', '>=', thirtyDaysAgo), orderBy('createdAt', 'desc'));
    
    // --- THE FIX IS HERE ---
    // We now query using the 'date' field from the competition start date.
    const writtenScoresQuery = query(
        collection(db, `${publicDataPath}/written_scores`), 
        where('date', '>=', competitionStartDateString), 
        orderBy('date', 'desc')
    );
    // --- END OF FIX ---

    // --- Attach Listeners ---
    state.setUnsubscribeClasses(onSnapshot(classesQuery, (snapshot) => {
        const schoolClasses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.setAllSchoolClasses(schoolClasses);
        state.setAllTeachersClasses(schoolClasses.filter(c => c.createdBy?.uid === userId));
        findAndSetCurrentLeague();
        renderClassLeaderboardTab();
        renderManageClassesTab();
        renderCalendarTab();
        renderAwardStarsTab(); 
        renderIdeasTabSelects(); 
        renderAdventureLogTab();
        renderScholarsScrollTab();
        if (!document.getElementById('options-tab').classList.contains('hidden')) renderStarManagerStudentSelect();
    }, (error) => console.error("Error listening to classes:", error)));

    state.setUnsubscribeStudents(onSnapshot(studentsQuery, (snapshot) => {
        const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.setAllStudents(allStudents.sort((a,b) => a.name.localeCompare(b.name)));
        
        renderStudentLeaderboardTab();
        renderClassLeaderboardTab();
        renderManageStudentsTab();
        renderAwardStarsStudentList(state.get('globalSelectedClassId')); 
        renderScholarsScrollTab(state.get('globalSelectedClassId'));
        if (!document.getElementById('options-tab').classList.contains('hidden')) renderStarManagerStudentSelect();
    }, (error) => console.error("Error listening to students:", error)));

    state.setUnsubscribeStudentScores(onSnapshot(scoresQuery, (snapshot) => {
        const currentMonthStart = getStartOfMonthString();
        const allStudentScores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.setAllStudentScores(allStudentScores);
        
        snapshot.docChanges().forEach(change => {
            if (change.type === "added" || change.type === "modified") {
                const scoreData = change.doc.data();
                const studentId = change.doc.id;
    
                if (scoreData.lastMonthlyResetDate !== currentMonthStart) {
                    checkAndResetMonthlyStars(studentId, currentMonthStart);
                }
    
                const newMonthly = scoreData.monthlyStars || 0;
                const newTotal = scoreData.totalStars || 0;
    
                const monthlyEl = document.getElementById(`monthly-stars-${studentId}`);
                const totalEl = document.getElementById(`total-stars-${studentId}`);
    
                if (monthlyEl && monthlyEl.textContent != newMonthly) {
                    monthlyEl.textContent = newMonthly;
                    const bubble = monthlyEl.closest('.counter-bubble');
                    if (bubble) {
                        bubble.classList.add('counter-animate');
                        setTimeout(() => bubble.classList.remove('counter-animate'), 500);
                    }
                }
    
                if (totalEl && totalEl.textContent != newTotal) {
                    totalEl.textContent = newTotal;
                    const bubble = totalEl.closest('.counter-bubble');
                    if (bubble) {
                        bubble.classList.add('counter-animate');
                        setTimeout(() => bubble.classList.remove('counter-animate'), 500);
                    }
                }
            }
        });

        renderStudentLeaderboardTab();
        renderClassLeaderboardTab();
    }, (error) => console.error("Error listening to student_scores:", error)));

    state.setUnsubscribeTodaysStars(onSnapshot(todaysStarsQuery, (snapshot) => {
        const awardStarsTab = document.getElementById('award-stars-tab');
        const isTabVisible = awardStarsTab && !awardStarsTab.classList.contains('hidden');
        const currentTodaysStars = state.get('todaysStars');

        snapshot.docChanges().forEach(change => {
            const starData = change.doc.data();
            const studentId = starData.studentId;

            if (change.type === "added" || change.type === "modified") {
                currentTodaysStars[studentId] = { docId: change.doc.id, stars: starData.stars, reason: starData.reason };
                if (isTabVisible) {
                    updateAwardCardState(studentId, starData.stars, starData.reason);
                }
            } else if (change.type === "removed") {
                delete currentTodaysStars[studentId];
                if (isTabVisible) {
                    updateAwardCardState(studentId, 0, null);
                }
            }
        });

        // Set the state with the modified object to ensure reactivity if needed elsewhere
        state.set('todaysStars', currentTodaysStars);

    }, (error) => console.error("Error listening to today_stars:", error)));

    state.setUnsubscribeAwardLogs(onSnapshot(awardLogsQuery, (snapshot) => {
        state.setAllAwardLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        const newTodaysAwardLogs = {};
        const today = getTodayDateString();
        state.get('allAwardLogs').filter(l => l.teacherId === userId && l.date === today).forEach(log => {
            newTodaysAwardLogs[log.studentId] = log.id;
        });
        state.setTodaysAwardLogs(newTodaysAwardLogs);
        renderCalendarTab();
    }, (error) => console.error("Error listening to award logs:", error)));

    state.setUnsubscribeQuestEvents(onSnapshot(questEventsQuery, (snapshot) => {
        state.setAllQuestEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        renderCalendarTab();
    }, (error) => console.error("Error listening to quest events:", error)));

    state.setUnsubscribeAdventureLogs(onSnapshot(adventureLogsQuery, (snapshot) => {
        state.setAllAdventureLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        renderAdventureLog();
    }, (error) => console.error("Error listening to adventure logs:", error)));

    state.setUnsubscribeQuestAssignments(onSnapshot(questAssignmentsQuery, (snapshot) => {
        state.setAllQuestAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Error listening to quest assignments:", error)));

    state.setUnsubscribeCompletedStories(onSnapshot(completedStoriesQuery, (snapshot) => {
        state.setAllCompletedStories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!document.getElementById('story-archive-modal').classList.contains('hidden')) {
            renderStoryArchive();
        }
    }, (error) => console.error("Error listening to completed stories:", error)));

    state.setUnsubscribeWrittenScores(onSnapshot(writtenScoresQuery, (snapshot) => {
        state.setAllWrittenScores(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        const scrollClassId = document.getElementById('scroll-class-select')?.value;
        if (scrollClassId) {
            renderScholarsScrollTab(scrollClassId);
        }
        const trialHistoryModal = document.getElementById('trial-history-modal');
        if (trialHistoryModal && !trialHistoryModal.classList.contains('hidden')) {
            const classId = trialHistoryModal.dataset.classId;
            const activeView = document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
            renderTrialHistoryContent(classId, activeView);
        }
    }, (error) => {
        if (error.code === 'failed-precondition') {
             console.error("Firestore query failed. You likely need to create a composite index for 'written_scores' on the 'date' field. The error message below should contain a link to create it.", error);
            alert("A one-time database setup is required. Please open the browser console (F12) to find a link to create a necessary database index for this feature.");
        } else {
            console.error("Error listening to written scores:", error);
        }
    }));

    state.setUnsubscribeAttendance(onSnapshot(attendanceQuery, (snapshot) => {
        state.setAllAttendanceRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        snapshot.docChanges().forEach(change => {
            const attendanceData = change.doc.data();
            const student = state.get('allStudents').find(s => s.id === attendanceData.studentId);
            if (student) {
                const lastLessonDate = utils.getLastLessonDate(student.classId, state.get('allSchoolClasses'));
                if (attendanceData.date === lastLessonDate) {
                    updateStudentCardAttendanceState(attendanceData.studentId, change.type !== 'removed');
                }
            }
        });
    }, (error) => console.error("Error listening to attendance:", error)));

    state.setUnsubscribeScheduleOverrides(onSnapshot(overridesQuery, (snapshot) => {
        state.setAllScheduleOverrides(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        renderCalendarTab();
        updateCeremonyStatus();
    }, (error) => console.error("Error listening to schedule overrides:", error)));
}

export async function archivePreviousDayStars(userId, todayDateString) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const allStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where('teacherId', '==', userId));
    const snapshot = await getDocs(allStarsQuery);
    const oldDocs = snapshot.docs.filter(doc => doc.data().date !== todayDateString);
    if (oldDocs.length === 0) return;
    try {
        const batch = writeBatch(db);
        oldDocs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Archived and deleted ${oldDocs.length} old daily entries.`);
    } catch (error) { console.error('Error archiving stars:', error); }
}

export async function fetchMonthlyHistory(monthKey) {
    const allMonthlyHistory = state.get('allMonthlyHistory');
    if (allMonthlyHistory[monthKey]) return allMonthlyHistory[monthKey];
    
    const contentEl = document.getElementById('history-modal-content');
    if(contentEl && contentEl.innerHTML.includes('Select a month')) {
        contentEl.innerHTML = `<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading historical data...</p>`;
    }
    
    const historyQuery = query(collectionGroup(db, 'monthly_history'), where("month", "==", monthKey));
    try {
        const snapshot = await getDocs(historyQuery);
        const scores = {};
        snapshot.forEach(doc => {
            const studentId = doc.ref.parent.parent.id;
            scores[studentId] = doc.data().stars || 0;
        });
        allMonthlyHistory[monthKey] = scores;
        state.set('allMonthlyHistory', allMonthlyHistory);
        return scores;
    } catch (error) {
        console.error("Error fetching monthly history:", error);
        allMonthlyHistory[monthKey] = {};
        state.set('allMonthlyHistory', allMonthlyHistory);
        return {};
    }
}
