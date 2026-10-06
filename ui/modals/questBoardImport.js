// /ui/modals/questBoardImport.js — Quest Board "Copy from league":
// fills the notepad with the homework another class in the same league has right now.
// It only fills the textarea; nothing is saved until the teacher presses Save.
import * as state from '../../state.js';
import { db, query, collection, where, getDocs } from '../../firebase.js';
import { showToast } from '../effects.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';

const LEGACY_DATE_PREFIX = /^\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\s*[:\-]?\s*/; // same as the Edit button strips

let openForClassId = null;
let loadToken = 0;

function getLeagueSiblings(classId) {
    const all = state.get('allSchoolClasses') || [];
    const current = all.find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId);
    const league = current?.questLevel;
    if (!league) return [];
    return all.filter((c) => c.id !== classId && c.questLevel === league);
}

function describeSetAt(seconds) {
    if (!seconds) return '';
    const date = new Date(seconds * 1000);
    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((dayStart(new Date()) - dayStart(date)) / 86400000);
    if (days <= 0) return 'set today';
    if (days === 1) return 'set yesterday';
    return `set ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

/** Latest assignment per sibling class in the active school year (any teacher). */
async function loadLeagueHomework(siblings) {
    const activeYear = state.getActiveSchoolYearKey?.() || null;
    const ids = siblings.map((c) => c.id);
    const latestByClass = new Map();
    for (let i = 0; i < ids.length; i += 30) {
        const snapshot = await getDocs(query(
            collection(db, `${PUBLIC_DATA_PATH}/quest_assignments`),
            where('classId', 'in', ids.slice(i, i + 30))
        ));
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (activeYear && data.schoolYearKey && data.schoolYearKey !== activeYear) return;
            if (!String(data.text || '').trim()) return;
            const seconds = data.createdAt?.seconds || 0;
            const prev = latestByClass.get(data.classId);
            if (!prev || seconds > prev.seconds) latestByClass.set(data.classId, { ...data, seconds });
        });
    }
    return siblings
        .filter((c) => latestByClass.has(c.id))
        .map((c) => ({ classData: c, assignment: latestByClass.get(c.id) }))
        .sort((a, b) => b.assignment.seconds - a.assignment.seconds);
}

function getEls() {
    return {
        btn: document.getElementById('qb-league-import-btn'),
        panel: document.getElementById('qb-league-import-panel'),
        textarea: document.getElementById('quest-assignment-textarea')
    };
}

function closePanel() {
    const { btn, panel } = getEls();
    openForClassId = null;
    loadToken += 1;
    panel?.classList.add('hidden');
    if (panel) panel.innerHTML = '';
    btn?.setAttribute('aria-expanded', 'false');
    btn?.classList.remove('is-open');
}

function renderRows(panel, rows, leagueName) {
    if (!rows.length) {
        panel.innerHTML = `
            <p class="qb-import__empty">No other ${escapeHtml(leagueName)} class has homework on its board right now.</p>`;
        return;
    }
    panel.innerHTML = `
        <p class="qb-import__hint">Tap a class to copy its homework onto your notepad. Nothing is saved until you press Save.</p>
        <ul class="qb-import__list">
            ${rows.map(({ classData, assignment }, index) => {
                const text = String(assignment.text || '').replace(LEGACY_DATE_PREFIX, '').trim();
                const preview = text.replace(/\s+/g, ' ');
                const teacher = assignment.createdBy?.name ? ` · ${escapeHtml(assignment.createdBy.name)}` : '';
                return `
                <li>
                    <button type="button" class="qb-import__row" data-import-index="${index}">
                        <span class="qb-import__logo" aria-hidden="true">${classData.logo || '📘'}</span>
                        <span class="qb-import__body">
                            <span class="qb-import__name">${escapeHtml(classData.name || 'Class')}</span>
                            <span class="qb-import__meta">${escapeHtml(describeSetAt(assignment.seconds))}${teacher}</span>
                            <span class="qb-import__preview">${escapeHtml(preview.length > 110 ? `${preview.slice(0, 107)}…` : preview)}</span>
                        </span>
                        <span class="qb-import__go"><i class="fas fa-arrow-down" aria-hidden="true"></i> Copy</span>
                    </button>
                </li>`;
            }).join('')}
        </ul>`;

    panel.querySelectorAll('[data-import-index]').forEach((rowBtn) => {
        rowBtn.addEventListener('click', () => {
            const row = rows[Number(rowBtn.dataset.importIndex)];
            const { textarea } = getEls();
            if (!row || !textarea) return;
            textarea.value = String(row.assignment.text || '').replace(LEGACY_DATE_PREFIX, '');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            closePanel();
            textarea.focus();
            textarea.setSelectionRange(0, 0);
            textarea.scrollTop = 0;
            const pad = textarea.closest('.qb-notepad');
            if (pad) {
                pad.classList.remove('qb-notepad--imported');
                void pad.offsetWidth;
                pad.classList.add('qb-notepad--imported');
            }
            showToast(`Copied ${row.classData.name || 'the class'}'s homework. Press Save to pin it.`, 'success');
        });
    });
}

async function openPanel(classId) {
    const { btn, panel } = getEls();
    if (!btn || !panel) return;
    const siblings = getLeagueSiblings(classId);
    const leagueName = siblings[0]?.questLevel || 'league';
    openForClassId = classId;
    const token = ++loadToken;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-open');
    panel.classList.remove('hidden');
    panel.innerHTML = `<p class="qb-import__loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Checking the other ${escapeHtml(leagueName)} boards…</p>`;
    try {
        const rows = await loadLeagueHomework(siblings);
        if (token !== loadToken) return;
        renderRows(panel, rows, leagueName);
    } catch (error) {
        console.error('Could not load league homework:', error);
        if (token !== loadToken) return;
        panel.innerHTML = '<p class="qb-import__empty">Could not reach the other boards. Please try again.</p>';
    }
}

/** Called every time the Quest Board opens for a class. */
export function setupLeagueHomeworkImport(classId) {
    const { btn } = getEls();
    if (!btn) return;
    closePanel();
    btn.classList.toggle('hidden', getLeagueSiblings(classId).length === 0);
    btn.onclick = () => {
        if (openForClassId === classId) closePanel();
        else openPanel(classId);
    };
}
