// /db/listeners.js

import { db, collection, query, where, onSnapshot, orderBy, doc, getDocs, writeBatch, collectionGroup, limit } from '../firebase.js';
import * as state from '../state.js';
import { getStartOfMonthString, getTodayDateString } from '../utils.js';
import {
    renderClassLeaderboardTab, renderManageClassesTab, renderAwardStarsTab, renderIdeasTabSelects,
    renderAdventureLogTab, renderStudentLeaderboardTab, renderManageStudentsTab,
    renderAwardStarsStudentList, renderCalendarTab, renderStarManagerStudentSelect,
    renderAdventureLog,
    updateAwardCardState,
    updateAwardBoonButtons
} from '../ui/tabs.js';

import {
    renderScholarsScrollTab,
    renderTrialHistoryContent
} from '../features/scholarScroll.js';
import { updateStudentCardAttendanceState, findAndSetCurrentClass } from '../ui/core.js';
import { findAndSetCurrentLeague } from '../ui/core.js';
import { checkAndResetMonthlyStars } from './actions.js';
import { renderStoryArchive } from '../features/storyWeaver.js';
import { updateCeremonyStatus } from '../features/ceremony.js';
import * as utils from '../utils.js';
import { competitionStart, DEFAULT_SCHOOL_NAME } from '../constants.js';
import * as modals from '../ui/modals.js';
import { renderFamiliarOptionsUi } from '../features/familiars.js';
import { renderHomeTab } from '../features/home.js';
import { reconcileFamiliarLifecycle, shouldPassivelyReconcileFamiliar } from '../features/familiars.js';
import { refreshSetupClassesList } from '../features/schoolSetup.js';
import { setSchoolGraceConfig } from '../utils/subscription.js';
import { parseGraceWindow } from '../features/teacherJourney.js';

function clearDataListeners() {
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
    state.get('unsubscribeGuildChampions')();
    state.get('unsubscribeFortuneWheelLog')();
    state.get('unsubscribeParentSnapshot')();
    state.get('unsubscribeParentHomework')();
    state.get('unsubscribeCommunicationThreads')();
    state.get('unsubscribeCommunicationMessages')();
}

export function watchCommunicationThread(threadId) {
    state.get('unsubscribeCommunicationMessages')();
    state.setCurrentCommunicationThreadId(threadId || null);
    state.setCurrentCommunicationMessages([]);
    if (!threadId) return;

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const messagesQuery = query(
        collection(db, `${publicDataPath}/communication_messages`),
        where('threadId', '==', threadId),
        orderBy('createdAt', 'desc')
    );
    state.setUnsubscribeCommunicationMessages(onSnapshot(messagesQuery, (snapshot) => {
        state.setCurrentCommunicationMessages(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).reverse());
        if (!document.getElementById('parent-screen')?.classList.contains('hidden')) {
            import('../features/parentPortal.js').then((module) => module.renderParentPortal());
        }
        if (!document.getElementById('secretary-screen')?.classList.contains('hidden')) {
            import('../features/secretaryConsole.js').then((module) => module.renderSecretaryConsole());
        }
    }, (error) => console.error("Error listening to communication_messages:", error)));
}

function subscribeCommunicationThreads({ userId, isSecretary = false }) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const threadsQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/communication_threads`), orderBy('lastMessageAt', 'desc'))
        : query(collection(db, `${publicDataPath}/communication_threads`), where('participantUids', 'array-contains', userId), orderBy('lastMessageAt', 'desc'));

    state.setUnsubscribeCommunicationThreads(onSnapshot(threadsQuery, (snapshot) => {
        const threads = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        state.setCurrentCommunicationThreads(threads);
        const activeThreadId = state.get('currentCommunicationThreadId');
        if (!activeThreadId && threads[0]?.id) {
            watchCommunicationThread(threads[0].id);
        } else if (activeThreadId && !threads.find((item) => item.id === activeThreadId)) {
            watchCommunicationThread(threads[0]?.id || null);
        }
        if (!document.getElementById('parent-screen')?.classList.contains('hidden')) {
            import('../features/parentPortal.js').then((module) => module.renderParentPortal());
        }
        if (!document.getElementById('secretary-screen')?.classList.contains('hidden')) {
            import('../features/secretaryConsole.js').then((module) => module.renderSecretaryConsole());
        }
    }, (error) => console.error("Error listening to communication_threads:", error)));
}

export function setupParentSession(userId, profile, onInitialDataReady) {
    clearDataListeners();

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const studentId = profile?.linkedStudentId;
    if (!studentId) {
        state.setCurrentParentSnapshot(null);
        state.setCurrentParentHomework([]);
        state.setCurrentCommunicationThreads([]);
        state.setCurrentCommunicationMessages([]);
        if (typeof onInitialDataReady === 'function') onInitialDataReady();
        return;
    }

    let snapshotReady = false;
    let schoolSettingsReady = false;
    const maybeReady = () => {
        if (snapshotReady && schoolSettingsReady && typeof onInitialDataReady === 'function') {
            onInitialDataReady();
        }
    };

    const parentSnapshotRef = doc(db, `${publicDataPath}/parent_snapshots`, studentId);
    const homeworkQuery = query(
        collection(db, `${publicDataPath}/parent_homework`),
        where('studentId', '==', studentId),
        where('sourceType', '==', 'quest-assignment'),
        where('status', '==', 'published'),
        orderBy('updatedAt', 'desc'),
        limit(1)
    );
    const schoolSettingsQuery = doc(db, `${publicDataPath}/school_settings`, 'holidays');

    state.setUnsubscribeParentSnapshot(onSnapshot(parentSnapshotRef, (snapshot) => {
        state.setCurrentParentSnapshot(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        snapshotReady = true;
        maybeReady();
        import('../features/parentPortal.js').then((module) => module.renderParentPortal());
    }, (error) => console.error('Error listening to parent snapshot:', error)));

    state.setUnsubscribeParentHomework(onSnapshot(homeworkQuery, (snapshot) => {
        state.setCurrentParentHomework(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        import('../features/parentPortal.js').then((module) => module.renderParentPortal());
    }, (error) => console.error('Error listening to parent homework:', error)));

    state.setUnsubscribeSchoolSettings(onSnapshot(schoolSettingsQuery, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            state.setSchoolName(data.schoolName || null);
            state.setSchoolHolidayRanges(data.ranges || []);
            const weatherLocation = utils.normalizeWeatherLocation(data.weatherLocation);
            state.setSchoolWeatherLocation(weatherLocation);
            utils.setWeatherCoordinates(weatherLocation);
            document.querySelectorAll('[data-school-name]').forEach((el) => {
                el.textContent = data.schoolName || DEFAULT_SCHOOL_NAME;
            });
        }
        schoolSettingsReady = true;
        maybeReady();
    }));

    subscribeCommunicationThreads({ userId, isSecretary: false });
}

export function setupDataListeners(userId, dateString, onInitialDataReady, options = {}) {
    const isSecretary = options.role === 'secretary';
    let initialReadyFired = false;
    let classesReady = false;
    let schoolSettingsReady = false;
    let specialHeroProgressionReconciled = false;
    function maybeFireInitialReady() {
        if (typeof onInitialDataReady === 'function' && !initialReadyFired && classesReady && schoolSettingsReady) {
            initialReadyFired = true;
            onInitialDataReady();
        }
    }
    function maybeReconcileSpecialHeroProgression() {
        if (specialHeroProgressionReconciled) return;
        if (!state.get('allStudents').length || !state.get('allStudentScores').length) return;
        specialHeroProgressionReconciled = true;
        import('./actions.js')
            .then(actions => actions.reconcileScholarAndNomadProgressFromLogs())
            .catch((error) => console.warn('Special hero progression reconciliation failed:', error));
    }

    clearDataListeners();

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
    const questAssignmentsQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/quest_assignments`))
        : query(collection(db, `${publicDataPath}/quest_assignments`), where('createdBy.uid', '==', userId));
    const completedStoriesQuery = query(collection(db, `${publicDataPath}/completed_stories`), orderBy('completedAt', 'desc'));
    const overridesQuery = query(collection(db, `${publicDataPath}/schedule_overrides`));
    const heroChronicleNotesQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/hero_chronicle_notes`))
        : query(collection(db, `${publicDataPath}/hero_chronicle_notes`), where('teacherId', '==', userId));
    const questBountiesQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/quest_bounties`))
        : query(collection(db, `${publicDataPath}/quest_bounties`), where('createdBy.uid', '==', userId));
    const shopItemsQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/shop_items`))
        : query(collection(db, `${publicDataPath}/shop_items`), where('teacherId', '==', userId));
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
    const attendanceQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/attendance`), where('createdAt', '>=', thirtyDaysAgo))
        : query(
            collection(db, `${publicDataPath}/attendance`),
            where('markedBy.uid', '==', userId),
            where('createdAt', '>=', thirtyDaysAgo)
        );

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoString = threeMonthsAgo.toISOString().split('T')[0];

    const writtenScoresQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/written_scores`), where('date', '>=', threeMonthsAgoString))
        : query(
            collection(db, `${publicDataPath}/written_scores`),
            where('teacherId', '==', userId),
            where('date', '>=', threeMonthsAgoString),
            orderBy('date', 'desc')
        );

    function applySchoolNameToDom(name) {
        const display = name || DEFAULT_SCHOOL_NAME;
        document.querySelectorAll('[data-school-name]').forEach((el) => {
            el.textContent = display;
        });
    }

    // --- Attach Listeners ---
    state.setUnsubscribeClasses(onSnapshot(classesQuery, (snapshot) => {
        const schoolClasses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.setAllSchoolClasses(schoolClasses);
        state.setAllTeachersClasses(isSecretary ? schoolClasses : schoolClasses.filter(c => c.createdBy?.uid === userId));
        classesReady = true;
        maybeFireInitialReady();
        refreshSetupClassesList();
        findAndSetCurrentLeague();
        // Smart class selector - find active class if there's an active lesson
        findAndSetCurrentClass();
        renderClassLeaderboardTab();
        renderManageClassesTab();
        renderCalendarTab();
        renderAwardStarsTab({ preserveStudentOrder: true });
        renderIdeasTabSelects();
        renderAdventureLogTab();
        renderScholarsScrollTab();
        if (!document.getElementById('options-tab').classList.contains('hidden')) {
            renderStarManagerStudentSelect();
            renderFamiliarOptionsUi();
        }
        updateCeremonyStatus();
        renderHomeTab(); // Also update home tab when classes load/change
    }, (error) => console.error("Error listening to classes:", error)));

    state.setUnsubscribeStudents(onSnapshot(studentsQuery, (snapshot) => {
        const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.setAllStudents(allStudents.sort((a, b) => a.name.localeCompare(b.name)));
        maybeReconcileSpecialHeroProgression();

        renderStudentLeaderboardTab();
        renderClassLeaderboardTab();
        renderManageStudentsTab();
        renderAwardStarsStudentList(state.get('globalSelectedClassId'), false);
        renderScholarsScrollTab(state.get('globalSelectedClassId'));
        if (!document.getElementById('options-tab').classList.contains('hidden')) {
            renderStarManagerStudentSelect();
            renderFamiliarOptionsUi();
        }
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
        maybeReconcileSpecialHeroProgression();

        snapshot.docChanges().forEach(change => {
            if (change.type === "added" || change.type === "modified") {
                const scoreData = change.doc.data();
                const studentId = change.doc.id;

                if (scoreData.lastMonthlyResetDate !== currentMonthStart) {
                    // Only reset MY students — writing sub-collections on other teachers'
                    // students causes Firebase 403 permission-denied errors.
                    const student = state.get('allStudents').find(s => s.id === studentId);
                    if (student?.createdBy?.uid === userId) {
                        checkAndResetMonthlyStars(studentId, currentMonthStart);
                    }
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

                // Also update the shop gold display if this student is selected in the shop
                const shopStudentSelect = document.getElementById('shop-student-select');
                const shopGoldEl = document.getElementById('shop-student-gold');
                if (shopGoldEl && shopStudentSelect && shopStudentSelect.value === studentId) {
                    shopGoldEl.innerText = `${newGold} 🪙`;
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

                const ownerUid = scoreData.createdBy?.uid || state.get('allStudents').find((s) => s.id === studentId)?.createdBy?.uid;
                if (ownerUid === userId && shouldPassivelyReconcileFamiliar(scoreData)) {
                    reconcileFamiliarLifecycle(studentId, { announce: false, source: 'listener-passive' }).catch((e) => console.warn('Passive familiar reconciliation failed:', e));
                }
            }
        });

        const manageStudentsTab = document.getElementById('manage-students-tab');
        if (manageStudentsTab && !manageStudentsTab.classList.contains('hidden')) {
            renderManageStudentsTab();
        }

        renderStudentLeaderboardTab();
        renderClassLeaderboardTab();
        if (!document.getElementById('options-tab').classList.contains('hidden')) {
            renderFamiliarOptionsUi();
        }

        // Update boon buttons in award tab when leaderboard changes
        updateAwardBoonButtons(state.get('globalSelectedClassId'));

        // --- ADDED LINE ---
        import('../features/home.js').then(m => m.renderHomeTab());
    }, (error) => console.error("Error listening to student_scores:", error)));

    // School settings listener is set up below (line ~398) to avoid duplicate listeners
    // It handles holidays, school name, and weather location

    state.setUnsubscribeTodaysStars(onSnapshot(todaysStarsQuery, (snapshot) => {
        const awardStarsTab = document.getElementById('award-stars-tab');
        const isTabVisible = awardStarsTab && !awardStarsTab.classList.contains('hidden');
        const adventureLogTab = document.getElementById('adventure-log-tab');
        const isAdventureLogVisible = adventureLogTab && !adventureLogTab.classList.contains('hidden');
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
        if (isAdventureLogVisible) renderAdventureLogTab();
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
        // Refresh boon button states when a peer boon is given (daily limit changes)
        updateAwardBoonButtons(state.get('globalSelectedClassId'));
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
                const lastLessonDate = utils.getLastLessonDate(
                    student.classId,
                    state.get('allSchoolClasses'),
                    state.get('allScheduleOverrides'),
                    state.get('schoolHolidayRanges')
                );
                // If the change is relevant to the most recent lesson, update the UI immediately
                if (attendanceData.date === lastLessonDate) {
                    updateStudentCardAttendanceState(attendanceData.studentId, change.type !== 'removed');
                }
            }
        });

        modals.scheduleAttendanceChronicleRefresh?.();
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

    onSnapshot(shopItemsQuery, async (snapshot) => {
        state.setCurrentShopItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        // Real-time stock updates: Refresh shop UI if modal is open
        const shopModal = document.getElementById('shop-modal');
        if (shopModal && !shopModal.classList.contains('hidden')) {
            const { renderShopUI } = await import('../ui/core/shop.js');
            renderShopUI();
        }
    });

    state.setUnsubscribeSchoolSettings(onSnapshot(schoolSettingsQuery, async (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            state.setSchoolHolidayRanges(data.ranges || []);
            state.setSchoolName(data.schoolName || null);
            const graceWindow = parseGraceWindow(data);
            state.setSchoolBillingGrace(graceWindow);
            setSchoolGraceConfig(graceWindow);
            const weatherLocation = utils.normalizeWeatherLocation(data.weatherLocation);
            state.setSchoolWeatherLocation(weatherLocation);
            state.setSchoolAssessmentDefaults(data.assessmentDefaultsByLeague || null);
            utils.setWeatherCoordinates(weatherLocation);
            applySchoolNameToDom(data.schoolName);
        } else {
            state.setSchoolHolidayRanges([]);
            state.setSchoolName(null);
            state.setSchoolBillingGrace(null);
            setSchoolGraceConfig(null);
            state.setSchoolWeatherLocation(null);
            state.setSchoolAssessmentDefaults(null);
            utils.setWeatherCoordinates(null);
            applySchoolNameToDom(null);
        }
        schoolSettingsReady = true;
        maybeFireInitialReady();
        utils.fetchSolarCycle();

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
        // One-time Glory migration for guilds without Glory fields
        import('../features/guildScoring.js').then(m => m.migrateGuildGloryIfNeeded());
        // Check weekly reset
        import('../features/guildScoring.js').then(m => m.checkAndPerformWeeklyGloryReset());
        renderStudentLeaderboardTab();
        const guildsTab = document.getElementById('guilds-tab');
        if (guildsTab && !guildsTab.classList.contains('hidden')) {
            import('../ui/tabs/guilds.js').then(m => m.renderGuildsTab());
        }
    }, (error) => console.error("Error listening to guild_scores:", error)));

    // Guild Champions — current month
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const guildChampionsQuery = query(
        collection(db, `${publicDataPath}/guild_champions`),
        where('monthKey', '==', currentMonthKey)
    );
    state.setUnsubscribeGuildChampions(onSnapshot(guildChampionsQuery, (snapshot) => {
        const champions = {};
        snapshot.docs.forEach(d => { champions[d.data().guildId] = { ...d.data() }; });
        state.setGuildChampions(champions);
        renderStudentLeaderboardTab();
    }, (error) => console.error("Error listening to guild_champions:", error)));

    // Fortune's Wheel Log — recent spins for all classes (limit 20)
    const wheelLogQuery = query(
        collection(db, `${publicDataPath}/fortune_wheel_log`),
        orderBy('spunAt', 'desc'),
        limit(20)
    );
    state.setUnsubscribeFortuneWheelLog(onSnapshot(wheelLogQuery, (snapshot) => {
        const log = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.setFortuneWheelLog(log);
        const guildsTab = document.getElementById('guilds-tab');
        if (guildsTab && !guildsTab.classList.contains('hidden')) {
            import('../ui/tabs/guilds.js').then(m => m.renderGuildsTab());
        }
    }, (error) => console.error("Error listening to fortune_wheel_log:", error)));

    subscribeCommunicationThreads({ userId, isSecretary });
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
