// templates/modals/hero.js
// Hero celebration, hero stats, hero chronicle, prodigy
import { PRODIGY_HALL_DEFS_SVG, PRODIGY_ROSE_WINDOW_SVG } from '../../ui/modals/prodigyHallView.js';

export const heroModalsHTML = `
    <div id="hero-celebration-modal"
        class="fixed inset-0 z-[95] flex items-center justify-center p-4 hidden"
        style="background: radial-gradient(ellipse at 40% 25%, rgba(109,40,217,0.97) 0%, rgba(10,4,42,0.99) 100%);">

        <!-- Floating star particles -->
        <div class="hcd-particles" aria-hidden="true">
            <span class="hcd-p hcd-p1">⭐</span>
            <span class="hcd-p hcd-p2">✨</span>
            <span class="hcd-p hcd-p3">⭐</span>
            <span class="hcd-p hcd-p4">✨</span>
            <span class="hcd-p hcd-p5">🌟</span>
            <span class="hcd-p hcd-p6">✨</span>
            <span class="hcd-p hcd-p7">⭐</span>
            <span class="hcd-p hcd-p8">✨</span>
            <span class="hcd-p hcd-p9">🌟</span>
            <span class="hcd-p hcd-p10">⭐</span>
            <span class="hcd-p hcd-p11">✨</span>
            <span class="hcd-p hcd-p12">⭐</span>
        </div>

        <!-- Rotating golden light-ray burst -->
        <div class="hcd-rays-wrap" aria-hidden="true">
            <div class="hcd-rays"></div>
        </div>

        <!-- Main card -->
        <div class="hcd-card pop-in">
            <!-- Card shimmer sweep overlay -->
            <div class="hcd-card-shimmer" aria-hidden="true"></div>

            <!-- Crown -->
            <div class="hcd-crown-section" aria-hidden="true">
                <span class="hcd-crown-glow"></span>
                <span class="hcd-crown">👑</span>
            </div>

            <!-- "Hero of the Day" badge -->
            <div class="hcd-badge">
                <i class="fas fa-star hcd-badge-star"></i>
                <span>Hero of the Day</span>
                <i class="fas fa-star hcd-badge-star"></i>
            </div>

            <!-- Avatar with spinning golden rings -->
            <div class="hcd-avatar-wrap">
                <div class="hcd-ring-spinner" aria-hidden="true"></div>
                <div class="hcd-ring-pulse-el" aria-hidden="true"></div>
                <div id="hero-celebration-avatar" class="hcd-avatar"></div>
            </div>

            <!-- Student name with shimmer -->
            <h2 id="hero-celebration-name" class="hcd-name font-title">Student Name</h2>

            <!-- Gem divider -->
            <div class="hcd-divider" aria-hidden="true">
                <span class="hcd-div-line"></span>
                <span class="hcd-div-gems">◆◆◆</span>
                <span class="hcd-div-line"></span>
            </div>

            <!-- Reason text -->
            <p id="hero-celebration-reason" class="hcd-reason">For Outstanding Courage</p>

            <!-- Huzzah button -->
            <button id="hero-celebration-close-btn" class="hcd-btn bubbly-button">
                <i class="fas fa-crown"></i>
                <span>Huzzah!</span>
                <span class="hcd-btn-shine" aria-hidden="true"></span>
            </button>

            <!-- Bottom decorative line -->
            <div class="hcd-bottom-deco" aria-hidden="true">
                <span>⚔️</span>
                <span class="hcd-scrollwork">— ✦ ✦ ✦ —</span>
                <span>🛡️</span>
            </div>
        </div>
    </div>

    <div id="hero-level-up-modal"
        class="fixed inset-0 bg-black bg-opacity-85 z-[96] flex items-center justify-center p-4 hidden">
        <div id="hero-level-up-modal-inner"
            class="bg-gradient-to-b from-indigo-900 via-purple-900 to-violet-900 rounded-[2.5rem] shadow-2xl max-w-md w-full pop-in border-4 border-amber-400/90 relative overflow-hidden text-center p-8">
            <div class="absolute inset-0 opacity-25" style="background: radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.4) 0%, transparent 60%);"></div>
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
            <div class="absolute top-4 left-1/2 -translate-x-1/2 text-6xl opacity-90 animate-bounce" style="animation-duration: 1.2s;">✨</div>
            <div class="absolute top-12 right-6 text-4xl opacity-70">🌟</div>
            <div class="absolute top-14 left-6 text-4xl opacity-70">🌟</div>

            <div class="relative z-10 pt-10">
                <div class="inline-block px-4 py-1.5 rounded-full bg-amber-400/95 text-amber-900 font-title font-bold text-lg shadow-[0_0_24px_rgba(250,204,21,0.5)] mb-4">
                    LEVEL UP!
                </div>
                <div id="hero-level-up-avatar"
                    class="w-28 h-28 mx-auto rounded-full border-4 border-amber-400/90 shadow-2xl mb-4 bg-white flex items-center justify-center text-5xl font-bold text-indigo-500 overflow-hidden">
                </div>
                <h2 id="hero-level-up-name" class="font-title text-3xl text-white mb-1 text-shadow-lg">Student</h2>
                <p id="hero-level-up-subtitle" class="text-purple-200 text-sm font-semibold mb-2">reached a new rank</p>
                <div id="hero-level-up-title-badge" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white font-title text-xl font-bold mb-2 shadow-lg" style="background: linear-gradient(135deg, #a855f7, #7c3aed); border: 2px solid rgba(255,255,255,0.3);">
                    <span id="hero-level-up-title-icon"></span>
                    <span id="hero-level-up-title-text">Tinkerer</span>
                </div>
                <p id="hero-level-up-level" class="text-amber-300 text-sm font-bold mb-6">Level <span id="hero-level-up-level-num">2</span></p>
                <p class="text-white/80 text-sm mb-5">Choose a new skill in the Skill Tree!</p>
                <div class="flex flex-col sm:flex-row gap-3 justify-center">
                    <button id="hero-level-up-skill-tree-btn"
                        class="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-900 font-title text-lg py-3 px-6 rounded-xl bubbly-button shadow-xl border-2 border-amber-300/50">
                        <i class="fas fa-sitemap mr-2"></i> Open Skill Tree
                    </button>
                    <button id="hero-level-up-close-btn"
                        class="bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-6 rounded-xl transition-colors border border-white/30">
                        Later
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="hero-chronicle-modal"
        class="hc-overlay fixed inset-0 z-[72] flex items-center justify-center p-3 sm:p-5 hidden"
        role="dialog" aria-modal="true" aria-labelledby="hero-chronicle-title" data-chronicle-tab="notes">
        <div class="hc-book pop-in">
            <span class="hc-book__corner hc-book__corner--tl" aria-hidden="true"></span>
            <span class="hc-book__corner hc-book__corner--tr" aria-hidden="true"></span>
            <span class="hc-book__bookmark" aria-hidden="true"></span>

            <!-- Cover: the hero's portrait, the book's title and the bookmark tabs -->
            <header class="hc-cover">
                <div class="hc-cover__hero">
                    <div class="hc-medallion" aria-hidden="true">
                        <div id="hero-chronicle-avatar" class="hc-medallion__portrait">
                            <!-- Avatar injected here -->
                        </div>
                    </div>
                    <div class="hc-cover__titles">
                        <h2 id="hero-chronicle-title" class="hc-cover__title font-title">Hero's Chronicle</h2>
                        <p id="hero-chronicle-student-name" class="hc-cover__name"></p>
                    </div>
                </div>

                <div class="hc-tabs" role="tablist" aria-label="Chronicle sections">
                    <button type="button" id="chronicle-tab-notes" role="tab" aria-selected="true" aria-controls="hero-chronicle-content-notes"
                        class="hero-chronicle-tab-btn hc-tab hc-tab--notes active">
                        <span class="hc-tab__icon" aria-hidden="true"><i class="fas fa-feather-pointed"></i></span>
                        <span class="hc-tab__text"><span class="hc-tab__label">Notes</span><span class="hc-tab__hint">Deeds you record</span></span>
                    </button>
                    <button type="button" id="chronicle-tab-oaths" role="tab" aria-selected="false" aria-controls="hero-chronicle-content-oaths"
                        class="hero-chronicle-tab-btn hc-tab hc-tab--oaths">
                        <span class="hc-tab__icon" aria-hidden="true"><i class="fas fa-fire-flame-curved"></i></span>
                        <span class="hc-tab__text"><span class="hc-tab__label">Oaths</span><span class="hc-tab__hint">Promises they keep</span></span>
                    </button>
                    <button type="button" id="chronicle-tab-oracle" role="tab" aria-selected="false" aria-controls="hero-chronicle-content-oracle"
                        class="hero-chronicle-tab-btn hc-tab hc-tab--oracle">
                        <span class="hc-tab__icon" aria-hidden="true"><i class="fas fa-wand-sparkles"></i></span>
                        <span class="hc-tab__text"><span class="hc-tab__label">The Oracle</span><span class="hc-tab__hint">AI counsel</span></span>
                    </button>
                </div>

                <button type="button" id="hero-chronicle-close-btn" class="hc-close" aria-label="Close Hero's Chronicle">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>

            <!-- Pages -->
            <div class="hc-pages">

                <!-- Notes: history of deeds on the left page, the quill on the right -->
                <div id="hero-chronicle-content-notes" role="tabpanel" aria-labelledby="chronicle-tab-notes" class="hc-panel hc-panel--notes">
                    <section class="hc-page hc-page--history" aria-label="History of deeds">
                        <div class="hc-page__head">
                            <h3 class="hc-page__title"><i class="fas fa-scroll" aria-hidden="true"></i> History of Deeds</h3>
                            <span id="chronicle-note-count" class="hc-tally">0 Notes</span>
                        </div>
                        <div id="hero-chronicle-notes-feed" class="hc-feed">
                            <!-- Notes injected here -->
                        </div>
                    </section>

                    <section class="hc-page hc-page--quill" aria-labelledby="hc-quill-title">
                        <form id="hero-chronicle-note-form" class="hc-quill">
                            <input type="hidden" id="hero-chronicle-note-id">
                            <div class="hc-quill__head">
                                <span class="hc-quill__nib" aria-hidden="true"><i class="fas fa-pen-nib"></i></span>
                                <div>
                                    <h3 id="hc-quill-title" class="hc-quill__title font-title">
                                        <span class="hc-quill__title-new">Write an entry</span>
                                        <span class="hc-quill__title-edit">Editing an entry</span>
                                    </h3>
                                    <p class="hc-quill__sub">Private to you. Parents never see these notes.</p>
                                </div>
                            </div>

                            <div class="hc-field">
                                <label for="hero-chronicle-note-category" class="hc-field__label">What is it about?</label>
                                <div class="hc-cats" role="radiogroup" aria-label="Focus category">
                                    <button type="button" class="hc-cat hc-cat--general" data-category="General" role="radio" aria-checked="true"><i class="fas fa-bookmark" aria-hidden="true"></i>General</button>
                                    <button type="button" class="hc-cat hc-cat--academic" data-category="Academic" role="radio" aria-checked="false"><i class="fas fa-graduation-cap" aria-hidden="true"></i>Academic</button>
                                    <button type="button" class="hc-cat hc-cat--behavior" data-category="Behavior" role="radio" aria-checked="false"><i class="fas fa-masks-theater" aria-hidden="true"></i>Behavior</button>
                                    <button type="button" class="hc-cat hc-cat--social" data-category="Social" role="radio" aria-checked="false"><i class="fas fa-comments" aria-hidden="true"></i>Social</button>
                                    <button type="button" class="hc-cat hc-cat--goals" data-category="Goals" role="radio" aria-checked="false"><i class="fas fa-bullseye" aria-hidden="true"></i>Goals</button>
                                </div>
                                <select id="hero-chronicle-note-category" class="hc-visually-hidden" tabindex="-1" aria-hidden="true">
                                    <option value="General">📓 General</option>
                                    <option value="Academic">🎓 Academic</option>
                                    <option value="Behavior">🎭 Behavior</option>
                                    <option value="Social">💬 Social</option>
                                    <option value="Goals">🎯 Goals</option>
                                </select>
                            </div>

                            <div class="hc-field hc-field--grow">
                                <label for="hero-chronicle-note-text" class="hc-field__label">What happened?</label>
                                <textarea id="hero-chronicle-note-text" rows="5" class="hc-lined"
                                    placeholder="What happened on today's quest?"></textarea>
                            </div>

                            <div class="hc-quill__actions">
                                <button type="submit" class="hc-seal-btn font-title">Save Note</button>
                                <button type="button" id="hero-chronicle-cancel-edit-btn" class="hc-ghost-btn hidden">Cancel Editing</button>
                            </div>
                        </form>
                    </section>
                </div>

                <!-- Oaths: rendered by ui/modals/emberOaths.js -->
                <div id="hero-chronicle-content-oaths" role="tabpanel" aria-labelledby="chronicle-tab-oaths" class="hc-panel hc-panel--oaths hidden"></div>

                <!-- The Oracle: choose a counsel, read the answer -->
                <div id="hero-chronicle-content-oracle" role="tabpanel" aria-labelledby="chronicle-tab-oracle" class="hc-panel hc-panel--oracle hidden">
                    <aside class="hc-oracle-side">
                        <div class="hc-oracle-ask">
                            <span class="hc-orb hc-orb--small" aria-hidden="true"></span>
                            <div>
                                <h3 class="hc-oracle-ask__title font-title">Ask the Oracle</h3>
                                <p class="hc-oracle-ask__sub">It reads the notes, trials and stars in this book.</p>
                            </div>
                        </div>

                        <div class="hc-counsels">
                            <button type="button" data-type="parent" class="ai-insight-btn hc-counsel">
                                <span class="hc-counsel__glyph" aria-hidden="true">👪</span>
                                <span class="hc-counsel__text"><span class="hc-counsel__name">Parent Summary</span><span class="hc-counsel__hint">Balanced &amp; constructive</span></span>
                            </button>
                            <button type="button" data-type="teacher" class="ai-insight-btn hc-counsel">
                                <span class="hc-counsel__glyph" aria-hidden="true">🧑‍🏫</span>
                                <span class="hc-counsel__text"><span class="hc-counsel__name">Teacher Strategy</span><span class="hc-counsel__hint">Actionable classroom tips</span></span>
                            </button>
                            <button type="button" data-type="analysis" class="ai-insight-btn hc-counsel">
                                <span class="hc-counsel__glyph" aria-hidden="true">📊</span>
                                <span class="hc-counsel__text"><span class="hc-counsel__name">Traits &amp; Trends</span><span class="hc-counsel__hint">Strengths and weaknesses</span></span>
                            </button>
                            <button type="button" data-type="goal" class="ai-insight-btn hc-counsel">
                                <span class="hc-counsel__glyph" aria-hidden="true">🎯</span>
                                <span class="hc-counsel__text"><span class="hc-counsel__name">Hero's Goal</span><span class="hc-counsel__hint">A SMART target for the month</span></span>
                            </button>
                        </div>

                        <button type="button" id="hero-chronicle-publish-parent-btn" class="hc-publish">
                            <span class="hc-publish__icon" aria-hidden="true"><i class="fas fa-paper-plane"></i></span>
                            <span class="hc-publish__text"><span class="hc-publish__name">Publish to Parent Portal</span><span class="hc-publish__hint">Writes a parent-safe summary families can read</span></span>
                        </button>
                    </aside>

                    <section class="hc-oracle-main" aria-label="The Oracle's response">
                        <div class="hc-oracle-main__head">
                            <h3 class="hc-page__title"><i class="fas fa-eye" aria-hidden="true"></i> The Oracle's Response</h3>
                            <div id="oracle-status-badge" class="hc-oracle-badge">
                                <span aria-hidden="true"></span>
                                Elite AI Active
                            </div>
                        </div>
                        <div id="hero-chronicle-ai-output" class="hc-oracle-sheet rich-text" aria-live="polite">
                            <div class="hc-oracle-empty">
                                <span class="hc-orb" aria-hidden="true"></span>
                                <p>Choose a counsel on the left to receive the Oracle's wisdom.</p>
                            </div>
                        </div>
                    </section>
                </div>

            </div>
        </div>
    </div>

    <div id="prodigy-modal" class="ph-backdrop fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-4 hidden">
        <div class="prodigy-hall-shell ph-hall pop-in" role="dialog" aria-modal="true" aria-labelledby="prodigy-hall-title">
            ${PRODIGY_HALL_DEFS_SVG}
            <!-- The hall itself: marble wall, arches, columns, banners and the rose window's light -->
            <div class="ph-architecture" aria-hidden="true">
                <span class="ph-arch ph-arch--l"></span>
                <span class="ph-arch ph-arch--c"></span>
                <span class="ph-arch ph-arch--r"></span>
                <div class="ph-rose">${PRODIGY_ROSE_WINDOW_SVG}</div>
                <span class="ph-ray ph-ray--1"></span>
                <span class="ph-ray ph-ray--2"></span>
                <span class="ph-ray ph-ray--3"></span>
                <span class="ph-banner ph-banner--l"><span class="ph-banner__emblem"><i class="fas fa-crown"></i></span></span>
                <span class="ph-banner ph-banner--r"><span class="ph-banner__emblem"><i class="fas fa-crown"></i></span></span>
                <span class="ph-column ph-column--l"></span>
                <span class="ph-column ph-column--r"></span>
                <div class="ph-motes">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
                <span class="ph-floor"></span>
            </div>

            <header class="ph-frieze">
                <span class="ph-frieze__crest" aria-hidden="true"><i class="fas fa-landmark"></i></span>
                <div class="ph-frieze__titles">
                    <h2 id="prodigy-hall-title" class="ph-frieze__title">Hall of Prodigies</h2>
                    <p class="ph-frieze__sub">One crown for every month this school year</p>
                </div>
                <div id="prodigy-nav-container" class="ph-nav"></div>
                <button type="button" id="prodigy-close-btn" class="ph-close" aria-label="Close Hall of Prodigies">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <div id="prodigy-content" class="ph-content custom-scrollbar">
                <!-- Content injected here -->
            </div>

            <nav id="prodigy-year-strip" class="ph-year" aria-label="This year's Prodigies by month"></nav>
        </div>
    </div>
`;
