// templates/app/tabs/students.js

export const studentsTabHTML = `
    <div id="manage-students-tab" class="app-tab hidden">
        <div class="max-w-5xl mx-auto px-2 sm:px-4">

            <!-- Page Header Card -->
            <div class="bg-white rounded-2xl shadow-md border-b-4 border-teal-400 mb-5 overflow-hidden">

                <!-- Top row: back / title / add-toggle / count -->
                <div class="flex items-center gap-3 px-4 py-3">
                    <button id="back-to-classes-btn"
                        class="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-full bubbly-button flex-shrink-0 transition-colors">
                        <i class="fas fa-arrow-left text-sm"></i>
                        <span class="hidden sm:inline">Classes</span>
                    </button>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold text-teal-500 uppercase tracking-widest leading-none">Managing Class</p>
                        <h2 class="font-title text-2xl text-teal-700 truncate" id="manage-class-name"></h2>
                    </div>
                    <button id="add-student-toggle-btn"
                        class="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-full bubbly-button flex-shrink-0 transition-colors shadow-sm">
                        <i class="fas fa-user-plus text-xs"></i>
                        <span class="hidden sm:inline text-sm">New Student</span>
                    </button>
                    <div id="student-count-badge"
                        class="hidden flex-shrink-0 bg-teal-100 text-teal-700 font-bold text-sm px-3 py-1.5 rounded-full border border-teal-200">
                        <i class="fas fa-users mr-1 text-teal-500 text-xs"></i><span id="student-count-number">0</span> students
                    </div>
                </div>

                <!-- Inline expandable add-student form (hidden by default) -->
                <div id="add-student-panel" class="hidden border-t border-teal-100 bg-teal-50/60 px-4 py-3">
                    <form id="add-student-form" class="flex items-center gap-2 sm:gap-3">
                        <input type="hidden" id="manage-class-id">
                        <input type="text" id="student-name" placeholder="Student's full name..."
                            class="flex-1 min-w-0 px-4 py-2 border-2 border-teal-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 text-gray-800 transition-all placeholder-gray-400 text-sm"
                            autocomplete="off" required>
                        <button type="submit"
                            class="flex-shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-title text-base py-2 px-4 rounded-xl bubbly-button shadow-md transition-all">
                            <i class="fas fa-plus text-xs"></i>
                            <span>Add to Roster</span>
                        </button>
                    </form>
                </div>

            </div>

            <!-- Student Roster — full width -->
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                <div class="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-3 flex items-center gap-2">
                    <i class="fas fa-scroll text-white/80 text-sm"></i>
                    <h3 class="font-title text-xl text-white">Student Roster</h3>
                </div>
                <div id="student-list" class="divide-y divide-gray-100"></div>
            </div>

        </div>
    </div>
`;
