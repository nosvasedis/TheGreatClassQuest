// /features/storyWeaverHelpers.js — Story Weavers writing helpers, loaded on demand by storyWeaver.js.
// Structure focus + sentence starters (per Quest League), story-input scaffolds, dialogic
// reveal prompts, the Lucky Dip, Story Spark and Twist cards. Content lives in
// trainingGrounds/content/storyContent.mjs (per league) and languageScaffolds.mjs (reveal prompts).
import * as state from '../state.js';
import { showToast } from '../ui/effects.js';
import { getDialogicPrompts } from './languageScaffolds.mjs';
import {
    getLeagueStarters as getSentenceStarters, getLeagueStructures as getStructureHints,
    pickLeagueStoryWords, drawSpark, drawSparkCard, drawTwist, sparkDecks, sparkOpening
} from './trainingGrounds/content/storyContent.mjs';
import { storySparkHtml, storyTwistHtml } from './storyWeaverView.js';

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

    const startWith = (text) => {
        if (!text) return;
        if (document.getElementById('story-weavers-lock-in-btn')?.disabled) {
            showToast('Lock in the Word of the Day first, then use the card.', 'info');
            document.getElementById('story-weavers-word-input')?.focus();
            return;
        }
        openStoryInputModal?.({ starter: text });
    };

    document.getElementById('sw-spark')?.addEventListener('click', (event) => {
        const classId = storyWeaverClassId();
        const league = storyWeaverClassData(classId)?.questLevel;
        if (!classId) return;
        const deckBtn = event.target.closest('[data-spark-deck]');
        if (deckBtn) {
            const spark = readSpark(classId, league);
            const deck = deckBtn.dataset.sparkDeck;
            writeSpark(classId, { ...spark, [deck]: drawSparkCard(league, deck, { current: spark[deck] }) });
            renderStorySpark(classId, 0);
            return;
        }
        if (event.target.closest('[data-spark-all]')) {
            writeSpark(classId, drawSpark(league));
            renderStorySpark(classId, 0);
            return;
        }
        if (event.target.closest('[data-spark-use]')) startWith(sparkOpening(league, readSpark(classId, league)));
    });

    document.getElementById('sw-twist-btn')?.addEventListener('click', () => {
        const classId = storyWeaverClassId();
        const box = document.getElementById('sw-twist');
        if (!classId || !box) return;
        const twist = drawTwist(storyWeaverClassData(classId)?.questLevel, { current: box.dataset.twist || '' });
        box.dataset.twist = twist;
        box.innerHTML = storyTwistHtml(twist);
        box.classList.remove('hidden');
    });

    document.getElementById('sw-twist')?.addEventListener('click', (event) => {
        if (event.target.closest('[data-twist-use]')) startWith(event.currentTarget.dataset.twist || '');
    });
}

// ─── Lucky Dip, Story Spark and Twist cards ──────────────────────────────────

/** Three Lucky Dip words for the class's league: a noun, a verb and an adjective. */
export function pickLuckyWords(league, { exclude = [] } = {}) {
    return pickLeagueStoryWords(league, { exclude });
}

const SPARK_KEY = 'gcq_sw_spark_';

function readSpark(classId, league) {
    try {
        const saved = JSON.parse(localStorage.getItem(`${SPARK_KEY}${classId}`) || 'null');
        if (saved?.hero && saved?.place && saved?.problem) return saved;
    } catch {
        /* storage unavailable or junk: draw a fresh spark */
    }
    const spark = drawSpark(league);
    writeSpark(classId, spark);
    return spark;
}

function writeSpark(classId, spark) {
    try {
        localStorage.setItem(`${SPARK_KEY}${classId}`, JSON.stringify(spark));
    } catch {
        /* storage unavailable: the spark still shows until the page reloads */
    }
}

/**
 * The Story Spark shows on an empty book; Twist cards take over once the story has pages.
 * Called by storyWeaver.js whenever the book redraws.
 */
export function renderStorySpark(classId, pageCount = 0) {
    const sparkEl = document.getElementById('sw-spark');
    const twistRow = document.getElementById('sw-twist-row');
    const classData = storyWeaverClassData(classId);
    const empty = Boolean(classData) && pageCount === 0;
    if (sparkEl) {
        sparkEl.classList.toggle('hidden', !empty);
        if (empty) {
            const league = classData.questLevel;
            const spark = readSpark(classId, league);
            const decks = sparkDecks(league).filter((d) => d !== 'genre' || spark.genre);
            sparkEl.innerHTML = storySparkHtml({
                spark, decks,
                opening: sparkOpening(league, spark),
                wordLocked: !document.getElementById('story-weavers-lock-in-btn')?.disabled
            });
        }
    }
    if (twistRow) {
        twistRow.classList.toggle('hidden', !classData || pageCount === 0);
        if (twistRow.dataset.classId !== classId) {
            twistRow.dataset.classId = classId || '';
            const box = document.getElementById('sw-twist');
            if (box) { box.classList.add('hidden'); box.innerHTML = ''; box.dataset.twist = ''; }
        }
    }
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
