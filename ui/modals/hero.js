// /ui/modals/hero.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { showAnimatedModal } from './base.js';
import { callGeminiApi } from '../../api.js';
import {
    getAssessmentAverage,
    getAssessmentValueLabel,
    getNormalizedPercentForScore,
    getQualitativeDistribution
} from '../../features/assessmentConfig.js';

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

import { getTier, canUseFeature } from '../../utils/subscription.js';
import { getTierTagline, getTierSummary, getGuideSections } from '../../config/tiers/features.js';
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
    
    const studentScores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const studentTestScores = studentScores.filter(s => s.type === 'test');
    const studentDictationScores = studentScores.filter(s => s.type === 'dictation');
    const totalTests = studentTestScores.length;
    const totalDictations = studentDictationScores.length;

    const avgTestScore = getAssessmentAverage(studentTestScores, classData);

    let bestTest = null;
    if (totalTests > 0) {
        bestTest = studentTestScores.reduce((best, current) => {
            const bestScore = getNormalizedPercentForScore(best, classData) || 0;
            const currentScore = getNormalizedPercentForScore(current, classData) || 0;
            return currentScore > bestScore ? current : best;
        });
    }
    
    let dictationStatHtml = '';
    if (totalDictations > 0) {
        const qualitativeCounts = getQualitativeDistribution(studentDictationScores, classData);
        const labels = Object.keys(qualitativeCounts);
        const avgDictationScore = getAssessmentAverage(studentDictationScores, classData);
        if (labels.length > 0) {
            const dictationSummary = labels
                .map((label) => `${qualitativeCounts[label]}x ${label}`)
                .join(', ');
            dictationStatHtml = `<div class="hero-stat-item">
                <div class="icon text-blue-400"><i class="fas fa-microphone-alt"></i></div>
                <div class="text">
                    <div class="title">Dictation Results</div>
                    <div class="value">${dictationSummary}${avgDictationScore !== null ? ` • ${avgDictationScore.toFixed(0)}%` : ''}</div>
                </div>
            </div>`;
        } else if (avgDictationScore !== null) {
            dictationStatHtml = `<div class="hero-stat-item">
                <div class="icon text-blue-400"><i class="fas fa-microphone-alt"></i></div>
                <div class="text">
                    <div class="title">Average Dictation Score</div>
                    <div class="value">${avgDictationScore.toFixed(1)}%</div>
                </div>
            </div>`;
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
        const bestScorePercent = (getNormalizedPercentForScore(bestTest, classData) || 0).toFixed(0);
        statsHtml += `<div class="hero-stat-item">
            <div class="icon text-amber-400"><i class="fas fa-award"></i></div>
            <div class="text">
                <div class="title">Best Test Performance</div>
                <div class="value">${bestScorePercent}% on "${bestTest.title || getAssessmentValueLabel(bestTest)}"</div>
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
            const testData = sortedScores.map(s => s.type === 'test' ? (getNormalizedPercentForScore(s, classData) || null) : null);
            const dictationData = sortedScores.map(s => {
                if (s.type !== 'dictation') return null;
                return getNormalizedPercentForScore(s, classData) || null;
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
                                            const normalized = getNormalizedPercentForScore(originalScore, classData) || 0;
                                            label += `${originalScore.scoreQualitative} (${normalized.toFixed(0)}%)`;
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
    const tierBadgeEl = document.getElementById('guide-header-tier-badge');
    const headerEl = document.getElementById('guide-header-shell');

    // ─── ROBUST TIER DETECTION ───────────────────────────────────────────────
    // We use canUseFeature() (reads Firestore boolean flags) as ground truth,
    // not just getTier() (reads the 'tier' string) — older subscription docs
    // may have boolean flags set without the 'tier' string field.
    const hasEliteFeatures = canUseFeature('eliteAI');
    const hasProFeatures   = canUseFeature('guilds') ||
                             canUseFeature('scholarScroll') ||
                             canUseFeature('calendar') ||
                             canUseFeature('storyWeavers') ||
                             canUseFeature('heroProgression') ||
                             canUseFeature('adventureLog');

    // Resolve canonical tier: feature flags win, tier string is the tie-breaker
    const tierString = getTier();
    const rawTier = hasEliteFeatures ? 'elite'
                  : hasProFeatures   ? 'pro'
                  : tierString;   // 'pro' or 'elite' from Firestore tier field if flags not set

    const prettyTier = rawTier === 'elite' ? 'Elite ✨' : rawTier === 'pro' ? 'Pro ⚡' : 'Starter 🌱';
    const tierTagline = getTierTagline(rawTier);
    const tierSummary = getTierSummary(rawTier);

    // hasTier: use the feature flags directly — they ARE the ground truth
    const hasTier = (requiredTier) => {
        if (requiredTier === 'starter') return true;
        if (requiredTier === 'elite')   return hasEliteFeatures || rawTier === 'elite';
        if (requiredTier === 'pro')     return hasEliteFeatures || hasProFeatures || rawTier === 'pro' || rawTier === 'elite';
        return false;
    };

    const tierBadgeHTML = (requiredTier) => {
        if (hasTier(requiredTier)) {
            return '<span class="guide-acc-badge guide-acc-badge-active">✅ Active</span>';
        }
        if (requiredTier === 'pro')   return '<span class="guide-acc-badge guide-acc-badge-locked">🔒 Pro</span>';
        if (requiredTier === 'elite') return '<span class="guide-acc-badge guide-acc-badge-locked">🔒 Elite</span>';
        return '<span class="guide-acc-badge guide-acc-badge-active">✅ Active</span>';
    };

    // Apply tier-themed gradient class and aria to the header
    if (headerEl) {
        headerEl.classList.remove('tier-starter', 'tier-pro', 'tier-elite');
        headerEl.classList.add(`tier-${rawTier}`);
    }

    // Populate header tier badge with appropriate styling
    if (tierBadgeEl) {
        const tierEmoji  = rawTier === 'elite' ? '👑' : rawTier === 'pro' ? '⚡' : '🌱';
        const pillClass  = rawTier === 'elite' ? 'pill-elite' : rawTier === 'pro' ? 'pill-pro' : 'pill-starter';
        const tierLabel  = rawTier === 'elite' ? 'Elite Plan' : rawTier === 'pro' ? 'Pro Plan' : 'Starter Plan';
        tierBadgeEl.innerHTML = `<span class="guide-header-tier-inner ${pillClass}">${tierEmoji} ${tierLabel} — ${tierTagline}</span>`;
    }

    // ─────────── SECTION BUILDER UTILITY ───────────
    const buildSectionHTML = (sections, perspective) => {
        const colorMap = {
            amber:  { bg: 'guide-cluster-amber',  accent: '#b45309' },
            violet: { bg: 'guide-cluster-violet', accent: '#6d28d9' },
            teal:   { bg: 'guide-cluster-teal',   accent: '#0d9488' },
            rose:   { bg: 'guide-cluster-rose',   accent: '#e11d48' },
            cyan:   { bg: 'guide-cluster-cyan',   accent: '#0284c7' },
            indigo: { bg: 'guide-cluster-indigo', accent: '#4338ca' },
        };

        return sections.map((section, sIdx) => {
            const colorClass = colorMap[section.color]?.bg || 'guide-cluster-cyan';
            const featuresHTML = section.features.map((feat, fIdx) => {
                const isActive = hasTier(feat.tier);
                const explain = perspective === 'teacher' ? (feat.teacherExplain || '') : (feat.studentExplain || '');
                const itemId = `gacc-${perspective}-${sIdx}-${fIdx}`;
                return `
                <div class="guide-acc-item${isActive ? '' : ' guide-acc-item-locked'}" data-acc-id="${itemId}">
                    <button class="guide-acc-item-header" aria-expanded="false" aria-controls="${itemId}-body" onclick="this.closest('.guide-acc-item').classList.toggle('open'); const expanded = this.closest('.guide-acc-item').classList.contains('open'); this.setAttribute('aria-expanded', expanded); this.querySelector('.guide-acc-arrow').textContent = expanded ? '▲' : '▼';">
                        <span class="guide-acc-item-left">
                            <span class="guide-acc-emoji">${feat.emoji}</span>
                            <span class="guide-acc-name">${feat.name}</span>
                        </span>
                        <span class="guide-acc-item-right">
                            ${tierBadgeHTML(feat.tier)}
                            <span class="guide-acc-arrow" aria-hidden="true">▼</span>
                        </span>
                    </button>
                    <div class="guide-acc-item-body" id="${itemId}-body" role="region">
                        <p class="guide-acc-explain">${explain}</p>
                        ${feat.why ? `<p class="guide-acc-why">💡 <em>${feat.why}</em></p>` : ''}
                        ${!isActive ? `<p class="guide-acc-upgrade-hint">🔒 Unlock this on the <strong>${feat.tier.charAt(0).toUpperCase() + feat.tier.slice(1)}</strong> plan — contact us to upgrade!</p>` : ''}
                    </div>
                </div>`;
            }).join('');

            return `
            <section class="guide-accordion-group guide-stagger-item ${colorClass}" style="--guide-delay: ${80 + sIdx * 60}ms;">
                <div class="guide-acc-group-header">
                    <span class="guide-acc-group-emoji">${section.emoji}</span>
                    <div>
                        <h4 class="guide-acc-group-title">${section.title}</h4>
                        <p class="guide-acc-group-intro">${section.intro}</p>
                    </div>
                </div>
                <div class="guide-acc-items">${featuresHTML}</div>
            </section>`;
        }).join('');
    };

    // ─────────── DAILY FLOW BUILDER ───────────
    const buildDailyFlow = (steps) => steps.map((step, i) => `
        <article class="guide-flow-card guide-stagger-item" style="--guide-delay: ${500 + i * 60}ms;">
            <div class="guide-flow-num">${i + 1}</div>
            <div class="guide-flow-content">
                <h5 class="guide-flow-title">${step.emoji} ${step.title}</h5>
                <p class="guide-flow-body">${step.body}</p>
            </div>
        </article>`
    ).join('');

    // ─────────── TIER BOTTOM CARD ───────────
    const buildTierCard = () => {
        if (rawTier === 'elite') {
            return `
            <section class="guide-elite-celebration guide-stagger-item" style="--guide-delay: 700ms;">
                <div class="guide-elite-inner">
                    <div class="guide-elite-burst" aria-hidden="true">🎉✨🏆✨🎉</div>
                    <h3 class="guide-elite-title">You've unlocked the Full Quest Universe! 🌟</h3>
                    <p class="guide-elite-body">Every feature, every AI tool, every ceremony enhancement, and every creative tool is live for your school. You are running the most complete gamified English classroom experience available — and your students feel every bit of it.</p>
                    <p class="guide-elite-thanks">💜 Thank you for being a founding legend of The Great Class Quest. This journey grows with you!</p>
                </div>
            </section>`;
        }

        const nextTier = rawTier === 'pro' ? 'Elite' : 'Pro';
        const nextEmoji = rawTier === 'pro' ? '🤖✨' : '⚡🏰';
        const nextPerks = rawTier === 'pro'
            ? [
                '🤖 AI Oracle — personalised class insights automatically',
                '✍️ AI Adventure Log Writer — logs generated after each lesson',
                '🎨 AI Story Images — illustrated covers for your class stories',
                '🔬 Early-access experiments and priority support',
              ]
            : [
                '🏰 Guilds & Sorting Quiz — houses, team competition, champions',
                '⚔️ Hero Classes & Skill Tree — student identity and levelling',
                '📅 Calendar & School Year Planner — full academic year planning',
                '📖 Story Weavers — collaborative storytelling with Word of the Day',
                "📜 Scholar's Scroll — test tracking, dictations, and performance charts",
                '📓 Adventure Log — visual diary, Hall of Heroes, lesson stories',
                '📋 Advanced Attendance — chronicles, monthly view, absence history',
              ];

        return `
        <section class="guide-upgrade-card guide-stagger-item" style="--guide-delay: 700ms;">
            <div class="guide-upgrade-inner">
                <div class="guide-upgrade-top">
                    <span class="guide-upgrade-emoji">${nextEmoji}</span>
                    <div>
                        <h4 class="guide-upgrade-title">Imagine what ${nextTier} would add to your classroom…</h4>
                        <p class="guide-upgrade-subtitle">You're doing amazing things already. Here's what opens up next:</p>
                    </div>
                </div>
                <ul class="guide-upgrade-perks">
                    ${nextPerks.map(p => `<li>${p}</li>`).join('')}
                </ul>
                <p class="guide-upgrade-cta">Interested? <strong>Contact us</strong> to upgrade — no complex setup, just more magic! 🌟</p>
            </div>
        </section>`;
    };

    // ─────────── STUDENT DAILY FLOW ───────────
    const studentDailyFlow = [
        { emoji: '🌅', title: 'Arrive as the Hero you Are', body: 'Walk into class knowing your avatar is waiting. Check your missions, your familiar, and your stars from last time — then get ready to earn more!' },
        { emoji: '⭐', title: 'Earn Stars & Conquer Bounties', body: 'Answer questions, speak English, help classmates, complete bounties — every great moment earns stars. The teacher notices EVERYTHING in the Quest!' },
        { emoji: '🛒', title: 'Build Your Legend', body: 'Visit the Mystic Market, evolve your familiar, level up your hero class, and grow your skill tree. Your character is uniquely yours.' },
        { emoji: '🎉', title: 'Celebrate & Remember', body: 'Monthly ceremonies spotlight the top heroes. Your class story goes in the Adventure Log. These are moments you will actually remember!' },
    ];

    // ─────────── TEACHER DAILY FLOW ───────────
    const teacherDailyFlow = [
        { emoji: '🏫', title: 'Open & Orient (2 min)', body: 'Select your class, glance at the Home dashboard — reminders, any ceremonies due, bounty ideas. You know exactly where the Quest stands before the lesson starts.' },
        { emoji: '⭐', title: 'Award Stars in Real Time', body: 'Tap student avatars to award stars during the lesson. Use reasons (Speaking, Grammar, Effort, Creativity) so students know WHY they earned it. Launch a bounty for an instant energy spike!' },
        { emoji: '📝', title: 'Record What Matters', body: "Log test scores in Scholar's Scroll, mark attendance, write a quick Adventure Log entry. It takes seconds but builds a rich class history over the year." },
        { emoji: '🏆', title: 'Review & Celebrate', body: 'End the lesson with a quick look at the leaderboard. Trigger a ceremony when the time is right. Your students leave talking about the Quest — that is the goal!' },
    ];

    const studentSections = getGuideSections('student');
    const teacherSections = getGuideSections('teacher');

    // ─────────── PHILOSOPHY INTRO ───────────
    const studentPhilosophyHTML = `
    <section class="guide-philosophy-card guide-philosophy-student guide-stagger-item" style="--guide-delay: 30ms;">
        <div class="guide-philosophy-inner">
            <span class="guide-philosophy-icon">🌍</span>
            <div>
                <h4 class="guide-philosophy-title">Why is English Class a Quest? 🗡️</h4>
                <p class="guide-philosophy-body">Because language learning is an adventure — and adventures need heroes, rewards, companions, and celebrations. <strong>The Great Class Quest</strong> turns every lesson into a chapter of your own story. Stars are XP. Your teacher is the Quest Master. Every word you learn is a new power. Every answer you give is a move forward. You are genuinely becoming a better version of yourself — and the Quest makes that visible, tangible, and FUN. 🚀</p>
            </div>
        </div>
    </section>`;

    const teacherPhilosophyHTML = `
    <section class="guide-philosophy-card guide-philosophy-teacher guide-stagger-item" style="--guide-delay: 30ms;">
        <div class="guide-philosophy-inner">
            <span class="guide-philosophy-icon">🏫</span>
            <div>
                <h4 class="guide-philosophy-title">Why Gamify Your English Classroom? ✨</h4>
                <p class="guide-philosophy-body"><strong>The Great Class Quest</strong> is built specifically for English teachers in private language schools. It answers a real challenge: how do you keep students genuinely engaged lesson after lesson, year after year, across all levels and ages? The answer is a carefully designed reward economy, a hero identity for every student, team dynamics through Guilds, academic tracking through Scholar's Scroll, and a living story — the Adventure Log — that makes every lesson feel part of something bigger. You don't need to change how you teach. You just give the Quest to your classroom and watch what happens. 🌟</p>
            </div>
        </div>
    </section>`;

    // ─────────── BUILD FINAL HTML ───────────
    studentContent.innerHTML = `
        <section class="guide-hero-card guide-student-hero guide-sparkle-layer guide-stagger-item" style="--guide-delay: 0ms;">
            <h3 class="font-title text-3xl md:text-4xl text-cyan-900 mb-2">🧙 Welcome, Hero!</h3>
            <p class="text-slate-700 text-base md:text-lg leading-relaxed mb-3">
                This is your complete guide to The Great Class Quest — <em>your</em> adventure in English class. Tap any feature below to discover what it does, what you can unlock, and why it makes class genuinely exciting! 🌟
            </p>
            <div class="guide-tier-chip-row">
                <span class="guide-tier-chip">🏫 School Plan: ${prettyTier}</span>
                <span class="guide-tier-chip guide-tier-chip-soft">${tierTagline}</span>
            </div>
        </section>

        ${studentPhilosophyHTML}

        <div class="guide-section-label guide-stagger-item" style="--guide-delay: 60ms;">🗂️ Tap any feature to learn what it does!</div>

        ${buildSectionHTML(studentSections, 'student')}

        <section class="guide-panel guide-stagger-item" style="--guide-delay: 480ms;">
            <h4 class="guide-section-title">⚡ Your Daily Quest Loop</h4>
            <div class="guide-flow-grid">${buildDailyFlow(studentDailyFlow)}</div>
        </section>

        ${buildTierCard()}
    `;

    teacherContent.innerHTML = `
        <section class="guide-hero-card guide-teacher-hero guide-sparkle-layer guide-stagger-item" style="--guide-delay: 0ms;">
            <h3 class="font-title text-3xl md:text-4xl text-emerald-900 mb-2">🏫 Welcome, Quest Master!</h3>
            <p class="text-slate-700 text-base md:text-lg leading-relaxed mb-3">
                This guide covers everything in The Great Class Quest — designed for English teachers and school owners. Tap any feature to see a full explanation in plain English (no tech jargon, ever). Your current plan is shown on each feature so you always know what's live. 🌟
            </p>
            <div class="guide-tier-chip-row">
                <span class="guide-tier-chip">👑 Active Plan: ${prettyTier}</span>
                <span class="guide-tier-chip guide-tier-chip-soft">${tierTagline}</span>
            </div>
        </section>

        ${teacherPhilosophyHTML}

        <div class="guide-section-label guide-stagger-item" style="--guide-delay: 60ms;">🗂️ Tap any feature to see its full explanation!</div>

        ${buildSectionHTML(teacherSections, 'teacher')}

        <section class="guide-panel guide-stagger-item" style="--guide-delay: 480ms;">
            <h4 class="guide-section-title">⚡ Your Daily Teaching Loop</h4>
            <div class="guide-flow-grid">${buildDailyFlow(teacherDailyFlow)}</div>
        </section>

        ${buildTierCard()}
    `;

    // Reset Tabs — show Students by default
    const studentBtn = document.getElementById('info-btn-students');
    const teacherBtn = document.getElementById('info-btn-teachers');

    studentBtn.classList.add('active');
    teacherBtn.classList.remove('active');

    studentContent.classList.remove('hidden');
    teacherContent.classList.add('hidden');

    showAnimatedModal('app-info-modal');
}
