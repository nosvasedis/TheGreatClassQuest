// /features/diaryPageEditor.js — shared page shell for the Adventure Log editors
// ("Write today's page" for manual entries and "Edit page" for any entry).
// Pure markup + small UI helpers; saving stays in db/actions/log.js and db/actions/quests.js.

export function escapeDiaryEditorHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * The editor overlay: a diary page lying open on the desk.
 * `ids` names every element callers read back, so saving code can keep its selectors.
 */
export function diaryPageEditorHtml({
    ids,
    heading,
    subtitle = '',
    dateLabel = '',
    titleValue = '',
    storyValue = '',
    highlightsValue = '',
    storyTool = '',
    heroHtml = '',
    learnedHtml = '',
    pictureHtml = '',
    saveLabel = 'Save page',
    saveIcon = 'fa-feather-alt'
}) {
    return `
        <section class="adventure-log-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="${ids.heading}">
            <header class="adventure-log-editor-header">
                <div class="adventure-log-editor-header-inner">
                    <div class="adventure-log-editor-header-text">
                        <p class="adventure-log-editor-kicker"><i class="fas fa-book-open" aria-hidden="true"></i> Adventure Log</p>
                        <h2 id="${ids.heading}" class="adventure-log-editor-title">${heading}</h2>
                        ${subtitle ? `<p class="adventure-log-editor-subtitle">${subtitle}</p>` : ''}
                    </div>
                    ${dateLabel ? `<p class="adventure-log-editor-date-chip"><span class="adventure-log-editor-date-chip__ring" aria-hidden="true"></span><span>${dateLabel}</span></p>` : ''}
                    <button type="button" id="${ids.close}" class="adventure-log-editor-close" aria-label="Close without saving">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </header>

            <div class="adventure-log-editor-body">
                <span class="adventure-log-editor-binding" aria-hidden="true"></span>
                <div class="adventure-log-editor-field adventure-log-editor-field--title">
                    <label for="${ids.title}">Title</label>
                    <input type="text" id="${ids.title}" maxlength="90" value="${escapeDiaryEditorHtml(titleValue)}" placeholder="Give today a name, e.g. A Day of Discovery" autocomplete="off">
                    <p id="${ids.counter}" class="adventure-log-editor-hint adventure-log-editor-counter">0 / 90</p>
                </div>

                <div class="adventure-log-editor-field adventure-log-editor-field--story">
                    <div class="adventure-log-editor-label-row">
                        <label for="${ids.story}">Today's story</label>
                        ${storyTool}
                    </div>
                    <textarea id="${ids.story}" rows="8" placeholder="What happened in the lesson? Who was brave, funny, kind? What did we discover?">${escapeDiaryEditorHtml(storyValue)}</textarea>
                    <p class="adventure-log-editor-hint">Tip: Ctrl + Enter (Cmd + Enter on Mac) saves the page.</p>
                </div>

                <div class="adventure-log-editor-grid">
                    <div class="adventure-log-editor-field">
                        <span class="adventure-log-editor-label">Hero of the Day</span>
                        ${heroHtml}
                    </div>
                    <div class="adventure-log-editor-field">
                        <label for="${ids.highlights}">Highlights <span class="adventure-log-editor-optional">(up to 4, split with commas)</span></label>
                        <input type="text" id="${ids.highlights}" value="${escapeDiaryEditorHtml(highlightsValue)}" placeholder="Teamwork, Creative answers, Brave speaking" autocomplete="off">
                        <ul class="adventure-log-editor-washi" data-highlight-preview aria-hidden="true"></ul>
                    </div>
                </div>

                ${pictureHtml}

                <div class="adventure-log-editor-field adventure-log-editor-field--learned">
                    <span class="adventure-log-editor-label"><i class="fas fa-graduation-cap" aria-hidden="true"></i> What we learned today <span class="adventure-log-editor-optional">(optional)</span></span>
                    ${learnedHtml}
                </div>
            </div>

            <footer class="adventure-log-editor-footer">
                <div class="adventure-log-editor-footer-inner">
                    <button type="button" id="${ids.cancel}" class="adventure-log-editor-btn secondary">Cancel</button>
                    <button type="button" id="${ids.save}" class="adventure-log-editor-btn primary">
                        <i class="fas ${saveIcon}" aria-hidden="true"></i>
                        <span>${saveLabel}</span>
                    </button>
                </div>
            </footer>
        </section>
    `;
}

/** Hero sticker for the editor: a known hero, or a mystery seal crowned on save. */
export function diaryEditorHeroHtml(heroName, { pending = false } = {}) {
    if (pending) {
        return `
            <div class="adventure-log-editor-hero-pill is-pending">
                <span class="adventure-log-editor-hero-seal" aria-hidden="true">?</span>
                <span><strong>Crowned when you save</strong><small>The app picks today's Hero from the students present.</small></span>
            </div>`;
    }
    return `
        <div class="adventure-log-editor-hero-pill">
            <span class="adventure-log-editor-hero-seal" aria-hidden="true"><i class="fas fa-crown"></i></span>
            <span><strong>${escapeDiaryEditorHtml(heroName || 'The Class Team')}</strong><small>Crowned for this lesson; stays on the page.</small></span>
        </div>`;
}

/** Shows the comma-separated highlights as washi-tape strips while the teacher types. */
export function bindDiaryHighlightPreview(input, root) {
    const preview = root?.querySelector('[data-highlight-preview]');
    if (!input || !preview) return;
    const render = () => {
        const parts = input.value.split(',').map((part) => part.trim()).filter(Boolean);
        preview.innerHTML = parts.slice(0, 4)
            .map((part, index) => `<li class="adventure-log-editor-washi__strip adventure-log-editor-washi__strip--${index % 4}">${escapeDiaryEditorHtml(part)}</li>`)
            .join('') + (parts.length > 4 ? `<li class="adventure-log-editor-washi__more">+${parts.length - 4} will be left out</li>` : '');
    };
    input.addEventListener('input', render);
    render();
}

export function formatDiaryEditorDate(dateObj) {
    if (!dateObj || Number.isNaN(dateObj.getTime?.())) return '';
    return escapeDiaryEditorHtml(dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
}
