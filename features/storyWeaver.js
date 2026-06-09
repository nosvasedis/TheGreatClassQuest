// /features/storyWeaver.js

// --- IMPORTS ---
import { db } from '../firebase.js';
import { doc, getDocs, collection, query, orderBy, setDoc, updateDoc, writeBatch, serverTimestamp, increment, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

function storyWeaverClassId() {
    return state.get('globalSelectedClassId') || '';
}

// --- MAIN UI & STATE MANAGEMENT ---

export function handleStoryWeaversClassSelect() {
    const classId = storyWeaverClassId();
    const mainContent = document.getElementById('story-weavers-main-content');
    const placeholder = document.getElementById('story-weavers-placeholder');
    
    const unsubscribeStoryData = state.get('unsubscribeStoryData');
    const currentUnsub = unsubscribeStoryData.current;
    if (currentUnsub) {
        currentUnsub();
        delete unsubscribeStoryData.current;
    }

    resetStoryWeaverWordUI();

    if (classId) {
        mainContent.classList.remove('hidden');
        placeholder.classList.add('hidden');
        
        const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        unsubscribeStoryData.current = onSnapshot(storyDocRef, (doc) => {
            const currentStoryData = state.get('currentStoryData');
            currentStoryData[classId] = doc.exists() ? doc.data() : null;
            renderStoryWeaversUI(classId);
        }, (error) => console.error("Error listening to story data:", error));
    } else {
        mainContent.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    renderStoryArchive();
}

function renderStoryWeaversUI(classId) {
    const story = state.get('currentStoryData')[classId];
    const textEl = document.getElementById('story-weavers-text');
    const imageEl = document.getElementById('story-weavers-image');
    const imagePlaceholder = document.getElementById('story-weavers-image-placeholder');
    const imageLoader = document.getElementById('story-weavers-image-loader');
    const lockInBtn = document.getElementById('story-weavers-lock-in-btn');
    const endBtn = document.getElementById('story-weavers-end-btn');

    if (story && story.currentSentence) {
        lockInBtn.innerHTML = 'Continue...';
        endBtn.disabled = false;
        textEl.textContent = story.currentSentence;
        imageLoader.classList.add('hidden');
        if (story.currentImageUrl || story.currentImageBase64) {
            imageEl.src = story.currentImageUrl || story.currentImageBase64;
            imageEl.classList.remove('hidden');
            imagePlaceholder.classList.add('hidden');
        } else {
            imageEl.classList.add('hidden');
            imagePlaceholder.classList.remove('hidden');
        }
    } else {
        lockInBtn.innerHTML = 'Start Story...';
        endBtn.disabled = true;
        textEl.textContent = "A new story awaits! Suggest and lock in a 'Word of the Day' to begin.";
        imageEl.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
        imageLoader.classList.add('hidden');
    }
}

export function resetStoryWeaverWordUI() {
    const input = document.getElementById('story-weavers-word-input');
    input.value = '';
    input.classList.remove('bg-green-100', 'border-green-400', 'font-bold');
    state.set('storyWeaverLockedWord', null);
    document.getElementById('story-weavers-suggest-word-btn').disabled = false;
    document.getElementById('story-weavers-lock-in-btn').disabled = true;
    document.getElementById('story-weavers-end-btn').disabled = true;
    const classId = storyWeaverClassId();
    renderStoryWeaversUI(classId);
    hideWordEditorControls();
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


// --- CORE GAME ACTIONS ---

export async function handleSuggestWord() {
    if (!canUseFeature('eliteAI')) {
        showToast("AI features require the Elite tier.", "error");
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

    const systemPrompt = `You are a creative writing assistant for a teacher. Suggest a single, interesting, and slightly challenging English vocabulary word suitable for a language learner in the ${ageGroup} age group. The word should fit the theme of the ongoing story. Provide only the word, no definitions or extra text. Vary your suggestions; provide a mix of nouns, verbs, and adjectives.`;
    const userPrompt = `The current story is: "${currentStory}". Suggest one new, creative word to continue the story.`;
    try {
        const word = await callGeminiApi(systemPrompt, userPrompt);
        input.value = word.replace(/[\n."]/g, '').trim();
        showWordEditorControls();
    } catch (error) {
        showToast("The AI is busy, please try again!", "error");
    } finally {
        btn.disabled = false;
    }
}

export function openStoryInputModal() {
    const classId = storyWeaverClassId();
    if (!classId) return;
    
    const story = state.get('currentStoryData')[classId];
    const isNewStory = !story || !story.currentSentence;
    
    document.getElementById('story-input-textarea').value = '';
    modals.showAnimatedModal('story-input-modal');
}

export async function handleLockInSentence() {
    if (!canUseFeature('eliteAI')) {
        showToast("AI image generation requires Elite tier.", "error");
        return;
    }
    const classId = storyWeaverClassId();
    const wordOfTheDay = state.get('storyWeaverLockedWord');
    const newSentence = document.getElementById('story-input-textarea').value.trim();
    const currentStory = state.get('currentStoryData')[classId] || {};
    const isNewStory = !currentStory.currentSentence;
    const historyQuery = query(collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`), orderBy("createdAt", "desc"), limit(3));
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

    const btn = document.getElementById('story-weavers-lock-in-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Chronicling...`;

    document.getElementById('story-weavers-image-loader').classList.remove('hidden');
    document.getElementById('story-weavers-image').classList.add('hidden');
    document.getElementById('story-weavers-image-placeholder').classList.add('hidden');

    try {
        const imagePromptSystemPrompt = "You are an expert AI art prompt engineer. Your task is to convert a story's context into a short, effective, simplified English prompt for an image generator, under 75 tokens. The image type must be a 'whimsical children's storybook illustration'. The style should be 'simple shapes, vibrant and cheerful colors, friendly characters'. Use progressive detailing and relative descriptions. The prompt must be a single, structured paragraph. Conclude with '(Token count: X)'.";
        const imagePromptUserPrompt = `Refactor the following into a high-quality, short image prompt. Previous context: '${recentHistory}'. The new, most important sentence is: "${newSentence}". The image should focus on the new sentence while staying consistent with the previous context.`;
        const imagePrompt = await callGeminiApi(imagePromptSystemPrompt, imagePromptUserPrompt);
        
        const rawImageBase64 = await callCloudflareAiImageApi(imagePrompt);
        const compressedImageBase64 = await compressImageBase64(rawImageBase64);

        // --- NEW: UPLOAD TO STORAGE START ---
        const { uploadImageToStorage } = await import('../utils.js');
        const imagePath = `story_images/${classId}/${Date.now()}.jpg`;
        const imageUrl = await uploadImageToStorage(compressedImageBase64, imagePath);
        // --- NEW: UPLOAD TO STORAGE END ---

        const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        const historyCollectionRef = collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`);
        
        const batch = writeBatch(db);
        const storyDataToSet = { 
            currentSentence: newSentence, 
            currentImageUrl: imageUrl, // Saved the URL instead of Base64
            currentWord: wordOfTheDay,
            storyAdditionsCount: increment(1),
            updatedAt: serverTimestamp(),
            createdBy: currentStory.createdBy || { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        };

        if (isNewStory) {
            batch.set(storyDocRef, storyDataToSet);
        } else {
            batch.update(storyDocRef, storyDataToSet);
        }

        const newHistoryDoc = doc(historyCollectionRef);
        batch.set(newHistoryDoc, {
            sentence: newSentence,
            word: wordOfTheDay,
            imageUrl: imageUrl, // Saved the URL instead of Base64
            createdAt: serverTimestamp(),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        });

        await batch.commit();
        
        const newAdditionsCount = (currentStory.storyAdditionsCount || 0) + 1;
        if (newAdditionsCount > 0 && newAdditionsCount % 2 === 0) {
            modals.showModal('Story Milestone!', 'Award a +0.5 Creativity Bonus Star to every student in the class?', () => awardStoryWeaverBonusStarToClass(classId), 'Yes, Award Bonus!', 'No, Thanks');
        } else {
            showToast("Story updated successfully!", "success");
        }
    } catch (error) {
        console.error("Error locking in sentence:", error);
        showToast("Failed to save the story. Please try again.", "error");
        // renderStoryWeaversUI(classId); // Optional: Refresh UI on error
    } finally {
        // We rely on the onSnapshot listener to update the UI once the data is saved
        resetStoryWeaverWordUI();
    }
}

export function handleRevealStory() {
    const classId = storyWeaverClassId();
    const storyText = state.get('currentStoryData')[classId]?.currentSentence || "Select a class to see the story.";
    document.getElementById('story-reveal-text').textContent = storyText;
    modals.showAnimatedModal('story-reveal-modal');
}

export async function handleShowStoryHistory() {
    const classId = storyWeaverClassId();
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    document.getElementById('story-history-title').innerText = `${classData.logo} ${classData.name}'s Current Chronicle`;
    const contentEl = document.getElementById('story-history-content');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Loading chronicle...</p>`;
    modals.showAnimatedModal('story-history-modal');

    const historyQuery = query(collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`), orderBy("createdAt", "asc"));
    try {
        const snapshot = await getDocs(historyQuery);
        if (snapshot.empty) {
            contentEl.innerHTML = `<p class="text-center text-gray-500">This story is just beginning!</p>`;
        } else {
            contentEl.innerHTML = snapshot.docs.map((doc, index) => {
                const data = doc.data();
                const sentence = escapeHtml(data.sentence || '');
                const word = escapeHtml(data.word || 'N/A');
                const imgSrc = escapeHtml(data.imageUrl || data.imageBase64 || '');
                return `<div class="story-history-card">
                            <img src="${imgSrc}" alt="Chapter ${index + 1} illustration" loading="lazy" decoding="async" width="150" height="150">
                            <div class="text-content">
                                <p class="text-xs text-gray-500 font-bold">CHAPTER ${index + 1} (Word: <span class="text-cyan-600">${word}</span>)</p>
                                <p class="text-gray-800 mt-2 flex-grow">${sentence}</p>
                            </div>
                        </div>`;
            }).join('');
        }
    } catch (error) {
        console.error("Error fetching story history:", error);
        contentEl.innerHTML = `<p class="text-center text-red-500">Could not load story history.</p>`;
    }
}

export function handleResetStory() {
    const classId = storyWeaverClassId();
    if (!classId) return;
    modals.showModal('Start a New Story?', "This will reset the current story progress. The old story's history will be kept, but you will start from a blank page. Are you sure?", async () => {
        try {
            const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
            await setDoc(storyDocRef, {
                currentSentence: "",
                currentImageBase64: null,
                currentWord: null,
                storyAdditionsCount: 0,
                updatedAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            });
            resetStoryWeaverWordUI();
            showToast("A new chapter begins!", "success");
        } catch (error) {
            console.error("Error resetting story:", error);
            showToast("Failed to start a new story.", "error");
        }
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

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
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
        listEl.innerHTML = `<div class="text-center text-slate-500 py-10">You have no completed storybooks yet. Finish a story to see it here!</div>`;
        return;
    }

    if (visibleStories.length === 0) {
        listEl.innerHTML = selectedClassId
            ? `<div class="text-center text-slate-500 py-10">No storybooks for this class yet.</div>`
            : `<div class="text-center text-slate-500 py-10">No matching storybooks.</div>`;
        return;
    }

    visibleStories.forEach((s) => {
        if (!s?.id) return;
        if (s.coverImageUrl || s.coverImageBase64) return;
        ensureStorybookCover(s.id);
    });

    listEl.innerHTML = visibleStories.map(story => {
        const title = escapeHtml(story.title || 'Untitled Story');
        const classLine = escapeHtml(`${story.classLogo || ''} ${story.className || ''}`.trim() || 'Unknown class');
        const completedDate = story.completedAt?.toDate?.().toLocaleDateString?.() || '';
        const completedText = completedDate ? `Completed ${escapeHtml(completedDate)}` : 'Completed earlier';
        const coverUrl = story.coverImageUrl || story.coverImageBase64 || '';

        const cover = coverUrl
            ? `<img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" decoding="async" class="story-weavers-archive-cover" />`
            : `<div class="story-weavers-archive-cover story-weavers-archive-cover--placeholder" aria-hidden="true">
                    <i class="fas fa-feather-alt text-white/85 text-2xl"></i>
               </div>`;

        return `
            <button type="button"
                class="story-weavers-archive-tile view-storybook-btn"
                data-story-id="${escapeHtml(story.id)}"
                aria-label="Open storybook: ${title}">
                <div class="story-weavers-archive-cover-wrap">
                    ${cover}
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

    document.getElementById('storybook-viewer-title').innerText = story.title;
    document.getElementById('storybook-viewer-subtitle').innerText = `A Story by ${story.classLogo} ${story.className}`;
    const contentEl = document.getElementById('storybook-viewer-content');
    contentEl.innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading chapters...</p>`;
    
    const playBtn = document.getElementById('storybook-viewer-play-btn');
    playBtn.onclick = null;
    playBtn.disabled = true;
    playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;

    document.getElementById('storybook-viewer-print-btn').onclick = null;
    document.getElementById('storybook-viewer-print-btn').disabled = true;
    
    document.getElementById('storybook-viewer-delete-btn').onclick = () => handleDeleteCompletedStory(story.id);
    
    modals.showAnimatedModal('storybook-viewer-modal');

    try {
        const chaptersQuery = query(collection(db, `artifacts/great-class-quest/public/data/completed_stories/${storyId}/chapters`), orderBy("chapterNumber", "asc"));
        const snapshot = await getDocs(chaptersQuery);
        const chapters = snapshot.docs.map(doc => doc.data());

        if (chapters.length === 0) {
            contentEl.innerHTML = `<p class="text-center text-red-500 py-8">This storybook has no chapters!</p>`;
            return;
        }

        story.chapters = chapters;

        contentEl.innerHTML = chapters.map((chapter) => {
            const chapterNumber = Number(chapter.chapterNumber) || 0;
            const imgSrc = escapeHtml(chapter.imageUrl || chapter.imageBase64 || '');
            const sentence = escapeHtml(chapter.sentence || '');
            return `
                <div class="story-history-card">
                    <img src="${imgSrc}" alt="Chapter ${chapterNumber} illustration" loading="lazy" decoding="async" width="150" height="150">
                    <div class="text-content">
                        <p class="text-xs text-gray-500 font-bold">CHAPTER ${chapterNumber}</p>
                        <p class="text-gray-800 mt-2 flex-grow">${sentence}</p>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('storybook-viewer-print-btn').onclick = () => handlePrintStorybook(storyId);
        document.getElementById('storybook-viewer-print-btn').disabled = false;

        if (!isTtsSupported()) {
            playBtn.disabled = true;
            playBtn.innerHTML = `<i class="fas fa-volume-mute mr-2"></i> TTS Unsupported`;
            return;
        }

        playBtn.disabled = false;
        playBtn.onclick = () => {
            const chapterText = (story.chapters || []).map(c => c.sentence || '').filter(Boolean).join(' ');
            if (!chapterText) return;
            if (isSpeaking()) {
                stopSpeech();
                playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
                return;
            }
            speakText(chapterText, {
                rate: 0.95,
                pitch: 1.05,
                voiceHint: 'en',
                onStart: () => {
                    playBtn.innerHTML = `<i class="fas fa-stop-circle mr-2"></i> Stop Narration`;
                },
                onEnd: () => {
                    playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
                },
                onError: () => {
                    playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
                    showToast('Narration failed on this device/browser.', 'error');
                }
            });
        };

    } catch (error) {
        console.error("Error loading story chapters:", error);
        contentEl.innerHTML = `<p class="text-center text-red-500 py-8">Could not load the chapters for this storybook.</p>`;
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

        const { jsPDF } = window.jspdf;
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
