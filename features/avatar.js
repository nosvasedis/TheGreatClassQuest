// /features/avatar.js

// --- IMPORTS ---
import { db, doc, updateDoc } from '../firebase.js';

import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../api.js';
import { compressAvatarImageBase64 } from '../utils.js';
import { AVATAR_IMAGE_CACHE_CONTROL, studentAvatarStoragePath } from '../constants.js';
import { requireEliteAI } from '../utils/upgradePrompt.js';

import {
    FORGE_CREATURES, FORGE_COLORS, FORGE_ACCESSORIES, FORGE_MOODS, FORGE_STYLES,
    FORGE_BACKDROPS, FORGE_FRAMINGS, FORGE_DEFAULTS, FORGE_SPECIAL_MAX, FORGE_NEGATIVE_PROMPT,
    FORGE_IMAGE_OPTIONS, normalizeForgeRecipe, isLegacyForgeRecipe, buildForgeWriterMessages,
    cleanWriterSubject, composeForgeImagePrompt, cleanSpecialTouch
} from '../functions/avatarForgeRecipe.mjs';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

// --- LOCAL STATE ---
const REQUIRED_POOLS = ['creature', 'color', 'accessory'];
const OPTIONAL_POOLS = ['style', 'mood', 'backdrop', 'framing'];
const FORGE_POOLS = {
    creature: FORGE_CREATURES,
    color: FORGE_COLORS,
    accessory: FORGE_ACCESSORIES,
    style: FORGE_STYLES,
    mood: FORGE_MOODS,
    backdrop: FORGE_BACKDROPS,
    framing: FORGE_FRAMINGS
};
// The callable version that understands mood, style, backdrop, framing and the special touch.
const SERVER_FORGE_VERSION = 2;
const MAX_GALLERY = 6;
const LOADER_LINES = ['Heating the metal…', 'Folding in the colour…', 'Hammering out the details…', 'Quenching the portrait…'];

let avatarMakerData = freshForgeState(null);
let loaderTimer = null;

function freshForgeState(studentId) {
    return {
        studentId,
        creature: null,
        color: null,
        accessory: null,
        ...FORGE_DEFAULTS,
        generatedImage: null,
        gallery: []
    };
}

function escapeAttr(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function optionButton(option, pool) {
    const label = option.label || option.value;
    if (pool === 'color') {
        const bg = option.hex ?? 'conic-gradient(#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#a855f7,#ef4444)';
        return `<button type="button" class="avatar-maker-option-btn avatar-color-btn" data-value="${escapeAttr(option.value)}" aria-pressed="false">
            <span class="avatar-color-swatch" style="background:${bg};"></span>${escapeAttr(label)}
        </button>`;
    }
    return `<button type="button" class="avatar-maker-option-btn" data-value="${escapeAttr(option.value)}" aria-pressed="false">
        <span class="avatar-maker-option-btn__icon" aria-hidden="true">${option.icon || ''}</span><span>${escapeAttr(label)}</span>
    </button>`;
}

function markSelected(pool, value) {
    const container = document.getElementById(`avatar-${pool}-pool`);
    if (!container) return;
    container.querySelectorAll('.avatar-maker-option-btn').forEach((btn) => {
        const on = btn.dataset.value === value;
        btn.classList.toggle('selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    revealInPool(container);
}

/** Scrolls a long list (only that list, never the bench) so its chosen token shows. */
function revealInPool(container) {
    const chosen = container.querySelector('.selected');
    if (!chosen || container.scrollHeight <= container.clientHeight) return;
    const top = chosen.offsetTop; // the list is positioned, so this is inside it
    const pad = 8;
    if (top < container.scrollTop + pad) {
        container.scrollTo({ top: Math.max(0, top - pad), behavior: 'smooth' });
    } else if (top + chosen.offsetHeight > container.scrollTop + container.clientHeight - pad) {
        container.scrollTo({ top: top + chosen.offsetHeight - container.clientHeight + pad, behavior: 'smooth' });
    }
}

function labelFor(pool, value) {
    const option = FORGE_POOLS[pool].find((o) => o.value === value);
    return option ? (option.label || option.value) : '';
}

function recipeReady() {
    return REQUIRED_POOLS.every((pool) => avatarMakerData[pool]);
}

function refreshForgeHeat() {
    REQUIRED_POOLS.forEach((pool) => {
        const done = Boolean(avatarMakerData[pool]);
        document.getElementById(`step-${pool}-check`)?.classList.toggle('is-done', done);
        document.getElementById(`step-${pool}-dot`)?.classList.toggle('is-hot', done);
    });
    const ready = recipeReady();
    document.querySelector('#avatar-maker-modal .af-card')?.classList.toggle('is-ready', ready);
    const generateBtn = document.getElementById('avatar-generate-btn');
    if (generateBtn && !generateBtn.dataset.busy) generateBtn.disabled = !ready;

    const summary = document.getElementById('avatar-recipe-summary');
    if (summary) {
        const parts = [
            avatarMakerData.color && avatarMakerData.creature
                ? `A ${avatarMakerData.color.toLowerCase()} ${avatarMakerData.creature.toLowerCase()}`
                : (avatarMakerData.creature ? `A ${avatarMakerData.creature.toLowerCase()}` : ''),
            avatarMakerData.accessory && avatarMakerData.accessory !== 'None' ? `with ${avatarMakerData.accessory.toLowerCase()}` : '',
            avatarMakerData.creature ? `· ${labelFor('style', avatarMakerData.style)}` : ''
        ].filter(Boolean);
        summary.textContent = parts.join(' ');
    }
}

function renderGallery() {
    const wrap = document.getElementById('avatar-forge-gallery-wrap');
    const row = document.getElementById('avatar-forge-gallery');
    if (!wrap || !row) return;
    const { gallery, generatedImage } = avatarMakerData;
    wrap.classList.toggle('hidden', gallery.length < 2);
    row.innerHTML = gallery.map((src, index) => `
        <button type="button" class="af-gallery__thumb${src === generatedImage ? ' is-current' : ''}" data-index="${index}" aria-label="Use strike ${index + 1}">
            <img src="${escapeAttr(src)}" alt="">
        </button>`).join('');
}

function showPortrait(src, { fresh = false } = {}) {
    const imgEl = document.getElementById('avatar-maker-img');
    imgEl.src = src;
    imgEl.classList.remove('hidden');
    imgEl.classList.remove('is-fresh');
    if (fresh) {
        void imgEl.offsetWidth;
        imgEl.classList.add('is-fresh');
    }
    document.getElementById('avatar-maker-placeholder').classList.add('hidden');
}

function setHasResult(on) {
    document.getElementById('avatar-post-generation-btns').classList.toggle('hidden', !on);
    document.querySelector('#avatar-maker-modal .af-card')?.classList.toggle('has-result', on);
}

function setForging(on) {
    const card = document.querySelector('#avatar-maker-modal .af-card');
    card?.classList.toggle('is-forging', on);
    const text = document.getElementById('avatar-maker-loader-text');
    clearInterval(loaderTimer);
    loaderTimer = null;
    if (on && text) {
        let line = 0;
        text.textContent = LOADER_LINES[0];
        loaderTimer = setInterval(() => {
            line = (line + 1) % LOADER_LINES.length;
            text.textContent = LOADER_LINES[line];
        }, 2600);
    }
}

// --- MODAL & UI FUNCTIONS ---

export function openAvatarMaker(studentId) {
    if (!requireEliteAI({ feature: 'Avatar Forge' })) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    avatarMakerData = freshForgeState(studentId);

    document.getElementById('avatar-maker-student-name').textContent = `Forging a portrait for ${student.name}`;

    const deleteBtn = document.getElementById('avatar-delete-btn');
    if (student.avatar) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    Object.entries(FORGE_POOLS).forEach(([pool, options]) => {
        const container = document.getElementById(`avatar-${pool}-pool`);
        if (container) container.innerHTML = options.map((option) => optionButton(option, pool)).join('');
    });
    OPTIONAL_POOLS.forEach((pool) => markSelected(pool, avatarMakerData[pool]));

    const specialInput = document.getElementById('avatar-special-input');
    if (specialInput) {
        specialInput.value = '';
        specialInput.maxLength = FORGE_SPECIAL_MAX;
        handleAvatarSpecialInput();
    }

    const placeholder = document.getElementById('avatar-maker-placeholder');
    const loader = document.getElementById('avatar-maker-loader');
    const imgEl = document.getElementById('avatar-maker-img');

    loader.classList.add('hidden');
    setForging(false);
    if (student.avatar) {
        imgEl.src = student.avatar;
        imgEl.classList.remove('hidden', 'is-fresh');
        placeholder.classList.add('hidden');
    } else {
        imgEl.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    const generateBtn = document.getElementById('avatar-generate-btn');
    delete generateBtn.dataset.busy;
    generateBtn.disabled = true;
    ['avatar-retry-btn', 'avatar-surprise-btn', 'avatar-save-btn'].forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });
    setHasResult(false);
    document.getElementById('avatar-maker-options-wrapper').scrollTop = 0;
    renderGallery();
    refreshForgeHeat();

    createForgeParticles();
    modals.showAnimatedModal('avatar-maker-modal');
}

function createForgeParticles() {
    const container = document.getElementById('forge-particles-container');
    if (!container) return;
    container.innerHTML = '';
    const count = 26;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'af-ember';
        p.style.left = `${Math.random() * 100}%`;
        p.style.setProperty('--af-size', `${(Math.random() * 4 + 2).toFixed(1)}px`);
        p.style.setProperty('--af-dur', `${(Math.random() * 8 + 7).toFixed(1)}s`);
        p.style.setProperty('--af-delay', `${(-Math.random() * 14).toFixed(1)}s`);
        p.style.setProperty('--af-drift', `${Math.round(Math.random() * 80 - 40)}px`);
        container.appendChild(p);
    }
}

export function handleAvatarOptionSelect(event, pool) {
    const btn = event.target.closest('.avatar-maker-option-btn');
    if (!btn || !FORGE_POOLS[pool]) return;
    playSound('click');

    const wasReady = recipeReady();
    avatarMakerData[pool] = btn.dataset.value;
    markSelected(pool, btn.dataset.value);
    refreshForgeHeat();

    if (!wasReady && recipeReady()) playSound('magic_chime_short');
}

export function handleAvatarSpecialInput() {
    const input = document.getElementById('avatar-special-input');
    const count = document.getElementById('avatar-special-count');
    if (!input) return;
    avatarMakerData.special = input.value;
    if (count) count.textContent = `${input.value.length}/${FORGE_SPECIAL_MAX}`;
}

/** Fills every step with a random choice, so a teacher can forge in one tap. */
export function handleAvatarSurprise() {
    playSound('click');
    const pick = (list) => list[Math.floor(Math.random() * list.length)].value;
    avatarMakerData.creature = pick(FORGE_CREATURES);
    avatarMakerData.color = pick(FORGE_COLORS);
    avatarMakerData.accessory = pick(FORGE_ACCESSORIES.filter((o) => o.value !== 'None'));
    avatarMakerData.mood = pick(FORGE_MOODS);
    avatarMakerData.style = pick(FORGE_STYLES);
    avatarMakerData.backdrop = pick(FORGE_BACKDROPS);
    Object.keys(FORGE_POOLS).forEach((pool) => markSelected(pool, avatarMakerData[pool]));
    refreshForgeHeat();
    document.querySelector('#avatar-creature-pool .selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    playSound('magic_chime_short');
}

export function handleAvatarGalleryPick(event) {
    const thumb = event.target.closest('.af-gallery__thumb');
    if (!thumb) return;
    const src = avatarMakerData.gallery[Number(thumb.dataset.index)];
    if (!src) return;
    playSound('click');
    avatarMakerData.generatedImage = src;
    showPortrait(src);
    renderGallery();
}


function avatarCallableMissing(error) {
    const code = String(error?.code || '');
    return code === 'functions/not-found' || code === 'functions/unimplemented';
}

/**
 * School networks often block workers.dev and then report that as a CORS error.
 * The callable paints the portrait on the server, so the browser never calls that host.
 * Resolves to null when the deployed callable predates this recipe, so the caller can
 * paint it in the browser instead.
 */
async function forgeAvatarOnServer(studentId, recipe) {
    const { functions, httpsCallable } = await import('../firebase.js');
    const forge = httpsCallable(functions, 'forgeStudentAvatar', { timeout: 180000 });
    let result;
    try {
        result = await forge({ studentId, ...recipe });
    } catch (error) {
        // An older deployment rejects the new creatures, colours and relics by name.
        if (String(error?.code || '') === 'functions/invalid-argument' && !isLegacyForgeRecipe(recipe)) return null;
        throw error;
    }
    const imageDataUrl = result?.data?.imageDataUrl;
    if (!imageDataUrl) throw new Error('Avatar forge returned no portrait.');
    if (Number(result?.data?.forgeVersion || 1) < SERVER_FORGE_VERSION && !isLegacyForgeRecipe(recipe)) return null;
    return imageDataUrl;
}

async function forgeAvatarInBrowser(recipe) {
    const { system, user } = buildForgeWriterMessages(recipe);
    let subject = '';
    try {
        subject = cleanWriterSubject(await callGeminiApi(system, user));
    } catch (error) {
        console.warn('Avatar prompt writer unavailable; using the catalogue description.', error);
    }
    return callCloudflareAiImageApi(composeForgeImagePrompt(recipe, subject), FORGE_NEGATIVE_PROMPT, { ...FORGE_IMAGE_OPTIONS });
}

async function saveAvatarOnServer(studentId, imageDataUrl) {
    const { functions, httpsCallable } = await import('../firebase.js');
    const save = httpsCallable(functions, 'saveStudentAvatar', { timeout: 60000 });
    const result = await save({ studentId, imageDataUrl });
    const avatar = result?.data?.avatar;
    if (!avatar) throw new Error('Avatar save returned no portrait URL.');
    return avatar;
}

// --- CORE ACTIONS ---

export async function handleGenerateAvatar() {
    if (!requireEliteAI({ feature: 'Avatar image generator' })) return;
    if (!recipeReady()) {
        showToast('Choose a creature, a colour and a relic first.', 'error');
        return;
    }
    playSound('magic_chime');

    let recipe;
    try {
        recipe = normalizeForgeRecipe({ ...avatarMakerData, special: cleanSpecialTouch(avatarMakerData.special) });
    } catch (error) {
        showToast(error.message, 'error');
        return;
    }

    const generateBtn = document.getElementById('avatar-generate-btn');
    const retryBtn = document.getElementById('avatar-retry-btn');
    const surpriseBtn = document.getElementById('avatar-surprise-btn');
    const saveBtn = document.getElementById('avatar-save-btn');
    const loader = document.getElementById('avatar-maker-loader');
    const placeholder = document.getElementById('avatar-maker-placeholder');
    const imgEl = document.getElementById('avatar-maker-img');

    generateBtn.dataset.busy = '1';
    generateBtn.disabled = true;
    if (retryBtn) retryBtn.disabled = true;
    if (surpriseBtn) surpriseBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    placeholder.classList.add('hidden');
    imgEl.classList.add('hidden');
    loader.classList.remove('hidden');
    setForging(true);
    if (window.matchMedia?.('(max-width: 860px)').matches) {
        document.getElementById('avatar-display-area')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // Closing and reopening the forge mid-strike starts a new session; a late
    // portrait from the old one must not land in it.
    const session = avatarMakerData;
    const stillOpen = () => avatarMakerData === session;

    try {
        let imageBase64 = null;
        try {
            imageBase64 = await forgeAvatarOnServer(session.studentId, recipe);
        } catch (serverError) {
            if (!avatarCallableMissing(serverError)) throw serverError;
            console.warn('Avatar forge callable is not deployed; using the browser AI proxy.', serverError?.code || serverError);
        }
        if (!imageBase64) imageBase64 = await forgeAvatarInBrowser(recipe);
        if (!stillOpen()) return;

        avatarMakerData.generatedImage = imageBase64;
        avatarMakerData.gallery = [imageBase64, ...avatarMakerData.gallery].slice(0, MAX_GALLERY);
        showPortrait(imageBase64, { fresh: true });
        setHasResult(true);
        renderGallery();
        playSound('magic_chime_short');
    } catch (error) {
        console.error("Avatar Generation Error:", error);
        if (!stillOpen()) return;
        showToast("The Avatar Forge had a hiccup. Please try again.", "error");
        if (avatarMakerData.generatedImage) {
            showPortrait(avatarMakerData.generatedImage);
        } else {
            placeholder.classList.remove('hidden');
        }
    } finally {
        if (stillOpen()) {
            loader.classList.add('hidden');
            setForging(false);
            delete generateBtn.dataset.busy;
            generateBtn.disabled = !recipeReady();
            if (retryBtn) retryBtn.disabled = false;
            if (surpriseBtn) surpriseBtn.disabled = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    }
}

async function refreshVisibleStudentPortraits() {
    const tabs = await import('../ui/tabs.js');
    const activeRenderers = [
        ['award-stars-tab', () => tabs.renderAwardStarsStudentList?.(state.get('globalSelectedClassId'), false)],
        ['manage-students-tab', () => tabs.renderManageStudentsTab?.()],
        ['student-leaderboard-tab', () => tabs.renderStudentLeaderboardTab?.()],
        ['class-leaderboard-tab', () => tabs.renderClassLeaderboardTab?.()]
    ];

    activeRenderers.forEach(([tabId, render]) => {
        const tab = document.getElementById(tabId);
        if (tab && !tab.classList.contains('hidden')) render();
    });

    const { renderHomeTab } = await import('./home.js');
    renderHomeTab();
}

export async function handleSaveAvatar() {
    const { studentId, generatedImage } = avatarMakerData;
    if (!studentId || !generatedImage) return;

    const saveBtn = document.getElementById('avatar-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Cooling and saving…</span>`;

    try {
        const compressedAvatar = await compressAvatarImageBase64(generatedImage);

        let imageUrl = '';
        try {
            imageUrl = await saveAvatarOnServer(studentId, compressedAvatar);
        } catch (serverError) {
            if (!avatarCallableMissing(serverError)) throw serverError;
            console.warn('Avatar save callable is not deployed; uploading from the browser.', serverError?.code || serverError);
            const { uploadImageToStorage } = await import('../utils.js');
            imageUrl = await uploadImageToStorage(compressedAvatar, studentAvatarStoragePath(studentId), { cacheControl: AVATAR_IMAGE_CACHE_CONTROL });
            const studentRef = doc(db, `${PUBLIC_DATA_PATH}/students`, studentId);
            await updateDoc(studentRef, { avatar: imageUrl });
        }

        const nextStudents = (state.get('allStudents') || []).map((student) => (
            student.id === studentId ? { ...student, avatar: imageUrl } : student
        ));
        state.setAllStudents(nextStudents);
        await refreshVisibleStudentPortraits();

        showToast("Avatar saved successfully!", "success");
        modals.hideModal('avatar-maker-modal');
    } catch (error) {
        console.error("Error saving avatar:", error);
        showToast("Could not save the avatar. Please try again.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fas fa-save" aria-hidden="true"></i><span>Keep this portrait</span>`;
    }
}

export async function handleDeleteAvatar() {
    const { studentId } = avatarMakerData;
    if (!studentId) return;

    modals.showModal(
        'Remove Avatar?',
        'Are you sure you want to remove this student\'s avatar? This will revert them to the default initial.',
        async () => {
            const deleteBtn = document.getElementById('avatar-delete-btn');
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Melting…</span>`;

            try {
                const studentRef = doc(db, `${PUBLIC_DATA_PATH}/students`, studentId);
                await updateDoc(studentRef, {
                    avatar: null 
                });
                const nextStudents = (state.get('allStudents') || []).map((student) => (
                    student.id === studentId ? { ...student, avatar: null } : student
                ));
                state.setAllStudents(nextStudents);
                await refreshVisibleStudentPortraits();
                
                showToast("Avatar removed successfully!", "success");
                modals.hideModal('avatar-maker-modal');
            } catch (error) {
                console.error("Error removing avatar:", error);
                showToast("Could not remove the avatar. Please try again.", "error");
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = `<i class="fas fa-trash-alt" aria-hidden="true"></i><span>Melt the current portrait</span>`;
            }
        },
        'Yes, Remove It',
        'Cancel'
    );
}
