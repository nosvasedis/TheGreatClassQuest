// /db/listeners.js

import { db, collection, query, where, onSnapshot, orderBy, doc, getDocs, writeBatch, collectionGroup } from '../firebase.js';
import * as state from '../state.js';
import { getStartOfMonthString, getTodayDateString } from '../utils.js';
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
import { updateStudentCardAttendanceState } from '../ui/core.js';
import { updateStudentCardAttendanceState as updateTabAttendance } from '../ui/tabs.js'; // Explicit import to avoid naming collision if needed
import { findAndSetCurrentLeague } from '../ui/core.js';
import { checkAndResetMonthlyStars } from './actions.js';
import { renderStoryArchive } from '../features/storyWeaver.js';
import { updateCeremonyStatus } from '../features/ceremony.js';
import * as utils from '../utils.js';
import { competitionStart } from '../constants.js';
import * as modals from '../ui/modals.js';
import { renderHomeTab } from '../features/home.js';

export function setupDataListeners(userId, dateString) {
    // Clear previous listeners
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
    state.get('unsubscribeHeroChronicleNotes')();
    state.get('unsubscribeSchoolSettings')();
    state.get('unsubscribeQuestBounties')();
    state.get('unsubscribeGuildScores')();

    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    // --- Time-bounded Definitions ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthString = startOfCurrentMonth.toISOString().split('T')[0];
    
    const competitionStartDateString = competitionStart.toISOString().split('T')[0];

    // --- Define Queries ---
    const classesQuery = query(collection(db, `${publicDataPath}/classes`));
    const studentsQuery = query(collection(db, `${publicDataPath}/students`));
    const scoresQuery = query(collection(db, `${publicDataPath}/student_scores`));
    const todaysStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where('teacherId', '==', userId), where('date', '==', dateString));
    const questEventsQuery = query(collection(db, `${publicDataPath}/quest_events`));
    const questAssignmentsQuery = query(collection(db, `${publicDataPath}/quest_assignments`), where('createdBy.uid', '==', userId));
    const completedStoriesQuery = query(collection(db, `${publicDataPath}/completed_stories`), orderBy('completedAt', 'desc'));
    const overridesQuery = query(collection(db, `${publicDataPath}/schedule_overrides`));
    const heroChronicleNotesQuery = query(collection(db, `${publicDataPath}/hero_chronicle_notes`), where('teacherId', '==', userId));
    const questBountiesQuery = query(collection(db, `${publicDataPath}/quest_bounties`), where('createdBy.uid', '==', userId));
    const shopItemsQuery = query(collection(db, `${publicDataPath}/shop_items`), where('teacherId', '==', userId));
    const schoolSettingsQuery = doc(db, `${publicDataPath}/school_settings`, 'holidays');
    const guildScoresQuery = query(collection(db, `${publicDataPath}/guild_scores`));

    // --- Optimized Queries (Time-Bounded) ---
    
    // 1. Current Month Range for Award Logs (Real-time)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const awardLogsQuery = query(
        collection(db, `${publicDataPath}/award_log`), 
        where('createdAt', '>=', startOfCurrentMonth),
        where('createdAt', '<', startOfNextMonth)
    );

    // 2. Adventure Logs (Last 30 days is fine, or match month)
    const adventureLogsQuery = query(
        collection(db, `${publicDataPath}/adventure_logs`), 
        where('createdAt', '>=', thirtyDaysAgo), 
        orderBy('createdAt', 'desc')
    );
    
    // REVAMP: Attendance now only fetches the last 30 days real-time. Older data is fetched on demand.
    const attendanceQuery = query(
    collection(db, `${publicDataPath}/attendance`), 
    where('markedBy.uid', '==', userId), // Only my attendance records
    where('createdAt', '>=', thirtyDaysAgo)
);

    const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const threeMonthsAgoString = threeMonthsAgo.toISOString().split('T')[0];

const writtenScoresQuery = query(
    collection(db, `${publicDataPath}/written_scores`), 
    where('teacherId', '==', userId), // Only load MY grading papers
    where('date', '>=', threeMonthsAgoString),
    orderBy('date', 'desc')
);

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
        updateCeremonyStatus();
        renderHomeTab(); // Also update home tab when classes load/change
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
        renderHomeTab(); // Update home tab (student count changes)
        // --- NEW: Check for missing genders in background ---
        // Debounce this slightly so it doesn't fire while typing a new name
        if (window.genderCheckTimeout) clearTimeout(window.genderCheckTimeout);
        window.genderCheckTimeout = setTimeout(() => {
            import('../db/actions.js').then(a => a.resolveMissingGenders());
        }, 3000); // Wait 3 seconds after data loads
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
                const newGold = scoreData.gold !== undefined ? scoreData.gold : newTotal; // Fallback
                const goldEl = document.getElementById(`student-gold-display-${studentId}`);

                if (goldEl && goldEl.innerText != newGold) {
                    goldEl.innerText = newGold;
                    // Trigger the CSS animation on the parent pill
                    const pill = goldEl.closest('.coin-pill');
                    if (pill) {
                        pill.classList.remove('coin-update-anim'); // Reset
                        void pill.offsetWidth; // Force reflow
                        pill.classList.add('coin-update-anim');
                    }
                }
    
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
        
        // --- ADDED LINE ---
        import('../features/home.js').then(m => m.renderHomeTab()); 
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

        state.set('todaysStars', currentTodaysStars);
        renderHomeTab(); // Update home tab (today's stars count)

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
        renderHomeTab(); // Update home tab (last test info)
    }, (error) => {
        console.error("Error listening to written scores:", error);
    }));

    state.setUnsubscribeAttendance(onSnapshot(attendanceQuery, (snapshot) => {
        // This state now only contains RECENT attendance (last 30 days)
        state.setAllAttendanceRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        
        snapshot.docChanges().forEach(change => {
            const attendanceData = change.doc.data();
            const student = state.get('allStudents').find(s => s.id === attendanceData.studentId);
            if (student) {
                const lastLessonDate = utils.getLastLessonDate(student.classId, state.get('allSchoolClasses'));
                // If the change is relevant to the most recent lesson, update the UI immediately
                if (attendanceData.date === lastLessonDate) {
                    updateStudentCardAttendanceState(attendanceData.studentId, change.type !== 'removed');
                }
            }
        });
        
        // If the attendance modal is open, and we are viewing the current month, refresh it
        const modal = document.getElementById('attendance-chronicle-modal');
        if (modal && !modal.classList.contains('hidden')) {
             // We'll handle this refresh logic more robustly in modals.js, 
             // but simple re-render triggers here if needed.
             // For now, we rely on the Modal's internal state to trigger updates or 
             // just let the 'on-demand' logic handle older months.
        }
    }, (error) => console.error("Error listening to attendance:", error)));

    state.setUnsubscribeScheduleOverrides(onSnapshot(overridesQuery, (snapshot) => {
        state.setAllScheduleOverrides(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        renderCalendarTab();
        updateCeremonyStatus();
        renderHomeTab(); // Update home tab (schedule changes)
    }, (error) => console.error("Error listening to schedule overrides:", error)));

    state.setUnsubscribeHeroChronicleNotes(onSnapshot(heroChronicleNotesQuery, (snapshot) => {
        state.setAllHeroChronicleNotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        const modal = document.getElementById('hero-chronicle-modal');
        if (modal && !modal.classList.contains('hidden')) {
            const studentId = modal.dataset.studentId;
            if (studentId) {
                modals.renderHeroChronicleContent(studentId);
            }
        }
    }, (error) => console.error("Error listening to hero chronicle notes:", error)));

    state.setUnsubscribeQuestBounties(onSnapshot(questBountiesQuery, async (snapshot) => {
        state.setAllQuestBounties(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        // Dynamically import to avoid circular dependency
        const { renderActiveBounties } = await import('../ui/core.js');
        renderActiveBounties();
    }, (error) => console.error("Error listening to quest bounties:", error)));

    onSnapshot(shopItemsQuery, (snapshot) => {
        state.setCurrentShopItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        // If shop modal is open, refresh it? For now, we trust the manual open action.
    });
    
    state.setUnsubscribeSchoolSettings(onSnapshot(schoolSettingsQuery, async (docSnapshot) => {
        if (docSnapshot.exists()) {
            state.setSchoolHolidayRanges(docSnapshot.data().ranges || []);
        } else {
            state.setSchoolHolidayRanges([]);
        }
        
        // Refresh UI
        // We use dynamic imports here to avoid circular dependency issues
        const { renderCalendarTab } = await import('../ui/tabs.js');
        renderCalendarTab();
        
        const optionsTab = document.getElementById('options-tab');
        if (optionsTab && !optionsTab.classList.contains('hidden')) {
            const { renderHolidayList } = await import('../ui/core.js');
            renderHolidayList();
        }
        renderHomeTab(); // Update home tab (holidays affect monthly stars calculation context)
    }));

    state.setUnsubscribeGuildScores(onSnapshot(guildScoresQuery, (snapshot) => {
        const allGuildScores = {};
        snapshot.docs.forEach(d => { allGuildScores[d.id] = { id: d.id, ...d.data() }; });
        state.setAllGuildScores(allGuildScores);
        renderStudentLeaderboardTab();
    }, (error) => console.error("Error listening to guild_scores:", error)));
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
