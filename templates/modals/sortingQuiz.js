// templates/modals/sortingQuiz.js — The Guild Sorting Ceremony (one full-screen stage)
// Stages (data-stage on #sorting-quiz-modal): intro → question → seal → reveal → result.
// Behaviour: ui/modals/sortingQuiz.js. Styles: styles/sorting_ceremony.css.

const RUNE_RING = 'ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ ✦ ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ✦';

export const sortingQuizModalsHTML = `
    <div id="sorting-quiz-modal"
        class="sq fixed inset-0 z-[72] hidden"
        data-stage="intro"
        role="dialog"
        aria-labelledby="sorting-quiz-title"
        aria-modal="true">

        <div class="sq-sky" aria-hidden="true">
            <div class="sq-sky__nebula"></div>
            <div class="sq-sky__stars sq-sky__stars--far"></div>
            <div class="sq-sky__stars sq-sky__stars--near"></div>
            <div class="sq-sky__motes"></div>
            <div class="sq-sky__flood"></div>
        </div>
        <div class="sq-portal" aria-hidden="true"></div>
        <canvas id="sq-sparks" class="sq-sparks" aria-hidden="true"></canvas>
        <div class="sq-flash" aria-hidden="true"></div>

        <button id="sorting-quiz-cancel-btn" type="button" class="sq-close" aria-label="Leave the Sorting Ceremony">
            <i class="fas fa-times"></i>
        </button>

        <div class="sq-stage">
            <!-- The Sorting Sigil: rune circle, orb, four house seats -->
            <div class="sq-sigil" id="sq-sigil">
                <svg class="sq-sigil__runes" viewBox="0 0 200 200" aria-hidden="true">
                    <defs>
                        <path id="sq-rune-path" d="M100,100 m-86,0 a86,86 0 1,1 172,0 a86,86 0 1,1 -172,0"/>
                    </defs>
                    <circle cx="100" cy="100" r="96" class="sq-sigil__line"/>
                    <circle cx="100" cy="100" r="78" class="sq-sigil__line sq-sigil__line--thin"/>
                    <polygon points="100,8 192,100 100,192 8,100" class="sq-sigil__line sq-sigil__line--thin"/>
                    <polygon points="35,35 165,35 165,165 35,165" class="sq-sigil__line sq-sigil__line--faint"/>
                    <text class="sq-sigil__runetext"><textPath href="#sq-rune-path">${RUNE_RING}</textPath></text>
                </svg>
                <div class="sq-orb" id="sq-orb">
                    <div class="sq-orb__swirl"></div>
                    <div class="sq-orb__glass"></div>
                    <span class="sq-orb__glyph" id="sorting-quiz-question-emoji">🔮</span>
                </div>
                <div class="sq-ring" id="sq-ring"></div>
            </div>

            <!-- Intro -->
            <section class="sq-panel sq-panel--intro" data-panel="intro">
                <div class="sq-hero" id="sq-hero"></div>
                <p class="sq-kicker">The Guild Hall calls a new hero</p>
                <h2 id="sorting-quiz-title" class="sq-title">The Sorting Ceremony</h2>
                <p class="sq-lede" id="sq-intro-lede">Four great houses are waiting. Answer from the heart: there are no wrong answers.</p>
                <p class="sq-chip-row">
                    <span class="sq-chip" id="sq-intro-count">🎲 7 questions, just for you</span>
                    <span class="sq-chip">✨ One tap per answer</span>
                </p>
                <button id="sq-begin-btn" type="button" class="sq-btn sq-btn--gold">
                    <span>Begin the Sorting</span> <i class="fas fa-wand-magic-sparkles"></i>
                </button>
            </section>

            <!-- Question -->
            <section class="sq-panel sq-panel--question" data-panel="question">
                <div class="sq-runes" id="sorting-quiz-dots" aria-hidden="true"></div>
                <p id="sorting-quiz-progress" class="sq-progress" aria-live="polite">Question 1 of 7</p>
                <div id="sorting-quiz-question" class="sq-question">
                    <p id="sorting-quiz-question-text" class="sq-question__text"></p>
                    <div id="sorting-quiz-options" class="sq-options"></div>
                </div>
                <div class="sq-footer">
                    <button id="sq-back-btn" type="button" class="sq-btn sq-btn--ghost">
                        <i class="fas fa-arrow-left"></i> <span>Back</span>
                    </button>
                </div>
            </section>

            <!-- Seal: all answers given, the teacher builds the moment -->
            <section class="sq-panel sq-panel--seal" data-panel="seal">
                <p class="sq-kicker">Every answer has been heard</p>
                <h2 class="sq-title sq-title--small">The orb is ready…</h2>
                <p class="sq-lede">When the whole class is watching, reveal the house.</p>
                <div class="sq-footer sq-footer--center">
                    <button id="sq-seal-back-btn" type="button" class="sq-btn sq-btn--ghost">
                        <i class="fas fa-arrow-left"></i> <span>Change an answer</span>
                    </button>
                    <button id="sorting-quiz-next-btn" type="button" class="sq-btn sq-btn--gold sq-btn--big">
                        <span>Reveal my Guild</span> <i class="fas fa-star"></i>
                    </button>
                </div>
            </section>

            <!-- Reveal: the spotlight circles the houses -->
            <section class="sq-panel sq-panel--reveal" data-panel="reveal" aria-live="polite">
                <p class="sq-reveal-line" id="sq-reveal-line">The stars are deciding…</p>
            </section>

            <!-- Result -->
            <section id="sorting-quiz-result-card" class="sq-panel sq-panel--result" data-panel="result">
                <div class="sq-crest">
                    <div class="sq-crest__rays" aria-hidden="true"></div>
                    <div class="sq-crest__halo" aria-hidden="true"></div>
                    <div id="sorting-quiz-result-emblem" class="sq-crest__emblem"></div>
                </div>
                <p class="sq-kicker sq-kicker--result" id="sorting-quiz-result-title">The stars have spoken</p>
                <p class="sq-result-who" id="sq-result-who"></p>
                <h2 id="sorting-quiz-result-name" class="sq-result-name"></h2>
                <p id="sorting-quiz-result-motto" class="sq-result-motto"></p>
                <div class="sq-traits" id="sq-result-traits"></div>
                <p class="sq-result-why" id="sq-result-why"></p>
                <div class="sq-echo" id="sq-result-echo"></div>
                <p class="sq-result-msg">Every star you earn now writes Glory for your guild. Give it your all! ⭐</p>
                <button id="sorting-quiz-result-done-btn" type="button" class="sq-btn sq-btn--guild sq-btn--big">
                    <span>Take my place in the Guild Hall</span> <i class="fas fa-shield-halved"></i>
                </button>
            </section>

            <!-- Error (save failed) -->
            <section class="sq-panel sq-panel--error" data-panel="error" role="alert">
                <p class="sq-kicker">The magic flickered</p>
                <h2 class="sq-title sq-title--small">We couldn't save the house</h2>
                <p class="sq-lede">Check the connection and try the reveal again. The answers are kept.</p>
                <div class="sq-footer sq-footer--center">
                    <button id="sq-retry-btn" type="button" class="sq-btn sq-btn--gold"><span>Try again</span> <i class="fas fa-rotate-right"></i></button>
                </div>
            </section>
        </div>
    </div>
`;
