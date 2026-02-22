// templates/modals/attendance.js
// Trial type, bulk trial, attendance chronicle, trial history, hidden print templates

export const attendanceModalsHTML = `
    <div id="trial-type-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full pop-in border-4 border-amber-300 text-center">
            <h2 class="font-title text-4xl text-amber-800 mb-2">Choose Your Challenge</h2>
            <p class="text-gray-600 mb-8">What kind of trial are we logging today?</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button id="select-dictation-btn"
                    class="flex flex-col items-center justify-center p-8 rounded-2xl border-4 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 hover:shadow-xl transition-all duration-200 bubbly-button group">
                    <i
                        class="fas fa-microphone-alt text-6xl text-blue-400 mb-4 group-hover:text-blue-600 group-hover:scale-110 transition-transform"></i>
                    <span class="font-title text-3xl text-blue-800">Dictation</span>
                </button>

                <button id="select-test-btn"
                    class="flex flex-col items-center justify-center p-8 rounded-2xl border-4 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400 hover:shadow-xl transition-all duration-200 bubbly-button group">
                    <i
                        class="fas fa-file-alt text-6xl text-green-400 mb-4 group-hover:text-green-600 group-hover:scale-110 transition-transform"></i>
                    <span class="font-title text-3xl text-green-800">Test</span>
                </button>
            </div>

            <button id="trial-type-cancel-btn"
                class="mt-8 text-gray-500 hover:text-gray-800 font-semibold underline">Cancel</button>
        </div>
    </div>

    <div id="bulk-trial-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[73] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col pop-in border-4 border-amber-300 overflow-hidden">

            <div
                class="bg-amber-50 p-6 border-b-2 border-amber-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 id="bulk-trial-title" class="font-title text-3xl text-amber-800">Log Results</h2>
                    <p id="bulk-trial-subtitle" class="text-amber-600 font-semibold"></p>
                </div>
                <div class="flex flex-wrap gap-4 items-end">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase">Date</label>
                        <input type="date" id="bulk-trial-date"
                            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none">
                    </div>
                    <div id="bulk-trial-title-wrapper" class="hidden">
                        <label class="block text-xs font-bold text-gray-500 uppercase">Title</label>
                        <input type="text" id="bulk-trial-name" placeholder="e.g. Unit 5 Quiz"
                            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none w-48 md:w-64">
                    </div>
                    <button id="bulk-trial-save-btn"
                        class="bg-amber-500 hover:bg-amber-600 text-white font-title text-xl py-2 px-8 rounded-xl bubbly-button shadow-md">
                        <i class="fas fa-save mr-2"></i> Save All
                    </button>
                </div>
            </div>

            <div class="flex-grow overflow-y-auto p-6 bg-gray-50">
                <div id="bulk-student-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
            </div>

            <div class="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
                <span class="text-xs text-gray-400">Prodigies Language School</span>
                <button id="bulk-trial-close-btn"
                    class="text-gray-500 hover:text-red-500 font-bold px-4">Cancel</button>
            </div>
        </div>
    </div>

    <div id="attendance-chronicle-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-gray-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 id="attendance-chronicle-title" class="font-title text-2xl md:text-3xl text-gray-700">Attendance
                    Chronicle</h2>
                <button id="attendance-chronicle-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="attendance-chronicle-content" class="space-y-4 max-h-[70vh] overflow-y-auto overflow-x-auto pr-2">
            </div>
        </div>
    </div>

    <div id="trial-history-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-gradient-to-br from-amber-50 to-orange-100 p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-amber-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 id="trial-history-title" class="font-title text-2xl md:text-3xl text-amber-800">Trial History</h2>
                <button id="trial-history-close-btn"
                    class="bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="trial-history-controls-container" class="flex justify-between items-center mb-4">
                <div id="trial-history-view-toggle"
                    class="inline-flex items-center bg-white/50 p-1 rounded-full border-2 border-amber-200 shadow-inner">
                </div>
                <div id="trial-history-actions" class="flex items-center gap-2 flex-wrap justify-end">
                </div>
            </div>
            <div id="trial-history-content"
                class="space-y-3 max-h-[60vh] overflow-y-auto p-2 flex-grow bg-white/30 rounded-lg">
            </div>
        </div>
    </div>

    <div style="position: fixed; left: -9999px; top: -9999px;">
        <div id="certificate-template">
            <div
                style="display: flex; flex-direction: column; height: 100%; width: 100%; align-items: center; text-align: center; position: relative;">

                <div>
                    <div id="cert-icon" style="font-size: 70px; line-height: 1; margin-bottom: 5px;"></div>
                    <h1 id="cert-title" style="font-family: 'Fredoka One', cursive; font-size: 44px; margin: 0;">
                        Certificate of Achievement</h1>
                    <p style="font-size: 22px; margin-top: 5px;">PROUDLY PRESENTED TO</p>
                </div>

                <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; width: 100%;">
                    <p id="cert-student-name"
                        style="font-family: 'Fredoka One', cursive; font-size: 56px; margin: 10px 0;"></p>
                    <div id="cert-text" style="font-size: 21px; margin: 10px auto; max-width: 90%;">
                        Certificate text will be generated here.
                    </div>
                </div>

                <div style="width: 100%; margin-top: auto; padding-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center;">
                            <p style="border-top-width: 2px; border-top-style: solid; padding-top: 5px; font-weight: bold;"
                                id="cert-teacher-name">Teacher Name</p>
                            <p style="font-size: 14px; margin-top: 5px;">Quest Facilitator</p>
                        </div>
                        <div style="display: flex; align-items: flex-end; gap: 15px;">
                            <div style="text-align: center;">
                                <p style="border-top-width: 2px; border-top-style: solid; padding-top: 5px; font-weight: bold;"
                                    id="cert-date">Date</p>
                                <p style="font-size: 14px; margin-top: 5px;">Date of Issue</p>
                            </div>
                            <img id="cert-avatar" src=""
                                style="display: none; width: 60px; height: 60px; border-radius: 9999px; border: 4px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        </div>
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 15px; text-align: center; width: 100%;">
                        Prodigies Language School</p>
                </div>

            </div>
        </div>
        <div id="storybook-print-container" style="width: 800px;"></div>
        <div id="storybook-signature-page-template"
            style="width: 800px; height: 600px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; background-color: #F3E8FF; border: 10px solid #A855F7; box-sizing: border-box;">
            <div id="signature-class-logo" style="font-size: 100px; margin-bottom: 20px;"></div>
            <h2 id="signature-created-by"
                style="font-family: 'Fredoka One', cursive; font-size: 40px; color: #5B21B6; text-align: center;">
                Created By The Adventurers Of</h2>
            <h1 id="signature-class-name"
                style="font-family: 'Fredoka One', cursive; font-size: 50px; color: #3730A3; text-align: center; margin-bottom: 20px;">
            </h1>
            <div id="signature-student-list"
                style="display: flex; flex-wrap: wrap; justify-content: center; gap: 5px 15px; font-family: 'Georgia', serif; font-size: 18px; color: #4C1D95;">
            </div>
            <p id="signature-school-name" style="font-size: 14px; color: #6D28D9; margin-top: auto;">Prodigies Language
                School</p>
        </div>
    </div>
`;
