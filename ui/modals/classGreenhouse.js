// /ui/modals/classGreenhouse.js
// The Class Greenhouse: the whole-class companion to the Hero's Chronicle.
// Opened from a class card in My Classes, the class roster and the Chronicle itself.
//
//   Overview     health thermometer, the class signals with matched techniques, the growth
//                map (effort against papers, every child a dot) and the class's virtue mix.
//   Every hero   one pot per child: profile, plain-English reading, signals and the next move;
//                a tap opens the child's full reading with a quick Chronicle note.
//   Next lesson  the rounds for the next lesson: who to focus on, who to catch shining, who
//                to welcome back, catch-up papers, ability crews and mixed-ability partners
//                for one activity (guilds are never touched). Ticks are kept per laptop.
//   Playbook     seed packets: the techniques picked for this class, then the whole shelf.
//   Almanac      Elite AI counsel, written once per class and shared school-wide
//                (daily_cache/greenhouse_<classId>_<counsel>); only re-asked by hand.
//
// Numbers come from features/classGreenhouseCore.mjs (pure, tested); techniques from
// features/classGreenhousePlaybook.mjs. Styles: styles/class_greenhouse.css.

import * as state from '../../state.js';
import { db, collection, query, where, getDocs, doc, getDoc, setDoc } from '../../firebase.js';
import { dataPath } from '../../utils/tenant.mjs';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { normalizeTrialType } from '../../features/trialTypesCore.mjs';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { fetchAllTrialsForClass } from '../../db/queries.js';
import { canUseFeature } from '../../utils/subscription.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { esc } from '../../features/scholarScrollCore.mjs';
import { oracleMarkdown } from '../../features/scholarFolioCore.mjs';
import {
    buildGreenhouse, almanacBrief, dayLabel, PROFILES, PROFILE_ORDER, VIRTUES, WINDOW_DAYS,
    ALMANAC_COUNSELS, ALMANAC_SYSTEM_PROMPT
} from '../../features/classGreenhouseCore.mjs';
import { TECHNIQUES, PLAYBOOK_AREAS, getTechnique } from '../../features/classGreenhousePlaybook.mjs';
import { showAnimatedModal, hideModal } from './base.js';
import { showToast } from '../effects.js';
import '../../styles/class_greenhouse.css';

const MODAL_ID = 'class-greenhouse-modal';
const TABS = [
    { id: 'overview', label: 'Overview', icon: 'fa-sun' },
    { id: 'heroes', label: 'Every hero', icon: 'fa-seedling' },
    { id: 'lesson', label: 'Next lesson', icon: 'fa-list-check' },
    { id: 'playbook', label: 'Playbook', icon: 'fa-envelope-open-text' },
    { id: 'almanac', label: 'Almanac', icon: 'fa-book-open' }
];
const PROFILE_TONE = { bloom: 'bloom', reaching: 'reaching', roots: 'roots', tending: 'tending', steady: 'steady', planted: 'planted' };
const RECORD_CACHE_MS = 3 * 60 * 1000;

const view = {
    classId: null,
    tab: 'overview',
    green: null,
    heroFilter: 'all',
    areaFilter: 'all',
    drawerId: null,
    packetId: null,
    almanacBusy: false,
    almanacLast: null,
    unsubscribe: null
};
const recordCache = new Map(); // classId → { at, awards, absences, trials }

// ------------------------------------------------------------------ open / close

export async function openClassGreenhouse(classId, { tab = 'overview', studentId = '' } = {}) {
    const classData = findClass(classId);
    if (!classData) {
        showToast('Choose one of your classes first.', 'info');
        return;
    }
    ensureShell();
    view.classId = classId;
    view.tab = tab;
    view.heroFilter = 'all';
    view.drawerId = null;
    view.packetId = null;
    view.green = null;

    const modal = document.getElementById(MODAL_ID);
    modal.querySelector('.gh-title__logo').textContent = classData.logo || '🌱';
    modal.querySelector('.gh-title__name').textContent = classData.name || 'Class';
    modal.querySelector('.gh-title__sub').textContent = 'Reading the last six weeks…';
    renderThermometer(null);
    renderTabs();
    body().innerHTML = `<div class="gh-loading"><span class="gh-loading__sprout" aria-hidden="true">${plantSvg({ profile: 'planted', growth: 0.3, leafiness: 0.4 })}</span><p>Walking the rows…</p></div>`;
    closeDrawer();
    showAnimatedModal(MODAL_ID);

    import('../../db/listeners.js').then(({ ensureHeroChronicleNotesListener }) => ensureHeroChronicleNotesListener()).catch(() => {});
    view.unsubscribe?.();
    let pending = null;
    view.unsubscribe = state.subscribe(['allHeroChronicleNotes', 'allStudentScores', 'allStudents'], () => {
        clearTimeout(pending);
        pending = setTimeout(() => { if (isOpen() && view.classId === classId) recompute({ keepScroll: true }); }, 400);
    });

    try {
        await loadRecords(classId);
    } catch (err) {
        console.warn('Greenhouse: could not read every record, using what is on this laptop.', err);
    }
    if (view.classId !== classId) return;
    recompute();
    if (studentId) openDrawer(studentId);
}

function closeGreenhouse() {
    closeDrawer();
    view.unsubscribe?.();
    view.unsubscribe = null;
    hideModal(MODAL_ID);
}

function isOpen() {
    const modal = document.getElementById(MODAL_ID);
    return modal && !modal.classList.contains('hidden');
}

function body() {
    return document.getElementById('class-greenhouse-body');
}

function findClass(classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

// ------------------------------------------------------------------ records

function sinceDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - WINDOW_DAYS - 1);
    return d;
}

async function readClassCollection(name, classId) {
    const yearKey = state.getActiveSchoolYearKey?.();
    const clauses = [where('classId', '==', classId), where('createdAt', '>=', sinceDate())];
    if (yearKey) clauses.unshift(where('schoolYearKey', '==', yearKey));
    const snap = await getDocs(query(collection(db, dataPath(name)), ...clauses));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadRecords(classId) {
    const cached = recordCache.get(classId);
    if (cached && Date.now() - cached.at < RECORD_CACHE_MS) return cached;
    const [awards, absences, trials] = await Promise.all([
        readClassCollection('award_log', classId).catch((e) => { console.warn('Greenhouse awards:', e?.message); return null; }),
        readClassCollection('attendance', classId).catch((e) => { console.warn('Greenhouse attendance:', e?.message); return null; }),
        fetchAllTrialsForClass(classId).catch(() => null)
    ]);
    let oaths = [];
    if (canUseFeature('heroCampfire')) {
        try {
            const { loadEmberOaths } = await import('../../db/actions/emberOaths.js');
            oaths = await loadEmberOaths(classId);
        } catch { /* oaths are a nicety */ }
    }
    const entry = { at: Date.now(), awards, absences, trials, oaths };
    recordCache.set(classId, entry);
    return entry;
}

/** Fetched records merged with the live listeners (today's stars land without a re-read). */
function gatherInputs(classId) {
    const classData = findClass(classId);
    const cached = recordCache.get(classId) || {};
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const ids = new Set(students.map((s) => s.id));
    const mergeById = (fetched, live) => {
        const map = new Map();
        (fetched || []).forEach((r) => map.set(r.id, r));
        (live || []).filter((r) => r.classId === classId || ids.has(r.studentId)).forEach((r) => map.set(r.id, r));
        return [...map.values()];
    };
    const awards = mergeById(cached.awards, state.get('allAwardLogs')).map((log) => ({
        studentId: log.studentId, date: log.date, stars: getAwardLogMonthlyStarCredit(log), reason: log.reason
    }));
    const absences = mergeById(cached.absences, state.get('allAttendanceRecords')).map((r) => ({ studentId: r.studentId, date: r.date }));
    const trials = mergeById(cached.trials, state.get('allWrittenScores')).map((t) => ({
        studentId: t.studentId,
        date: t.date,
        pct: getNormalizedPercentForScore(t, classData),
        type: normalizeTrialType(t.type),
        title: t.title || ''
    }));
    const notes = (state.get('allHeroChronicleNotes') || []).filter((n) => ids.has(n.studentId)).map((n) => ({
        studentId: n.studentId,
        category: n.category,
        createdAtMs: n.createdAt?.toMillis ? n.createdAt.toMillis() : (n.createdAt?.seconds ? n.createdAt.seconds * 1000 : Date.now())
    }));
    return { students, awards, absences, trials, notes, oaths: cached.oaths || [] };
}

function recompute({ keepScroll = false } = {}) {
    const scroll = keepScroll ? body()?.scrollTop : 0;
    view.green = buildGreenhouse({ ...gatherInputs(view.classId), now: new Date() });
    const g = view.green;
    const sub = document.querySelector(`#${MODAL_ID} .gh-title__sub`);
    if (sub) {
        sub.textContent = g.lessons.all
            ? `${g.classReading.size} heroes · ${g.lessons.all} lessons in the last six weeks${g.lessons.last != null ? ` · last on ${dayLabel(g.lessons.last)}` : ''}`
            : `${g.classReading.size} heroes · no lessons recorded in the last six weeks yet`;
    }
    renderThermometer(g.classReading.health);
    renderTabs();
    renderPanel();
    if (keepScroll && body()) body().scrollTop = scroll;
    // Never wipe a note the teacher is in the middle of writing.
    const draft = document.querySelector(`#${MODAL_ID} .gh-note__text`)?.value.trim();
    if (view.drawerId && !draft) renderDrawer(view.drawerId);
}

// ------------------------------------------------------------------ shell

function ensureShell() {
    if (document.getElementById(MODAL_ID)) return;
    const el = document.createElement('div');
    el.id = MODAL_ID;
    el.className = 'gh-overlay hidden';
    el.innerHTML = `
        <div class="gh-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="gh-title">
            <header class="gh-roof">
                <svg class="gh-roof__frame" viewBox="0 0 1000 170" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path class="gh-roof__arch" d="M0 170 V96 Q500 -40 1000 96 V170"/>
                    <path class="gh-roof__rib" d="M125 170 V70"/><path class="gh-roof__rib" d="M250 170 V44"/>
                    <path class="gh-roof__rib" d="M375 170 V30"/><path class="gh-roof__rib" d="M500 170 V26"/>
                    <path class="gh-roof__rib" d="M625 170 V30"/><path class="gh-roof__rib" d="M750 170 V44"/>
                    <path class="gh-roof__rib" d="M875 170 V70"/>
                    <path class="gh-roof__bar" d="M0 128 H1000"/>
                </svg>
                <svg class="gh-roof__ivy gh-roof__ivy--l" viewBox="0 0 120 130" aria-hidden="true" focusable="false">${ivySvg()}</svg>
                <svg class="gh-roof__ivy gh-roof__ivy--r" viewBox="0 0 120 130" aria-hidden="true" focusable="false">${ivySvg()}</svg>
                <div class="gh-title">
                    <span class="gh-title__logo" aria-hidden="true">🌱</span>
                    <div class="gh-title__text">
                        <p class="gh-title__kicker">Class Greenhouse</p>
                        <h2 id="gh-title" class="gh-title__name font-title">Class</h2>
                        <p class="gh-title__sub"></p>
                    </div>
                </div>
                <div class="gh-thermo" role="img" aria-label="Class health"></div>
                <button type="button" class="gh-close" aria-label="Close the Class Greenhouse"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </header>
            <nav class="gh-tabs" role="tablist" aria-label="Greenhouse sections"></nav>
            <div class="gh-stage">
                <main id="class-greenhouse-body" class="gh-body custom-scrollbar" tabindex="-1"></main>
                <aside class="gh-drawer" aria-hidden="true" aria-label="A hero's reading"></aside>
                <div class="gh-packet-layer" hidden></div>
            </div>
        </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            if (view.packetId) closePacket();
            else if (view.drawerId) closeDrawer();
            else closeGreenhouse();
        }
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-gh-student][role="button"]')) {
            e.preventDefault();
            openDrawer(e.target.dataset.ghStudent);
        }
    });
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeGreenhouse(); });
}

function onClick(e) {
    const t = e.target.closest('button, [data-gh-student], a');
    if (!t) return;
    if (t.classList.contains('gh-close')) return closeGreenhouse();
    if (t.dataset.ghFilterAfter) view.heroFilter = t.dataset.ghFilterAfter;
    if (t.dataset.ghTab) { view.tab = t.dataset.ghTab; renderTabs(); renderPanel(); body().scrollTop = 0; return; }
    if (t.dataset.ghFilter) { view.heroFilter = t.dataset.ghFilter; renderPanel({ keepScroll: true }); return; }
    if (t.dataset.ghArea) { view.areaFilter = t.dataset.ghArea; renderPanel({ keepScroll: true }); return; }
    if (t.dataset.ghPacket) return openPacket(t.dataset.ghPacket);
    if (t.dataset.ghClosePacket != null) return closePacket();
    if (t.dataset.ghChronicle) return openChronicle(t.dataset.ghChronicle);
    if (t.dataset.ghCloseDrawer != null) return closeDrawer();
    if (t.dataset.ghCounsel) return askAlmanac(t.dataset.ghCounsel, { fresh: t.dataset.ghFresh === '1' });
    if (t.dataset.ghCopyPlan != null) return copyPlan();
    if (t.dataset.ghNoteCat) {
        t.closest('.gh-note').querySelectorAll('[data-gh-note-cat]').forEach((c) => c.setAttribute('aria-checked', String(c === t)));
        return;
    }
    if (t.dataset.ghSaveNote) return saveQuickNote(t.dataset.ghSaveNote, t);
    if (t.dataset.ghStudent) return openDrawer(t.dataset.ghStudent);
}

function onChange(e) {
    const box = e.target.closest('[data-gh-tick]');
    if (box) setTick(box.dataset.ghTick, box.checked);
}

function renderTabs() {
    const nav = document.querySelector(`#${MODAL_ID} .gh-tabs`);
    if (!nav) return;
    const g = view.green;
    const counts = {
        heroes: g ? g.students.filter((r) => r.signals.some((s) => s.sev >= 2)).length : 0,
        lesson: g ? g.plan.focus.length : 0
    };
    nav.innerHTML = TABS.map((t) => `
        <button type="button" role="tab" class="gh-tab${view.tab === t.id ? ' is-active' : ''}" data-gh-tab="${t.id}" aria-selected="${view.tab === t.id}">
            <span class="gh-tab__hole" aria-hidden="true"></span>
            <i class="fas ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>
            ${counts[t.id] ? `<span class="gh-tab__count" aria-label="${counts[t.id]} need you">${counts[t.id]}</span>` : ''}
        </button>`).join('');
}

function renderPanel({ keepScroll = false } = {}) {
    const el = body();
    const g = view.green;
    if (!el || !g) return;
    const scroll = el.scrollTop;
    const html = {
        overview: overviewHtml,
        heroes: heroesHtml,
        lesson: lessonHtml,
        playbook: playbookHtml,
        almanac: almanacHtml
    }[view.tab]?.(g) || '';
    el.innerHTML = `<section class="gh-panel gh-panel--${view.tab}" role="tabpanel">${html}</section>`;
    if (keepScroll) el.scrollTop = scroll;
    if (view.tab === 'almanac') hydrateAlmanac();
}

// ------------------------------------------------------------------ overview

function overviewHtml(g) {
    const c = g.classReading;
    if (!c.size) return emptyHtml('No heroes in this class yet', 'Add students to the class and the greenhouse fills itself.');
    const trendArrow = (x, unit = '') => (x == null ? '' : `<span class="gh-trend gh-trend--${x > 0 ? 'up' : x < 0 ? 'down' : 'flat'}">${x > 0 ? '▲' : x < 0 ? '▼' : '•'} ${Math.abs(x)}${unit}</span>`);
    const tiles = [
        { label: 'Stars per child', value: c.stars.perChildRecent ?? '—', foot: c.stars.trend != null ? trendArrow(Math.round(c.stars.trend * 100), '%') + ' a lesson, vs before' : 'a lesson, last two weeks' },
        { label: 'Papers average', value: c.papers.classAvg != null ? `${c.papers.classAvg}%` : '—', foot: c.papers.trend != null ? trendArrow(c.papers.trend, ' pts') + ' latest papers' : `${c.papers.count} papers this year` },
        { label: 'Attendance', value: c.attendance.rate != null ? `${Math.round(c.attendance.rate * 100)}%` : '—', foot: c.attendance.worstWeekday ? `lowest on ${c.attendance.worstWeekday.day}s` : 'last six weeks' },
        { label: 'Unseen', value: c.stars.unseen, foot: '3+ lessons without a star' },
        { label: 'Fresh notes', value: `${c.notes.noted}/${c.size}`, foot: 'Chronicle, last six weeks' }
    ];
    return `
        <div class="gh-labels">${tiles.map((t) => `
            <div class="gh-label"><span class="gh-label__hole" aria-hidden="true"></span>
                <p class="gh-label__name">${t.label}</p><p class="gh-label__value font-title">${t.value}</p><p class="gh-label__foot">${t.foot}</p>
            </div>`).join('')}
        </div>

        <div class="gh-grid-2">
            <section class="gh-card gh-card--signals">
                <h3 class="gh-h"><i class="fas fa-binoculars" aria-hidden="true"></i> What the greenhouse sees</h3>
                <ul class="gh-insights">${c.insights.map((i) => `
                    <li class="gh-insight gh-insight--${i.tone}">
                        <p class="gh-insight__title">${esc(i.title)}</p>
                        <p class="gh-insight__text">${esc(i.text)}</p>
                        ${i.techniques.length ? `<div class="gh-chips">${i.techniques.map(packetChip).join('')}</div>` : ''}
                    </li>`).join('')}
                </ul>
            </section>
            <section class="gh-card gh-card--map">
                <h3 class="gh-h"><i class="fas fa-seedling" aria-hidden="true"></i> The growth map</h3>
                <p class="gh-hint">Each dot is a hero: across, stars a lesson (effort); up, papers against the class. Tap a dot for the full reading.</p>
                ${growthMapSvg(g)}
                <div class="gh-legend">${PROFILE_ORDER.filter((p) => c.profiles[p]).map((p) => `
                    <button type="button" class="gh-legend__item gh-tone--${p}" data-gh-tab="heroes" data-gh-filter-after="${p}">
                        <span class="gh-legend__dot" aria-hidden="true"></span>${PROFILES[p].label} <b>${c.profiles[p]}</b>
                    </button>`).join('')}
                </div>
            </section>
        </div>

        <div class="gh-grid-2">
            <section class="gh-card">
                <h3 class="gh-h"><i class="fas fa-gem" aria-hidden="true"></i> Virtue mix</h3>
                ${virtueMixHtml(c.virtueMix, g.students)}
            </section>
            <section class="gh-card">
                <h3 class="gh-h"><i class="fas fa-layer-group" aria-hidden="true"></i> Paper levels</h3>
                ${bandsHtml(c.papers)}
            </section>
        </div>`;
}

function virtueMixHtml(mix, readings = []) {
    const total = mix.reduce((t, v) => t + v.stars, 0);
    if (!total) return '<p class="gh-hint">No virtue stars in the last six weeks yet.</p>';
    return `
        <div class="gh-virtue-bar" role="img" aria-label="${mix.map((v) => `${v.label} ${Math.round(v.share * 100)}%`).join(', ')}">
            ${mix.map((v) => `<span class="gh-virtue-bar__seg gh-virtue--${v.id}" style="flex-grow:${Math.max(v.share, 0.001)}"></span>`).join('')}
        </div>
        <ul class="gh-virtues">${mix.map((v) => `
            <li class="gh-virtue gh-virtue--${v.id}"><i class="fas ${v.icon}" aria-hidden="true"></i>${v.label}<b>${Math.round(v.share * 100)}%</b></li>`).join('')}
        </ul>
        <h4 class="gh-h4">Who shines where</h4>
        <ul class="gh-shiners">${mix.map((v) => {
        const top = readings.filter((r) => r.virtues[v.id] > 0).sort((a, b) => b.virtues[v.id] - a.virtues[v.id]).slice(0, 3);
        return `<li class="gh-shiner gh-virtue--${v.id}"><i class="fas ${v.icon}" aria-hidden="true"></i><span>${top.length ? top.map((r) => `<button type="button" class="gh-name" data-gh-student="${r.id}">${esc(r.first)}</button>`).join(', ') : '<em>nobody yet</em>'}</span></li>`;
    }).join('')}
        </ul>`;
}

function bandsHtml(p) {
    const max = Math.max(1, ...p.bands.map((b) => b.count));
    if (!p.bands.some((b) => b.count)) return '<p class="gh-hint">No marked papers yet. Log a test or dictation and the levels appear.</p>';
    return `
        <div class="gh-bands">${p.bands.map((b) => `
            <div class="gh-band gh-band--${b.id}">
                <span class="gh-band__pot" style="--h:${(b.count / max) * 100}%"><span class="gh-band__count font-title">${b.count}</span></span>
                <span class="gh-band__label">${b.label}</span>
            </div>`).join('')}
        </div>
        <p class="gh-hint">${p.testAvg != null ? `Tests ${p.testAvg}%` : ''}${p.testAvg != null && p.dictationAvg != null ? ' · ' : ''}${p.dictationAvg != null ? `Dictations ${p.dictationAvg}%` : ''}${p.last ? ` · last paper "${esc(p.last.title || 'paper')}" ${p.last.avg}%` : ''}</p>`;
}

function growthMapSvg(g) {
    const W = 640, H = 400, L = 46, R = 16, T = 18, B = 40;
    const iw = W - L - R, ih = H - T - B;
    const px = (x) => L + x * iw;
    const py = (y) => T + (1 - y) * ih;
    const placed = [];
    const dots = g.students.map((r) => {
        let x = px(r.map.x), y = py(r.map.y);
        // Nudge overlapping dots apart so every name stays tappable.
        for (let k = 0; k < 12 && placed.some((p) => Math.hypot(p.x - x, p.y - y) < 30); k += 1) {
            const a = k * 2.4;
            x = Math.max(L + 14, Math.min(W - R - 14, x + Math.cos(a) * 14));
            y = Math.max(T + 14, Math.min(H - B - 14, y + Math.sin(a) * 14));
        }
        placed.push({ x, y });
        const initials = r.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        const urgent = r.signals.some((s) => s.sev >= 3);
        return `
            <g class="gh-dot gh-tone--${PROFILE_TONE[r.profile]}${r.map.achKnown ? '' : ' is-unknown'}${urgent ? ' is-urgent' : ''}" data-gh-student="${r.id}" role="button" tabindex="0"
                aria-label="${esc(r.name)}: ${PROFILES[r.profile].label}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
                ${urgent ? '<circle class="gh-dot__halo" r="19"/>' : ''}
                <circle class="gh-dot__disc" r="13"/>
                <text class="gh-dot__ini" y="4">${esc(initials)}</text>
                <text class="gh-dot__name" y="27">${esc(r.first)}</text>
                <title>${esc(r.name)} · ${PROFILES[r.profile].label}</title>
            </g>`;
    }).join('');
    // Shade the map exactly as the profiles are decided: thirds at ±0.35 sd on each axis.
    const cut = [0, 0.5 - 0.35 / 4, 0.5 + 0.35 / 4, 1];
    const grid = [ // rows top→bottom (papers high, mid, low); columns left→right (effort low, mid, high)
        ['roots', 'bloom', 'bloom'],
        ['roots', 'steady', 'bloom'],
        ['tending', 'reaching', 'reaching']
    ];
    let cells = '';
    grid.forEach((row, ri) => row.forEach((profile, ci) => {
        const x0 = px(cut[ci]), x1 = px(cut[ci + 1]);
        const y0 = py(cut[3 - ri]), y1 = py(cut[2 - ri]);
        cells += `<rect class="gh-map__q gh-map__q--${profile}" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}"/>`;
    }));
    const label = (text, x, y, anchor) => `<text class="gh-map__qlabel" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;
    return `
        <svg class="gh-map" viewBox="0 0 ${W} ${H}" role="group" aria-label="Growth map of the class">
            ${cells}
            ${label(PROFILES.roots.label, L + 8, T + 16, 'start')}
            ${label(PROFILES.bloom.label, L + iw - 8, T + 16, 'end')}
            ${label(PROFILES.tending.label, L + 8, T + ih - 8, 'start')}
            ${label(PROFILES.reaching.label, L + iw - 8, T + ih - 8, 'end')}
            ${label('Steady', px(0.5), py(0.5) + 4, 'middle')}
            <path class="gh-map__axis" d="M${L} ${T} V${T + ih} H${L + iw}"/>
            <text class="gh-map__axislabel" x="${L + iw / 2}" y="${H - 10}" text-anchor="middle">Stars a lesson (effort) →</text>
            <text class="gh-map__axislabel" transform="translate(16 ${T + ih / 2}) rotate(-90)" text-anchor="middle">Papers vs class →</text>
            ${dots}
        </svg>`;
}

// ------------------------------------------------------------------ every hero

function heroesHtml(g) {
    if (!g.students.length) return emptyHtml('No heroes in this class yet', 'Add students and every one gets a pot here.');
    const filters = [
        { id: 'all', label: 'All', count: g.students.length },
        { id: 'act', label: 'Need you', count: g.students.filter((r) => r.signals.some((s) => s.sev >= 2)).length },
        ...PROFILE_ORDER.map((p) => ({ id: p, label: PROFILES[p].short, count: g.classReading.profiles[p] })).filter((f) => f.count)
    ];
    const list = g.students.filter((r) => view.heroFilter === 'all'
        || (view.heroFilter === 'act' ? r.signals.some((s) => s.sev >= 2) : r.profile === view.heroFilter));
    return `
        <div class="gh-filters" role="group" aria-label="Show">${filters.map((f) => `
            <button type="button" class="gh-filter${view.heroFilter === f.id ? ' is-active' : ''}${PROFILES[f.id] ? ` gh-tone--${f.id}` : ''}" data-gh-filter="${f.id}" aria-pressed="${view.heroFilter === f.id}">${f.label}<b>${f.count}</b></button>`).join('')}
        </div>
        <div class="gh-pots">${list.map(potHtml).join('') || '<p class="gh-hint">Nobody here right now.</p>'}</div>`;
}

function potHtml(r) {
    const act = r.signals.filter((s) => s.kind === 'act').slice(0, 2);
    const good = r.signals.find((s) => s.kind === 'good');
    return `
        <article class="gh-pot gh-tone--${PROFILE_TONE[r.profile]}">
            <button type="button" class="gh-pot__open" data-gh-student="${r.id}" aria-label="Open ${esc(r.name)}'s reading">
                <span class="gh-pot__plant" aria-hidden="true">${plantSvg(plantShape(r))}</span>
                <span class="gh-pot__head">
                    <span class="gh-pot__name font-title">${esc(r.name)}</span>
                    <span class="gh-pot__profile"><i class="fas ${PROFILES[r.profile].icon}" aria-hidden="true"></i>${PROFILES[r.profile].label}</span>
                </span>
            </button>
            <p class="gh-pot__summary">${esc(r.summary)}</p>
            ${sparkHtml(r.stars.weekly)}
            <ul class="gh-signals">
                ${act.map((s) => `<li class="gh-signal gh-signal--sev${s.sev}"><i class="fas ${s.icon}" aria-hidden="true"></i>${esc(s.text)}</li>`).join('')}
                ${!act.length && good ? `<li class="gh-signal gh-signal--good"><i class="fas ${good.icon}" aria-hidden="true"></i>${esc(good.text)}</li>` : ''}
            </ul>
            <p class="gh-pot__next"><span>Next</span>${esc(r.action)}</p>
            <div class="gh-pot__foot">
                <button type="button" class="gh-btn gh-btn--ghost" data-gh-student="${r.id}"><i class="fas fa-magnifying-glass" aria-hidden="true"></i> Reading</button>
                <button type="button" class="gh-btn gh-btn--ghost" data-gh-chronicle="${r.id}"><i class="fas fa-book-reader" aria-hidden="true"></i> Chronicle</button>
            </div>
        </article>`;
}

function sparkHtml(weekly) {
    const max = Math.max(1, ...weekly);
    if (!weekly.some((w) => w > 0)) return '<div class="gh-spark gh-spark--empty" aria-hidden="true"><span>no stars in six weeks</span></div>';
    return `<div class="gh-spark" role="img" aria-label="Stars week by week: ${weekly.join(', ')}">${weekly.map((w, i) => `
        <span class="gh-spark__bar${i === weekly.length - 1 ? ' is-now' : ''}" style="--h:${Math.max(4, (w / max) * 100)}%" title="${w} stars"></span>`).join('')}
        <span class="gh-spark__cap">6 weeks of stars</span></div>`;
}

function plantShape(r) {
    const growth = r.map.achKnown ? r.map.y : (r.papers.avg != null ? r.papers.avg / 100 : 0.45);
    return { profile: r.profile, growth: 0.15 + growth * 0.85, leafiness: r.map.x, thirsty: r.signals.some((s) => s.id === 'unseen') };
}

/** A potted plant drawn from a child's reading: height from papers, leaves from stars, crown from profile. */
function plantSvg({ profile = 'steady', growth = 0.5, leafiness = 0.5, thirsty = false }) {
    const h = 10 + growth * 34;
    const top = 47 - h;
    const leafCount = 1 + Math.round(leafiness * 3);
    const droop = profile === 'tending';
    const lean = profile === 'reaching' ? 6 : 0;
    const stem = `M30 47 Q${30 + lean / 2} ${47 - h / 2} ${30 + lean} ${top}`;
    let leaves = '';
    for (let i = 0; i < leafCount; i += 1) {
        const t = (i + 1) / (leafCount + 1);
        const y = 47 - h * t;
        const x = 30 + lean * t;
        const side = i % 2 ? 1 : -1;
        const rot = droop ? side * 120 : side * 35;
        leaves += `<ellipse class="gh-plant__leaf" cx="${x + side * 6}" cy="${y}" rx="6.5" ry="3" transform="rotate(${rot} ${x + side * 6} ${y})"/>`;
    }
    let crown = '';
    if (profile === 'bloom') {
        crown = [0, 72, 144, 216, 288].map((a) => `<circle class="gh-plant__petal" cx="${30 + Math.cos((a * Math.PI) / 180) * 4.5}" cy="${top + Math.sin((a * Math.PI) / 180) * 4.5}" r="3.6"/>`).join('')
            + `<circle class="gh-plant__heart" cx="30" cy="${top}" r="2.6"/>`;
    } else if (profile === 'reaching') {
        crown = `<ellipse class="gh-plant__bud" cx="${30 + lean}" cy="${top - 1}" rx="2.6" ry="4" transform="rotate(20 ${30 + lean} ${top - 1})"/>`;
    } else if (profile === 'planted') {
        crown = `<ellipse class="gh-plant__leaf" cx="27" cy="${top}" rx="4" ry="2" transform="rotate(-30 27 ${top})"/><ellipse class="gh-plant__leaf" cx="33" cy="${top}" rx="4" ry="2" transform="rotate(30 33 ${top})"/>`;
    } else {
        crown = `<ellipse class="gh-plant__leaf" cx="${30 + lean}" cy="${top}" rx="3" ry="5"/>`;
    }
    const drop = thirsty ? '<path class="gh-plant__drop" d="M50 14 Q54 21 50 24 Q46 21 50 14 Z"/>' : '';
    return `<svg viewBox="0 0 60 72" focusable="false" class="gh-plant gh-plant--${profile}">
        <path class="gh-plant__stem" d="${stem}"/>${leaves}${crown}${drop}
        <path class="gh-plant__pot" d="M16 52 H44 L41 70 H19 Z"/>
        <rect class="gh-plant__rim" x="13" y="46" width="34" height="7" rx="2"/>
        <path class="gh-plant__soil" d="M16 47 H44"/>
    </svg>`;
}

// ------------------------------------------------------------------ drawer: one hero

function openDrawer(studentId) {
    view.drawerId = studentId;
    renderDrawer(studentId);
    const drawer = document.querySelector(`#${MODAL_ID} .gh-drawer`);
    drawer?.classList.add('is-open');
    drawer?.setAttribute('aria-hidden', 'false');
    drawer?.querySelector('.gh-drawer__close')?.focus();
}

function closeDrawer() {
    view.drawerId = null;
    const drawer = document.querySelector(`#${MODAL_ID} .gh-drawer`);
    drawer?.classList.remove('is-open');
    drawer?.setAttribute('aria-hidden', 'true');
}

function renderDrawer(studentId) {
    const drawer = document.querySelector(`#${MODAL_ID} .gh-drawer`);
    const r = view.green?.students.find((x) => x.id === studentId);
    if (!drawer || !r) return;
    const s = r.stars, p = r.papers, a = r.attendance;
    const fact = (label, value, foot = '') => `<div class="gh-fact"><p class="gh-fact__label">${label}</p><p class="gh-fact__value">${value}</p>${foot ? `<p class="gh-fact__foot">${foot}</p>` : ''}</div>`;
    const avatar = r.avatar ? `<img src="${esc(r.avatar)}" alt="">` : `<span class="font-title">${esc(r.first.charAt(0))}</span>`;
    drawer.innerHTML = `
        <div class="gh-drawer__head gh-tone--${PROFILE_TONE[r.profile]}">
            <span class="gh-drawer__avatar">${avatar}</span>
            <div class="gh-drawer__titles">
                <h3 class="gh-drawer__name font-title">${esc(r.name)}</h3>
                <p class="gh-drawer__profile"><i class="fas ${PROFILES[r.profile].icon}" aria-hidden="true"></i> ${PROFILES[r.profile].label}</p>
            </div>
            <button type="button" class="gh-drawer__close" data-gh-close-drawer aria-label="Close the reading"><i class="fas fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div class="gh-drawer__body custom-scrollbar">
            <p class="gh-drawer__meaning">${PROFILES[r.profile].meaning}</p>
            <div class="gh-next"><p class="gh-next__label">Next lesson</p><p class="gh-next__text">${esc(r.action)}</p></div>
            <div class="gh-facts">
                ${fact('Stars a lesson', s.perLesson ?? '—', s.perLessonRecent != null && s.perLessonPrior != null ? `now ${s.perLessonRecent}, before ${s.perLessonPrior}` : '')}
                ${fact('Last star', s.lastStarDay != null ? dayLabel(s.lastStarDay) : 'none yet', s.lessonsWithoutStar ? `${s.lessonsWithoutStar} lessons since` : 'last lesson')}
                ${fact('Papers', p.avg != null ? `${p.avg}%` : '—', p.rel != null ? `${p.rel > 0 ? '+' : ''}${p.rel} vs class` : `${p.count} marked`)}
                ${fact('Trend', p.trend != null ? `${p.trend > 0 ? '+' : ''}${p.trend} pts` : '—', 'recent papers vs earlier')}
                ${fact('Tests / dictations', `${p.test ?? '—'} / ${p.dictation ?? '—'}`, 'average %')}
                ${fact('Attendance', a.rate != null ? `${Math.round(a.rate * 100)}%` : '—', a.lessons ? `${a.present} of ${a.lessons} lessons` : '')}
            </div>
            ${r.virtueTotal ? `<div class="gh-mini-virtues">${VIRTUES.map((v) => `<span class="gh-virtue gh-virtue--${v.id}"><i class="fas ${v.icon}" aria-hidden="true"></i>${r.virtues[v.id]}</span>`).join('')}</div>` : ''}
            ${sparkHtml(s.weekly)}
            ${p.series.length >= 2 ? paperLineSvg(p.series) : ''}
            <h4 class="gh-h4">Signals</h4>
            <ul class="gh-signals gh-signals--all">${r.signals.map((x) => `<li class="gh-signal gh-signal--${x.kind === 'good' ? 'good' : `sev${x.sev}`}"><i class="fas ${x.icon}" aria-hidden="true"></i>${esc(x.text)}</li>`).join('') || '<li class="gh-signal">Nothing to flag.</li>'}</ul>
            ${p.missed.length ? `<h4 class="gh-h4">Papers without a mark</h4><ul class="gh-missed">${p.missed.map((m) => `<li>${esc(m.title)} · ${dayLabel(m.day)}${m.wasAbsent ? ' · absent that day' : ''}</li>`).join('')}</ul>` : ''}
            <h4 class="gh-h4">Seed packets for ${esc(r.first)}</h4>
            <div class="gh-chips">${r.techniques.map(packetChip).join('')}</div>
            <div class="gh-note">
                <h4 class="gh-h4">Quick Chronicle note</h4>
                <div class="gh-note__cats" role="radiogroup" aria-label="Category">${['General', 'Academic', 'Behavior', 'Social', 'Goals'].map((c, i) => `
                    <button type="button" role="radio" class="gh-note__cat" data-gh-note-cat="${c}" aria-checked="${i === 0}">${c === 'Behavior' ? 'Behaviour' : c}</button>`).join('')}
                </div>
                <textarea class="gh-note__text" rows="3" maxlength="1000" placeholder="What did you notice about ${esc(r.first)} today?" aria-label="Note about ${esc(r.first)}"></textarea>
                <button type="button" class="gh-btn" data-gh-save-note="${r.id}"><i class="fas fa-feather-pointed" aria-hidden="true"></i> Save to Chronicle</button>
            </div>
            <button type="button" class="gh-btn gh-btn--wide gh-btn--ghost" data-gh-chronicle="${r.id}"><i class="fas fa-book-reader" aria-hidden="true"></i> Open ${esc(r.first)}'s Hero's Chronicle</button>
        </div>`;
}

function paperLineSvg(series) {
    const W = 260, H = 64, n = series.length;
    const pts = series.map((v, i) => [8 + (i * (W - 16)) / Math.max(1, n - 1), H - 8 - (v / 100) * (H - 16)]);
    return `<figure class="gh-paperline"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Last papers: ${series.join('%, ')}%">
        <path class="gh-paperline__mid" d="M0 ${H / 2} H${W}"/>
        <polyline class="gh-paperline__line" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}"/>
        ${pts.map((p, i) => `<circle class="gh-paperline__dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"><title>${series[i]}%</title></circle>`).join('')}
    </svg><figcaption>Last ${n} papers</figcaption></figure>`;
}

async function saveQuickNote(studentId, btn) {
    const box = btn.closest('.gh-note');
    const text = box.querySelector('.gh-note__text').value.trim();
    const category = box.querySelector('[data-gh-note-cat][aria-checked="true"]')?.dataset.ghNoteCat || 'General';
    if (!text) {
        box.querySelector('.gh-note__text').focus();
        return;
    }
    btn.disabled = true;
    try {
        const { addOrUpdateHeroChronicleNote } = await import('../../db/actions.js');
        await addOrUpdateHeroChronicleNote(studentId, text, category);
        box.querySelector('.gh-note__text').value = '';
    } finally {
        btn.disabled = false;
    }
}

function openChronicle(studentId) {
    import('./hero.js').then((m) => m.openHeroChronicleModal(studentId));
}

// ------------------------------------------------------------------ next lesson

function tickKey() {
    const d = new Date();
    return `gcq_greenhouse_ticks_${view.classId}_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readTicks() {
    try { return JSON.parse(localStorage.getItem(tickKey()) || '{}'); } catch { return {}; }
}
function setTick(id, on) {
    const ticks = readTicks();
    if (on) ticks[id] = 1; else delete ticks[id];
    try { localStorage.setItem(tickKey(), JSON.stringify(ticks)); } catch { /* ticks are a per-laptop nicety */ }
}

function lessonHtml(g) {
    const p = g.plan;
    const ticks = readTicks();
    const tick = (id, html) => `
        <label class="gh-round"><input type="checkbox" data-gh-tick="${id}"${ticks[id] ? ' checked' : ''}><span class="gh-round__box" aria-hidden="true"></span><span class="gh-round__text">${html}</span></label>`;
    const nameBtn = (x) => `<button type="button" class="gh-name" data-gh-student="${x.id}">${esc(x.first)}</button>`;
    const move = p.classMove ? getTechnique(p.classMove.technique) : null;
    return `
        <div class="gh-lesson-head">
            <p class="gh-hint">The rounds for your next lesson, from the last six weeks of records. Ticks stay on this computer for today.</p>
            <button type="button" class="gh-btn gh-btn--ghost" data-gh-copy-plan><i class="fas fa-copy" aria-hidden="true"></i> Copy the plan</button>
        </div>
        ${move ? `
        <section class="gh-card gh-card--move">
            <p class="gh-move__kicker">Whole-class move · because ${esc(p.classMove.title.toLowerCase())}</p>
            <h3 class="gh-move__title font-title">${esc(move.title)}</h3>
            <p>${esc(move.how)}</p>
            <button type="button" class="gh-chip" data-gh-packet="${move.id}"><i class="fas fa-envelope-open" aria-hidden="true"></i> Open the packet</button>
        </section>` : ''}
        <div class="gh-grid-2">
            <section class="gh-card">
                <h3 class="gh-h"><i class="fas fa-hand-holding-droplet" aria-hidden="true"></i> Tend first</h3>
                ${p.focus.length ? p.focus.map((f) => tick(`focus-${f.id}`, `${esc(f.action).replace(esc(f.first), nameBtn(f))}<small>${esc(f.reason)}</small>`)).join('') : '<p class="gh-hint">Nobody urgent. A good week to stretch the strongest.</p>'}
            </section>
            <section class="gh-card">
                <h3 class="gh-h"><i class="fas fa-sun" aria-hidden="true"></i> Catch them shining</h3>
                <p class="gh-hint">Give each a specific star in the first ten minutes.</p>
                ${p.spotlight.length ? p.spotlight.map((x) => tick(`shine-${x.id}`, `${nameBtn(x)} <small>${x.lessonsWithoutStar ? `${x.lessonsWithoutStar} lessons since a star` : 'quiet lately'}</small>`)).join('') : '<p class="gh-hint">Everyone has been noticed lately.</p>'}
                ${p.welcome.length ? `<h4 class="gh-h4">Welcome back</h4>${p.welcome.map((x) => tick(`welcome-${x.id}`, `${nameBtn(x)} <small>${x.streak > 1 ? `missed ${x.streak} lessons` : 'missed last lesson'}</small>`)).join('')}` : ''}
                ${p.catchUps.length ? `<h4 class="gh-h4">Catch-up papers</h4>${p.catchUps.map((x) => tick(`catch-${x.id}`, `${nameBtn(x)} <small>${esc(x.papers.slice(0, 2).join(', '))}${x.papers.length > 2 ? ` +${x.papers.length - 2}` : ''}</small>`)).join('')}` : ''}
            </section>
        </div>
        ${p.crews ? `
        <section class="gh-card">
            <h3 class="gh-h"><i class="fas fa-layer-group" aria-hidden="true"></i> Three crews for one activity</h3>
            <p class="gh-hint">Grouped by papers for a single differentiated task. Guilds stay exactly as they are.</p>
            <div class="gh-crews">${p.crews.map((c) => `
                <div class="gh-crew gh-crew--${c.id}">
                    <p class="gh-crew__name font-title">${c.label}</p>
                    <p class="gh-crew__hint">${esc(c.hint)}</p>
                    <div class="gh-crew__members">${c.members.map((m) => `<button type="button" class="gh-name" data-gh-student="${m.id}">${esc(m.first)} <small>${m.avg}%</small></button>`).join('')}</div>
                    <button type="button" class="gh-chip" data-gh-packet="${c.technique}">${esc(getTechnique(c.technique)?.title || '')}</button>
                </div>`).join('')}
            </div>
        </section>` : ''}
        ${p.pairs ? `
        <section class="gh-card">
            <h3 class="gh-h"><i class="fas fa-user-group" aria-hidden="true"></i> Mixed-ability partners</h3>
            <p class="gh-hint">Stronger papers sit with middle ones, so the gap is small enough to help. For pair work only.</p>
            <div class="gh-pairs">${p.pairs.map((pair) => `<span class="gh-pair">${pair.map(nameBtn).join('<i class="fas fa-plus" aria-hidden="true"></i>')}</span>`).join('')}</div>
        </section>` : ''}`;
}

function planText(g) {
    const classData = findClass(view.classId);
    const p = g.plan;
    const lines = [`${classData?.name || 'Class'}: next lesson (Class Greenhouse)`];
    const move = p.classMove ? getTechnique(p.classMove.technique) : null;
    if (move) lines.push('', `Whole-class move: ${move.title}. ${move.how}`);
    if (p.focus.length) lines.push('', 'Tend first:', ...p.focus.map((f) => `- ${f.action}`));
    if (p.spotlight.length) lines.push('', 'Catch them shining:', ...p.spotlight.map((x) => `- ${x.first}`));
    if (p.welcome.length) lines.push('', 'Welcome back:', ...p.welcome.map((x) => `- ${x.first}`));
    if (p.catchUps.length) lines.push('', 'Catch-up papers:', ...p.catchUps.map((x) => `- ${x.first}: ${x.papers.join(', ')}`));
    if (p.crews) lines.push('', 'Crews for one activity:', ...p.crews.map((c) => `- ${c.label}: ${c.members.map((m) => m.first).join(', ')}`));
    if (p.pairs) lines.push('', 'Partners:', ...p.pairs.map((pair) => `- ${pair.map((m) => m.first).join(' + ')}`));
    return lines.join('\n');
}

async function copyPlan() {
    if (!view.green) return;
    try {
        await navigator.clipboard.writeText(planText(view.green));
        showToast('Next-lesson plan copied.', 'success');
    } catch {
        showToast('Could not copy on this computer.', 'error');
    }
}

// ------------------------------------------------------------------ playbook

function packetChip(id) {
    const t = getTechnique(id);
    if (!t) return '';
    const area = PLAYBOOK_AREAS.find((a) => a.id === t.area);
    return `<button type="button" class="gh-chip gh-area--${t.area}" data-gh-packet="${t.id}"><i class="fas ${area?.icon || 'fa-seedling'}" aria-hidden="true"></i>${esc(t.title)}</button>`;
}

function packetHtml(t, because = '') {
    const area = PLAYBOOK_AREAS.find((a) => a.id === t.area);
    return `
        <article class="gh-packet gh-area--${t.area}">
            <div class="gh-packet__band"><i class="fas ${area?.icon || 'fa-seedling'}" aria-hidden="true"></i><span>${area?.label || ''}</span><span class="gh-packet__time">${esc(t.time)}</span></div>
            <h4 class="gh-packet__title font-title">${esc(t.title)}</h4>
            ${because ? `<p class="gh-packet__because">For: ${esc(because)}</p>` : ''}
            <p class="gh-packet__how"><b>How to sow</b>${esc(t.how)}</p>
            <p class="gh-packet__why"><b>What grows</b>${esc(t.why)}</p>
            ${t.tool ? `<p class="gh-packet__tool"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> In the app: ${esc(t.tool)}</p>` : ''}
        </article>`;
}

function playbookHtml(g) {
    const picked = new Map();
    g.classReading.insights.forEach((i) => i.techniques.forEach((id) => { if (!picked.has(id)) picked.set(id, i.title); }));
    g.plan.focus.forEach((f) => { if (f.technique && !picked.has(f.technique)) picked.set(f.technique, f.first); });
    const pickedList = [...picked.entries()].slice(0, 6).map(([id, because]) => ({ t: getTechnique(id), because })).filter((x) => x.t);
    const shelf = TECHNIQUES.filter((t) => view.areaFilter === 'all' || t.area === view.areaFilter);
    return `
        ${pickedList.length ? `
        <h3 class="gh-h"><i class="fas fa-hand-sparkles" aria-hidden="true"></i> Picked for this class</h3>
        <div class="gh-packets">${pickedList.map(({ t, because }) => packetHtml(t, because)).join('')}</div>` : ''}
        <h3 class="gh-h gh-h--shelf"><i class="fas fa-box-archive" aria-hidden="true"></i> The whole shelf <span class="gh-h__count">${TECHNIQUES.length} techniques</span></h3>
        <div class="gh-filters" role="group" aria-label="Shelf">
            <button type="button" class="gh-filter${view.areaFilter === 'all' ? ' is-active' : ''}" data-gh-area="all" aria-pressed="${view.areaFilter === 'all'}">All</button>
            ${PLAYBOOK_AREAS.map((a) => `<button type="button" class="gh-filter gh-area--${a.id}${view.areaFilter === a.id ? ' is-active' : ''}" data-gh-area="${a.id}" aria-pressed="${view.areaFilter === a.id}"><i class="fas ${a.icon}" aria-hidden="true"></i>${a.label}</button>`).join('')}
        </div>
        <div class="gh-packets">${shelf.map((t) => packetHtml(t)).join('')}</div>`;
}

function openPacket(id) {
    const t = getTechnique(id);
    const layer = document.querySelector(`#${MODAL_ID} .gh-packet-layer`);
    if (!t || !layer) return;
    view.packetId = id;
    layer.innerHTML = `<div class="gh-packet-pop" role="dialog" aria-label="${esc(t.title)}">
        ${packetHtml(t)}
        <button type="button" class="gh-btn gh-btn--wide" data-gh-close-packet>Back to the greenhouse</button>
    </div>`;
    layer.hidden = false;
    layer.onclick = (e) => { if (e.target === layer) closePacket(); };
    layer.querySelector('[data-gh-close-packet]')?.focus();
}

function closePacket() {
    view.packetId = null;
    const layer = document.querySelector(`#${MODAL_ID} .gh-packet-layer`);
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
}

// ------------------------------------------------------------------ almanac (Elite AI, shared cache)

function almanacHtml() {
    const elite = canUseFeature('eliteAI');
    return `
        <div class="gh-almanac">
            <div class="gh-almanac__mast">
                <p class="gh-almanac__kicker">Elite counsel · written once, shared by every computer in the school</p>
                <h3 class="gh-almanac__title font-title">The Gardener's Almanac</h3>
                <p class="gh-almanac__lede">The Almanac reads this class's numbers and signals (never your private note text) and writes advice for the whole class.</p>
            </div>
            <div class="gh-counsels">${ALMANAC_COUNSELS.map((c) => `
                <button type="button" class="gh-counsel" data-gh-counsel="${c.id}">
                    <i class="fas ${c.icon}" aria-hidden="true"></i><span class="gh-counsel__name">${c.label}</span><span class="gh-counsel__hint">${c.hint}</span>
                    ${elite ? '' : '<span class="gh-counsel__lock"><i class="fas fa-lock" aria-hidden="true"></i> Elite</span>'}
                </button>`).join('')}
            </div>
            <div class="gh-almanac__page" aria-live="polite">
                <p class="gh-hint">Choose a counsel. A page someone already wrote for this class opens instantly, without asking the AI again.</p>
            </div>
        </div>`;
}

function hydrateAlmanac() {
    if (view.almanacLast && view.almanacLast.classId === view.classId) showAlmanacPage(view.almanacLast);
}

function counselDocRef(classId, counselId) {
    return doc(db, dataPath('daily_cache'), `greenhouse_${classId}_${counselId}`);
}

async function askAlmanac(counselId, { fresh = false } = {}) {
    if (!requireEliteAI({ feature: "The Gardener's Almanac" })) return;
    if (view.almanacBusy || !view.green) return;
    const counsel = ALMANAC_COUNSELS.find((c) => c.id === counselId);
    if (!counsel) return;
    const classId = view.classId;
    const page = document.querySelector(`#${MODAL_ID} .gh-almanac__page`);
    document.querySelectorAll(`#${MODAL_ID} [data-gh-counsel]`).forEach((b) => b.classList.toggle('is-chosen', b.dataset.ghCounsel === counselId));
    const fingerprint = view.green.fingerprint;
    const ref = counselDocRef(classId, counselId);
    view.almanacBusy = true;
    try {
        if (!fresh) {
            if (page) page.innerHTML = '<p class="gh-almanac__wait"><i class="fas fa-book-open fa-beat-fade" aria-hidden="true"></i> Turning to the right page…</p>';
            const snap = await getDoc(ref).catch(() => null);
            const data = snap?.exists?.() ? snap.data() : null;
            if (data?.content) {
                showAlmanacPage({ classId, counselId, content: data.content, createdAt: data.createdAt, stale: data.fingerprint !== fingerprint });
                return;
            }
        }
        if (page) page.innerHTML = '<p class="gh-almanac__wait"><i class="fas fa-feather-pointed fa-beat-fade" aria-hidden="true"></i> The Almanac is reading the whole class…</p>';
        const classData = findClass(classId);
        const { callGeminiApi } = await import('../../api.js');
        const brief = almanacBrief(view.green, { className: classData?.name || '', level: classData?.questLevel || '' });
        const content = String(await callGeminiApi(
            `${ALMANAC_SYSTEM_PROMPT} ${counsel.task}`,
            `Here is the class summary:\n\n${brief}\n\nWrite the ${counsel.label.toLowerCase()} now.`,
            { maxTokens: 900, timeoutMs: 45000 }
        ) || '').trim();
        if (!content) throw new Error('empty');
        const createdAt = Date.now();
        await setDoc(ref, {
            type: 'class_greenhouse', classId, counsel: counselId, content, fingerprint, createdAt,
            writtenFor: state.get('currentTeacherName') || ''
        }).catch((e) => console.warn('Almanac page could not be shared:', e?.message));
        if (view.classId === classId) showAlmanacPage({ classId, counselId, content, createdAt, stale: false });
    } catch (err) {
        console.error('Almanac error:', err);
        if (page && view.classId === classId) page.innerHTML = '<p class="gh-almanac__wait is-error"><i class="fas fa-cloud-bolt" aria-hidden="true"></i> The Almanac could not be written right now. Try again in a little while.</p>';
    } finally {
        view.almanacBusy = false;
    }
}

function showAlmanacPage({ classId, counselId, content, createdAt, stale }) {
    view.almanacLast = { classId, counselId, content, createdAt, stale };
    const page = document.querySelector(`#${MODAL_ID} .gh-almanac__page`);
    if (!page || view.tab !== 'almanac' || classId !== view.classId) return;
    const counsel = ALMANAC_COUNSELS.find((c) => c.id === counselId);
    document.querySelectorAll(`#${MODAL_ID} [data-gh-counsel]`).forEach((b) => b.classList.toggle('is-chosen', b.dataset.ghCounsel === counselId));
    const when = createdAt ? new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
    page.innerHTML = `
        <article class="gh-almanac__entry">
            <p class="gh-almanac__dateline">${esc(counsel?.label || '')}${when ? ` · written ${when}` : ''}</p>
            <div class="gh-almanac__text">${oracleMarkdown(content)}</div>
            ${stale ? `<div class="gh-almanac__stale"><p>New records have come in since this page was written.</p>
                <button type="button" class="gh-btn" data-gh-counsel="${counselId}" data-gh-fresh="1"><i class="fas fa-rotate" aria-hidden="true"></i> Write a fresh page</button></div>` : ''}
        </article>`;
}

// ------------------------------------------------------------------ bits

function renderThermometer(health) {
    const el = document.querySelector(`#${MODAL_ID} .gh-thermo`);
    if (!el) return;
    const v = health == null ? 0 : health;
    const word = health == null ? 'reading…' : health >= 75 ? 'thriving' : health >= 55 ? 'growing' : health >= 40 ? 'needs care' : 'needs tending';
    el.setAttribute('aria-label', health == null ? 'Class health: reading' : `Class health ${health} out of 100, ${word}`);
    el.style.setProperty('--fill', `${v}%`);
    el.innerHTML = `
        <span class="gh-thermo__tube" aria-hidden="true"><span class="gh-thermo__fill"></span><span class="gh-thermo__bulb"></span></span>
        <span class="gh-thermo__read"><b class="font-title">${health == null ? '…' : health}</b><span>${word}</span></span>`;
}

function emptyHtml(title, text) {
    return `<div class="gh-empty"><span aria-hidden="true">${plantSvg({ profile: 'planted', growth: 0.2, leafiness: 0.3 })}</span><p class="gh-empty__title font-title">${title}</p><p>${text}</p></div>`;
}

function ivySvg() {
    const leaf = (x, y, r) => `<path class="gh-ivy__leaf" transform="translate(${x} ${y}) rotate(${r})" d="M0 0 C6 -6 12 -2 10 6 C6 10 2 8 0 0 Z"/>`;
    return `<path class="gh-ivy__vine" d="M4 0 C20 30 6 60 26 88 S30 120 46 128"/>
        ${leaf(10, 18, 10)}${leaf(16, 38, 140)}${leaf(12, 58, 20)}${leaf(24, 80, 150)}${leaf(30, 100, 30)}${leaf(40, 120, 160)}`;
}

