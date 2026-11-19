// templates/app/tabs/award.js

export const awardTabHTML = `
            <div id="award-stars-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto aw-stage-wide">
                    <!-- Tab title: Award Stars -->
                    <header class="tab-sign tab-sign--award">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__crest" aria-hidden="true"><i class="fas fa-star"></i></span>
                            <span class="tab-sign__twinkle tab-sign__twinkle--a" aria-hidden="true">&#10022;</span>
                            <span class="tab-sign__twinkle tab-sign__twinkle--b" aria-hidden="true">&#10023;</span>
                            <span class="tab-sign__twinkle tab-sign__twinkle--c" aria-hidden="true">&#10022;</span>
                            <span class="tab-sign__ribbon tab-sign__ribbon--l" aria-hidden="true"></span>
                            <span class="tab-sign__ribbon tab-sign__ribbon--r" aria-hidden="true"></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__kicker">Effort · Courage · Kindness</span>
                                <h2 class="font-title tab-sign__title">Award Stars</h2>
                            </div>
                        </div>
                        <p class="tab-sign__tagline award-stars-hero-subtitle">Recognize your students' excellence and effort.</p>
                    </header>

                    <div class="award-stars-toolbar mb-6 flex flex-wrap items-center justify-center gap-4">
                        <button id="open-teacher-boon-btn"
                            class="teacher-boon-launch-btn hidden"
                            type="button"
                            title="Teacher Boon: gift 2 stars to one hero this month"
                            aria-label="Teacher Boon: gift 2 stars to one hero this month">
                            <span class="teacher-boon-launch-btn__glow" aria-hidden="true"></span>
                            <span class="teacher-boon-launch-btn__halo" aria-hidden="true"></span>
                            <span class="teacher-boon-launch-btn__body" aria-hidden="true">
                                <span class="teacher-boon-launch-btn__shimmer"></span>
                                <span class="teacher-boon-launch-btn__seal">
                                    <span class="teacher-boon-launch-btn__orbit"><i>&#10022;</i><i>&#10022;</i></span>
                                    <span class="teacher-boon-launch-btn__seal-core">
                                        <i class="fas fa-gift teacher-boon-launch-btn__icon"></i>
                                    </span>
                                </span>
                                <span class="teacher-boon-launch-btn__text">
                                    <span class="teacher-boon-launch-btn__kicker">Month's end gift</span>
                                    <span class="teacher-boon-launch-btn__label">Teacher Boon</span>
                                </span>
                                <span class="teacher-boon-launch-btn__gift">+2 <i class="fas fa-star"></i></span>
                            </span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--a" aria-hidden="true">&#10022;</span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--b" aria-hidden="true">&#10023;</span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--c" aria-hidden="true">&#10022;</span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--d" aria-hidden="true">&#10023;</span>
                        </button>
                    </div>

                    <div id="award-sky-summary" class="aw-sky-summary hidden" aria-live="polite"></div>

                    <div id="award-stars-student-list" class="aw-sky-grid">
                        <p class="aw-empty col-span-full"><i class="fas fa-cloud" aria-hidden="true"></i> Please choose a class from the header to award stars.</p>
                    </div>
                </div>
            </div>
`;
