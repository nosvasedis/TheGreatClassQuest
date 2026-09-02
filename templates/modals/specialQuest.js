export const specialQuestModalHTML = `
<div id="special-quest-runner-modal" class="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[80] hidden flex items-center justify-center p-3 md:p-6 overflow-y-auto">
  <div class="special-quest-runner bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-white/40 my-auto" role="dialog" aria-modal="true" aria-labelledby="special-quest-runner-title">
    
    <!-- Dynamic Themed Banner -->
    <div id="special-quest-runner-banner" class="relative p-5 md:p-7 bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white overflow-hidden">
      <div class="absolute -right-6 -bottom-6 w-32 h-32 opacity-15 pointer-events-none" id="special-quest-runner-bg-icon"></div>
      <div class="flex items-start justify-between gap-4 relative z-10">
        <div class="flex items-center gap-3.5 md:gap-4">
          <div id="special-quest-runner-icon-wrap" class="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner shrink-0 p-2.5">
            <img id="special-quest-runner-badge-img" src="" alt="Quest Badge" class="w-full h-full object-contain" />
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span id="special-quest-runner-status" class="quest-status-chip quest-status-chip--active">Active</span>
              <span id="special-quest-runner-reward-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <span>⭐ +1 Stars</span> <span>🪙 +1 Gold</span>
              </span>
            </div>
            <h2 id="special-quest-runner-title" class="font-title text-2xl md:text-3xl font-black text-white mt-1 drop-shadow-sm">Special Quest</h2>
            <p id="special-quest-runner-instructions" class="text-xs md:text-sm text-indigo-200 mt-0.5 line-clamp-2 max-w-xl"></p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button id="special-quest-projector-toggle" type="button" class="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all border border-white/15 shadow-sm" aria-label="Toggle Projector Mode">
            <i class="fas fa-expand"></i> <span>Projector</span>
          </button>
          <button id="special-quest-runner-close" type="button" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all shrink-0 border border-white/10" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Dedicated Projector Screen Surface -->
    <div id="special-quest-projector-view" class="hidden min-h-[440px] p-6 md:p-10 flex flex-col items-center justify-center text-center"></div>

    <!-- Modal Content Body -->
    <div id="special-quest-runner-body" class="p-5 md:p-7 space-y-6">
      
      <!-- Progress Bar & Count -->
      <div class="bg-slate-50 border border-slate-100 rounded-2xl p-4">
        <div class="flex items-center justify-between text-sm font-black text-slate-600 mb-2">
          <span class="flex items-center gap-1.5"><i class="fas fa-bullseye text-indigo-500"></i> Quest Objective</span>
          <span id="special-quest-runner-count" class="text-base font-black text-indigo-600">0 / 0</span>
        </div>
        <div class="special-quest-progress-track h-3 bg-slate-200 rounded-full overflow-hidden">
          <div id="special-quest-runner-progress" class="special-quest-progress-fill h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 transition-all duration-300 rounded-full" style="width: 0%"></div>
        </div>
      </div>

      <!-- Specific Interactive Mechanic Widget (Gems, Shield, Chain, Checklist, Saga) -->
      <div id="special-quest-runner-interactive" class="min-h-[60px]"></div>

      <!-- Action Buttons Controls -->
      <div id="special-quest-runner-controls" class="flex flex-wrap gap-3"></div>

      <!-- Saga Sentence Box (When active) -->
      <div id="special-quest-runner-saga" class="hidden bg-rose-50/60 border border-rose-100 rounded-2xl p-4">
        <label for="special-quest-sentence" class="block text-sm font-black text-rose-900 mb-1 flex items-center gap-1.5">
          <i class="fas fa-feather-alt text-rose-500"></i> Sentence Storyteller Prompt
        </label>
        <textarea id="special-quest-sentence" maxlength="240" rows="2" placeholder="Write or speak the next sentence in the saga..." class="w-full border border-rose-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white"></textarea>
      </div>

      <!-- Recipient Picker Section -->
      <div class="border-t border-slate-100 pt-5">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 class="font-title text-base md:text-lg font-black text-slate-800 flex items-center gap-1.5">
              <i class="fas fa-users text-indigo-500"></i> Reward Recipients
            </h3>
            <p class="text-xs text-slate-500 font-medium">Select students who participated in this quest</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="special-quest-select-all" type="button" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">Select All</button>
            <button id="special-quest-deselect-all" type="button" class="text-xs font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">Clear</button>
            <span id="special-quest-recipient-count" class="text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">0 recipients</span>
          </div>
        </div>
        <div id="special-quest-recipient-list" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1" aria-label="Quest reward recipients"></div>
      </div>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <button id="special-quest-runner-undo" type="button" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-sm transition-colors flex items-center gap-1.5">
          <i class="fas fa-rotate-left text-xs"></i> Undo
        </button>
        <button id="special-quest-runner-complete" type="button" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all flex items-center gap-2" disabled>
          <i class="fas fa-award"></i> Complete Quest
        </button>
      </div>

    </div>
  </div>
</div>
`;

