// templates/app/tabs/award.js

export const awardTabHTML = `
            <div id="award-stars-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-star text-rose-500 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-rose-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Award Stars</h2>
                        <p class="award-stars-hero-subtitle text-lg text-gray-600 mt-2">Recognize your students' excellence and effort.</p>
                    </div>

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
