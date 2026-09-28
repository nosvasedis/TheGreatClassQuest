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
import { getTodayDateString, parseFlexibleDate, normalizeToDateString, parseDDMMYYYY, doesClassMeetOnDate, datesMatch } from '../../utils.js';
import { reconcileFamiliarLifecycle } from '../../features/familiars.js';
import { applyAwardOutwardSkillEffects, applyReasonAwardScoreTransaction, showHeroLevelUpCelebration } from './stars.js';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { retryAdventureLogGeneration } from './quests.js';
import { bindDiaryHighlightPreview, diaryEditorHeroHtml, diaryPageEditorHtml, formatDiaryEditorDate } from '../../features/diaryPageEditor.js';
import { withSchoolYear } from '../../utils/schoolYear.js';
import { recordGuildGloryEvent, updateGuildScores } from '../../features/guildScoring.js';
import { createQuestEventDocument, normalizeQuestType, isSpecialQuestType, isSchoolWideModifierType, QUEST_DEFINITIONS, validateQuestEvent } from '../../features/specialQuestEngine.js';
import { buildGrowthStarfallNote } from '../../features/growthStarfallCore.mjs';

export async function addOrUpdateHeroChronicleNote(studentId, noteText, category, noteId = null) {
    if (!studentId || !noteText || !category) {
        showToast("Missing required note information.", "error");
        return;
    }
    
    const noteData = withSchoolYear({
        studentId,
        teacherId: state.get('currentUserId'),
        noteText,
        category,
        updatedAt: serverTimestamp()
    }, state.getActiveSchoolYearKey());

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
            
            batch.set(newArchiveDocRef, withSchoolYear({
                title: storyTitle,
                classId: classId,
                className: classData.name,
                classLogo: classData.logo,
                coverImageUrl,
                coverImageBase64,
                completedAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            }, state.getActiveSchoolYearKey()));

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
    let appliedGuildStars = Number(bonusAmount) || 0;

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
            appliedGuildStars = txResult.totalStarsDelta || appliedGuildStars;

            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
            const logData = withSchoolYear({
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
            }, state.getActiveSchoolYearKey());
            transaction.set(newLogRef, logData);
        });
        updateGuildScores(studentId, appliedGuildStars, 'scholar_s_bonus').catch((e) => console.warn('Scholar Guild Glory update failed:', e));
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
        for (const { studentId, bonusAmount, trialType, kind, jump } of students) {
            const student = state.get('allStudents').find(s => s.id === studentId);
            if (!student) continue;

            let levelUpInfo = null;
            let appliedGuildStars = Number(bonusAmount) || 0;
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
                appliedGuildStars = txResult.totalStarsDelta || appliedGuildStars;

                const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
                const logData = withSchoolYear({
                    studentId,
                    classId: student.classId,
                    teacherId: state.get('currentUserId'),
                    stars: bonusAmount,
                    appliedStarCredit: txResult.totalStarsDelta,
                    reason: "scholar_s_bonus",
                    note: kind === 'growth'
                        ? buildGrowthStarfallNote({ trialType, jump })
                        : `Awarded for exceptional performance on a ${trialType}.`,
                    date: today,
                    createdAt: serverTimestamp(),
                    createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                }, state.getActiveSchoolYearKey());
                transaction.set(newLogRef, logData);
            });

            if (levelUpInfo) levelUps.push(levelUpInfo);
            updateGuildScores(studentId, appliedGuildStars, 'scholar_s_bonus').catch((e) => console.warn('Batch scholar Guild Glory update failed:', e));
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

    const learnedModule = await import('../../features/learnedToday.js');
    openAdventureLogEditor(logId, log, learnedModule);
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
    return formatDiaryEditorDate(dateObj);
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

function openAdventureLogEditor(logId, log, learnedModule) {
    const existing = document.getElementById('adventure-log-editor-modal');
    if (existing) existing.remove();
    const entryMode = inferAdventureLogEntryMode(log);
    const dateChipHtml = formatAdventureLogEditorDateChip(log);
    const subtitle = entryMode === 'manual'
        ? 'Tidy up your page. The crowned hero stays on it.'
        : 'Polish what the Chronicler wrote, or ask it to write the day again.';
    const aiRewriteControl = entryMode === 'ai'
        ? `<button type="button" id="adventure-log-ai-rewrite-btn" class="adventure-log-editor-ai-btn" title="Rewrite this day with the Chronicler (AI)">
                <i class="fas fa-wand-magic-sparkles adventure-log-editor-ai-icon" aria-hidden="true"></i>
                <span class="adventure-log-editor-ai-label">Ask the Chronicler</span>
           </button>`
        : '';
    const learnedPicks = learnedModule.renderLearnedTodayPicksHtml(log.learnedToday, 'edit-learned');

    const overlay = document.createElement('div');
    overlay.id = 'adventure-log-editor-modal';
    overlay.className = 'adventure-log-editor-overlay';
    overlay.innerHTML = diaryPageEditorHtml({
        ids: {
            heading: 'adventure-log-editor-title',
            close: 'adventure-log-editor-close-btn',
            title: 'edit-log-title',
            counter: 'edit-log-title-counter',
            story: 'edit-log-text',
            highlights: 'edit-log-highlights',
            cancel: 'cancel-edit-log-btn',
            save: 'save-edit-log-btn'
        },
        heading: 'Edit this page',
        subtitle,
        dateLabel: dateChipHtml,
        titleValue: log.title || '',
        storyValue: log.text || '',
        highlightsValue: (log.highlights || []).join(', '),
        storyTool: aiRewriteControl,
        heroHtml: diaryEditorHeroHtml(log.hero || 'The Class Team'),
        learnedHtml: `
            ${learnedPicks || '<p class="adventure-log-editor-hint">Nothing was collected for this lesson.</p>'}
            <input type="text" id="edit-log-learned-extra" maxlength="160" placeholder="Add your own line (optional)" autocomplete="off">
            <p class="adventure-log-editor-hint">Collected from the quiz, story, quests, trials and homework. Untick anything that does not fit.</p>`,
        saveLabel: 'Save changes',
        saveIcon: 'fa-check'
    });

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
                        if (highlightsInput) {
                            highlightsInput.value = (d.highlights || []).join(', ');
                            highlightsInput.dispatchEvent(new Event('input'));
                        }
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
    bindDiaryHighlightPreview(highlightsInput, overlay);

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
        const learnedModule = await import('../../features/learnedToday.js');
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
            learnedToday: learnedModule.readLearnedTodayPicks(rootEl, log.learnedToday, 'edit-learned', '#edit-log-learned-extra'),
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
            
            let absentGuildCredit = 0;
            await runTransaction(db, async (transaction) => {
                // === ALL READS FIRST (Firestore requires reads before writes) ===

                // 1. Read student_scores (transactional read must precede any writes)
                const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                const scoreDoc = await transaction.get(scoreRef);

                // 2. Query today_stars and award_log (non-transactional query reads)
                const todayStarsQ = query(collection(db, `${publicDataPath}/today_stars`), where("studentId", "==", studentId), where("date", "==", today));
                const todayStarsSnap = await getDocs(todayStarsQ);

                const logsQ = query(collection(db, `${publicDataPath}/award_log`), where("studentId", "==", studentId), where("date", "==", today));
                const logsSnap = await getDocs(logsQ);

                // === COMPUTE credit totals before writing ===
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
                });
                absentGuildCredit = creditFromLogsTotal;

                // === ALL WRITES AFTER ALL READS ===

                // 3. Create Attendance Record
                const newAttendanceRef = doc(attendanceCollectionRef);
                transaction.set(newAttendanceRef, withSchoolYear({
                    studentId,
                    classId,
                    date: today,
                    markedBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
                    createdAt: serverTimestamp()
                }, state.getActiveSchoolYearKey()));

                // 4. Delete today_stars
                todayStarsSnap.forEach(d => transaction.delete(d.ref));

                // 5. Delete award_log entries for today
                logsSnap.forEach(docSnap => transaction.delete(docSnap.ref));

                // 6. Decrement Scores (aligned with award_log credit, not today_stars nominal count)
                if (scoreDoc.exists() && creditFromLogsTotal > 0) {
                    const scoreUpdates = { totalStars: increment(-creditFromLogsTotal) };
                    if (creditFromLogsMonthly > 0) {
                        scoreUpdates.monthlyStars = increment(-creditFromLogsMonthly);
                    }
                    transaction.update(scoreRef, scoreUpdates);
                }
            });

            const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
            if (student?.guildId && absentGuildCredit > 0) {
                recordGuildGloryEvent({
                    guildId: student.guildId,
                    studentId,
                    classId,
                    source: 'absence_star_erase',
                    starDelta: -absentGuildCredit,
                    note: `Stars erased after absence mark for ${today}`,
                }).catch((error) => console.warn('Absence Guild Glory adjustment failed:', error));
            }
            
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
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-magic" aria-hidden="true"></i><span>Adding...</span>';

        const normalizedType = normalizeQuestType(type);
        const schoolWide = isSchoolWideModifierType(normalizedType);
        const scope = document.getElementById('quest-event-scope');
        const selectedClassIds = scope ? [...scope.selectedOptions].map((option) => option.value) : [state.get('globalSelectedClassId')];
        const overrides = state.get('allScheduleOverrides') || [];
        const holidays = state.get('schoolHolidayRanges') || [];
        const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
        let classes;
        if (schoolWide) {
            // Standard events are school-wide: one event with no class applies to every class.
            const alreadyScheduled = (state.get('allQuestEvents') || []).some((event) =>
                isSchoolWideModifierType(event.type) &&
                !event.classId &&
                event.status !== 'cancelled' &&
                datesMatch(event.dateKey || event.date, date));
            if (alreadyScheduled) throw new Error('A standard event is already scheduled for this day.');
            classes = [{ id: null }];
        } else {
            const classPool = state.get('currentUserRole') === 'secretary'
                ? (state.get('allSchoolClasses') || [])
                : (state.get('allTeachersClasses') || []);
            classes = classPool.filter((item) => selectedClassIds.includes(item.id));
            if (!classes.length && isSpecialQuestType(normalizedType)) {
                throw new Error('Select at least one class for this event.');
            }
            const conflicts = classes.filter((classInfo) => !doesClassMeetOnDate(classInfo.id, date, state.get('allSchoolClasses') || [], overrides, holidays, classEndDates));
            if (conflicts.length) {
                throw new Error(`No lesson is scheduled for ${conflicts.map((item) => item.name).join(', ')} on this date. Resolve the calendar conflict first.`);
            }
        }
        const target = Number(details.goalTarget || QUEST_DEFINITIONS[normalizedType]?.defaultTarget);
        const instructions = document.getElementById('quest-instructions')?.value || '';
        const prompt = document.getElementById('quest-prompt')?.value || '';
        const showTextOnProjector = document.getElementById('quest-show-prompt')?.checked || false;
        for (const classInfo of classes) {
            const validation = validateQuestEvent({ type: normalizedType, classId: classInfo.id, dateKey: date, goalSpec: { target }, rewardSpec: { starsPerRecipient: details.completionBonus || 1 } }, { existing: state.get('allQuestEvents') || [] });
            if (!validation.valid) throw new Error(validation.errors.join(' '));
        }
        const docs = (classes.length ? classes : [{ id: null }]).map((classInfo, index) => createQuestEventDocument({
            type: normalizedType,
            classId: classInfo.id,
            dateKey: date,
            schoolYearKey: state.getActiveSchoolYearKey(),
            eventGroupId: `${date}__${state.get('currentUserId')}__${Date.now()}`,
            target,
            starsPerRecipient: details.completionBonus || 1,
            instructions,
            prompt,
            showTextOnProjector,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
        }));
        for (const eventDocument of docs) {
            await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_events"), { ...eventDocument, details: { ...details, title } });
        }
        
        showToast('Quest Event added to calendar!', 'success');
        import('../../ui/modals.js').then(m => m.hideModal('day-planner-modal'));
        
    } catch (error) {
        console.error("Error adding quest event:", error);
        showToast(error.message || 'Failed to save event.', 'error');
    } finally {
        const btn = document.querySelector('#quest-event-form button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic" aria-hidden="true"></i><span>Summon Event</span>';
        }
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
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), withSchoolYear({
                date: dateString, 
                classId, 
                type: 'cancelled', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            }, state.getActiveSchoolYearKey()));
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
            batch.set(overrideRef, withSchoolYear({
                date: dateString, 
                classId: cls.id, 
                type: 'cancelled', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            }, state.getActiveSchoolYearKey()));
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
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), withSchoolYear({
                date: dateString, 
                classId, 
                type: 'one-time', 
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }, 
                createdAt: serverTimestamp() 
            }, state.getActiveSchoolYearKey()));
        }
        showToast("One-time lesson added.", "success");
    } catch (e) { showToast("Error updating schedule.", "error"); }

}
