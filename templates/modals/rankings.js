// templates/modals/rankings.js
// Global leaderboard modal

export const rankingsModalsHTML = `
    <div id="global-leaderboard-modal"
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[95] flex items-center justify-center p-4 hidden">
        <div class="bg-white/95 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-4xl w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
            <div class="relative bg-gradient-to-r from-purple-700 via-indigo-700 to-violet-700 p-6 text-white flex-shrink-0 overflow-hidden">
                <div class="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none"></div>
                <div class="absolute bottom-0 left-0 w-56 h-56 bg-fuchsia-400/15 rounded-full -ml-24 -mb-24 blur-2xl pointer-events-none"></div>
                <div class="relative flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4 min-w-0">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30 flex-shrink-0">
                            <i class="fas fa-trophy text-white drop-shadow-sm"></i>
                        </div>
                        <div class="min-w-0">
                            <h2 id="global-leaderboard-title" class="font-title text-3xl drop-shadow-md truncate">Global Leaderboard</h2>
                            <p id="global-leaderboard-subtitle" class="text-indigo-100 font-bold uppercase tracking-widest text-[10px] opacity-90">Hero Logs</p>
                        </div>
                    </div>
                    <button id="global-leaderboard-close-btn"
                        class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90 flex-shrink-0">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div id="global-leaderboard-controls" class="px-6 pt-5 pb-4 bg-slate-50/40 border-b border-slate-200/60">
            </div>
            <div id="global-leaderboard-content" class="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-slate-50/30">
            </div>
        </div>
    </div>
`;
