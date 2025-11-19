// /ui/core.js

// --- IMPORTS ---
import * as state from '../state.js';
import { db, auth } from '../firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, collection, query, where, getDocs, runTransaction, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import * as modals from './modals.js';
import { 
    handleGenerateIdea, 
    handleGetOracleInsight, 
    handleGetQuestUpdate, 
    downloadCertificateAsPdf 
} from './modals.js';
import * as tabs from './tabs.js';
import * as scholarScroll from '../features/scholarScroll.js';
import * as storyWeaver from '../features/storyWeaver.js';
import * as avatar from '../features/avatar.js';
import * as ceremony from '../features/ceremony.js';
import * as utils from '../utils.js';
import { playSound } from '../audio.js';
import { showToast, triggerAwardEffects, triggerDynamicPraise, showWelcomeBackMessage } from './effects.js';
import { 
    handleAddClass, 
    handleAddStudent, 
    handleEditClass,
    handleSaveTeacherName,
    setStudentStarsForToday,
    handleAddStarsManually,
    handlePurgeStudentStars,
    handleSetStudentScores,
    handlePurgeAwardLogs,
    handleEraseTodaysStars,
    handleDeleteAwardLog,
    saveAwardNote,
    saveAdventureLogNote,
    handleLogAdventure,
    deleteAdventureLog,
    handleBulkSaveTrial, 
    handleSaveQuestAssignment,
    handleMarkAbsent,
    handleMoveStudent,
    handleEditStudentName,
    handleStarManagerStudentSelect,
    handleDeleteQuestEvent,
    handleAddOneTimeLesson,
    handleCancelLesson,
    handleEndStory,
    addOrUpdateHeroChronicleNote,
    deleteHeroChronicleNote
} from '../db/actions.js';
import { fetchLogsForMonth } from '../db/queries.js'; 

// --- MAIN UI EVENT LISTENERS SETUP ---

export function setupUIListeners() {
    document.body.addEventListener('click', (e) => {
       const heroStatsTrigger = e.target.closest('.hero-stats-avatar-trigger');
        if (heroStatsTrigger) {
            e.stopPropagation(); 
            const studentId = heroStatsTrigger.dataset.studentId;
            modals.openHeroStatsModal(studentId, heroStatsTrigger); 
            return;
        }
        handleAvatarClick(e);
        let target = e.target;
        while (target && target !== document.body) {
            if (target.classList && (target.classList.contains('bubbly-button') || target.classList.contains('about-tab-switcher'))) {
                if (!target.classList.contains('star-award-btn') && target.type !== 'submit') playSound('click');
                return;
            }
            target = target.parentNode;
        }
    });

    // Navigation
    document.getElementById('bottom-nav-bar').addEventListener('click', (e) => {
        const target = e.target.closest('.nav-button');
        if (target) {
            playSound('click'); 
            tabs.showTab(target.dataset.tab);
        }
    });
    document.getElementById('back-to-classes-btn').addEventListener('click', () => tabs.showTab('my-classes-tab'));

    // Auth
    document.getElementById('logout-btn').addEventListener('click', async () => {
        playSound('click');
        await signOut(auth);
    });

    // Home/About Tab
    const studentBtn = document.getElementById('about-btn-students');
    const teacherBtn = document.getElementById('about-btn-teachers');
    studentBtn.addEventListener('click', () => {
        document.getElementById('about-students').classList.remove('hidden');
        document.getElementById('about-teachers').classList.add('hidden');
        studentBtn.classList.add('bg-cyan-500', 'text-white', 'shadow-md');
        studentBtn.classList.remove('text-cyan-700', 'bg-white');
        teacherBtn.classList.remove('bg-green-500', 'text-white', 'shadow-md');
        teacherBtn.classList.add('text-green-700', 'bg-white');
    });
    teacherBtn.addEventListener('click', () => {
        document.getElementById('about-teachers').classList.remove('hidden');
        document.getElementById('about-students').classList.add('hidden');
        teacherBtn.classList.add('bg-green-500', 'text-white', 'shadow-md');
        teacherBtn.classList.remove('text-green-700', 'bg-white');
        studentBtn.classList.remove('bg-cyan-500', 'text-white', 'shadow-md');
        studentBtn.classList.add('text-cyan-700', 'bg-white');
    });

    // Modals & Pickers
    document.getElementById('modal-cancel-btn').addEventListener('click', () => modals.hideModal('confirmation-modal'));
    document.getElementById('leaderboard-league-picker-btn').addEventListener('click', () => modals.showLeaguePicker());
    document.getElementById('student-leaderboard-league-picker-btn').addEventListener('click', () => modals.showLeaguePicker());
    document.getElementById('league-picker-close-btn').addEventListener('click', () => modals.hideModal('league-picker-modal'));
    document.getElementById('logo-picker-btn').addEventListener('click', () => modals.showLogoPicker('create'));
    document.getElementById('edit-logo-picker-btn').addEventListener('click', () => modals.showLogoPicker('edit'));
    document.getElementById('logo-picker-close-btn').addEventListener('click', () => modals.hideModal('logo-picker-modal'));
    document.getElementById('hero-stats-close-btn').addEventListener('click', () => modals.hideModal('hero-stats-modal'));
    
    // Class & Student Management
    document.getElementById('add-class-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddClass(); });
    document.getElementById('generate-class-name-btn').addEventListener('click', modals.handleGenerateClassName);
    document.getElementById('class-name-suggestions').addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            document.getElementById('class-name').value = e.target.innerText;
            document.getElementById('class-name-suggestions').innerHTML = '';
        }
    });
    document.getElementById('class-level').addEventListener('change', () => { 
        document.getElementById('generate-class-name-btn').disabled = !document.getElementById('class-level').value; 
    });

    document.getElementById('add-student-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddStudent(); });
    document.getElementById('edit-class-form').addEventListener('submit', (e) => { e.preventDefault(); handleEditClass(); });
    document.getElementById('edit-class-cancel-btn').addEventListener('click', () => modals.hideModal('edit-class-modal'));
    document.getElementById('edit-student-name-cancel-btn').addEventListener('click', () => modals.hideModal('edit-student-name-modal'));
    document.getElementById('edit-student-name-confirm-btn').addEventListener('click', handleEditStudentName);

    // Calendar Logic
    const handleMonthChange = async (direction) => {
        const calDate = state.get('calendarCurrentDate');
        calDate.setMonth(calDate.getMonth() + direction);
        state.set('calendarCurrentDate', calDate);

        tabs.renderCalendarTab(); 

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        const isHistoricalView = calDate < thirtyDaysAgo;

        if (isHistoricalView) {
            const loader = document.getElementById('calendar-loader');
            if (loader) {
                loader.classList.remove('hidden');
                loader.classList.add('flex');
            }
            
            const year = calDate.getFullYear();
            const month = calDate.getMonth() + 1;
            const historicalLogs = await fetchLogsForMonth(year, month);
            
            tabs.populateCalendarStars(historicalLogs);
            
            if (loader) {
                loader.classList.add('hidden');
                loader.classList.remove('flex');
            }
        }
    };

    document.getElementById('prev-month-btn').addEventListener('click', () => handleMonthChange(-1));
    document.getElementById('next-month-btn').addEventListener('click', () => handleMonthChange(1));
    
    document.getElementById('calendar-grid').addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day-cell');
        const deleteBtn = e.target.closest('.delete-event-btn');
    
        if (deleteBtn) {
            e.stopPropagation();
            const eventId = deleteBtn.dataset.id;
            const eventName = deleteBtn.dataset.name;
            modals.showModal('Delete Event?', `Are you sure you want to delete the "${eventName}" event?`, () => handleDeleteQuestEvent(eventId));
            return;
        }
    
        if (!dayCell) return;
        
        const dateString = dayCell.dataset.date;
        const dayDate = utils.parseDDMMYYYY(dateString);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        if (dayCell.classList.contains('future-day')) {
            modals.openDayPlannerModal(dateString, dayCell);
        } else if (dayCell.classList.contains('logbook-day-btn')) {
            if (dayDate >= thirtyDaysAgo) {
                modals.showLogbookModal(dateString);
            } else {
                modals.showLogbookModal(dateString, true);
            }
        }
    });

    document.getElementById('day-planner-close-btn').addEventListener('click', () => modals.hideModal('day-planner-modal'));
    document.getElementById('day-planner-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.day-planner-tab-btn');
        if (btn) {
            modals.switchDayPlannerTab(btn.dataset.tab);
        }
    });
    document.getElementById('add-onetime-lesson-btn').addEventListener('click', () => {
        const dateString = document.getElementById('day-planner-modal').dataset.date;
        handleAddOneTimeLesson(dateString);
    });
    document.getElementById('quest-event-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddQuestEvent(); });
    document.getElementById('quest-event-type').addEventListener('change', modals.renderQuestEventDetails);
    
    // Logbook & History
    document.getElementById('logbook-modal-close-btn').addEventListener('click', () => modals.hideModal('logbook-modal'));
    document.getElementById('logbook-modal-content').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-log-btn');
        if (deleteBtn) {
            const { logId } = deleteBtn.dataset;
            modals.showModal('Delete Log Entry?', `Are you sure you want to delete this award? The student's score will be updated.`, () => {
                handleDeleteAwardLog(logId);
            });
        }
        const noteBtn = e.target.closest('.note-log-btn');
        if(noteBtn) {
            modals.openAwardNoteModal(noteBtn.dataset.logId);
        }
    });
    document.getElementById('class-history-btn').addEventListener('click', () => modals.openHistoryModal());
    document.getElementById('student-history-btn').addEventListener('click', () => modals.openHistoryModal());
    document.getElementById('history-modal-close-btn').addEventListener('click', () => modals.hideModal('history-modal'));
    document.getElementById('history-month-select').addEventListener('change', (e) => modals.renderHistoricalLeaderboard(e.target.value));

    // Get Quest Update button
    document.getElementById('get-quest-update-btn').addEventListener('click', handleGetQuestUpdate);

    // Award Stars Tab
    document.getElementById('award-class-dropdown-btn').addEventListener('click', () => {
        const panel = document.getElementById('award-class-dropdown-panel');
        const icon = document.querySelector('#award-class-dropdown-btn i');
        panel.classList.toggle('hidden');
        icon.classList.toggle('rotate-180');
    });
    document.getElementById('award-class-list').addEventListener('click', (e) => {
        const target = e.target.closest('.award-class-item');
        if (target) {
            playSound('click');
            state.setGlobalSelectedClass(target.dataset.id, true);
            const panel = document.getElementById('award-class-dropdown-panel');
            const icon = document.querySelector('#award-class-dropdown-btn i');
            panel.classList.add('hidden');
            icon.classList.remove('rotate-180');
        }
    });

    // --- AWARD STARS & ABSENCE HANDLING ---
    document.getElementById('award-stars-student-list').addEventListener('click', async (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const studentCard = actionBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            const student = state.get('allStudents').find(s => s.id === studentId);
            
            // --- CASE 1: MARK ABSENT (Explicit for Today) ---
            if (actionBtn.dataset.action === 'mark-absent') {
                playSound('click');
                await handleMarkAbsent(studentId, student.classId, true);
                return;
            }

            // --- CASE 2: MARK PRESENT (Explicit Undo or Implicit Override) ---
            if (actionBtn.dataset.action === 'mark-present') {
                playSound('click');
                const today = utils.getTodayDateString();
                const isMarkedAbsentToday = state.get('allAttendanceRecords').some(r => r.studentId === studentId && r.date === today);
                
                if (isMarkedAbsentToday) {
                    // It was an explicit absence for today. Just delete the record.
                    await handleMarkAbsent(studentId, student.classId, false);
                } else {
                    // Implicit Absence (from previous lesson).
                    // User wants to mark present but NOT give a bonus.
                    // We use 0 stars with a specific reason to signal "Present" to the UI logic.
                    await setStudentStarsForToday(studentId, 0, 'marked_present');
                    showToast(`${student.name} marked present.`, 'success');
                }
                return;
            }

            // --- CASE 3: WELCOME BACK (Implicit Absence Bonus) ---
            if (actionBtn.dataset.action === 'welcome-back') {
                // Awards bonus star(s) AND creates the today_stars entry
                const stars = Math.random() < 0.5 ? 0.5 : 1;
                const firstName = student.name.split(' ')[0];
                playSound('star2');
                
                try {
                    const publicDataPath = "artifacts/great-class-quest/public/data";
                    await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                        const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
                        
                        const scoreDoc = await transaction.get(scoreRef);
                        if (!scoreDoc.exists()) {
                             transaction.set(scoreRef, {
                                totalStars: stars, monthlyStars: stars,
                                lastMonthlyResetDate: utils.getStartOfMonthString(),
                                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                            });
                        } else {
                            transaction.update(scoreRef, {
                                totalStars: increment(stars),
                                monthlyStars: increment(stars)
                            });
                        }

                        const logData = {
                            studentId, classId: student.classId, teacherId: state.get('currentUserId'),
                            stars: stars, reason: 'welcome_back', date: utils.getTodayDateString(),
                            createdAt: serverTimestamp(), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                        };
                        transaction.set(newLogRef, logData);
                        
                        const todayStarsRef = doc(collection(db, `${publicDataPath}/today_stars`));
                        transaction.set(todayStarsRef, {
                             studentId, stars: stars, date: utils.getTodayDateString(), reason: 'welcome_back',
                             teacherId: state.get('currentUserId'), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                        });
                    });
                    
                    showWelcomeBackMessage(firstName, stars);

                } catch (error) {
                    console.error("Welcome back bonus transaction failed:", error);
                    showToast('Could not apply welcome back bonus. Please try again.', 'error');
                }
                
                return;
            }
        }
        
        const reasonBtn = e.target.closest('.reason-btn');
        const starBtn = e.target.closest('.star-award-btn');
        const undoBtn = e.target.closest('.post-award-undo-btn');

        if (undoBtn) {
            const studentId = undoBtn.closest('.student-cloud-card').dataset.studentid;
            setStudentStarsForToday(studentId, 0, null); 
            playSound('star_remove');
            tabs.updateAwardCardState(studentId, 0, null); 
            return;
        }

        if (reasonBtn) {
            const studentCard = reasonBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            
            if (state.get('todaysStars')[studentId]?.stars > 0) {
                showToast('Please use the undo button to change today\'s stars.', 'info');
                return;
            }

            const starSelector = studentCard.querySelector('.star-selector-container');
            const allReasonBtns = studentCard.querySelectorAll('.reason-btn');

            if (reasonBtn.classList.contains('active')) {
                reasonBtn.classList.remove('active');
                starSelector.classList.remove('visible');
            } else {
                allReasonBtns.forEach(btn => btn.classList.remove('active'));
                reasonBtn.classList.add('active');
                starSelector.classList.add('visible');
                reasonBtn.classList.add('animate-reason-select');
                const randomAngle = Math.random() * 2 * Math.PI;
                reasonBtn.style.setProperty('--x', `${Math.cos(randomAngle) * 60}px`);
                reasonBtn.style.setProperty('--y', `${Math.sin(randomAngle) * 60}px`);
                reasonBtn.addEventListener('animationend', () => {
                    reasonBtn.classList.remove('animate-reason-select');
                }, { once: true });
            }
            return;
        }

        if (starBtn) {
            const studentCard = starBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            const activeReasonBtn = studentCard.querySelector('.reason-btn.active');
            
            if (!activeReasonBtn) {
                 showToast('Please select a reason first!', 'info');
                 return;
            }

            const reason = activeReasonBtn.dataset.reason;
            const starValue = parseInt(starBtn.dataset.stars);
            const student = state.get('allStudents').find(s => s.id === studentId);

            triggerAwardEffects(starBtn, starValue);

            await setStudentStarsForToday(studentId, starValue, reason);
            triggerDynamicPraise(student.name, starValue, reason);
            
            tabs.updateAwardCardState(studentId, state.get('todaysStars')[studentId]?.stars || starValue, reason);
            
            return;
        }
    });

    // Options Tab
    document.getElementById('save-teacher-name-btn').addEventListener('click', (e) => { e.preventDefault(); handleSaveTeacherName(); });
    document.getElementById('star-manager-student-select').addEventListener('change', handleStarManagerStudentSelect);
    document.getElementById('star-manager-add-btn').addEventListener('click', handleAddStarsManually);
    document.getElementById('star-manager-purge-btn').addEventListener('click', handlePurgeStudentStars);
    document.getElementById('star-manager-override-btn').addEventListener('click', handleSetStudentScores);
    document.getElementById('purge-logs-btn').addEventListener('click', () => {
        modals.showModal('Purge All My Logs?', 'Are you sure you want to delete all your historical award log entries? This cannot be undone.', () => handlePurgeAwardLogs());
    });
    document.getElementById('erase-today-btn').addEventListener('click', () => {
        modals.showModal('Erase Today\'s Stars?', 'Are you sure you want to remove all stars you awarded today?', () => handleEraseTodaysStars());
    });

    // Leaderboard View Switchers
    document.getElementById('view-by-league').addEventListener('click', () => {
        state.set('studentLeaderboardView', 'league');
        tabs.renderStudentLeaderboardTab();
        document.getElementById('view-by-league').classList.add('bg-purple-500', 'text-white');
        document.getElementById('view-by-class').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('view-by-class').classList.add('bg-gray-300', 'text-gray-800');
    });
    document.getElementById('view-by-class').addEventListener('click', () => {
        state.set('studentLeaderboardView', 'class');
        tabs.renderStudentLeaderboardTab();
        document.getElementById('view-by-class').classList.add('bg-purple-500', 'text-white');
        document.getElementById('view-by-league').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('view-by-league').classList.add('bg-gray-300', 'text-gray-800');
    });
    document.getElementById('metric-monthly').addEventListener('click', () => {
        state.set('studentStarMetric', 'monthly');
        tabs.renderStudentLeaderboardTab();
        document.getElementById('metric-monthly').classList.add('bg-purple-500', 'text-white');
        document.getElementById('metric-total').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('metric-total').classList.add('bg-gray-300', 'text-gray-800');
    });
    document.getElementById('metric-total').addEventListener('click', () => {
        state.set('studentStarMetric', 'total');
        tabs.renderStudentLeaderboardTab();
        document.getElementById('metric-total').classList.add('bg-purple-500', 'text-white');
        document.getElementById('metric-monthly').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('metric-monthly').classList.add('bg-gray-300', 'text-gray-800');
    });

    // Adventure Log
    document.getElementById('adventure-log-class-select').addEventListener('change', (e) => {
        state.setGlobalSelectedClass(e.target.value, true);
        tabs.renderAdventureLogTab();
    });
    document.getElementById('adventure-log-month-filter').addEventListener('change', (e) => {
        state.get('currentLogFilter').month = e.target.value;
        tabs.renderAdventureLog();
    });
    document.getElementById('log-adventure-btn').addEventListener('click', handleLogAdventure);
    document.getElementById('quest-assignment-btn').addEventListener('click', modals.openQuestAssignmentModal);
    document.getElementById('adventure-log-feed').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.log-delete-btn');
        const noteBtn = e.target.closest('.log-note-btn');
        if (deleteBtn) {
            deleteAdventureLog(deleteBtn.dataset.logId);
        }
        if (noteBtn) {
            modals.openNoteModal(noteBtn.dataset.logId);
        }
    });
    document.getElementById('note-cancel-btn').addEventListener('click', () => modals.hideModal('note-modal'));
    document.getElementById('note-confirm-btn').addEventListener('click', saveAdventureLogNote);
    document.getElementById('award-note-cancel-btn').addEventListener('click', () => modals.hideModal('award-note-modal'));
    document.getElementById('award-note-confirm-btn').addEventListener('click', saveAwardNote);
    document.getElementById('quest-assignment-cancel-btn').addEventListener('click', () => modals.hideModal('quest-assignment-modal'));
    document.getElementById('quest-assignment-confirm-btn').addEventListener('click', handleSaveQuestAssignment);
    document.getElementById('attendance-chronicle-btn').addEventListener('click', modals.openAttendanceChronicle);
    document.getElementById('attendance-chronicle-close-btn').addEventListener('click', () => modals.hideModal('attendance-chronicle-modal'));
    
    // Scholar's Scroll
    document.getElementById('scroll-class-select').addEventListener('change', (e) => {
        state.setGlobalSelectedClass(e.target.value, true);
        scholarScroll.renderScholarsScrollTab(e.target.value);
    });
    
    // NEW: Replaced log-trial-btn listener to open the trial type modal via scholarScroll helper
    document.getElementById('log-trial-btn').addEventListener('click', () => scholarScroll.openTrialTypeModal(document.getElementById('scroll-class-select').value));
    
    // NEW: Bulk Save listener
    document.getElementById('bulk-trial-save-btn').addEventListener('click', handleBulkSaveTrial);
    document.getElementById('bulk-trial-close-btn').addEventListener('click', () => modals.hideModal('bulk-trial-modal'));
    document.getElementById('trial-type-cancel-btn').addEventListener('click', () => modals.hideModal('trial-type-modal'));
    
    document.getElementById('view-trial-history-btn').addEventListener('click', () => scholarScroll.openTrialHistoryModal(document.getElementById('scroll-class-select').value));
    document.getElementById('trial-history-close-btn').addEventListener('click', () => modals.hideModal('trial-history-modal'));
    document.getElementById('starfall-cancel-btn').addEventListener('click', () => modals.hideModal('starfall-modal'));
    
    // Idea Forge AI buttons
    document.getElementById('gemini-idea-btn').addEventListener('click', handleGenerateIdea);
    document.getElementById('copy-idea-btn').addEventListener('click', () => modals.copyToClipboard('gemini-idea-output'));
    document.getElementById('oracle-insight-btn').addEventListener('click', handleGetOracleInsight);
    
    // Story Weavers
    document.getElementById('story-weavers-class-select').addEventListener('change', (e) => {
        state.setGlobalSelectedClass(e.target.value, true);
        storyWeaver.handleStoryWeaversClassSelect();
    });
    document.getElementById('story-weavers-suggest-word-btn').addEventListener('click', storyWeaver.handleSuggestWord);
    document.getElementById('story-weavers-lock-in-btn').addEventListener('click', storyWeaver.openStoryInputModal);
    document.getElementById('story-weavers-end-btn').addEventListener('click', handleEndStory);
    document.getElementById('story-weavers-reveal-btn').addEventListener('click', storyWeaver.handleRevealStory);
    document.getElementById('story-weavers-history-btn').addEventListener('click', storyWeaver.handleShowStoryHistory);
    document.getElementById('story-weavers-archive-btn').addEventListener('click', storyWeaver.openStoryArchiveModal);
    document.getElementById('story-weavers-reset-btn').addEventListener('click', storyWeaver.handleResetStory);
    document.getElementById('story-reveal-close-btn').addEventListener('click', () => modals.hideModal('story-reveal-modal'));
    document.getElementById('story-history-close-btn').addEventListener('click', () => modals.hideModal('story-history-modal'));
    document.getElementById('story-archive-close-btn').addEventListener('click', () => modals.hideModal('story-archive-modal'));
    document.getElementById('storybook-viewer-close-btn').addEventListener('click', () => modals.hideModal('storybook-viewer-modal'));
    document.getElementById('story-archive-list').addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-storybook-btn');
        if (viewBtn) {
            storyWeaver.openStorybookViewer(viewBtn.dataset.storyId);
        }
    });
    document.getElementById('story-input-confirm-btn').addEventListener('click', storyWeaver.handleLockInSentence);
    document.getElementById('story-weavers-confirm-word-btn').addEventListener('click', confirmWord);
    document.getElementById('story-weavers-clear-word-btn').addEventListener('click', storyWeaver.resetStoryWeaverWordUI);
    document.getElementById('story-weavers-word-input').addEventListener('input', handleWordInputChange);

    // Avatar Maker
    document.getElementById('avatar-maker-close-btn').addEventListener('click', () => modals.hideModal('avatar-maker-modal'));
    document.getElementById('avatar-creature-pool').addEventListener('click', (e) => avatar.handleAvatarOptionSelect(e, 'creature'));
    document.getElementById('avatar-color-pool').addEventListener('click', (e) => avatar.handleAvatarOptionSelect(e, 'color'));
    document.getElementById('avatar-accessory-pool').addEventListener('click', (e) => avatar.handleAvatarOptionSelect(e, 'accessory'));
    document.getElementById('avatar-generate-btn').addEventListener('click', avatar.handleGenerateAvatar);
    document.getElementById('avatar-retry-btn').addEventListener('click', avatar.handleGenerateAvatar);
    document.getElementById('avatar-save-btn').addEventListener('click', avatar.handleSaveAvatar);
    document.getElementById('avatar-delete-btn').addEventListener('click', avatar.handleDeleteAvatar);

    // Move Student
    document.getElementById('move-student-confirm-btn').addEventListener('click', handleMoveStudent);
    document.getElementById('move-student-cancel-btn').addEventListener('click', () => modals.hideModal('move-student-modal'));

    // Ceremony Listeners
    document.getElementById('ceremony-veil-close-btn').addEventListener('click', ceremony.hideCeremonyVeil);
    document.getElementById('ceremony-exit-btn').addEventListener('click', ceremony.endCeremony);
    document.getElementById('ceremony-skip-btn').addEventListener('click', ceremony.skipCeremony);
    document.getElementById('ceremony-next-btn').addEventListener('click', ceremony.advanceCeremony);
    document.getElementById('ceremony-show-global-btn').addEventListener('click', ceremony.showGlobalLeaderboardModal);
    document.getElementById('global-leaderboard-close-btn').addEventListener('click', () => modals.hideModal('global-leaderboard-modal'));
    document.getElementById('start-ceremony-btn').addEventListener('click', ceremony.startCeremonyFromVeil);

    // Other Modals
    document.getElementById('report-modal-close-btn').addEventListener('click', () => modals.hideModal('report-modal'));
    document.getElementById('certificate-modal-close-btn').addEventListener('click', () => modals.hideModal('certificate-modal'));
    document.getElementById('quest-update-close-btn').addEventListener('click', () => modals.hideModal('quest-update-modal'));
    document.getElementById('milestone-modal-close-btn').addEventListener('click', () => modals.hideModal('milestone-details-modal'));
    document.getElementById('milestone-details-modal').addEventListener('click', (e) => {
        if (e.target.id === 'milestone-details-modal') {
            modals.hideModal('milestone-details-modal');
        }
    });
    document.getElementById('play-narrative-btn').addEventListener('click', modals.playNarrative);
    document.getElementById('download-certificate-btn').addEventListener('click', downloadCertificateAsPdf);
    document.getElementById('overview-modal-close-btn').addEventListener('click', () => modals.hideModal('overview-modal'));
    document.getElementById('overview-modal-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.overview-tab-btn');
        if (btn) {
            const classId = document.getElementById('overview-modal').dataset.classId;
            const view = btn.dataset.view;
            
            document.querySelectorAll('.overview-tab-btn').forEach(b => {
                b.classList.remove('border-purple-500', 'text-purple-600');
                b.classList.add('border-transparent', 'text-gray-500');
            });
            btn.classList.add('border-purple-500', 'text-purple-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
            
            modals.renderOverviewContent(classId, view);
        }
    });

    // Hero's Chronicle Modal Listeners
    document.getElementById('hero-chronicle-close-btn').addEventListener('click', () => modals.hideModal('hero-chronicle-modal'));
    document.getElementById('hero-chronicle-note-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = document.getElementById('hero-chronicle-modal').dataset.studentId;
        const noteId = document.getElementById('hero-chronicle-note-id').value;
        const noteText = document.getElementById('hero-chronicle-note-text').value;
        const category = document.getElementById('hero-chronicle-note-category').value;
        addOrUpdateHeroChronicleNote(studentId, noteText, category, noteId || null);
        modals.resetHeroChronicleForm();
    });
    document.getElementById('hero-chronicle-cancel-edit-btn').addEventListener('click', modals.resetHeroChronicleForm);
    document.getElementById('hero-chronicle-notes-feed').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-chronicle-note-btn');
        const deleteBtn = e.target.closest('.delete-chronicle-note-btn');
        if (editBtn) {
            modals.setupNoteForEditing(editBtn.dataset.noteId);
        }
        if (deleteBtn) {
            modals.showModal('Delete Note?', 'Are you sure you want to permanently delete this note?', () => {
                deleteHeroChronicleNote(deleteBtn.dataset.noteId);
            });
        }
    });
    document.querySelectorAll('.ai-insight-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const studentId = document.getElementById('hero-chronicle-modal').dataset.studentId;
            const insightType = e.currentTarget.dataset.type;
            modals.generateAIInsight(studentId, insightType);
        });
    });
}

// --- AVATAR ENLARGEMENT ---
function handleAvatarClick(e) {
    const avatar = e.target.closest('.enlargeable-avatar');
    if (e.target.closest('.enlarged-avatar-container')) return;
    const existingEnlarged = document.querySelector('.enlarged-avatar-container');
    if (existingEnlarged) existingEnlarged.click();
    if (avatar) {
        e.stopPropagation(); 
        const rect = avatar.getBoundingClientRect();
        const src = avatar.src;
        const container = document.createElement('div');
        container.className = 'enlarged-avatar-container';
        const clone = document.createElement('img');
        clone.src = src;
        clone.className = 'enlarged-avatar-image';
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        container.appendChild(clone);
        document.body.appendChild(container);
        requestAnimationFrame(() => {
            clone.style.top = `50%`;
            clone.style.left = `50%`;
            clone.style.width = `256px`;
            clone.style.height = `256px`;
            clone.style.transform = 'translate(-50%, -50%)';
            container.style.opacity = '1';
        });
        const closeHandler = () => {
            clone.style.top = `${rect.top}px`;
            clone.style.left = `${rect.left}px`;
            clone.style.width = `${rect.width}px`;
            clone.style.height = `${rect.height}px`;
            clone.style.transform = 'translate(0, 0)';
            container.style.opacity = '0';
            container.removeEventListener('click', closeHandler);
            setTimeout(() => container.remove(), 300);
        };
        container.addEventListener('click', closeHandler);
    }
}

// --- GLOBAL STATE SYNC FUNCTIONS ---
export function findAndSetCurrentClass() {
    if (state.get('globalSelectedClassId')) return;
    const todayString = utils.getTodayDateString();
    const classesToday = utils.getClassesOnDay(
        todayString, 
        state.get('allSchoolClasses'), 
        state.get('allScheduleOverrides')
    );
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    for (const c of myClassesToday) {
        if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
            state.setGlobalSelectedClass(c.id, false);
            return;
        }
    }
}

export function findAndSetCurrentLeague(shouldRender = true) {
    if (state.get('globalSelectedLeague')) return;
    const now = new Date();
    const currentDay = now.getDay().toString();
    const currentTime = now.toTimeString().slice(0, 5);
    for (const c of state.get('allTeachersClasses')) {
        if (c.scheduleDays && c.scheduleDays.includes(currentDay)) {
            if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
                state.setGlobalSelectedLeague(c.questLevel, false);
                if (shouldRender) {
                    tabs.renderClassLeaderboardTab();
                    tabs.renderStudentLeaderboardTab();
                }
                return;
            }
        }
    }
}

export function updateStudentCardAttendanceState(studentId, isAbsent) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;
    studentCard.classList.toggle('is-absent', isAbsent);
    const controlsDiv = studentCard.querySelector('.absence-controls');
    if (!controlsDiv) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const isLessonToday = (studentClass?.scheduleDays || []).includes(new Date().getDay().toString());
    const welcomeBackVisible = isAbsent && isLessonToday;
    if (isAbsent) {
        controlsDiv.innerHTML = `
            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Mark as Present">
                <i class="fas fa-user-check pointer-events-none"></i>
            </button>
            <button class="welcome-back-btn ${welcomeBackVisible ? '' : 'hidden'}" data-action="welcome-back" title="Welcome Back Bonus!">
                <i class="fas fa-hand-sparkles pointer-events-none"></i>
            </button>
        `;
    } else {
        controlsDiv.innerHTML = `
            <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                <i class="fas fa-user-slash pointer-events-none"></i>
            </button>
        `;
    }
}

function confirmWord() {
    const input = document.getElementById('story-weavers-word-input');
    const word = input.value.trim();
    if (word) {
        state.set('storyWeaverLockedWord', word);
        input.classList.add('bg-green-100', 'border-green-400', 'font-bold');
        document.getElementById('story-weavers-suggest-word-btn').disabled = true;
        document.getElementById('story-weavers-lock-in-btn').disabled = false;
        document.getElementById('story-weavers-end-btn').disabled = false;
        storyWeaver.hideWordEditorControls(true);
        playSound('confirm');
    }
}

function handleWordInputChange(event) {
    if (event.target.value.trim() !== '') {
        storyWeaver.showWordEditorControls();
    } else {
        storyWeaver.hideWordEditorControls();
    }
}
