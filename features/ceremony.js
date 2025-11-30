// /features/ceremony.js

// --- IMPORTS ---
import { db } from '../firebase.js';
import { fetchMonthlyHistory } from '../state.js'; 
import { updateDoc, doc, getDoc, setDoc, query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import * as state from '../state.js';
import * as utils from '../utils.js';
import * as constants from '../constants.js';
import { playSound, ceremonyMusic, winnerFanfare, showdownSting } from '../audio.js';
import * as modals from '../ui/modals.js';
import { callGeminiApi } from '../api.js';
import { renderClassLeaderboardTab, renderStudentLeaderboardTab } from '../ui/tabs.js';

// --- CEREMONY LOGIC ---

export function updateCeremonyStatus() {
    const teamQuestBtn = document.querySelector('.nav-button[data-tab="class-leaderboard-tab"]');
    const heroChallengeBtn = document.querySelector('.nav-button[data-tab="student-leaderboard-tab"]');
    
    if (!teamQuestBtn || !heroChallengeBtn) return;

    teamQuestBtn.classList.remove('ceremony-ready-pulse');
    heroChallengeBtn.classList.remove('ceremony-ready-pulse');

    let currentClassId = state.get('globalSelectedClassId');
    
    if (!currentClassId) {
        const todayStr = utils.getTodayDateString();
        const classesToday = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
        const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));
        
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const activeClass = myClassesToday.find(c => c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd);
        
        if (activeClass) currentClassId = activeClass.id;
    }

    if (!currentClassId) return;

    const classData = state.get('allSchoolClasses').find(c => c.id === currentClassId);
    if (!classData) return;

    const league = classData.questLevel;
    if (!league) return;

    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    if (lastMonthDate < constants.competitionStart) return;

    const monthKey = lastMonthDate.toISOString().substring(0, 7);

    const todayStr = utils.getTodayDateString();
    const classesToday = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
    const isClassScheduledToday = classesToday.some(c => c.id === currentClassId);

    if (!isClassScheduledToday) return;

    const history = classData.ceremonyHistory || {};
    const monthStatus = history[monthKey] || {};

    const isTeamCeremonyDone = !!monthStatus.team;
    const isHeroCeremonyDone = !!monthStatus.hero;

    if (!isTeamCeremonyDone) teamQuestBtn.classList.add('ceremony-ready-pulse');
    if (!isHeroCeremonyDone) heroChallengeBtn.classList.add('ceremony-ready-pulse');

    const activeTab = document.querySelector('.app-tab:not(.hidden)');
    const veilDismissKey = `veil_dismiss_${currentClassId}_${monthKey}`;
    const isVeilDismissed = sessionStorage.getItem(veilDismissKey) === 'true';

    if (activeTab && !isVeilDismissed) {
        if (activeTab.id === 'class-leaderboard-tab' && !isTeamCeremonyDone) {
            showCeremonyVeil('team', league, monthKey, currentClassId);
        } else if (activeTab.id === 'student-leaderboard-tab' && !isHeroCeremonyDone) {
            showCeremonyVeil('hero', league, monthKey, currentClassId);
        } else {
            hideCeremonyVeil(false); 
        }
    }
}

function showCeremonyVeil(type, league, monthKey, classId) {
    const screen = document.getElementById('ceremony-screen');
    const veil = document.getElementById('ceremony-veil');
    const stage = document.getElementById('ceremony-stage');
    const btn = document.getElementById('start-ceremony-btn');
    const ceremonyTitle = btn.querySelector('.font-title.text-6xl');
    const monthName = new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long' });
    document.getElementById('ceremony-month-name').innerText = monthName;

    const themes = {
        team: { gradient: 'from-amber-500 to-orange-500', text: 'Team Quest Ceremony' },
        hero: { gradient: 'from-purple-500 to-indigo-500', text: 'Hero\'s Challenge Ceremony' }
    };
    const theme = themes[type];
    const buttonGradientDiv = btn.querySelector('.bg-gradient-to-r');
    buttonGradientDiv.className = `mt-2 px-8 py-4 bg-gradient-to-r ${theme.gradient} rounded-full shadow-2xl`;
    ceremonyTitle.innerText = theme.text;

    screen.classList.remove('hidden');
    veil.classList.remove('hidden');
    stage.classList.add('hidden');

    btn.dataset.type = type;
    btn.dataset.league = league;
    btn.dataset.monthKey = monthKey;
    btn.dataset.classId = classId;

    document.getElementById('ceremony-veil-close-btn').onclick = () => {
        const veilDismissKey = `veil_dismiss_${classId}_${monthKey}`;
        sessionStorage.setItem(veilDismissKey, 'true');
        hideCeremonyVeil();
    };
}

export function startCeremonyFromVeil() {
    const btn = document.getElementById('start-ceremony-btn');
    const { type, league, monthKey, classId } = btn.dataset;
    
    playSound('confirm');
    document.getElementById('ceremony-veil').classList.add('hidden');
    document.getElementById('ceremony-stage').classList.remove('hidden');
    startCeremony(type, league, monthKey, classId); 
}

export function hideCeremonyVeil(stopMusic = true) {
    document.getElementById('ceremony-screen').classList.add('hidden');
    if (stopMusic && ceremonyMusic.state === "started") ceremonyMusic.stop(); 
}

async function startCeremony(type, league, monthKey, classId) {
    const ceremonyState = { isActive: true, type, league, monthKey, data: [], step: -1, isFinalShowdown: false, classId: classId };
    state.set('ceremonyState', ceremonyState);
    
    if (ceremonyMusic.loaded) {
        ceremonyMusic.start();
    }

    const veilBtn = document.getElementById('start-ceremony-btn');
    if (veilBtn) veilBtn.disabled = true;
    const titleEl = document.getElementById('ceremony-title');
    titleEl.innerText = `Preparing the stage...`;
    
    if (state.get('allSchoolClasses').length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    document.getElementById('ceremony-title').innerText = `Fetching results...`;
    document.getElementById('ceremony-reveal-area').innerHTML = '';
    document.getElementById('ceremony-next-btn').disabled = true;
    
    const showGlobalBtn = document.getElementById('ceremony-show-global-btn');
    showGlobalBtn.onclick = showGlobalLeaderboardModal;

    const nextBtn = document.getElementById('ceremony-next-btn');
    const exitBtn = document.getElementById('ceremony-exit-btn');
    const skipBtn = document.getElementById('ceremony-skip-btn');
    nextBtn.onclick = advanceCeremony;
    exitBtn.onclick = endCeremony;
    skipBtn.onclick = skipCeremony;
    
    let rawData;
    try {
        rawData = await fetchLastMonthResults(league, type, monthKey, classId);
    } catch (error) {
        console.error("Failed to fetch ceremony results:", error);
        document.getElementById('ceremony-reveal-area').innerHTML = `<p class="text-2xl font-title text-red-400">Connection Interrupted</p>`;
        nextBtn.innerHTML = `<i class="fas fa-times"></i>`;
        nextBtn.onclick = endCeremony;
        nextBtn.disabled = false;
        if (veilBtn) veilBtn.disabled = false;
        return;
    }

    // --- UPDATED RANKING GROUPING LOGIC (Matches tabs.js) ---
    let dataWithRanks = [];
    if (rawData.length > 0 && rawData.some(d => d.score > 0)) {
        
        let lastScore = -1, lastUnique = -1, last3 = -1, last2 = -1, lastRank = 0;

        rawData.forEach((entry, index) => {
            // Note: In ceremony rawData, keys are top-level (entry.count3Star), unlike tabs.js (s.stats.count3Star)
            let isBehaviorTie = (
                entry.score === lastScore && 
                entry.uniqueReasons === lastUnique && 
                entry.count3Star === last3 && 
                entry.count2Star === last2
            );
            
            let currentRank;

            if (index === 0) {
                currentRank = 1;
            } else {
                if (lastRank <= 3) {
                    // Top 3: Ignore Academic Score for ranking (Shared Rank)
                    currentRank = isBehaviorTie ? lastRank : index + 1;
                } else {
                    // 4th+: Use Academic Score as final tie-breaker
                    // (rawData is already sorted by academicAvg at the end)
                    let isTotalTie = isBehaviorTie && (entry.academicAvg === rawData[index-1].academicAvg);
                    currentRank = isTotalTie ? lastRank : index + 1;
                }
            }

            // Update trackers
            lastScore = entry.score; 
            lastUnique = entry.uniqueReasons; 
            last3 = entry.count3Star; 
            last2 = entry.count2Star; 
            lastRank = currentRank;

            dataWithRanks.push({ ...entry, rank: currentRank });
        });

        const groupedByRank = dataWithRanks.reduce((acc, entry) => {
            if (!acc[entry.rank]) { acc[entry.rank] = { rank: entry.rank, entries: [] }; }
            acc[entry.rank].entries.push(entry);
            return acc;
        }, {});

        ceremonyState.data = Object.values(groupedByRank).sort((a, b) => b.rank - a.rank);
    }
    
    if (ceremonyState.data.length === 0) {
        document.getElementById('ceremony-reveal-area').innerHTML = `<p class="text-2xl font-title">No results recorded for this period!</p>`;
        nextBtn.innerHTML = `<i class="fas fa-check"></i>`;
        nextBtn.onclick = endCeremony;
        nextBtn.disabled = false;
        skipBtn.disabled = true;
        markCeremonyViewedInDB(classId, monthKey, type);
        return;
    }
    
    document.getElementById('ceremony-title').innerText = `${type === 'team' ? 'Team Quest' : 'Hero\'s Challenge'} - ${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long' })}`;
    nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
    nextBtn.disabled = false;
    skipBtn.disabled = false;
    
    advanceCeremony();
}

export async function advanceCeremony() {
    let ceremonyState = state.get('ceremonyState');
    if (ceremonyState.isFinalShowdown) {
        revealWinner();
        ceremonyState.isFinalShowdown = false;
        state.set('ceremonyState', ceremonyState);
        return;
    }

    ceremonyState.step++;
    const { data, step } = ceremonyState;
    const nextBtn = document.getElementById('ceremony-next-btn');
    
    if (step >= data.length) {
        endCeremony();
        return;
    }
    
    const currentRankGroup = data[step];
    const { rank, entries } = currentRankGroup;
    
    const isShowdownTrigger = (rank === 2 && data[step + 1]?.rank === 1);

    if (isShowdownTrigger) {
        ceremonyState.isFinalShowdown = true;
        
        const finalists2 = entries;
        const finalists1 = data[step + 1].entries;
        
        revealFinalists(finalists1[0], finalists2[0]);

        if (ceremonyMusic.loaded) ceremonyMusic.volume.rampTo(-20, 1);
        if (showdownSting.loaded) showdownSting.start();

        nextBtn.innerHTML = `Reveal Winner!`;
        const aiCommentary = document.getElementById('ceremony-ai-commentary');
        aiCommentary.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> The Quest Master is preparing the final announcement...</p>`;
        const comment = await generateAICommentary(null, 0, ceremonyState.type);
        aiCommentary.innerHTML = `<p>${comment}</p>`;
        
        ceremonyState.step++;
    } else {
        if (rank <= 3) {
            revealPodiumEntry(entries, rank);
        } else {
            revealRegularEntry(entries, rank);
        }
        
        if (step === data.length - 1) {
            nextBtn.innerHTML = `<i class="fas fa-check"></i>`;
        }

        const aiCommentary = document.getElementById('ceremony-ai-commentary');
        aiCommentary.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> The Quest Master is checking their notes...</p>`;
        const comment = await generateAICommentary(entries[0], rank, ceremonyState.type);
        aiCommentary.innerHTML = `<p>${comment}</p>`;
    }
    state.set('ceremonyState', ceremonyState);
}

export function skipCeremony() {
    let ceremonyState = state.get('ceremonyState');
    const lastStep = ceremonyState.data.length - 1;
    if (lastStep >= 0) {
            ceremonyState.step = lastStep - 2;
            state.set('ceremonyState', ceremonyState);
            advanceCeremony();
    } else {
        endCeremony();
    }
}

async function markCeremonyViewedInDB(classId, monthKey, type) {
    if (!classId || !monthKey || !type) return;

    try {
        const classRef = doc(db, `artifacts/great-class-quest/public/data/classes`, classId);
        const fieldPath = `ceremonyHistory.${monthKey}.${type}`;
        
        await updateDoc(classRef, {
            [fieldPath]: true
        });
        
        const allClasses = state.get('allSchoolClasses');
        const classIndex = allClasses.findIndex(c => c.id === classId);
        if (classIndex > -1) {
            if (!allClasses[classIndex].ceremonyHistory) allClasses[classIndex].ceremonyHistory = {};
            if (!allClasses[classIndex].ceremonyHistory[monthKey]) allClasses[classIndex].ceremonyHistory[monthKey] = {};
            allClasses[classIndex].ceremonyHistory[monthKey][type] = true;
            state.setAllSchoolClasses(allClasses);
        }
        
        updateCeremonyStatus(); 

    } catch (e) {
        console.error("Failed to save ceremony status:", e);
    }
}

function revealFinalists(finalist1, finalist2) {
    const revealArea = document.getElementById('ceremony-reveal-area');
    revealArea.innerHTML = '';

    const createCard = (entry, rank) => {
        const avatarHtml = entry.avatar ? `<img src="${entry.avatar}" class="w-24 h-24 rounded-full border-4 border-white shadow-lg mx-auto">` : (entry.logo ? `<div class="text-6xl mx-auto">${entry.logo}</div>` : `<div class="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-5xl mx-auto">${entry.name.charAt(0)}</div>`);
        
        return `
            <div class="ceremony-card finalist" data-rank="${rank}">
                <p class="text-3xl font-bold text-gray-400">Finalist</p>
                <div class="my-4">${avatarHtml}</div>
                <h3 class="font-title text-3xl truncate">${entry.name}</h3>
                ${entry.className ? `<p class="text-sm text-gray-300">${entry.className}</p>` : ''}
                <p class="font-title text-4xl text-amber-400 mt-2">${entry.score} ⭐</p>
                <p class="text-xs text-amber-200 mt-1">${entry.qualityScore} perfect lessons!</p>
            </div>
        `;
    };

    revealArea.innerHTML = createCard(finalist1, 1) + createCard(finalist2, 2);
}

function revealWinner() {
    if (showdownSting.state === "started") showdownSting.stop();
    if (ceremonyMusic.loaded) ceremonyMusic.volume.rampTo(-12, 0.5);

    const winnerCard = document.querySelector('.ceremony-card[data-rank="1"]');
    const runnerUpCard = document.querySelector('.ceremony-card[data-rank="2"]');
    const revealArea = document.getElementById('ceremony-reveal-area');
    
    if (winnerCard && runnerUpCard) {
        winnerCard.classList.remove('finalist');
        runnerUpCard.classList.remove('finalist');
        winnerCard.classList.add('podium-1');
        runnerUpCard.classList.add('podium-2');
        winnerCard.querySelector('p:first-child').innerText = '#1';
        runnerUpCard.querySelector('p:first-child').innerText = '#2';
        revealArea.classList.add('confetti-active');
        playSound('star3');
        if (winnerFanfare.loaded) winnerFanfare.start();
    }

    if (state.get('ceremonyState').type === 'hero') {
        document.getElementById('ceremony-show-global-btn').classList.remove('hidden');
    }
    
    document.getElementById('ceremony-next-btn').innerHTML = `<i class="fas fa-check"></i>`;
}

function revealPodiumEntry(entries, rank) {
    const revealArea = document.getElementById('ceremony-reveal-area');
    revealArea.classList.remove('confetti-active');
    const ceremonyState = state.get('ceremonyState');

    const entry = entries[0];
    const tieCount = entries.length;

    if (!ceremonyState.isFinalShowdown) {
         revealArea.innerHTML = '';
    }
    
    const avatarHtml = entry.avatar ? `<img src="${entry.avatar}" class="w-24 h-24 rounded-full border-4 border-white shadow-lg mx-auto">` : (entry.logo ? `<div class="text-6xl mx-auto">${entry.logo}</div>` : `<div class="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-5xl mx-auto">${entry.name.charAt(0)}</div>`);
    
    const nameHtml = tieCount > 1 
        ? entries.map(e => `<h3 class="font-title text-2xl truncate">${e.name}</h3>`).join('')
        : `<h3 class="font-title text-3xl truncate">${entry.name}</h3>`;

    const card = document.createElement('div');
    card.className = `ceremony-card podium-${rank}`;
    card.innerHTML = `
        <p class="text-3xl font-bold text-gray-400">#${rank}</p>
        <div class="my-4">${avatarHtml}</div>
        ${nameHtml}
        ${entry.className ? `<p class="text-sm text-gray-300">${entry.className}</p>` : ''}
        <p class="font-title text-4xl text-amber-400 mt-2">${entry.score} ⭐</p>
    `;
    revealArea.appendChild(card);

    if (rank === 1) {
        revealArea.classList.add('confetti-active');
        if (winnerFanfare.loaded) {
            if (ceremonyMusic.state === "started") ceremonyMusic.stop();
            winnerFanfare.start();
        }
    } else if (rank === 2) {
        playSound('star2');
    } else if (rank === 3) {
        playSound('star1');
    }
}

function revealRegularEntry(entries, rank) {
    const revealArea = document.getElementById('ceremony-reveal-area');
    revealArea.innerHTML = ''; 
    
    const cardHtml = entries.map(entry => {
        const avatarHtml = entry.avatar ? `<img src="${entry.avatar}" class="w-16 h-16 rounded-full border-2 border-white shadow-md">` : (entry.logo ? `<div class="text-4xl">${entry.logo}</div>` : `<div class="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-3xl">${entry.name.charAt(0)}</div>`);
        return `
            <div class="flex items-center gap-4">
                ${avatarHtml}
                <div>
                    <h3 class="font-title text-2xl truncate">${entry.name}</h3>
                    ${entry.className ? `<p class="text-xs text-gray-300">${entry.className}</p>` : ''}
                </div>
            </div>
        `;
    }).join('<div class="my-2 border-t border-gray-600"></div>');

    const card = document.createElement('div');
    card.className = 'ceremony-card';
    card.innerHTML = `
        <p class="text-2xl font-bold text-gray-400">#${rank}</p>
        <div class="my-4 space-y-2">${cardHtml}</div>
        <p class="font-title text-3xl text-amber-400 mt-2">${entries[0].score} ⭐</p>
    `;
    revealArea.appendChild(card);
    playSound('click');
}

export function endCeremony() {
    const ceremonyState = state.get('ceremonyState');
    const { type, league, monthKey, classId } = ceremonyState;

    markCeremonyViewedInDB(classId, monthKey, type);

    document.getElementById('ceremony-screen').classList.add('hidden');
    document.getElementById('ceremony-reveal-area').classList.remove('confetti-active');
    
    document.getElementById('ceremony-show-global-btn').classList.add('hidden');
    
    ceremonyState.isActive = false;
    state.set('ceremonyState', ceremonyState);

    if (ceremonyMusic.state === "started") ceremonyMusic.stop();
    if (winnerFanfare.state === "started") winnerFanfare.stop();
    if (showdownSting.state === "started") showdownSting.stop();
    
    updateCeremonyStatus();
    if (type === 'team') renderClassLeaderboardTab();
    else renderStudentLeaderboardTab();
}

async function generateAICommentary(entry, rank, type) {
    const systemPrompt = `You are the 'Quest Master', a fun and dramatic announcer for a classroom awards ceremony. Provide a single, exciting sentence of commentary for a participant's ranking. Do NOT use markdown.`;
    let userPrompt;

    if (rank === 0) {
        userPrompt = `Generate a one-sentence, highly suspenseful comment announcing that only two finalists remain. Do not mention their names.`;
    } else if (rank > 3) {
        userPrompt = `Generate a one-sentence comment for ${entry.name}, who placed #${rank} with ${entry.score} stars. Keep it positive but brief.`;
    } else if (rank === 3) {
        userPrompt = `Generate a one-sentence comment for ${entry.name} securing the 3rd place (bronze) position with ${entry.score} stars. Make it sound honorable.`;
    } else if (rank === 2) {
        userPrompt = `Generate a one-sentence comment acknowledging the incredible effort of ${entry.name} for achieving the hard-fought 2nd place (silver) position with ${entry.score} stars.`;
    } else {
        const title = type === 'team' ? 'Team Quest Champions' : 'Prodigy of the Month';
        userPrompt = `Generate a one-sentence, highly celebratory championship announcement for ${entry.name}, who has won 1st place with ${entry.score} stars and is now the "${title}"!`;
    }

    try {
        return await callGeminiApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("AI Commentary Error:", error);
        if (rank === 0) return "And then there were two... Who will be the champion?";
        return `A valiant effort from ${entry.name}, securing the #${rank} position!`;
    }
}

// Fetch Logic
async function fetchLastMonthResults(league, type, monthKey, classId = null) {
    const monthlyScores = await fetchMonthlyHistory(monthKey); 
    
    if (type === 'team') {
        const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);
        
        const BASE_GOAL = 18; 
        const SCALING_FACTOR = 1.5;
        
        const y = parseInt(monthKey.split('-')[0]);
        const m = parseInt(monthKey.split('-')[1]) - 1; 
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        
        let holidayDaysLost = 0;
        const ranges = state.get('schoolHolidayRanges') || [];
        
        ranges.forEach(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            const monthStart = new Date(y, m, 1);
            const monthEnd = new Date(y, m + 1, 0);
            
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;
            
            if (overlapStart <= overlapEnd) {
                const diffTime = Math.abs(overlapEnd - overlapStart);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                holidayDaysLost += diffDays;
            }
        });

        let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
        if (m === 5) monthModifier = 0.5;
        else monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));

        let classScores = classesInLeague.map(c => {
            const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
            const studentCount = studentsInClass.length;
            const difficulty = c.difficultyLevel || 0;
            
            const adjustedGoalPerStudent = (BASE_GOAL + (difficulty * SCALING_FACTOR)) * monthModifier;
            const diamondGoal = studentCount > 0 ? Math.round(studentCount * adjustedGoalPerStudent) : 18;
            
            const score = studentsInClass.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0);
            const progress = diamondGoal > 0 ? (score / diamondGoal) * 100 : 0;
            
            return { id: c.id, name: c.name, logo: c.logo, score, progress, studentCount, qualityScore: 0 };
        });

        const diamondClasses = classScores.filter(c => c.progress >= 100);
        if (diamondClasses.length > 1) {
            const startDate = new Date(y, m, 1);
            const endDate = new Date(y, m + 1, 0);
            const publicDataPath = "artifacts/great-class-quest/public/data";
            
            await Promise.all(diamondClasses.map(async (c) => {
                try {
                    const q = query(
                        collection(db, `${publicDataPath}/award_log`),
                        where("classId", "==", c.id)
                    );
                    const snap = await getDocs(q);
                    
                    let threeStarCount = 0;
                    snap.forEach(doc => {
                        const d = doc.data();
                        const logParts = d.date.split('-'); 
                        if (parseInt(logParts[1]) == (m + 1) && parseInt(logParts[2]) == y) {
                            if (d.stars === 3) threeStarCount++;
                        }
                    });

                    c.qualityScore = c.studentCount > 0 ? (threeStarCount / c.studentCount) : 0;
                } catch (e) {
                    console.error("Error calculating tie-breaker", e);
                }
            }));
        }

        return classScores.sort((a, b) => {
            if (Math.abs(b.progress - a.progress) > 0.1) return b.progress - a.progress;
            if (a.progress >= 100 && b.progress >= 100) {
                if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
            }
            return b.score - a.score;
        });

    } else {
        // --- HERO'S CHALLENGE TIE-BREAKER LOGIC ---
        let studentsToRank;
        
        if (classId) {
            studentsToRank = state.get('allStudents').filter(s => s.classId === classId);
        } else {
            const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);
            studentsToRank = state.get('allStudents').filter(s => classesInLeague.some(c => c.id === s.classId));
        }

        // Stats storage
        const studentStats = {}; 
        const academicStats = {}; 

        const y = parseInt(monthKey.split('-')[0]);
        const m = parseInt(monthKey.split('-')[1]); 

        const publicDataPath = "artifacts/great-class-quest/public/data";
        
        try {
            // 1. Fetch Behavioral Logs
            let logsQuery;
            if (classId) {
                logsQuery = query(collection(db, `${publicDataPath}/award_log`), where("classId", "==", classId));
            } else {
                logsQuery = query(collection(db, `${publicDataPath}/award_log`)); 
            }

            const logsSnap = await getDocs(logsQuery);
            
            logsSnap.forEach(doc => {
                const d = doc.data();
                if (!d.date) return;
                const parts = d.date.split('-'); 
                const logMonth = parseInt(parts[1]);
                const logYear = parseInt(parts[2]);

                if (logMonth === m && logYear === y) {
                    if (!studentStats[d.studentId]) {
                        studentStats[d.studentId] = { reasons: new Set(), count3Star: 0, count2Star: 0 };
                    }
                    if (d.reason) studentStats[d.studentId].reasons.add(d.reason);
                    if (d.stars >= 3) studentStats[d.studentId].count3Star++;
                    else if (d.stars >= 2) studentStats[d.studentId].count2Star++;
                }
            });

            // 2. Fetch Academic Scores
            let scoresQuery;
            if (classId) {
                scoresQuery = query(collection(db, `${publicDataPath}/written_scores`), where("classId", "==", classId));
            } else {
                scoresQuery = query(collection(db, `${publicDataPath}/written_scores`));
            }
            const scoresSnap = await getDocs(scoresQuery);
            
            scoresSnap.forEach(doc => {
                const d = doc.data();
                if (!d.date) return;
                const parts = d.date.split('-');
                const scoreDate = new Date(d.date); 
                if (scoreDate.getMonth() + 1 === m && scoreDate.getFullYear() === y) {
                    if (!academicStats[d.studentId]) academicStats[d.studentId] = { sum: 0, count: 0 };
                    
                    let val = 0;
                    if (d.maxScore > 0 && d.scoreNumeric !== null) val = (d.scoreNumeric / d.maxScore) * 100;
                    else if (d.scoreQualitative === "Great!!!") val = 100;
                    else if (d.scoreQualitative === "Great!!") val = 75;
                    
                    if (val > 0) {
                        academicStats[d.studentId].sum += val;
                        academicStats[d.studentId].count++;
                    }
                }
            });

        } catch (e) {
            console.error("Error calculating Hero tie-breaker:", e);
        }
        
        return studentsToRank
            .map(s => {
                const studentClass = state.get('allSchoolClasses').find(c => c.id === s.classId);
                const score = monthlyScores[s.id] || 0;
                
                const stats = studentStats[s.id] || { reasons: new Set(), count3Star: 0, count2Star: 0 };
                const acad = academicStats[s.id] || { sum: 0, count: 0 };
                const academicAvg = acad.count > 0 ? (acad.sum / acad.count) : 0;

                return { 
                    id: s.id, 
                    name: s.name, 
                    avatar: s.avatar, 
                    score: score, 
                    uniqueReasons: stats.reasons.size,
                    count3Star: stats.count3Star,
                    count2Star: stats.count2Star,
                    academicAvg: academicAvg, 
                    className: studentClass?.name || '?',
                    qualityScore: stats.reasons.size 
                };
            })
            .sort((a, b) => {
                // 1. Primary: Total Stars
                if (b.score !== a.score) return b.score - a.score;
                // 2. Secondary: Supernova (3-Stars) - MOVED UP
                if (b.count3Star !== a.count3Star) return b.count3Star - a.count3Star;
                // 3. Tertiary: Shine (2-Stars) - MOVED UP
                if (b.count2Star !== a.count2Star) return b.count2Star - a.count2Star;
                // 4. Quaternary: Academic (Higher Priority)
                if (b.academicAvg !== a.academicAvg) return b.academicAvg - a.academicAvg;
                // 5. Quinary: Diversity (Lower Priority)
                if (b.uniqueReasons !== a.uniqueReasons) return b.uniqueReasons - a.uniqueReasons;
                
                return a.name.localeCompare(b.name);
            });
    }
}

export async function showGlobalLeaderboardModal() {
    playSound('click');
    const { league, monthKey } = state.get('ceremonyState');
    const titleEl = document.getElementById('global-leaderboard-title');
    const contentEl = document.getElementById('global-leaderboard-content');
    
    titleEl.innerText = `${league} - Global Ranks (${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long' })})`;
    contentEl.innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading global ranks...</p>`;
    modals.showAnimatedModal('global-leaderboard-modal');
    
    document.getElementById('global-leaderboard-close-btn').onclick = () => modals.hideModal('global-leaderboard-modal');
    
    const globalData = await fetchLastMonthResults(league, 'hero', monthKey);
    
    if (globalData.length === 0 || globalData.every(s => s.score === 0)) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No students in this league earned stars last month.</p>`;
        return;
    }
    
    let dataWithRanks = [];
    let lastMetric = -1;
    let currentRank = 0;
    
    globalData.forEach((entry, index) => {
        // Same ranking logic as startCeremony to ensure consistency
        const metric = entry.score + (entry.qualityScore || 0) * 0.001;
        if (metric !== lastMetric) {
            currentRank = index + 1;
        }
        dataWithRanks.push({ ...entry, rank: currentRank });
        lastMetric = metric;
    });

    contentEl.innerHTML = dataWithRanks.slice(0, 100).map((student) => {
        const isMyStudent = state.get('allStudents').some(s => s.id === student.id && state.get('allTeachersClasses').some(tc => tc.id === s.classId));
        const highlightClass = isMyStudent ? 'bg-purple-100 border-purple-400' : 'bg-gray-50 border-gray-200';
        
        return `
            <div class="flex items-center justify-between p-2 rounded-lg border-l-4 ${highlightClass}">
                <div class="flex items-center">
                    <span class="font-bold text-gray-500 w-8 text-center">${student.rank}.</span>
                    <div>
                        <p class="font-semibold text-gray-800">${student.name}</p>
                        <p class="text-xs text-gray-500">${student.className}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-title text-xl text-purple-600">${student.score} ⭐</p>
                    <p class="text-xs text-purple-400">${student.qualityScore} perf.</p>
                </div>
            </div>
        `;
    }).join('');
}
