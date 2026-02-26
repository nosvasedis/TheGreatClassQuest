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

            <!-- Corner ornaments (border-color set by JS) -->
            <div id="cert-corner-tl" style="position:absolute;top:14px;left:14px;width:26px;height:26px;border-top:2px solid;border-left:2px solid;border-radius:3px 0 0 0;opacity:0.5;pointer-events:none;"></div>
            <div id="cert-corner-tr" style="position:absolute;top:14px;right:14px;width:26px;height:26px;border-top:2px solid;border-right:2px solid;border-radius:0 3px 0 0;opacity:0.5;pointer-events:none;"></div>
            <div id="cert-corner-bl" style="position:absolute;bottom:14px;left:14px;width:26px;height:26px;border-bottom:2px solid;border-left:2px solid;border-radius:0 0 0 3px;opacity:0.5;pointer-events:none;"></div>
            <div id="cert-corner-br" style="position:absolute;bottom:14px;right:14px;width:26px;height:26px;border-bottom:2px solid;border-right:2px solid;border-radius:0 0 3px 0;opacity:0.5;pointer-events:none;"></div>

            <!-- Header: crest icon + title, subtitle -->
            <div style="flex-shrink:0; text-align:center;">
                <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:2px;">
                    <div id="cert-icon" style="font-size:44px; line-height:1;"></div>
                </div>
                <h1 id="cert-title" style="font-family:'Fredoka One',cursive; font-size:36px; margin:0; line-height:1.1;"></h1>
                <p style="font-size:10.5px; margin:3px 0 0; letter-spacing:0.15em; text-transform:uppercase; opacity:0.65;">
                    The Great Class Quest &nbsp;•&nbsp; Hero Certificate
                </p>
            </div>

            <!-- Divider 1 -->
            <div style="width:100%; display:flex; align-items:center; gap:10px; margin:9px 0 6px; flex-shrink:0; opacity:0.3;">
                <div style="flex:1; border-top:1px solid rgba(0,0,0,0.6);"></div>
                <span style="font-size:12px; color:rgba(0,0,0,0.5);">✦</span>
                <div style="flex:1; border-top:1px solid rgba(0,0,0,0.6);"></div>
            </div>

            <!-- Proudly Presented To + Name -->
            <div style="flex-shrink:0; text-align:center; margin-bottom:4px;">
                <p style="font-size:11px; text-transform:uppercase; letter-spacing:0.2em; opacity:0.58; margin:0 0 3px;">Proudly Presented To</p>
                <p id="cert-student-name" style="font-family:'Fredoka One',cursive; font-size:46px; margin:0; line-height:1.2;"></p>
            </div>

            <!-- Badges row: class, guild, hero, stars, league, virtue (kept in a single row) -->
            <div id="cert-badges" style="display:flex; flex-wrap:nowrap; justify-content:center; align-items:stretch; gap:6px; margin:22px 0 12px; font-size:11px; font-weight:600; flex-shrink:0; max-width:100%;">
                <span id="cert-class-name"   class="cert-pill" style="display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border-radius:9999px; white-space:nowrap; box-sizing:border-box;"></span>
                <span id="cert-guild-pill"   class="cert-pill" style="display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border-radius:9999px; white-space:nowrap; box-sizing:border-box;"></span>
                <span id="cert-hero-pill"    class="cert-pill" style="display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border-radius:9999px; white-space:nowrap; box-sizing:border-box;"></span>
                <span id="cert-stars-pill"   class="cert-pill" style="display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border-radius:9999px; white-space:nowrap; box-sizing:border-box;"></span>
                <span id="cert-league-pill"  class="cert-pill" style="display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border-radius:9999px; white-space:nowrap; box-sizing:border-box;"></span>
                <span id="cert-virtue-pill"  class="cert-pill" style="display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 12px; border-radius:9999px; white-space:nowrap; box-sizing:border-box;"></span>
            </div>

            <!-- AI-generated certificate text -->
            <div id="cert-text" style="font-size:16.5px; text-align:center; line-height:1.62; max-width:86%; flex-shrink:0; font-style:italic;"></div>

            <!-- Decorative flair row under the main text -->
            <div id="cert-flair-row" style="margin-top:8px; display:flex; justify-content:center; gap:8px; flex-shrink:0;"></div>

            <!-- Meta stats line -->
            <div id="cert-meta" style="font-size:10.5px; margin-top:4px; opacity:0.52; text-align:center; flex-shrink:0; letter-spacing:0.06em;"></div>

            <!-- Flex spacer — pushes footer down -->
            <div style="flex:1; min-height:6px;"></div>

            <!-- Divider 2 -->
            <div style="width:100%; display:flex; align-items:center; gap:10px; margin-bottom:9px; flex-shrink:0; opacity:0.3;">
                <div style="flex:1; border-top:1px solid rgba(0,0,0,0.6);"></div>
                <span style="font-size:12px; color:rgba(0,0,0,0.5);">✦</span>
                <div style="flex:1; border-top:1px solid rgba(0,0,0,0.6);"></div>
            </div>

            <!-- Footer: guild emblem + teacher | school | date + avatar -->
            <div style="width:100%; display:flex; justify-content:space-between; align-items:flex-end; flex-shrink:0;">
                <div style="display:flex; align-items:flex-end; gap:8px;">
                    <img id="cert-guild-emblem" src="" style="display:none; width:50px; height:50px; border-radius:9999px; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.22); object-fit:cover; flex-shrink:0;">
                    <div style="text-align:center; min-width:150px;">
                        <p id="cert-teacher-name" style="font-weight:700; font-size:13px; border-top-width:2px; border-top-style:solid; padding-top:5px; margin:0;"></p>
                        <p style="font-size:10px; margin-top:2px; opacity:0.55;">Quest Facilitator</p>
                    </div>
                </div>
                <div style="text-align:center; font-size:9.5px; opacity:0.38; flex:1; padding:0 8px;">
                    Prodigies Language School
                </div>
                <div style="display:flex; align-items:flex-end; gap:8px;">
                    <div style="text-align:center; min-width:150px;">
                        <p id="cert-date" style="font-weight:700; font-size:13px; border-top-width:2px; border-top-style:solid; padding-top:5px; margin:0;"></p>
                        <p style="font-size:10px; margin-top:2px; opacity:0.55;">Date of Issue</p>
                    </div>
                    <img id="cert-avatar" src="" style="display:none; width:50px; height:50px; border-radius:9999px; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.22); object-fit:cover; flex-shrink:0;">
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
