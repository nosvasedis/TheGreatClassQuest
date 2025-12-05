// /features/ceremony.js

import { db } from '../firebase.js';
import { updateDoc, doc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../state.js';
import { playSound, ceremonyMusic, winnerFanfare, showdownSting, fadeCeremonyMusic, stopAllCeremonyAudio, playCeremonyMusic, playDrumRoll, stopDrumRoll, playWinnerFanfare } from '../audio.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import * as utils from '../utils.js';

// --- LOCAL STATE ---
let ceremonyData = {
    active: false,
    phase: 'intro', 
    monthKey: null,
    monthName: '',
    classId: null,
    league: null,
    classQueue: [], 
    studentQueue: [], 
    classPointer: 0, 
    studentPointer: 0 
};

// --- HELPER: Title Formatter (Fixes Emoji Gradient Issue) ---
function formatTitleHtml(text) {
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;
    const parts = text.split(emojiRegex);
    return parts.map(part => {
        if (part.match(emojiRegex)) {
            return `<span class="emoji-reset">${part}</span>`;
        } else if (part.trim().length > 0) {
            return `<span class="gradient-text">${part}</span>`;
        }
        return '';
    }).join('');
}

// --- 1. STATUS & INITIALIZATION ---

export function updateCeremonyStatus() {
    const teamQuestBtn = document.querySelector('.nav-button[data-tab="class-leaderboard-tab"]');
    const heroChallengeBtn = document.querySelector('.nav-button[data-tab="student-leaderboard-tab"]');
    
    if (!teamQuestBtn || !heroChallengeBtn) return;
    
    teamQuestBtn.classList.remove('ceremony-ready-pulse');
    heroChallengeBtn.classList.remove('ceremony-ready-pulse');

    const currentClassId = state.get('globalSelectedClassId');
    if (!currentClassId) return;

    const classData = state.get('allSchoolClasses').find(c => c.id === currentClassId);
    if (!classData) return;

    const now = new Date();
    const prevDate = new Date();
    prevDate.setMonth(now.getMonth() - 1);
    
    const monthKey = prevDate.toISOString().substring(0, 7); 

    const history = classData.ceremonyHistory || {};
    const isComplete = history[monthKey] && history[monthKey].complete;
    const currentMonthKey = now.toISOString().substring(0, 7);
    
    if (!isComplete && monthKey !== currentMonthKey) {
        teamQuestBtn.classList.add('ceremony-ready-pulse');
        heroChallengeBtn.classList.add('ceremony-ready-pulse');
    }
}

export async function checkAndInitCeremony(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return null;

    const now = new Date();
    const prevDate = new Date();
    prevDate.setMonth(now.getMonth() - 1);
    
    const monthKey = prevDate.toISOString().substring(0, 7); 
    const monthName = prevDate.toLocaleString('en-GB', { month: 'long' });

    const history = classData.ceremonyHistory || {};
    if (history[monthKey] && history[monthKey].complete) {
        return null; 
    }

    if (monthKey === now.toISOString().substring(0, 7)) return null; 

    return {
        monthKey,
        monthName,
        classId: classData.id,
        league: classData.questLevel
    };
}

export function startCeremony(params) {
    ceremonyData = {
        active: true,
        phase: 'intro',
        monthKey: params.monthKey,
        monthName: params.monthName,
        classId: params.classId,
        league: params.league,
        classQueue: [],
        studentQueue: [],
        classPointer: 0,
        studentPointer: 0
    };

    const screen = document.getElementById('ceremony-screen');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const actionBtn = document.getElementById('ceremony-action-btn');
    const stage = document.getElementById('ceremony-stage-area');
    const aiBox = document.getElementById('ceremony-ai-box');

    screen.classList.remove('hidden');
    stage.innerHTML = '';
    aiBox.style.opacity = '0';
    
    title.innerHTML = formatTitleHtml("The Great Class Quest");
    subtitle.innerHTML = formatTitleHtml(`${params.monthName} Ceremony`);
    actionBtn.innerText = "Begin Ceremony";
    actionBtn.onclick = loadDataAndAdvance;

    if (ceremonyMusic.loaded) {
        ceremonyMusic.volume.value = -12; 
        ceremonyMusic.start();
    }
    
    aiBox.style.opacity = '1';
    document.getElementById('ceremony-ai-text').innerText = "Welcome! The scrolls are ready...";
    triggerAICommentary('intro', { month: params.monthName });
}

// --- 2. DATA LOADING ---

async function loadDataAndAdvance() {
    const btn = document.getElementById('ceremony-action-btn');
    btn.disabled = true;
    btn.innerText = "Summoning Scrolls...";

    try {
        const [year, month] = ceremonyData.monthKey.split('-').map(Number);
        
        // 1. Fetch Logs
        const logs = await fetchLogsForMonth(year, month);
        const monthlyScores = {}; 
        logs.forEach(log => {
            monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
        });

        // 2. PREPARE CLASSES
        const allClasses = state.get('allSchoolClasses').filter(c => c.questLevel === ceremonyData.league);
        const overrides = state.get('allScheduleOverrides') || [];
        const ranges = state.get('schoolHolidayRanges') || [];
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthStart = new Date(year, month - 1, 1);

        let globalHolidayDays = 0;
        ranges.forEach(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < new Date(year, month, 0) ? end : new Date(year, month, 0);
            if (overlapStart <= overlapEnd) {
                const diffTime = Math.abs(overlapEnd - overlapStart);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                globalHolidayDays += diffDays;
            }
        });

        let classScores = allClasses.map(c => {
            const students = state.get('allStudents').filter(s => s.classId === c.id);
            const score = students.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0);
            
            const classCancellations = overrides.filter(o => {
                if (o.classId !== c.id || o.type !== 'cancelled') return false;
                const oDate = utils.parseDDMMYYYY(o.date); 
                return oDate.getMonth() === (month - 1) && oDate.getFullYear() === year;
            }).length;

            const totalDaysLost = globalHolidayDays + classCancellations;
            let monthModifier = (daysInMonth - totalDaysLost) / daysInMonth;
            if (month === 6) monthModifier = 0.5; 
            else monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));

            let historicalDifficulty = c.difficultyLevel || 0;
            if (c.questCompletedAt) {
                const completedDate = c.questCompletedAt.toDate();
                completedDate.setHours(0,0,0,0);
                if (completedDate >= monthStart) {
                    historicalDifficulty = Math.max(0, historicalDifficulty - 1);
                }
            }

            const BASE_GOAL = 18;
            const SCALING_FACTOR = 1.5;
            const adjustedGoalPerStudent = (BASE_GOAL + (historicalDifficulty * SCALING_FACTOR)) * monthModifier;
            const goal = Math.max(18, Math.round(students.length * adjustedGoalPerStudent));
            
            const progress = (score / goal) * 100;

            return { 
                ...c, score, goal, progress, 
                level: historicalDifficulty + 1,
                studentCount: students.length 
            };
        });

        classScores.sort((a, b) => {
            if (Math.abs(a.progress - b.progress) > 0.01) return b.progress - a.progress;
            return b.score - a.score;
        });

        let cRank = 1;
        classScores = classScores.map((c, i) => {
            if (i > 0) {
                const prev = classScores[i-1];
                if (Math.abs(c.progress - prev.progress) > 0.01) cRank = i + 1;
            }
            return { ...c, rank: cRank };
        });

        ceremonyData.classQueue = classScores.reverse(); 

        // 3. PREPARE STUDENTS
        const studentsInClass = state.get('allStudents').filter(s => s.classId === ceremonyData.classId);
        const allWrittenScores = state.get('allWrittenScores'); 

        let studentStats = studentsInClass.map(s => {
            const sLogs = logs.filter(l => l.studentId === s.id);
            const score = monthlyScores[s.id] || 0;
            let count3 = 0, count2 = 0;
            const reasons = new Set();
            sLogs.forEach(l => {
                if (l.stars >= 3) count3++;
                else if (l.stars >= 2) count2++;
                if (l.reason) reasons.add(l.reason);
            });

            const sScores = allWrittenScores.filter(sc => {
                if(sc.studentId !== s.id || !sc.date) return false;
                const d = utils.parseFlexibleDate(sc.date);
                return d && d.getMonth() === (month - 1) && d.getFullYear() === year;
            });
            let acadSum = 0;
            sScores.forEach(sc => {
                if (sc.scoreNumeric !== null && sc.maxScore) acadSum += (sc.scoreNumeric/sc.maxScore)*100;
                else if (sc.scoreQualitative === 'Great!!!') acadSum += 100;
                else if (sc.scoreQualitative === 'Great!!') acadSum += 75;
            });
            const academicAvg = sScores.length > 0 ? acadSum / sScores.length : 0;

            return {
                id: s.id,
                name: s.name,
                avatar: s.avatar,
                score,
                stats: { count3, count2, academicAvg, uniqueReasons: reasons.size }
            };
        });

        studentStats.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;
            if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;
            if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
            return b.stats.academicAvg - a.stats.academicAvg;
        });

        let sRank = 1;
        studentStats = studentStats.map((s, i) => {
            if (i > 0) {
                const prev = studentStats[i-1];
                let isTie = s.score === prev.score && 
                            s.stats.count3 === prev.stats.count3 && 
                            s.stats.count2 === prev.stats.count2 &&
                            s.stats.uniqueReasons === prev.stats.uniqueReasons;
                if (sRank > 3) isTie = isTie && (Math.abs(s.stats.academicAvg - prev.stats.academicAvg) < 0.1);
                if (!isTie) sRank = i + 1;
            }
            return { ...s, rank: sRank };
        });

        ceremonyData.studentQueue = studentStats.reverse();
        ceremonyData.phase = 'class_reveal';
        advanceCeremony();

    } catch (e) {
        console.error("Ceremony Load Error:", e);
        btn.innerText = "Error loading. Check connection.";
    }
}

// --- 3. THE "CONVEYOR BELT" ENGINE ---

function advanceCeremony() {
    const btn = document.getElementById('ceremony-action-btn');
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const aiBox = document.getElementById('ceremony-ai-box');
    const subtitle = document.getElementById('ceremony-subtitle');

    btn.disabled = false;
    btn.onclick = advanceCeremony; 

    // --- PHASE 1: CLASSES ---
    if (ceremonyData.phase === 'class_reveal') {
        const queue = ceremonyData.classQueue;
        
        if (!queue || queue.length === 0) {
            ceremonyData.phase = 'transition';
            advanceCeremony();
            return;
        }

        if (queue.length === 1) {
            stage.innerHTML = '';
            renderCard(queue[0], 'class');
            title.innerHTML = formatTitleHtml("The Champion");
            ceremonyData.phase = 'transition';
            btn.innerText = "See Student Heroes";
            return;
        }

        const pointer = ceremonyData.classPointer;

        if (pointer >= queue.length - 2) {
            ceremonyData.phase = 'class_showdown'; 
            const silver = queue[queue.length - 2];
            const gold = queue[queue.length - 1];
            setupShowdown(silver, gold, 'The Final Duel', 'Two legends remain...');
            btn.innerText = "🥁 Drumroll...";
            btn.onclick = handleDramaticReveal;
            return;
        }

        const entry = queue[pointer];
        stage.innerHTML = '';
        renderCard(entry, 'class');
        
        title.innerHTML = formatTitleHtml(`Rank #${entry.rank}`);
        subtitle.innerHTML = formatTitleHtml("Team Quest");
        aiBox.style.opacity = '1';
        
        triggerAICommentary('class_rank', { name: entry.name, rank: entry.rank, score: entry.score, progress: entry.progress.toFixed(0) });

        ceremonyData.classPointer++;
        btn.innerText = "Next";
    }

    // --- PHASE 1.5: CLASS SHOWDOWN DONE ---
    else if (ceremonyData.phase === 'class_showdown_done') {
        ceremonyData.phase = 'transition';
        advanceCeremony();
    }

    // --- PHASE 2: TRANSITION ---
    else if (ceremonyData.phase === 'transition') {
        stopAllCeremonyAudio();
        setTimeout(() => { playCeremonyMusic(); }, 500);

        stage.innerHTML = `<div class="text-white text-center animate-pulse"><i class="fas fa-user-astronaut text-9xl mb-4"></i><h2 class="font-title text-5xl">Hero's Challenge</h2></div>`;
        title.innerHTML = formatTitleHtml("Individual Honors");
        subtitle.innerHTML = formatTitleHtml("Who went above and beyond?");
        aiBox.style.opacity = '0';
        triggerAICommentary('transition', {});
        
        btn.innerText = "Begin Hero Reveal";
        ceremonyData.phase = 'student_reveal';
    }
        
    // --- PHASE 3: STUDENTS ---
    else if (ceremonyData.phase === 'student_reveal') {
        const queue = ceremonyData.studentQueue;
        
        if (!queue || queue.length === 0) {
            ceremonyData.phase = 'final_leaderboard';
            advanceCeremony();
            return;
        }

        if (queue.length === 1) {
            stage.innerHTML = '';
            renderCard(queue[0], 'student');
            title.innerHTML = formatTitleHtml("Class Hero");
            ceremonyData.phase = 'final_leaderboard';
            btn.innerText = "See Full Results";
            return;
        }

        const pointer = ceremonyData.studentPointer;

        if (pointer >= queue.length - 2) {
            ceremonyData.phase = 'student_showdown';
            const silver = queue[queue.length - 2];
            const gold = queue[queue.length - 1];
            setupShowdown(silver, gold, 'Top Heroes', 'Two legends remain...');
            btn.innerText = "Crown the Champion";
            btn.onclick = handleDramaticReveal;
            return;
        }

        const entry = queue[pointer];
        stage.innerHTML = '';
        renderCard(entry, 'student');
        
        let rankText = `#${entry.rank}`;
        if (entry.rank === 3) rankText = "🥉 Bronze";
        
        title.innerHTML = formatTitleHtml(`${rankText} Place`);
        subtitle.innerHTML = formatTitleHtml("Hero's Challenge");
        
        aiBox.style.opacity = '1';
        
        let winReason = "";
        if (pointer > 0) {
            const prevEntry = queue[pointer - 1];
            if (entry.score === prevEntry.score && entry.rank < prevEntry.rank) {
                if (entry.stats.count3 > prevEntry.stats.count3) winReason = "tie_3star";
                else if (entry.stats.count2 > prevEntry.stats.count2) winReason = "tie_2star";
                else if (entry.stats.academicAvg > prevEntry.stats.academicAvg) winReason = "tie_academic";
                else if (entry.stats.uniqueReasons > prevEntry.stats.uniqueReasons) winReason = "tie_variety";
            }
        }

        triggerAICommentary('student_rank', { 
            name: entry.name, 
            rank: entry.rank, 
            score: entry.score,
            tieReason: winReason 
        });

        ceremonyData.studentPointer++;
        btn.innerText = "Next";
    }

    // --- PHASE 3.5: STUDENT SHOWDOWN DONE ---
    else if (ceremonyData.phase === 'student_showdown_done') {
        ceremonyData.phase = 'final_leaderboard';
        // Auto-advance to render the board immediately
        advanceCeremony(); 
    }

    // --- PHASE 3.6: FINAL LEADERBOARD (NEW) ---
    else if (ceremonyData.phase === 'final_leaderboard') {
        stage.innerHTML = '';
        renderFinalLeaderboard();
        
        title.innerHTML = formatTitleHtml("Final Standings");
        subtitle.innerHTML = formatTitleHtml("A glorious month for everyone!");
        aiBox.style.opacity = '0'; // Hide AI box to focus on list
        
        btn.innerText = "Finish Ceremony";
        ceremonyData.phase = 'end';
    }

    // --- PHASE 4: END ---
    else if (ceremonyData.phase === 'end') {
        saveCeremonyComplete();
        
        stage.innerHTML = `
            <div class="text-center">
                <h2 class="font-title text-6xl text-white mb-4">Congratulations!</h2>
                <p class="text-2xl text-indigo-200">A new quest begins...</p>
                <div class="mt-8 text-8xl animate-bounce">🎓</div>
            </div>
        `;
        title.innerHTML = formatTitleHtml("Ceremony Complete");
        subtitle.innerHTML = formatTitleHtml("Until next time..."); 
        aiBox.style.opacity = '0';
        triggerAICommentary('outro', {});
        btn.innerText = "Close";
        btn.onclick = closeCeremony;
        
        triggerConfetti();
        triggerFireworks();
        if (winnerFanfare.loaded) winnerFanfare.start();
    }
}

// --- 4. RENDERERS ---

function renderCard(entry, type) {
    const stage = document.getElementById('ceremony-stage-area');
    const isStudent = type === 'student';
    
    let borderColor = 'border-gray-300';
    let extraClass = '';
    let rankBadge = `<span class="bg-gray-700 text-white px-3 py-1 rounded-full text-lg font-bold">#${entry.rank}</span>`;
    
    if (entry.rank === 3) { 
        borderColor = 'border-orange-400'; 
        extraClass = 'bronze-shine'; 
        rankBadge = `<span class="bg-orange-500 text-white px-4 py-1 rounded-full text-xl font-bold">🥉 Bronze</span>`;
    }

    const imageHtml = isStudent 
        ? (entry.avatar ? `<img src="${entry.avatar}" class="w-40 h-40 rounded-full border-4 border-white object-cover mx-auto mb-4">` : `<div class="w-40 h-40 rounded-full bg-indigo-500 flex items-center justify-center text-7xl text-white font-bold mx-auto mb-4 border-4 border-white">${entry.name.charAt(0)}</div>`)
        : `<div class="text-8xl mb-4 filter drop-shadow-lg">${entry.logo}</div>`;

    const subText = isStudent 
        ? `${entry.score} Stars`
        : `<div class="flex flex-col items-center">
             <span class="text-2xl font-bold text-indigo-700">${entry.score} Stars</span>
             <span class="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">${entry.studentCount} Students</span>
             <span class="text-amber-500 font-extrabold text-3xl mt-2 drop-shadow-sm">${entry.progress.toFixed(0)}%</span>
           </div>`;

    const card = document.createElement('div');
    card.className = `ceremony-display-card ceremony-card-enter ${borderColor} ${extraClass}`;
    card.innerHTML = `
        <div class="absolute -top-5 left-1/2 transform -translate-x-1/2 z-20">
            ${rankBadge}
        </div>
        <div class="mt-4">
            ${imageHtml}
            <h3 class="font-title text-4xl text-gray-800 mb-2 truncate px-2 leading-tight">${entry.name}</h3>
            <div class="mt-2">${subText}</div>
        </div>
    `;
    
    stage.appendChild(card);
    playSound(entry.rank <= 3 ? 'star2' : 'click');
}

function setupShowdown(silverEntry, goldEntry, titleText, subText) {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const aiBox = document.getElementById('ceremony-ai-box');

    title.innerHTML = formatTitleHtml(titleText);
    subtitle.innerHTML = formatTitleHtml(subText);
    subtitle.style.opacity = '1';
    aiBox.style.opacity = '1'; 

    stage.innerHTML = ''; 

    const spotlight = document.createElement('div');
    spotlight.className = 'absolute inset-0 bg-radial-gradient-spotlight pointer-events-none animate-pulse-slow';
    stage.appendChild(spotlight);

    const leftCard = createFaceOff(silverEntry, silverEntry.rank, 'left');
    const rightCard = createFaceOff(goldEntry, goldEntry.rank, 'right');
    
    const vsBadge = document.createElement('div');
    vsBadge.id = 'ceremony-vs-badge';
    vsBadge.className = 'z-20 mx-4 font-title text-6xl text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-orange-600 drop-shadow-[0_0_15px_rgba(255,0,0,0.8)] animate-bounce';
    vsBadge.innerText = 'VS';

    stage.appendChild(leftCard);
    stage.appendChild(vsBadge);
    stage.appendChild(rightCard);

    triggerAICommentary('showdown_build', { name1: silverEntry.name, name2: goldEntry.name });

    stopAllCeremonyAudio(); 
    if (showdownSting.loaded) {
        showdownSting.volume.value = -5;
        showdownSting.start();
    }
}

function createFaceOff(entry, realRank, position) {
    if (!entry) return document.createElement('div');

    const div = document.createElement('div');
    div.className = `ceremony-display-card ceremony-card face-off relative`;
    
    div.id = `showdown-card-${position}`; 
    div.dataset.rank = realRank; 
    div.dataset.name = entry.name; 
    div.dataset.score = entry.score;
    
    const isStudent = entry.avatar !== undefined;
    
    const imageHtml = !isStudent
        ? `<div class="text-8xl mb-4 filter drop-shadow-lg">${entry.logo}</div>`
        : (entry.avatar
            ? `<img src="${entry.avatar}" class="w-40 h-40 rounded-full border-4 border-gray-300 mx-auto mb-4 object-cover shadow-inner">`
            : `<div class="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center text-7xl text-gray-500 font-bold mx-auto mb-4 border-4 border-gray-300 shadow-inner">${entry.name.charAt(0)}</div>`);

    const scoreDisplay = isStudent 
        ? `${entry.score} Stars`
        : `<div class="flex flex-col items-center">
             <span class="text-xl text-amber-700">${entry.score} Stars</span>
             <span class="text-xs text-gray-500 uppercase">${entry.studentCount} Students</span>
             <span class="text-3xl text-amber-600 font-bold mt-1">${entry.progress.toFixed(0)}%</span>
           </div>`;

    div.innerHTML = `
        <div class="rank-badge absolute -top-8 left-1/2 transform -translate-x-1/2 text-6xl drop-shadow-md z-20 transition-all duration-500 opacity-0">
            ${realRank === 1 ? '🥇' : '🥈'}
        </div>
        <div class="mt-6">
            ${imageHtml}
            <h3 class="font-title text-3xl text-gray-700 mb-2 truncate px-2 leading-tight">${entry.name}</h3>
            <div class="star-count opacity-0 blur-sm transition-all duration-500">
                ${scoreDisplay}
            </div>
        </div>
    `;
    return div;
}

function handleDramaticReveal() {
    const btn = document.getElementById('ceremony-action-btn');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const cards = document.querySelectorAll('.ceremony-card.face-off');
    
    btn.disabled = true;
    btn.innerText = "Wait for it...";

    stopAllCeremonyAudio();
    playDrumRoll();

    cards.forEach(card => card.classList.add('tension-active'));

    setTimeout(() => {
        stopDrumRoll();
        
        if(subtitle) {
            subtitle.style.opacity = '0'; 
            setTimeout(() => subtitle.innerHTML = '', 500);
        }

        const vsBadge = document.getElementById('ceremony-vs-badge');
        if (vsBadge) {
            vsBadge.classList.add('fade-out-fast');
            setTimeout(() => vsBadge.remove(), 500);
        }
        
        let winners = [];
        const cardLeft = document.getElementById('showdown-card-left'); // Silver usually
        const cardRight = document.getElementById('showdown-card-right'); // Gold usually

        const rankLeft = parseInt(cardLeft.dataset.rank);
        const rankRight = parseInt(cardRight.dataset.rank);
        const isTie = rankLeft === rankRight && rankLeft === 1;

        if (cardLeft) {
            cardLeft.classList.remove('tension-active', 'face-off');
            cardLeft.classList.add('converge-left'); 
        }
        if (cardRight) {
            cardRight.classList.remove('tension-active', 'face-off');
            cardRight.classList.add('converge-right');
        }

        [cardLeft, cardRight].forEach(card => {
            if(!card) return;
            
            const badge = card.querySelector('.rank-badge');
            const scoreEl = card.querySelector('.star-count');
            
            if(badge) badge.classList.remove('opacity-0');
            if(scoreEl) {
                scoreEl.classList.remove('opacity-0', 'blur-sm');
                scoreEl.classList.add('opacity-100');
            }

            const r = parseInt(card.dataset.rank);
            if (r === 1) {
                // WINNER
                card.classList.add('revealed-gold', 'ceremony-winner');
                winners.push(card.dataset.name);
                
                setTimeout(() => {
                    triggerFireworks(); 
                    triggerConfetti();
                }, 300);
            } else {
                // RUNNER UP (Now Glimmering Silver, Not Grey)
                card.classList.add('revealed-silver');
            }
        });

        playWinnerFanfare();

        if (isTie) {
            title.innerHTML = formatTitleHtml("It's a Draw! 🤝");
            triggerAICommentary('tie', { names: winners.join(' & '), score: cardRight.dataset.score });
        } else {
            title.innerHTML = formatTitleHtml("Champion Crowned!");
            const phaseType = ceremonyData.phase === 'class_showdown' ? 'class_winner' : 'student_winner';
            triggerAICommentary(phaseType, { name: cardRight.dataset.name, score: cardRight.dataset.score });
        }

        if (ceremonyData.phase === 'class_showdown') {
            ceremonyData.phase = 'class_showdown_done'; 
        } else {
            ceremonyData.phase = 'student_showdown_done'; 
        }

        btn.disabled = false;
        // FIX: Change button directly to final step
        btn.innerText = "Show Final Standings";
        btn.onclick = advanceCeremony; 

    }, 3000); 
}

// --- NEW FUNCTION: RENDER FINAL LEADERBOARD ---
function renderFinalLeaderboard() {
    const stage = document.getElementById('ceremony-stage-area');
    
    // Create Container
    const container = document.createElement('div');
    container.className = 'ceremony-leaderboard-container custom-scrollbar';
    
    // Reverse again because studentQueue is [Last ... 1st] for reveal, but we want [1st ... Last] for list
    const queue = ceremonyData.studentQueue.slice().reverse(); 
    
    let html = '';
    queue.forEach((s, index) => {
        const rank = s.rank;
        let rankClass = 'cli-rank-other';
        let rankContent = rank;
        
        if (rank === 1) { rankClass = 'cli-rank-1'; rankContent = '🥇'; }
        else if (rank === 2) { rankClass = 'cli-rank-2'; rankContent = '🥈'; }
        else if (rank === 3) { rankClass = 'cli-rank-3'; rankContent = '🥉'; }
        
        const avatarHtml = s.avatar 
            ? `<img src="${s.avatar}" class="cli-avatar">`
            : `<div class="cli-avatar bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xl">${s.name.charAt(0)}</div>`;

        html += `
            <div class="ceremony-leaderboard-item" style="animation-delay: ${index * 0.1}s">
                <div class="cli-rank ${rankClass}">${rankContent}</div>
                ${avatarHtml}
                <div class="cli-info">
                    <div class="cli-name">${s.name}</div>
                    <div class="cli-stats">High Skill: ${s.stats.uniqueReasons} types</div>
                </div>
                <div class="cli-stars">${s.score} ⭐</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    stage.appendChild(container);
    
    // Trigger confetti again for effect
    triggerConfetti(); 
}

// --- 5. HELPERS ---

async function saveCeremonyComplete() {
    const classId = ceremonyData.classId;
    const monthKey = ceremonyData.monthKey;
    try {
        const classRef = doc(db, `artifacts/great-class-quest/public/data/classes`, classId);
        await updateDoc(classRef, {
            [`ceremonyHistory.${monthKey}.complete`]: true,
            [`ceremonyHistory.${monthKey}.watchedAt`]: new Date()
        });
        
        const classes = state.get('allSchoolClasses');
        const c = classes.find(x => x.id === classId);
        if(c) {
            if(!c.ceremonyHistory) c.ceremonyHistory = {};
            if(!c.ceremonyHistory[monthKey]) c.ceremonyHistory[monthKey] = {};
            c.ceremonyHistory[monthKey].complete = true;
        }
        updateCeremonyStatus();
    } catch(e) { console.error("Save failed", e); }
}

function closeCeremony() {
    document.getElementById('ceremony-screen').classList.add('hidden');
    stopAllCeremonyAudio();
    import('../features/home.js').then(m => m.renderHomeTab());
}

function triggerConfetti() {
    const container = document.getElementById('ceremony-confetti-container');
    container.innerHTML = '';
    const colors = ['#fcd34d', '#f87171', '#60a5fa', '#a78bfa', '#34d399'];
    for(let i=0; i<150; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.left = Math.random() * 100 + '%';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = (Math.random() * 2 + 2) + 's';
        el.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(el);
    }
}

// Firework Generator
function triggerFireworks() {
    const container = document.getElementById('ceremony-confetti-container');
    for(let i=0; i<5; i++) {
        setTimeout(() => {
            const x = 20 + Math.random() * 60; 
            const y = 20 + Math.random() * 40; 
            
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = x + '%';
            firework.style.top = y + '%';
            container.appendChild(firework);
            
            setTimeout(() => firework.remove(), 1000);
        }, i * 300);
    }
}

// --- AI COMMENTARY ---
let aiDebounce = null;

async function triggerAICommentary(phase, data) {
    if (aiDebounce) clearTimeout(aiDebounce);

    const aiBox = document.getElementById('ceremony-ai-box');
    const aiText = document.getElementById('ceremony-ai-text');

    aiDebounce = setTimeout(async () => {
        aiBox.style.opacity = '0.5'; 

        // 1. Determine Tone based on League (Age Group)
        const league = ceremonyData.league || 'A'; // Default to A if missing
        let toneInstruction = "";
        
        if (league.includes('Junior')) {
            // Young Kids (7-9): Simple, high energy, magical
            toneInstruction = "Speak like an exciting game show host for young kids. Use simple words. Be very enthusiastic and magical.";
        } else {
            // Older Kids/Teens (10+): Serious, professional, 'Esports' style
            toneInstruction = "Speak like a professional Esports commentator. Use sophisticated, punchy, dramatic language. Be serious but hype. Use words like 'dominance', 'precision', 'legendary status'.";
        }

        let systemPrompt = `You are the 'Grand Quest Master'. ${toneInstruction} Your commentary must be short (max 12 words). Do not use markdown.`;
        let userPrompt = "";

        if (phase === 'intro') userPrompt = `Hyping up the start of the ${data.month} Ceremony.`;
        else if (phase === 'class_rank') userPrompt = `Class '${data.name}' got Rank #${data.rank}. Hype them up!`;
        else if (phase === 'class_winner') userPrompt = `Class '${data.name}' WON the whole thing! Go wild!`;
        else if (phase === 'transition') userPrompt = "Transitioning to the student hero reveal. Ask who is the best.";
        else if (phase === 'student_rank') {
            if (data.tieReason === 'tie_3star') userPrompt = `Hype ${data.name} for having tons of 3-Star badges!`;
            else if (data.tieReason === 'tie_2star') userPrompt = `Hype ${data.name} for consistent 2-Star plays!`;
            else if (data.tieReason === 'tie_academic') userPrompt = `Hype ${data.name} for their brain power on tests!`;
            else if (data.tieReason === 'tie_variety') userPrompt = `Hype ${data.name} for being a jack-of-all-trades!`;
            else userPrompt = `Shout out ${data.name} for hitting Rank #${data.rank}.`;
        }
        else if (phase === 'student_winner') userPrompt = `Announce ${data.name} is the PRODIGY of the Month!`;
        else if (phase === 'outro') userPrompt = "Sign off with energy. See you next month.";
        else if (phase === 'showdown_build') userPrompt = `It's down to ${data.name1} vs ${data.name2}. The tension is maximum! Build extreme suspense but DO NOT announce the winner yet.`;
        else if (phase === 'tie') userPrompt = `UNBELIEVABLE! It's a Tie! Double winners!`;

        try {
            const commentary = await callGeminiApi(systemPrompt, userPrompt);
            aiBox.style.opacity = '0';
            setTimeout(() => {
                aiText.innerText = commentary;
                aiBox.style.opacity = '1';
            }, 300);
        } catch (e) {
            console.error("AI Error", e);
            aiBox.style.opacity = '1';
        }
    }, 250); 
}
