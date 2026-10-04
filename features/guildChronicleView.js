// features/guildChronicleView.js — markup for the Chapter chronicles: the scroll under the
// Crown Race in the Guild Hall and the "Story of the Year" in the Grand Guild Ceremony.
// Loaded on demand with its stylesheet, once a Chapter has been sealed.

import '../styles/guild_chronicle.css';

const esc = (v) => String(v ?? '').replace(/[<&>"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[ch]));

function byline(chronicle) {
    return chronicle.by === 'chronicler'
        ? '<span class="gh-chron__by"><i class="fas fa-feather-pointed" aria-hidden="true"></i>Written by the Chronicler</span>'
        : '<span class="gh-chron__by"><i class="fas fa-scroll" aria-hidden="true"></i>The herald’s record</span>';
}

/** The Guild Hall scroll for one Chapter, with arrows to the Chapters before and after it. */
export function chroniclePanelHtml(chronicle, { index = 0, total = 1, canSpeak = false } = {}) {
    const lines = chronicle.lines.map((l, i) => `<li style="--i:${i}">${esc(l)}</li>`).join('');
    return `
        <div class="gh-chron__scroll" data-chronicle-shown="${esc(chronicle.key)}">
            <span class="gh-chron__rod gh-chron__rod--top" aria-hidden="true"></span>
            <div class="gh-chron__paper">
                <header class="gh-chron__head">
                    <button type="button" class="gh-chron__nav" data-chronicle-nav="-1" ${index > 0 ? '' : 'disabled'} aria-label="Earlier Chapter"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                    <span class="gh-chron__title"><small>The Chronicle of</small>${esc(chronicle.month)}</span>
                    <button type="button" class="gh-chron__nav" data-chronicle-nav="1" ${index < total - 1 ? '' : 'disabled'} aria-label="Later Chapter"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                </header>
                <ol class="gh-chron__lines">${lines}</ol>
                <footer class="gh-chron__foot">
                    ${byline(chronicle)}
                    ${canSpeak ? '<button type="button" class="gh-chron__read" data-chronicle-read="true"><i class="fas fa-volume-high" aria-hidden="true"></i>Read aloud</button>' : ''}
                </footer>
            </div>
            <span class="gh-chron__rod gh-chron__rod--bottom" aria-hidden="true"></span>
        </div>`;
}

/** The Grand Guild Ceremony page: every Chapter of the year as a stanza on one long scroll. */
export function grandStoryHtml(chronicles = []) {
    const stanzas = chronicles.map((c, i) => `
        <li class="grd-story__stanza" style="--i:${i}">
            <span class="grd-story__month">${esc(c.month)}</span>
            <p>${c.lines.map(esc).join('<br>')}</p>
        </li>`).join('');
    return `
        <div class="grd-story">
            <span class="grd-story__rod" aria-hidden="true"></span>
            <ol class="grd-story__paper">${stanzas}</ol>
            <span class="grd-story__rod" aria-hidden="true"></span>
        </div>`;
}
