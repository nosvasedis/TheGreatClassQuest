// /features/storyWeaver.js

// --- IMPORTS ---
import { db } from '../firebase.js';
import { doc, getDocs, collection, query, orderBy, setDoc, updateDoc, writeBatch, serverTimestamp, increment, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi, callElevenLabsTtsApi } from '../api.js';
import { simpleHashCode, compressImageBase64, getAgeGroupForLeague } from '../utils.js';
import * as constants from '../constants.js';
import { awardStoryWeaverBonusStarToClass, handleDeleteCompletedStory } from '../db/actions.js';

// --- MAIN UI & STATE MANAGEMENT ---

export function handleStoryWeaversClassSelect() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const mainContent = document.getElementById('story-weavers-main-content');
    const placeholder = document.getElementById('story-weavers-placeholder');
    const ideaForgeGrid = document.querySelector('#reward-ideas-tab .grid');
    
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
        if (ideaForgeGrid) ideaForgeGrid.classList.add('story-weavers-active');
        
        const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        unsubscribeStoryData.current = onSnapshot(storyDocRef, (doc) => {
            const currentStoryData = state.get('currentStoryData');
            currentStoryData[classId] = doc.exists() ? doc.data() : null;
            renderStoryWeaversUI(classId);
        }, (error) => console.error("Error listening to story data:", error));
    } else {
        mainContent.classList.add('hidden');
        placeholder.classList.remove('hidden');
        if (ideaForgeGrid) ideaForgeGrid.classList.remove('story-weavers-active');
    }
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
    const classId = document.getElementById('story-weavers-class-select').value;
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
    playSound('magic_chime');
    const classId = document.getElementById('story-weavers-class-select').value;
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
    const classId = document.getElementById('story-weavers-class-select').value;
    if (!classId) return;
    
    const story = state.get('currentStoryData')[classId];
    const isNewStory = !story || !story.currentSentence;
    
    document.getElementById('story-input-textarea').value = '';
    modals.showAnimatedModal('story-input-modal');
}

export async function handleLockInSentence() {
    const classId = document.getElementById('story-weavers-class-select').value;
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
    const classId = document.getElementById('story-weavers-class-select').value;
    const storyText = state.get('currentStoryData')[classId]?.currentSentence || "Select a class to see the story.";
    document.getElementById('story-reveal-text').textContent = storyText;
    modals.showAnimatedModal('story-reveal-modal');
}

export async function handleShowStoryHistory() {
    const classId = document.getElementById('story-weavers-class-select').value;
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
                return `<div class="story-history-card">
                            <img src="${data.imageUrl || data.imageBase64}" alt="Chapter ${index + 1} illustration">
                            <div class="text-content">
                                <p class="text-xs text-gray-500 font-bold">CHAPTER ${index + 1} (Word: <span class="text-cyan-600">${data.word || 'N/A'}</span>)</p>
                                <p class="text-gray-800 mt-2 flex-grow">${data.sentence}</p>
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
    const classId = document.getElementById('story-weavers-class-select').value;
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

export function openStoryArchiveModal() {
    renderStoryArchive();
    modals.showAnimatedModal('story-archive-modal');
}

export function renderStoryArchive() {
    const listEl = document.getElementById('story-archive-list');
    const allCompletedStories = state.get('allCompletedStories');
    if (allCompletedStories.length === 0) {
        listEl.innerHTML = `<p class="text-center text-gray-500 py-8">You have no completed storybooks yet. Finish a story to see it here!</p>`;
        return;
    }
    listEl.innerHTML = allCompletedStories.map(story => `
        <div class="completed-storybook-item border-indigo-300">
            <div>
                <h3 class="font-bold text-lg text-indigo-800">${story.title}</h3>
                <p class="text-sm text-gray-600">A story by <span class="font-semibold">${story.classLogo} ${story.className}</span></p>
                <p class="text-xs text-gray-400">Completed on ${story.completedAt?.toDate().toLocaleDateString() || 'a while ago'}</p>
            </div>
            <div class="flex gap-2">
                <button class="view-storybook-btn bg-indigo-100 text-indigo-700 w-10 h-10 rounded-full bubbly-button" data-story-id="${story.id}"><i class="fas fa-book-open"></i></button>
            </div>
        </div>
    `).join('');
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

        contentEl.innerHTML = chapters.map((chapter) => `
            <div class="story-history-card">
                <img src="${chapter.imageUrl || chapter.imageBase64}" alt="Chapter ${chapter.chapterNumber} illustration">
                <div class="text-content">
                    <p class="text-xs text-gray-500 font-bold">CHAPTER ${chapter.chapterNumber}</p>
                    <p class="text-gray-800 mt-2 flex-grow">${chapter.sentence}</p>
                </div>
            </div>`).join('');
        
        playBtn.onclick = () => playStorybookNarration(storyId);
        playBtn.disabled = false;
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;

        document.getElementById('storybook-viewer-print-btn').onclick = () => handlePrintStorybook(storyId);
        document.getElementById('storybook-viewer-print-btn').disabled = false;

    } catch (error) {
        console.error("Error loading story chapters:", error);
        contentEl.innerHTML = `<p class="text-center text-red-500 py-8">Could not load the chapters for this storybook.</p>`;
    }
}

async function playStorybookNarration(storyId) {
    const story = state.get('allCompletedStories').find(s => s.id === storyId);
    if (!story || !story.chapters) return;

    const playBtn = document.getElementById('storybook-viewer-play-btn');
    const fullStoryText = story.chapters.map(c => c.sentence).join(' ');
    let currentStorybookAudio = state.get('currentStorybookAudio');

    if (currentStorybookAudio && !currentStorybookAudio.paused) {
        currentStorybookAudio.pause();
        state.set('currentStorybookAudio', null);
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
        return;
    }

    playBtn.disabled = true;
    playBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-3"></i> Generating Audio...`;

    try {
        const audioBlob = await callElevenLabsTtsApi(fullStoryText);
        const audioUrl = URL.createObjectURL(audioBlob);
        currentStorybookAudio = new Audio(audioUrl);
        state.set('currentStorybookAudio', currentStorybookAudio);
        
        currentStorybookAudio.onplay = () => {
            playBtn.innerHTML = `<i class="fas fa-pause-circle mr-3"></i> Pause Narration`;
            playBtn.disabled = false;
        };
        currentStorybookAudio.onended = () => {
            playBtn.innerHTML = `<i class="fas fa-redo-alt mr-3"></i> Narrate Again`;
            state.set('currentStorybookAudio', null);
        };
        currentStorybookAudio.play();
    } catch (error) {
        showToast('Could not generate or play audio.', 'error');
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
        playBtn.disabled = false;
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
    btn.disabled = true;btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Assembling...`;

    try {
        const theme = constants.storybookThemes[simpleHashCode(story.title) % constants.storybookThemes.length];
        const storyPages = story.chapters.map(chapter => `
            <div style="width: 800px; height: 600px; display: flex; flex-direction: column; padding: 40px; background-color: ${theme.bg}; border: 10px solid ${theme.border}; box-sizing: border-box; page-break-after: always;">
                <div style="width: 100%; height: 350px; border-radius: 10px; border: 3px solid ${theme.border}; background-color: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${chapter.imageBase64}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <p style="text-align: center; font-family: ${theme.bodyFont}; font-size: 22px; color: ${theme.textColor}; margin-top: 20px; flex-grow: 1; font-weight: ${theme.fontWeight || 'normal'};">${chapter.sentence}</p>
                <p style="text-align: right; font-size: 14px; color: ${theme.textColor}; opacity: 0.7;">- Page ${chapter.chapterNumber} -</p>
            </div>`);

        const titlePage = `
            <div style="width: 800px; height: 600px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; background-color: ${theme.bg}; border: 10px solid ${theme.border}; box-sizing: border-box; page-break-after: always;">
                <h1 style="font-family: ${theme.titleFont}; font-size: 50px; color: ${theme.titleColor}; text-align: center;">${story.title}</h1>
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
        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { scale: 2 });
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
