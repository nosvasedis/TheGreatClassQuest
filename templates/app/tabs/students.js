// templates/app/tabs/students.js

export const studentsTabHTML = `
            <div id="manage-students-tab" class="app-tab hidden">
                <div class="max-w-6xl mx-auto">
                    <div class="flex items-center mb-6">
                        <button id="back-to-classes-btn"
                            class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full bubbly-button">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <h2 class="font-title text-3xl text-teal-700 text-center flex-1">
                            Managing: <span id="manage-class-name"></span>
                        </h2>
                        <input type="hidden" id="manage-class-id">
                    </div>

                    <div class="flex flex-col md:flex-row items-start gap-8">
                        <div class="w-full md:w-1/3 flex-shrink-0">
                            <form id="add-student-form"
                                class="bg-white p-6 rounded-3xl shadow-lg border-4 border-teal-300">
                                <h3 class="font-title text-2xl text-teal-700 mb-4 text-center">Add New Student</h3>
                                <div class="mb-4">
                                    <label for="student-name" class="block text-sm font-medium text-gray-700">Student
                                        Name</label>
                                    <input type="text" id="student-name"
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                                        autocomplete="off" required>
                                </div>
                                <button type="submit"
                                    class="w-full bg-teal-500 hover:bg-teal-600 text-white font-title text-xl py-3 rounded-xl bubbly-button">
                                    <i class="fas fa-user-plus"></i> Add Student
                                </button>
                            </form>
                        </div>
                        <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-teal-300 w-full flex-grow">
                            <h3 class="font-title text-2xl text-teal-700 mb-4 text-center">Student Roster</h3>
                            <div id="student-list" class="space-y-3 overflow-y-auto pr-2"></div>
                        </div>
                    </div>
                </div>
            </div>
`;
