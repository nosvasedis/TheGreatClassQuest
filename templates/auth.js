// templates/auth.js

export const authHTML = `
    <div id="auth-screen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-500 hidden"
        style="background: linear-gradient(135deg, #a8e0ff 0%, #8ee3f8 100%);">

        <span class="floating-star" style="top: 10%; left: 10%; font-size: 3rem; animation-delay: 0s;">⭐</span>
        <span class="floating-star" style="bottom: 15%; right: 5%; font-size: 2.5rem; animation-delay: -3s;">🏆</span>
        <span class="floating-star" style="top: 30%; right: 20%; font-size: 4rem; animation-delay: -1s;">🚀</span>
        <span class="floating-star" style="bottom: 5%; left: 25%; font-size: 2rem; animation-delay: -5s;">💡</span>
        <span class="floating-star" style="top: 55%; left: 15%; font-size: 2.8rem; animation-delay: -2s;">🧠</span>
        <span class="floating-star" style="bottom: 30%; right: 25%; font-size: 3.5rem; animation-delay: -4s;">🎨</span>

        <div class="w-full max-w-md z-10">
            <h1 class="font-title text-5xl text-white text-center mb-6 wobbly-title login-title-pulse"
                style="text-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                The Great Class Quest
                <span class="block text-2xl text-white/80 font-semibold mt-1">Prodigies Language School</span>
            </h1>

            <div id="login-form-container" class="bg-white p-8 rounded-3xl shadow-2xl pop-in">
                <h2 id="auth-title" class="font-title text-3xl text-sky-700 text-center mb-6">Teacher Login</h2>
                <form id="login-form">
                    <div class="mb-4">
                        <label for="login-email" class="block text-sm font-bold text-gray-700 mb-2">Email</label>
                        <input type="email" id="login-email"
                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            autocomplete="off" required>
                    </div>
                    <div class="mb-6">
                        <label for="login-password" class="block text-sm font-bold text-gray-700 mb-2">Password</label>
                        <input type="password" id="login-password"
                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            autocomplete="new-password" required>
                    </div>
                    <button type="submit"
                        class="w-full bg-sky-500 hover:bg-sky-600 text-white font-title text-xl py-3 rounded-xl bubbly-button">Login</button>
                </form>

                <form id="signup-form" class="hidden">
                    <div class="mb-4">
                        <label for="signup-name" class="block text-sm font-bold text-gray-700 mb-2">Your Name</label>
                        <input type="text" id="signup-name"
                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            autocomplete="off" required>
                    </div>
                    <div class="mb-4">
                        <label for="signup-email" class="block text-sm font-bold text-gray-700 mb-2">Email</label>
                        <input type="email" id="signup-email"
                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            autocomplete="off" required>
                    </div>
                    <div class="mb-6">
                        <label for="signup-password" class="block text-sm font-bold text-gray-700 mb-2">Password</label>
                        <input type="password" id="signup-password"
                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            autocomplete="new-password" required>
                    </div>
                    <button type="submit"
                        class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-title text-xl py-3 rounded-xl bubbly-button">Sign
                        Up</button>
                </form>

                <p id="auth-error" class="text-sm text-red-600 mt-4 text-center h-4"></p>
                <div class="text-center mt-4">
                    <button id="toggle-auth-mode" class="text-sm text-sky-600 hover:underline">Need an account? Sign
                        Up</button>
                </div>
            </div>
        </div>
    </div>
`;
