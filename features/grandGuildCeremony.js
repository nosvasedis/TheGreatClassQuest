// features/grandGuildCeremony.js - Grand Guild Ceremony System
// The ultimate SUPER END OF YEAR ceremony celebrating ALL competition levels

import { db } from '../firebase.js';
import { updateDoc, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../state.js';
import { playSound, ceremonyMusic, winnerFanfare, showdownSting, fadeCeremonyMusic, stopAllCeremonyAudio, playCeremonyMusic, playDrumRoll, stopDrumRoll, playWinnerFanfare } from '../audio.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as utils from '../utils.js';
import { GUILDS, getGuildById, getGuildBadgeHtml } from './guilds.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from './awardLogReasonMeta.js';

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
        guildChampions: {},
        fortuneWheel: {},
        familiars: {}
    },
    ceremonyDate: null,
    schoolYearData: {}
};

function getCeremonyYearKey() {
    return ceremonyData.schoolYearData?.yearKey || state.getActiveSchoolYearKey?.() || '2025-2026';
}

function getSchoolYearMonthEntries(yearKey = getCeremonyYearKey()) {
    const years = state.get('allSchoolYears') || [];
    const yearData = years.find((item) => item.id === yearKey) || {};
    const start = new Date(`${yearData.startsAt || `${yearKey.slice(0, 4)}-09-01`}T12:00:00`);
    const end = new Date(`${yearData.endsAt || `${yearKey.slice(5)}-06-30`}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return [];
    }
    const months = [];
    for (let date = new Date(start.getFullYear(), start.getMonth(), 1); date <= end; date.setMonth(date.getMonth() + 1)) {
        months.push({
            year: date.getFullYear(),
            monthIndex: date.getMonth(),
            monthNumber: date.getMonth() + 1,
            monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        });
    }
    return months;
}

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

    const yearKey = getCeremonyYearKey();
    const monthEntries = getSchoolYearMonthEntries(yearKey);
    
    for (let classId of classIds) {
        const classStudents = state.get('allStudents').filter(s => s.classId === classId);
        
        // Track daily winners for this class
        const dailyWinners = new Map();
        
        // Get logs for each month of the selected school year.
        for (let { year, monthIndex } of monthEntries) {
            try {
                const logs = await fetchLogsForMonth(year, monthIndex + 1, { schoolYearKey: yearKey });
                const classLogs = logs.filter((l) => l.classId === classId);
                
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
                        dailyScores[log.studentId] = (dailyScores[log.studentId] || 0) + getAwardLogMonthlyStarCredit(log);
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
        monthlyGoalsByClassId: {},
        classProgress: {}
    };

    const monthEntries = getSchoolYearMonthEntries();
    // Get all classes in the ceremony
    const ceremonyClasses = state.get('allSchoolClasses').filter(c => classIds.includes(c.id));

    // Note: student_scores.monthlyStars is the current month only; per-month keys below repeat that
    // snapshot (not true history). Prodigy/hero phases use fetchLogsForMonth for historical accuracy.
    
    // Calculate final standings based on total monthly stars
    for (let classData of ceremonyClasses) {
        const students = state.get('allStudents').filter(s => s.classId === classData.id);
        const allScores = state.get('allStudentScores');
        
        let totalYearStars = 0;
        const monthlyProgress = {};
        
        // Aggregate stars across the selected school-year months.
        for (let { monthKey } of monthEntries) {
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

    teamQuestData.monthlyGoalsByClassId = Object.fromEntries(
        Object.entries(teamQuestData.classProgress).map(([id, progress]) => [id, progress.goals])
    );
    teamQuestData.monthlyGoals = teamQuestData.monthlyGoalsByClassId;

    return teamQuestData;
}

async function monthlyScoresForClassLogsAndArchive(classLogs, monthKey, schoolYearKey = getCeremonyYearKey()) {
    const { fetchMonthlyHistory } = await import('../state.js');
    const archived = await fetchMonthlyHistory(monthKey, { schoolYearKey }).catch(() => ({}));
    const fromLogs = sumMonthlyStarCreditsByStudentFromAwardLogs(classLogs);
    return mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogs, archived || {});
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

    const schoolYearKey = getCeremonyYearKey();
    const monthEntries = getSchoolYearMonthEntries(schoolYearKey);
    // Get monthly prodigies from rankings system
    const ceremonyClasses = state.get('allSchoolClasses').filter(c => classIds.includes(c.id));
    
    for (let classData of ceremonyClasses) {
        const students = state.get('allStudents').filter(s => s.classId === classData.id);
        
        // Track monthly champions for this class across the selected school year.
        for (let { year, monthNumber, monthKey } of monthEntries) {
            try {
                const logs = await fetchLogsForMonth(year, monthNumber, { schoolYearKey });
                const classLogs = logs.filter(l => l.classId === classData.id);
                
                const monthlyScores = await monthlyScoresForClassLogsAndArchive(classLogs, monthKey, schoolYearKey);
                
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
    const allGuildScores = state.get('allGuildScores') || {};
    
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
    
    // Create final rankings — now using Guild Power (composite) for fairness
    guildData.finalRankings = Object.entries(guildTotals)
        .map(([guildId, totalStars]) => {
            const guild = getGuildById(guildId);
            const members = guildMembers[guildId] || [];
            const topContributor = members.sort((a, b) => b.totalStars - a.totalStars)[0];
            const gDoc = allGuildScores[guildId] || {};
            const totalGlory = Number(gDoc.totalGlory) || (totalStars * 2);
            const perCapitaGlory = members.length > 0 ? Math.round((totalGlory / members.length) * 10) / 10 : 0;
            
            return {
                guildId,
                guildName: guild?.name || 'Unknown Guild',
                guildEmoji: guild?.emoji || '⚔️',
                totalStars,
                totalGlory,
                perCapitaGlory,
                memberCount: members.length,
                topContributor,
                members
            };
        })
        .sort((a, b) => b.perCapitaGlory - a.perCapitaGlory || b.totalGlory - a.totalGlory)
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

/**
 * Gather Fortune's Wheel data for the school year
 */
async function gatherFortuneWheelData(classIds) {
    const wheelData = {
        hasData: false,
        totalSpins: 0,
        biggestGlorySwing: null,
        luckiestGuild: null,
        notableSpins: [],
        guildGloryImpact: {}
    };

    const wheelLog = state.get('fortuneWheelLog') || [];
    if (wheelLog.length === 0) return wheelData;

    // Filter to participating classes
    const classSet = new Set(classIds);
    const relevantEntries = wheelLog.filter(entry => classSet.has(entry.classId));
    if (relevantEntries.length === 0) return wheelData;

    wheelData.hasData = true;
    wheelData.totalSpins = relevantEntries.length;

    // Process results from each spin entry
    relevantEntries.forEach(entry => {
        const results = entry.results || [];
        results.forEach(result => {
            const delta = Number(result.gloryDelta) || 0;
            const guildId = result.guildId;

            // Track guild glory impact
            if (!wheelData.guildGloryImpact[guildId]) {
                wheelData.guildGloryImpact[guildId] = { totalGlory: 0, spinCount: 0 };
            }
            wheelData.guildGloryImpact[guildId].totalGlory += delta;
            wheelData.guildGloryImpact[guildId].spinCount++;

            // Track biggest single glory swing
            if (!wheelData.biggestGlorySwing || delta > wheelData.biggestGlorySwing.gloryDelta) {
                wheelData.biggestGlorySwing = {
                    gloryDelta: delta,
                    segmentLabel: result.segmentLabel || 'Unknown',
                    segmentDescription: result.segmentDescription || '',
                    rarity: result.rarity || 'common',
                    guildId,
                    weekKey: entry.weekKey
                };
            }

            // Track notable spins (any non-zero glory change)
            if (delta !== 0) {
                wheelData.notableSpins.push({
                    gloryDelta: delta,
                    segmentLabel: result.segmentLabel || 'Unknown',
                    rarity: result.rarity || 'common',
                    guildId,
                    weekKey: entry.weekKey
                });
            }
        });
    });

    // Sort notable spins by absolute glory impact
    wheelData.notableSpins.sort((a, b) => Math.abs(b.gloryDelta) - Math.abs(a.gloryDelta));
    wheelData.notableSpins = wheelData.notableSpins.slice(0, 5);

    // Find luckiest guild (most net positive glory from wheel)
    const guildEntries = Object.entries(wheelData.guildGloryImpact);
    if (guildEntries.length > 0) {
        const [luckiestId, luckiestData] = guildEntries.sort(([, a], [, b]) => b.totalGlory - a.totalGlory)[0];
        const guild = getGuildById(luckiestId);
        wheelData.luckiestGuild = {
            guildId: luckiestId,
            guildName: guild?.name || 'Unknown',
            guildEmoji: guild?.emoji || '⚔️',
            totalGlory: luckiestData.totalGlory,
            spinCount: luckiestData.spinCount
        };
    }

    return wheelData;
}

/**
 * Gather Familiar data for participating classes
 */
async function gatherFamiliarData(classIds) {
    const familiarData = {
        hasData: false,
        totalHatched: 0,
        totalEggs: 0,
        levelDistribution: { 1: 0, 2: 0, 3: 0 },
        typeDistribution: {},
        mostAdvanced: [],
        totalStudents: 0
    };

    const classSet = new Set(classIds);
    const allStudents = (state.get('allStudents') || []).filter(s => classSet.has(s.classId));
    const allScores = state.get('allStudentScores') || [];

    familiarData.totalStudents = allStudents.length;

    // Import familiar helpers
    const { FAMILIAR_TYPES } = await import('./familiars.js');
    const { getUnlockedFamiliarLevel } = await import('./familiarProgression.mjs');

    allStudents.forEach(student => {
        const score = allScores.find(s => s.id === student.id);
        const familiar = score?.familiar;
        if (!familiar) return;

        if (familiar.state === 'egg') {
            familiarData.totalEggs++;
            return;
        }

        if (familiar.state !== 'alive') return;

        familiarData.totalHatched++;

        // Compute level
        const totalStars = score?.totalStars || 0;
        const level = getUnlockedFamiliarLevel(familiar, totalStars);
        if (level >= 1 && level <= 3) {
            familiarData.levelDistribution[level]++;
        }

        // Track type distribution
        const typeId = familiar.typeId;
        if (!familiarData.typeDistribution[typeId]) {
            const typeDef = FAMILIAR_TYPES[typeId];
            familiarData.typeDistribution[typeId] = {
                typeId,
                name: typeDef?.name || typeId,
                emoji: typeDef?.eggIcon || '🥚',
                count: 0
            };
        }
        familiarData.typeDistribution[typeId].count++;

        // Track most advanced (level 3)
        if (level === 3) {
            familiarData.mostAdvanced.push({
                studentId: student.id,
                studentName: student.name,
                avatar: student.avatar,
                familiarName: familiar.name || 'Unnamed',
                typeId,
                typeName: FAMILIAR_TYPES[typeId]?.name || typeId,
                levelNames: FAMILIAR_TYPES[typeId]?.levelNames || [],
                classId: student.classId
            });
        }
    });

    familiarData.hasData = familiarData.totalHatched > 0 || familiarData.totalEggs > 0;

    return familiarData;
}

// --- CEREMONY CONTROL ---

/**
 * Trigger Spirit Animal Patrol
 */
function triggerSpiritAnimalPatrol() {
    const container = document.getElementById('spirit-animal-container');
    if (!container) return;

    const animals = [
        { emoji: '🐉', color: '#ff4500', name: 'dragon' },
        { emoji: '🐻', color: '#8b4513', name: 'grizzly' },
        { emoji: '🦉', color: '#ffd700', name: 'owl' },
        { emoji: '🔥', color: '#ff69b4', name: 'phoenix' }
    ];

    animals.forEach((animal, index) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'spirit-animal';
            el.innerText = animal.emoji;
            el.style.color = animal.color;
            el.style.animation = `spirit-flight-dragon ${5 + Math.random() * 3}s ease-in-out forwards`;
            container.appendChild(el);
            setTimeout(() => el.remove(), 8000);
        }, index * 1000);
    });
}

/**
 * Trigger Guild Particles with High Density
 */
function triggerGuildParticles(guildId = null, density = 50) {
    const container = document.getElementById('guild-particles-container');
    if (!container) return;

    const guild = guildId ? getGuildById(guildId) : null;
    const type = guild?.id === 'dragon' ? 'fire' : 
                 guild?.id === 'grizzly' ? 'earth' : 
                 guild?.id === 'owl' ? 'star' : 
                 guild?.id === 'phoenix' ? 'light' : 'star';

    for (let i = 0; i < density; i++) {
        const el = document.createElement('div');
        el.className = `${type}-particle`;
        el.style.position = 'absolute';
        el.style.left = Math.random() * 100 + '%';
        el.style.top = Math.random() * 100 + '%';
        el.style.setProperty('--delay', Math.random() * 2 + 's');
        el.style.setProperty('--duration', (2 + Math.random() * 3) + 's');
        el.style.setProperty('--x', Math.random() * 100 + '%');
        el.style.setProperty('--y', Math.random() * 100 + '%');
        container.appendChild(el);
        
        // Auto-remove after some time to prevent DOM bloat
        setTimeout(() => el.remove(), 5000);
    }
}

/**
 * Update Ceremony Atmosphere based on phase
 */
function updateAtmosphere(phase) {
    const screen = document.getElementById('grand-guild-ceremony-screen');
    const bg = document.getElementById('ceremony-bg-gradient');
    if (!screen || !bg) return;

    const phaseStyles = {
        intro: 'radial-gradient(circle at center, #1e1b4b 0%, #312e81 40%, #0f172a 100%)',
        heroGallery: 'radial-gradient(circle at center, #312e81 0%, #1e3a8a 40%, #0f172a 100%)',
        teamQuest: 'radial-gradient(circle at center, #1e3a8a 0%, #1e40af 40%, #0f172a 100%)',
        prodigyTimeline: 'radial-gradient(circle at center, #4c1d95 0%, #5b21b6 40%, #0f172a 100%)',
        fortuneWheel: 'radial-gradient(circle at center, #581c87 0%, #7e22ce 40%, #1e1b4b 100%)',
        familiars: 'radial-gradient(circle at center, #064e3b 0%, #065f46 40%, #0f172a 100%)',
        guildChampions: 'radial-gradient(circle at center, #92400e 0%, #b45309 40%, #0f172a 100%)',
        hallOfHeroes: 'radial-gradient(circle at center, #065f46 0%, #064e3b 40%, #0f172a 100%)',
        end: 'radial-gradient(circle at center, #1e1b4b 0%, #312e81 40%, #0f172a 100%)'
    };

    bg.style.background = phaseStyles[phase] || phaseStyles.intro;
    
    // Trigger Spirit Animal Patrol on major transitions
    if (['heroGallery', 'teamQuest', 'prodigyTimeline', 'fortuneWheel', 'familiars', 'guildChampions', 'hallOfHeroes'].includes(phase)) {
        triggerSpiritAnimalPatrol();
    }
}

/**
 * Trigger Legendary Aura for an element
 */
function triggerLegendaryAura(container) {
    if (!container) return;
    const aura = document.createElement('div');
    aura.className = 'legendary-aura';
    container.appendChild(aura);
}

/**
 * Check if any classes have their ceremony today
 */
export function checkCeremonyActivation() {
    const today = utils.getTodayDateString();
    const teacherSettings = state.get('teacherSettings') || {};
    const classEndDates = teacherSettings.schoolYearSettings?.classEndDates || {};
    const myClassIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));

    const participatingClasses = [];

    Object.entries(classEndDates).forEach(([classId, endDate]) => {
        if (!myClassIds.has(classId)) return;
        if (utils.datesMatch(endDate, today)) {
            participatingClasses.push(classId);
        }
    });

    return participatingClasses;
}

/**
 * Update ceremony button visibility. Grand Guild Ceremony is Pro+ (guilds feature).
 */
export function updateCeremonyButtons() {
    if (!canUseFeature('guilds')) {
        [document.getElementById('grand-guild-ceremony-btn-home'), document.getElementById('grand-guild-ceremony-btn-class')].forEach(btn => { if (btn) btn.classList.add('hidden'); });
        return;
    }
    const participatingClasses = checkCeremonyActivation();
    const hasActiveCeremony = participatingClasses.length > 0;

    // Update Home tab buttons
    updateHomeCeremonyButtons(participatingClasses);
}

/**
 * Update Home tab ceremony buttons — toggle visibility only, don't replace innerHTML.
 */
function updateHomeCeremonyButtons(participatingClasses) {
    const hasActiveCeremony = participatingClasses.length > 0;

    // School-wide home button
    const schoolHomeButton = document.getElementById('grand-guild-ceremony-btn-home');
    if (schoolHomeButton) {
        schoolHomeButton.classList.toggle('hidden', !hasActiveCeremony);
    }

    // Class-specific home button
    const currentClassId = state.get('globalSelectedClassId');
    const classHomeButton = document.getElementById('grand-guild-ceremony-btn-class');
    if (classHomeButton) {
        const showClassBtn = currentClassId && participatingClasses.includes(currentClassId);
        classHomeButton.classList.toggle('hidden', !showClassBtn);
    }
}

/**
 * Start the Grand Guild Ceremony. Pro+ only (guilds feature).
 */
export async function startGrandGuildCeremony(classIds = null) {
    if (!canUseFeature('guilds')) {
        const { showUpgradePrompt } = await import('../utils/upgradePrompt.js');
        const { getUpgradeMessage } = await import('../config/tiers/features.js');
        showUpgradePrompt('Pro', { message: getUpgradeMessage('Pro', 'default') });
        return;
    }
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
            guildChampions: {},
            fortuneWheel: {},
            familiars: {}
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
        const [heroData, teamQuestData, prodigyData, guildData, fortuneWheelData, familiarData] = await Promise.all([
            gatherHeroOfTheDayData(participatingClasses),
            gatherTeamQuestData(participatingClasses),
            gatherProdigyData(participatingClasses),
            gatherGuildData(participatingClasses),
            gatherFortuneWheelData(participatingClasses),
            gatherFamiliarData(participatingClasses)
        ]);
        
        ceremonyData.competitionData = {
            heroOfTheDay: heroData,
            teamQuest: teamQuestData,
            prodigyOfTheMonth: prodigyData,
            guildChampions: guildData,
            fortuneWheel: fortuneWheelData,
            familiars: familiarData
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
    
    // Update atmosphere for the current phase
    updateAtmosphere(ceremonyData.phase);
    
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
            ceremonyData.phase = 'fortuneWheel';
            btn.innerText = "See Fortune's Wheel";
            break;

        case 'fortuneWheel':
            await renderFortuneWheelRetrospective();
            ceremonyData.phase = 'familiars';
            btn.innerText = "Meet Familiar Companions";
            break;

        case 'familiars':
            await renderFamiliarShowcase();
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
        <div class="text-center text-white animate-entrance">
            <div class="text-8xl mb-6 drop-shadow-[0_0_30px_rgba(255,215,0,0.6)]">🏆</div>
            <h2 class="font-title text-6xl mb-4 victory-text">Welcome to the Ultimate Celebration</h2>
            <p class="text-2xl mb-8 text-indigo-200">Honoring Heroes, Champions, and Guild Legends</p>
            
            <div class="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:scale-110 transition-transform">
                    <div class="text-4xl mb-3">🌟</div>
                    <div class="font-bold text-xl">Hero of the Day</div>
                    <div class="text-sm opacity-75">Daily Champions</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:scale-110 transition-transform">
                    <div class="text-4xl mb-3">🗺️</div>
                    <div class="font-bold text-xl">Team Quest</div>
                    <div class="text-sm opacity-75">Class Journey</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:scale-110 transition-transform">
                    <div class="text-4xl mb-3">👑</div>
                    <div class="font-bold text-xl">Prodigy</div>
                    <div class="text-sm opacity-75">Monthly Stars</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:scale-110 transition-transform">
                    <div class="text-4xl mb-3">🎡</div>
                    <div class="font-bold text-xl">Fortune's Wheel</div>
                    <div class="text-sm opacity-75">Guild Fates</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:scale-110 transition-transform">
                    <div class="text-4xl mb-3">🐾</div>
                    <div class="font-bold text-xl">Familiars</div>
                    <div class="text-sm opacity-75">Companion Bonds</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:scale-110 transition-transform">
                    <div class="text-4xl mb-3">🛡️</div>
                    <div class="font-bold text-xl">Guilds</div>
                    <div class="text-sm opacity-75">Year Champions</div>
                </div>
            </div>
        </div>
    `;
    
    triggerGuildParticles(null, 100);
    
    // AI commentary
    triggerAICommentary('grand_opening', {
        classCount: ceremonyData.participatingClasses.length,
        competitionLevels: ['Hero of the Day', 'Team Quest', 'Prodigy of the Month', 'Fortune\'s Wheel', 'Familiar Companions', 'Guild Champions']
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
        <div class="text-white w-full max-w-5xl animate-entrance">
            <h3 class="font-title text-4xl text-center mb-8 victory-text">Daily Champions Throughout the Year</h3>
            <div class="text-center mb-8">
                <span class="text-2xl bg-white/10 px-6 py-2 rounded-full border border-white/20">${heroOfTheDay.totalDays} days of heroic achievements!</span>
            </div>
    `;
    
    // Most frequent hero
    if (heroOfTheDay.mostFrequent) {
        const hero = heroOfTheDay.mostFrequent;
        galleryHTML += `
            <div id="most-frequent-hero" class="bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 p-8 rounded-3xl mb-12 text-center shadow-[0_0_50px_rgba(245,158,11,0.4)] border-4 border-white/30 relative overflow-hidden group">
                <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <h4 class="font-title text-3xl mb-4">Most Frequent Hero</h4>
                <div class="relative inline-block mb-4">
                    <div class="absolute inset-0 bg-white blur-2xl opacity-30 animate-pulse"></div>
                    <div class="text-8xl relative z-10">${hero.avatar ? `<img src="${hero.avatar}" class="w-32 h-32 rounded-full border-8 border-white mx-auto shadow-2xl">` : hero.studentName.charAt(0)}</div>
                </div>
                <div class="font-bold text-3xl mb-2">${hero.studentName}</div>
                <div class="text-xl opacity-90 mb-4">Hero for ${hero.frequency} days!</div>
                <div class="text-4xl font-bold">⭐ ${hero.frequency} Daily Victories</div>
            </div>
        `;
    }
    
    // Recent heroes gallery
    const recentHeroes = heroOfTheDay.dailyHeroes.slice(-12).reverse();
    galleryHTML += `
        <div class="grid grid-cols-3 md:grid-cols-4 gap-6">
            ${recentHeroes.map(hero => `
                <div class="hero-card bg-white/5 backdrop-blur-sm p-4 rounded-2xl text-center border border-white/10 hover:border-white/40 transition-all">
                    <div class="relative inline-block mb-2">
                        <div class="text-4xl">${hero.avatar ? `<img src="${hero.avatar}" class="w-16 h-16 rounded-full border-2 border-white mx-auto">` : hero.studentName.charAt(0)}</div>
                    </div>
                    <div class="text-lg font-bold truncate mb-1">${hero.studentName}</div>
                    <div class="text-sm text-amber-300 font-bold">${hero.stars} stars</div>
                </div>
            `).join('')}
        </div>
    </div>`;
    
    stage.innerHTML = galleryHTML;
    
    // Add aura to most frequent hero
    setTimeout(() => {
        const mostFrequentEl = document.getElementById('most-frequent-hero');
        if (mostFrequentEl) triggerLegendaryAura(mostFrequentEl);
    }, 100);
    
    triggerGuildParticles(null, 60);
    
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
        <div class="text-white w-full max-w-4xl animate-entrance">
            <h3 class="font-title text-4xl text-center mb-10 victory-text">The Year-Long Team Quest</h3>
    `;
    
    // Final standings
    journeyHTML += `
        <div class="mb-12">
            <h4 class="font-title text-2xl mb-6 text-center text-indigo-200">Final Class Standings</h4>
            <div class="space-y-4">
                ${teamQuest.finalStandings.slice(0, 5).map((classData, index) => {
                    const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                    const isWinner = index === 0;
                    return `
                        <div class="team-quest-ranking bg-white/10 backdrop-blur-md p-5 rounded-2xl flex items-center justify-between border ${isWinner ? 'border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.3)] scale-105' : 'border-white/10'} hover:bg-white/20 transition-all">
                            <div class="flex items-center gap-6">
                                <span class="text-4xl ${isWinner ? 'animate-bounce' : ''}">${rankEmoji}</span>
                                <span class="text-5xl drop-shadow-lg">${classData.class.logo}</span>
                                <div>
                                    <div class="font-bold text-2xl">${classData.class.name}</div>
                                    <div class="text-lg opacity-75">${classData.studentCount} students</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-3xl font-black text-amber-400">${classData.totalYearStars.toLocaleString()}</div>
                                <div class="text-sm opacity-75 uppercase tracking-widest font-bold">total stars</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    journeyHTML += `</div>`;
    stage.innerHTML = journeyHTML;
    
    triggerGuildParticles(null, 40);
    
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
        <div class="text-white w-full max-w-6xl animate-entrance">
            <h3 class="font-title text-4xl text-center mb-10 victory-text">Monthly Champions Throughout the Year</h3>
    `;
    
    // Top prodigies
    const topProdigies = Object.values(prodigyOfTheMonth.cumulativeStats)
        .sort((a, b) => b.monthsWon - a.monthsWon)
        .slice(0, 3);
    
    timelineHTML += `
        <div class="mb-12">
            <h4 class="font-title text-2xl mb-8 text-center text-purple-200">Most Celebrated Students</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                ${topProdigies.map((prodigy, index) => {
                    const rankEmoji = index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉';
                    const colors = index === 0 ? 'from-amber-400 to-yellow-600' : index === 1 ? 'from-slate-300 to-slate-500' : 'from-orange-400 to-orange-700';
                    return `
                        <div class="prodigy-card bg-gradient-to-br ${colors} p-8 rounded-3xl text-center shadow-2xl transform hover:scale-105 transition-transform border-4 border-white/40">
                            <div class="text-5xl mb-4 drop-shadow-md">${rankEmoji}</div>
                            <div class="relative inline-block mb-4">
                                <div class="absolute inset-0 bg-white blur-xl opacity-20"></div>
                                <div class="text-6xl relative z-10">${prodigy.avatar ? `<img src="${prodigy.avatar}" class="w-24 h-24 rounded-full border-4 border-white mx-auto shadow-lg">` : prodigy.studentName.charAt(0)}</div>
                            </div>
                            <div class="font-bold text-2xl mb-2">${prodigy.studentName}</div>
                            <div class="text-3xl font-black mb-1">${prodigy.monthsWon} Monthly Wins</div>
                            <div class="text-lg opacity-90">${prodigy.totalStars.toLocaleString()} total stars</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    timelineHTML += `</div>`;
    stage.innerHTML = timelineHTML;
    
    triggerGuildParticles(null, 80);
    
    triggerAICommentary('prodigy_timeline', {
        totalChampions: prodigyOfTheMonth.monthlyChampions.length,
        topProdigy: topProdigies[0]
    });
}

/**
 * Render Fortune's Wheel Retrospective phase
 */
async function renderFortuneWheelRetrospective() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const { fortuneWheel } = ceremonyData.competitionData;

    title.innerHTML = "Fortune's Wheel Retrospective";

    if (!fortuneWheel.hasData) {
        stage.innerHTML = `
            <div class="text-center text-white animate-entrance">
                <div class="text-9xl mb-8 drop-shadow-[0_0_40px_rgba(168,85,247,0.5)]">🎰</div>
                <h2 class="font-title text-5xl mb-6 victory-text">The Wheel Awaits</h2>
                <p class="text-2xl text-purple-200 italic font-serif">"Destiny has not yet been spun this year — the Wheel's fortune awaits next session!"</p>
                <div class="mt-8 flex justify-center gap-4">
                    <div class="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                        <div class="text-3xl mb-2">🎡</div>
                        <div class="text-sm opacity-75">Ready for Next Year</div>
                    </div>
                </div>
            </div>
        `;
        triggerGuildParticles(null, 30);
        triggerAICommentary('fortune_wheel', { hasData: false });
        return;
    }

    const rarityColors = {
        common: 'from-slate-400 to-slate-600',
        uncommon: 'from-green-400 to-emerald-600',
        rare: 'from-blue-400 to-indigo-600',
        epic: 'from-purple-400 to-violet-600',
        legendary: 'from-amber-400 to-orange-600',
        mythic: 'from-rose-400 via-pink-500 to-fuchsia-600'
    };

    let wheelHTML = `
        <div class="text-white w-full max-w-5xl animate-entrance">
            <h3 class="font-title text-4xl text-center mb-10 victory-text">The Fortune's Wheel — Year in Review</h3>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                    <div class="text-4xl mb-3">🎡</div>
                    <div class="font-bold text-4xl text-purple-400">${fortuneWheel.totalSpins}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Total Spins</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                    <div class="text-4xl mb-3">⚡</div>
                    <div class="font-bold text-4xl text-amber-400">${fortuneWheel.biggestGlorySwing ? '+' + fortuneWheel.biggestGlorySwing.gloryDelta.toLocaleString() : '—'}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Biggest Glory Swing</div>
                </div>
                <div class="bg-gradient-to-br from-amber-400/20 to-orange-500/20 backdrop-blur-md p-6 rounded-3xl border border-amber-400/40 text-center col-span-2 md:col-span-1">
                    <div class="text-4xl mb-3">${fortuneWheel.luckiestGuild?.guildEmoji || '🍀'}</div>
                    <div class="font-bold text-2xl text-amber-300">${fortuneWheel.luckiestGuild?.guildName || '—'}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Luckiest Guild</div>
                    ${fortuneWheel.luckiestGuild ? `<div class="text-sm text-amber-400 mt-1">+${fortuneWheel.luckiestGuild.totalGlory.toLocaleString()} Glory</div>` : ''}
                </div>
            </div>
    `;

    // Notable spins
    if (fortuneWheel.notableSpins.length > 0) {
        wheelHTML += `
            <h4 class="font-title text-2xl mb-6 text-center text-purple-200">Most Dramatic Spins</h4>
            <div class="space-y-3 mb-8">
                ${fortuneWheel.notableSpins.map(spin => {
                    const guild = getGuildById(spin.guildId);
                    const colorClass = rarityColors[spin.rarity] || rarityColors.common;
                    const isPositive = spin.gloryDelta > 0;
                    return `
                        <div class="bg-gradient-to-r ${colorClass} bg-opacity-20 backdrop-blur-md p-4 rounded-2xl flex items-center justify-between border border-white/10">
                            <div class="flex items-center gap-4">
                                <span class="text-3xl">${guild?.emoji || '⚔️'}</span>
                                <div>
                                    <div class="font-bold text-lg">${spin.segmentLabel}</div>
                                    <div class="text-sm opacity-75">${guild?.name || 'Unknown Guild'} • ${spin.rarity}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-2xl font-black ${isPositive ? 'text-green-400' : 'text-red-400'}">
                                    ${isPositive ? '+' : ''}${spin.gloryDelta.toLocaleString()} ⚜️
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    wheelHTML += `</div>`;
    stage.innerHTML = wheelHTML;

    triggerGuildParticles(null, 60);
    triggerAICommentary('fortune_wheel', { hasData: true, totalSpins: fortuneWheel.totalSpins, luckiestGuild: fortuneWheel.luckiestGuild });
}

/**
 * Render Familiar Companions phase
 */
async function renderFamiliarShowcase() {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const { familiars } = ceremonyData.competitionData;

    title.innerHTML = "Familiar Companions";

    if (!familiars.hasData) {
        stage.innerHTML = `
            <div class="text-center text-white animate-entrance">
                <div class="text-9xl mb-8 drop-shadow-[0_0_40px_rgba(16,185,129,0.5)]">🥚</div>
                <h2 class="font-title text-5xl mb-6 victory-text">Familiars Await</h2>
                <p class="text-2xl text-emerald-200 italic font-serif">"No companions have been discovered yet — the bond between hero and familiar awaits next session!"</p>
                <div class="mt-8 flex justify-center gap-4">
                    <div class="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                        <div class="text-3xl mb-2">🐾</div>
                        <div class="text-sm opacity-75">Ready for Heroes</div>
                    </div>
                </div>
            </div>
        `;
        triggerGuildParticles(null, 30);
        triggerAICommentary('familiars', { hasData: false });
        return;
    }

    const typeEmojis = { emberfang: '🔥', frostpaw: '❄️', thornback: '🌿', veilshade: '🌑', sparkling: '✨' };

    let familiarHTML = `
        <div class="text-white w-full max-w-5xl animate-entrance">
            <h3 class="font-title text-4xl text-center mb-10 victory-text">Familiar Companions — A Year of Bonds</h3>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                    <div class="text-4xl mb-3">🐾</div>
                    <div class="font-bold text-4xl text-emerald-400">${familiars.totalHatched}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Familiars Hatched</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                    <div class="text-4xl mb-3">🥚</div>
                    <div class="font-bold text-4xl text-amber-400">${familiars.totalEggs}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Eggs Incubating</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                    <div class="text-4xl mb-3">⭐</div>
                    <div class="font-bold text-4xl text-purple-400">${familiars.levelDistribution[3] || 0}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Max Level (L3)</div>
                </div>
                <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center">
                    <div class="text-4xl mb-3">📊</div>
                    <div class="font-bold text-4xl text-blue-400">${familiars.totalStudents}</div>
                    <div class="text-xs opacity-75 uppercase tracking-widest font-black mt-1">Total Students</div>
                </div>
            </div>
    `;

    // Type distribution
    const typeEntries = Object.values(familiars.typeDistribution);
    if (typeEntries.length > 0) {
        familiarHTML += `
            <h4 class="font-title text-2xl mb-6 text-center text-emerald-200">Familiar Types</h4>
            <div class="grid grid-cols-3 md:grid-cols-5 gap-4 mb-10">
                ${typeEntries.sort((a, b) => b.count - a.count).map(type => `
                    <div class="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 text-center hover:scale-105 transition-transform">
                        <div class="text-4xl mb-2">${typeEmojis[type.typeId] || type.emoji}</div>
                        <div class="font-bold text-lg">${type.name}</div>
                        <div class="text-2xl font-black text-emerald-400 mt-1">${type.count}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Level distribution bar
    const totalLeveled = (familiars.levelDistribution[1] || 0) + (familiars.levelDistribution[2] || 0) + (familiars.levelDistribution[3] || 0);
    if (totalLeveled > 0) {
        familiarHTML += `
            <h4 class="font-title text-2xl mb-6 text-center text-emerald-200">Level Distribution</h4>
            <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 mb-10">
                <div class="flex items-center gap-2 mb-4">
                    <div class="flex-1 h-8 rounded-full overflow-hidden flex">
                        ${familiars.levelDistribution[1] > 0 ? `<div class="bg-gradient-to-r from-green-400 to-emerald-500 h-full flex items-center justify-center text-xs font-bold" style="width: ${(familiars.levelDistribution[1] / totalLeveled) * 100}%">L1: ${familiars.levelDistribution[1]}</div>` : ''}
                        ${familiars.levelDistribution[2] > 0 ? `<div class="bg-gradient-to-r from-blue-400 to-indigo-500 h-full flex items-center justify-center text-xs font-bold" style="width: ${(familiars.levelDistribution[2] / totalLeveled) * 100}%">L2: ${familiars.levelDistribution[2]}</div>` : ''}
                        ${familiars.levelDistribution[3] > 0 ? `<div class="bg-gradient-to-r from-amber-400 to-orange-500 h-full flex items-center justify-center text-xs font-bold" style="width: ${(familiars.levelDistribution[3] / totalLeveled) * 100}%">L3: ${familiars.levelDistribution[3]}</div>` : ''}
                    </div>
                </div>
                <div class="flex justify-between text-xs opacity-75">
                    <span>Hatchling</span>
                    <span>Growing</span>
                    <span>Legendary</span>
                </div>
            </div>
        `;
    }

    // Most Advanced Familiars (Level 3)
    if (familiars.mostAdvanced.length > 0) {
        familiarHTML += `
            <h4 class="font-title text-2xl mb-6 text-center text-amber-200">Legendary Companions (Level 3)</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${familiars.mostAdvanced.slice(0, 6).map(hero => `
                    <div class="bg-gradient-to-r from-amber-400/20 to-orange-500/20 backdrop-blur-md p-5 rounded-2xl border border-amber-400/40 flex items-center gap-4">
                        <div class="text-4xl">${typeEmojis[hero.typeId] || '🐾'}</div>
                        <div class="flex-1">
                            <div class="font-bold text-lg">${hero.studentName}</div>
                            <div class="text-sm text-amber-300">${hero.familiarName} — ${hero.levelNames[2] || hero.typeName}</div>
                        </div>
                        <div class="text-2xl">⭐</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    familiarHTML += `</div>`;
    stage.innerHTML = familiarHTML;

    triggerGuildParticles(null, 60);
    triggerAICommentary('familiars', { hasData: true, totalHatched: familiars.totalHatched, mostAdvanced: familiars.mostAdvanced });
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
        <div class="text-white w-full max-w-5xl animate-entrance">
            <h3 class="font-title text-4xl text-center mb-10 victory-text">The Ultimate Guild Champions</h3>
    `;
    
    if (guildChampions.winningGuild) {
        const winner = guildChampions.winningGuild;
        crowningHTML += `
            <div id="guild-winner-card" class="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 p-10 rounded-[3rem] mb-12 text-center shadow-[0_0_100px_rgba(251,191,36,0.5)] border-8 border-white/40 relative overflow-hidden group">
                <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="absolute -top-10 -left-10 w-40 h-40 bg-white/20 blur-3xl rounded-full"></div>
                <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 blur-3xl rounded-full"></div>
                
                <h4 class="font-title text-4xl mb-6 flex items-center justify-center gap-4">
                    <span class="animate-bounce">🏆</span> 
                    Winning Guild 
                    <span class="animate-bounce">🏆</span>
                </h4>
                <div class="text-9xl mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-pulse">${winner.guildEmoji}</div>
                <div class="font-title text-5xl mb-4 tracking-widest">${winner.guildName}</div>
                <div class="text-3xl font-black mb-2">${winner.totalStars.toLocaleString()} Total Stars</div>
                <div class="text-xl opacity-90 mb-8 uppercase tracking-widest">${winner.memberCount} Members Strong</div>
                
                <div class="bg-black/20 p-6 rounded-2xl inline-block backdrop-blur-md border border-white/20">
                    <div class="font-bold text-lg mb-2 text-amber-200">LEGENDARY CONTRIBUTOR:</div>
                    <div class="text-3xl font-bold">${winner.topContributor.name}</div>
                    <div class="text-xl text-amber-400 font-black mt-1">${winner.topContributor.totalStars.toLocaleString()} stars</div>
                </div>
            </div>
        `;
    }
    
    // All guild rankings
    crowningHTML += `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${guildChampions.finalRankings.map((guild, index) => {
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                const isWinner = index === 0;
                return `
                    <div class="bg-white/10 backdrop-blur-md p-6 rounded-3xl border ${isWinner ? 'border-amber-400 hidden' : 'border-white/20'} flex items-center justify-between hover:bg-white/20 transition-all">
                        <div class="flex items-center gap-4">
                            <span class="text-4xl">${rankEmoji}</span>
                            <span class="text-5xl drop-shadow-md">${guild.guildEmoji}</span>
                            <div>
                                <span class="font-title text-2xl block">${guild.guildName}</span>
                                <span class="text-sm opacity-75 uppercase tracking-widest">${guild.memberCount} members</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-black text-amber-400">${guild.totalStars.toLocaleString()}</div>
                            <div class="text-xs opacity-60 font-bold uppercase tracking-tighter">Stars</div>
                        </div>
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
    
    // Effects
    setTimeout(() => {
        const winnerCard = document.getElementById('guild-winner-card');
        if (winnerCard) triggerLegendaryAura(winnerCard);
        triggerGuildParticles(guildChampions.winningGuild?.guildId, 150);
        triggerFireworks();
        triggerConfetti();
    }, 100);
    
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
        <div class="text-white text-center w-full max-w-5xl animate-entrance">
            <h3 class="font-title text-5xl mb-8 victory-text">A Year of Excellence</h3>
            <div class="text-9xl mb-8 animate-pulse drop-shadow-[0_0_50px_rgba(255,215,0,0.4)]">🌟</div>
            <p class="text-3xl mb-12 text-indigo-200 italic font-serif">"Every Achievement, Every Hero, Every Moment — Forever in our Hearts"</p>
            
            <div class="hall-of-heroes p-12 rounded-[4rem] relative overflow-hidden">
                <div class="absolute inset-0 bg-white/5 backdrop-blur-xl"></div>
                <div class="relative z-10">
                    <h4 class="font-title text-3xl mb-8 tracking-widest text-amber-400">SCHOOL YEAR ${getCeremonyYearKey()} HIGHLIGHTS</h4>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-8">
                        <div class="bg-black/30 p-6 rounded-3xl border border-white/10">
                            <div class="text-5xl mb-4">🌟</div>
                            <div class="font-bold text-3xl mb-1">${ceremonyData.competitionData.heroOfTheDay.totalDays}</div>
                            <div class="text-xs opacity-75 uppercase tracking-widest font-black">Daily Heroes</div>
                        </div>
                        <div class="bg-black/30 p-6 rounded-3xl border border-white/10">
                            <div class="text-5xl mb-4">🗺️</div>
                            <div class="font-bold text-3xl mb-1">${ceremonyData.competitionData.teamQuest.finalStandings.length}</div>
                            <div class="text-xs opacity-75 uppercase tracking-widest font-black">Class Quests</div>
                        </div>
                        <div class="bg-black/30 p-6 rounded-3xl border border-white/10">
                            <div class="text-5xl mb-4">👑</div>
                            <div class="font-bold text-3xl mb-1">${ceremonyData.competitionData.prodigyOfTheMonth.monthlyChampions.length}</div>
                            <div class="text-xs opacity-75 uppercase tracking-widest font-black">Prodigies</div>
                        </div>
                        <div class="bg-black/30 p-6 rounded-3xl border border-white/10">
                            <div class="text-5xl mb-4">🎡</div>
                            <div class="font-bold text-3xl mb-1">${ceremonyData.competitionData.fortuneWheel.totalSpins || 0}</div>
                            <div class="text-xs opacity-75 uppercase tracking-widest font-black">Wheel Spins</div>
                        </div>
                        <div class="bg-black/30 p-6 rounded-3xl border border-white/10">
                            <div class="text-5xl mb-4">🐾</div>
                            <div class="font-bold text-3xl mb-1">${ceremonyData.competitionData.familiars.totalHatched || 0}</div>
                            <div class="text-xs opacity-75 uppercase tracking-widest font-black">Familiars</div>
                        </div>
                        <div class="bg-black/30 p-6 rounded-3xl border border-white/10">
                            <div class="text-5xl mb-4">🛡️</div>
                            <div class="font-bold text-3xl mb-1">${ceremonyData.competitionData.guildChampions.finalRankings.length}</div>
                            <div class="text-xs opacity-75 uppercase tracking-widest font-black">Guilds</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-16 animate-bounce">
                <div class="text-5xl mb-4">🎓</div>
                <p class="text-3xl font-title tracking-widest victory-text">Congratulations to All Students!</p>
                <p class="text-xl opacity-75 italic mt-2">You've made this year truly unforgettable.</p>
            </div>
        </div>
    `;
    
    stage.innerHTML = hallHTML;
    
    // Trigger celebration effects
    triggerConfetti();
    triggerFireworks();
    triggerGuildParticles(null, 100);
    
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
        <div class="text-center text-white animate-entrance">
            <div class="text-9xl mb-8 drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">🎉</div>
            <h2 class="font-title text-6xl mb-6 victory-text">Thank You for an Amazing Year!</h2>
            <p class="text-2xl mb-12 text-indigo-200">The Grand Guild Ceremony concludes with pride and joy.</p>
            <div class="text-[12rem] animate-bounce drop-shadow-[0_0_80px_rgba(251,191,36,0.6)]">🏆</div>
        </div>
    `;
    
    btn.innerText = "Close Ceremony";
    btn.onclick = closeCeremony;
    
    // Save ceremony completion
    await saveCeremonyCompletion();
    
    // Final celebration
    triggerConfetti();
    triggerFireworks();
    triggerGuildParticles(null, 200);
    
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
            guildChampions: {},
            fortuneWheel: {},
            familiars: {}
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
        
        await setDoc(teacherRef, {
            grandCeremonyHistory: { [ceremonyDate]: ceremonyData }
        }, { merge: true });
        
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

            case 'fortune_wheel':
                if (data.hasData) {
                    prompt = `The Fortune's Wheel has been spun ${data.totalSpins} times this year! ${data.luckiestGuild ? `The ${data.luckiestGuild.guildName} guild was the luckiest, gaining ${data.luckiestGuild.totalGlory} glory from the wheel!` : ''} Create an exciting message about fate, luck, and the drama of the wheel.`;
                } else {
                    prompt = `The Fortune's Wheel has not been spun yet this year. Create a hopeful, anticipatory message about destiny and the excitement of what the wheel may bring next session.`;
                }
                break;

            case 'familiars':
                if (data.hasData) {
                    prompt = `${data.totalHatched} familiar companions have been hatched this year! ${data.mostAdvanced && data.mostAdvanced.length > 0 ? `The most advanced familiars reached Level 3, including ${data.mostAdvanced.slice(0, 2).map(h => `${h.studentName}'s ${h.familiarName}`).join(' and ')}!` : ''} Create a heartwarming message about the bond between students and their magical companions.`;
                } else {
                    prompt = `No familiar companions have been discovered yet. Create an exciting message about the potential of these magical creatures and the bonds that await.`;
                }
                break;

            case 'guild_crowning':
                prompt = `The moment we've all been waiting for! ${data.winningGuild ? `The ${data.winningGuild.guildName} guild wins with ${data.winningGuild.totalStars} stars!` : ''} Create an epic, celebratory message for the guild champion announcement.`;
                break;
                
            case 'hall_of_heroes':
                prompt = `The ultimate celebration of a year filled with excellence! Create a heartfelt, emotional message that brings closure to the ceremony and celebrates every student's journey.`;
                break;
                
            default:
                prompt = 'Continue the ceremony with enthusiasm and celebration!';
        }
        
        const genericByPhase = {
            grand_opening: "Welcome to the Grand Guild Ceremony!",
            hero_gallery: "Celebrating our daily heroes from throughout the year!",
            team_quest_journey: "The Team Quest journey — what a year!",
            prodigy_timeline: "Celebrating our monthly prodigies!",
            fortune_wheel: "The Fortune's Wheel — destiny has been spun!",
            familiars: "Celebrating our familiar companions and the bonds we've formed!",
            guild_crowning: "The moment we've all been waiting for — the guild champion!",
            'hall_of_heroes': "Here's to a year of excellence. Congratulations, everyone!"
        };
        const genericMessage = genericByPhase[phase] || 'Congratulations to everyone!';

        const aiText = document.getElementById('ceremony-ai-text');
        if (canUseFeature('eliteAI')) {
            const response = await callGeminiApi(prompt);
            if (aiText && response) aiText.innerText = response;
        } else if (aiText) {
            aiText.innerText = genericMessage;
        }
        
    } catch (error) {
        console.error('Error generating AI commentary:', error);
        const aiTextFallback = document.getElementById('ceremony-ai-text');
        if (aiTextFallback) aiTextFallback.innerText = genericMessage || 'Congratulations to everyone!';
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
