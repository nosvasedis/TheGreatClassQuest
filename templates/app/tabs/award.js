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

                    <div class="aw-sky-motes" aria-hidden="true"><span class="aw-mote aw-mote--spark" style="--x:8%;--y:12%;--d:5s;--i:0"></span><span class="aw-mote aw-mote--spark" style="--x:92%;--y:18%;--d:6.5s;--i:1"></span><span class="aw-mote aw-mote--spark" style="--x:48%;--y:6%;--d:4.6s;--i:2"></span><span class="aw-mote aw-mote--spark" style="--x:22%;--y:44%;--d:7s;--i:3"></span><span class="aw-mote aw-mote--spark" style="--x:78%;--y:52%;--d:5.4s;--i:4"></span><span class="aw-mote aw-mote--spark" style="--x:4%;--y:70%;--d:6.2s;--i:5"></span><span class="aw-mote aw-mote--spark" style="--x:96%;--y:82%;--d:4.8s;--i:6"></span><span class="aw-mote aw-mote--spark" style="--x:56%;--y:90%;--d:7.4s;--i:7"></span><span class="aw-mote aw-mote--puff" style="--x:0%;--y:28%;--d:70s;--i:8"></span><span class="aw-mote aw-mote--puff" style="--x:0%;--y:63%;--d:92s;--i:9"></span><span class="aw-mote aw-mote--puff" style="--x:0%;--y:96%;--d:80s;--i:10"></span><span class="aw-mote aw-mote--bird" style="--x:0%;--y:22%;--d:38s;--i:11"></span></div>

                    <div id="award-stars-student-list" class="aw-sky-grid">
                        <p class="aw-empty col-span-full"><i class="fas fa-cloud" aria-hidden="true"></i> Please choose a class from the header to award stars.</p>
                    </div>
                </div>
            </div>
`;
