// features/grandGuildCeremony.js - Grand Guild Ceremony System
// The ultimate SUPER END OF YEAR ceremony celebrating ALL competition levels

import { db } from '../firebase.js';
import { updateDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../state.js';
import { playSound, ceremonyMusic, winnerFanfare, showdownSting, fadeCeremonyMusic, stopAllCeremonyAudio, playCeremonyMusic, playDrumRoll, stopDrumRoll, playWinnerFanfare } from '../audio.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import * as utils from '../utils.js';
import { GUILDS, getGuildById, getGuildBadgeHtml } from './guilds.js';

// --- LOCAL STATE ---
let ceremonyData = {
    active: false,
    phase: 'intro',
    participatingClasses: [],
    currentClassIndex: 0,
    competitionData: {
        heroOfTheDay: {},
        teamQuest: {},
        prodigyOfTheMonth: {},
        guildChampions: {}
    },
    ceremonyDate: null,
    schoolYearData: {}
};

// --- COMPETITION LEVEL DATA GATHERING ---

/**
 * Gather Hero of the Day data for the entire school year
 */
async function gatherHeroOfTheDayData(classIds) {
    const heroData = {
        dailyHeroes: [],
        mostFrequent: null,
        specialMoments: [],
        totalDays: 0
    };

    // Get all award logs for the school year (Sept 2025 - June 2026)
    const startDate = new Date('2025-09-01');
    const endDate = new Date('2026-06-30');
    
    for (let classId of classIds) {
        const classStudents = state.get('allStudents').filter(s => s.classId === classId);
        
        // Track daily winners for this class
        const dailyWinners = new Map();
        
        // Get logs for each month of the school year
        for (let date = new Date(startDate); date <= endDate; date.setMonth(date.getMonth() + 1)) {
            const year = date.getFullYear();
            const month = date.getMonth();
            
            try {
                const logs = await fetchLogsForMonth(year, month);
                const classLogs = logs.filter(l => classIds.includes(l.classId));
                
                // Group by date and find daily winner
                const logsByDate = {};
                classLogs.forEach(log => {
                    if (!logsByDate[log.date]) logsByDate[log.date] = [];
                    logsByDate[log.date].push(log);
                });
                
                Object.entries(logsByDate).forEach(([date, dayLogs]) => {
                    // Find student with most stars for this day
                    const dailyScores = {};
                    dayLogs.forEach(log => {
                        dailyScores[log.studentId] = (dailyScores[log.studentId] || 0) + log.stars;
                    });
                    
                    if (Object.keys(dailyScores).length > 0) {
                        const topStudentId = Object.entries(dailyScores)
                            .sort(([,a], [,b]) => b - a)[0][0];
                        const student = classStudents.find(s => s.id === topStudentId);
                        
                        if (student) {
                            dailyWinners.set(date, {
                                studentId: topStudentId,
                                studentName: student.name,
                                avatar: student.avatar,
                                stars: dailyScores[topStudentId],
                                date: date,
                                classId: classId
                            });
                        }
                    }
                });
            } catch (e) {
                console.warn(`Could not fetch logs for ${year}-${month}:`, e);
            }
        }
        
        // Add to hero data
        dailyWinners.forEach(winner => {
            heroData.dailyHeroes.push(winner);
        });
    }
    
    // Find most frequent hero
    const frequencyMap = {};
    heroData.dailyHeroes.forEach(hero => {
        frequencyMap[hero.studentId] = (frequencyMap[hero.studentId] || 0) + 1;
    });
    
    const mostFrequentId = Object.entries(frequencyMap)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    if (mostFrequentId) {
        const mostFrequentHero = heroData.dailyHeroes.find(h => h.studentId === mostFrequentId);
        heroData.mostFrequent = {
            ...mostFrequentHero,
            frequency: frequencyMap[mostFrequentId]
        };
    }
    
    heroData.totalDays = heroData.dailyHeroes.length;
    
    return heroData;
}

/**
 * Gather Team Quest data for the entire school year
 */
async function gatherTeamQuestData(classIds) {
    const teamQuestData = {
        finalStandings: [],
        journeyProgress: [],
        monthlyGoals: {},
        classProgress: {}
    };

    // Get all classes in the ceremony
    const ceremonyClasses = state.get('allSchoolClasses').filter(c => classIds.includes(c.id));
    
    // Calculate final standings based on total monthly stars
    for (let classData of ceremonyClasses) {
        const students = state.get('allStudents').filter(s => s.classId === classData.id);
        const allScores = state.get('allStudentScores');
        
        let totalYearStars = 0;
        const monthlyProgress = {};
        
        // Aggregate stars across all months
        for (let month = 8; month <= 11; month++) { // Sep-Dec 2025
            const monthKey = `2025-${String(month + 1).padStart(2, '0')}`;
            const monthStars = students.reduce((sum, student) => {
                const score = allScores.find(s => s.id === student.id);
                // Get monthly stars from score history or current monthly
                return sum + (score?.monthlyStars || 0);
            }, 0);
            monthlyProgress[monthKey] = monthStars;
            totalYearStars += monthStars;
        }
        
        for (let month = 0; month <= 5; month++) { // Jan-Jun 2026
            const monthKey = `2026-${String(month + 1).padStart(2, '0')}`;
            const monthStars = students.reduce((sum, student) => {
                const score = allScores.find(s => s.id === student.id);
                return sum + (score?.monthlyStars || 0);
            }, 0);
            monthlyProgress[monthKey] = monthStars;
            totalYearStars += monthStars;
        }
        
        // Calculate monthly goals
        const goals = {};
        Object.entries(monthlyProgress).forEach(([monthKey, stars]) => {
            const studentCount = students.length;
            const goal = utils.calculateMonthlyClassGoal(
                classData, 
                studentCount, 
                state.get('schoolHolidayRanges'), 
                state.get('allScheduleOverrides')
            );
            goals[monthKey] = goal;
        });
        
        teamQuestData.classProgress[classData.id] = {
            class: classData,
            totalYearStars,
            monthlyProgress,
            goals,
            studentCount: students.length
        };
    }
    
    // Create final standings
    teamQuestData.finalStandings = Object.values(teamQuestData.classProgress)
        .sort((a, b) => b.totalYearStars - a.totalYearStars)
        .map((classData, index) => ({
            ...classData,
            rank: index + 1
        }));
    
    teamQuestData.monthlyGoals = goals;
    
    return teamQuestData;
}

/**
 * Gather Prodigy of the Month data for the entire school year
 */
async function gatherProdigyData(classIds) {
    const prodigyData = {
        monthlyChampions: [],
        cumulativeStats: {},
        evolutionTimeline: []
    };

    // Get monthly prodigies from rankings system
    const ceremonyClasses = state.get('allSchoolClasses').filter(c => classIds.includes(c.id));
    
    for (let classData of ceremonyClasses) {
        const students = state.get('allStudents').filter(s => s.classId === classData.id);
        
        // Track monthly champions for this class
        for (let month = 8; month <= 11; month++) { // Sep-Dec 2025
            const year = 2025;
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            
            try {
                const logs = await fetchLogsForMonth(year, month);
                const classLogs = logs.filter(l => l.classId === classData.id);
                
                // Calculate monthly scores
                const monthlyScores = {};
                classLogs.forEach(log => {
                    monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
                });
                
                // Find prodigy (top student)
                if (Object.keys(monthlyScores).length > 0) {
                    const topStudent = Object.entries(monthlyScores)
                        .sort(([,a], [,b]) => b - a)[0];
                    const student = students.find(s => s.id === topStudent[0]);
                    
                    if (student) {
                        prodigyData.monthlyChampions.push({
                            studentId: topStudent[0],
                            studentName: student.name,
                            avatar: student.avatar,
                            stars: topStudent[1],
                            month: monthKey,
                            className: classData.name,
                            classId: classData.id
                        });
                    }
                }
            } catch (e) {
                console.warn(`Could not fetch prodigy data for ${monthKey}:`, e);
            }
        }
        
        for (let month = 0; month <= 5; month++) { // Jan-Jun 2026
            const year = 2026;
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            
            try {
                const logs = await fetchLogsForMonth(year, month);
                const classLogs = logs.filter(l => l.classId === classData.id);
                
                const monthlyScores = {};
                classLogs.forEach(log => {
                    monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
                });
                
                if (Object.keys(monthlyScores).length > 0) {
                    const topStudent = Object.entries(monthlyScores)
                        .sort(([,a], [,b]) => b - a)[0];
                    const student = students.find(s => s.id === topStudent[0]);
                    
                    if (student) {
                        prodigyData.monthlyChampions.push({
                            studentId: topStudent[0],
                            studentName: student.name,
                            avatar: student.avatar,
                            stars: topStudent[1],
                            month: monthKey,
                            className: classData.name,
                            classId: classData.id
                        });
                    }
                }
            } catch (e) {
                console.warn(`Could not fetch prodigy data for ${monthKey}:`, e);
            }
        }
    }
    
    // Calculate cumulative stats
    const studentTotals = {};
    prodigyData.monthlyChampions.forEach(champion => {
        if (!studentTotals[champion.studentId]) {
            studentTotals[champion.studentId] = {
                studentName: champion.studentName,
                avatar: champion.avatar,
                totalStars: 0,
                monthsWon: 0,
                classes: new Set()
            };
        }
        studentTotals[champion.studentId].totalStars += champion.stars;
        studentTotals[champion.studentId].monthsWon++;
        studentTotals[champion.studentId].classes.add(champion.className);
    });
    
    prodigyData.cumulativeStats = studentTotals;
    
    return prodigyData;
}

/**
 * Gather Guild Champions data for the entire school year
 */
async function gatherGuildData(classIds) {
    const guildData = {
        finalRankings: [],
        winningGuild: null,
        topContributors: {},
        memberHighlights: []
    };

    // Get all students in participating classes
    const ceremonyStudents = state.get('allStudents').filter(s => classIds.includes(s.classId));
    const allScores = state.get('allStudentScores');
    
    // Calculate guild totals
    const guildTotals = {};
    const guildMembers = {};
    
    ceremonyStudents.forEach(student => {
        const guildId = student.guildId;
        if (!guildId) return;
        
        if (!guildTotals[guildId]) {
            guildTotals[guildId] = 0;
            guildMembers[guildId] = [];
        }
        
        const score = allScores.find(s => s.id === student.id);
        const totalStars = score?.totalStars || 0;
        
        guildTotals[guildId] += totalStars;
        guildMembers[guildId].push({
            ...student,
            totalStars
        });
    });
    
    // Create final rankings
    guildData.finalRankings = Object.entries(guildTotals)
        .map(([guildId, totalStars]) => {
            const guild = getGuildById(guildId);
            const members = guildMembers[guildId] || [];
            const topContributor = members.sort((a, b) => b.totalStars - a.totalStars)[0];
            
            return {
                guildId,
                guildName: guild?.name || 'Unknown Guild',
                guildEmoji: guild?.emoji || '⚔️',
                totalStars,
                memberCount: members.length,
                topContributor,
                members
            };
        })
        .sort((a, b) => b.totalStars - a.totalStars)
        .map((guild, index) => ({
            ...guild,
            rank: index + 1
        }));
    
    // Set winning guild
    if (guildData.finalRankings.length > 0) {
        guildData.winningGuild = guildData.finalRankings[0];
    }
    
    // Set top contributors per guild
    guildData.finalRankings.forEach(guild => {
        guildData.topContributors[guild.guildId] = guild.topContributor;
    });
    
    // Collect member highlights (top 3 from each guild)
    guildData.finalRankings.forEach(guild => {
        guild.members.slice(0, 3).forEach((member, index) => {
            guildData.memberHighlights.push({
                ...member,
                guildRank: guild.rank,
                guildName: guild.guildName,
                guildEmoji: guild.guildEmoji,
                memberRank: index + 1
            });
        });
    });
    
    return guildData;
}

// --- CEREMONY CONTROL ---

/**
 * Check if any classes have their ceremony today
 */
export function checkCeremonyActivation() {
    const today = utils.getTodayDateString();
    const teacherSettings = state.get('teacherSettings') || {};
    const classEndDates = teacherSettings.schoolYearSettings?.classEndDates || {};
    
    const participatingClasses = [];
    
    Object.entries(classEndDates).forEach(([classId, endDate]) => {
        if (endDate === today) {
            participatingClasses.push(classId);
        }
    });
    
    return participatingClasses;
}

/**
 * Update ceremony button visibility
 */
export function updateCeremonyButtons() {
    const participatingClasses = checkCeremonyActivation();
    const hasActiveCeremony = participatingClasses.length > 0;
    
    // Update Guilds tab button
    const guildsButton = document.getElementById('grand-guild-ceremony-btn-guilds');
    if (guildsButton) {
        guildsButton.classList.toggle('hidden', !hasActiveCeremony);
        if (hasActiveCeremony) {
            guildsButton.innerHTML = `
                <i class="fas fa-crown text-2xl mb-2"></i>
                <span class="font-title text-xl">Grand Guild Ceremony</span>
                ${participatingClasses.length > 1 ? `<span class="text-sm opacity-75">(${participatingClasses.length} classes)</span>` : ''}
            `;
        }
    }
    
    // Update Home tab buttons
    updateHomeCeremonyButtons(participatingClasses);
}

/**
 * Update Home tab ceremony buttons
 */
function updateHomeCeremonyButtons(participatingClasses) {
    const hasActiveCeremony = participatingClasses.length > 0;
    
    // School-wide home button
    const schoolHomeButton = document.getElementById('grand-guild-ceremony-btn-home');
    if (schoolHomeButton) {
        schoolHomeButton.classList.toggle('hidden', !hasActiveCeremony);
        if (hasActiveCeremony) {
            schoolHomeButton.innerHTML = `
                <div class="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 rounded-2xl shadow-lg animate-pulse">
                    <i class="fas fa-crown text-3xl mb-2"></i>
                    <div class="font-title text-2xl">Grand Guild Ceremony</div>
                    ${participatingClasses.length > 1 ? `<div class="text-sm">${participatingClasses.length} classes active</div>` : ''}
                </div>
            `;
        }
    }
    
    // Class-specific home buttons
    const currentClassId = state.get('globalSelectedClassId');
    if (currentClassId && participatingClasses.includes(currentClassId)) {
        const classHomeButton = document.getElementById('grand-guild-ceremony-btn-class');
        if (classHomeButton) {
            classHomeButton.classList.remove('hidden');
            classHomeButton.innerHTML = `
                <div class="bg-gradient-to-r from-purple-400 to-pink-500 text-white p-4 rounded-2xl shadow-lg animate-pulse">
                    <i class="fas fa-crown text-3xl mb-2"></i>
                    <div class="font-title text-xl">Your Class Ceremony</div>
                    <div class="text-sm">Click to begin!</div>
                </div>
            `;
        }
    }
}

/**
 * Start the Grand Guild Ceremony
 */
export async function startGrandGuildCeremony(classIds = null) {
    const participatingClasses = classIds || checkCeremonyActivation();
    
    if (participatingClasses.length === 0) {
        console.warn('No classes have ceremony today');
        return;
    }
    
    // Initialize ceremony data
    ceremonyData = {
        active: true,
        phase: 'intro',
        participatingClasses,
        currentClassIndex: 0,
        competitionData: {
            heroOfTheDay: {},
            teamQuest: {},
            prodigyOfTheMonth: {},
            guildChampions: {}
        },
        ceremonyDate: utils.getTodayDateString(),
        schoolYearData: {}
    };
    
    // Show ceremony screen
    const screen = document.getElementById('grand-guild-ceremony-screen');
    if (!screen) {
        console.error('Ceremony screen not found');
        return;
    }
    
    screen.classList.remove('hidden');
    
    // Start ceremony music
    if (ceremonyMusic.loaded) {
        ceremonyMusic.volume.value = -12;
        ceremonyMusic.start();
    }
    
    // Initialize ceremony UI
    initializeCeremonyUI();
    
    // Begin gathering data
    await gatherAllCeremonyData();
    
    // Start ceremony phases
    advanceCeremony();
}

/**
 * Initialize ceremony UI
 */
function initializeCeremonyUI() {
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const actionBtn = document.getElementById('ceremony-action-btn');
    const stage = document.getElementById('ceremony-stage-area');
    const aiBox = document.getElementById('ceremony-ai-box');
    
    if (title) title.innerHTML = "The Grand Guild Ceremony";
    if (subtitle) subtitle.innerHTML = "The Ultimate End of Year Celebration";
    if (actionBtn) {
        actionBtn.innerText = "Begin Ceremony";
        actionBtn.onclick = advanceCeremony;
    }
    if (stage) stage.innerHTML = '';
    if (aiBox) aiBox.style.opacity = '1';
    
    // AI welcome message
    const aiText = document.getElementById('ceremony-ai-text');
    if (aiText) {
        aiText.innerText = "Welcome to the ultimate celebration of our year's achievements!";
    }
}

/**
 * Gather all ceremony data
 */
async function gatherAllCeremonyData() {
    const { participatingClasses } = ceremonyData;
    
    try {
        // Gather data for all competition levels
        const [heroData, teamQuestData, prodigyData, guildData] = await Promise.all([
            gatherHeroOfTheDayData(participatingClasses),
            gatherTeamQuestData(participatingClasses),
            gatherProdigyData(participatingClasses),
            gatherGuildData(participatingClasses)
        ]);
        
        ceremonyData.competitionData = {
            heroOfTheDay: heroData,
            teamQuest: teamQuestData,
            prodigyOfTheMonth: prodigyData,
            guildChampions: guildData
        };
        
    } catch (error) {
        console.error('Error gathering ceremony data:', error);
    }
}

/**
 * Advance ceremony to next phase
 */
async function advanceCeremony() {
    const btn = document.getElementById('ceremony-action-btn');
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const aiBox = document.getElementById('ceremony-ai-box');
    
    if (!ceremonyData.active) return;
    
    btn.disabled = true;
    
    switch (ceremonyData.phase) {
        case 'intro':
            await renderGrandOpening();
            ceremonyData.phase = 'heroGallery';
            btn.innerText = "See Hero Gallery";
            break;
            
        case 'heroGallery':
            await renderHeroGallery();
            ceremonyData.phase = 'teamQuest';
            btn.innerText = "View Team Quest";
            break;
            
        case 'teamQuest':
            await renderTeamQuestJourney();
            ceremonyData.phase = 'prodigyTimeline';
            btn.innerText = "See Prodigy Timeline";
            break;
            
        case 'prodigyTimeline':
            await renderProdigyTimeline();
            ceremonyData.phase = 'guildChampions';
            btn.innerText = "Crown Guild Champions";
            break;
            
        case 'guildChampions':
            await renderGuildChampionCrowding();
            ceremonyData.phase = 'hallOfHeroes';
            btn.innerText = "Enter Hall of Heroes";
            break;
            
        case 'hallOfHeroes':
            await renderUltimateHallOfHeroes();
            ceremonyData.phase = 'end';
            btn.innerText = "Complete Ceremony";
            break;
            
        case 'end':
            await completeCeremony();
            return;
    }
    
    btn.disabled = false;
}

/**
 * Render Grand Opening phase
 */
async function renderGrandOpening() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    
    title.innerHTML = "The Grand Guild Ceremony";
    subtitle.innerHTML = "Celebrating a Year of Excellence";
    
    stage.innerHTML = `
        <div class="text-center text-white">
            <div class="text-6xl mb-4">🏆</div>
            <h2 class="font-title text-5xl mb-4">Welcome to the Ultimate Celebration</h2>
            <p class="text-xl mb-8">Honoring Heroes, Champions, and Guild Legends</p>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <div class="bg-white/10 p-4 rounded-xl">
                    <div class="text-3xl mb-2">🌟</div>
                    <div class="font-bold">Hero of the Day</div>
                    <div class="text-sm opacity-75">Daily Champions</div>
                </div>
                <div class="bg-white/10 p-4 rounded-xl">
                    <div class="text-3xl mb-2">🗺️</div>
                    <div class="font-bold">Team Quest</div>
                    <div class="text-sm opacity-75">Class Journey</div>
                </div>
                <div class="bg-white/10 p-4 rounded-xl">
                    <div class="text-3xl mb-2">👑</div>
                    <div class="font-bold">Prodigy</div>
                    <div class="text-sm opacity-75">Monthly Stars</div>
                </div>
                <div class="bg-white/10 p-4 rounded-xl">
                    <div class="text-3xl mb-2">🛡️</div>
                    <div class="font-bold">Guilds</div>
                    <div class="text-sm opacity-75">Year Champions</div>
                </div>
            </div>
        </div>
    `;
    
    // AI commentary
    triggerAICommentary('grand_opening', {
        classCount: ceremonyData.participatingClasses.length,
        competitionLevels: ['Hero of the Day', 'Team Quest', 'Prodigy of the Month', 'Guild Champions']
    });
}

/**
 * Render Hero Gallery phase
 */
async function renderHeroGallery() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const { heroOfTheDay } = ceremonyData.competitionData;
    
    title.innerHTML = "Hero of the Day Gallery";
    
    let galleryHTML = `
        <div class="text-white">
            <h3 class="font-title text-3xl text-center mb-6">Daily Champions Throughout the Year</h3>
            <div class="text-center mb-4">
                <span class="text-xl">${heroOfTheDay.totalDays} days of heroic achievements!</span>
            </div>
    `;
    
    // Most frequent hero
    if (heroOfTheDay.mostFrequent) {
        const hero = heroOfTheDay.mostFrequent;
        galleryHTML += `
            <div class="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-2xl mb-6 text-center">
                <h4 class="font-title text-2xl mb-2">Most Frequent Hero</h4>
                <div class="text-6xl mb-2">${hero.avatar ? `<img src="${hero.avatar}" class="w-20 h-20 rounded-full border-4 border-white mx-auto">` : hero.studentName.charAt(0)}</div>
                <div class="font-bold text-xl">${hero.studentName}</div>
                <div class="text-lg">Hero for ${hero.frequency} days!</div>
                <div class="text-2xl mt-2">⭐ ${hero.frequency} Daily Victories</div>
            </div>
        `;
    }
    
    // Recent heroes gallery
    const recentHeroes = heroOfTheDay.dailyHeroes.slice(-12).reverse();
    galleryHTML += `
        <div class="grid grid-cols-3 md:grid-cols-4 gap-4">
            ${recentHeroes.map(hero => `
                <div class="bg-white/10 p-3 rounded-xl text-center">
                    <div class="text-2xl mb-1">${hero.avatar ? `<img src="${hero.avatar}" class="w-12 h-12 rounded-full border-2 border-white mx-auto">` : hero.studentName.charAt(0)}</div>
                    <div class="text-sm font-bold truncate">${hero.studentName}</div>
                    <div class="text-xs opacity-75">${hero.stars} stars</div>
                </div>
            `).join('')}
        </div>
    </div>`;
    
    stage.innerHTML = galleryHTML;
    
    triggerAICommentary('hero_gallery', {
        totalDays: heroOfTheDay.totalDays,
        mostFrequent: heroOfTheDay.mostFrequent
    });
}

/**
 * Render Team Quest Journey phase
 */
async function renderTeamQuestJourney() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const { teamQuest } = ceremonyData.competitionData;
    
    title.innerHTML = "Team Quest Journey";
    
    let journeyHTML = `
        <div class="text-white">
            <h3 class="font-title text-3xl text-center mb-6">The Year-Long Team Quest</h3>
    `;
    
    // Final standings
    journeyHTML += `
        <div class="mb-6">
            <h4 class="font-title text-xl mb-3 text-center">Final Class Standings</h4>
            <div class="space-y-2">
                ${teamQuest.finalStandings.slice(0, 5).map((classData, index) => {
                    const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                    return `
                        <div class="bg-white/10 p-3 rounded-xl flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <span class="text-2xl">${rankEmoji}</span>
                                <span class="text-3xl">${classData.class.logo}</span>
                                <div>
                                    <div class="font-bold">${classData.class.name}</div>
                                    <div class="text-sm opacity-75">${classData.studentCount} students</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xl font-bold">${classData.totalYearStars}</div>
                                <div class="text-sm opacity-75">total stars</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    journeyHTML += `</div>`;
    stage.innerHTML = journeyHTML;
    
    triggerAICommentary('team_quest_journey', {
        totalClasses: teamQuest.finalStandings.length,
        topClass: teamQuest.finalStandings[0]
    });
}

/**
 * Render Prodigy Timeline phase
 */
async function renderProdigyTimeline() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const { prodigyOfTheMonth } = ceremonyData.competitionData;
    
    title.innerHTML = "Prodigy of the Month Timeline";
    
    let timelineHTML = `
        <div class="text-white">
            <h3 class="font-title text-3xl text-center mb-6">Monthly Champions Throughout the Year</h3>
    `;
    
    // Top prodigies
    const topProdigies = Object.values(prodigyOfTheMonth.cumulativeStats)
        .sort((a, b) => b.monthsWon - a.monthsWon)
        .slice(0, 3);
    
    timelineHTML += `
        <div class="mb-6">
            <h4 class="font-title text-xl mb-3 text-center">Most Celebrated Students</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${topProdigies.map((prodigy, index) => {
                    const rankEmoji = index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉';
                    return `
                        <div class="bg-gradient-to-r from-purple-400 to-pink-500 p-4 rounded-xl text-center">
                            <div class="text-3xl mb-2">${rankEmoji}</div>
                            <div class="text-4xl mb-2">${prodigy.avatar ? `<img src="${prodigy.avatar}" class="w-16 h-16 rounded-full border-3 border-white mx-auto">` : prodigy.studentName.charAt(0)}</div>
                            <div class="font-bold text-lg">${prodigy.studentName}</div>
                            <div class="text-xl">${prodigy.monthsWon} Monthly Wins</div>
                            <div class="text-sm opacity-75">${prodigy.totalStars} total stars</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    timelineHTML += `</div>`;
    stage.innerHTML = timelineHTML;
    
    triggerAICommentary('prodigy_timeline', {
        totalChampions: prodigyOfTheMonth.monthlyChampions.length,
        topProdigy: topProdigies[0]
    });
}

/**
 * Render Guild Champion Crowning phase
 */
async function renderGuildChampionCrowding() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const { guildChampions } = ceremonyData.competitionData;
    
    title.innerHTML = "Guild Champion Crowning";
    
    let crowningHTML = `
        <div class="text-white">
            <h3 class="font-title text-3xl text-center mb-6">The Ultimate Guild Champions</h3>
    `;
    
    if (guildChampions.winningGuild) {
        const winner = guildChampions.winningGuild;
        crowningHTML += `
            <div class="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-2xl mb-6 text-center">
                <h4 class="font-title text-3xl mb-4">🏆 Winning Guild 🏆</h4>
                <div class="text-6xl mb-2">${winner.guildEmoji}</div>
                <div class="font-title text-2xl mb-2">${winner.guildName}</div>
                <div class="text-xl mb-2">${winner.totalStars} Total Stars</div>
                <div class="text-lg opacity-75">${winner.memberCount} Members</div>
                <div class="mt-4">
                    <div class="font-bold">Top Contributor:</div>
                    <div class="text-lg">${winner.topContributor.name}</div>
                    <div class="text-sm opacity-75">${winner.topContributor.totalStars} stars</div>
                </div>
            </div>
        `;
    }
    
    // All guild rankings
    crowningHTML += `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${guildChampions.finalRankings.map((guild, index) => {
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                return `
                    <div class="bg-white/10 p-4 rounded-xl">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">${rankEmoji}</span>
                                <span class="text-3xl">${guild.guildEmoji}</span>
                                <span class="font-bold text-lg">${guild.guildName}</span>
                            </div>
                            <div class="text-xl font-bold">${guild.totalStars}</div>
                        </div>
                        <div class="text-sm opacity-75">${guild.memberCount} members</div>
                        <div class="text-sm opacity-75">Top: ${guild.topContributor?.name || 'N/A'}</div>
                    </div>
                `;
            }).join('')}
        </div>
    </div>`;
    
    stage.innerHTML = crowningHTML;
    
    // Play winner fanfare for guild announcement
    if (winnerFanfare.loaded) {
        winnerFanfare.start();
    }
    
    triggerAICommentary('guild_crowning', {
        winningGuild: guildChampions.winningGuild,
        totalGuilds: guildChampions.finalRankings.length
    });
}

/**
 * Render Ultimate Hall of Heroes phase
 */
async function renderUltimateHallOfHeroes() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    
    title.innerHTML = "The Ultimate Hall of Heroes";
    
    const hallHTML = `
        <div class="text-white text-center">
            <h3 class="font-title text-4xl mb-6">A Year of Excellence</h3>
            <div class="text-6xl mb-4">🌟</div>
            <p class="text-xl mb-8">Celebrating Every Achievement, Every Hero, Every Moment</p>
            
            <div class="bg-white/10 p-6 rounded-2xl">
                <h4 class="font-title text-2xl mb-4">Ceremony Highlights</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                    <div>
                        <div class="font-bold text-lg">🌟 Daily Heroes</div>
                        <div class="text-sm opacity-75">${ceremonyData.competitionData.heroOfTheDay.totalDays} days celebrated</div>
                    </div>
                    <div>
                        <div class="font-bold text-lg">🗺️ Team Quest</div>
                        <div class="text-sm opacity-75">${ceremonyData.competitionData.teamQuest.finalStandings.length} classes journeyed</div>
                    </div>
                    <div>
                        <div class="font-bold text-lg">👑 Prodigies</div>
                        <div class="text-sm opacity-75">${ceremonyData.competitionData.prodigyOfTheMonth.monthlyChampions.length} monthly champions</div>
                    </div>
                    <div>
                        <div class="font-bold text-lg">🛡️ Guilds</div>
                        <div class="text-sm opacity-75">${ceremonyData.competitionData.guildChampions.finalRankings.length} guilds competed</div>
                    </div>
                </div>
            </div>
            
            <div class="mt-8">
                <div class="text-3xl mb-4 animate-bounce">🎓</div>
                <p class="text-lg font-bold">Congratulations to All Students!</p>
                <p class="text-sm opacity-75">You've made this year truly unforgettable.</p>
            </div>
        </div>
    `;
    
    stage.innerHTML = hallHTML;
    
    // Trigger celebration effects
    triggerConfetti();
    triggerFireworks();
    
    triggerAICommentary('hall_of_heroes', {
        totalStudents: ceremonyData.participatingClasses.length * 20, // estimate
        ceremonyComplete: true
    });
}

/**
 * Complete the ceremony
 */
async function completeCeremony() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const btn = document.getElementById('ceremony-action-btn');
    
    title.innerHTML = "Ceremony Complete";
    
    stage.innerHTML = `
        <div class="text-center text-white">
            <div class="text-6xl mb-4">🎉</div>
            <h2 class="font-title text-4xl mb-4">Thank You for an Amazing Year!</h2>
            <p class="text-xl mb-8">The Grand Guild Ceremony concludes with pride and joy.</p>
            <div class="text-8xl animate-bounce">🏆</div>
        </div>
    `;
    
    btn.innerText = "Close Ceremony";
    btn.onclick = closeCeremony;
    
    // Save ceremony completion
    await saveCeremonyCompletion();
    
    // Final celebration
    triggerConfetti();
    triggerFireworks();
    
    if (winnerFanfare.loaded) {
        winnerFanfare.start();
    }
}

/**
 * Close ceremony
 */
function closeCeremony() {
    const screen = document.getElementById('grand-guild-ceremony-screen');
    if (screen) {
        screen.classList.add('hidden');
    }
    
    stopAllCeremonyAudio();
    
    // Reset ceremony data
    ceremonyData = {
        active: false,
        phase: 'intro',
        participatingClasses: [],
        currentClassIndex: 0,
        competitionData: {
            heroOfTheDay: {},
            teamQuest: {},
            prodigyOfTheMonth: {},
            guildChampions: {}
        },
        ceremonyDate: null,
        schoolYearData: {}
    };
    
    // Update button visibility
    updateCeremonyButtons();
}

/**
 * Save ceremony completion to database
 */
async function saveCeremonyCompletion() {
    const { participatingClasses, ceremonyDate, competitionData } = ceremonyData;
    
    try {
        const teacherId = state.get('currentUserId');
        if (!teacherId) return;
        
        // Save to teacher's profile
        const teacherRef = doc(db, 'artifacts/great-class-quest/public/data/teachers', teacherId);
        const ceremonyData = {
            ceremonyDate,
            participatingClasses,
            competitionData,
            completedAt: new Date(),
            ceremonyVersion: '2026'
        };
        
        await updateDoc(teacherRef, {
            [`grandCeremonyHistory.${ceremonyDate}`]: ceremonyData
        });
        
        // Save per-class ceremony data
        for (const classId of participatingClasses) {
            const classRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classId);
            await updateDoc(classRef, {
                [`grandCeremonyHistory.${ceremonyDate}`]: {
                    ceremonyDate,
                    competitionData,
                    completedAt: new Date(),
                    ceremonyVersion: '2026'
                }
            });
        }
        
        console.log('Ceremony completion saved successfully');
        
    } catch (error) {
        console.error('Error saving ceremony completion:', error);
    }
}

/**
 * Trigger AI commentary for ceremony phases
 */
async function triggerAICommentary(phase, data) {
    try {
        let prompt = '';
        
        switch (phase) {
            case 'grand_opening':
                prompt = `Welcome to the Grand Guild Ceremony! We're celebrating ${data.classCount} classes and honoring achievements across ${data.competitionLevels.join(', ')}. Create an exciting, ceremonial opening message that sets the tone for this ultimate end-of-year celebration.`;
                break;
                
            case 'hero_gallery':
                prompt = `Showcasing ${data.totalDays} daily heroes from throughout the year! ${data.mostFrequent ? `${data.mostFrequent.studentName} was the most frequent hero with ${data.mostFrequent.frequency} daily victories!` : ''} Create an inspiring message about daily excellence and consistency.`;
                break;
                
            case 'team_quest_journey':
                prompt = `The Team Quest journey concludes with ${data.totalClasses} classes competing! ${data.topClass ? `${data.topClass.class.name} leads with ${data.topClass.totalYearStars} stars!` : ''} Create an exciting message about teamwork, progress, and class achievement.`;
                break;
                
            case 'prodigy_timeline':
                prompt = `Celebrating ${data.totalChampions} monthly prodigies! ${data.topProdigy ? `${data.topProdigy.studentName} achieved prodigy status ${data.topProdigy.monthsWon} times!` : ''} Create an inspiring message about monthly excellence and student achievement.`;
                break;
                
            case 'guild_crowning':
                prompt = `The moment we've all been waiting for! ${data.winningGuild ? `The ${data.winningGuild.guildName} guild wins with ${data.winningGuild.totalStars} stars!` : ''} Create an epic, celebratory message for the guild champion announcement.`;
                break;
                
            case 'hall_of heroes':
                prompt = `The ultimate celebration of a year filled with excellence! Create a heartfelt, emotional message that brings closure to the ceremony and celebrates every student's journey.`;
                break;
                
            default:
                prompt = 'Continue the ceremony with enthusiasm and celebration!';
        }
        
        const response = await callGeminiApi(prompt);
        const aiText = document.getElementById('ceremony-ai-text');
        if (aiText && response) {
            aiText.innerText = response;
        }
        
    } catch (error) {
        console.error('Error generating AI commentary:', error);
    }
}

/**
 * Trigger confetti effect
 */
function triggerConfetti() {
    const container = document.getElementById('ceremony-confetti-container');
    if (!container) return;
    
    container.innerHTML = '';
    const colors = ['#fcd34d', '#f87171', '#60a5fa', '#a78bfa', '#34d399'];
    
    for (let i = 0; i < 150; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.left = Math.random() * 100 + '%';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = (Math.random() * 2 + 2) + 's';
        el.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(el);
    }
}

/**
 * Trigger fireworks effect
 */
function triggerFireworks() {
    const container = document.getElementById('ceremony-confetti-container');
    if (!container) return;
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const x = 20 + Math.random() * 60;
            const y = 20 + Math.random() * 40;
            
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = x + '%';
            firework.style.top = y + '%';
            
            container.appendChild(firework);
            
            setTimeout(() => firework.remove(), 2000);
        }, i * 300);
    }
}

// --- INITIALIZATION ---

/**
 * Initialize ceremony system
 */
export function initializeGrandGuildCeremony() {
    // Check for ceremony activation on page load
    updateCeremonyButtons();
    
    // Set up periodic checks
    setInterval(updateCeremonyButtons, 60000); // Check every minute
}

// Auto-initialize when module loads
initializeGrandGuildCeremony();

// --- GLOBAL FUNCTIONS FOR BUTTON CLICKS ---
// Make these available globally for onclick handlers
window.startGrandGuildCeremony = startGrandGuildCeremony;
