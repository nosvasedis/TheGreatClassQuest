// templates/modals/student.js
// Edit student, award note, note, move student

export const studentModalsHTML = `
    <div id="edit-student-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-cyan-300">
            <h2 class="font-title text-2xl text-cyan-700 mb-4 text-center">Edit Student Details</h2>
            <input type="hidden" id="edit-student-id-input-full">
            <div class="space-y-4">
                <div>
                    <label for="edit-student-name-input-full"
                        class="block text-sm font-medium text-gray-700">Name</label>
                    <input type="text" id="edit-student-name-input-full"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                        autocomplete="off" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Birthday</label>
                    <div class="flex items-center gap-2 mt-1">
                        <select id="edit-student-birthday-month"
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                        </select>
                        <select id="edit-student-birthday-day"
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Nameday</label>
                    <div class="flex items-center gap-2 mt-1">
                        <select id="edit-student-nameday-month"
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                        </select>
                        <select id="edit-student-nameday-day"
                            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                        </select>
                        <button id="lookup-nameday-btn"
                            class="bg-indigo-100 text-indigo-700 h-10 w-10 rounded-full bubbly-button flex-shrink-0"
                            title="AI Nameday Lookup"><i class="fas fa-magic"></i></button>
                    </div>
                </div>
                <div class="mt-4 p-4 bg-indigo-50 rounded-2xl border-2 border-indigo-100">
                    <label class="block text-sm font-black text-indigo-900 uppercase tracking-widest mb-2">
                        <i class="fas fa-masked-hero mr-2"></i>Choose Hero Path
                    </label>
                    <select id="edit-student-hero-class"
                        class="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-indigo-700">
                        <option value="">No Class Assigned</option>
                        <option value="Guardian">🛡️ Guardian (Respect)</option>
                        <option value="Sage">🔮 Sage (Creativity)</option>
                        <option value="Paladin">⚔️ Paladin (Teamwork)</option>
                        <option value="Artificer">⚙️ Artificer (Focus)</option>
                        <option value="Scholar">📜 Scholar (Trials)</option>
                        <option value="Weaver">✒️ Weaver (Story)</option>
                        <option value="Nomad">👟 Nomad (Attendance)</option>
                    </select>
                    <p class="text-[10px] text-indigo-400 mt-2 italic">Classes grant +10 extra Gold Coins when earning
                        stars for their specific trait.</p>
                </div>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="edit-student-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="edit-student-confirm-btn"
                    class="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save</button>
            </div>
        </div>
    </div>

    <div id="award-note-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-blue-300">
            <h2 class="font-title text-2xl text-blue-700 mb-4 text-center">Teacher's Note for Award</h2>
            <input type="hidden" id="award-note-log-id-input">
            <div class="mb-4">
                <label for="award-note-textarea" class="block text-sm font-medium text-gray-700">Your personal note for
                    this award:</label>
                <textarea id="award-note-textarea" rows="4"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="award-note-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="award-note-confirm-btn"
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save
                    Note</button>
            </div>
        </div>
    </div>

    <div id="note-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-blue-300">
            <h2 class="font-title text-2xl text-blue-700 mb-4 text-center">Teacher's Note for Adventure Log</h2>
            <input type="hidden" id="note-log-id-input">
            <div class="mb-4">
                <label for="note-textarea" class="block text-sm font-medium text-gray-700">Your personal note for this
                    day's log:</label>
                <textarea id="note-textarea" rows="4"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="note-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="note-confirm-btn"
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save
                    Note</button>
            </div>
        </div>
    </div>

    <div id="move-student-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-yellow-300">
            <h2 class="font-title text-2xl text-yellow-800 mb-4 text-center">Move Student</h2>
            <p class="text-center mb-2">Moving: <b id="move-student-name" class="text-lg"></b></p>
            <p class="text-center text-sm text-gray-600 mb-6">From: <span id="move-student-current-class"></span></p>
            <div class="mb-4">
                <label for="move-student-target-class" class="block text-sm font-medium text-gray-700">Select new class
                    (must be in the same league):</label>
                <select id="move-student-target-class"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"></select>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="move-student-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="move-student-confirm-btn"
                    class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Confirm
                    Move</button>
            </div>
        </div>
    </div>
`;
