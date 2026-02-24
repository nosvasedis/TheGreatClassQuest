// /ui/tabs/award.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { wrapAvatarWithLevelUpIndicator } from '../core/avatar.js';
import { getGuildBadgeHtml, getGuildById } from '../../features/guilds.js';

export function renderAwardStarsTab() {
    const dropdownList = document.getElementById('award-class-list');
    const studentListContainer = document.getElementById('award-stars-student-list');
    if (!dropdownList) return;

    const selectedClassId = state.get('globalSelectedClassId');
    const allTeachersClasses = state.get('allTeachersClasses');

    if (allTeachersClasses.length === 0) {
        dropdownList.innerHTML = '';
        document.getElementById('selected-class-name').innerText = 'No classes created';
        document.getElementById('selected-class-level').innerText = 'Create one in "My Classes"';
        document.getElementById('selected-class-logo').innerText = '😢';
        studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">You must create a class first.</p>`;
        return;
    }

    dropdownList.innerHTML = allTeachersClasses
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => `
        <div class="award-class-item flex items-center gap-3 p-3 hover:bg-rose-50 cursor-pointer" data-id="${c.id}">
            <span class="text-3xl">${c.logo}</span>
            <div class="text-left">
                <div class="font-bold text-md text-rose-800">${c.name}</div>
                <div class="text-xs text-rose-500 -mt-1">${c.questLevel}</div>
            </div>
        </div>
    `).join('');

    if (selectedClassId) {
        const selectedClass = allTeachersClasses.find(c => c.id === selectedClassId);
        if (selectedClass) {
            document.getElementById('selected-class-name').innerText = selectedClass.name;
            document.getElementById('selected-class-level').innerText = selectedClass.questLevel;
            document.getElementById('selected-class-logo').innerText = selectedClass.logo;
            renderAwardStarsStudentList(selectedClassId);
        } else {
            // Class might have been deleted but ID still in localStorage
            document.getElementById('selected-class-name').innerText = 'Select a class...';
            document.getElementById('selected-class-level').innerText = '';
            document.getElementById('selected-class-logo').innerText = '❓';
            studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
        }
    } else {
        document.getElementById('selected-class-name').innerText = 'Select a class...';
        document.getElementById('selected-class-level').innerText = '';
        document.getElementById('selected-class-logo').innerText = '❓';
        studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
    }
}

export function renderAwardStarsStudentList(selectedClassId, fullRender = true) {
    const listContainer = document.getElementById('award-stars-student-list');
    if (!listContainer) return;

    const renderContent = () => {
        if (!selectedClassId) {
            listContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
            return;
        }

        let studentsInClass = state.get('allStudents').filter(s => s.classId === selectedClassId);

        if (fullRender) {
            for (let i = studentsInClass.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [studentsInClass[i], studentsInClass[j]] = [studentsInClass[j], studentsInClass[i]];
            }
        }

        if (studentsInClass.length === 0) {
            listContainer.innerHTML = `<p class="text-sm text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl col-span-full">No students in this class. Add some in "My Classes"!</p>`;
        } else {
            const previousLessonDate = utils.getPreviousLessonDate(selectedClassId, state.get('allSchoolClasses'));
            const today = utils.getTodayDateString();

            const cloudShapes = ['cloud-shape-1', 'cloud-shape-2', 'cloud-shape-3', 'cloud-shape-4'];

            // --- 1. PRE-CALCULATE BOON ELIGIBILITY ---
            const allScores = state.get('allStudentScores');
            // Map students to scores
            const leaderboard = studentsInClass.map(s => {
                const sc = allScores.find(score => score.id === s.id);
                return { id: s.id, stars: sc ? (Number(sc.monthlyStars) || 0) : 0 };
            });
            // Sort ascending (Lowest stars first)
            leaderboard.sort((a, b) => a.stars - b.stars);
            // Identify Bottom 3 IDs
            const bottomThreeIds = leaderboard.slice(0, 3).map(x => x.id);
            // Identify Ties
            const scoreCounts = {};
            leaderboard.forEach(x => { scoreCounts[x.stars] = (scoreCounts[x.stars] || 0) + 1; });

            listContainer.innerHTML = studentsInClass.map((s, index) => {
                const reigningHero = state.get('reigningHero');
                const isReigningHero = reigningHero && reigningHero.id === s.id;
                const scoreData = state.get('allStudentScores').find(score => score.id === s.id) || {};
                const totalStars = scoreData.totalStars || 0;
                const goldCount = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);
                const monthlyStars = scoreData.monthlyStars || 0;
                const starsToday = state.get('todaysStars')[s.id]?.stars || 0;
                const reasonToday = state.get('todaysStars')[s.id]?.reason;
                const cloudShape = cloudShapes[index % cloudShapes.length];

                const isMarkedAbsentToday = state.get('allAttendanceRecords').some(r => r.studentId === s.id && r.date === today);
                const wasAbsentLastTime = previousLessonDate && state.get('allAttendanceRecords').some(r => r.studentId === s.id && r.date === previousLessonDate);

                const isPresentToday = starsToday > 0 || reasonToday === 'marked_present' || reasonToday === 'welcome_back';
                const isVisuallyAbsent = isMarkedAbsentToday || (wasAbsentLastTime && !isPresentToday);
                const isCardLocked = starsToday > 0 && reasonToday !== 'welcome_back';

                let absenceButtonHtml = '';

                if (isVisuallyAbsent) {
                    if (isMarkedAbsentToday) {
                        absenceButtonHtml = `
                            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Undo: Mark as Present">
                                <i class="fas fa-user-check pointer-events-none"></i>
                            </button>`;
                    } else {
                        absenceButtonHtml = `
                            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Mark as Present">
                                <i class="fas fa-user-check pointer-events-none"></i>
                            </button>
                            <button class="welcome-back-btn" data-action="welcome-back" title="Welcome Back Bonus!">
                                <i class="fas fa-hand-sparkles pointer-events-none"></i>
                            </button>`;
                    }
                }
                else {
                    if (!isCardLocked) {
                        absenceButtonHtml = `
                            <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                                <i class="fas fa-user-slash pointer-events-none"></i>
                            </button>`;
                    }
                }

                const avatarInner = s.avatar
                    ? `<img src="${s.avatar}" alt="${s.name}" class="student-avatar-cloud enlargeable-avatar">`
                    : `<div class="student-avatar-cloud-placeholder">${s.name.charAt(0)}</div>`;
                const avatarHtml = wrapAvatarWithLevelUpIndicator(avatarInner, !!scoreData.pendingSkillChoice);
                const guildBadgeHtml = s.guildId
                    ? `<div class="award-guild-emblem ${getGuildById(s.guildId) ? `guild-tone-${s.guildId}` : ''}">${getGuildBadgeHtml(s.guildId, 'w-9 h-9')}</div>`
                    : '';

                const coinHtml = `
                  <div class="coin-pill ${starsToday > 0 ? 'animate-glitter' : ''}" title="Current Gold">
                      <i class="fas fa-coins text-yellow-400"></i>
                      <span id="student-gold-display-${s.id}">${goldCount}</span>
                  </div>
                `;

                // --- BOON BUTTON VISUAL LOGIC ---
                // Check eligibility based on the pre-calculated leaderboard
                const myLeaderboardData = leaderboard.find(x => x.id === s.id);
                const isEligible = bottomThreeIds.includes(s.id) || (myLeaderboardData && scoreCounts[myLeaderboardData.stars] > 1);

                let boonBtnHtml = '';
                if (isEligible) {
                    boonBtnHtml = `
                    <button class="boon-btn absolute top-2 left-14 w-8 h-8 rounded-full bg-rose-100 text-rose-500 hover:bg-rose-200 transition-colors shadow-sm border border-rose-200 z-30" 
                            data-receiver-id="${s.id}" title="Bestow Hero's Boon">
                        <i class="fas fa-heart"></i>
                    </button>`;
                } else {
                    // Visually disabled state (Greyed out)
                    boonBtnHtml = `
                    <button class="boon-btn absolute top-2 left-14 w-8 h-8 rounded-full bg-gray-100 text-gray-300 border border-gray-200 z-30 cursor-not-allowed opacity-60" 
                            data-receiver-id="${s.id}" title="Not eligible for Boon">
                        <i class="fas fa-heart-broken"></i>
                    </button>`;
                }

                return `
               <div class="student-cloud-card ${cloudShape} ${isVisuallyAbsent ? 'is-absent' : ''} ${isReigningHero ? 'reigning-hero-card' : ''}" data-studentid="${s.id}" style="animation: float-card ${4 + Math.random() * 4}s ease-in-out infinite;">
               ${isReigningHero ? '<div class="hero-crown-badge">👑</div>' : ''}
               <div class="absence-controls">
               ${absenceButtonHtml}
                    </div>
                    <div class="award-avatar-stack">
                        ${avatarHtml}
                        ${guildBadgeHtml}
                    </div>
                    ${coinHtml} 
                    ${boonBtnHtml}
                    <button id="post-award-undo-${s.id}" class="post-award-undo-btn bubbly-button ${starsToday > 0 ? '' : 'hidden'}" title="Undo Award"><i class="fas fa-times"></i></button>
                    
                    <div class="card-content-wrapper">
                        <h3 class="font-title text-2xl text-gray-800 text-center">
                            <span class="text-sm opacity-70 block mb-1">
                                ${s.heroClass && HERO_CLASSES[s.heroClass] ? HERO_CLASSES[s.heroClass].icon : ''} ${s.heroClass || ''}
                            </span>
                            ${s.name}
                        </h3>
                        <div class="flex gap-2 text-center justify-center items-center p-2">
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-pink-300 rounded-full shadow-md border-b-4 border-pink-400 text-pink-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">TODAY</span>
                                <span class="font-title text-3xl" id="today-stars-${s.id}">${starsToday}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-yellow-300 rounded-full shadow-md border-b-4 border-yellow-400 text-yellow-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">MONTH</span>
                                <span class="font-title text-3xl" id="monthly-stars-${s.id}">${monthlyStars}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-cyan-300 rounded-full shadow-md border-b-4 border-cyan-400 text-cyan-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">TOTAL</span>
                                <span class="font-title text-3xl" id="total-stars-${s.id}">${totalStars}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                        </div>
                        <div class="reason-selector flex justify-center items-center gap-2 ${isCardLocked ? 'pointer-events-none opacity-50' : ''}">
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-purple-200" data-reason="teamwork" title="Teamwork"><i class="fas fa-users text-purple-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-pink-200" data-reason="creativity" title="Creativity"><i class="fas fa-lightbulb text-pink-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-green-200" data-reason="respect" title="Respect"><i class="fas fa-hands-helping text-green-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-yellow-200" data-reason="focus" title="Focus/Effort"><i class="fas fa-brain text-yellow-600 pointer-events-none"></i></button>
                        </div>
                        <div class="star-selector-container flex items-center justify-center space-x-2">
                            <button data-stars="1" class="star-award-btn star-btn-1"><i class="fas fa-star"></i></button>
                            <button data-stars="2" class="star-award-btn star-btn-2"><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
                            <button data-stars="3" class="star-award-btn star-btn-3"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    };

    if (fullRender) {
        listContainer.classList.remove('fade-in');
        listContainer.classList.add('fade-out');
        setTimeout(() => {
            renderContent();
            listContainer.classList.remove('fade-out');
            listContainer.classList.add('fade-in');
        }, 300);
    } else {
        renderContent();
    }
}

export function updateStudentCardAttendanceState(studentId, isAbsent) {
    const selectedClassId = state.get('globalSelectedClassId');
    const student = state.get('allStudents').find(s => s.id === studentId);

    if (student && student.classId === selectedClassId) {
        const activeTab = document.querySelector('.app-tab:not(.hidden)');
        if (activeTab && activeTab.id === 'award-stars-tab') {
            renderAwardStarsStudentList(selectedClassId, false);
        }
    }
}

export function updateAwardCardState(studentId, starsToday, reason) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;

    const todayStarsEl = studentCard.querySelector(`#today-stars-${studentId}`);
    if (todayStarsEl && todayStarsEl.textContent != starsToday) {
        todayStarsEl.textContent = starsToday;
        const bubble = todayStarsEl.closest('.counter-bubble');
        if (bubble) {
            bubble.classList.add('counter-animate');
            setTimeout(() => bubble.classList.remove('counter-animate'), 500);
        }
    }

    const undoBtn = studentCard.querySelector(`#post-award-undo-${studentId}`);
    const reasonSelector = studentCard.querySelector('.reason-selector');
    const starSelector = studentCard.querySelector('.star-selector-container');
    const absenceControls = studentCard.querySelector('.absence-controls');

    // Logic: Card locks ONLY if stars > 0 AND the reason is NOT 'welcome_back'
    const shouldLock = starsToday > 0 && reason !== 'welcome_back';

    if (shouldLock) {
        undoBtn?.classList.remove('hidden');
        reasonSelector?.classList.add('pointer-events-none', 'opacity-50');
        starSelector?.classList.remove('visible');
        reasonSelector?.querySelectorAll('.reason-btn.active').forEach(b => b.classList.remove('active'));
    } else {
        // If not locked (either 0 stars OR welcome_back), enable controls
        undoBtn?.classList.add('hidden'); // Hide general undo
        reasonSelector?.classList.remove('pointer-events-none', 'opacity-50');
    }

    // If we have 0 stars (unlocked), we are present, so remove absent visual
    // (Unless we are specifically marked absent, but this function usually runs after awarding stars)
    if (starsToday >= 0) {
        studentCard.classList.remove('is-absent');
        if (absenceControls) {
            // Re-render controls to show "Mark Absent" again
            absenceControls.innerHTML = `
                <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                    <i class="fas fa-user-slash pointer-events-none"></i>
                </button>
            `;
        }
    }
}
