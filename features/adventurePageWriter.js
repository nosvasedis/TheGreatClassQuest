// /features/adventurePageWriter.js — Manual: the teacher writes the whole crowned page
// (title, story, highlights, what we learned, picture). The picture can be uploaded or, on
// Elite, painted from the teacher's own words. Typing is kept as a draft on this device until
// the page is saved. Opened from the Today's Page chooser or the blank page in the diary.
// Lazy; pure rules in ./adventurePageCore.mjs, page shell in ./diaryPageEditor.js.
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, getDoc, runTransaction, serverTimestamp } from '../firebase.js';
import { canUseFeature } from '../utils/subscription.js';
import { showToast } from '../ui/effects.js';
import {
    diaryPageEditorHtml,
    diaryEditorHeroHtml,
    bindDiaryHighlightPreview,
    escapeDiaryEditorHtml,
    formatDiaryEditorDate
} from './diaryPageEditor.js';
import {
    diaryPictureControlsHtml,
    bindDiaryPictureControls,
    prepareAdventurePictureSave,
    discardAdventurePictureObject
} from './adventureLogArtwork.js';
import { gatherLearnedToday, renderLearnedTodayPicksHtml, readLearnedTodayPicks } from './learnedToday.js';
import {
    PAGE_WRITTEN,
    isAwaitingAdventurePage,
    syncHeroLine,
    buildPageKeywords,
    splitHighlights,
    suggestPageTitles,
    getStoryStarters,
    insertStoryStarter,
    hasEnoughStoryForPicture,
    rankVirtueReasons
} from './adventurePageCore.mjs';
import { dataPath } from '../utils/tenant.mjs';

const OVERLAY_ID = 'adventure-log-new-modal';
const draftKey = logId => `gcq_diary_draft_${logId}`;

function readDraft(logId) {
    try {
        const raw = localStorage.getItem(draftKey(logId));
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function writeDraft(logId, draft) {
    try {
        if (!draft.title && !draft.text && !draft.highlights) localStorage.removeItem(draftKey(logId));
        else localStorage.setItem(draftKey(logId), JSON.stringify(draft));
    } catch { /* private window or storage blocked: the page still works without drafts */ }
}

function clearDraft(logId) {
    try { localStorage.removeItem(draftKey(logId)); } catch { /* ignore */ }
}

async function loadLog(logId) {
    try {
        const snap = await getDoc(doc(db, dataPath('adventure_logs'), logId));
        if (snap.exists()) return { id: snap.id, ...snap.data() };
    } catch { /* fall back to the live snapshot */ }
    return (state.get('allAdventureLogs') || []).find(l => l.id === logId) || null;
}

function friendlyError(message) {
    const error = new Error(message);
    error.friendly = true;
    return error;
}

function closeWriter() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay._cleanup?.();
    overlay.remove();
    if (!document.getElementById('adventure-log-editor-modal')) {
        document.body.classList.remove('adventure-log-editor-open');
    }
}

function titleIdeasHtml(ideas) {
    if (!ideas.length) return '';
    return `<div class="apw-ideas" role="group" aria-label="Title ideas">
        <span class="apw-ideas__label"><i class="fas fa-lightbulb" aria-hidden="true"></i> Ideas</span>
        ${ideas.map(idea => `<button type="button" class="apw-chip" data-title-idea="${escapeDiaryEditorHtml(idea)}">${escapeDiaryEditorHtml(idea)}</button>`).join('')}
    </div>`;
}

function storyStartersHtml(starters, words) {
    const wordChips = (words || []).slice(0, 10).map(word =>
        `<button type="button" class="apw-chip apw-chip--word" data-story-word="${escapeDiaryEditorHtml(word)}">${escapeDiaryEditorHtml(word)}</button>`).join('');
    return `<div class="apw-starters">
        <div class="apw-ideas" role="group" aria-label="Story starters">
            <span class="apw-ideas__label"><i class="fas fa-feather" aria-hidden="true"></i> Need a spark?</span>
            ${starters.map(starter => `<button type="button" class="apw-chip apw-chip--starter" data-story-starter="${escapeDiaryEditorHtml(starter)}">${escapeDiaryEditorHtml(starter)}…</button>`).join('')}
        </div>
        ${wordChips ? `<div class="apw-ideas" role="group" aria-label="Today's words"><span class="apw-ideas__label"><i class="fas fa-spell-check" aria-hidden="true"></i> Today's words</span>${wordChips}</div>` : ''}
        <p class="adventure-log-editor-hint apw-wordcount" data-story-count aria-live="polite">0 words</p>
    </div>`;
}

function buildLearnedHtml(learned) {
    const picks = renderLearnedTodayPicksHtml(learned, 'learned');
    const collected = picks
        ? `${picks}<p class="adventure-log-editor-hint">Collected from the lesson. Untick anything that does not fit.</p>`
        : '<p class="adventure-log-editor-hint">Nothing collected for this lesson (no quiz, story, quest or trial). You can leave this empty.</p>';
    return `<div class="learned-today-box">
            ${collected}
            <input type="text" id="manual-log-learned-extra" maxlength="160" placeholder="Add your own line (optional), e.g. Describing people with adjectives" autocomplete="off">
        </div>`;
}

/** Opens the Manual writer for a crowned page that is still blank. */
export async function openAdventurePageWriter(logId) {
    if (!logId) return;
    if (!canUseFeature('adventureLog')) {
        showToast('The Adventure Log diary is part of the Pro plan.', 'info');
        return;
    }
    const log = await loadLog(logId);
    if (!log) {
        showToast('This diary page could not be found.', 'error');
        return;
    }
    if (log.createdBy?.uid !== state.get('currentUserId') || log.schoolYearKey !== state.getActiveSchoolYearKey()) {
        showToast('Only the teacher who crowned this hero can write the page.', 'info');
        return;
    }
    if (!isAwaitingAdventurePage(log)) {
        showToast('This page has already been written. Use Edit on the page to change it.', 'info');
        return;
    }

    const isToday = log.date === utils.getTodayDateString();
    let learned = log.learnedToday || { items: [], words: [], summary: '' };
    if (isToday) {
        // The lesson may have moved on since the crowning (a quiz, a story line): collect again.
        const fresh = await gatherLearnedToday(log.classId);
        if (fresh.items.length || fresh.words.length) learned = fresh;
    }

    const classData = (state.get('allTeachersClasses') || []).find(c => c.id === log.classId) || {};
    const awards = (state.get('allAwardLogs') || []).filter(a => a.classId === log.classId && utils.datesMatch(a.date, log.date));
    const dateObj = utils.parseFlexibleDate(log.date);
    const canPaint = canUseFeature('eliteAI');

    closeWriter();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'adventure-log-editor-overlay adventure-log-editor-overlay--new';
    overlay.innerHTML = diaryPageEditorHtml({
        ids: {
            heading: 'adventure-log-new-title',
            close: 'close-manual-log-btn',
            title: 'manual-log-title',
            counter: 'manual-log-title-counter',
            story: 'manual-log-text',
            highlights: 'manual-log-highlights',
            cancel: 'cancel-manual-log-btn',
            save: 'save-manual-log-btn'
        },
        heading: isToday ? "Write today's page" : 'Write this page',
        subtitle: `${escapeDiaryEditorHtml(classData.name || 'Your class')}'s diary, in your own words`,
        dateLabel: dateObj ? formatDiaryEditorDate(dateObj) : '',
        titleAssist: titleIdeasHtml(suggestPageTitles(rankVirtueReasons(awards))),
        storyAssist: storyStartersHtml(getStoryStarters({ heroName: log.hero, words: learned.words }), learned.words),
        heroHtml: diaryEditorHeroHtml(log.hero || 'The Class Team'),
        pictureHtml: diaryPictureControlsHtml({
            canGenerate: canPaint,
            generateLabel: 'Paint it from my words',
            generateIcon: 'fa-palette',
            hint: canPaint
                ? 'Upload a JPG, PNG or WebP (up to 8 MB), or write your story and let the Chronicler paint it.'
                : 'Upload a JPG, PNG or WebP, up to 8 MB. A picture is optional.'
        }),
        learnedHtml: buildLearnedHtml(learned),
        saveLabel: isToday ? "Save today's page" : 'Save this page',
        saveIcon: 'fa-feather-alt'
    });
    document.body.appendChild(overlay);
    document.body.classList.add('adventure-log-editor-open');

    const titleInput = overlay.querySelector('#manual-log-title');
    const storyInput = overlay.querySelector('#manual-log-text');
    const highlightsInput = overlay.querySelector('#manual-log-highlights');
    const counter = overlay.querySelector('#manual-log-title-counter');
    const storyCount = overlay.querySelector('[data-story-count]');
    const saveBtn = overlay.querySelector('#save-manual-log-btn');
    const cancelBtn = overlay.querySelector('#cancel-manual-log-btn');
    const closeBtn = overlay.querySelector('#close-manual-log-btn');

    const saved = readDraft(logId);
    if (saved) {
        titleInput.value = String(saved.title || '').slice(0, 90);
        storyInput.value = String(saved.text || '');
        highlightsInput.value = String(saved.highlights || '');
    }

    let pictureBusy = false;
    let saving = false;
    const pictureControls = bindDiaryPictureControls(overlay, log, {
        getStory: () => ({ title: titleInput.value, text: storyInput.value }),
        beforePaint: () => {
            if (!hasEnoughStoryForPicture({ title: titleInput.value, text: storyInput.value })) {
                throw friendlyError('Write a few lines of the story first, then the picture can follow it.');
            }
        },
        readyText: 'Picture ready. It is saved with your page.',
        onBusy: value => {
            pictureBusy = value;
            saveBtn.disabled = value;
        }
    });

    const updateCounters = () => {
        counter.textContent = `${titleInput.value.length} / 90`;
        counter.classList.toggle('limit', titleInput.value.length > 80);
        const words = storyInput.value.trim() ? storyInput.value.trim().split(/\s+/).length : 0;
        if (storyCount) storyCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    };
    let draftTimer = null;
    const queueDraft = () => {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => writeDraft(logId, {
            title: titleInput.value,
            text: storyInput.value,
            highlights: highlightsInput.value
        }), 350);
    };
    const hasWords = () => Boolean(titleInput.value.trim() || storyInput.value.trim());
    const close = () => {
        if (saving) return;
        clearTimeout(draftTimer);
        writeDraft(logId, { title: titleInput.value, text: storyInput.value, highlights: highlightsInput.value });
        if (hasWords()) showToast('Your words are kept on this device. Write Today\'s Page picks up where you left off.', 'info');
        closeWriter();
    };

    const onKey = (event) => {
        if (saving) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            saveBtn.click();
        }
    };
    overlay._cleanup = () => {
        clearTimeout(draftTimer);
        document.removeEventListener('keydown', onKey);
        pictureControls.dispose();
    };
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay && !saving && !pictureBusy) { close(); return; }
        const idea = event.target.closest('[data-title-idea]');
        if (idea) {
            titleInput.value = idea.dataset.titleIdea.slice(0, 90);
            updateCounters();
            queueDraft();
            titleInput.focus();
            return;
        }
        const starter = event.target.closest('[data-story-starter]');
        const word = event.target.closest('[data-story-word]');
        if (starter || word) {
            const value = storyInput.value;
            storyInput.value = starter
                ? insertStoryStarter(value, starter.dataset.storyStarter)
                : `${value}${value && !/\s$/.test(value) ? ' ' : ''}${word.dataset.storyWord} `;
            storyInput.focus();
            storyInput.setSelectionRange(storyInput.value.length, storyInput.value.length);
            updateCounters();
            queueDraft();
        }
    });
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    [titleInput, storyInput, highlightsInput].forEach(input => input.addEventListener('input', () => { updateCounters(); queueDraft(); }));
    bindDiaryHighlightPreview(highlightsInput, overlay);
    updateCounters();

    saveBtn.addEventListener('click', async () => {
        if (saving || pictureBusy) return;
        const title = titleInput.value.trim();
        const text = storyInput.value.trim();
        if (!title || !text) {
            showToast('Give the page a title and a story first.', 'error');
            (title ? storyInput : titleInput).focus();
            return;
        }
        saving = true;
        saveBtn.disabled = true; cancelBtn.disabled = true; closeBtn.disabled = true;
        pictureControls.setDisabled(true);
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Binding the page…</span>';
        const ok = await savePage(log, overlay, { title, text, learned, pictureDraft: pictureControls.getDraft() });
        saving = false;
        if (ok) {
            clearDraft(logId);
            closeWriter();
            showToast('Your page is in the diary! 📖', 'success');
            import('../ui/tabs/log.js').then(m => m.focusDiaryPage(logId)).catch(() => {});
            return;
        }
        if (document.body.contains(overlay)) {
            saveBtn.disabled = false; cancelBtn.disabled = false; closeBtn.disabled = false;
            pictureControls.setDisabled(false);
            saveBtn.innerHTML = `<i class="fas fa-feather-alt" aria-hidden="true"></i><span>${isToday ? "Save today's page" : 'Save this page'}</span>`;
        }
    });

    requestAnimationFrame(() => (titleInput.value ? storyInput : titleInput).focus());
}

/** Writes the whole page in one transaction, only while it is still blank. Returns true when saved. */
async function savePage(log, overlay, { title, text, learned, pictureDraft }) {
    let pictureUpdate = {};
    try {
        pictureUpdate = await prepareAdventurePictureSave(log, pictureDraft);
        const storyText = syncHeroLine(text, log.hero);
        const highlights = splitHighlights(overlay.querySelector('#manual-log-highlights')?.value);
        const learnedToday = readLearnedTodayPicks(overlay, learned, 'learned', '#manual-log-learned-extra');
        const updates = {
            pageStatus: PAGE_WRITTEN,
            entryMode: 'manual',
            title: title.slice(0, 90),
            text: storyText,
            highlights,
            keywords: buildPageKeywords(storyText),
            topReason: highlights[0] || log.topReason || 'excellence',
            learnedToday,
            ...pictureUpdate,
            writtenAt: serverTimestamp(),
            writtenBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        };
        await runTransaction(db, async tx => {
            const logRef = doc(db, dataPath('adventure_logs'), log.id);
            const snap = await tx.get(logRef);
            if (!snap.exists()) throw friendlyError('This diary page could not be found.');
            const data = snap.data();
            if (data.createdBy?.uid !== state.get('currentUserId') || data.schoolYearKey !== state.getActiveSchoolYearKey()) {
                throw friendlyError('This diary page belongs to another teacher or school year.');
            }
            if (!isAwaitingAdventurePage(data)) {
                throw friendlyError('This page was already written (perhaps by the Chronicler). Your words are kept as a draft.');
            }
            tx.update(logRef, updates);
        });
        return true;
    } catch (error) {
        if (pictureUpdate.artworkStoragePath) await discardAdventurePictureObject(pictureUpdate.artworkStoragePath, log);
        console.error('Saving the diary page failed:', error);
        showToast(error.friendly ? error.message : 'The page could not be saved. Please try again.', 'error');
        return false;
    }
}
