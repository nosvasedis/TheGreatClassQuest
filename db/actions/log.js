// /db/actions/log.js — log, hero chronicle, quest events, attendance, holidays
import {
    db,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    writeBatch,
    serverTimestamp,
    increment,
    orderBy,
    getDoc
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast, showPraiseToast } from '../../ui/effects.js';
import { showModal, hideModal } from '../../ui/modals.js';
import { callGeminiApi } from '../../api.js';
import { playSound } from '../../audio.js';
import { canUseFeature } from '../../utils/subscription.js';
import { handleStoryWeaversClassSelect } from '../../features/storyWeaver.js';
import { getTodayDateString, parseFlexibleDate, normalizeToDateString, parseDDMMYYYY } from '../../utils.js';
import { reconcileFamiliarLifecycle } from '../../features/familiars.js';
import { applyAwardOutwardSkillEffects, applyReasonAwardScoreTransaction, showHeroLevelUpCelebration } from './stars.js';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { retryAdventureLogGeneration } from './quests.js';

export async function addOrUpdateHeroChronicleNote(studentId, noteText, category, noteId = null) {
    if (!studentId || !noteText || !category) {
        showToast("Missing required note information.", "error");
        return;
    }
    
    const noteData = {
        studentId,
        teacherId: state.get('currentUserId'),
        noteText,
        category,
        updatedAt: serverTimestamp()
    };

    try {
        if (noteId) {
            const noteRef = doc(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`, noteId);
            await updateDoc(noteRef, noteData);
            showToast("Note updated successfully!", "success");
        } else {
            noteData.createdAt = serverTimestamp();
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`), noteData);
            showToast("Note added to Hero's Chronicle!", "success");
        }
    } catch (error) {
        console.error("Error saving Hero's Chronicle note:", error);
        showToast("Failed to save note.", "error");
    }
}

export async function deleteHeroChronicleNote(noteId) {
    try {
        await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/hero_chronicle_notes`, noteId));
        showToast("Note deleted.", "success");
    } catch (error) {
        console.error("Error deleting Hero's Chronicle note:", error);
        showToast("Failed to delete note.", "error");
    }
}

export async function deleteAdventureLog(logId) {
    showModal('Delete Log Entry?', 'Are you sure you want to permanently delete this entry from the Adventure Log?', async () => {
        try {
            await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId));
            showToast('Log entry deleted.', 'success');
        } catch (error) {
            console.error("Error deleting log entry:", error);
            showToast('Could not delete the log entry.', 'error');
        }
    });
}

export async function handleEndStory() {
    const classId = state.get('globalSelectedClassId');
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    const currentStoryData = state.get('currentStoryData');

    if (!classData || !currentStoryData[classId]) {
        showToast("There is no active story to end.", "info");
        return;
    }

    showModal('Finish this Storybook?', 'This will mark the story as complete and move it to the archive. You will start with a blank page. Are you sure?', async () => {
        const endBtn = document.getElementById('story-weavers-end-btn');
        endBtn.disabled = true;
        endBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

        try {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const storyDocRef = doc(db, `${publicDataPath}/story_data`, classId);
            const historyCollectionRef = collection(db, `${storyDocRef.path}/story_history`);
            const historySnapshot = await getDocs(query(historyCollectionRef, orderBy("createdAt", "asc")));

            if (historySnapshot.empty) {
                showToast("Cannot end an empty story.", "error");
                return;
            }

            const storyChapters = historySnapshot.docs.map(d => d.data());
            let storyTitle;
            if (canUseFeature('eliteAI')) {
                storyTitle = await callGeminiApi(
                    "You are an AI that creates short, creative book titles. Based on the story, create a title that is 2-5 words long. Provide only the title, no extra text or quotation marks.",
                    `The story is: ${storyChapters.map(c => c.sentence).join(' ')}`
                );
            } else {
                storyTitle = `${classData.name} Story`;
            }

            const batch = writeBatch(db);
            const newArchiveDocRef = doc(collection(db, `${publicDataPath}/completed_stories`));
            const firstChapter = storyChapters[0] || {};
            const coverImageUrl = firstChapter.imageUrl || null;
            const coverImageBase64 = !coverImageUrl ? (firstChapter.imageBase64 || null) : null;
            
            batch.set(newArchiveDocRef, {
                title: storyTitle,
                classId: classId,
                className: classData.name,
                classLogo: classData.logo,
                coverImageUrl,
                coverImageBase64,
                completedAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });

            storyChapters.forEach((chapter, index) => {
                const chapterDocRef = doc(collection(db, `${newArchiveDocRef.path}/chapters`));
                batch.set(chapterDocRef, { ...chapter, chapterNumber: index + 1 });
            });
            
            historySnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(storyDocRef);

            await batch.commit();
            
            handleStoryWeaversClassSelect();
            showToast(`Storybook "${storyTitle}" has been archived!`, "success");

        } catch (error) {
            console.error("Error ending story:", error);
            showToast("Failed to archive the story. Please try again.", "error");
        } finally {
            endBtn.disabled = false;
            endBtn.innerHTML = `The End`;
        }
    }, "Yes, Finish It!");
}

export async function handleDeleteCompletedStory(storyId) {
    const story = state.get('allCompletedStories').find(s => s.id === storyId);
    if (!story) return;

    showModal('Delete This Storybook?', `Are you sure you want to permanently delete "${story.title}"? This cannot be undone.`, async () => {
        try {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const storyDocRef = doc(db, `${publicDataPath}/completed_stories`, storyId);
            const chaptersSnapshot = await getDocs(collection(db, `${storyDocRef.path}/chapters`));

            const batch = writeBatch(db);
            chaptersSnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(storyDocRef);
            await batch.commit();

            hideModal('storybook-viewer-modal');
            showToast('Storybook deleted.', 'success');
        } catch (error) {
            showToast('Failed to delete storybook.', 'error');
        }
    }, 'Delete Forever');
}

export function handleDeleteTrial(trialId) {
    showModal('Delete Trial Record?', 'Are you sure you want to permanently delete this score? This cannot be undone.', async () => {
        try {
            await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/written_scores", trialId));
            showToast('Trial record deleted.', 'success');
        } catch (error) {
            console.error("Error deleting trial record:", error);
            showToast('Could not delete the record.', 'error');
        }
    });
}

// === MODIFIED SECTION: Starfall Logic & Bulk Saving ===

export async function handleAwardBonusStar(studentId, bonusAmount, trialType) {
    playSound('star3');
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    let levelUpInfo = null;
    let finalBonus = bonusAmount;

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const scoreDoc = await transaction.get(scoreRef);

            if (scoreDoc.exists()) {
                const currentScoreData = scoreDoc.data();
                // --- STARFALL CATALYST CHECK ---
                if (currentScoreData.starfallCatalystActive) {
                    finalBonus *= 2;
                    transaction.update(scoreRef, { starfallCatalystActive: false });
                }
            }

            const txResult = applyReasonAwardScoreTransaction(transaction, {
                scoreRef,
                studentId,
                studentData: student,
                scoreData: scoreDoc.exists() ? scoreDoc.data() : null,
                reason: 'scholar_s_bonus',
                awardedStars: finalBonus
            });
            levelUpInfo = txResult.levelUpInfo;

            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
            const logData = {
                studentId,
                classId: student.classId,
                teacherId: state.get('currentUserId'),
                stars: finalBonus,
                appliedStarCredit: txResult.totalStarsDelta,
                reason: "scholar_s_bonus",
                note: `Awarded for exceptional performance on a ${trialType}.`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };
            transaction.set(newLogRef, logData);
        });
        applyAwardOutwardSkillEffects(studentId, student.classId, 'scholar_s_bonus', finalBonus).catch((e) => console.warn('Scholar outward skill effect failed:', e));
        reconcileFamiliarLifecycle(studentId, { announce: true, source: 'trial-bonus' }).catch((e) => console.warn('Trial familiar reconciliation failed:', e));
        showHeroLevelUpCelebration(levelUpInfo);
        showToast(`✨ A Bonus has been bestowed upon ${student.name}! ✨`, 'success');
    } catch (error) {
        console.error("Scholar's Bonus transaction failed:", error);
        showToast('Could not award the bonus star. Please try again.', 'error');
    }
}

export async function handleBatchAwardBonus(students) {
    playSound('star3');
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const today = getTodayDateString();
    const levelUps = [];

    try {
        for (const { studentId, bonusAmount, trialType } of students) {
            const student = state.get('allStudents').find(s => s.id === studentId);
            if (!student) continue;

            let levelUpInfo = null;
            await runTransaction(db, async (transaction) => {
                const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                const scoreDoc = await transaction.get(scoreRef);

                const txResult = applyReasonAwardScoreTransaction(transaction, {
                    scoreRef,
                    studentId,
                    studentData: student,
                    scoreData: scoreDoc.exists() ? scoreDoc.data() : null,
                    reason: 'scholar_s_bonus',
                    awardedStars: bonusAmount
                });
                levelUpInfo = txResult.levelUpInfo;

                const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
                const logData = {
                    studentId,
                    classId: student.classId,
                    teacherId: state.get('currentUserId'),
                    stars: bonusAmount,
                    appliedStarCredit: txResult.totalStarsDelta,
                    reason: "scholar_s_bonus",
                    note: `Awarded for exceptional performance on a ${trialType}.`,
                    date: today,
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                };
                transaction.set(newLogRef, logData);
            });

            if (levelUpInfo) levelUps.push(levelUpInfo);
            applyAwardOutwardSkillEffects(studentId, student.classId, 'scholar_s_bonus', bonusAmount).catch((e) => console.warn('Batch scholar outward skill effect failed:', e));
            reconcileFamiliarLifecycle(studentId, { announce: true, source: 'trial-batch-bonus' }).catch((e) => console.warn('Batch familiar reconciliation failed:', e));
        }

        levelUps.forEach(showHeroLevelUpCelebration);
        showToast(`✨ ${students.length} Scholars received their bonus stars! ✨`, 'success');
    } catch (error) {
        console.error("Batch Scholar's Bonus failed:", error);
        showToast('Could not award bonuses. Please try again.', 'error');
    }
}

export async function saveAdventureLogNote() {
    const logId = document.getElementById('note-log-id-input').value;
    const newNote = document.getElementById('note-textarea').value;
    const log = state.get('allAdventureLogs').find(l => l.id === logId);

    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId), {
            note: newNote,
            noteBy: state.get('currentTeacherName')
        });
        showToast('Note saved!', 'success');
        hideModal('note-modal'); 
        if (log && newNote.trim() !== '' && newNote !== log.note) {
            triggerNoteToast(log.text, newNote); 
        }
    } catch (error) {
        console.error("Error saving note:", error);
        showToast('Failed to save note.', 'error');
    }
}

export async function editAdventureLogEntry(logId) {
    const log = state.get('allAdventureLogs').find(l => l.id === logId);
    if (!log) return;
    const entryMode = inferAdventureLogEntryMode(log);

    if (!canEditAdventureLog(log)) {
        showToast(
            entryMode === 'ai'
                ? 'AI-written Adventure Log entries can be edited on the Elite plan.'
                : 'Manual Adventure Log entries can be edited on Pro or Elite.',
            'info'
        );
        return;
    }

    openAdventureLogEditor(logId, log);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function inferAdventureLogEntryMode(log) {
    const explicitMode = String(log?.entryMode || '').toLowerCase();
    if (explicitMode === 'manual' || explicitMode === 'ai') return explicitMode;
    return (log?.imageUrl || log?.imageBase64) ? 'ai' : 'manual';
}

function canEditAdventureLog(log) {
    return canUseFeature('eliteAI') || (inferAdventureLogEntryMode(log) === 'manual' && canUseFeature('adventureLog'));
}

function formatAdventureLogEditorDateChip(log) {
    const dateObj = parseFlexibleDate(log?.date);
    if (!dateObj || isNaN(dateObj.getTime())) {
        const fallback = String(log?.date || '').trim();
        return fallback ? escapeHtml(fallback) : '';
    }
    return escapeHtml(
        dateObj.toLocaleDateString('en-GB', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    );
}

function syncHeroLine(text, heroName) {
    const storyText = String(text || '').trim();
    const normalizedHeroName = String(heroName || 'The Class Team').trim() || 'The Class Team';
    const heroLine = `Hero of the Day: ${normalizedHeroName}.`;
    const heroLinePattern = /(^|\n{1,2})Hero of the Day:\s*[^\n]+/im;

    if (!storyText) return heroLine;
    if (heroLinePattern.test(storyText)) {
        return storyText.replace(heroLinePattern, (match, prefix = '') => `${prefix}${heroLine}`);
    }
    return `${storyText}\n\n${heroLine}`;
}

function openAdventureLogEditor(logId, log) {
    const existing = document.getElementById('adventure-log-editor-modal');
    if (existing) existing.remove();
    const entryMode = inferAdventureLogEntryMode(log);
    const heroLabel = escapeHtml(log.hero || 'The Class Team');
    const dateChipHtml = formatAdventureLogEditorDateChip(log);
    const subtitle = entryMode === 'manual'
        ? 'Refine your manual chronicle. The crowned hero stays locked in.'
        : 'Polish the AI-written story, keep the magic, and publish your final version.';
    const aiRewriteControl = entryMode === 'ai'
        ? `<button type="button" id="adventure-log-ai-rewrite-btn" class="adventure-log-editor-ai-btn" title="Rewrite this day with the Chronicler (AI)">
                <i class="fas fa-wand-magic-sparkles adventure-log-editor-ai-icon" aria-hidden="true"></i>
                <span class="adventure-log-editor-ai-label">AI</span>
           </button>`
        : '';

    const overlay = document.createElement('div');
    overlay.id = 'adventure-log-editor-modal';
    overlay.className = 'adventure-log-editor-overlay';
    overlay.innerHTML = `
        <section class="adventure-log-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="adventure-log-editor-title">
            <header class="adventure-log-editor-header">
                <div class="adventure-log-editor-header-pattern" aria-hidden="true"></div>
                <div class="adventure-log-editor-header-inner">
                    <div class="adventure-log-editor-header-brand">
                        <div class="adventure-log-editor-icon-box" aria-hidden="true">
                            <i class="fas fa-book-open"></i>
                        </div>
                        <div class="adventure-log-editor-header-text">
                            <p class="adventure-log-editor-kicker">Adventure Log</p>
                            <h2 id="adventure-log-editor-title" class="adventure-log-editor-title">Edit Entry</h2>
                            <p class="adventure-log-editor-subtitle">${subtitle}</p>
                            ${dateChipHtml ? `<p class="adventure-log-editor-date-chip"><i class="fas fa-calendar-day" aria-hidden="true"></i><span>${dateChipHtml}</span></p>` : ''}
                        </div>
                    </div>
                    <button type="button" id="adventure-log-editor-close-btn" class="adventure-log-editor-close" aria-label="Close editor">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </header>

            <div class="adventure-log-editor-body">
                <div class="adventure-log-editor-card">
                    <div class="adventure-log-editor-field">
                        <label for="edit-log-title">Title</label>
                        <input type="text" id="edit-log-title" maxlength="90" value="${escapeHtml(log.title || '')}" placeholder="Enter a clear, memorable title">
                        <p id="edit-log-title-counter" class="adventure-log-editor-hint">0 / 90</p>
                    </div>
                </div>

                <div class="adventure-log-editor-card adventure-log-editor-card--story">
                    <div class="adventure-log-editor-field">
                        <div class="adventure-log-editor-label-row">
                            <label for="edit-log-text">Story</label>
                            ${aiRewriteControl}
                        </div>
                        <textarea id="edit-log-text" rows="10" placeholder="Write what happened in this lesson...">${escapeHtml(log.text || '')}</textarea>
                        <p class="adventure-log-editor-hint">Tip: Use Cmd/Ctrl + Enter to save quickly.</p>
                    </div>
                </div>

                <div class="adventure-log-editor-grid">
                    <div class="adventure-log-editor-card">
                        <div class="adventure-log-editor-field">
                            <label>Hero of the Day</label>
                            <div class="adventure-log-editor-hero-pill">
                                <i class="fas fa-crown" aria-hidden="true"></i>
                                <span>${heroLabel}</span>
                            </div>
                            <p class="adventure-log-editor-hint">This hero is locked after the lesson is crowned.</p>
                        </div>
                    </div>

                    <div class="adventure-log-editor-card">
                        <div class="adventure-log-editor-field">
                            <label for="edit-log-highlights">Highlights</label>
                            <input type="text" id="edit-log-highlights" value="${escapeHtml((log.highlights || []).join(', '))}" placeholder="Teamwork, Creativity, Confidence">
                            <p class="adventure-log-editor-hint">Use commas to separate up to 4 highlights.</p>
                        </div>
                    </div>
                </div>
            </div>

            <footer class="adventure-log-editor-footer">
                <div class="adventure-log-editor-footer-inner">
                    <button type="button" id="cancel-edit-log-btn" class="adventure-log-editor-btn secondary">Cancel</button>
                    <button type="button" id="save-edit-log-btn" class="adventure-log-editor-btn primary">
                        <i class="fas fa-save"></i>
                        Save Changes
                    </button>
                </div>
            </footer>
        </section>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('adventure-log-editor-open');

    const titleInput = overlay.querySelector('#edit-log-title');
    const storyInput = overlay.querySelector('#edit-log-text');
    const counter = overlay.querySelector('#edit-log-title-counter');
    const closeBtn = overlay.querySelector('#adventure-log-editor-close-btn');
    const cancelBtn = overlay.querySelector('#cancel-edit-log-btn');
    const saveBtn = overlay.querySelector('#save-edit-log-btn');
    const highlightsInput = overlay.querySelector('#edit-log-highlights');
    const aiRewriteBtn = overlay.querySelector('#adventure-log-ai-rewrite-btn');

    let aiRewriteBusy = false;

    const updateCounter = () => {
        const len = titleInput.value.length;
        counter.textContent = `${len} / 90`;
        counter.classList.toggle('limit', len > 80);
    };

    const closeEditor = () => {
        document.removeEventListener('keydown', onEscape);
        document.body.classList.remove('adventure-log-editor-open');
        overlay.remove();
    };

    const onEscape = (event) => {
        if (aiRewriteBusy) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeEditor();
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            saveBtn.click();
        }
    };

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay && !aiRewriteBusy) closeEditor();
    });
    closeBtn.addEventListener('click', closeEditor);
    cancelBtn.addEventListener('click', closeEditor);
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        await saveEditedLogEntry(logId, overlay);
        if (document.body.contains(overlay)) saveBtn.disabled = false;
    });

    if (aiRewriteBtn) {
        const iconEl = aiRewriteBtn.querySelector('.adventure-log-editor-ai-icon');
        aiRewriteBtn.addEventListener('click', async () => {
            aiRewriteBusy = true;
            aiRewriteBtn.disabled = true;
            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            closeBtn.disabled = true;
            aiRewriteBtn.classList.add('is-loading');
            if (iconEl) {
                iconEl.className = 'fas fa-spinner fa-spin adventure-log-editor-ai-icon';
            }
            try {
                await retryAdventureLogGeneration(logId);
                const logRef = doc(db, 'artifacts/great-class-quest/public/data/adventure_logs', logId);
                const snap = await getDoc(logRef);
                if (snap.exists()) {
                    const d = snap.data();
                    const st = String(d?.generationStatus || '').toLowerCase();
                    if (st !== 'failed') {
                        titleInput.value = d.title || '';
                        storyInput.value = d.text || '';
                        if (highlightsInput) highlightsInput.value = (d.highlights || []).join(', ');
                        updateCounter();
                        const { renderAdventureLog } = await import('../../ui/tabs/log.js');
                        await renderAdventureLog();
                    }
                }
            } catch (err) {
                console.error('AI rewrite from adventure log editor failed:', err);
            } finally {
                aiRewriteBusy = false;
                aiRewriteBtn.disabled = false;
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
                closeBtn.disabled = false;
                aiRewriteBtn.classList.remove('is-loading');
                if (iconEl) {
                    iconEl.className = 'fas fa-wand-magic-sparkles adventure-log-editor-ai-icon';
                }
            }
        });
    }

    titleInput.addEventListener('input', updateCounter);
    document.addEventListener('keydown', onEscape);

    updateCounter();
    requestAnimationFrame(() => titleInput.focus());
}

async function saveEditedLogEntry(logId, rootEl = document) {
    const log = state.get('allAdventureLogs').find(l => l.id === logId);
    if (!log) return;

    const title = rootEl.querySelector('#edit-log-title').value.trim();
    const text = rootEl.querySelector('#edit-log-text').value.trim();
    const highlightsText = rootEl.querySelector('#edit-log-highlights').value.trim();
    
    if (!title || !text) {
        showToast('Title and story cannot be empty.', 'error');
        return;
    }

    if (!canEditAdventureLog(log)) {
        showToast('You do not have permission to edit this Adventure Log entry.', 'error');
        return;
    }
    
    try {
        const entryMode = inferAdventureLogEntryMode(log);
        const finalText = entryMode === 'manual' ? syncHeroLine(text, log.hero || 'The Class Team') : text;
        const highlights = highlightsText ? highlightsText.split(',').map(h => h.trim()).filter(h => h) : [];
        const keywords = finalText.toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}_-]/gu, '')).filter(w => w.length > 3).slice(0, 6);
        
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId), {
            title: title.slice(0, 90),
            text: finalText,
            highlights: highlights.slice(0, 4),
            keywords: keywords.slice(0, 6),
            entryMode,
            editedAt: serverTimestamp(),
            editedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        });

        const overlay = document.getElementById('adventure-log-editor-modal');
        if (overlay) {
            document.body.classList.remove('adventure-log-editor-open');
            overlay.remove();
        }
        showToast('Adventure log entry updated!', 'success');
        
        // Refresh the log display
        const { renderAdventureLog } = await import('../../ui/tabs/log.js');
        await renderAdventureLog();
    } catch (error) {
        console.error("Error saving edited log:", error);
        showToast('Failed to save changes. Please try again.', 'error');
    }
}

async function triggerNoteToast(logText, noteText) {
    showPraiseToast('Note saved — another moment in the chronicle!', '📝');
}

export async function saveAwardNote() {
    const logId = document.getElementById('award-note-log-id-input').value;
    const newNote = document.getElementById('award-note-textarea').value;

    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/award_log", logId), {
            note: newNote,
        });
        showToast('Note saved!', 'success');
        hideModal('award-note-modal');
    } catch (error) {
        console.error("Error saving award note:", error);
        showToast('Failed to save note.', 'error');
    }
}

/**
 * @param {{ silent?: boolean }} [options] - If silent, skip success toasts (for bulk operations).
 * @returns {Promise<'marked_absent'|'already_absent'|'marked_present'|undefined>}
 */
export async function handleMarkAbsent(studentId, classId, isAbsent, targetDate = getTodayDateString(), options = {}) {
    const silent = !!options.silent;
    const today = normalizeToDateString(targetDate) || targetDate || getTodayDateString();
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const attendanceCollectionRef = collection(db, `${publicDataPath}/attendance`);

    try {
        const q = query(
            attendanceCollectionRef,
            where("studentId", "==", studentId),
            where("date", "==", today)
        );
        const snapshot = await getDocs(q);

        if (isAbsent) {
            // Mark Absent Logic:
            // 1. Create attendance record if not exists
            // 2. Remove ANY stars awarded today (today_stars)
            // 3. Remove logs for today (award_log)
            // 4. Decrement student_scores
            
            if (!snapshot.empty) return 'already_absent';
            
            await runTransaction(db, async (transaction) => {
                // 1. Create Attendance Record
                const newAttendanceRef = doc(attendanceCollectionRef);
                transaction.set(newAttendanceRef, {
                    studentId,
                    classId,
                    date: today,
                    markedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
                    createdAt: serverTimestamp()
                });

                // 2. Find & Delete 'today_stars'
                const todayStarsQ = query(collection(db, `${publicDataPath}/today_stars`), where("studentId", "==", studentId), where("date", "==", today));
                const todayStarsSnap = await getDocs(todayStarsQ);

                todayStarsSnap.forEach(d => transaction.delete(d.ref));

                // 3. Find & Delete 'award_log' for today
                // Note: award_log stores date as DD-MM-YYYY string too
                const logsQ = query(collection(db, `${publicDataPath}/award_log`), where("studentId", "==", studentId), where("date", "==", today));
                const logsSnap = await getDocs(logsQ);

                const calendarNow = new Date();
                let creditFromLogsTotal = 0;
                let creditFromLogsMonthly = 0;

                logsSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    const credit = getAwardLogMonthlyStarCredit({ ...data, id: docSnap.id });
                    creditFromLogsTotal += credit;
                    const logDate = parseDDMMYYYY(data.date);
                    if (logDate.getMonth() === calendarNow.getMonth() && logDate.getFullYear() === calendarNow.getFullYear()) {
                        creditFromLogsMonthly += credit;
                    }
                    transaction.delete(docSnap.ref);
                });

                // 4. Decrement Scores (aligned with award_log credit, not today_stars nominal count)
                const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                const scoreDoc = await transaction.get(scoreRef);
                if (scoreDoc.exists() && creditFromLogsTotal > 0) {
                    const scoreUpdates = { totalStars: increment(-creditFromLogsTotal) };
                    if (creditFromLogsMonthly > 0) {
                        scoreUpdates.monthlyStars = increment(-creditFromLogsMonthly);
                    }
                    transaction.update(scoreRef, scoreUpdates);
                }
            });
            
            if (!silent) {
                showToast(today === getTodayDateString() ? `Marked absent for today.` : `Marked absent on ${today}.`, 'info');
            }
            return 'marked_absent';

        } else {
            // Mark Present (Undo) Logic: Just delete attendance record
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            if (!silent) {
                showToast(today === getTodayDateString() ? `Marked present.` : `Marked present on ${today}.`, 'success');
            }
            return 'marked_present';
        }

    } catch (error) {
        console.error("Error updating attendance:", error);
        showToast("Failed to update attendance record.", "error");
    }
    return undefined;
}

export async function handleAddQuestEvent() {
    const date = document.getElementById('quest-event-date').value;
    const type = document.getElementById('quest-event-type').value;
    
    if (!date) {
        showToast('System Error: Date is missing. Please close and reopen the planner.', 'error');
        return;
    }
    if (!type) {
        showToast('Please select an event type.', 'error');
        return;
    }

    let details = {};
    const title = document.getElementById('quest-event-type').options[document.getElementById('quest-event-type').selectedIndex].text;
    details.title = title;

    try {
        switch(type) {
            case 'Vocabulary Vault':
            case 'Grammar Guardians':
                details.goalTarget = parseInt(document.getElementById('quest-goal-target').value);
                details.completionBonus = parseFloat(document.getElementById('quest-completion-bonus').value);
                if (isNaN(details.goalTarget) || isNaN(details.completionBonus) || details.goalTarget <= 0 || details.completionBonus <= 0) {
                    throw new Error("Please enter valid numbers for the goal and bonus.");
                }
                break;
            case 'The Unbroken Chain':
            case 'The Scribe\'s Sketch':
            case 'Five-Sentence Saga':
                details.completionBonus = parseFloat(document.getElementById('quest-completion-bonus').value);
                if (isNaN(details.completionBonus) || details.completionBonus <= 0) {
                    throw new Error("Please enter a valid bonus amount.");
                }
                break;
            case 'Reason Bonus Day':
                const reason = document.getElementById('quest-event-reason').value;
                details.reason = reason;
                details.title = `${reason.charAt(0).toUpperCase() + reason.slice(1)} Bonus Day`;
                break;
            case '2x Star Day':
                break;
            default:
                throw new Error("Invalid event type selected.");
        }

        const btn = document.querySelector('#quest-event-form button[type="submit"]');
        btn.disabled = true; btn.innerText = "Adding...";

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_events"), {
            date, type, details,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        });
        
        showToast('Quest Event added to calendar!', 'success');
        import('../../ui/modals.js').then(m => m.hideModal('day-planner-modal'));
        
    } catch (error) {
        console.error("Error adding quest event:", error);
        showToast(error.message || 'Failed to save event.', 'error');
    } finally {
        const btn = document.querySelector('#quest-event-form button[type="submit"]');
        if(btn) { btn.disabled = false; btn.innerText = "Add Event"; }
    }
}

export async function handleDeleteQuestEvent(eventId) {
    try {
        await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/quest_events", eventId));
        showToast('Event deleted!', 'success');
    } catch (error) {
        console.error("Error deleting event:", error);
        showToast('Could not delete event.', 'error');
    }
}

export async function handleCancelLesson(dateString, classId) {
    const override = state.get('allScheduleOverrides').find(o => o.date === dateString && o.classId === classId);
    try {
        if (override && override.type === 'one-time') {
            await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/schedule_overrides`, override.id));
        } else {
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), { 
                date: dateString, 
                classId, 
                type: 'cancelled', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            });
        }
        showToast("Lesson cancelled for this day.", "success");
    } catch (e) { showToast("Error updating schedule.", "error"); }
}

export async function handleAddHolidayRange() {
    const name = document.getElementById('holiday-name').value;
    const type = document.getElementById('holiday-type').value;
    const start = document.getElementById('holiday-start').value;
    const end = document.getElementById('holiday-end').value;

    if (!name || !start || !end) {
        showToast("Please fill in all fields.", "error");
        return;
    }
    if (start > end) {
        showToast("Start date must be before end date.", "error");
        return;
    }

    const btn = document.getElementById('add-holiday-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const settingsRef = doc(db, `${publicDataPath}/school_settings`, 'holidays');

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(settingsRef);
            const existing = docSnap.exists() ? (docSnap.data() || {}) : {};
            let ranges = existing.ranges || [];

            ranges.push({ id: Date.now().toString(), name, type, start, end });
            ranges.sort((a, b) => a.start.localeCompare(b.start));

            transaction.set(settingsRef, { ...existing, ranges }, { merge: true });
        });
        
        showToast("Holiday range added!", "success");
        document.getElementById('holiday-name').value = '';
        document.getElementById('holiday-start').value = '';
        document.getElementById('holiday-end').value = '';
    } catch (e) {
        console.error(e);
        showToast("Error saving holiday.", "error");
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Add Range';
    }
}

export async function handleDeleteHolidayRange(rangeId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const settingsRef = doc(db, `${publicDataPath}/school_settings`, 'holidays');

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(settingsRef);
            if (!docSnap.exists()) return;
            
            let ranges = docSnap.data().ranges || [];
            ranges = ranges.filter(r => r.id !== rangeId);
            
            transaction.update(settingsRef, { ranges });
        });
        showToast("Holiday removed.", "success");
    } catch (e) {
        showToast("Error deleting holiday.", "error");
    }
}

export async function handleRemoveAttendanceColumn(classId, dateString, isGlobal = false) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    try {
        const batch = writeBatch(db);
        
        // 1. Determine which classes to affect
        let classesToCancel = [];
        if (isGlobal) {
            // Find ALL classes that usually have a lesson on this day of the week
            const dayOfWeek = (parseFlexibleDate(dateString) || new Date()).getDay().toString();
            classesToCancel = state.get('allSchoolClasses').filter(c => c.scheduleDays && c.scheduleDays.includes(dayOfWeek));
        } else {
            // Just the selected class
            classesToCancel = [{ id: classId }];
        }

        // 2. Create Overrides for all affected classes
        for (const cls of classesToCancel) {
            const overrideRef = doc(collection(db, `${publicDataPath}/schedule_overrides`));
            batch.set(overrideRef, { 
                date: dateString, 
                classId: cls.id, 
                type: 'cancelled', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            });
        }

        // 3. Delete Attendance Records for all affected classes on this day
        const classIds = classesToCancel.map(c => c.id);
        // Note: Firestore 'in' query is limited to 10, so we loop queries to be safe or just simple loop
        for (const cid of classIds) {
            const q = query(
                collection(db, `${publicDataPath}/attendance`), 
                where("classId", "==", cid), 
                where("date", "==", dateString)
            );
            const snap = await getDocs(q);
            snap.forEach(doc => batch.delete(doc.ref));
        }

        await batch.commit();

        const msg = isGlobal ? `School Holiday set for ${dateString}.` : `Class cancelled for ${dateString}.`;
        showToast(msg, "success");
        
        // Refresh the view
        const { renderAttendanceChronicle } = await import('../../ui/modals.js');
        await renderAttendanceChronicle(classId);

    } catch (error) {
        console.error("Error removing attendance column:", error);
        showToast("Failed to remove date.", "error");
    }
}

export async function handleAddOneTimeLesson(dateString) {
    const classId = document.getElementById('add-onetime-lesson-select').value;
    if (!classId) return;
    const override = state.get('allScheduleOverrides').find(o => o.date === dateString && o.classId === classId);
    try {
        if (override && override.type === 'cancelled') {
            await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/schedule_overrides`, override.id));
        } else {
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), { 
                date: dateString, 
                classId, 
                type: 'one-time', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            });
        }
        showToast("One-time lesson added.", "success");
    } catch (e) { showToast("Error updating schedule.", "error"); }

}
