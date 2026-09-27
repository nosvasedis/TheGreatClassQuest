// templates/app/tabs/award.js

export const awardTabHTML = `
            <div id="award-stars-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <!-- Tab sign: Award Stars -->
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
                            <span class="tab-sign__badge"><i class="fas fa-medal" aria-hidden="true"></i> Every effort shines</span>
                        </div>
                        <p class="tab-sign__tagline award-stars-hero-subtitle">Recognize your students' excellence and effort.</p>
                    </header>

                    <div class="award-stars-toolbar mb-6 flex flex-wrap items-center justify-center gap-4">
                        <button id="open-teacher-boon-btn"
                            class="teacher-boon-launch-btn hidden"
                            type="button"
                            title="Teacher Boon">
                            <span class="teacher-boon-launch-btn__glow" aria-hidden="true"></span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--a" aria-hidden="true">✦</span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--b" aria-hidden="true">✧</span>
                            <span class="teacher-boon-launch-btn__sparkle teacher-boon-launch-btn__sparkle--c" aria-hidden="true">✦</span>
                            <span class="teacher-boon-launch-btn__shimmer" aria-hidden="true"></span>
                            <i class="fas fa-wand-magic-sparkles teacher-boon-launch-btn__icon" aria-hidden="true"></i>
                            <span class="teacher-boon-launch-btn__label">Teacher Boon</span>
                        </button>
                    </div>

                    <div id="award-stars-student-list" class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-0 items-start">
                        <p
                            class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">
                            Please choose a class from the header to award stars.</p>
                    </div>
                </div>
            </div>
`;
