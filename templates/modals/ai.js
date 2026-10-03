// templates/modals/ai.js
// App info, story reveal, story archive, storybook reader, story input

export const aiModalsHTML = `
    <div id="app-info-modal" class="ag-overlay fixed inset-0 z-[95] hidden" role="dialog" aria-modal="true" aria-labelledby="ag-title">
        <div class="ag-book pop-in">
            <header class="ag-cover">
                <svg class="ag-compass" viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r="29" class="ag-compass__rim"/>
                    <circle cx="32" cy="32" r="24.5" class="ag-compass__face"/>
                    <path class="ag-compass__rose" d="M32 9 35 29 55 32 35 35 32 55 29 35 9 32 29 29Z"/>
                    <path class="ag-compass__rose ag-compass__rose--small" d="M32 20 33.6 30.4 44 32 33.6 33.6 32 44 30.4 33.6 20 32 30.4 30.4Z" transform="rotate(45 32 32)"/>
                    <g class="ag-compass__needle">
                        <path d="M32 12 36 32H28Z" class="ag-compass__north"/>
                        <path d="M32 52 28 32H36Z" class="ag-compass__south"/>
                        <circle cx="32" cy="32" r="2.6" class="ag-compass__pin"/>
                    </g>
                </svg>
                <div class="ag-cover__text">
                    <h2 id="ag-title" class="ag-cover__title">The Adventurer's Guide</h2>
                    <p id="ag-cover-sub" class="ag-cover__sub">A field guide to The Great Class Quest</p>
                </div>
                <div id="ag-plan-stamp" class="ag-stamp"></div>
                <button type="button" id="app-info-close-btn" class="ag-close" aria-label="Close the guide">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <div class="ag-toolbar">
                <div class="ag-audience" role="group" aria-label="Who is reading">
                    <button type="button" class="ag-audience__btn is-active" data-ag-audience="teacher" aria-pressed="true">
                        <i class="fas fa-chalkboard-user" aria-hidden="true"></i> Quest Master
                    </button>
                    <button type="button" class="ag-audience__btn" data-ag-audience="class" aria-pressed="false">
                        <i class="fas fa-children" aria-hidden="true"></i> For the class
                    </button>
                </div>
                <div class="ag-search">
                    <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                    <input type="search" id="ag-search-input" placeholder="Search the guide" aria-label="Search the guide" autocomplete="off" enterkeyhint="search">
                    <button type="button" id="ag-search-clear" class="ag-search__clear" aria-label="Clear the search" hidden>
                        <i class="fas fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <div class="ag-body">
                <nav id="ag-index" class="ag-index" aria-label="Chapters"></nav>
                <div id="ag-page" class="ag-page" tabindex="-1"></div>
            </div>
        </div>
    </div>

    <div id="story-reveal-modal"
        class="sw-overlay fixed inset-0 z-[71] flex items-center justify-center p-4 hidden">
        <div class="sw-reveal pop-in relative">
            <span class="sw-reveal__glow" aria-hidden="true"></span>
            <div class="sw-reveal__top">
                <p id="story-reveal-page" class="sw-reveal__page"></p>
                <div class="sw-reveal__top-actions">
                    <button type="button" id="story-reveal-read-btn" class="sw-reveal__read" title="Read the page aloud">
                        <i class="fas fa-volume-high" aria-hidden="true"></i><span>Read aloud</span>
                    </button>
                    <button id="story-reveal-close-btn" class="sw-x" aria-label="Close">&times;</button>
                </div>
            </div>
            <div class="sw-reveal-book">
                <div id="story-reveal-art" class="sw-reveal-art hidden">
                    <img id="story-reveal-image" src="" alt="Story illustration" decoding="async">
                </div>
                <div class="sw-reveal-page">
                    <p id="story-reveal-text" class="sw-reveal-text" data-selectable></p>
                    <p id="story-reveal-word" class="sw-reveal-word hidden"></p>
                </div>
            </div>
            <div id="story-reveal-prompts" class="sw-reveal-prompts hidden" aria-live="polite">
                <div class="sw-reveal-prompts-head">
                    <p class="sw-reveal-prompts-title"><i class="fas fa-comments" aria-hidden="true"></i> Let's talk about it</p>
                    <button type="button" id="story-reveal-prompts-shuffle" class="sw-reveal-prompts-shuffle" title="Show different questions">
                        <i class="fas fa-shuffle" aria-hidden="true"></i> New questions
                    </button>
                </div>
                <div id="story-reveal-prompts-list" class="sw-reveal-prompts-list"></div>
            </div>
        </div>
    </div>

    <div id="story-archive-modal"
        class="sw-overlay fixed inset-0 z-[71] flex items-center justify-center p-4 hidden">
        <div class="sw-library-modal pop-in">
            <header class="sw-library-modal__head">
                <span class="sw-library-modal__crest" aria-hidden="true"><i class="fas fa-book-open"></i></span>
                <div class="min-w-0">
                    <h2 class="sw-library-modal__title">The Storybook Library</h2>
                    <p class="sw-library-modal__sub">Every tale your classes have finished, bound and kept.</p>
                </div>
                <button id="story-archive-close-btn" class="sw-x" aria-label="Close">&times;</button>
            </header>
            <div class="sw-library-modal__tools">
                <label class="sw-search">
                    <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                    <input id="story-archive-search" type="search" placeholder="Search by title or class" autocomplete="off" aria-label="Search storybooks">
                </label>
                <select id="story-archive-sort" class="sw-select" aria-label="Sort storybooks">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="title">Title A–Z</option>
                </select>
            </div>
            <div id="story-archive-list" class="story-weavers-archive-grid"></div>
        </div>
    </div>

    <div id="storybook-viewer-modal"
        class="sw-overlay fixed inset-0 z-[72] flex items-center justify-center p-4 hidden">
        <div class="sw-reader pop-in" role="dialog" aria-modal="true" aria-labelledby="storybook-viewer-title">
            <header class="sw-reader__head">
                <div class="min-w-0">
                    <p id="storybook-viewer-eyebrow" class="sw-reader__eyebrow">Storybook</p>
                    <h2 id="storybook-viewer-title" class="sw-reader__title"></h2>
                    <p id="storybook-viewer-subtitle" class="sw-reader__sub"></p>
                </div>
                <div class="sw-reader__views" role="group" aria-label="How to read">
                    <button type="button" class="sw-reader__view is-active" data-reader-view="book" aria-pressed="true"><i class="fas fa-book-open" aria-hidden="true"></i><span>Book</span></button>
                    <button type="button" class="sw-reader__view" data-reader-view="grid" aria-pressed="false"><i class="fas fa-table-cells-large" aria-hidden="true"></i><span>All pages</span></button>
                </div>
                <button id="storybook-viewer-close-btn" class="sw-x sw-x--light" aria-label="Close">&times;</button>
            </header>
            <div id="storybook-viewer-content" class="sw-reader__body" data-selectable></div>
            <footer class="sw-reader__foot">
                <div class="sw-reader__nav">
                    <button type="button" id="storybook-viewer-prev" class="sw-turn sw-turn--light" aria-label="Previous page"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                    <span id="storybook-viewer-pos" class="sw-reader__pos"></span>
                    <button type="button" id="storybook-viewer-next" class="sw-turn sw-turn--light" aria-label="Next page"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                </div>
                <div class="sw-reader__actions">
                    <button id="storybook-viewer-play-btn" class="sw-reader__btn sw-reader__btn--narrate">
                        <i class="fas fa-play-circle mr-2"></i> Narrate Story
                    </button>
                    <button id="storybook-viewer-print-btn" class="sw-reader__btn sw-reader__btn--print">
                        <i class="fas fa-print mr-2"></i> Print Storybook
                    </button>
                    <button id="storybook-viewer-delete-btn" class="sw-reader__btn sw-reader__btn--delete" aria-label="Delete storybook" title="Delete storybook">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="story-input-modal"
        class="sw-overlay fixed inset-0 z-[1200] flex items-center justify-center p-4 hidden">
        <div class="sw-quill pop-in">
            <header class="sw-quill__head">
                <span class="sw-quill__seal" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>
                <div>
                    <p id="story-input-eyebrow" class="sw-quill__eyebrow">The next page</p>
                    <h2 class="sw-quill__title">Continue the Chronicle</h2>
                </div>
            </header>
            <div class="sw-quill__body">
                <p id="story-input-previous" class="sw-quill__previous hidden" data-selectable></p>
                <div id="story-input-helpers" class="sw-input-helpers"></div>
                <label for="story-input-textarea" class="sw-quill__label">The Next Sentence</label>
                <textarea id="story-input-textarea" rows="4" class="sw-quill__textarea" placeholder="Once upon a time..."></textarea>
                <div class="sw-quill__meta">
                    <span id="story-input-word-check" class="sw-word-check hidden"></span>
                    <span id="story-input-count" class="sw-quill__count">0 words</span>
                </div>
                <div class="sw-quill__actions">
                    <button id="story-input-cancel-btn" class="sw-ghost-btn">Cancel</button>
                    <button id="story-input-confirm-btn" class="sw-weave-btn">
                        <i class="fas fa-feather-pointed" aria-hidden="true"></i><span>Chronicled!</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
