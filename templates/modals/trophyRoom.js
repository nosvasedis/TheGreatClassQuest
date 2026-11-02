// templates/modals/trophyRoom.js
// Trophy room, shop, avatar maker

export const trophyRoomModalsHTML = `
    <!-- The Satchel (code name: trophy room): a leather satchel for the class. The flap holds the title,
         name tags down the side pick the hero, and four pocket tabs inside hold Relics, Charms, Treasures
         and Seals. Markup inside: ui/modals/trophyRoomView.js. Styles: styles/satchel.css (lazy). -->
    <div id="trophy-room-modal"
        class="sat-overlay fixed inset-0 z-[80] flex items-center justify-center p-4 hidden">
        <div class="trophy-room-shell sat-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="trophy-room-title">
            <header class="trophy-room-head sat-flap">
                <span class="sat-flap__ring sat-flap__ring--l" aria-hidden="true"></span>
                <span class="sat-flap__ring sat-flap__ring--r" aria-hidden="true"></span>
                <span class="trophy-room-emblem sat-emblem" aria-hidden="true">
                    <svg viewBox="0 0 120 110" focusable="false">
                        <path class="sat-art-strap" d="M30 44 C30 6 90 6 90 44" />
                        <rect class="sat-art-body" x="12" y="38" width="96" height="64" rx="16" />
                        <path class="sat-art-flap-leather" d="M12 54 Q12 38 28 38 H92 Q108 38 108 54 V70 Q60 90 12 70 Z" />
                        <path class="sat-art-stitch" d="M20 53 Q20 45 29 45 H91 Q100 45 100 53 V66 Q60 82 20 66 Z" />
                        <rect class="sat-art-buckle" x="50" y="64" width="20" height="18" rx="4" />
                    </svg>
                </span>
                <div class="trophy-room-heading">
                    <h2 id="trophy-room-title" class="font-title">Satchels</h2>
                    <p id="trophy-room-subtitle">Every hero's satchel</p>
                </div>
                <button id="trophy-room-close-btn" type="button" class="trophy-room-close" aria-label="Close the Satchel">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
                <span class="sat-buckle" aria-hidden="true"><span class="sat-buckle__frame"></span><span class="sat-buckle__tongue"></span></span>
            </header>
            <div class="trophy-room-body">
                <nav class="trophy-room-roster sat-tags" aria-label="Heroes">
                    <p class="trophy-room-roster-label">Name tags</p>
                    <div id="trophy-room-roster" class="trophy-room-roster-list custom-scrollbar"></div>
                </nav>
                <section id="trophy-room-content" class="trophy-room-content sat-lining custom-scrollbar" aria-live="polite"></section>
            </div>
        </div>
    </div>



    <!-- Purchase complete: the Keeper's Parcel. Filled by ui/core/marketParcel.js; z-[100] sits above the market (z-[80]). -->
    <div id="shop-purchase-modal" class="mmp-overlay fixed inset-0 z-[100] hidden"></div>

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
                        <div id="avatar-creature-pool" class="af-pool af-pool--scroll" role="group" aria-label="Creature"></div>
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
                        <div id="avatar-color-pool" class="af-pool af-pool--colors af-pool--scroll" role="group" aria-label="Colour"></div>
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
                        <div id="avatar-accessory-pool" class="af-pool af-pool--scroll" role="group" aria-label="Relic"></div>
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
