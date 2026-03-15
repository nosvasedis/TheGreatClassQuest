// templates/subscribe.js
// Shown when tier is "pending" — school must subscribe before using the app.

export const subscribeHTML = `
    <div id="subscribe-screen"
        class="fixed inset-0 z-40 flex items-center justify-center p-4 hidden"
        style="background:
            radial-gradient(circle at top, rgba(255,244,201,0.95) 0%, rgba(196,225,255,0.92) 30%, rgba(148,163,255,0.94) 100%),
            linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);">
        <div class="w-full max-w-6xl bg-white/95 backdrop-blur p-8 md:p-10 rounded-[2rem] shadow-2xl border border-white/70 overflow-hidden relative">
            <div class="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-amber-200/40 blur-3xl pointer-events-none"></div>
            <div class="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-cyan-200/40 blur-3xl pointer-events-none"></div>

            <div class="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8 items-start mb-8 relative">
                <div>
                    <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm shadow-sm border border-indigo-200 mb-4">
                        <span>🗝️ School unlock portal</span>
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span id="subscribe-status-meta">Payment or grace unlocks the Quest</span>
                    </div>
                    <h1 class="font-title text-4xl md:text-5xl text-indigo-800 mb-3 leading-tight">Welcome to The Great Class Quest</h1>
                    <p id="subscribe-status-lead" class="text-slate-600 text-lg leading-relaxed max-w-2xl">Choose a plan to unlock your school’s adventure, or begin the first-day setup grace period if this is a brand-new school.</p>

                    <div id="subscribe-grace-banner" class="hidden mt-5 rounded-[1.5rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 shadow-sm">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p class="text-xs uppercase tracking-[0.25em] text-emerald-600 font-black mb-1">Grace Time</p>
                                <h3 id="subscribe-grace-title" class="font-title text-2xl text-emerald-800">1-day setup grace is active</h3>
                                <p id="subscribe-grace-copy" class="text-sm text-emerald-800/80 mt-1">Use this time to set up the school before payment is required.</p>
                            </div>
                            <div class="rounded-2xl bg-white/85 border border-emerald-200 px-4 py-3 min-w-[220px] text-center shadow-sm">
                                <p class="text-[11px] uppercase tracking-[0.24em] text-emerald-500 font-black mb-1">Remaining Time</p>
                                <p id="subscribe-grace-countdown" class="font-title text-2xl text-emerald-800">24h 00m</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="rounded-[1.75rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-2xl border border-white/10">
                    <p class="text-xs uppercase tracking-[0.25em] text-white/60 font-black mb-3">What unlocks right away</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="rounded-2xl bg-white/10 border border-white/10 px-4 py-4">
                            <div class="text-2xl mb-2">🏫</div>
                            <h3 class="font-title text-xl">School Setup</h3>
                            <p class="text-sm text-white/75 mt-1">Create the school, add classes, and paste students into GCQ beautifully.</p>
                        </div>
                        <div class="rounded-2xl bg-white/10 border border-white/10 px-4 py-4">
                            <div class="text-2xl mb-2">🔐</div>
                            <h3 class="font-title text-xl">Stripe-secure billing</h3>
                            <p class="text-sm text-white/75 mt-1">Plans, invoices, upgrades, and payment methods stay inside Stripe.</p>
                        </div>
                        <div class="rounded-2xl bg-white/10 border border-white/10 px-4 py-4">
                            <div class="text-2xl mb-2">📈</div>
                            <h3 class="font-title text-xl">Tier-based limits</h3>
                            <p class="text-sm text-white/75 mt-1">Starter, Pro, and Elite all enforce the right limits and features automatically.</p>
                        </div>
                        <div class="rounded-2xl bg-white/10 border border-white/10 px-4 py-4">
                            <div class="text-2xl mb-2">✨</div>
                            <h3 class="font-title text-xl">Magic that scales</h3>
                            <p class="text-sm text-white/75 mt-1">Start simple, then unlock guilds, avatars, AI, and the rest when the school grows.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative">
                <!-- Starter Plan -->
                <div class="bg-gradient-to-b from-slate-50 to-white rounded-[1.75rem] border-2 border-slate-200 p-6 flex flex-col shadow-lg">
                    <div class="text-center mb-4">
                        <div class="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-[0.2em] mb-3">Simple launch</div>
                        <h2 class="font-title text-2xl text-slate-700 mb-1">Starter</h2>
                        <div class="text-4xl font-bold text-slate-800">€20<span class="text-lg font-normal text-slate-500">/month</span></div>
                    </div>
                    <ul class="text-sm text-slate-600 space-y-2 mb-6 flex-grow">
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Award Stars system</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Mystic Market & Shop</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Quest Bounties</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Monthly Ceremonies</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> Projector Mode</li>
                        <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i> 3 teachers, 6 classes</li>
                    </ul>
                    <button type="button" id="subscribe-starter-btn" class="w-full bg-slate-700 hover:bg-slate-800 text-white font-title text-lg py-3 rounded-xl transition-colors shadow-md">
                        Choose Starter
                    </button>
                </div>

                <!-- Pro Plan -->
                <div class="bg-gradient-to-b from-indigo-50 to-white rounded-[1.9rem] border-2 border-indigo-400 p-6 flex flex-col relative transform scale-[1.03] shadow-2xl">
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs px-4 py-1 rounded-full font-semibold">
                        MOST POPULAR
                    </div>
                    <div class="text-center mb-4">
                        <div class="inline-flex px-3 py-1 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-3">School growth</div>
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
                <div class="bg-gradient-to-b from-fuchsia-50 to-white rounded-[1.75rem] border-2 border-fuchsia-400 p-6 flex flex-col shadow-lg">
                    <div class="text-center mb-4">
                        <div class="inline-flex px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-600 text-xs font-black uppercase tracking-[0.2em] mb-3">Full magic</div>
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
            <div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500 font-black mb-1">Secure Billing Promise</p>
                    <p class="text-sm text-slate-600">Stripe handles payment securely. GCQ only uses the result to unlock the correct school tier.</p>
                </div>
                <div class="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    <span class="px-3 py-1 rounded-full bg-white border border-slate-200">Upgrade anytime</span>
                    <span class="px-3 py-1 rounded-full bg-white border border-slate-200">Manage in Stripe</span>
                    <span class="px-3 py-1 rounded-full bg-white border border-slate-200">Access updates automatically</span>
                </div>
            </div>
            <p id="subscribe-status" class="text-sm text-rose-600 mt-4 text-center hidden" aria-live="polite"></p>
            <p id="subscribe-refresh-hint" class="text-sm text-gray-500 mt-6 text-center hidden">
                <i class="fas fa-sync-alt mr-1"></i> Refresh this page after you've completed payment
            </p>
        </div>
    </div>
`;
