// /features/avatar.js

// --- IMPORTS ---
import { db } from '../firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../api.js';
import { compressAvatarImageBase64 } from '../utils.js';

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

    // Reset step checkmarks
    ['creature', 'color', 'accessory'].forEach(p => {
        document.getElementById(`step-${p}-check`)?.classList.add('hidden');
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

    modals.showAnimatedModal('avatar-maker-modal');
}

export function handleAvatarOptionSelect(event, pool) {
    const btn = event.target.closest('.avatar-maker-option-btn');
    if (!btn) return;
    playSound('click');

    const poolContainer = document.getElementById(`avatar-${pool}-pool`);
    poolContainer.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    avatarMakerData[pool] = btn.dataset.value;

    // Light up the step checkmark
    document.getElementById(`step-${pool}-check`)?.classList.remove('hidden');

    if (avatarMakerData.creature && avatarMakerData.color && avatarMakerData.accessory) {
        document.getElementById('avatar-generate-btn').disabled = false;
    }
}


// --- CORE ACTIONS ---

export async function handleGenerateAvatar() {
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
        const finalPrompt = await callGeminiApi(systemPrompt, userPrompt);
        const imageBase64 = await callCloudflareAiImageApi(finalPrompt);
        
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

export async function handleSaveAvatar() {
    const { studentId, generatedImage } = avatarMakerData;
    if (!studentId || !generatedImage) return;

    const saveBtn = document.getElementById('avatar-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        const compressedAvatar = await compressAvatarImageBase64(generatedImage);
        
        // NEW: Upload to Storage
        const { uploadImageToStorage } = await import('../utils.js');
        const imagePath = `avatars/${studentId}_${Date.now()}.webp`;
        const imageUrl = await uploadImageToStorage(compressedAvatar, imagePath);

        const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
        await updateDoc(studentRef, { avatar: imageUrl }); // NEW: Save URL
        
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
