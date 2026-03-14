// /ui/modals/hero.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { showAnimatedModal } from './base.js';
import { callGeminiApi } from '../../api.js';
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

    const studentFeatures = [
        {
            icon: 'fa-route',
            title: 'Team Quest & Monthly Ceremonies',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Your class collects stars together and moves across the quest map. At month-end, ceremonies celebrate class and hero progress.'
        },
        {
            icon: 'fa-user-graduate',
            title: "Hero's Challenge & Ranks",
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Every star you earn shapes your personal rank, class reputation, and monthly hero highlights.'
        },
        {
            icon: 'fa-store',
            title: 'Mystic Market, Inventory & Trophy Room',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Spend gold on themed items, collect artifacts, and show your collection in your expanded hero view.'
        },
        {
            icon: 'fa-paw',
            title: 'Familiars (Eggs, Hatch, Evolution)',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Some rewards become living companions that hatch and evolve as your star journey continues.'
        },
        {
            icon: 'fa-shield-alt',
            title: 'Guild Identity & Guild Races',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Join one of the school guilds, contribute to year-long guild totals, and chase guild champion status.'
        },
        {
            icon: 'fa-scroll',
            title: "Scholar's Scroll (Tests & Dictations)",
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Your test and dictation results can be tracked over time with progress visuals and performance feedback.'
        },
        {
            icon: 'fa-calendar-alt',
            title: 'Calendar, Day Planner & Quest Events',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'See lesson days, holidays, special challenge events, and the rhythm of your school quest calendar.'
        },
        {
            icon: 'fa-feather-alt',
            title: 'Story Weavers & Word-of-the-Day',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Build collaborative stories as a class and transform lessons into shared worldbuilding moments.'
        },
        {
            icon: 'fa-book-open',
            title: 'Adventure Log, Hall of Heroes & Assignments',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Review class chronicles, attendance history, assignments, and monthly hero archives in one place.'
        },
        {
            icon: 'fa-magic',
            title: 'AI Magic (Oracle, Story Art, Smart Summaries)',
            requiredTier: 'elite',
            lockedLabel: 'Unlocks on Elite',
            desc: 'Elite adds creative AI support for stories, reflections, and richer teacher-student narrative feedback.'
        }
    ];

    const teacherSystems = [
        {
            icon: 'fa-home',
            title: 'Home Dashboard',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'School or class overview, schedule snapshots, ceremony reminders, weather-aware ambiance, and quick actions.'
        },
        {
            icon: 'fa-route',
            title: 'Team Quest',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Monthly class leaderboard, league map progression, goal tracking adjusted by holidays/cancellations, and ceremonies.'
        },
        {
            icon: 'fa-user-graduate',
            title: "Hero's Challenge",
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Individual leaderboard, rank progression, shop, inventory, hero stats, familiars, and certificate links.'
        },
        {
            icon: 'fa-shield-alt',
            title: 'Guilds',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Guild hall, sorting quiz pathways, yearly guild totals, anthem/lore moments, and guild champion views.'
        },
        {
            icon: 'fa-chalkboard-teacher',
            title: 'My Classes & Student Management',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Create classes, edit schedules, manage rosters, set birthdays/namedays, assign hero classes, move students, and run reports.'
        },
        {
            icon: 'fa-star',
            title: 'Award Stars',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Fast awarding by reason, bounty timers, hero boons, particle/sound feedback, and motivation loops during lessons.'
        },
        {
            icon: 'fa-book-open',
            title: 'Adventure Log',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Daily chronicles, assignment and attendance workflows, hall of heroes archive, and class narrative memory.'
        },
        {
            icon: 'fa-scroll',
            title: "Scholar's Scroll",
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Tests, dictations, performance trends, makeup tracking, and trial-based analytics by student or class.'
        },
        {
            icon: 'fa-calendar-alt',
            title: 'Calendar & School Planner',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Lesson overrides, cancellations, school holiday ranges, and quest events that shape monthly objectives.'
        },
        {
            icon: 'fa-feather-alt',
            title: 'Story Weavers',
            requiredTier: 'pro',
            lockedLabel: 'Unlocks on Pro',
            desc: 'Collaborative writing mode and creative prompts that connect literacy practice to your classroom storyline.'
        },
        {
            icon: 'fa-cog',
            title: 'Options & Operations',
            requiredTier: 'starter',
            lockedLabel: '',
            desc: 'Star and coin managers, profile controls, school setup tools, and data safety controls for administrators.'
        },
        {
            icon: 'fa-robot',
            title: 'Elite AI Assistant Layer',
            requiredTier: 'elite',
            lockedLabel: 'Unlocks on Elite',
            desc: 'Oracle insights, AI-aided diary writing, creative story support, and early-access experimental classroom tools.'
        }
    ];

    const studentDailyFlow = [
        'Arrive and check your class quest goals for the day.',
        'Earn stars through teamwork, focus, creativity, respect, and challenge participation.',
        'Use gold in the Mystic Market and track your hero/familiar progression.',
        'Join story, guild, or quest event moments when your class activates them.',
        'Celebrate milestones in monthly ceremonies and hall-of-heroes moments.'
    ];

    const teacherDailyFlow = [
        '<strong>Before class:</strong> check Home reminders, schedule, and active class selection.',
        '<strong>During class:</strong> use Award Stars for fast positive reinforcement and bounty pacing.',
        '<strong>After key tasks:</strong> update tests/dictations, attendance, or quest events where needed.',
        '<strong>End of session:</strong> write or generate the day\'s Adventure Log entry and assignments.',
        '<strong>Weekly/Monthly:</strong> review analytics, celebrate ceremonies, and tune goals/settings.'
    ];

    const quickFacts = [
        {
            icon: 'fa-coins',
            title: 'Stars and Gold Economy',
            body: 'Stars drive class and hero progression. Gold supports reward choice, collection strategy, and long-term motivation through items and familiars.'
        },
        {
            icon: 'fa-chess-knight',
            title: 'Hero Classes and Skill Trees',
            body: 'Students can build an identity path with class-themed progressions and choices that influence rewards and play style over the year.'
        },
        {
            icon: 'fa-scroll-old',
            title: 'Quest Bounties and Events',
            body: 'Timed group challenges and planner events create focused objective windows for participation, effort, and academic targets.'
        },
        {
            icon: 'fa-tv',
            title: 'Projector and Wallpaper Presence',
            body: 'Live visual mode can turn classroom screens into dynamic quest dashboards with atmosphere and progress cues.'
        }
    ];

    // 1. STUDENTS CONTENT (Adventure Guide)
    studentContent.innerHTML = `
        <section class="guide-hero-card guide-student-hero">
            <div class="guide-hero-badge">For Students</div>
            <h3 class="font-title text-3xl md:text-4xl text-cyan-900 mb-3"><i class="fas fa-compass mr-2"></i> The Complete Student Adventure Guide</h3>
            <p class="text-slate-700 text-base md:text-lg leading-relaxed">
                Your classroom is a living quest world. You grow through stars, unlock hero identity, collect rewards, and build team victories with your class.
                This guide shows everything available in your school's plan and what unlocks next.
            </p>
            <div class="guide-tier-chip-row">
                <span class="guide-tier-chip"><i class="fas fa-layer-group"></i> School Plan: ${prettyTier}</span>
                <span class="guide-tier-chip guide-tier-chip-soft">${tierTagline}</span>
            </div>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-flag-checkered"></i> Student Daily Quest Loop</h4>
            <ol class="guide-ordered-list">
                ${studentDailyFlow.map(item => `<li>${item}</li>`).join('')}
            </ol>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-map"></i> Student Features and What They Mean</h4>
            <div class="guide-feature-grid">
                ${studentFeatures.map(feature => `
                    <article class="guide-feature-card">
                        <div class="guide-feature-head">
                            <h5><i class="fas ${feature.icon}"></i> ${feature.title}</h5>
                            ${availabilityBadge(feature.requiredTier, feature.lockedLabel)}
                        </div>
                        <p>${feature.desc}</p>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-lightbulb"></i> Student Power Tips</h4>
            <ul class="guide-bullet-list">
                <li>Consistency beats bursts: daily effort grows stars, rank, and familiar progress faster than occasional spikes.</li>
                <li>Choose your rewards strategically: some items are cosmetic, while others support key challenge moments.</li>
                <li>When guilds are active, helping your team helps your own profile too.</li>
                <li>Ceremony months are milestone months: your progress can become part of your class legend.</li>
            </ul>
        </section>

        <section class="guide-panel guide-tier-panel">
            <h4 class="guide-section-title"><i class="fas fa-unlock-alt"></i> Tier Progress Path</h4>
            <ul class="guide-tier-list">
                ${tiersGlance.map(t => `<li><strong>${t.label}:</strong> ${t.bullets}</li>`).join('')}
            </ul>
            <p class="guide-tier-footnote">
                ${rawTier === 'elite'
                    ? 'You are on the full experience. Every major student-facing feature is active.'
                    : rawTier === 'pro'
                        ? 'You are on Pro. Elite adds advanced AI-powered creativity and assistant tools.'
                        : 'You are on Starter. Pro unlocks the expanded quest world (guilds, stories, planner, log, and scroll).'}
            </p>
        </section>
    `;

    // 2. TEACHERS CONTENT (Game Master's Manual)
    teacherContent.innerHTML = `
        <section class="guide-hero-card guide-teacher-hero">
            <div class="guide-hero-badge">For Teachers</div>
            <h3 class="font-title text-3xl md:text-4xl text-emerald-900 mb-3"><i class="fas fa-chalkboard-teacher mr-2"></i> The Game Master's Complete Manual</h3>
            <p class="text-slate-700 text-base md:text-lg leading-relaxed">
                The Great Class Quest transforms daily classroom routines into an intentional motivation system: visible progress, narrative ownership,
                celebration moments, and feedback loops that students understand.
            </p>
            <div class="guide-tier-chip-row">
                <span class="guide-tier-chip"><i class="fas fa-crown"></i> Active Plan: ${prettyTier}</span>
                <span class="guide-tier-chip guide-tier-chip-soft">${tierTagline}</span>
            </div>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-list-check"></i> Teacher Daily Operating Loop</h4>
            <ol class="guide-ordered-list">
                ${teacherDailyFlow.map(item => `<li>${item}</li>`).join('')}
            </ol>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-sitemap"></i> Full System Overview (Tab by Tab)</h4>
            <div class="guide-feature-grid">
                ${teacherSystems.map(system => `
                    <article class="guide-feature-card">
                        <div class="guide-feature-head">
                            <h5><i class="fas ${system.icon}"></i> ${system.title}</h5>
                            ${availabilityBadge(system.requiredTier, system.lockedLabel)}
                        </div>
                        <p>${system.desc}</p>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-toolbox"></i> What Teachers Should Configure Early</h4>
            <ul class="guide-bullet-list">
                <li>Set class schedules accurately first; monthly goals and planning rely on lesson-day truth.</li>
                <li>Define clear award reasons with students so stars represent shared values, not random points.</li>
                <li>Use reports, hero stats, and scroll trends to combine behavior and academic signals in one view.</li>
                <li>Use namedays, ceremonies, and hall-of-heroes moments to strengthen class belonging.</li>
                <li>Review school-wide options (holiday ranges, star/coin settings, setup tools) at least monthly.</li>
            </ul>
        </section>

        <section class="guide-panel">
            <h4 class="guide-section-title"><i class="fas fa-helmet-battle"></i> Core Mechanics Worth Teaching Students Explicitly</h4>
            <div class="guide-facts-grid">
                ${quickFacts.map(fact => `
                    <article class="guide-fact-card">
                        <h5><i class="fas ${fact.icon}"></i> ${fact.title}</h5>
                        <p>${fact.body}</p>
                    </article>
                `).join('')}
            </div>
        </section>

        <section class="guide-panel guide-tier-panel">
            <h4 class="guide-section-title"><i class="fas fa-layer-group"></i> Plan Tiers at a Glance</h4>
            <ul class="guide-tier-list">
                ${tiersGlance.map(t => `<li><strong>${t.label}:</strong> ${t.bullets}</li>`).join('')}
            </ul>
            <p class="guide-tier-footnote">
                ${rawTier === 'elite'
                    ? 'Elite is active: all current major features and AI support layers are available to your school.'
                    : rawTier === 'pro'
                        ? 'Pro is active: the expanded classroom toolkit is unlocked, with Elite reserved for advanced AI and experimental tools.'
                        : 'Starter is active: core quest operations are available now, and Pro/Elite can be added without changing your classroom identity.'}
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
