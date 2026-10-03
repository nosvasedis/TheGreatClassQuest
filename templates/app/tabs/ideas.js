// templates/app/tabs/ideas.js

export const ideasTabHTML = `
            <div id="reward-ideas-tab" class="app-tab hidden">
                <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
                    <!-- Tab title: Story Weavers -->
                    <header class="tab-sign tab-sign--weave">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__rod" aria-hidden="true"></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__kicker">Words · Worlds · Wonder</span>
                                <h2 class="font-title tab-sign__title">Story Weavers</h2>
                            </div>
                            <span class="tab-sign__fringe" aria-hidden="true"></span>
                            <span class="tab-sign__tassel tab-sign__tassel--l" aria-hidden="true"></span>
                            <span class="tab-sign__tassel tab-sign__tassel--r" aria-hidden="true"></span>
                        </div>
                        <p class="tab-sign__tagline">Collaborative class storytelling with AI-powered word suggestions and illustrations.</p>
                    </header>
                    <div id="sw-root" class="sw-layout">
                        <!-- The stage: the class storybook lying open on a woven tapestry -->
                        <section class="sw-stage" aria-labelledby="sw-book-heading">
                            <div class="sw-stage__motes" aria-hidden="true">
                                <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                            </div>
                            <div class="sw-stage__bar">
                                <div class="sw-stage__title">
                                    <span id="sw-class-chip" class="sw-class-chip hidden"></span>
                                    <h3 id="sw-book-heading" class="sw-stage__heading">Current Chronicle</h3>
                                    <p id="sw-stage-sub" class="sw-stage__sub">The open book shows the latest page of your class story.</p>
                                </div>
                                <div class="sw-stage__tools">
                                    <button type="button" id="story-weavers-read-btn" class="sw-tool" disabled title="Read this page aloud">
                                        <i class="fas fa-volume-high" aria-hidden="true"></i><span>Read aloud</span>
                                    </button>
                                    <button type="button" id="story-weavers-redraw-btn" class="sw-tool" disabled title="Paint a new picture for the latest page">
                                        <i class="fas fa-palette" aria-hidden="true"></i><span>Redraw</span>
                                    </button>
                                    <button type="button" id="story-weavers-reveal-btn" class="sw-reveal-btn" aria-label="Reveal story to class">
                                        <i class="fas fa-eye" aria-hidden="true"></i><span>Reveal to class</span>
                                    </button>
                                </div>
                            </div>

                            <div id="story-weavers-main-content" class="hidden">
                                <div id="sw-book" class="sw-book">
                                    <span class="sw-book__corner sw-book__corner--tl" aria-hidden="true"></span>
                                    <span class="sw-book__corner sw-book__corner--tr" aria-hidden="true"></span>
                                    <span class="sw-book__corner sw-book__corner--bl" aria-hidden="true"></span>
                                    <span class="sw-book__corner sw-book__corner--br" aria-hidden="true"></span>
                                    <div class="sw-page sw-page--left">
                                        <div id="story-weavers-image-container" class="sw-illustration">
                                            <img id="story-weavers-image" src="" alt="Story illustration" class="hidden" decoding="async" width="520" height="390">
                                            <div id="story-weavers-image-loader" class="sw-loom hidden" role="status" aria-live="polite">
                                                <div class="sw-loom__threads" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
                                                <i class="fas fa-feather-pointed sw-loom__quill" aria-hidden="true"></i>
                                                <p id="sw-loom-step" class="sw-loom__step">The Chronicler is illustrating...</p>
                                            </div>
                                            <div id="story-weavers-image-placeholder" class="sw-illustration__empty">
                                                <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                                                <p>The story awaits its illustration!</p>
                                            </div>
                                        </div>
                                        <span id="story-weavers-page-left-num" class="sw-page-number" aria-hidden="true"></span>
                                    </div>
                                    <div class="sw-spine" aria-hidden="true"></div>
                                    <div class="sw-page sw-page--right">
                                        <p id="story-weavers-chapter-label" class="sw-chapter-label">Latest page</p>
                                        <p id="story-weavers-text" class="story-weavers-story-text sw-story-text" aria-live="polite"></p>
                                        <div id="story-weavers-word-ribbon" class="sw-word-ribbon hidden">
                                            <span class="sw-word-ribbon-label">Word on this page</span>
                                            <span id="story-weavers-word-ribbon-text" class="sw-word-ribbon-word"></span>
                                        </div>
                                        <span id="story-weavers-page-right-num" class="sw-page-number" aria-hidden="true"></span>
                                    </div>
                                    <span class="sw-leaf" aria-hidden="true"></span>
                                    <span class="sw-bookmark" aria-hidden="true"></span>
                                </div>

                                <div id="sw-browse-note" class="sw-browse-note hidden">
                                    <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
                                    <span id="sw-browse-text">Looking back at an earlier page</span>
                                    <button type="button" id="sw-back-latest" class="sw-browse-note__btn">Back to the latest page <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
                                </div>

                                <div class="sw-thread-row">
                                    <button type="button" id="sw-prev-page" class="sw-turn" aria-label="Previous page"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                                    <div id="sw-thread" class="sw-thread" role="list" aria-label="Pages of this story"></div>
                                    <button type="button" id="sw-next-page" class="sw-turn" aria-label="Next page"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                                </div>
                                <div id="sw-milestone" class="sw-milestone"></div>
                            </div>

                            <div id="story-weavers-placeholder" class="sw-book-placeholder">
                                <div class="sw-closed-book" aria-hidden="true">
                                    <span class="sw-closed-book__clasp"></span>
                                    <i class="fas fa-feather-pointed"></i>
                                </div>
                                <div class="sw-book-placeholder__text">
                                    <p class="sw-book-placeholder__title">Choose a class from the header to open its storybook.</p>
                                    <p class="sw-book-placeholder__sub">You can still browse the storybook shelf below.</p>
                                </div>
                            </div>
                        </section>

                        <div class="sw-desk">
                            <!-- The Weaver's Desk: word, page, finish -->
                            <section class="sw-card sw-card--steps" aria-labelledby="sw-desk-heading">
                                <header class="sw-card__head">
                                    <span class="sw-card__icon" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>
                                    <div>
                                        <h3 id="sw-desk-heading" class="sw-card__title">Game Master Controls</h3>
                                        <p class="sw-card__sub">Pick the Word of the Day, then weave the next page together.</p>
                                    </div>
                                </header>

                                <ol class="sw-steps">
                                    <li id="sw-word-step" class="sw-step">
                                        <span class="sw-step__num" aria-hidden="true">1</span>
                                        <div class="sw-step__body">
                                            <div class="sw-step__head">
                                                <label for="story-weavers-word-input" class="sw-step__title">Word of the Day</label>
                                                <div class="sw-step__actions">
                                                    <button type="button" id="story-weavers-lucky-btn" class="sw-chip-btn" title="Pick three words from the word bank">
                                                        <i class="fas fa-dice" aria-hidden="true"></i><span>Lucky dip</span>
                                                    </button>
                                                    <button type="button" id="story-weavers-suggest-word-btn" class="sw-chip-btn sw-chip-btn--magic" title="Suggest words with AI" aria-label="Suggest words with AI">
                                                        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>Suggest</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="sw-word-field">
                                                <i class="fas fa-gem sw-word-field__gem" aria-hidden="true"></i>
                                                <input type="text" id="story-weavers-word-input" class="sw-word-input"
                                                    placeholder="Type a word, e.g. mysterious" autocomplete="off" inputmode="text" enterkeyhint="done" aria-label="Word of the Day">
                                                <button type="button" id="story-weavers-confirm-word-btn" class="sw-word-btn sw-word-btn--lock hidden" title="Lock in word" aria-label="Lock in word">
                                                    <i class="fas fa-lock" aria-hidden="true"></i><span>Lock in</span>
                                                </button>
                                                <button type="button" id="story-weavers-clear-word-btn" class="sw-word-btn sw-word-btn--clear hidden" title="Clear word" aria-label="Clear word">
                                                    <i class="fas fa-xmark" aria-hidden="true"></i>
                                                </button>
                                            </div>
                                            <div id="story-weavers-word-choices" class="sw-word-choices" aria-live="polite"></div>
                                            <div id="story-weavers-word-seal" class="sw-word-seal hidden" aria-live="polite">
                                                <span class="sw-word-seal__wax" aria-hidden="true"><i class="fas fa-gem"></i></span>
                                                <span class="sw-word-seal__text"><small>Today's word is sealed</small><strong id="story-weavers-word-seal-text"></strong></span>
                                                <button type="button" id="story-weavers-change-word-btn" class="sw-word-seal__change">Change</button>
                                            </div>
                                        </div>
                                    </li>
                                    <li id="sw-write-step" class="sw-step">
                                        <span class="sw-step__num" aria-hidden="true">2</span>
                                        <div class="sw-step__body">
                                            <p class="sw-step__title">Weave the next page</p>
                                            <p id="sw-write-hint" class="sw-step__hint">Lock in a word first. Then the class decides what happens next.</p>
                                            <button type="button" id="story-weavers-lock-in-btn" class="sw-weave-btn" disabled>
                                                <i class="fas fa-feather-pointed" aria-hidden="true"></i>
                                                <span id="sw-weave-label">Start Story...</span>
                                            </button>
                                        </div>
                                    </li>
                                    <li class="sw-step sw-step--finish">
                                        <span class="sw-step__num" aria-hidden="true">3</span>
                                        <div class="sw-step__body">
                                            <p class="sw-step__title">Close the book</p>
                                            <p class="sw-step__hint">The End binds the story into a storybook for the shelf.</p>
                                            <div class="sw-finish-row">
                                                <button type="button" id="story-weavers-end-btn" class="sw-end-btn" disabled>
                                                    <i class="fas fa-book-bookmark" aria-hidden="true"></i><span>The End</span>
                                                </button>
                                                <button type="button" id="story-weavers-history-btn" class="sw-ghost-btn">
                                                    <i class="fas fa-book-open-reader" aria-hidden="true"></i><span>Read the whole story</span>
                                                </button>
                                                <button type="button" id="story-weavers-reset-btn" class="sw-ghost-btn sw-ghost-btn--quiet">
                                                    <i class="fas fa-rotate-left" aria-hidden="true"></i><span>Start New</span>
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                </ol>
                            </section>

                            <section class="sw-card sw-helpers-card" aria-labelledby="sw-helpers-heading">
                                <header class="sw-card__head">
                                    <span class="sw-card__icon sw-card__icon--gold" aria-hidden="true"><i class="fas fa-lightbulb"></i></span>
                                    <div>
                                        <h3 id="sw-helpers-heading" class="sw-card__title">Writing Helpers</h3>
                                        <p id="story-weavers-helpers-sub" class="sw-card__sub">Scaffolds matched to the class's Quest League.</p>
                                    </div>
                                </header>
                                <p class="sw-helper-label"><i class="fas fa-shapes" aria-hidden="true"></i> Structure focus <span class="sw-helper-hint">Tap to set the pattern for the next page</span></p>
                                <div id="story-weavers-structure-hints" class="sw-structure-list" role="radiogroup" aria-label="Structure focus"></div>
                                <p class="sw-helper-label"><i class="fas fa-quote-left" aria-hidden="true"></i> Sentence starters <span class="sw-helper-hint">Tap one to begin the next page</span></p>
                                <div id="story-weavers-starters" class="sw-starter-chips"></div>
                            </section>
                        </div>

                        <!-- Finished storybooks, standing on the class shelf -->
                        <section class="sw-library" aria-labelledby="sw-shelf-heading">
                            <header class="sw-library__head">
                                <div>
                                    <h3 id="sw-shelf-heading" class="sw-card__title">Storybook Shelf</h3>
                                    <p id="sw-shelf-sub" class="sw-card__sub">Every finished story is bound and kept here.</p>
                                </div>
                                <button type="button" id="story-weavers-archive-btn" class="sw-ghost-btn sw-ghost-btn--library">
                                    <i class="fas fa-book-open" aria-hidden="true"></i><span>Open the library</span>
                                </button>
                            </header>
                            <div id="sw-shelf" class="sw-shelf"></div>
                        </section>
                    </div>
                </div>
            </div>
`;
