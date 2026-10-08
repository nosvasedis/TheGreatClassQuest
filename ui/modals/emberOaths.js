// /ui/modals/emberOaths.js — Ember Oaths board (lazy). One modal under a night sky, four quick views:
// the class board (what needs you tonight first), the choosing ceremony (one tap per child, auto-advance),
// a promise's story (check-in, one-tap moments, keep), and the kept-promise celebration.
import '../../features/campfire/emberOaths.css';
import * as state from '../../state.js';
import { db, doc, updateDoc } from '../../firebase.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getLocalIsoDateString as isoToday } from '../../utils.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { getLeagueBand } from '../../features/languageScaffolds.mjs';
import { suggestOaths, buildOathSuggestions, oathTemplates, evaluateOathEvidence, oathDate, CATEGORY_META, QUICK_MOMENTS, CLASS_PROMISES, nextChildWithoutOath } from '../../features/emberOathCore.mjs';
import { emberSigns, LENS_KINDS, matchesLens } from '../../features/oathSuggestCore.mjs';
import { INTERESTS, SPIRITS, oathTitle, spiritForKey, detectInterests } from '../../features/oathForge.mjs';
import { cleanCampfireText } from '../../features/heroCampfireCore.mjs';
import { getGuildById } from '../../features/guilds.js';
import * as oathActions from '../../db/actions/emberOaths.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';
const { loadEmberOaths } = oathActions;
import { showAnimatedModal, hideModal, showModal } from './base.js';
import { showToast } from '../effects.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';

const MODAL_ID = 'ember-oaths-modal';
const MOODS = [['flame', '🔥', 'Tried it'], ['candle', '🕯️', 'Growing'], ['moon', '🌙', 'Quiet day']];
const FEELINGS = [['🌱', 'Growing'], ['✨', 'Proud'], ['💪', 'Stronger'], ['😊', 'Happy']];
const EVIDENCE_ICON = { virtue: '⭐', practice: '📜', quiz: '❓', manual: '✍️' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const prettyDate = iso => { const d = new Date(String(iso) + 'T12:00:00'); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const HUES = ['#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#ec4899', '#f59e0b', '#6366f1', '#14b8a6'];
const FLAME = '<svg class="eo-flame" viewBox="0 0 48 64" aria-hidden="true"><path class="eo-flame__outer" d="M25 1C38 20 47 29 43 43 39 60 13 65 5 47-2 30 16 23 16 12c6 5 8 9 7 14C30 17 30 9 25 1Z"/><path class="eo-flame__mid" d="M25 20c10 13 14 20 9 29-5 10-20 9-23-1-3-11 9-17 10-23l4 10c4-5 3-9 0-15Z"/><path class="eo-flame__core" d="M24 37c4 7 10 11 5 16-5 6-13 1-11-5 1-4 5-6 6-11Z"/></svg>';

/** Days between two ISO dates (b − a). */
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
/** A promise's time, told gently: never a countdown that shames. */
function dueLabel(oath) {
    const d = daysBetween(isoToday(), oath.dueDate);
    if (!Number.isFinite(d)) return '';
    if (d > 1) return d + ' days left';
    if (d === 1) return 'Last day tomorrow';
    if (d === 0) return 'Last day today';
    return 'Time to keep it or choose anew';
}

function avatarHtml(student, size = 'md') {
    const guild = getGuildById(student?.guildId);
    const hue = guild?.primary || HUES[[...String(student?.name || '?')].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
    const inner = student?.avatar ? '<img src="' + esc(student.avatar) + '" alt="" loading="lazy">' : '<span>' + esc((student?.name || '?').charAt(0).toUpperCase()) + '</span>';
    return '<span class="eo-avatar eo-avatar--' + size + '" style="--ring:' + esc(hue) + '">' + inner + '</span>';
}
function categoryChip(category) {
    const meta = CATEGORY_META[category] || { icon: '✨', label: 'Promise', hue: 'amber' };
    return '<span class="eo-chip eo-chip--' + meta.hue + '"><span aria-hidden="true">' + meta.icon + '</span>' + esc(meta.label) + '</span>';
}
/** The poetic name and spirit of a stored promise (derived from its template, so nothing new is stored). */
function oathName(oath) {
    const key = String(oath?.templateId || '').replace(/^(early|junior|mid|upper|exam)_/, '');
    return { title: oath?.templateId === 'custom' ? 'In Their Own Words' : oathTitle({ templateId: oath?.templateId, category: oath?.category, text: oath?.text, target: oath?.target, seed: oath?.studentId }),
        spirit: oath?.templateId === 'custom' ? 'own' : spiritForKey(key) };
}
const OWN_SPIRIT = { icon: '✏️', label: 'Their words', hint: 'Exactly what the child said', tone: 'slate' };
function spiritRibbon(spirit) {
    const meta = SPIRITS[spirit] || OWN_SPIRIT;
    return '<span class="eo-ribbon eo-ribbon--' + meta.tone + '" title="' + esc(meta.hint) + '"><span aria-hidden="true">' + meta.icon + '</span>' + esc(meta.label) + '</span>';
}
function emberRow(count, target, big = false) {
    const total = Math.max(1, Math.min(12, target));
    return '<span class="eo-embers' + (big ? ' is-big' : '') + '" role="img" aria-label="' + Math.min(count, total) + ' of ' + total + ' moments">' +
        Array.from({ length: total }, (_, i) => '<i class="' + (i < count ? 'is-lit' : '') + '" style="--i:' + i + '"></i>').join('') + '</span>';
}
/** The header's ring: how much of the class is growing a promise. */
function ringHtml(part, whole) {
    const r = 21, c = 2 * Math.PI * r, p = whole ? part / whole : 0;
    return '<span class="eo-ring" role="img" aria-label="' + part + ' of ' + whole + ' heroes have a promise"><svg viewBox="0 0 52 52" aria-hidden="true"><circle class="eo-ring__track" cx="26" cy="26" r="' + r + '"/>' +
        '<circle class="eo-ring__fill" cx="26" cy="26" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '"/></svg><b>' + part + '<small>/' + whole + '</small></b></span>';
}

// ─── Modal shell (built once, animated like every other app modal) ────────────
function ensureShell() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-3 sm:p-5 hidden backdrop-blur-md';
    modal.innerHTML = '<div class="eo-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="eo-title">' +
        '<header class="eo-head"><span class="eo-sky" aria-hidden="true"><span class="eo-stars"></span><span class="eo-moon"></span><span class="eo-hills"></span><span class="eo-glow"></span></span>' +
        '<span class="eo-floaters" aria-hidden="true">' + Array.from({ length: 9 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</span>' +
        '<div class="eo-head-main"><span class="eo-hearth" aria-hidden="true">' + FLAME + '<span class="eo-hearth__logs"></span></span><div><p class="eo-head-eyebrow">Ember Oaths</p><h2 id="eo-title" class="font-title"></h2><p class="eo-head-sub"></p></div></div>' +
        '<div class="eo-head-side"><div class="eo-stats"></div>' +
        '<button type="button" class="eo-icon-btn" data-close aria-label="Close"><i class="fas fa-times"></i></button></div>' +
        '</header>' +
        '<div class="eo-view" aria-live="polite"></div><p class="eo-error" role="alert" hidden></p></div>';
    document.body.append(modal);
    return modal;
}

let session = null; // the one open board

export async function openOathBoard(classId, { checkInOnly = false, studentId = null, preview = null } = {}) {
    // `preview` (campfire-preview.html only) swaps Firestore for an in-memory api.
    const api = preview?.api || oathActions;
    api.oathContext();
    const c = state.get('allTeachersClasses').find(item => item.id === classId);
    if (!c) throw new Error('Choose your class first.');
    session?.dispose();
    const modal = ensureShell();
    const shell = modal.querySelector('.eo-shell'), view = modal.querySelector('.eo-view'), error = modal.querySelector('.eo-error');
    const band = getLeagueBand(c.questLevel), early = band === 'early';
    const roster = state.get('allStudents').filter(s => s.classId === classId && (!studentId || s.id === studentId))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const facts = new Map();
    let stop = () => {};
    let local = [], screen = 'board', busy = false, closed = false, focusId = null, choosing = null, filter = 'all';
    const previousFocus = document.activeElement;

    modal.querySelector('#eo-title').textContent = c.name;
    modal.querySelector('.eo-head-sub').textContent = checkInOnly ? 'Campfire check-ins' : 'Small promises, steady growth';
    shell.dataset.band = band;
    // Weak laptops keep the look and lose the endless loops (flicker, floating embers, glowing pulses).
    shell.classList.toggle('is-lite', (() => { try { return detectLowPowerTier(); } catch { return false; } })());

    const activeFor = id => local.find(o => o.studentId === id && o.status === 'active');
    const keptFor = id => local.filter(o => o.studentId === id && o.status === 'kept');
    const resultFor = oath => evaluateOathEvidence(oath, facts.get(oath.id) || { awards: state.get('allAwardLogs'), writtenScores: state.get('allWrittenScores'), today: isoToday() });
    const checkedToday = oath => (oath.checkIns || []).some(ci => ci.date === isoToday());
    const campfire = () => import('../../features/campfire/campfireService.js').then(m => m.getCachedCampfire(classId)).catch(() => null);
    // The live award listener only holds this month's stars. A virtue promise begun last month (or a quiz
    // promise) reads its full window once, so the board, the story and the Campfire agree on "ready".
    const monthStart = isoToday().slice(0, 8) + '01';
    async function hydrateFacts() {
        const stale = local.filter(o => o.status === 'active' && !facts.has(o.id) && (o.evidenceRule === 'quiz' || (o.evidenceRule === 'virtue' && o.startDate < monthStart)));
        if (!stale.length) return;
        await Promise.all(stale.map(o => api.getOathFacts(o).then(f => { facts.set(o.id, f); }).catch(() => {})));
        if (closed) return;
        if (!busy && screen === 'board') renderBoard(); else renderStats();
    }

    function renderStats() {
        const growing = roster.filter(s => activeFor(s.id)).length;
        const ready = roster.filter(s => { const o = activeFor(s.id); return o && resultFor(o).ready; }).length;
        const kept = local.filter(o => o.status === 'kept').length;
        modal.querySelector('.eo-stats').innerHTML = ringHtml(growing, roster.length) +
            '<span class="eo-stat-stack"><span class="eo-stat"><span aria-hidden="true">⭐</span><b>' + kept + '</b> kept</span>' +
            (ready ? '<span class="eo-stat is-ready"><span aria-hidden="true">✨</span><b>' + ready + '</b> ready</span>' : '') + '</span>';
    }
    function setView(html, name) {
        screen = name; view.innerHTML = html; view.scrollTop = 0;
        view.classList.remove('is-entering'); void view.offsetWidth; view.classList.add('is-entering');
        shell.dataset.screen = name;
        renderStats();
    }
    async function work(fn) {
        if (busy || closed) return;
        busy = true; shell.setAttribute('aria-busy', 'true'); error.hidden = true;
        try { await fn(); }
        catch (e) { if (!closed) { error.textContent = e.message || 'Could not save this change. Please try again.'; error.hidden = false; } }
        finally { busy = false; shell.removeAttribute('aria-busy'); }
    }

    // ─── Board ────────────────────────────────────────────────────────────────
    function moodButtons(oath, big = false) {
        const selected = oath.checkIns?.find(ci => ci.date === isoToday())?.mood;
        return '<div class="eo-moods' + (big ? ' is-big' : '') + (selected ? ' is-done' : '') + '" role="group" aria-label="Today’s check-in">' + MOODS.map(([m, icon, label]) =>
            '<button type="button" data-check="' + esc(oath.id) + '" data-mood="' + m + '" aria-pressed="' + (selected === m) + '" title="' + label + '"><span aria-hidden="true">' + icon + '</span><small>' + label + '</small></button>').join('') + '</div>';
    }
    function studentCard(student, i) {
        const oath = activeFor(student.id), kept = keptFor(student.id).length;
        const keptBadge = kept ? '<span class="eo-kept-badge" title="' + kept + ' kept">⭐' + (kept > 1 ? kept : '') + '</span>' : '';
        if (!oath) {
            return '<article class="eo-card is-empty" style="--i:' + i + '"><div class="eo-card-top"><span class="eo-avatar-wrap">' + avatarHtml(student) + keptBadge + '</span><div class="eo-card-name"><h3>' + esc(student.name) + '</h3><span class="eo-muted">' + (kept ? 'Ready for a new promise' : 'No promise yet') + '</span></div></div>' +
                (checkInOnly ? '' : '<button type="button" class="eo-choose-btn" data-choose="' + esc(student.id) + '"><span aria-hidden="true">✨</span> Choose a promise</button>') + '</article>';
        }
        const r = resultFor(oath), meta = CATEGORY_META[oath.category] || CATEGORY_META.virtue;
        const due = daysBetween(isoToday(), oath.dueDate);
        return '<article class="eo-card eo-card--' + meta.hue + (r.ready ? ' is-ready' : '') + '" style="--i:' + i + '">' +
            (r.ready ? '<span class="eo-ready-flag">✨ Ready to keep</span>' : '') +
            '<button type="button" class="eo-card-open" data-open="' + esc(oath.id) + '" aria-label="Open ' + esc(student.name) + '’s promise"></button>' +
            '<div class="eo-card-top"><span class="eo-avatar-wrap">' + avatarHtml(student) + keptBadge + '</span>' + '<div class="eo-card-name"><h3>' + esc(student.name) + '</h3>' + categoryChip(oath.category) + '</div></div>' +
            '<p class="eo-card-title">' + esc(oathName(oath).title) + '</p><p class="eo-card-oath">' + esc(oath.text) + '</p>' +
            '<div class="eo-card-progress">' + emberRow(r.count, r.target) + '<span class="eo-card-due' + (due <= 1 ? ' is-soon' : '') + '">' + esc(dueLabel(oath)) + '</span></div>' +
            moodButtons(oath) + '</article>';
    }
    function classPromiseBlock() {
        const current = c.classOath?.text || '';
        const custom = current && !CLASS_PROMISES.some(p => p.text === current);
        return '<section class="eo-promise"><div class="eo-promise-title"><span aria-hidden="true">🤝</span><div><h3 class="font-title">Our Class Promise</h3><p>Little ones share one promise at the Campfire: no names, no numbers.</p></div></div>' +
            '<div class="eo-promise-options">' + CLASS_PROMISES.map(p => '<button type="button" data-promise="' + esc(p.text) + '" aria-pressed="' + (current === p.text) + '"><span aria-hidden="true">' + p.icon + '</span>' + esc(p.text) + '</button>').join('') +
            '<button type="button" data-promise-custom aria-pressed="' + Boolean(custom) + '"><span aria-hidden="true">✏️</span>' + esc(custom ? current : 'Our own words…') + '</button></div>' +
            '<form class="eo-promise-form" hidden><input maxlength="200" placeholder="We…" aria-label="Our own class promise" value="' + esc(custom ? current : '') + '"><button class="eo-primary is-small">Save</button></form></section>';
    }
    /** Ready first, then promises still waiting for today's check-in, then the rest; children without one last. */
    function boardOrder(list) {
        const rank = s => { const o = activeFor(s.id); if (!o) return 3; if (resultFor(o).ready) return 0; return checkedToday(o) ? 2 : 1; };
        return [...list].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
    }
    /** "Tonight": the next useful thing, one tap away. */
    function focusBar(waiting, ready, toCheck) {
        const items = [];
        if (ready.length) items.push('<button type="button" class="eo-focus eo-focus--ready" data-open="' + esc(activeFor(ready[0].id).id) + '"><span class="eo-focus-icon" aria-hidden="true">⭐</span><span><b>' + (ready.length === 1 ? esc(ready[0].name) + '’s promise is ready' : ready.length + ' promises are ready') + '</b><small>Keep it and a Star-Ember rises</small></span></button>');
        if (toCheck.length && !early) items.push('<button type="button" class="eo-focus eo-focus--check" data-filter="check"><span class="eo-focus-icon" aria-hidden="true">🔥</span><span><b>' + toCheck.length + ' to check in today</b><small>Tried it, growing or a quiet day</small></span></button>');
        if (waiting.length && !checkInOnly) items.push('<button type="button" class="eo-focus eo-focus--ceremony" data-ceremony><span class="eo-focus-icon" aria-hidden="true">✨</span><span><b>Choosing ceremony · ' + waiting.length + '</b><small>' + (waiting.length === 1 ? esc(waiting[0].name) + ' needs a promise' : waiting.length + ' heroes need a promise') + '</small></span></button>');
        if (!items.length && roster.length) items.push('<div class="eo-focus eo-focus--calm"><span class="eo-focus-icon" aria-hidden="true">🌙</span><span><b>All tended for today</b><small>Every promise has its check-in. The embers rest.</small></span></div>');
        return items.length ? '<div class="eo-focus-row">' + items.join('') + '</div>' : '';
    }
    function renderBoard() {
        if (closed) return;
        const waiting = roster.filter(s => !activeFor(s.id));
        const ready = roster.filter(s => { const o = activeFor(s.id); return o && resultFor(o).ready; });
        const toCheck = roster.filter(s => { const o = activeFor(s.id); return o && !checkedToday(o); });
        if (filter === 'check' && !toCheck.length) filter = 'all';
        const shown = boardOrder(filter === 'waiting' ? waiting : filter === 'ready' ? ready : filter === 'check' ? toCheck : roster);
        const tabs = [['all', 'Everyone', roster.length], ['check', 'Check in', toCheck.length], ['waiting', 'Need a promise', waiting.length], ['ready', 'Ready to keep', ready.length]]
            .filter(([key, , n]) => key === 'all' || n || filter === key);
        const empty = filter === 'ready' ? ['🌙', 'No promise is ready yet. Embers grow with every moment.'] : filter === 'waiting' ? ['🌟', 'Every hero has a promise.'] : ['🌱', 'No students in this class yet.'];
        setView((early && !studentId ? classPromiseBlock() + '<h3 class="eo-section-title font-title">Personal promises <small>optional · never shown on the projector</small></h3>' : '') +
            focusBar(waiting, ready, toCheck) +
            '<div class="eo-toolbar"><div class="eo-tabs" role="tablist">' + tabs.map(([key, label, n]) =>
                '<button type="button" role="tab" data-filter="' + key + '" aria-selected="' + (filter === key) + '">' + label + ' <b>' + n + '</b></button>').join('') + '</div></div>' +
            (shown.length ? '<div class="eo-grid">' + shown.map(studentCard).join('') + '</div>'
                : '<div class="eo-empty-state"><span aria-hidden="true">' + empty[0] + '</span><p>' + empty[1] + '</p></div>'), 'board');
    }

    // ─── Choosing ceremony ──────────────────────────────────────────────────────
    let ceremony = false;
    /** Everything the app knows about this child, for personalised suggestions. */
    function profileFor(student, quiz, fire) {
        const monthStars = id => state.get('allAwardLogs').filter(x => x.studentId === id).reduce((n, x) => n + (Number(x.stars) || 0), 0);
        const classStars = roster.map(r => monthStars(r.id)).sort((x, y) => x - y);
        const median = classStars.length ? classStars[Math.floor(classStars.length / 2)] : null;
        const written = state.get('allWrittenScores').filter(w => w.studentId === student.id)
            .map(w => ({ type: w.type, date: oathDate(w.date), percent: getNormalizedPercentForScore(w, c) }))
            .sort((x, y) => String(x.date).localeCompare(String(y.date)));
        const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        const absences = (state.get('allAttendanceRecords') || []).filter(r => r.studentId === student.id && oathDate(r.date) >= monthAgo).length;
        const story = (state.get('currentStoryData') || {})[classId] || null;
        const lesson = fire?.script?.lessonTarget || null;
        const vaultWords = (state.get('allQuestEvents') || [])
            .filter(e => e.classId === classId && /vocab|vault/i.test(String(e.type || '') + ' ' + String(e.label || '')))
            .reduce((n, e) => n + (Number(e.progress?.count ?? e.count) || 0), 0);
        // The teacher's own Chronicle notes (newest first) reveal passions and needs; they never leave this laptop.
        const notes = (state.get('allHeroChronicleNotes') || []).filter(n => n.studentId === student.id)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 30)
            .map(n => ({ text: n.noteText || n.text || '', category: n.category || '' }));
        return {
            league: c.questLevel, seed: student.id, name: student.name, heroClass: student.heroClass,
            awards: state.get('allAwardLogs').filter(x => x.studentId === student.id), writtenScores: written,
            quiz: quiz?.results?.studentPerformance?.[student.id] || null, absences,
            questionStats: quiz?.results?.questionStats || [],
            studentStars: monthStars(student.id), classStarMedian: median,
            words: fire?.script?.words || [], theme: lesson?.theme || lesson?.bigQuestion || '',
            bigQuestion: lesson?.bigQuestion || '', grammar: lesson?.grammar || '',
            bookTitle: String(lesson?.summary || '').split('·')[0].trim().slice(0, 40), unit: lesson?.unit || null,
            bookKind: lesson?.bookKind || (lesson?.summary && /grammar/i.test(String(lesson.summary)) ? 'grammar' : 'coursebook'),
            storyWord: story?.currentWord || '', vaultWords, day: isoToday(),
            guildName: getGuildById(student.guildId)?.name || '', birthday: student.birthday || '', notes,
            liveInterests: [...(student.oathInterests || [])],
            classActiveKeys: local.filter(o => o.status === 'active' && o.studentId !== student.id).map(o => String(o.templateId || '').replace(/^(early|junior|mid|upper|exam)_/, '')),
            previousOaths: local.filter(o => o.studentId === student.id)
        };
    }
    const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'this hero';
    /** Rebuild the whole spectrum (after a passion is tapped) and deal the current page. */
    function deal() {
        choosing.profile.liveInterests = [...choosing.loves];
        choosing.all = buildOathSuggestions(choosing.profile);
        if (choosing.lens && !choosing.all.some(x => matchesLens(x, choosing.lens))) choosing.lens = '';
        choosing.suggestions = suggestOaths(choosing.profile, { offset: choosing.offset, lens: choosing.lens, all: choosing.all });
    }
    function oathCardHtml(t, i) {
        const meta = CATEGORY_META[t.category] || { icon: '✨', label: 'Promise', hue: 'amber' };
        const n = Math.max(1, Math.min(6, Number(t.target?.count) || 1)), weeks = Number(t.weeks) || 1;
        return '<button type="button" class="eo-oath eo-oath--' + meta.hue + '" data-pick="' + i + '" style="--i:' + i + '" aria-pressed="' + (choosing.selected === i) + '">' +
            spiritRibbon(t.spirit) + '<span class="eo-oath-seal" aria-hidden="true"><span>' + meta.icon + '</span></span>' +
            '<span class="eo-oath-title">' + esc(t.title || meta.label) + '</span>' +
            '<span class="eo-oath-text font-title">' + esc(t.text) + '</span>' +
            '<span class="eo-oath-why"><span aria-hidden="true">💡</span>' + esc(t.why || '') + '</span>' +
            '<span class="eo-oath-foot"><span class="eo-oath-kind">' + esc(meta.label) + '</span><span class="eo-oath-measure" title="' + n + ' moment' + (n > 1 ? 's' : '') + ' and one 🔥 check-in">' +
                '<span class="eo-oath-dots" aria-hidden="true">' + '<i></i>'.repeat(n) + '</span>' + n + (n > 1 ? ' moments' : ' moment') + ' · ' + weeks + (weeks > 1 ? ' weeks' : ' week') + '</span></span>' +
            '<span class="eo-option-check" aria-hidden="true">✓</span></button>';
    }
    function optionsHtml() {
        return choosing.suggestions.map(oathCardHtml).join('') +
            '<button type="button" class="eo-oath eo-oath--own" data-pick="own" style="--i:3" aria-pressed="' + (choosing.selected === 'own') + '">' + spiritRibbon('own') +
            '<span class="eo-oath-seal" aria-hidden="true"><span>✏️</span></span><span class="eo-oath-title">In Their Own Words</span>' +
            '<span class="eo-oath-text font-title">Something else…</span><span class="eo-oath-why"><span aria-hidden="true">🗣️</span>Write exactly what the child says.</span><span class="eo-option-check" aria-hidden="true">✓</span></button>';
    }
    function lensesHtml() {
        const all = choosing.all, first = firstName(choosing.student.name);
        const kinds = LENS_KINDS.map(k => [k, CATEGORY_META[k].icon, CATEGORY_META[k].label === 'Reading & listening' ? 'Reading' : CATEGORY_META[k].label === 'Hero virtue' ? 'Heart' : CATEGORY_META[k].label, all.filter(x => x.category === k).length]).filter(x => x[3]);
        const spirits = ['passion', 'ladder', 'hero', 'gift', 'bridge', 'quest', 'season', 'home'].map(k => ['spirit:' + k, SPIRITS[k].icon, SPIRITS[k].label, all.filter(x => x.spirit === k).length]).filter(x => x[3]);
        const chip = ([key, icon, label, n]) => '<button type="button" class="eo-lens" data-lens="' + esc(key) + '" aria-pressed="' + (choosing.lens === key) + '"><span aria-hidden="true">' + icon + '</span>' + esc(label) + (n != null ? '<b>' + n + '</b>' : '') + '</button>';
        const passions = INTERESTS.filter(x => all.some(o => o.interest === x.id)).map(x => ['interest:' + x.id, x.icon, x.label.split(' & ')[0], all.filter(o => o.interest === x.id).length]);
        return chip(['', '✨', 'Best for ' + first, null]) + (passions.length ? '<span class="eo-lens-sep" aria-hidden="true"></span>' + passions.map(chip).join('') : '') +
            '<span class="eo-lens-sep" aria-hidden="true"></span>' + kinds.map(chip).join('') + '<span class="eo-lens-sep" aria-hidden="true"></span>' + spirits.map(chip).join('');
    }
    function lovesHtml() {
        const fromNotes = new Set(detectInterests(choosing.profile.notes));
        const on = id => choosing.loves.has(id) || fromNotes.has(id);
        const ordered = [...INTERESTS].sort((a, b) => Number(on(b.id)) - Number(on(a.id)));
        const shown = choosing.lovesOpen ? ordered : ordered.slice(0, Math.max(8, ordered.filter(x => on(x.id)).length));
        return shown.map(x => '<button type="button" class="eo-love' + (fromNotes.has(x.id) ? ' is-noted' : '') + '" data-love="' + x.id + '" aria-pressed="' + on(x.id) + '" title="' + esc(fromNotes.has(x.id) ? x.label + ' · from your Chronicle notes' : x.label) + '"><span aria-hidden="true">' + x.icon + '</span>' + esc(x.label) + '</button>').join('') +
            (choosing.lovesOpen ? '' : '<button type="button" class="eo-love is-more" data-loves-more><span aria-hidden="true">＋</span>More passions</button>');
    }
    function readingHtml(student) {
        const signs = emberSigns(choosing.profile);
        const kept = keptFor(student.id).length;
        const guild = getGuildById(student.guildId);
        return '<aside class="eo-reading" aria-label="What the embers know about ' + esc(student.name) + '">' +
            '<div class="eo-reading-hero"><span class="eo-reading-ring" aria-hidden="true">' + Array.from({ length: 12 }, (_, i) => '<i style="--i:' + i + '"' + (i < kept * 3 ? ' class="is-lit"' : '') + '></i>').join('') + '</span>' + avatarHtml(student, 'xl') + '</div>' +
            '<h3 class="font-title">' + esc(student.name) + '</h3>' +
            '<p class="eo-reading-sub">' + [student.heroClass, guild?.name].filter(Boolean).map(esc).join(' · ') + (kept ? (student.heroClass || guild ? ' · ' : '') + '⭐ ' + kept + ' kept' : '') + '</p>' +
            '<details class="eo-signs-box"' + (matchMedia('(max-width: 640px)').matches ? '' : ' open') + '><summary><span>What the embers know</span><small>for your eyes</small></summary><div class="eo-signs">' +
                (signs.length ? signs.map(x => '<span class="eo-sign eo-sign--' + x.tone + '" title="' + esc(x.hint) + '"><span aria-hidden="true">' + x.icon + '</span>' + esc(x.label) + '</span>').join('') : '<span class="eo-muted">Little is known yet. The ideas start broad.</span>') +
            '</div></details>' +
            '<div class="eo-loves-box"><p class="eo-loves-title">What does ' + esc(firstName(student.name)) + ' love?</p><p class="eo-loves-hint">Ask them. Each tap forges promises from it.</p><div class="eo-loves">' + lovesHtml() + '</div></div>' +
            '</aside>';
    }
    function refreshAltar({ shuffle = false } = {}) {
        const box = view.querySelector('.eo-options'); if (!box || !choosing) return;
        box.innerHTML = optionsHtml();
        if (shuffle) { box.classList.remove('is-shuffling'); void box.offsetWidth; box.classList.add('is-shuffling'); }
        const lenses = view.querySelector('.eo-lenses');
        if (lenses) {
            lenses.innerHTML = lensesHtml();
            const on = lenses.querySelector('[aria-pressed="true"]');
            if (on) lenses.scrollLeft = Math.max(0, on.offsetLeft - (lenses.clientWidth - on.offsetWidth) / 2); // keep the chosen lens in sight
        }
        const loves = view.querySelector('.eo-loves'); if (loves) loves.innerHTML = lovesHtml();
        const count = view.querySelector('[data-forge-count]'); if (count) count.textContent = String(choosing.all.length);
        const own = view.querySelector('.eo-own'); if (own) own.hidden = choosing.selected !== 'own' && !choosing.editing;
        syncAdjust(); refreshCommit();
    }
    function syncAdjust() {
        const adjust = view.querySelector('[data-adjust]');
        if (adjust) adjust.hidden = typeof choosing?.selected !== 'number' || choosing.editing;
    }
    async function choose(id, { fromCeremony = ceremony } = {}) {
        const student = roster.find(r => r.id === id); if (!student) return;
        ceremony = fromCeremony;
        const [quiz, fire] = await Promise.all([
            canUseFeature('quizOfTheWeek') ? import('../../db/actions/quizOfTheWeek.js').then(m => m.getQuizForClass(classId)).catch(() => null) : null,
            campfire()
        ]);
        const profile = profileFor(student, quiz, fire);
        choosing = { id, student, profile, offset: 0, lens: '', selected: null, editing: false, loves: new Set(student.oathInterests || []), lovesOpen: false, all: [], suggestions: [] };
        deal();
        const first = firstName(student.name);
        setView('<div class="eo-choose eo-forge">' +
            '<span class="eo-forge-embers" aria-hidden="true">' + Array.from({ length: 14 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</span>' +
            '<div class="eo-choose-top"><button type="button" class="eo-back" data-back>← Board</button>' + (ceremony ? ceremonyStrip(id) : '') + '</div>' +
            '<div class="eo-forge-grid">' + readingHtml(student) +
            '<section class="eo-altar"><div class="eo-altar-head"><p class="eo-altar-eyebrow">The Oath Fire</p><h3 class="font-title">Which promise will ' + esc(first) + ' choose?</h3><p>Read them aloud. Let ' + esc(first) + ' pick, or say it in their own words.</p></div>' +
            '<div class="eo-lenses" role="group" aria-label="Look through">' + lensesHtml() + '</div>' +
            '<div class="eo-options">' + optionsHtml() + '</div>' +
            '<label class="eo-own" hidden><span>Their promise, in their words</span><input type="text" maxlength="200" placeholder="I will…"></label>' +
            '<div class="eo-choose-more"><button type="button" class="eo-more" data-more><span aria-hidden="true">🔄</span> Deal three more</button>' +
            '<button type="button" class="eo-more is-soft" data-adjust hidden><span aria-hidden="true">✏️</span> Change the words</button>' +
            (canUseFeature('eliteAI') ? '<button type="button" class="eo-oracle" data-oracle><span aria-hidden="true">🔮</span> Ask the Oracle</button>' : '') +
            '<span class="eo-forge-count"><b data-forge-count>' + choosing.all.length + '</b> promises forged for ' + esc(first) + '</span></div>' +
            '<div class="eo-choose-actions"><button type="button" class="eo-quiet" data-skip-child>' + (ceremony ? 'Skip for now' : 'Cancel') + '</button><button type="button" class="eo-primary" data-commit disabled><span aria-hidden="true">🔥</span> Light this promise</button></div>' +
            '</section></div></div>', 'choose');
    }
    function selectedTemplate() {
        if (!choosing) return null;
        const typed = cleanCampfireText(view.querySelector('.eo-own input')?.value || '', 200);
        if (choosing.selected === 'own') {
            if (!typed) return null;
            return { ...oathTemplates(c.questLevel)[4], id: 'custom', category: 'habit', text: typed, evidenceRule: 'manual', target: { kind: 'manual', count: 2 } };
        }
        const picked = choosing.suggestions[choosing.selected];
        if (!picked) return null;
        return choosing.editing ? (typed ? { ...picked, text: typed } : null) : picked;
    }
    function refreshCommit() {
        const btn = view.querySelector('[data-commit]');
        if (btn) btn.disabled = !selectedTemplate();
    }
    async function commitChoice() {
        const template = selectedTemplate(); if (!template) return;
        const studentIdNow = choosing.id;
        const oath = await api.createEmberOath(template, { studentId: studentIdNow, classId, text: template.text });
        local = [...local.filter(o => o.id !== oath.id), oath];
        view.querySelector('.eo-choose')?.classList.add('is-lit');
        await new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650));
        const next = nextChildWithoutOath(roster.map(s => s.id), local, studentIdNow);
        if (next && !studentId && ceremony) {
            try { await choose(next); }
            catch { choosing = null; ceremony = false; renderBoard(); }
            return;
        }
        choosing = null; filter = 'all'; ceremony = false; renderBoard();
        showToast(next ? 'Promise lit! 🔥' : 'Every hero has a promise! ✨', 'success');
    }

    // ─── A promise's story ──────────────────────────────────────────────────────
    async function openOath(id) {
        const oath = local.find(o => o.id === id); if (!oath) return;
        focusId = id;
        facts.set(id, await api.getOathFacts(oath));
        renderOath();
    }
    function renderOath() {
        const oath = local.find(o => o.id === focusId); if (!oath) return renderBoard();
        const student = roster.find(s => s.id === oath.studentId);
        const r = resultFor(oath), meta = CATEGORY_META[oath.category] || CATEGORY_META.virtue;
        const missing = r.count < r.target ? (r.target - r.count) + ' more moment' + (r.target - r.count > 1 ? 's' : '') : '';
        const needsFlame = !r.hasFlame;
        const moments = ['Kept their word today', ...(QUICK_MOMENTS[oath.category] || QUICK_MOMENTS.habit)];
        const kept = keptFor(oath.studentId).length;
        setView('<div class="eo-story eo-story--' + meta.hue + (r.ready ? ' is-ready' : '') + '">' +
            '<div class="eo-choose-top"><button type="button" class="eo-back" data-back>← Board</button><span class="eo-pill">🗓️ ' + esc(dueLabel(oath)) + ' · until ' + esc(prettyDate(oath.dueDate)) + '</span></div>' +
            '<div class="eo-story-grid"><section class="eo-scroll">' +
                '<div class="eo-story-hero">' + avatarHtml(student, 'lg') + '<div><h3 class="font-title">' + esc(student?.name) + '</h3><div class="eo-story-tags">' + categoryChip(oath.category) + (kept ? '<span class="eo-chip eo-chip--gold">⭐ ' + kept + ' kept before</span>' : '') + '</div></div></div>' +
                '<div class="eo-story-name">' + spiritRibbon(oathName(oath).spirit) + '<span class="eo-story-title">' + esc(oathName(oath).title) + '</span></div>' +
                '<blockquote class="eo-story-oath font-title"><span class="eo-quote" aria-hidden="true">“</span>' + esc(oath.text) + '</blockquote>' +
                '<div class="eo-story-progress">' + emberRow(r.count, r.target, true) + '<p>' + (r.ready ? '<b>Ready to keep!</b> Every ember is glowing.' : 'Growing: ' + [missing, needsFlame ? 'one 🔥 check-in' : ''].filter(Boolean).join(' and ') + ' to go.') + '</p></div>' +
                (r.ready ? '<section class="eo-keep"><h4 class="font-title">✨ Keep the Ember</h4><p>How does ' + esc(student?.name) + ' feel about it?</p><div class="eo-feelings">' +
                    FEELINGS.map(([e, label], i) => '<button type="button" data-feeling="' + e + '" aria-pressed="' + (i === 0) + '"><span aria-hidden="true">' + e + '</span><small>' + label + '</small></button>').join('') + '</div>' +
                    '<input class="eo-helped" maxlength="200" placeholder="What helped? (optional)" aria-label="What helped">' +
                    '<button type="button" class="eo-primary is-wide is-gold" data-keep><span aria-hidden="true">⭐</span> Keep the promise</button></section>' : '') +
            '</section><div class="eo-story-side">' +
                '<section class="eo-panel"><h4>Today</h4>' + moodButtons(oath, true) +
                    ((oath.checkIns || []).length ? '<div class="eo-checkin-strip" aria-label="Recent check-ins">' + oath.checkIns.slice(-8).map(ci => '<span title="' + esc(prettyDate(ci.date)) + '">' + (MOODS.find(m => m[0] === ci.mood)?.[1] || '·') + '<small>' + esc(prettyDate(ci.date)) + '</small></span>').join('') + '</div>' : '') + '</section>' +
                '<section class="eo-panel"><h4>Moments</h4><div class="eo-quick">' + moments.map(m => '<button type="button" data-moment="' + esc(m) + '"><span aria-hidden="true">＋</span>' + esc(m) + '</button>').join('') +
                    '<button type="button" data-moment-own><span aria-hidden="true">✏️</span>Something else…</button></div>' +
                    '<form class="eo-moment-form" hidden><input maxlength="160" placeholder="What did you notice?" aria-label="Describe the moment"><button class="eo-primary is-small">Add</button></form>' +
                    '<ol class="eo-timeline">' + (r.evidence.length ? [...r.evidence].reverse().map(e => '<li><span class="eo-tl-icon" aria-hidden="true">' + (EVIDENCE_ICON[e.kind] || '✨') + '</span><span class="eo-tl-text">' + esc(e.label) + '</span><time>' + esc(prettyDate(e.date)) + '</time></li>').join('')
                        : '<li class="eo-tl-empty">Moments appear here, some by themselves' + (oath.evidenceRule === 'virtue' ? ' as you award ' + esc(oath.target?.reason || '') + ' stars' : '') + '.</li>') + '</ol></section>' +
                '<button type="button" class="eo-release" data-release>Let this promise go</button>' +
            '</div></div></div>', 'story');
    }
    function renderKept(oath) {
        const student = roster.find(s => s.id === oath.studentId);
        setView('<div class="eo-kept"><div class="eo-kept-rays" aria-hidden="true"></div><div class="eo-kept-burst" aria-hidden="true">' + Array.from({ length: 14 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</div>' +
            '<div class="eo-kept-star" aria-hidden="true">🌟</div>' + avatarHtml(student, 'lg') +
            '<p class="eo-kept-eyebrow">' + esc(oathName(oath).title) + ' · kept</p><h3 class="font-title">' + esc(student?.name) + ' kept a promise!</h3><p class="eo-kept-quote font-title">“' + esc(oath.text) + '”</p>' +
            '<p class="eo-muted">A Star-Ember is in their Trophy Room, and a new star shines in the Campfire sky.</p>' +
            '<div class="eo-kept-actions">' + (canUseFeature('parentAccess') ? '<button type="button" class="eo-secondary" data-share="' + esc(oath.id) + '"><span aria-hidden="true">💌</span> Share with family</button>' : '') +
            '<button type="button" class="eo-secondary" data-new-for="' + esc(oath.studentId) + '"><span aria-hidden="true">✨</span> Choose the next promise</button>' +
            '<button type="button" class="eo-primary" data-back>Back to the board</button></div></div>', 'kept');
    }
    function renderShare(oath) {
        const student = roster.find(s => s.id === oath.studentId);
        setView('<div class="eo-share"><div class="eo-choose-top"><button type="button" class="eo-back" data-back>← Board</button></div>' +
            '<div class="eo-story-hero">' + avatarHtml(student, 'lg') + '<div><h3 class="font-title">A note for ' + esc(student?.name) + '’s family</h3><p class="eo-muted">Only this message is shared. Moments and reflections stay with you.</p></div></div>' +
            '<form data-publish="' + esc(oath.id) + '"><textarea maxlength="500" required>' + esc(student?.name + ' kept a promise: “' + oath.text + '” 🌟') + '</textarea>' +
            '<button class="eo-primary is-wide"><span aria-hidden="true">💌</span> Send to Family Portal</button></form></div>', 'share');
    }

    // ─── Events ─────────────────────────────────────────────────────────────────
    function onClick(event) {
        const b = event.target.closest('button'); if (!b || closed) return;
        if (b.hasAttribute('data-close')) return close();
        if (busy) return;
        if (b.hasAttribute('data-back')) { choosing = null; focusId = null; return renderBoard(); }
        if (b.dataset.filter) { filter = b.dataset.filter; return renderBoard(); }
        if (b.hasAttribute('data-ceremony')) { const first = nextChildWithoutOath(roster.map(r => r.id), local); return first && work(() => choose(first, { fromCeremony: true })); }
        if (b.dataset.choose) return work(() => choose(b.dataset.choose, { fromCeremony: false }));
        if (b.dataset.newFor) return work(() => choose(b.dataset.newFor, { fromCeremony: false }));
        if (b.hasAttribute('data-more')) {
            if (!choosing) return;
            choosing.offset += 3; choosing.selected = null; choosing.editing = false;
            choosing.suggestions = suggestOaths(choosing.profile, { offset: choosing.offset, lens: choosing.lens, all: choosing.all });
            return refreshAltar({ shuffle: true });
        }
        if (b.dataset.lens !== undefined) {
            if (!choosing) return;
            choosing.lens = b.dataset.lens; choosing.offset = 0; choosing.selected = null; choosing.editing = false;
            choosing.suggestions = suggestOaths(choosing.profile, { offset: 0, lens: choosing.lens, all: choosing.all });
            return refreshAltar({ shuffle: true });
        }
        if (b.dataset.love) {
            if (!choosing || b.classList.contains('is-noted')) return;
            const id = b.dataset.love, on = !choosing.loves.has(id);
            if (on) choosing.loves.add(id); else choosing.loves.delete(id);
            choosing.lens = on ? 'interest:' + id : (choosing.lens === 'interest:' + id ? '' : choosing.lens);
            choosing.offset = 0; choosing.selected = null; choosing.editing = false;
            deal(); refreshAltar({ shuffle: true });
            saveLoves(choosing.student, [...choosing.loves]);
            return;
        }
        if (b.hasAttribute('data-loves-more')) { if (!choosing) return; choosing.lovesOpen = true; const loves = view.querySelector('.eo-loves'); if (loves) { loves.classList.add('is-open'); loves.innerHTML = lovesHtml(); } return; }
        if (b.hasAttribute('data-adjust')) {
            if (!choosing || typeof choosing.selected !== 'number') return;
            choosing.editing = true;
            const own = view.querySelector('.eo-own'), input = own?.querySelector('input');
            if (own && input) { own.hidden = false; own.querySelector('span').textContent = 'Their promise, in their words'; input.value = choosing.suggestions[choosing.selected]?.text || ''; input.focus(); input.select(); }
            syncAdjust(); return refreshCommit();
        }
        if (b.dataset.open) return work(() => openOath(b.dataset.open));
        if (b.dataset.pick !== undefined) {
            if (!choosing) return;
            const next = b.dataset.pick === 'own' ? 'own' : Number(b.dataset.pick);
            if (next !== choosing.selected) choosing.editing = false;
            choosing.selected = next;
            view.querySelectorAll('[data-pick]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            const own = view.querySelector('.eo-own'); if (!own) return refreshCommit();
            own.hidden = choosing.selected !== 'own' && !choosing.editing;
            if (choosing.selected === 'own') { const input = own.querySelector('input'); if (input && !choosing.ownTyped) input.value = ''; input?.focus(); }
            syncAdjust();
            return refreshCommit();
        }
        if (b.hasAttribute('data-skip-child')) {
            const next = ceremony ? nextChildWithoutOath(roster.map(r => r.id), local, choosing?.id) : null;
            if (next && next !== choosing?.id) return work(() => choose(next));
            ceremony = false; choosing = null; return renderBoard();
        }
        if (b.hasAttribute('data-commit')) return work(commitChoice);
        if (b.hasAttribute('data-oracle')) return work(async () => {
            const [{ requestCampfireAi }, { oraclePrompt, acceptOracleIdea }] = await Promise.all([
                import('../../features/campfire/campfireAi.js'),
                import('../../features/oathSuggestCore.mjs')
            ]);
            const shown = choosing.suggestions.map(s => s.text);
            const { system, data } = oraclePrompt(choosing.profile, shown);
            const result = await requestCampfireAi(system, data);
            const idea = acceptOracleIdea(result, shown, band);
            if (!idea) throw new Error('The Oracle has nothing new this time — the ideas above are ready.');
            const own = view.querySelector('.eo-oath--own');
            choosing.selected = 'own'; choosing.editing = false; choosing.ownTyped = true; view.querySelectorAll('[data-pick]').forEach(x => x.setAttribute('aria-pressed', String(x === own)));
            const field = view.querySelector('.eo-own');
            if (field) { field.hidden = false; const input = field.querySelector('input'); if (input) input.value = idea.text; }
            const why = own?.querySelector('.eo-oath-why'); if (why) why.textContent = '🔮 ' + idea.why;
            syncAdjust();
            b.remove(); refreshCommit();
        });
        if (b.dataset.check) return work(async () => {
            const updated = await api.checkInEmberOath(b.dataset.check, b.dataset.mood);
            local = local.map(o => o.id === updated.id ? updated : o);
            const group = b.closest('.eo-moods');
            group?.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            group?.classList.add('is-done');
            b.classList.remove('is-popping'); void b.offsetWidth; b.classList.add('is-popping');
            if (screen === 'story') renderOath(); else renderStats();
        });
        if (b.dataset.moment) return work(async () => {
            await api.addEmberEvidence(focusId, b.dataset.moment);
            local = await api.loadEmberOaths(classId); facts.set(focusId, await api.getOathFacts(local.find(o => o.id === focusId))); renderOath();
            showToast('Moment added ✨', 'success');
        });
        if (b.hasAttribute('data-moment-own')) { const form = view.querySelector('.eo-moment-form'); form.hidden = false; form.querySelector('input').focus(); return; }
        if (b.dataset.feeling) { view.querySelectorAll('[data-feeling]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
        if (b.hasAttribute('data-keep')) return work(async () => {
            const feeling = view.querySelector('[data-feeling][aria-pressed="true"]')?.dataset.feeling || '🌱';
            const kept = await api.keepEmberOath(focusId, { confirmed: true, reflection: { helped: view.querySelector('.eo-helped')?.value || '', next: '', emoji: feeling } });
            local = local.map(o => o.id === kept.id ? kept : o); focusId = null; renderKept(kept);
        });
        if (b.hasAttribute('data-release')) {
            const oath = local.find(o => o.id === focusId);
            return showModal('Let this promise go?', 'A different promise may fit better. Releasing it carries no penalty, and ' + esc(roster.find(s => s.id === oath?.studentId)?.name || 'the child') + ' can choose a new one.', () => work(async () => {
                await api.releaseEmberOath(focusId); local = local.map(o => o.id === focusId ? { ...o, status: 'released' } : o); focusId = null; renderBoard();
            }), 'Release it', 'Keep growing');
        }
        if (b.dataset.share) { const oath = local.find(o => o.id === b.dataset.share); return oath && renderShare(oath); }
        if (b.hasAttribute('data-promise-custom')) { const form = view.querySelector('.eo-promise-form'); form.hidden = false; form.querySelector('input').focus(); return; }
        if (b.dataset.promise) return work(() => saveClassPromise(b.dataset.promise));
    }
    async function saveClassPromise(raw) {
        const text = cleanCampfireText(raw || '', 200); if (!text) return;
        if (!preview) await updateDoc(doc(db, `${PUBLIC_DATA_PATH}/classes`, classId), { classOath: { text, updatedAt: new Date().toISOString() } });
        c.classOath = { text }; renderBoard(); showToast('Class promise saved 🤝', 'success');
    }
    function onSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (form.classList.contains('eo-promise-form')) return work(() => saveClassPromise(form.querySelector('input').value));
        if (form.classList.contains('eo-moment-form')) return work(async () => {
            const label = cleanCampfireText(form.querySelector('input').value, 160); if (!label) return;
            await api.addEmberEvidence(focusId, label);
            local = await api.loadEmberOaths(classId); facts.set(focusId, await api.getOathFacts(local.find(o => o.id === focusId))); renderOath();
        });
        if (form.dataset.publish) return work(async () => {
            const { publishEmberOath } = await import('../../utils/adminRuntime.js');
            await publishEmberOath({ oathId: form.dataset.publish, summary: form.querySelector('textarea').value, confirmed: true });
            showToast('Shared with the family 💌', 'success'); renderBoard();
        });
    }
    function onInput(event) { if (event.target.closest('.eo-own')) { if (choosing?.selected === 'own') choosing.ownTyped = true; refreshCommit(); } }
    /** A tapped passion is remembered on the student, so next time the forge already knows. Best effort. */
    async function saveLoves(student, ids) {
        student.oathInterests = ids;
        if (preview) return;
        try { await updateDoc(doc(db, `${PUBLIC_DATA_PATH}/students`, student.id), { oathInterests: ids.slice(0, 6) }); } catch { /* a student the teacher does not own: the session still remembers */ }
    }
    function onKey(event) {
        if (modal.classList.contains('hidden')) return;
        // "Let this promise go?" sits on top: Escape belongs to it, not to the board.
        if (document.getElementById('confirmation-modal')?.classList.contains('hidden') === false) {
            if (event.key === 'Escape') { event.stopPropagation(); hideModal('confirmation-modal'); }
            return;
        }
        if (event.key === 'Escape') { event.stopPropagation(); if (screen !== 'board') { choosing = null; focusId = null; renderBoard(); } else close(); }
        if (event.key === 'Enter' && screen === 'choose' && event.target.closest('.eo-own')) { event.preventDefault(); if (!busy && selectedTemplate()) work(commitChoice); }
    }
    function close() {
        if (closed) return; closed = true;
        stop(); dispose();
        hideModal(MODAL_ID);
        if (previousFocus?.isConnected) previousFocus.focus?.();
    }
    function dispose() {
        closed = true;
        modal.removeEventListener('click', onClick); modal.removeEventListener('submit', onSubmit); modal.removeEventListener('input', onInput);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('gcq:campfire-close', close); window.removeEventListener('gcq:campfire-reset', close);
        if (session?.dispose === dispose) session = null;
    }
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.addEventListener('click', onClick); modal.addEventListener('submit', onSubmit); modal.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('gcq:campfire-close', close); window.addEventListener('gcq:campfire-reset', close);
    session = { dispose };
    error.hidden = true;
    view.innerHTML = '<div class="eo-loading">' + FLAME + '<p>Gathering promises…</p></div>';
    modal.querySelector('.eo-stats').innerHTML = '';
    showAnimatedModal(MODAL_ID);
    requestAnimationFrame(() => modal.querySelector('[data-close]')?.focus({ preventScroll: true }));

    await work(async () => {
        local = await api.loadEmberOaths(classId); if (closed) return;
        api.ensureEmberOathsListener();
        stop = state.subscribe('allEmberOaths', value => {
            local = value.filter(o => o.classId === classId);
            if (!busy && screen === 'board') renderBoard(); else renderStats();
        });
        if (studentId && !activeFor(studentId) && !checkInOnly) return choose(studentId);
        if (studentId && activeFor(studentId)) return openOath(activeFor(studentId).id);
        renderBoard();
        hydrateFacts();
    });
}

// ─── Hero's Chronicle → 🔥 Oaths tab ───────────────────────────────────────────
export async function renderChronicleOaths(studentId) {
    const host = document.getElementById('hero-chronicle-content-oaths');
    if (!host) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student || !canUseFeature('heroCampfire')) { host.innerHTML = '<p class="eo-muted">Ember Oaths are part of the Pro plan.</p>'; return; }
    host.innerHTML = '<div class="eo-loading is-light"><span aria-hidden="true">🔥</span><p>Gathering promises…</p></div>';
    try {
        const oaths = (await loadEmberOaths(student.classId)).filter(o => o.studentId === studentId)
            .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0) || String(b.startDate).localeCompare(String(a.startDate)));
        if (document.getElementById('hero-chronicle-modal')?.dataset.studentId !== studentId) return;
        const active = oaths.find(o => o.status === 'active');
        const liveFacts = { awards: state.get('allAwardLogs'), writtenScores: state.get('allWrittenScores'), today: isoToday() };
        const needsWindow = active && (active.evidenceRule === 'quiz' || (active.evidenceRule === 'virtue' && active.startDate < isoToday().slice(0, 8) + '01'));
        const activeFacts = needsWindow ? await oathActions.getOathFacts(active).catch(() => liveFacts) : liveFacts;
        if (document.getElementById('hero-chronicle-modal')?.dataset.studentId !== studentId) return;
        host.innerHTML = '<div class="eo-chron">' +
            '<div class="eo-chron-head"><div><p class="eo-chron-eyebrow">EMBER OATHS</p><h3 class="font-title">Small promises, steady growth</h3><p class="eo-muted">Personal goals ' + esc(student.name) + ' chose. Separate from grades and stars.</p></div>' +
            '<button type="button" class="eo-primary" data-open-board><span aria-hidden="true">' + (active ? '🔥' : '✨') + '</span> ' + (active ? 'Open this promise' : 'Choose a promise') + '</button></div>' +
            (oaths.length ? '<div class="eo-chron-list">' + oaths.map((o, i) => {
                const r = o.status === 'active' ? evaluateOathEvidence(o, activeFacts) : null;
                const status = o.status === 'kept' ? '<span class="eo-status is-kept">⭐ Kept</span>' : o.status === 'released' ? '<span class="eo-status is-released">🍃 Released</span>' : '<span class="eo-status is-active">🔥 Growing</span>';
                return '<article class="eo-chron-item is-' + o.status + '" style="--i:' + i + '"><div class="eo-chron-item-top">' + categoryChip(o.category) + status + '</div>' +
                    '<p class="eo-card-title">' + esc(oathName(o).title) + '</p><p class="eo-chron-text">' + esc(o.text) + '</p>' +
                    (r ? '<div class="eo-card-progress">' + emberRow(r.count, r.target) + '<span class="eo-muted">' + Math.min(r.count, r.target) + '/' + r.target + ' · until ' + esc(prettyDate(o.dueDate)) + '</span></div>' : '') +
                    (o.status === 'kept' && (o.reflection?.helped || o.reflection?.emoji) ? '<p class="eo-chron-reflection">' + esc(o.reflection.emoji || '') + ' ' + esc(o.reflection.helped || '') + '</p>' : '') + '</article>';
            }).join('') + '</div>'
                : '<div class="eo-empty-state is-light"><span aria-hidden="true">🌱</span><p>No promise yet. A small one is the best start.</p></div>') + '</div>';
        host.querySelector('[data-open-board]').onclick = () => openOathBoard(student.classId, { studentId }).catch(e => showToast(e.message, 'error'));
    } catch (error) { host.innerHTML = '<p class="eo-muted">' + esc(error.message) + '</p>'; }
}
