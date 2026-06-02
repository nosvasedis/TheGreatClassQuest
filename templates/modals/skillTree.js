// templates/modals/skillTree.js — Skill Tree modal HTML shell (content rendered dynamically)

export const skillTreeModalHTML = `
    <div id="skill-tree-modal"
        class="fixed inset-0 bg-black/90 backdrop-blur-md z-[90] flex items-center justify-center p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="skill-tree-modal-title">
        
        <div class="skill-tree-modal-panel relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden pop-in border border-white/10"
             id="skill-tree-modal-panel">

            <!-- Background Decoration -->
            <div id="skill-tree-bg-ornament" class="absolute inset-0 pointer-events-none opacity-10 overflow-hidden">
                <div class="ornament-circle ornament-1"></div>
                <div class="ornament-circle ornament-2"></div>
                <div id="skill-tree-class-bg-icon" class="absolute -bottom-20 -right-20 text-[20rem] font-bold select-none rotate-12"></div>
            </div>

            <!-- Header -->
            <div id="skill-tree-modal-header"
                 class="relative z-10 flex-shrink-0 p-6 md:p-8 flex items-center justify-between">
                <div class="flex items-center gap-5">
                    <div class="relative">
                        <div id="skill-tree-class-icon-glow" class="absolute inset-0 blur-2xl opacity-50 scale-150"></div>
                        <div id="skill-tree-class-icon" class="relative text-6xl filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"></div>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="h-px w-4 bg-white/30"></span>
                            <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Ascension Path</p>
                        </div>
                        <h2 id="skill-tree-modal-title"
                            class="font-title text-3xl md:text-4xl text-white leading-tight tracking-tight"></h2>
                        <p id="skill-tree-student-name" class="text-sm text-white/60 font-medium mt-1 flex items-center gap-2">
                            <i class="fas fa-user-shield opacity-50"></i>
                            <span class="student-name-text"></span>
                        </p>
                    </div>
                </div>
                <button id="skill-tree-close-btn"
                        class="group relative w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300">
                    <span class="text-white/40 group-hover:text-white text-2xl transition-colors">&times;</span>
                </button>
            </div>

            <!-- Progress Bar + Level Indicator -->
            <div id="skill-tree-progress-section"
                 class="relative z-10 flex-shrink-0 px-6 md:px-8 py-4 flex flex-col gap-2">
                <div class="flex justify-between items-end">
                    <div class="flex flex-col">
                        <span id="skill-tree-level-label" class="text-sm font-title text-white/90"></span>
                        <span id="skill-tree-progress-text" class="text-[11px] font-bold text-white/40 uppercase tracking-wider mt-0.5"></span>
                    </div>
                    <div id="skill-tree-xp-badge" class="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/60">
                        XP PROGRESS
                    </div>
                </div>
                <div class="relative w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 p-[2px]">
                    <div id="skill-tree-progress-bar"
                         class="h-full rounded-full transition-all duration-1000 ease-out relative"
                         style="width: 0%">
                         <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer"></div>
                         <div class="absolute right-0 top-0 bottom-0 w-4 bg-white blur-sm opacity-50"></div>
                    </div>
                </div>
            </div>

            <!-- Tree Content (scrollable) -->
            <div id="skill-tree-content"
                 class="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
                <!-- Level nodes injected by JS -->
            </div>

            <!-- Footer -->
            <div class="relative z-10 flex-shrink-0 p-5 border-t border-white/5 bg-black/20 backdrop-blur-sm text-center">
                <p class="text-[10px] text-white/30 uppercase tracking-[0.15em] font-bold flex items-center justify-center gap-3">
                    <span class="h-px w-8 bg-white/10"></span>
                    Skills unlock every 40 stars in your class specialty
                    <span class="h-px w-8 bg-white/10"></span>
                </p>
            </div>
        </div>
    </div>
`;

