// /features/storyWeaverView.js — Story Weavers markup builders.
// Pure: no Firestore, no state. storyWeaver.js feeds it data, and the guidebook capture can too.

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex that finds the Word of the Day and its simple forms (luminous, lanterns, jumped). */
export function wordPattern(word) {
    const clean = String(word || '').trim();
    if (!clean || clean.length > 40) return null;
    // Let a trailing silent e drop, so "dance" also finds "dancing".
    const stem = clean.length > 3 && /e$/i.test(clean) ? clean.slice(0, -1) : clean;
    try {
        return new RegExp(`(^|[^\\p{L}])(${escapeRegExp(stem)}\\p{L}{0,4})(?=[^\\p{L}]|$)`, 'giu');
    } catch {
        return null;
    }
}

export function sentenceUsesWord(sentence, word) {
    const pattern = wordPattern(word);
    return Boolean(pattern && pattern.test(String(sentence || '')));
}

/** Escaped sentence with every use of the word wrapped in a glowing mark. */
export function highlightWord(sentence, word) {
    const text = escapeHtml(sentence);
    const pattern = wordPattern(escapeHtml(word));
    if (!pattern) return text;
    return text.replace(pattern, (_, lead, hit) => `${lead}<mark class="sw-word-mark">${hit}</mark>`);
}

export function countWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The pages of the class's current story, oldest first.
 * Older versions of Start New kept earlier pages in story_history, so when the story
 * counts fewer pages than the history holds, only the newest pages belong to it.
 */
export function deriveStoryPages(story, history = []) {
    if (!story?.currentSentence) return [];
    const count = Math.max(0, Number(story.storyAdditionsCount) || 0);
    let pages = history.slice();
    if (count > 0 && count < pages.length) pages = pages.slice(-count);
    if (!pages.length) {
        pages = [{ id: null, sentence: story.currentSentence, word: story.currentWord || '', imageUrl: story.currentImageUrl || story.currentImageBase64 || '' }];
    }
    return pages.map((page) => ({
        id: page.id || null,
        sentence: page.sentence || '',
        word: page.word || '',
        imageUrl: page.imageUrl || page.imageBase64 || ''
    }));
}

/** Beads along the golden thread: one per page, then a bead for the page still to come. */
export function storyThreadHtml(pages, activeIndex, { canWrite = false } = {}) {
    const beads = pages.map((page, index) => {
        const active = index === activeIndex;
        const thumb = page.imageUrl
            ? `<img src="${escapeHtml(page.imageUrl)}" alt="" loading="lazy" decoding="async">`
            : `<span class="sw-bead__num">${index + 1}</span>`;
        return `<button type="button" class="sw-bead${active ? ' is-active' : ''}" role="listitem" data-page-index="${index}"
            aria-label="Page ${index + 1}${active ? ' (showing)' : ''}" aria-current="${active ? 'page' : 'false'}" style="--i:${index}">
            <span class="sw-bead__frame">${thumb}</span>
            <span class="sw-bead__label">${index + 1}</span>
        </button>`;
    }).join('');
    const next = pages.length + 1;
    const nextBead = `<button type="button" class="sw-bead sw-bead--next${canWrite ? ' is-ready' : ''}" role="listitem" data-page-next="1"
        aria-label="Write page ${next}" title="${canWrite ? `Write page ${next}` : 'Lock in a word to write the next page'}" style="--i:${pages.length}">
        <span class="sw-bead__frame"><i class="fas fa-plus" aria-hidden="true"></i></span>
        <span class="sw-bead__label">${next}</span>
    </button>`;
    return beads + nextBead;
}

/** Bonus Creativity Star moments come every second page. */
export function milestoneHtml(pageCount) {
    const into = pageCount % 2;
    const knots = [0, 1].map((i) => `<span class="sw-knot${i < into ? ' is-tied' : ''}"></span>`).join('');
    const line = pageCount === 0
        ? 'Every two pages, the class can earn a <strong>Creativity Star</strong>.'
        : into === 1
            ? 'One more page and the class reaches a <strong>Creativity Star</strong> moment!'
            : `<strong>${pageCount}</strong> pages woven. Two more for the next <strong>Creativity Star</strong>.`;
    return `<span class="sw-milestone__star" aria-hidden="true"><i class="fas fa-star"></i></span>
        <span class="sw-milestone__knots" aria-hidden="true">${knots}</span>
        <span class="sw-milestone__text">${line}</span>`;
}

/** Book covers for the shelf. Covers fall back to a woven pattern tinted from the title. */
export function shelfBookHtml(story, index) {
    const title = escapeHtml(story.title || 'Untitled Story');
    const cover = story.coverImageUrl || story.coverImageBase64 || '';
    const hue = [...String(story.title || '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;
    const art = cover
        ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async">`
        : `<span class="sw-cover__pattern" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>`;
    return `<button type="button" class="sw-shelf-book view-storybook-btn" data-story-id="${escapeHtml(story.id)}"
        style="--hue:${hue};--i:${index}" aria-label="Open storybook: ${title}">
        <span class="sw-cover">
            <span class="sw-cover__art">${art}</span>
            <span class="sw-cover__plate"><span class="sw-cover__title">${title}</span></span>
            <span class="sw-cover__class">${escapeHtml(`${story.classLogo || ''} ${story.className || ''}`.trim())}</span>
        </span>
    </button>`;
}

export function shelfEmptyHtml(hasClass) {
    return `<div class="sw-shelf__empty">
        <span class="sw-shelf__empty-book" aria-hidden="true"><i class="fas fa-book"></i></span>
        <p><strong>${hasClass ? 'This shelf is waiting for its first storybook.' : 'No storybooks yet.'}</strong>
        Write a few pages, then press <em>The End</em> to bind the story into a book.</p>
    </div>`;
}

/** One spread of the reader: illustration on the left page, words on the right. */
export function readerSpreadHtml(page, index, total, { word = '' } = {}) {
    const art = page.imageUrl
        ? `<img src="${escapeHtml(page.imageUrl)}" alt="Page ${index + 1} illustration" decoding="async">`
        : `<span class="sw-illustration__empty"><i class="fas fa-image" aria-hidden="true"></i><span>No illustration</span></span>`;
    return `<div class="sw-reader-spread">
        <div class="sw-reader-spread__left"><div class="sw-reader-spread__art">${art}</div><span class="sw-page-number">${index * 2 + 1}</span></div>
        <div class="sw-reader-spread__right">
            <p class="sw-chapter-label">Page ${index + 1} of ${total}</p>
            <p class="sw-story-text sw-reader-spread__text">${highlightWord(page.sentence, page.word || word)}</p>
            ${page.word ? `<span class="sw-word-ribbon"><span class="sw-word-ribbon-label">Word</span><span class="sw-word-ribbon-word">${escapeHtml(page.word)}</span></span>` : ''}
            <span class="sw-page-number">${index * 2 + 2}</span>
        </div>
    </div>`;
}

export function readerGridHtml(pages) {
    return `<div class="sw-reader-grid">${pages.map((page, index) => `
        <button type="button" class="sw-reader-card" data-reader-page="${index}" style="--i:${index}">
            <span class="sw-reader-card__art">${page.imageUrl ? `<img src="${escapeHtml(page.imageUrl)}" alt="" loading="lazy" decoding="async">` : '<i class="fas fa-image" aria-hidden="true"></i>'}</span>
            <span class="sw-reader-card__num">Page ${index + 1}</span>
            <span class="sw-reader-card__text">${highlightWord(page.sentence, page.word)}</span>
        </button>`).join('')}</div>`;
}

// ─── Story Spark + Twist cards (content in trainingGrounds/content/storyContent.mjs) ──

const SPARK_DECKS = {
    hero: { label: 'Who?', icon: 'fa-user-astronaut' },
    place: { label: 'Where?', icon: 'fa-map-location-dot' },
    problem: { label: 'Uh-oh!', icon: 'fa-bolt' },
    genre: { label: 'What kind of story?', icon: 'fa-masks-theater' }
};

/** The Story Spark for an empty book: draw-or-reroll cards and the opening line they make. */
export function storySparkHtml({ spark = {}, decks = [], opening = '', wordLocked = false } = {}) {
    const cards = decks.map((deck, i) => {
        const meta = SPARK_DECKS[deck] || { label: deck, icon: 'fa-star' };
        return `<button type="button" class="sw-spark__card sw-spark__card--${escapeHtml(deck)}" data-spark-deck="${escapeHtml(deck)}" style="--i:${i}" title="Draw another card">
            <span class="sw-spark__deck"><i class="fas ${meta.icon}" aria-hidden="true"></i> ${escapeHtml(meta.label)}</span>
            <span class="sw-spark__value">${escapeHtml(spark[deck] || '…')}</span>
            <span class="sw-spark__reroll" aria-hidden="true"><i class="fas fa-rotate"></i></span>
        </button>`;
    }).join('');
    return `<div class="sw-spark__head">
            <p class="sw-spark__kicker"><i class="fas fa-wand-sparkles" aria-hidden="true"></i> Story Spark</p>
            <p class="sw-spark__sub">A blank book! Draw a hero, a place and a problem. Tap a card to draw again.</p>
        </div>
        <div class="sw-spark__cards">${cards}</div>
        ${opening ? `<p class="sw-spark__opening">“${escapeHtml(opening)}”</p>` : ''}
        <div class="sw-spark__actions">
            <button type="button" class="sw-ghost-btn" data-spark-all><i class="fas fa-shuffle" aria-hidden="true"></i><span>Draw all again</span></button>
            <button type="button" class="sw-weave-btn sw-spark__use" data-spark-use${opening ? '' : ' disabled'} title="${wordLocked ? 'Start the first page with this opening' : 'Lock in the Word of the Day first'}"><i class="fas fa-feather-pointed" aria-hidden="true"></i><span>Use this opening</span></button>
        </div>`;
}

/** A drawn Twist card for the next page. */
export function storyTwistHtml(twist) {
    if (!twist) return '';
    return `<span class="sw-twist__text"><i class="fas fa-tornado" aria-hidden="true"></i> ${escapeHtml(twist)}</span>
        <button type="button" class="sw-twist__use" data-twist-use>Use it</button>`;
}
