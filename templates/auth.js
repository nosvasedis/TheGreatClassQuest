// templates/auth.js — "The Quest Gate": the sign-in screen for teachers, families and the school office.
// A dawn valley whose path climbs to a castle gate; the card is that gate's arch,
// and its colour follows who is signing in (teacher = sky, parent = amber, secretary = violet).

import { cloudSvg } from '../features/skyWeatherArt.js';

const AUTH_LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

// One illustrated valley shared by every width. It anchors to the bottom so phones keep the path and hills.
const AUTH_SCENE_SVG = `
<svg class="auth-scene" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs>
        <radialGradient id="auth-sun-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fffbeb"/>
            <stop offset="55%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#fbbf24"/>
        </radialGradient>
        <radialGradient id="auth-sun-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fef3c7" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#fef3c7" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="auth-hill-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#a7dcef"/>
            <stop offset="100%" stop-color="#bfe9f0"/>
        </linearGradient>
        <linearGradient id="auth-hill-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9fe0b9"/>
            <stop offset="100%" stop-color="#7fcf9f"/>
        </linearGradient>
        <linearGradient id="auth-hill-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6cc58c"/>
            <stop offset="100%" stop-color="#4fae74"/>
        </linearGradient>
        <linearGradient id="auth-path" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#fdf1d6"/>
            <stop offset="100%" stop-color="#f6e2b3"/>
        </linearGradient>
    </defs>

    <g class="auth-scene__sun">
        <circle cx="1180" cy="190" r="190" fill="url(#auth-sun-halo)"/>
        <circle cx="1180" cy="190" r="62" fill="url(#auth-sun-core)"/>
    </g>

    <path class="auth-scene__far" d="M0 560 C 160 500 300 520 420 548 C 560 580 660 520 800 530 C 960 542 1060 498 1200 520 C 1320 538 1390 520 1440 512 L1440 900 L0 900 Z" fill="url(#auth-hill-far)"/>

    <g class="auth-scene__castle" transform="translate(662 440) scale(0.85)">
        <path d="M0 108 L0 44 L14 44 L14 30 L24 30 L24 44 L34 44 L34 0 L42 -10 L50 0 L50 44 L66 44 L66 18 L74 10 L82 18 L82 44 L98 44 L98 0 L106 -10 L114 0 L114 44 L124 44 L124 30 L134 30 L134 44 L148 44 L148 108 Z" fill="#8fc3dc"/>
        <path d="M64 108 L64 80 C 64 70 84 70 84 80 L84 108 Z" fill="#6aa9c7"/>
        <path d="M42 -10 L42 -30 L56 -24 L42 -18" fill="#f59e0b"/>
        <path d="M106 -10 L106 -30 L120 -24 L106 -18" fill="#38bdf8"/>
        <rect x="38" y="16" width="8" height="12" rx="4" fill="#6aa9c7"/>
        <rect x="102" y="16" width="8" height="12" rx="4" fill="#6aa9c7"/>
    </g>

    <path class="auth-scene__mid" d="M0 640 C 180 590 330 600 470 628 C 640 662 760 600 930 606 C 1100 612 1220 650 1440 616 L1440 900 L0 900 Z" fill="url(#auth-hill-mid)"/>

    <path class="auth-scene__path" d="M640 900 C 624 826 500 800 506 736 C 512 676 690 650 719 532 L 739 532 C 736 640 600 690 604 738 C 608 790 770 826 800 900 Z" fill="url(#auth-path)"/>

    <path class="auth-scene__near" d="M0 760 C 150 720 280 730 380 760 C 440 778 470 800 520 820 L520 900 L0 900 Z" fill="url(#auth-hill-near)"/>
    <path class="auth-scene__near" d="M900 810 C 1010 760 1170 732 1300 742 C 1370 748 1410 756 1440 760 L1440 900 L900 900 Z" fill="url(#auth-hill-near)"/>

    <g class="auth-scene__trees">
        <g transform="translate(96 700)"><rect x="-3" y="0" width="6" height="26" rx="3" fill="#5b8a5a"/><circle cx="0" cy="-8" r="22" fill="#3f9d66"/><circle cx="-8" cy="-16" r="10" fill="#57b57b" opacity="0.8"/></g>
        <g transform="translate(330 726)"><rect x="-2.5" y="0" width="5" height="20" rx="2.5" fill="#5b8a5a"/><circle cx="0" cy="-6" r="16" fill="#46a56e"/></g>
        <g transform="translate(1040 752)"><rect x="-3" y="0" width="6" height="24" rx="3" fill="#5b8a5a"/><circle cx="0" cy="-8" r="20" fill="#3f9d66"/><circle cx="7" cy="-15" r="9" fill="#57b57b" opacity="0.8"/></g>
        <g transform="translate(1330 712)"><rect x="-2.5" y="0" width="5" height="22" rx="2.5" fill="#5b8a5a"/><circle cx="0" cy="-6" r="17" fill="#46a56e"/></g>
        <g transform="translate(560 636)"><rect x="-2" y="0" width="4" height="14" rx="2" fill="#6a9c6a"/><circle cx="0" cy="-4" r="11" fill="#5cbf84"/></g>
    </g>

    <g class="auth-scene__flowers">
        <circle cx="170" cy="812" r="5" fill="#fde68a"/><circle cx="210" cy="836" r="4" fill="#fbcfe8"/>
        <circle cx="420" cy="846" r="5" fill="#ffffff"/><circle cx="1110" cy="850" r="5" fill="#fde68a"/>
        <circle cx="1210" cy="818" r="4" fill="#fbcfe8"/><circle cx="1390" cy="842" r="5" fill="#ffffff"/>
        <circle cx="980" cy="872" r="4" fill="#fbcfe8"/>
    </g>
</svg>`;


export const authHTML = `
    <div id="auth-screen" class="fixed inset-0 z-50 auth-screen-sky transition-opacity duration-500 hidden" data-auth-role="teacher">
        <div class="auth-sky-glow" aria-hidden="true"></div>
        ${AUTH_SCENE_SVG}

        <div class="auth-cloud-layer" aria-hidden="true">
            <span class="auth-cloud auth-cloud-1">${cloudSvg('cumulus', 2)}</span>
            <span class="auth-cloud auth-cloud-2">${cloudSvg('puff', 1)}</span>
            <span class="auth-cloud auth-cloud-3">${cloudSvg('long', 3)}</span>
        </div>

        <div class="auth-stage">
            <div class="auth-content">
                <div class="auth-welcome">
                    <div class="auth-crest" aria-hidden="true"><img src="${AUTH_LOGO_URL}" alt=""></div>
                    <h1 class="font-title auth-hero-title">The Great Class Quest</h1>
                    <p class="auth-welcome__kicker" data-auth-welcome-kicker>Welcome back, teacher</p>
                    <p class="auth-welcome__lede" data-auth-welcome-lede>Your classes, stars and adventures are waiting at the gate.</p>
                    <ul class="auth-welcome__list" data-auth-welcome-list></ul>
                </div>

                <div id="login-form-container" class="auth-card auth-gate">
                    <div class="auth-gate__keystone" aria-hidden="true"><i class="fas fa-hat-wizard" data-auth-keystone-icon></i></div>

                    <div id="auth-availability-panel" class="auth-availability-panel hidden" role="status" aria-live="polite">
                        <p class="auth-availability-eyebrow"></p>
                        <div class="auth-availability-icon" aria-hidden="true"></div>
                        <h2 class="auth-availability-title font-title"></h2>
                        <p class="auth-availability-text"></p>
                        <button type="button" id="auth-availability-retry" class="auth-availability-retry hidden">Try again</button>
                    </div>

                    <div id="auth-interactive">
                        <div id="auth-role-switcher" class="auth-role-switcher" role="tablist" aria-label="Who is signing in?">
                            <button type="button" class="auth-role-btn auth-role-btn-active" data-auth-role="teacher" role="tab" aria-selected="true">
                                <span class="auth-role-btn__icon" aria-hidden="true"><i class="fas fa-hat-wizard"></i></span>
                                <span class="auth-role-btn__label">Teacher</span>
                            </button>
                            <button type="button" class="auth-role-btn" data-auth-role="parent" role="tab" aria-selected="false">
                                <span class="auth-role-btn__icon" aria-hidden="true"><i class="fas fa-house-chimney-user"></i></span>
                                <span class="auth-role-btn__label">Parent</span>
                            </button>
                            <button type="button" class="auth-role-btn" data-auth-role="secretary" role="tab" aria-selected="false">
                                <span class="auth-role-btn__icon" aria-hidden="true"><i class="fas fa-scroll"></i></span>
                                <span class="auth-role-btn__label">Secretary</span>
                            </button>
                        </div>

                        <div id="auth-arrival" class="auth-arrival hidden" role="note">
                            <span class="auth-arrival__wave" aria-hidden="true">👋</span>
                            <span><strong>Hello, family!</strong> Welcome to your child’s quest. Sign in below to follow it from home.</span>
                        </div>

                        <h2 id="auth-title" class="font-title auth-card-title">Teacher sign in</h2>
                        <p id="auth-subtitle" class="auth-subtitle">Sign in with your school email.</p>

                        <form id="login-form" novalidate>
                            <div class="auth-field" id="login-email-wrap">
                                <label for="login-email" id="login-email-label" class="auth-field-label">Email</label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-envelope auth-field-icon" aria-hidden="true"></i>
                                    <input type="email" id="login-email" class="auth-field-input" placeholder="name@school.gr"
                                        autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="email" required>
                                </div>
                            </div>
                            <div class="hidden auth-field" id="login-username-wrap">
                                <label for="login-username" class="auth-field-label">Username</label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-user auth-field-icon" aria-hidden="true"></i>
                                    <input type="text" id="login-username" class="auth-field-input" placeholder="e.g. maria.p"
                                        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                                </div>
                                <p class="auth-field-hint hidden" id="login-username-hint" aria-live="polite"></p>
                            </div>
                            <div class="auth-field">
                                <div class="auth-field-label-row">
                                    <label for="login-password" class="auth-field-label">Password</label>
                                    <button type="button" class="auth-link auth-link--small" id="auth-forgot-btn">Forgot password?</button>
                                </div>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-lock auth-field-icon" aria-hidden="true"></i>
                                    <input type="password" id="login-password" class="auth-field-input"
                                        autocomplete="new-password" autocapitalize="off" spellcheck="false" required>
                                    <button type="button" class="auth-peek" data-auth-peek="login-password" aria-label="Show password" aria-pressed="false"><i class="fas fa-eye" aria-hidden="true"></i></button>
                                </div>
                                <p class="auth-field-hint auth-field-hint--caps hidden" data-auth-caps-for="login-password"><i class="fas fa-arrow-up" aria-hidden="true"></i> Caps Lock is on</p>
                            </div>
                            <div id="auth-forgot-panel" class="auth-forgot hidden" aria-live="polite"></div>
                            <button type="submit" id="login-submit-btn" class="auth-submit-btn auth-submit-btn--login">
                                <span class="auth-submit-label">Sign in</span>
                            </button>
                        </form>

                        <form id="signup-form" class="hidden" novalidate>
                            <div class="auth-field">
                                <label for="signup-name" class="auth-field-label">Your name</label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-signature auth-field-icon" aria-hidden="true"></i>
                                    <input type="text" id="signup-name" class="auth-field-input" placeholder="As your students know you"
                                        autocomplete="off" required>
                                </div>
                            </div>
                            <div class="auth-field">
                                <label for="signup-email" class="auth-field-label">Email</label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-envelope auth-field-icon" aria-hidden="true"></i>
                                    <input type="email" id="signup-email" class="auth-field-input" placeholder="name@school.gr"
                                        autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="email" required>
                                </div>
                            </div>
                            <div class="auth-field">
                                <label for="signup-password" class="auth-field-label">Password</label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-lock auth-field-icon" aria-hidden="true"></i>
                                    <input type="password" id="signup-password" class="auth-field-input" placeholder="At least 6 characters"
                                        autocomplete="new-password" autocapitalize="off" spellcheck="false" minlength="6" required>
                                    <button type="button" class="auth-peek" data-auth-peek="signup-password" aria-label="Show password" aria-pressed="false"><i class="fas fa-eye" aria-hidden="true"></i></button>
                                </div>
                                <div class="auth-strength" data-auth-strength aria-hidden="true"><span></span><span></span><span></span></div>
                                <p class="auth-field-hint auth-field-hint--caps hidden" data-auth-caps-for="signup-password"><i class="fas fa-arrow-up" aria-hidden="true"></i> Caps Lock is on</p>
                            </div>
                            <div class="auth-field hidden" id="signup-join-code-wrap">
                                <label for="signup-join-code" class="auth-field-label">Teacher code <span class="auth-field-label__aside">(from your school office)</span></label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-key auth-field-icon" aria-hidden="true"></i>
                                    <input type="text" id="signup-join-code" class="auth-field-input" placeholder="ABCDE-FGHJK"
                                        autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false">
                                </div>
                            </div>
                            <button type="submit" id="signup-submit-btn" class="auth-submit-btn auth-submit-btn--signup">
                                <span class="auth-submit-label">Create my account</span>
                            </button>
                        </form>

                        <div class="auth-switch">
                            <button id="toggle-auth-mode" type="button" class="auth-toggle-link">New teacher? Create an account</button>
                        </div>
                    </div>

                    <div id="auth-school-line" class="auth-school-line">
                        <p id="auth-school-current" class="auth-school-current hidden"></p>
                        <button type="button" id="auth-school-change" class="auth-toggle-link auth-school-change">Another school? Enter its school code</button>
                        <form id="auth-school-form" class="auth-school-form hidden" novalidate>
                            <div class="auth-field">
                                <label for="auth-school-code" class="auth-field-label">School code</label>
                                <div class="auth-field-input-wrap">
                                    <i class="fas fa-school auth-field-icon" aria-hidden="true"></i>
                                    <input type="text" id="auth-school-code" class="auth-field-input" placeholder="e.g. alpha-patras"
                                        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                                </div>
                            </div>
                            <div class="auth-school-actions">
                                <button type="submit" class="auth-toggle-link auth-school-use">Use this school</button>
                                <button type="button" id="auth-school-cancel" class="auth-toggle-link">Cancel</button>
                            </div>
                        </form>
                    </div>

                    <form id="secretary-activation-form" class="hidden" novalidate>
                        <div class="auth-field">
                            <label for="activation-display-name" class="auth-field-label">Secretary / administrator name</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-id-badge auth-field-icon" aria-hidden="true"></i>
                                <input type="text" id="activation-display-name" class="auth-field-input" autocomplete="name" required>
                            </div>
                        </div>
                        <div class="auth-field">
                            <label for="activation-school-name" class="auth-field-label">School name <span class="auth-field-label__aside">(new schools only)</span></label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-school auth-field-icon" aria-hidden="true"></i>
                                <input type="text" id="activation-school-name" class="auth-field-input" autocomplete="organization">
                            </div>
                        </div>
                        <div class="auth-field">
                            <label for="activation-username" class="auth-field-label">Administrator username</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-user auth-field-icon" aria-hidden="true"></i>
                                <input type="text" id="activation-username" class="auth-field-input" autocomplete="username" autocapitalize="off" spellcheck="false" required>
                            </div>
                        </div>
                        <div class="auth-field">
                            <label for="activation-password" class="auth-field-label">Password</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-lock auth-field-icon" aria-hidden="true"></i>
                                <input type="password" id="activation-password" class="auth-field-input" autocomplete="new-password" minlength="6" required>
                                <button type="button" class="auth-peek" data-auth-peek="activation-password" aria-label="Show password" aria-pressed="false"><i class="fas fa-eye" aria-hidden="true"></i></button>
                            </div>
                        </div>
                        <button type="submit" id="secretary-activation-submit-btn" class="auth-submit-btn auth-submit-btn--activation">
                            <span>Activate Secretary / Admin</span>
                        </button>
                    </form>

                    <div id="auth-error" class="auth-error" role="alert" aria-live="assertive"></div>
                </div>

                <p class="auth-footnote" data-auth-footnote>Families: scan the school’s QR code to land straight on the Parent sign-in.</p>
            </div>
        </div>
    </div>
`;
