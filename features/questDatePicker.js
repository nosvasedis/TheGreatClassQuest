// /features/questDatePicker.js
// Quest Board: the "Test date" calendar. A paper wall calendar with a red ring
// binding that opens from the date button on the Schedule a test card (a pop-over
// on desktop, a bottom sheet on phones). Lesson days of the class carry a blue pin,
// school closures are hatched, today is ringed in blue ink and the picked day is
// stamped in red. Lazy-loaded with its CSS so the startup bundle stays small.
import * as state from '../state.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const PHONE_QUERY = '(max-width: 640px)';

let cssReady = null;
const loadStyles = () => (cssReady ||= import('../styles/quest_date_picker.css').catch((err) => { cssReady = null; throw err; }));

let open = null; // { root, close }

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseIso(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}
const noon = (d) => { const c = new Date(d); c.setHours(12, 0, 0, 0); return c; };
const addDays = (d, n) => { const c = noon(d); c.setDate(c.getDate() + n); return c; };
const sameDay = (a, b) => a && b && isoOf(a) === isoOf(b);

function classContext(classId) {
    const classes = [...(state.get('allTeachersClasses') || []), ...(state.get('allSchoolClasses') || [])];
    const cls = classes.find((c) => c?.id === classId) || null;
    const lessonDays = new Set((Array.isArray(cls?.scheduleDays) ? cls.scheduleDays : []).map(String));
    const holidays = (state.get('schoolHolidayRanges') || []).filter((h) => h?.start && h?.end);
    const closureOf = (iso) => holidays.find((h) => iso >= h.start && iso <= h.end) || null;
    return { lessonDays, closureOf };
}

function relativeWords(date, today) {
    const diff = Math.round((noon(date) - noon(today)) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    if (diff === -1) return 'yesterday';
    if (diff > 1 && diff < 14) return `in ${diff} days`;
    if (diff >= 14) return `in ${Math.round(diff / 7)} weeks`;
    return diff > -14 ? `${-diff} days ago` : `${Math.round(-diff / 7)} weeks ago`;
}

export async function openQuestDatePicker({ trigger, input, classId } = {}) {
    if (!trigger || !input) return;
    if (open) { open.close(); return; }
    await loadStyles();

    const today = noon(new Date());
    const ctx = classContext(classId);
    let selected = parseIso(input.value);
    let view = new Date((selected || today).getFullYear(), (selected || today).getMonth(), 1, 12);
    let focusDay = selected || today;
    const isPhone = window.matchMedia(PHONE_QUERY).matches;

    const nextLesson = (() => {
        if (!ctx.lessonDays.size) return null;
        for (let i = 1; i <= 60; i += 1) {
            const d = addDays(today, i);
            if (ctx.lessonDays.has(String(d.getDay())) && !ctx.closureOf(isoOf(d))) return d;
        }
        return null;
    })();

    const root = document.createElement('div');
    root.className = `qdp-layer${isPhone ? ' qdp-layer--sheet' : ''}`;
    root.innerHTML = `
        <div class="qdp-scrim" data-qdp-close></div>
        <div class="qdp" role="dialog" aria-modal="true" aria-label="Choose the test date">
            <div class="qdp-binding" aria-hidden="true">${'<span></span>'.repeat(9)}</div>
            <div class="qdp-head">
                <button type="button" class="qdp-nav" data-qdp-step="-1" aria-label="Previous month"><i class="fas fa-chevron-left"></i></button>
                <div class="qdp-title" aria-live="polite">
                    <span class="qdp-title__month"></span>
                    <span class="qdp-title__year"></span>
                </div>
                <button type="button" class="qdp-nav" data-qdp-step="1" aria-label="Next month"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="qdp-quick">
                ${nextLesson ? `<button type="button" class="qdp-chip qdp-chip--lesson" data-qdp-pick="${isoOf(nextLesson)}"><i class="fas fa-thumbtack"></i> Next lesson</button>` : ''}
                <button type="button" class="qdp-chip" data-qdp-pick="${isoOf(addDays(today, 7))}">In a week</button>
                <button type="button" class="qdp-chip" data-qdp-pick="${isoOf(addDays(today, 14))}">In 2 weeks</button>
            </div>
            <div class="qdp-weekdays" aria-hidden="true">${WEEKDAYS.map((w, i) => `<span${i > 4 ? ' class="is-weekend"' : ''}>${w}</span>`).join('')}</div>
            <div class="qdp-grid-wrap"><div class="qdp-grid" role="grid"></div></div>
            <div class="qdp-foot">
                <div class="qdp-readout"></div>
                <div class="qdp-foot__row">
                    <div class="qdp-legend" aria-hidden="true">
                        ${ctx.lessonDays.size ? '<span><i class="qdp-legend__pin"></i>Lesson</span>' : ''}
                        <span><i class="qdp-legend__closed"></i>No school</span>
                    </div>
                    <div class="qdp-actions">
                        <button type="button" class="qdp-link" data-qdp-today>Today</button>
                        <button type="button" class="qdp-link qdp-link--clear" data-qdp-clear>Clear</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(root);

    const panel = root.querySelector('.qdp');
    const grid = root.querySelector('.qdp-grid');
    const monthEl = root.querySelector('.qdp-title__month');
    const yearEl = root.querySelector('.qdp-title__year');
    const readout = root.querySelector('.qdp-readout');

    function renderReadout() {
        readout.innerHTML = selected
            ? `<span class="qdp-readout__day">${selected.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="qdp-readout__rel">${relativeWords(selected, today)}</span>`
            : '<span class="qdp-readout__empty">Tap a day to pin the test on it</span>';
    }

    function renderGrid(direction = 0) {
        monthEl.textContent = view.toLocaleDateString('en-GB', { month: 'long' });
        yearEl.textContent = String(view.getFullYear());
        const first = new Date(view.getFullYear(), view.getMonth(), 1, 12);
        const lead = (first.getDay() + 6) % 7; // Monday first
        const start = addDays(first, -lead);
        const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        const weeks = Math.ceil((lead + daysInMonth) / 7);
        let html = '';
        for (let w = 0; w < weeks; w += 1) {
            html += '<div class="qdp-week" role="row">';
            for (let i = 0; i < 7; i += 1) {
                const d = addDays(start, w * 7 + i);
                const iso = isoOf(d);
                const inMonth = d.getMonth() === view.getMonth();
                const closure = ctx.closureOf(iso);
                const lesson = !closure && ctx.lessonDays.has(String(d.getDay()));
                const cls = ['qdp-day'];
                if (!inMonth) cls.push('is-outside');
                if (i > 4) cls.push('is-weekend');
                if (d < today) cls.push('is-past');
                if (sameDay(d, today)) cls.push('is-today');
                if (sameDay(d, selected)) cls.push('is-selected');
                if (closure) cls.push('is-closed');
                if (lesson) cls.push('is-lesson');
                const focus = sameDay(d, focusDay);
                const label = `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${sameDay(d, today) ? ', today' : ''}${lesson ? ', lesson day' : ''}${closure ? ', no school' : ''}`;
                html += `<button type="button" role="gridcell" class="${cls.join(' ')}" data-qdp-day="${iso}" tabindex="${focus ? 0 : -1}" aria-selected="${sameDay(d, selected)}" aria-label="${label}"${closure?.name ? ` title="${String(closure.name).replace(/"/g, '&quot;')}"` : ''}><span class="qdp-day__n">${d.getDate()}</span></button>`;
            }
            html += '</div>';
        }
        grid.innerHTML = html;
        grid.classList.remove('is-slide-next', 'is-slide-prev');
        if (direction) {
            void grid.offsetWidth;
            grid.classList.add(direction > 0 ? 'is-slide-next' : 'is-slide-prev');
        }
    }

    function stepMonth(n, keepFocus = false) {
        view = new Date(view.getFullYear(), view.getMonth() + n, 1, 12);
        if (!keepFocus) {
            const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
            focusDay = new Date(view.getFullYear(), view.getMonth(), Math.min(focusDay.getDate(), dim), 12);
        }
        renderGrid(n);
    }

    function moveFocus(to) {
        const monthDiff = (to.getFullYear() - view.getFullYear()) * 12 + (to.getMonth() - view.getMonth());
        focusDay = to;
        if (monthDiff) stepMonth(monthDiff, true);
        else renderGrid();
        grid.querySelector(`[data-qdp-day="${isoOf(to)}"]`)?.focus();
    }

    function commit(date, { animate = true } = {}) {
        selected = date;
        input.value = date ? isoOf(date) : '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (!date) { close(); return; }
        focusDay = date;
        const monthDiff = (date.getFullYear() - view.getFullYear()) * 12 + (date.getMonth() - view.getMonth());
        if (monthDiff) stepMonth(monthDiff, true); else renderGrid();
        renderReadout();
        const cell = grid.querySelector(`[data-qdp-day="${isoOf(date)}"]`);
        if (animate && cell) cell.classList.add('is-stamping');
        window.setTimeout(close, animate ? 420 : 0);
    }

    function place() {
        if (isPhone) return;
        const r = trigger.getBoundingClientRect();
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12));
        const below = r.bottom + 10;
        const top = below + h <= vh - 12 ? below : Math.max(12, r.top - h - 10);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.classList.toggle('is-above', top < r.top);
    }

    let closing = false;
    function close() {
        if (closing) return;
        closing = true;
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
        root.classList.add('is-leaving');
        const done = () => { root.remove(); };
        window.setTimeout(done, 220);
        open = null;
        trigger.focus({ preventScroll: true });
    }

    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        const cell = e.target.closest?.('[data-qdp-day]');
        if (!cell) return;
        const cur = parseIso(cell.dataset.qdpDay);
        const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (map[e.key] !== undefined) { e.preventDefault(); moveFocus(addDays(cur, map[e.key])); return; }
        if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault();
            const n = e.key === 'PageUp' ? -1 : 1;
            const t = new Date(cur.getFullYear(), cur.getMonth() + n, 1, 12);
            const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
            moveFocus(new Date(t.getFullYear(), t.getMonth(), Math.min(cur.getDate(), dim), 12));
            return;
        }
        if (e.key === 'Home') { e.preventDefault(); moveFocus(addDays(cur, -((cur.getDay() + 6) % 7))); return; }
        if (e.key === 'End') { e.preventDefault(); moveFocus(addDays(cur, 6 - ((cur.getDay() + 6) % 7))); }
    }

    root.addEventListener('click', (e) => {
        if (e.target.closest('[data-qdp-close]')) { close(); return; }
        const step = e.target.closest('[data-qdp-step]');
        if (step) { stepMonth(Number(step.dataset.qdpStep)); return; }
        const pick = e.target.closest('[data-qdp-pick], [data-qdp-day]');
        if (pick) { commit(parseIso(pick.dataset.qdpPick || pick.dataset.qdpDay)); return; }
        if (e.target.closest('[data-qdp-today]')) { commit(today); return; }
        if (e.target.closest('[data-qdp-clear]')) commit(null);
    });

    // Swipe between months on touch screens.
    let swipe = null;
    grid.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY }; });
    grid.addEventListener('pointerup', (e) => {
        if (!swipe) return;
        const dx = e.clientX - swipe.x;
        const dy = e.clientY - swipe.y;
        swipe = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepMonth(dx < 0 ? 1 : -1);
    });
    grid.addEventListener('pointercancel', () => { swipe = null; });

    renderGrid();
    renderReadout();
    place();
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    requestAnimationFrame(() => {
        root.classList.add('is-open');
        grid.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
    });
    open = { root, close };
}

export function closeQuestDatePicker() {
    open?.close();
}
