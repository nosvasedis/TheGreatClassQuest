// /ui/modals/classGreenhouse.js
// The Class Greenhouse: the WHOLE class, beside the Hero's Chronicle for each child.
// Opened from a class card in My Classes, the class roster and the Chronicle's class ribbon.
//
//   The class    one sentence about the class, three moves for it, who needs you first, the
//                growth map, what your Chronicle notes say across the class, and the stars and
//                papers in detail (folded away).
//   Next lesson  the rounds for the next lesson: who to tend first, notes to follow up, who
//                to catch shining, small groups and buddies from the notes, who to keep apart,
//                lesson hooks, ability crews and partners for one activity (guilds are never
//                touched). Ticks are kept per laptop.
//   Counsel      the Gardener's Almanac (Elite AI, written once per class and shared
//                school-wide in daily_cache/greenhouse_<classId>_<counsel>, questions too), and
//                the seed shelf of techniques, the ones picked for this class first.
//
// Every child's name opens that child's Hero's Chronicle on top: the Greenhouse steps back
// behind it and comes forward again when the Chronicle closes. The Chronicle shows where the
// child stands in this class (classRoleOf) and its ribbon leads back here, to that child's dot.
//
// Numbers come from features/classGreenhouseCore.mjs (pure, tested), records from
// ui/modals/classGreenhouseData.js; techniques from features/classGreenhousePlaybook.mjs.
// Styles: styles/class_greenhouse.css.

import * as state from '../../state.js';
import { db, doc, getDoc, setDoc } from '../../firebase.js';
import { dataPath } from '../../utils/tenant.mjs';
import { canUseFeature } from '../../utils/subscription.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { esc } from '../../features/scholarScrollCore.mjs';
import { oracleMarkdown } from '../../features/scholarFolioCore.mjs';
import {
    almanacBrief, almanacQuestionTask, classHeadline, dayLabel, PROFILES, PROFILE_ORDER,
    ALMANAC_COUNSELS, ALMANAC_SYSTEM_PROMPT, spreadDots
} from '../../features/classGreenhouseCore.mjs';
import { NOTE_DOMAINS } from '../../features/noteLexicon.mjs';
import { TECHNIQUES, PLAYBOOK_AREAS, getTechnique } from '../../features/classGreenhousePlaybook.mjs';
import { findClass, loadRecords, readGreenhouse } from './classGreenhouseData.js';
import { showAnimatedModal, hideModal } from './base.js';
import { showToast } from '../effects.js';
import '../../styles/class_greenhouse.css';

const MODAL_ID = 'class-greenhouse-modal';
const TABS = [
    { id: 'class', label: 'The class', icon: 'fa-sun' },
    { id: 'lesson', label: 'Next lesson', icon: 'fa-list-check' },
    { id: 'counsel', label: 'Counsel', icon: 'fa-book-open' }
];
// Older links (and the guidebook) used five tabs; they land on the one that holds that content now.
const TAB_ALIASES = { overview: 'class', heroes: 'class', playbook: 'counsel', almanac: 'counsel' };
const PROFILE_TONE = { bloom: 'bloom', reaching: 'reaching', roots: 'roots', wild: 'wild', tending: 'tending', steady: 'steady', planted: 'planted' };

const view = {
    classId: null,
    tab: 'class',
    green: null,
    areaFilter: 'all',
    packetId: null,
    spotId: null,          // the child the Chronicle sent us to: their dot is lit on the map
    almanacBusy: false,
    almanacLast: null,
    aiRound: null,         // the weekly AI reading round: { next, pending, read } (Elite), from noteAiReader.js
    asked: new Map(),      // classId → [{ question, content, createdAt }] asked this session
    unsubscribe: null,
    chronicleWatch: null
};

// ------------------------------------------------------------------ open / close

export async function openClassGreenhouse(classId, { tab = 'class', studentId = '' } = {}) {
    const classData = findClass(classId);
    if (!classData) {
        showToast('Choose one of your classes first.', 'info');
        return;
    }
    ensureShell();
    const modal = document.getElementById(MODAL_ID);
    const wanted = TAB_ALIASES[tab] || (TABS.some((t) => t.id === tab) ? tab : 'class');
    view.spotId = studentId || null;

    // Already open on this class, waiting behind the Chronicle: just step forward to the child.
    if (isOpen() && view.classId === classId && view.green) {
        modal.classList.remove('is-behind');
        view.tab = wanted;
        recompute();
        revealSpot();
        return;
    }

    view.classId = classId;
    view.tab = wanted;
    view.packetId = null;
    view.green = null;
    modal.classList.remove('is-behind');
    modal.querySelector('.gh-title__logo').textContent = classData.logo || '🌱';
    modal.querySelector('.gh-title__name').textContent = classData.name || 'Class';
    modal.querySelector('.gh-title__sub').textContent = 'Reading the last six weeks…';
    renderThermometer(null);
    renderTabs();
    body().innerHTML = `<div class="gh-loading"><span class="gh-loading__sprout" aria-hidden="true">${plantSvg({ profile: 'planted', growth: 0.3, leafiness: 0.4 })}</span><p>Walking the rows…</p></div>`;
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
    revealSpot();
    showReadingRound(classId);
}

/** Elite: when the next deep reading of the notes will run, and how many notes wait for it. No AI call here. */
function showReadingRound(classId) {
    if (!canUseFeature('eliteAI')) return;
    import('./noteAiReader.js')
        .then((m) => m.readingRoundStatus())
        .then((st) => {
            if (!st?.eligible || view.classId !== classId) return;
            view.aiRound = { next: st.pending ? st.nextLabel : '', pending: st.pending };
            if (isOpen() && view.tab === 'class') renderPanel({ keepScroll: true });
        })
        .catch(() => {});
}

function closeGreenhouse() {
    closePacket();
    view.unsubscribe?.();
    view.unsubscribe = null;
    view.chronicleWatch?.disconnect();
    view.chronicleWatch = null;
    document.getElementById(MODAL_ID)?.classList.remove('is-behind');
    hideModal(MODAL_ID);
}

function isOpen() {
    const modal = document.getElementById(MODAL_ID);
    return modal && !modal.classList.contains('hidden');
}

function body() {
    return document.getElementById('class-greenhouse-body');
}

function recompute({ keepScroll = false } = {}) {
    const scroll = keepScroll ? body()?.scrollTop : 0;
    view.green = readGreenhouse(view.classId);
    const g = view.green;
    const sub = document.querySelector(`#${MODAL_ID} .gh-title__sub`);
    if (sub) {
        sub.textContent = g.lessons.all
            ? `${g.classReading.size} heroes · ${g.lessons.all} lessons in the last six weeks${g.lessons.last != null ? ` · last on ${dayLabel(g.lessons.last)}` : ''}`
            : `${g.classReading.size} heroes · no lessons recorded in the last six weeks yet`;
    }
    renderThermometer(g.classReading.health);
    renderTabs();
    renderPanel({ animate: !keepScroll });
    if (keepScroll && body()) body().scrollTop = scroll;
}

/** Arriving from a child's Chronicle: light their dot and bring the map into view. */
function revealSpot() {
    if (!view.spotId || view.tab !== 'class') return;
    requestAnimationFrame(() => {
        const dot = document.querySelector(`#${MODAL_ID} .gh-dot.is-spot`);
        dot?.closest('.gh-card')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
}

// ------------------------------------------------------------------ the hand-off to the Chronicle

/** A child's own book opens on top; the Greenhouse steps back and returns when it closes. */
function openChronicle(studentId, { oracle = false } = {}) {
    const modal = document.getElementById(MODAL_ID);
    modal?.classList.add('is-behind');
    view.spotId = studentId;
    import('./hero.js')
        .then((m) => {
            m.openHeroChronicleModal(studentId, { tab: oracle ? 'oracle' : 'notes' });
            watchChronicle();
        })
        .catch(() => modal?.classList.remove('is-behind'));
}

function watchChronicle() {
    const chronicle = document.getElementById('hero-chronicle-modal');
    if (!chronicle) {
        document.getElementById(MODAL_ID)?.classList.remove('is-behind');
        return;
    }
    view.chronicleWatch?.disconnect();
    view.chronicleWatch = new MutationObserver(() => {
        if (!chronicle.classList.contains('hidden')) return;
        view.chronicleWatch?.disconnect();
        view.chronicleWatch = null;
        const modal = document.getElementById(MODAL_ID);
        modal?.classList.remove('is-behind');
        // Notes written in the Chronicle change the class reading: show it fresh.
        if (isOpen()) recompute({ keepScroll: true });
    });
    view.chronicleWatch.observe(chronicle, { attributes: true, attributeFilter: ['class'] });
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
                <span class="gh-roof__sun" aria-hidden="true"></span>
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
                <div class="gh-packet-layer" hidden></div>
            </div>
        </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('submit', onSubmit);
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            if (view.packetId) closePacket();
            else closeGreenhouse();
        }
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-gh-student][role="button"]')) {
            e.preventDefault();
            openChronicle(e.target.dataset.ghStudent);
        }
    });
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeGreenhouse(); });
}

function onClick(e) {
    const t = e.target.closest('button, [data-gh-student], a');
    if (!t) return;
    if (t.classList.contains('gh-close')) return closeGreenhouse();
    if (t.dataset.ghTab) { switchTab(t.dataset.ghTab); return; }
    if (t.dataset.ghArea) { view.areaFilter = t.dataset.ghArea; renderPanel({ keepScroll: true }); return; }
    if (t.dataset.ghPacket) return openPacket(t.dataset.ghPacket);
    if (t.dataset.ghClosePacket != null) return closePacket();
    if (t.dataset.ghCounsel) return askAlmanac(t.dataset.ghCounsel, { fresh: t.dataset.ghFresh === '1' });
    if (t.dataset.ghQuestionFresh) return askClassQuestion(t.dataset.ghQuestionFresh, { fresh: true });
    if (t.dataset.ghCopyPlan != null) return copyPlan();
    if (t.dataset.ghOracle) return openChronicle(t.dataset.ghOracle, { oracle: true });
    if (t.dataset.ghStudent) return openChronicle(t.dataset.ghStudent);
}

function onChange(e) {
    const box = e.target.closest('[data-gh-tick]');
    if (box) setTick(box.dataset.ghTick, box.checked);
}

function onSubmit(e) {
    const form = e.target.closest('.gh-ask');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input');
    const q = input?.value.trim();
    if (q) askClassQuestion(q);
}

function switchTab(tab) {
    if (tab === view.tab) return;
    view.tab = tab;
    renderTabs();
    renderPanel({ animate: true });
    body().scrollTop = 0;
}

function renderTabs() {
    const nav = document.querySelector(`#${MODAL_ID} .gh-tabs`);
    if (!nav) return;
    const g = view.green;
    const counts = { lesson: g ? g.plan.focus.length + g.plan.followUps.length : 0 };
    nav.innerHTML = TABS.map((t) => `
        <button type="button" role="tab" class="gh-tab${view.tab === t.id ? ' is-active' : ''}" data-gh-tab="${t.id}" aria-selected="${view.tab === t.id}">
            <span class="gh-tab__hole" aria-hidden="true"></span>
            <i class="fas ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>
            ${counts[t.id] ? `<span class="gh-tab__count" aria-label="${counts[t.id]} to do">${counts[t.id]}</span>` : ''}
        </button>`).join('');
}

function renderPanel({ keepScroll = false, animate = false } = {}) {
    const el = body();
    const g = view.green;
    if (!el || !g) return;
    const scroll = el.scrollTop;
    const html = { class: classHtml, lesson: lessonHtml, counsel: counselHtml }[view.tab]?.(g) || '';
    el.innerHTML = `<section class="gh-panel gh-panel--${view.tab}${animate ? ' is-entering' : ''}" role="tabpanel">${html}</section>`;
    if (keepScroll) el.scrollTop = scroll;
    if (view.tab === 'counsel') hydrateAlmanac();
}

// ------------------------------------------------------------------ the class

const avatarHtml = (r) => (r.avatar ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">` : `<span class="font-title">${esc(r.first.charAt(0))}</span>`);

function classHtml(g) {
    const c = g.classReading;
    if (!c.size) return emptyHtml('No heroes in this class yet', 'Add students to the class and the greenhouse fills itself.');
    const stat = (value, label, foot = '') => `<div class="gh-stat"><b class="font-title">${value}</b><span>${label}</span>${foot ? `<small>${foot}</small>` : ''}</div>`;
    const trend = (x, unit = '') => (x == null || x === 0 ? '' : `<em class="gh-trend gh-trend--${x > 0 ? 'up' : 'down'}">${x > 0 ? '▲' : '▼'} ${Math.abs(x)}${unit}</em>`);

    const all = c.insights.filter((i) => i.id !== 'healthy' && i.tone !== 'info');
    const moves = (all.length ? all : c.insights).slice(0, 3);
    const rest = c.insights.filter((i) => !moves.includes(i));
    const need = g.students.filter((r) => r.signals.some((s) => s.sev >= 2)).slice(0, 6);

    return `
        <section class="gh-hello gh-rise" style="--i:0">
            <span class="gh-hello__sprout" aria-hidden="true">${plantSvg({ profile: c.health >= 55 ? 'bloom' : c.health >= 40 ? 'steady' : 'tending', growth: Math.max(0.25, (c.health || 40) / 100), leafiness: 0.7 })}</span>
            <div class="gh-hello__text">
                <p class="gh-hello__kicker">The class this week</p>
                <p class="gh-hello__line font-title">${esc(classHeadline(g))}</p>
                <div class="gh-hello__stats">
                    ${stat(c.stars.perChildRecent ?? '—', 'stars a child, a lesson', trend(c.stars.trend == null ? null : Math.round(c.stars.trend * 100), '%'))}
                    ${stat(c.papers.classAvg != null ? `${c.papers.classAvg}%` : '—', 'papers average', trend(c.papers.trend, ' pts'))}
                    ${stat(c.attendance.rate != null ? `${Math.round(c.attendance.rate * 100)}%` : '—', 'attendance', c.attendance.worstWeekday ? `lowest on ${c.attendance.worstWeekday.day}s` : '')}
                    ${stat(`${c.notes.noted}/${c.size}`, 'with a recent note')}
                </div>
            </div>
        </section>

        <section class="gh-card gh-card--moves gh-rise" style="--i:1">
            <h3 class="gh-h"><i class="fas fa-compass" aria-hidden="true"></i> ${moves.length === 1 ? 'One move' : `${moves.length === 2 ? 'Two' : 'Three'} moves`} for this class</h3>
            <ol class="gh-moves">${moves.map((i, k) => `
                <li class="gh-move gh-insight--${i.tone}" style="--k:${k}">
                    <span class="gh-move__num font-title" aria-hidden="true">${k + 1}</span>
                    <div class="gh-move__body">
                        <p class="gh-insight__title">${esc(i.title)}${i.source === 'notes' ? ' <span class="gh-from-notes"><i class="fas fa-feather-pointed" aria-hidden="true"></i> from your notes</span>' : ''}</p>
                        <p class="gh-insight__text">${linkNames(esc(i.text))}</p>
                        ${i.techniques.length ? `<div class="gh-chips">${i.techniques.map(packetChip).join('')}</div>` : ''}
                    </div>
                </li>`).join('')}
            </ol>
            ${rest.length ? `<details class="gh-more"><summary>Everything else the greenhouse sees <b>${rest.length}</b></summary>
                <ul class="gh-insights">${rest.map(insightLi).join('')}</ul></details>` : ''}
        </section>

        <div class="gh-grid-2 gh-grid-2--map">
            <section class="gh-card gh-card--map gh-rise" style="--i:2">
                <h3 class="gh-h"><i class="fas fa-seedling" aria-hidden="true"></i> The growth map</h3>
                <p class="gh-hint">Every dot is a hero. Across: stars a lesson (effort). Up: papers against the class. Tap a dot to open their Chronicle.</p>
                ${spotBanner(g)}
                ${growthMapSvg(g)}
                <div class="gh-legend">${PROFILE_ORDER.filter((p) => c.profiles[p]).map((p) => `
                    <span class="gh-legend__item gh-tone--${p}" title="${esc(PROFILES[p].meaning)}"><span class="gh-legend__dot" aria-hidden="true"></span>${PROFILES[p].label} <b>${c.profiles[p]}</b></span>`).join('')}
                </div>
            </section>

            <section class="gh-card gh-card--kids gh-card--kids-side gh-rise" style="--i:3">
                <h3 class="gh-h"><i class="fas fa-hand-holding-droplet" aria-hidden="true"></i> Who needs you first</h3>
                <p class="gh-hint">Tap a hero to open their Chronicle: their notes, their Oracle and their place in this class.</p>
                ${need.length ? `<div class="gh-kids">${need.map((r, k) => {
        const why = r.signals.find((s) => s.action && s.action === r.action) || r.signals.find((s) => s.kind === 'act');
        return `
                    <button type="button" class="gh-kid gh-tone--${PROFILE_TONE[r.profile]}" data-gh-student="${r.id}" style="--k:${k}">
                        <span class="gh-kid__avatar">${avatarHtml(r)}</span>
                        <span class="gh-kid__text">
                            <span class="gh-kid__name font-title">${esc(r.first)} <small class="gh-kid__profile">${esc(PROFILES[r.profile].label)}</small></span>
                            <span class="gh-kid__why">${esc(why?.text || PROFILES[r.profile].label)}</span>
                            <span class="gh-kid__next"><i class="fas fa-seedling" aria-hidden="true"></i> ${esc(r.action)}</span>
                        </span>
                        <i class="fas fa-book-open gh-kid__open" aria-hidden="true"></i>
                    </button>`;
    }).join('')}</div>` : '<p class="gh-calm"><i class="fas fa-sun" aria-hidden="true"></i> Nobody urgent this week. A good time to stretch the strongest and notice the quiet ones.</p>'}
            </section>
        </div>

        ${notesCardHtml(g)}

        <details class="gh-card gh-more gh-more--numbers gh-rise" style="--i:5">
            <summary><i class="fas fa-chart-simple" aria-hidden="true"></i> Stars and papers in detail</summary>
            <div class="gh-grid-2">
                <div><h4 class="gh-h4">Virtue mix</h4>${virtueMixHtml(c.virtueMix, g.students)}</div>
                <div><h4 class="gh-h4">Paper levels</h4>${bandsHtml(c.papers)}</div>
            </div>
        </details>`;
}

/** "Ioanna is here": shown above the map when the Chronicle sent the teacher to a child. */
function spotBanner(g) {
    const r = view.spotId ? g.students.find((x) => x.id === view.spotId) : null;
    if (!r) return '';
    return `
        <div class="gh-spot gh-tone--${PROFILE_TONE[r.profile]}">
            <span class="gh-spot__avatar">${avatarHtml(r)}</span>
            <p><b>${esc(r.first)}</b> is the glowing dot: ${esc(PROFILES[r.profile].label.toLowerCase())}. ${esc(PROFILES[r.profile].meaning)}${r.profileWhy ? `<small class="gh-spot__why">${esc(r.profileWhy)}</small>` : ''}</p>
            <button type="button" class="gh-btn gh-btn--ghost" data-gh-student="${r.id}"><i class="fas fa-book-open" aria-hidden="true"></i> Back to ${esc(r.first)}'s Chronicle</button>
        </div>`;
}

/** First names in a sentence become links to that child's Chronicle. */
function linkNames(html) {
    const g = view.green;
    if (!g) return html;
    const counts = new Map();
    g.students.forEach((r) => counts.set(r.first, (counts.get(r.first) || 0) + 1));
    const byFirst = new Map(g.students.filter((r) => counts.get(r.first) === 1 && r.first.length >= 2).map((r) => [r.first, r.id]));
    if (!byFirst.size) return html;
    const names = [...byFirst.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(?<![\\p{L}])(${names.join('|')})(?![\\p{L}])`, 'gu');
    // Only text between tags, never inside an attribute or an existing button.
    let insideButton = 0;
    return html.split(/(<[^>]+>)/).map((part) => {
        if (part.startsWith('<')) {
            if (/^<button\b/i.test(part)) insideButton += 1;
            if (/^<\/button>/i.test(part)) insideButton = Math.max(0, insideButton - 1);
            return part;
        }
        if (insideButton) return part;
        return part.replace(re, (name) => `<button type="button" class="gh-name" data-gh-student="${byFirst.get(name)}">${name}</button>`);
    }).join('');
}

function insightLi(i) {
    return `
        <li class="gh-insight gh-insight--${i.tone}">
            <p class="gh-insight__title">${esc(i.title)}</p>
            <p class="gh-insight__text">${linkNames(esc(i.text))}</p>
            ${i.techniques.length ? `<div class="gh-chips">${i.techniques.map(packetChip).join('')}</div>` : ''}
        </li>`;
}

/** The class picture from what the teacher wrote: shared themes, interests, who with whom, balance. */
function notesCardHtml(g) {
    const ch = g.classReading.chronicle;
    const nameBtn = (x) => `<button type="button" class="gh-name" data-gh-student="${x.id}">${esc(x.first)}</button>`;
    if (!ch.written) {
        return `<section class="gh-card gh-card--notes gh-rise" style="--i:4">
            <h3 class="gh-h"><i class="fas fa-book-reader" aria-hidden="true"></i> What your notes say</h3>
            <p class="gh-hint">No Chronicle notes for this class yet. Write a line or two in a child's Hero's Chronicle (spelling, shyness, a passion for football, who argues with whom) and the greenhouse turns it into groups, buddies and lesson hooks for the whole class.</p>
        </section>`;
    }
    const t = ch.tone || {};
    const toneTotal = Math.max(1, (t.worry || 0) + (t.good || 0) + (t.mixed || 0) + (t.neutral || 0));
    const seg = (k, label) => (t[k] ? `<span class="gh-tone-bar__seg gh-tone-bar--${k}" style="flex-grow:${t[k]}" title="${label}: ${t[k]}"></span>` : '');
    const legend = [['worry', 'Worries'], ['mixed', 'Mixed'], ['good', 'Good news'], ['neutral', 'Plain']]
        .filter(([k]) => t[k])
        .map(([k, label]) => `<span class="gh-tone-legend__item"><span class="gh-tone-legend__swatch gh-tone-bar--${k}"></span>${label} <b>${t[k]}</b> <small>${Math.round((t[k] / toneTotal) * 100)}%</small></span>`).join('');
    const mix = ch.languageMix || {};
    const langs = [['el', 'Greek'], ['en', 'English'], ['greeklish', 'Greeklish'], ['mixed', 'Mixed']].filter(([k]) => mix[k]).map(([k, label]) => `${label} ${mix[k]}`);
    const round = view.aiRound;
    const facts = [
        langs.length ? `<li><i class="fas fa-language" aria-hidden="true"></i> Read in ${langs.join(' · ')}</li>` : '',
        ch.aiRead ? `<li class="is-ai"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> ${ch.aiRead} read more deeply by the Oracle</li>` : '',
        round?.next && round.pending ? `<li class="is-ai"><i class="fas fa-hourglass-half" aria-hidden="true"></i> Next deep reading ${esc(round.next)} (${round.pending} ${round.pending === 1 ? 'note' : 'notes'} waiting)</li>` : '',
        ch.corrected ? `<li><i class="fas fa-pen" aria-hidden="true"></i> ${ch.corrected} corrected by you</li>` : ''
    ].filter(Boolean).join('');

    // Feelings stay in their column: a highlight card is for a small-group move, never a group of anxious children.
    const shared = ch.clusters.filter((c) => c.kind !== 'context' && c.kind !== 'strength' && c.group !== 'wellbeing' && c.open.length >= 2).slice(0, 3);
    const byDomain = new Map(NOTE_DOMAINS.map((d) => [d.id, []]));
    ch.clusters.forEach((c) => byDomain.get(c.domain === 'background' ? 'feelings' : c.domain)?.push(c));
    const columns = NOTE_DOMAINS.filter((d) => d.id !== 'background' && byDomain.get(d.id).length);
    const ROWS_SHOWN = 5;

    return `
        <section class="gh-card gh-card--notes gh-rise" style="--i:4">
            <header class="gh-notes-head">
                <h3 class="gh-h"><i class="fas fa-book-reader" aria-hidden="true"></i> What your notes say <span class="gh-h__count">${ch.written} ${ch.written === 1 ? 'note' : 'notes'}</span></h3>
                <p class="gh-hint">Your Chronicle notes, read sentence by sentence in Greek, English or Greeklish. Tap a name to open that hero's Chronicle; fix a reading there if it is wrong.</p>
                <div class="gh-notes-summary">
                    ${ch.recent ? `<div class="gh-tonebox">
                        <div class="gh-tone-bar" role="img" aria-label="Last six weeks: ${t.worry || 0} worries, ${t.good || 0} good news, ${t.mixed || 0} mixed, ${t.neutral || 0} plain">
                            ${seg('worry', 'Worries')}${seg('mixed', 'Mixed')}${seg('good', 'Good news')}${seg('neutral', 'Plain notes')}
                        </div>
                        <p class="gh-tone-legend">${legend}</p>
                    </div>` : ''}
                    ${facts ? `<ul class="gh-notes-facts">${facts}</ul>` : ''}
                </div>
            </header>
            ${shared.length ? `<div class="gh-patterns">${shared.map((c) => `
                <article class="gh-pattern">
                    <p class="gh-pattern__kicker">Shared by ${c.open.length}</p>
                    <p class="gh-pattern__title"><i class="fas ${c.icon}" aria-hidden="true"></i> ${esc(c.label)}</p>
                    <div class="gh-pattern__who">${c.open.slice(0, 6).map((x) => kidChip(x, 'worry')).join('')}${c.open.length > 6 ? `<span class="gh-more-count">+${c.open.length - 6}</span>` : ''}</div>
                    ${c.techniques[0] ? `<div class="gh-chips">${packetChip(c.techniques[0])}</div>` : ''}
                </article>`).join('')}</div>` : ''}
            ${columns.length ? `<div class="gh-domains">${columns.map((d) => {
        const rows = byDomain.get(d.id);
        const people = rows.reduce((n, c) => n + c.open.length + c.improving.length + c.strong.length, 0);
        return `
                <section class="gh-domain gh-domain--${d.id}">
                    <h4 class="gh-domain__head"><i class="fas ${d.icon}" aria-hidden="true"></i> ${esc(d.label)} <b>${people}</b></h4>
                    <ul class="gh-trays">${rows.slice(0, ROWS_SHOWN).map(trayHtml).join('')}</ul>
                    ${rows.length > ROWS_SHOWN ? `<details class="gh-domain__more"><summary>Show ${rows.length - ROWS_SHOWN} more</summary><ul class="gh-trays">${rows.slice(ROWS_SHOWN).map(trayHtml).join('')}</ul></details>` : ''}
                </section>`;
    }).join('')}</div>` : '<p class="gh-hint">The notes so far do not name a clear pattern yet.</p>'}
            <div class="gh-notes-foot">
                ${ch.interests.length ? `<div class="gh-tagblock"><p class="gh-tagblock__label"><i class="fas fa-heart" aria-hidden="true"></i> Passions</p><p class="gh-tagblock__items">${ch.interests.slice(0, 6).map((i) => `<span class="gh-like">${esc(i.icon || '')} ${esc(i.label)} <small>${i.children.map((x) => esc(x.first)).join(', ')}</small></span>`).join('')}</p></div>` : ''}
                ${ch.friction.length ? `<div class="gh-tagblock gh-tagblock--apart"><p class="gh-tagblock__label"><i class="fas fa-people-arrows" aria-hidden="true"></i> Keep apart</p><p class="gh-tagblock__items">${ch.friction.slice(0, 4).map((x) => `<span class="gh-duo gh-duo--apart">${nameBtn({ id: x.a, first: x.aFirst })} &amp; ${nameBtn({ id: x.b, first: x.bFirst })}</span>`).join('')}</p></div>` : ''}
                ${ch.warm.length ? `<div class="gh-tagblock"><p class="gh-tagblock__label"><i class="fas fa-handshake" aria-hidden="true"></i> Good together</p><p class="gh-tagblock__items">${ch.warm.slice(0, 4).map((x) => `<span class="gh-duo">${nameBtn({ id: x.a, first: x.aFirst })} &amp; ${nameBtn({ id: x.b, first: x.bFirst })}</span>`).join('')}</p></div>` : ''}
                ${ch.followUps.length ? `<div class="gh-tagblock"><p class="gh-tagblock__label"><i class="fas fa-reply" aria-hidden="true"></i> Gone quiet</p><p class="gh-tagblock__items">${ch.followUps.map((f) => `<span class="gh-duo">${nameBtn(f)} <small>${esc(f.label.toLowerCase())}, ${f.daysAgo} days ago</small></span>`).join('')}</p></div>` : ''}
                ${ch.unwritten.length ? `<div class="gh-tagblock"><p class="gh-tagblock__label"><i class="fas fa-feather" aria-hidden="true"></i> No notes yet</p><p class="gh-tagblock__items">${ch.unwritten.slice(0, 10).map(nameBtn).join('')}${ch.unwritten.length > 10 ? `<span class="gh-more-count">+${ch.unwritten.length - 10}</span>` : ''}</p></div>` : ''}
            </div>
        </section>`;
}

const TONE_WORD = { worry: 'worry', context: 'background', better: 'getting better', strength: 'strength' };

/** One child on a theme row: coloured by tone, heavier when the note said it strongly. */
function kidChip(x, tone) {
    const strong = (x.intensity || 1) >= 2 && tone === 'worry';
    const when = x.last != null ? ` · ${dayLabel(x.last)}` : '';
    const by = x.source === 'ai' ? ' · read by the Oracle' : x.source === 'teacher' ? ' · set by you' : '';
    const title = `${TONE_WORD[tone]}${x.count > 1 ? ` · ${x.count} notes` : ''}${x.pattern === 'trait' ? ' · a pattern' : ''}${when}${by}${x.quote ? `\n“${x.quote}”` : ''}`;
    return `<button type="button" class="gh-kidchip gh-kidchip--${tone}${strong ? ' is-strong' : ''}" data-gh-student="${x.id}" title="${esc(title)}">${esc(x.first)}${strong ? '<span class="gh-kidchip__mark" aria-label="said strongly">!</span>' : ''}${x.source === 'ai' ? '<i class="fas fa-wand-magic-sparkles gh-kidchip__src" aria-hidden="true"></i>' : x.source === 'teacher' ? '<i class="fas fa-pen gh-kidchip__src" aria-hidden="true"></i>' : ''}</button>`;
}

/** One theme row in a domain column: label, how many in each tone, then the children. */
function trayHtml(c) {
    const openTone = c.kind === 'context' ? 'context' : 'worry';
    const chips = [
        ...c.open.map((x) => kidChip(x, openTone)),
        ...c.improving.map((x) => kidChip(x, 'better')),
        ...c.strong.map((x) => kidChip(x, 'strength'))
    ];
    const SHOWN = 5;
    const pill = (n, tone, label) => (n ? `<span class="gh-pill gh-pill--${tone}" title="${n} ${label}">${n}</span>` : '');
    const lead = c.open.length ? openTone : c.improving.length ? 'better' : 'strength';
    return `
        <li class="gh-tray gh-tray--${lead}${c.kind === 'context' ? ' is-private' : ''}">
            <p class="gh-tray__head">
                <i class="fas ${c.icon}" aria-hidden="true"></i>
                <span class="gh-tray__label" ${c.labelEl ? `title="${esc(c.labelEl)}"` : ''}>${esc(c.label)}</span>
                <span class="gh-tray__counts">${pill(c.open.length, openTone, TONE_WORD[openTone])}${pill(c.improving.length, 'better', 'getting better')}${pill(c.strong.length, 'strength', 'strength')}</span>
            </p>
            <div class="gh-tray__who">${chips.slice(0, SHOWN).join('')}${chips.length > SHOWN ? `<details class="gh-tray__more"><summary>+${chips.length - SHOWN}</summary>${chips.slice(SHOWN).join('')}</details>` : ''}</div>
        </li>`;
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
    const W = 640, H = 420, L = 46, R = 16, T = 18, B = 50;
    const iw = W - L - R, ih = H - T - B;
    const px = (x) => L + x * iw;
    const py = (y) => T + (1 - y) * ih;
    // Spread overlapping dots apart (pure maths in classGreenhouseCore), never onto an axis.
    const pos = spreadDots(g.students.map((r) => ({ x: px(r.map.x), y: py(r.map.y) })), { x0: L + 18, x1: L + iw - 16, y0: T + 16, y1: T + ih - 16 }, 32);
    const spots = g.students.map((r, i) => ({ r, x: pos[i].x, y: pos[i].y }));
    // Put each name where it touches no other dot or name: below, above, right, then left.
    const qw = (t) => t.length * 7.4;
    const axisW = 190;
    const boxes = [ // the quadrant names and the axis labels stay readable too
        { x0: L + 6, x1: L + 10 + qw(PROFILES.roots.label), y0: T + 2, y1: T + 20 },
        { x0: L + iw - 10 - qw(PROFILES.bloom.label), x1: L + iw - 6, y0: T + 2, y1: T + 20 },
        { x0: L + 6, x1: L + 10 + qw(PROFILES.tending.label), y0: T + ih - 22, y1: T + ih - 4 },
        { x0: L + iw - 10 - qw(PROFILES.reaching.label), x1: L + iw - 6, y0: T + ih - 22, y1: T + ih - 4 },
        { x0: L + iw / 2 - axisW / 2, x1: L + iw / 2 + axisW / 2, y0: H - 24, y1: H },
        { x0: 0, x1: 26, y0: T + ih / 2 - 70, y1: T + ih / 2 + 70 }
    ];
    const hits = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)
        || spots.some((s) => s.x + 13 > b.x0 && s.x - 13 < b.x1 && s.y + 13 > b.y0 && s.y - 13 < b.y1 && !(s.x === b.cx && s.y === b.cy));
    const labels = spots.map(({ r, x, y }) => {
        const w = r.first.length * 6.6 + 4;
        const options = [
            { dx: 0, dy: 27, anchor: 'middle', x0: x - w / 2, x1: x + w / 2, y0: y + 16, y1: y + 30 },
            { dx: 0, dy: -19, anchor: 'middle', x0: x - w / 2, x1: x + w / 2, y0: y - 30, y1: y - 16 },
            { dx: 17, dy: 4, anchor: 'start', x0: x + 15, x1: x + 17 + w, y0: y - 7, y1: y + 7 },
            { dx: -17, dy: 4, anchor: 'end', x0: x - 17 - w, x1: x - 15, y0: y - 7, y1: y + 7 },
        ].map((o) => ({ ...o, cx: x, cy: y }));
        const inside = (o) => o.x0 >= 2 && o.x1 <= W - 2 && o.y0 >= 2 && o.y1 <= H - 26;
        const pick = options.find((o) => !hits(o) && inside(o)) || options.find(inside) || options[1];
        boxes.push(pick);
        return pick;
    });
    const dots = spots.map(({ r, x, y }, index) => {
        const lab = labels[index];
        const initials = r.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        const urgent = r.signals.some((s) => s.sev >= 3);
        const wild = r.profile === 'wild';
        return `
            <g class="gh-dot gh-tone--${PROFILE_TONE[r.profile]}${r.map.achKnown ? '' : ' is-unknown'}${urgent ? ' is-urgent' : ''}${wild ? ' is-wild' : ''}${r.id === view.spotId ? ' is-spot' : ''}" data-gh-student="${r.id}" role="button" tabindex="0" style="--i:${index}"
                aria-label="${esc(r.name)}: ${PROFILES[r.profile].label}. Open the Hero's Chronicle" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
                ${urgent ? '<circle class="gh-dot__halo" r="19"/>' : ''}
                ${wild ? '<circle class="gh-dot__spark" r="17"/>' : ''}
                ${r.id === view.spotId ? '<circle class="gh-dot__spot" r="24"/>' : ''}
                <circle class="gh-dot__disc" r="13"/>
                <text class="gh-dot__ini" y="4">${esc(initials)}</text>
                <text class="gh-dot__name" x="${lab.dx}" y="${lab.dy}" text-anchor="${lab.anchor}">${esc(r.first)}</text>
                <title>${esc(r.name)} · ${PROFILES[r.profile].label}${r.profileWhy ? ` · ${esc(r.profileWhy)}` : ''}</title>
            </g>`;
    }).join('');
    // Shade the map exactly as the profiles are decided: the middle third is ±0.35 sd on each axis
    // (classGreenhouseCore.mjs#mapScale), so the map is an even 3×3 grid.
    const cut = [0, 1 / 3, 2 / 3, 1];
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
            <path class="gh-map__axis" d="M${L} ${T} V${T + ih} H${L + iw}"/>
            <text class="gh-map__axislabel" x="${L + iw / 2}" y="${H - 10}" text-anchor="middle">Stars a lesson (effort) →</text>
            <text class="gh-map__axislabel" transform="translate(16 ${T + ih / 2}) rotate(-90)" text-anchor="middle">Papers vs class →</text>
            ${dots}
        </svg>`;
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

const NEED_WORDS = { newcomer: 'new to the class', shy: 'shy to speak', worry: 'needs a calm start', support: 'learning support', listening: 'instructions', reading: 'reading' };

/** The rounds that come from what the Chronicle notes say. */
function lessonNotesHtml(p, tick, nameBtn) {
    if (!p.followUps.length && !p.noteGroups.length && !p.buddies.length && !p.keepApart.length && !p.hooks.length) return '';
    return `
        <section class="gh-card gh-card--fromnotes">
            <h3 class="gh-h"><i class="fas fa-book-reader" aria-hidden="true"></i> From your notes</h3>
            <div class="gh-fromnotes">
                ${p.followUps.length ? `<div><h4 class="gh-h4">Follow up</h4><p class="gh-hint">You wrote these down, then nothing more. See how it is going, then add a line in the Chronicle.</p>
                    ${p.followUps.map((f) => tick(`follow-${f.id}`, `${nameBtn(f)} <small>${esc(f.label.toLowerCase())}, ${f.daysAgo} days ago</small><q class="gh-quote">${esc(f.quote)}</q>`)).join('')}</div>` : ''}
                ${p.noteGroups.length ? `<div><h4 class="gh-h4">Small groups, ten minutes with you</h4><p class="gh-hint">Children your notes name for the same skill. While the class works, sit with one group.</p>
                    ${p.noteGroups.map((gr) => tick(`group-${gr.id}`, `<b><i class="fas ${gr.icon}" aria-hidden="true"></i> ${esc(gr.label)}</b> ${gr.members.map((m) => kidChip(m, 'worry')).join('')}${gr.technique ? ` <button type="button" class="gh-chip" data-gh-packet="${gr.technique}">${esc(getTechnique(gr.technique)?.title || '')}</button>` : ''}`)).join('')}</div>` : ''}
                ${p.buddies.length ? `<div><h4 class="gh-h4">Buddies</h4><p class="gh-hint">A kind helper beside a child who needs one, for pair work.</p>
                    ${p.buddies.map((b) => tick(`buddy-${b.child.id}`, `${nameBtn(b.helper)} <i class="fas fa-hands-holding-child" aria-hidden="true"></i> ${nameBtn(b.child)} <small>${esc(b.helper.why.toLowerCase())} · ${esc(NEED_WORDS[b.child.need] || b.child.need)}</small>`)).join('')}</div>` : ''}
                ${p.keepApart.length ? `<div><h4 class="gh-h4">Keep apart</h4><p class="gh-hint">Written about together in rough notes. Seat and pair them apart.</p>
                    ${p.keepApart.map((k) => `<p class="gh-duo gh-duo--apart">${nameBtn(k.a)} <i class="fas fa-arrows-left-right" aria-hidden="true"></i> ${nameBtn(k.b)}</p>`).join('')}</div>` : ''}
                ${p.hooks.length ? `<div><h4 class="gh-h4">Lesson hooks</h4><p class="gh-hint">Passions from your notes. Use them in example sentences and warm-ups.</p>
                    ${p.hooks.map((h) => `<p class="gh-hook"><b>${esc(h.icon || '')} ${esc(h.label)}</b> <small>${esc(h.children.join(', '))}</small>${h.words.length ? `<span class="gh-hook__words">${h.words.map((w) => `<span>${esc(w)}</span>`).join('')}</span>` : ''}</p>`).join('')}</div>` : ''}
            </div>
        </section>`;
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
        ${lessonNotesHtml(p, tick, nameBtn)}
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
            <p class="gh-hint">Stronger papers sit with middle ones, so the gap is small enough to help${p.keepApart.length ? ', and nobody your notes say to keep apart sits together' : ''}. For pair work only.</p>
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
    if (p.followUps.length) lines.push('', 'Follow up:', ...p.followUps.map((f) => `- ${f.first}: ${f.label.toLowerCase()} (${f.daysAgo} days ago)`));
    if (p.noteGroups.length) lines.push('', 'Small groups:', ...p.noteGroups.map((gr) => `- ${gr.label}: ${gr.members.map((m) => m.first).join(', ')}`));
    if (p.buddies.length) lines.push('', 'Buddies:', ...p.buddies.map((b) => `- ${b.helper.first} with ${b.child.first}`));
    if (p.keepApart.length) lines.push('', 'Keep apart:', ...p.keepApart.map((k) => `- ${k.a.first} / ${k.b.first}`));
    if (p.hooks.length) lines.push('', 'Lesson hooks:', ...p.hooks.map((h) => `- ${h.label}: ${h.words.join(', ')}`));
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

// ------------------------------------------------------------------ counsel: the Almanac and the seed shelf

function counselHtml(g) {
    const elite = canUseFeature('eliteAI');
    const asked = view.asked.get(view.classId) || [];
    return `
        <div class="gh-almanac gh-rise" style="--i:0">
            <div class="gh-almanac__mast">
                <p class="gh-almanac__kicker">Elite counsel · written once, shared by every computer in the school</p>
                <h3 class="gh-almanac__title font-title">The Gardener's Almanac</h3>
                <p class="gh-almanac__lede">Advice for the whole class, from its numbers, its signals, the themes of your notes and the plan for the next lesson. It never sees your note text or anything about home or health. For one child, open their Chronicle and ask the Oracle.</p>
            </div>
            <div class="gh-counsels">${ALMANAC_COUNSELS.map((c, k) => `
                <button type="button" class="gh-counsel" data-gh-counsel="${c.id}" style="--k:${k}">
                    <i class="fas ${c.icon}" aria-hidden="true"></i><span class="gh-counsel__name">${c.label}</span><span class="gh-counsel__hint">${c.hint}</span>
                    ${elite ? '' : '<span class="gh-counsel__lock"><i class="fas fa-lock" aria-hidden="true"></i> Elite</span>'}
                </button>`).join('')}
            </div>
            <form class="gh-ask" autocomplete="off">
                <label for="gh-ask-input" class="gh-ask__label"><i class="fas fa-circle-question" aria-hidden="true"></i> Ask about the class</label>
                <div class="gh-ask__row">
                    <input id="gh-ask-input" class="gh-ask__input" type="text" maxlength="300" placeholder="How do I get the quiet ones speaking in pair work?">
                    <button type="submit" class="gh-ask__btn" aria-label="Ask the Almanac"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
                </div>
            </form>
            <div class="gh-almanac__page" aria-live="polite">
                <p class="gh-hint">Choose a counsel or ask a question. A page someone already wrote for this class opens instantly, without asking the AI again.</p>
            </div>
            ${asked.length ? `<div class="gh-asked">${asked.map(askedHtml).join('')}</div>` : ''}
        </div>
        <section class="gh-shelf gh-rise" style="--i:1">${shelfHtml(g)}</section>`;
}

function askedHtml(a) {
    return `<article class="gh-asked__item"><p class="gh-asked__q"><i class="fas fa-circle-question" aria-hidden="true"></i> ${esc(a.question)}</p><div class="gh-almanac__text">${linkNames(oracleMarkdown(a.content))}</div></article>`;
}

function shelfHtml(g) {
    const picked = new Map();
    g.classReading.insights.forEach((i) => i.techniques.forEach((id) => { if (!picked.has(id)) picked.set(id, i.title); }));
    g.plan.focus.forEach((f) => { if (f.technique && !picked.has(f.technique)) picked.set(f.technique, f.first); });
    const pickedList = [...picked.entries()].slice(0, 6).map(([id, because]) => ({ t: getTechnique(id), because })).filter((x) => x.t);
    const shelf = TECHNIQUES.filter((t) => view.areaFilter === 'all' || t.area === view.areaFilter);
    return `
        ${pickedList.length ? `
        <h3 class="gh-h"><i class="fas fa-hand-sparkles" aria-hidden="true"></i> Seed packets picked for this class</h3>
        <div class="gh-packets">${pickedList.map(({ t, because }) => packetHtml(t, because)).join('')}</div>` : ''}
        <details class="gh-more gh-more--shelf"${view.areaFilter !== 'all' ? ' open' : ''}>
            <summary><i class="fas fa-box-archive" aria-hidden="true"></i> The whole seed shelf <b>${TECHNIQUES.length}</b></summary>
            <div class="gh-filters" role="group" aria-label="Shelf">
                <button type="button" class="gh-filter${view.areaFilter === 'all' ? ' is-active' : ''}" data-gh-area="all" aria-pressed="${view.areaFilter === 'all'}">All</button>
                ${PLAYBOOK_AREAS.map((a) => `<button type="button" class="gh-filter gh-area--${a.id}${view.areaFilter === a.id ? ' is-active' : ''}" data-gh-area="${a.id}" aria-pressed="${view.areaFilter === a.id}"><i class="fas ${a.icon}" aria-hidden="true"></i>${a.label}</button>`).join('')}
            </div>
            <div class="gh-packets">${shelf.map((t) => packetHtml(t)).join('')}</div>
        </details>`;
}

function hydrateAlmanac() {
    if (view.almanacLast && view.almanacLast.classId === view.classId) showAlmanacPage(view.almanacLast);
}

/** Same words, same key on every computer: a repeated question opens the stored answer. */
function questionKey(question) {
    const s = String(question || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

async function writeAlmanac(task, closing) {
    const classData = findClass(view.classId);
    const { callGeminiApi } = await import('../../api.js');
    const brief = almanacBrief(view.green, { className: classData?.name || '', level: classData?.questLevel || '' });
    const content = String(await callGeminiApi(
        `${ALMANAC_SYSTEM_PROMPT}\n\n${task}`,
        `Here is the class summary:\n\n${brief}\n\n${closing}`,
        { maxTokens: 1100, timeoutMs: 50000 }
    ) || '').trim();
    if (!content) throw new Error('empty');
    return content;
}

function almanacWait(text, icon = 'fa-book-open') {
    const page = document.querySelector(`#${MODAL_ID} .gh-almanac__page`);
    if (page) page.innerHTML = `<p class="gh-almanac__wait"><span class="gh-almanac__quill" aria-hidden="true"><i class="fas ${icon}"></i></span> ${esc(text)}</p>`;
}

async function askAlmanac(counselId, { fresh = false } = {}) {
    if (!requireEliteAI({ feature: "The Gardener's Almanac" })) return;
    if (view.almanacBusy || !view.green) return;
    const counsel = ALMANAC_COUNSELS.find((c) => c.id === counselId);
    if (!counsel) return;
    const classId = view.classId;
    document.querySelectorAll(`#${MODAL_ID} [data-gh-counsel]`).forEach((b) => b.classList.toggle('is-chosen', b.dataset.ghCounsel === counselId));
    const fingerprint = view.green.fingerprint;
    const ref = counselDocRef(classId, counselId);
    view.almanacBusy = true;
    try {
        if (!fresh) {
            almanacWait('Turning to the right page…');
            const snap = await getDoc(ref).catch(() => null);
            const data = snap?.exists?.() ? snap.data() : null;
            if (data?.content) {
                showAlmanacPage({ classId, counselId, content: data.content, createdAt: data.createdAt, stale: data.fingerprint !== fingerprint });
                return;
            }
        }
        almanacWait('The Almanac is reading the whole class…', 'fa-feather-pointed');
        const content = await writeAlmanac(counsel.task, `Write "${counsel.label}" now.`);
        const createdAt = Date.now();
        await setDoc(ref, {
            type: 'class_greenhouse', classId, counsel: counselId, content, fingerprint, createdAt,
            writtenFor: state.get('currentTeacherName') || ''
        }).catch((e) => console.warn('Almanac page could not be shared:', e?.message));
        if (view.classId === classId) showAlmanacPage({ classId, counselId, content, createdAt, stale: false });
    } catch (err) {
        console.error('Almanac error:', err);
        if (view.classId === classId) almanacWait('The Almanac could not be written right now. Try again in a little while.', 'fa-cloud-bolt');
    } finally {
        view.almanacBusy = false;
    }
}

async function askClassQuestion(question, { fresh = false } = {}) {
    if (!requireEliteAI({ feature: "The Gardener's Almanac" })) return;
    if (view.almanacBusy || !view.green) return;
    const q = String(question || '').trim().slice(0, 300);
    if (!q) return;
    const classId = view.classId;
    const fingerprint = view.green.fingerprint;
    const ref = doc(db, dataPath('daily_cache'), `greenhouse_${classId}_q_${questionKey(q)}`);
    view.almanacBusy = true;
    document.querySelectorAll(`#${MODAL_ID} [data-gh-counsel]`).forEach((b) => b.classList.remove('is-chosen'));
    try {
        let content = null;
        let createdAt = null;
        let stale = false;
        if (!fresh) {
            almanacWait('Looking for an answer someone already has…');
            const snap = await getDoc(ref).catch(() => null);
            const data = snap?.exists?.() ? snap.data() : null;
            if (data?.content) {
                content = data.content;
                createdAt = data.createdAt;
                stale = data.fingerprint !== fingerprint;
            }
        }
        if (!content) {
            almanacWait('The Almanac is thinking about your class…', 'fa-feather-pointed');
            content = await writeAlmanac(almanacQuestionTask(q), 'Answer the question now.');
            createdAt = Date.now();
            await setDoc(ref, {
                type: 'class_greenhouse', classId, counsel: 'question', question: q, content, fingerprint, createdAt,
                writtenFor: state.get('currentTeacherName') || ''
            }).catch((e) => console.warn('Almanac answer could not be shared:', e?.message));
        }
        const list = (view.asked.get(classId) || []).filter((a) => a.question !== q);
        list.unshift({ question: q, content, createdAt });
        view.asked.set(classId, list.slice(0, 4));
        if (view.classId === classId) showAlmanacPage({ classId, counselId: 'question', question: q, content, createdAt, stale });
        const input = document.getElementById('gh-ask-input');
        if (input) input.value = '';
    } catch (err) {
        console.error('Almanac question error:', err);
        if (view.classId === classId) almanacWait('The Almanac could not answer right now. Try again in a little while.', 'fa-cloud-bolt');
    } finally {
        view.almanacBusy = false;
    }
}

function showAlmanacPage({ classId, counselId, question = '', content, createdAt, stale }) {
    view.almanacLast = { classId, counselId, question, content, createdAt, stale };
    const page = document.querySelector(`#${MODAL_ID} .gh-almanac__page`);
    if (!page || view.tab !== 'counsel' || classId !== view.classId) return;
    const counsel = ALMANAC_COUNSELS.find((c) => c.id === counselId);
    document.querySelectorAll(`#${MODAL_ID} [data-gh-counsel]`).forEach((b) => b.classList.toggle('is-chosen', b.dataset.ghCounsel === counselId));
    const when = createdAt ? new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
    const title = counsel ? counsel.label : `“${question}”`;
    const freshBtn = counsel
        ? `<button type="button" class="gh-btn" data-gh-counsel="${counselId}" data-gh-fresh="1"><i class="fas fa-rotate" aria-hidden="true"></i> Write a fresh page</button>`
        : `<button type="button" class="gh-btn" data-gh-question-fresh="${esc(question)}"><i class="fas fa-rotate" aria-hidden="true"></i> Answer it again</button>`;
    page.innerHTML = `
        <article class="gh-almanac__entry">
            <p class="gh-almanac__dateline">${esc(title)}${when ? ` · written ${when}` : ''}</p>
            <div class="gh-almanac__text">${linkNames(oracleMarkdown(content))}</div>
            ${stale ? `<div class="gh-almanac__stale"><p>New records have come in since this page was written.</p>${freshBtn}</div>` : ''}
            <p class="gh-almanac__tip"><i class="fas fa-book-open" aria-hidden="true"></i> Tap a name to open that hero's Chronicle.</p>
        </article>`;
}

// ------------------------------------------------------------------ seed packets

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

function counselDocRef(classId, counselId) {
    return doc(db, dataPath('daily_cache'), `greenhouse_${classId}_${counselId}`);
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

function ivySvg() {
    const leaf = (x, y, r) => `<path class="gh-ivy__leaf" transform="translate(${x} ${y}) rotate(${r})" d="M0 0 C6 -6 12 -2 10 6 C6 10 2 8 0 0 Z"/>`;
    return `<path class="gh-ivy__vine" d="M4 0 C20 30 6 60 26 88 S30 120 46 128"/>
        ${leaf(10, 18, 10)}${leaf(16, 38, 140)}${leaf(12, 58, 20)}${leaf(24, 80, 150)}${leaf(30, 100, 30)}${leaf(40, 120, 160)}`;
}
