// templates/modals/trophyRoom.js
// Trophy room, shop, avatar maker

export const trophyRoomModalsHTML = `
    <!-- Trophy Room: a class's satchels. Hero list on the left, the chosen hero's Relics + Treasures on the right. -->
    <div id="trophy-room-modal"
        class="fixed inset-0 bg-indigo-950/60 z-[80] flex items-center justify-center p-4 hidden backdrop-blur-xl">
        <div class="trophy-room-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="trophy-room-title">
            <header class="trophy-room-head">
                <span class="trophy-room-emblem" aria-hidden="true">🏆</span>
                <div class="trophy-room-heading">
                    <h2 id="trophy-room-title" class="font-title">Trophy Room</h2>
                    <p id="trophy-room-subtitle">Every hero's satchel</p>
                </div>
                <button id="trophy-room-close-btn" type="button" class="trophy-room-close" aria-label="Close the Trophy Room">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>
            <div class="trophy-room-body">
                <nav class="trophy-room-roster" aria-label="Heroes">
                    <p class="trophy-room-roster-label">Heroes</p>
                    <div id="trophy-room-roster" class="trophy-room-roster-list custom-scrollbar"></div>
                </nav>
                <section id="trophy-room-content" class="trophy-room-content custom-scrollbar" aria-live="polite"></section>
            </div>
        </div>
    </div>



    <!-- Purchase Success Modal — z-[100] ensures it appears above the shop (z-[80]) -->
    <div id="shop-purchase-modal"
        class="fixed inset-0 bg-black/75 backdrop-blur-xl z-[100] flex items-center justify-center p-4 hidden">
        <div class="shop-purchase-shell pop-in">

            <!-- Outer glow ring -->
            <div class="shop-purchase-glow" aria-hidden="true"></div>

            <!-- Confetti burst particles -->
            <div class="shop-purchase-confetti-layer" aria-hidden="true">
                <span class="spc spc--1"></span>
                <span class="spc spc--2"></span>
                <span class="spc spc--3"></span>
                <span class="spc spc--4"></span>
                <span class="spc spc--5"></span>
                <span class="spc spc--6"></span>
                <span class="spc spc--7"></span>
                <span class="spc spc--8"></span>
                <span class="spc spc--9"></span>
                <span class="spc spc--10"></span>
            </div>

            <!-- Floating emoji particles -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden">
                <div class="shop-purchase-float shop-purchase-float--1">✨</div>
                <div class="shop-purchase-float shop-purchase-float--2">⭐</div>
                <div class="shop-purchase-float shop-purchase-float--3">💫</div>
                <div class="shop-purchase-float shop-purchase-float--4">🪙</div>
                <div class="shop-purchase-float shop-purchase-float--5">🎉</div>
            </div>

            <!-- Success Header -->
            <div class="shop-purchase-header">
                <div class="shop-purchase-header__glow" aria-hidden="true"></div>
                <div class="shop-purchase-header__icon">🛒</div>
                <h2 class="shop-purchase-header__title">Purchase Complete!</h2>
                <p class="shop-purchase-header__sub">Added to your collection</p>
            </div>

            <!-- Content -->
            <div class="shop-purchase-body">

                <!-- Item card with shine -->
                <div id="shop-purchase-item" class="shop-purchase-item-card">
                    <div class="shop-purchase-item-card__shine" aria-hidden="true"></div>
                    <div id="shop-purchase-icon" class="text-5xl mb-2 flex justify-center items-center min-h-[60px] relative z-10">📦</div>
                    <h3 id="shop-purchase-name" class="font-title text-xl text-amber-300 leading-tight relative z-10">Item Name</h3>
                    <p id="shop-purchase-desc" class="text-indigo-300 text-xs mt-1 line-clamp-2 leading-relaxed relative z-10">Item description</p>
                </div>

                <!-- Cost / Balance row -->
                <div class="flex justify-center gap-3 mb-4">
                    <div class="shop-purchase-stat shop-purchase-stat--cost">
                        <p class="shop-purchase-stat__label">Cost</p>
                        <p id="shop-purchase-cost" class="shop-purchase-stat__value">-10 🪙</p>
                    </div>
                    <div class="shop-purchase-stat shop-purchase-stat--balance">
                        <p class="shop-purchase-stat__label">Gold</p>
                        <p id="shop-purchase-balance" class="shop-purchase-stat__value">90 🪙</p>
                    </div>
                </div>

                <!-- Student badge -->
                <p id="shop-purchase-student"
                   class="text-indigo-300 text-xs mb-4 flex items-center justify-center gap-2 bg-indigo-800/40 px-3 py-2 rounded-full border border-indigo-600/30 mx-auto w-fit">
                    <i class="fas fa-user text-indigo-400"></i>
                    <span class="font-bold text-indigo-200">Student Name</span>'s inventory
                </p>

                <!-- Action buttons -->
                <div class="flex flex-col gap-2.5 mb-3">
                    <button id="shop-purchase-use-btn"
                        class="hidden shop-purchase-use-btn">
                        <i class="fas fa-bolt mr-2"></i>Use Now
                    </button>
                    <button id="shop-purchase-close-btn" class="shop-purchase-close-btn">
                        <span class="shop-purchase-close-btn__shimmer"></span>
                        <i class="fas fa-check mr-2"></i>Awesome!
                    </button>
                </div>

                <!-- Auto-close progress bar -->
                <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div id="shop-purchase-timer-bar"
                         class="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-none"
                         style="width:100%;"></div>
                </div>
                <p class="text-indigo-500 text-[10px] mt-1.5">Closes automatically in 3 seconds</p>
            </div>
        </div>
    </div>

    <div id="avatar-maker-modal" class="af-overlay fixed inset-0 z-[72] hidden" role="dialog" aria-modal="true" aria-labelledby="avatar-maker-title">
        <!-- Soot, heat haze and rising embers behind the forge -->
        <div class="af-backdrop" aria-hidden="true">
            <div class="af-backdrop__heat"></div>
            <div id="forge-particles-container" class="af-embers"></div>
        </div>

        <div class="af-card pop-in">
            <span class="af-rivet af-rivet--tl" aria-hidden="true"></span>
            <span class="af-rivet af-rivet--tr" aria-hidden="true"></span>
            <span class="af-rivet af-rivet--bl" aria-hidden="true"></span>
            <span class="af-rivet af-rivet--br" aria-hidden="true"></span>

            <!-- Header: the hearth's glowing arch with the forge's name hammered above it -->
            <header class="af-header">
                <div class="af-hearth" aria-hidden="true"><span class="af-hearth__fire"></span></div>
                <div class="af-header__crest" aria-hidden="true">
                    <svg viewBox="0 0 64 64" class="af-hammer-icon"><path d="M14 20l14-10 8 8-4 4 22 22a4 4 0 0 1-6 6L26 28l-4 4z" fill="currentColor"/><path d="M8 56h30v4H8z" fill="currentColor" opacity=".55"/></svg>
                </div>
                <div class="af-header__text">
                    <p class="af-eyebrow">Hammer · Heat · Heart</p>
                    <h2 id="avatar-maker-title" class="af-title">Avatar Forge</h2>
                    <p id="avatar-maker-student-name" class="af-subtitle"></p>
                </div>
                <button id="avatar-maker-close-btn" type="button" class="af-close" aria-label="Close the Avatar Forge">&times;</button>
            </header>

            <div class="af-body">
                <!-- The anvil: live portrait, forging state and the actions -->
                <section class="af-anvil" aria-label="Portrait on the anvil">
                    <div class="af-anvil__stage">
                        <div class="af-ring" aria-hidden="true"></div>
                        <div id="avatar-display-area" class="af-portrait">
                            <div id="avatar-maker-placeholder" class="af-portrait__empty">
                                <span class="af-portrait__ingot" aria-hidden="true"></span>
                                <p class="af-portrait__title">Cold anvil</p>
                                <p class="af-portrait__hint">Choose a creature, a colour and a relic to heat the metal</p>
                            </div>
                            <div id="avatar-maker-loader" class="af-portrait__loader hidden" aria-live="polite">
                                <svg viewBox="0 0 64 64" class="af-loader-hammer" aria-hidden="true"><path d="M14 20l14-10 8 8-4 4 22 22a4 4 0 0 1-6 6L26 28l-4 4z" fill="currentColor"/></svg>
                                <span class="af-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
                                <p id="avatar-maker-loader-text" class="af-loader-text">Heating the metal…</p>
                            </div>
                            <img id="avatar-maker-img" class="af-portrait__img hidden" src="" alt="Forged avatar portrait">
                        </div>
                        <div class="af-anvil__block" aria-hidden="true"></div>
                    </div>

                    <p id="avatar-recipe-summary" class="af-recipe" aria-live="polite"></p>

                    <div class="af-actions">
                        <div class="af-actions__row af-actions__row--strike">
                            <button id="avatar-generate-btn" type="button" class="af-strike" disabled>
                                <span class="af-strike__glow" aria-hidden="true"></span>
                                <i class="fas fa-hammer" aria-hidden="true"></i>
                                <span>Strike the Anvil</span>
                            </button>
                            <button id="avatar-surprise-btn" type="button" class="af-btn-iron af-btn-iron--dice" title="Pick a random recipe" aria-label="Surprise me: pick a random recipe">
                                <i class="fas fa-dice" aria-hidden="true"></i><span class="af-btn-iron__label">Surprise me</span>
                            </button>
                        </div>

                        <div id="avatar-post-generation-btns" class="af-post af-actions__row hidden">
                            <button id="avatar-save-btn" type="button" class="af-keep">
                                <i class="fas fa-save" aria-hidden="true"></i><span>Keep this portrait</span>
                            </button>
                            <button id="avatar-retry-btn" type="button" class="af-btn-iron">
                                <i class="fas fa-redo-alt" aria-hidden="true"></i><span>Strike again</span>
                            </button>
                        </div>

                        <div id="avatar-forge-gallery-wrap" class="af-gallery hidden">
                            <p class="af-gallery__label">This session's strikes · tap one to keep it instead</p>
                            <div id="avatar-forge-gallery" class="af-gallery__row"></div>
                        </div>

                        <button id="avatar-delete-btn" type="button" class="af-melt hidden">
                            <i class="fas fa-trash-alt" aria-hidden="true"></i><span>Melt the current portrait</span>
                        </button>
                    </div>
                </section>

                <!-- The workbench: recipe steps -->
                <div id="avatar-maker-options-wrapper" class="af-bench custom-scrollbar">
                    <div class="af-progress" aria-hidden="true">
                        <span class="af-progress__label">Heat</span>
                        <div class="af-progress__bar">
                            <div id="step-creature-dot" class="af-progress__seg"></div>
                            <div id="step-color-dot" class="af-progress__seg"></div>
                            <div id="step-accessory-dot" class="af-progress__seg"></div>
                        </div>
                    </div>

                    <section class="af-step" aria-labelledby="af-step-creature">
                        <div class="af-step__head">
                            <span class="af-step__num">1</span>
                            <div>
                                <h3 id="af-step-creature" class="af-step__title">The Creature</h3>
                                <p class="af-step__hint">Who steps out of the fire?</p>
                            </div>
                            <span id="step-creature-check" class="af-step__check" aria-hidden="true"><i class="fas fa-check"></i></span>
                        </div>
                        <div id="avatar-creature-pool" class="af-pool" role="group" aria-label="Creature"></div>
                    </section>

                    <section class="af-step" aria-labelledby="af-step-color">
                        <div class="af-step__head">
                            <span class="af-step__num">2</span>
                            <div>
                                <h3 id="af-step-color" class="af-step__title">The Colour</h3>
                                <p class="af-step__hint">The metal's main hue</p>
                            </div>
                            <span id="step-color-check" class="af-step__check" aria-hidden="true"><i class="fas fa-check"></i></span>
                        </div>
                        <div id="avatar-color-pool" class="af-pool af-pool--colors" role="group" aria-label="Colour"></div>
                    </section>

                    <section class="af-step" aria-labelledby="af-step-accessory">
                        <div class="af-step__head">
                            <span class="af-step__num">3</span>
                            <div>
                                <h3 id="af-step-accessory" class="af-step__title">The Relic</h3>
                                <p class="af-step__hint">Something to hold or wear</p>
                            </div>
                            <span id="step-accessory-check" class="af-step__check" aria-hidden="true"><i class="fas fa-check"></i></span>
                        </div>
                        <div id="avatar-accessory-pool" class="af-pool" role="group" aria-label="Relic"></div>
                    </section>

                    <section class="af-step af-step--temper" aria-labelledby="af-step-temper">
                        <div class="af-step__head">
                            <span class="af-step__num af-step__num--temper"><i class="fas fa-fire-alt" aria-hidden="true"></i></span>
                            <div>
                                <h3 id="af-step-temper" class="af-step__title">Tempering</h3>
                                <p class="af-step__hint">Optional finishing touches, already set to good defaults</p>
                            </div>
                        </div>

                        <p class="af-sub">Art style</p>
                        <div id="avatar-style-pool" class="af-pool af-pool--tiles" role="group" aria-label="Art style"></div>

                        <p class="af-sub">Mood</p>
                        <div id="avatar-mood-pool" class="af-pool" role="group" aria-label="Mood"></div>

                        <p class="af-sub">Backdrop</p>
                        <div id="avatar-backdrop-pool" class="af-pool" role="group" aria-label="Backdrop"></div>

                        <p class="af-sub">Framing</p>
                        <div id="avatar-framing-pool" class="af-pool" role="group" aria-label="Framing"></div>

                        <label class="af-sub" for="avatar-special-input">A special touch <span class="af-sub__note">(optional)</span></label>
                        <div class="af-engrave">
                            <input id="avatar-special-input" type="text" maxlength="60" autocomplete="off" spellcheck="true"
                                placeholder="e.g. freckles and a star-shaped badge">
                            <span id="avatar-special-count" class="af-engrave__count">0/60</span>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>

`;
