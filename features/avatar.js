// /features/avatar.js

// --- IMPORTS ---
import { db, doc, updateDoc } from '../firebase.js';

import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../api.js';
import { compressAvatarImageBase64 } from '../utils.js';
import { requireEliteAI } from '../utils/upgradePrompt.js';

// --- LOCAL STATE ---
let avatarMakerData = {
    studentId: null,
    creature: null,
    color: null,
    accessory: null,
    generatedImage: null
};

// --- MODAL & UI FUNCTIONS ---

export function openAvatarMaker(studentId) {
    if (!requireEliteAI({ feature: 'Avatar Forge' })) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    avatarMakerData = { studentId, creature: null, color: null, accessory: null, generatedImage: null };
    
    document.getElementById('avatar-maker-student-name').textContent = `for ${student.name}`;

    const deleteBtn = document.getElementById('avatar-delete-btn');
    if (student.avatar) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
    
    const creatures = [
        { value: 'Fairy', icon: '🧚' },     { value: 'Wizard', icon: '🧙' },
        { value: 'Witch', icon: '🧙‍♀️' },   { value: 'Elf', icon: '🧝' },
        { value: 'Dwarf', icon: '⛏️' },      { value: 'Goblin', icon: '👺' },
        { value: 'Knight', icon: '🗡️' },    { value: 'Dragon', icon: '🐉' },
        { value: 'Unicorn', icon: '🦄' },    { value: 'Robot', icon: '🤖' },
        { value: 'Alien', icon: '👽' },      { value: 'Mermaid', icon: '🧜' },
        { value: 'Gnome', icon: '🍄' },      { value: 'Prince', icon: '🤴' },
        { value: 'Princess', icon: '👸' },   { value: 'Pirate', icon: '🏴‍☠️' },
        { value: 'Superhero', icon: '🦸' },
    ];
    const colors = [
        { value: 'Red', hex: '#ef4444' },       { value: 'Blue', hex: '#3b82f6' },
        { value: 'Green', hex: '#22c55e' },      { value: 'Yellow', hex: '#eab308' },
        { value: 'Purple', hex: '#a855f7' },     { value: 'Orange', hex: '#f97316' },
        { value: 'Pink', hex: '#ec4899' },       { value: 'Turquoise', hex: '#14b8a6' },
        { value: 'Black', hex: '#374151' },      { value: 'White', hex: '#e5e7eb' },
        { value: 'Grey', hex: '#9ca3af' },       { value: 'Rainbow', hex: null },
    ];
    const accessories = [
        { value: 'None', icon: '✨' },           { value: 'Magic Wand', icon: '🪄' },
        { value: 'Big Glasses', icon: '👓' },    { value: 'Flower Crown', icon: '🌸' },
        { value: 'Pointy Hat', icon: '🎩' },     { value: 'Shiny Sword', icon: '⚔️' },
        { value: 'Glowing Book', icon: '📚' },   { value: 'Headphones', icon: '🎧' },
        { value: 'Small Backpack', icon: '🎒' },
    ];

    document.getElementById('avatar-creature-pool').innerHTML = creatures.map(c =>
        `<button class="avatar-maker-option-btn" data-value="${c.value}">${c.icon} ${c.value}</button>`
    ).join('');

    document.getElementById('avatar-color-pool').innerHTML = colors.map(c => {
        const bg = c.hex ?? 'linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#a855f7)';
        return `<button class="avatar-maker-option-btn avatar-color-btn" data-value="${c.value}">
            <span class="avatar-color-swatch" style="background:${bg};"></span>${c.value}
        </button>`;
    }).join('');

    document.getElementById('avatar-accessory-pool').innerHTML = accessories.map(a =>
        `<button class="avatar-maker-option-btn" data-value="${a.value}">${a.icon} ${a.value}</button>`
    ).join('');

    // Reset step checkmarks and dots
    ['creature', 'color', 'accessory'].forEach(p => {
        const check = document.getElementById(`step-${p}-check`);
        if (check) check.style.opacity = '0';
        
        const dot = document.getElementById(`step-${p}-dot`);
        if (dot) dot.classList.replace('bg-purple-500', 'bg-white/10');
    });

    const placeholder = document.getElementById('avatar-maker-placeholder');
    const loader = document.getElementById('avatar-maker-loader');
    const imgEl = document.getElementById('avatar-maker-img');
    
    loader.classList.add('hidden');
    if (student.avatar) {
        imgEl.src = student.avatar;
        imgEl.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        imgEl.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    document.getElementById('avatar-generate-btn').disabled = true;
    document.getElementById('avatar-post-generation-btns').classList.add('hidden');

    createForgeParticles();
    modals.showAnimatedModal('avatar-maker-modal');
}

function createForgeParticles() {
    const container = document.getElementById('forge-particles-container');
    if (!container) return;
    container.innerHTML = '';
    const count = 20;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        const size = Math.random() * 4 + 2;
        p.className = 'absolute bg-orange-500/40 rounded-full blur-[1px]';
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.top = `${Math.random() * 100}%`;
        p.style.opacity = Math.random();
        
        const duration = Math.random() * 10 + 5;
        const delay = Math.random() * 5;
        p.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
        
        container.appendChild(p);
    }
}

export function handleAvatarOptionSelect(event, pool) {
    const btn = event.target.closest('.avatar-maker-option-btn');
    if (!btn) return;
    playSound('click');

    const poolContainer = document.getElementById(`avatar-${pool}-pool`);
    poolContainer.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    avatarMakerData[pool] = btn.dataset.value;

    // Light up the step checkmark and dot
    const check = document.getElementById(`step-${pool}-check`);
    if (check) check.style.opacity = '1';
    
    const dot = document.getElementById(`step-${pool}-dot`);
    if (dot) {
        dot.classList.remove('bg-white/10');
        dot.classList.add('bg-purple-500', 'shadow-[0_0_10px_#a855f7]');
    }

    if (avatarMakerData.creature && avatarMakerData.color && avatarMakerData.accessory) {
        document.getElementById('avatar-generate-btn').disabled = false;
        playSound('magic_chime_short');
    }
}


function avatarCallableMissing(error) {
    const code = String(error?.code || '');
    return code === 'functions/not-found' || code === 'functions/unimplemented';
}

/**
 * School networks often block workers.dev and then report that as a CORS error.
 * The callable paints the portrait on the server, so the browser never calls that host.
 */
async function forgeAvatarOnServer(studentId, creature, color, accessory) {
    const { functions, httpsCallable } = await import('../firebase.js');
    const forge = httpsCallable(functions, 'forgeStudentAvatar', { timeout: 180000 });
    const result = await forge({ studentId, creature, color, accessory });
    const imageDataUrl = result?.data?.imageDataUrl;
    if (!imageDataUrl) throw new Error('Avatar forge returned no portrait.');
    return imageDataUrl;
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
    playSound('magic_chime');
    const { creature, color, accessory } = avatarMakerData;
    if (!creature || !color || !accessory) {
        showToast('Please select an option from each category.', 'error');
        return;
    }

    const generateBtn = document.getElementById('avatar-generate-btn');
    const postGenBtns = document.getElementById('avatar-post-generation-btns');
    const loader = document.getElementById('avatar-maker-loader');
    const placeholder = document.getElementById('avatar-maker-placeholder');
    const imgEl = document.getElementById('avatar-maker-img');

    generateBtn.disabled = true;
    postGenBtns.classList.add('hidden');
    placeholder.classList.add('hidden');
    imgEl.classList.add('hidden');
    loader.classList.remove('hidden');

    const systemPrompt = "You are an AI art prompt engineer specializing in creating cute, child-friendly avatars. The style MUST be: 'chibi character, cute, simple, flat 2D vector style, thick outlines, solid colors, centered, on a white background'. Your task is to combine a creature, a main color, and an accessory into a concise, effective prompt. The prompt MUST be a single sentence.";
    const accessoryText = accessory === 'None' ? 'with no accessory' : `holding a ${accessory}`;
    const userPrompt = `Generate a prompt for a cute chibi ${creature} with a main color scheme of ${color}, ${accessoryText}.`;

    try {
        let imageBase64 = '';
        try {
            imageBase64 = await forgeAvatarOnServer(avatarMakerData.studentId, creature, color, accessory);
        } catch (serverError) {
            if (!avatarCallableMissing(serverError)) throw serverError;
            console.warn('Avatar forge callable is not deployed; using the browser AI proxy.', serverError?.code || serverError);
            const finalPrompt = await callGeminiApi(systemPrompt, userPrompt);
            imageBase64 = await callCloudflareAiImageApi(finalPrompt);
        }

        avatarMakerData.generatedImage = imageBase64;
        imgEl.src = imageBase64;

        imgEl.classList.remove('hidden');
        postGenBtns.classList.remove('hidden');
    } catch (error) {
        console.error("Avatar Generation Error:", error);
        showToast("The Avatar Forge had a hiccup. Please try again.", "error");
        placeholder.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
        generateBtn.disabled = false;
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
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        const compressedAvatar = await compressAvatarImageBase64(generatedImage);

        let imageUrl = '';
        try {
            imageUrl = await saveAvatarOnServer(studentId, compressedAvatar);
        } catch (serverError) {
            if (!avatarCallableMissing(serverError)) throw serverError;
            console.warn('Avatar save callable is not deployed; uploading from the browser.', serverError?.code || serverError);
            const { uploadImageToStorage } = await import('../utils.js');
            imageUrl = await uploadImageToStorage(compressedAvatar, `avatars/${studentId}/avatar.webp`);
            const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
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
        saveBtn.innerHTML = `<i class="fas fa-save mr-2"></i> Save Avatar`;
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
            deleteBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Removing...`;

            try {
                const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
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
                deleteBtn.innerHTML = `<i class="fas fa-trash-alt mr-2"></i> Remove Avatar`;
            }
        },
        'Yes, Remove It',
        'Cancel'
    );
}
