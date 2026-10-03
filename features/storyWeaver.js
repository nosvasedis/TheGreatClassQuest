// /features/storyWeaver.js

// --- IMPORTS ---
import { db, doc, getDocs, collection, query, orderBy, setDoc, updateDoc, writeBatch, serverTimestamp, increment, limit, onSnapshot } from '../firebase.js';

import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import { simpleHashCode, compressImageBase64, getAgeGroupForLeague } from '../utils.js';
import * as constants from '../constants.js';
import { awardStoryWeaverBonusStarToClass, handleDeleteCompletedStory } from '../db/actions.js';
import { isSpeaking, speakText, stopSpeech, isTtsSupported } from './tts.js';
import { loadPdfTools } from '../utils/lazyLibraries.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { pickStoryWords } from './languageScaffolds.mjs';
import {
    countWords, deriveStoryPages, escapeHtml, highlightWord, milestoneHtml, sentenceUsesWord,
    shelfBookHtml, shelfEmptyHtml, storyThreadHtml
} from './storyWeaverView.js';
function storyWeaverClassId() {
    return state.get('globalSelectedClassId') || '';
}

function storyWeaverClassData(classId = storyWeaverClassId()) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

// Writing helpers (scaffolds, starters, reveal prompts) load on demand so they stay out of the
// shared actions chunk. See features/storyWeaverHelpers.js.
let storyHelpersModule = null;
function loadStoryHelpers() {
    if (storyHelpersModule) return Promise.resolve(storyHelpersModule);
    return import('./storyWeaverHelpers.js').then((module) => {
        storyHelpersModule = module;
        module.ensureStoryHelperListeners({ openStoryInputModal });
        return module;
    });
}

export function renderStoryWritingHelpers(classId = storyWeaverClassId()) {
    return loadStoryHelpers()
        .then((helpers) => helpers.renderStoryWritingHelpers(classId))
        .catch((error) => console.warn('Story Weavers helpers failed to render:', error));
}

// --- MAIN UI & STATE MANAGEMENT ---

// What the open book is showing: the live pages of the selected class's story, and which one
// is open (null = the latest page, which follows new pages as they arrive).
const sw = {
    classId: '',
    history: [],
    viewIndex: null,
    shownKey: '',
    narrating: false,
    weaving: false,
    redrawing: false,
    listenersBound: false
};

const LOOM_STEPS = ['Writing the page into the book...', 'The Chronicler is illustrating...', 'Painting the colours...', 'Binding it into the story...'];

function storyRef(classId) {
    return doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
}

function historyRef(classId) {
    return collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`);
}

function currentPages(classId = storyWeaverClassId()) {
    const story = state.get('currentStoryData')[classId];
    return deriveStoryPages(story, sw.classId === classId ? sw.history : []);
}

const swLite = (() => { try { return detectLowPowerTier(); } catch { return false; } })();

export function handleStoryWeaversClassSelect() {
    const classId = storyWeaverClassId();
    const mainContent = document.getElementById('story-weavers-main-content');
    const placeholder = document.getElementById('story-weavers-placeholder');
    ensureStoryWeaverListeners();
    const root = document.getElementById('sw-root');
    root?.classList.toggle('sw--lite', swLite);
    root?.classList.toggle('is-no-class', !classId);

    const unsubscribeStoryData = state.get('unsubscribeStoryData');
    ['current', 'history'].forEach((key) => {
        if (unsubscribeStoryData[key]) {
            unsubscribeStoryData[key]();
            delete unsubscribeStoryData[key];
        }
    });
    stopPageNarration();
    if (sw.classId !== classId) {
        sw.history = [];
        sw.viewIndex = null;
        sw.shownKey = '';
    }
    sw.classId = classId;

    resetStoryWeaverWordUI();
    renderStoryWritingHelpers(classId);
    renderClassChip(classId);

    if (classId) {
        mainContent.classList.remove('hidden');
        placeholder.classList.add('hidden');

        unsubscribeStoryData.current = onSnapshot(storyRef(classId), (doc) => {
            const currentStoryData = state.get('currentStoryData');
            currentStoryData[classId] = doc.exists() ? doc.data() : null;
            renderStoryWeaversUI(classId);
        }, (error) => console.error("Error listening to story data:", error));

        unsubscribeStoryData.history = onSnapshot(query(historyRef(classId), orderBy('createdAt', 'asc')), (snapshot) => {
            if (sw.classId !== classId) return;
            sw.history = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderStoryWeaversUI(classId);
        }, (error) => console.error("Error listening to story pages:", error));
    } else {
        mainContent.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    import('../db/listeners.js')
        .then(({ ensureCompletedStoriesListener }) => ensureCompletedStoriesListener())
        .catch(() => {})
        .finally(() => renderStoryArchive());
}

function renderClassChip(classId) {
    const chip = document.getElementById('sw-class-chip');
    if (!chip) return;
    const classData = storyWeaverClassData(classId);
    chip.classList.toggle('hidden', !classData);
    chip.innerHTML = classData
        ? `<span aria-hidden="true">${escapeHtml(classData.logo || '📖')}</span> ${escapeHtml(classData.name || '')}`
        : '';
}

function renderStoryWeaversUI(classId) {
    if (!classId) return;
    const story = state.get('currentStoryData')[classId];
    const pages = currentPages(classId);
    const lockInBtn = document.getElementById('story-weavers-lock-in-btn');
    const endBtn = document.getElementById('story-weavers-end-btn');
    const wordLocked = Boolean(state.get('storyWeaverLockedWord'));

    if (sw.viewIndex !== null && sw.viewIndex >= pages.length) sw.viewIndex = null;
    const activeIndex = sw.viewIndex ?? pages.length - 1;
    const page = pages[activeIndex] || null;
    const isLatest = activeIndex === pages.length - 1;

    if (!sw.weaving) renderBookPage(page, activeIndex, pages.length, story);

    const nextNumber = pages.length + 1;
    const weaveLabel = document.getElementById('sw-weave-label');
    if (weaveLabel && !sw.weaving) weaveLabel.textContent = pages.length ? `Write page ${nextNumber}` : 'Start Story...';
    if (!sw.weaving) lockInBtn.disabled = !wordLocked;
    endBtn.disabled = !story?.currentSentence;
    const hint = document.getElementById('sw-write-hint');
    if (hint) {
        hint.textContent = wordLocked
            ? `The class decides what happens on page ${nextNumber}. Use the word, and try a starter below.`
            : 'Lock in a word first. Then the class decides what happens next.';
    }
    document.getElementById('sw-word-step')?.classList.toggle('is-done', wordLocked);
    document.getElementById('sw-write-step')?.classList.toggle('is-ready', wordLocked);

    const sub = document.getElementById('sw-stage-sub');
    if (sub) {
        sub.textContent = !pages.length
            ? 'A blank book is waiting for its first page.'
            : `${pages.length} page${pages.length === 1 ? '' : 's'} woven so far. ${isLatest ? 'The open book shows the latest page.' : `You are looking back at page ${activeIndex + 1}.`}`;
    }

    const thread = document.getElementById('sw-thread');
    if (thread) {
        thread.innerHTML = storyThreadHtml(pages, activeIndex, { canWrite: wordLocked });
        thread.querySelector('.sw-bead.is-active')?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'auto' });
    }
    const prev = document.getElementById('sw-prev-page');
    const next = document.getElementById('sw-next-page');
    if (prev) prev.disabled = activeIndex <= 0;
    if (next) next.disabled = isLatest || !pages.length;

    const browse = document.getElementById('sw-browse-note');
    if (browse) {
        browse.classList.toggle('hidden', isLatest || !pages.length);
        const text = document.getElementById('sw-browse-text');
        if (text) text.textContent = `Looking back at page ${activeIndex + 1} of ${pages.length}`;
    }
    const milestone = document.getElementById('sw-milestone');
    if (milestone) milestone.innerHTML = milestoneHtml(pages.length);

    const readBtn = document.getElementById('story-weavers-read-btn');
    if (readBtn) readBtn.disabled = !page || !isTtsSupported();
    const redrawBtn = document.getElementById('story-weavers-redraw-btn');
    if (redrawBtn) redrawBtn.disabled = !page || !isLatest || sw.weaving || sw.redrawing;
}

/** Puts one page into the open book, turning the leaf when the page changes. */
function renderBookPage(page, index, total, story) {
    const textEl = document.getElementById('story-weavers-text');
    const imageEl = document.getElementById('story-weavers-image');
    const imagePlaceholder = document.getElementById('story-weavers-image-placeholder');
    const imageLoader = document.getElementById('story-weavers-image-loader');
    const chapterLabel = document.getElementById('story-weavers-chapter-label');
    const leftNum = document.getElementById('story-weavers-page-left-num');
    const rightNum = document.getElementById('story-weavers-page-right-num');
    const ribbon = document.getElementById('story-weavers-word-ribbon');
    const ribbonText = document.getElementById('story-weavers-word-ribbon-text');
    const book = document.getElementById('sw-book');

    const key = page ? `${index}|${page.sentence}|${page.imageUrl}` : 'blank';
    const previousIndex = Number(sw.shownKey.split('|')[0]);
    const changed = sw.shownKey !== '' && key !== sw.shownKey;
    const sameSpot = changed && previousIndex === index;
    sw.shownKey = key;

    textEl.classList.remove('is-pending');
    if (!sw.redrawing) imageLoader.classList.add('hidden');
    if (page) {
        textEl.innerHTML = highlightWord(page.sentence, page.word);
        chapterLabel.textContent = index === total - 1 ? `Page ${index + 1} · Latest page` : `Page ${index + 1} of ${total}`;
        leftNum.textContent = String(index * 2 + 1);
        rightNum.textContent = String(index * 2 + 2);
        ribbonText.textContent = page.word || '';
        ribbon.classList.toggle('hidden', !page.word);
        if (!sw.redrawing) {
            if (page.imageUrl) {
                if (imageEl.getAttribute('src') !== page.imageUrl) imageEl.src = page.imageUrl;
                imageEl.classList.remove('hidden');
                imagePlaceholder.classList.add('hidden');
            } else {
                imageEl.classList.add('hidden');
                imagePlaceholder.classList.remove('hidden');
            }
        }
    } else {
        textEl.textContent = story?.currentSentence === '' || !story
            ? "A new story awaits! Suggest and lock in a 'Word of the Day' to begin."
            : story.currentSentence;
        chapterLabel.textContent = 'A blank page';
        leftNum.textContent = '';
        rightNum.textContent = '';
        ribbon.classList.add('hidden');
        imageEl.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
    }
    book?.classList.toggle('is-blank', !page);

    if (changed && book && !sameSpot) {
        const forward = Number.isNaN(previousIndex) || index > previousIndex;
        book.classList.remove('is-turning-next', 'is-turning-prev');
        void book.offsetWidth;
        book.classList.add(forward ? 'is-turning-next' : 'is-turning-prev');
        window.clearTimeout(renderBookPage.turnTimer);
        renderBookPage.turnTimer = window.setTimeout(() => book.classList.remove('is-turning-next', 'is-turning-prev'), 900);
    }
}

function showPage(index) {
    const pages = currentPages();
    if (!pages.length) return;
    const target = Math.max(0, Math.min(pages.length - 1, index));
    stopPageNarration();
    sw.viewIndex = target === pages.length - 1 ? null : target;
    renderStoryWeaversUI(storyWeaverClassId());
}

function activePageIndex() {
    const pages = currentPages();
    return sw.viewIndex ?? pages.length - 1;
}

// --- WORD OF THE DAY ---

function setWordLockedUI(word) {
    const input = document.getElementById('story-weavers-word-input');
    const field = input?.closest('.sw-word-field');
    const seal = document.getElementById('story-weavers-word-seal');
    const sealText = document.getElementById('story-weavers-word-seal-text');
    const locked = Boolean(word);
    field?.classList.toggle('hidden', locked);
    seal?.classList.toggle('hidden', !locked);
    if (sealText) sealText.textContent = word || '';
    document.getElementById('story-weavers-suggest-word-btn').disabled = locked;
    const lucky = document.getElementById('story-weavers-lucky-btn');
    if (lucky) lucky.disabled = locked;
    if (locked) renderWordChoices([]);
}

export function resetStoryWeaverWordUI() {
    const input = document.getElementById('story-weavers-word-input');
    input.value = '';
    state.set('storyWeaverLockedWord', null);
    setWordLockedUI(null);
    document.getElementById('story-weavers-lock-in-btn').disabled = true;
    document.getElementById('story-weavers-end-btn').disabled = true;
    const classId = storyWeaverClassId();
    renderStoryWeaversUI(classId);
    hideWordEditorControls();
}

/** Seals the Word of the Day (the tick button, Enter, or a picked word card). */
export function confirmStoryWord(wordOverride = '') {
    const input = document.getElementById('story-weavers-word-input');
    const word = String(wordOverride || input.value || '').replace(/\s+/g, ' ').trim();
    if (!word) return false;
    input.value = word;
    state.set('storyWeaverLockedWord', word);
    setWordLockedUI(word);
    hideWordEditorControls(true);
    document.getElementById('story-weavers-clear-word-btn').classList.add('hidden');
    renderStoryWeaversUI(storyWeaverClassId());
    playSound('confirm');
    const seal = document.getElementById('story-weavers-word-seal');
    seal?.classList.remove('is-stamped');
    void seal?.offsetWidth;
    seal?.classList.add('is-stamped');
    return true;
}

export function showWordEditorControls() {
    document.getElementById('story-weavers-confirm-word-btn').classList.remove('hidden');
    document.getElementById('story-weavers-clear-word-btn').classList.remove('hidden');
}

export function hideWordEditorControls(isLocked = false) {
    document.getElementById('story-weavers-confirm-word-btn').classList.add('hidden');
    if (!isLocked) {
        document.getElementById('story-weavers-clear-word-btn').classList.add('hidden');
    }
}

const WORD_KINDS = new Set(['noun', 'verb', 'adjective', 'adverb']);

function renderWordChoices(choices, { source = '' } = {}) {
    const box = document.getElementById('story-weavers-word-choices');
    if (!box) return;
    if (!choices.length) {
        box.innerHTML = '';
        return;
    }
    box.innerHTML = `<p class="sw-word-choices__label">${source === 'ai' ? '<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> The Chronicler suggests' : '<i class="fas fa-dice" aria-hidden="true"></i> From the word bank'} <span>Tap one to seal it</span></p>
        <div class="sw-word-choices__row">${choices.map((choice, index) => `
            <button type="button" class="sw-word-card" data-word-choice="${escapeHtml(choice.word)}" style="--i:${index}">
                <span class="sw-word-card__word">${escapeHtml(choice.word)}</span>
                ${choice.kind ? `<span class="sw-word-card__kind sw-word-card__kind--${escapeHtml(choice.kind)}">${escapeHtml(choice.kind)}</span>` : ''}
            </button>`).join('')}</div>`;
}

/** "lantern - noun" lines from the AI, tolerant of numbering, bullets and stray punctuation. */
function parseWordChoices(text) {
    const seen = new Set();
    return String(text || '')
        .split(/[\n,;]+/)
        .map((line) => line.replace(/^[\s\d.)*•-]+/, '').replace(/["'`*.]/g, '').trim())
        .map((line) => {
            const [rawWord, rawKind = ''] = line.split(/\s*[-–:|(]\s*/);
            const word = String(rawWord || '').trim().split(/\s+/).slice(0, 2).join(' ');
            const kind = String(rawKind || '').replace(/[)]/g, '').trim().toLowerCase();
            return { word, kind: WORD_KINDS.has(kind) ? kind : '' };
        })
        .filter(({ word }) => {
            const key = word.toLowerCase();
            if (!word || word.length > 24 || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 3);
}

export async function handleSuggestWord() {
    if (!canUseFeature('eliteAI')) {
        showToast("AI features require the Elite tier. Try a Lucky dip instead!", "error");
        return;
    }
    playSound('magic_chime');
    const classId = storyWeaverClassId();
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;
    const ageGroup = getAgeGroupForLeague(classData.questLevel);
    const currentStory = state.get('currentStoryData')[classId]?.currentSentence || "A brand new story";
    const btn = document.getElementById('story-weavers-suggest-word-btn');
    const input = document.getElementById('story-weavers-word-input');
    btn.disabled = true;
    btn.classList.add('is-busy');

    const systemPrompt = `You are a creative writing assistant for a teacher. Suggest three interesting, slightly challenging English vocabulary words suitable for a language learner in the ${ageGroup} age group. The words should fit the theme of the ongoing story: one noun, one verb and one adjective. Answer with exactly three lines in the form "word - kind" and nothing else.`;
    const userPrompt = `The current story is: "${currentStory}". Suggest three new, creative words to continue the story.`;
    try {
        const reply = await callGeminiApi(systemPrompt, userPrompt);
        const choices = parseWordChoices(reply);
        if (!choices.length) throw new Error('No words in the reply');
        input.value = '';
        renderWordChoices(choices, { source: 'ai' });
    } catch (error) {
        showToast("The AI is busy, please try again!", "error");
    } finally {
        btn.disabled = Boolean(state.get('storyWeaverLockedWord'));
        btn.classList.remove('is-busy');
    }
}

function handleLuckyDip() {
    const classData = storyWeaverClassData();
    if (!classData) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }
    playSound('click');
    const shown = Array.from(document.querySelectorAll('[data-word-choice]')).map((b) => b.dataset.wordChoice);
    renderWordChoices(pickStoryWords(classData.questLevel, { exclude: shown }), { source: 'bank' });
}

// --- READ ALOUD & REDRAW ---

function stopPageNarration() {
    if (!sw.narrating) return;
    sw.narrating = false;
    if (isSpeaking()) stopSpeech();
    setReadButton(document.getElementById('story-weavers-read-btn'), false);
    document.getElementById('sw-book')?.classList.remove('is-narrating');
}

function setReadButton(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.innerHTML = on
        ? `<i class="fas fa-stop" aria-hidden="true"></i><span>Stop</span>`
        : `<i class="fas fa-volume-high" aria-hidden="true"></i><span>Read aloud</span>`;
}

function readPageAloud(text, btn, { onStop } = {}) {
    if (sw.narrating) {
        stopPageNarration();
        onStop?.();
        return;
    }
    if (!text) return;
    sw.narrating = true;
    setReadButton(btn, true);
    document.getElementById('sw-book')?.classList.add('is-narrating');
    const done = () => {
        sw.narrating = false;
        setReadButton(btn, false);
        document.getElementById('sw-book')?.classList.remove('is-narrating');
        onStop?.();
    };
    speakText(text, {
        rate: 0.92,
        pitch: 1.05,
        voiceHint: 'en',
        onEnd: done,
        onError: () => {
            done();
            showToast('Read aloud is not available on this device.', 'error');
        }
    });
}

function setLoomStep(step) {
    const el = document.getElementById('sw-loom-step');
    if (el) el.textContent = LOOM_STEPS[step] || LOOM_STEPS[1];
}

/** Paints a fresh illustration for the latest page and swaps it in, keeping the words. */
async function handleRedrawIllustration() {
    if (!canUseFeature('eliteAI')) {
        showToast("AI image generation requires Elite tier.", "error");
        return;
    }
    const classId = storyWeaverClassId();
    const pages = currentPages(classId);
    const page = pages[pages.length - 1];
    if (!classId || !page || sw.redrawing) return;
    sw.redrawing = true;
    playSound('magic_chime');
    const loader = document.getElementById('story-weavers-image-loader');
    document.getElementById('story-weavers-image').classList.add('hidden');
    document.getElementById('story-weavers-image-placeholder').classList.add('hidden');
    loader.classList.remove('hidden');
    setLoomStep(2);
    renderStoryWeaversUI(classId);
    try {
        const context = pages.slice(-4, -1).map((p) => p.sentence).join(' ');
        const imageUrl = await paintStoryPage(classId, page.sentence, context);
        const batch = writeBatch(db);
        batch.update(storyRef(classId), { currentImageUrl: imageUrl, updatedAt: serverTimestamp() });
        if (page.id) batch.update(doc(historyRef(classId), page.id), { imageUrl });
        await batch.commit();
        showToast('A fresh illustration is in the book!', 'success');
    } catch (error) {
        console.error('Error redrawing illustration:', error);
        showToast('Could not paint a new picture. Please try again.', 'error');
    } finally {
        sw.redrawing = false;
        sw.shownKey = '';
        renderStoryWeaversUI(classId);
    }
}

/** AI prompt → Cloudflare image → compressed → Storage URL. */
async function paintStoryPage(classId, sentence, recentHistory, onStep = setLoomStep) {
    const imagePromptSystemPrompt = "You are an expert AI art prompt engineer. Your task is to convert a story's context into a short, effective, simplified English prompt for an image generator, under 75 tokens. The image type must be a 'whimsical children's storybook illustration'. The style should be 'simple shapes, vibrant and cheerful colors, friendly characters'. Use progressive detailing and relative descriptions. The prompt must be a single, structured paragraph. Conclude with '(Token count: X)'.";
    const imagePromptUserPrompt = `Refactor the following into a high-quality, short image prompt. Previous context: '${recentHistory}'. The new, most important sentence is: "${sentence}". The image should focus on the new sentence while staying consistent with the previous context.`;
    const imagePrompt = await callGeminiApi(imagePromptSystemPrompt, imagePromptUserPrompt);

    onStep(2);
    const rawImageBase64 = await callCloudflareAiImageApi(imagePrompt);
    const compressedImageBase64 = await compressImageBase64(rawImageBase64);

    onStep(3);
    const { uploadImageToStorage } = await import('../utils.js');
    const imagePath = `story_images/${classId}/${Date.now()}.jpg`;
    return uploadImageToStorage(compressedImageBase64, imagePath);
}

// --- CORE GAME ACTIONS ---

export function openStoryInputModal(options = {}) {
    const classId = storyWeaverClassId();
    if (!classId) return;
    // Called directly as a click handler too, so ignore Event objects.
    const starter = typeof options?.starter === 'string' ? options.starter : '';

    const pages = currentPages(classId);
    const eyebrow = document.getElementById('story-input-eyebrow');
    if (eyebrow) eyebrow.textContent = pages.length ? `Page ${pages.length + 1} of the story` : 'The very first page';
    const previous = document.getElementById('story-input-previous');
    if (previous) {
        const last = pages[pages.length - 1];
        previous.innerHTML = last ? `<span>So far…</span> ${highlightWord(last.sentence, last.word)}` : '';
        previous.classList.toggle('hidden', !last);
    }

    const textarea = document.getElementById('story-input-textarea');
    textarea.value = '';
    updateStoryInputMeta();
    modals.showAnimatedModal('story-input-modal');
    loadStoryHelpers()
        .then((helpers) => {
            helpers.renderStoryInputHelpers(classId);
            if (starter) helpers.insertStarterIntoTextarea(starter);
            updateStoryInputMeta();
        })
        .catch((error) => console.warn('Story input helpers failed to render:', error));
}

/** Live word count and a check that the Word of the Day made it into the sentence. */
function updateStoryInputMeta() {
    const textarea = document.getElementById('story-input-textarea');
    const text = textarea?.value || '';
    const count = document.getElementById('story-input-count');
    if (count) {
        const n = countWords(text);
        count.textContent = `${n} word${n === 1 ? '' : 's'}`;
    }
    const check = document.getElementById('story-input-word-check');
    const word = state.get('storyWeaverLockedWord');
    if (!check) return;
    check.classList.toggle('hidden', !word);
    if (!word) return;
    const used = sentenceUsesWord(text, word);
    check.classList.toggle('is-used', used);
    check.innerHTML = used
        ? `<i class="fas fa-circle-check" aria-hidden="true"></i> <strong>${escapeHtml(word)}</strong> is in the sentence!`
        : `<i class="fas fa-gem" aria-hidden="true"></i> Try to use <strong>${escapeHtml(word)}</strong>`;
}

export async function handleLockInSentence() {
    if (!canUseFeature('eliteAI')) {
        showToast("AI image generation requires Elite tier.", "error");
        return;
    }
    const classId = storyWeaverClassId();
    const wordOfTheDay = state.get('storyWeaverLockedWord');
    const newSentence = document.getElementById('story-input-textarea').value.trim();
    const storyRecord = state.get('currentStoryData')[classId];
    const storyDocExists = Boolean(storyRecord);
    const currentStory = storyRecord || {};
    const isNewStory = !currentStory.currentSentence;
    const historyQuery = query(historyRef(classId), orderBy("createdAt", "desc"), limit(3));
    const historySnapshot = await getDocs(historyQuery);
    const recentHistory = historySnapshot.docs.map(d => d.data().sentence).join(' ');

    if (newSentence === (currentStory.currentSentence || '')) {
        showToast("No changes made to the story.", "info");
        modals.hideModal('story-input-modal');
        return;
    }
    if (!newSentence) {
        showToast("The story cannot be empty.", "error");
        return;
    }

    modals.hideModal('story-input-modal');
    playSound('writing');
    stopPageNarration();

    const btn = document.getElementById('story-weavers-lock-in-btn');
    btn.disabled = true;
    btn.classList.add('is-busy');
    document.getElementById('sw-weave-label').textContent = 'Chronicling...';

    // The new words go straight onto the page while the Chronicler paints.
    sw.weaving = true;
    sw.viewIndex = null;
    const textEl = document.getElementById('story-weavers-text');
    textEl.innerHTML = highlightWord(newSentence, wordOfTheDay);
    textEl.classList.add('is-pending');
    document.getElementById('story-weavers-chapter-label').textContent = 'Weaving a new page...';
    const nextPage = currentPages(classId).length + 1;
    document.getElementById('story-weavers-page-left-num').textContent = String(nextPage * 2 - 1);
    document.getElementById('story-weavers-page-right-num').textContent = String(nextPage * 2);
    document.getElementById('story-weavers-word-ribbon-text').textContent = wordOfTheDay || '';
    document.getElementById('story-weavers-word-ribbon').classList.toggle('hidden', !wordOfTheDay);
    ['story-weavers-redraw-btn', 'story-weavers-read-btn'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
    document.getElementById('sw-book')?.classList.add('is-weaving');
    document.getElementById('story-weavers-image-loader').classList.remove('hidden');
    document.getElementById('story-weavers-image').classList.add('hidden');
    document.getElementById('story-weavers-image-placeholder').classList.add('hidden');
    setLoomStep(1);

    try {
        const imageUrl = await paintStoryPage(classId, newSentence, recentHistory);

        const storyDocRef = storyRef(classId);
        const newHistoryDoc = doc(historyRef(classId));
        const storyDataToSet = {
            currentSentence: newSentence,
            currentImageUrl: imageUrl,
            currentWord: wordOfTheDay,
            storyAdditionsCount: increment(1),
            updatedAt: serverTimestamp(),
            createdBy: currentStory.createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        };
        const historyPayload = {
            sentence: newSentence,
            word: wordOfTheDay,
            imageUrl: imageUrl,
            createdAt: serverTimestamp(),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        };

        // Chapter writes are only allowed once the parent story_data doc exists.
        if (!storyDocExists) {
            await setDoc(storyDocRef, storyDataToSet);
            await setDoc(newHistoryDoc, historyPayload);
        } else {
            const batch = writeBatch(db);
            if (isNewStory) {
                batch.set(storyDocRef, storyDataToSet);
            } else {
                batch.update(storyDocRef, storyDataToSet);
            }
            batch.set(newHistoryDoc, historyPayload);
            await batch.commit();
        }

        const newAdditionsCount = (currentStory.storyAdditionsCount || 0) + 1;
        if (newAdditionsCount > 0 && newAdditionsCount % 2 === 0) {
            modals.showModal('Story Milestone!', 'Award a +0.5 Creativity Bonus Star to every student in the class?', () => awardStoryWeaverBonusStarToClass(classId), 'Yes, Award Bonus!', 'No, Thanks');
        } else {
            showToast("Story updated successfully!", "success");
        }
    } catch (error) {
        console.error("Error locking in sentence:", error);
        showToast("Failed to save the story. Please try again.", "error");
    } finally {
        sw.weaving = false;
        sw.shownKey = sw.shownKey || 'blank';
        btn.classList.remove('is-busy');
        document.getElementById('sw-book')?.classList.remove('is-weaving');
        // We rely on the onSnapshot listener to update the UI once the data is saved
        resetStoryWeaverWordUI();
    }
}

export function handleRevealStory() {
    const classId = storyWeaverClassId();
    const story = state.get('currentStoryData')[classId];
    const pages = currentPages(classId);
    const index = activePageIndex();
    const page = pages[index] || null;
    const textEl = document.getElementById('story-reveal-text');
    if (page) textEl.innerHTML = highlightWord(page.sentence, page.word);
    else textEl.textContent = story?.currentSentence || "Select a class to see the story.";

    const pageLabel = document.getElementById('story-reveal-page');
    if (pageLabel) {
        const classData = storyWeaverClassData(classId);
        pageLabel.innerHTML = page
            ? `${escapeHtml(classData?.logo || '📖')} <span>Page ${index + 1}${pages.length > 1 ? ` of ${pages.length}` : ''}</span>`
            : '';
    }

    const art = document.getElementById('story-reveal-art');
    const image = document.getElementById('story-reveal-image');
    const imageSrc = page?.imageUrl || '';
    if (art && image) {
        image.src = imageSrc;
        art.classList.toggle('hidden', !imageSrc);
    }
    const wordEl = document.getElementById('story-reveal-word');
    if (wordEl) {
        const word = page ? String(page.word || '').trim() : '';
        wordEl.innerHTML = word ? `<span>Word of the Day</span> ${escapeHtml(word)}` : '';
        wordEl.classList.toggle('hidden', !word);
    }
    const readBtn = document.getElementById('story-reveal-read-btn');
    if (readBtn) {
        stopPageNarration();
        setReadButton(readBtn, false);
        readBtn.classList.toggle('hidden', !page || !isTtsSupported());
    }

    modals.showAnimatedModal('story-reveal-modal');
    loadStoryHelpers()
        .then((helpers) => helpers.renderRevealPrompts(classId))
        .catch((error) => console.warn('Story reveal prompts failed to render:', error));
}

export async function handleShowStoryHistory() {
    const classId = storyWeaverClassId();
    const classData = storyWeaverClassData(classId);
    if (!classData) return;
    stopPageNarration();
    const { openStoryReader } = await import('./storyReader.js');
    const pages = currentPages(classId);
    openStoryReader({
        eyebrow: 'Current Chronicle',
        title: `${classData.logo || ''} ${classData.name}'s story`.trim(),
        subtitle: pages.length ? `${pages.length} page${pages.length === 1 ? '' : 's'} so far. Still being written!` : 'This story is just beginning!',
        pages,
        startAt: 0,
        mode: 'current'
    });
}

export function handleResetStory() {
    const classId = storyWeaverClassId();
    if (!classId) return;
    const pageCount = currentPages(classId).length;
    const message = pageCount
        ? `This clears the ${pageCount} page${pageCount === 1 ? '' : 's'} of the current story and opens a blank book. To keep them as a storybook, press The End instead. Start over?`
        : 'This opens a blank book for the class. Start over?';
    modals.showModal('Start a New Story?', message, async () => {
        try {
            stopPageNarration();
            const storyDocRef = storyRef(classId);
            await setDoc(storyDocRef, {
                currentSentence: "",
                currentImageBase64: null,
                currentWord: null,
                storyAdditionsCount: 0,
                updatedAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });
            // Clear the old pages so they cannot slip into the next storybook.
            const oldPages = await getDocs(historyRef(classId));
            for (let i = 0; i < oldPages.docs.length; i += 400) {
                const batch = writeBatch(db);
                oldPages.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
            sw.viewIndex = null;
            resetStoryWeaverWordUI();
            showToast("A new chapter begins!", "success");
        } catch (error) {
            console.error("Error resetting story:", error);
            showToast("Failed to start a new story.", "error");
        }
    }, 'Start Over');
}

function ensureStoryWeaverListeners() {
    if (sw.listenersBound) return;
    sw.listenersBound = true;
    const on = (id, type, fn) => document.getElementById(id)?.addEventListener(type, fn);

    on('story-weavers-lucky-btn', 'click', handleLuckyDip);
    on('story-weavers-change-word-btn', 'click', () => {
        const word = state.get('storyWeaverLockedWord') || '';
        resetStoryWeaverWordUI();
        const input = document.getElementById('story-weavers-word-input');
        input.value = word;
        if (word) showWordEditorControls();
        input.focus();
    });
    on('story-weavers-word-input', 'keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmStoryWord();
        }
    });
    on('story-weavers-word-choices', 'click', (event) => {
        const card = event.target.closest('[data-word-choice]');
        if (card) confirmStoryWord(card.dataset.wordChoice);
    });
    on('sw-thread', 'click', (event) => {
        const bead = event.target.closest('.sw-bead');
        if (!bead) return;
        if (bead.dataset.pageNext) {
            const lockInBtn = document.getElementById('story-weavers-lock-in-btn');
            if (lockInBtn.disabled) {
                showToast('Lock in the Word of the Day first, then write the next page.', 'info');
                document.getElementById('story-weavers-word-input')?.focus();
            } else {
                openStoryInputModal();
            }
            return;
        }
        showPage(Number(bead.dataset.pageIndex));
    });
    on('sw-prev-page', 'click', () => showPage(activePageIndex() - 1));
    on('sw-next-page', 'click', () => showPage(activePageIndex() + 1));
    on('sw-back-latest', 'click', () => showPage(Infinity));
    on('story-weavers-read-btn', 'click', (event) => {
        const page = currentPages()[activePageIndex()];
        readPageAloud(page?.sentence, event.currentTarget);
    });
    on('story-weavers-redraw-btn', 'click', handleRedrawIllustration);
    on('story-reveal-read-btn', 'click', (event) => {
        readPageAloud(document.getElementById('story-reveal-text')?.textContent?.trim(), event.currentTarget);
    });
    on('story-reveal-close-btn', 'click', stopPageNarration);
    on('story-input-textarea', 'input', updateStoryInputMeta);
    on('story-input-helpers', 'click', () => window.setTimeout(updateStoryInputMeta, 0));
    on('sw-shelf', 'click', (event) => {
        const book = event.target.closest('.view-storybook-btn');
        if (book) openStorybookViewer(book.dataset.storyId);
    });
}

// --- ARCHIVE & STORYBOOK ---

function debounce(fn, waitMs) {
    let timeoutId;
    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn(...args), waitMs);
    };
}

/** Ensures &lt;img&gt; nodes have finished loading before html2canvas runs (needed for remote URLs). */
function waitForImages(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    return Promise.all(
        imgs.map(
            (img) =>
                new Promise((resolve) => {
                    if (img.complete && img.naturalHeight > 0) {
                        resolve();
                        return;
                    }
                    const done = () => resolve();
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                    window.setTimeout(done, 20000);
                })
        )
    );
}

function getTimestampMillis(ts) {
    try {
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.toDate === 'function') return ts.toDate().getTime();
        return 0;
    } catch {
        return 0;
    }
}

const debouncedRenderStoryArchive = debounce(() => renderStoryArchive(), 140);
const storybookCoverInflight = new Set();

export function handleStoryArchiveSearchInput() {
    debouncedRenderStoryArchive();
}

export function handleStoryArchiveFilterChange() {
    renderStoryArchive();
}

export function openStoryArchiveModal() {
    import('../db/listeners.js').then(({ ensureCompletedStoriesListener }) => {
        ensureCompletedStoriesListener();
        renderStoryArchive();
        modals.showAnimatedModal('story-archive-modal');
        document.getElementById('story-archive-search')?.focus();
    });
}

export function renderStoryArchive() {
    const allCompletedStories = state.get('allCompletedStories') || [];
    const selectedClassId = storyWeaverClassId();

    renderArchiveSurface({
        listEl: document.getElementById('story-archive-list'),
        searchEl: document.getElementById('story-archive-search'),
        sortEl: document.getElementById('story-archive-sort'),
        stories: allCompletedStories,
        selectedClassId
    });
    renderStoryShelf(allCompletedStories, selectedClassId);
}

/** The class's finished storybooks, standing on the shelf under the desk (newest first). */
function renderStoryShelf(stories, selectedClassId) {
    const shelf = document.getElementById('sw-shelf');
    if (!shelf) return;
    const mine = stories
        .filter((s) => !selectedClassId || s.classId === selectedClassId)
        .sort((a, b) => getTimestampMillis(b.completedAt) - getTimestampMillis(a.completedAt));
    const sub = document.getElementById('sw-shelf-sub');
    const classData = storyWeaverClassData(selectedClassId);
    if (sub) {
        sub.textContent = mine.length
            ? `${mine.length} storybook${mine.length === 1 ? '' : 's'} ${classData ? `by ${classData.name}` : 'from your classes'}. Tap a book to read it.`
            : 'Every finished story is bound and kept here.';
    }
    const visible = mine.slice(0, 10);
    visible.forEach((s) => {
        if (s?.id && !s.coverImageUrl && !s.coverImageBase64) ensureStorybookCover(s.id);
    });
    shelf.innerHTML = visible.length
        ? `<div class="sw-shelf__books">${visible.map(shelfBookHtml).join('')}</div><div class="sw-shelf__plank" aria-hidden="true"></div>`
        : `${shelfEmptyHtml(Boolean(selectedClassId))}<div class="sw-shelf__plank" aria-hidden="true"></div>`;
}

function renderArchiveSurface({ listEl, searchEl, sortEl, stories, selectedClassId, limit }) {
    if (!listEl) return;

    const queryText = (searchEl?.value || '').trim().toLowerCase();
    const sortMode = sortEl?.value || 'newest';

    let filtered = stories.slice();
    if (selectedClassId) filtered = filtered.filter(s => s.classId === selectedClassId);
    if (queryText) {
        filtered = filtered.filter(s => {
            const haystack = `${s.title || ''} ${s.className || ''}`.toLowerCase();
            return haystack.includes(queryText);
        });
    }

    filtered.sort((a, b) => {
        if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '');
        const aTime = getTimestampMillis(a.completedAt);
        const bTime = getTimestampMillis(b.completedAt);
        if (sortMode === 'oldest') return aTime - bTime;
        return bTime - aTime;
    });

    const visibleStories = typeof limit === 'number' ? filtered.slice(0, limit) : filtered;

    if (stories.length === 0) {
        listEl.innerHTML = `<div class="sw-library-empty"><i class="fas fa-book" aria-hidden="true"></i><p>You have no completed storybooks yet. Finish a story to see it here!</p></div>`;
        return;
    }

    if (visibleStories.length === 0) {
        listEl.innerHTML = selectedClassId
            ? `<div class="sw-library-empty"><i class="fas fa-book" aria-hidden="true"></i><p>No storybooks for this class yet.</p></div>`
            : `<div class="sw-library-empty"><i class="fas fa-magnifying-glass" aria-hidden="true"></i><p>No matching storybooks.</p></div>`;
        return;
    }

    visibleStories.forEach((s) => {
        if (!s?.id) return;
        if (s.coverImageUrl || s.coverImageBase64) return;
        ensureStorybookCover(s.id);
    });

    listEl.innerHTML = visibleStories.map((story, index) => {
        const title = escapeHtml(story.title || 'Untitled Story');
        const classLine = escapeHtml(`${story.classLogo || ''} ${story.className || ''}`.trim() || 'Unknown class');
        const completedDate = story.completedAt?.toDate?.().toLocaleDateString?.() || '';
        const completedText = completedDate ? `Completed ${escapeHtml(completedDate)}` : 'Completed earlier';
        const coverUrl = story.coverImageUrl || story.coverImageBase64 || '';
        const hue = [...String(story.title || '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;

        const cover = coverUrl
            ? `<img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" decoding="async" class="story-weavers-archive-cover" />`
            : `<div class="story-weavers-archive-cover story-weavers-archive-cover--placeholder" aria-hidden="true">
                    <i class="fas fa-feather-pointed"></i>
               </div>`;

        return `
            <button type="button"
                class="story-weavers-archive-tile view-storybook-btn"
                data-story-id="${escapeHtml(story.id)}" style="--hue:${hue};--i:${index}"
                aria-label="Open storybook: ${title}">
                <div class="story-weavers-archive-cover-wrap">
                    ${cover}
                    <span class="story-weavers-archive-open" aria-hidden="true"><i class="fas fa-book-open"></i> Read</span>
                </div>
                <div class="story-weavers-archive-body">
                    <div class="story-weavers-archive-title">${title}</div>
                    <div class="story-weavers-archive-meta">${classLine}</div>
                    <div class="story-weavers-archive-submeta">${completedText}</div>
                </div>
            </button>
        `;
    }).join('');
}

async function ensureStorybookCover(storyId) {
    if (storybookCoverInflight.has(storyId)) return;
    storybookCoverInflight.add(storyId);
    try {
        const chaptersQuery = query(
            collection(db, `artifacts/great-class-quest/public/data/completed_stories/${storyId}/chapters`),
            orderBy('chapterNumber', 'asc'),
            limit(1)
        );
        const snapshot = await getDocs(chaptersQuery);
        const first = snapshot.docs[0]?.data?.();
        const coverImageUrl = first?.imageUrl || null;
        const coverImageBase64 = !coverImageUrl ? (first?.imageBase64 || null) : null;
        if (!coverImageUrl && !coverImageBase64) return;

        const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/completed_stories`, storyId);
        await updateDoc(storyDocRef, { coverImageUrl, coverImageBase64 });
    } catch {
    } finally {
        storybookCoverInflight.delete(storyId);
    }
}

export async function openStorybookViewer(storyId) {
    modals.hideModal('story-archive-modal');
    const story = state.get('allCompletedStories').find(s => s.id === storyId);
    if (!story) return;
    stopPageNarration();
    const { openStoryReader, setReaderPages, showReaderError } = await import('./storyReader.js');
    const completedDate = story.completedAt?.toDate?.().toLocaleDateString?.() || '';

    openStoryReader({
        eyebrow: completedDate ? `Storybook · finished ${completedDate}` : 'Storybook',
        title: story.title || 'Untitled Story',
        subtitle: `A Story by ${story.classLogo || ''} ${story.className || ''}`.replace(/\s+/g, ' ').trim(),
        pages: null,
        mode: 'archive',
        onDelete: () => handleDeleteCompletedStory(story.id)
    });

    try {
        const chaptersQuery = query(collection(db, `artifacts/great-class-quest/public/data/completed_stories/${storyId}/chapters`), orderBy("chapterNumber", "asc"));
        const snapshot = await getDocs(chaptersQuery);
        const chapters = snapshot.docs.map(doc => doc.data());

        if (chapters.length === 0) {
            showReaderError('This storybook has no chapters!');
            return;
        }

        story.chapters = chapters;
        setReaderPages(chapters.map((chapter) => ({
            sentence: chapter.sentence || '',
            word: chapter.word || '',
            imageUrl: chapter.imageUrl || chapter.imageBase64 || ''
        })), { onPrint: () => handlePrintStorybook(storyId) });
    } catch (error) {
        console.error("Error loading story chapters:", error);
        showReaderError('Could not load the chapters for this storybook.');
    }
}

async function handlePrintStorybook(storyId) {
    const story = state.get('allCompletedStories').find(s => s.id === storyId);
    const classData = state.get('allSchoolClasses').find(c => c.id === story.classId);
    if (!story || !classData || !story.chapters) {
        showToast("Story data is not fully loaded for printing.", "error");
        return;
    }

    const btn = document.getElementById('storybook-viewer-print-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Assembling...`;

    try {
        const theme = constants.storybookThemes[simpleHashCode(story.title) % constants.storybookThemes.length];
        const storyPages = story.chapters.map((chapter) => {
            const imgSrcRaw = chapter.imageUrl || chapter.imageBase64 || '';
            const escapedSrc = escapeHtml(imgSrcRaw);
            const sentence = escapeHtml(chapter.sentence || '');
            const pageNum = escapeHtml(String(chapter.chapterNumber ?? ''));
            const remoteAttr = /^https?:\/\//i.test(imgSrcRaw) ? ' crossorigin="anonymous"' : '';
            const imageInner = imgSrcRaw
                ? `<img src="${escapedSrc}" alt=""${remoteAttr} style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:${theme.textColor};opacity:0.45;font-family:${theme.bodyFont};font-size:18px;">No illustration</div>`;
            return `
            <div style="width: 800px; height: 600px; display: flex; flex-direction: column; padding: 40px; background-color: ${theme.bg}; border: 10px solid ${theme.border}; box-sizing: border-box; page-break-after: always;">
                <div style="width: 100%; height: 350px; border-radius: 10px; border: 3px solid ${theme.border}; background-color: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${imageInner}
                </div>
                <p style="text-align: center; font-family: ${theme.bodyFont}; font-size: 22px; color: ${theme.textColor}; margin-top: 20px; flex-grow: 1; font-weight: ${theme.fontWeight || 'normal'};">${sentence}</p>
                <p style="text-align: right; font-size: 14px; color: ${theme.textColor}; opacity: 0.7;">- Page ${pageNum} -</p>
            </div>`;
        });

        const titlePage = `
            <div style="width: 800px; height: 600px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; background-color: ${theme.bg}; border: 10px solid ${theme.border}; box-sizing: border-box; page-break-after: always;">
                <h1 style="font-family: ${theme.titleFont}; font-size: 50px; color: ${theme.titleColor}; text-align: center;">${escapeHtml(story.title)}</h1>
                <h2 style="font-family: ${theme.titleFont}; font-size: 30px; color: ${theme.textColor}; text-align: center; margin-top: 10px;">A Story Weavers Adventure</h2>
            </div>`;

        const signatureTemplate = document.getElementById('storybook-signature-page-template');
        signatureTemplate.style.backgroundColor = theme.bg;
        signatureTemplate.style.borderColor = theme.border;
        document.getElementById('signature-class-logo').innerText = classData.logo;
        document.getElementById('signature-created-by').style.color = theme.titleColor;
        document.getElementById('signature-class-name').innerText = classData.name;
        document.getElementById('signature-class-name').style.color = theme.titleColor;
        document.getElementById('signature-student-list').style.fontFamily = theme.bodyFont;
        document.getElementById('signature-student-list').style.color = theme.textColor;
        document.getElementById('signature-school-name').style.color = theme.textColor;
        const studentsInClass = state.get('allStudents').filter(s => s.classId === classData.id);
        document.getElementById('signature-student-list').innerHTML = studentsInClass.map(s => `<span>${s.name}</span>`).join('');

        const printContainer = document.getElementById('storybook-print-container');
        printContainer.innerHTML = titlePage + storyPages.join('') + signatureTemplate.outerHTML;

        const { html2canvas, jsPDF } = await loadPdfTools();
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });

        const pages = printContainer.children;
        const canvasOpts = {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            logging: false,
            imageTimeout: 25000
        };
        for (let i = 0; i < pages.length; i++) {
            const pageEl = pages[i];
            await waitForImages(pageEl);
            try {
                if (document.fonts) await document.fonts.ready;
            } catch (_) {
                /* ignore */
            }
            const canvas = await html2canvas(pageEl, canvasOpts);
            const imgData = canvas.toDataURL('image/png');
            if (i > 0) pdf.addPage([800, 600], 'landscape');
            pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        }

        pdf.save(`${story.title}_Storybook.pdf`);

    } catch (error) {
        console.error("Error creating storybook PDF:", error);
        showToast("Could not create the storybook PDF.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-print mr-2"></i> Print Storybook`;
    }
}
