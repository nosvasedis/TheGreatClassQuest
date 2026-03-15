// templates/subscribe.js
// Shown when tier is "pending" — school must subscribe before using the app.

export const subscribeHTML = `
    <div id="subscribe-screen"
        class="fixed inset-0 z-40 flex items-center justify-center p-4 hidden"
        style="background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);">
        <div class="w-full max-w-4xl bg-white p-8 rounded-3xl shadow-2xl">
            <div class="text-center mb-8">
                <h1 class="font-title text-4xl text-indigo-700 mb-2">Welcome to The Great Class Quest</h1>
                <p class="text-gray-600 text-lg">Choose a plan to unlock your school's adventure</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <!-- Starter Plan -->
                <div class="bg-gradient-to-b from-gray-50 to-white rounded-2xl border-2 border-gray-200 p-6 flex flex-col">
                    <div class="text-center mb-4">
                        <h2 class="font-title text-2xl text-gray-700 mb-1">Starter</h2>
                        <div class="text-4xl font-bold text-gray-800">€20<span class="text-lg font-normal text-gray-500">/month</span></div>
                    </div>
                    <ul class="text-sm text-gray-600 space-y-2 mb-6 flex-grow">
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Award Stars system</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Mystic Market & Shop</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Quest Bounties</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Monthly Ceremonies</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Projector Mode</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> 3 teachers, 6 classes</li>
                    </ul>
                    <button type="button" id="subscribe-starter-btn" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-title text-lg py-3 rounded-xl transition-colors">
                        Choose Starter
                    </button>
                </div>

                <!-- Pro Plan -->
                <div class="bg-gradient-to-b from-indigo-50 to-white rounded-2xl border-2 border-indigo-400 p-6 flex flex-col relative transform scale-105 shadow-xl">
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs px-4 py-1 rounded-full font-semibold">
                        MOST POPULAR
                    </div>
                    <div class="text-center mb-4">
                        <h2 class="font-title text-2xl text-indigo-700 mb-1">Pro</h2>
                        <div class="text-4xl font-bold text-indigo-800">€40<span class="text-lg font-normal text-indigo-500">/month</span></div>
                    </div>
                    <ul class="text-sm text-gray-600 space-y-2 mb-6 flex-grow">
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> Everything in Starter</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> Guilds System</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> Hero Classes & Skill Tree</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> Calendar & Planner</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> Scholar's Scroll</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> Adventure Log</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500"></i> 6 teachers, 10 classes</li>
                    </ul>
                    <button type="button" id="subscribe-pro-btn" class="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-title text-lg py-3 rounded-xl transition-colors shadow-lg">
                        Choose Pro
                    </button>
                </div>

                <!-- Elite Plan -->
                <div class="bg-gradient-to-b from-purple-50 to-white rounded-2xl border-2 border-purple-400 p-6 flex flex-col">
                    <div class="text-center mb-4">
                        <h2 class="font-title text-2xl text-purple-700 mb-1">Elite</h2>
                        <div class="text-4xl font-bold text-purple-800">€60<span class="text-lg font-normal text-purple-500">/month</span></div>
                    </div>
                    <ul class="text-sm text-gray-600 space-y-2 mb-6 flex-grow">
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> Everything in Pro</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> AI Adventure Log Writer</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> AI Reports & Certificates</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> AI Avatar Generator</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> Familiars (magical pets)</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> Priority Support</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i> Unlimited teachers & classes</li>
                    </ul>
                    <button type="button" id="subscribe-elite-btn" class="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-title text-lg py-3 rounded-xl transition-colors shadow-lg">
                        Choose Elite
                    </button>
                </div>
            </div>

            <div id="subscribe-actions" class="hidden"></div>
            <p id="subscribe-status" class="text-sm text-rose-600 mt-4 text-center hidden" aria-live="polite"></p>
            <p id="subscribe-refresh-hint" class="text-sm text-gray-500 mt-6 text-center hidden">
                <i class="fas fa-sync-alt mr-1"></i> Refresh this page after you've completed payment
            </p>
        </div>
    </div>
`;
