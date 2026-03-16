// templates/app/tabs/options.js

export const optionsTabHTML = `
            <div id="options-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-8">
                        <i class="fas fa-cog text-gray-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-gray-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Options & Settings</h2>
                        <p class="text-lg text-gray-600 mt-2">Manage your profile and access advanced tools.</p>
                    </div>

                    <div id="options-tier-summary" class="mb-6 flex items-center justify-between">
                    </div>

                    <div id="options-subscription-manage-wrap" class="mb-6 hidden">
                        <div class="bg-white rounded-2xl shadow-lg border-2 border-indigo-200 overflow-hidden">
                            <div class="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-indigo-100">
                                <h3 class="font-title text-xl text-indigo-800 mb-0.5"><i class="fas fa-credit-card mr-2 text-indigo-600"></i>Billing & subscription</h3>
                                <p class="text-sm text-indigo-600/90">Managed securely by Stripe. Your payment and plan details live in your Stripe customer portal.</p>
                            </div>
                            <div class="p-5 space-y-4">
                                <div>
                                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Current status</p>
                                    <p id="options-subscription-details" class="text-sm text-gray-800 font-medium" aria-live="polite">Loading subscription…</p>
                                    <div id="options-subscription-facts" class="mt-3 space-y-2"></div>
                                    <p id="options-subscription-source" class="mt-3 text-xs text-gray-500">Checking Stripe and school access settings…</p>
                                </div>
                                <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">In Stripe you can</p>
                                    <ul class="text-sm text-gray-700 space-y-2">
                                        <li class="flex items-center gap-2"><i class="fas fa-credit-card text-indigo-500 w-4 text-center" aria-hidden="true"></i>Update payment method</li>
                                        <li class="flex items-center gap-2"><i class="fas fa-file-invoice text-indigo-500 w-4 text-center" aria-hidden="true"></i>View and download invoices</li>
                                        <li class="flex items-center gap-2"><i class="fas fa-exchange-alt text-indigo-500 w-4 text-center" aria-hidden="true"></i>Change plan (upgrade or downgrade)</li>
                                        <li class="flex items-center gap-2"><i class="fas fa-calendar-times text-indigo-500 w-4 text-center" aria-hidden="true"></i>Cancel at end of billing period</li>
                                    </ul>
                                </div>
                                <p class="text-xs text-gray-500">To upgrade from the app, use the plan card above. Opening the button below takes you to Stripe’s secure portal.</p>
                                <button type="button" id="options-manage-subscription-btn" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-title text-base py-3 rounded-xl bubbly-button flex items-center justify-center gap-2">
                                    <i class="fas fa-external-link-alt"></i>
                                    <span>Open Stripe billing</span>
                                </button>
                                <p class="text-xs text-gray-400 text-center">You’ll be redirected to Stripe’s secure site.</p>
                            </div>
                        </div>
                    </div>

                    <div class="options-subtab-bar">
                        <button type="button" class="options-subtab-btn options-subtab-active" data-options-tab="manage">
                            <i class="fas fa-tools mr-1.5"></i> Manage
                        </button>
                        <button type="button" class="options-subtab-btn" data-options-tab="planning">
                            <i class="fas fa-calendar-alt mr-1.5"></i> Planning
                        </button>
                        <button type="button" class="options-subtab-btn" data-options-tab="profile">
                            <i class="fas fa-user mr-1.5"></i> Profile
                        </button>
                        <button type="button" class="options-subtab-btn" data-options-tab="assessments">
                            <i class="fas fa-clipboard-check mr-1.5"></i> Assessments
                        </button>
                        <button type="button" class="options-subtab-btn" data-options-tab="danger">
                            <i class="fas fa-shield-alt mr-1.5"></i> Danger
                        </button>
                    </div>

                    <div class="space-y-8">

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-amber-300 space-y-6" data-options-section="manage">
                                <h2 class="font-title text-3xl text-amber-700 mb-2 text-center">Student Star Manager
                                </h2>
                                <div id="star-manager-form" class="space-y-4">
                                    <div>
                                        <label for="star-manager-student-select"
                                            class="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
                                        <select id="star-manager-student-select"
                                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                                            <option value="">Loading students...</option>
                                        </select>
                                    </div>
                                    <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                        <h3 class="font-title text-xl text-amber-800 mb-2 text-center">Add Historical
                                            Award</h3>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <label for="star-manager-date"
                                                    class="block text-sm font-medium text-gray-700">Award Date</label>
                                                <input type="date" id="star-manager-date"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500"
                                                    disabled>
                                            </div>
                                            <div>
                                                <label for="star-manager-stars-to-add"
                                                    class="block text-sm font-medium text-gray-700">Stars to Add</label>
                                                <input type="number" id="star-manager-stars-to-add"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500"
                                                    min="0.5" step="0.5" max="10" value="1" disabled>
                                            </div>
                                        </div>
                                        <div>
                                            <label for="star-manager-reason"
                                                class="block text-sm font-medium text-gray-700 mt-2">Reason</label>
                                            <select id="star-manager-reason"
                                                class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-amber-500"
                                                disabled>
                                                <option value="teamwork">Teamwork</option>
                                                <option value="creativity">Creativity</option>
                                                <option value="respect">Respect</option>
                                                <option value="focus">Focus/Effort</option>
                                                <option value="welcome_back">Welcome Back Bonus</option>
                                                <option value="correction">Manual Correction</option>
                                            </select>
                                        </div>
                                        <button id="star-manager-add-btn"
                                            class="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-title text-lg py-2 rounded-xl bubbly-button"
                                            disabled>
                                            <i class="fas fa-plus-circle mr-2"></i> Add Stars to Log
                                        </button>
                                    </div>
                                    <div class="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <h3 class="font-title text-xl text-blue-800 mb-2 text-center">Direct Score
                                            Override</h3>
                                        <p class="text-xs text-gray-600 text-center mb-3">Manually set the star
                                            counters. This does NOT create a log entry.</p>
                                        <div id="star-override-form" class="grid grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label for="override-today-stars"
                                                    class="block text-sm font-medium text-gray-700">Today</label>
                                                <input type="number" id="override-today-stars"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    min="0" value="0" disabled>
                                            </div>
                                            <div>
                                                <label for="override-monthly-stars"
                                                    class="block text-sm font-medium text-gray-700">Monthly</label>
                                                <input type="number" id="override-monthly-stars"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    min="0" value="0" disabled>
                                            </div>
                                            <div>
                                                <label for="override-total-stars"
                                                    class="block text-sm font-medium text-gray-700">Total</label>
                                                <input type="number" id="override-total-stars"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    min="0" value="0" disabled>
                                            </div>
                                        </div>
                                        <button id="star-manager-override-btn"
                                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-title text-lg py-2 rounded-xl bubbly-button"
                                            disabled>
                                            <i class="fas fa-wrench mr-2"></i> Set Student Scores
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-yellow-400 space-y-6" data-options-section="manage">
                                <div class="text-center">
                                    <div class="text-4xl mb-2">💰</div>
                                    <h2 class="font-title text-3xl text-yellow-700">Coin Purse Manager</h2>
                                    <p class="text-sm text-gray-500">Fix balances or reward custom gold amounts.</p>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="md:col-span-2">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Select
                                            Student</label>
                                        <select id="economy-student-select"
                                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white">
                                            <option value="">Loading...</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Current Gold</label>
                                        <div class="relative">
                                            <input type="number" id="economy-gold-input"
                                                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 font-bold text-lg text-yellow-600"
                                                placeholder="0">
                                            <div class="absolute right-4 top-3 text-yellow-500">🪙</div>
                                        </div>
                                    </div>

                                    <div class="flex items-end">
                                        <button id="save-gold-btn"
                                            class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-title text-lg py-3 rounded-xl bubbly-button disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled>
                                            <i class="fas fa-save mr-2"></i> Update Balance
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="space-y-6" data-options-section="planning">
                                <div id="options-planning-locked" class="options-tier-locked hidden">
                                    <div class="options-tier-locked-icon">📅</div>
                                    <div class="options-tier-locked-title">Planning tools</div>
                                    <p class="options-tier-locked-text">School Year Planner and Class End Dates are available on the Pro plan.</p>
                                    <span class="options-tier-locked-badge">Pro</span>
                                </div>
                                <div id="options-planning-content" class="flex flex-col gap-8">
                                    <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-pink-300 space-y-4">
                                        <h2 class="font-title text-3xl text-pink-700 text-center">School Year Planner</h2>
                                        <p class="text-sm text-gray-500 text-center">Set school-wide holidays (Christmas,
                                            Easter) to overshadow the calendar.</p>

                                        <div class="grid grid-cols-2 gap-2">
                                            <div class="col-span-2">
                                                <label class="block text-xs font-bold text-gray-500">Holiday Name</label>
                                                <input type="text" id="holiday-name" placeholder="e.g. Christmas Break"
                                                    class="w-full px-3 py-2 border rounded-lg">
                                            </div>
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500">Start Date</label>
                                                <input type="date" id="holiday-start"
                                                    class="w-full px-3 py-2 border rounded-lg">
                                            </div>
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500">End Date</label>
                                                <input type="date" id="holiday-end" class="w-full px-3 py-2 border rounded-lg">
                                            </div>
                                            <div class="col-span-2">
                                                <label class="block text-xs font-bold text-gray-500">Theme</label>
                                                <select id="holiday-type" class="w-full px-3 py-2 border rounded-lg bg-white">
                                                    <option value="christmas">🎄 Christmas / Winter</option>
                                                    <option value="easter">🐣 Easter / Spring</option>
                                                    <option value="generic">📅 Generic / Other</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button id="add-holiday-btn"
                                            class="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 rounded-xl bubbly-button">
                                            <i class="fas fa-plus-circle mr-2"></i> Add Break
                                        </button>

                                        <div id="holiday-list" class="mt-4 space-y-2 max-h-40 overflow-y-auto"></div>
                                    </div>
                                    
                                    <!-- Class End Dates Configuration -->
                                    <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-purple-300 space-y-4">
                                        <h2 class="font-title text-3xl text-purple-700 text-center">Class End Dates</h2>
                                        <p class="text-sm text-gray-500 text-center">Set the last lesson date for each class. The Grand Guild Ceremony will activate on these dates.</p>

                                        <div id="class-end-dates-list" class="space-y-3 max-h-60 overflow-y-auto">
                                            <!-- Class end dates will be populated here by JavaScript -->
                                        </div>
                                        
                                        <button id="save-class-end-dates-btn"
                                            class="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded-xl bubbly-button">
                                            <i class="fas fa-save mr-2"></i> Save End Dates
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-blue-300 space-y-4" data-options-section="profile">
                                <h2 class="font-title text-3xl text-blue-700 text-center">Profile Settings</h2>
                                <div>
                                    <label for="teacher-name-input"
                                        class="block text-sm font-medium text-gray-700 mb-1">Your Display Name</label>
                                    <input type="text" id="teacher-name-input"
                                        class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autocomplete="off">
                                </div>
                                <button id="save-teacher-name-btn"
                                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-title text-xl py-3 rounded-xl bubbly-button flex items-center justify-center mb-4">
                                    <i class="fas fa-save mr-2"></i> Save Name
                                </button>
                                <div class="pt-2 border-t border-dashed border-blue-100 space-y-3">
                                    <div>
                                        <label for="options-school-name-input"
                                            class="block text-sm font-medium text-gray-700 mb-1">School name</label>
                                        <input type="text" id="options-school-name-input"
                                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autocomplete="off"
                                            placeholder="e.g. Your School">
                                        <p class="text-xs text-gray-500 mt-1">This appears on the home screen, login header, and attendance footer.</p>
                                    </div>
                                    <button id="save-school-name-btn"
                                        class="w-full bg-sky-600 hover:bg-sky-700 text-white font-title text-xl py-3 rounded-xl bubbly-button flex items-center justify-center">
                                        <i class="fas fa-save mr-2"></i> Save School Name
                                    </button>
                                    <div class="pt-2 border-t border-dashed border-blue-100 space-y-2">
                                        <label for="options-school-location-search"
                                            class="block text-sm font-medium text-gray-700 mb-1">School location for weather</label>
                                        <div class="flex flex-wrap gap-2">
                                            <input type="text" id="options-school-location-search"
                                                class="flex-1 min-w-[180px] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                autocomplete="off"
                                                placeholder="e.g. Thessaloniki, Heraklion">
                                            <button id="search-school-location-btn"
                                                class="bg-sky-500 hover:bg-sky-600 text-white font-title text-lg py-3 px-4 rounded-xl bubbly-button flex items-center justify-center whitespace-nowrap">
                                                <i class="fas fa-search mr-2"></i> Search
                                            </button>
                                        </div>
                                        <select id="options-school-location-results" class="hidden w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-sm"></select>
                                        <p id="options-school-location-status" class="text-xs text-gray-500">No weather location selected. Default Athens area is used.</p>
                                        <button id="save-school-location-btn"
                                            class="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-title text-xl py-3 rounded-xl bubbly-button flex items-center justify-center">
                                            <i class="fas fa-map-marker-alt mr-2"></i> Save School Location
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-fuchsia-300 space-y-4 hidden" data-options-section="assessments">
                                <div class="text-center">
                                    <h2 class="font-title text-3xl text-fuchsia-700">Assessment Settings</h2>
                                    <p class="text-sm text-slate-500 mt-2">Set school-wide league defaults and decide which classes inherit them or use custom grading.</p>
                                </div>
                                <div class="rounded-[1.5rem] border border-fuchsia-100 bg-fuchsia-50/60 p-5">
                                    <h3 class="font-title text-2xl text-fuchsia-800 mb-3">School defaults by league</h3>
                                    <div id="options-assessment-defaults-editor" class="space-y-4"></div>
                                </div>
                                <div class="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/60 p-5">
                                    <h3 class="font-title text-2xl text-indigo-800 mb-3">Per-class overrides</h3>
                                    <div id="options-class-assessment-editor" class="space-y-4"></div>
                                </div>
                                <button id="save-assessment-settings-btn"
                                    class="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-title text-xl py-3 rounded-xl bubbly-button flex items-center justify-center">
                                    <i class="fas fa-save mr-2"></i> Save Assessment Settings
                                </button>
                            </div>

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-red-300 space-y-4" data-options-section="danger">
                                <h2 class="font-title text-3xl text-red-700 text-center">Danger Zone</h2>
                                <div class="space-y-4">
                                    <p class="text-sm text-gray-600 text-center">These actions are permanent and can
                                        result in data loss. Proceed with caution.</p>
                                    <button id="star-manager-purge-btn"
                                        class="w-full bg-red-600 hover:bg-red-700 text-white font-title text-lg py-2 rounded-xl bubbly-button"
                                        disabled>
                                        <i class="fas fa-exclamation-triangle mr-2"></i> Purge Student Score Data
                                    </button>
                                    <button id="erase-today-btn"
                                        class="w-full bg-orange-500 hover:bg-orange-600 text-white font-title text-lg py-2 rounded-xl bubbly-button">
                                        <i class="fas fa-undo mr-2"></i> Erase Today's Stars
                                    </button>
                                    <button id="purge-logs-btn"
                                        class="w-full bg-red-800 hover:bg-red-900 text-white font-title text-lg py-2 rounded-xl bubbly-button">
                                        <i class="fas fa-fire mr-2"></i> Purge All My Award Logs
                                    </button>
                                </div>
                            </div>
                            <div class="options-meta-footer mt-8 text-center text-xs text-gray-400">
                                <span id="app-tier-label" class="font-semibold block"></span>
                                <span id="app-version-label" class="block mt-1"></span>
                            </div>
                    </div>
                </div>
            </div>

            <!-- Pricing Comparison Modal -->
            <div id="pricing-modal" class="fixed inset-0 bg-slate-950/60 z-[95] flex items-center justify-center p-4 hidden backdrop-blur-sm">
                <div class="bg-white p-0 rounded-[1.8rem] shadow-2xl max-w-6xl w-full h-[85vh] pop-in border border-slate-200 flex flex-col overflow-hidden relative">
                    <button id="pricing-modal-close-btn" class="premium-close-btn absolute top-4 right-4 bg-white/75 hover:bg-white text-slate-500 hover:text-rose-500 font-bold w-10 h-10 rounded-full bubbly-button z-50 transition-colors">&times;</button>
                    
                    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 text-center">
                        <h2 class="font-title text-3xl mb-2">🏆 Choose Your Quest Plan</h2>
                        <p class="text-indigo-100">Unlock powerful features to transform your English teaching adventure</p>
                    </div>
                    
                    <div class="flex-grow overflow-y-auto p-6">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <!-- Starter Tier -->
                            <div class="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden">
                                <div class="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-4 text-center">
                                    <h3 class="font-title text-2xl mb-1">Starter</h3>
                                    <div class="text-3xl font-bold mb-2">€20<span class="text-lg font-normal">/month</span></div>
                                    <p class="text-gray-100 text-sm">Perfect for getting started</p>
                                </div>
                                <div class="p-4">
                                    <h4 class="font-semibold text-gray-700 mb-3">Core Features:</h4>
                                    <ul class="space-y-2 text-sm">
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Star awarding system</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Monthly ceremonies</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Quest Assignment & Attendance</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Quest Bounties</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Basic Mystic Market</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Hero's Boon (peer gifts)</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Quest World Map</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Projector Mode</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Hero's Chronicle (notes only)</span></li>
                                    </ul>
                                </div>
                            </div>
                            
                            <!-- Pro Tier -->
                            <div class="bg-white rounded-2xl border-2 border-indigo-400 shadow-lg overflow-hidden relative">
                                <div class="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs px-3 py-1 rounded-bl-xl">MOST POPULAR</div>
                                <div class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-4 text-center">
                                    <h3 class="font-title text-2xl mb-1">Pro</h3>
                                    <div class="text-3xl font-bold mb-2">€40<span class="text-lg font-normal">/month</span></div>
                                    <p class="text-indigo-100 text-sm">Complete classroom management</p>
                                </div>
                                <div class="p-4">
                                    <h4 class="font-semibold text-gray-700 mb-3">All Starter +:</h4>
                                    <ul class="space-y-2 text-sm">
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🏰 Guilds system & sorting quiz</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>⚔️ Hero Classes & Skill Tree</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📅 Calendar & Day Planner</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🗓️ School Year Planner</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📜 Scholar's Scroll (tests/dictations)</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📓 Adventure Log (manual entries)</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📋 Advanced Attendance Chronicle</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔄 Make-up lesson tracking</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🏆 Hall of Heroes</span></li>
                                    </ul>
                                </div>
                            </div>
                            
                            <!-- Elite Tier -->
                            <div class="bg-white rounded-2xl border-2 border-purple-400 shadow-lg overflow-hidden">
                                <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 text-center">
                                    <h3 class="font-title text-2xl mb-1">Elite</h3>
                                    <div class="text-3xl font-bold mb-2">€60<span class="text-lg font-normal">/month</span></div>
                                    <p class="text-purple-100 text-sm">Ultimate AI-powered experience</p>
                                </div>
                                <div class="p-4">
                                    <h4 class="font-semibold text-gray-700 mb-3">All Pro +:</h4>
                                    <ul class="space-y-2 text-sm">
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🤖 AI-powered Adventure Log</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>✏️ Edit AI-generated entries</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📖 Story Weavers (collaborative)</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔤 Word of the Day</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🐉 Familiars (magical companions)</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔮 Hero's Chronicle Oracle</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🎭 AI avatars</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📄 AI reports & certificates</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🎨 AI story images</span></li>
                                        <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🌟 Priority support</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mt-6 p-4 bg-gray-50 rounded-xl">
                            <h4 class="font-semibold text-gray-700 mb-2">💡 Why upgrade?</h4>
                            <p class="text-sm text-gray-600 mb-3">Each tier builds upon the previous one, giving you more powerful tools to engage your students and save time.</p>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div class="text-center">
                                    <div class="text-2xl mb-1">🌱</div>
                                    <strong>Starter:</strong> Perfect for testing the waters
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl mb-1">🚀</div>
                                    <strong>Pro:</strong> Complete classroom ecosystem
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl mb-1">✨</div>
                                    <strong>Elite:</strong> AI-powered magic that saves hours
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
`;
