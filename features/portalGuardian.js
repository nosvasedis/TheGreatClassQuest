// features/portalGuardian.js
// The Portal Guardian (from Quest Level 4): once a class has filled its goal and lit every
// other Portal rune, the Guardian asks riddles at the gate. The class answers aloud, the
// teacher judges each one (Right / Not this time), and enough right answers open the Portal.
// One try per lesson day; a miss takes nothing away (stars and runes stay lit).
// Riddles: the class's own grammar from the Grammar Forge plus the Wheel's riddle bank, at the
// league's level (utils/wheelChallenges.mjs). Rules: questRanksCore.mjs (guardianTestFor).
// Motion: transform and opacity only; the lite tier and reduced motion keep it still.
import '../styles/quest_ranks.css';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { db, doc, updateDoc, increment, serverTimestamp } from '../firebase.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { drawChallenge, challengeBand } from '../utils/wheelChallenges.mjs';
import { classPortalStatus, ownsClass } from './questPortal.js';
import { riddleHtml, endHtml } from './portalGuardianView.mjs';


let session = null;

function render() {
    if (!session) return;
    const done = session.finished;
    session.host.innerHTML = done ? endHtml(session, session.passed) : riddleHtml(session);
}

async function loadForgeRiddles(classId, league) {
    try {
        const [{ getClassBookPlan }, { BOOK_ATLAS }, forge] = await Promise.all([
            import('./bookProgress.js'), import('./bookAtlas.data.mjs'), import('./grammarForge/index.mjs')]);
        const band = challengeBand(league);
        const { recent, covered } = forge.classGrammarLines(getClassBookPlan(classId), BOOK_ATLAS);
        return band === 'e' ? forge.forgeRiddles([], 'e') : [...forge.forgeRiddles(recent, band), ...forge.forgeRiddles(covered, band)];
    } catch (err) {
        console.warn('Portal Guardian: grammar riddles', err);
        return [];
    }
}

function nextChallenge() {
    const used = session.used;
    let c = null;
    for (let i = 0; i < 8; i += 1) {
        c = drawChallenge('riddle', session.band, { previous: session.challenge, extra: session.extra });
        if (!used.has(c.text)) break;
    }
    used.add(c.text);
    session.challenge = c;
}

async function saveTry(classId, passed) {
    const monthKey = utils.getMonthKey();
    const base = `portalGuardian.${monthKey}`;
    const patch = { [`${base}.lastTry`]: utils.getLocalIsoDateString(), [`${base}.tries`]: increment(1) };
    if (passed) patch[`${base}.passedAt`] = serverTimestamp();
    await updateDoc(doc(db, `${PUBLIC_DATA_PATH}/classes`, classId), patch);
}

async function finish(passed) {
    const classId = session.classData.id;
    session.finished = true;
    session.passed = passed;
    render();
    import('../audio.js').then(({ playSound }) => playSound(passed ? 'hero_fanfare' : 'magic_chime')).catch(() => {});
    try {
        await saveTry(classId, passed);
    } catch (error) {
        console.warn('Portal Guardian: could not save the try', error);
        import('../ui/effects.js').then(({ notify }) => notify({ type: 'error', message: 'The Guardian\'s answer could not be saved. Please try again.' })).catch(() => {});
        return;
    }
    if (passed) {
        const { checkAndRecordQuestCompletion } = await import('../db/actions/stars.js');
        await checkAndRecordQuestCompletion(classId).catch((err) => console.warn('Portal Guardian: crossing failed', err));
    }
}

function close() {
    if (!session) return;
    const { host, onKey } = session;
    document.removeEventListener('keydown', onKey);
    host.classList.add('is-leaving');
    session = null;
    setTimeout(() => host.remove(), 220);
}

function onClick(event) {
    if (!session) return;
    if (event.target.closest('[data-pg-close]')) { close(); return; }
    const btn = event.target.closest('[data-pg-act]');
    if (!btn || session.finished) return;
    const act = btn.dataset.pgAct;
    if (act === 'answer') {
        btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
        return;
    }
    if (act === 'another') { nextChallenge(); render(); return; }
    session.results.push(act === 'right');
    import('../audio.js').then(({ playSound }) => playSound(act === 'right' ? 'star3' : 'quiz_question_in')).catch(() => {});
    const right = session.results.filter(Boolean).length;
    const left = session.questions - session.results.length;
    if (right >= session.toPass) { finish(true); return; }
    if (right + left < session.toPass) { finish(false); return; }
    nextChallenge();
    render();
}

/** Opens the Guardian for a class whose Portal waits on it. */
export async function openPortalGuardian(classId) {
    if (session) return;
    const classData = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
    const notice = (message) => import('../ui/effects.js').then(({ notify }) => notify({ type: 'info', title: 'The Portal Guardian', icon: '🗝️', message })).catch(() => {});
    if (!classData) return;
    if (!ownsClass(classData)) { notice('Only the class\'s own teacher can call the Guardian.'); return; }
    const status = classPortalStatus(classData);
    if (!status?.guardian) return;
    if (status.open) { notice(`${classData.name} has already stepped through this month.`); return; }
    if (!status.guardian.awake) { notice('The Guardian wakes once the stars fill the goal and every other rune is lit.'); return; }
    if (status.guardian.triedToday) { notice('The Guardian has spoken today. Try again next lesson.'); return; }

    const host = document.createElement('div');
    host.className = `pg-host${detectLowPowerTier() ? ' pg-host--lite' : ''}`;
    document.body.appendChild(host);
    const league = classData.questLevel || state.get('globalSelectedLeague') || '';
    session = {
        host,
        classData,
        status,
        band: challengeBand(league),
        extra: [],
        used: new Set(),
        challenge: null,
        results: [],
        questions: status.guardian.questions,
        toPass: status.guardian.toPass,
        finished: false,
        passed: false,
        onKey: (e) => { if (e.key === 'Escape') close(); }
    };
    host.addEventListener('click', onClick);
    document.addEventListener('keydown', session.onKey);
    session.extra = await loadForgeRiddles(classId, league);
    if (!session) return;
    nextChallenge();
    render();
    import('../audio.js').then(({ playSound }) => playSound('magic_chime')).catch(() => {});
}
