// /features/storyWeaverHelpers.js — Story Weavers writing helpers, loaded on demand by storyWeaver.js.
// Structure focus + sentence starters (per Quest League), story-input scaffolds, and dialogic
// reveal prompts. Content lives in languageScaffolds.mjs.
import * as state from '../state.js';
import { showToast } from '../ui/effects.js';
import { getDialogicPrompts, getSentenceStarters, getStructureHints } from './languageScaffolds.mjs';

function storyWeaverClassId() {
    return state.get('globalSelectedClassId') || '';
}

function storyWeaverClassData(classId = storyWeaverClassId()) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// ─── Writing helpers: structure focus + sentence starters (per Quest League) ──
const STRUCTURE_FOCUS_KEY = 'gcq_sw_structure_focus_';

function readStructureFocus(classId) {
    try {
        const value = localStorage.getItem(`${STRUCTURE_FOCUS_KEY}${classId}`);
        return value === null ? -1 : Number(value);
    } catch {
        return -1;
    }
}

function writeStructureFocus(classId, index) {
    try {
        localStorage.setItem(`${STRUCTURE_FOCUS_KEY}${classId}`, String(index));
    } catch {
        /* storage unavailable: the focus still applies until the page reloads */
    }
}

function getActiveStructureHint(classId, { getStructureHints }) {
    const classData = storyWeaverClassData(classId);
    if (!classData) return null;
    const hints = getStructureHints(classData.questLevel);
    const index = readStructureFocus(classId);
    return index >= 0 && index < hints.length ? hints[index] : null;
}

export function renderStoryWritingHelpers(classId = storyWeaverClassId()) {
        const hintsEl = document.getElementById('story-weavers-structure-hints');
    const startersEl = document.getElementById('story-weavers-starters');
    const subEl = document.getElementById('story-weavers-helpers-sub');
    if (!hintsEl || !startersEl) return;

    const classData = storyWeaverClassData(classId);
    if (!classData) {
        if (subEl) subEl.textContent = 'Choose a class from the header to see scaffolds for its Quest League.';
        hintsEl.innerHTML = '';
        startersEl.innerHTML = '';
        return;
    }

    if (subEl) subEl.textContent = `Scaffolds for ${classData.questLevel || 'this'} league. Use them to lift every child's sentence.`;
    const activeIndex = readStructureFocus(classId);
    hintsEl.innerHTML = getStructureHints(classData.questLevel).map((hint, index) => `
        <button type="button" class="sw-structure-card ${index === activeIndex ? 'is-active' : ''}" role="radio"
            aria-checked="${index === activeIndex}" data-structure-index="${index}" style="--i:${index}">
            <span class="sw-structure-name">${escapeHtml(hint.label)}</span>
            <span class="sw-structure-pattern">${escapeHtml(hint.pattern)}</span>
            <span class="sw-structure-example">“${escapeHtml(hint.example)}”</span>
        </button>`).join('');
    startersEl.innerHTML = getSentenceStarters(classData.questLevel).map((starter, index) => `
        <button type="button" class="sw-starter-chip" style="--i:${index}" data-story-starter="${escapeHtml(starter)}">${escapeHtml(starter)}</button>`).join('');
}

export function renderStoryInputHelpers(classId = storyWeaverClassId()) {
    const scaffolds = { getStructureHints };
    const container = document.getElementById('story-input-helpers');
    if (!container) return;
    const classData = storyWeaverClassData(classId);
    if (!classData) {
        container.innerHTML = '';
        return;
    }
    const focus = getActiveStructureHint(classId, scaffolds);
    const starters = getSentenceStarters(classData.questLevel).slice(0, 6);
    container.innerHTML = `
        ${focus ? `<p class="sw-input-focus"><i class="fas fa-shapes" aria-hidden="true"></i> <strong>${escapeHtml(focus.label)}:</strong> ${escapeHtml(focus.pattern)} <span>e.g. “${escapeHtml(focus.example)}”</span></p>` : ''}
        <div class="sw-input-starters" aria-label="Sentence starters">
            ${starters.map((starter) => `<button type="button" class="sw-starter-chip sw-starter-chip--small" data-input-starter="${escapeHtml(starter)}">${escapeHtml(starter)}</button>`).join('')}
        </div>`;
}

export function insertStarterIntoTextarea(starter) {
    const textarea = document.getElementById('story-input-textarea');
    if (!textarea) return;
    const clean = String(starter || '').replace(/…$/, '').trim();
    const current = textarea.value.trim();
    textarea.value = current ? `${current} ${clean} ` : `${clean} `;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

let storyHelperListenersBound = false;
/** Binds once; openStoryInputModal comes from storyWeaver.js (avoids a static import cycle). */
export function ensureStoryHelperListeners({ openStoryInputModal } = {}) {
    if (storyHelperListenersBound) return;
    storyHelperListenersBound = true;

    document.getElementById('story-weavers-structure-hints')?.addEventListener('click', (event) => {
        const card = event.target.closest('[data-structure-index]');
        const classId = storyWeaverClassId();
        if (!card || !classId) return;
        const index = Number(card.dataset.structureIndex);
        // Tapping the active focus again clears it.
        writeStructureFocus(classId, readStructureFocus(classId) === index ? -1 : index);
        renderStoryWritingHelpers(classId);
    });

    document.getElementById('story-weavers-starters')?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-story-starter]');
        if (!chip) return;
        const lockInBtn = document.getElementById('story-weavers-lock-in-btn');
        if (lockInBtn?.disabled) {
            showToast("Lock in the Word of the Day first, then pick a starter.", 'info');
            document.getElementById('story-weavers-word-input')?.focus();
            return;
        }
        openStoryInputModal?.({ starter: chip.dataset.storyStarter });
    });

    document.getElementById('story-input-helpers')?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-input-starter]');
        if (chip) insertStarterIntoTextarea(chip.dataset.inputStarter);
    });

    document.getElementById('story-reveal-prompts-shuffle')?.addEventListener('click', () => {
        renderRevealPrompts(storyWeaverClassId());
    });
}

export function renderRevealPrompts(classId) {
    const panel = document.getElementById('story-reveal-prompts');
    const list = document.getElementById('story-reveal-prompts-list');
    if (!panel || !list) return;
    const classData = storyWeaverClassData(classId);
    const story = state.get('currentStoryData')?.[classId];
    if (!classData || !story?.currentSentence) {
        panel.classList.add('hidden');
        return;
    }
    const prompts = getDialogicPrompts(classData.questLevel, { word: story.currentWord || '' });
    list.innerHTML = prompts.map((prompt) => `
        <div class="sw-reveal-prompt sw-reveal-prompt--${prompt.type}">
            <span class="sw-reveal-prompt-kind"><span aria-hidden="true">${prompt.icon}</span> ${escapeHtml(prompt.label)}</span>
            <p class="sw-reveal-prompt-text">${escapeHtml(prompt.text)}</p>
        </div>`).join('');
    panel.classList.remove('hidden');
}
