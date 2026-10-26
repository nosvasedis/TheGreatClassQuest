// ui/headerClock.js
// Paints the header date and clock as separate glyphs, so that when a minute or an
// hour turns only the digits that changed fade out while the new ones fade in
// (styles/header_flourish.css). Also plays the header's entrance when the app opens.
// Shared by the teacher header and the School Office header (.gcq-sky-header).

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function glyphCell(token, index, extraClass = '') {
    const cell = document.createElement('span');
    cell.className = `gcq-glyph-cell${extraClass}`;
    cell.style.setProperty('--i', index);
    cell.append(makeGlyph(token));
    return cell;
}

function makeGlyph(token) {
    const glyph = document.createElement('span');
    glyph.className = 'gcq-glyph';
    glyph.dataset.text = token;
    glyph.textContent = token;
    return glyph;
}

function build(el, tokens, joiner, cellClass) {
    el.textContent = '';
    tokens.forEach((token, i) => {
        if (i && joiner) el.append(joiner);
        el.append(glyphCell(token, i, cellClass(token)));
    });
    el.classList.add('gcq-glyphs');
}

/** Old glyph drifts up and fades; the new one rises in beneath it. */
function swap(cell, token, order) {
    const old = cell.querySelector('.gcq-glyph:not(.is-out)');
    if (reduceMotion() || !old) {
        cell.replaceChildren(makeGlyph(token));
        return;
    }
    cell.querySelectorAll('.gcq-glyph.is-out').forEach((g) => g.remove());
    // A small gold glint marks the digit that turned.
    cell.classList.remove('is-turning');
    void cell.offsetWidth;
    cell.classList.add('is-turning');
    window.clearTimeout(cell._gcqTurnTimer);
    cell._gcqTurnTimer = window.setTimeout(() => cell.classList.remove('is-turning'), 1400);
    const next = makeGlyph(token);
    cell.style.setProperty('--o', order);
    old.classList.add('is-out');
    next.classList.add('is-in');
    cell.append(next);
    const done = () => old.remove();
    old.addEventListener('animationend', done, { once: true });
    window.setTimeout(done, 1600);
    next.addEventListener('animationend', () => next.classList.remove('is-in'), { once: true });
}

function paint(el, text, tokens, joiner, cellClass) {
    if (!el || el.dataset.painted === text) return;
    const cells = el.querySelectorAll(':scope > .gcq-glyph-cell');
    const same = el.classList.contains('gcq-glyphs') && cells.length === tokens.length;
    if (!same) {
        build(el, tokens, joiner, cellClass);
    } else {
        // Right-most change first, like the wheels of a little brass counter.
        let order = 0;
        for (let i = tokens.length - 1; i >= 0; i -= 1) {
            const current = cells[i].querySelector('.gcq-glyph:not(.is-out)')?.dataset.text;
            if (current !== tokens[i]) swap(cells[i], tokens[i], order++);
        }
    }
    el.dataset.painted = text;
    el.dataset.text = text;
    el.setAttribute('aria-label', text);
}

export function paintHeaderTime(el, text) {
    paint(el, text, [...text], '', (t) => (t === ':' ? ' gcq-glyph-cell--colon' : ''));
}

export function paintHeaderDate(el, text) {
    paint(el, text, text.split(' '), ' ', () => '');
}

/** Every header date and clock on the page (teacher + School Office). */
export function paintHeaderDateTime(now = new Date()) {
    const dateText = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('.gcq-header-date').forEach((el) => paintHeaderDate(el, dateText));
    document.querySelectorAll('.gcq-header-time').forEach((el) => paintHeaderTime(el, timeText));
}

/**
 * The header's entrance: title, quote, date words, buttons and clock digits arrive in
 * turn. The intro class stays on (every animation ends on the resting look), so the
 * glyphs never replay; only the gold thread's weave is lifted afterwards, because the
 * Award sky animates the same thread.
 */
export function playHeaderIntro(header) {
    if (!header || reduceMotion()) return;
    header.classList.remove('gcq-hdr-intro', 'gcq-hdr-weave');
    void header.offsetWidth;
    header.classList.add('gcq-hdr-intro', 'gcq-hdr-weave');
    window.clearTimeout(header._gcqWeaveTimer);
    header._gcqWeaveTimer = window.setTimeout(() => header.classList.remove('gcq-hdr-weave'), 2600);
}

/**
 * Plays the entrance once the header can be seen: straight away, or as the loading
 * screen starts to fade if it still covers the app.
 */
export function playHeaderIntroWhenRevealed(header) {
    if (!header) return;
    const loading = document.getElementById('loading-screen');
    const covering = () => loading
        && !loading.classList.contains('hidden')
        && !loading.classList.contains('loading-screen-exit');
    if (!covering()) {
        playHeaderIntro(header);
        return;
    }
    const observer = new MutationObserver(() => {
        if (covering()) return;
        observer.disconnect();
        // The loading scene holds full colour for the first half of its exit.
        window.setTimeout(() => playHeaderIntro(header), loading.classList.contains('hidden') ? 0 : 320);
    });
    observer.observe(loading, { attributes: true, attributeFilter: ['class'] });
    window.setTimeout(() => observer.disconnect(), 30000);
}
