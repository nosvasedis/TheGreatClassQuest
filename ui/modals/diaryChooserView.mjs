// /ui/modals/diaryChooserView.mjs — pure markup for "Today's Page", the chooser that
// follows Huzzah!: the crowned hero on a ribbon, what today's ink holds, and two paths,
// Auto (the AI Chronicler writes the page) or Manual (the teacher writes it all).
// Model comes from features/adventurePageCore.mjs#buildDiaryChooserModel. No DOM, no state.

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const SPARKS = Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}"></i>`).join('');

function heroMedallionHtml(model) {
    const face = model.heroAvatar
        ? `<img src="${esc(model.heroAvatar)}" alt="" decoding="async">`
        : model.heroInitial
            ? `<span class="dc-medallion__initial">${esc(model.heroInitial)}</span>`
            : '<span class="dc-medallion__initial"><i class="fas fa-users"></i></span>';
    return `
        <div class="dc-medallion" aria-hidden="true">
            <span class="dc-medallion__halo"></span>
            <span class="dc-medallion__face">${face}</span>
            <i class="fas fa-crown dc-medallion__crown"></i>
        </div>`;
}

function inkHtml(ink) {
    if (!ink.length) return '<p class="dc-ink dc-ink--quiet">A quiet lesson is still a story worth keeping.</p>';
    return `<ul class="dc-ink" aria-label="Today's ink">${ink.map(item =>
        `<li><i class="fas ${esc(item.icon)}" aria-hidden="true"></i>${esc(item.label)}</li>`).join('')}</ul>`;
}

function autoCardHtml(model) {
    const lock = model.canAuto ? '' : '<span class="dc-choice__lock"><i class="fas fa-lock" aria-hidden="true"></i> Elite</span>';
    return `
        <button type="button" class="dc-choice dc-choice--auto${model.canAuto ? '' : ' is-locked'}" data-diary-choice="auto" aria-keyshortcuts="A">
            ${lock}
            <span class="dc-choice__icon" aria-hidden="true"><i class="fas fa-wand-magic-sparkles"></i></span>
            <span class="dc-choice__name">Auto</span>
            <span class="dc-choice__tag">The Chronicler writes it</span>
            <span class="dc-choice__body">Weaves today's stars, lessons and moments into a full page, then paints a picture for it. You can edit it afterwards.</span>
            <span class="dc-choice__key" aria-hidden="true">A</span>
        </button>`;
}

function manualCardHtml() {
    return `
        <button type="button" class="dc-choice dc-choice--manual" data-diary-choice="manual" aria-keyshortcuts="M">
            <span class="dc-choice__icon" aria-hidden="true"><i class="fas fa-feather-alt"></i></span>
            <span class="dc-choice__name">Manual</span>
            <span class="dc-choice__tag">I'll write it myself</span>
            <span class="dc-choice__body">Write the whole page your way, with title, story and highlights. Upload a photo or paint one from your words.</span>
            <span class="dc-choice__key" aria-hidden="true">M</span>
        </button>`;
}

/** The whole sheet (goes inside #diary-chooser-modal). */
export function diaryChooserHtml(model) {
    return `
        <section class="dc-sheet" role="dialog" aria-modal="true" aria-labelledby="diary-chooser-title" aria-describedby="diary-chooser-sub">
            <span class="dc-sparks" aria-hidden="true">${SPARKS}</span>
            <header class="dc-head">
                ${heroMedallionHtml(model)}
                <div class="dc-ribbon">
                    <p class="dc-kicker">Hero of the Day</p>
                    <p class="dc-hero-name">${esc(model.hero)}</p>
                </div>
            </header>
            <div class="dc-stage" data-diary-stage="choose">
                <h2 id="diary-chooser-title" class="dc-title">${esc(model.heading)}</h2>
                <p id="diary-chooser-sub" class="dc-sub">${esc(model.className)}'s diary${model.dateLabel ? ` · ${esc(model.dateLabel)}` : ''}</p>
                ${inkHtml(model.ink)}
                <div class="dc-choices">
                    ${autoCardHtml(model)}
                    ${manualCardHtml()}
                </div>
                <button type="button" class="dc-later" data-diary-choice="later">
                    <i class="fas fa-bookmark" aria-hidden="true"></i>
                    Later: keep the page blank for now
                </button>
            </div>
            <div class="dc-stage dc-stage--writing" data-diary-stage="writing" hidden>
                <div class="dc-quill" aria-hidden="true">
                    <i class="fas fa-feather-alt dc-quill__pen"></i>
                    <span class="dc-quill__line"></span>
                </div>
                <h2 class="dc-title">The Chronicler dips the quill…</h2>
                <p class="dc-sub" role="status" aria-live="polite" data-diary-writing-status>Gathering today's stars, words and moments.</p>
            </div>
        </section>`;
}
