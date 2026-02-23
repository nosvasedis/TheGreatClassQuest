// /ui/core/listeners.js

// --- IMPORTS ---
import * as state from '../../state.js';
import { db, auth } from '../../firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, collection, query, where, getDocs, runTransaction, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { handleAddHolidayRange, handleDeleteHolidayRange } from '../../db/actions.js';
import { setupHomeListeners } from '../../features/home.js';

import * as modals from '../modals.js';
import {
    handleGetQuestUpdate,
    downloadCertificateAsPdf,
    openAppInfoModal
} from '../modals.js';
import * as tabs from '../tabs.js';
import * as scholarScroll from '../../features/scholarScroll.js';
import * as storyWeaver from '../../features/storyWeaver.js';
import * as avatar from '../../features/avatar.js';
import * as ceremony from '../../features/ceremony.js';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { showToast, triggerAwardEffects, triggerDynamicPraise, showWelcomeBackMessage, createFloatingHearts } from '../effects.js';
import { openShopModal, updateShopStudentDisplay } from './shop.js';
import { confirmWord, handleWordInputChange } from './misc.js';
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
    handleStarManagerStudentSelect,
    handleAddQuestEvent,
    handleDeleteQuestEvent,
    handleAddOneTimeLesson,
    handleCancelLesson,
    handleEndStory,
    addOrUpdateHeroChronicleNote,
    deleteHeroChronicleNote
} from '../../db/actions.js';
import { fetchLogsForMonth } from '../../db/queries.js';
import { handleBestowBoon } from '../../features/boons.js';
import { handleAvatarClick } from './avatar.js';

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

    // Modals & Pickers
    document.getElementById('modal-cancel-btn').addEventListener('click', () => modals.hideModal('confirmation-modal'));
    document.getElementById('leaderboard-league-picker-btn').addEventListener('click', () => modals.showLeaguePicker());
    document.getElementById('student-leaderboard-league-picker-btn').addEventListener('click', () => modals.showLeaguePicker());
    document.getElementById('league-picker-close-btn').addEventListener('click', () => modals.hideModal('league-picker-modal'));
    document.getElementById('logo-picker-btn').addEventListener('click', () => modals.showLogoPicker('create'));
    document.getElementById('edit-logo-picker-btn').addEventListener('click', () => modals.showLogoPicker('edit'));
    document.getElementById('logo-picker-close-btn').addEventListener('click', () => modals.hideModal('logo-picker-modal'));
    if (modals.wireSortingQuizResultDone) modals.wireSortingQuizResultDone();
    document.getElementById('hero-stats-close-btn').addEventListener('click', () => modals.hideModal('hero-stats-modal'));
    document.getElementById('hall-of-heroes-btn').addEventListener('click', modals.openHallOfHeroes);

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

    document.getElementById('add-student-toggle-btn').addEventListener('click', () => {
        const panel = document.getElementById('add-student-panel');
        const isNowVisible = panel.classList.toggle('hidden');
        if (!isNowVisible) document.getElementById('student-name').focus();
    });

    document.getElementById('add-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddStudent();
        // Auto-collapse the panel on success (input will be empty after a successful add)
        if (!document.getElementById('student-name').value) {
            document.getElementById('add-student-panel').classList.add('hidden');
        }
    });
    document.getElementById('edit-class-form').addEventListener('submit', (e) => { e.preventDefault(); handleEditClass(); });
    document.getElementById('edit-class-cancel-btn').addEventListener('click', () => modals.hideModal('edit-class-modal'));
    document.getElementById('edit-student-cancel-btn').addEventListener('click', () => modals.hideModal('edit-student-modal'));
    document.getElementById('edit-student-confirm-btn').addEventListener('click', () => {
        import('../../db/actions.js').then(actions => actions.handleSaveStudentDetails());
    });
    document.getElementById('lookup-nameday-btn').addEventListener('click', () => {
        import('../../db/actions.js').then(actions => actions.handleLookupNameday());
    });

    // Calendar Logic: On-Demand Loading
    const handleMonthChange = async (direction) => {
        const calDate = state.get('calendarCurrentDate');
        calDate.setMonth(calDate.getMonth() + direction);
        state.set('calendarCurrentDate', calDate);

        // 1. Check if we moved to a past month
        const now = new Date();
        const isCurrentMonth = calDate.getMonth() === now.getMonth() && calDate.getFullYear() === now.getFullYear();
        const isFuture = calDate > now;

        // 2. Clear grid and show loading state immediately
        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.innerHTML = '<div class="col-span-7 h-64 flex flex-col items-center justify-center text-gray-500"><i class="fas fa-spinner fa-spin text-3xl mb-2 text-indigo-500"></i><p>Traveling through time...</p></div>';
        }

        // 3. Data Retrieval Strategy
        let logsForView = [];

        if (isCurrentMonth || isFuture) {
            // A. Current Month: Use the Real-Time State (Already loaded on app start)
            logsForView = state.get('allAwardLogs');

            // Re-render immediately
            import('../tabs.js').then(m => m.renderCalendarTab(logsForView));

        } else {
            // B. Past Month: Fetch On Demand (Save Reads)
            const year = calDate.getFullYear();
            const month = calDate.getMonth() + 1;

            try {
                // Import query dynamically
                const { fetchLogsForMonth: fetchLogs } = await import('../../db/queries.js');
                logsForView = await fetchLogs(year, month);

                // Render with fetched data
                import('../tabs.js').then(m => m.renderCalendarTab(logsForView));

            } catch (error) {
                console.error("History fetch failed:", error);
                if (grid) grid.innerHTML = '<div class="col-span-7 text-center text-red-500 p-4">Could not load history.</div>';
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

    // NEW: Mark School Holiday Button
    document.getElementById('day-planner-mark-holiday-btn').addEventListener('click', () => {
        const dateString = document.getElementById('day-planner-modal').dataset.date;
        modals.showModal(
            'Mark School Holiday?',
            `<p class="mb-4">Are you sure you want to mark <b>${dateString}</b> as a School Holiday?</p>
            <p class="text-sm text-red-600 font-bold">This will cancel ALL classes for this day and adjust monthly goals accordingly.</p>`,
            () => {
                import('../../db/actions.js').then(actions => {
                    actions.handleRemoveAttendanceColumn(null, dateString, true);
                    modals.hideModal('day-planner-modal');
                    const currentTab = document.querySelector('.app-tab:not(.hidden)');
                    if (currentTab && currentTab.id === 'calendar-tab') {
                        import('../tabs.js').then(t => t.renderCalendarTab());
                    }
                });
            },
            'Confirm Holiday'
        );
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
        if (noteBtn) {
            modals.openAwardNoteModal(noteBtn.dataset.logId);
        }
    });
    document.getElementById('class-history-btn').addEventListener('click', () => modals.openHistoryModal('team'));
    document.getElementById('student-history-btn').addEventListener('click', modals.openStudentRankingsModal);
    document.getElementById('history-modal-close-btn').addEventListener('click', () => modals.hideModal('history-modal'));
    document.getElementById('history-month-select').addEventListener('change', (e) => {
        const type = document.getElementById('history-modal').dataset.historyType;
        modals.renderHistoricalLeaderboard(e.target.value, type);
    });

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

    // Boon Modal Listeners
    document.getElementById('boon-cancel-btn').addEventListener('click', () => modals.hideModal('bestow-boon-modal'));
    document.getElementById('boon-confirm-btn').addEventListener('click', (e) => {
        const modal = document.getElementById('bestow-boon-modal');
        const receiverId = modal.dataset.receiverId;
        const senderId = document.getElementById('boon-sender-select').value;

        if (senderId && receiverId) {
            playSound('star3');
            createFloatingHearts(e.clientX, e.clientY);

            const sender = state.get('allStudents').find(s => s.id === senderId);
            const receiver = state.get('allStudents').find(s => s.id === receiverId);

            modals.showBoonConfirmationModal(sender, receiver, () => {
                import('../../features/boons.js').then(m => {
                    m.handleBestowBoon(senderId, receiverId);
                    modals.hideModal('bestow-boon-modal');
                });
            });
        }
    });

    // Shop Listeners
    const openShopBtn = document.getElementById('open-shop-btn');
    if (openShopBtn) {
        openShopBtn.addEventListener('click', openShopModal); // Direct function reference
    }

    // --- Prodigy Button Listener ---
    const openProdigyBtn = document.getElementById('open-prodigy-btn');
    if (openProdigyBtn) {
        openProdigyBtn.addEventListener('click', modals.openProdigyModal);
    }
    document.getElementById('prodigy-close-btn').addEventListener('click', () => modals.hideModal('prodigy-modal'));
    document.getElementById('prodigy-class-select').addEventListener('change', (e) => {
        modals.renderProdigyHistory(e.target.value);
    });

    const shopCloseBtn = document.getElementById('shop-close-btn');
    if (shopCloseBtn) {
        shopCloseBtn.addEventListener('click', () => modals.hideModal('shop-modal'));
    }

    // Trophy Room
    const openTrophyRoomBtn = document.getElementById('open-trophy-room-btn');
    if (openTrophyRoomBtn) {
        openTrophyRoomBtn.addEventListener('click', () => modals.openTrophyRoomModal());
    }
    const trophyRoomCloseBtn = document.getElementById('trophy-room-close-btn');
    if (trophyRoomCloseBtn) {
        trophyRoomCloseBtn.addEventListener('click', () => modals.hideModal('trophy-room-modal'));
    }
    const trophyRoomStudentSelect = document.getElementById('trophy-room-student-select');
    if (trophyRoomStudentSelect) {
        trophyRoomStudentSelect.addEventListener('change', (e) => {
            modals.renderTrophyRoomContent(e.target.value);
        });
    }

    const genShopBtn = document.getElementById('generate-shop-btn');
    if (genShopBtn) {
        genShopBtn.addEventListener('click', () => {
            // Use dynamic import only for the action, not the UI function
            import('../../db/actions.js').then(a => a.handleGenerateShopStock());
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
                const itemType = buyBtn.dataset.type;
                if (itemType === 'familiar') {
                    import('../../db/actions/economy.js').then(a => a.handleBuyFamiliarEgg(studentId, itemId));
                } else {
                    import('../../db/actions.js').then(a => a.handleBuyItem(studentId, itemId));
                }
            }
        });
    }

    // Bounty Listeners
    const openBountyBtn = document.getElementById('open-bounty-modal-btn');
    if (openBountyBtn) {
        openBountyBtn.addEventListener('click', () => {
            const classId = state.get('globalSelectedClassId');
            if (!classId) { showToast('Select a class first', 'error'); return; }

            document.getElementById('bounty-class-id').value = classId;

            // --- SMART OPTIONS GENERATOR ---
            const smartContainer = document.getElementById('bounty-smart-options');
            if (smartContainer) {
                smartContainer.innerHTML = '';

                const classData = state.get('allSchoolClasses').find(c => c.id === classId);
                const now = new Date();

                // 1. Standard Presets
                [5, 10, 20, 45].forEach(min => {
                    smartContainer.innerHTML += `<button type="button" class="smart-time-btn bg-white border border-indigo-200 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors" data-mins="${min}">${min}m</button>`;
                });

                // 2. "End of Lesson" Logic
                if (classData && classData.timeEnd) {
                    const [endH, endM] = classData.timeEnd.split(':').map(Number);
                    const endDate = new Date();
                    endDate.setHours(endH, endM, 0);

                    if (endDate > now) {
                        const diffMins = Math.floor((endDate - now) / 60000);
                        if (diffMins > 0 && diffMins < 180) {
                            smartContainer.innerHTML += `<button type="button" class="smart-time-btn bg-indigo-100 border border-indigo-300 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors" data-mins="${diffMins}">End of Lesson (${diffMins}m)</button>`;
                        }
                    }
                }

                // Click Handler for Presets
                smartContainer.querySelectorAll('.smart-time-btn').forEach(btn => {
                    btn.onclick = () => {
                        document.getElementById('bounty-timer-minutes').value = btn.dataset.mins;
                        document.getElementById('bounty-timer-end').value = '';
                    };
                });
            }

            modals.showAnimatedModal('create-bounty-modal');
        });
    }

    // --- TOGGLE LOGIC ---
    const bStars = document.getElementById('bounty-mode-stars');
    const bTimer = document.getElementById('bounty-mode-timer');
    const inputStars = document.getElementById('bounty-inputs-stars');
    const inputTimer = document.getElementById('bounty-inputs-timer');
    const bType = document.getElementById('bounty-type');
    const bSubmit = document.getElementById('bounty-submit-btn');

    if (bStars && bTimer) {
        bStars.addEventListener('click', () => {
            bStars.className = "flex-1 py-2 rounded-md text-sm font-bold bg-white text-amber-600 shadow-sm transition-all";
            bTimer.className = "flex-1 py-2 rounded-md text-sm font-bold text-gray-500 hover:text-gray-700 transition-all";
            inputStars.classList.remove('hidden');
            inputTimer.classList.add('hidden');
            bType.value = 'standard';
            bSubmit.className = "w-2/3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-xl bubbly-button shadow-lg";
            bSubmit.innerHTML = "Start Quest";
        });

        bTimer.addEventListener('click', () => {
            bTimer.className = "flex-1 py-2 rounded-md text-sm font-bold bg-white text-red-600 shadow-sm transition-all";
            bStars.className = "flex-1 py-2 rounded-md text-sm font-bold text-gray-500 hover:text-gray-700 transition-all";
            inputStars.classList.add('hidden');
            inputTimer.classList.remove('hidden');
            bType.value = 'timer';
            bSubmit.className = "w-2/3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-3 rounded-xl bubbly-button shadow-lg";
            bSubmit.innerHTML = "Start Timer";
        });
    }

    // --- FORM SUBMIT HANDLER (Crucial to prevent reload) ---
    document.getElementById('create-bounty-form')?.addEventListener('submit', (e) => {
        e.preventDefault(); // <--- THIS STOPS THE RELOAD
        import('../../db/actions.js').then(a => a.handleCreateBounty());
    });

    document.getElementById('bounty-cancel-btn')?.addEventListener('click', () => modals.hideModal('create-bounty-modal'));

    // Global listener for dynamic bounty buttons (Claim/Delete)
    document.getElementById('bounty-board-container').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-bounty-btn');
        const claimBtn = e.target.closest('.claim-bounty-btn');

        if (deleteBtn) {
            import('../../db/actions.js').then(a => a.handleDeleteBounty(deleteBtn.dataset.id));
        }
        if (claimBtn) {
            import('../../db/actions.js').then(a => a.handleClaimBounty(claimBtn.dataset.id, null, claimBtn.dataset.reward));
        }
    });

    // --- AWARD STARS & ABSENCE HANDLING ---
    document.getElementById('award-stars-student-list').addEventListener('click', async (e) => {

        const boonBtn = e.target.closest('.boon-btn');
        if (boonBtn) {
            e.stopPropagation();
            const receiverId = boonBtn.dataset.receiverId;
            // NEW: Open the nice modal instead of prompt
            modals.openBestowBoonModal(receiverId);
            return;
        }

        // 1. Define all targets first (to prevent "null" errors)
        const actionBtn = e.target.closest('[data-action]');
        const undoBtn = e.target.closest('.post-award-undo-btn');
        const reasonBtn = e.target.closest('.reason-btn');
        const starBtn = e.target.closest('.star-award-btn');

        // 2. Handle Action Buttons (Absent, Present, Welcome Back)
        if (actionBtn) {
            const studentCard = actionBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            const student = state.get('allStudents').find(s => s.id === studentId);

            // --- CASE 1: MARK ABSENT ---
            if (actionBtn.dataset.action === 'mark-absent') {
                playSound('click');
                await handleMarkAbsent(studentId, student.classId, true);
                return;
            }

            // --- CASE 2: MARK PRESENT ---
            if (actionBtn.dataset.action === 'mark-present') {
                playSound('click');
                const today = utils.getTodayDateString();
                const isMarkedAbsentToday = state.get('allAttendanceRecords').some(r => r.studentId === studentId && r.date === today);

                if (isMarkedAbsentToday) {
                    await handleMarkAbsent(studentId, student.classId, false);
                } else {
                    await setStudentStarsForToday(studentId, 0, 'marked_present');
                    showToast(`${student.name} marked present.`, 'success');
                }
                return;
            }

            // --- CASE 3: WELCOME BACK ---
            // --- CASE 3: WELCOME BACK (Escalated) ---
            if (actionBtn.dataset.action === 'welcome-back') {
                const studentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
                const firstName = student.name.split(' ')[0];
                playSound('star2');

                // 1. Calculate Streak of Missed Lessons
                let missedLessons = 0;
                const scheduleDays = studentClass.scheduleDays || [];
                const attendanceRecords = state.get('allAttendanceRecords');

                // Look back up to 30 days
                for (let i = 1; i <= 30; i++) {
                    let checkDate = new Date();
                    checkDate.setDate(checkDate.getDate() - i);
                    const checkDateString = utils.getDDMMYYYY(checkDate);

                    // If it was a scheduled day
                    if (scheduleDays.includes(checkDate.getDay().toString())) {
                        const wasAbsent = attendanceRecords.some(r => r.studentId === studentId && r.date === checkDateString);
                        if (wasAbsent) {
                            missedLessons++;
                        } else {
                            // Found a day present (or no record), streak ends
                            // But check if it was cancelled? Assuming simple logic for now.
                            // If user wasn't marked absent, streak breaks.
                            break;
                        }
                    }
                }

                // 2. Determine Bonus
                let stars = 0.5;
                if (missedLessons === 1) {
                    // Random 0.5 or 1.0
                    stars = Math.random() > 0.5 ? 1.0 : 0.5;
                } else if (missedLessons === 2) {
                    stars = 1.5;
                } else if (missedLessons >= 3) {
                    stars = 2.0;
                }

                console.log(`Student missed ${missedLessons} lessons. Awarding ${stars} stars.`);

                try {
                    const publicDataPath = "artifacts/great-class-quest/public/data";
                    await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                        const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));

                        // Update Scores
                        const scoreDoc = await transaction.get(scoreRef);
                        if (!scoreDoc.exists()) {
                            transaction.set(scoreRef, {
                                totalStars: stars, monthlyStars: stars, gold: stars,
                                lastMonthlyResetDate: utils.getStartOfMonthString(),
                                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                            });
                        } else {
                            transaction.update(scoreRef, {
                                totalStars: increment(stars),
                                monthlyStars: increment(stars),
                                gold: increment(stars)
                            });
                        }

                        // Create Log
                        const logData = {
                            studentId, classId: student.classId, teacherId: state.get('currentUserId'),
                            stars: stars, reason: 'welcome_back', date: utils.getTodayDateString(),
                            createdAt: serverTimestamp(), createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                        };
                        transaction.set(newLogRef, logData);

                        // Unlock card
                        const todayStarsRef = doc(collection(db, `${publicDataPath}/today_stars`));
                        transaction.set(todayStarsRef, {
                            studentId, stars: 0, date: utils.getTodayDateString(), reason: 'welcome_back',
                            teacherId: state.get('currentUserId'),
                            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                        });
                    });

                    showWelcomeBackMessage(firstName, stars);

                } catch (error) {
                    console.error("Welcome back bonus failed:", error);
                    showToast('Could not apply welcome back bonus.', 'error');
                }
                return;
            }
        }

        // 3. Handle Undo Button
        if (undoBtn) {
            const studentId = undoBtn.closest('.student-cloud-card').dataset.studentid;
            setStudentStarsForToday(studentId, 0, null);
            playSound('star_remove');
            tabs.updateAwardCardState(studentId, 0, null);
            return;
        }

        // 4. Handle Reason Selection Buttons
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

                // Dynamic sparkle animation position
                const randomAngle = Math.random() * 2 * Math.PI;
                reasonBtn.style.setProperty('--x', `${Math.cos(randomAngle) * 60}px`);
                reasonBtn.style.setProperty('--y', `${Math.sin(randomAngle) * 60}px`);

                reasonBtn.addEventListener('animationend', () => {
                    reasonBtn.classList.remove('animate-reason-select');
                }, { once: true });
            }
            return;
        }

        // 5. Handle Star Award Buttons (with Birthday/Nameday Logic)
        if (starBtn) {
            const studentCard = starBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            const activeReasonBtn = studentCard.querySelector('.reason-btn.active');

            if (!activeReasonBtn) {
                showToast('Please select a reason first!', 'info');
                return;
            }

            const student = state.get('allStudents').find(s => s.id === studentId);
            const cls = state.get('allSchoolClasses').find(c => c.id === student.classId);
            const schedule = cls?.scheduleDays || [];

            // --- STANDARD AWARD LOGIC ---
            // (This only runs if it's NOT a special occasion, or if the bonus was already given today)
            const reason = activeReasonBtn.dataset.reason;
            const starValue = parseInt(starBtn.dataset.stars);

            triggerAwardEffects(starBtn, starValue);

            await setStudentStarsForToday(studentId, starValue, reason);
            triggerDynamicPraise(student.name, starValue, reason);

            tabs.updateAwardCardState(studentId, state.get('todaysStars')[studentId]?.stars || starValue, reason);

            // --- BIRTHDAY CHECK ---
            if (utils.isSpecialOccasion(student.birthday, schedule)) {
                const todayLogs = state.get('allAwardLogs').filter(l => l.studentId === studentId && l.date === utils.getTodayDateString() && l.note && l.note.includes('Birthday'));

                if (todayLogs.length === 0) {
                    // Trigger Modal
                    document.getElementById('celebration-title').innerText = "Happy Birthday!";
                    document.getElementById('celebration-message').innerHTML = `It's <b>${student.name}'s</b> birthday! Wish them well?`;
                    document.getElementById('celebration-points').innerText = "2.5";

                    const btn = document.getElementById('celebration-award-btn');
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);

                    newBtn.onclick = () => {
                        import('../../db/actions.js').then(a => a.handleSpecialOccasionBonus(studentId, 'birthday'));
                    };

                    document.getElementById('celebration-cancel-btn').onclick = () => modals.hideModal('celebration-bonus-modal');
                    modals.showAnimatedModal('celebration-bonus-modal');
                    return; // STOP standard award logic
                }
            }

            // --- NAMEDAY CHECK ---
            if (utils.isSpecialOccasion(student.nameday, schedule)) {
                const todayLogs = state.get('allAwardLogs').filter(l => l.studentId === studentId && l.date === utils.getTodayDateString() && l.note && l.note.includes('Nameday'));

                if (todayLogs.length === 0) {
                    // Trigger Modal
                    document.getElementById('celebration-title').innerText = "Happy Nameday!";
                    document.getElementById('celebration-message').innerHTML = `It's <b>${student.name}'s</b> Name Day! Wish them well?`;
                    document.getElementById('celebration-points').innerText = "1.5";

                    const btn = document.getElementById('celebration-award-btn');
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);

                    newBtn.onclick = () => {
                        import('../../db/actions.js').then(a => a.handleSpecialOccasionBonus(studentId, 'nameday'));
                    };

                    document.getElementById('celebration-cancel-btn').onclick = () => modals.hideModal('celebration-bonus-modal');
                    modals.showAnimatedModal('celebration-bonus-modal');
                    return; // STOP standard award logic
                }
            }

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

    // --- Economy Manager Listeners ---
    const ecoSelect = document.getElementById('economy-student-select');
    if (ecoSelect) {
        ecoSelect.addEventListener('change', (e) => {
            const studentId = e.target.value;
            const btn = document.getElementById('save-gold-btn');
            const input = document.getElementById('economy-gold-input');

            if (studentId) {
                const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
                // Default to totalStars if gold is undefined
                const currentGold = scoreData && scoreData.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
                input.value = currentGold;
                btn.disabled = false;
            } else {
                input.value = '';
                btn.disabled = true;
            }
        });
    }

    const saveGoldBtn = document.getElementById('save-gold-btn');
    if (saveGoldBtn) {
        saveGoldBtn.addEventListener('click', () => {
            // Import dynamically to ensure actions.js is loaded
            import('../../db/actions.js').then(a => a.handleManualGoldUpdate());
        });
    }

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

    // Ceremony Listeners (New System handled via Home Tab Pill)
    document.getElementById('global-leaderboard-close-btn').addEventListener('click', () => modals.hideModal('global-leaderboard-modal'));

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

    // Initialize Home/Info Listeners
    setupHomeListeners();
    // Hero Celebration Modal
    const heroCelebrationCloseBtn = document.getElementById('hero-celebration-close-btn');
    if (heroCelebrationCloseBtn) {
        heroCelebrationCloseBtn.addEventListener('click', () => {
            modals.hideModal('hero-celebration-modal');
        });
    }

    // Skill Tree Modal close
    const skillTreeCloseBtn = document.getElementById('skill-tree-close-btn');
    if (skillTreeCloseBtn) {
        skillTreeCloseBtn.addEventListener('click', () => modals.hideModal('skill-tree-modal'));
    }
    // Close on backdrop click
    document.getElementById('skill-tree-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('skill-tree-modal')) modals.hideModal('skill-tree-modal');
    });
}
