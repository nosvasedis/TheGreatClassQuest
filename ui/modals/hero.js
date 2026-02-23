// /ui/modals/hero.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { showAnimatedModal } from './base.js';
import { callGeminiApi } from '../../api.js';

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

    // 1. STUDENTS CONTENT (Adventure Guide)
    studentContent.innerHTML = `
        <div class="bg-white/80 p-6 rounded-3xl shadow-sm border-l-8 border-cyan-400">
            <h3 class="font-title text-3xl text-cyan-800 mb-4"><i class="fas fa-map-signs"></i> Your Journey Begins!</h3>
            <p class="text-gray-700 text-lg leading-relaxed">
                Welcome, brave adventurer! In <strong>The Great Class Quest</strong>, your classroom is a team, and every lesson is a step on an epic journey. 
                Work together, learn new things, and earn <strong>Stars</strong> to travel across the map!
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-amber-50 p-6 rounded-2xl border-2 border-amber-200">
                <h4 class="font-title text-xl text-amber-700 mb-2"><i class="fas fa-star"></i> Earning Stars</h4>
                <p class="text-sm text-gray-600">
                    Show <strong>Teamwork</strong>, <strong>Creativity</strong>, <strong>Focus</strong>, and <strong>Respect</strong>. Every star your teacher awards moves your class ship forward on the Team Map!
                </p>
            </div>
            <div class="bg-purple-50 p-6 rounded-2xl border-2 border-purple-200">
                <h4 class="font-title text-xl text-purple-700 mb-2"><i class="fas fa-medal"></i> Hero's Challenge</h4>
                <p class="text-sm text-gray-600">
                    Your personal stars count too! Climb the ranks from <strong>Bronze</strong> to <strong>Diamond</strong>. Be the "Class Hero" by helping others!
                </p>
            </div>
            <div class="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-200">
                <h4 class="font-title text-xl text-indigo-700 mb-2"><i class="fas fa-store"></i> The Mystic Shop</h4>
                <p class="text-sm text-gray-600">
                    Earn <strong>Gold Coins</strong> by collecting stars. Spend them on cool virtual artifacts like swords, pets, and potions to decorate your profile!
                </p>
            </div>
            <div class="bg-green-50 p-6 rounded-2xl border-2 border-green-200">
                <h4 class="font-title text-xl text-green-700 mb-2"><i class="fas fa-feather-alt"></i> Story Weavers</h4>
                <p class="text-sm text-gray-600">
                    Every lesson, you create a story together. The AI illustrates your adventure based on what you learn!
                </p>
            </div>
        </div>
    `;

    // 2. TEACHERS CONTENT (Game Master's Manual)
    teacherContent.innerHTML = `
        <div class="bg-white/80 p-6 rounded-3xl shadow-sm border-l-8 border-green-500">
            <h3 class="font-title text-3xl text-green-800 mb-4"><i class="fas fa-chalkboard-teacher"></i> The Philosophy</h3>
            <p class="text-gray-700 text-lg leading-relaxed">
                This app turns classroom management into a cooperative RPG. Instead of policing behavior, you are the <strong>Game Master</strong> guiding a guild of heroes.
                Use visuals, sounds, and AI storytelling to make "boring" tasks (attendance, homework) feel magical.
            </p>
        </div>

        <div class="space-y-6">
            <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div class="text-3xl text-rose-500"><i class="fas fa-mouse-pointer"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">One-Tap Awards</h4>
                    <p class="text-sm text-gray-600">Go to <strong>Award Stars</strong>. Tap a student card to give 1 star. Tap the small buttons for specific amounts. Use the "Undo" button on the card if you make a mistake.</p>
                </div>
            </div>

            <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div class="text-3xl text-blue-500"><i class="fas fa-calendar-check"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">The Daily Rhythm</h4>
                    <p class="text-sm text-gray-600">
                        1. <strong>Home Tab:</strong> Check active class.<br>
                        2. <strong>Roll Call:</strong> Mark absences (removes today's stars).<br>
                        3. <strong>Award:</strong> Give stars during lesson.<br>
                        4. <strong>Log:</strong> At end of class, go to <strong>Log</strong> tab and click "Log Adventure". The AI writes the summary!
                    </p>
                </div>
            </div>

            <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div class="text-3xl text-amber-500"><i class="fas fa-crown"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">Ceremonies</h4>
                    <p class="text-sm text-gray-600">
                        At the start of a new month, the <strong>Team Quest</strong> and <strong>Hero's Challenge</strong> buttons will glow. Click them to launch the automated Award Ceremony for the previous month!
                    </p>
                </div>
            </div>
        </div>
    `;

    // 3. Reset Tabs (Show Student by default)
    const studentBtn = document.getElementById('info-btn-students');
    const teacherBtn = document.getElementById('info-btn-teachers');
    
    studentBtn.classList.add('bg-cyan-500', 'text-white', 'active');
    studentBtn.classList.remove('bg-white', 'text-cyan-700');
    teacherBtn.classList.remove('bg-green-500', 'text-white', 'active');
    teacherBtn.classList.add('bg-white', 'text-green-700');
    
    studentContent.classList.remove('hidden');
    teacherContent.classList.add('hidden');

    showAnimatedModal('app-info-modal');
}
