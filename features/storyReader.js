// /features/storyReader.js — the Story Weavers book reader (storybook-viewer-modal).
// Reads the class's current story and finished storybooks one spread at a time,
// with page turns, an all-pages view, and narration that turns the pages by itself.
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { isSpeaking, speakText, stopSpeech, isTtsSupported } from './tts.js';
import { readerGridHtml, readerSpreadHtml } from './storyWeaverView.js';

const NARRATE_IDLE = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
const NARRATE_ON = `<i class="fas fa-stop-circle mr-2"></i> Stop Narration`;

const reader = {
    pages: [],
    index: 0,
    view: 'book',
    narrating: false,
    bound: false
};

function el(id) {
    return document.getElementById(id);
}

function isOpen() {
    const modal = el('storybook-viewer-modal');
    return Boolean(modal && !modal.classList.contains('hidden'));
}

function render(direction = 0) {
    const body = el('storybook-viewer-content');
    if (!body) return;
    const total = reader.pages.length;
    const modal = el('storybook-viewer-modal');
    modal?.classList.toggle('is-grid', reader.view === 'grid');
    modal?.querySelectorAll('[data-reader-view]').forEach((btn) => {
        const on = btn.dataset.readerView === reader.view;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', String(on));
    });

    if (!total) {
        body.innerHTML = `<p class="sw-reader__empty">This story is just beginning!</p>`;
    } else if (reader.view === 'grid') {
        body.innerHTML = readerGridHtml(reader.pages);
    } else {
        body.innerHTML = readerSpreadHtml(reader.pages[reader.index], reader.index, total);
        const spread = body.firstElementChild;
        if (spread && direction) spread.classList.add(direction > 0 ? 'is-turning-next' : 'is-turning-prev');
    }

    const pos = el('storybook-viewer-pos');
    if (pos) {
        pos.innerHTML = total && reader.view === 'book'
            ? `<span class="sw-reader__dots" aria-hidden="true">${reader.pages.map((_, i) => `<span class="${i === reader.index ? 'is-on' : ''}"></span>`).join('')}</span><span>Page ${reader.index + 1} of ${total}</span>`
            : `<span>${total} page${total === 1 ? '' : 's'}</span>`;
    }
    const prev = el('storybook-viewer-prev');
    const next = el('storybook-viewer-next');
    if (prev) prev.disabled = reader.view !== 'book' || reader.index <= 0;
    if (next) next.disabled = reader.view !== 'book' || reader.index >= total - 1;
}

function goTo(index) {
    const target = Math.max(0, Math.min(reader.pages.length - 1, index));
    if (target === reader.index && reader.view === 'book') return;
    const direction = Math.sign(target - reader.index);
    reader.index = target;
    reader.view = 'book';
    render(direction);
}

function setNarrateButton(on) {
    const btn = el('storybook-viewer-play-btn');
    if (btn) btn.innerHTML = on ? NARRATE_ON : NARRATE_IDLE;
}

function stopNarration() {
    reader.narrating = false;
    if (isSpeaking()) stopSpeech();
    setNarrateButton(false);
    el('storybook-viewer-modal')?.classList.remove('is-narrating');
}

/** Reads the open page, then turns to the next one until the book ends. */
function narrateFrom(index) {
    const page = reader.pages[index];
    if (!reader.narrating || !page || !isOpen()) {
        stopNarration();
        return;
    }
    goTo(index);
    speakText(page.sentence, {
        rate: 0.95,
        pitch: 1.05,
        voiceHint: 'en',
        onStart: () => setNarrateButton(true),
        onEnd: () => {
            if (!reader.narrating) return;
            if (index + 1 < reader.pages.length) window.setTimeout(() => narrateFrom(index + 1), 650);
            else stopNarration();
        },
        onError: () => {
            stopNarration();
            showToast('Narration failed on this device/browser.', 'error');
        }
    });
}

function bindOnce() {
    if (reader.bound) return;
    reader.bound = true;
    el('storybook-viewer-prev')?.addEventListener('click', () => { stopNarration(); goTo(reader.index - 1); });
    el('storybook-viewer-next')?.addEventListener('click', () => { stopNarration(); goTo(reader.index + 1); });
    el('storybook-viewer-modal')?.addEventListener('click', (event) => {
        const viewBtn = event.target.closest('[data-reader-view]');
        if (viewBtn) {
            reader.view = viewBtn.dataset.readerView;
            render();
            return;
        }
        const card = event.target.closest('[data-reader-page]');
        if (card) goTo(Number(card.dataset.readerPage));
    });
    el('storybook-viewer-close-btn')?.addEventListener('click', stopNarration);
    document.addEventListener('keydown', (event) => {
        if (!isOpen() || reader.view !== 'book') return;
        if (event.target.closest?.('input, textarea, select')) return;
        if (event.key === 'ArrowRight') { stopNarration(); goTo(reader.index + 1); }
        if (event.key === 'ArrowLeft') { stopNarration(); goTo(reader.index - 1); }
    });
    // A tap on either half of the spread turns the page, like a real book.
    el('storybook-viewer-content')?.addEventListener('click', (event) => {
        if (reader.view !== 'book' || event.target.closest('button, a, mark')) return;
        if (window.getSelection?.().toString()) return;
        const spread = event.target.closest('.sw-reader-spread');
        if (!spread) return;
        const rect = spread.getBoundingClientRect();
        const wide = rect.width > 640;
        const forward = wide ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2;
        stopNarration();
        goTo(reader.index + (forward ? 1 : -1));
    });
}

/**
 * Opens the reader.
 * pages: [{ sentence, word, imageUrl }]
 * mode: 'current' hides print and delete; 'archive' shows them (onPrint/onDelete).
 */
export function openStoryReader({ eyebrow = 'Storybook', title = '', subtitle = '', pages = null, startAt = 0, mode = 'archive', onPrint = null, onDelete = null } = {}) {
    bindOnce();
    stopNarration();
    reader.pages = pages || [];
    reader.index = Math.max(0, Math.min(reader.pages.length - 1, startAt));
    reader.view = 'book';

    el('storybook-viewer-eyebrow').textContent = eyebrow;
    el('storybook-viewer-title').textContent = title;
    el('storybook-viewer-subtitle').textContent = subtitle;

    const printBtn = el('storybook-viewer-print-btn');
    const deleteBtn = el('storybook-viewer-delete-btn');
    printBtn.classList.toggle('hidden', mode !== 'archive');
    deleteBtn.classList.toggle('hidden', mode !== 'archive');
    printBtn.onclick = onPrint;
    printBtn.disabled = !onPrint || !pages;
    deleteBtn.onclick = onDelete;

    const playBtn = el('storybook-viewer-play-btn');
    setNarrateButton(false);
    playBtn.disabled = true;
    playBtn.onclick = null;

    if (!pages) {
        el('storybook-viewer-content').innerHTML = `<p class="sw-reader__empty"><i class="fas fa-spinner fa-spin mr-2"></i>Loading pages...</p>`;
        el('storybook-viewer-pos').textContent = '';
    } else {
        render();
        enableNarration();
    }
    modals.showAnimatedModal('storybook-viewer-modal');
}

/** Fills a reader that opened with pages: null while they loaded. */
export function setReaderPages(pages, { onPrint } = {}) {
    reader.pages = pages || [];
    reader.index = 0;
    render();
    const printBtn = el('storybook-viewer-print-btn');
    if (onPrint) {
        printBtn.onclick = onPrint;
        printBtn.disabled = false;
    }
    enableNarration();
}

export function showReaderError(message) {
    el('storybook-viewer-content').innerHTML = `<p class="sw-reader__empty sw-reader__empty--error">${message}</p>`;
}

function enableNarration() {
    const playBtn = el('storybook-viewer-play-btn');
    if (!reader.pages.length) return;
    if (!isTtsSupported()) {
        playBtn.disabled = true;
        playBtn.innerHTML = `<i class="fas fa-volume-mute mr-2"></i> TTS Unsupported`;
        return;
    }
    playBtn.disabled = false;
    playBtn.onclick = () => {
        if (reader.narrating) {
            stopNarration();
            return;
        }
        reader.narrating = true;
        el('storybook-viewer-modal')?.classList.add('is-narrating');
        // Start from the open page; from the last page, start again at the beginning.
        const start = reader.view === 'book' && reader.index < reader.pages.length - 1 ? reader.index : 0;
        narrateFrom(start);
    };
}

export function closeStoryReader() {
    stopNarration();
    modals.hideModal('storybook-viewer-modal');
}
