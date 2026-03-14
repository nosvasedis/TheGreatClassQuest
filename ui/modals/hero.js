// /ui/modals/hero.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { showAnimatedModal } from './base.js';
import { callGeminiApi } from '../../api.js';

/** Shows the hero level-up celebration modal. Called after a student levels up in the skill tree. */
export function showHeroLevelUpCelebration({ studentId, studentName, newHeroLevel, heroClass }) {
    const modal = document.getElementById('hero-level-up-modal');
    const inner = document.getElementById('hero-level-up-modal-inner');
    if (!modal || !inner) return;

    modal.dataset.studentId = studentId;

    const tree = HERO_SKILL_TREE[heroClass];
    const title = getHeroTitle(heroClass, newHeroLevel);
    const icon = HERO_CLASSES[heroClass]?.icon || '⚔️';
    const auraColor = tree?.auraColor || '#7c3aed';

    document.getElementById('hero-level-up-name').textContent = studentName;
    document.getElementById('hero-level-up-title-text').textContent = title;
    document.getElementById('hero-level-up-title-icon').textContent = icon;
    document.getElementById('hero-level-up-level-num').textContent = String(newHeroLevel);
    document.getElementById('hero-level-up-title-badge').style.background = `linear-gradient(135deg, ${auraColor}, ${auraColor}dd)`;

    const student = state.get('allStudents').find(s => s.id === studentId);
    const avatarEl = document.getElementById('hero-level-up-avatar');
    if (student?.avatar) {
        avatarEl.innerHTML = `<img src="${student.avatar}" alt="${studentName}" class="w-full h-full object-cover">`;
    } else {
        avatarEl.innerHTML = `<span class="text-indigo-500">${(studentName || '?').charAt(0)}</span>`;
    }

    showAnimatedModal('hero-level-up-modal');
}

import { getTier } from '../../utils/subscription.js';
import { getTierTagline, getTiersAtAGlance } from '../../config/tiers/features.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';

// --- CORRECTED & ENHANCED HERO STATS MODAL ---

export function openHeroStatsModal(studentId, triggerElement) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('hero-stats-modal');
    const modalContent = modal.querySelector('.pop-in');
    const avatarEl = document.getElementById('hero-stats-avatar');
    const nameEl = document.getElementById('hero-stats-name');
    const contentEl = document.getElementById('hero-stats-content');
    const chartContainer = document.getElementById('hero-stats-chart-container');

    // --- Animation Setup ---
    const rect = triggerElement.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    modalContent.style.transformOrigin = `${originX}px ${originY}px`;

    // --- Populate Content ---
    const heroIcon = (student.heroClass && HERO_CLASSES[student.heroClass]) ? HERO_CLASSES[student.heroClass].icon : '';
nameEl.innerHTML = `${heroIcon} ${student.name}`;
    if (student.avatar) {
        avatarEl.innerHTML = `<img src="${student.avatar}" alt="${student.name}">`;
    } else {
        avatarEl.innerHTML = `<div class="flex items-center justify-center bg-gray-500 text-white font-bold text-7xl">${student.name.charAt(0)}</div>`;
    }

    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const isJunior = classData && (classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B');
    
    const studentScores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const studentTestScores = studentScores.filter(s => s.type === 'test');
    const studentDictationScores = studentScores.filter(s => s.type === 'dictation');
    const totalTests = studentTestScores.length;
    const totalDictations = studentDictationScores.length;

    let avgTestScore = null;
    if (totalTests > 0) {
        avgTestScore = studentTestScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / totalTests;
    }

    let bestTest = null;
    if (totalTests > 0) {
        bestTest = studentTestScores.reduce((best, current) => {
            const bestScore = best.scoreNumeric / best.maxScore;
            const currentScore = current.scoreNumeric / current.maxScore;
            return currentScore > bestScore ? current : best;
        });
    }
    
    let dictationStatHtml = '';
    if (isJunior) {
        const dictationCounts = studentDictationScores.reduce((acc, s) => {
            if (s.scoreQualitative) acc[s.scoreQualitative] = (acc[s.scoreQualitative] || 0) + 1;
            return acc;
        }, {});
        const dictationOrder = ["Great!!!", "Great!!", "Great!", "Nice Try!"];
        const dictationSummary = dictationOrder
            .filter(key => dictationCounts[key])
            .map(key => `${dictationCounts[key]}x ${key}`)
            .join(', ');
        if (dictationSummary) {
            dictationStatHtml = `<div class="hero-stat-item">
                <div class="icon text-blue-400"><i class="fas fa-microphone-alt"></i></div>
                <div class="text">
                    <div class="title">Dictation Results</div>
                    <div class="value">${dictationSummary}</div>
                </div>
            </div>`;
        }
    } else { // Is Senior
        if (totalDictations > 0) {
            const seniorDictations = studentDictationScores.filter(s => s.scoreNumeric !== null);
            if (seniorDictations.length > 0) {
                const avgDictationScore = seniorDictations.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / seniorDictations.length;
                dictationStatHtml = `<div class="hero-stat-item">
                    <div class="icon text-blue-400"><i class="fas fa-microphone-alt"></i></div>
                    <div class="text">
                        <div class="title">Average Dictation Score</div>
                        <div class="value">${avgDictationScore.toFixed(1)}%</div>
                    </div>
                </div>`;
            }
        }
    }

    let statsHtml = `
        <div class="hero-stat-item">
            <div class="icon text-gray-400"><i class="fas fa-scroll"></i></div>
            <div class="text">
                <div class="title">Trials Logged</div>
                <div class="value">${totalTests + totalDictations}</div>
            </div>
        </div>
    `;

    if (avgTestScore !== null) {
        statsHtml += `<div class="hero-stat-item">
            <div class="icon text-green-400"><i class="fas fa-file-alt"></i></div>
            <div class="text">
                <div class="title">Average Test Score</div>
                <div class="value">${avgTestScore.toFixed(1)}%</div>
            </div>
        </div>`;
    }

    statsHtml += dictationStatHtml;

    if (bestTest) {
        const bestScorePercent = (bestTest.scoreNumeric / bestTest.maxScore * 100).toFixed(0);
        statsHtml += `<div class="hero-stat-item">
            <div class="icon text-amber-400"><i class="fas fa-award"></i></div>
            <div class="text">
                <div class="title">Best Test Performance</div>
                <div class="value">${bestScorePercent}% on "${bestTest.title}"</div>
            </div>
        </div>`;
    }
    
    if (totalTests === 0 && totalDictations === 0) {
        statsHtml = `<div class="h-full flex items-center justify-center text-gray-400">No trial data logged for this student yet.</div>`;
    }
    
    contentEl.innerHTML = statsHtml;

    // --- Chart Implementation with Error Handling ---
    if (heroStatsChart) {
        heroStatsChart.destroy();
        heroStatsChart = null;
    }
    chartContainer.innerHTML = '';

    if (studentScores.length < 2) {
        chartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400">Log at least two trials to see a progress chart.</div>`;
    } else {
        try {
            const canvas = document.createElement('canvas');
            chartContainer.appendChild(canvas);
            
            const sortedScores = [...studentScores].sort((a, b) => (utils.parseFlexibleDate(a.date) || 0) - (utils.parseFlexibleDate(b.date) || 0));
            const labels = sortedScores.map(s => (utils.parseFlexibleDate(s.date) || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
            const dictationMap = { "Great!!!": 100, "Great!!": 75, "Great!": 50, "Nice Try!": 25 };

            const testData = sortedScores.map(s => s.type === 'test' ? (s.scoreNumeric / s.maxScore) * 100 : null);
            const dictationData = sortedScores.map(s => {
                if (s.type !== 'dictation') return null;
                return s.scoreQualitative ? dictationMap[s.scoreQualitative] : (s.scoreNumeric / s.maxScore) * 100;
            });

            heroStatsChart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Test Score', data: testData, borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.2)', fill: false, tension: 0.1, spanGaps: true },
                        { label: 'Dictation Score', data: dictationData, borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.2)', fill: false, tension: 0.1, spanGaps: true }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Trial Progress Over Time', color: '#d1d5db', font: { size: 16 } },
                        legend: { labels: { color: '#d1d5db' } },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) {
                                        const originalScore = sortedScores[context.dataIndex];
                                        if(originalScore.type === 'dictation' && originalScore.scoreQualitative) {
                                            label += originalScore.scoreQualitative;
                                        } else {
                                            label += context.parsed.y.toFixed(1) + '%';
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, max: 100, ticks: { color: '#9ca3af', callback: value => value + '%' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                    }
                }
            });
        } catch (error) {
            console.error("Chart.js rendering error:", error);
            chartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-red-400">Could not render progress chart. (Is Chart.js library loaded?)</div>`;
        }
    }

    const closeHandler = () => {
        modal.removeEventListener('click', backgroundClickHandler);
        
        modalContent.classList.add('modal-origin-start');
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0)';

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 350);
    };

    const backgroundClickHandler = (e) => {
        if (e.target === modal) {
            closeHandler();
        }
    };
    
    const oldCloseBtn = document.getElementById('hero-stats-close-btn');
    const newCloseBtn = oldCloseBtn.cloneNode(true);
    oldCloseBtn.parentNode.replaceChild(newCloseBtn, oldCloseBtn);
    newCloseBtn.addEventListener('click', closeHandler, { once: true });

    modal.addEventListener('click', backgroundClickHandler);

    modal.style.transition = 'background-color 0.3s ease-out';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    modalContent.classList.add('modal-origin-start');
    modal.classList.remove('hidden');

    requestAnimationFrame(() => {
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modalContent.classList.remove('modal-origin-start');
    });
}

// --- NEW: HERO'S CHRONICLE MODAL ---

export function openHeroChronicleModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('hero-chronicle-modal');
    modal.dataset.studentId = studentId;

    document.getElementById('hero-chronicle-student-name').innerText = `for ${student.name}`;
    
    resetHeroChronicleForm();
    renderHeroChronicleContent(studentId);
    
    // Reset AI output
    document.getElementById('hero-chronicle-ai-output').innerHTML = `<p class="text-center text-indigo-700">Select a counsel type to receive the Oracle's wisdom.</p>`;

    showAnimatedModal('hero-chronicle-modal');
}

export function renderHeroChronicleContent(studentId) {
    const notesFeed = document.getElementById('hero-chronicle-notes-feed');
    const notes = state.get('allHeroChronicleNotes')
        .filter(n => n.studentId === studentId)
        .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    if (notes.length === 0) {
        notesFeed.innerHTML = `<p class="text-center text-gray-500 p-4">No notes have been added for this student yet.</p>`;
        return;
    }

    notesFeed.innerHTML = notes.map(note => `
        <div class="bg-white p-3 rounded-md shadow-sm border">
            <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
                <span class="font-bold">${note.category}</span>
                <span>${(note.createdAt ? note.createdAt.toDate() : new Date()).toLocaleDateString('en-GB')}</span>
            </div>
            <p class="text-gray-800 whitespace-pre-wrap">${note.noteText}</p>
            <div class="text-right mt-2">
                <button class="edit-chronicle-note-btn text-blue-500 hover:underline text-xs mr-2" data-note-id="${note.id}">Edit</button>
                <button class="delete-chronicle-note-btn text-red-500 hover:underline text-xs" data-note-id="${note.id}">Delete</button>
            </div>
        </div>
    `).join('');
}

export function resetHeroChronicleForm() {
    const form = document.getElementById('hero-chronicle-note-form');
    form.reset();
    document.getElementById('hero-chronicle-note-id').value = '';
    document.getElementById('hero-chronicle-cancel-edit-btn').classList.add('hidden');
    form.querySelector('button[type="submit"]').textContent = 'Save Note';
}

export function setupNoteForEditing(noteId) {
    const note = state.get('allHeroChronicleNotes').find(n => n.id === noteId);
    if (!note) return;

    document.getElementById('hero-chronicle-note-id').value = noteId;
    document.getElementById('hero-chronicle-note-text').value = note.noteText;
    document.getElementById('hero-chronicle-note-category').value = note.category;
    document.getElementById('hero-chronicle-cancel-edit-btn').classList.remove('hidden');
    document.getElementById('hero-chronicle-note-form').querySelector('button[type="submit"]').textContent = 'Update Note';
    document.getElementById('hero-chronicle-note-text').focus();
}

export async function generateAIInsight(studentId, insightType) {
    if (!requireEliteAI({ feature: 'The Oracle' })) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const outputEl = document.getElementById('hero-chronicle-ai-output');
    outputEl.innerHTML = `<p class="text-center text-indigo-700"><i class="fas fa-spinner fa-spin mr-2"></i>The Oracle is consulting the records...</p>`;

    // 1. Gather all data
    const notes = state.get('allHeroChronicleNotes')
        .filter(n => n.studentId === studentId)
        .sort((a, b) => (a.createdAt?.toDate() || new Date()) - (b.createdAt?.toDate() || new Date()))
        .map(n => `[${(n.createdAt ? n.createdAt.toDate() : new Date()).toLocaleDateString('en-GB')} - ${n.category}] ${n.noteText}`)
        .join('\n');

    const academicScores = state.get('allWrittenScores')
        .filter(s => s.studentId === studentId)
        .sort((a, b) => (utils.parseFlexibleDate(a.date) || 0) - (utils.parseFlexibleDate(b.date) || 0))
        .map(s => `[${s.date}] Scored ${s.scoreQualitative || `${s.scoreNumeric}/${s.maxScore}`} on a ${s.type} titled "${s.title || 'Dictation'}". Note: ${s.notes || 'N/A'}`)
        .join('\n');

    const behavioralAwards = state.get('allAwardLogs')
        .filter(l => l.studentId === studentId)
        .sort((a, b) => utils.parseDDMMYYYY(a.date) - utils.parseDDMMYYYY(b.date))
        .map(l => `[${l.date}] Awarded ${l.stars} star(s) for ${l.reason}. Note: ${l.note || 'N/A'}`)
        .join('\n');

    // 2. Select prompt based on type
    let systemPrompt = "";
    const prompts = {
        parent: {
            persona: "You are a thoughtful educational psychologist writing a summary for a parent-teacher meeting. Your tone is balanced, positive, and constructive. Use clear, jargon-free language.",
            task: `Summarize the student's progress. Structure your response with clear headings in markdown: '### Key Strengths' and '### Areas for Growth'. Under each, provide 2-3 bullet points. Conclude with a positive, encouraging sentence.`
        },
        teacher: {
            persona: "You are an experienced teaching coach and mentor providing confidential advice to another teacher. Your tone is practical, supportive, and insightful.",
            task: `Analyze the student's complete record and provide actionable strategies. Structure your response with clear headings in markdown: '### In-Classroom Strategies', '### Motivation Techniques', and '### Potential Challenges to Watch For'. Provide 2-3 specific, bulleted suggestions under each heading.`
        },
        analysis: {
            persona: "You are a concise data analyst summarizing student performance patterns. Your tone is objective and direct.",
            task: `Identify key patterns from the data. Structure your response with two markdown lists: '### Key Strengths' and '### Areas to Develop'. Provide 3-4 bullet points for each, citing specific data types (e.g., 'academic scores', 'behavior notes') where patterns emerge.`
        },
        goal: {
            persona: "You are a goal-setting expert for students, focusing on SMART (Specific, Measurable, Achievable, Relevant, Time-bound) goals. Your tone is positive and forward-looking.",
            task: `Based on the student's record, suggest ONE specific and achievable goal for the upcoming month. Explain the goal and why it's relevant in a single paragraph. Do not use markdown.`
        }
    };
    systemPrompt = `${prompts[insightType].persona} Your task is to analyze a comprehensive record for a student named ${student.name} and generate a specific type of summary. ${prompts[insightType].task}`;
    
    const userPrompt = `Here is the complete record for ${student.name}:
    
    --- TEACHER'S PRIVATE NOTES ---
    ${notes || "No private notes recorded."}

    --- ACADEMIC TRIAL SCORES ---
    ${academicScores || "No academic scores recorded."}

    --- BEHAVIORAL STAR AWARDS ---
    ${behavioralAwards || "No behavioral awards recorded."}

    Please generate the requested summary.`;

    try {
        const insight = await callGeminiApi(systemPrompt, userPrompt);
        // Basic markdown to HTML conversion
        let htmlInsight = insight
            .replace(/\*\*\*(.*?)\*\*\*/g, '<b>$1</b>') // Handle ***bold***
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')   // Handle **bold**
            .replace(/### (.*?)\n/g, '<h4 class="font-bold text-indigo-800 mt-3 mb-1">$1</h4>')
            .replace(/\* (.*?)\n/g, '<li class="ml-4">$1</li>')
            .replace(/(\n)/g, '<br>');
        outputEl.innerHTML = `<ul>${htmlInsight}</ul>`;
    } catch (error) {
        console.error("AI Insight Error:", error);
        outputEl.innerHTML = `<p class="text-center text-red-500">The Oracle could not process the records at this time. Please try again later.</p>`;
    }
}

export function openAppInfoModal() {
    const studentContent = document.getElementById('info-content-students');
    const teacherContent = document.getElementById('info-content-teachers');

    const rawTier = getTier();
    const prettyTier =
        rawTier === 'elite' ? 'Elite' :
        rawTier === 'pro' ? 'Pro' : 'Starter';
    const tierTagline = getTierTagline(rawTier);
    const tiersGlance = getTiersAtAGlance();
    const tierRank = rawTier === 'elite' ? 2 : rawTier === 'pro' ? 1 : 0;

    const hasTier = (requiredTier) => {
        if (requiredTier === 'starter') return true;
        if (requiredTier === 'pro') return tierRank >= 1;
        if (requiredTier === 'elite') return tierRank >= 2;
        return false;
    };

    const availabilityBadge = (requiredTier, lockedLabel) => {
        if (hasTier(requiredTier)) {
            return '<span class="guide-pill guide-pill-on"><i class="fas fa-check-circle"></i> Available now</span>';
        }
        return `<span class="guide-pill guide-pill-locked"><i class="fas fa-lock"></i> ${lockedLabel}</span>`;
    };

    const compactAvailability = (requiredTier) => {
        if (hasTier(requiredTier)) {
            return '<span class="guide-chip-status guide-chip-status-on">Now</span>';
        }
        if (requiredTier === 'pro') {
            return '<span class="guide-chip-status guide-chip-status-lock">Pro</span>';
        }
        if (requiredTier === 'elite') {
            return '<span class="guide-chip-status guide-chip-status-lock">Elite</span>';
        }
        return '<span class="guide-chip-status guide-chip-status-on">Now</span>';
    };

    const studentQuestClusters = [
        {
            theme: 'guide-cluster-cyan',
            icon: 'fa-globe',
            title: 'Quest World Core',
            items: [
                { name: 'Home mission view', tier: 'starter' },
                { name: 'Team Quest map progress', tier: 'starter' },
                { name: 'Monthly ceremonies', tier: 'starter' },
                { name: "Hero's Challenge ranks", tier: 'starter' },
                { name: 'Hall of Heroes highlights', tier: 'pro' }
            ]
        },
        {
            theme: 'guide-cluster-amber',
            icon: 'fa-coins',
            title: 'Economy and Rewards',
            items: [
                { name: 'Stars and gold loop', tier: 'starter' },
                { name: 'Mystic Market items', tier: 'starter' },
                { name: 'Legendary artifacts', tier: 'starter' },
                { name: 'Inventory and Trophy Room', tier: 'starter' },
                { name: "Hero's Boon gifting", tier: 'starter' }
            ]
        },
        {
            theme: 'guide-cluster-violet',
            icon: 'fa-dragon',
            title: 'Identity and Growth',
            items: [
                { name: 'Hero Classes', tier: 'starter' },
                { name: 'Skill Tree progression', tier: 'starter' },
                { name: 'Familiars hatch and evolve', tier: 'starter' },
                { name: 'Guild identity and house points', tier: 'pro' },
                { name: 'Guild champions', tier: 'pro' }
            ]
        },
        {
            theme: 'guide-cluster-teal',
            icon: 'fa-book',
            title: 'Learning and Story',
            items: [
                { name: 'Adventure Log stories', tier: 'pro' },
                { name: 'Story Weavers', tier: 'pro' },
                { name: 'Word of the Day', tier: 'pro' },
                { name: "Scholar's Scroll tests", tier: 'pro' },
                { name: 'Dictation tracking', tier: 'pro' }
            ]
        },
        {
            theme: 'guide-cluster-rose',
            icon: 'fa-calendar-check',
            title: 'Events and Planner',
            items: [
                { name: 'Calendar day planner', tier: 'pro' },
                { name: 'Quest Events and specials', tier: 'pro' },
                { name: 'Attendance chronicle', tier: 'pro' },
                { name: 'Quest assignments', tier: 'pro' },
                { name: 'School year holiday flow', tier: 'pro' }
            ]
        },
        {
            theme: 'guide-cluster-indigo',
            icon: 'fa-wand-magic-sparkles',
            title: 'Elite AI Magic',
            items: [
                { name: 'Oracle insights', tier: 'elite' },
                { name: 'AI story support', tier: 'elite' },
                { name: 'AI image creativity', tier: 'elite' },
                { name: 'Smart summary helpers', tier: 'elite' },
                { name: 'Early-access experiments', tier: 'elite' }
            ]
        }
    ];

    const teacherQuestClusters = [
        {
            theme: 'guide-cluster-cyan',
            icon: 'fa-compass',
            title: 'Command Tabs (Daily)',
            items: [
                { name: 'Home dashboard', tier: 'starter' },
                { name: 'Team Quest', tier: 'starter' },
                { name: "Hero's Challenge", tier: 'starter' },
                { name: 'My Classes', tier: 'starter' },
                { name: 'Award Stars', tier: 'starter' },
                { name: 'Options', tier: 'starter' }
            ]
        },
        {
            theme: 'guide-cluster-violet',
            icon: 'fa-users-gear',
            title: 'Class and Student Management',
            items: [
                { name: 'Class creation/editing', tier: 'starter' },
                { name: 'Roster and student profile', tier: 'starter' },
                { name: 'Avatar and hero identity setup', tier: 'starter' },
                { name: 'Hero skill tree controls', tier: 'starter' },
                { name: 'Move student between classes', tier: 'starter' },
                { name: 'Guild sorting quiz', tier: 'pro' }
            ]
        },
        {
            theme: 'guide-cluster-amber',
            icon: 'fa-sack-dollar',
            title: 'Motivation and Economy Engine',
            items: [
                { name: 'Reason-based star awards', tier: 'starter' },
                { name: 'Quest bounties with timers', tier: 'starter' },
                { name: "Hero's Boon economy", tier: 'starter' },
                { name: 'Mystic Market and artifacts', tier: 'starter' },
                { name: 'Familiars progression', tier: 'starter' },
                { name: 'Ceremony triggers and highlights', tier: 'starter' }
            ]
        },
        {
            theme: 'guide-cluster-teal',
            icon: 'fa-chart-line',
            title: 'Academics and Analytics',
            items: [
                { name: "Scholar's Scroll", tier: 'pro' },
                { name: 'Tests and dictations', tier: 'pro' },
                { name: 'Performance charts', tier: 'pro' },
                { name: 'Makeup tracking', tier: 'pro' },
                { name: 'Class and hero reports', tier: 'starter' },
                { name: 'Certificates', tier: 'starter' }
            ]
        },
        {
            theme: 'guide-cluster-rose',
            icon: 'fa-calendar-check',
            title: 'Planning and Attendance',
            items: [
                { name: 'Calendar tab', tier: 'pro' },
                { name: 'Day planner overrides', tier: 'pro' },
                { name: 'Quest events planner', tier: 'pro' },
                { name: 'Adventure Log and assignments', tier: 'pro' },
                { name: 'Attendance chronicle', tier: 'pro' },
                { name: 'School year planner', tier: 'pro' }
            ]
        },
        {
            theme: 'guide-cluster-indigo',
            icon: 'fa-wand-magic-sparkles',
            title: 'Creative and Premium Layer',
            items: [
                { name: 'Story Weavers', tier: 'pro' },
                { name: 'Word-of-the-Day workflows', tier: 'pro' },
                { name: 'Guild hall and anthem experience', tier: 'pro' },
                { name: 'Projector wallpaper mode', tier: 'starter' },
                { name: 'AI Oracle and AI logs', tier: 'elite' },
                { name: 'Priority and early-access tools', tier: 'elite' }
            ]
        }
    ];

    const studentDailyFlow = [
        { icon: 'fa-sun', title: 'Start', body: 'Check your class mission and choose your hero attitude for the lesson.' },
        { icon: 'fa-star', title: 'Earn', body: 'Collect stars from teamwork, focus, creativity, and challenge participation.' },
        { icon: 'fa-bag-shopping', title: 'Build', body: 'Spend smart in the shop, grow your inventory, and evolve your familiar.' },
        { icon: 'fa-trophy', title: 'Celebrate', body: 'Finish with stories, events, guild moments, and ceremony milestones.' }
    ];

    const teacherDailyFlow = [
        { icon: 'fa-house', title: 'Prepare', body: 'Open Home, check reminders and class selection, confirm schedule reality.' },
        { icon: 'fa-bolt', title: 'Run', body: 'Award stars fast, launch bounties, and keep momentum high during teaching.' },
        { icon: 'fa-book-medical', title: 'Record', body: 'Capture key outcomes in log, tests, dictations, and attendance as needed.' },
        { icon: 'fa-chart-pie-simple', title: 'Review', body: 'Use reports, stats, and ceremonies to close loops and plan the next cycle.' }
    ];

    const countItems = (clusters) => clusters.reduce((sum, cluster) => sum + cluster.items.length, 0);
    const countUnlockedItems = (clusters) => clusters.reduce((sum, cluster) => sum + cluster.items.filter(item => hasTier(item.tier)).length, 0);

    const studentTotalItems = countItems(studentQuestClusters);
    const studentUnlockedItems = countUnlockedItems(studentQuestClusters);
    const teacherTotalItems = countItems(teacherQuestClusters);
    const teacherUnlockedItems = countUnlockedItems(teacherQuestClusters);

    // 1. STUDENTS CONTENT (Adventure Guide)
    studentContent.innerHTML = `
        <section class="guide-hero-card guide-student-hero guide-sparkle-layer guide-stagger-item" style="--guide-delay: 0ms;">
            <div class="guide-hero-badge">For Students</div>
            <h3 class="font-title text-3xl md:text-4xl text-cyan-900 mb-3"><i class="fas fa-compass mr-2"></i> Your Quest Book, but Actually Fun</h3>
            <p class="text-slate-700 text-base md:text-lg leading-relaxed">
                Everything is here: stars, heroes, shop, familiars, events, stories, guilds, and AI magic. It is colorful on purpose, quick to scan, and built to show exactly what your school plan unlocks.
            </p>
            <div class="guide-tier-chip-row">
                <span class="guide-tier-chip"><i class="fas fa-layer-group"></i> School Plan: ${prettyTier}</span>
                <span class="guide-tier-chip guide-tier-chip-soft">${tierTagline}</span>
                <span class="guide-tier-chip"><i class="fas fa-unlock-keyhole"></i> ${studentUnlockedItems}/${studentTotalItems} feature modules active</span>
            </div>
        </section>

        <section class="guide-kpi-grid guide-stagger-item" style="--guide-delay: 70ms;">
            <article class="guide-kpi-card"><span class="kpi-number">${studentUnlockedItems}</span><span class="kpi-label">Unlocked Modules</span></article>
            <article class="guide-kpi-card"><span class="kpi-number">${studentTotalItems - studentUnlockedItems}</span><span class="kpi-label">Future Unlocks</span></article>
            <article class="guide-kpi-card"><span class="kpi-number">${prettyTier}</span><span class="kpi-label">Current Plan</span></article>
            <article class="guide-kpi-card"><span class="kpi-number">4</span><span class="kpi-label">Daily Quest Beats</span></article>
        </section>

        <section class="guide-panel guide-stagger-item" style="--guide-delay: 120ms;">
            <h4 class="guide-section-title"><i class="fas fa-map-location-dot"></i> Student Feature Atlas</h4>
            <div class="guide-cluster-grid">
                ${studentQuestClusters.map((cluster, index) => `
                    <article class="guide-cluster ${cluster.theme} guide-stagger-item" style="--guide-delay: ${150 + (index * 35)}ms;">
                        <h5><i class="fas ${cluster.icon}"></i> ${cluster.title}</h5>
                        <div class="guide-chip-list">
                            ${cluster.items.map(item => `
                                <span class="guide-chip-item">
                                    <span class="guide-chip-name">${item.name}</span>
                                    ${compactAvailability(item.tier)}
                                </span>
                            `).join('')}
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel guide-stagger-item" style="--guide-delay: 380ms;">
            <h4 class="guide-section-title"><i class="fas fa-timeline"></i> Your Daily Loop</h4>
            <div class="guide-timeline-grid">
                ${studentDailyFlow.map((step, index) => `
                    <article class="guide-timeline-card guide-stagger-item" style="--guide-delay: ${420 + (index * 45)}ms;">
                        <h5><i class="fas ${step.icon}"></i> ${step.title}</h5>
                        <p>${step.body}</p>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel guide-tier-panel guide-stagger-item" style="--guide-delay: 620ms;">
            <h4 class="guide-section-title"><i class="fas fa-unlock-alt"></i> Tier Progress Path</h4>
            <ul class="guide-tier-list">
                ${tiersGlance.map(t => `<li><strong>${t.label}:</strong> ${t.bullets}</li>`).join('')}
            </ul>
            <p class="guide-tier-footnote">
                ${rawTier === 'elite'
                    ? 'Everything is live. Explore all systems and use the full quest universe.'
                    : rawTier === 'pro'
                        ? 'Pro gives you the full classroom adventure toolkit; Elite adds the deepest AI magic.'
                        : 'Starter has a strong core; Pro unlocks the larger world with stories, planner, guilds, and advanced tracking.'}
            </p>
        </section>
    `;

    // 2. TEACHERS CONTENT (Game Master's Manual)
    teacherContent.innerHTML = `
        <section class="guide-hero-card guide-teacher-hero guide-sparkle-layer guide-stagger-item" style="--guide-delay: 0ms;">
            <div class="guide-hero-badge">For Teachers</div>
            <h3 class="font-title text-3xl md:text-4xl text-emerald-900 mb-3"><i class="fas fa-chalkboard-teacher mr-2"></i> Beautiful, Fast, Complete Teacher Command Guide</h3>
            <p class="text-slate-700 text-base md:text-lg leading-relaxed">
                Every major workflow is listed here, grouped by purpose, color-coded, and tier-labeled. No feature is hidden, but nothing feels like a wall of text.
            </p>
            <div class="guide-tier-chip-row">
                <span class="guide-tier-chip"><i class="fas fa-crown"></i> Active Plan: ${prettyTier}</span>
                <span class="guide-tier-chip guide-tier-chip-soft">${tierTagline}</span>
                <span class="guide-tier-chip"><i class="fas fa-server"></i> ${teacherUnlockedItems}/${teacherTotalItems} modules active</span>
            </div>
        </section>

        <section class="guide-kpi-grid guide-stagger-item" style="--guide-delay: 70ms;">
            <article class="guide-kpi-card"><span class="kpi-number">${teacherUnlockedItems}</span><span class="kpi-label">Active Modules</span></article>
            <article class="guide-kpi-card"><span class="kpi-number">${teacherTotalItems - teacherUnlockedItems}</span><span class="kpi-label">Locked Modules</span></article>
            <article class="guide-kpi-card"><span class="kpi-number">11</span><span class="kpi-label">Main Nav Tabs</span></article>
            <article class="guide-kpi-card"><span class="kpi-number">4</span><span class="kpi-label">Daily Ops Stages</span></article>
        </section>

        <section class="guide-panel guide-stagger-item" style="--guide-delay: 120ms;">
            <h4 class="guide-section-title"><i class="fas fa-sparkles"></i> Full Teacher Feature Atlas</h4>
            <div class="guide-cluster-grid">
                ${teacherQuestClusters.map((cluster, index) => `
                    <article class="guide-cluster ${cluster.theme} guide-stagger-item" style="--guide-delay: ${150 + (index * 35)}ms;">
                        <h5><i class="fas ${cluster.icon}"></i> ${cluster.title}</h5>
                        <div class="guide-chip-list">
                            ${cluster.items.map(item => `
                                <span class="guide-chip-item">
                                    <span class="guide-chip-name">${item.name}</span>
                                    ${compactAvailability(item.tier)}
                                </span>
                            `).join('')}
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel guide-stagger-item" style="--guide-delay: 380ms;">
            <h4 class="guide-section-title"><i class="fas fa-list-check"></i> Teacher Daily Operating Loop</h4>
            <div class="guide-timeline-grid">
                ${teacherDailyFlow.map((step, index) => `
                    <article class="guide-timeline-card guide-stagger-item" style="--guide-delay: ${420 + (index * 45)}ms;">
                        <h5><i class="fas ${step.icon}"></i> ${step.title}</h5>
                        <p>${step.body}</p>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel guide-tier-panel guide-stagger-item" style="--guide-delay: 620ms;">
            <h4 class="guide-section-title"><i class="fas fa-layer-group"></i> Plan Tiers at a Glance</h4>
            <ul class="guide-tier-list">
                ${tiersGlance.map(t => `<li><strong>${t.label}:</strong> ${t.bullets}</li>`).join('')}
            </ul>
            <p class="guide-tier-footnote">
                ${rawTier === 'elite'
                    ? 'Elite is active: full AI support, full operations, and full classroom quest depth are available.'
                    : rawTier === 'pro'
                        ? 'Pro is active: complete classroom systems are live; Elite is the AI/premium extension layer.'
                        : 'Starter is active: core quest systems are ready, and Pro/Elite expand depth when your school wants it.'}
            </p>
        </section>
    `;

    // 3. Reset Tabs (Show Student by default)
    const studentBtn = document.getElementById('info-btn-students');
    const teacherBtn = document.getElementById('info-btn-teachers');
    
    studentBtn.classList.add('active');
    teacherBtn.classList.remove('active');
    
    studentContent.classList.remove('hidden');
    teacherContent.classList.add('hidden');

    showAnimatedModal('app-info-modal');
}
