// templates/modals/skillTree.js — Skill Tree modal HTML shell (content rendered dynamically)

export const skillTreeModalHTML = `
    <div id="skill-tree-modal"
        class="fixed inset-0 bg-black bg-opacity-85 z-[90] flex items-center justify-center p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="skill-tree-modal-title">
        <div class="skill-tree-modal-panel relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden pop-in"
             id="skill-tree-modal-panel">

            <!-- Header -->
            <div id="skill-tree-modal-header"
                 class="flex-shrink-0 p-5 md:p-6 flex items-center justify-between border-b-2 border-white/10">
                <div class="flex items-center gap-4">
                    <div id="skill-tree-class-icon" class="text-5xl filter drop-shadow-lg"></div>
                    <div>
                        <p class="text-xs font-bold uppercase tracking-widest text-white/50 mb-0.5">Hero Class</p>
                        <h2 id="skill-tree-modal-title"
                            class="font-title text-2xl md:text-3xl text-white leading-tight"></h2>
                        <p id="skill-tree-student-name" class="text-sm text-white/70 font-semibold mt-0.5"></p>
                    </div>
                </div>
                <button id="skill-tree-close-btn"
                        class="text-white/40 hover:text-white text-3xl leading-none transition-colors">&times;</button>
            </div>

            <!-- Progress Bar + Level Indicator -->
            <div id="skill-tree-progress-section"
                 class="flex-shrink-0 px-5 py-3 flex items-center gap-4 bg-black/20">
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-1">
                        <span id="skill-tree-level-label" class="text-xs font-bold text-white/70 uppercase tracking-wider"></span>
                        <span id="skill-tree-progress-text" class="text-xs font-bold text-white/50"></span>
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div id="skill-tree-progress-bar"
                             class="h-2.5 rounded-full transition-all duration-700 ease-out"
                             style="width: 0%"></div>
                    </div>
                </div>
            </div>

            <!-- Tree Content (scrollable) -->
            <div id="skill-tree-content"
                 class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-5">
                <!-- Level nodes injected by JS -->
            </div>

            <!-- Footer -->
            <div class="flex-shrink-0 p-4 border-t border-white/10 bg-black/20 text-center">
                <p class="text-xs text-white/40 italic">Skills unlock every 40 stars in your class reason.</p>
            </div>
        </div>
    </div>
`;
