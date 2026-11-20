// /features/familyStudentPicker.js
// Teacher Settings > Family Access: the student picker. A class roll book that
// opens from the "Student" button (a pop-over on desktop, a bottom sheet on
// phones): search by name, read the roll A to Z with letter tabs or grouped by
// class, narrow to one class with the class tabs, and see at a glance which
// families already have a login. Lazy-loaded with its CSS so the startup bundle
// stays small; the closed button lives in features/accessManagement.js.

const PHONE_QUERY = '(max-width: 640px)';
const PREFS_KEY = 'gcq.familyPicker.v1';

let cssReady = null;
export const loadFamilyPickerStyles = () => (cssReady ||= import('../styles/family_student_picker.css').catch((err) => { cssReady = null; throw err; }));

let open = null; // { root, close }

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readPrefs() {
    try {
        const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}');
        return { mode: raw.mode === 'class' ? 'class' : 'az', classId: typeof raw.classId === 'string' ? raw.classId : '' };
    } catch {
        return { mode: 'az', classId: '' };
    }
}

function savePrefs(prefs) {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private window: fine */ }
}

const plain = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), ['el', 'en'], { sensitivity: 'base' });

function letterOf(name) {
    const first = plain(name).trim().charAt(0).toUpperCase();
    return /\p{L}/u.test(first) ? first : '#';
}

function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function keyState(link) {
    if (!link) return { tone: 'none', label: 'No login yet', icon: 'fa-lock-open' };
    return String(link.status || 'active') === 'active'
        ? { tone: 'active', label: 'Login active', icon: 'fa-key' }
        : { tone: 'off', label: 'Switched off', icon: 'fa-ban' };
}

function faceHtml(student) {
    return student?.avatar
        ? `<span class="fsp-face"><img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="fsp-face fsp-face--initials" aria-hidden="true">${esc(initialsOf(student?.name))}</span>`;
}

/**
 * Open the roll book.
 * @param {{ trigger: HTMLElement, students: object[], classes: Map<string, object>, links: object, selectedId: string, onPick: (id: string) => void }} opts
 */
export async function openFamilyStudentPicker({ trigger, students = [], classes = new Map(), links = {}, selectedId = '', onPick } = {}) {
    if (!trigger) return;
    if (open) { open.close(); return; }
    await loadFamilyPickerStyles();

    const isPhone = window.matchMedia(PHONE_QUERY).matches;
    const prefs = readPrefs();
    const roster = students.slice().sort(byName);
    const classIds = [...new Set(roster.map((s) => s.classId).filter((id) => classes.has(id)))]
        .sort((a, b) => String(classes.get(a).name || '').localeCompare(String(classes.get(b).name || ''), ['el', 'en'], { numeric: true }));
    const hasOrphans = roster.some((s) => !classes.has(s.classId));
    let mode = prefs.mode;
    let classFilter = classIds.includes(prefs.classId) ? prefs.classId : '';
    let query = '';

    const root = document.createElement('div');
    root.className = `fsp-layer${isPhone ? ' fsp-layer--sheet' : ''}`;
    root.innerHTML = `
        <div class="fsp-scrim" data-fsp-close></div>
        <section class="fsp" role="dialog" aria-modal="true" aria-label="Choose a student">
            <span class="fsp__grip" aria-hidden="true"></span>
            <header class="fsp__head">
                <span class="fsp__sticker" aria-hidden="true"><i class="fas fa-book-open"></i></span>
                <span class="fsp__title">Class roll</span>
                <button type="button" class="fsp__x" data-fsp-close aria-label="Close"><i class="fas fa-xmark"></i></button>
            </header>
            <label class="fsp-search">
                <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                <input type="search" class="fsp-search__input" placeholder="Find a student by name" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Find a student by name">
                <button type="button" class="fsp-search__clear hidden" data-fsp-clear aria-label="Clear search"><i class="fas fa-xmark"></i></button>
            </label>
            <div class="fsp-sort" role="radiogroup" aria-label="Order">
                <button type="button" role="radio" class="fsp-sort__btn" data-fsp-mode="az"><i class="fas fa-arrow-down-a-z" aria-hidden="true"></i> A to Z</button>
                <button type="button" role="radio" class="fsp-sort__btn" data-fsp-mode="class"><i class="fas fa-people-roof" aria-hidden="true"></i> By class</button>
            </div>
            <div class="fsp-tabs" role="tablist" aria-label="Class">
                <button type="button" role="tab" class="fsp-tab" data-fsp-class="">All classes</button>
                ${classIds.map((id) => {
                    const c = classes.get(id);
                    return `<button type="button" role="tab" class="fsp-tab" data-fsp-class="${esc(id)}"><span aria-hidden="true">${esc(c.logo || '')}</span> ${esc(c.name || 'Class')}</button>`;
                }).join('')}
            </div>
            <div class="fsp-list" role="listbox" aria-label="Students" tabindex="-1"></div>
            <footer class="fsp__foot">
                <span class="fsp__count"></span>
                <span class="fsp__legend"><span class="fsp-dot fsp-dot--active"></span>Login <span class="fsp-dot fsp-dot--off"></span>Off <span class="fsp-dot fsp-dot--none"></span>None</span>
            </footer>
        </section>`;
    document.body.appendChild(root);

    const panel = root.querySelector('.fsp');
    const list = root.querySelector('.fsp-list');
    const search = root.querySelector('.fsp-search__input');
    const clearBtn = root.querySelector('[data-fsp-clear]');
    const countEl = root.querySelector('.fsp__count');

    function rowHtml(student, showClass) {
        const c = classes.get(student.classId);
        const key = keyState(links[student.id]);
        const isPicked = student.id === selectedId;
        return `
            <button type="button" role="option" class="fsp-row${isPicked ? ' is-picked' : ''}" data-fsp-pick="${esc(student.id)}" aria-selected="${isPicked}" tabindex="-1">
                ${faceHtml(student)}
                <span class="fsp-row__text">
                    <span class="fsp-row__name">${esc(student.name)}</span>
                    ${showClass && c ? `<span class="fsp-row__class">${esc(c.logo || '')} ${esc(c.name || '')}</span>` : ''}
                </span>
                <span class="fsp-key fsp-key--${key.tone}" title="${esc(key.label)}"><i class="fas ${key.icon}" aria-hidden="true"></i><span class="fsp-key__label">${esc(key.label)}</span></span>
                ${isPicked ? '<i class="fas fa-check fsp-row__tick" aria-hidden="true"></i>' : ''}
            </button>`;
    }

    function visibleStudents() {
        const q = plain(query).trim();
        return roster.filter((s) => (!classFilter || s.classId === classFilter) && (!q || plain(s.name).includes(q)));
    }

    function renderList() {
        root.querySelectorAll('[data-fsp-mode]').forEach((b) => {
            const on = b.dataset.fspMode === mode;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-checked', String(on));
        });
        root.querySelectorAll('[data-fsp-class]').forEach((b) => {
            const on = b.dataset.fspClass === classFilter;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-selected', String(on));
        });
        clearBtn.classList.toggle('hidden', !query);

        const shown = visibleStudents();
        const withLogin = shown.filter((s) => keyState(links[s.id]).tone === 'active').length;
        countEl.textContent = `${shown.length} ${shown.length === 1 ? 'student' : 'students'} · ${withLogin} with a login`;

        if (!shown.length) {
            list.innerHTML = `<p class="fsp-empty"><span aria-hidden="true">🔍</span>No student called “${esc(query)}”${classFilter ? ' in this class' : ''}.</p>`;
            return;
        }

        const groups = [];
        if (mode === 'class') {
            const ids = classFilter ? [classFilter] : [...classIds, ...(hasOrphans ? [''] : [])];
            ids.forEach((id) => {
                const members = shown.filter((s) => (id ? s.classId === id : !classes.has(s.classId)));
                if (!members.length) return;
                const c = classes.get(id);
                const active = members.filter((s) => keyState(links[s.id]).tone === 'active').length;
                groups.push({
                    head: `<span class="fsp-group__logo" aria-hidden="true">${esc(c?.logo || '📘')}</span><span class="fsp-group__name">${esc(c?.name || 'No class')}</span><span class="fsp-group__tally">${active}/${members.length} logins</span>`,
                    kind: 'class',
                    rows: members.map((s) => rowHtml(s, false)).join('')
                });
            });
        } else {
            let current = null;
            shown.forEach((s) => {
                const letter = letterOf(s.name);
                if (!current || current.letter !== letter) {
                    current = { letter, head: `<span class="fsp-group__letter">${esc(letter)}</span>`, kind: 'letter', rows: '' };
                    groups.push(current);
                }
                current.rows += rowHtml(s, !classFilter);
            });
        }
        list.innerHTML = groups.map((g) => `
            <div class="fsp-group fsp-group--${g.kind}" role="group">
                <div class="fsp-group__head">${g.head}</div>
                ${g.rows}
            </div>`).join('');
        const first = list.querySelector('.fsp-row.is-picked') || list.querySelector('.fsp-row');
        if (first) first.tabIndex = 0;
    }

    function place() {
        if (isPhone) return;
        const r = trigger.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = panel.offsetWidth;
        const left = Math.max(12, Math.min(r.left, vw - w - 12));
        const spaceBelow = vh - r.bottom - 22;
        const spaceAbove = r.top - 22;
        const below = spaceBelow >= 340 || spaceBelow >= spaceAbove;
        const room = Math.max(260, Math.min(560, below ? spaceBelow : spaceAbove));
        panel.style.maxHeight = `${room}px`;
        panel.style.left = `${left}px`;
        panel.style.top = below ? `${r.bottom + 10}px` : `${Math.max(12, r.top - 10 - Math.min(panel.scrollHeight, room))}px`;
        panel.classList.toggle('is-above', !below);
    }

    const cleanups = [];
    let closing = false;
    function close({ refocus = true } = {}) {
        if (closing) return;
        closing = true;
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', onScroll, true);
        cleanups.forEach((fn) => fn());
        root.classList.add('is-leaving');
        window.setTimeout(() => root.remove(), 220);
        open = null;
        if (refocus && trigger.isConnected) trigger.focus({ preventScroll: true });
    }

    function pick(id) {
        close({ refocus: false });
        if (id && id !== selectedId) onPick?.(id);
        else trigger.focus({ preventScroll: true });
    }

    function moveRow(step) {
        const rows = [...list.querySelectorAll('.fsp-row')];
        if (!rows.length) return;
        const at = rows.indexOf(document.activeElement);
        const next = rows[Math.max(0, Math.min(rows.length - 1, at < 0 ? 0 : at + step))];
        rows.forEach((row) => { row.tabIndex = row === next ? 0 : -1; });
        next.focus();
        next.scrollIntoView({ block: 'nearest' });
    }

    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); moveRow(1); return; }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (document.activeElement === list.querySelector('.fsp-row')) search.focus();
            else moveRow(-1);
            return;
        }
        if (e.key === 'Enter' && document.activeElement === search) {
            e.preventDefault();
            const only = list.querySelector('.fsp-row');
            if (only) pick(only.dataset.fspPick);
        }
    }

    // Scrolling the list itself must not move the pop-over.
    function onScroll(e) { if (!root.contains(e.target)) place(); }

    root.addEventListener('click', (e) => {
        if (e.target.closest('[data-fsp-close]')) { close(); return; }
        if (e.target.closest('[data-fsp-clear]')) { query = ''; search.value = ''; renderList(); search.focus(); return; }
        const modeBtn = e.target.closest('[data-fsp-mode]');
        if (modeBtn) { mode = modeBtn.dataset.fspMode; savePrefs({ mode, classId: classFilter }); renderList(); list.scrollTop = 0; return; }
        const tab = e.target.closest('[data-fsp-class]');
        if (tab) {
            classFilter = tab.dataset.fspClass;
            savePrefs({ mode, classId: classFilter });
            renderList();
            list.scrollTop = 0;
            tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            return;
        }
        const row = e.target.closest('[data-fsp-pick]');
        if (row) pick(row.dataset.fspPick);
    });
    search.addEventListener('input', () => { query = search.value; renderList(); list.scrollTop = 0; });

    // Phones: drag the sheet down by its grip to close it.
    if (isPhone) {
        const grip = root.querySelector('.fsp__grip');
        const head = root.querySelector('.fsp__head');
        let drag = null;
        const startDrag = (e) => { drag = { y: e.clientY, dy: 0 }; panel.style.transition = 'none'; };
        [grip, head].forEach((el) => el.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) startDrag(e); }));
        const onMove = (e) => {
            if (!drag) return;
            drag.dy = Math.max(0, e.clientY - drag.y);
            panel.style.transform = `translateY(${drag.dy}px)`;
        };
        const endDrag = () => {
            if (!drag) return;
            const far = drag.dy > 90;
            drag = null;
            panel.style.transition = '';
            panel.style.transform = '';
            if (far) close();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
        cleanups.push(() => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        });
    }

    renderList();
    place();
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    requestAnimationFrame(() => {
        root.classList.add('is-open');
        const picked = list.querySelector('.fsp-row.is-picked');
        if (picked) picked.scrollIntoView({ block: 'center' });
        if (!isPhone) search.focus({ preventScroll: true });
    });
    open = { root, close };
}

export function closeFamilyStudentPicker() {
    open?.close({ refocus: false });
}
