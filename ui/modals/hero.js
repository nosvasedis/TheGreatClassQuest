// /ui/modals/hero.js
import * as state from '../../state.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { showAnimatedModal, hideModal } from './base.js';

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

// --- NEW: HERO'S CHRONICLE MODAL ---

export function openHeroChronicleModal(studentId, { tab = 'notes' } = {}) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    import('../../db/listeners.js').then(({ ensureHeroChronicleNotesListener }) => {
        ensureHeroChronicleNotesListener();
        openHeroChronicleModalContent(studentId, student);
        if (tab === 'oracle') switchHeroChronicleTab('oracle');
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

    // The green ribbon on the cover: the child's growth profile in the class; a tap shows them there.
    const greenhouseButton = document.getElementById('hero-chronicle-greenhouse-btn');
    if (greenhouseButton) {
        greenhouseButton.hidden = !student.classId;
        greenhouseButton.onclick = () => showChildInGreenhouse(studentId);
        import('./chronicleClassRibbon.js').then(m => m.paintCoverRibbon(greenhouseButton, student));
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
    bindQuillHears();

    // Reset Tabs
    switchHeroChronicleTab('notes');
    
    resetHeroChronicleForm();
    renderHeroChronicleContent(studentId);
    
    // The Oracle page is read fresh when its tab opens
    markChosenCounsel(null);
    const oracleOutput = document.getElementById('hero-chronicle-ai-output');
    oracleOutput.dataset.view = 'idle';
    oracleOutput.innerHTML = `
        <div class="hc-oracle-empty">
            <span class="hc-orb" aria-hidden="true"></span>
            <p>The Oracle is opening ${student.name.split(' ')[0]}'s notes…</p>
        </div>
    `;

    showAnimatedModal('hero-chronicle-modal');
}

/** Closes the Chronicle and shows this child's glowing dot in the Class Greenhouse (stepping it forward when it waits behind). */
export function showChildInGreenhouse(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student?.classId) return;
    hideModal('hero-chronicle-modal');
    import('./classGreenhouse.js').then(m => m.openClassGreenhouse(student.classId, { tab: 'class', studentId }));
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
        // The reading opens first; a counsel already on the page stays until "The reading" is tapped.
        const studentId = chronicleModal?.dataset.studentId;
        const output = document.getElementById('hero-chronicle-ai-output');
        if (studentId && !['answer', 'thinking'].includes(output?.dataset.view)) {
            import('./heroOracle.js').then(m => m.renderOracleReading(studentId));
        }
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
        refreshOracleIfOpen(studentId);
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
            <article class="hc-entry hc-entry--${tone}" data-note-id="${note.id}" style="--i:${Math.min(index, 8)}">
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
                    <p class="hc-entry__text">${escapeNoteText(note.noteText)}</p>
                </div>
            </article>
        `;
    }).join('');
    // Under each note: how it was read, and the teacher's say over it (lazy).
    import('./chronicleNoteReading.js').then(m => m.paintNoteReadings(notesFeed, studentId)).catch(() => {});
    refreshOracleIfOpen(studentId);
}

function escapeNoteText(text) {
    return String(text || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

function refreshOracleIfOpen(studentId) {
    if (document.getElementById('hero-chronicle-ai-output')?.dataset.view !== 'reading') return;
    import('./heroOracle.js').then(m => m.refreshOracleReading(studentId));
}

/** Opens the Notes page on one entry, as the Oracle's [N3] chips do. */
export function showChronicleNote(noteId) {
    switchHeroChronicleTab('notes');
    const entry = document.querySelector(`#hero-chronicle-notes-feed .hc-entry[data-note-id="${CSS.escape(noteId)}"]`);
    if (!entry) return;
    entry.scrollIntoView({ block: 'center', behavior: 'smooth' });
    entry.classList.remove('is-cited');
    void entry.offsetWidth;
    entry.classList.add('is-cited');
    setTimeout(() => entry.classList.remove('is-cited'), 2600);
}

/** Opens the quill with a question to answer, as the Oracle's "Not in your notes yet" cards do. */
export function startChronicleNote({ prompt = '' } = {}) {
    switchHeroChronicleTab('notes');
    resetHeroChronicleForm();
    const text = document.getElementById('hero-chronicle-note-text');
    if (!text) return;
    if (prompt) text.placeholder = prompt;
    text.focus();
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
    const text = document.getElementById('hero-chronicle-note-text');
    if (text) text.placeholder = "What happened on today's quest?";
    renderQuillHears('');
    syncChronicleCategoryChips();
}

/** Under the quill: the themes the Oracle will read in what is being written. */
function renderQuillHears(value) {
    const el = document.getElementById('hc-quill-hears');
    if (!el) return;
    if (!String(value || '').trim()) { el.innerHTML = ''; return; }
    import('./heroOracle.js').then(m => { el.innerHTML = m.quillHears(document.getElementById('hero-chronicle-note-text')?.value || ''); });
}

function bindQuillHears() {
    const text = document.getElementById('hero-chronicle-note-text');
    if (!text || text.dataset.hearsBound) return;
    text.dataset.hearsBound = 'true';
    let timer = null;
    text.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => renderQuillHears(text.value), 350);
    });
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
    renderQuillHears(note.noteText);
    syncChronicleCategoryChips();
    document.getElementById('hero-chronicle-note-text').focus();
}

// --- The Oracle: ui/modals/heroOracle.js (loaded when the tab opens) ---

export async function generateAIInsight(studentId, insightType) {
    const { askOracleCounsel } = await import('./heroOracle.js');
    return askOracleCounsel(studentId, insightType);
}

export async function publishParentSummary(studentId) {
    const { publishOracleParentSummary } = await import('./heroOracle.js');
    return publishOracleParentSummary(studentId);
}

/** The Adventurer's Guide lives in its own module; kept here so existing callers still work. */
export function openAppInfoModal(options) {
    openAdventurersGuide(options);
}
