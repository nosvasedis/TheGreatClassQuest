// templates/auth.js

const AUTH_LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

export const authHTML = `
    <div id="auth-screen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 auth-screen-sky transition-opacity duration-500 hidden">

        <div class="auth-sky-glow" aria-hidden="true"></div>

        <!-- Drifting cloud shapes so the login screen rhymes with the loading scene beyond it -->
        <div class="auth-cloud-layer" aria-hidden="true">
            <span class="auth-cloud auth-cloud-1"><i class="fas fa-cloud"></i></span>
            <span class="auth-cloud auth-cloud-2"><i class="fas fa-cloud"></i></span>
            <span class="auth-cloud auth-cloud-3"><i class="fas fa-cloud"></i></span>
            <span class="auth-cloud auth-cloud-4"><i class="fas fa-cloud"></i></span>
        </div>

        <!-- Gentle sparkle particles -->
        <div class="auth-sparkles" aria-hidden="true">
            <span class="auth-sparkle auth-sparkle-1"><i class="fas fa-star"></i></span>
            <span class="auth-sparkle auth-sparkle-2"><i class="fas fa-star"></i></span>
            <span class="auth-sparkle auth-sparkle-3"><i class="fas fa-star"></i></span>
            <span class="auth-sparkle auth-sparkle-4"><i class="fas fa-star"></i></span>
            <span class="auth-sparkle auth-sparkle-5"><i class="fas fa-star"></i></span>
            <span class="auth-sparkle auth-sparkle-6"><i class="fas fa-star"></i></span>
        </div>

        <span class="floating-star" style="top: 10%; left: 8%; font-size: 2.6rem; animation-delay: 0s;">🏆</span>
        <span class="floating-star" style="bottom: 12%; right: 6%; font-size: 2.4rem; animation-delay: -3s;">🚀</span>
        <span class="floating-star" style="top: 62%; left: 10%; font-size: 2.2rem; animation-delay: -2s;">🧠</span>
        <span class="floating-star" style="bottom: 32%; right: 9%; font-size: 2.8rem; animation-delay: -4.5s;">🎨</span>

        <div class="w-full max-w-md z-10 auth-content">
            <div class="auth-crest" aria-hidden="true"><img src="${AUTH_LOGO_URL}" alt=""></div>
            <h1 class="font-title text-5xl text-center mb-6 auth-hero-title wobbly-title">
                The Great Class Quest
            </h1>

            <div id="login-form-container" class="auth-card pop-in">
                <div id="auth-availability-panel" class="auth-availability-panel hidden" role="status" aria-live="polite">
                    <p class="auth-availability-eyebrow"></p>
                    <div class="auth-availability-icon" aria-hidden="true"></div>
                    <h2 class="auth-availability-title font-title"></h2>
                    <p class="auth-availability-text"></p>
                    <button type="button" id="auth-availability-retry" class="auth-availability-retry hidden">Try again</button>
                </div>

                <div id="auth-interactive">
                    <div class="flex items-center justify-center mb-6">
                        <div id="auth-role-switcher" class="auth-role-switcher">
                            <button type="button" class="auth-role-btn auth-role-btn-active" data-auth-role="teacher">
                                <i class="fas fa-hat-wizard" aria-hidden="true"></i><span>Teacher</span>
                            </button>
                            <button type="button" class="auth-role-btn" data-auth-role="parent">
                                <i class="fas fa-heart" aria-hidden="true"></i><span>Parent</span>
                            </button>
                            <button type="button" class="auth-role-btn" data-auth-role="secretary">
                                <i class="fas fa-scroll" aria-hidden="true"></i><span>Secretary</span>
                            </button>
                        </div>
                    </div>
                    <h2 id="auth-title" class="font-title text-3xl auth-card-title text-center mb-2">Teacher Login</h2>
                    <p id="auth-subtitle" class="text-center text-sm text-slate-500 mb-6">Teachers sign in with email. Parent and secretary accounts use usernames created by the school.</p>
                    <form id="login-form">
                        <div class="mb-4 auth-field" id="login-email-wrap">
                            <label for="login-email" id="login-email-label" class="auth-field-label">Email</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-envelope auth-field-icon" aria-hidden="true"></i>
                                <input type="email" id="login-email"
                                    class="auth-field-input"
                                    autocomplete="off" required>
                            </div>
                        </div>
                        <div class="mb-4 hidden auth-field" id="login-username-wrap">
                            <label for="login-username" class="auth-field-label">Username</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-user auth-field-icon" aria-hidden="true"></i>
                                <input type="text" id="login-username"
                                    class="auth-field-input"
                                    autocomplete="off">
                            </div>
                        </div>
                        <div class="mb-6 auth-field">
                            <label for="login-password" class="auth-field-label">Password</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-lock auth-field-icon" aria-hidden="true"></i>
                                <input type="password" id="login-password"
                                    class="auth-field-input"
                                    autocomplete="new-password" required>
                            </div>
                        </div>
                        <button type="submit" id="login-submit-btn"
                            class="auth-submit-btn auth-submit-btn--login bubbly-button">
                            <span class="auth-submit-label">Login</span>
                        </button>
                    </form>

                    <form id="signup-form" class="hidden">
                        <div class="mb-4 auth-field">
                            <label for="signup-name" class="auth-field-label">Your Name</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-signature auth-field-icon" aria-hidden="true"></i>
                                <input type="text" id="signup-name"
                                    class="auth-field-input"
                                    autocomplete="off" required>
                            </div>
                        </div>
                        <div class="mb-4 auth-field">
                            <label for="signup-email" class="auth-field-label">Email</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-envelope auth-field-icon" aria-hidden="true"></i>
                                <input type="email" id="signup-email"
                                    class="auth-field-input"
                                    autocomplete="off" required>
                            </div>
                        </div>
                        <div class="mb-6 auth-field">
                            <label for="signup-password" class="auth-field-label">Password</label>
                            <div class="auth-field-input-wrap">
                                <i class="fas fa-lock auth-field-icon" aria-hidden="true"></i>
                                <input type="password" id="signup-password"
                                    class="auth-field-input"
                                    autocomplete="new-password" required>
                            </div>
                        </div>
                        <button type="submit" id="signup-submit-btn"
                            class="auth-submit-btn auth-submit-btn--signup bubbly-button">
                            <span class="auth-submit-label">Sign Up</span>
                        </button>
                    </form>

                    <div class="text-center mt-4">
                        <button id="toggle-auth-mode" type="button" class="text-sm auth-toggle-link">Need an account? Sign
                            Up</button>
                    </div>
                </div>

                <form id="secretary-activation-form" class="hidden">
                    <div class="mb-4 auth-field">
                        <label for="activation-display-name" class="auth-field-label">Secretary / administrator name</label>
                        <div class="auth-field-input-wrap">
                            <i class="fas fa-id-badge auth-field-icon" aria-hidden="true"></i>
                            <input type="text" id="activation-display-name"
                                class="auth-field-input"
                                autocomplete="name" required>
                        </div>
                    </div>
                    <div class="mb-4 auth-field">
                        <label for="activation-school-name" class="auth-field-label">School name <span class="font-normal text-gray-400">(new schools only)</span></label>
                        <div class="auth-field-input-wrap">
                            <i class="fas fa-school auth-field-icon" aria-hidden="true"></i>
                            <input type="text" id="activation-school-name"
                                class="auth-field-input"
                                autocomplete="organization">
                        </div>
                    </div>
                    <div class="mb-4 auth-field">
                        <label for="activation-username" class="auth-field-label">Administrator username</label>
                        <div class="auth-field-input-wrap">
                            <i class="fas fa-user auth-field-icon" aria-hidden="true"></i>
                            <input type="text" id="activation-username"
                                class="auth-field-input"
                                autocomplete="username" required>
                        </div>
                    </div>
                    <div class="mb-6 auth-field">
                        <label for="activation-password" class="auth-field-label">Password</label>
                        <div class="auth-field-input-wrap">
                            <i class="fas fa-lock auth-field-icon" aria-hidden="true"></i>
                            <input type="password" id="activation-password"
                                class="auth-field-input"
                                autocomplete="new-password" minlength="6" required>
                        </div>
                    </div>
                    <button type="submit" id="secretary-activation-submit-btn"
                        class="auth-submit-btn auth-submit-btn--activation bubbly-button">
                        <span>Activate Secretary / Admin</span>
                    </button>
                </form>

                <p id="auth-error" class="text-sm text-red-600 mt-4 text-center h-4"></p>
            </div>
        </div>
    </div>
`;
