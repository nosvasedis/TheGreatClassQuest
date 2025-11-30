// /ui/core.js

// --- IMPORTS ---
import * as state from '../state.js';
import { db, auth } from '../firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, collection, query, where, getDocs, runTransaction, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { handleAddHolidayRange, handleDeleteHolidayRange } from '../db/actions.js';

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

    // Shop Listeners
    const openShopBtn = document.getElementById('open-shop-btn');
    if (openShopBtn) {
        openShopBtn.addEventListener('click', openShopModal); // Direct function reference
    }
    
    const shopCloseBtn = document.getElementById('shop-close-btn');
    if (shopCloseBtn) {
        shopCloseBtn.addEventListener('click', () => modals.hideModal('shop-modal'));
    }
    
    const genShopBtn = document.getElementById('generate-shop-btn');
    if (genShopBtn) {
        genShopBtn.addEventListener('click', () => {
            // Use dynamic import only for the action, not the UI function
            import('../db/actions.js').then(a => a.handleGenerateShopStock());
        });
    }
    
    const shopStudentSelect = document.getElementById('shop-student-select');
    if (shopStudentSelect) {
        shopStudentSelect.addEventListener('change', (e) => {
            updateShopStudentDisplay(e.target.value);
        });
    }
    
    const shopItemsContainer = document.getElementById('shop-items-container');
    if (shopItemsContainer) {
        shopItemsContainer.addEventListener('click', (e) => {
            const buyBtn = e.target.closest('.shop-buy-btn');
            if (buyBtn) {
                const studentId = document.getElementById('shop-student-select').value;
                const itemId = buyBtn.dataset.id;
                import('../db/actions.js').then(a => a.handleBuyItem(studentId, itemId));
            }
        });
    }

    // Bounty Listeners
    const openBountyBtn = document.getElementById('open-bounty-modal-btn');
    if (openBountyBtn) {
        openBountyBtn.addEventListener('click', () => {
            const classId = state.get('globalSelectedClassId');
            if(!classId) { showToast('Select a class first', 'error'); return; }
            
            // 1. Setup ID
            document.getElementById('bounty-class-id').value = classId;
            
            // 2. Generate Smart Time Options
            const classData = state.get('allSchoolClasses').find(c => c.id === classId);
            const selectEl = document.getElementById('bounty-duration');
            selectEl.innerHTML = ''; // Clear old options
            
            const now = new Date();
            const scheduleDays = classData.scheduleDays || [];
            
            // Helper: Find the next N lesson end dates
            const upcomingLessons = [];
            
            // Safety break: check 60 days ahead max
            for (let i = 0; i < 60; i++) {
                const checkDate = new Date();
                checkDate.setDate(now.getDate() + i);
                const dayStr = checkDate.getDay().toString();
                
                if (scheduleDays.includes(dayStr)) {
                    // Set to End Time
                    if (classData.timeEnd) {
                        const [endH, endM] = classData.timeEnd.split(':').map(Number);
                        checkDate.setHours(endH, endM, 0, 0);
                    } else {
                        checkDate.setHours(17, 0, 0, 0); // Default 5 PM
                    }
                    
                    // Only add if it's in the future
                    if (checkDate > now) {
                        upcomingLessons.push(checkDate);
                    }
                }
                
                if (upcomingLessons.length >= 4) break;
            }

            if (upcomingLessons.length > 0) {
                const nextLesson = upcomingLessons[0];
                const isToday = nextLesson.toDateString() === now.toDateString();
                
                // OPTION A: "End of THIS Lesson" (Only if today is a lesson day and not over)
                if (isToday) {
                    const diffMins = Math.round((nextLesson - now) / 60000);
                    const opt = document.createElement('option');
                    opt.value = diffMins;
                    opt.innerText = `End of THIS Lesson (${diffMins} mins)`;
                    opt.selected = true; 
                    selectEl.appendChild(opt);
                }

                // OPTION B: "End of NEXT Lesson"
                // If today is active (isToday), the "Next" lesson is index 1.
                // If today is NOT active, the "Next" lesson is index 0.
                const nextIndex = isToday ? 1 : 0;
                
                if (upcomingLessons[nextIndex]) {
                    const targetDate = upcomingLessons[nextIndex];
                    const totalMins = Math.round((targetDate - now) / 60000);
                    const dayName = targetDate.toLocaleDateString('en-GB', { weekday: 'long' });
                    
                    const opt = document.createElement('option');
                    opt.value = totalMins;
                    opt.innerText = `Until End of NEXT Lesson (${dayName})`;
                    // If not in a lesson, make this the default
                    if (!isToday) opt.selected = true; 
                    selectEl.appendChild(opt);
                }

                // OPTION C: "End of 4th Lesson" (Epic Quest)
                // We want the 4th occurrence in the list (index 3).
                if (upcomingLessons[3]) {
                    const targetDate = upcomingLessons[3];
                    const totalMins = Math.round((targetDate - now) / 60000);
                    const dateStr = targetDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
                    
                    const opt = document.createElement('option');
                    opt.value = totalMins;
                    opt.innerText = `Epic Quest: End of 4th Lesson (${dateStr})`;
                    selectEl.appendChild(opt);
                }
            } else {
                // Fallback if no schedule is set
                const opt = document.createElement('option');
                opt.value = 1440;
                opt.innerText = "24 Hours (No Schedule Found)";
                selectEl.appendChild(opt);
            }

            modals.showAnimatedModal('create-bounty-modal');
        });
    }
    
    document.getElementById('create-bounty-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        import('../db/actions.js').then(a => a.handleCreateBounty());
    });
    
    document.getElementById('bounty-cancel-btn')?.addEventListener('click', () => modals.hideModal('create-bounty-modal'));
    
    // Global listener for dynamic bounty buttons (Claim/Delete)
    document.getElementById('bounty-board-container').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-bounty-btn');
        const claimBtn = e.target.closest('.claim-bounty-btn');
        
        if (deleteBtn) {
            import('../db/actions.js').then(a => a.handleDeleteBounty(deleteBtn.dataset.id));
        }
        if (claimBtn) {
            import('../db/actions.js').then(a => a.handleClaimBounty(claimBtn.dataset.id, null, claimBtn.dataset.reward));
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
                // Awards bonus star(s) ONLY to monthly/total
                // Marks today as present (0 stars) so card unlocks
                const stars = Math.random() < 0.5 ? 0.5 : 1;
                const firstName = student.name.split(' ')[0];
                playSound('star2');
                
                try {
                    const publicDataPath = "artifacts/great-class-quest/public/data";
                    await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                        const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
                        
                        // 1. Update Scores (Total/Monthly)
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

                        // 2. Log the Bonus
                        const logData = {
                            studentId, classId: student.classId, teacherId: state.get('currentUserId'),
                            stars: stars, reason: 'welcome_back', date: utils.getTodayDateString(),
                            createdAt: serverTimestamp(), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                        };
                        transaction.set(newLogRef, logData);
                        
                        // 3. Set Daily Record to 0 Stars (Present but Unlocked)
                        const todayStarsRef = doc(collection(db, `${publicDataPath}/today_stars`));
                        transaction.set(todayStarsRef, {
                             studentId, 
                             stars: 0, // Zero daily stars keeps card unlocked
                             date: utils.getTodayDateString(), 
                             reason: 'welcome_back',
                             teacherId: state.get('currentUserId'), 
                             createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
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

    document.getElementById('add-holiday-btn').addEventListener('click', handleAddHolidayRange);
    document.getElementById('holiday-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-holiday-btn');
    if (btn) {
        modals.showModal('Delete Holiday?', 'This will restore the calendar days.', () => handleDeleteHolidayRange(btn.dataset.id));
    }
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
    // Prevent closing if clicking the inventory itself
    if (e.target.closest('.inventory-container')) return; 
    
    // Close existing if open
    const existingEnlarged = document.querySelector('.enlarged-avatar-container');
    if (existingEnlarged) {
        existingEnlarged.click(); // Trigger close
    }

    if (avatar) {
        e.stopPropagation(); 
        
        // Find student data
        let studentId = null;
        // Try to find ID from parent elements
        const card = avatar.closest('[data-studentid], [data-id], .student-leaderboard-card');
        if (card) {
            studentId = card.dataset.studentid || card.dataset.id;
            // For leaderboard cards, finding ID is tricky if not set explicitly. 
            // Better to rely on the `img` dataset if we added it (we did in tabs.js: data-student-id)
        }
        if (!studentId && avatar.dataset.studentId) studentId = avatar.dataset.studentId;

        const rect = avatar.getBoundingClientRect();
        const src = avatar.src;
        
        const container = document.createElement('div');
        container.className = 'enlarged-avatar-container';
        
        // Wrapper for Layout
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'flex flex-col items-center gap-6 transform transition-all duration-300';
        contentWrapper.style.opacity = '0';
        
        const clone = document.createElement('img');
        clone.src = src;
        clone.className = 'enlarged-avatar-image';
        // Initial pos matches original
        clone.style.position = 'fixed'; // Initially fixed for animation
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.zIndex = '102';
        
        container.appendChild(clone);
        
        // INVENTORY UI
        let inventoryHtml = '';
        if (studentId) {
            const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
            const inventory = scoreData?.inventory || [];
            const gold = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);
            const student = state.get('allStudents').find(s => s.id === studentId);
            
            let itemsHtml = '';
            if (inventory.length > 0) {
                itemsHtml = inventory.map(item => `
                    <div class="relative group cursor-help">
                        <img src="${item.image}" class="w-16 h-16 rounded-lg border-2 border-amber-400 bg-black/50 shadow-lg transform group-hover:scale-110 transition-transform">
                        <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/90 text-white text-xs p-2 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center">
                            <strong class="text-amber-400 block mb-1">${item.name}</strong>
                            ${item.description}
                        </div>
                    </div>
                `).join('');
            } else {
                itemsHtml = `<p class="text-white/50 text-sm italic">No artifacts collected yet.</p>`;
            }

            inventoryHtml = `
                <div class="inventory-container bg-indigo-950/90 backdrop-blur-md p-6 rounded-3xl border-2 border-indigo-500 shadow-2xl max-w-2xl w-full mx-4 text-center mt-[300px] z-101 opacity-0 transition-opacity duration-500 delay-100">
                    <h3 class="font-title text-3xl text-white mb-1">${student?.name || 'Unknown'}'s Collection</h3>
                    <p class="text-amber-400 font-bold mb-4">${gold} Gold Coins</p>
                    <div class="flex flex-wrap justify-center gap-4">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }

        container.insertAdjacentHTML('beforeend', inventoryHtml);
        document.body.appendChild(container);

        // Animate
        requestAnimationFrame(() => {
            // Move Image to Center
            clone.style.top = `20%`;
            clone.style.left = `50%`;
            clone.style.width = `200px`;
            clone.style.height = `200px`;
            clone.style.transform = 'translate(-50%, -50%)';
            container.style.opacity = '1';
            
            const inv = container.querySelector('.inventory-container');
            if(inv) inv.style.opacity = '1';
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

export function renderHolidayList() {
    const list = document.getElementById('holiday-list');
    if (!list) return;
    const ranges = state.get('schoolHolidayRanges') || [];
    
    if (ranges.length === 0) {
        list.innerHTML = '<p class="text-center text-xs text-gray-400">No holidays set.</p>';
        return;
    }
    
    list.innerHTML = ranges.map(r => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm">
            <div>
                <span class="font-bold text-gray-700">${r.name}</span>
                <div class="text-xs text-gray-500">${utils.parseDDMMYYYY(utils.getDDMMYYYY(new Date(r.start))).toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${utils.parseDDMMYYYY(utils.getDDMMYYYY(new Date(r.end))).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</div>
            </div>
            <button class="delete-holiday-btn text-red-500 hover:text-red-700" data-id="${r.id}"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

// --- BOUNTY LOGIC ---

export function renderActiveBounties() {
    const container = document.getElementById('bounty-board-container');
    if (!container) return;

    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        container.innerHTML = '';
        return;
    }

    const bounties = state.get('allQuestBounties')
        .filter(b => b.classId === classId && b.status !== 'completed') // Hide completed ones to keep board clean
        .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

    if (bounties.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = bounties.map(b => {
        const now = new Date();
        const deadline = new Date(b.deadline);
        const isExpired = now > deadline;
        const progressPercent = Math.min(100, (b.currentProgress / b.target) * 100);
        const isReady = b.currentProgress >= b.target;

        let statusHtml = '';
        if (isExpired) statusHtml = `<span class="text-red-500 font-bold">EXPIRED</span>`;
        else if (isReady) statusHtml = `<button class="claim-bounty-btn bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-full bubbly-button animate-bounce" data-id="${b.id}" data-reward="${b.reward}">CLAIM REWARD</button>`;
        else statusHtml = `<span class="bounty-timer text-amber-600 font-bold" data-deadline="${b.deadline}">--:--</span>`;

        return `
            <div class="bounty-card mb-2 ${isExpired ? 'expired' : ''}">
                <div class="flex items-center gap-4 flex-grow">
                    <div class="text-3xl text-amber-500"><i class="fas fa-scroll"></i></div>
                    <div class="flex-grow">
                        <div class="flex justify-between items-center">
                            <h4 class="font-bold text-lg text-amber-900">${b.title}</h4>
                            <div class="bounty-actions text-right">
                                ${statusHtml}
                                <button class="delete-bounty-btn text-gray-400 hover:text-red-500 ml-2" data-id="${b.id}"><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                        <div class="w-full bg-amber-100 rounded-full h-3 mt-1 overflow-hidden">
                            <div class="bg-amber-500 h-full transition-all duration-1000" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="flex justify-between text-xs text-amber-700 mt-1 font-semibold">
                            <span>Progress: ${b.currentProgress} / ${b.target} ⭐</span>
                            <span>Reward: ${b.reward}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    startBountyTimer();
}

let bountyInterval;
function startBountyTimer() {
    if (bountyInterval) clearInterval(bountyInterval);
    
    const update = () => {
        const timers = document.querySelectorAll('.bounty-timer');
        if (timers.length === 0) { clearInterval(bountyInterval); return; }

        timers.forEach(el => {
            const deadline = new Date(el.dataset.deadline);
            const now = new Date();
            const diff = deadline - now;

            if (diff <= 0) {
                el.innerText = "00:00:00";
                el.classList.add('text-red-500');
                // Could trigger a reload here to mark visually as expired
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                el.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            }
        });
    };
    
    update();
    bountyInterval = setInterval(update, 1000);
}

// --- SHOP UI LOGIC ---

export function openShopModal() {
    // 1. Determine Context
    let league = state.get('globalSelectedLeague');
    let classId = state.get('globalSelectedClassId');

    // If viewing Hero Stats for a specific student, try to get their class/league
    if (!league && classId) {
        const cls = state.get('allTeachersClasses').find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    if (!league) {
        showToast("Please select a League or Class first to enter the correct market.", "error");
        return;
    }

    // 2. Set UI Text
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    document.getElementById('shop-title').innerText = "The Mystic Market"; // Title is now static
    document.getElementById('shop-month').innerText = monthName; // Month has its own element
    
    document.getElementById('shop-student-select').innerHTML = `<option value="">Select Shopper...</option>`;
    document.getElementById('shop-student-gold').innerText = "0 🪙";

    // 3. Filter Students (Only show MY students in this League)
    // FIX: Use 'allTeachersClasses' instead of 'allSchoolClasses'
    const myClassesInLeague = state.get('allTeachersClasses').filter(c => c.questLevel === league);
    const myClassIds = myClassesInLeague.map(c => c.id);
    
    const validStudents = state.get('allStudents')
        .filter(s => myClassIds.includes(s.classId))
        .sort((a,b) => a.name.localeCompare(b.name));

    const selectEl = document.getElementById('shop-student-select');
    selectEl.innerHTML = `<option value="">Select Shopper...</option>` + 
        validStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    renderShopUI();
    modals.showAnimatedModal('shop-modal');
}

export function renderShopUI() {
    const container = document.getElementById('shop-items-container');
    const emptyState = document.getElementById('shop-empty-state');
    
    // 1. Determine League Context again
    let league = state.get('globalSelectedLeague');
    if (!league) {
        const classId = state.get('globalSelectedClassId');
        const cls = state.get('allSchoolClasses').find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    // 2. Filter Items (By Month AND League)
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const shopItems = state.get('currentShopItems')
        .filter(i => i.monthKey === currentMonthKey && i.league === league)
        .sort((a,b) => a.price - b.price); // Sort cheapest first

    if (shopItems.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        container.classList.remove('hidden');
        
        container.innerHTML = shopItems.map(item => `
            <div class="shop-item-card group bg-indigo-900 border-2 border-indigo-700 rounded-2xl overflow-hidden hover:border-amber-400 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] flex flex-col">
                <div class="relative h-40 bg-white flex items-center justify-center overflow-hidden">
                    <div class="absolute inset-0 bg-radial-gradient from-white to-gray-100 opacity-50"></div>
                    <img src="${item.image}" class="relative w-full h-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-500">
                </div>
                <div class="p-4 flex-grow flex flex-col">
                    <h3 class="font-title text-xl text-amber-300 leading-tight mb-1">${item.name}</h3>
                    <p class="text-indigo-300 text-xs mb-3 line-clamp-2 flex-grow">${item.description}</p>
                    <div class="flex justify-between items-center mt-auto pt-3 border-t border-indigo-800">
                        <span class="font-bold text-white text-lg">${item.price} 🪙</span>
                        <button class="shop-buy-btn bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-500 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-4 rounded-lg uppercase tracking-wider transition-colors" data-id="${item.id}" disabled>
                            Select Student
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Re-run status check if a student is already selected
        const currentStudentId = document.getElementById('shop-student-select').value;
        if(currentStudentId) updateShopStudentDisplay(currentStudentId);
    }
}

export function updateShopStudentDisplay(studentId) {
    const goldDisplay = document.getElementById('shop-student-gold');
    const buyBtns = document.querySelectorAll('.shop-buy-btn');
    
    if (!studentId) {
        goldDisplay.innerText = "0 🪙";
        buyBtns.forEach(btn => {
            btn.disabled = true;
            btn.innerText = "Select Student";
            btn.classList.remove('bg-red-500', 'bg-green-600');
        });
        return;
    }

    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const gold = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);
    const inventory = scoreData?.inventory || [];
    
    // Check Monthly Limit
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const itemsBoughtThisMonth = inventory.filter(i => 
        i.acquiredAt && i.acquiredAt.startsWith(currentMonthKey)
    );
    const isLimitReached = itemsBoughtThisMonth.length >= 2;

    goldDisplay.innerText = `${gold} 🪙`;

    buyBtns.forEach(btn => {
        const itemPrice = parseInt(btn.previousElementSibling.innerText); 
        const itemId = btn.dataset.id;
        const alreadyOwned = inventory.some(i => i.id === itemId);

        // Reset classes
        btn.classList.remove('bg-green-600', 'bg-red-500');

        if (alreadyOwned) {
            btn.disabled = true;
            btn.innerText = "Owned";
            btn.classList.add('bg-green-600');
        } 
        else if (isLimitReached) {
            btn.disabled = true;
            btn.innerText = "Limit Reached (2/2)";
            btn.classList.add('bg-red-500');
        }
        else if (gold >= itemPrice) {
            btn.disabled = false;
            btn.innerText = "Buy Now";
        } 
        else {
            btn.disabled = true;
            btn.innerText = "Need Gold";
        }
    });
}
