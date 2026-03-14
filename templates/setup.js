// templates/setup.js
// First-user new-school setup screen (shown when school has no classes)

export const setupHTML = `
    <div id="setup-screen" class="fixed inset-0 z-40 hidden flex flex-col items-center justify-center p-4"
        style="background: linear-gradient(135deg, #a8e0ff 0%, #8ee3f8 100%);">
        <div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 border-4 border-gray-200">
            <h1 class="font-title text-4xl text-sky-700 text-center mb-2">Set up your school</h1>
            <p class="text-center text-gray-600 mb-6">Add your first classes and invite your colleagues. Then enter the Quest!</p>

            <section class="mb-6">
                <h2 class="font-title text-xl text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fas fa-school text-sky-500"></i> School name
                </h2>
                <p class="text-gray-600 text-sm mb-2">This is how your school will appear across the app (home screen, headers, certificates).</p>
                <input type="text" id="setup-school-name" placeholder="e.g. Prodiges Language School"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500">
            </section>

            <section class="mb-8">
                <h2 class="font-title text-xl text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fas fa-chalkboard-teacher text-sky-500"></i> Add classes
                </h2>
                <div class="flex flex-wrap gap-2 mb-3">
                    <input type="text" id="setup-class-name" placeholder="Class name (e.g. Junior A)"
                        class="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500">
                    <select id="setup-class-level" class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white">
                        <option value="Junior A">Junior A</option>
                        <option value="Junior B">Junior B</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                    </select>
                    <button type="button" id="setup-add-class-btn" class="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg bubbly-button">
                        <i class="fas fa-plus mr-1"></i> Add
                    </button>
                </div>
                <ul id="setup-classes-list" class="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto"></ul>
            </section>

            <section class="mb-8">
                <h2 class="font-title text-xl text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fas fa-user-plus text-sky-500"></i> Invite other teachers
                </h2>
                <p class="text-gray-600 text-sm mb-2">Share the signup link with your colleagues. They can sign up here and create their own classes.</p>
                <div class="flex gap-2">
                    <input type="text" id="setup-invite-link" readonly
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm">
                    <button type="button" id="setup-copy-link-btn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg bubbly-button whitespace-nowrap">
                        <i class="fas fa-copy mr-1"></i> Copy link
                    </button>
                </div>
            </section>

            <div class="text-center">
                <button type="button" id="setup-enter-quest-btn" class="bg-emerald-500 hover:bg-emerald-600 text-white font-title text-xl py-3 px-8 rounded-xl bubbly-button">
                    <i class="fas fa-dragon mr-2"></i> Enter the Quest
                </button>
                <p id="setup-enter-hint" class="text-xs text-gray-500 mt-2 hidden">Add at least one class to continue.</p>
            </div>
        </div>
    </div>
`;
