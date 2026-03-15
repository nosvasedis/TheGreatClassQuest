// templates/app/tabs/classes.js

export const classesTabHTML = `
            <div id="my-classes-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-chalkboard-teacher text-green-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-green-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">My Classes</h2>
                        <p class="text-lg text-gray-600 mt-2">Manage your classes and student rosters from one place.</p>
                    </div>
                    <div id="class-list" class="space-y-4"></div>
                    <div class="mt-5 flex flex-col items-center gap-2 text-center">
                        <p class="text-sm text-gray-500">Need to add another class?</p>
                        <button id="open-create-class-modal-btn" type="button"
                            class="inline-flex items-center justify-center gap-2 bg-white hover:bg-green-50 text-green-700 border border-green-200 font-bold px-4 py-2.5 rounded-xl shadow-sm bubbly-button">
                            <i class="fas fa-plus-circle"></i>
                            <span>Add New Class</span>
                        </button>
                    </div>
                </div>
            </div>
`;
