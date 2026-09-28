// templates/modals/skillTree.js — Ascension Path (Skill Tree) modal shell.
// The stage (header, meter, path, footer) is rendered by ui/modals/skillTreeView.mjs.

const motes = Array.from({ length: 16 }, (_, i) => {
    const left = (i * 61) % 100;
    const size = 2 + (i % 3);
    const dur = 9 + ((i * 7) % 8);
    const delay = -((i * 13) % 17);
    return `<span class="st-mote" style="left:${left}%;--s:${size}px;--dur:${dur}s;--delay:${delay}s"></span>`;
}).join('');

export const skillTreeModalHTML = `
    <div id="skill-tree-modal"
        class="fixed inset-0 z-[90] flex items-center justify-center p-3 md:p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="skill-tree-modal-title">

        <div id="skill-tree-modal-panel" class="skill-tree-modal-panel pop-in">
            <div class="st-sky" aria-hidden="true">
                <span class="st-stars st-stars--far"></span>
                <span class="st-stars st-stars--near"></span>
                <span class="st-nebula st-nebula--a"></span>
                <span class="st-nebula st-nebula--b"></span>
                <span class="st-motes">${motes}</span>
                <span id="skill-tree-class-bg-icon" class="st-sky-sigil"></span>
            </div>

            <button id="skill-tree-close-btn" type="button" class="st-close" aria-label="Close the Ascension Path">
                <i class="fas fa-times"></i>
            </button>

            <div id="skill-tree-stage" class="st-stage"></div>
        </div>
    </div>
`;
