// /features/trainingGrounds.js — the Training Grounds tab: four skill games, one per subtab.
// Story Weavers (Creativity) lives in storyWeaver.js. This file runs the other three:
// The Vanishing Hoard (Focus), The Torn Map (Teamwork) and The Round Table (Respect).
// Each class keeps its progress on its own class document (trainingGrounds.<game>), so the
// class listener already carries it live to every screen.

import '../styles/training_grounds.css';
import { db, doc, runTransaction } from '../firebase.js';
import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import { getTodayDateString } from '../utils.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import {
    TRAINING_GAMES, TRAINING_GAME_KEYS, ROUND_GAME_KEYS, TRAINING_BONUS_STARS,
    getLeagueBand, normalizeGameState, recordRound, keepsakeName, canCountRound,
    hoardLevel, hoardSettings, buildHoard, parseLessonWords,
    pickRiddle, scrapCount, hintScrapIndex, MAP_TRIES,
    councilSettings, pickCouncilQuestion, councilVerdict
} from './trainingGroundsCore.mjs';
import {
    knotsHtml, milestoneHtml, noClassHtml, hoardStageHtml, mapStageHtml, councilStageHtml,
    controlsHtml, guideHtml, shelfHtml, printableScrapsHtml, howToHtml
} from './trainingGroundsView.mjs';

const TAB_KEY = 'tg-active-game';
const LITE = (() => { try { return detectLowPowerTier(); } catch { return false; } })();
const PATH = 'artifacts/great-class-quest/public/data/classes';

const tg = {
    bound: false,
    classId: '',
    active: readActiveGame(),
    views: {},
    saved: {},
    timers: new Set(),
    saving: false
};

function readActiveGame() {
    try {
        const v = localStorage.getItem(TAB_KEY);
        return TRAINING_GAME_KEYS.includes(v) ? v : 'story';
    } catch {
        return 'story';
    }
}

function writeActiveGame(key) {
    try { localStorage.setItem(TAB_KEY, key); } catch { /* private mode */ }
}

function currentClassId() {
    return state.get('globalSelectedClassId') || '';
}

function classData(classId = tg.classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || null;
}

function bandFor(classId = tg.classId) {
    return getLeagueBand(classData(classId)?.questLevel);
}

/** The newest of what the class document says and what this screen just saved. */
function gameState(gameKey, classId = tg.classId) {
    const fromDoc = classData(classId)?.trainingGrounds?.[gameKey] || null;
    const local = tg.saved[`${classId}:${gameKey}`] || null;
    const pick = local && (!fromDoc || (Number(local.savedAt) || 0) >= (Number(fromDoc.savedAt) || 0)) ? local : fromDoc;
    return normalizeGameState(gameKey, pick);
}

function panel(gameKey) {
    return document.querySelector(`#reward-ideas-tab [data-tg-panel="${gameKey}"]`);
}

function slot(gameKey, name) {
    return panel(gameKey)?.querySelector(`[data-tg-slot="${name}"]`) || null;
}

function clearTimers() {
    for (const t of tg.timers) { clearTimeout(t); clearInterval(t); }
    tg.timers.clear();
}

function later(fn, ms) {
    const t = setTimeout(() => { tg.timers.delete(t); fn(); }, ms);
    tg.timers.add(t);
    return t;
}

// ─── Views (the in-progress round lives only on this screen) ─────────────────

function homeView(gameKey) {
    const s = gameState(gameKey);
    const band = bandFor();
    if (gameKey === 'hoard') {
        return { phase: 'vault', band, lit: s.pieces, vaultNo: s.keepsakeIndex + 1, vaultName: keepsakeName('hoard', s.keepsakeIndex), settings: hoardSettings(band, hoardLevel(s)) };
    }
    if (gameKey === 'map') {
        return { phase: 'map', band, restored: s.pieces, mapNo: s.keepsakeIndex + 1, mapName: keepsakeName('map', s.keepsakeIndex), scraps: scrapCount(band) };
    }
    return { phase: 'table', band, lit: s.pieces, bannerNo: s.keepsakeIndex + 1, bannerName: keepsakeName('council', s.keepsakeIndex) };
}

function view(gameKey) {
    if (!tg.views[gameKey]) tg.views[gameKey] = homeView(gameKey);
    return tg.views[gameKey];
}

function isIdle(v) {
    return ['vault', 'map', 'table'].includes(v.phase);
}

function goHome(gameKey) {
    clearTimers();
    const keep = tg.views[gameKey] || {};
    tg.views[gameKey] = { ...homeView(gameKey), useWords: keep.useWords, wordsText: keep.wordsText };
    renderGame(gameKey);
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderTrainingGrounds() {
    const root = document.getElementById('reward-ideas-tab');
    if (!root) return;
    bindOnce(root);
    root.querySelectorAll('.tg-layout').forEach((el) => el.classList.toggle('sw--lite', LITE));
    const classId = currentClassId();
    if (classId !== tg.classId) {
        clearTimers();
        tg.classId = classId;
        tg.views = {};
    }
    showActiveTab();
    renderKnots();
    for (const key of ROUND_GAME_KEYS) renderGame(key, { keepStage: true });
}

function showActiveTab() {
    document.querySelectorAll('#tg-tabs [data-tg-game]').forEach((btn) => {
        const on = btn.dataset.tgGame === tg.active;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', String(on));
        btn.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('#reward-ideas-tab [data-tg-panel]').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.tgPanel !== tg.active);
    });
}

function renderKnots() {
    const storyRounds = tg.classId ? (state.get('currentStoryData')?.[tg.classId]?.storyAdditionsCount || 0) : 0;
    for (const key of TRAINING_GAME_KEYS) {
        const el = document.querySelector(`#tg-tabs [data-tg-knots="${key}"]`);
        if (!el) continue;
        const rounds = key === 'story' ? storyRounds : (tg.classId ? gameState(key).rounds : 0);
        el.innerHTML = knotsHtml(rounds);
        el.closest('.tg-tab')?.classList.toggle('is-star-next', tg.classId !== '' && rounds % 2 === 1);
    }
}

/** Story Weavers calls this when its page count changes. */
export function refreshStoryKnots() {
    renderKnots();
}

function renderGame(gameKey, { keepStage = false } = {}) {
    const stage = slot(gameKey, 'stage');
    if (!stage) return;
    const chip = panel(gameKey)?.querySelector('[data-tg-class-chip]');
    const cls = classData();
    if (chip) {
        chip.classList.toggle('hidden', !cls);
        chip.textContent = cls ? `${cls.logo || '🏰'} ${cls.name || ''}` : '';
    }
    if (!tg.classId) {
        stage.innerHTML = noClassHtml(gameKey);
        slot(gameKey, 'milestone').innerHTML = '';
        slot(gameKey, 'controls').innerHTML = '<p class="sw-step__hint">Choose a class from the header to begin.</p>';
        slot(gameKey, 'guide').innerHTML = guideHtml(gameKey, { band: 'mid', settingsLine: 'Content matches each class’s Quest League.' });
        slot(gameKey, 'shelf').innerHTML = shelfHtml(gameKey, [], false);
        return;
    }
    const v = view(gameKey);
    // A round in progress keeps its stage (and its timers) when the class document refreshes.
    if (isIdle(v)) tg.views[gameKey] = { ...homeView(gameKey), useWords: v.useWords, wordsText: v.wordsText };
    const current = tg.views[gameKey];
    if (!(keepStage && !isIdle(current) && stage.childElementCount)) {
        stage.innerHTML = gameKey === 'hoard' ? hoardStageHtml(current) : gameKey === 'map' ? mapStageHtml(current) : councilStageHtml(current);
        stage.dataset.phase = current.phase;
    }
    const s = gameState(gameKey);
    slot(gameKey, 'milestone').innerHTML = milestoneHtml(gameKey, s.rounds, { countedToday: !canCountRound(s, getTodayDateString()) });
    slot(gameKey, 'controls').innerHTML = controlsHtml(gameKey, current);
    slot(gameKey, 'guide').innerHTML = guideHtml(gameKey, { league: cls?.questLevel || '', band: bandFor(), log: s.log, settingsLine: settingsLine(gameKey) });
    slot(gameKey, 'shelf').innerHTML = shelfHtml(gameKey, s.shelf, true);
}

function settingsLine(gameKey) {
    const band = bandFor();
    if (gameKey === 'hoard') {
        const st = hoardSettings(band, hoardLevel(gameState('hoard')));
        return `${st.count} treasures, ${st.vanish} ${st.vanish === 1 ? 'vanishes' : 'vanish'}, ${st.watchSeconds} seconds to watch${st.shuffle ? ', and the hoard shuffles' : ''}. The hoard grows as runes light up.`;
    }
    if (gameKey === 'map') {
        const n = scrapCount(band);
        return `${n} groups, one scrap each, and ${n + 1} answers to choose from. Fewer groups? Give one group two scraps.`;
    }
    const cs = councilSettings(band);
    return `${cs.speakers} speakers, about ${cs.seconds} seconds each with the stone. Change the number of speakers before you begin.`;
}

// ─── How to play ─────────────────────────────────────────────────────────────

let howTo = null;

function openHowTo(gameKey, opener) {
    closeHowTo(false);
    const cls = tg.classId ? classData() : null;
    const forClass = cls && gameKey !== 'story'
        ? `For ${cls.questLevel ? `this ${cls.questLevel} class` : 'this class'}: ${settingsLine(gameKey)}`
        : '';
    // Full screen shows only the stage, so the card has to live inside it.
    const host = document.fullscreenElement || document.body;
    const wrap = document.createElement('div');
    wrap.innerHTML = howToHtml(gameKey, { forClass });
    const el = wrap.firstElementChild;
    if (!el) return;
    if (LITE) el.classList.add('is-lite');
    host.appendChild(el);
    const onKey = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeHowTo(); return; }
        if (event.key !== 'Tab') return;
        const focusable = [...el.querySelectorAll('button')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    el.addEventListener('click', (event) => {
        if (event.target.closest('[data-tg-howto-close]')) closeHowTo();
    });
    document.addEventListener('keydown', onKey, true);
    howTo = { el, onKey, opener };
    playSound('click');
    requestAnimationFrame(() => {
        el.classList.add('is-open');
        el.querySelector('.tg-howto__foot .tg-cta')?.focus({ preventScroll: true });
    });
}

function closeHowTo(restoreFocus = true) {
    if (!howTo) return;
    const { el, onKey, opener } = howTo;
    howTo = null;
    document.removeEventListener('keydown', onKey, true);
    el.classList.remove('is-open');
    el.classList.add('is-closing');
    setTimeout(() => el.remove(), LITE ? 0 : 220);
    if (restoreFocus) opener?.focus?.({ preventScroll: true });
}

// ─── Saving a round ──────────────────────────────────────────────────────────

async function saveRound(gameKey, { success, piece = null, note = '', usedId = '' }) {
    const classId = tg.classId;
    const today = getTodayDateString();
    const before = gameState(gameKey, classId);
    let outcome = recordRound(gameKey, before, { today, success, piece, note, usedId });
    tg.saving = true;
    try {
        const classRef = doc(db, PATH, classId);
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(classRef);
            if (!snap.exists()) throw new Error('Class not found');
            const fresh = normalizeGameState(gameKey, snap.data()?.trainingGrounds?.[gameKey]);
            outcome = recordRound(gameKey, fresh, { today, success, piece, note, usedId });
            transaction.update(classRef, { [`trainingGrounds.${gameKey}`]: { ...outcome.next, savedAt: Date.now() } });
        });
        tg.saved[`${classId}:${gameKey}`] = { ...outcome.next, savedAt: Date.now() };
    } catch (error) {
        console.error('Training Grounds round save failed:', error);
        showToast('This round could not be saved. Check the connection and try again.', 'error');
        return { ...outcome, counted: false, starMoment: false, failedToSave: true };
    } finally {
        tg.saving = false;
    }
    renderKnots();
    return outcome;
}

function offerStar(gameKey, classId) {
    const game = TRAINING_GAMES[gameKey];
    modals.showModal(
        `${game.skillLabel} Milestone!`,
        `Two rounds won in ${game.name}! Award a +${TRAINING_BONUS_STARS} ${game.skillLabel} Bonus Star to every student in the class?`,
        () => import('../db/actions.js').then((m) => m.awardTrainingBonusToClass(classId, gameKey)),
        'Yes, Award Bonus!',
        'No, Thanks'
    );
}

async function finishRound(gameKey, payload, applyResult) {
    if (tg.saving) return;
    const classId = tg.classId;
    const outcome = await saveRound(gameKey, payload);
    if (tg.classId !== classId) return;
    applyResult(outcome);
    renderGame(gameKey);
    if (payload.success) {
        playSound('award_2');
        celebrate(gameKey);
    } else {
        playSound('award_undo');
    }
    if (outcome.starMoment) later(() => offerStar(gameKey, classId), 1400);
}

function celebrate(gameKey) {
    const stage = panel(gameKey)?.querySelector('[data-tg-stage]');
    if (!stage) return;
    stage.classList.remove('is-celebrating');
    void stage.offsetWidth;
    stage.classList.add('is-celebrating');
    later(() => stage.classList.remove('is-celebrating'), 2600);
}

// ─── The Vanishing Hoard ─────────────────────────────────────────────────────

function hoardStart() {
    clearTimers();
    const v = view('hoard');
    const band = bandFor();
    const level = hoardLevel(gameState('hoard'));
    const lessonWords = v.useWords ? parseLessonWords(v.wordsText) : [];
    const hoard = buildHoard(band, level, { lessonWords });
    tg.views.hoard = { ...homeView('hoard'), useWords: v.useWords, wordsText: v.wordsText, phase: 'watch', hoard, settings: hoard.settings, seconds: hoard.settings.watchSeconds, marks: {}, flipped: [] };
    renderGame('hoard');
    playSound('click');
    let left = hoard.settings.watchSeconds;
    const tick = setInterval(() => {
        left -= 1;
        const el = slot('hoard', 'stage')?.querySelector('[data-tg-countdown]');
        if (el) el.textContent = String(Math.max(0, left));
        if (left <= 0) {
            clearInterval(tick);
            tg.timers.delete(tick);
            hoardSweep();
        }
    }, 1000);
    tg.timers.add(tick);
}

function hoardSweep() {
    clearTimers();
    const v = tg.views.hoard;
    if (!v || v.phase !== 'watch') return;
    v.phase = 'sweep';
    renderGame('hoard');
    playSound('writing');
    later(() => {
        if (tg.views.hoard?.phase !== 'sweep') return;
        tg.views.hoard.phase = 'recall';
        renderGame('hoard');
    }, 1700);
}

function hoardMark(id, mark) {
    const v = tg.views.hoard;
    if (!v || v.phase !== 'reveal') return;
    v.marks = { ...v.marks, [id]: mark };
    playSound(mark === 'found' ? 'star1' : 'click');
    const all = v.hoard.vanishIds.every((vid) => v.marks[vid]);
    renderGame('hoard');
    if (!all) return;
    const missed = v.hoard.treasures.filter((t) => v.hoard.vanishIds.includes(t.id) && v.marks[t.id] === 'missed').map((t) => t.word);
    const success = missed.length === 0;
    const stolen = v.hoard.treasures.filter((t) => v.hoard.vanishIds.includes(t.id));
    later(() => finishRound('hoard', {
        success,
        piece: success ? { emoji: stolen[0]?.emoji || '', word: stolen.map((t) => t.word).join(', '), note: `${v.hoard.treasures.length} treasures` } : null,
        note: success ? `Named ${stolen.map((t) => t.word).join(', ')}` : `Missed ${missed.join(', ')}`
    }, (outcome) => {
        const s = gameState('hoard');
        tg.views.hoard = { ...tg.views.hoard, phase: 'result', result: { ...outcome, success, missed }, lit: outcome.keepsakeDone ? 8 : s.pieces };
    }), 700);
}

// ─── The Torn Map ────────────────────────────────────────────────────────────

function mapStart(another = false) {
    const v = view('map');
    const s = gameState('map');
    const exclude = another && v.riddle ? [...s.used, v.riddle.id] : s.used;
    const riddle = pickRiddle(bandFor(), exclude);
    tg.views.map = { ...homeView('map'), phase: 'riddle', riddle, dealIndex: 0, dealShown: false, openScraps: [], out: [], attempts: 0 };
    renderGame('map');
}

function mapChoose(i) {
    const v = tg.views.map;
    if (!v || v.phase !== 'pool' || tg.saving) return;
    const r = v.riddle;
    v.attempts = (v.attempts || 0) + 1;
    if (i === r.answer) {
        playSound('star2');
        finishRound('map', {
            success: true,
            usedId: r.id,
            piece: { emoji: r.options[r.answer].emoji, word: r.options[r.answer].word, note: r.ask },
            note: `${r.ask} ${r.options[r.answer].word}${v.attempts > 1 ? ` (${v.attempts} tries)` : ''}`
        }, (outcome) => {
            const s = gameState('map');
            tg.views.map = { ...tg.views.map, phase: 'solved', result: { ...outcome, success: true }, restored: outcome.keepsakeDone ? 6 : s.pieces };
        });
        return;
    }
    v.out = [...new Set([...(v.out || []), i])];
    if (v.attempts >= MAP_TRIES) {
        finishRound('map', { success: false, note: `${r.ask} Not solved (picked ${r.options[i].word})` }, (outcome) => {
            tg.views.map = { ...tg.views.map, phase: 'solved', result: { ...outcome, success: false, picked: r.options[i].word }, restored: gameState('map').pieces };
        });
        return;
    }
    playSound('click');
    const hint = hintScrapIndex(r, v.openScraps || []);
    if (hint >= 0) v.openScraps = [...(v.openScraps || []), hint];
    v.wrongNote = hint >= 0
        ? `Not the ${r.options[i].word}! One try left. Group ${hint + 1}’s scrap is now open to help.`
        : `Not the ${r.options[i].word}! One try left. Read every scrap again.`;
    renderGame('map');
}

function mapPrint() {
    const v = tg.views.map;
    if (!v?.riddle) return;
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
        showToast('Allow pop-ups to print the scraps.', 'info');
        return;
    }
    win.document.write(printableScrapsHtml(v.riddle, classData()?.name || ''));
    win.document.close();
}

// ─── The Round Table ─────────────────────────────────────────────────────────

function councilStart(another = false) {
    const prev = tg.views.council;
    const s = gameState('council');
    const exclude = another && prev?.question ? [...s.used, prev.question.id] : s.used;
    const band = bandFor();
    const cs = councilSettings(band);
    tg.views.council = {
        ...homeView('council'), phase: 'question', question: pickCouncilQuestion(band, exclude),
        speakers: prev?.phase === 'question' ? prev.speakers : cs.speakers, seconds: cs.seconds,
        speaker: 0, echoed: [], interruptions: 0
    };
    renderGame('council');
}

function councilClose() {
    const v = tg.views.council;
    v.echoes = (v.echoed || []).length;
    v.verdict = councilVerdict({ speakers: v.speakers, echoes: v.echoes, interruptions: v.interruptions });
    v.phase = 'verdict';
    renderGame('council');
}

function councilFinish(success) {
    const v = tg.views.council;
    if (!v || v.phase !== 'verdict') return;
    finishRound('council', {
        success,
        usedId: success ? v.question.id : '',
        piece: success ? { word: v.question.text, note: `${v.speakers} voices, ${v.echoes} echoes` } : null,
        note: `${v.question.text} (${v.speakers} voices${v.interruptions ? `, ${v.interruptions} interruptions` : ''})`
    }, (outcome) => {
        const s = gameState('council');
        tg.views.council = { ...tg.views.council, phase: 'result', result: { ...outcome, success }, lit: outcome.keepsakeDone ? 6 : s.pieces };
    });
}

// ─── Events ──────────────────────────────────────────────────────────────────

function selectGame(key) {
    if (!TRAINING_GAME_KEYS.includes(key) || key === tg.active) return;
    tg.active = key;
    writeActiveGame(key);
    showActiveTab();
    if (key !== 'story') renderGame(key, { keepStage: true });
}

function toggleFullscreen(btn) {
    const stage = btn.closest('[data-tg-stage]');
    if (!stage) return;
    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    } else {
        stage.requestFullscreen?.().catch(() => showToast('Full screen is not available in this browser.', 'info'));
    }
}

function handleAction(action, btn) {
    const v = (key) => tg.views[key];
    switch (action) {
        case 'fullscreen': return toggleFullscreen(btn);
        case 'hoard-start': return hoardStart();
        case 'hoard-sweep': return hoardSweep();
        case 'hoard-check':
            if (v('hoard')?.phase !== 'recall') return;
            v('hoard').phase = 'reveal';
            return renderGame('hoard');
        case 'hoard-flip':
            if (v('hoard')?.phase !== 'reveal') return;
            v('hoard').flipped = [...new Set([...(v('hoard').flipped || []), btn.dataset.id])];
            playSound('click');
            return renderGame('hoard');
        case 'hoard-mark': return hoardMark(btn.dataset.id, btn.dataset.mark);
        case 'hoard-home': return goHome('hoard');
        case 'hoard-abandon': return goHome('hoard');
        case 'map-start': return mapStart();
        case 'map-another': return mapStart(true);
        case 'map-deal':
            v('map').phase = 'deal';
            v('map').dealIndex = 0;
            v('map').dealShown = false;
            return renderGame('map');
        case 'map-show-scrap':
            v('map').dealShown = true;
            playSound('click');
            return renderGame('map');
        case 'map-next-scrap':
            v('map').dealIndex += 1;
            v('map').dealShown = false;
            return renderGame('map');
        case 'map-pool':
            v('map').phase = 'pool';
            return renderGame('map');
        case 'map-toggle-scrap': {
            const i = Number(btn.dataset.i);
            const open = new Set(v('map').openScraps || []);
            if (open.has(i)) open.delete(i); else open.add(i);
            v('map').openScraps = [...open];
            return renderGame('map');
        }
        case 'map-choose': return mapChoose(Number(btn.dataset.i));
        case 'map-print': return mapPrint();
        case 'map-home':
        case 'map-abandon': return goHome('map');
        case 'council-start': return councilStart();
        case 'council-another': return councilStart(true);
        case 'council-speakers': {
            const c = v('council');
            c.speakers = Math.max(2, Math.min(12, c.speakers + Number(btn.dataset.d || 0)));
            return renderGame('council');
        }
        case 'council-begin':
            v('council').phase = 'speaking';
            v('council').speaker = 1;
            playSound('click');
            return renderGame('council');
        case 'council-echo': {
            const c = v('council');
            const set = new Set(c.echoed || []);
            if (set.has(c.speaker)) set.delete(c.speaker); else { set.add(c.speaker); playSound('star1'); }
            c.echoed = [...set];
            return renderGame('council');
        }
        case 'council-interrupt':
            v('council').interruptions += 1;
            return renderGame('council');
        case 'council-pass':
            v('council').speaker += 1;
            playSound('click');
            return renderGame('council');
        case 'council-close': return councilClose();
        case 'council-honour': return councilFinish(true);
        case 'council-fail': return councilFinish(false);
        case 'council-home':
        case 'council-abandon': return goHome('council');
        default: return undefined;
    }
}

function bindOnce(root) {
    if (tg.bound) return;
    tg.bound = true;
    root.addEventListener('click', (event) => {
        const help = event.target.closest('[data-tg-help]');
        if (help && root.contains(help)) {
            openHowTo(help.dataset.tgHelp, help);
            return;
        }
        const tab = event.target.closest('#tg-tabs [data-tg-game]');
        if (tab) {
            selectGame(tab.dataset.tgGame);
            return;
        }
        const btn = event.target.closest('[data-tg-action]');
        if (!btn || btn.disabled || !root.contains(btn)) return;
        if (!tg.classId && btn.dataset.tgAction !== 'fullscreen') return;
        handleAction(btn.dataset.tgAction, btn);
    });
    root.querySelector('#tg-tabs')?.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const keys = TRAINING_GAME_KEYS;
        let i = keys.indexOf(tg.active);
        if (event.key === 'ArrowLeft') i = (i + keys.length - 1) % keys.length;
        if (event.key === 'ArrowRight') i = (i + 1) % keys.length;
        if (event.key === 'Home') i = 0;
        if (event.key === 'End') i = keys.length - 1;
        event.preventDefault();
        selectGame(keys[i]);
        document.getElementById(`tg-tab-${keys[i]}`)?.focus();
    });
    root.addEventListener('change', (event) => {
        const input = event.target.closest('[data-tg-input="hoard-use-words"]');
        if (!input) return;
        view('hoard').useWords = input.checked;
        renderGame('hoard');
        if (input.checked) slot('hoard', 'controls')?.querySelector('[data-tg-input="hoard-words"]')?.focus();
    });
    root.addEventListener('input', (event) => {
        const area = event.target.closest('[data-tg-input="hoard-words"]');
        if (area) view('hoard').wordsText = area.value;
    });
    document.addEventListener('fullscreenchange', () => {
        document.querySelectorAll('#reward-ideas-tab [data-tg-action="fullscreen"] span').forEach((s) => {
            s.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
        });
    });
}
