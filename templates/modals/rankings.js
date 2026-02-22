// templates/modals/rankings.js
// Global leaderboard modal

export const rankingsModalsHTML = `
    <div id="global-leaderboard-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[95] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full pop-in border-4 border-purple-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 id="global-leaderboard-title" class="font-title text-2xl md:text-3xl text-purple-700">Global
                    Leaderboard</h2>
                <button id="global-leaderboard-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="global-leaderboard-content" class="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            </div>
        </div>
    </div>
`;
