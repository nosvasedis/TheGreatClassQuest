
// --- AI & REPORTING MODALS ---

export async function handleGetQuestUpdate() {
    const narrativeContainer = document.getElementById('narrative-text-container');
    const playBtn = document.getElementById('play-narrative-btn');

    if (!state.get('globalSelectedLeague')) {
        showToast('Please select a league first!', 'error');
        return;
    }

    playBtn.classList.add('hidden');
    narrativeContainer.innerHTML = `<i class="fas fa-spinner fa-spin text-4xl text-purple-400"></i>`;
    showAnimatedModal('quest-update-modal');

    const GOAL_PER_STUDENT = { DIAMOND: 18 };
    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === state.get('globalSelectedLeague'));

    // Correct Calculation Logic
    const classScores = classesInLeague.map(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const scores = state.get('allStudentScores') || [];
        const monthlyStars = students.reduce((sum, s) => {
            const scoreData = scores.find(sc => sc.id === s.id);
            return sum + (scoreData ? (scoreData.monthlyStars || 0) : 0);
        }, 0);

        const BASE_GOAL = 18;
        const SCALING_FACTOR = 2.5;
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        let holidayDaysLost = 0;
        (state.get('schoolHolidayRanges') || []).forEach(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;
            if (overlapStart <= overlapEnd) {
                holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
            }
        });

        let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
        monthModifier = now.getMonth() === 5 ? 0.5 : Math.max(0.6, Math.min(1.0, monthModifier));

        const adjustedGoalPerStudent = (BASE_GOAL + ((c.difficultyLevel || 0) * SCALING_FACTOR)) * monthModifier;
        const diamondGoal = Math.round(Math.max(18, students.length * adjustedGoalPerStudent));
        const progress = diamondGoal > 0 ? ((monthlyStars / diamondGoal) * 100).toFixed(1) : 0;

        return { name: c.name, totalStars: monthlyStars, progress };
    }).sort((a, b) => b.progress - a.progress);

    const topClasses = classScores.filter(c => c.totalStars > 0).slice(0, 3);

    if (topClasses.length < 2) {
        narrativeContainer.innerHTML = `<p class="text-xl text-center">Not enough Quest data yet! At least two classes need to earn stars for a rivalry to begin!</p>`;
        return;
    }

    const classDataString = topClasses.map(c => `'${c.name}' is at ${c.progress}% of their goal with ${c.totalStars} stars`).join('. ');
    const systemPrompt = "You are a fun, exciting quest announcer for a classroom game. Do not use markdown or asterisks. Your response must be only the narrative text. You will be given the names, progress percentage, and star counts of the top classes. Write a short, exciting, 2-sentence narrative about their race to the top. IMPORTANT: The class with the highest progress percentage is in the lead, NOT the class with the most stars. Make this distinction clear in your narrative.";
    const userPrompt = `The top classes are: ${classDataString}. The first class in this list is in the lead. Write the narrative.`;

    try {
        const narrative = await callGeminiApi(systemPrompt, userPrompt);
        narrativeContainer.innerHTML = `<p>${narrative}</p>`;
        narrativeContainer.dataset.text = narrative;

    } catch (error) {
        console.error("Quest Update Narrative Error:", error);
        narrativeContainer.innerHTML = `<p class="text-xl text-center text-red-500">The Quest Announcer is taking a break. Please try again in a moment!</p>`;
    }
}

export async function handleGenerateIdea() {
    const classId = document.getElementById('gemini-class-select').value;
    if (!classId) { showToast('Please select a class first.', 'error'); return; }
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) { showToast('Could not find selected class data.', 'error'); return; }
    const ageGroup = utils.getAgeGroupForLeague(classData.questLevel);

    const btn = document.getElementById('gemini-idea-btn'), output = document.getElementById('gemini-idea-output'), copyBtn = document.getElementById('copy-idea-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Thinking...';
    output.value = ''; copyBtn.disabled = true; copyBtn.classList.add('opacity-50');

    const systemPrompt = `You are the 'Quest Master,' a helpful AI assistant for a teacher's classroom competition. You are creative, fun, and concise. Do NOT use markdown or asterisks. You will be asked to generate a 'special lesson experience' reward idea. The teacher will provide an age group. Make the idea fun, educational, and achievable in a classroom setting, and ensure it is perfectly suited for the specified age group. Format the response with a title and a 2-3 sentence description.`;
    const userPrompt = `Generate a 'special lesson experience' reward idea for students in the ${ageGroup} age group.`;
    try {
        const idea = await callGeminiApi(systemPrompt, userPrompt);
        output.value = idea;
        copyBtn.disabled = false; copyBtn.classList.remove('opacity-50');
    } catch (error) { console.error('Gemini Idea Error:', error); output.value = 'Oops! The Quest Master is busy. Please try again in a moment.'; }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lightbulb mr-2"></i> Generate New Idea'; }
}

export function copyToClipboard(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!', 'success');
}

export async function handleGetOracleInsight() {
    await ensureHistoryLoaded();
    const classId = document.getElementById('oracle-class-select').value;
    const question = document.getElementById('oracle-question-input').value.trim();
    if (!classId || !question) {
        showToast('Please select a class and ask a question.', 'error');
        return;
    }
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;

    const btn = document.getElementById('oracle-insight-btn');
    const output = document.getElementById('oracle-insight-output');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Consulting the Oracle...';
    output.value = '';

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toLocaleDateString('en-GB');

    const relevantLogs = state.get('allAwardLogs').filter(log => log.classId === classId && log.date >= oneMonthAgoStr).map(log => {
        const student = state.get('allStudents').find(s => s.id === log.studentId);
        const noteText = log.note ? ` (Note: ${log.note})` : '';
        return `On ${log.date}, ${student?.name || 'A student'} received ${log.stars} star(s) for ${log.reason}${noteText}.`;
    }).join('\n');

    const academicScores = state.get('allWrittenScores').filter(score => score.classId === classId && score.date >= oneMonthAgoStr).map(score => {
        const student = state.get('allStudents').find(s => s.id === score.studentId);
        const noteText = score.note ? ` (Note: ${score.note})` : '';
        return `On ${score.date}, ${student?.name || 'A student'} scored ${score.scoreNumeric || score.scoreQualitative} on a ${score.type}${noteText}.`;
    }).join('\n');

    const attendanceRecords = state.get('allAttendanceRecords').filter(rec => rec.classId === classId && rec.date >= oneMonthAgoStr);
    const absenceCount = attendanceRecords.length;
    const absentStudents = attendanceRecords.reduce((acc, rec) => {
        const student = state.get('allStudents').find(s => s.id === rec.studentId);
        if (student) acc.push(student.name);
        return acc;
    }, []);
    const attendanceSummary = absenceCount > 0 ? `There were ${absenceCount} absences recorded. Students absent include: ${[...new Set(absentStudents)].join(', ')}.` : 'Attendance has been perfect.';

    if (relevantLogs.length === 0 && academicScores.length === 0 && absenceCount === 0) {
        output.value = "The Oracle has no records for this class in the past month. Award some stars, log some trial scores, or mark attendance to gather insights!";
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-question-circle mr-2"></i> Ask the Oracle';
        return;
    }

    const systemPrompt = "You are 'The Oracle,' a wise and encouraging AI data analyst for a teacher. Your goal is to analyze raw award log data, academic scores, and attendance records, including any teacher notes, and answer the teacher's questions in plain English. Provide concise, actionable, and positive insights based ONLY on the data provided. If the data is insufficient, say so kindly. Format your response clearly in 2-3 sentences. Do not use markdown.";
    const userPrompt = `Here is the data for the class "${classData.name}" over the last 30 days:
- Behavioral Star Data:
${relevantLogs || 'None.'}
- Academic Score Data:
${academicScores || 'None.'}
- Attendance Data:
${attendanceSummary}

Based on ALL this data, please answer the teacher's question: "${question}"`;

    try {
        const insight = await callGeminiApi(systemPrompt, userPrompt);
        output.value = insight;
    } catch (error) {
        console.error("Oracle Insight Error:", error);
        output.value = 'The Oracle is pondering other mysteries right now. Please try again in a moment.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-question-circle mr-2"></i> Ask the Oracle';
    }
}

export function openAwardNoteModal(logId) {
    const log = state.get('allAwardLogs').find(l => l.id === logId);
    if (!log) return;
    document.getElementById('award-note-log-id-input').value = logId;
    document.getElementById('award-note-textarea').value = log.note || '';
    showAnimatedModal('award-note-modal');
}

export function openNoteModal(logId) {
    const log = state.get('allAdventureLogs').find(l => l.id === logId);
    if (!log) return;
    document.getElementById('note-log-id-input').value = logId;
    document.getElementById('note-textarea').value = log.note || '';
    showAnimatedModal('note-modal');
}

export async function openMilestoneModal(markerElement) {
    await ensureHistoryLoaded();
    const questCard = markerElement.closest('.quest-card');
    const classId = questCard.dataset.classId;
    const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classInfo) return;

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;

    // --- 1. SYNCED MATH LOGIC ---
    const BASE_GOAL = 18;
    const SCALING_FACTOR = 2.5;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let holidayDaysLost = 0;
    const ranges = state.get('schoolHolidayRanges') || [];
    ranges.forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
        }
    });

    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    monthModifier = currentMonth === 5 ? 0.5 : Math.max(0.6, Math.min(1.0, monthModifier));

    let isCompletedThisMonth = false;
    if (classInfo.questCompletedAt) {
        const completedDate = typeof classInfo.questCompletedAt.toDate === 'function' ? classInfo.questCompletedAt.toDate() : new Date(classInfo.questCompletedAt);
        if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) isCompletedThisMonth = true;
    }
    const dbDifficulty = classInfo.difficultyLevel || 0;
    const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
    const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;

    const goals = {
        bronze: Math.round(studentCount * (adjustedGoalPerStudent * 0.25)),
        silver: Math.round(studentCount * (adjustedGoalPerStudent * 0.50)),
        gold: Math.round(studentCount * (adjustedGoalPerStudent * 0.75)),
        diamond: studentCount > 0 ? Math.round(studentCount * adjustedGoalPerStudent) : 18
    };

    // --- 2. ADVANCED DATA ANALYSIS ---
    const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
        const scoreData = state.get('allStudentScores').find(score => score.id === s.id);
        return sum + (scoreData?.monthlyStars || 0);
    }, 0);

    const relevantLogs = state.get('allAwardLogs').filter(log => {
        if (log.classId !== classId) return false;
        const logDate = utils.parseDDMMYYYY(log.date);
        return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
    });

    // Weekly Momentum
    const todayDate = new Date();
    const startOfWeek = new Date(todayDate.setDate(todayDate.getDate() - todayDate.getDay() + (todayDate.getDay() === 0 ? -6 : 1)));
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyStars = relevantLogs.filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek).reduce((sum, log) => sum + log.stars, 0);

    // Trial Mastery (Class Average)
    const classTrials = state.get('allWrittenScores').filter(s => s.classId === classId && new Date(s.date).getMonth() === currentMonth);
    let totalScorePercent = 0, scoreCount = 0;
    classTrials.forEach(s => {
        if (s.scoreNumeric !== null) { totalScorePercent += (s.scoreNumeric / s.maxScore) * 100; scoreCount++; }
        else if (s.scoreQualitative === "Great!!!") { totalScorePercent += 100; scoreCount++; }
    });
    const trialMastery = scoreCount > 0 ? (totalScorePercent / scoreCount).toFixed(0) : "N/A";

    // Attendance Rate
    const absences = state.get('allAttendanceRecords').filter(r => r.classId === classId && utils.parseDDMMYYYY(r.date).getMonth() === currentMonth).length;
    const lessonDatesCount = new Set(relevantLogs.map(l => l.date)).size || 1;
    const totalPotential = studentCount * lessonDatesCount;
    const attendanceRate = totalPotential > 0 ? (((totalPotential - absences) / totalPotential) * 100).toFixed(0) : "100";

    // Top Skill
    const reasonCounts = relevantLogs.reduce((acc, log) => {
        if (['welcome_back', 'scholar_s_bonus'].includes(log.reason)) return acc;
        acc[log.reason || 'excellence'] = (acc[log.reason || 'excellence'] || 0) + log.stars;
        return acc;
    }, {});
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0].replace(/_/g, ' ') || "Teamwork";

    // --- 3. DYNAMIC UI RENDER ---
    const modalTitle = document.getElementById('milestone-modal-title');
    const modalContent = document.getElementById('milestone-modal-content');

    let milestoneName, goal, icon, color;
    if (markerElement.innerText.includes('🛡️')) { milestoneName = "Bronze Shield"; goal = goals.bronze; icon = '🛡️'; color = "blue"; }
    else if (markerElement.innerText.includes('🏆')) { milestoneName = "Silver Trophy"; goal = goals.silver; icon = '🏆'; color = "slate"; }
    else if (markerElement.innerText.includes('👑')) { milestoneName = "Golden Crown"; goal = goals.gold; icon = '👑'; color = "amber"; }
    else { milestoneName = "Diamond Quest"; goal = goals.diamond; icon = '💎'; color = "cyan"; }

    const progressPercent = goal > 0 ? Math.min(100, (currentMonthlyStars / goal) * 100).toFixed(1) : 0;
    const starsNeeded = Math.max(0, goal - currentMonthlyStars);

    modalTitle.innerHTML = `${icon} ${milestoneName}`;
    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div class="vibrant-card p-6 bg-gradient-to-b from-white to-${color}-50 border-4 border-${color}-400 shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-[3rem] text-center">
                <div class="mb-4">
                    <span class="text-4xl filter drop-shadow-md">${classInfo.logo}</span>
                    <h3 class="font-title text-4xl text-gray-800 tracking-tight mt-2">${classInfo.name}</h3>
                    <p class="text-xs font-black uppercase text-${color}-600 tracking-[0.2em] mb-4">Quest Level ${dbDifficulty + 1}</p>
                </div>
                
                <div class="relative py-4">
                    <div class="flex justify-center items-baseline gap-2 mb-2">
                        <span class="font-title text-7xl text-transparent bg-clip-text bg-gradient-to-br from-${color}-500 to-${color}-800">${currentMonthlyStars}</span>
                        <span class="font-title text-2xl text-gray-400">/ ${goal}</span>
                    </div>
                    <div class="w-full bg-gray-200/50 rounded-full h-10 border-4 border-white shadow-inner relative overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-${color}-400 to-${color}-600 transition-all duration-1000 shadow-[0_0_20px_rgba(0,0,0,0.2)]" style="width: ${progressPercent}%">
                            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                        <span class="absolute inset-0 flex items-center justify-center text-sm font-black text-gray-800 mix-blend-overlay">${progressPercent}%</span>
                    </div>
                </div>

                ${starsNeeded > 0
            ? `<div class="mt-6 bg-${color}-100/50 border-2 border-dashed border-${color}-300 rounded-2xl p-4 animate-bounce-slow">
                         <p class="text-${color}-800 font-bold text-lg"><i class="fas fa-arrow-up mr-2"></i>${starsNeeded} stars to reach ${icon}</p>
                       </div>`
            : `<div class="mt-6 bg-green-100 border-2 border-green-400 rounded-2xl p-4">
                         <p class="text-green-800 font-bold text-xl">⚔️ Milestone Claimed!</p>
                       </div>`
        }
            </div>

            <div class="grid grid-cols-1 gap-4">
                <div class="vibrant-card p-4 bg-white border-2 border-orange-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-fire-alt"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Weekly Momentum</p>
                        <p class="font-title text-3xl text-orange-700">${weeklyStars} <span class="text-sm font-sans font-bold">Stars</span></p>
                    </div>
                </div>

                <div class="vibrant-card p-4 bg-white border-2 border-purple-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-bolt"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none mb-1">Top Skill</p>
                        <p class="font-title text-3xl text-purple-700 capitalize">${topReason}</p>
                    </div>
                </div>

                <div class="vibrant-card p-4 bg-white border-2 border-green-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-graduation-cap"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-green-400 uppercase tracking-widest leading-none mb-1">Trial Mastery</p>
                        <p class="font-title text-3xl text-green-700">${trialMastery}% <span class="text-sm font-sans font-bold">Avg</span></p>
                    </div>
                </div>

                <div class="vibrant-card p-4 bg-white border-2 border-indigo-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-user-check"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Attendance Rate</p>
                        <p class="font-title text-3xl text-indigo-700">${attendanceRate}% <span class="text-sm font-sans font-bold">Show-up</span></p>
                    </div>
                </div>
            </div>
        </div>`;

    showAnimatedModal('milestone-details-modal');
}

export async function showWelcomeBackMessage(firstName, stars) {
    const modal = document.getElementById('welcome-back-modal');
    const messageEl = document.getElementById('welcome-back-message');
    const starsEl = document.getElementById('welcome-back-stars');

    starsEl.textContent = stars;
    messageEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    showAnimatedModal('welcome-back-modal');

    const systemPrompt = "You are the 'Quest Master' in a fun classroom game. You speak in short, exciting, single sentences. Do NOT use markdown or asterisks. Your job is to give a unique, positive welcome back message to a student who was absent. It must be one sentence only.";
    const userPrompt = `Generate a one-sentence welcome back message for a student named ${firstName}.`;

    try {
        const message = await callGeminiApi(systemPrompt, userPrompt);
        messageEl.textContent = message;
    } catch (e) {
        messageEl.textContent = `We're so glad you're back, ${firstName}!`;
    }

    setTimeout(() => {
        hideModal('welcome-back-modal');
    }, 4000);
}

export async function handleGenerateClassName() {
    const level = document.getElementById('class-level').value;
    const output = document.getElementById('class-name-suggestions');
    const btn = document.getElementById('generate-class-name-btn');

    if (!level) {
        showToast('Please select a Quest Level first.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

    // Get age context using utils
    const ageGroup = utils.getAgeGroupForLeague(level);

    const systemPrompt = "You are a creative assistant helping a teacher name their class team. Generate 3 short, catchy, fantasy/adventure themed class names suitable for children aged " + ageGroup + ". Do not use numbers. Return only the names separated by commas (e.g. 'Star Seekers, Dragon Riders, Time Travelers').";
    const userPrompt = `Generate names for a class in the "${level}" league.`;

    try {
        const result = await callGeminiApi(systemPrompt, userPrompt);
        const names = result.split(',').map(n => n.trim());

        output.innerHTML = names.map(name =>
            `<button type="button" class="suggestion-btn bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors border border-indigo-200 shadow-sm">${name}</button>`
        ).join('');

    } catch (error) {
        console.error(error);
        showToast('The naming spell failed. Try again!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-magic"></i>`;
    }
}
