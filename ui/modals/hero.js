// /ui/modals/hero.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { showAnimatedModal } from './base.js';
import { callGeminiApi } from '../../api.js';
import { showToast } from '../effects.js';

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

import { canUseFeature } from '../../utils/subscription.js';
import { openAdventurersGuide } from './adventurersGuide.js';
import { publishParentSummary as publishParentSummaryToRuntime } from '../../utils/adminRuntime.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';

// --- NEW: HERO'S CHRONICLE MODAL ---

export function openHeroChronicleModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    import('../../db/listeners.js').then(({ ensureHeroChronicleNotesListener }) => {
        ensureHeroChronicleNotesListener();
        openHeroChronicleModalContent(studentId, student);
    });
}

function openHeroChronicleModalContent(studentId, student) {
    const modal = document.getElementById('hero-chronicle-modal');
    modal.dataset.studentId = studentId;
    const oathsButton = document.getElementById('chronicle-tab-oaths');
    if (oathsButton) {
        oathsButton.hidden = !canUseFeature('heroCampfire');
        oathsButton.onclick = () => switchHeroChronicleTab('oaths');
    }

    // Set student name
    document.getElementById('hero-chronicle-student-name').innerText = `The deeds of ${student.name}`;
    
    // Inject Avatar
    const avatarContainer = document.getElementById('hero-chronicle-avatar');
    if (student.avatar) {
        avatarContainer.innerHTML = `<img src="${student.avatar}" alt="${student.name}">`;
    } else {
        avatarContainer.innerHTML = `<span class="hc-medallion__initial font-title">${student.name.charAt(0)}</span>`;
    }

    bindChronicleCategoryChips();

    // Reset Tabs
    switchHeroChronicleTab('notes');
    
    resetHeroChronicleForm();
    renderHeroChronicleContent(studentId);
    
    // Reset AI output
    markChosenCounsel(null);
    document.getElementById('hero-chronicle-ai-output').innerHTML = `
        <div class="hc-oracle-empty">
            <span class="hc-orb" aria-hidden="true"></span>
            <p>Choose a counsel to receive the Oracle's wisdom.</p>
        </div>
    `;

    showAnimatedModal('hero-chronicle-modal');
}

export function switchHeroChronicleTab(tabId) {
    // Drives the page tint and bookmark colour in styles/chronicle.css
    const chronicleModal = document.getElementById('hero-chronicle-modal');
    if (chronicleModal) chronicleModal.dataset.chronicleTab = tabId;
    const oathsTab = document.getElementById('hero-chronicle-content-oaths');
    const oathsBtn = document.getElementById('chronicle-tab-oaths');
    oathsTab?.classList.toggle('hidden', tabId !== 'oaths');
    oathsBtn?.classList.toggle('active', tabId === 'oaths');
    oathsBtn?.setAttribute('aria-selected', String(tabId === 'oaths'));
    if (tabId === 'oaths') {
        for (const other of ['notes', 'oracle']) {
            document.getElementById('hero-chronicle-content-' + other)?.classList.add('hidden');
            document.getElementById('chronicle-tab-' + other)?.classList.remove('active');
            document.getElementById('chronicle-tab-' + other)?.setAttribute('aria-selected', 'false');
        }
        const studentId = document.getElementById('hero-chronicle-modal')?.dataset.studentId;
        import('./emberOaths.js').then(m => m.renderChronicleOaths(studentId));
        return;
    }
    const notesTab = document.getElementById('hero-chronicle-content-notes');
    const oracleTab = document.getElementById('hero-chronicle-content-oracle');
    const notesBtn = document.getElementById('chronicle-tab-notes');
    const oracleBtn = document.getElementById('chronicle-tab-oracle');

    if (tabId === 'notes') {
        notesTab.classList.remove('hidden');
        oracleTab.classList.add('hidden');
        notesBtn.classList.add('active');
        oracleBtn.classList.remove('active');
        notesBtn.setAttribute('aria-selected', 'true');
        oracleBtn.setAttribute('aria-selected', 'false');
    } else {
        notesTab.classList.add('hidden');
        oracleTab.classList.remove('hidden');
        notesBtn.classList.remove('active');
        oracleBtn.classList.add('active');
        notesBtn.setAttribute('aria-selected', 'false');
        oracleBtn.setAttribute('aria-selected', 'true');
    }
}

export function renderHeroChronicleContent(studentId) {
    const notesFeed = document.getElementById('hero-chronicle-notes-feed');
    const noteCountEl = document.getElementById('chronicle-note-count');
    const notes = state.get('allHeroChronicleNotes')
        .filter(n => n.studentId === studentId)
        .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    if (noteCountEl) noteCountEl.textContent = `${notes.length} ${notes.length === 1 ? 'Note' : 'Notes'}`;

    if (notes.length === 0) {
        notesFeed.innerHTML = `
            <div class="hc-feed-empty">
                <span class="hc-feed-empty__book" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>
                <p class="hc-feed-empty__title font-title">The chronicle is empty...</p>
                <p class="hc-feed-empty__hint">Write the first deed and it will appear here.</p>
            </div>
        `;
        return;
    }

    const categoryIcons = {
        'General': 'fa-bookmark',
        'Academic': 'fa-graduation-cap',
        'Behavior': 'fa-masks-theater',
        'Social': 'fa-comments',
        'Goals': 'fa-bullseye'
    };

    notesFeed.innerHTML = notes.map((note, index) => {
        const icon = categoryIcons[note.category] || 'fa-bookmark';
        const tone = categoryIcons[note.category] ? note.category.toLowerCase() : 'general';
        const date = note.createdAt ? note.createdAt.toDate() : new Date();
        const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const day = date.toLocaleDateString('en-GB', { day: 'numeric' });
        const month = date.toLocaleDateString('en-GB', { month: 'short' });
        const year = date.getFullYear();
        
        return `
            <article class="hc-entry hc-entry--${tone}" style="--i:${Math.min(index, 8)}">
                <time class="hc-entry__date" title="${dateStr}">
                    <span class="hc-entry__day">${day}</span>
                    <span class="hc-entry__month">${month}</span>
                    <span class="hc-entry__year">${year}</span>
                </time>
                <span class="hc-entry__seal" aria-hidden="true"><i class="fas ${icon}"></i></span>
                <div class="hc-entry__body">
                    <div class="hc-entry__head">
                        <span class="hc-entry__cat">${note.category}</span>
                        <div class="hc-entry__actions">
                            <button type="button" class="edit-chronicle-note-btn hc-entry__btn" data-note-id="${note.id}" title="Edit Entry" aria-label="Edit entry">
                                <i class="fas fa-pen-to-square" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="delete-chronicle-note-btn hc-entry__btn hc-entry__btn--danger" data-note-id="${note.id}" title="Delete Entry" aria-label="Delete entry">
                                <i class="fas fa-trash-can" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                    <p class="hc-entry__text">${note.noteText}</p>
                </div>
            </article>
        `;
    }).join('');
}

/** Category chips mirror the hidden <select>, which stays the form's source of truth. */
function syncChronicleCategoryChips() {
    const select = document.getElementById('hero-chronicle-note-category');
    if (!select) return;
    document.querySelectorAll('#hero-chronicle-note-form .hc-cat').forEach(chip => {
        chip.setAttribute('aria-checked', String(chip.dataset.category === select.value));
    });
}

function bindChronicleCategoryChips() {
    const group = document.querySelector('#hero-chronicle-note-form .hc-cats');
    if (!group || group.dataset.bound) return;
    group.dataset.bound = 'true';
    group.addEventListener('click', (e) => {
        const chip = e.target.closest('.hc-cat');
        if (!chip) return;
        document.getElementById('hero-chronicle-note-category').value = chip.dataset.category;
        syncChronicleCategoryChips();
    });
    group.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        const chips = [...group.querySelectorAll('.hc-cat')];
        const current = chips.findIndex(c => c.getAttribute('aria-checked') === 'true');
        const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
        const next = chips[(current + step + chips.length) % chips.length];
        e.preventDefault();
        next.click();
        next.focus();
    });
}

function markChosenCounsel(insightType) {
    document.querySelectorAll('#hero-chronicle-content-oracle .ai-insight-btn').forEach(btn => {
        btn.classList.toggle('is-chosen', btn.dataset.type === insightType);
    });
}

export function resetHeroChronicleForm() {
    const form = document.getElementById('hero-chronicle-note-form');
    form.reset();
    document.getElementById('hero-chronicle-note-id').value = '';
    document.getElementById('hero-chronicle-cancel-edit-btn').classList.add('hidden');
    form.querySelector('button[type="submit"]').textContent = 'Save Note';
    form.classList.remove('is-editing');
    syncChronicleCategoryChips();
}

export function setupNoteForEditing(noteId) {
    const note = state.get('allHeroChronicleNotes').find(n => n.id === noteId);
    if (!note) return;

    document.getElementById('hero-chronicle-note-id').value = noteId;
    document.getElementById('hero-chronicle-note-text').value = note.noteText;
    document.getElementById('hero-chronicle-note-category').value = note.category;
    document.getElementById('hero-chronicle-cancel-edit-btn').classList.remove('hidden');
    document.getElementById('hero-chronicle-note-form').querySelector('button[type="submit"]').textContent = 'Update Note';
    document.getElementById('hero-chronicle-note-form').classList.add('is-editing');
    syncChronicleCategoryChips();
    document.getElementById('hero-chronicle-note-text').focus();
}

function buildInsightPrompts(studentName) {
    return {
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
}

function collectStudentInsightData(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return null;

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

    return { student, notes, academicScores, behavioralAwards };
}

async function requestAIInsight(studentId, insightType) {
    let emberContext = '';
    if (canUseFeature('heroCampfire')) {
        try {
            const { loadEmberOaths } = await import('../../db/actions/emberOaths.js');
            const oaths = (await loadEmberOaths()).filter(o => o.studentId === studentId && (insightType !== 'parent' || !o.private));
            emberContext = JSON.stringify(oaths.map(o => ({ text: o.text, status: o.status, ...(insightType === 'parent' ? {} : { reflection: o.reflection }) })));
        } catch { /* optional context; the original insight remains available */ }
    }
    const insightData = collectStudentInsightData(studentId);
    if (!insightData) return '';
    const { student, notes, academicScores, behavioralAwards } = insightData;
    const prompts = buildInsightPrompts(student.name);
    const prompt = prompts[insightType];
    const systemPrompt = `${prompt.persona} Your task is to analyze a comprehensive record for a student named ${student.name} and generate a specific type of summary. ${prompt.task}`;
    const userPrompt = `Here is the complete record for ${student.name}:
    
    --- TEACHER'S PRIVATE NOTES ---
    ${notes || "No private notes recorded."}

    --- ACADEMIC TRIAL SCORES ---
    ${academicScores || "No academic scores recorded."}

    --- BEHAVIORAL STAR AWARDS ---
    ${behavioralAwards || "No behavioral awards recorded."}

    Please generate the requested summary.`;

    return callGeminiApi(systemPrompt, userPrompt + '\n--- EMBER OATHS (personal goals, not grades) ---\n' + emberContext);
}

export async function generateAIInsight(studentId, insightType) {
    if (!requireEliteAI({ feature: 'The Oracle' })) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const outputEl = document.getElementById('hero-chronicle-ai-output');
    markChosenCounsel(insightType);
    outputEl.innerHTML = `
        <div class="hc-oracle-empty is-thinking">
            <span class="hc-orb" aria-hidden="true"></span>
            <p>The Oracle is consulting the records...</p>
        </div>
    `;
    // On phones the answer sits below the counsel buttons
    outputEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    try {
        const insight = await requestAIInsight(studentId, insightType);
        // Basic markdown to HTML conversion
        let htmlInsight = insight
            .replace(/\*\*\*(.*?)\*\*\*/g, '<b>$1</b>') // Handle ***bold***
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')   // Handle **bold**
            .replace(/### (.*?)\n/g, '<h4 class="hc-oracle-h font-title">$1</h4>')
            .replace(/\* (.*?)\n/g, '<li class="hc-oracle-li"><i class="fas fa-star" aria-hidden="true"></i><span>$1</span></li>')
            .replace(/(\n)/g, '<br>');
            
        outputEl.innerHTML = `<div class="ai-response-container animate-fade-in"><ul class="list-none">${htmlInsight}</ul></div>`;
    } catch (error) {
        console.error("AI Insight Error:", error);
        outputEl.innerHTML = `
            <div class="hc-oracle-empty is-error">
                <i class="fas fa-cloud-bolt" aria-hidden="true"></i>
                <p>The Oracle could not process the records at this time.</p>
                <button onclick="location.reload()" class="hc-ghost-btn">Retry Connection</button>
            </div>
        `;
    }
}

export async function publishParentSummary(studentId) {
    if (!requireEliteAI({ feature: 'The Oracle' })) return;
    const outputEl = document.getElementById('hero-chronicle-ai-output');
    const publishBtn = document.getElementById('hero-chronicle-publish-parent-btn');
    const publishBtnHtml = publishBtn?.innerHTML;
    if (publishBtn) {
        publishBtn.disabled = true;
        publishBtn.innerHTML = '<span class="hc-publish__icon" aria-hidden="true"><i class="fas fa-spinner fa-spin"></i></span><span class="hc-publish__text"><span class="hc-publish__name">Publishing...</span></span>';
    }
    markChosenCounsel(null);
    outputEl.innerHTML = `
        <div class="hc-oracle-empty is-thinking">
            <span class="hc-orb" aria-hidden="true"></span>
            <p>Preparing a parent-safe summary...</p>
        </div>
    `;

    try {
        const summary = await requestAIInsight(studentId, 'parent');
        await publishParentSummaryToRuntime({ studentId, summary });
        outputEl.innerHTML = `<div class="hc-oracle-published"><p class="hc-oracle-published__stamp"><i class="fas fa-circle-check" aria-hidden="true"></i> Published to the Parent Portal</p><div class="hc-oracle-published__text">${summary}</div></div>`;
        showToast('Parent summary published to the portal.', 'success');
    } catch (error) {
        console.error('Could not publish parent summary:', error);
        outputEl.innerHTML = `
            <div class="hc-oracle-empty is-error">
                <i class="fas fa-cloud-bolt" aria-hidden="true"></i>
                <p>The summary could not be published right now.</p>
            </div>
        `;
        showToast(error?.message || 'Could not publish the parent summary.', 'error');
    } finally {
        if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.innerHTML = publishBtnHtml;
        }
    }
}

/** The Adventurer's Guide lives in its own module; kept here so existing callers still work. */
export function openAppInfoModal(options) {
    openAdventurersGuide(options);
}
